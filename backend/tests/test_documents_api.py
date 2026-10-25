from __future__ import annotations

import uuid
import hashlib
from datetime import datetime, timezone

import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.user import User
from app.routers.documents import _file_response, _response_stream, _validate_content
from app.schemas.documents import PermissionGrantRequest
from app.services.antivirus import MalwareDetectedError, ScannerUnavailableError
from app.services.s3_storage import (
    StorageObjectNotFoundError,
    StorageUnavailableError,
    get_document as get_s3_object,
)

_PDF = b"%PDF-1.7\nSureDocs document test\n"


def test_permission_grants_require_an_action_and_timezone_aware_expiry() -> None:
    with pytest.raises(ValidationError, match="must allow viewing or downloading"):
        PermissionGrantRequest(
            user_id=uuid.uuid4(),
            can_view=False,
            can_download=False,
        )


def test_text_formats_are_utf8_checked_and_malformed_json_remains_plain_text() -> None:
    assert _validate_content("history.json", "application/json", b'{"ok": true}') == (
        "application/json",
        "json",
    )
    assert _validate_content("broken.json", "application/json", b'{"ok":') == (
        "application/json",
        "json",
    )
    assert _validate_content("notes.log", "text/plain", b"line one\nline two") == (
        "text/plain",
        "log",
    )
    assert _validate_content("active.html", "text/html", b"<script>alert(1)</script>") == (
        "text/html",
        "html",
    )
    with pytest.raises(HTTPException) as invalid_encoding:
        _validate_content("notes.txt", "text/plain", b"\xff\xfe")
    assert invalid_encoding.value.status_code == 415


