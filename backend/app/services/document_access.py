"""Shared document ownership, permission, and audit helpers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.documents import Document, DocumentAuditLog, DocumentPermission
from app.models.user import AccountStatus, User

DocumentAction = Literal[
    "view", "download", "edit", "delete", "share", "manage_permissions",
]


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
    return can_perform_document_action(db, document, user, action)


def _document_is_active(document: Document, user: User) -> bool:
    return (
        user.account_status == AccountStatus.ACTIVE
        and document.status == "ACTIVE"
        and document.deleted_at is None
    )


def _active_grant(
    db: Session,
    document: Document,
    user: User,
) -> DocumentPermission | None:
    grant = permission_for(db, document.id, user.id)
    if grant is None or not grant.is_effective:
        return None
    return grant


def can_view_document(db: Session, document: Document, user: User) -> bool:
    if not _document_is_active(document, user):
        return False
    if document.owner_user_id == user.id:
        return True
    grant = _active_grant(db, document, user)
    return bool(grant and grant.can_view)


def can_download_document(db: Session, document: Document, user: User) -> bool:
    if not _document_is_active(document, user):
        return False
    if document.owner_user_id == user.id:
        return True
    grant = _active_grant(db, document, user)
    return bool(grant and grant.can_download)


def can_edit_document(db: Session, document: Document, user: User) -> bool:
    if not _document_is_active(document, user):
        return False
    if document.owner_user_id == user.id:
        return True
    grant = _active_grant(db, document, user)
    return bool(grant and grant.can_edit)


def can_delete_document(document: Document, user: User) -> bool:
    return _document_is_active(document, user) and document.owner_user_id == user.id


def can_share_document(db: Session, document: Document, user: User) -> bool:
    # Delegated sharing is not part of the current product contract.
    return can_manage_document_permissions(db, document, user)


def can_manage_document_permissions(
    db: Session,
    document: Document,
    user: User,
) -> bool:
    return _document_is_active(document, user) and document.owner_user_id == user.id


def can_perform_document_action(
    db: Session,
    document: Document,
    user: User,
    action: DocumentAction,
) -> bool:
    if action == "view":
        return can_view_document(db, document, user)
    if action == "download":
        return can_download_document(db, document, user)
    if action == "edit":
        return can_edit_document(db, document, user)
    if action == "delete":
        return can_delete_document(document, user)
    if action == "share":
        return can_share_document(db, document, user)
    return can_manage_document_permissions(db, document, user)


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
    actor = db.get(User, actor_user_id) if actor_user_id is not None else None
    target = db.get(User, target_user_id) if target_user_id is not None else None
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
        actor_user_id_snapshot=actor.id if actor else actor_user_id,
        actor_name_snapshot=actor.full_name if actor else None,
        actor_email_snapshot=actor.email if actor else None,
        actor_role_snapshot=(
            actor.role.value if actor and hasattr(actor.role, "value")
            else str(actor.role) if actor else None
        ),
        target_user_id=target_user_id,
        target_user_id_snapshot=target.id if target else target_user_id,
        target_name_snapshot=target.full_name if target else None,
        target_email_snapshot=target.email if target else None,
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
    if document is None or not can_perform_document_action(db, document, user, action):
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
    forbidden_for_existing_document: bool = False,
) -> Document:
    if (
        document is None
        or user.account_status != AccountStatus.ACTIVE
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
            status_code=(
                status.HTTP_403_FORBIDDEN
                if document is not None and forbidden_for_existing_document
                else status.HTTP_404_NOT_FOUND
            ),
            detail="Document not found or access denied.",
        )
    return document


def require_edit(
    db: Session,
    request: Request,
    document: Document | None,
    user: User,
    operation: str,
    requested_id: uuid.UUID | None = None,
) -> Document:
    return require_access(
        db, request, document, user, "edit", requested_id=requested_id,
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
