from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.documents import Document, DocumentAuditLog
from app.models.persistence import DocumentAuditSecurityFlag
from app.models.user import User


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def _seed_document(db: Session, owner: User, title: str = "Activity document") -> Document:
    now = datetime.now(timezone.utc)
    document = Document(
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title=title,
        classification="CONFIDENTIAL",
        status="ACTIVE",
        custom_metadata={},
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.flush()
    return document


def _seed_event(
    db: Session,
    document: Document,
    actor: User | None,
    *,
    action: str = "DOCUMENT_VIEWED",
    result: str = "SUCCESS",
    occurred_at: datetime | None = None,
    details: dict | None = None,
    actor_snapshot: User | None = None,
    target_snapshot: User | None = None,
) -> DocumentAuditLog:
    event = DocumentAuditLog(
        document_id=document.id,
        document_id_snapshot=document.id,
        actor_user_id=actor.id if actor else None,
        actor_user_id_snapshot=actor_snapshot.id if actor_snapshot else None,
        actor_name_snapshot=actor_snapshot.full_name if actor_snapshot else None,
        actor_email_snapshot=actor_snapshot.email if actor_snapshot else None,
        actor_role_snapshot=actor_snapshot.role.value if actor_snapshot else None,
        target_user_id_snapshot=target_snapshot.id if target_snapshot else None,
        target_name_snapshot=target_snapshot.full_name if target_snapshot else None,
        target_email_snapshot=target_snapshot.email if target_snapshot else None,
        action_type=action,
        result=result,
        occurred_at=occurred_at or datetime.now(timezone.utc),
        details=details or {},
    )
    db.add(event)
    db.flush()
    return event


def test_activity_feed_is_scoped_to_owned_documents_and_keeps_real_actor(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    owned = _seed_document(db, active_employee, "Employee owned report")
    foreign = _seed_document(db, active_admin, "Admin private report")
    owned_event = _seed_event(db, owned, active_admin)
    _seed_event(db, foreign, active_employee)
    db.commit()

    _login(client, active_employee.email, "SecureEmp1!")
    response = client.get("/api/documents/activity?date_range=90d")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 1
    assert payload["successful"] == 1
    assert payload["denied"] == 0
    assert payload["items"][0]["id"] == str(owned_event.id)
    assert payload["items"][0]["actor"]["name"] == active_admin.full_name
    assert payload["items"][0]["actor"]["email"] == active_admin.email
    assert payload["items"][0]["document"]["title"] == owned.title

    _login(client, active_admin.email, "SecureAdmin1!")
    forbidden_detail = client.get(f"/api/documents/activity/events/{owned_event.id}")
    assert forbidden_detail.status_code == 404


def test_activity_search_filters_metrics_and_pagination_are_server_side(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee, "Quarterly finance report")
    now = datetime.now(timezone.utc)
    success = _seed_event(db, document, active_admin, occurred_at=now - timedelta(minutes=1))
    denied = _seed_event(
        db,
        document,
        active_admin,
        action="ACCESS_DENIED",
        result="DENIED",
        occurred_at=now,
    )
    db.commit()
    _login(client, active_employee.email, "SecureEmp1!")

    response = client.get(
        "/api/documents/activity",
        params={
            "search": "quarterly",
            "action": "DOCUMENT_VIEWED",
            "outcome": "SUCCESS",
            "date_range": "90d",
            "page": 1,
            "page_size": 1,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == payload["successful"] == 1
    assert payload["denied"] == 0
    assert [item["id"] for item in payload["items"]] == [str(success.id)]

    second_page = client.get(
        "/api/documents/activity?date_range=90d&page=2&page_size=1&sort=oldest"
    )
    assert second_page.status_code == 200, second_page.text
    assert second_page.json()["total"] == 2
    assert len(second_page.json()["items"]) == 1
    assert second_page.json()["items"][0]["id"] == str(denied.id)


def test_event_details_redact_secret_metadata_and_csv_exports_all_matches(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee, "=Sensitive title")
    event = _seed_event(
        db,
        document,
        None,
        details={
            "version_id": str(uuid.uuid4()),
            "reason": "authorized preview",
            "access_token": "must-not-leak",
            "storage_key": "private/s3/key",
        },
        actor_snapshot=active_admin,
        target_snapshot=active_employee,
    )
    second = _seed_event(db, document, active_employee, action="DOCUMENT_DOWNLOADED")
    db.commit()
    _login(client, active_employee.email, "SecureEmp1!")

    details = client.get(f"/api/documents/activity/events/{event.id}")
    assert details.status_code == 200, details.text
    assert set(details.json()["details"]) == {"version_id", "reason"}
    assert details.json()["actor"]["id"] == str(active_admin.id)
    assert details.json()["actor"]["name"] == active_admin.full_name
    assert details.json()["target"]["email"] == active_employee.email
    assert "must-not-leak" not in details.text
    assert "private/s3/key" not in details.text

    event_export = client.get(f"/api/documents/activity/events/{event.id}/export.json")
    assert event_export.status_code == 200, event_export.text
    assert event_export.headers["content-type"].startswith("application/json")
    assert event_export.json()["id"] == str(event.id)
    assert "must-not-leak" not in event_export.text

    exported = client.get("/api/documents/activity/export.csv?date_range=90d&action=DOCUMENT_VIEWED")
    assert exported.status_code == 200, exported.text
    assert exported.headers["content-type"].startswith("text/csv")
    assert "'=" in exported.text
    assert str(event.id) in exported.text
    assert str(second.id) not in exported.text
    assert active_admin.full_name in exported.text
    assert active_admin.email in exported.text


def test_security_flag_is_persisted_idempotently_and_owner_scoped(
    client: TestClient,
    db: Session,
    active_admin: User,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    event = _seed_event(db, document, active_admin, result="DENIED", action="ACCESS_DENIED")
    db.commit()
    _login(client, active_employee.email, "SecureEmp1!")
    submission_id = uuid.uuid4()
    body = {
        "submission_id": str(submission_id),
        "reason_code": "UNAUTHORIZED_ATTEMPT",
        "description": "This request was unexpected.",
    }

    first = client.post(f"/api/documents/activity/events/{event.id}/flags", json=body)
    assert first.status_code == 201, first.text
    duplicate = client.post(f"/api/documents/activity/events/{event.id}/flags", json=body)
    assert duplicate.status_code == 201, duplicate.text
    assert duplicate.json()["duplicate"] is True
    assert duplicate.json()["id"] == first.json()["id"]
    flags = db.execute(select(DocumentAuditSecurityFlag)).scalars().all()
    assert len(flags) == 1
    assert flags[0].event_id == event.id
    assert flags[0].reported_by_user_id == active_employee.id
    assert flags[0].reason_code == body["reason_code"]

    _login(client, active_admin.email, "SecureAdmin1!")
    forbidden = client.post(f"/api/documents/activity/events/{event.id}/flags", json={**body, "submission_id": str(uuid.uuid4())})
    assert forbidden.status_code == 404


def test_activity_routes_require_authentication(client: TestClient) -> None:
    assert client.get("/api/documents/activity").status_code == 401
    assert client.get(f"/api/documents/activity/events/{uuid.uuid4()}").status_code == 401


def test_document_metadata_lookup_does_not_create_a_successful_view_event(
    client: TestClient,
    db: Session,
    active_employee: User,
) -> None:
    document = _seed_document(db, active_employee)
    db.commit()
    _login(client, active_employee.email, "SecureEmp1!")

    response = client.get(f"/api/documents/{document.id}")
    assert response.status_code == 200, response.text
    successful_views = db.execute(
        select(func.count(DocumentAuditLog.id)).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_VIEWED",
            DocumentAuditLog.result == "SUCCESS",
        )
    ).scalar_one()
    assert successful_views == 0

    updated = client.patch(
        f"/api/documents/{document.id}",
        json={"title": "Updated activity document", "classification": "CONFIDENTIAL"},
    )
    assert updated.status_code == 200, updated.text
    audit = db.execute(
        select(DocumentAuditLog).where(
            DocumentAuditLog.document_id_snapshot == document.id,
            DocumentAuditLog.action_type == "DOCUMENT_METADATA_UPDATED",
        )
    ).scalar_one()
    assert audit.actor_user_id_snapshot == active_employee.id
    assert audit.actor_name_snapshot == active_employee.full_name
    assert audit.actor_email_snapshot == active_employee.email
    assert audit.actor_role_snapshot == active_employee.role.value


def test_custom_date_range_requires_timezone_aware_boundaries(
    client: TestClient,
    active_employee: User,
) -> None:
    _login(client, active_employee.email, "SecureEmp1!")
    missing_end = client.get(
        "/api/documents/activity?date_range=custom&start_at=2026-10-01T00:00:00Z"
    )
    assert missing_end.status_code == 422

    naive_date = client.get(
        "/api/documents/activity?date_range=custom&start_at=2026-10-01T00:00:00&end_at=2026-10-02T00:00:00Z"
    )
    assert naive_date.status_code == 422
