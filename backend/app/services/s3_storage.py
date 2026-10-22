"""Private S3 operations for document contents."""

from __future__ import annotations

import logging
from typing import BinaryIO

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from app.core.config import AWS_REGION, S3_BUCKET

logger = logging.getLogger(__name__)


class StorageUnavailableError(RuntimeError):
    """S3 is not configured or cannot be reached using the AWS credential chain."""


def get_s3_client():
    """Build an S3 client using the standard AWS credential provider chain."""
    return boto3.client("s3", region_name=AWS_REGION)


def put_document(
    key: str,
    body: BinaryIO,
    *,
    content_type: str,
    checksum_sha256: str,
) -> str | None:
    """Store bytes in the configured private bucket and return S3's version ID."""
    try:
        result = get_s3_client().put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=body,
            ContentType=content_type,
            Metadata={"sha256": checksum_sha256},
            ServerSideEncryption="AES256",
        )
        return result.get("VersionId")
    except (BotoCoreError, ClientError, NoCredentialsError) as exc:
        logger.error("S3 document upload failed (%s)", type(exc).__name__)
        raise StorageUnavailableError(
            "Document storage is unavailable. The upload was not completed."
        ) from exc


def get_document(key: str, version_id: str | None = None):
    """Read a stored object without exposing a bucket URL to the caller."""
    arguments = {"Bucket": S3_BUCKET, "Key": key}
    if version_id:
        arguments["VersionId"] = version_id
    try:
        return get_s3_client().get_object(**arguments)
    except (BotoCoreError, ClientError, NoCredentialsError) as exc:
        logger.error("S3 document retrieval failed (%s)", type(exc).__name__)
        raise StorageUnavailableError(
            "The document file is temporarily unavailable."
        ) from exc


def delete_document_object(key: str, version_id: str | None = None) -> None:
    """Compensate for an upload whose database finalization failed."""
    arguments = {"Bucket": S3_BUCKET, "Key": key}
    if version_id:
        arguments["VersionId"] = version_id
    try:
        get_s3_client().delete_object(**arguments)
    except (BotoCoreError, ClientError, NoCredentialsError) as exc:
        logger.error("S3 upload compensation failed (%s)", type(exc).__name__)
        raise StorageUnavailableError(
            "The uploaded object could not be removed after a database failure."
        ) from exc
