"""
FastAPI authentication dependencies.

These dependencies validate the session cookie, look up the session in
PostgreSQL, verify the user's current status and role, and provide the
authenticated user to route handlers.

The user identity is always determined from the server-side session record —
never from client-supplied data like localStorage, URL params, or request body.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import COOKIE_NAME, SESSION_IDLE_TIMEOUT
from app.core.security import hash_session_token
from app.db.session import get_db
from app.models.user import AccountStatus, User, UserRole
from app.models.user_session import UserSession

logger = logging.getLogger(__name__)


def _unauthorized(request: Request, reason: str, detail: str) -> HTTPException:
    logger.warning(
        "Authentication rejected status=401 method=%s path=%s reason=%s",
        request.method,
        request.url.path,
        reason,
    )
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Validate the session cookie and return the authenticated user.

    Raises 401 if:
    - No session cookie is present
    - The session token is invalid or not found
    - The session has expired
    - The session has been revoked
    - The associated account is not ACTIVE
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise _unauthorized(request, "missing_cookie", "Authentication required")

    token_hash = hash_session_token(token)

    session = db.execute(
        select(UserSession).where(UserSession.session_token_hash == token_hash)
    ).scalar_one_or_none()

    if session is None:
        raise _unauthorized(request, "unknown_session", "Invalid session")

    now = datetime.now(timezone.utc)

    # Check if session has been revoked
    if session.revoked_at is not None:
        raise _unauthorized(request, "revoked_session", "Session has been revoked")

    # Check absolute expiry
    if session.expires_at <= now:
        raise _unauthorized(request, "absolute_expiry", "Session expired")

    # Check idle timeout
    last_activity = session.last_seen_at or session.created_at
    if (now - last_activity).total_seconds() > SESSION_IDLE_TIMEOUT:
        raise _unauthorized(request, "idle_expiry", "Session expired due to inactivity")

    # Load the user
    user = db.get(User, session.user_id)
    if user is None:
        raise _unauthorized(request, "missing_user", "User not found")

    # Verify the account is still active
    if user.account_status != AccountStatus.ACTIVE:
        raise _unauthorized(request, "inactive_account", "Account is no longer active")

    # Update last_seen_at for idle timeout tracking
    session.last_seen_at = now
    db.commit()

    return user


async def require_admin(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    """Require the authenticated user to have ADMIN role."""
    if user.role != UserRole.ADMIN:
        logger.warning(
            "Authorization denied status=403 method=%s path=%s role=%s",
            request.method,
            request.url.path,
            user.role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return user


async def require_employee(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    """Require the authenticated user to have EMPLOYEE role."""
    if user.role not in {UserRole.EMPLOYEE, UserRole.MANAGER}:
        logger.warning(
            "Authorization denied status=403 method=%s path=%s role=%s",
            request.method,
            request.url.path,
            user.role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee access required",
        )
    return user
