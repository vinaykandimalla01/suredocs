"""Authorization and response-shape tests for user profile endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

from app.core.security import generate_session_token, hash_session_token
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.user import User
from app.models.user_session import UserSession


def authenticate(client, db, user: User) -> None:
    token = generate_session_token()
    now = datetime.now(timezone.utc)
    db.add(
        UserSession(
            user_id=user.id,
            session_token_hash=hash_session_token(token),
            created_at=now,
            expires_at=now + timedelta(hours=1),
        )
    )
    db.flush()
    client.cookies.set("suredocs_session", token)


def test_admin_list_is_paginated_filtered_and_safe(client, db, active_admin, active_employee):
    active_employee.department = "SureDocs Test Department"
    active_employee.employee_code = "TEST-001"
    active_employee.job_title = "Engineer"
    db.flush()
    authenticate(client, db, active_admin)

    response = client.get(
        "/api/admin/users?page=1&page_size=1&role=EMPLOYEE&status=ACTIVE&department=suredocs%20test%20department"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["page_size"] == 1
    assert body["items"][0]["id"] == str(active_employee.id)
    assert body["items"][0]["employee_code"] == "TEST-001"
    assert "password_hash" not in response.text
    assert "session_token_hash" not in response.text
    employee_code_search = client.get("/api/admin/users?search=TEST-001")
    assert employee_code_search.status_code == 200
    assert employee_code_search.json()["total"] == 1


def test_admin_detail_resolves_creator_without_exposing_creator_id(
    client, db, active_admin, active_employee
):
    authenticate(client, db, active_admin)

    response = client.get(f"/api/admin/users/{active_employee.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["created_by"] == {
        "full_name": active_admin.full_name,
        "email": active_admin.email,
    }
    assert "password_hash" not in response.text
    assert str(active_admin.id) not in str(body["created_by"])


def test_admin_user_profile_returns_real_document_permission_and_security_data(
    client, db, active_admin, active_employee
):
    authenticate(client, db, active_admin)
    now = datetime.now(timezone.utc)
    document = Document(
        owner_user_id=active_employee.id,
        created_by_user_id=active_employee.id,
        title="Profile test document",
        classification="INTERNAL",
        status="ACTIVE",
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.flush()
    version_id = uuid.uuid4()
    version = DocumentVersion(
        id=version_id,
        document_id=document.id,
        version_number=1,
        storage_bucket="private-test-bucket",
        storage_key=f"documents/{document.id}/versions/{version_id}/content",
        original_filename="profile-test.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        size_bytes=1024,
        checksum_sha256="a" * 64,
        status="AVAILABLE",
        uploaded_by_user_id=active_employee.id,
        uploaded_at=now,
    )
    db.add(version)
    db.flush()
    document.current_version_id = version.id
    db.add(DocumentPermission(
        document_id=document.id,
        user_id=active_admin.id,
        can_view=True,
        can_download=False,
        can_edit=False,
        granted_by_user_id=active_employee.id,
        granted_at=now,
    ))
    db.add(DocumentAuditLog(
        document_id=document.id,
        document_id_snapshot=document.id,
        actor_user_id=active_employee.id,
        actor_user_id_snapshot=active_employee.id,
        actor_name_snapshot=active_employee.full_name,
        actor_email_snapshot=active_employee.email,
        actor_role_snapshot="EMPLOYEE",
        action_type="DOCUMENT_UPLOADED",
        result="SUCCESS",
        occurred_at=now,
        details={"filename": "profile-test.pdf", "storage_key": "must-not-leak"},
    ))
    db.add(AuthEvent(
        user_id=active_employee.id,
        event_type=AuthEventType.LOGIN_FAILED,
        occurred_at=now,
        ip_address="192.0.2.9",
        user_agent="Test Browser",
        details={"reason": "invalid_credentials"},
    ))
    db.flush()

    response = client.get(f"/api/admin/users/{active_employee.id}/profile")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["user"]["id"] == str(active_employee.id)
    assert payload["summary"]["owned_documents"] == 1
    assert payload["summary"]["shared_documents"] == 0
    assert payload["summary"]["documents_uploaded"] == 1
    assert payload["documents"][0]["filename"] == "profile-test.pdf"
    assert payload["documents"][0]["storage_reference_configured"] is True
    assert payload["permissions"][0]["direction"] == "granted"
    assert "two_factor_enabled" not in payload["security"]
    assert any(event["action"] == "LOGIN_FAILED" for event in payload["events"])
    assert "storage_key" not in response.text
    assert "session_token_hash" not in response.text

    shared_profile = client.get(f"/api/admin/users/{active_admin.id}/profile")
    assert shared_profile.status_code == 200, shared_profile.text
    shared_payload = shared_profile.json()
    assert shared_payload["summary"]["shared_documents"] == 1
    assert shared_payload["documents_total"] == 1
    assert shared_payload["documents"][0]["access"] == "Shared with user"
    assert shared_payload["permissions"][0]["direction"] == "received"


def test_employee_profile_uses_authenticated_identity_only(client, db, active_employee):
    authenticate(client, db, active_employee)

    response = client.get("/api/users/me/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(active_employee.id)
    assert body["email"] == active_employee.email
    assert body["role"] == "EMPLOYEE"
    assert "password_hash" not in response.text
    assert "session_token_hash" not in response.text


def test_employee_cannot_access_admin_user_list(client, db, active_employee):
    authenticate(client, db, active_employee)

    response = client.get("/api/admin/users")

    assert response.status_code == 403


def test_profile_endpoints_require_authentication(client):
    assert client.get("/api/admin/users").status_code == 401
    assert client.get("/api/admin/users/summary").status_code == 401
    assert client.get(f"/api/admin/users/{uuid.uuid4()}/profile").status_code == 401
    assert client.get("/api/users/me/profile").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_auth_me_returns_profile_for_authenticated_user(client, db, active_employee):
    authenticate(client, db, active_employee)

    response = client.get("/api/auth/me")
    assert response.status_code == 200
    user_data = response.json()["user"]
    assert user_data["id"] == str(active_employee.id)
    assert user_data["full_name"] == active_employee.full_name
    assert user_data["email"] == active_employee.email
    assert user_data["role"] == "EMPLOYEE"
    assert "password_hash" not in response.text


def test_two_users_sequential_login_and_logout(client, active_admin, active_employee):
    # Test A: Log in as first user (Admin)
    res1 = client.post("/api/auth/login", json={"email": active_admin.email, "password": "SecureAdmin1!"})
    assert res1.status_code == 200
    assert res1.json()["user"]["email"] == active_admin.email
    assert res1.json()["user"]["role"] == "ADMIN"

    me1 = client.get("/api/auth/me")
    assert me1.status_code == 200
    assert me1.json()["user"]["email"] == active_admin.email

    # Log out
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Test C: Unauthenticated access after logout
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/admin/users").status_code == 401

    # Test B: Log in as second user (Employee)
    res2 = client.post("/api/auth/login", json={"email": active_employee.email, "password": "SecureEmp1!"})
    assert res2.status_code == 200
    assert res2.json()["user"]["email"] == active_employee.email
    assert res2.json()["user"]["role"] == "EMPLOYEE"

    me2 = client.get("/api/auth/me")
    assert me2.status_code == 200
    assert me2.json()["user"]["email"] == active_employee.email
    assert me2.json()["user"]["full_name"] == active_employee.full_name

    # Confirm admin-only route is blocked for the employee
    assert client.get("/api/admin/users").status_code == 403
    assert client.get(f"/api/admin/users/{active_employee.id}/profile").status_code == 403


def test_admin_summary_endpoint(client, db, active_admin):
    authenticate(client, db, active_admin)
    response = client.get("/api/admin/users/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "active_users" in data
    assert "disabled_users" in data
    assert "pending_users" in data
    assert "administrator_users" in data


def test_admin_create_user_and_permissions(client, db, active_admin, active_employee):
    # Unauthenticated
    unauth = client.post("/api/admin/users", json={
        "first_name": "New",
        "last_name": "Employee",
        "email": "new.employee@suredocs.test",
        "role": "EMPLOYEE",
        "department": "Engineering",
        "password": "TempPassword123!",
    })
    assert unauth.status_code == 401

    # Employee forbidden
    authenticate(client, db, active_employee)
    forbidden = client.post("/api/admin/users", json={
        "first_name": "New",
        "last_name": "Employee",
        "email": "new.employee@suredocs.test",
        "role": "EMPLOYEE",
        "department": "Engineering",
        "password": "TempPassword123!",
    })
    assert forbidden.status_code == 403

    # Admin creates user successfully
    authenticate(client, db, active_admin)
    res = client.post("/api/admin/users", json={
        "first_name": "New",
        "last_name": "Employee",
        "email": "new.employee@suredocs.test",
        "role": "EMPLOYEE",
        "department": "Engineering",
        "password": "TempPassword123!",
    })
    assert res.status_code == 201
    created = res.json()
    assert created["full_name"] == "New Employee"
    assert created["email"] == "new.employee@suredocs.test"
    assert created["role"] == "EMPLOYEE"
    assert created["account_status"] == "PENDING"
    assert created["department"] == "Engineering"
    assert created["created_by"]["full_name"] == active_admin.full_name
    assert "password_hash" not in res.text

    # Duplicate email conflict
    dup = client.post("/api/admin/users", json={
        "first_name": "Another",
        "last_name": "Employee",
        "email": "new.employee@suredocs.test",
        "role": "EMPLOYEE",
        "department": "Engineering",
        "password": "TempPassword123!",
    })
    assert dup.status_code == 409
