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
    submit_audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "ACCESS_REQUEST_SUBMITTED",
        )
    ).scalar_one()
    assert submit_audit.details["previous_status"] is None
    assert submit_audit.details["new_status"] == "PENDING"

    mine = client.get("/api/access-requests?scope=mine&status=PENDING&page=1&page_size=10")
    assert mine.status_code == 200
    assert mine.json()["total"] == 1
    assert mine.json()["items"][0]["id"] == request_id
    search_result = client.get(
        "/api/access-requests?scope=mine&search=update%20the%20report"
    )
    assert search_result.status_code == 200
    assert search_result.json()["total"] == 1
    requester_date_filter = client.get(
        "/api/access-requests",
        params={
            "scope": "mine",
            "requester_user_id": str(active_admin.id),
            "requested_after": "2000-01-01T00:00:00Z",
            "requested_before": "2100-01-01T00:00:00Z",
        },
    )
    assert requester_date_filter.status_code == 200
    assert requester_date_filter.json()["total"] == 1
    invalid_date_filter = client.get(
        "/api/access-requests?scope=mine&requested_after=2026-10-25T00:00:00"
    )
    assert invalid_date_filter.status_code == 422
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
    before_approval_summary = client.get("/api/access-requests/summary")
    assert before_approval_summary.status_code == 200
    assert before_approval_summary.json()["pending_requests"] == 1
    assert before_approval_summary.json()["users_with_access"] == 0
    scoped_owned = client.get(
        f"/api/access-requests?scope=owned&status=PENDING&document_id={document.id}&page=1&page_size=1"
    )
    assert scoped_owned.status_code == 200
    assert scoped_owned.json()["total"] == 1
    approved = client.post(f"/api/access-requests/{request_id}/approve", json={"decision_reason": "Approved."})
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "APPROVED"
    after_approval_summary = client.get("/api/access-requests/summary")
    assert after_approval_summary.status_code == 200
    assert after_approval_summary.json()["pending_requests"] == 0
    assert after_approval_summary.json()["users_with_access"] == 1
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
    approval_audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "ACCESS_REQUEST_APPROVED",
        )
    ).scalar_one()
    assert approval_audit.details["previous_status"] == "PENDING"
    assert approval_audit.details["new_status"] == "APPROVED"
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
    denied_summary = client.get("/api/access-requests/summary")
    assert denied_summary.status_code == 200
    assert denied_summary.json()["denied_requests"] == 1
    assert denied_summary.json()["users_with_access"] == 0
    denial_audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "ACCESS_REQUEST_DENIED",
        )
    ).scalar_one()
    assert denial_audit.details["previous_status"] == "PENDING"
    assert denial_audit.details["new_status"] == "DENIED"
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


def test_denied_summary_counts_only_requests_for_owned_documents(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    employee_document = _seed_document(db, active_employee)
    admin_document = _seed_document(db, active_admin)
    body = {
        "requested_permissions": {"can_view": True},
        "reason": "Need to review this document for the current assignment.",
    }

    _login(client, active_admin.email, "SecureAdmin1!")
    employee_request = client.post(
        "/api/access-requests",
        json={**body, "document_id": str(employee_document.id)},
    )
    assert employee_request.status_code == 201, employee_request.text

    _login(client, active_employee.email, "SecureEmp1!")
    denied_by_employee = client.post(
        f"/api/access-requests/{employee_request.json()['id']}/deny",
        json={},
    )
    assert denied_by_employee.status_code == 200, denied_by_employee.text

    employee_request_to_admin = client.post(
        "/api/access-requests",
        json={**body, "document_id": str(admin_document.id)},
    )
    assert employee_request_to_admin.status_code == 201, employee_request_to_admin.text

    _login(client, active_admin.email, "SecureAdmin1!")
    denied_by_admin = client.post(
        f"/api/access-requests/{employee_request_to_admin.json()['id']}/deny",
        json={},
    )
    assert denied_by_admin.status_code == 200, denied_by_admin.text

    _login(client, active_employee.email, "SecureEmp1!")
    summary = client.get("/api/access-requests/summary")
    owned_denied = client.get("/api/access-requests?scope=owned&status=DENIED")
    assert summary.status_code == 200
    assert summary.json()["denied_requests"] == 1
    assert owned_denied.status_code == 200
    assert owned_denied.json()["total"] == 1
