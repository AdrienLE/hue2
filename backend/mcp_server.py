import os
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal

from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from pydantic import AnyHttpUrl
from sqlalchemy.orm import Session

from . import models
from .auth import AUTH0_DOMAIN, verify_jwt_token
from .database import SessionLocal


UTC = timezone.utc
DEFAULT_ROLLOVER_HOUR = 3
WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]


class Auth0TokenVerifier(TokenVerifier):
    """Validate MCP bearer tokens with the same Auth0 JWT rules as the REST API."""

    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            payload = verify_jwt_token(token)
        except HTTPException:
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        scopes = _extract_scopes(payload)
        return AccessToken(
            token=token,
            client_id=user_id,
            scopes=scopes,
            expires_at=payload.get("exp"),
            resource=_payload_resource(payload),
        )


def _extract_scopes(payload: dict[str, Any]) -> list[str]:
    scope = payload.get("scope", "")
    scopes = scope.split() if isinstance(scope, str) else []
    permissions = payload.get("permissions", [])
    if isinstance(permissions, list):
        scopes.extend(str(permission) for permission in permissions)
    return sorted(set(scopes))


def _payload_resource(payload: dict[str, Any]) -> str | None:
    audience = payload.get("aud")
    if isinstance(audience, str):
        return audience
    if isinstance(audience, list) and audience:
        return str(audience[0])
    return None


def _auth_issuer_url() -> str:
    explicit = os.getenv("MCP_ISSUER_URL")
    if explicit:
        return explicit
    if AUTH0_DOMAIN:
        domain = AUTH0_DOMAIN.removeprefix("https://").removeprefix("http://").rstrip("/")
        return f"https://{domain}/"
    return "https://auth.example.invalid/"


def _resource_server_url() -> str:
    explicit = os.getenv("MCP_RESOURCE_SERVER_URL")
    if explicit:
        return explicit

    for env_key in ("PUBLIC_API_URL", "EXPO_PUBLIC_API_URL_PRODUCTION", "EXPO_PUBLIC_API_URL"):
        value = os.getenv(env_key)
        if value:
            return value.rstrip("/") + "/mcp"

    railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN")
    if railway_domain:
        return f"https://{railway_domain.strip('/')}/mcp"

    return "http://localhost:8000/mcp"


def protected_resource_metadata() -> dict[str, Any]:
    """Return OAuth protected resource metadata for the mounted MCP endpoint."""

    return {
        "resource": _resource_server_url(),
        "authorization_servers": [_auth_issuer_url()],
        "scopes_supported": [],
        "bearer_methods_supported": ["header"],
        "resource_name": "Hue Habits MCP",
    }


habit_mcp = FastMCP(
    "Hue Habits",
    instructions=(
        "Use these tools to inspect and update the authenticated user's habits. "
        "Pass ISO 8601 datetimes with an offset when asking about a specific local time."
    ),
    token_verifier=Auth0TokenVerifier(),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(_auth_issuer_url()),
        resource_server_url=AnyHttpUrl(_resource_server_url()),
        required_scopes=[],
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
)


def _db_session() -> Session:
    return SessionLocal()


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _current_payload() -> dict[str, Any]:
    access_token = get_access_token()
    if access_token is None:
        raise PermissionError("Authentication required")
    return verify_jwt_token(access_token.token)


def _current_user_id() -> str:
    payload = _current_payload()
    user_id = payload.get("sub")
    if not user_id:
        raise PermissionError("Authenticated token is missing a subject")
    return user_id


