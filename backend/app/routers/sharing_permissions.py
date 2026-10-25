"""Owner-scoped sharing and permission management APIs."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import and_, case, cast, false, func, literal, or_, select, union_all
from sqlalchemy.orm import Session, aliased
from sqlalchemy.sql.sqltypes import String

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.documents import Document, DocumentPermission, DocumentVersion
from app.models.persistence import AccessRequest, UserPreference
from app.models.user import AccountStatus, User
from app.schemas.documents import DocumentPermissionResponse
from app.services.document_access import get_document, permission_for, record_audit, require_owner, utc_now
from app.services.notifications import DEFAULT_NOTIFICATION_SETTINGS, add_notification

router = APIRouter(prefix="/api/sharing", tags=["sharing"])

_EXPIRING_DAYS = 30
_DENIED_WINDOW_DAYS = 90


class SharingSummary(BaseModel):
    active_grants: int
    expiring_soon: int
    denied_permissions: int
    denied_window_days: int = _DENIED_WINDOW_DAYS


class SharingDocumentOption(BaseModel):
    id: uuid.UUID
    title: str
    original_filename: str | None
    category: str | None
    size_bytes: int | None
    created_at: datetime
    owner_name: str
    permission_count: int


class SharingDocumentPage(BaseModel):
    items: list[SharingDocumentOption]
    total: int
    page: int
    page_size: int


class SharingGrantRow(BaseModel):
    id: uuid.UUID
    permission_id: uuid.UUID | None
    record_type: Literal["grant", "denied_request"]
    document_id: uuid.UUID
    document_title: str
    original_filename: str | None
    category: str | None
    size_bytes: int | None
    document_created_at: datetime
    recipient_id: uuid.UUID
    recipient_name: str
    recipient_email: str
    recipient_account_status: str
    can_view: bool
    can_download: bool
    can_edit: bool
    permission_key: str
    event_at: datetime
    expires_at: datetime | None
    status: str
    updated_at: datetime


class SharingGrantPage(BaseModel):
    items: list[SharingGrantRow]
    total: int
    page: int
    page_size: int


class SharingGrantBatch(BaseModel):
    document_id: uuid.UUID
    recipient_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)
    can_view: bool
    can_download: bool = False
    can_edit: bool = False
    expires_at: datetime | None = None
    message: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_grant(self) -> "SharingGrantBatch":
        if len(set(self.recipient_ids)) != len(self.recipient_ids):
            raise ValueError("Each recipient may only be selected once.")
        if (self.can_download or self.can_edit) and not self.can_view:
            raise ValueError("Download or edit access requires view access.")
        if not (self.can_view or self.can_download or self.can_edit):
            raise ValueError("At least one permission must be selected.")
        if self.expires_at is not None and self.expires_at.tzinfo is None:
            raise ValueError("Permission expiration must include a timezone.")
        return self


class GrantChange(BaseModel):
    permission_id: uuid.UUID
    expected_updated_at: datetime
    can_view: bool
    can_download: bool = False
    can_edit: bool = False
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def validate_change(self) -> "GrantChange":
        if self.expected_updated_at.tzinfo is None:
            raise ValueError("The expected grant timestamp must include a timezone.")
        if self.expires_at is not None and self.expires_at.tzinfo is None:
            raise ValueError("Permission expiration must include a timezone.")
        if (self.can_download or self.can_edit) and not self.can_view:
            raise ValueError("Download or edit access requires view access.")
        if not (self.can_view or self.can_download or self.can_edit):
            raise ValueError("At least one permission must be selected.")
        return self


class GrantChanges(BaseModel):
    updates: list[GrantChange] = Field(min_length=1, max_length=100)
    message: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def unique_grants(self) -> "GrantChanges":
        ids = [update.permission_id for update in self.updates]
        if len(ids) != len(set(ids)):
            raise ValueError("Each permission grant may only be updated once.")
        return self


class GrantChangeResult(BaseModel):
    items: list[DocumentPermissionResponse]


class RevokeAllResult(BaseModel):
    revoked_count: int


def _owned_document(
    db: Session,
    request: Request,
    document_id: uuid.UUID,
    user: User,
    operation: str,
    *,
    for_update: bool = False,
) -> Document:
    return require_owner(
        db,
        request,
        get_document(db, document_id, for_update=for_update),
        user,
        operation,
        requested_id=document_id,
    )


def _status_for_grant(grant: DocumentPermission, document: Document, recipient: User, now: datetime) -> str:
    if grant.revoked_at is not None:
        return "revoked"
    if grant.expires_at is not None and grant.expires_at <= now:
        return "expired"
    if (
        document.status != "ACTIVE"
        or document.deleted_at is not None
        or document.current_version_id is None
        or document.current_version is None
        or document.current_version.status != "AVAILABLE"
        or recipient.account_status != AccountStatus.ACTIVE
    ):
        return "unavailable"
    if grant.expires_at is not None and grant.expires_at <= now + timedelta(days=_EXPIRING_DAYS):
        return "expiring_soon"
    return "active"


def _grant_response(
    grant: DocumentPermission,
    recipient: User,
    grantor: User,
    document: Document,
    now: datetime,
) -> DocumentPermissionResponse:
    return DocumentPermissionResponse(
        id=grant.id,
        user_id=recipient.id,
        user_name=recipient.full_name,
        user_email=recipient.email,
        user_role=recipient.role.value,
        user_department=recipient.department,
        user_job_title=recipient.job_title,
        user_account_status=recipient.account_status.value,
        can_view=grant.can_view,
        can_download=grant.can_download,
        can_edit=grant.can_edit,
        granted_by_user_id=grant.granted_by_user_id,
        granted_by_name=grantor.full_name,
        granted_at=grant.granted_at,
        expires_at=grant.expires_at,
        revoked_at=grant.revoked_at,
        revoked_by_user_id=grant.revoked_by_user_id,
        is_effective=grant.is_effective,
        updated_at=grant.updated_at,
        status=_status_for_grant(grant, document, recipient, now),
    )


def _notification_message(actor: User, document: Document, note: str | None, action: str) -> str:
    prefix = f"{actor.full_name} {action} access to {document.title}."
    clean_note = note.strip() if note else ""
    return f"{prefix} Note: {clean_note}"[:500] if clean_note else prefix[:500]


def _require_message_notifications(db: Session, recipients: list[User], preference_key: str) -> None:
    for recipient in recipients:
        preferences = db.get(UserPreference, recipient.id)
        settings = preferences.notification_settings if preferences is not None else DEFAULT_NOTIFICATION_SETTINGS
        if settings.get(preference_key, DEFAULT_NOTIFICATION_SETTINGS.get(preference_key, True)) is False:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A recipient has disabled this SureDocs notification. Remove the optional message or update notification preferences before saving.",
            )


@router.get("/summary", response_model=SharingSummary)
async def get_sharing_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SharingSummary:
    now = utc_now()
    active_scope = (
        Document.owner_user_id == current_user.id,
        Document.status == "ACTIVE",
        Document.deleted_at.is_(None),
        Document.current_version_id.is_not(None),
        DocumentVersion.status == "AVAILABLE",
        User.account_status == AccountStatus.ACTIVE,
        DocumentPermission.revoked_at.is_(None),
        DocumentPermission.user_id != Document.owner_user_id,
        or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > now),
    )
    active_count = db.scalar(
        select(func.count(DocumentPermission.id))
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(DocumentVersion, and_(DocumentVersion.document_id == Document.id, DocumentVersion.id == Document.current_version_id))
        .join(User, User.id == DocumentPermission.user_id)
        .where(*active_scope)
    ) or 0
    expiring_count = db.scalar(
        select(func.count(DocumentPermission.id))
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(DocumentVersion, and_(DocumentVersion.document_id == Document.id, DocumentVersion.id == Document.current_version_id))
        .join(User, User.id == DocumentPermission.user_id)
        .where(
            *active_scope,
            DocumentPermission.expires_at.is_not(None),
            DocumentPermission.expires_at <= now + timedelta(days=_EXPIRING_DAYS),
        )
    ) or 0
    cutoff = now - timedelta(days=_DENIED_WINDOW_DAYS)
    revoked_count = db.scalar(
        select(func.count(DocumentPermission.id))
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(
            Document.owner_user_id == current_user.id,
            DocumentPermission.user_id != Document.owner_user_id,
            DocumentPermission.revoked_at.is_not(None),
            DocumentPermission.revoked_at >= cutoff,
        )
    ) or 0
    denied_requests = db.scalar(
        select(func.count(AccessRequest.id))
        .select_from(AccessRequest)
        .join(Document, Document.id == AccessRequest.document_id)
        .where(
            Document.owner_user_id == current_user.id,
            AccessRequest.status == "DENIED",
            AccessRequest.decided_at >= cutoff,
            AccessRequest.requester_user_id != Document.owner_user_id,
            AccessRequest.decided_by_user_id == current_user.id,
        )
    ) or 0
    return SharingSummary(
        active_grants=active_count,
        expiring_soon=expiring_count,
        denied_permissions=revoked_count + denied_requests,
    )


@router.get("/documents", response_model=SharingDocumentPage)
async def list_sharing_documents(
    search: str | None = Query(default=None, max_length=100),
    shared_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SharingDocumentPage:
    shared_grant = select(DocumentPermission.id).where(
        DocumentPermission.document_id == Document.id,
        DocumentPermission.user_id != Document.owner_user_id,
    ).exists()
    denied_request = select(AccessRequest.id).where(
        AccessRequest.document_id == Document.id,
        AccessRequest.status == "DENIED",
        AccessRequest.requester_user_id != Document.owner_user_id,
        AccessRequest.decided_by_user_id == current_user.id,
    ).exists()
    statement = (
        select(Document, DocumentVersion)
        .outerjoin(
            DocumentVersion,
            and_(
                DocumentVersion.document_id == Document.id,
                DocumentVersion.id == Document.current_version_id,
            ),
        )
        .where(
            Document.owner_user_id == current_user.id,
            Document.status == "ACTIVE",
            Document.deleted_at.is_(None),
            Document.current_version_id.is_not(None),
            DocumentVersion.status == "AVAILABLE",
        )
    )
    if shared_only:
        statement = statement.where(or_(shared_grant, denied_request))
    term = search.strip() if search else ""
    if term:
        pattern = f"%{term}%"
        statement = statement.where(
            or_(
                Document.title.ilike(pattern),
                cast(Document.id, String).ilike(pattern),
                DocumentVersion.original_filename.ilike(pattern),
            )
        )
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    permission_count = (
        select(func.count(DocumentPermission.id))
        .where(
            DocumentPermission.document_id == Document.id,
            DocumentPermission.user_id != Document.owner_user_id,
            DocumentPermission.revoked_at.is_(None),
            or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > utc_now()),
        )
        .correlate(Document)
        .scalar_subquery()
    )
    rows = db.execute(
        statement.order_by(Document.title.asc(), Document.id.asc())
        .add_columns(permission_count.label("permission_count"))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = []
    for document, version, shared_count in rows:
        items.append(SharingDocumentOption(
            id=document.id,
            title=document.title,
            original_filename=version.original_filename if version else None,
            category=document.category,
            size_bytes=version.size_bytes if version else None,
            created_at=document.created_at,
            owner_name=current_user.full_name,
            permission_count=shared_count,
        ))
    return SharingDocumentPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/grants", response_model=SharingGrantPage)
async def list_sharing_grants(
    search: str | None = Query(default=None, max_length=100),
    document_id: uuid.UUID | None = None,
    permission: Literal["read", "read_download", "edit", "read_download_edit"] | None = None,
    status_filter: Literal["active", "expiring_soon", "expired", "revoked", "unavailable", "denied"] | None = Query(default=None, alias="status"),
    date_window: Literal["7d", "30d", "90d", "all"] = "30d",
    sort_by: Literal["document", "recipient", "permission", "event_at", "expires_at", "status"] = "event_at",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=7, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SharingGrantPage:
    now = utc_now()
    recipient = aliased(User)
    grant_status = case(
        (DocumentPermission.revoked_at.is_not(None), literal("revoked")),
        (and_(DocumentPermission.expires_at.is_not(None), DocumentPermission.expires_at <= now), literal("expired")),
        (
            or_(
                Document.status != "ACTIVE",
                Document.deleted_at.is_not(None),
                Document.current_version_id.is_(None),
                DocumentVersion.status != "AVAILABLE",
                recipient.account_status != AccountStatus.ACTIVE,
            ),
            literal("unavailable"),
        ),
        (
            and_(DocumentPermission.expires_at.is_not(None), DocumentPermission.expires_at <= now + timedelta(days=_EXPIRING_DAYS)),
            literal("expiring_soon"),
        ),
        else_=literal("active"),
    )
    grant_permission = case(
        (and_(DocumentPermission.can_edit.is_(True), DocumentPermission.can_download.is_(True)), literal("read_download_edit")),
        (DocumentPermission.can_edit.is_(True), literal("edit")),
        (DocumentPermission.can_download.is_(True), literal("read_download")),
        else_=literal("read"),
    )
    version_join = and_(
        DocumentVersion.document_id == Document.id,
        DocumentVersion.id == Document.current_version_id,
    )
    grant_rows = (
        select(
            DocumentPermission.id.label("id"),
            DocumentPermission.id.label("permission_id"),
            literal("grant", type_=String()).label("record_type"),
            Document.id.label("document_id"),
            Document.title.label("document_title"),
            DocumentVersion.original_filename.label("original_filename"),
            Document.category.label("category"),
            DocumentVersion.size_bytes.label("size_bytes"),
            Document.created_at.label("document_created_at"),
            recipient.id.label("recipient_id"),
            recipient.full_name.label("recipient_name"),
            recipient.email.label("recipient_email"),
            cast(recipient.account_status, String).label("recipient_account_status"),
            DocumentPermission.can_view.label("can_view"),
            DocumentPermission.can_download.label("can_download"),
            DocumentPermission.can_edit.label("can_edit"),
            grant_permission.label("permission_key"),
            DocumentPermission.granted_at.label("event_at"),
            DocumentPermission.expires_at.label("expires_at"),
            grant_status.label("status"),
            DocumentPermission.updated_at.label("updated_at"),
        )
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .outerjoin(DocumentVersion, version_join)
        .where(
            Document.owner_user_id == current_user.id,
            DocumentPermission.user_id != Document.owner_user_id,
        )
    )
    request_can_view = func.coalesce(AccessRequest.requested_permissions["can_view"].as_boolean(), false())
    request_can_download = func.coalesce(AccessRequest.requested_permissions["can_download"].as_boolean(), false())
    request_can_edit = func.coalesce(AccessRequest.requested_permissions["can_edit"].as_boolean(), false())
    request_permission = case(
        (and_(request_can_edit, request_can_download), literal("read_download_edit")),
        (request_can_edit, literal("edit")),
        (request_can_download, literal("read_download")),
        else_=literal("read"),
    )
    denied_rows = (
        select(
            AccessRequest.id.label("id"),
            cast(literal(None), DocumentPermission.id.type).label("permission_id"),
            literal("denied_request", type_=String()).label("record_type"),
            Document.id.label("document_id"),
            Document.title.label("document_title"),
            DocumentVersion.original_filename.label("original_filename"),
            Document.category.label("category"),
            DocumentVersion.size_bytes.label("size_bytes"),
            Document.created_at.label("document_created_at"),
            recipient.id.label("recipient_id"),
            recipient.full_name.label("recipient_name"),
            recipient.email.label("recipient_email"),
            cast(recipient.account_status, String).label("recipient_account_status"),
            (request_can_view | request_can_download | request_can_edit).label("can_view"),
            request_can_download.label("can_download"),
            request_can_edit.label("can_edit"),
            request_permission.label("permission_key"),
            func.coalesce(AccessRequest.decided_at, AccessRequest.requested_at).label("event_at"),
            AccessRequest.expires_at.label("expires_at"),
            literal("denied", type_=String()).label("status"),
            AccessRequest.updated_at.label("updated_at"),
        )
        .join(Document, Document.id == AccessRequest.document_id)
        .join(recipient, recipient.id == AccessRequest.requester_user_id)
        .outerjoin(DocumentVersion, version_join)
        .where(
            Document.owner_user_id == current_user.id,
            AccessRequest.status == "DENIED",
            AccessRequest.requester_user_id != Document.owner_user_id,
            AccessRequest.decided_by_user_id == current_user.id,
        )
    )
    feed = union_all(grant_rows, denied_rows).subquery("sharing_permission_feed")
    statement = select(feed)
    if document_id:
        statement = statement.where(feed.c.document_id == document_id)
    if permission:
        statement = statement.where(feed.c.permission_key == permission)
    if status_filter:
        statement = statement.where(feed.c.status == status_filter)
    if date_window != "all":
        days = int(date_window[:-1])
        statement = statement.where(feed.c.event_at >= now - timedelta(days=days))
    term = search.strip() if search else ""
    if term:
        pattern = f"%{term}%"
        statement = statement.where(
            or_(
                feed.c.document_title.ilike(pattern),
                cast(feed.c.document_id, String).ilike(pattern),
                feed.c.recipient_name.ilike(pattern),
                feed.c.recipient_email.ilike(pattern),
            )
        )
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    sort_columns = {
        "document": feed.c.document_title,
        "recipient": feed.c.recipient_name,
        "permission": feed.c.permission_key,
        "event_at": feed.c.event_at,
        "expires_at": feed.c.expires_at,
        "status": feed.c.status,
    }
    sort_column = sort_columns[sort_by]
    ordered = sort_column.asc() if sort_order == "asc" else sort_column.desc()
    rows = db.execute(
        statement.order_by(ordered.nulls_last(), feed.c.record_type.asc(), feed.c.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).mappings().all()
    return SharingGrantPage(
        items=[SharingGrantRow(**row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/grants", response_model=list[DocumentPermissionResponse], status_code=status.HTTP_201_CREATED)
async def create_sharing_grants(
    body: SharingGrantBatch,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentPermissionResponse]:
    document = _owned_document(
        db, request, body.document_id, current_user, "grant_permission", for_update=True,
    )
    now = utc_now()
    if document.current_version is None or document.current_version.status != "AVAILABLE":
        raise HTTPException(status_code=409, detail="This document is not currently available for sharing.")
    if body.expires_at is not None and body.expires_at <= now:
        raise HTTPException(status_code=422, detail="Expiration must be in the future.")
    recipients = db.execute(
        select(User).where(
            User.id.in_(body.recipient_ids),
            User.account_status == AccountStatus.ACTIVE,
            User.id != current_user.id,
        )
    ).scalars().all()
    if len(recipients) != len(body.recipient_ids):
        raise HTTPException(status_code=422, detail="One or more selected recipients are unavailable.")
    if body.message and body.message.strip():
        _require_message_notifications(db, recipients, "access_granted")
    existing = {
        grant.user_id: grant
        for grant in db.execute(
            select(DocumentPermission).where(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id.in_(body.recipient_ids),
            ).with_for_update()
        ).scalars()
    }
    active_duplicates = [
        recipient.full_name
        for recipient in recipients
        if (grant := existing.get(recipient.id)) is not None
        and grant.revoked_at is None
        and (grant.expires_at is None or grant.expires_at > now)
        and document.status == "ACTIVE"
        and document.deleted_at is None
    ]
    if active_duplicates:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more selected people already have access. Open Manage Access to update their grant.",
        )
    result = []
    try:
        for recipient in recipients:
            grant = existing.get(recipient.id)
            if grant is None:
                grant = DocumentPermission(
                    document_id=document.id,
                    user_id=recipient.id,
                    granted_by_user_id=current_user.id,
                    granted_at=now,
                    updated_at=now,
                    can_view=body.can_view,
                    can_download=body.can_download,
                    can_edit=body.can_edit,
                    expires_at=body.expires_at,
                )
                db.add(grant)
            else:
                grant.granted_by_user_id = current_user.id
                grant.granted_at = now
                grant.can_view = body.can_view
                grant.can_download = body.can_download
                grant.can_edit = body.can_edit
                grant.expires_at = body.expires_at
                grant.revoked_at = None
                grant.revoked_by_user_id = None
                grant.updated_at = now
            record_audit(
                db,
                request,
                actor_user_id=current_user.id,
                action_type="PERMISSION_GRANTED",
                result="SUCCESS",
                document=document,
                target_user_id=recipient.id,
                details={
                    "can_view": body.can_view,
                    "can_download": body.can_download,
                    "can_edit": body.can_edit,
                    "expires_at": body.expires_at.isoformat() if body.expires_at else None,
                    "source": "sharing_permissions",
                },
            )
            add_notification(
                db,
                recipient_user_id=recipient.id,
                actor_user_id=current_user.id,
                notification_type="ACCESS_GRANTED",
                title="Document access granted",
                message=_notification_message(current_user, document, body.message, "shared"),
                preference_key="access_granted",
                document_id=document.id,
                metadata={"permission_id": str(grant.id)},
            )
            result.append((grant, recipient))
        db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return [
        _grant_response(grant, recipient, current_user, document, now)
        for grant, recipient in result
    ]


@router.patch("/documents/{document_id}/grants", response_model=GrantChangeResult)
async def update_sharing_grants(
    document_id: uuid.UUID,
    body: GrantChanges,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GrantChangeResult:
    document = _owned_document(
        db, request, document_id, current_user, "manage_permissions", for_update=True,
    )
    now = utc_now()
    if any(update.expires_at is not None and update.expires_at <= now for update in body.updates):
        raise HTTPException(status_code=422, detail="Expiration must be in the future.")
    ids = [update.permission_id for update in body.updates]
    grants = db.execute(
        select(DocumentPermission)
        .where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id != document.owner_user_id,
            DocumentPermission.id.in_(ids),
        )
        .with_for_update()
    ).scalars().all()
    by_id = {grant.id: grant for grant in grants}
    if len(by_id) != len(ids):
        raise HTTPException(status_code=404, detail="One or more permission grants were not found.")
    for change in body.updates:
        grant = by_id[change.permission_id]
        if grant.revoked_at is not None:
            raise HTTPException(status_code=409, detail="A revoked permission changed while this dialog was open. Refresh and try again.")
        if grant.updated_at != change.expected_updated_at:
            raise HTTPException(status_code=409, detail="A permission changed while this dialog was open. Refresh and review the latest access settings.")
    recipient_alias = aliased(User)
    recipients = {
        user.id: user
        for user in db.execute(
            select(recipient_alias).where(recipient_alias.id.in_([grant.user_id for grant in grants]))
        ).scalars()
    }
    changed_updates = []
    for change in body.updates:
        grant = by_id[change.permission_id]
        next_expiry = change.expires_at
        if (grant.can_view, grant.can_download, grant.can_edit, grant.expires_at) != (
            change.can_view, change.can_download, change.can_edit, next_expiry,
        ):
            changed_updates.append(change)
    if not changed_updates:
        raise HTTPException(status_code=422, detail="There are no permission changes to save.")
    if body.message and body.message.strip():
        _require_message_notifications(
            db,
            [recipients[by_id[change.permission_id].user_id] for change in changed_updates],
            "access_granted",
        )
    try:
        updated = []
        for change in changed_updates:
            grant = by_id[change.permission_id]
            previous = (grant.can_view, grant.can_download, grant.can_edit, grant.expires_at)
            grant.can_view = change.can_view
            grant.can_download = change.can_download
            grant.can_edit = change.can_edit
            grant.expires_at = change.expires_at
            grant.updated_at = now
            recipient = recipients[grant.user_id]
            record_audit(
                db,
                request,
                actor_user_id=current_user.id,
                action_type="PERMISSION_GRANTED",
                result="SUCCESS",
                document=document,
                target_user_id=recipient.id,
                details={
                    "operation": "permission_updated",
                    "permission_id": str(grant.id),
                    "can_view": grant.can_view,
                    "can_download": grant.can_download,
                    "can_edit": grant.can_edit,
                    "expires_at": grant.expires_at.isoformat() if grant.expires_at else None,
                },
            )
            if previous != (grant.can_view, grant.can_download, grant.can_edit, grant.expires_at):
                add_notification(
                    db,
                    recipient_user_id=recipient.id,
                    actor_user_id=current_user.id,
                    notification_type="ACCESS_GRANTED",
                    title="Document access updated",
                    message=_notification_message(current_user, document, body.message, "updated"),
                    preference_key="access_granted",
                    document_id=document.id,
                    metadata={"permission_id": str(grant.id)},
                )
            updated.append((grant, recipient))
        db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return GrantChangeResult(items=[
        _grant_response(grant, recipients[grant.user_id], current_user, document, now)
        for grant, _recipient in updated
    ])


@router.post("/documents/{document_id}/revoke-all", response_model=RevokeAllResult)
async def revoke_all_sharing_grants(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RevokeAllResult:
    document = _owned_document(
        db, request, document_id, current_user, "revoke_permission", for_update=True,
    )
    now = utc_now()
    grants = db.execute(
        select(DocumentPermission)
        .where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id != document.owner_user_id,
            DocumentPermission.revoked_at.is_(None),
            or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > now),
        )
        .with_for_update()
    ).scalars().all()
    recipients = {
        user.id: user
        for user in db.execute(select(User).where(User.id.in_([grant.user_id for grant in grants]))).scalars()
    } if grants else {}
    try:
        for grant in grants:
            grant.revoked_at = now
            grant.revoked_by_user_id = current_user.id
            grant.updated_at = now
            record_audit(
                db,
                request,
                actor_user_id=current_user.id,
                action_type="PERMISSION_REVOKED",
                result="SUCCESS",
                document=document,
                target_user_id=grant.user_id,
                details={"permission_id": str(grant.id), "operation": "revoke_all"},
            )
            recipient = recipients.get(grant.user_id)
            if recipient is not None:
                add_notification(
                    db,
                    recipient_user_id=recipient.id,
                    actor_user_id=current_user.id,
                    notification_type="ACCESS_REVOKED",
                    title="Document access revoked",
                    message=f"Access to {document.title} was revoked.",
                    preference_key="access_revoked",
                    document_id=document.id,
                    metadata={"permission_id": str(grant.id)},
                )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return RevokeAllResult(revoked_count=len(grants))
