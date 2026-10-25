"""Request and response schemas for the owner-scoped document activity feed."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ActivityPrincipal(BaseModel):
    id: uuid.UUID | None = None
    name: str | None = None
    email: str | None = None
    role: str | None = None
    account_status: str | None = None


class ActivityDocument(BaseModel):
    id: uuid.UUID
    title: str
    original_filename: str | None = None
    file_extension: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    category: str | None = None
    classification: str
    status: str
    owner: ActivityPrincipal
    current_version_id: uuid.UUID | None = None
    current_version_number: int | None = None
    current_version_status: str | None = None


class ActivityEvent(BaseModel):
    id: uuid.UUID
    document_id_snapshot: uuid.UUID
    actor: ActivityPrincipal
    target: ActivityPrincipal | None = None
    action_type: str
    result: str
    occurred_at: datetime
    document: ActivityDocument


class ActivityEventDetails(ActivityEvent):
    ip_address: str | None = None
    user_agent: str | None = None
    request_id: str | None = None
    details: dict[str, Any]


class ActivityListResponse(BaseModel):
    items: list[ActivityEvent]
    total: int
    successful: int
    denied: int
    page: int
    page_size: int


class SecurityFlagRequest(BaseModel):
    submission_id: uuid.UUID
    reason_code: str = Field(max_length=40)
    description: str | None = Field(default=None, max_length=2000)


class SecurityFlagResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    submitted_at: datetime
    duplicate: bool = False
