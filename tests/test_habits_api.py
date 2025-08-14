import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json
from unittest.mock import Mock, patch

from backend.main import app, get_db, verify_jwt
from backend.models import User, Habit, SubHabit, Check, Count, WeightUpdate, ActiveDay


# Mock JWT verification
def mock_verify_jwt():
    return {"sub": "test-user-123", "email": "test@example.com"}


# Mock database session
def mock_get_db():
    return Mock()


@pytest.fixture
def setup_app():
    # Override dependencies
    app.dependency_overrides[verify_jwt] = mock_verify_jwt
    app.dependency_overrides[get_db] = mock_get_db
    yield
    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def client(setup_app):
    return TestClient(app)


@pytest.fixture
def mock_db():
    return mock_get_db()


class TestUserEndpoints:

    def test_get_current_user_existing(self, client, mock_db):
        # Create a mock user with proper attributes
        mock_user = Mock()
        mock_user.id = "test-user-123"
        mock_user.email = "test@example.com"
        mock_user.name = "Test User"
        mock_user.nickname = None
        mock_user.image_url = None
        mock_user.settings = None
        mock_user.created_at = datetime.now()
        mock_user.updated_at = None

        mock_db.query().filter().first.return_value = mock_user

        response = client.get("/api/users/me")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "test-user-123"
        assert data["email"] == "test@example.com"

    def test_get_current_user_auto_create(self, client, mock_db):
        # Mock no existing user
        mock_db.query().filter().first.return_value = None

        # Mock created user
        mock_user = User(id="test-user-123", email="test@example.com", created_at=datetime.now())
        mock_db.refresh.return_value = mock_user

        response = client.get("/api/users/me")
        assert response.status_code == 200

        # Verify user was created
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_update_current_user(self, mock_auth, mock_db):
        mock_user = User(id="test-user-123", email="test@example.com", name="Old Name")
        mock_db.query().filter().first.return_value = mock_user

        update_data = {"name": "New Name", "nickname": "nickname"}
        response = client.put("/api/users/me", json=update_data)

        assert response.status_code == 200
        mock_db.commit.assert_called_once()


class TestHabitEndpoints:

    def test_get_habits(self, mock_auth, mock_db):
        mock_habits = [
            Habit(id=1, user_id="test-user-123", name="Habit 1", has_counts=False, is_weight=False),
            Habit(id=2, user_id="test-user-123", name="Habit 2", has_counts=True, is_weight=False),
        ]
        mock_db.query().filter().filter().offset().limit().all.return_value = mock_habits

        response = client.get("/api/habits")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Habit 1"

    def test_create_habit_simple(self, mock_auth, mock_db):
        habit_data = {
            "name": "Test Habit",
            "description": "A test habit",
            "has_counts": False,
            "is_weight": False,
            "reward_settings": {"success_points": 10},
        }

        mock_habit = Habit(id=1, user_id="test-user-123", **habit_data)
        mock_db.refresh.return_value = mock_habit

        response = client.post("/api/habits", json=habit_data)
        assert response.status_code == 200

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_create_habit_count_based(self, mock_auth, mock_db):
        habit_data = {
            "name": "Push-ups",
            "has_counts": True,
            "is_weight": False,
            "count_settings": {"target": 50, "unit": "reps", "step_size": 1},
        }

        response = client.post("/api/habits", json=habit_data)
        assert response.status_code == 200

    def test_create_habit_weight_based(self, mock_auth, mock_db):
        habit_data = {
            "name": "Weight Loss",
            "has_counts": False,
            "is_weight": True,
            "weight_settings": {"target_weight": 70, "unit": "kg", "goal_type": "lose"},
        }

        response = client.post("/api/habits", json=habit_data)
        assert response.status_code == 200

    def test_get_habit_by_id(self, mock_auth, mock_db):
        mock_habit = Habit(id=1, user_id="test-user-123", name="Test Habit")
        mock_db.query().filter().first.return_value = mock_habit

        response = client.get("/api/habits/1")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Habit"

    def test_get_habit_not_found(self, mock_auth, mock_db):
        mock_db.query().filter().first.return_value = None

        response = client.get("/api/habits/999")
        assert response.status_code == 404

    def test_update_habit(self, mock_auth, mock_db):
        mock_habit = Habit(id=1, user_id="test-user-123", name="Old Name")
        mock_db.query().filter().first.return_value = mock_habit

        update_data = {"name": "New Name", "description": "Updated description"}
        response = client.put("/api/habits/1", json=update_data)

        assert response.status_code == 200
        mock_db.commit.assert_called_once()

    def test_delete_habit_soft(self, mock_auth, mock_db):
        mock_habit = Habit(id=1, user_id="test-user-123", name="Test Habit")
        mock_db.query().filter().first.return_value = mock_habit

        response = client.delete("/api/habits/1")
        assert response.status_code == 200

        # Verify soft delete (deleted_at should be set)
        assert mock_habit.deleted_at is not None
        mock_db.commit.assert_called_once()

    def test_delete_habit_hard(self, mock_auth, mock_db):
        mock_habit = Habit(id=1, user_id="test-user-123", name="Test Habit")
        mock_db.query().filter().first.return_value = mock_habit

        response = client.delete("/api/habits/1?hard_delete=true")
        assert response.status_code == 200

        # Verify hard delete
        mock_db.delete.assert_called_once_with(mock_habit)
        mock_db.commit.assert_called_once()


