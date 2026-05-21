#!/usr/bin/env python3
"""Seed a repeatable local dataset for iOS widget QA against the real backend."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_DB_PATH = "/private/tmp/hue2-widget-real-dev.db"
DEFAULT_USER_ID = "dev-widget-user"
REPO_ROOT = Path(__file__).resolve().parents[1]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="SQLAlchemy database URL to seed.")
    parser.add_argument(
        "--database-path",
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path used when --database-url is omitted. Default: {DEFAULT_DB_PATH}",
    )
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument("--email", default="widget.qa@example.com")
    parser.add_argument("--name", default="Widget QA")
    parser.add_argument(
        "--allow-non-sqlite",
        action="store_true",
        help="Allow seeding a non-SQLite DATABASE_URL. Off by default to avoid surprises.",
    )
    return parser.parse_args()


def sqlite_url(path: str) -> str:
    return f"sqlite:///{Path(path).expanduser().resolve()}"


def habit(
    *,
    user_id: str,
    name: str,
    order: int,
    has_counts: bool = False,
    is_weight: bool = False,
    count_settings: dict[str, Any] | None = None,
    weight_settings: dict[str, Any] | None = None,
):
    from backend import models

    return models.Habit(
        user_id=user_id,
        name=name,
        has_counts=has_counts,
        is_weight=is_weight,
        count_settings=count_settings,
        weight_settings=weight_settings,
        schedule_settings={"weekdays": [0, 1, 2, 3, 4, 5, 6]},
        reward_settings={"success_points": 1, "sub_habit_points": 0.25},
        display_settings={"order": order},
    )


def add_sub_habits(db, *, user_id: str, parent_id: int, names: list[str]):
    from backend import models

    sub_habits = [
        models.SubHabit(
            user_id=user_id,
            parent_habit_id=parent_id,
            name=name,
            order_index=index,
        )
        for index, name in enumerate(names)
    ]
    db.add_all(sub_habits)
    db.flush()
    return sub_habits


def seed(db, *, user_id: str, email: str, name: str) -> None:
    from backend import models

    existing_user = db.get(models.User, user_id)
    if existing_user:
        db.delete(existing_user)
        db.flush()

    db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).delete()

    now = datetime.now(timezone.utc).replace(microsecond=0)
    user = models.User(
        id=user_id,
        email=email,
        name=name,
        nickname=name,
        settings={
            "day_rollover_hour": 3,
            "reward_unit": "$",
            "reward_unit_position": "before",
            "color_brightness": 65,
            "color_saturation": 15,
        },
    )
    settings = models.UserSettings(user_id=user_id, name=name, nickname=name, email=email)
    db.add_all([user, settings])
    db.flush()

    morning = habit(user_id=user_id, name="Morning routine", order=0)
    evening = habit(user_id=user_id, name="Evening reset", order=1)
    inbox = habit(user_id=user_id, name="Inbox sweep", order=2)
    pushups = habit(
        user_id=user_id,
        name="Pushups",
        order=3,
        has_counts=True,
        count_settings={"target": 40, "unit": "reps", "step_size": 5, "count_is_good": True},
    )
    caffeine = habit(
        user_id=user_id,
        name="Caffeine",
        order=4,
        has_counts=True,
        count_settings={"target": 2, "unit": "cups", "step_size": 1, "count_is_good": False},
    )
    weight = habit(
        user_id=user_id,
        name="Weight trend",
        order=5,
        is_weight=True,
        weight_settings={
            "target_weight": 180,
            "starting_weight": 184.4,
            "unit": "lb",
            "step_size": 0.5,
        },
    )
    db.add_all([morning, evening, inbox, pushups, caffeine, weight])
    db.flush()

    morning_subs = add_sub_habits(
        db,
        user_id=user_id,
        parent_id=morning.id,
        names=["Water", "Vitamins", "Plan"],
    )
    evening_subs = add_sub_habits(
        db,
        user_id=user_id,
        parent_id=evening.id,
        names=["Kitchen", "Laundry", "Desk", "Journal", "Stretch", "Meds", "Pack", "Lights"],
    )
    inbox_subs = add_sub_habits(
        db,
        user_id=user_id,
        parent_id=inbox.id,
        names=["Email", "Mail", "Calendar", "Desk"],
    )

    db.add_all(
        [
            models.Check(
                user_id=user_id,
                habit_id=morning.id,
                sub_habit_id=morning_subs[0].id,
                checked=True,
                check_date=now,
            ),
            models.Check(
                user_id=user_id,
                habit_id=evening.id,
                sub_habit_id=evening_subs[0].id,
                checked=True,
                check_date=now,
            ),
            models.Check(
                user_id=user_id,
                habit_id=inbox.id,
                sub_habit_id=inbox_subs[0].id,
                checked=True,
                check_date=now,
            ),
            models.Count(user_id=user_id, habit_id=pushups.id, value=15, count_date=now),
            models.Count(user_id=user_id, habit_id=caffeine.id, value=1, count_date=now),
            models.WeightUpdate(user_id=user_id, habit_id=weight.id, weight=184.4, update_date=now),
        ]
    )
    db.commit()


def main() -> int:
    args = parse_args()
    database_url = args.database_url or os.getenv("DATABASE_URL") or sqlite_url(args.database_path)
    if not database_url.startswith("sqlite") and not args.allow_non_sqlite:
        print("Refusing to seed non-SQLite database without --allow-non-sqlite", file=sys.stderr)
        return 2

    os.environ["DATABASE_URL"] = database_url

    from backend import models  # noqa: F401
    from backend.database import Base, SessionLocal, engine

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db, user_id=args.user_id, email=args.email, name=args.name)
    finally:
        db.close()

    print(f"Seeded widget QA data for {args.user_id} in {database_url}")
    print("Use DEV_AUTH_TOKEN with DEV_AUTH_USER_ID set to the same user id.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
