"""Authenticated, current-owner-scoped document audit activity."""

from __future__ import annotations

import csv
import json
import uuid
from datetime import datetime, timedelta, timezone
from io import StringIO
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.documents import Document, DocumentAuditLog, DocumentVersion
from app.models.persistence import DocumentAuditSecurityFlag
from app.models.user import User
from app.schemas.document_activity import (
    ActivityDocument,
    ActivityEvent,
    ActivityEventDetails,
    ActivityListResponse,
    ActivityPrincipal,
    SecurityFlagRequest,
    SecurityFlagResponse,
)

router = APIRouter(prefix="/api/documents/activity", tags=["document-activity"])

ACTION_TYPES = {
    "DOCUMENT_UPLOADED",
    "DOCUMENT_VIEWED",
    "DOCUMENT_DOWNLOADED",
    "DOCUMENT_METADATA_UPDATED",
    "DOCUMENT_VERSION_CREATED",
    "DOCUMENT_DELETED",
    "DOCUMENT_RESTORED",
    "DOCUMENT_SCAN_COMPLETED",
    "PERMISSION_GRANTED",
    "PERMISSION_REVOKED",
    "UPLOAD_REJECTED",
    "ACCESS_DENIED",
    "ACCESS_REQUEST_SUBMITTED",
    "ACCESS_REQUEST_APPROVED",
    "ACCESS_REQUEST_DENIED",
    "ACCESS_REQUEST_CANCELLED",
}
OUTCOMES = {"SUCCESS", "DENIED", "FAILED"}
DATE_RANGES = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "90d": timedelta(days=90)}
FLAG_REASONS = {
    "SUSPICIOUS_ACCESS",
    "UNEXPECTED_DOWNLOAD",
    "UNAUTHORIZED_ATTEMPT",
    "PERMISSION_CHANGE",
    "UNRECOGNIZED_ACTOR",
    "OTHER",
}
_SENSITIVE_KEY_PARTS = (
    "password", "token", "secret", "credential", "authorization", "cookie",
    "session", "presigned", "storage_key", "s3_key", "bucket", "object_key",
)


def _safe_details(value: Any) -> Any:
    """Return audit metadata while dropping storage locators and secret-like fields."""
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for key, item in value.items():
            normalized = str(key).lower().replace("-", "_")
            if any(part in normalized for part in _SENSITIVE_KEY_PARTS):
                continue
            safe[str(key)] = _safe_details(item)
        return safe
    if isinstance(value, list):
        return [_safe_details(item) for item in value[:100]]
    if isinstance(value, str):
        return value[:2000]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:2000]


def _principal(
    user: User | None,
    *,
    fallback: str | None = None,
    id_snapshot: uuid.UUID | None = None,
    name_snapshot: str | None = None,
    email_snapshot: str | None = None,
    role_snapshot: str | None = None,
) -> ActivityPrincipal:
    if user is None:
        return ActivityPrincipal(
            id=id_snapshot,
            name=name_snapshot or fallback or "Unavailable account",
            email=email_snapshot,
            role=role_snapshot,
        )
    return ActivityPrincipal(
        id=id_snapshot or user.id,
        name=name_snapshot or user.full_name,
        email=email_snapshot or user.email,
        role=role_snapshot or (user.role.value if hasattr(user.role, "value") else str(user.role)),
        account_status=(
            user.account_status.value
            if hasattr(user.account_status, "value")
            else str(user.account_status)
        ),
    )


def _document(document: Document, owner: User, version: DocumentVersion | None) -> ActivityDocument:
    return ActivityDocument(
        id=document.id,
        title=document.title,
        original_filename=version.original_filename if version else None,
        file_extension=version.file_extension if version else None,
        content_type=version.content_type if version else None,
        size_bytes=version.size_bytes if version else None,
        category=document.category,
        classification=document.classification,
        status=document.status,
        owner=_principal(owner),
        current_version_id=document.current_version_id,
        current_version_number=version.version_number if version else None,
        current_version_status=version.status if version else None,
    )


def _base_statement(current_user: User):
    actor = aliased(User, name="activity_actor")
    target = aliased(User, name="activity_target")
    owner = aliased(User, name="activity_owner")
    version = aliased(DocumentVersion, name="activity_version")
    statement = (
        select(DocumentAuditLog, Document, owner, actor, target, version)
        .join(Document, Document.id == DocumentAuditLog.document_id_snapshot)
        .join(owner, owner.id == Document.owner_user_id)
        .outerjoin(actor, actor.id == DocumentAuditLog.actor_user_id)
        .outerjoin(target, target.id == DocumentAuditLog.target_user_id)
        .outerjoin(version, version.id == Document.current_version_id)
        .where(Document.owner_user_id == current_user.id)
    )
    return statement, actor, target