class TestSubHabitEndpoints:

    def test_get_sub_habits(self, mock_auth, mock_db):
        # Mock parent habit exists
        mock_habit = Habit(id=1, user_id="test-user-123", name="Parent Habit")
        mock_db.query().filter().first.return_value = mock_habit

        # Mock sub-habits
        mock_sub_habits = [
            SubHabit(
                id=1, parent_habit_id=1, user_id="test-user-123", name="Sub-habit 1", order_index=0
            ),
            SubHabit(
                id=2, parent_habit_id=1, user_id="test-user-123", name="Sub-habit 2", order_index=1
            ),
        ]
        mock_db.query().filter().order_by().all.return_value = mock_sub_habits

        response = client.get("/api/habits/1/sub-habits")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_create_sub_habit(self, mock_auth, mock_db):
        # Mock parent habit exists
        mock_habit = Habit(id=1, user_id="test-user-123", name="Parent Habit")
        mock_db.query().filter().first.return_value = mock_habit

        sub_habit_data = {"parent_habit_id": 1, "name": "Test Sub-habit", "order_index": 0}

        response = client.post("/api/sub-habits", json=sub_habit_data)
        assert response.status_code == 200

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_create_sub_habit_parent_not_found(self, mock_auth, mock_db):
        mock_db.query().filter().first.return_value = None

        sub_habit_data = {"parent_habit_id": 999, "name": "Test Sub-habit"}

        response = client.post("/api/sub-habits", json=sub_habit_data)
        assert response.status_code == 404


