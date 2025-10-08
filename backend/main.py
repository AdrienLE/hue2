from fastapi import (
    FastAPI,
    Depends,
    UploadFile,
    File,
    HTTPException,
    Request,
)
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exception_handlers import http_exception_handler
from sqlalchemy.orm import Session
from sqlalchemy import text
from .auth import verify_jwt, AUTH0_DOMAIN
import os
from contextlib import asynccontextmanager
from openai import OpenAI
import boto3
from uuid import uuid4
import logging
import requests

from .database import Base, engine, SessionLocal
from . import models


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.error").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.access").setLevel(logging.DEBUG)

models.Base.metadata.create_all(bind=engine)

# Manual migration to add new columns if they don't exist
try:
    with engine.connect() as connection:
        # Check if nickname column exists
        result = connection.execute(text("PRAGMA table_info(user_settings)"))
        columns = [row[1] for row in result.fetchall()]

        if "nickname" not in columns:
            logger.info("Adding nickname column to user_settings table")
            connection.execute(text("ALTER TABLE user_settings ADD COLUMN nickname TEXT"))
            connection.commit()

        if "email" not in columns:
            logger.info("Adding email column to user_settings table")
            connection.execute(text("ALTER TABLE user_settings ADD COLUMN email TEXT"))
            connection.commit()
except Exception as e:
    logger.error(f"Migration failed: {e}")
    # Continue anyway - columns might already exist

# Initialize optional services with error handling
try:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
except Exception as e:
    logger.warning(f"OpenAI client initialization failed: {e}")
    client = None

try:
    s3_client = boto3.client("s3") if os.getenv("AWS_ACCESS_KEY_ID") else None
    S3_BUCKET = os.getenv("AWS_S3_BUCKET")
except Exception as e:
    logger.warning(f"S3 client initialization failed: {e}")
    s3_client = None
    S3_BUCKET = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("DEBUG_STARTUP") in {"1", "true", "TRUE"}:
        logger.info("🚀 FastAPI application starting up...")
        logger.info(f"Python version: {__import__('sys').version}")
        logger.info(f"Working directory: {os.getcwd()}")
        logger.info(f"Environment variables: PORT={os.getenv('PORT')}")
        logger.info(f"Frontend dist exists: {os.path.exists('frontend/dist')}")
    yield


app = FastAPI(lifespan=lifespan)


# Startup logs handled by lifespan above


@app.get("/health")
def health_check():
    """Health check endpoint for Railway deployment"""
    return {
        "status": "healthy",
        "service": "base-app-api",
        "openai": "configured" if client else "not configured",
        "s3": "configured" if s3_client else "not configured",
        "database": "connected",
    }


@app.exception_handler(HTTPException)
async def log_http_exception(request: Request, exc: HTTPException):
    logger.error(
        "HTTPException %s %s: %s",
        request.method,
        request.url,
        exc.detail,
        exc_info=True,
    )
    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def log_unhandled_exception(request: Request, exc: Exception):
    logger.exception("Unhandled exception for %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_nugget() -> str:
    if not client:
        return "Wisdom comes from experience, and experience comes from making mistakes."

    prompt = "Provide a short nugget of wisdom in one sentence."
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=30,
    )
    return completion.choices[0].message.content.strip()


