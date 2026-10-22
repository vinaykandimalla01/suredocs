"""
Authentication router — login, logout, current user, health check.

All login failures return a generic error message to prevent account
enumeration. Passwords are never logged or returned in responses.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import (
    COOKIE_HTTPONLY,
    COOKIE_NAME,
    COOKIE_PATH,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    LOCKOUT_DURATION_SECONDS,
    MAX_FAILED_LOGIN_ATTEMPTS,
    SESSION_ABSOLUTE_TIMEOUT,
)
from app.core.dependencies import get_current_user
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.db.session import get_db
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.user import AccountStatus, User
from app.models.user_session import UserSession
from app.schemas.auth import (
    ErrorResponse,
    HealthResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    MeResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Generic login failure message — deliberately vague for security.
# ---------------------------------------------------------------------------
_LOGIN_FAILED_MSG = "Invalid email address or password"

# ---------------------------------------------------------------------------
# IP-based rate limiting (in-memory, bounded).
# This supplements the per-account lockout stored in the database.
# For multi-instance deployments, replace with Redis or a database-backed
# counter.
# ---------------------------------------------------------------------------
_ip_attempts: dict[str, list[float]] = defaultdict(list)
_ip_lock = Lock()
_IP_WINDOW_SECONDS = 300  # 5 minutes
_IP_MAX_ATTEMPTS = 20  # max attempts per IP within the window


def _reset_ip_rate_limit() -> None:
    """Clear all IP rate-limit state. Intended for test isolation only."""
    with _ip_lock:
        _ip_attempts.clear()


def _check_ip_rate_limit(ip: str) -> bool:
    """Return True if the IP is within its rate limit, False if exceeded."""
    now = datetime.now(timezone.utc).timestamp()
    with _ip_lock:
        # Prune old entries
        _ip_attempts[ip] = [
            t for t in _ip_attempts[ip]
            if now - t < _IP_WINDOW_SECONDS
        ]
        if len(_ip_attempts[ip]) >= _IP_MAX_ATTEMPTS:
            return False
        _ip_attempts[ip].append(now)
    return True


def _get_client_ip(request: Request) -> str:
    """Extract client IP, preferring X-Forwarded-For behind a trusted proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_user_agent(request: Request) -> str:
    """Extract and truncate the User-Agent header."""
    ua = request.headers.get("user-agent", "")
    return ua[:512]


def _record_event(
    db: Session,
    event_type: AuthEventType,
    user_id: Any | None,
    request: Request,
    details: dict[str, Any] | None = None,
) -> None:
    """Record an authentication event in the audit log."""
    event = AuthEvent(
        user_id=user_id,
        event_type=event_type,
        ip_address=_get_client_ip(request),
        user_agent=_get_user_agent(request),
        details=details,
    )
    db.add(event)


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=LoginResponse,
    responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Authenticate a user with email and password."""
    client_ip = _get_client_ip(request)

    # 1. IP-based rate limit
    if not _check_ip_rate_limit(client_ip):
        logger.warning("IP rate limit exceeded: %s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    # 2. Normalize and look up the user by email (case-insensitive)
    normalized_email = body.email.strip().lower()
    user = db.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    ).scalar_one_or_none()

    # We still perform password hashing even if the user doesn't exist
    # to prevent timing-based account enumeration.
    if user is None:
        # Hash a dummy password to equalize timing
        hash_password("dummy-password-for-timing")
        _record_event(db, AuthEventType.LOGIN_FAILED, None, request,
                       {"reason": "unknown_email"})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAILED_MSG,
        )

    now = datetime.now(timezone.utc)

    # 3. Check account lockout
    if user.locked_until and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds())
        _record_event(db, AuthEventType.LOGIN_FAILED, user.id, request,
                       {"reason": "account_locked", "locked_remaining_s": remaining})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAILED_MSG,
        )

    # 4. Check account status
    if user.account_status != AccountStatus.ACTIVE:
        # Use same message as wrong-password to prevent enumeration
        hash_password("dummy-password-for-timing")
        _record_event(db, AuthEventType.AUTH_REJECTED_INACTIVE, user.id, request,
                       {"reason": f"account_{user.account_status.value.lower()}"})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAILED_MSG,
        )

    # 5. Check password_hash exists
    if not user.password_hash:
        hash_password("dummy-password-for-timing")
        _record_event(db, AuthEventType.LOGIN_FAILED, user.id, request,
                       {"reason": "no_password_set"})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAILED_MSG,
        )

    # 6. Verify password
    if not verify_password(body.password, user.password_hash):
        # Increment failed attempts
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(seconds=LOCKOUT_DURATION_SECONDS)
            _record_event(db, AuthEventType.ACCOUNT_LOCKED, user.id, request,
                           {"reason": "max_failed_attempts",
                            "attempts": user.failed_login_attempts})
            logger.warning(
                "Account locked due to %d failed attempts: user_id=%s",
                user.failed_login_attempts, user.id,
            )
        else:
            _record_event(db, AuthEventType.LOGIN_FAILED, user.id, request,
                           {"reason": "wrong_password"})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_LOGIN_FAILED_MSG,
        )

    # 7. Successful authentication — reset failed attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now

    # 8. Create server-side session (session regeneration for fixation prevention)
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    session = UserSession(
        user_id=user.id,
        session_token_hash=token_hash,
        expires_at=now + timedelta(seconds=SESSION_ABSOLUTE_TIMEOUT),
        ip_address=client_ip,
        user_agent=_get_user_agent(request),
        last_seen_at=now,
    )
    db.add(session)

    # 9. Record success event
    _record_event(db, AuthEventType.LOGIN_SUCCESS, user.id, request)
    db.commit()

    # 10. Set session cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path=COOKIE_PATH,
        max_age=SESSION_ABSOLUTE_TIMEOUT,
    )

    user_resp = UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.value,
        department=user.department,
        job_title=user.job_title,
        employee_code=user.employee_code,
    )

    return LoginResponse(user=user_resp)


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=MeResponse,
    responses={401: {"model": ErrorResponse}},
)
async def get_me(
    user: User = Depends(get_current_user),
) -> MeResponse:
    """Return the currently authenticated user's profile."""
    return MeResponse(
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role.value,
            department=user.department,
            job_title=user.job_title,
            employee_code=user.employee_code,
        )
    )


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

@router.post(
    "/logout",
    response_model=LogoutResponse,
)
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LogoutResponse:
    """Revoke the current session and clear the cookie."""
    token = request.cookies.get(COOKIE_NAME)

    if token:
        token_hash = hash_session_token(token)
        session = db.execute(
            select(UserSession).where(
                UserSession.session_token_hash == token_hash
            )
        ).scalar_one_or_none()

        if session and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            _record_event(db, AuthEventType.LOGOUT, session.user_id, request)
            db.commit()

    # Always clear the cookie, even if the session wasn't found
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path=COOKIE_PATH,
    )

    return LogoutResponse()


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------

@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["health"],
)
async def health_check(
    db: Session = Depends(get_db),
) -> HealthResponse:
    """Minimal health check. Does not expose credentials or internal config."""
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    return HealthResponse(status="ok", database=db_status)
