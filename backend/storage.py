import os
from dataclasses import dataclass
from urllib.parse import quote

import boto3
from botocore.config import Config


@dataclass(frozen=True)
class ObjectStorageConfig:
    bucket_name: str
    endpoint_url: str
    access_key_id: str
    secret_access_key: str
    region: str = "auto"
    addressing_style: str = "virtual"
    public_base_url: str | None = None

    @classmethod
    def from_env(cls) -> "ObjectStorageConfig | None":
        bucket_name = os.getenv("RAILWAY_BUCKET_NAME") or os.getenv("BUCKET_NAME")
        endpoint_url = os.getenv("RAILWAY_BUCKET_ENDPOINT") or os.getenv("BUCKET_ENDPOINT")
        access_key_id = os.getenv("RAILWAY_BUCKET_ACCESS_KEY_ID") or os.getenv(
            "BUCKET_ACCESS_KEY_ID"
        )
        secret_access_key = os.getenv("RAILWAY_BUCKET_SECRET_ACCESS_KEY") or os.getenv(
            "BUCKET_SECRET_ACCESS_KEY"
        )

        if not all([bucket_name, endpoint_url, access_key_id, secret_access_key]):
            return None

        return cls(
            bucket_name=bucket_name,
            endpoint_url=endpoint_url,
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            region=os.getenv("RAILWAY_BUCKET_REGION") or os.getenv("BUCKET_REGION") or "auto",
            addressing_style=os.getenv("RAILWAY_BUCKET_ADDRESSING_STYLE")
            or os.getenv("BUCKET_ADDRESSING_STYLE")
            or "virtual",
            public_base_url=os.getenv("PUBLIC_BASE_URL"),
        )


class ObjectStorage:
    def __init__(self, config: ObjectStorageConfig, client=None):
        self.config = config
        self.client = client or boto3.client(
            "s3",
            endpoint_url=config.endpoint_url,
            region_name=config.region,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": config.addressing_style},
            ),
        )

    @classmethod
    def from_env(cls) -> "ObjectStorage | None":
        config = ObjectStorageConfig.from_env()
        if config is None:
            return None
        return cls(config)

    @property
    def bucket_name(self) -> str:
        return self.config.bucket_name

    def upload_fileobj(self, fileobj, key: str, content_type: str | None = None) -> None:
        extra_args = {"ContentType": content_type} if content_type else None
        kwargs = {"ExtraArgs": extra_args} if extra_args else {}
        self.client.upload_fileobj(fileobj, self.bucket_name, key, **kwargs)

    def presigned_get_url(self, key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )

    def public_object_url(self, key: str, request_base_url: str) -> str:
        base_url = self.config.public_base_url or request_base_url
        return f"{base_url.rstrip('/')}/api/profile-picture/{quote(key, safe='/')}"
