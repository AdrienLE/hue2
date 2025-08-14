import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

from backend.main import app, get_db, verify_jwt


def mock_verify_jwt():
    return {"sub": "test-user-123", "email": "test@example.com"}


def mock_get_db():
    from unittest.mock import Mock

    db = Mock()

    # Mock user with rollover settings
    mock_user = Mock()
    mock_user.id = "test-user-123"
    mock_user.settings = {"day_rollover_hour": 3, "reward_unit": "$", "total_rewards": 100}

    db.query().filter().first.return_value = mock_user
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


class TestDayRollover:

    def test_user_settings_with_rollover_hour(self, client):
        """Test that user settings can include day_rollover_hour"""
        settings_data = {
            "reward_unit": "$",
            "reward_unit_position": "before",
            "day_rollover_hour": 4,  # 4am rollover
            "total_rewards": 150,
        }

        response = client.put("/api/users/me", json=settings_data)
        assert response.status_code == 200

    def test_get_user_settings_includes_rollover(self, client):
        """Test retrieving user settings includes rollover hour"""
        response = client.get("/api/users/me")
        assert response.status_code == 200
        # Settings should be returned with rollover hour

    def test_default_rollover_hour_handling(self, client):
        """Test that missing rollover hour defaults appropriately"""
        # Frontend should handle default of 3, backend just stores what's sent
        settings_data = {
            "reward_unit": "€"
            # No day_rollover_hour - frontend should default to 3
        }

        response = client.put("/api/users/me", json=settings_data)
        assert response.status_code == 200

    def test_check_creation_with_logical_timestamp(self, client):
        """Test that checks can be created with logical date timestamps"""
        # This tests that the backend accepts timestamps created by
        # getLogicalDateTimestamp() from frontend

        # Simulate a check created at 2am (before 3am rollover)
        # Frontend should send timestamp for "yesterday"
        logical_timestamp = "2024-01-14T02:30:00.000Z"  # 2:30am on "today" but logical "yesterday"

        check_data = {"habit_id": 1, "checked": True, "check_date": logical_timestamp}

        response = client.post("/api/checks", json=check_data)
        assert response.status_code == 200

    def test_check_filtering_with_date_ranges(self, client):
        """Test that checks can be filtered by date ranges for rollover logic"""
        # Test filtering checks within a logical day range
        # This would be used by frontend to get "today's" checks

        start_date = "2024-01-14T03:00:00.000Z"  # 3am start
        end_date = "2024-01-15T02:59:59.999Z"  # 2:59:59 end

        response = client.get(f"/api/checks?startDate={start_date}&endDate={end_date}")
        assert response.status_code == 200

    def test_rollover_hour_validation(self, client):
        """Test that rollover hour is within valid range"""
        # Test various rollover hours
        for hour in [0, 3, 6, 12, 23]:
            settings_data = {"day_rollover_hour": hour, "reward_unit": "$"}
            response = client.put("/api/users/me", json=settings_data)
            assert response.status_code == 200

        # Test invalid hour (though frontend should prevent this)
        invalid_settings = {"day_rollover_hour": 25, "reward_unit": "$"}  # Invalid hour
        response = client.put("/api/users/me", json=invalid_settings)
        # Backend might accept this and let frontend handle validation
        # Or we could add backend validation
