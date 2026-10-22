"""Database-backed administrator and employee user profile endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
import math
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.core.dependencies import require_admin, require_employee
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import AccountStatus, User, UserRole
from app.schemas.users import (
    AdminUserCreateRequest,
    AdminUserDetailResponse,
    AdminUserListItem,
    AdminUserPageResponse,
    AdminUserSummaryResponse,
    CreatorSummary,
    EmployeeMyProfileResponse,
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


@employee_router.get("/me/profile", response_model=EmployeeMyProfileResponse)
async def get_my_profile(
    user: User = Depends(require_employee),
) -> EmployeeMyProfileResponse:
    """Return the authenticated employee's own profile only."""
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
    )
