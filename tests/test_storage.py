from io import BytesIO

from backend.storage import ObjectStorage, ObjectStorageConfig


def test_storage_config_reads_railway_bucket_env(monkeypatch):
    monkeypatch.setenv("RAILWAY_BUCKET_NAME", "bucket")
    monkeypatch.setenv("RAILWAY_BUCKET_ENDPOINT", "https://storage.example")
    monkeypatch.setenv("RAILWAY_BUCKET_ACCESS_KEY_ID", "access")
    monkeypatch.setenv("RAILWAY_BUCKET_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("RAILWAY_BUCKET_REGION", "sjc")

    config = ObjectStorageConfig.from_env()

    assert config is not None
    assert config.bucket_name == "bucket"
    assert config.endpoint_url == "https://storage.example"
    assert config.region == "sjc"


def test_storage_config_requires_bucket_credentials(monkeypatch):
    for key in [
        "RAILWAY_BUCKET_NAME",
        "RAILWAY_BUCKET_ENDPOINT",
        "RAILWAY_BUCKET_ACCESS_KEY_ID",
        "RAILWAY_BUCKET_SECRET_ACCESS_KEY",
        "BUCKET_NAME",
        "BUCKET_ENDPOINT",
        "BUCKET_ACCESS_KEY_ID",
        "BUCKET_SECRET_ACCESS_KEY",
    ]:
        monkeypatch.delenv(key, raising=False)

    assert ObjectStorageConfig.from_env() is None


def test_object_storage_delegates_upload_and_signed_urls():
    calls = {}

    class FakeClient:
        def upload_fileobj(self, fileobj, bucket, key, ExtraArgs=None):
            calls["upload"] = {
                "body": fileobj.read(),
                "bucket": bucket,
                "key": key,
                "extra_args": ExtraArgs,
            }

        def generate_presigned_url(self, operation, Params, ExpiresIn):
            calls["signed"] = {
                "operation": operation,
                "params": Params,
                "expires_in": ExpiresIn,
            }
            return "https://signed.example/object"

    storage = ObjectStorage(
        ObjectStorageConfig(
            bucket_name="bucket",
            endpoint_url="https://storage.example",
            access_key_id="access",
            secret_access_key="secret",
        ),
        client=FakeClient(),
    )

    storage.upload_fileobj(BytesIO(b"image"), "profile_pics/key.jpg", "image/jpeg")
    signed_url = storage.presigned_get_url("profile_pics/key.jpg", expires_in=60)
    public_url = storage.public_object_url("profile_pics/key.jpg", "https://app.example/")

    assert calls["upload"] == {
        "body": b"image",
        "bucket": "bucket",
        "key": "profile_pics/key.jpg",
        "extra_args": {"ContentType": "image/jpeg"},
    }
    assert calls["signed"] == {
        "operation": "get_object",
        "params": {"Bucket": "bucket", "Key": "profile_pics/key.jpg"},
        "expires_in": 60,
    }
    assert signed_url == "https://signed.example/object"
    assert public_url == "https://app.example/api/profile-picture/profile_pics/key.jpg"