def test_additional_document_formats_are_validated_and_active_content_is_sandboxed() -> None:
    import zipfile
    from types import SimpleNamespace
    from io import BytesIO

    assert _validate_content("events.ics", "text/calendar", b"BEGIN:VCALENDAR\nEND:VCALENDAR") == (
        "text/calendar",
        "ics",
    )
    assert _validate_content("events.jsonl", "application/json", b'{"ok":true}\n') == (
        "application/x-ndjson",
        "jsonl",
    )
    assert _validate_content("diagram.svg", "image/svg+xml", b"<svg xmlns='http://www.w3.org/2000/svg'/>") == (
        "image/svg+xml",
        "svg",
    )
    with pytest.raises(HTTPException):
        _validate_content("unsafe.xml", "application/xml", b"<!DOCTYPE x [<!ENTITY y 'z'>]><x/>")

    epub = BytesIO()
    with zipfile.ZipFile(epub, "w") as archive:
        archive.writestr(
            "mimetype",
            b"application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )
        archive.writestr(
            "META-INF/container.xml",
            b"<container xmlns='urn:oasis:names:tc:opendocument:xmlns:container'><rootfiles/></container>",
        )
    assert _validate_content("guide.epub", "application/epub+zip", epub.getvalue()) == (
        "application/epub+zip",
        "epub",
    )

    response = _file_response(
        {"Body": BytesIO(b"<script>blocked</script>")},
        SimpleNamespace(content_type="text/html", original_filename="index.html"),
        inline=True,
    )
    assert "sandbox" in response.headers["content-security-policy"]
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert "connect-src 'none'" in response.headers["content-security-policy"]


def test_gif_and_webp_images_require_matching_content_signatures() -> None:
    gif = b"GIF89a\x01\x00\x01\x00\x00\x00\x00"
    webp = b"RIFF\x04\x00\x00\x00WEBP"
    assert _validate_content("animation.gif", "image/gif", gif) == ("image/gif", "gif")
    assert _validate_content("picture.webp", "image/webp", webp) == ("image/webp", "webp")
    with pytest.raises(HTTPException):
        _validate_content("wrong.gif", "image/gif", b"<html>not an image</html>")
    with pytest.raises(HTTPException):
        _validate_content("wrong.webp", "image/webp", b"RIFF----WAVE")


def test_interrupted_s3_stream_reports_failure_and_closes_the_body() -> None:
    failures = []

    class InterruptedBody:
        closed = False

        def iter_chunks(self, chunk_size):
            yield b"partial content"
            raise OSError("stream interrupted")

        def close(self):
            self.closed = True

    body = InterruptedBody()
    chunks = _response_stream({"Body": body}, on_error=failures.append)
    assert next(chunks) == b"partial content"
    with pytest.raises(OSError, match="stream interrupted"):
        next(chunks)
    assert isinstance(failures[0], OSError)
    assert body.closed

    with pytest.raises(ValidationError, match="must include a timezone"):
        PermissionGrantRequest(
            user_id=uuid.uuid4(),
            can_view=True,
            can_download=False,
            expires_at=datetime(2026, 1, 1),
        )


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200


def _seed_document(db: Session, owner: User) -> Document:
    now = datetime.now(timezone.utc)
    document_id = uuid.uuid4()
    version_id = uuid.uuid4()
    document = Document(
        id=document_id,
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title="Test document",
        classification="CONFIDENTIAL",
        status="ACTIVE",
        custom_metadata={},
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.flush()
    version = DocumentVersion(
        id=version_id,
        document_id=document_id,
        version_number=1,
        storage_bucket="suredocs-private-documents-dev",
        storage_key=f"documents/{document_id}/versions/{version_id}/content",
        original_filename="test.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        size_bytes=len(_PDF),
        checksum_sha256="a" * 64,
        status="AVAILABLE",
        uploaded_by_user_id=owner.id,
        uploaded_at=now,
        created_at=now,
    )
    db.add(version)
    db.flush()
    document.current_version_id = version_id
    db.commit()
    db.refresh(document)
    return document


def test_permission_responses_include_account_status_and_edit_level(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    _login(client, active_employee.email, "SecureEmp1!")

    grant_response = client.put(
        f"/api/documents/{document.id}/permissions",
        json={
            "user_id": str(active_admin.id),
            "can_view": True,
            "can_download": False,
            "can_edit": True,
        },
    )

    assert grant_response.status_code == 200, grant_response.text
    assert grant_response.json()["user_account_status"] == "ACTIVE"
    assert grant_response.json()["can_edit"] is True

    listed = client.get(f"/api/documents/{document.id}/permissions")
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["user_account_status"] == "ACTIVE"
    assert listed.json()["items"][0]["can_edit"] is True


@pytest.mark.parametrize(
    ("email", "password", "owner_fixture"),
    [
        ("testemployee@suredocs.example", "SecureEmp1!", "employee"),
        ("testadmin@suredocs.example", "SecureAdmin1!", "admin"),
    ],
)
def test_active_user_uploads_document_and_persists_s3_metadata(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
    email: str,
    password: str,
    owner_fixture: str,
) -> None:
    owner = active_employee if owner_fixture == "employee" else active_admin
    uploaded: dict[str, object] = {}

    def fake_put(key, body, *, content_type, checksum_sha256):
        uploaded.update(
            key=key,
            bytes=body.read(),
            content_type=content_type,
            checksum=checksum_sha256,
        )
        return "test-s3-version"

    monkeypatch.setattr("app.routers.documents.put_document", fake_put)
    monkeypatch.setattr("app.routers.documents.scan_document_bytes", lambda content: None)
    _login(client, email, password)
    response = client.post(
        "/api/documents/upload",
        data={
            "title": "Signed agreement",
            "description": "Test upload",
            "category": "Legal",
            "classification": "RESTRICTED",
        },
        files={"file": ("agreement.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["owner_user_id"] == str(owner.id)
    assert payload["owner_name"] == owner.full_name
    assert payload["title"] == "Signed agreement"
    assert payload["original_filename"] == "agreement.pdf"
    assert payload["current_version_id"] is not None
    assert payload["current_version_number"] == 1
    assert payload["latest_uploaded_version_number"] == 1
    assert payload["latest_uploaded_version_status"] == "AVAILABLE"
    assert uploaded["bytes"] == _PDF
    version = db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == uuid.UUID(payload["id"]))
    ).scalar_one()
    assert uploaded["key"] == version.storage_key
    assert version.original_filename == "agreement.pdf"
    assert version.size_bytes == len(_PDF)
    assert version.status == "AVAILABLE"
    assert version.scan_completed_at is not None
    assert version.s3_version_id == "test-s3-version"
    assert version.checksum_sha256 == hashlib.sha256(_PDF).hexdigest()


def test_failed_s3_upload_never_marks_document_version_available(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_upload(key, body, *, content_type, checksum_sha256):
        assert key.startswith("documents/")
        assert hasattr(body, "read")
        assert content_type == "application/pdf"
        assert checksum_sha256
        raise StorageUnavailableError("storage unavailable")

    monkeypatch.setattr("app.routers.documents.put_document", fail_upload)
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("failed.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 503
    failed_version = db.execute(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(
            Document.owner_user_id == active_employee.id,
            DocumentVersion.status == "FAILED",
        )
        .order_by(DocumentVersion.created_at.desc())
    ).scalars().first()
    assert failed_version is not None
    document = db.get(Document, failed_version.document_id)
    assert document is not None
    assert document.current_version_id is None
    assert db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "UPLOAD_REJECTED",
        )
    ).scalar_one_or_none() is not None


def test_upload_with_unavailable_scanner_stays_pending_and_returns_accepted(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.routers.documents.put_document",
        lambda key, body, *, content_type, checksum_sha256: "test-s3-version",
    )

    def scanner_unavailable(content: bytes) -> None:
        raise ScannerUnavailableError("scanner offline")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", scanner_unavailable)
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("pending.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 202
    assert response.json()["latest_uploaded_version_status"] == "PENDING_SCAN"
    version = db.execute(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(Document.owner_user_id == active_employee.id)
        .order_by(DocumentVersion.created_at.desc())
    ).scalars().first()
    assert version is not None and version.status == "PENDING_SCAN"
    assert version.scan_completed_at is None


def test_upload_detected_as_malware_is_quarantined_and_not_published(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.routers.documents.put_document",
        lambda key, body, *, content_type, checksum_sha256: "test-s3-version",
    )

    def scanner_detects_malware(content: bytes) -> None:
        raise MalwareDetectedError("detected")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", scanner_detects_malware)
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("infected.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 202
    assert response.json()["latest_uploaded_version_status"] == "QUARANTINED"
    version = db.execute(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(Document.owner_user_id == active_employee.id)
        .order_by(DocumentVersion.created_at.desc())
    ).scalars().first()
    assert version is not None and version.status == "QUARANTINED"
    assert version.scan_completed_at is not None
    document = db.get(Document, version.document_id)
    assert document is not None and document.current_version_id is None


def test_view_grant_allows_view_but_not_download_and_admin_is_not_implicitly_authorized(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)
    fetched = []

    class FakeBody:
        def iter_chunks(self, chunk_size):
            assert chunk_size > 0
            yield _PDF

        def close(self):
            pass

    def fake_get(key, version_id=None):
        assert version_id is None
        fetched.append(key)
        return {"Body": FakeBody(), "ContentLength": len(_PDF)}

    monkeypatch.setattr("app.routers.documents.get_s3_document", fake_get)
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")
    registry = client.get("/api/documents/registry")
    assert registry.status_code == 200
    registry_item = next(
        item for item in registry.json()["items"] if item["id"] == str(document.id)
    )
    assert registry_item["owner_name"] == active_employee.full_name
    assert registry_item["can_view"] is False
    assert fetched == []
    denied = client.get(f"/api/documents/{document.id}/view")
    assert denied.status_code == 404
    assert fetched == []
    assert db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "ACCESS_DENIED",
        )
    ).scalar_one().result == "DENIED"

    client.post("/api/auth/logout")
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    grant = client.put(
        f"/api/documents/{document.id}/permissions",
        json={
            "user_id": str(active_admin.id),
            "can_view": True,
            "can_download": False,
        },
    )
    assert grant.status_code == 200, grant.text
    permission_id = grant.json()["id"]

    client.post("/api/auth/logout")
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")
    shared = client.get("/api/documents/shared")
    assert shared.status_code == 200
    shared_document = next(
        item for item in shared.json()["items"] if item["id"] == str(document.id)
    )
    assert shared_document["can_view"] is True
    assert shared_document["can_download"] is False
    assert shared_document["can_edit"] is False
    denied_edit = client.patch(
        f"/api/documents/{document.id}",
        json={"title": "Unauthorized edit", "classification": "CONFIDENTIAL"},
    )
    assert denied_edit.status_code == 404
    viewed = client.get(f"/api/documents/{document.id}/view")
    assert viewed.status_code == 200
    assert viewed.content == _PDF
    assert viewed.headers["content-type"] == "application/pdf"
    assert viewed.headers["content-disposition"].startswith("inline;")
    assert viewed.headers["content-security-policy"] == "sandbox"
    assert viewed.headers["x-content-type-options"] == "nosniff"
    assert viewed.headers["cache-control"] == "private, no-store"
    assert db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one_or_none() is None
    rendered = client.post(
        f"/api/documents/{document.id}/preview-success"
        f"?version_id={document.current_version_id}",
        json={},
    )
    assert rendered.status_code == 204
    success_event = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one()
    assert success_event.actor_user_id == active_admin.id
    denied_download = client.get(f"/api/documents/{document.id}/download")
    assert denied_download.status_code == 404

    client.post("/api/auth/logout")
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    download_grant = client.put(
        f"/api/documents/{document.id}/permissions",
        json={
            "user_id": str(active_admin.id),
            "can_view": True,
            "can_download": True,
        },
    )
    assert download_grant.status_code == 200, download_grant.text
    client.post("/api/auth/logout")
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")
    downloaded = client.get(
        f"/api/documents/{document.id}/versions/{document.current_version_id}/download"
    )
    assert downloaded.status_code == 200
    assert downloaded.content == _PDF
    assert downloaded.headers["content-disposition"].startswith("attachment;")
    assert "filename*=UTF-8''" in downloaded.headers["content-disposition"]
    assert db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_DOWNLOADED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one().actor_user_id == active_admin.id

    client.post("/api/auth/logout")
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    revoked = client.delete(
        f"/api/documents/{document.id}/permissions/{permission_id}"
    )
    assert revoked.status_code == 204
    client.post("/api/auth/logout")
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")
    revoked_view = client.get(f"/api/documents/{document.id}/view")
    assert revoked_view.status_code == 404
    revoked_download = client.get(f"/api/documents/{document.id}/download")
    assert revoked_download.status_code == 404
    revoked_render = client.post(
        f"/api/documents/{document.id}/preview-success"
        f"?version_id={document.current_version_id}",
        json={},
    )
    assert revoked_render.status_code == 404
    assert len(fetched) == 2


def test_admin_registry_filters_categories_and_aggregations(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    _login(client, active_admin.email, "SecureAdmin1!")
    initial_summary = client.get("/api/documents/registry/summary").json()
    initial_categories = client.get("/api/documents/registry/categories").json()
    initial_finance_count = next(
        (
            item["count"]
            for item in initial_categories["items"]
            if item["name"] == "Finance"
        ),
        0,
    )
    document = _seed_document(db, active_employee)
    document.title = "Finance planning"
    document.category = "Finance"
    owned_document = _seed_document(db, active_admin)
    db.add(
        DocumentPermission(
            document_id=document.id,
            user_id=active_admin.id,
            can_view=True,
            can_download=False,
            can_edit=False,
            granted_by_user_id=active_employee.id,
            granted_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    response = client.get(
        "/api/documents/registry",
        params={
            "document_id": str(document.id),
            "category": "Finance",
            "status": "ACTIVE",
            "access_level": "SHARED",
            "sort_by": "title",
            "sort_direction": "asc",
            "page": 1,
            "page_size": 10,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 1
    assert payload["page"] == 1
    assert payload["page_size"] == 10
    assert payload["items"][0]["id"] == str(document.id)
    assert payload["items"][0]["permission_count"] == 1
    assert payload["items"][0]["can_view"] is True
    assert payload["items"][0]["current_version_status"] == "AVAILABLE"
    assert "storage_key" not in payload["items"][0]
    private = client.get(
        "/api/documents/registry",
        params={"document_id": str(document.id), "access_level": "PRIVATE"},
    )
    assert private.status_code == 200
    assert private.json()["total"] == 0
    owner_search = client.get(
        "/api/documents/registry",
        params={"search": active_employee.full_name, "category": "Finance"},
    )
    assert any(item["id"] == str(document.id) for item in owner_search.json()["items"])
    owned_scope = client.get(
        "/api/documents/registry",
        params={
            "registry_scope": "OWNED",
            "document_id": str(owned_document.id),
        },
    )
    assert owned_scope.status_code == 200
    assert [item["id"] for item in owned_scope.json()["items"]] == [
        str(owned_document.id)
    ]
    assert owned_scope.json()["total"] == 1
    shared_scope = client.get(
        "/api/documents/registry",
        params={
            "registry_scope": "SHARED_WITH_ME",
            "document_id": str(document.id),
        },
    )
    assert shared_scope.status_code == 200
    assert [item["id"] for item in shared_scope.json()["items"]] == [
        str(document.id)
    ]
    not_shared_with_me = client.get(
        "/api/documents/registry",
        params={
            "registry_scope": "SHARED_WITH_ME",
            "document_id": str(owned_document.id),
        },
    )
    assert not_shared_with_me.status_code == 200
    assert not_shared_with_me.json()["total"] == 0

    categories = client.get("/api/documents/registry/categories")
    assert categories.status_code == 200, categories.text
    assert {"name": "Finance", "count": initial_finance_count + 1} in categories.json()["items"]
    assert categories.json()["total"] == initial_categories["total"] + 2

    summary = client.get("/api/documents/registry/summary")
    assert summary.status_code == 200, summary.text
    assert summary.json() == {
        "total_documents": initial_summary["total_documents"] + 2,
        "owned_documents": initial_summary["owned_documents"] + 1,
        "shared_documents": initial_summary["shared_documents"] + 1,
        "storage_bytes": initial_summary["storage_bytes"] + (2 * len(_PDF)),
    }


def test_admin_registry_rejects_unsupported_filter_values(
    client: TestClient,
    active_admin: User,
) -> None:
    _login(client, active_admin.email, "SecureAdmin1!")
    response = client.get(
        "/api/documents/registry",
        params={"status": "PURGED", "sort_by": "untrusted_column"},
    )
    assert response.status_code == 422


def test_registry_aggregates_and_listing_remain_admin_only(
    client: TestClient,
    active_employee: User,
) -> None:
    _login(client, active_employee.email, "SecureEmp1!")
    for endpoint in (
        "/api/documents/registry",
        "/api/documents/registry/summary",
        "/api/documents/registry/categories",
    ):
        assert client.get(endpoint).status_code == 403


def test_owner_view_is_audited_only_after_client_reports_render_success(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)

    class FakeBody:
        def iter_chunks(self, chunk_size):
            yield _PDF

        def close(self):
            pass

    monkeypatch.setattr(
        "app.routers.documents.get_s3_document",
        lambda *args, **kwargs: {"Body": FakeBody(), "ContentLength": len(_PDF)},
    )
    _login(client, active_employee.email, "SecureEmp1!")
    response = client.get(f"/api/documents/{document.id}/view")
    assert response.status_code == 200
    assert response.content == _PDF
    assert db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one_or_none() is None

    rendered = client.post(
        f"/api/documents/{document.id}/preview-success"
        f"?version_id={document.current_version_id}",
        json={},
    )
    assert rendered.status_code == 204
    event = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one()
    assert event.actor_user_id == active_employee.id


def test_unauthenticated_view_is_audited_without_retrieving_s3_content(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)

    def unexpected_fetch(*args, **kwargs):
        pytest.fail("S3 must not be accessed for an unauthenticated view request")

    monkeypatch.setattr("app.routers.documents.get_s3_document", unexpected_fetch)
    response = client.get(f"/api/documents/{document.id}/view")

    assert response.status_code == 401
    event = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
        )
    ).scalar_one()
    assert event.actor_user_id is None
    assert event.result == "DENIED"
    assert event.details["reason"] == "authentication_required"


def test_s3_view_failure_is_audited_as_failed(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)

    def failed_fetch(*args, **kwargs):
        raise StorageUnavailableError("backend detail must not reach the client")

    monkeypatch.setattr("app.routers.documents.get_s3_document", failed_fetch)
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.get(f"/api/documents/{document.id}/view")

    assert response.status_code == 503
    assert response.json()["detail"] == "The document file is temporarily unavailable."
    event = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
        )
    ).scalar_one()
    assert event.result == "FAILED"
    assert event.details["reason"] == "storage_unavailable"


def test_missing_s3_object_returns_not_found_without_exposing_storage_key(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)

    def missing_object(*args, **kwargs):
        raise StorageObjectNotFoundError("private key must not reach the client")

    monkeypatch.setattr(
        "app.routers.documents.get_s3_document",
        missing_object,
    )
    _login(client, active_employee.email, "SecureEmp1!")

    response = client.get(f"/api/documents/{document.id}/view")

    assert response.status_code == 404
    assert response.json()["detail"] == "The document file could not be found."
    assert "storage_key" not in response.text
    event = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "FAILED",
        )
    ).scalar_one()
    assert event.details["reason"] == "storage_object_missing"


def test_s3_no_such_key_is_classified_as_a_missing_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class MissingS3Client:
        def get_object(self, **kwargs):
            raise ClientError(
                {"Error": {"Code": "NoSuchKey", "Message": "missing"}},
                "GetObject",
            )

    monkeypatch.setattr("app.services.s3_storage.get_s3_client", MissingS3Client)
    with pytest.raises(StorageObjectNotFoundError):
        get_s3_object("documents/private/version/content", "s3-version-id")


def test_client_side_preview_failure_is_audited_without_document_content(
    client: TestClient,
    db: Session,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")

    response = client.post(
        f"/api/documents/{document.id}/preview-failure"
        f"?version_id={document.current_version_id}",
        json={},
    )

    assert response.status_code == 204
    event = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "FAILED",
        )
    ).scalar_one()
    assert event.actor_user_id == active_employee.id
    assert event.details == {
        "version_id": str(document.current_version_id),
        "reason": "client_preview_failed",
        "stage": "render",
    }


def test_interrupted_view_delivery_appends_failed_audit_without_rewriting_history(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)

    class InterruptedBody:
        def iter_chunks(self, chunk_size):
            yield b"%PDF-1.7 partial"
            raise OSError("stream interrupted")

        def close(self):
            pass

    monkeypatch.setattr(
        "app.routers.documents.get_s3_document",
        lambda *args, **kwargs: {"Body": InterruptedBody(), "ContentLength": len(_PDF)},
    )
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    transport = client._transport
    old_raise_setting = transport.raise_server_exceptions
    transport.raise_server_exceptions = False
    try:
        response = client.get(f"/api/documents/{document.id}/view")
    finally:
        transport.raise_server_exceptions = old_raise_setting

    assert response.status_code == 200
    db.expire_all()
    events = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
        )
    ).scalars().all()
    assert len(events) == 1
    assert {(event.result, event.details.get("reason")) for event in events} == {
        ("FAILED", "stream_interrupted"),
    }


