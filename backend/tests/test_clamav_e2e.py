from __future__ import annotations

import hashlib
import uuid
from io import BytesIO
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.documents import Document, DocumentAuditLog, DocumentScan, DocumentVersion
from app.models.user import User
from app.services.antivirus import (
    MalwareDetectedError,
    ScannerUnavailableError,
    get_scanner_version,
    ping_scanner,
    scan_document_with_verdict,
)
from app.services.s3_storage import StorageObjectNotFoundError, StorageUnavailableError

_CLEAN_PDF = b"%PDF-1.7\nSureDocs clean document test\n"
_EICAR = (
    b"X5O!P%@AP[4\\PZX54(P^)7CC)7}"
    + b"$"
    + b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE!"
    + b"$"
    + b"H+H*"
)


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


class S3Mock:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str, str]] = {}
        self.copied: list[tuple[str, str]] = []
        self.deleted: list[str] = []

    def put_document(self, key: str, body: Any, *, content_type: str, checksum_sha256: str) -> str:
        if hasattr(body, "read"):
            data = body.read()
        else:
            data = body
        self.objects[key] = (data, content_type, checksum_sha256)
        return "s3-v1"

    def get_document(self, key: str, version_id: str | None = None) -> dict[str, Any]:
        if key not in self.objects:
            raise StorageObjectNotFoundError(f"Object {key} not found")
        data, c_type, sha = self.objects[key]
        return {
            "Body": BytesIO(data),
            "Metadata": {"sha256": sha},
            "ContentType": c_type,
            "ContentLength": len(data),
        }

    def copy_document_object(
        self,
        source_key: str,
        destination_key: str,
        content_type: str,
        checksum_sha256: str,
        source_version_id: str | None = None,
    ) -> str:
        if source_key not in self.objects:
            raise StorageObjectNotFoundError(f"Source object {source_key} not found")
        self.objects[destination_key] = self.objects[source_key]
        self.copied.append((source_key, destination_key))
        return "s3-v2"

    def delete_document_object(self, key: str, version_id: str | None = None) -> None:
        self.objects.pop(key, None)
        self.deleted.append(key)


@pytest.fixture()
def s3_mock(monkeypatch: pytest.MonkeyPatch) -> S3Mock:
    mock = S3Mock()
    monkeypatch.setattr("app.routers.documents.put_document", mock.put_document)
    monkeypatch.setattr("app.routers.documents.get_s3_document", mock.get_document)
    monkeypatch.setattr("app.routers.documents.copy_document_object", mock.copy_document_object)
    monkeypatch.setattr("app.routers.documents.delete_document_object", mock.delete_document_object)
    monkeypatch.setattr("app.routers.document_scans.get_s3_document", mock.get_document)
    monkeypatch.setattr("app.routers.document_scans.copy_document_object", mock.copy_document_object)
    monkeypatch.setattr("app.routers.document_scans.delete_document_object", mock.delete_document_object)
    monkeypatch.setattr("app.services.s3_storage.put_document", mock.put_document)
    return mock


# 1. Clean file upload is quarantined, scanned, promoted to trusted storage, and made available
def test_clean_file_promoted_and_available(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.routers.documents.scan_document_bytes", lambda content: None)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", _CLEAN_PDF, "application/pdf")},
        data={"title": "Quarterly Report", "category": "Finance", "classification": "CONFIDENTIAL"},
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["latest_uploaded_version_status"] == "AVAILABLE"
    assert data["scan_message"] == "Document uploaded and security scan passed."
    doc_id = uuid.UUID(data["id"])

    # Verify S3 quarantine -> trusted promotion
    assert len(s3_mock.copied) == 1
    src_key, dst_key = s3_mock.copied[0]
    assert "documents/quarantine/" in src_key
    assert dst_key.startswith("documents/") and "quarantine" not in dst_key
    assert src_key in s3_mock.deleted

    # Verify DB Document and Version
    doc = db.get(Document, doc_id)
    assert doc is not None
    assert doc.current_version_id is not None
    version = db.get(DocumentVersion, doc.current_version_id)
    assert version is not None
    assert version.status == "AVAILABLE"
    assert version.scan_completed_at is not None

    # Verify DocumentScan record
    scan = db.execute(
        select(DocumentScan).where(DocumentScan.document_id == doc_id)
    ).scalar_one_or_none()
    assert scan is not None
    assert scan.scan_status == "CLEAN"
    assert scan.scanner_name == "ClamAV"
    assert scan.file_hash_sha256 == hashlib.sha256(_CLEAN_PDF).hexdigest()

    # Verify audit logs
    audits = db.execute(
        select(DocumentAuditLog).where(DocumentAuditLog.document_id_snapshot == doc_id)
    ).scalars().all()
    action_types = {a.action_type for a in audits}
    assert "DOCUMENT_UPLOADED" in action_types
    assert "DOCUMENT_SCAN_COMPLETED" in action_types