@app.get("/api/nugget")
def read_nugget(
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    nugget = db.query(models.Nugget).first()
    if not nugget:
        text = generate_nugget()
        nugget = models.Nugget(text=text)
        db.add(nugget)
        db.commit()
        db.refresh(nugget)
    return {"text": nugget.text}


@app.post("/api/nugget/regenerate")
def regenerate_nugget(
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    text = generate_nugget()
    nugget = db.query(models.Nugget).first()
    if not nugget:
        nugget = models.Nugget(text=text)
        db.add(nugget)
    else:
        nugget.text = text
    db.commit()
    db.refresh(nugget)
    return {"text": nugget.text}


# Pydantic models for habit tracking
class SettingsIn(BaseModel):
    name: str | None = None
    nickname: str | None = None
    email: str | None = None
    imageUrl: str | None = None


class HabitBase(BaseModel):
    name: str
    description: Optional[str] = None
    has_counts: bool = False
    is_weight: bool = False
    count_settings: Optional[Dict[str, Any]] = None
    weight_settings: Optional[Dict[str, Any]] = None
    schedule_settings: Optional[Dict[str, Any]] = None
    reward_settings: Optional[Dict[str, Any]] = None
    display_settings: Optional[Dict[str, Any]] = None


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    has_counts: Optional[bool] = None
    is_weight: Optional[bool] = None
    count_settings: Optional[Dict[str, Any]] = None
    weight_settings: Optional[Dict[str, Any]] = None
    schedule_settings: Optional[Dict[str, Any]] = None
    reward_settings: Optional[Dict[str, Any]] = None
    display_settings: Optional[Dict[str, Any]] = None
    deleted_at: Optional[datetime] = None


class HabitResponse(HabitBase):
    id: int
    user_id: str
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubHabitBase(BaseModel):
    name: str
    description: Optional[str] = None
    order_index: int = 0
    reward_settings: Optional[Dict[str, Any]] = None


class SubHabitCreate(SubHabitBase):
    parent_habit_id: int


class SubHabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    reward_settings: Optional[Dict[str, Any]] = None


class SubHabitResponse(SubHabitBase):
    id: int
    parent_habit_id: int
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CheckCreate(BaseModel):
    habit_id: Optional[int] = None
    sub_habit_id: Optional[int] = None
    checked: bool = True
    check_date: datetime
    metadata_json: Optional[Dict[str, Any]] = None


class CheckResponse(BaseModel):
    id: int
    user_id: str
    habit_id: Optional[int] = None
    sub_habit_id: Optional[int] = None
    checked: bool
    check_date: datetime
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CountCreate(BaseModel):
    habit_id: int
    value: float
    count_date: datetime
    metadata_json: Optional[Dict[str, Any]] = None


class CountResponse(BaseModel):
    id: int
    user_id: str
    habit_id: int
    value: float
    count_date: datetime
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WeightUpdateCreate(BaseModel):
    habit_id: int
    weight: float
    update_date: datetime
    metadata_json: Optional[Dict[str, Any]] = None


class WeightUpdateResponse(BaseModel):
    id: int
    user_id: str
    habit_id: int
    weight: float
    update_date: datetime
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActiveDayCreate(BaseModel):
    date: datetime
    validated: bool = False
    summary_data: Optional[Dict[str, Any]] = None


class ActiveDayResponse(BaseModel):
    id: int
    user_id: str
    date: datetime
    validated: bool
    summary_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    name: Optional[str] = None
    nickname: Optional[str] = None
    image_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    image_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    nickname: Optional[str] = None
    image_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# User management endpoints
@app.post("/api/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.id == current_user["sub"]).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    db_user = models.User(
        id=current_user["sub"],
        email=user_data.email,
        name=user_data.name,
        nickname=user_data.nickname,
        image_url=user_data.image_url,
        settings=user_data.settings,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/api/users/me", response_model=UserResponse)
def get_current_user(
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    user = db.query(models.User).filter(models.User.id == current_user["sub"]).first()
    if not user:
        # Auto-create user if doesn't exist
        user = models.User(
            id=current_user["sub"],
            email=current_user.get("email", ""),
            name=current_user.get("name"),
            nickname=current_user.get("nickname"),
            image_url=current_user.get("picture"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@app.put("/api/users/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    user = db.query(models.User).filter(models.User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in user_data.dict(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


# Habit management endpoints
@app.get("/api/habits", response_model=List[HabitResponse])
def get_habits(
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    query = db.query(models.Habit).filter(models.Habit.user_id == current_user["sub"])
    if not include_deleted:
        query = query.filter(models.Habit.deleted_at.is_(None))
    habits = query.offset(skip).limit(limit).all()
    return habits


@app.post("/api/habits", response_model=HabitResponse)
def create_habit(
    habit: HabitCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    db_habit = models.Habit(user_id=current_user["sub"], **habit.dict())
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit


@app.get("/api/habits/{habit_id}", response_model=HabitResponse)
def get_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user["sub"])
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@app.put("/api/habits/{habit_id}", response_model=HabitResponse)
def update_habit(
    habit_id: int,
    habit_update: HabitUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user["sub"])
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    for field, value in habit_update.dict(exclude_unset=True).items():
        setattr(habit, field, value)

    db.commit()
    db.refresh(habit)
    return habit


@app.delete("/api/habits/{habit_id}")
def delete_habit(
    habit_id: int,
    hard_delete: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user["sub"])
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    if hard_delete:
        db.delete(habit)
    else:
        habit.deleted_at = datetime.now(timezone.utc)

    db.commit()
    return {"ok": True}


# Sub-habit management endpoints
@app.get("/api/habits/{habit_id}/sub-habits", response_model=List[SubHabitResponse])
def get_sub_habits(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    # Verify habit ownership
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user["sub"])
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    sub_habits = (
        db.query(models.SubHabit)
        .filter(
            models.SubHabit.parent_habit_id == habit_id,
            models.SubHabit.user_id == current_user["sub"],
        )
        .order_by(models.SubHabit.order_index)
        .all()
    )
    return sub_habits


@app.post("/api/sub-habits", response_model=SubHabitResponse)
def create_sub_habit(
    sub_habit: SubHabitCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    # Verify parent habit ownership
    habit = (
        db.query(models.Habit)
        .filter(
            models.Habit.id == sub_habit.parent_habit_id,
            models.Habit.user_id == current_user["sub"],
        )
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Parent habit not found")

    db_sub_habit = models.SubHabit(user_id=current_user["sub"], **sub_habit.dict())
    db.add(db_sub_habit)
    db.commit()
    db.refresh(db_sub_habit)
    return db_sub_habit


@app.put("/api/sub-habits/{sub_habit_id}", response_model=SubHabitResponse)
def update_sub_habit(
    sub_habit_id: int,
    sub_habit_update: SubHabitUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    sub_habit = (
        db.query(models.SubHabit)
        .filter(models.SubHabit.id == sub_habit_id, models.SubHabit.user_id == current_user["sub"])
        .first()
    )
    if not sub_habit:
        raise HTTPException(status_code=404, detail="Sub-habit not found")

    for field, value in sub_habit_update.dict(exclude_unset=True).items():
        setattr(sub_habit, field, value)

    db.commit()
    db.refresh(sub_habit)
    return sub_habit


@app.delete("/api/sub-habits/{sub_habit_id}")
def delete_sub_habit(
    sub_habit_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    sub_habit = (
        db.query(models.SubHabit)
        .filter(models.SubHabit.id == sub_habit_id, models.SubHabit.user_id == current_user["sub"])
        .first()
    )
    if not sub_habit:
        raise HTTPException(status_code=404, detail="Sub-habit not found")

    db.delete(sub_habit)
    db.commit()
    return {"ok": True}


# Check/uncheck endpoints
@app.get("/api/checks", response_model=List[CheckResponse])
def get_checks(
    habit_id: Optional[int] = None,
    sub_habit_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    query = db.query(models.Check).filter(models.Check.user_id == current_user["sub"])

    if habit_id:
        query = query.filter(models.Check.habit_id == habit_id)
    if sub_habit_id:
        query = query.filter(models.Check.sub_habit_id == sub_habit_id)
    if start_date:
        query = query.filter(models.Check.check_date >= start_date)
    if end_date:
        query = query.filter(models.Check.check_date <= end_date)

    checks = query.order_by(models.Check.check_date.desc()).offset(skip).limit(limit).all()
    return checks


@app.post("/api/checks", response_model=CheckResponse)
def create_check(
    check: CheckCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    # Verify ownership of habit or sub-habit
    if check.habit_id:
        habit = (
            db.query(models.Habit)
            .filter(models.Habit.id == check.habit_id, models.Habit.user_id == current_user["sub"])
            .first()
        )
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found")

    if check.sub_habit_id:
        sub_habit = (
            db.query(models.SubHabit)
            .filter(
                models.SubHabit.id == check.sub_habit_id,
                models.SubHabit.user_id == current_user["sub"],
            )
            .first()
        )
        if not sub_habit:
            raise HTTPException(status_code=404, detail="Sub-habit not found")

    db_check = models.Check(user_id=current_user["sub"], **check.dict())
    db.add(db_check)
    db.commit()
    db.refresh(db_check)
    return db_check


@app.delete("/api/checks/{check_id}")
def delete_check(
    check_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    check = (
        db.query(models.Check)
        .filter(models.Check.id == check_id, models.Check.user_id == current_user["sub"])
        .first()
    )
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    db.delete(check)
    db.commit()
    return {"ok": True}


# Count tracking endpoints
@app.get("/api/counts", response_model=List[CountResponse])
def get_counts(
    habit_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    query = db.query(models.Count).filter(models.Count.user_id == current_user["sub"])

    if habit_id:
        query = query.filter(models.Count.habit_id == habit_id)
    if start_date:
        query = query.filter(models.Count.count_date >= start_date)
    if end_date:
        query = query.filter(models.Count.count_date <= end_date)

    counts = query.order_by(models.Count.count_date.desc()).offset(skip).limit(limit).all()
    return counts


@app.post("/api/counts", response_model=CountResponse)
def create_count(
    count: CountCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    # Verify habit ownership
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == count.habit_id, models.Habit.user_id == current_user["sub"])
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    db_count = models.Count(user_id=current_user["sub"], **count.dict())
    db.add(db_count)
    db.commit()
    db.refresh(db_count)
    return db_count


# Weight tracking endpoints
@app.get("/api/weight-updates", response_model=List[WeightUpdateResponse])
def get_weight_updates(
    habit_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    query = db.query(models.WeightUpdate).filter(models.WeightUpdate.user_id == current_user["sub"])

    if habit_id:
        query = query.filter(models.WeightUpdate.habit_id == habit_id)
    if start_date:
        query = query.filter(models.WeightUpdate.update_date >= start_date)
    if end_date:
        query = query.filter(models.WeightUpdate.update_date <= end_date)

    weight_updates = (
        query.order_by(models.WeightUpdate.update_date.desc()).offset(skip).limit(limit).all()
    )
    return weight_updates


@app.post("/api/weight-updates", response_model=WeightUpdateResponse)
def create_weight_update(
    weight_update: WeightUpdateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    # Verify habit ownership
    habit = (
        db.query(models.Habit)
        .filter(
            models.Habit.id == weight_update.habit_id, models.Habit.user_id == current_user["sub"]
        )
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    db_weight_update = models.WeightUpdate(user_id=current_user["sub"], **weight_update.dict())
    db.add(db_weight_update)
    db.commit()
    db.refresh(db_weight_update)
    return db_weight_update


# Active day tracking endpoints
@app.get("/api/active-days", response_model=List[ActiveDayResponse])
def get_active_days(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    query = db.query(models.ActiveDay).filter(models.ActiveDay.user_id == current_user["sub"])

    if start_date:
        query = query.filter(models.ActiveDay.date >= start_date)
    if end_date:
        query = query.filter(models.ActiveDay.date <= end_date)

    active_days = query.order_by(models.ActiveDay.date.desc()).offset(skip).limit(limit).all()
    return active_days


@app.post("/api/active-days", response_model=ActiveDayResponse)
def create_active_day(
    active_day: ActiveDayCreate,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    db_active_day = models.ActiveDay(user_id=current_user["sub"], **active_day.dict())
    db.add(db_active_day)
    db.commit()
    db.refresh(db_active_day)
    return db_active_day


@app.put("/api/active-days/{active_day_id}", response_model=ActiveDayResponse)
def update_active_day(
    active_day_id: int,
    validated: Optional[bool] = None,
    summary_data: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user=Depends(verify_jwt),
):
    active_day = (
        db.query(models.ActiveDay)
        .filter(
            models.ActiveDay.id == active_day_id, models.ActiveDay.user_id == current_user["sub"]
        )
        .first()
    )
    if not active_day:
        raise HTTPException(status_code=404, detail="Active day not found")

    if validated is not None:
        active_day.validated = validated
    if summary_data is not None:
        active_day.summary_data = summary_data

    db.commit()
    db.refresh(active_day)
    return active_day


ALLOWED_CONTENT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
}
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", str(5 * 1024 * 1024)))  # 5 MB default


@app.post("/api/upload-profile-picture")
def upload_profile_picture(
    file: UploadFile = File(...),
    user=Depends(verify_jwt),
):
    logger.info(
        f"Upload request - filename: {file.filename}, content_type: {file.content_type}, size: {getattr(file, 'size', 'unknown')}"
    )

    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    try:
        # Validate content type
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported content type")

        # Determine size (best-effort)
        try:
            current = file.file.tell()
            file.file.seek(0, os.SEEK_END)
            size = file.file.tell()
            file.file.seek(0)
        except Exception:
            size = getattr(file, "size", 0) or 0

        if size and size > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large")

        # Determine extension, prefer MIME-derived when missing
        ext = os.path.splitext(file.filename or "image")[1]
        if not ext:
            ext = ALLOWED_CONTENT_TYPES[content_type]
        key = f"profile_pics/{user['sub']}/{uuid4().hex}{ext}"
        logger.info(f"Uploading to S3 key: {key}")

        s3_client.upload_fileobj(
            file.file,
            S3_BUCKET,
            key,
            ExtraArgs={
                "ContentType": file.content_type,
            },
        )
        url = f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
        logger.info(f"Upload successful, URL: {url}")
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


def fetch_auth0_userinfo(access_token: str) -> dict:
    """Fetch user profile information from Auth0 userinfo endpoint"""

    if not AUTH0_DOMAIN:
        return {}

    try:
        response = requests.get(
            f"https://{AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if response.status_code == 200:
            userinfo = response.json()
            logger.info(f"Fetched Auth0 userinfo: {userinfo}")
            return userinfo
        else:
            logger.warning(f"Failed to fetch userinfo: {response.status_code}")
            return {}
    except Exception as e:
        logger.error(f"Error fetching Auth0 userinfo: {e}")
        return {}


def _merge_from_profile(settings: "models.UserSettings", profile_data: dict) -> bool:
    updated = False
    if not settings.name and profile_data.get("name"):
        settings.name = profile_data["name"]
        updated = True
    elif not settings.name and profile_data.get("nickname"):
        settings.name = profile_data["nickname"]
        updated = True

    if not settings.nickname and profile_data.get("nickname"):
        settings.nickname = profile_data["nickname"]
        updated = True
    elif not settings.nickname and profile_data.get("name"):
        settings.nickname = profile_data["name"]
        updated = True

    if not settings.email and profile_data.get("email"):
        settings.email = profile_data["email"]
        updated = True

    if not settings.image_url and profile_data.get("picture"):
        settings.image_url = profile_data["picture"]
        updated = True
    return updated


@app.get("/api/settings")
def read_settings(
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
    request: Request = None,
):
    settings = (
        db.query(models.UserSettings).filter(models.UserSettings.user_id == user["sub"]).first()
    )

    # If no settings exist, create them
    if not settings:
        settings = models.UserSettings(user_id=user["sub"])
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # If any profile fields are missing, try to fetch from Auth0 userinfo endpoint
    needs_userinfo = not all([settings.name, settings.nickname, settings.email, settings.image_url])
    userinfo = {}

    if needs_userinfo and request:
        # Extract access token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            access_token = auth_header[7:]  # Remove "Bearer " prefix
            userinfo = fetch_auth0_userinfo(access_token)

    # Merge from JWT payload first, then userinfo
    updated = False
    if user:
        updated = _merge_from_profile(
            settings,
            {
                "name": user.get("name"),
                "nickname": user.get("nickname"),
                "email": user.get("email"),
                "picture": user.get("picture"),
            },
        )
    if userinfo:
        updated = _merge_from_profile(settings, userinfo) or updated

    if updated:
        db.commit()
        db.refresh(settings)
        logger.info(
            f"Updated settings for user {user['sub']} with name='{settings.name}', nickname='{settings.nickname}', email='{settings.email}', and picture='{settings.image_url}'"
        )

    return {
        "name": settings.name or "",
        "nickname": settings.nickname or "",
        "email": settings.email or "",
        "imageUrl": settings.image_url or "",
    }


@app.post("/api/settings")
def update_settings(
    data: SettingsIn,
    db: Session = Depends(get_db),
    user=Depends(verify_jwt),
):
    settings = (
        db.query(models.UserSettings).filter(models.UserSettings.user_id == user["sub"]).first()
    )
    if not settings:
        settings = models.UserSettings(user_id=user["sub"])
        db.add(settings)

    # Only update fields that are provided in the request
    if data.name is not None:
        settings.name = data.name
    if data.nickname is not None:
        settings.nickname = data.nickname
    if data.email is not None:
        settings.email = data.email
    if data.imageUrl is not None:
        settings.image_url = data.imageUrl

    db.commit()
    db.refresh(settings)
    return {"ok": True}


# Mount frontend static files AFTER all API routes are defined
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_path):
    assets_dir = os.path.join(frontend_path, "assets")
    expo_static_dir = os.path.join(frontend_path, "_expo", "static")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if os.path.isdir(expo_static_dir):
        app.mount("/_expo/static", StaticFiles(directory=expo_static_dir), name="expo-static")

    @app.get("/favicon.{ext}")
    async def serve_favicon(ext: str):
        # Handle favicon requests
        favicon_file = os.path.join(frontend_path, f"favicon.{ext}")
        if os.path.isfile(favicon_file):
            return FileResponse(favicon_file)
        # Fallback to favicon.ico if other extensions are requested
        favicon_ico = os.path.join(frontend_path, "favicon.ico")
        if os.path.isfile(favicon_ico):
            return FileResponse(favicon_ico)
        raise HTTPException(status_code=404, detail="Favicon not found")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        # Do not catch API paths
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        # Serve static files in dist root if requested path exists (e.g., favicons, manifest)
        direct_file = os.path.join(frontend_path, path)
        if os.path.isfile(direct_file):
            return FileResponse(direct_file)

        # Serve HTML for routes (path -> path.html)
        html_file = os.path.join(frontend_path, f"{path}.html")
        if os.path.isfile(html_file):
            return FileResponse(html_file)

        # Fallback to index.html for SPA routing (client-side routing)
        return FileResponse(os.path.join(frontend_path, "index.html"))

else:
    print("Frontend build not found at", frontend_path)