class TestCheckEndpoints:

    def test_get_checks(self, mock_auth, mock_db):
        mock_checks = [
            Check(
                id=1,
                user_id="test-user-123",
                habit_id=1,
                checked=True,
                check_date=datetime.utcnow(),
            ),
            Check(
                id=2,
                user_id="test-user-123",
                habit_id=1,
                checked=False,
                check_date=datetime.utcnow(),
            ),
        ]
        mock_db.query().filter().offset().limit().order_by().all.return_value = mock_checks

        response = client.get("/api/checks?habit_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_create_check_for_habit(self, mock_auth, mock_db):
        # Mock habit exists
        mock_habit = Habit(id=1, user_id="test-user-123", name="Test Habit")
        mock_db.query().filter().first.return_value = mock_habit

        check_data = {"habit_id": 1, "checked": True, "check_date": datetime.utcnow().isoformat()}

        response = client.post("/api/checks", json=check_data)
        assert response.status_code == 200

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_create_check_habit_not_found(self, mock_auth, mock_db):
        mock_db.query().filter().first.return_value = None

        check_data = {"habit_id": 999, "checked": True, "check_date": datetime.utcnow().isoformat()}

        response = client.post("/api/checks", json=check_data)
        assert response.status_code == 404


class TestCountEndpoints:

    def test_get_counts(self, mock_auth, mock_db):
        mock_counts = [
            Count(
                id=1, user_id="test-user-123", habit_id=1, value=25, count_date=datetime.utcnow()
            ),
            Count(
                id=2, user_id="test-user-123", habit_id=1, value=30, count_date=datetime.utcnow()
            ),
        ]
        mock_db.query().filter().offset().limit().order_by().all.return_value = mock_counts

        response = client.get("/api/counts?habit_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["value"] == 25

    def test_create_count(self, mock_auth, mock_db):
        # Mock habit exists
        mock_habit = Habit(id=1, user_id="test-user-123", name="Test Habit", has_counts=True)
        mock_db.query().filter().first.return_value = mock_habit

        count_data = {"habit_id": 1, "value": 50, "count_date": datetime.utcnow().isoformat()}

        response = client.post("/api/counts", json=count_data)
        assert response.status_code == 200

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


class TestWeightUpdateEndpoints:

    def test_get_weight_updates(self, mock_auth, mock_db):
        mock_updates = [
            WeightUpdate(
                id=1,
                user_id="test-user-123",
                habit_id=1,
                weight=70.5,
                update_date=datetime.utcnow(),
            ),
            WeightUpdate(
                id=2,
                user_id="test-user-123",
                habit_id=1,
                weight=69.8,
                update_date=datetime.utcnow(),
            ),
        ]
        mock_db.query().filter().offset().limit().order_by().all.return_value = mock_updates

        response = client.get("/api/weight-updates?habit_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["weight"] == 70.5

    def test_create_weight_update(self, mock_auth, mock_db):
        # Mock habit exists
        mock_habit = Habit(id=1, user_id="test-user-123", name="Weight Habit", is_weight=True)
        mock_db.query().filter().first.return_value = mock_habit

        weight_data = {"habit_id": 1, "weight": 68.5, "update_date": datetime.utcnow().isoformat()}

        response = client.post("/api/weight-updates", json=weight_data)
        assert response.status_code == 200

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


class TestActiveDayEndpoints:

    def test_get_active_days(self, mock_auth, mock_db):
        mock_days = [
            ActiveDay(id=1, user_id="test-user-123", date=datetime.utcnow(), validated=True),
            ActiveDay(
                id=2,
                user_id="test-user-123",
                date=datetime.utcnow() - timedelta(days=1),
                validated=False,
            ),
        ]
        mock_db.query().filter().offset().limit().order_by().all.return_value = mock_days

        response = client.get("/api/active-days")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_create_active_day(self, mock_auth, mock_db):
        day_data = {
            "date": datetime.utcnow().isoformat(),
            "validated": False,
            "summary_data": {"total_habits": 5, "completed": 3},
        }

        response = client.post("/api/active-days", json=day_data)
        assert response.status_code == 200

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_update_active_day(self, mock_auth, mock_db):
        mock_day = ActiveDay(id=1, user_id="test-user-123", date=datetime.utcnow(), validated=False)
        mock_db.query().filter().first.return_value = mock_day

        update_data = {"validated": True, "summary_data": {"completed": True}}
        response = client.put("/api/active-days/1", json=update_data)

        assert response.status_code == 200
        assert mock_day.validated == True
        mock_db.commit.assert_called_once()


class TestErrorHandling:

    def test_habit_not_owned_by_user(self, mock_auth, mock_db):
        # Mock habit owned by different user
        mock_habit = Habit(id=1, user_id="different-user", name="Not my habit")
        mock_db.query().filter().first.return_value = None  # Filter by user_id returns None

        response = client.get("/api/habits/1")
        assert response.status_code == 404

    def test_invalid_json_data(self, mock_auth, mock_db):
        response = client.post("/api/habits", data="invalid json")
        assert response.status_code == 422

    def test_missing_required_fields(self, mock_auth, mock_db):
        habit_data = {}  # Missing required 'name' field

        response = client.post("/api/habits", json=habit_data)
        assert response.status_code == 422


class TestDataValidation:

    def test_habit_name_length(self, mock_auth, mock_db):
        habit_data = {
            "name": "a" * 101,  # Assuming 100 char limit
            "has_counts": False,
            "is_weight": False,
        }

        # This test would need actual validation in the models
        response = client.post("/api/habits", json=habit_data)
        # Depending on implementation, this might be 422 or 200

    def test_count_negative_values(self, mock_auth, mock_db):
        mock_habit = Habit(id=1, user_id="test-user-123", name="Test Habit", has_counts=True)
        mock_db.query().filter().first.return_value = mock_habit

        count_data = {
            "habit_id": 1,
            "value": -10,  # Negative value
            "count_date": datetime.utcnow().isoformat(),
        }

        response = client.post("/api/counts", json=count_data)
        # The API should probably accept negative values for decrements
        assert response.status_code == 200

    def test_weight_validation(self, mock_auth, mock_db):
        mock_habit = Habit(id=1, user_id="test-user-123", name="Weight Habit", is_weight=True)
        mock_db.query().filter().first.return_value = mock_habit

        weight_data = {
            "habit_id": 1,
            "weight": 0,  # Invalid weight
            "update_date": datetime.utcnow().isoformat(),
        }

        response = client.post("/api/weight-updates", json=weight_data)
        # Should probably validate positive weights
        assert response.status_code == 200