# 2. Infected EICAR test file is quarantined, blocked from trusted storage, and audit logged
def test_infected_eicar_file_blocked(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_scan_detects_eicar(content: bytes):
        raise MalwareDetectedError("Eicar-Test-Signature detected", detection_name="Eicar-Test-Signature")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", fake_scan_detects_eicar)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("eicar.txt", _EICAR, "text/plain")},
        data={"title": "EICAR Test", "category": "Security"},
    )

    assert response.status_code == 202, response.text
    data = response.json()
    assert data["latest_uploaded_version_status"] == "QUARANTINED"
    assert data["scan_message"] == "Upload blocked: the file failed the security scan."
    doc_id = uuid.UUID(data["id"])

    # Verify file was NOT copied/promoted to trusted location
    assert len(s3_mock.copied) == 0

    # Verify DB: current_version_id must NOT be set
    doc = db.get(Document, doc_id)
    assert doc is not None
    assert doc.current_version_id is None

    # Version status must be QUARANTINED
    version = db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == doc_id)
    ).scalar_one()
    assert version.status == "QUARANTINED"
    assert version.scan_completed_at is not None

    # Verify DocumentScan table
    scan = db.execute(
        select(DocumentScan).where(DocumentScan.document_id == doc_id)
    ).scalar_one_or_none()
    assert scan is not None
    assert scan.scan_status == "INFECTED"
    assert scan.detection_name == "Eicar-Test-Signature"

    # Verify audit log
    audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == doc_id,
            DocumentAuditLog.action_type == "DOCUMENT_SCAN_COMPLETED",
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.result == "FAILED"


# 3. Unscanned or pending files cannot be viewed or downloaded
def test_pending_scan_file_cannot_be_viewed_or_downloaded(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def scanner_unavailable(content: bytes):
        raise ScannerUnavailableError("Scanner connection timed out")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", scanner_unavailable)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("pending.pdf", _CLEAN_PDF, "application/pdf")},
    )
    assert response.status_code == 202
    data = response.json()
    assert data["latest_uploaded_version_status"] == "PENDING_SCAN"
    doc_id = uuid.UUID(data["id"])

    # Attempting to view or download must fail (404 because no available version exists)
    view_resp = client.get(f"/api/documents/{doc_id}/view")
    assert view_resp.status_code == 404

    # Direct version download must fail
    v = db.execute(select(DocumentVersion).where(DocumentVersion.document_id == doc_id)).scalar_one()
    dl_resp = client.get(f"/api/documents/{doc_id}/versions/{v.id}/download")
    assert dl_resp.status_code == 404


# 4. Quarantined file cannot be viewed, downloaded, or shared
def test_quarantined_file_cannot_be_viewed_downloaded_or_shared(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def detect_trojan(content: bytes):
        raise MalwareDetectedError("Infected", detection_name="Trojan.Generic")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", detect_trojan)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("bad.pdf", _CLEAN_PDF, "application/pdf")},
    )
    assert response.status_code == 202
    data = response.json()
    assert data["latest_uploaded_version_status"] == "QUARANTINED"
    doc_id = uuid.UUID(data["id"])

    # View fails
    assert client.get(f"/api/documents/{doc_id}/view").status_code == 404

    # Direct version download fails
    v = db.execute(select(DocumentVersion).where(DocumentVersion.document_id == doc_id)).scalar_one()
    assert client.get(f"/api/documents/{doc_id}/versions/{v.id}/download").status_code == 404

    # Permission grant fails with 409 Conflict
    perm_resp = client.put(
        f"/api/documents/{doc_id}/permissions",
        json={"user_id": str(active_admin.id), "can_view": True, "can_download": False},
    )
    assert perm_resp.status_code == 409
    assert "available" in perm_resp.json()["detail"].lower()


# 5. Scanner timeout blocks publication (fail closed)
def test_scanner_timeout_fails_closed(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def scanner_timeout(content: bytes):
        raise ScannerUnavailableError("Timed out reading from ClamAV daemon")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", scanner_timeout)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("doc.pdf", _CLEAN_PDF, "application/pdf")},
    )
    assert response.status_code == 202
    assert response.json()["latest_uploaded_version_status"] == "PENDING_SCAN"
    # Never promoted
    assert len(s3_mock.copied) == 0


