"""Administrator views and controls for document permission records."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import String, func, or_, select
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.documents import Document, DocumentAuditLog, DocumentPermission
from app.models.user import User
from app.services.document_access import record_audit, utc_now

router = APIRouter(prefix="/api/admin/permissions", tags=["admin-permissions"])


class RevokePermissionRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a reason for revoking this permission.")
        return value


def _permission_status(permission: DocumentPermission, now: datetime) -> str:
    if permission.revoked_at is not None:
        return "Revoked"
    if permission.expires_at is not None and permission.expires_at <= now:
        return "Expired"
    return "Active"


def _permission_type(can_view: bool, can_download: bool, can_edit: bool = False) -> str:
    if can_edit and can_download:
        return "Edit + Download"
    if can_edit:
        return "Edit"
    if can_download:
        return "Read + Download"
    if can_view:
        return "Read"
    return "Not recorded"


@router.get("/records")
async def list_admin_permission_records(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=150),
    owner_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    permission_type: str | None = Query(default=None, max_length=30),
    permission_status: str | None = Query(default=None, max_length=20),
    grant_from: date | None = None,
    expires_from: date | None = None,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return real grant rows, global summary counts, and filter options."""
    now = utc_now()
    owner = aliased(User)
    recipient = aliased(User)
    grantor = aliased(User)
    statement = (
        select(DocumentPermission, Document, owner, recipient, grantor)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(owner, owner.id == Document.owner_user_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .options(joinedload(Document.current_version))
    )
    filters = []
    if owner_id is not None:
        filters.append(Document.owner_user_id == owner_id)
    if user_id is not None:
        filters.append(DocumentPermission.user_id == user_id)
    if permission_type:
        normalized_type = permission_type.strip().lower()
        if normalized_type == "read":
            filters.extend([
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
            ])
        elif normalized_type in {"read + download", "read_download"}:
            filters.append(DocumentPermission.can_download.is_(True))
        elif normalized_type == "edit":
            filters.append(DocumentPermission.can_edit.is_(True))
        else:
            raise HTTPException(status_code=422, detail="Unsupported permission type.")
    if permission_status:
        normalized_status = permission_status.strip().lower()
        if normalized_status == "active":
            filters.extend([
                DocumentPermission.revoked_at.is_(None),
                or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > now),
            ])
        elif normalized_status == "expired":
            filters.extend([
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
            ])
        elif normalized_status == "revoked":
            filters.append(DocumentPermission.revoked_at.is_not(None))
        else:
            raise HTTPException(status_code=422, detail="Unsupported permission status.")
    if grant_from is not None:
        filters.append(
            DocumentPermission.granted_at >= datetime.combine(grant_from, time.min, timezone.utc)
        )
    if expires_from is not None:
        expiry_boundary = datetime.combine(expires_from, time.min, timezone.utc)
        filters.append(
            or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at >= expiry_boundary)
        )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(
            Document.title.ilike(pattern),
            Document.id.cast(String).ilike(pattern),
            DocumentPermission.id.cast(String).ilike(pattern),
            owner.full_name.ilike(pattern),
            owner.email.ilike(pattern),
            recipient.full_name.ilike(pattern),
            recipient.email.ilike(pattern),
            grantor.full_name.ilike(pattern),
            grantor.email.ilike(pattern),
        ))

    total = db.scalar(
        select(func.count())
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(owner, owner.id == Document.owner_user_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .where(*filters)
    ) or 0
    rows = db.execute(
        statement.where(*filters)
        .order_by(DocumentPermission.granted_at.desc(), DocumentPermission.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    active = [
        DocumentPermission.revoked_at.is_(None),
        or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > now),
    ]
    totals = db.execute(select(
        func.count(DocumentPermission.id).filter(*active).label("active_grants"),
        func.count(DocumentPermission.id).filter(
            *active,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.can_download.is_(False),
        ).label("read_permissions"),
        func.count(DocumentPermission.id).filter(
            *active, DocumentPermission.can_download.is_(True)
        ).label("download_permissions"),
        func.count(DocumentPermission.id).filter(
            DocumentPermission.revoked_at.is_not(None)
        ).label("revoked_grants"),
    )).mappings().one()

    owners = db.execute(
        select(owner.id, owner.full_name)
        .join(Document, Document.owner_user_id == owner.id)
        .join(DocumentPermission, DocumentPermission.document_id == Document.id)
        .distinct()
        .order_by(owner.full_name)
    ).all()
    users = db.execute(
        select(recipient.id, recipient.full_name)
        .join(DocumentPermission, DocumentPermission.user_id == recipient.id)
        .distinct()
        .order_by(recipient.full_name)
    ).all()

    items = []
    for permission, document, document_owner, user, granted_by in rows:
        version = document.current_version
        items.append({
            "id": str(permission.id),
            "document_id": str(document.id),
            "document_title": document.title,
            "document_filename": version.original_filename if version else None,
            "document_status": document.status,
            "owner_id": str(document_owner.id),
            "owner_name": document_owner.full_name,
            "user_id": str(user.id),
            "user_name": user.full_name,
            "user_email": user.email,
            "permission_type": _permission_type(permission.can_view, permission.can_download, permission.can_edit),
            "can_view": permission.can_view,
            "can_download": permission.can_download,
            "can_edit": permission.can_edit,
            "granted_by_name": granted_by.full_name,
            "granted_at": permission.granted_at,
            "expires_at": permission.expires_at,
            "status": _permission_status(permission, now),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": {key: totals[key] for key in totals.keys()},
        "owners": [{"id": str(row.id), "name": row.full_name} for row in owners],
        "users": [{"id": str(row.id), "name": row.full_name} for row in users],
    }


@router.get("/documents/{document_id}")
async def get_admin_document_permission_details(
    document_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return admin-visible metadata, every grant, and recorded audit events."""
    document = db.execute(
        select(Document)
        .options(joinedload(Document.owner), joinedload(Document.current_version))
        .where(Document.id == document_id)
    ).unique().scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    owner = document.owner
    version = document.current_version
    # Build explicit aliases for the grant recipient and grantor to avoid exposing
    # storage metadata while resolving both user identities.
    recipient = aliased(User)
    grantor = aliased(User)
    permission_rows = db.execute(
        select(DocumentPermission, recipient, grantor)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .where(DocumentPermission.document_id == document.id)
        .order_by(DocumentPermission.granted_at.desc(), DocumentPermission.id)
    ).all()
    now = utc_now()
    grants = [{
        "id": str(permission.id),
        "user_id": str(user.id),
        "user_name": user.full_name,
        "user_email": user.email,
        "user_department": user.department,
        "can_view": permission.can_view,
        "can_download": permission.can_download,
        "can_edit": permission.can_edit,
        "permission_type": _permission_type(permission.can_view, permission.can_download, permission.can_edit),
        "granted_by_user_id": str(granting_user.id),
        "granted_by_name": granting_user.full_name,
        "granted_by_email": granting_user.email,
        "granted_at": permission.granted_at,
        "expires_at": permission.expires_at,
        "revoked_at": permission.revoked_at,
        "revoked_by_user_id": str(permission.revoked_by_user_id) if permission.revoked_by_user_id else None,
        "status": _permission_status(permission, now),
    } for permission, user, granting_user in permission_rows]

    actor = aliased(User)
    target = aliased(User)
    audit_rows = db.execute(
        select(DocumentAuditLog, actor, target)
        .outerjoin(actor, actor.id == DocumentAuditLog.actor_user_id)
        .outerjoin(target, target.id == DocumentAuditLog.target_user_id)
        .where(DocumentAuditLog.document_id_snapshot == document.id)
        .order_by(DocumentAuditLog.occurred_at.desc(), DocumentAuditLog.id.desc())
    ).all()
    audit = [{
        "id": str(event.id),
        "actor_user_id": str(event.actor_user_id) if event.actor_user_id else None,
        "actor_name": event_actor.full_name if event_actor else None,
        "actor_email": event_actor.email if event_actor else None,
        "target_user_id": str(event.target_user_id) if event.target_user_id else None,
        "target_name": event_target.full_name if event_target else None,
        "target_email": event_target.email if event_target else None,
        "action_type": event.action_type,
        "result": event.result,
        "occurred_at": event.occurred_at,
        "ip_address": event.ip_address,
        "details": event.details,
    } for event, event_actor, event_target in audit_rows]

    return {
        "document": {
            "id": str(document.id),
            "title": document.title,
            "original_filename": version.original_filename if version else None,
            "file_extension": version.file_extension if version else None,
            "content_type": version.content_type if version else None,
            "size_bytes": version.size_bytes if version else None,
            "category": document.category,
            "classification": document.classification,
            "department": document.department,
            "description": document.description,
            "status": document.status,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
            "uploaded_at": version.uploaded_at if version else None,
            "owner": {
                "id": str(owner.id),
                "full_name": owner.full_name,
                "email": owner.email,
                "role": owner.role.value,
                "department": owner.department,
                "job_title": owner.job_title,
                "account_status": owner.account_status.value,
            },
        },
        "permissions": grants,
        "audit": audit,
    }


@router.delete("/documents/{document_id}/grants/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_admin_document_permission(
    document_id: uuid.UUID,
    permission_id: uuid.UUID,
    body: RevokePermissionRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    grant = db.execute(
        select(DocumentPermission)
        .where(
            DocumentPermission.id == permission_id,
            DocumentPermission.document_id == document.id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if grant is None:
        raise HTTPException(status_code=404, detail="Permission not found for this document.")
    now = utc_now()
    if grant.user_id == document.owner_user_id:
        raise HTTPException(status_code=409, detail="The document owner cannot be revoked.")
    if grant.revoked_at is not None or (grant.expires_at is not None and grant.expires_at <= now):
        raise HTTPException(status_code=409, detail="This permission is no longer active.")

    grant.revoked_at = now
    grant.revoked_by_user_id = admin.id
    grant.updated_at = now
    record_audit(
        db,
        request,
        actor_user_id=admin.id,
        action_type="PERMISSION_REVOKED",
        result="SUCCESS",
        document=document,
        target_user_id=grant.user_id,
        details={
            "permission_id": str(grant.id),
            "reason": body.reason,
            "can_view": grant.can_view,
            "can_download": grant.can_download,
        },
    )
    db.commit()
