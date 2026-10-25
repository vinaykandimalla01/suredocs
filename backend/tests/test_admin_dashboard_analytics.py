"""Database-backed tests for secure administrator dashboard aggregates."""

from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.auth_event import AuthEvent, AuthEventType
from app.models.documents import Document, DocumentAuditLog, DocumentVersion
from app.models.user import AccountStatus, User, UserRole


def _login_admin(client: TestClient, email: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": "SecureAdmin1!"})
    assert response.status_code == 200, response.text


def _seed_document(db: Session, owner: User, title: str) -> Document:
    now = datetime.now(timezone.utc)
    document = Document(
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title=title,
        classification="INTERNAL",
        status="ACTIVE",
        custom_metadata={},
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.flush()
    return document


def _seed_version(
    db: Session,
    document: Document,
    actor: User,
    *,
    size: int,
    extension: str,
    content_type: str,
    uploaded_at: datetime,
    version_number: int = 1,
    status: str = "AVAILABLE",
    current: bool = False,
) -> DocumentVersion:
    version_id = uuid.uuid4()
    version = DocumentVersion(
        id=version_id,
        document_id=document.id,
        version_number=version_number,
        storage_bucket="private-dashboard-test",
        storage_key=f"documents/{document.id}/versions/{version_id}/content",
        s3_version_id=f"s3-version-{version_number}",
        original_filename=f"dashboard-test.{extension}",
        file_extension=extension,
        content_type=content_type,
        size_bytes=size,
        checksum_sha256="a" * 64,
        status=status,
        uploaded_by_user_id=actor.id,
        uploaded_at=uploaded_at,
        scan_completed_at=uploaded_at if status == "AVAILABLE" else None,
    )
    db.add(version)
    db.flush()
    if current:
        document.current_version_id = version.id
        db.flush()
    return version


def _seed_event(
    db: Session,
    document: Document,
    actor: User,
    *,
    action: str,
    result: str,
    occurred_at: datetime,
    operation: str | None = None,
) -> DocumentAuditLog:
    event = DocumentAuditLog(
        document_id=document.id,
        document_id_snapshot=document.id,
        actor_user_id=actor.id,
        actor_user_id_snapshot=actor.id,
        actor_name_snapshot=actor.full_name,
        actor_email_snapshot=actor.email,
        actor_role_snapshot=actor.role.value,
        action_type=action,
        result=result,
        occurred_at=occurred_at,
        details={"operation": operation} if operation else {},
    )
    db.add(event)
    db.flush()
    return event


def test_summary_uses_real_account_and_logical_document_counts(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
    disabled_user: User,
    pending_user: User,
) -> None:
    now = datetime.now(timezone.utc)
    old_employee = User(
        full_name="Historical status test",
        email=f"dashboard-status-{uuid.uuid4()}@suredocs.example",
        password_hash="fixture-password-hash",
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.ACTIVE,
        email_verified_at=now,
        created_at=now - timedelta(days=10),
        updated_at=now,
    )
    db.add(old_employee)
    db.flush()
    db.add(AuthEvent(
        user_id=old_employee.id,
        event_type=AuthEventType.USER_STATUS_CHANGED,
        occurred_at=now - timedelta(days=2),
        details={"before": "DISABLED", "after": "ACTIVE"},
    ))
    live_doc = _seed_document(db, active_admin, "Current dashboard logical document")
    live_doc.created_at = now - timedelta(days=20)
    _seed_version(
        db, live_doc, active_admin, size=512, extension="pdf", content_type="application/pdf",
        uploaded_at=now - timedelta(days=20), current=True,
    )
    failed_upload = _seed_document(db, active_admin, "Failed dashboard upload must not count")
    _seed_version(
        db, failed_upload, active_admin, size=2048, extension="pdf", content_type="application/pdf",
        uploaded_at=now - timedelta(days=2), status="FAILED",
    )
    deleted_doc = _seed_document(db, active_admin, "Deleted dashboard logical document")
    deleted_doc.status = "DELETED"
    deleted_doc.deleted_at = now - timedelta(days=1)
    db.flush()

    expected_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
    expected_active = int(db.scalar(select(func.count()).select_from(User).where(User.account_status == AccountStatus.ACTIVE)) or 0)
    expected_disabled = int(db.scalar(select(func.count()).select_from(User).where(User.account_status == AccountStatus.DISABLED)) or 0)
    expected_documents = int(db.scalar(select(func.count()).select_from(Document).where(
        Document.status != "DELETED", Document.deleted_at.is_(None), Document.current_version_id.is_not(None),
    )) or 0)
    db.commit()
    _login_admin(client, active_admin.email)

    response = client.get("/api/admin/dashboard/summary?days=7")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["users"] == {"total": expected_users, "active": expected_active, "disabled": expected_disabled}
    assert payload["documents"] == {"total": expected_documents}
    assert payload["period_days"] == 7
    assert payload["trends"]["active"]["change"] >= 1
    assert len(payload["trends"]["users"]["points"]) == 7
    assert len(payload["trends"]["documents"]["points"]) == 7
    assert "fixture-password-hash" not in response.text


def test_storage_uses_version_metadata_and_period_uploads_without_s3_scans(
    client: TestClient,
    db: Session,
    active_admin: User,
) -> None:
    now = datetime.now(timezone.utc)
    document = _seed_document(db, active_admin, "Storage metadata test")
    _seed_version(
        db, document, active_admin, size=1234, extension="pdf", content_type="application/pdf",
        uploaded_at=now - timedelta(days=1), version_number=1,
    )
    _seed_version(
        db, document, active_admin, size=4321, extension="docx",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploaded_at=now - timedelta(days=40), version_number=2, current=True,
    )
    baseline_total = int(db.scalar(select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0)).where(
        DocumentVersion.status.in_(("AVAILABLE", "PENDING_SCAN", "QUARANTINED", "PURGE_PENDING")),
    )) or 0) - 5555
    baseline_docs = int(db.scalar(select(func.count()).select_from(Document).where(
        Document.status != "DELETED", Document.deleted_at.is_(None), Document.current_version_id.is_not(None),
    )) or 0) - 1
    period_end = datetime.combine(now.date() + timedelta(days=1), time.min, tzinfo=timezone.utc)
    period_start = period_end - timedelta(days=30)
    expected_total_bytes = baseline_total + 5555
    expected_added_bytes = int(db.scalar(select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0)).where(
        DocumentVersion.status.in_(("AVAILABLE", "PENDING_SCAN", "QUARANTINED", "PURGE_PENDING")),
        DocumentVersion.uploaded_at >= period_start,
        DocumentVersion.uploaded_at < period_end,
    )) or 0)
    has_purged_history = bool(db.scalar(select(func.count()).select_from(DocumentVersion).where(
        DocumentVersion.status == "PURGED",
    )) or 0)
    starting_bytes = expected_total_bytes - expected_added_bytes
    expected_growth = (
        None if has_purged_history or starting_bytes <= 0
        else round((expected_total_bytes - starting_bytes) * 100.0 / starting_bytes, 1)
    )
    db.commit()
    _login_admin(client, active_admin.email)

    response = client.get("/api/admin/dashboard/storage?days=30")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total_bytes"] == baseline_total + 5555
    assert payload["added_bytes"] >= 1234
    assert payload["growth_percent"] == expected_growth
    assert payload["logical_documents"] == baseline_docs + 1
    categories = {row["key"]: row for row in payload["categories"]}
    assert categories["pdf"]["bytes"] >= 1234
    assert categories["office"]["bytes"] >= 4321
    assert sum(row["bytes"] for row in payload["categories"]) == payload["total_bytes"]
    assert "storage_key" not in response.text
    assert "private-dashboard-test" not in response.text