def _filters(
    statement,
    *,
    actor,
    search: str | None,
    action: str | None,
    outcome: str | None,
    date_range: str,
    start_at: datetime | None,
    end_at: datetime | None,
):
    if action:
        if action not in ACTION_TYPES:
            raise HTTPException(status_code=422, detail="Unsupported activity action.")
        statement = statement.where(DocumentAuditLog.action_type == action)
    if outcome:
        if outcome not in OUTCOMES:
            raise HTTPException(status_code=422, detail="Unsupported activity outcome.")
        statement = statement.where(DocumentAuditLog.result == outcome)

    now = datetime.now(timezone.utc)
    if date_range == "custom":
        if start_at is None or end_at is None:
            raise HTTPException(status_code=422, detail="A custom date range needs both start and end dates.")
        if start_at.tzinfo is None or end_at.tzinfo is None:
            raise HTTPException(status_code=422, detail="Custom dates must include a timezone.")
        start = start_at.astimezone(timezone.utc)
        end = end_at.astimezone(timezone.utc)
        if start > end:
            raise HTTPException(status_code=422, detail="The start date must be before the end date.")
    elif date_range in DATE_RANGES:
        start = now - DATE_RANGES[date_range]
        end = now
    else:
        raise HTTPException(status_code=422, detail="Unsupported activity date range.")
    statement = statement.where(
        DocumentAuditLog.occurred_at >= start,
        DocumentAuditLog.occurred_at <= end,
    )

    query = search.strip() if search else ""
    if query:
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        statement = statement.where(or_(
            Document.title.ilike(pattern, escape="\\"),
            cast(Document.id, String).ilike(pattern, escape="\\"),
            cast(DocumentAuditLog.id, String).ilike(pattern, escape="\\"),
            func.coalesce(DocumentAuditLog.actor_name_snapshot, actor.full_name).ilike(pattern, escape="\\"),
            func.coalesce(DocumentAuditLog.actor_email_snapshot, actor.email).ilike(pattern, escape="\\"),
            DocumentAuditLog.action_type.ilike(pattern, escape="\\"),
        ))
    return statement


def _row_to_event(row: tuple[Any, ...]) -> ActivityEvent:
    event, document, owner, actor, target, version = row
    return ActivityEvent(
        id=event.id,
        document_id_snapshot=event.document_id_snapshot,
        actor=_principal(
            actor,
            fallback="System or unavailable account",
            id_snapshot=event.actor_user_id_snapshot,
            name_snapshot=event.actor_name_snapshot,
            email_snapshot=event.actor_email_snapshot,
            role_snapshot=event.actor_role_snapshot,
        ),
        target=(
            _principal(
                target,
                id_snapshot=event.target_user_id_snapshot,
                name_snapshot=event.target_name_snapshot,
                email_snapshot=event.target_email_snapshot,
            )
            if event.target_user_id or event.target_user_id_snapshot
            else None
        ),
        action_type=event.action_type,
        result=event.result,
        occurred_at=event.occurred_at,
        document=_document(document, owner, version),
    )


def _row_to_details(row: tuple[Any, ...]) -> ActivityEventDetails:
    event, document, owner, actor, target, version = row
    base = _row_to_event(row).model_dump()
    return ActivityEventDetails(
        **base,
        ip_address=event.ip_address,
        user_agent=event.user_agent,
        request_id=event.request_id,
        details=_safe_details(event.details or {}),
    )


def _owned_event_statement(event_id: uuid.UUID, current_user: User):
    statement, _, _ = _base_statement(current_user)
    return statement.where(DocumentAuditLog.id == event_id)


def _csv_safe(value: Any) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