def test_non_owner_cannot_soft_delete_another_users_document(
    client: TestClient,
    db: Session,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    response = client.delete(f"/api/documents/{document.id}")

    assert response.status_code == 403
    missing_response = client.delete(f"/api/documents/{uuid.uuid4()}")
    assert missing_response.status_code == 404
    edit_response = client.patch(
        f"/api/documents/{document.id}",
        json={"title": "Not permitted"},
    )
    assert edit_response.status_code == 404
    db.refresh(document)
    assert document.status == "ACTIVE"
    denied_events = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "ACCESS_DENIED",
        )
    ).scalars().all()
    assert len(denied_events) == 2


def test_edit_grant_does_not_allow_non_owner_to_delete_document(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    now = datetime.now(timezone.utc)
    db.add(
        DocumentPermission(
            document_id=document.id,
            user_id=active_admin.id,
            can_view=True,
            can_download=False,
            can_edit=True,
            granted_by_user_id=active_employee.id,
            granted_at=now,
        )
    )
    db.commit()
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    updated = client.patch(
        f"/api/documents/{document.id}",
        json={
            "title": "Shared editor update",
            "classification": document.classification,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Shared editor update"
    assert db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_METADATA_UPDATED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one().actor_user_id == active_admin.id

    response = client.delete(f"/api/documents/{document.id}")

    assert response.status_code == 403
    db.refresh(document)
    assert document.status == "ACTIVE"


def test_replacing_content_adds_version_and_keeps_the_previous_version(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _seed_document(db, active_employee)
    original_version_id = document.current_version_id
    uploaded = {}

    def fake_put(key, body, *, content_type, checksum_sha256):
        uploaded.update(
            key=key,
            content=body.read(),
            content_type=content_type,
            checksum=checksum_sha256,
        )
        return "replacement-s3-version"

    monkeypatch.setattr("app.routers.documents.put_document", fake_put)
    monkeypatch.setattr("app.routers.documents.scan_document_bytes", lambda content: None)
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        f"/api/documents/{document.id}/versions",
        files={"file": ("replacement.pdf", _PDF + b"new version", "application/pdf")},
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["current_version_number"] == 2
    assert payload["current_version_id"] != str(original_version_id)
    assert payload["latest_uploaded_version_number"] == 2
    assert payload["latest_uploaded_version_status"] == "AVAILABLE"
    assert uploaded["content"] == _PDF + b"new version"
    new_version = db.execute(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document.id,
            DocumentVersion.version_number == 2,
        )
    ).scalar_one()
    assert uploaded["key"] == new_version.storage_key
    old_version = db.get(DocumentVersion, original_version_id)
    assert old_version is not None and old_version.status == "AVAILABLE"
    assert new_version.status == "AVAILABLE"
    assert new_version.scan_completed_at is not None


def test_owner_soft_delete_retains_versions_and_records_audit(
    client: TestClient,
    db: Session,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    version_id = document.current_version_id
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")

    response = client.delete(f"/api/documents/{document.id}")

    assert response.status_code == 204
    db.refresh(document)
    assert document.status == "DELETED"
    assert document.deleted_by_user_id == active_employee.id
    assert db.get(DocumentVersion, version_id).status == "AVAILABLE"
    audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_DELETED",
        )
    ).scalar_one()
    assert audit.document_id is None
