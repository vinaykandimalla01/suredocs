from __future__ import annotations

from io import BytesIO

import pytest

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
