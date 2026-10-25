"""Private S3 operations for document contents."""

from __future__ import annotations

import logging
import os
from typing import BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from app.core.config import AWS_ENDPOINT_URL_S3, AWS_REGION, S3_BUCKET

logger = logging.getLogger(__name__)


class StorageUnavailableError(RuntimeError):
    """S3 is not configured or cannot be reached using the AWS credential chain."""


class StorageObjectNotFoundError(StorageUnavailableError):
    """The authorized document version has no matching private S3 object."""


def get_s3_client():
    """Build an S3 client using the standard AWS credential provider chain."""
    s3_options = {"addressing_style": "path"} if AWS_ENDPOINT_URL_S3 else {}
    client_options = {"region_name": AWS_REGION, "config": Config(s3=s3_options)}
    if AWS_ENDPOINT_URL_S3:
        client_options["endpoint_url"] = AWS_ENDPOINT_URL_S3
    return boto3.client("s3", **client_options)


def _log_s3_client_error(operation: str, exc: ClientError) -> None:
    error = exc.response.get("Error", {})
    metadata = exc.response.get("ResponseMetadata", {})
    message = str(error.get("Message", "No error message returned."))
    for credential_name in (
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_SECURITY_TOKEN",
    ):
        credential = os.environ.get(credential_name)
        if credential:
            message = message.replace(credential, "[REDACTED]")
    message = message.replace("\r", " ").replace("\n", " ")
    logger.error(
        "S3 %s failed: Error.Code=%s Error.Message=%s "
        "ResponseMetadata.HTTPStatusCode=%s ResponseMetadata.RequestId=%s "
        "operation_name=%s",
        operation,
        error.get("Code", "unknown"),
        message,
        metadata.get("HTTPStatusCode", "unknown"),
        metadata.get("RequestId", "unknown"),
        exc.operation_name,
    )


def put_document(
    key: str,
    body: BinaryIO,
    *,
    content_type: str,
    checksum_sha256: str,
) -> str | None:
    """Store bytes privately and verify the stored object before finalization."""
    try:
        client = get_s3_client()
        expected_length = None
        if hasattr(body, "getbuffer"):
            expected_length = body.getbuffer().nbytes
        elif getattr(body, "seekable", lambda: False)():
            position = body.tell()
            body.seek(0, 2)
            expected_length = body.tell() - position
            body.seek(position)
        result = client.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=body,
            ContentType=content_type,
            Metadata={"sha256": checksum_sha256},
            ChecksumSHA256=checksum_sha256,
            ServerSideEncryption="AES256",
        )
        version_id = result.get("VersionId")
        head_arguments = {"Bucket": S3_BUCKET, "Key": key, "ChecksumMode": "ENABLED"}
        if version_id:
            head_arguments["VersionId"] = version_id
        try:
            stored = client.head_object(**head_arguments)
            if expected_length is not None and stored.get("ContentLength") != expected_length:
                raise StorageUnavailableError("Stored object size verification failed.")
            if stored.get("Metadata", {}).get("sha256") != checksum_sha256:
                raise StorageUnavailableError("Stored object checksum metadata verification failed.")
            if stored.get("ChecksumSHA256") and stored["ChecksumSHA256"] != checksum_sha256:
                raise StorageUnavailableError("Stored object checksum verification failed.")
        except Exception as exc:
            cleanup_arguments = {"Bucket": S3_BUCKET, "Key": key}
            if version_id:
                cleanup_arguments["VersionId"] = version_id
            try:
                client.delete_object(**cleanup_arguments)
            except Exception as cleanup_exc:
                if isinstance(cleanup_exc, ClientError):
                    _log_s3_client_error("verification cleanup", cleanup_exc)
                else:
                    logger.error(
                        "S3 verification cleanup failed (%s)",
                        type(cleanup_exc).__name__,
                    )
            if isinstance(exc, StorageUnavailableError):
                raise
            if isinstance(exc, (BotoCoreError, ClientError, NoCredentialsError)):
                if isinstance(exc, ClientError):
                    _log_s3_client_error("document verification", exc)
                else:
                    logger.error(
                        "S3 document verification failed (%s)",
                        type(exc).__name__,
                    )
                raise StorageUnavailableError(
                    "Document storage verification failed. The upload was not completed."
                ) from exc
            raise
        return version_id
    except (BotoCoreError, ClientError, NoCredentialsError) as exc:
        if isinstance(exc, ClientError):
            _log_s3_client_error("document upload", exc)
        else:
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
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        _log_s3_client_error("document retrieval", exc)
        if error_code in {"NoSuchKey", "NoSuchVersion", "404", "NotFound"}:
            raise StorageObjectNotFoundError(
                "The document file could not be found in private storage."
            ) from exc
        raise StorageUnavailableError(
            "The document file is temporarily unavailable."
        ) from exc
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
        if isinstance(exc, ClientError):
            _log_s3_client_error("upload compensation", exc)
        else:
            logger.error("S3 upload compensation failed (%s)", type(exc).__name__)
        raise StorageUnavailableError(
            "The uploaded object could not be removed after a database failure."
        ) from exc


def copy_document_object(
    source_key: str,
    destination_key: str,
    *,
    content_type: str,
    checksum_sha256: str,
    source_version_id: str | None = None,
) -> str | None:
    """Promote an object from quarantine to trusted storage and verify it before returning."""
    try:
        client = get_s3_client()
        copy_source: dict[str, str] = {"Bucket": S3_BUCKET, "Key": source_key}
        if source_version_id:
            copy_source["VersionId"] = source_version_id
        result = client.copy_object(
            Bucket=S3_BUCKET,
            Key=destination_key,
            CopySource=copy_source,
            ContentType=content_type,
            Metadata={"sha256": checksum_sha256},
            MetadataDirective="REPLACE",
            ChecksumAlgorithm="SHA256",
            ServerSideEncryption="AES256",
        )
        version_id = result.get("VersionId")
        head_arguments = {"Bucket": S3_BUCKET, "Key": destination_key, "ChecksumMode": "ENABLED"}
        if version_id:
            head_arguments["VersionId"] = version_id
        try:
            stored = client.head_object(**head_arguments)
            if stored.get("Metadata", {}).get("sha256") != checksum_sha256:
                raise StorageUnavailableError("Promoted document object checksum metadata verification failed.")
        except StorageUnavailableError:
            raise
        except (BotoCoreError, ClientError, NoCredentialsError) as exc:
            if isinstance(exc, ClientError):
                _log_s3_client_error("document promotion verification", exc)
            else:
                logger.error(
                    "Promoted S3 document verification failed (%s)",
                    type(exc).__name__,
                )
            raise StorageUnavailableError(
                "Document promotion verification failed."
            ) from exc
        return version_id
    except (BotoCoreError, ClientError, NoCredentialsError) as exc:
        if isinstance(exc, ClientError):
            _log_s3_client_error("document copy", exc)
        else:
            logger.error("S3 document copy failed (%s)", type(exc).__name__)
        raise StorageUnavailableError(
            "Document promotion from quarantine failed. The upload was not completed."
        ) from exc
