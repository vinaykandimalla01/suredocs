from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.persistence import AccessRequest, Notification
from app.models.user import AccountStatus, User, UserRole


def _login(client: TestClient, email: str, password: str = "SecureEmp1!") -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def _seed_document(db: Session, owner: User, title: str = "Sharing API document") -> Document:
    now = datetime.now(timezone.utc)
    document_id = uuid.uuid4()
    version_id = uuid.uuid4()
    document = Document(
        id=document_id,
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title=title,
        category="Project Documents",
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
        original_filename="sharing-source.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        size_bytes=1234,
        checksum_sha256="b" * 64,
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


def _second_active_user(db: Session, creator: User) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        full_name="Second Active User",
        email=f"sharing-{uuid.uuid4().hex[:10]}@suredocs.example",
        password_hash=hash_password("SecureEmp1!"),
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.ACTIVE,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
        password_changed_at=now,
        created_by=creator.id,
    )
    db.add(user)
    db.flush()
    return user


def _grant(
    db: Session,
    document: Document,
    owner: User,
    recipient: User,
    *,
    expires_at: datetime | None = None,
    revoked_at: datetime | None = None,
) -> DocumentPermission:
    now = datetime.now(timezone.utc)
    grant = DocumentPermission(
        document_id=document.id,
        user_id=recipient.id,
        can_view=True,
        can_download=False,
        can_edit=False,
        granted_by_user_id=owner.id,
        granted_at=now,
        expires_at=expires_at,
        revoked_at=revoked_at,
        revoked_by_user_id=owner.id if revoked_at else None,
        created_at=now,
        updated_at=now,
    )
    db.add(grant)
    db.flush()
    return grant