def _ensure_user(db: Session, payload: dict[str, Any]) -> models.User:
    user_id = payload["sub"]
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        return user

    user = models.User(
        id=user_id,
        email=payload.get("email") or f"{user_id}@mcp.local",
        name=payload.get("name"),
        nickname=payload.get("nickname"),
        image_url=payload.get("picture"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _get_rollover_hour(db: Session, user_id: str) -> int:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    settings = user.settings if user and isinstance(user.settings, dict) else {}
    value = settings.get("day_rollover_hour", DEFAULT_ROLLOVER_HOUR)
    try:
        rollover = int(value)
    except (TypeError, ValueError):
        return DEFAULT_ROLLOVER_HOUR
    if 0 <= rollover <= 23:
        return rollover
    return DEFAULT_ROLLOVER_HOUR


def _timezone_from_offset(timezone_offset_minutes: int | None) -> timezone | None:
    if timezone_offset_minutes is None:
        return None
    return timezone(timedelta(minutes=timezone_offset_minutes))


def _parse_reference_time(
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
) -> datetime:
    requested_tz = _timezone_from_offset(timezone_offset_minutes)
    if not at:
        return datetime.now(requested_tz or UTC)

    value = at.strip()
    if len(value) == 10:
        parsed_date = date.fromisoformat(value)
        return datetime.combine(parsed_date, time(12, 0), tzinfo=requested_tz or UTC)

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=requested_tz or UTC)
    if requested_tz is not None:
        return parsed.astimezone(requested_tz)
    return parsed


def _logical_window(
    at: str | None,
    rollover_hour: int,
    timezone_offset_minutes: int | None,
) -> dict[str, Any]:
    reference_time = _parse_reference_time(at, timezone_offset_minutes)
    start = reference_time.replace(hour=rollover_hour, minute=0, second=0, microsecond=0)
    if reference_time < start:
        start -= timedelta(days=1)
    next_start = start + timedelta(days=1)
    logical_date = start.date().isoformat()
    return {
        "reference_time": reference_time,
        "start": start,
        "next_start": next_start,
        "start_utc": start.astimezone(UTC),
        "next_start_utc": next_start.astimezone(UTC),
        "end": next_start - timedelta(milliseconds=1),
        "logical_date": logical_date,
        "day_of_week": (start.weekday() + 1) % 7,
    }


def _validate_weekdays(weekdays: list[int] | None) -> list[int] | None:
    if weekdays is None:
        return None
    unique_weekdays = sorted(set(int(day) for day in weekdays))
    invalid = [day for day in unique_weekdays if day < 0 or day > 6]
    if invalid:
        raise ValueError("weekdays must contain integers from 0 to 6, where Sunday is 0")
    return unique_weekdays


def _habit_type(habit: models.Habit) -> str:
    if habit.has_counts:
        return "count"
    if habit.is_weight:
        return "weight"
    return "normal"


def _habit_to_dict(habit: models.Habit) -> dict[str, Any]:
    return {
        "id": habit.id,
        "user_id": habit.user_id,
        "name": habit.name,
        "description": habit.description,
        "type": _habit_type(habit),
        "has_counts": habit.has_counts,
        "is_weight": habit.is_weight,
        "count_settings": habit.count_settings,
        "weight_settings": habit.weight_settings,
        "schedule_settings": habit.schedule_settings,
        "reward_settings": habit.reward_settings,
        "display_settings": habit.display_settings,
        "deleted_at": _serialize_datetime(habit.deleted_at),
        "created_at": _serialize_datetime(habit.created_at),
        "updated_at": _serialize_datetime(habit.updated_at),
    }


def _habit_sort_key(habit: models.Habit) -> tuple[Any, float]:
    created_at = habit.created_at
    if created_at is None:
        created_timestamp = 0.0
    else:
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)
        created_timestamp = created_at.timestamp()
    return (habit.display_settings or {}).get("order", 999), created_timestamp


def _sub_habit_to_dict(sub_habit: models.SubHabit, checked: bool = False) -> dict[str, Any]:
    return {
        "id": sub_habit.id,
        "parent_habit_id": sub_habit.parent_habit_id,
        "user_id": sub_habit.user_id,
        "name": sub_habit.name,
        "description": sub_habit.description,
        "order_index": sub_habit.order_index,
        "reward_settings": sub_habit.reward_settings,
        "checked": checked,
        "created_at": _serialize_datetime(sub_habit.created_at),
        "updated_at": _serialize_datetime(sub_habit.updated_at),
    }


def _check_to_dict(check: models.Check) -> dict[str, Any]:
    return {
        "id": check.id,
        "user_id": check.user_id,
        "habit_id": check.habit_id,
        "sub_habit_id": check.sub_habit_id,
        "checked": check.checked,
        "check_date": _serialize_datetime(check.check_date),
        "metadata_json": check.metadata_json,
        "created_at": _serialize_datetime(check.created_at),
        "updated_at": _serialize_datetime(check.updated_at),
    }


