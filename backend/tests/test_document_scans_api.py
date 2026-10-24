from __future__ import annotations

import base64
import hashlib
import uuid
from datetime import datetime, timezone
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import S3_BUCKET
from app.models.documents import Document, DocumentAuditLog, DocumentVersion
from app.models.user import User
from app.services.antivirus import MalwareDetectedError, ScannerUnavailableError

_PDF = b"%PDF-1.7\npending scan test\n"


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def _seed_pending_version(db: Session, owner: User) -> tuple[Document, DocumentVersion]:
    now = datetime.now(timezone.utc)
    document_id = uuid.uuid4()
    version_id = uuid.uuid4()
    version = DocumentVersion(
        id=version_id,
        document_id=document_id,
        version_number=1,
        storage_bucket=S3_BUCKET,
        storage_key=f"documents/{document_id}/versions/{version_id}/content",
        original_filename="pending.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        size_bytes=len(_PDF),
        checksum_sha256=hashlib.sha256(_PDF).hexdigest(),
        status="PENDING_SCAN",
        uploaded_by_user_id=owner.id,
        uploaded_at=now,
        created_at=now,
    )
    document = Document(
        id=document_id,
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title="Pending scan test",
        classification="CONFIDENTIAL",
        status="ACTIVE",
        custom_metadata={},
        created_at=now,
        updated_at=now,
    )
    db.add_all([document, version])
    db.flush()
    db.commit()
    db.refresh(document)
    db.refresh(version)
    return document, version


def _mock_s3(monkeypatch) -> None:
    checksum = base64.b64encode(hashlib.sha256(_PDF).digest()).decode("ascii")

    def get_document(key: str, version_id: str | None = None):
        assert key.startswith("documents/")
        return {"Body": BytesIO(_PDF), "Metadata": {"sha256": checksum}}

    monkeypatch.setattr("app.routers.document_scans.get_s3_document", get_document)


def test_admin_scan_marks_clean_pending_version_available_and_audits(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    monkeypatch,
) -> None:
    document, version = _seed_pending_version(db, active_employee)
    _mock_s3(monkeypatch)
    monkeypatch.setattr("app.routers.document_scans.scan_document_bytes", lambda content: None)
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    response = client.post("/api/admin/document-scans/pending")

    assert response.status_code == 200, response.text
    assert response.json()["processed"] == 1
    assert response.json()["available"] == 1
    db.refresh(version)
    db.refresh(document)
    assert version.status == "AVAILABLE"
    assert version.scan_completed_at is not None
    assert document.current_version_id == version.id
    audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_SCAN_COMPLETED",
        )
    ).scalar_one()
    assert audit.actor_user_id == active_admin.id
    assert audit.result == "SUCCESS"
    assert audit.details["verdict"] == "clean"


def test_admin_scan_quarantines_infected_pending_version(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    monkeypatch,
) -> None:
    document, version = _seed_pending_version(db, active_employee)
    _mock_s3(monkeypatch)

    def detect(content: bytes) -> None:
        raise MalwareDetectedError("detected")

    monkeypatch.setattr("app.routers.document_scans.scan_document_bytes", detect)
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    response = client.post("/api/admin/document-scans/pending")

    assert response.status_code == 200, response.text
    assert response.json()["quarantined"] == 1
    db.refresh(version)
    db.refresh(document)
    assert version.status == "QUARANTINED"
    assert version.scan_completed_at is not None
    assert document.current_version_id is None


def test_admin_scan_keeps_version_pending_when_scanner_is_unavailable(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    monkeypatch,
) -> None:
    _, version = _seed_pending_version(db, active_employee)
    _mock_s3(monkeypatch)

    def unavailable(content: bytes) -> None:
        raise ScannerUnavailableError("offline")

    monkeypatch.setattr("app.routers.document_scans.scan_document_bytes", unavailable)
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    response = client.post("/api/admin/document-scans/pending")

    assert response.status_code == 200, response.text
    assert response.json()["still_pending"] == 1
    db.refresh(version)
    assert version.status == "PENDING_SCAN"
    assert version.scan_completed_at is None