def test_owner_sees_real_grants_and_database_derived_summary(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    now = datetime.now(timezone.utc)
    _grant(db, document, active_employee, active_admin)
    expiring_user = _second_active_user(db, active_admin)
    _grant(db, document, active_employee, expiring_user, expires_at=now + timedelta(days=15))
    revoked_user = _second_active_user(db, active_admin)
    _grant(db, document, active_employee, revoked_user, revoked_at=now - timedelta(days=1))
    denied_requester = _second_active_user(db, active_admin)
    db.add(AccessRequest(
        document_id=document.id,
        requester_user_id=denied_requester.id,
        requested_permissions={"can_view": True},
        reason="Need to review the project document",
        status="DENIED",
        requested_at=now - timedelta(days=2),
        decided_by_user_id=active_employee.id,
        decided_at=now - timedelta(days=1),
        decision_reason="Not required for this role",
    ))
    db.commit()

    _login(client, active_employee.email)
    summary = client.get("/api/sharing/summary")
    assert summary.status_code == 200, summary.text
    assert summary.json() == {
        "active_grants": 2,
        "expiring_soon": 1,
        "denied_permissions": 2,
        "denied_window_days": 90,
    }

    owned_options = client.get("/api/sharing/documents?shared_only=false&page_size=10")
    assert owned_options.status_code == 200, owned_options.text
    assert [item["id"] for item in owned_options.json()["items"]] == [str(document.id)]
    shared_options = client.get("/api/sharing/documents?shared_only=true&page_size=10")
    assert shared_options.status_code == 200, shared_options.text
    assert shared_options.json()["total"] == 1

    response = client.get("/api/sharing/grants?date_window=all&page_size=10")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 4
    assert {item["document_title"] for item in payload["items"]} == {document.title}
    assert {item["recipient_email"] for item in payload["items"]} == {
        active_admin.email,
        expiring_user.email,
        revoked_user.email,
        denied_requester.email,
    }
    assert {item["status"] for item in payload["items"]} == {"active", "expiring_soon", "revoked", "denied"}
    denied = client.get("/api/sharing/grants?status=denied&date_window=all")
    assert denied.status_code == 200, denied.text
    assert denied.json()["total"] == 1
    search = client.get(f"/api/sharing/grants?search={expiring_user.email}&date_window=all")
    assert search.status_code == 200, search.text
    assert search.json()["total"] == 1
    paged = client.get("/api/sharing/grants?date_window=all&page_size=1&page=2")
    assert paged.status_code == 200, paged.text
    assert paged.json()["total"] == 4
    assert len(paged.json()["items"]) == 1


def test_multi_recipient_grants_update_one_recipient_and_detect_stale_changes(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    second_recipient = _second_active_user(db, active_admin)
    _login(client, active_employee.email)

    shared = client.post("/api/sharing/grants", json={
        "document_id": str(document.id),
        "recipient_ids": [str(active_admin.id), str(second_recipient.id)],
        "can_view": True,
        "can_download": True,
        "can_edit": False,
        "message": "Please review this file.",
    })
    assert shared.status_code == 201, shared.text
    grants = shared.json()
    assert len(grants) == 2
    assert all(grant["can_view"] and grant["can_download"] and not grant["can_edit"] for grant in grants)
    assert db.scalar(select(func.count()).select_from(DocumentVersion).where(DocumentVersion.document_id == document.id)) == 1
    duplicate = client.post("/api/sharing/grants", json={
        "document_id": str(document.id),
        "recipient_ids": [str(active_admin.id)],
        "can_view": True,
    })
    assert duplicate.status_code == 409
    assert db.scalar(select(Notification.id).where(
        Notification.recipient_user_id == active_admin.id,
        Notification.document_id == document.id,
        Notification.message.ilike("%Please review this file.%"),
    )) is not None

    target = grants[0]
    updated = client.patch(f"/api/sharing/documents/{document.id}/grants", json={
        "updates": [{
            "permission_id": target["id"],
            "expected_updated_at": target["updated_at"],
            "can_view": True,
            "can_download": False,
            "can_edit": True,
            "expires_at": None,
        }],
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()["items"][0]["can_edit"] is True

    stale = client.patch(f"/api/sharing/documents/{document.id}/grants", json={
        "updates": [{
            "permission_id": target["id"],
            "expected_updated_at": target["updated_at"],
            "can_view": True,
            "can_download": True,
            "can_edit": False,
            "expires_at": None,
        }],
    })
    assert stale.status_code == 409
    db.expire_all()
    persisted = db.execute(
        select(DocumentPermission).where(DocumentPermission.document_id == document.id)
    ).scalars().all()
    assert len(persisted) == 2
    changed = next(item for item in persisted if str(item.id) == target["id"])
    untouched = next(item for item in persisted if str(item.id) != target["id"])
    assert changed.can_edit and not changed.can_download
    assert untouched.can_download and not untouched.can_edit
    assert db.scalar(select(DocumentAuditLog.id).where(
        DocumentAuditLog.document_id_snapshot == document.id,
        DocumentAuditLog.action_type == "PERMISSION_GRANTED",
    )) is not None


def test_revoke_all_is_owner_scoped_and_non_owners_cannot_manage_grants(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    second_recipient = _second_active_user(db, active_admin)
    _login(client, active_employee.email)
    created = client.post("/api/sharing/grants", json={
        "document_id": str(document.id),
        "recipient_ids": [str(active_admin.id), str(second_recipient.id)],
        "can_view": True,
        "can_download": False,
        "can_edit": False,
    })
    assert created.status_code == 201, created.text

    revoked = client.post(f"/api/sharing/documents/{document.id}/revoke-all", json={})
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["revoked_count"] == 2
    grants = db.execute(
        select(DocumentPermission).where(DocumentPermission.document_id == document.id)
    ).scalars().all()
    assert len(grants) == 2
    assert all(grant.revoked_at is not None and grant.revoked_by_user_id == active_employee.id for grant in grants)

    client.post("/api/auth/logout")
    _login(client, active_admin.email, "SecureAdmin1!")
    denied = client.post("/api/sharing/grants", json={
        "document_id": str(document.id),
        "recipient_ids": [str(second_recipient.id)],
        "can_view": True,
    })
    assert denied.status_code in {403, 404}
    owner_filtered = client.get("/api/sharing/grants?date_window=all")
    assert owner_filtered.status_code == 200, owner_filtered.text
    assert all(item["document_id"] != str(document.id) for item in owner_filtered.json()["items"])
    assert len(db.execute(
        select(DocumentPermission).where(DocumentPermission.document_id == document.id)
    ).scalars().all()) == 2


@pytest.mark.parametrize(
    ("permission", "expected"),
    [
        ({"can_view": True, "can_download": False, "can_edit": False}, (True, False, False)),
        ({"can_view": True, "can_download": True, "can_edit": False}, (True, True, False)),
        ({"can_view": True, "can_download": False, "can_edit": True}, (True, False, True)),
        ({"can_view": True, "can_download": True, "can_edit": True}, (True, True, True)),
    ],
)
def test_all_four_permission_combinations_are_persisted(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    permission: dict[str, bool],
    expected: tuple[bool, bool, bool],
) -> None:
    document = _seed_document(db, active_employee)
    _login(client, active_employee.email)
    response = client.post("/api/sharing/grants", json={
        "document_id": str(document.id),
        "recipient_ids": [str(active_admin.id)],
        **permission,
    })
    assert response.status_code == 201, response.text
    grant = response.json()[0]
    assert (grant["can_view"], grant["can_download"], grant["can_edit"]) == expected
