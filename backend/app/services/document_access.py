"""Shared document ownership, permission, and audit helpers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.documents import Document, DocumentAuditLog, DocumentPermission
from app.models.user import User

DocumentAction = Literal["view", "download"]


def get_document(
    db: Session,
    document_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Document | None:
    statement = (
        select(Document)
        .options(joinedload(Document.owner), joinedload(Document.current_version))
        .where(Document.id == document_id)
    )
    if for_update:
        statement = statement.with_for_update(of=Document)
    return db.execute(statement).unique().scalar_one_or_none()


def permission_for(
    db: Session,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
) -> DocumentPermission | None:
    return db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id,
        )
    ).scalar_one_or_none()


def can_access(
    db: Session,
    document: Document,
    user: User,
    action: DocumentAction,
) -> bool:
    if document.status != "ACTIVE" or document.deleted_at is not None:
        return False
    if document.owner_user_id == user.id:
        return True
    grant = permission_for(db, document.id, user.id)
    if grant is None or not grant.is_effective:
        return False
    return grant.can_view if action == "view" else grant.can_download


def record_audit(
    db: Session,
    request: Request,
    *,
    actor_user_id: uuid.UUID | None,
    action_type: str,
    result: str,
    document: Document | None = None,
    document_id: uuid.UUID | None = None,
    target_user_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> DocumentAuditLog:
    resolved_id = document.id if document is not None else document_id
    if resolved_id is None:
        raise ValueError("A document or document ID is required for audit records.")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:512] or None
    request_id = request.headers.get("x-request-id", "")[:100] or None
    event = DocumentAuditLog(
        document_id=(
            resolved_id
            if document is not None and document.status != "DELETED"
            else None
        ),
        document_id_snapshot=resolved_id,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        action_type=action_type,
        result=result,
        ip_address=client_ip,
        user_agent=user_agent,
        request_id=request_id,
        details=details or {},
    )
    db.add(event)
    return event


def require_access(
    db: Session,
    request: Request,
    document: Document | None,
    user: User,
    action: DocumentAction,
    requested_id: uuid.UUID | None = None,
) -> Document:
    if document is None or not can_access(db, document, user, action):
        record_audit(
            db,
            request,
            actor_user_id=user.id,
            action_type="ACCESS_DENIED",
            result="DENIED",
            document=document,
            document_id=document.id if document is not None else requested_id,
            details={"operation": action},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )
    return document


def require_owner(
    db: Session,
    request: Request,
    document: Document | None,
    user: User,
    operation: str,
    requested_id: uuid.UUID | None = None,
) -> Document:
    if (
        document is None
        or document.owner_user_id != user.id
        or document.status != "ACTIVE"
        or document.deleted_at is not None
    ):
        record_audit(
            db,
            request,
            actor_user_id=user.id,
            action_type="ACCESS_DENIED",
            result="DENIED",
            document=document,
            document_id=document.id if document is not None else requested_id,
            details={"operation": operation},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )
    return document


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