# 6. Scanner connection failure blocks publication (fail closed)
def test_scanner_connection_failure_fails_closed(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def conn_refused(content: bytes):
        raise ScannerUnavailableError("Connection refused to 127.0.0.1:3310")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", conn_refused)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("doc.pdf", _CLEAN_PDF, "application/pdf")},
    )
    assert response.status_code == 202
    assert response.json()["latest_uploaded_version_status"] == "PENDING_SCAN"
    assert len(s3_mock.copied) == 0


# 7. File with misleading extension cannot bypass validation
def test_misleading_extension_rejected(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
) -> None:
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    # PDF extension but random binary content
    response = client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", b"\x00\x01\x02\x03\x04\x05\x06\x07", "application/pdf")},
    )
    assert response.status_code == 415


# 8. File exceeding size limit is rejected
def test_large_file_rejected(
    client: TestClient,
    db: Session,
    active_employee: User,
    s3_mock: S3Mock,
) -> None:
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    large_content = b"%PDF-1.7\n" + b"0" * (50 * 1024 * 1024 + 1)
    response = client.post(
        "/api/documents/upload",
        files={"file": ("huge.pdf", large_content, "application/pdf")},
    )
    assert response.status_code in (400, 413)


# 9. S3 promotion failure does not mark document as available
def test_s3_promotion_failure_leaves_document_unavailable(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_put(key, body, *, content_type, checksum_sha256):
        if "documents/quarantine/" in key:
            return "quarantine-v1"
        raise StorageUnavailableError("S3 put failed on promotion")

    def fake_copy(source_key, destination_key, content_type, checksum_sha256, source_version_id=None):
        raise StorageUnavailableError("S3 copy failed on promotion")

    monkeypatch.setattr("app.routers.documents.put_document", fake_put)
    monkeypatch.setattr("app.routers.documents.copy_document_object", fake_copy)
    monkeypatch.setattr("app.routers.documents.scan_document_bytes", lambda content: None)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("doc.pdf", _CLEAN_PDF, "application/pdf")},
    )

    # 503 is returned because promotion to trusted storage failed
    assert response.status_code == 503
    # Verify no document is marked available
    docs = db.execute(select(Document).where(Document.owner_user_id == active_employee.id)).scalars().all()
    for d in docs:
        assert d.current_version_id is None


# 10. Database scan recovery / retry endpoint updates existing document without duplicates
def test_admin_scan_retry_recovers_pending_file(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # First: upload fails scan with timeout
    def scanner_timeout(content: bytes):
        raise ScannerUnavailableError("timeout")

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", scanner_timeout)

    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    upload_resp = client.post(
        "/api/documents/upload",
        files={"file": ("recover.pdf", _CLEAN_PDF, "application/pdf")},
    )
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["id"]

    client.post("/api/auth/logout")

    # Now scanner is restored
    monkeypatch.setattr("app.routers.document_scans.scan_document_bytes", lambda content: None)

    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    # Check pending scans list
    pending_list = client.get("/api/admin/document-scans")
    assert pending_list.status_code == 200

    # Retry specific document
    retry_resp = client.post(f"/api/admin/document-scans/{doc_id}/retry")
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "AVAILABLE"

    # Verify no duplicate documents created
    total_docs = db.execute(select(Document).where(Document.id == uuid.UUID(doc_id))).scalars().all()
    assert len(total_docs) == 1
    assert total_docs[0].current_version_id is not None


# 11. Administrators also undergo scanning
def test_admin_upload_also_undergoes_scanning(
    client: TestClient,
    db: Session,
    active_admin: User,
    s3_mock: S3Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scanned_count = 0

    def counting_scan(content: bytes):
        nonlocal scanned_count
        scanned_count += 1

    monkeypatch.setattr("app.routers.documents.scan_document_bytes", counting_scan)

    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("admin_policy.pdf", _CLEAN_PDF, "application/pdf")},
        data={"title": "Admin Policy"},
    )
    assert response.status_code == 201
    assert scanned_count == 1
    assert response.json()["latest_uploaded_version_status"] == "AVAILABLE"


# 12. Live ClamAV scanner integration (checks actual Docker container)
def test_live_clamav_daemon_ping_and_version():
    is_live = ping_scanner()
    assert is_live is True, "ClamAV container should be running and healthy on 127.0.0.1:3310"
    version = get_scanner_version()
    assert "ClamAV" in version


# 13. Live ClamAV detects EICAR test string
def test_live_clamav_detects_eicar_signature():
    verdict, detection, ver = scan_document_with_verdict(_EICAR)
    assert verdict == "INFECTED"
    assert "Eicar" in (detection or "")