def test_denied_and_operation_aggregates_use_persisted_results_and_utc_boundaries(
    client: TestClient,
    db: Session,
    active_admin: User,
) -> None:
    now = datetime.now(timezone.utc)
    boundary = datetime.combine(now.date() - timedelta(days=6), time.min, tzinfo=timezone.utc)
    actor = User(
        full_name="Unique dashboard denial actor",
        email=f"dashboard-denial-{uuid.uuid4()}@suredocs.example",
        password_hash="fixture-password-hash",
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.ACTIVE,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(actor)
    db.flush()
    document = _seed_document(db, active_admin, "Denied access dashboard test")

    baseline_denials = int(db.scalar(select(func.count(DocumentAuditLog.id)).where(
        DocumentAuditLog.occurred_at >= boundary,
        DocumentAuditLog.action_type == "ACCESS_DENIED",
        DocumentAuditLog.result == "DENIED",
        DocumentAuditLog.details["operation"].as_string().in_(("view", "download", "edit", "edit_metadata", "replace", "delete")),
    )) or 0)
    baseline_attempts = int(db.scalar(select(func.count(DocumentAuditLog.id)).where(
        DocumentAuditLog.occurred_at >= boundary,
        or_(
            (DocumentAuditLog.result == "SUCCESS") & DocumentAuditLog.action_type.in_((
                "DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED", "DOCUMENT_METADATA_UPDATED",
                "DOCUMENT_VERSION_CREATED", "DOCUMENT_DELETED", "DOCUMENT_RESTORED",
            )),
            (DocumentAuditLog.action_type == "ACCESS_DENIED")
            & (DocumentAuditLog.result == "DENIED")
            & DocumentAuditLog.details["operation"].as_string().in_(("view", "download", "edit", "edit_metadata", "replace", "delete")),
            DocumentAuditLog.action_type.in_(("DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED"))
            & (DocumentAuditLog.result == "DENIED"),
        ),
    )) or 0)
    _seed_event(db, document, actor, action="DOCUMENT_VIEWED", result="SUCCESS", occurred_at=boundary)
    _seed_event(db, document, actor, action="ACCESS_DENIED", result="DENIED", operation="view", occurred_at=now)
    _seed_event(db, document, actor, action="ACCESS_DENIED", result="DENIED", operation="manage_permissions", occurred_at=now)
    _seed_event(db, document, actor, action="DOCUMENT_DOWNLOADED", result="SUCCESS", occurred_at=now)
    _seed_event(db, document, actor, action="DOCUMENT_VIEWED", result="FAILED", occurred_at=now)
    db.commit()
    _login_admin(client, active_admin.email)

    denied_response = client.get("/api/admin/dashboard/denied-requests?days=7")
    assert denied_response.status_code == 200, denied_response.text
    denied_payload = denied_response.json()
    assert denied_payload["denied"] == baseline_denials + 1
    assert denied_payload["total_access_attempts"] == baseline_attempts + 3
    assert denied_payload["unique_users"] >= 1
    assert denied_payload["distinct_documents"] >= 1
    assert denied_payload["daily"][0]["count"] >= 0
    assert len(denied_payload["daily"]) == 7

    operation_response = client.get("/api/admin/dashboard/operations?days=7&operation=read_view")
    assert operation_response.status_code == 200, operation_response.text
    operation_payload = operation_response.json()
    assert operation_payload["operation"] == "read_view"
    assert operation_payload["totals"]["success"] >= 1
    assert operation_payload["totals"]["denied"] >= 1
    assert len(operation_payload["daily"]) == 7
    assert operation_payload["by_type"][0]["key"] == "read_view"
    assert operation_payload["daily"][0]["success"] >= 1


def test_admin_analytics_filters_are_validated_and_protected(
    client: TestClient,
    active_employee: User,
    active_admin: User,
) -> None:
    assert client.get("/api/admin/dashboard/storage?days=365").status_code == 401
    response = client.post("/api/auth/login", json={"email": active_employee.email, "password": "SecureEmp1!"})
    assert response.status_code == 200, response.text
    assert client.get("/api/admin/dashboard/storage?days=30").status_code == 403
    _login_admin(client, active_admin.email)
    assert client.get("/api/admin/dashboard/storage?days=365").status_code == 422
    assert client.get("/api/admin/dashboard/denied-requests?days=5").status_code == 422
    assert client.get("/api/admin/dashboard/operations?operation=delete%3Bselect").status_code == 422
