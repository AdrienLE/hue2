import os
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Stub out JWT verification in auth module to return a fake user
import backend.auth as auth_module

fake_user = {
    "sub": "testuser",
    "name": "Test User",
    "nickname": "Tester",
    "email": "test@example.com",
    "picture": "http://example.com/pic.jpg",
}
auth_module._get_rsa_key = lambda token: {}
auth_module.jwt.decode = lambda token, key, algorithms, audience, issuer, **kwargs: fake_user

import backend.models  # ensure models are registered
from backend.database import Base
from backend.main import app, get_db
import backend.main as main_module

# Set up a fresh file-based SQLite database for tests
TEST_DATABASE_URL = "sqlite:///./test_main.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


# Ensure a clean database state for each test
@pytest.fixture(autouse=True)
def clear_db():
    # Drop and recreate all tables to isolate tests
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


client = TestClient(app)
# Use a dummy auth header to satisfy HTTPBearer security
auth_headers = {"Authorization": "Bearer testtoken"}


# Cleanup test database file after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    yield
    try:
        os.remove("test_main.db")
    except Exception:
        pass


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "swoosh-api"
    # Optional service statuses reflect configuration (may be configured in env)
    assert data["openai"] in ("configured", "not configured")
    assert data["storage"] in ("configured", "not configured")
    assert data["database"] == "connected"


