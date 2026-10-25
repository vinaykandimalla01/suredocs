"""Safe response schemas for user-management and profile screens."""

from __future__ import annotations

import uuid
from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class AdminUserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    role: UserRole | None = None
    account_status: AccountStatus | None = None
    department: str | None = Field(default=None, max_length=100)
    job_title: str | None = Field(default=None, max_length=100)

    @field_validator("full_name", "department", "job_title")
    @classmethod
    def strip_user_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


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
    phone: str | None = None
    location: str | None = None
    bio: str | None = None


class EmployeeProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    department: str | None = None
    job_title: str | None = None
    phone: str | None = None
    location: str | None = None
    bio: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class UserSessionItem(BaseModel):
    id: str
    device: str
    location: str
    last_active: str
    status: str
    is_current: bool


class NotificationPreferences(BaseModel):
    document_access_requests: bool = True
    access_granted: bool = True
    access_revoked: bool = True
    access_request_decisions: bool = True
    document_activity: bool = True
    security_alerts: bool = True
    product_updates: bool = False
    marketing_communications: bool = False


class DisplayPreferences(BaseModel):
    appearance: Literal["light", "dark", "system"] = "light"
    language: Literal["English (US)", "English (UK)", "Hindi"] = "English (US)"
    date_format: Literal["Oct 24, 2026", "24/10/2026", "2026-10-24"] = "Oct 24, 2026"
    time_format: Literal["12-hour (AM/PM)", "24-hour"] = "12-hour (AM/PM)"
    default_view: Literal["list", "grid"] = "list"


class StorageBreakdownItem(BaseModel):
    file_type: str
    count: int
    size: str
    percentage: int
    color: str


class StorageSummaryResponse(BaseModel):
    used_gb: float
    total_gb: float | None = None
    used_percentage: int | None = None
    documents_gb: float
    versions_mb: int
    trash_mb: int
    available_gb: float | None = None
    breakdown: list[StorageBreakdownItem]


class NotificationResponse(BaseModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID | None
    notification_type: str
    title: str
    message: str
    document_id: uuid.UUID | None
    metadata: dict
    created_at: datetime
    read_at: datetime | None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int


class ConnectedAccountItem(BaseModel):
    id: str
    name: str
    description: str
    status: str
    connected: bool