def _download_response(data: bytes, filename: str, content_type: str) -> Response:
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("", response_model=ActivityListResponse)
async def list_document_activity(
    search: str | None = Query(default=None, max_length=120),
    action: str | None = Query(default=None, max_length=50),
    outcome: str | None = Query(default=None, max_length=20),
    date_range: str = Query(default="30d", max_length=16),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    page: int = Query(default=1, ge=1, le=1000000),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityListResponse:
    statement, actor, _ = _base_statement(current_user)
    statement = _filters(
        statement,
        actor=actor,
        search=search,
        action=action,
        outcome=outcome,
        date_range=date_range,
        start_at=start_at,
        end_at=end_at,
    )
    filtered = statement.with_only_columns(
        DocumentAuditLog.id.label("id"),
        DocumentAuditLog.result.label("result"),
    ).order_by(None).subquery("owner_activity_filter")
    total, successful, denied = db.execute(select(
        func.count(filtered.c.id),
        func.count(filtered.c.id).filter(filtered.c.result == "SUCCESS"),
        func.count(filtered.c.id).filter(filtered.c.result == "DENIED"),
    )).one()

    ordering = (
        (DocumentAuditLog.occurred_at.asc(), DocumentAuditLog.id.asc())
        if sort == "oldest"
        else (DocumentAuditLog.occurred_at.desc(), DocumentAuditLog.id.desc())
    )
    rows = db.execute(
        statement.order_by(*ordering).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ActivityListResponse(
        items=[_row_to_event(row) for row in rows],
        total=total,
        successful=successful,
        denied=denied,
        page=page,
        page_size=page_size,
    )


@router.get("/export.csv")
async def export_document_activity(
    search: str | None = Query(default=None, max_length=120),
    action: str | None = Query(default=None, max_length=50),
    outcome: str | None = Query(default=None, max_length=20),
    date_range: str = Query(default="30d", max_length=16),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    statement, actor, _ = _base_statement(current_user)
    statement = _filters(
        statement,
        actor=actor,
        search=search,
        action=action,
        outcome=outcome,
        date_range=date_range,
        start_at=start_at,
        end_at=end_at,
    )
    ordering = (
        (DocumentAuditLog.occurred_at.asc(), DocumentAuditLog.id.asc())
        if sort == "oldest"
        else (DocumentAuditLog.occurred_at.desc(), DocumentAuditLog.id.desc())
    )
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(("Event ID", "Timestamp (UTC)", "Action", "Outcome", "Document ID", "Document", "Actor", "Actor email", "Target", "File type", "File size bytes"))
    for row in db.execute(statement.order_by(*ordering)).all():
        event, document, _, actor_user, target, version = row
        writer.writerow(tuple(_csv_safe(value) for value in (
            event.id,
            event.occurred_at.astimezone(timezone.utc).isoformat(),
            event.action_type,
            event.result,
            document.id,
            document.title,
            event.actor_name_snapshot or (actor_user.full_name if actor_user else "System or unavailable account"),
            event.actor_email_snapshot or (actor_user.email if actor_user else ""),
            event.target_name_snapshot or (target.full_name if target else ""),
            version.file_extension if version else "",
            version.size_bytes if version else "",
        )))
    return _download_response(
        output.getvalue().encode("utf-8-sig"),
        "suredocs-document-activity.csv",
        "text/csv; charset=utf-8",
    )


@router.get("/events/{event_id}", response_model=ActivityEventDetails)
async def get_document_activity_details(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityEventDetails:
    row = db.execute(_owned_event_statement(event_id, current_user)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Activity event not found.")
    return _row_to_details(row)


@router.get("/events/{event_id}/export.json")
async def export_document_activity_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    row = db.execute(_owned_event_statement(event_id, current_user)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Activity event not found.")
    data = json.dumps(jsonable_encoder(_row_to_details(row)), ensure_ascii=False, indent=2).encode("utf-8")
    return _download_response(data, f"activity-event-{event_id}.json", "application/json")


@router.post("/events/{event_id}/flags", response_model=SecurityFlagResponse, status_code=201)
async def create_document_activity_flag(
    event_id: uuid.UUID,
    payload: SecurityFlagRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SecurityFlagResponse:
    row = db.execute(_owned_event_statement(event_id, current_user)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Activity event not found.")
    if payload.reason_code not in FLAG_REASONS:
        raise HTTPException(status_code=422, detail="Choose a supported security review reason.")
    description = payload.description.strip() if payload.description else None
    description = description or None

    existing = db.execute(
        select(DocumentAuditSecurityFlag).where(
            DocumentAuditSecurityFlag.submission_id == payload.submission_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        if existing.event_id != event_id or existing.reported_by_user_id != current_user.id:
            raise HTTPException(status_code=409, detail="This report request was already used.")
        return SecurityFlagResponse(
            id=existing.id, event_id=existing.event_id,
            submitted_at=existing.submitted_at, duplicate=True,
        )

    event = row[0]
    flag = DocumentAuditSecurityFlag(
        event_id=event.id,
        document_id_snapshot=event.document_id_snapshot,
        reported_by_user_id=current_user.id,
        submission_id=payload.submission_id,
        reason_code=payload.reason_code,
        description=description,
    )
    db.add(flag)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(DocumentAuditSecurityFlag).where(
                DocumentAuditSecurityFlag.submission_id == payload.submission_id
            )
        ).scalar_one_or_none()
        if (
            existing is None
            or existing.event_id != event_id
            or existing.reported_by_user_id != current_user.id
        ):
            raise HTTPException(status_code=409, detail="This report request was already used.")
        return SecurityFlagResponse(
            id=existing.id, event_id=existing.event_id,
            submitted_at=existing.submitted_at, duplicate=True,
        )
    db.refresh(flag)
    return SecurityFlagResponse(id=flag.id, event_id=flag.event_id, submitted_at=flag.submitted_at)
