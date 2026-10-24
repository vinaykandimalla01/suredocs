"""Database-backed administrator and employee user profile endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.config import COOKIE_NAME
from app.core.dependencies import get_current_user, require_admin, require_employee
from app.core.security import hash_password, hash_session_token, verify_password
from app.db.session import get_db
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.documents import Document, DocumentVersion
from app.models.persistence import Notification, UserMfaMethod
from app.models.user import AccountStatus, User, UserRole
from app.models.user_session import UserSession
from app.services.mfa import (
    MfaServiceUnavailable,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_totp_secret,
    provisioning_uri,
    verify_totp,
)
from app.services.notifications import (
    DEFAULT_DISPLAY_SETTINGS,
    DEFAULT_NOTIFICATION_SETTINGS,
    preferences_for,
)
from app.schemas.users import (
    AdminUserCreateRequest,
    AdminUserDetailResponse,
    AdminUserListItem,
    AdminUserPageResponse,
    AdminUserSummaryResponse,
    ChangePasswordRequest,
    ConnectedAccountItem,
    CreatorSummary,
    DisplayPreferences,
    EmployeeMyProfileResponse,
    EmployeeProfileUpdateRequest,
    NotificationPreferences,
    NotificationListResponse,
    NotificationResponse,
    AdminUserUpdateRequest,
    StorageBreakdownItem,
    StorageSummaryResponse,
    TotpConfirmRequest,
    TotpDisableRequest,
    TotpSetupRequest,
    UserSessionItem,
)

admin_router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])
employee_router = APIRouter(prefix="/api/users", tags=["user-profile"])


@admin_router.post(
    "",
    response_model=AdminUserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_user(
    body: AdminUserCreateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserDetailResponse:
    """Create or invite a new user account with hashed password and pending status."""
    normalized_email = body.email.strip().lower()
    existing = db.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    now = datetime.now(timezone.utc)
    new_user = User(
        id=uuid.uuid4(),
        full_name=f"{body.first_name.strip()} {body.last_name.strip()}",
        email=normalized_email,
        password_hash=hash_password(body.password),
        role=body.role,
        account_status=AccountStatus.PENDING,
        department=body.department.strip() if body.department else None,
        job_title=None,
        employee_code=f"SD-{uuid.uuid4().hex[:6].upper()}",
        must_change_password=body.require_password_change,
        created_by=current_admin.id,
        created_at=now,
        updated_at=now,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return AdminUserDetailResponse(
        id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        role=new_user.role,
        account_status=new_user.account_status,
        employee_code=new_user.employee_code,
        department=new_user.department,
        job_title=new_user.job_title,
        email_verified_at=new_user.email_verified_at,
        last_login_at=new_user.last_login_at,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
        password_changed_at=new_user.password_changed_at,
        created_by=CreatorSummary(
            full_name=current_admin.full_name,
            email=current_admin.email,
        ),
    )


@admin_router.get(
    "/summary",
    response_model=AdminUserSummaryResponse,
    dependencies=[Depends(require_admin)],
)
async def get_user_summary(
    db: Session = Depends(get_db),
) -> AdminUserSummaryResponse:
    """Return account totals for the existing administrator dashboard."""
    total = select(func.count()).select_from(User).scalar_subquery()
    active = (
        select(func.count())
        .select_from(User)
        .where(User.account_status == AccountStatus.ACTIVE)
        .scalar_subquery()
    )
    disabled = (
        select(func.count())
        .select_from(User)
        .where(User.account_status == AccountStatus.DISABLED)
        .scalar_subquery()
    )
    pending = (
        select(func.count())
        .select_from(User)
        .where(User.account_status == AccountStatus.PENDING)
        .scalar_subquery()
    )
    administrators = (
        select(func.count())
        .select_from(User)
        .where(User.role == UserRole.ADMIN)
        .scalar_subquery()
    )
    row = db.execute(select(total, active, disabled, pending, administrators)).one()
    return AdminUserSummaryResponse(
        total_users=row[0],
        active_users=row[1],
        disabled_users=row[2],
        pending_users=row[3],
        administrator_users=row[4],
    )


@admin_router.get(
    "",
    response_model=AdminUserPageResponse,
    dependencies=[Depends(require_admin)],
)
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    role: UserRole | None = None,
    status_filter: AccountStatus | None = Query(default=None, alias="status"),
    department: str | None = Query(default=None, max_length=100),
    sort_by: Literal["created-desc", "created-asc", "name-asc", "last-login-desc"] = "created-desc",
    db: Session = Depends(get_db),
) -> AdminUserPageResponse:
    """Return a paginated, filtered list containing only display-safe fields."""
    filters = []
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        filters.append(
            User.full_name.ilike(search_term) | User.email.ilike(search_term)
        )
    if role is not None:
        filters.append(User.role == role)
    if status_filter is not None:
        filters.append(User.account_status == status_filter)
    if department and department.strip():
        filters.append(func.lower(User.department) == department.strip().lower())

    total = db.scalar(select(func.count()).select_from(User).where(*filters)) or 0
    ordering = {
        "created-desc": (User.created_at.desc(), User.id),
        "created-asc": (User.created_at.asc(), User.id),
        "name-asc": (func.lower(User.full_name), User.id),
        "last-login-desc": (User.last_login_at.desc().nullslast(), User.id),
    }[sort_by]
    rows = db.execute(
        select(
            User.id,
            User.full_name,
            User.email,
            User.role,
            User.account_status,
            User.department,
            User.job_title,
            User.employee_code,
            User.created_at,
            User.last_login_at,
        )
        .where(*filters)
        .order_by(*ordering)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).mappings()

    return AdminUserPageResponse(
        items=[AdminUserListItem(**row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size),
    )


@admin_router.get(
    "/{user_id}",
    response_model=AdminUserDetailResponse,
    dependencies=[Depends(require_admin)],
)
async def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> AdminUserDetailResponse:
    """Return a safe profile view and creator display name, never raw creator ID."""
    creator = aliased(User)
    row = db.execute(
        select(
            User.id,
            User.full_name,
            User.email,
            User.role,
            User.account_status,
            User.employee_code,
            User.department,
            User.job_title,
            User.email_verified_at,
            User.last_login_at,
            User.created_at,
            User.updated_at,
            User.password_changed_at,
            creator.id.label("creator_id"),
            creator.full_name.label("creator_full_name"),
            creator.email.label("creator_email"),
        )
        .outerjoin(creator, User.created_by == creator.id)
        .where(User.id == user_id)
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return AdminUserDetailResponse(
        id=row["id"],
        full_name=row["full_name"],
        email=row["email"],
        role=row["role"],
        account_status=row["account_status"],
        employee_code=row["employee_code"],
        department=row["department"],
        job_title=row["job_title"],
        email_verified_at=row["email_verified_at"],
        last_login_at=row["last_login_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        password_changed_at=row["password_changed_at"],
        created_by=(
            CreatorSummary(
                full_name=row["creator_full_name"],
                email=row["creator_email"],
            )
            if row["creator_id"] is not None
            else None
        ),
    )


@admin_router.patch(
    "/{user_id}",
    response_model=AdminUserDetailResponse,
    dependencies=[Depends(require_admin)],
)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdateRequest,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserDetailResponse:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one user field to update.")
    if "role" in changes and body.role is None:
        raise HTTPException(status_code=422, detail="Role cannot be null.")
    if "account_status" in changes and body.account_status is None:
        raise HTTPException(status_code=422, detail="Account status cannot be null.")
    if "full_name" in changes and body.full_name is None:
        raise HTTPException(status_code=422, detail="Full name cannot be blank.")

    # Serialize administrator demotions/deactivations so concurrent updates
    # cannot remove the final active administrator.
    active_admins = db.execute(
        select(User)
        .where(User.role == UserRole.ADMIN, User.account_status == AccountStatus.ACTIVE)
        .order_by(User.id)
        .with_for_update()
    ).scalars().all()
    target = db.execute(
        select(User).where(User.id == user_id).with_for_update()
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")

    before_role = target.role
    before_status = target.account_status
    after_role = body.role if "role" in changes else before_role
    after_status = body.account_status if "account_status" in changes else before_status
    if (
        before_role == UserRole.ADMIN
        and before_status == AccountStatus.ACTIVE
        and (after_role != UserRole.ADMIN or after_status != AccountStatus.ACTIVE)
        and len(active_admins) <= 1
    ):
        raise HTTPException(status_code=409, detail="The last active administrator cannot be demoted or deactivated.")
    if (
        target.id == current_admin.id
        and after_status != AccountStatus.ACTIVE
    ):
        raise HTTPException(status_code=409, detail="You cannot deactivate your own administrator account.")
    if after_status == AccountStatus.ACTIVE and target.email_verified_at is None:
        raise HTTPException(status_code=409, detail="Verify the user's email before activating the account.")

    now = datetime.now(timezone.utc)
    for field in ("full_name", "department", "job_title"):
        if field in changes:
            value = changes[field]
            if field == "full_name" and not value:
                raise HTTPException(status_code=422, detail="Full name cannot be blank.")
            setattr(target, field, value)
    if "role" in changes:
        target.role = after_role
    if "account_status" in changes:
        target.account_status = after_status
    target.updated_at = now

    if before_role != after_role:
        db.add(
            AuthEvent(
                user_id=target.id,
                event_type=AuthEventType.USER_ROLE_CHANGED,
                occurred_at=now,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent", "")[:512] or None,
                details={
                    "actor_user_id": str(current_admin.id),
                    "before": before_role.value,
                    "after": after_role.value,
                },
            )
        )
    if before_status != after_status:
        details = {
            "actor_user_id": str(current_admin.id),
            "before": before_status.value,
            "after": after_status.value,
        }
        db.add(
            AuthEvent(
                user_id=target.id,
                event_type=AuthEventType.USER_STATUS_CHANGED,
                occurred_at=now,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent", "")[:512] or None,
                details=details,
            )
        )
        if after_status != AccountStatus.ACTIVE:
            sessions = db.execute(
                select(UserSession).where(
                    UserSession.user_id == target.id,
                    UserSession.revoked_at.is_(None),
                ).with_for_update()
            ).scalars().all()
            for session in sessions:
                session.revoked_at = now
            if sessions:
                db.add(
                    AuthEvent(
                        user_id=target.id,
                        event_type=AuthEventType.SESSION_REVOKED,
                        occurred_at=now,
                        ip_address=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent", "")[:512] or None,
                        details={
                            "actor_user_id": str(current_admin.id),
                            "reason": "account_status_changed",
                            "count": len(sessions),
                        },
                    )
                )

    db.commit()
    return await get_user(user_id, db)



def _profile_response(user: User, db: Session) -> EmployeeMyProfileResponse:
    mfa_enabled = db.execute(
        select(UserMfaMethod.id).where(
            UserMfaMethod.user_id == user.id,
            UserMfaMethod.method_type == "TOTP",
            UserMfaMethod.is_enabled.is_(True),
        )
    ).scalar_one_or_none() is not None
    return EmployeeMyProfileResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        account_status=user.account_status,
        employee_code=user.employee_code,
        department=user.department,
        job_title=user.job_title,
        email_verified_at=user.email_verified_at,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        phone=user.phone,
        location=user.location,
        bio=user.bio,
        two_factor_enabled=mfa_enabled,
    )


def _security_event(
    db: Session,
    request: Request,
    user: User,
    event_type: AuthEventType,
    details: dict | None = None,
) -> None:
    db.add(
        AuthEvent(
            user_id=user.id,
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "")[:512] or None,
            details=details,
        )
    )


@employee_router.get("/me/profile", response_model=EmployeeMyProfileResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmployeeMyProfileResponse:
    return _profile_response(user, db)


@employee_router.patch("/me/profile", response_model=EmployeeMyProfileResponse)
async def update_my_profile(
    body: EmployeeProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmployeeMyProfileResponse:
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is not None:
            value = value.strip()
            if field == "full_name" and not value:
                raise HTTPException(status_code=422, detail="Full name cannot be blank.")
            setattr(user, field, value or None)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return _profile_response(user, db)


@employee_router.post("/me/password")
async def update_password(
    body: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not user.password_hash or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match.")
    new_password = body.new_password
    if len(new_password) < 10 or len(new_password) > 128:
        raise HTTPException(status_code=400, detail="Password must be between 10 and 128 characters long.")
    if (
        not any(char.isupper() for char in new_password)
        or not any(char.islower() for char in new_password)
        or not any(char.isdigit() for char in new_password)
        or not any(char in "!@#$%^&*()_+-=[]{}|;:,.<>?" for char in new_password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must include uppercase and lowercase letters, a number, and a special character.",
        )
    if verify_password(new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Choose a password you have not used before.")
    now = datetime.now(timezone.utc)
    current_token = request.cookies.get(COOKIE_NAME)
    current_hash = hash_session_token(current_token) if current_token else None
    old_sessions = db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        ).with_for_update()
    ).scalars().all()
    revoked_count = 0
    for session in old_sessions:
        if session.session_token_hash != current_hash:
            session.revoked_at = now
            revoked_count += 1
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    user.must_change_password = False
    _security_event(db, request, user, AuthEventType.PASSWORD_CHANGED)
    if revoked_count:
        _security_event(
            db, request, user, AuthEventType.SESSION_REVOKED,
            {"reason": "password_changed", "count": revoked_count},
        )
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}


@employee_router.post("/me/2fa/setup")
async def setup_two_factor(
    body: TotpSetupRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not user.password_hash or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    now = datetime.now(timezone.utc)
    method = db.execute(
        select(UserMfaMethod)
        .where(UserMfaMethod.user_id == user.id, UserMfaMethod.method_type == "TOTP")
        .with_for_update()
    ).scalar_one_or_none()
    if method is not None and method.is_enabled:
        raise HTTPException(status_code=409, detail="Two-factor authentication is already enabled.")
    secret = generate_totp_secret()
    try:
        ciphertext = encrypt_totp_secret(secret)
    except MfaServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail="Two-factor setup is unavailable because encryption is not configured.") from exc
    expires_at = now + timedelta(minutes=10)
    if method is None:
        method = UserMfaMethod(
            user_id=user.id,
            method_type="TOTP",
            secret_ciphertext=ciphertext,
            is_enabled=False,
            setup_expires_at=expires_at,
            confirmed_at=None,
            last_used_counter=None,
        )
        db.add(method)
    else:
        method.secret_ciphertext = ciphertext
        method.is_enabled = False
        method.setup_expires_at = expires_at
        method.confirmed_at = None
        method.last_used_counter = None
        method.updated_at = now
    db.commit()
    return {
        "secret": secret,
        "otpauth_url": provisioning_uri(secret, user.email),
        "expires_at": expires_at,
    }


@employee_router.post("/me/2fa/confirm")
async def confirm_two_factor(
    body: TotpConfirmRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    method = db.execute(
        select(UserMfaMethod)
        .where(UserMfaMethod.user_id == user.id, UserMfaMethod.method_type == "TOTP")
        .with_for_update()
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if method is None or method.is_enabled or method.setup_expires_at is None or method.setup_expires_at <= now:
        raise HTTPException(status_code=409, detail="Start a new two-factor setup before confirming.")
    try:
        secret = decrypt_totp_secret(method.secret_ciphertext)
    except MfaServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail="Two-factor verification is temporarily unavailable.") from exc
    counter = verify_totp(secret, body.code)
    if counter is None:
        _security_event(db, request, user, AuthEventType.MFA_REJECTED, {"reason": "setup_code_invalid"})
        db.commit()
        raise HTTPException(status_code=400, detail="The authenticator code is invalid.")
    method.is_enabled = True
    method.confirmed_at = now
    method.setup_expires_at = None
    method.last_used_counter = counter
    method.updated_at = now
    _security_event(db, request, user, AuthEventType.MFA_ENABLED)
    db.commit()
    return {"two_factor_enabled": True}


@employee_router.post("/me/2fa/disable")
async def disable_two_factor(
    body: TotpDisableRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    method = db.execute(
        select(UserMfaMethod)
        .where(
            UserMfaMethod.user_id == user.id,
            UserMfaMethod.method_type == "TOTP",
            UserMfaMethod.is_enabled.is_(True),
        )
        .with_for_update()
    ).scalar_one_or_none()
    if method is None:
        raise HTTPException(status_code=409, detail="Two-factor authentication is not enabled.")
    if not user.password_hash or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    try:
        secret = decrypt_totp_secret(method.secret_ciphertext)
    except MfaServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail="Two-factor verification is temporarily unavailable.") from exc
    counter = verify_totp(secret, body.code, last_used_counter=method.last_used_counter)
    if counter is None:
        _security_event(db, request, user, AuthEventType.MFA_REJECTED, {"reason": "disable_code_invalid"})
        db.commit()
        raise HTTPException(status_code=400, detail="The authenticator code is invalid.")
    db.delete(method)
    _security_event(db, request, user, AuthEventType.MFA_DISABLED)
    db.commit()
    return {"two_factor_enabled": False}


@employee_router.post("/me/2fa/toggle")
async def toggle_two_factor_deprecated(
    user: User = Depends(get_current_user),
) -> dict:
    raise HTTPException(status_code=409, detail="Use the two-factor setup, confirmation, or disable workflow.")


def _session_device(user_agent: str | None) -> str:
    ua = (user_agent or "").lower()
    if "iphone" in ua or "ipad" in ua:
        platform = "iPhone - Safari" if "safari" in ua else "iPhone - Browser"
    elif "android" in ua:
        platform = "Android"
    elif "windows" in ua:
        platform = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        platform = "macOS"
    elif "linux" in ua:
        platform = "Linux"
    else:
        platform = "Unknown device"
    if platform in {"iPhone - Safari", "iPhone - Browser"} or platform == "Unknown device":
        return platform
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua:
        browser = "Safari"
    else:
        browser = "Browser"
    return f"{platform} - {browser}"


@employee_router.get("/me/sessions", response_model=list[UserSessionItem])
async def get_sessions(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserSessionItem]:
    token = request.cookies.get(COOKIE_NAME)
    current_hash = hash_session_token(token) if token else None
    now = datetime.now(timezone.utc)
    sessions = db.execute(
        select(UserSession)
        .where(UserSession.user_id == user.id)
        .order_by(UserSession.last_seen_at.desc().nullslast(), UserSession.created_at.desc())
        .limit(100)
    ).scalars().all()
    result = []
    for session in sessions:
        is_current = bool(current_hash and session.session_token_hash == current_hash)
        if session.revoked_at is not None:
            session_status = "Logged out"
        elif session.expires_at <= now:
            session_status = "Expired"
        else:
            session_status = "Current" if is_current else "Active"
        result.append(
            UserSessionItem(
                id=str(session.id),
                device=_session_device(session.user_agent),
                location="Unknown",
                last_active=(session.last_seen_at or session.created_at).isoformat(),
                status=session_status,
                is_current=is_current,
            )
        )
    return result


@employee_router.delete("/me/sessions/{session_id}")
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = db.execute(
        select(UserSession)
        .where(UserSession.id == session_id, UserSession.user_id == user.id)
        .with_for_update()
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        _security_event(db, request, user, AuthEventType.SESSION_REVOKED, {"session_id": str(session.id)})
        db.commit()
    return {"status": "success", "message": "Session revoked"}


@employee_router.get("/me/notifications/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferences:
    preferences = preferences_for(db, user.id)
    return NotificationPreferences(**(DEFAULT_NOTIFICATION_SETTINGS | preferences.notification_settings))


@employee_router.put("/me/notifications/preferences", response_model=NotificationPreferences)
async def update_notification_preferences(
    body: NotificationPreferences,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferences:
    preferences = preferences_for(db, user.id)
    preferences.notification_settings = body.model_dump()
    preferences.updated_at = datetime.now(timezone.utc)
    db.commit()
    return body


@employee_router.get("/me/preferences", response_model=DisplayPreferences)
async def get_display_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisplayPreferences:
    preferences = preferences_for(db, user.id)
    return DisplayPreferences(**(DEFAULT_DISPLAY_SETTINGS | preferences.display_settings))


@employee_router.put("/me/preferences", response_model=DisplayPreferences)
async def update_display_preferences(
    body: DisplayPreferences,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisplayPreferences:
    preferences = preferences_for(db, user.id)
    preferences.display_settings = body.model_dump()
    preferences.updated_at = datetime.now(timezone.utc)
    db.commit()
    return body


@employee_router.get("/me/notifications", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    criteria = [Notification.recipient_user_id == user.id]
    if unread_only:
        criteria.append(Notification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(Notification).where(*criteria)) or 0
    unread = db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.recipient_user_id == user.id,
            Notification.read_at.is_(None),
        )
    ) or 0
    items = db.execute(
        select(Notification)
        .where(*criteria)
        .order_by(Notification.created_at.desc(), Notification.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return NotificationListResponse(
        items=[
            NotificationResponse(
                id=item.id,
                actor_user_id=item.actor_user_id,
                notification_type=item.notification_type,
                title=item.title,
                message=item.message,
                document_id=item.document_id,
                metadata=item.metadata_json,
                created_at=item.created_at,
                read_at=item.read_at,
            )
            for item in items
        ],
        total=total,
        unread_count=unread,
    )


@employee_router.get("/me/notifications/unread-count")
async def get_unread_notification_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    count = db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.recipient_user_id == user.id,
            Notification.read_at.is_(None),
        )
    ) or 0
    return {"unread_count": count}


@employee_router.patch("/me/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationResponse:
    item = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_user_id == user.id,
        ).with_for_update()
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if item.read_at is None:
        item.read_at = datetime.now(timezone.utc)
        db.commit()
    return NotificationResponse(
        id=item.id,
        actor_user_id=item.actor_user_id,
        notification_type=item.notification_type,
        title=item.title,
        message=item.message,
        document_id=item.document_id,
        metadata=item.metadata_json,
        created_at=item.created_at,
        read_at=item.read_at,
    )


@employee_router.post("/me/notifications/read-all")
async def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    result = db.execute(
        update(Notification)
        .where(
            Notification.recipient_user_id == user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    db.commit()
    return {"marked_read": result.rowcount or 0}


@employee_router.get("/me/storage", response_model=StorageSummaryResponse)
async def get_storage_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StorageSummaryResponse:
    stored_statuses = ("AVAILABLE", "PENDING_SCAN", "QUARANTINED", "PURGE_PENDING")
    rows = db.execute(
        select(DocumentVersion, Document.status, Document.deleted_at, Document.current_version_id)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(
            Document.owner_user_id == user.id,
            DocumentVersion.status.in_(stored_statuses),
        )
    ).all()
    total_bytes = sum(version.size_bytes for version, _, _, _ in rows)
    active_current_bytes = sum(
        version.size_bytes
        for version, doc_status, deleted_at, current_id in rows
        if doc_status == "ACTIVE" and deleted_at is None
        and version.id == current_id and version.status == "AVAILABLE"
    )
    trash_bytes = sum(
        version.size_bytes for version, doc_status, deleted_at, _ in rows
        if doc_status == "DELETED" or deleted_at is not None
    )
    latest_by_extension: dict[str, list[int]] = {}
    for version, doc_status, deleted_at, current_id in rows:
        if (
            version.id != current_id
            or doc_status != "ACTIVE"
            or deleted_at is not None
            or version.status not in {"AVAILABLE", "PENDING_SCAN", "QUARANTINED"}
        ):
            continue
        extension = (version.file_extension or "").upper()
        file_type = extension.upper() if extension in {"PDF", "DOCX", "XLSX", "PPTX"} else "Others"
        bucket = latest_by_extension.setdefault(file_type, [0, 0])
        bucket[0] += 1
        bucket[1] += version.size_bytes

    def human_size(size: int) -> str:
        if size >= 1024 ** 3:
            return f"{size / (1024 ** 3):.1f} GB"
        if size >= 1024 ** 2:
            return f"{size / (1024 ** 2):.0f} MB"
        if size >= 1024:
            return f"{size / 1024:.0f} KB"
        return f"{size} B"

    colors = {"PDF": "#2563eb", "DOCX": "#7c3aed", "XLSX": "#10b981", "PPTX": "#f97316", "Others": "#64748b"}
    breakdown = [
        StorageBreakdownItem(
            file_type=file_type,
            count=count,
            size=human_size(size),
            percentage=round(size * 100 / active_current_bytes) if active_current_bytes else 0,
            color=colors[file_type],
        )
        for file_type, (count, size) in sorted(latest_by_extension.items())
    ]
    used_gb = total_bytes / (1024 ** 3)
    documents_gb = active_current_bytes / (1024 ** 3)
    versions_bytes = max(0, total_bytes - active_current_bytes - trash_bytes)
    return StorageSummaryResponse(
        used_gb=round(used_gb, 3),
        total_gb=None,
        used_percentage=None,
        documents_gb=round(documents_gb, 3),
        versions_mb=round(versions_bytes / (1024 ** 2)),
        trash_mb=round(trash_bytes / (1024 ** 2)),
        available_gb=None,
        breakdown=breakdown,
    )


@employee_router.get("/me/integrations", response_model=list[ConnectedAccountItem])
async def get_integrations(
    user: User = Depends(get_current_user),
) -> list[ConnectedAccountItem]:
    providers = [
        ("google-drive", "Google Drive", "Connect your Google Drive account to import and manage documents."),
        ("onedrive", "Microsoft OneDrive", "Connect your OneDrive account to import and manage documents."),
        ("dropbox", "Dropbox", "Connect your Dropbox account to import and manage documents."),
        ("slack", "Slack", "Connect your Slack account to receive notifications."),
        ("ms365", "Microsoft 365", "Connect your Microsoft 365 account to access work documents."),
    ]
    return [
        ConnectedAccountItem(
            id=provider_id,
            name=name,
            description=description,
            status="Not configured",
            connected=False,
        )
        for provider_id, name, description in providers
    ]


@employee_router.post("/me/integrations/{provider_id}/toggle", response_model=list[ConnectedAccountItem])
async def toggle_integration(
    provider_id: str,
    user: User = Depends(get_current_user),
) -> list[ConnectedAccountItem]:
    raise HTTPException(status_code=501, detail="This external integration has not been configured.")