def _count_to_dict(count: models.Count) -> dict[str, Any]:
    return {
        "id": count.id,
        "user_id": count.user_id,
        "habit_id": count.habit_id,
        "value": count.value,
        "count_date": _serialize_datetime(count.count_date),
        "metadata_json": count.metadata_json,
        "created_at": _serialize_datetime(count.created_at),
        "updated_at": _serialize_datetime(count.updated_at),
    }


def _weight_update_to_dict(update: models.WeightUpdate) -> dict[str, Any]:
    return {
        "id": update.id,
        "user_id": update.user_id,
        "habit_id": update.habit_id,
        "weight": update.weight,
        "update_date": _serialize_datetime(update.update_date),
        "metadata_json": update.metadata_json,
        "created_at": _serialize_datetime(update.created_at),
        "updated_at": _serialize_datetime(update.updated_at),
    }


def _get_owned_habit(db: Session, user_id: str, habit_id: int) -> models.Habit:
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == user_id)
        .first()
    )
    if not habit:
        raise ValueError("Habit not found")
    return habit


def _get_owned_sub_habit(db: Session, user_id: str, sub_habit_id: int) -> models.SubHabit:
    sub_habit = (
        db.query(models.SubHabit)
        .filter(models.SubHabit.id == sub_habit_id, models.SubHabit.user_id == user_id)
        .first()
    )
    if not sub_habit:
        raise ValueError("Sub-habit not found")
    return sub_habit


