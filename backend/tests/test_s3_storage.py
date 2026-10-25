from __future__ import annotations

from io import BytesIO

import pytest
from botocore.exceptions import NoCredentialsError, NoRegionError

from app.core.config import AWS_REGION, S3_BUCKET
from app.services.s3_storage import StorageUnavailableError, get_s3_client, put_document


def test_get_s3_client_uses_neon_endpoint_and_path_style(monkeypatch):
    from app.services import s3_storage

    calls = {}

    def fake_client(service_name, **kwargs):
        calls["service_name"] = service_name
        calls["kwargs"] = kwargs
        return object()

    monkeypatch.setattr(s3_storage, "AWS_ENDPOINT_URL_S3", "https://storage.example.test")
    monkeypatch.setattr(s3_storage.boto3, "client", fake_client)

    get_s3_client()

    assert calls["service_name"] == "s3"
    assert calls["kwargs"]["region_name"] == AWS_REGION
    assert calls["kwargs"]["endpoint_url"] == "https://storage.example.test"
    assert calls["kwargs"]["config"].s3 == {"addressing_style": "path"}


def test_put_document_removes_uploaded_version_when_head_verification_fails(monkeypatch):
    class FakeS3:
        def __init__(self):
            self.deleted = []

        def put_object(self, **kwargs):
            assert kwargs["Metadata"] == {"sha256": "expected-checksum"}
            assert kwargs["ChecksumSHA256"] == "expected-checksum"
            return {"VersionId": "s3-version-123"}

        def head_object(self, **kwargs):
            assert kwargs["VersionId"] == "s3-version-123"
            return {
                "ContentLength": 3,
                "Metadata": {"sha256": "wrong-checksum"},
            }

        def delete_object(self, **kwargs):
            self.deleted.append(kwargs)

    fake_s3 = FakeS3()
    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: fake_s3)

    with pytest.raises(StorageUnavailableError, match="checksum metadata verification failed"):
        put_document("documents/test", BytesIO(b"abc"), content_type="text/plain", checksum_sha256="expected-checksum")

    assert fake_s3.deleted == [
        {"Bucket": S3_BUCKET, "Key": "documents/test", "VersionId": "s3-version-123"}
    ]


def test_put_document_logs_head_error_and_cleans_up(monkeypatch, caplog):
    import logging

    from botocore.exceptions import ClientError

    verification_error = ClientError(
        {
            "Error": {"Code": "AccessDenied", "Message": "Head denied"},
            "ResponseMetadata": {
                "HTTPStatusCode": 403,
                "RequestId": "head-request-123",
                "HTTPHeaders": {
                    "authorization": "must-not-be-logged",
                    "x-amz-security-token": "token-must-not-be-logged",
                },
            },
        },
        "HeadObject",
    )

    class FakeS3:
        def __init__(self):
            self.deleted = []
            self.uploaded = []
            self.verified = []

        def put_object(self, **kwargs):
            self.uploaded.append(kwargs)
            assert kwargs["Bucket"] == S3_BUCKET
            return {}

        def head_object(self, **kwargs):
            self.verified.append(kwargs)
            assert kwargs["Key"] == "documents/test"
            raise verification_error

        def delete_object(self, **kwargs):
            self.deleted.append(kwargs)

    fake_s3 = FakeS3()
    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: fake_s3)
    caplog.set_level(logging.ERROR, logger="app.services.s3_storage")

    with pytest.raises(
        StorageUnavailableError,
        match="verification failed",
    ) as exc_info:
        put_document("documents/test", BytesIO(b"abc"), content_type="text/plain", checksum_sha256="expected-checksum")

    assert len(fake_s3.uploaded) == 1
    assert fake_s3.verified == [
        {
            "Bucket": fake_s3.uploaded[0]["Bucket"],
            "Key": fake_s3.uploaded[0]["Key"],
            "ChecksumMode": "ENABLED",
        }
    ]
    assert fake_s3.deleted == [
        {
            "Bucket": fake_s3.uploaded[0]["Bucket"],
            "Key": fake_s3.uploaded[0]["Key"],
        }
    ]
    assert fake_s3.uploaded[0]["Bucket"] == S3_BUCKET
    assert fake_s3.uploaded[0]["Key"] == "documents/test"
    assert exc_info.value.__cause__ is verification_error
    assert "Error.Code=AccessDenied" in caplog.text
    assert "Error.Message=Head denied" in caplog.text
    assert "ResponseMetadata.HTTPStatusCode=403" in caplog.text
    assert "ResponseMetadata.RequestId=head-request-123" in caplog.text
    assert "operation_name=HeadObject" in caplog.text
    assert "must-not-be-logged" not in caplog.text
    assert "token-must-not-be-logged" not in caplog.text


