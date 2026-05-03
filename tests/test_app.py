import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("OPENAI_API_KEY", "test")
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.main import app, get_db, verify_jwt, generate_nugget


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_jwt] = lambda: {"sub": "user"}

    uploads = {}

    class DummyStorage:
        def upload_fileobj(self, fileobj, key, content_type=None):
            uploads[key] = fileobj.read()

        def public_object_url(self, key, request_base_url):
            return f"{request_base_url.rstrip('/')}/api/profile-picture/{key}"

        def presigned_get_url(self, key, expires_in=3600):
            return f"https://storage.example/{key}?signed=1"

    monkeypatch.setattr("backend.main.profile_picture_storage", DummyStorage())

    client = TestClient(app)
    yield client, uploads
    app.dependency_overrides.clear()


def test_nugget_generation_and_regeneration(client, monkeypatch):
    c, _ = client
    monkeypatch.setattr("backend.main.generate_nugget", lambda: "first")
    resp = c.get("/api/nugget")
    assert resp.status_code == 200
    assert resp.json() == {"text": "first"}

    resp = c.get("/api/nugget")
    assert resp.json() == {"text": "first"}

    monkeypatch.setattr("backend.main.generate_nugget", lambda: "second")
    resp = c.post("/api/nugget/regenerate")
    assert resp.status_code == 200
    assert resp.json() == {"text": "second"}

    resp = c.get("/api/nugget")
    assert resp.json() == {"text": "second"}


def test_settings_update(client):
    c, _ = client
    resp = c.get("/api/settings")
    assert resp.status_code == 200
    result = resp.json()
    assert result["name"] == ""
    assert result["imageUrl"] == ""
    assert "nickname" in result
    assert "email" in result

    resp = c.post("/api/settings", json={"name": "Alice", "imageUrl": "u"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = c.get("/api/settings")
    result = resp.json()
    assert result["name"] == "Alice"
    assert result["imageUrl"] == "u"
    assert result["nickname"] == ""
    assert result["email"] == ""


def test_upload_profile_picture(client):
    c, uploads = client
    data = {"file": ("pic.png", b"data", "image/png")}
    resp = c.post("/api/upload-profile-picture", files=data)
    assert resp.status_code == 200
    url = resp.json()["url"]
    assert url.startswith("http://testserver/api/profile-picture/profile_pics/")
    assert uploads
