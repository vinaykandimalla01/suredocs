"""Safe response schemas for user-management and profile screens."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.user import AccountStatus, UserRole
from pydantic import EmailStr


class AdminUserCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    role: UserRole
    department: str
    username: str | None = None
    password: str
    require_password_change: bool = True


class AdminUserListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    account_status: AccountStatus
    department: str | None
    job_title: str | None
    employee_code: str | None
    created_at: datetime
    last_login_at: datetime | None


class AdminUserPageResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int
    pages: int


class AdminUserSummaryResponse(BaseModel):
    total_users: int
    active_users: int
    disabled_users: int
    pending_users: int
    administrator_users: int


class CreatorSummary(BaseModel):
    full_name: str
    email: str


class AdminUserDetailResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    account_status: AccountStatus
    employee_code: str | None
    department: str | None
    job_title: str | None
    email_verified_at: datetime | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
    password_changed_at: datetime | None
    created_by: CreatorSummary | None


class EmployeeMyProfileResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    account_status: AccountStatus
    employee_code: str | None
    department: str | None
    job_title: str | None
    email_verified_at: datetime | None
    created_at: datetime
    last_login_at: datetime | None