def test_put_document_cleanup_client_error_does_not_hide_verification_error(
    monkeypatch, caplog
):
    import logging

    from botocore.exceptions import ClientError

    verification_error = ClientError(
        {
            "Error": {"Code": "InvalidObjectState", "Message": "Verification failed"},
            "ResponseMetadata": {
                "HTTPStatusCode": 409,
                "RequestId": "verification-request-456",
            },
        },
        "HeadObject",
    )
    cleanup_error = ClientError(
        {
            "Error": {"Code": "AccessDenied", "Message": "Delete denied"},
            "ResponseMetadata": {
                "HTTPStatusCode": 403,
                "RequestId": "cleanup-request-789",
                "HTTPHeaders": {"authorization": "must-not-be-logged"},
            },
        },
        "DeleteObject",
    )

    class FakeS3:
        def put_object(self, **kwargs):
            return {"VersionId": "s3-version-123"}

        def head_object(self, **kwargs):
            raise verification_error

        def delete_object(self, **kwargs):
            raise cleanup_error

    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: FakeS3())
    caplog.set_level(logging.ERROR, logger="app.services.s3_storage")

    with pytest.raises(
        StorageUnavailableError,
        match="verification failed",
    ) as exc_info:
        put_document(
            "documents/test",
            BytesIO(b"abc"),
            content_type="text/plain",
            checksum_sha256="expected-checksum",
        )

    assert exc_info.value.__cause__ is verification_error
    assert "Error.Code=InvalidObjectState" in caplog.text
    assert "Error.Message=Verification failed" in caplog.text
    assert "ResponseMetadata.RequestId=verification-request-456" in caplog.text
    assert "operation_name=HeadObject" in caplog.text
    assert "Error.Code=AccessDenied" in caplog.text
    assert "Error.Message=Delete denied" in caplog.text
    assert "ResponseMetadata.RequestId=cleanup-request-789" in caplog.text
    assert "operation_name=DeleteObject" in caplog.text
    assert "must-not-be-logged" not in caplog.text


def test_put_document_unexpected_cleanup_failure_does_not_hide_head_failure(
    monkeypatch, caplog
):
    from botocore.exceptions import ClientError

    verification_error = ClientError(
        {
            "Error": {"Code": "AccessDenied", "Message": "Head denied"},
            "ResponseMetadata": {"HTTPStatusCode": 403},
        },
        "HeadObject",
    )

    class FakeS3:
        def put_object(self, **kwargs):
            return {"VersionId": "s3-version-123"}

        def head_object(self, **kwargs):
            raise verification_error

        def delete_object(self, **kwargs):
            raise RuntimeError("cleanup transport failed")

    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: FakeS3())

    with pytest.raises(StorageUnavailableError) as exc_info:
        put_document(
            "documents/test",
            BytesIO(b"abc"),
            content_type="text/plain",
            checksum_sha256="expected-checksum",
        )

    assert exc_info.value.__cause__ is verification_error
    assert "Error.Code=AccessDenied" in caplog.text
    assert "S3 verification cleanup failed (RuntimeError)" in caplog.text


