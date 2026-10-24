from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.persistence import AccessRequest, Notification
from app.models.user import User


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def _seed_document(db: Session, owner: User) -> Document:
    now = datetime.now(timezone.utc)
    document = Document(
        id=uuid.uuid4(),
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title="Quarterly report",
        category="Finance",
        classification="CONFIDENTIAL",
        status="ACTIVE",
        custom_metadata={},
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.flush()
    version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=document.id,
        version_number=1,
        storage_bucket="suredocs-private-documents-dev",
        storage_key=f"documents/{document.id}/versions/",
        original_filename="quarterly.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        size_bytes=1024,
        checksum_sha256="a" * 64,
        status="AVAILABLE",
        uploaded_by_user_id=owner.id,
        uploaded_at=now,
        created_at=now,
    )
    version.storage_key = f"documents/{document.id}/versions/{version.id}/content"
    db.add(version)
    db.flush()
    document.current_version_id = version.id
    db.flush()
    return document


def test_access_request_approval_creates_scoped_edit_grant_and_notifications(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    monkeypatch,
) -> None:
    document = _seed_document(db, active_employee)
    _login(client, active_admin.email, "SecureAdmin1!")
    submitted = client.post(
        "/api/access-requests",
        json={
            "document_id": str(document.id),
            "requested_permissions": {"can_view": False, "can_download": False, "can_edit": True},
            "reason": "Please allow me to update the report metadata.",
        },
    )
    assert submitted.status_code == 201, submitted.text
    request_id = submitted.json()["id"]
    assert submitted.json()["requested_permissions"] == {
        "can_view": True,
        "can_download": False,
        "can_edit": True,
    }

    mine = client.get("/api/access-requests?scope=mine&status=PENDING&page=1&page_size=10")
    assert mine.status_code == 200
    assert mine.json()["total"] == 1
    assert mine.json()["items"][0]["id"] == request_id
    assert client.get("/api/access-requests?scope=owned").json()["total"] == 0
    assert db.execute(
        select(Notification).where(Notification.recipient_user_id == active_employee.id)
    ).scalar_one().notification_type == "ACCESS_REQUEST"

    requester_cannot_approve = client.post(f"/api/access-requests/{request_id}/approve", json={})
    assert requester_cannot_approve.status_code == 404
    _login(client, active_employee.email, "SecureEmp1!")
    owned = client.get("/api/access-requests?scope=owned&status=PENDING")
    assert owned.status_code == 200
    assert owned.json()["total"] == 1
    scoped_owned = client.get(
        f"/api/access-requests?scope=owned&status=PENDING&document_id={document.id}&page=1&page_size=1"
    )
    assert scoped_owned.status_code == 200
    assert scoped_owned.json()["total"] == 1
    approved = client.post(f"/api/access-requests/{request_id}/approve", json={"decision_reason": "Approved."})
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "APPROVED"
    grant = db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id == active_admin.id,
        )
    ).scalar_one()
    assert grant.is_effective is True
    assert grant.can_view is True and grant.can_edit is True and grant.can_download is False
    access_request = db.get(AccessRequest, uuid.UUID(request_id))
    assert access_request is not None and access_request.resulting_permission_id == grant.id
    audit_actions = set(
        db.execute(
            select(DocumentAuditLog.action_type).where(
                DocumentAuditLog.document_id_snapshot == document.id
            )
        ).scalars()
    )
    assert {"ACCESS_REQUEST_SUBMITTED", "ACCESS_REQUEST_APPROVED", "PERMISSION_GRANTED"} <= audit_actions
    assert db.execute(
        select(Notification).where(Notification.recipient_user_id == active_admin.id)
    ).scalar_one().notification_type == "ACCESS_REQUEST_APPROVED"

    _login(client, active_admin.email, "SecureAdmin1!")
    edited = client.patch(
        f"/api/documents/{document.id}",
        json={"title": "Quarterly report updated", "classification": "CONFIDENTIAL"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Quarterly report updated"

    monkeypatch.setattr(
        "app.routers.documents.put_document",
        lambda key, body, *, content_type, checksum_sha256: "replacement-s3-version",
    )
    monkeypatch.setattr("app.routers.documents.scan_document_bytes", lambda content: None)
    replacement = client.post(
        f"/api/documents/{document.id}/versions",
        files={"file": ("revised.pdf", b"%PDF-1.7\nrevised", "application/pdf")},
    )
    assert replacement.status_code == 201, replacement.text
    assert replacement.json()["current_version_number"] == 2
    assert replacement.json()["latest_uploaded_version_number"] == 2
    assert replacement.json()["latest_uploaded_version_status"] == "AVAILABLE"


def test_access_request_duplicate_deny_cancel_and_requester_scoping(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    _login(client, active_admin.email, "SecureAdmin1!")
    body = {
        "document_id": str(document.id),
        "requested_permissions": {"can_view": True},
        "reason": "Need to review this document.",
    }
    submitted = client.post("/api/access-requests", json=body)
    assert submitted.status_code == 201, submitted.text
    request_id = submitted.json()["id"]
    assert client.post("/api/access-requests", json=body).status_code == 409

    _login(client, active_employee.email, "SecureEmp1!")
    denied = client.post(
        f"/api/access-requests/{request_id}/deny",
        json={"decision_reason": "This document is not ready to share."},
    )
    assert denied.status_code == 200, denied.text
    assert denied.json()["status"] == "DENIED"
    assert db.execute(
        select(DocumentPermission).where(DocumentPermission.document_id == document.id)
    ).scalar_one_or_none() is None

    _login(client, active_admin.email, "SecureAdmin1!")
    second = client.post("/api/access-requests", json=body)
    assert second.status_code == 201, second.text
    second_id = second.json()["id"]
    cancelled = client.delete(f"/api/access-requests/{second_id}")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"
    assert client.get("/api/access-requests?scope=mine&status=CANCELLED").json()["total"] == 1

    _login(client, active_employee.email, "SecureEmp1!")
    owner_view = client.get(f"/api/access-requests/{second_id}")
    assert owner_view.status_code == 200
    assert owner_view.json()["is_reviewer"] is True
    assert client.post(f"/api/access-requests/{second_id}/approve", json={}).status_code == 409
