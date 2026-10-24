"""Validated request and response schemas for document APIs."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CLASSIFICATIONS = {"INTERNAL", "CONFIDENTIAL", "RESTRICTED"}


class DocumentMetadataUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    classification: str | None = None

    @field_validator("title")
    @classmethod
    def title_is_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Title cannot be blank.")
        return value.strip() if value is not None else value

    @field_validator("classification")
    @classmethod
    def classification_is_supported(cls, value: str | None) -> str | None:
        normalized = value.upper() if value is not None else None
        if normalized is not None and normalized not in CLASSIFICATIONS:
            raise ValueError("Unsupported document classification.")
        return normalized

    @model_validator(mode="after")
    def contains_changes(self) -> "DocumentMetadataUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one metadata field must be supplied.")
        return self


class PermissionGrantRequest(BaseModel):
    user_id: uuid.UUID
    can_view: bool
    can_download: bool
    can_edit: bool = False
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def download_requires_view(self) -> "PermissionGrantRequest":
        if self.can_download and not self.can_view:
            self.can_view = True
        if self.can_edit:
            self.can_view = True
        if not self.can_view and not self.can_download:
            raise ValueError("A permission must allow viewing or downloading.")
        return self

    @field_validator("expires_at")
    @classmethod
    def expiry_must_include_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Permission expiration must include a timezone.")
        return value


class DocumentVersionResponse(BaseModel):
    id: uuid.UUID
    version_number: int
    original_filename: str
    file_extension: str | None
    content_type: str
    size_bytes: int
    checksum_sha256: str
    status: str
    uploaded_by_user_id: uuid.UUID
    uploaded_by_name: str
    uploaded_at: datetime
    scan_completed_at: datetime | None


class DocumentPermissionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_role: str | None = None
    user_department: str | None = None
    user_job_title: str | None = None
    user_account_status: str
    can_view: bool
    can_download: bool
    can_edit: bool = False
    granted_by_user_id: uuid.UUID
    granted_by_name: str
    granted_at: datetime
    expires_at: datetime | None
    revoked_at: datetime | None
    revoked_by_user_id: uuid.UUID | None
    is_effective: bool


class DocumentResponse(BaseModel):
    id: uuid.UUID
    owner_user_id: uuid.UUID
    owner_name: str
    owner_email: str
    owner_role: str | None = None
    owner_department: str | None = None
    permission_granted_at: datetime | None = None
    permission_expires_at: datetime | None = None
    permission_granted_by_name: str | None = None
    permission_granted_by_email: str | None = None
    created_by_user_id: uuid.UUID
    title: str
    original_filename: str | None
    description: str | None
    category: str | None
    classification: str
    department: str | None
    status: str
    custom_metadata: dict
    current_version_id: uuid.UUID | None
    current_version_number: int | None
    latest_uploaded_version_number: int | None = None
    latest_uploaded_version_status: str | None = None
    content_type: str | None
    size_bytes: int | None
    checksum_sha256: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    can_view: bool
    can_download: bool
    can_edit: bool = False
    is_owner: bool
    permission_count: int | None = None


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int


class DocumentSummaryResponse(BaseModel):
    owned_documents: int
    shared_with_me: int
    shared_by_me: int
    organization_documents: int | None = None
    active_documents: int | None = None
    deleted_documents: int | None = None
    active_permissions: int | None = None


class DocumentPermissionListResponse(BaseModel):
    items: list[DocumentPermissionResponse]


class DocumentVersionListResponse(BaseModel):
    items: list[DocumentVersionResponse]


class DocumentAuditResponse(BaseModel):
    id: uuid.UUID
    document_id_snapshot: uuid.UUID
    actor_user_id: uuid.UUID | None
    actor_name: str | None
    actor_department: str | None = None
    target_user_id: uuid.UUID | None
    target_name: str | None
    action_type: str
    result: str
    occurred_at: datetime
    ip_address: str | None
    request_id: str | None
    details: dict


class DocumentAuditListResponse(BaseModel):
    items: list[DocumentAuditResponse]


class UserOption(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)