@pytest.mark.parametrize(
    ("error_code", "message", "status_code"),
    [
        ("AccessDenied", "Access Denied", 403),
        ("NoSuchBucket", "The specified bucket does not exist", 404),
        ("InvalidAccessKeyId", "The AWS Access Key Id does not exist", 403),
    ],
)
def test_put_document_logs_safe_client_error_diagnostics(
    monkeypatch, caplog, error_code, message, status_code
):
    import logging

    from botocore.exceptions import ClientError

    class FakeS3:
        def __init__(self):
            self.head_called = False
            self.delete_called = False

        def put_object(self, **kwargs):
            raise ClientError(
                {
                    "Error": {"Code": error_code, "Message": message},
                    "ResponseMetadata": {
                        "HTTPStatusCode": status_code,
                        "RequestId": "request-id-123",
                        "HTTPHeaders": {
                            "authorization": "must-not-be-logged",
                            "x-amz-security-token": "session-token-must-not-be-logged",
                        },
                    },
                },
                "PutObject",
            )

        def head_object(self, **kwargs):
            self.head_called = True

        def delete_object(self, **kwargs):
            self.delete_called = True

    fake_s3 = FakeS3()

    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: fake_s3)
    caplog.set_level(logging.ERROR, logger="app.services.s3_storage")

    with pytest.raises(
        StorageUnavailableError,
        match="Document storage is unavailable",
    ):
        put_document(
            "documents/test",
            BytesIO(b"document-content-must-not-be-logged"),
            content_type="text/plain",
            checksum_sha256="expected-checksum",
        )

    log_message = caplog.text
    assert f"Error.Code={error_code}" in log_message
    assert f"Error.Message={message}" in log_message
    assert f"ResponseMetadata.HTTPStatusCode={status_code}" in log_message
    assert "ResponseMetadata.RequestId=request-id-123" in log_message
    assert "operation_name=PutObject" in log_message
    assert fake_s3.head_called is False
    assert fake_s3.delete_called is False
    assert "must-not-be-logged" not in log_message
    assert "document-content-must-not-be-logged" not in log_message


@pytest.mark.parametrize(
    "configuration_error",
    [
        NoCredentialsError(),
        NoRegionError(),
    ],
)
def test_put_document_wraps_credential_and_region_configuration_errors(
    monkeypatch, caplog, configuration_error
):
    import logging

    def raise_configuration_error():
        raise configuration_error

    monkeypatch.setattr(
        "app.services.s3_storage.get_s3_client",
        raise_configuration_error,
    )
    caplog.set_level(logging.ERROR, logger="app.services.s3_storage")

    with pytest.raises(
        StorageUnavailableError,
        match="Document storage is unavailable",
    ):
        put_document(
            "documents/test",
            BytesIO(b"document-content-must-not-be-logged"),
            content_type="text/plain",
            checksum_sha256="expected-checksum",
        )

    assert type(configuration_error).__name__ in caplog.text
    assert "document-content-must-not-be-logged" not in caplog.text


def test_put_document_redacts_environment_credentials_from_client_error(
    monkeypatch, caplog
):
    import logging

    from botocore.exceptions import ClientError

    credentials = {
        "AWS_ACCESS_KEY_ID": "AKIAEXAMPLEACCESSKEY",
        "AWS_SECRET_ACCESS_KEY": "example-secret-access-key",
        "AWS_SESSION_TOKEN": "example-session-token",
    }
    for name, value in credentials.items():
        monkeypatch.setenv(name, value)

    class FakeS3:
        def put_object(self, **kwargs):
            raise ClientError(
                {
                    "Error": {
                        "Code": "SignatureDoesNotMatch",
                        "Message": "Invalid credential: "
                        + " ".join(credentials.values())
                        + "\nCheck the signing configuration.",
                    },
                    "ResponseMetadata": {"HTTPStatusCode": 403},
                },
                "PutObject",
            )

    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: FakeS3())
    caplog.set_level(logging.ERROR, logger="app.services.s3_storage")

    with pytest.raises(StorageUnavailableError):
        put_document(
            "documents/test",
            BytesIO(b"private document"),
            content_type="text/plain",
            checksum_sha256="expected-checksum",
        )

    for credential in credentials.values():
        assert credential not in caplog.text
    assert "[REDACTED]" in caplog.text
    assert "Check the signing configuration." in caplog.text
