import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.main import app
from backend import mcp_server


@pytest.fixture
def isolated_mcp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "mcp.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    monkeypatch.setattr(mcp_server, "_db_session", TestingSessionLocal)
    monkeypatch.setattr(
        mcp_server,
        "_current_payload",
        lambda: {
            "sub": "mcp-user",
            "email": "mcp@example.com",
            "name": "MCP User",
        },
    )
    yield TestingSessionLocal


def test_mcp_metadata_and_auth_challenge():
    with TestClient(app) as client:
        metadata = client.get("/.well-known/oauth-protected-resource/mcp")
        assert metadata.status_code == 200
        assert metadata.json()["resource"].endswith("/mcp")

        response = client.post("/mcp/", json={})
        assert response.status_code == 401
        assert response.json()["error"] == "invalid_token"


def test_mcp_habit_state_and_idempotent_check(isolated_mcp_db):
    created = mcp_server.create_habit(
        name="Drink water",
        habit_type="count",
        weekdays=[6],
        count_settings={"target": 8, "unit": "glasses", "step_size": 1},
    )

    state = mcp_server.get_habit_state(at="2026-05-02T10:00:00-07:00")
    assert state["logical_day"]["date"] == "2026-05-02"
    assert state["logical_day"]["day_of_week"] == 6
    assert state["totals"]["scheduled"] == 1
    assert state["habits"][0]["scheduled_for_logical_day"] is True
    assert state["habits"][0]["checked"] is False

    first_check = mcp_server.check_habit(
        habit_id=created["id"],
        at="2026-05-02T10:30:00-07:00",
    )
    second_check = mcp_server.check_habit(
        habit_id=created["id"],
        at="2026-05-02T11:00:00-07:00",
    )

    assert first_check["created"] is True
    assert second_check["created"] is False

    checked_state = mcp_server.get_habit_state(at="2026-05-02T12:00:00-07:00")
    assert checked_state["habits"][0]["checked"] is True
    assert checked_state["habits"][0]["tracked_today"] is True
    assert checked_state["totals"]["remaining_scheduled"] == 0


def test_mcp_count_weight_and_sub_habit_tools(isolated_mcp_db):
    normal = mcp_server.create_habit(name="Morning routine")
    sub_habit = mcp_server.create_sub_habit(parent_habit_id=normal["id"], name="Stretch")
    sub_check = mcp_server.check_sub_habit(
        sub_habit_id=sub_habit["id"],
        at="2026-05-02T08:00:00-07:00",
    )
    assert sub_check["created"] is True

    count_habit = mcp_server.create_habit(
        name="Read",
        habit_type="count",
        count_settings={"target": 30, "unit": "minutes"},
    )
    count = mcp_server.record_count(
        habit_id=count_habit["id"],
        value=15,
        at="2026-05-02T09:00:00-07:00",
    )
    assert count["value"] == 15

    weight_habit = mcp_server.create_habit(
        name="Weigh in",
        habit_type="weight",
        weight_settings={"starting_weight": 180, "target_weight": 170, "unit": "lbs"},
    )
    weight = mcp_server.record_weight(
        habit_id=weight_habit["id"],
        weight=179.5,
        at="2026-05-02T09:15:00-07:00",
    )
    assert weight["weight"] == 179.5

    state = mcp_server.get_habit_state(at="2026-05-02T12:00:00-07:00")
    by_name = {habit["name"]: habit for habit in state["habits"]}
    assert by_name["Morning routine"]["sub_habits"][0]["checked"] is True
    assert by_name["Read"]["count"]["total"] == 15
    assert by_name["Weigh in"]["weight"]["current"] == 179.5