@habit_mcp.tool()
def get_habit_state(
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
    include_inactive: bool = True,
    include_completed: bool = True,
    include_deleted: bool = False,
) -> dict[str, Any]:
    """Get the authenticated user's habit state for a logical day around a given time."""

    payload = _current_payload()
    user_id = payload["sub"]

    db = _db_session()
    try:
        _ensure_user(db, payload)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)

        habit_query = db.query(models.Habit).filter(models.Habit.user_id == user_id)
        if not include_deleted:
            habit_query = habit_query.filter(models.Habit.deleted_at.is_(None))
        habits = habit_query.all()
        habits.sort(key=_habit_sort_key)

        habit_ids = [habit.id for habit in habits]
        checks = (
            db.query(models.Check)
            .filter(
                models.Check.user_id == user_id,
                models.Check.check_date >= window["start_utc"],
                models.Check.check_date < window["next_start_utc"],
            )
            .all()
        )
        counts = (
            db.query(models.Count)
            .filter(
                models.Count.user_id == user_id,
                models.Count.count_date >= window["start_utc"],
                models.Count.count_date < window["next_start_utc"],
            )
            .all()
        )
        weight_updates_today = (
            db.query(models.WeightUpdate)
            .filter(
                models.WeightUpdate.user_id == user_id,
                models.WeightUpdate.update_date >= window["start_utc"],
                models.WeightUpdate.update_date < window["next_start_utc"],
            )
            .all()
        )
        latest_weight_updates = (
            db.query(models.WeightUpdate)
            .filter(
                models.WeightUpdate.user_id == user_id,
                models.WeightUpdate.update_date <= window["reference_time"].astimezone(UTC),
            )
            .order_by(models.WeightUpdate.update_date.desc())
            .all()
        )
        sub_habits = (
            db.query(models.SubHabit)
            .filter(
                models.SubHabit.user_id == user_id, models.SubHabit.parent_habit_id.in_(habit_ids)
            )
            .order_by(models.SubHabit.order_index)
            .all()
            if habit_ids
            else []
        )

        checks_by_habit: dict[int, list[models.Check]] = defaultdict(list)
        checked_habit_ids: set[int] = set()
        checked_sub_habit_ids: set[int] = set()
        for check in checks:
            if check.habit_id is not None:
                checks_by_habit[check.habit_id].append(check)
            if check.checked and check.sub_habit_id is not None:
                checked_sub_habit_ids.add(check.sub_habit_id)
            elif check.checked and check.habit_id is not None:
                checked_habit_ids.add(check.habit_id)

        counts_by_habit: dict[int, list[models.Count]] = defaultdict(list)
        for count in counts:
            counts_by_habit[count.habit_id].append(count)

        weights_today_by_habit: dict[int, list[models.WeightUpdate]] = defaultdict(list)
        for update in weight_updates_today:
            weights_today_by_habit[update.habit_id].append(update)

        latest_weight_by_habit: dict[int, models.WeightUpdate] = {}
        for update in latest_weight_updates:
            latest_weight_by_habit.setdefault(update.habit_id, update)

        sub_habits_by_habit: dict[int, list[models.SubHabit]] = defaultdict(list)
        for sub_habit in sub_habits:
            sub_habits_by_habit[sub_habit.parent_habit_id].append(sub_habit)

        state_habits = []
        for habit in habits:
            weekdays = (habit.schedule_settings or {}).get("weekdays", WEEKDAYS)
            scheduled = window["day_of_week"] in weekdays
            checked = habit.id in checked_habit_ids
            count_entries = counts_by_habit[habit.id]
            weight_entries = weights_today_by_habit[habit.id]
            tracked_today = checked or bool(count_entries) or bool(weight_entries)
            visible_in_default_app_filter = scheduled and not checked

            if not include_inactive and not scheduled:
                continue
            if not include_completed and tracked_today:
                continue

            latest_weight = latest_weight_by_habit.get(habit.id)
            count_total = sum(count.value for count in count_entries)
            state_habits.append(
                {
                    **_habit_to_dict(habit),
                    "scheduled_for_logical_day": scheduled,
                    "checked": checked,
                    "tracked_today": tracked_today,
                    "visible_in_default_app_filter": visible_in_default_app_filter,
                    "checks": [_check_to_dict(check) for check in checks_by_habit[habit.id]],
                    "sub_habits": [
                        _sub_habit_to_dict(
                            sub_habit,
                            checked=sub_habit.id in checked_sub_habit_ids,
                        )
                        for sub_habit in sub_habits_by_habit[habit.id]
                    ],
                    "count": {
                        "total": count_total,
                        "entries": [_count_to_dict(count) for count in count_entries],
                    },
                    "weight": {
                        "current": (
                            latest_weight.weight
                            if latest_weight
                            else (habit.weight_settings or {}).get("starting_weight")
                        ),
                        "latest_update": (
                            _weight_update_to_dict(latest_weight) if latest_weight else None
                        ),
                        "entries_today": [
                            _weight_update_to_dict(update) for update in weight_entries
                        ],
                    },
                }
            )

        scheduled_count = sum(1 for habit in state_habits if habit["scheduled_for_logical_day"])
        tracked_count = sum(1 for habit in state_habits if habit["tracked_today"])
        return {
            "user_id": user_id,
            "generated_at": datetime.now(UTC).isoformat(),
            "reference_time": window["reference_time"].isoformat(),
            "logical_day": {
                "date": window["logical_date"],
                "day_of_week": window["day_of_week"],
                "rollover_hour": rollover_hour,
                "start": window["start"].isoformat(),
                "end": window["end"].isoformat(),
                "start_utc": window["start_utc"].isoformat(),
                "end_utc": (window["next_start_utc"] - timedelta(milliseconds=1)).isoformat(),
            },
            "totals": {
                "habits": len(state_habits),
                "scheduled": scheduled_count,
                "tracked": tracked_count,
                "remaining_scheduled": max(scheduled_count - tracked_count, 0),
            },
            "habits": state_habits,
        }
    finally:
        db.close()