def test_get_settings_initial():
    resp = client.get("/api/settings", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # Should return the user settings structure with string values
    assert set(data.keys()) == {"name", "nickname", "email", "imageUrl"}
    for value in data.values():
        assert isinstance(value, str)


def test_post_settings_and_get():
    # Update only the name
    update_payload = {"name": "New Name"}
    resp = client.post("/api/settings", json=update_payload, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    # Retrieve settings and verify update
    resp2 = client.get("/api/settings", headers=auth_headers)
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["name"] == "New Name"
    # Other fields should remain from auth profile
    assert data["nickname"] == fake_user["nickname"]
    assert data["email"] == fake_user["email"]
    assert data["imageUrl"] == fake_user["picture"]


def test_user_settings_updates_merge_and_reward_adjustments_are_incremental():
    user = client.get("/api/users/me", headers=auth_headers)
    assert user.status_code == 200
    starting_total = float((user.json().get("settings") or {}).get("total_rewards", 0))

    first = client.put(
        "/api/users/me",
        json={"settings": {"theme": "dark", "day_rollover_hour": 4}},
        headers=auth_headers,
    )
    assert first.status_code == 200
    second = client.put(
        "/api/users/me", json={"settings": {"theme": "light"}}, headers=auth_headers
    )
    assert second.status_code == 200
    assert second.json()["settings"]["theme"] == "light"
    assert second.json()["settings"]["day_rollover_hour"] == 4

    add = client.post("/api/users/me/rewards/adjust", json={"delta": 3.5}, headers=auth_headers)
    subtract = client.post(
        "/api/users/me/rewards/adjust", json={"delta": -1.25}, headers=auth_headers
    )
    assert add.json()["total_rewards"] == starting_total + 3.5
    assert subtract.json()["total_rewards"] == starting_total + 2.25


def test_activity_endpoints_validate_target_and_habit_type():
    client.get("/api/users/me", headers=auth_headers)
    plain = client.post("/api/habits", json={"name": "Plain"}, headers=auth_headers).json()
    count = client.post(
        "/api/habits", json={"name": "Count", "has_counts": True}, headers=auth_headers
    ).json()

    missing_target = client.post(
        "/api/checks",
        json={"check_date": "2026-07-12T12:00:00Z"},
        headers=auth_headers,
    )
    assert missing_target.status_code == 422

    wrong_count_type = client.post(
        "/api/counts",
        json={"habit_id": plain["id"], "value": 1, "count_date": "2026-07-12T12:00:00Z"},
        headers=auth_headers,
    )
    assert wrong_count_type.status_code == 422

    valid_count = client.post(
        "/api/counts",
        json={"habit_id": count["id"], "value": 1, "count_date": "2026-07-12T12:00:00Z"},
        headers=auth_headers,
    )
    assert valid_count.status_code == 200


def test_weight_updates_filter_and_return_latest_first():
    first_habit = client.post(
        "/api/habits",
        json={
            "name": "Morning weight",
            "is_weight": True,
            "weight_settings": {"starting_weight": 180, "target_weight": 170, "unit": "lbs"},
        },
        headers=auth_headers,
    ).json()
    second_habit = client.post(
        "/api/habits",
        json={"name": "Evening weight", "is_weight": True},
        headers=auth_headers,
    ).json()

    for habit_id, weight, update_date in (
        (first_habit["id"], 180.0, "2026-07-12T08:00:00Z"),
        (first_habit["id"], 179.4, "2026-07-13T08:00:00Z"),
        (second_habit["id"], 150.0, "2026-07-14T08:00:00Z"),
    ):
        response = client.post(
            "/api/weight-updates",
            json={"habit_id": habit_id, "weight": weight, "update_date": update_date},
            headers=auth_headers,
        )
        assert response.status_code == 200

    latest = client.get(
        f"/api/weight-updates?habit_id={first_habit['id']}&limit=1",
        headers=auth_headers,
    )

    assert latest.status_code == 200
    assert [(item["habit_id"], item["weight"]) for item in latest.json()] == [
        (first_habit["id"], 179.4)
    ]


def test_nugget_api_no_openai_fallback():
    """Test that nugget API returns fallback text when OpenAI is not configured"""
    # This test verifies the fallback behavior we added
    resp = client.get("/api/nugget", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # The response should be a string (either from database or fallback)
    assert isinstance(data.get("text"), str)
    assert len(data.get("text", "")) > 0


def test_upload_profile_picture_not_configured():
    # Since no object storage bucket is set, should return 500 error
    files = {"file": ("test.jpg", b"dummy data", "image/jpeg")}
    resp = client.post("/api/upload-profile-picture", files=files, headers=auth_headers)
    assert resp.status_code == 500
    detail = resp.json().get("detail", "")
    # Depending on env, either bucket not configured or upload fails
    assert detail == "Object storage bucket not configured" or detail.startswith("Upload failed")


def test_upload_profile_picture_rejects_spoofed_image_content(monkeypatch):
    class DummyStorage:
        def upload_fileobj(self, *args, **kwargs):
            raise AssertionError("invalid image must not be uploaded")

    monkeypatch.setattr(main_module, "profile_picture_storage", DummyStorage())
    files = {"file": ("fake.jpg", b"this is not an image", "image/jpeg")}
    response = client.post("/api/upload-profile-picture", files=files, headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid image"


def test_serve_spa_root_and_fallback():
    # Root path should serve index.html
    resp_root = client.get("/")
    assert resp_root.status_code == 200
    assert "<!DOCTYPE html>" in resp_root.text

    # Non-existent path should also serve index.html
    resp_fallback = client.get("/nonexistent/path")
    assert resp_fallback.status_code == 200
    assert "<!DOCTYPE html>" in resp_fallback.text


def test_serve_spa_static_file():
    # An existing HTML file (index.html) should be served as-is
    resp = client.get("/index.html")
    assert resp.status_code == 200
    assert "<!DOCTYPE html>" in resp.text


def test_fetch_auth0_userinfo_success(monkeypatch):
    """Test successful Auth0 userinfo fetching"""
    import requests
    from backend.main import fetch_auth0_userinfo
    import backend.main as main_module

    # Mock AUTH0_DOMAIN to be available in main module
    monkeypatch.setattr(main_module, "AUTH0_DOMAIN", "test-domain.auth0.com")

    # Mock requests.get to return successful response
    class MockResponse:
        status_code = 200

        def json(self):
            return {
                "sub": "google-oauth2|123456",
                "name": "John Doe",
                "nickname": "johndoe",
                "email": "john@example.com",
                "picture": "https://example.com/pic.jpg",
            }

    monkeypatch.setattr(requests, "get", lambda *args, **kwargs: MockResponse())

    # Test the function
    userinfo = fetch_auth0_userinfo("test_access_token")

    assert userinfo["name"] == "John Doe"
    assert userinfo["email"] == "john@example.com"
    assert userinfo["picture"] == "https://example.com/pic.jpg"


def test_fetch_auth0_userinfo_error(monkeypatch):
    """Test Auth0 userinfo fetching with HTTP error"""
    import requests
    from backend.main import fetch_auth0_userinfo
    import backend.main as main_module

    # Mock AUTH0_DOMAIN to be available in main module
    monkeypatch.setattr(main_module, "AUTH0_DOMAIN", "test-domain.auth0.com")

    # Mock requests.get to return error response
    class MockResponse:
        status_code = 401

    monkeypatch.setattr(requests, "get", lambda *args, **kwargs: MockResponse())

    # Test the function
    userinfo = fetch_auth0_userinfo("invalid_token")

    assert userinfo == {}


def test_fetch_auth0_userinfo_exception(monkeypatch):
    """Test Auth0 userinfo fetching with exception"""
    import requests
    from backend.main import fetch_auth0_userinfo
    import backend.main as main_module

    # Mock AUTH0_DOMAIN to be available in main module
    monkeypatch.setattr(main_module, "AUTH0_DOMAIN", "test-domain.auth0.com")

    # Mock requests.get to raise exception
    def mock_get(*args, **kwargs):
        raise requests.RequestException("Network error")

    monkeypatch.setattr(requests, "get", mock_get)

    # Test the function
    userinfo = fetch_auth0_userinfo("test_token")

    assert userinfo == {}


def test_settings_with_userinfo_integration(monkeypatch):
    """Test that settings endpoint uses userinfo when profile fields are missing"""
    import requests
    from backend import models
    import backend.main as main_module

    # Mock AUTH0_DOMAIN to be available
    monkeypatch.setattr(main_module, "AUTH0_DOMAIN", "test-domain.auth0.com")

    # Mock requests.get to return userinfo
    class MockResponse:
        status_code = 200

        def json(self):
            return {
                "sub": "integration_testuser",
                "name": "Full Name From Auth0",
                "nickname": "auth0nick",
                "email": "auth0@example.com",
                "picture": "https://auth0.com/pic.jpg",
            }

    monkeypatch.setattr(requests, "get", lambda *args, **kwargs: MockResponse())

    # Clear any existing settings for this user
    db = TestingSessionLocal()
    try:
        db.query(models.UserSettings).filter(
            models.UserSettings.user_id == "integration_testuser"
        ).delete()
        db.commit()
    finally:
        db.close()

    # Mock JWT user with minimal info (simulating what might come from JWT)
    minimal_user = {"sub": "integration_testuser"}
    auth_module.jwt.decode = lambda token, key, algorithms, audience, issuer, **kwargs: minimal_user

    # Use different auth header to avoid conflict with other tests
    integration_auth_headers = {"Authorization": "Bearer integration_testtoken"}

    # First call to settings should fetch from userinfo and populate database
    resp = client.get("/api/settings", headers=integration_auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    # Should have populated from userinfo
    assert data["name"] == "Full Name From Auth0"
    assert data["nickname"] == "auth0nick"
    assert data["email"] == "auth0@example.com"
    assert data["imageUrl"] == "https://auth0.com/pic.jpg"
