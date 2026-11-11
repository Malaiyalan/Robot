import asyncio
from dataclasses import dataclass
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class R2StorageError(Exception):
    """Structured error raised for Cloudflare R2 operations."""

    def __init__(self, code: str, message: str, status_code: int = 502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class R2ObjectData:
    body: bytes
    content_type: str
    content_length: int


class CloudflareR2Service:
    """Backend-only Cloudflare R2 S3-compatible client wrapper."""

    def _build_client(self):
        endpoint = settings.r2_endpoint
        access_key = settings.CLOUDFLARE_ACCESS_KEY_ID
        secret_key = settings.CLOUDFLARE_SECRET_ACCESS_KEY
        if not endpoint or not access_key or not secret_key:
            raise R2StorageError(
                "R2_NOT_CONFIGURED",
                "Cloudflare R2 credentials are missing in backend environment configuration.",
                status_code=500,
            )

        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )

    @staticmethod
    def _extract_error(exc: ClientError) -> tuple[str, str, int]:
        err = exc.response.get("Error", {})
        meta = exc.response.get("ResponseMetadata", {})
        code = str(err.get("Code", "R2ClientError"))
        msg = str(err.get("Message", str(exc)))
        http_status = int(meta.get("HTTPStatusCode") or 502)
        return code, msg, http_status

    def _head_bucket_sync(self, bucket_name: str) -> dict[str, Any] | None:
        client = self._build_client()
        try:
            resp = client.head_bucket(Bucket=bucket_name)
            return {
                "exists": True,
                "region": resp.get("BucketRegion") or resp.get("ResponseMetadata", {}).get("HTTPHeaders", {}).get("x-amz-bucket-region") or "auto",
            }
        except ClientError as exc:
            code, msg, http_status = self._extract_error(exc)
            if code in ("404", "NoSuchBucket", "NotFound") or http_status == 404:
                return None
            if code == "AccessDenied" or http_status == 403:
                raise R2StorageError(
                    "AccessDenied",
                    f"Cloudflare R2 access denied for bucket '{bucket_name}'. Verify the R2 API token permissions in backend/.env.",
                    status_code=403,
                ) from exc
            raise R2StorageError(code, f"Cloudflare R2 head_bucket failed: {msg}") from exc
        except BotoCoreError as exc:
            raise R2StorageError("R2ConnectionError", f"Cloudflare R2 connection error: {exc}") from exc

    def _create_and_verify_bucket_sync(self, bucket_name: str) -> dict[str, Any]:
        client = self._build_client()
        existing = self._head_bucket_sync(bucket_name)
        if existing:
            return {"bucket_name": bucket_name, "region": existing["region"], "verified": True, "already_existed": True}

        try:
            client.create_bucket(Bucket=bucket_name)
        except ClientError as exc:
            code, msg, http_status = self._extract_error(exc)
            if code == "BucketAlreadyOwnedByYou":
                pass
            elif code == "BucketAlreadyExists":
                raise R2StorageError(
                    "BucketAlreadyExists",
                    f"Bucket name '{bucket_name}' already exists in R2.",
                    status_code=409,
                ) from exc
            elif code == "AccessDenied" or http_status == 403:
                raise R2StorageError(
                    "AccessDenied",
                    "Cloudflare R2 denied CreateBucket. Ensure the backend/.env R2 API token has 'Admin Read & Write' permissions.",
                    status_code=403,
                ) from exc
            else:
                raise R2StorageError(code, f"Cloudflare R2 create_bucket failed: {msg}") from exc
        except BotoCoreError as exc:
            raise R2StorageError("R2ConnectionError", f"Cloudflare R2 connection error: {exc}") from exc

        verified = self._head_bucket_sync(bucket_name)
        if not verified:
            raise R2StorageError(
                "VerificationFailed",
                f"Bucket '{bucket_name}' could not be verified after creation.",
            )
        return {"bucket_name": bucket_name, "region": verified["region"], "verified": True, "already_existed": False}

    def _put_object_sync(self, bucket_name: str, object_key: str, data: bytes, content_type: str) -> None:
        client = self._build_client()
        try:
            client.put_object(
                Bucket=bucket_name,
                Key=object_key,
                Body=data,
                ContentType=content_type,
                ContentLength=len(data),
            )
        except ClientError as exc:
            code, msg, http_status = self._extract_error(exc)
            if code == "AccessDenied" or http_status == 403:
                raise R2StorageError(
                    "AccessDenied",
                    f"Cloudflare R2 denied PutObject on bucket '{bucket_name}'. Ensure the R2 API token has write permissions.",
                    status_code=403,
                ) from exc
            raise R2StorageError(code, f"Cloudflare R2 upload failed: {msg}") from exc
        except BotoCoreError as exc:
            raise R2StorageError("R2ConnectionError", f"Cloudflare R2 connection error: {exc}") from exc

    def _get_object_sync(self, bucket_name: str, object_key: str) -> R2ObjectData:
        client = self._build_client()
        try:
            resp = client.get_object(Bucket=bucket_name, Key=object_key)
            body = resp["Body"].read()
            return R2ObjectData(
                body=body,
                content_type=resp.get("ContentType") or "application/octet-stream",
                content_length=int(resp.get("ContentLength") or len(body)),
            )
        except ClientError as exc:
            code, msg, http_status = self._extract_error(exc)
            if code in ("NoSuchKey", "404", "NoSuchBucket") or http_status == 404:
                raise R2StorageError("NotFound", "Object not found in Cloudflare R2.", status_code=404) from exc
            raise R2StorageError(code, f"Cloudflare R2 read failed: {msg}") from exc
        except BotoCoreError as exc:
            raise R2StorageError("R2ConnectionError", f"Cloudflare R2 connection error: {exc}") from exc

    def _delete_object_sync(self, bucket_name: str, object_key: str) -> None:
        client = self._build_client()
        try:
            client.delete_object(Bucket=bucket_name, Key=object_key)
        except ClientError as exc:
            code, msg, http_status = self._extract_error(exc)
            if code in ("NoSuchKey", "NoSuchBucket", "404") or http_status == 404:
                return
            if code == "AccessDenied" or http_status == 403:
                raise R2StorageError(
                    "AccessDenied",
                    f"Cloudflare R2 denied DeleteObject on bucket '{bucket_name}'.",
                    status_code=403,
                ) from exc
            raise R2StorageError(code, f"Cloudflare R2 delete failed: {msg}") from exc
        except BotoCoreError as exc:
            raise R2StorageError("R2ConnectionError", f"Cloudflare R2 connection error: {exc}") from exc

    def _delete_bucket_and_contents_sync(self, bucket_name: str) -> None:
        client = self._build_client()
        exists = self._head_bucket_sync(bucket_name)
        if not exists:
            return
        try:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket_name):
                contents = page.get("Contents") or []
                if contents:
                    client.delete_objects(
                        Bucket=bucket_name,
                        Delete={"Objects": [{"Key": item["Key"]} for item in contents]},
                    )
            client.delete_bucket(Bucket=bucket_name)
        except ClientError as exc:
            code, msg, http_status = self._extract_error(exc)
            if code in ("NoSuchBucket", "404") or http_status == 404:
                return
            if code == "AccessDenied" or http_status == 403:
                raise R2StorageError(
                    "AccessDenied",
                    f"Cloudflare R2 denied deleting bucket '{bucket_name}' or its objects.",
                    status_code=403,
                ) from exc
            raise R2StorageError(code, f"Cloudflare R2 bucket cleanup failed: {msg}") from exc
        except BotoCoreError as exc:
            raise R2StorageError("R2ConnectionError", f"Cloudflare R2 connection error: {exc}") from exc

    async def create_and_verify_bucket(self, bucket_name: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._create_and_verify_bucket_sync, bucket_name)

    async def head_bucket(self, bucket_name: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._head_bucket_sync, bucket_name)

    async def upload_photo(self, bucket_name: str, object_key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self._put_object_sync, bucket_name, object_key, data, content_type)

    async def get_photo(self, bucket_name: str, object_key: str) -> R2ObjectData:
        return await asyncio.to_thread(self._get_object_sync, bucket_name, object_key)

    async def delete_photo(self, bucket_name: str, object_key: str) -> None:
        await asyncio.to_thread(self._delete_object_sync, bucket_name, object_key)

    async def delete_bucket_and_contents(self, bucket_name: str) -> None:
        await asyncio.to_thread(self._delete_bucket_and_contents_sync, bucket_name)


r2_service = CloudflareR2Service()