@habit_mcp.tool()
def create_habit(
    name: str,
    description: str | None = None,
    habit_type: Literal["normal", "count", "weight"] = "normal",
    weekdays: list[int] | None = None,
    count_settings: dict[str, Any] | None = None,
    weight_settings: dict[str, Any] | None = None,
    schedule_settings: dict[str, Any] | None = None,
    reward_settings: dict[str, Any] | None = None,
    display_settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a habit for the authenticated user."""

    payload = _current_payload()
    user_id = payload["sub"]
    resolved_weekdays = _validate_weekdays(weekdays)
    resolved_schedule_settings = dict(schedule_settings or {})
    if resolved_weekdays is not None:
        resolved_schedule_settings["weekdays"] = resolved_weekdays

    db = _db_session()
    try:
        _ensure_user(db, payload)
        habit = models.Habit(
            user_id=user_id,
            name=name.strip(),
            description=description,
            has_counts=habit_type == "count",
            is_weight=habit_type == "weight",
            count_settings=count_settings if habit_type == "count" else None,
            weight_settings=weight_settings if habit_type == "weight" else None,
            schedule_settings=resolved_schedule_settings or None,
            reward_settings=reward_settings,
            display_settings=display_settings,
        )
        db.add(habit)
        db.commit()
        db.refresh(habit)
        return _habit_to_dict(habit)
    finally:
        db.close()


@habit_mcp.tool()
def update_habit(
    habit_id: int,
    name: str | None = None,
    description: str | None = None,
    habit_type: Literal["normal", "count", "weight"] | None = None,
    count_settings: dict[str, Any] | None = None,
    weight_settings: dict[str, Any] | None = None,
    schedule_settings: dict[str, Any] | None = None,
    reward_settings: dict[str, Any] | None = None,
    display_settings: dict[str, Any] | None = None,
    restore: bool = False,
) -> dict[str, Any]:
    """Update a habit owned by the authenticated user."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        habit = _get_owned_habit(db, user_id, habit_id)
        if name is not None:
            habit.name = name.strip()
        if description is not None:
            habit.description = description
        if habit_type is not None:
            habit.has_counts = habit_type == "count"
            habit.is_weight = habit_type == "weight"
        if count_settings is not None:
            habit.count_settings = count_settings
        if weight_settings is not None:
            habit.weight_settings = weight_settings
        if schedule_settings is not None:
            if "weekdays" in schedule_settings:
                schedule_settings = {
                    **schedule_settings,
                    "weekdays": _validate_weekdays(schedule_settings["weekdays"]),
                }
            habit.schedule_settings = schedule_settings
        if reward_settings is not None:
            habit.reward_settings = reward_settings
        if display_settings is not None:
            habit.display_settings = display_settings
        if restore:
            habit.deleted_at = None

        db.commit()
        db.refresh(habit)
        return _habit_to_dict(habit)
    finally:
        db.close()


@habit_mcp.tool()
def delete_habit(habit_id: int, hard_delete: bool = False) -> dict[str, Any]:
    """Delete a habit owned by the authenticated user, using soft delete by default."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        habit = _get_owned_habit(db, user_id, habit_id)
        if hard_delete:
            db.delete(habit)
        else:
            habit.deleted_at = datetime.now(UTC)
        db.commit()
        return {"ok": True, "habit_id": habit_id, "hard_delete": hard_delete}
    finally:
        db.close()


@habit_mcp.tool()
def create_sub_habit(
    parent_habit_id: int,
    name: str,
    description: str | None = None,
    order_index: int = 0,
    reward_settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a sub-habit under a habit owned by the authenticated user."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        _get_owned_habit(db, user_id, parent_habit_id)
        sub_habit = models.SubHabit(
            parent_habit_id=parent_habit_id,
            user_id=user_id,
            name=name.strip(),
            description=description,
            order_index=order_index,
            reward_settings=reward_settings,
        )
        db.add(sub_habit)
        db.commit()
        db.refresh(sub_habit)
        return _sub_habit_to_dict(sub_habit)
    finally:
        db.close()


@habit_mcp.tool()
def check_habit(
    habit_id: int,
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
    metadata: dict[str, Any] | None = None,
    allow_duplicate: bool = False,
) -> dict[str, Any]:
    """Mark a parent habit checked for the logical day containing the given time."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        _get_owned_habit(db, user_id, habit_id)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)

        existing = (
            db.query(models.Check)
            .filter(
                models.Check.user_id == user_id,
                models.Check.habit_id == habit_id,
                models.Check.sub_habit_id.is_(None),
                models.Check.check_date >= window["start_utc"],
                models.Check.check_date < window["next_start_utc"],
            )
            .first()
        )
        if existing and not allow_duplicate:
            return {"created": False, "check": _check_to_dict(existing)}

        check = models.Check(
            user_id=user_id,
            habit_id=habit_id,
            checked=True,
            check_date=window["reference_time"].astimezone(UTC),
            metadata_json=metadata,
        )
        db.add(check)
        db.commit()
        db.refresh(check)
        return {"created": True, "check": _check_to_dict(check)}
    finally:
        db.close()


@habit_mcp.tool()
def uncheck_habit(
    habit_id: int,
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
) -> dict[str, Any]:
    """Remove parent habit checks for the logical day containing the given time."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        _get_owned_habit(db, user_id, habit_id)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)
        checks = (
            db.query(models.Check)
            .filter(
                models.Check.user_id == user_id,
                models.Check.habit_id == habit_id,
                models.Check.sub_habit_id.is_(None),
                models.Check.check_date >= window["start_utc"],
                models.Check.check_date < window["next_start_utc"],
            )
            .all()
        )
        deleted_count = len(checks)
        for check in checks:
            db.delete(check)
        db.commit()
        return {"ok": True, "habit_id": habit_id, "deleted_count": deleted_count}
    finally:
        db.close()


@habit_mcp.tool()
def check_sub_habit(
    sub_habit_id: int,
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
    metadata: dict[str, Any] | None = None,
    allow_duplicate: bool = False,
) -> dict[str, Any]:
    """Mark a sub-habit checked for the logical day containing the given time."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        sub_habit = _get_owned_sub_habit(db, user_id, sub_habit_id)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)

        existing = (
            db.query(models.Check)
            .filter(
                models.Check.user_id == user_id,
                models.Check.habit_id == sub_habit.parent_habit_id,
                models.Check.sub_habit_id == sub_habit_id,
                models.Check.check_date >= window["start_utc"],
                models.Check.check_date < window["next_start_utc"],
            )
            .first()
        )
        if existing and not allow_duplicate:
            return {"created": False, "check": _check_to_dict(existing)}

        check = models.Check(
            user_id=user_id,
            habit_id=sub_habit.parent_habit_id,
            sub_habit_id=sub_habit_id,
            checked=True,
            check_date=window["reference_time"].astimezone(UTC),
            metadata_json=metadata,
        )
        db.add(check)
        db.commit()
        db.refresh(check)
        return {"created": True, "check": _check_to_dict(check)}
    finally:
        db.close()


@habit_mcp.tool()
def uncheck_sub_habit(
    sub_habit_id: int,
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
) -> dict[str, Any]:
    """Remove sub-habit checks for the logical day containing the given time."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        sub_habit = _get_owned_sub_habit(db, user_id, sub_habit_id)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)
        checks = (
            db.query(models.Check)
            .filter(
                models.Check.user_id == user_id,
                models.Check.habit_id == sub_habit.parent_habit_id,
                models.Check.sub_habit_id == sub_habit_id,
                models.Check.check_date >= window["start_utc"],
                models.Check.check_date < window["next_start_utc"],
            )
            .all()
        )
        deleted_count = len(checks)
        for check in checks:
            db.delete(check)
        db.commit()
        return {"ok": True, "sub_habit_id": sub_habit_id, "deleted_count": deleted_count}
    finally:
        db.close()


@habit_mcp.tool()
def record_count(
    habit_id: int,
    value: float,
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record a count delta or value for a count habit."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        _get_owned_habit(db, user_id, habit_id)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)
        count = models.Count(
            user_id=user_id,
            habit_id=habit_id,
            value=value,
            count_date=window["reference_time"].astimezone(UTC),
            metadata_json=metadata,
        )
        db.add(count)
        db.commit()
        db.refresh(count)
        return _count_to_dict(count)
    finally:
        db.close()


@habit_mcp.tool()
def record_weight(
    habit_id: int,
    weight: float,
    at: str | None = None,
    timezone_offset_minutes: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record a weight update for a weight habit."""

    user_id = _current_user_id()
    db = _db_session()
    try:
        _get_owned_habit(db, user_id, habit_id)
        rollover_hour = _get_rollover_hour(db, user_id)
        window = _logical_window(at, rollover_hour, timezone_offset_minutes)
        update = models.WeightUpdate(
            user_id=user_id,
            habit_id=habit_id,
            weight=weight,
            update_date=window["reference_time"].astimezone(UTC),
            metadata_json=metadata,
        )
        db.add(update)
        db.commit()
        db.refresh(update)
        return _weight_update_to_dict(update)
    finally:
        db.close()
