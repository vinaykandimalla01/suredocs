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


def test_put_document_wraps_head_errors_and_cleans_up(monkeypatch):
    from botocore.exceptions import ClientError

    class FakeS3:
        def __init__(self):
            self.deleted = []

        def put_object(self, **kwargs):
            assert kwargs["Bucket"] == S3_BUCKET
            return {}

        def head_object(self, **kwargs):
            assert kwargs["Key"] == "documents/test"
            raise ClientError({"Error": {"Code": "InternalError", "Message": "failed"}}, "HeadObject")

        def delete_object(self, **kwargs):
            self.deleted.append(kwargs)

    fake_s3 = FakeS3()
    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: fake_s3)

    with pytest.raises(StorageUnavailableError, match="verification failed"):
        put_document("documents/test", BytesIO(b"abc"), content_type="text/plain", checksum_sha256="expected-checksum")

    assert fake_s3.deleted == [{"Bucket": S3_BUCKET, "Key": "documents/test"}]


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

    monkeypatch.setattr("app.services.s3_storage.get_s3_client", lambda: FakeS3())
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
