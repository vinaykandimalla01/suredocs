"""Validated response models for the administrator permissions workspace."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PermissionSummary(BaseModel):
    total_grants: int = 0
    active_grants: int = 0
    read_permissions: int = 0
    download_permissions: int = 0
    edit_permissions: int = 0
    expired_grants: int = 0
    revoked_grants: int = 0


class PermissionFilterOption(BaseModel):
    id: uuid.UUID
    name: str


class PermissionRecord(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    document_filename: str | None = None
    file_extension: str | None = None
    file_size_bytes: int | None = None
    content_type: str | None = None
    category: str | None = None
    document_status: str
    owner_id: uuid.UUID
    owner_name: str
    owner_email: str
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_department: str | None = None
    permission_type: str
    can_view: bool
    can_download: bool
    can_edit: bool
    granted_by_name: str
    granted_by_email: str
    granted_at: datetime
    expires_at: datetime | None = None
    days_left: int | None = None
    expired_since: int | None = None
    status: str
    revoked_at: datetime | None = None
    revoked_by_name: str | None = None
    revocation_reason: str | None = None


class PermissionRecordsPage(BaseModel):
    items: list[PermissionRecord]
    total: int
    page: int
    page_size: int
    summary: PermissionSummary
    owners: list[PermissionFilterOption]
    users: list[PermissionFilterOption]
    documents: list[PermissionFilterOption] = Field(default_factory=list)


class PermissionDocumentOwner(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    department: str | None = None
    job_title: str | None = None
    account_status: str
    created_at: datetime | None = None


class PermissionDocumentMetadata(BaseModel):
    id: uuid.UUID
    title: str
    original_filename: str | None = None
    file_extension: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    category: str | None = None
    classification: str
    department: str | None = None
    description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    uploaded_at: datetime | None = None
    storage_location: str | None = None
    owner: PermissionDocumentOwner


class DocumentPermissionRecord(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_department: str | None = None
    can_view: bool
    can_download: bool
    can_edit: bool
    permission_type: str
    granted_by_user_id: uuid.UUID
    granted_by_name: str
    granted_by_email: str
    granted_at: datetime
    expires_at: datetime | None = None
    days_remaining: int | None = None
    revoked_at: datetime | None = None
    revoked_by_user_id: uuid.UUID | None = None
    revoked_by_name: str | None = None
    revocation_reason: str | None = None
    status: str


class PermissionAuditEvent(BaseModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    target_user_id: uuid.UUID | None = None
    target_name: str | None = None
    target_email: str | None = None
    action_type: str
    result: str
    occurred_at: datetime
    ip_address: str | None = None
    details: dict[str, Any]


class DocumentVersionItem(BaseModel):
    id: uuid.UUID
    version_number: int
    original_filename: str | None = None
    file_extension: str | None = None
    size_bytes: int | None = None
    uploaded_at: datetime
    status: str


class CurrentPermissionOverview(BaseModel):
    read_count: int = 0
    download_count: int = 0
    edit_count: int = 0


class PermissionDocumentDetails(BaseModel):
    document: PermissionDocumentMetadata
    permissions: list[DocumentPermissionRecord]
    audit: list[PermissionAuditEvent]
    versions: list[DocumentVersionItem] = Field(default_factory=list)
    overview: CurrentPermissionOverview = Field(default_factory=CurrentPermissionOverview)


class AnalyticsSummaryResponse(BaseModel):
    total_grants: int = 0
    total_change_pct: float | None = None
    read_grants: int = 0
    read_pct: float = 0.0
    read_change_pct: float | None = None
    download_grants: int = 0
    download_pct: float = 0.0
    download_change_pct: float | None = None
    edit_grants: int = 0
    edit_pct: float = 0.0
    edit_change_pct: float | None = None

    active_grants: int = 0
    active_change_pct: float | None = None
    active_read: int = 0
    active_read_pct: float = 0.0
    active_read_change_pct: float | None = None
    active_download: int = 0
    active_download_pct: float = 0.0
    active_download_change_pct: float | None = None
    active_edit: int = 0
    active_edit_pct: float = 0.0
    active_edit_change_pct: float | None = None

    expired_grants: int = 0
    expired_change_pct: float | None = None
    expired_read: int = 0
    expired_read_pct: float = 0.0
    expired_read_change_pct: float | None = None
    expired_download: int = 0
    expired_download_pct: float = 0.0
    expired_download_change_pct: float | None = None
    expired_edit: int = 0
    expired_edit_pct: float = 0.0
    expired_edit_change_pct: float | None = None

    revoked_grants: int = 0
    revoked_change_pct: float | None = None
    revoked_read: int = 0
    revoked_read_pct: float = 0.0
    revoked_read_change_pct: float | None = None
    revoked_download: int = 0
    revoked_download_pct: float = 0.0
    revoked_download_change_pct: float | None = None
    revoked_edit: int = 0
    revoked_edit_pct: float = 0.0
    revoked_edit_change_pct: float | None = None


class TrendPoint(BaseModel):
    date: str
    full_date: str
    read: int = 0
    download: int = 0
    edit: int = 0
    total: int = 0


class DistributionItem(BaseModel):
    type: str
    count: int = 0
    percentage: float = 0.0
    color: str


class DistributionResponse(BaseModel):
    total: int = 0
    types: list[DistributionItem] = Field(default_factory=list)


class TopDocumentItem(BaseModel):
    id: uuid.UUID
    title: str
    file_extension: str | None = None
    grant_count: int = 0
    percentage: float = 0.0


class EligibleUserOption(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    department: str | None = None
    role: str


class GrantPermissionRequest(BaseModel):
    user_id: uuid.UUID
    permission_level: str  # "Read", "Read + Download", "Edit", "Read + Download + Edit"
    expires_at: datetime | None = None


from pydantic import BaseModel, Field, field_validator


class RevokePermissionRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a reason for revoking this permission.")
        return value
