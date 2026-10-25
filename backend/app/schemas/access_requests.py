"""Validated schemas for document access requests."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class RequestedPermissions(BaseModel):
    can_view: bool = True
    can_download: bool = False
    can_edit: bool = False

    @model_validator(mode="after")
    def requires_view_and_an_action(self) -> "RequestedPermissions":
        if self.can_download or self.can_edit:
            self.can_view = True
        if not (self.can_view or self.can_download or self.can_edit):
            raise ValueError("Request at least one document permission.")
        return self


class AccessRequestCreate(BaseModel):
    document_id: uuid.UUID
    requested_permissions: RequestedPermissions
    reason: str = Field(min_length=1, max_length=2000)
    expires_at: datetime | None = None

    @field_validator("reason")
    @classmethod
    def reason_is_not_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("A reason is required.")
        return normalized

    @field_validator("expires_at")
    @classmethod
    def expiry_is_timezone_aware(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Expiration must include a timezone.")
        return value


class AccessRequestDecision(BaseModel):
    decision_reason: str | None = Field(default=None, max_length=2000)

    @field_validator("decision_reason")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AccessRequestResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    document_category: str | None
    original_filename: str | None
    requester_user_id: uuid.UUID
    requester_name: str
    requester_email: str
    requester_department: str | None
    owner_user_id: uuid.UUID
    owner_name: str
    requested_permissions: dict[str, bool]
    reason: str
    status: str
    requested_at: datetime
    decided_by_user_id: uuid.UUID | None
    decided_at: datetime | None
    decision_reason: str | None
    expires_at: datetime | None
    resulting_permission_id: uuid.UUID | None
    is_reviewer: bool


class AccessRequestPageResponse(BaseModel):
    items: list[AccessRequestResponse]
    total: int
    page: int
    page_size: int


class AccessRequestSummaryResponse(BaseModel):
    pending_requests: int
    users_with_access: int
    denied_requests: int
