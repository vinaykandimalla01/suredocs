from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.user import AccountStatus, User, UserRole

_PDF = b"%PDF-1.7\npermission admin test\n"


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def _seed_document_and_grants(db: Session, owner: User) -> tuple[Document, list[DocumentPermission], User]:
    now = datetime.now(timezone.utc)
    document_id = uuid.uuid4()
    version_id = uuid.uuid4()
    recipient = User(
        full_name="Shared Recipient",
        email=f"recipient-{uuid.uuid4()}@suredocs.example",
        password_hash=hash_password("SecureRecipient1!"),
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.ACTIVE,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
        password_changed_at=now,
        department="Finance",
        job_title="Analyst",
    )
    db.add(recipient)
    db.flush()
    document = Document(
        id=document_id,
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title="Admin permissions test.pdf",
        description="Metadata used by the admin permissions tests.",
        category="Legal",
        classification="CONFIDENTIAL",
        department="Finance",
        status="ACTIVE",
        custom_metadata={"source": "test"},
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.flush()
    version = DocumentVersion(
        id=version_id,
        document_id=document.id,
        version_number=1,
        storage_bucket="suredocs-private-documents-dev",
        storage_key=f"documents/{document_id}/versions/{version_id}/content",
        original_filename="admin-test.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        size_bytes=len(_PDF),
        checksum_sha256="b" * 64,
        status="AVAILABLE",
        uploaded_by_user_id=owner.id,
        uploaded_at=now,
        created_at=now,
    )
    db.add(version)
    db.flush()
    document.current_version_id = version.id
    grants = [
        DocumentPermission(
            document_id=document.id,
            user_id=recipient.id,
            can_view=True,
            can_download=False,
            granted_by_user_id=owner.id,
            granted_at=now,
        ),
        DocumentPermission(
            document_id=document.id,
            user_id=owner.created_by or owner.id,
            can_view=True,
            can_download=True,
            granted_by_user_id=owner.id,
            granted_at=now,
        ),
    ]
    # The second grant belongs to the administrator in these fixtures.
    if owner.created_by is None:
        grants[1].user_id = owner.id
    db.add_all(grants)
    db.flush()
    return document, grants, recipient


def test_admin_permission_records_and_document_details_are_real_and_authorized(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document, grants, recipient = _seed_document_and_grants(db, active_employee)
    db.add(DocumentAuditLog(
        document_id=document.id,
        document_id_snapshot=document.id,
        actor_user_id=active_employee.id,
        target_user_id=recipient.id,
        action_type="PERMISSION_GRANTED",
        result="SUCCESS",
        occurred_at=datetime.now(timezone.utc),
        details={"can_view": True, "can_download": False},
    ))
    db.flush()
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    records = client.get("/api/admin/permissions/records", params={"user_id": str(recipient.id)})
    assert records.status_code == 200, records.text
    payload = records.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == str(grants[0].id)
    assert payload["items"][0]["document_id"] == str(document.id)
    assert payload["items"][0]["document_title"] == document.title
    assert payload["items"][0]["permission_type"] == "Read"
    assert payload["summary"]["active_grants"] >= 2
    assert payload["summary"]["read_permissions"] >= 1
    assert payload["summary"]["download_permissions"] >= 1
    assert any(option["id"] == str(active_employee.id) for option in payload["owners"])
    assert any(option["id"] == str(recipient.id) for option in payload["users"])

    searched = client.get("/api/admin/permissions/records", params={"search": recipient.email})
    assert searched.status_code == 200
    assert searched.json()["total"] == 1
    downloaded = client.get(
        "/api/admin/permissions/records",
        params={
            "permission_type": "Read + Download",
            "user_id": str(active_admin.id),
            "page_size": 1,
        },
    )
    assert downloaded.status_code == 200
    assert downloaded.json()["total"] == 1
    assert downloaded.json()["items"][0]["id"] == str(grants[1].id)

    detail = client.get(f"/api/admin/permissions/documents/{document.id}")
    assert detail.status_code == 200, detail.text
    detail_payload = detail.json()
    assert detail_payload["document"]["owner"]["id"] == str(active_employee.id)
    assert detail_payload["document"]["owner"]["role"] == "EMPLOYEE"
    assert {item["id"] for item in detail_payload["permissions"]} == {str(grant.id) for grant in grants}
    assert detail_payload["audit"][0]["target_email"] == recipient.email
    assert "storage_key" not in detail.text
    assert "storage_bucket" not in detail.text

    client.post("/api/auth/logout")
    _login(client, "testemployee@suredocs.example", "SecureEmp1!")
    assert client.get(f"/api/admin/permissions/documents/{document.id}").status_code == 403
    assert client.get("/api/admin/permissions/records").status_code == 403
    denied_revoke = client.request(
        "DELETE",
        f"/api/admin/permissions/documents/{document.id}/grants/{grants[0].id}",
        json={"reason": "This employee must not use the admin revoke endpoint."},
    )
    assert denied_revoke.status_code == 403
    db.refresh(grants[0])
    assert grants[0].revoked_at is None


def test_admin_revoke_changes_only_selected_active_grant_and_audits_reason(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document, grants, recipient = _seed_document_and_grants(db, active_employee)
    selected_grant = grants[0]
    other_grant = grants[1]
    # Keep the second target distinct from the recipient and document owner.
    other_grant.user_id = active_admin.id
    db.flush()
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    response = client.request(
        "DELETE",
        f"/api/admin/permissions/documents/{document.id}/grants/{selected_grant.id}",
        json={"reason": "Access is no longer required for this review."},
    )
    assert response.status_code == 204, response.text
    db.refresh(selected_grant)
    db.refresh(other_grant)
    assert selected_grant.revoked_at is not None
    assert selected_grant.revoked_by_user_id == active_admin.id
    assert other_grant.revoked_at is None

    audit = db.query(DocumentAuditLog).filter_by(
        document_id_snapshot=document.id,
        action_type="PERMISSION_REVOKED",
    ).one()
    assert audit.actor_user_id == active_admin.id
    assert audit.target_user_id == recipient.id
    assert audit.details["permission_id"] == str(selected_grant.id)
    assert audit.details["reason"] == "Access is no longer required for this review."
    assert audit.details["can_view"] is True

    repeated = client.request(
        "DELETE",
        f"/api/admin/permissions/documents/{document.id}/grants/{selected_grant.id}",
        json={"reason": "Duplicate revoke attempt."},
    )
    assert repeated.status_code == 409


def test_admin_revoke_validates_reason_scope_and_owner_protection(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document, grants, _recipient = _seed_document_and_grants(db, active_employee)
    # A legacy or corrupt owner grant must still be protected by the admin route.
    owner_grant = DocumentPermission(
        document_id=document.id,
        user_id=active_employee.id,
        can_view=True,
        can_download=False,
        granted_by_user_id=active_employee.id,
        granted_at=datetime.now(timezone.utc),
    )
    db.add(owner_grant)
    db.flush()
    _login(client, "testadmin@suredocs.example", "SecureAdmin1!")

    blank_reason = client.request(
        "DELETE",
        f"/api/admin/permissions/documents/{document.id}/grants/{grants[0].id}",
        json={"reason": "  "},
    )
    assert blank_reason.status_code == 422
    wrong_document = client.request(
        "DELETE",
        f"/api/admin/permissions/documents/{uuid.uuid4()}/grants/{grants[0].id}",
        json={"reason": "Test wrong document scope."},
    )
    assert wrong_document.status_code == 404
    owner_revoke = client.request(
        "DELETE",
        f"/api/admin/permissions/documents/{document.id}/grants/{owner_grant.id}",
        json={"reason": "Test owner guard."},
    )
    assert owner_revoke.status_code == 409
