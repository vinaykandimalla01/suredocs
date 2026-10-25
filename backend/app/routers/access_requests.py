"""Document access request submission and owner decisions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.persistence import AccessRequest
from app.models.user import AccountStatus, User
from app.schemas.access_requests import (
    AccessRequestCreate,
    AccessRequestDecision,
    AccessRequestPageResponse,
    AccessRequestResponse,
    AccessRequestSummaryResponse,
)
from app.services.document_access import get_document, record_audit
from app.services.notifications import add_notification

router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])


def _response(
    request: AccessRequest,
    document: Document,
    version: DocumentVersion | None,
    requester: User,
    owner: User,
    viewer: User,
) -> AccessRequestResponse:
    return AccessRequestResponse(
        id=request.id,
        document_id=document.id,
        document_title=document.title,
        document_category=document.category,
        original_filename=version.original_filename if version else None,
        requester_user_id=requester.id,
        requester_name=requester.full_name,
        requester_email=requester.email,
        requester_department=requester.department,
        owner_user_id=owner.id,
        owner_name=owner.full_name,
        requested_permissions=request.requested_permissions,
        reason=request.reason,
        status=request.status,
        requested_at=request.requested_at,
        decided_by_user_id=request.decided_by_user_id,
        decided_at=request.decided_at,
        decision_reason=request.decision_reason,
        expires_at=request.expires_at,
        resulting_permission_id=request.resulting_permission_id,
        is_reviewer=viewer.id == owner.id,
    )


def _visible_request_rows(
    db: Session,
    viewer: User,
    *,
    request_id: uuid.UUID | None = None,
    for_update: bool = False,
):
    requester = aliased(User)
    owner = aliased(User)
    statement = (
        select(AccessRequest, Document, DocumentVersion, requester, owner)
        .join(Document, Document.id == AccessRequest.document_id)
        .outerjoin(
            DocumentVersion,
            (DocumentVersion.document_id == Document.id)
            & (DocumentVersion.id == Document.current_version_id),
        )
        .join(requester, requester.id == AccessRequest.requester_user_id)
        .join(owner, owner.id == Document.owner_user_id)
        .where(
            or_(AccessRequest.requester_user_id == viewer.id, Document.owner_user_id == viewer.id)
        )
    )
    if request_id is not None:
        statement = statement.where(AccessRequest.id == request_id)
    if for_update:
        statement = statement.with_for_update(of=AccessRequest, nowait=False)
    return db.execute(statement).all()


def _request_response_row(row, viewer: User) -> AccessRequestResponse:
    request, document, version, requester, owner = row
    return _response(request, document, version, requester, owner, viewer)


@router.post("", response_model=AccessRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_access_request(
    body: AccessRequestCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestResponse:
    document = db.get(Document, body.document_id)
    if document is None or document.status != "ACTIVE" or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.owner_user_id == user.id:
        raise HTTPException(status_code=409, detail="Owners do not need to request access to their own documents.")
    if body.expires_at is not None and body.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Requested access expiration must be in the future.")
    existing = db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id == user.id,
        )
    ).scalar_one_or_none()
    if existing is not None and existing.is_effective:
        requested = body.requested_permissions.model_dump()
        if (
            (not requested["can_view"] or existing.can_view)
            and (not requested["can_download"] or existing.can_download)
            and (not requested["can_edit"] or existing.can_edit)
        ):
            raise HTTPException(status_code=409, detail="You already have the requested access.")

    pending = db.execute(
        select(AccessRequest.id).where(
            AccessRequest.document_id == document.id,
            AccessRequest.requester_user_id == user.id,
            AccessRequest.status == "PENDING",
        )
    ).scalar_one_or_none()
    if pending is not None:
        raise HTTPException(status_code=409, detail="A pending request already exists for this document.")

    access_request = AccessRequest(
        document_id=document.id,
        requester_user_id=user.id,
        requested_permissions=body.requested_permissions.model_dump(),
        reason=body.reason,
        status="PENDING",
        expires_at=body.expires_at,
    )
    db.add(access_request)
    record_audit(
        db, request, actor_user_id=user.id,
        action_type="ACCESS_REQUEST_SUBMITTED", result="SUCCESS",
        document=document, target_user_id=document.owner_user_id,
        details={
            "access_request_id": str(access_request.id),
            "requested_permissions": access_request.requested_permissions,
            "previous_status": None,
            "new_status": "PENDING",
        },
    )
    add_notification(
        db,
        recipient_user_id=document.owner_user_id,
        actor_user_id=user.id,
        notification_type="ACCESS_REQUEST",
        title="Document access requested",
        message=f"{user.full_name} requested access to {document.title}.",
        preference_key="document_access_requests",
        document_id=document.id,
        metadata={"access_request_id": str(access_request.id)},
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A pending request already exists for this document.") from exc
    rows = _visible_request_rows(db, user, request_id=access_request.id)
    return _request_response_row(rows[0], user)


@router.get("", response_model=AccessRequestPageResponse)
async def list_access_requests(
    scope: Literal["all", "mine", "owned"] = "all",
    status_filter: Literal["PENDING", "APPROVED", "DENIED", "CANCELLED", "EXPIRED"] | None = Query(default=None, alias="status"),
    document_id: uuid.UUID | None = None,
    search: str | None = Query(default=None, max_length=120),
    requester_user_id: uuid.UUID | None = None,
    requested_after: datetime | None = None,
    requested_before: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestPageResponse:
    requester = aliased(User)
    base = (
        select(AccessRequest, Document, DocumentVersion, requester, User)
        .join(Document, Document.id == AccessRequest.document_id)
        .outerjoin(
            DocumentVersion,
            (DocumentVersion.document_id == Document.id)
            & (DocumentVersion.id == Document.current_version_id),
        )
        .join(requester, requester.id == AccessRequest.requester_user_id)
        .join(User, User.id == Document.owner_user_id)
    )
    scope_clause = (
        AccessRequest.requester_user_id == user.id
        if scope == "mine"
        else Document.owner_user_id == user.id
        if scope == "owned"
        else or_(AccessRequest.requester_user_id == user.id, Document.owner_user_id == user.id)
    )
    criteria = [scope_clause]
    if requested_after is not None and requested_after.tzinfo is None:
        raise HTTPException(status_code=422, detail="The start date must include a timezone.")
    if requested_before is not None and requested_before.tzinfo is None:
        raise HTTPException(status_code=422, detail="The end date must include a timezone.")
    if (
        requested_after is not None
        and requested_before is not None
        and requested_after > requested_before
    ):
        raise HTTPException(status_code=422, detail="The start date must not follow the end date.")
    if status_filter:
        criteria.append(AccessRequest.status == status_filter)
    if document_id:
        criteria.append(AccessRequest.document_id == document_id)
    if requester_user_id:
        criteria.append(AccessRequest.requester_user_id == requester_user_id)
    if requested_after:
        criteria.append(AccessRequest.requested_at >= requested_after)
    if requested_before:
        criteria.append(AccessRequest.requested_at <= requested_before)
    if search and search.strip():
        term = f"%{search.strip()}%"
        criteria.append(
            or_(
                Document.title.ilike(term),
                AccessRequest.reason.ilike(term),
                requester.full_name.ilike(term),
                requester.email.ilike(term),
            )
        )
    count_stmt = select(func.count()).select_from(AccessRequest).join(Document, Document.id == AccessRequest.document_id).join(requester, requester.id == AccessRequest.requester_user_id).where(*criteria)
    total = db.scalar(count_stmt) or 0
    rows = db.execute(
        base.where(*criteria)
        .order_by(AccessRequest.requested_at.desc(), AccessRequest.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return AccessRequestPageResponse(
        items=[_response(item, document, version, requested_by, owner, user) for item, document, version, requested_by, owner in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/summary", response_model=AccessRequestSummaryResponse)
async def access_request_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestSummaryResponse:
    pending_requests = db.scalar(
        select(func.count(AccessRequest.id))
        .join(Document, Document.id == AccessRequest.document_id)
        .where(
            Document.owner_user_id == user.id,
            AccessRequest.status == "PENDING",
        )
    ) or 0
    denied_requests = db.scalar(
        select(func.count(AccessRequest.id))
        .join(Document, Document.id == AccessRequest.document_id)
        .where(
            or_(
                AccessRequest.requester_user_id == user.id,
                Document.owner_user_id == user.id,
            ),
            AccessRequest.status == "DENIED",
        )
    ) or 0
    users_with_access = db.scalar(
        select(func.count(func.distinct(DocumentPermission.user_id)))
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(User, User.id == DocumentPermission.user_id)
        .where(
            Document.owner_user_id == user.id,
            DocumentPermission.user_id != user.id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > datetime.now(timezone.utc)),
            Document.status == "ACTIVE",
            Document.deleted_at.is_(None),
            User.account_status == AccountStatus.ACTIVE,
        )
    ) or 0
    return AccessRequestSummaryResponse(
        pending_requests=pending_requests,
        users_with_access=users_with_access,
        denied_requests=denied_requests,
    )


@router.get("/{request_id}", response_model=AccessRequestResponse)
async def get_access_request(
    request_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestResponse:
    rows = _visible_request_rows(db, user, request_id=request_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Access request not found.")
    return _request_response_row(rows[0], user)


async def _decide_access_request(
    request_id: uuid.UUID,
    decision: AccessRequestDecision,
    request: Request,
    user: User,
    db: Session,
    *,
    approve: bool,
) -> AccessRequestResponse:
    rows = _visible_request_rows(db, user, request_id=request_id, for_update=True)
    if not rows:
        raise HTTPException(status_code=404, detail="Access request not found.")
    access_request, document, version, requester, owner = rows[0]
    if owner.id != user.id:
        raise HTTPException(status_code=404, detail="Access request not found.")
    if document.status != "ACTIVE" or document.deleted_at is not None:
        raise HTTPException(status_code=409, detail="This document is no longer available for access decisions.")
    if access_request.status != "PENDING":
        raise HTTPException(status_code=409, detail="This access request has already been decided.")
    now = datetime.now(timezone.utc)
    if approve and access_request.expires_at is not None and access_request.expires_at <= now:
        raise HTTPException(status_code=409, detail="The requested access period has expired.")
    if approve and requester.account_status != AccountStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Access cannot be granted to an inactive account.")

    permissions = access_request.requested_permissions
    if approve:
        grant = db.execute(
            select(DocumentPermission)
            .where(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == requester.id,
            )
            .with_for_update()
        ).scalar_one_or_none()
        if grant is None:
            grant = DocumentPermission(
                document_id=document.id,
                user_id=requester.id,
                can_view=bool(permissions.get("can_view")),
                can_download=bool(permissions.get("can_download")),
                can_edit=bool(permissions.get("can_edit")),
                granted_by_user_id=user.id,
                granted_at=now,
                expires_at=access_request.expires_at,
            )
            db.add(grant)
        else:
            grant.can_view = bool(permissions.get("can_view"))
            grant.can_download = bool(permissions.get("can_download"))
            grant.can_edit = bool(permissions.get("can_edit"))
            grant.granted_by_user_id = user.id
            grant.granted_at = now
            grant.expires_at = access_request.expires_at
            grant.revoked_at = None
            grant.revoked_by_user_id = None
            grant.updated_at = now
        db.flush()
        access_request.status = "APPROVED"
        access_request.resulting_permission_id = grant.id
        action_type = "ACCESS_REQUEST_APPROVED"
        notification_type = "ACCESS_REQUEST_APPROVED"
        title = "Document access approved"
        message = f"Your request for {document.title} was approved."
    else:
        grant = None
        access_request.status = "DENIED"
        action_type = "ACCESS_REQUEST_DENIED"
        notification_type = "ACCESS_REQUEST_DENIED"
        title = "Document access declined"
        message = f"Your request for {document.title} was declined."

    access_request.decided_by_user_id = user.id
    access_request.decided_at = now
    access_request.decision_reason = decision.decision_reason
    access_request.updated_at = now
    record_audit(
        db, request, actor_user_id=user.id, action_type=action_type,
        result="SUCCESS", document=document, target_user_id=requester.id,
        details={
            "access_request_id": str(access_request.id),
            "permission_id": str(grant.id) if grant else None,
            "requested_permissions": access_request.requested_permissions,
            "previous_status": "PENDING",
            "new_status": access_request.status,
            "decision_reason": decision.decision_reason,
        },
    )
    if grant is not None:
        record_audit(
            db, request, actor_user_id=user.id, action_type="PERMISSION_GRANTED",
            result="SUCCESS", document=document, target_user_id=requester.id,
            details={
                "permission_id": str(grant.id),
                "access_request_id": str(access_request.id),
                "can_view": grant.can_view,
                "can_download": grant.can_download,
                "can_edit": grant.can_edit,
                "expires_at": grant.expires_at.isoformat() if grant.expires_at else None,
            },
        )
    add_notification(
        db,
        recipient_user_id=requester.id,
        actor_user_id=user.id,
        notification_type=notification_type,
        title=title,
        message=message,
        preference_key="access_request_decisions",
        document_id=document.id,
        metadata={"access_request_id": str(access_request.id)},
    )
    db.commit()
    return _response(access_request, document, version, requester, owner, user)


@router.post("/{request_id}/approve", response_model=AccessRequestResponse)
async def approve_access_request(
    request_id: uuid.UUID,
    body: AccessRequestDecision,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestResponse:
    return await _decide_access_request(request_id, body, request, user, db, approve=True)


@router.post("/{request_id}/deny", response_model=AccessRequestResponse)
async def deny_access_request(
    request_id: uuid.UUID,
    body: AccessRequestDecision,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestResponse:
    return await _decide_access_request(request_id, body, request, user, db, approve=False)


@router.delete("/{request_id}", response_model=AccessRequestResponse)
async def cancel_access_request(
    request_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequestResponse:
    rows = _visible_request_rows(db, user, request_id=request_id, for_update=True)
    if not rows:
        raise HTTPException(status_code=404, detail="Access request not found.")
    access_request, document, version, requester, owner = rows[0]
    if requester.id != user.id or access_request.status != "PENDING":
        raise HTTPException(status_code=404, detail="Access request not found.")
    now = datetime.now(timezone.utc)
    access_request.status = "CANCELLED"
    access_request.decided_by_user_id = user.id
    access_request.decided_at = now
    access_request.updated_at = now
    record_audit(
        db, request, actor_user_id=user.id, action_type="ACCESS_REQUEST_CANCELLED",
        result="SUCCESS", document=document, target_user_id=owner.id,
        details={
            "access_request_id": str(access_request.id),
            "previous_status": "PENDING",
            "new_status": "CANCELLED",
        },
    )
    db.commit()
    return _response(access_request, document, version, requester, owner, user)
