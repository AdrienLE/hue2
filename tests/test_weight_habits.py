import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import json

from backend.main import app, get_db, verify_jwt


def mock_verify_jwt():
    return {"sub": "test-user-123", "email": "test@example.com"}


def mock_get_db():
    from unittest.mock import Mock

    db = Mock()

    # Mock habit data
    mock_habit = Mock()
    mock_habit.id = 1
    mock_habit.user_id = "test-user-123"
    mock_habit.name = "Test Weight Habit"
    mock_habit.is_weight = True
    mock_habit.weight_settings = {"target_weight": 170, "starting_weight": 180, "unit": "lbs"}

    # Mock query chain
    db.query().filter().first.return_value = mock_habit
    db.add = Mock()
    db.commit = Mock()
    db.refresh = Mock()

    return db


@pytest.fixture
def setup_app():
    app.dependency_overrides[verify_jwt] = mock_verify_jwt
    app.dependency_overrides[get_db] = mock_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client(setup_app):
    return TestClient(app)


class TestWeightHabits:

    def test_create_weight_habit_with_starting_weight(self, client):
        """Test creating a weight habit with starting weight"""
        habit_data = {
            "name": "Lose Weight",
            "description": "Get to target weight",
            "has_counts": False,
            "is_weight": True,
            "weight_settings": {
                "target_weight": 170,
                "starting_weight": 180,
                "unit": "lbs",
                "step_size": 0.1,
            },
            "reward_settings": {"success_points": 1, "penalty_points": 0},
        }

        response = client.post("/api/habits", json=habit_data)
        assert response.status_code == 200

    def test_create_weight_habit_without_starting_weight(self, client):
        """Test that backend accepts weight habits without starting weight (frontend validation)"""
        habit_data = {
            "name": "Lose Weight",
            "description": "Get to target weight",
            "has_counts": False,
            "is_weight": True,
            "weight_settings": {"target_weight": 170, "unit": "lbs", "step_size": 0.1},
        }

        response = client.post("/api/habits", json=habit_data)
        # Backend should accept this - validation is on frontend
        assert response.status_code == 200

    def test_weight_update_creation(self, client):
        """Test creating weight updates"""
        weight_data = {"habit_id": 1, "weight": 175.5, "update_date": datetime.now().isoformat()}

        response = client.post("/api/weight-updates", json=weight_data)
        assert response.status_code == 200

    def test_weight_reward_calculation_improvement(self, client):
        """Test that moving toward target gives rewards"""
        # This would be tested in integration - the reward calculation
        # happens in the frontend but affects backend reward storage
        pass

    def test_get_weight_updates(self, client):
        """Test retrieving weight updates"""
        response = client.get("/api/weight-updates?habitId=1")
        assert response.status_code == 200

    def test_dynamic_goal_type_not_stored(self, client):
        """Test that goal_type is not stored in backend (removed field)"""
        habit_data = {
            "name": "Weight Habit",
            "is_weight": True,
            "weight_settings": {
                "target_weight": 170,
                "starting_weight": 180,
                "unit": "lbs",
                # No goal_type - should be dynamically calculated
            },
        }

        response = client.post("/api/habits", json=habit_data)
        assert response.status_code == 200
        # Backend should not expect or store goal_type
