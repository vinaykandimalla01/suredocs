"""Administrator views, analytics, and controls for document permission records."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import String, and_, case, func, or_, select
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.config import S3_BUCKET
from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion
from app.models.user import AccountStatus, User
from app.schemas.admin_permissions import (
    AnalyticsSummaryResponse,
    CurrentPermissionOverview,
    DistributionItem,
    DistributionResponse,
    DocumentPermissionRecord,
    DocumentVersionItem,
    EligibleUserOption,
    GrantPermissionRequest,
    PermissionAuditEvent,
    PermissionDocumentDetails,
    PermissionDocumentMetadata,
    PermissionDocumentOwner,
    PermissionFilterOption,
    PermissionRecord,
    PermissionRecordsPage,
    PermissionSummary,
    RevokePermissionRequest,
    TopDocumentItem,
    TrendPoint,
)
from app.services.document_access import record_audit, utc_now
from app.services.notifications import add_notification

router = APIRouter(prefix="/api/admin/permissions", tags=["admin-permissions"])


def _permission_status(
    permission: DocumentPermission,
    document: Document,
    recipient: User,
    now: datetime,
) -> str:
    if permission.revoked_at is not None:
        return "Revoked"
    if permission.expires_at is not None and permission.expires_at <= now:
        return "Expired"
    if (
        document.status != "ACTIVE"
        or document.deleted_at is not None
        or recipient.account_status != AccountStatus.ACTIVE
        or not (permission.can_view or permission.can_download or permission.can_edit)
    ):
        return "Unavailable"
    return "Active"


def _permission_type(can_view: bool, can_download: bool, can_edit: bool = False) -> str:
    if can_edit and can_download:
        return "Read + Download + Edit"
    if can_edit:
        return "Edit"
    if can_download:
        return "Read + Download"
    if can_view:
        return "Read"
    return "Not recorded"


def _active_grant_conditions(now: datetime, recipient: User) -> list:
    """Keep summary and table Active status aligned with document access rules."""
    return [
        DocumentPermission.revoked_at.is_(None),
        or_(DocumentPermission.expires_at.is_(None), DocumentPermission.expires_at > now),
        Document.status == "ACTIVE",
        Document.deleted_at.is_(None),
        recipient.account_status == AccountStatus.ACTIVE,
        or_(
            DocumentPermission.can_view.is_(True),
            DocumentPermission.can_download.is_(True),
            DocumentPermission.can_edit.is_(True),
        ),
    ]


_SENSITIVE_AUDIT_FIELDS = {
    "authorization", "password", "password_hash", "token", "access_token",
    "refresh_token", "secret", "credentials", "storage_key", "storage_bucket",
    "object_key", "presigned_url", "s3_url", "document_bytes", "file_content",
}


def _safe_audit_details(value: Any) -> Any:
    """Keep structured event context readable without exposing secrets or object paths."""
    if isinstance(value, dict):
        return {
            key: _safe_audit_details(item)
            for key, item in value.items()
            if key.lower().replace("-", "_") not in _SENSITIVE_AUDIT_FIELDS
        }
    if isinstance(value, list):
        return [_safe_audit_details(item) for item in value]
    return value


def _resolve_date_boundaries(
    range_str: str | None,
    start_date: date | None,
    end_date: date | None,
    now: datetime,
) -> tuple[datetime | None, datetime, datetime | None, datetime | None]:
    """Returns (period_start, period_end, prev_period_start, prev_period_end)."""
    end_dt = now
    if end_date:
        end_dt = datetime.combine(end_date, time.max, timezone.utc)

    if start_date:
        start_dt = datetime.combine(start_date, time.min, timezone.utc)
        duration = end_dt - start_dt
        prev_start = start_dt - duration
        prev_end = start_dt
        return start_dt, end_dt, prev_start, prev_end

    days = 30
    if range_str == "7d":
        days = 7
    elif range_str == "90d":
        days = 90
    elif range_str == "365d":
        days = 365
    elif range_str == "all":
        return None, end_dt, None, None

    start_dt = end_dt - timedelta(days=days)
    prev_start = start_dt - timedelta(days=days)
    prev_end = start_dt
    return start_dt, end_dt, prev_start, prev_end


def _calc_change(current: int, previous: int) -> float | None:
    if previous <= 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_permissions_summary(
    range: str | None = Query(default="30d"),
    start_date: date | None = None,
    end_date: date | None = None,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return comprehensive summary metrics for KPI cards with period comparisons."""
    now = utc_now()
    start_dt, end_dt, prev_start, prev_end = _resolve_date_boundaries(range, start_date, end_date, now)

    recipient = aliased(User)

    def count_period(p_start: datetime | None, p_end: datetime | None):
        date_cond = []
        if p_start:
            date_cond.append(DocumentPermission.granted_at >= p_start)
        if p_end:
            date_cond.append(DocumentPermission.granted_at <= p_end)

        active_conds = _active_grant_conditions(now, recipient)

        stmt = select(
            func.count(DocumentPermission.id).label("total_grants"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("read_grants"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ).label("download_grants"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_edit.is_(True),
            ).label("edit_grants"),
            # Active
            func.count(DocumentPermission.id).filter(*active_conds).label("active_grants"),
            func.count(DocumentPermission.id).filter(
                *active_conds,
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("active_read"),
            func.count(DocumentPermission.id).filter(
                *active_conds,
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ).label("active_download"),
            func.count(DocumentPermission.id).filter(
                *active_conds,
                DocumentPermission.can_edit.is_(True),
            ).label("active_edit"),
            # Expired
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
            ).label("expired_grants"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("expired_read"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ).label("expired_download"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
                DocumentPermission.can_edit.is_(True),
            ).label("expired_edit"),
            # Revoked
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_not(None),
            ).label("revoked_grants"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_not(None),
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("revoked_read"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_not(None),
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ).label("revoked_download"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_not(None),
                DocumentPermission.can_edit.is_(True),
            ).label("revoked_edit"),
        ).select_from(DocumentPermission).join(
            Document, Document.id == DocumentPermission.document_id
        ).join(
            recipient, recipient.id == DocumentPermission.user_id
        )
        if date_cond:
            stmt = stmt.where(*date_cond)
        return db.execute(stmt).mappings().one()

    curr = count_period(start_dt, end_dt)
    prev = count_period(prev_start, prev_end) if prev_start else None

    total_g = curr["total_grants"]
    read_g = curr["read_grants"]
    dl_g = curr["download_grants"]
    edit_g = curr["edit_grants"]

    act_g = curr["active_grants"]
    act_read = curr["active_read"]
    act_dl = curr["active_download"]
    act_edit = curr["active_edit"]

    exp_g = curr["expired_grants"]
    exp_read = curr["expired_read"]
    exp_dl = curr["expired_download"]
    exp_edit = curr["expired_edit"]

    rev_g = curr["revoked_grants"]
    rev_read = curr["revoked_read"]
    rev_dl = curr["revoked_download"]
    rev_edit = curr["revoked_edit"]

    def pct(val: int, denom: int) -> float:
        return round((val / denom * 100), 1) if denom > 0 else 0.0

    return {
        "total_grants": total_g,
        "total_change_pct": _calc_change(total_g, prev["total_grants"]) if prev else None,
        "read_grants": read_g,
        "read_pct": pct(read_g, total_g),
        "read_change_pct": _calc_change(read_g, prev["read_grants"]) if prev else None,
        "download_grants": dl_g,
        "download_pct": pct(dl_g, total_g),
        "download_change_pct": _calc_change(dl_g, prev["download_grants"]) if prev else None,
        "edit_grants": edit_g,
        "edit_pct": pct(edit_g, total_g),
        "edit_change_pct": _calc_change(edit_g, prev["edit_grants"]) if prev else None,

        "active_grants": act_g,
        "active_change_pct": _calc_change(act_g, prev["active_grants"]) if prev else None,
        "active_read": act_read,
        "active_read_pct": pct(act_read, act_g),
        "active_read_change_pct": _calc_change(act_read, prev["active_read"]) if prev else None,
        "active_download": act_dl,
        "active_download_pct": pct(act_dl, act_g),
        "active_download_change_pct": _calc_change(act_dl, prev["active_download"]) if prev else None,
        "active_edit": act_edit,
        "active_edit_pct": pct(act_edit, act_g),
        "active_edit_change_pct": _calc_change(act_edit, prev["active_edit"]) if prev else None,

        "expired_grants": exp_g,
        "expired_change_pct": _calc_change(exp_g, prev["expired_grants"]) if prev else None,
        "expired_read": exp_read,
        "expired_read_pct": pct(exp_read, exp_g),
        "expired_read_change_pct": _calc_change(exp_read, prev["expired_read"]) if prev else None,
        "expired_download": exp_dl,
        "expired_download_pct": pct(exp_dl, exp_g),
        "expired_download_change_pct": _calc_change(exp_dl, prev["expired_download"]) if prev else None,
        "expired_edit": exp_edit,
        "expired_edit_pct": pct(exp_edit, exp_g),
        "expired_edit_change_pct": _calc_change(exp_edit, prev["expired_edit"]) if prev else None,

        "revoked_grants": rev_g,
        "revoked_change_pct": _calc_change(rev_g, prev["revoked_grants"]) if prev else None,
        "revoked_read": rev_read,
        "revoked_read_pct": pct(rev_read, rev_g),
        "revoked_read_change_pct": _calc_change(rev_read, prev["revoked_read"]) if prev else None,
        "revoked_download": rev_dl,
        "revoked_download_pct": pct(rev_dl, rev_g),
        "revoked_download_change_pct": _calc_change(rev_dl, prev["revoked_download"]) if prev else None,
        "revoked_edit": rev_edit,
        "revoked_edit_pct": pct(rev_edit, rev_g),
        "revoked_edit_change_pct": _calc_change(rev_edit, prev["revoked_edit"]) if prev else None,
    }


@router.get("/trends", response_model=list[TrendPoint])
async def get_permissions_trends(
    range: str | None = Query(default="30d"),
    status: str | None = Query(default="all"),
    start_date: date | None = None,
    end_date: date | None = None,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return time-series trend points for permission creations, active, expired, or revoked."""
    now = utc_now()
    start_dt, end_dt, _, _ = _resolve_date_boundaries(range, start_date, end_date, now)
    if not start_dt:
        start_dt = end_dt - timedelta(days=30)

    recipient = aliased(User)
    date_col = DocumentPermission.granted_at
    if status == "expired":
        date_col = DocumentPermission.expires_at
    elif status == "revoked":
        date_col = DocumentPermission.revoked_at

    filters = [date_col >= start_dt, date_col <= end_dt]

    if status == "active":
        filters.extend(_active_grant_conditions(now, recipient))
    elif status == "expired":
        filters.extend([
            DocumentPermission.revoked_at.is_(None),
            DocumentPermission.expires_at.is_not(None),
            DocumentPermission.expires_at <= now,
        ])
    elif status == "revoked":
        filters.append(DocumentPermission.revoked_at.is_not(None))

    day_trunc = func.date_trunc("day", date_col)
    rows = db.execute(
        select(
            day_trunc.label("day"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("read"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ).label("download"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_edit.is_(True),
            ).label("edit"),
            func.count(DocumentPermission.id).label("total"),
        )
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .where(*filters)
        .group_by(day_trunc)
        .order_by(day_trunc)
    ).all()

    points_by_day = {
        row.day.strftime("%Y-%m-%d"): {
            "date": row.day.strftime("%b %d"),
            "full_date": row.day.strftime("%Y-%m-%d"),
            "read": row.read,
            "download": row.download,
            "edit": row.edit,
            "total": row.total,
        }
        for row in rows
    }

    # Generate continuous points across the range for clean chart curves
    all_points = []
    days_count = max(1, (end_dt.date() - start_dt.date()).days)
    step = max(1, days_count // 30)
    curr = start_dt.date()
    while curr <= end_dt.date():
        key = curr.strftime("%Y-%m-%d")
        if key in points_by_day:
            all_points.append(points_by_day[key])
        else:
            all_points.append({
                "date": curr.strftime("%b %d"),
                "full_date": key,
                "read": 0,
                "download": 0,
                "edit": 0,
                "total": 0,
            })
        curr += timedelta(days=step)

    return all_points


@router.get("/distribution", response_model=DistributionResponse)
async def get_permissions_distribution(
    range: str | None = Query(default="30d"),
    status: str | None = Query(default="all"),
    start_date: date | None = None,
    end_date: date | None = None,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return breakdown by type (Read, Download, Edit) for donut charts."""
    now = utc_now()
    start_dt, end_dt, _, _ = _resolve_date_boundaries(range, start_date, end_date, now)

    recipient = aliased(User)
    date_col = DocumentPermission.granted_at
    if status == "expired":
        date_col = DocumentPermission.expires_at
    elif status == "revoked":
        date_col = DocumentPermission.revoked_at

    filters = []
    if start_dt:
        filters.append(date_col >= start_dt)
    if end_dt:
        filters.append(date_col <= end_dt)

    if status == "active":
        filters.extend(_active_grant_conditions(now, recipient))
    elif status == "expired":
        filters.extend([
            DocumentPermission.revoked_at.is_(None),
            DocumentPermission.expires_at.is_not(None),
            DocumentPermission.expires_at <= now,
        ])
    elif status == "revoked":
        filters.append(DocumentPermission.revoked_at.is_not(None))

    row = db.execute(
        select(
            func.count(DocumentPermission.id).label("total"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("read"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ).label("download"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.can_edit.is_(True),
            ).label("edit"),
        )
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .where(*filters)
    ).mappings().one()

    total = row["total"]
    read_c = row["read"]
    dl_c = row["download"]
    edit_c = row["edit"]

    def pct(val: int) -> float:
        return round((val / total * 100), 1) if total > 0 else 0.0

    return {
        "total": total,
        "types": [
            {"type": "Read", "count": read_c, "percentage": pct(read_c), "color": "#1769F5"},
            {"type": "Download", "count": dl_c, "percentage": pct(dl_c), "color": "#8B5CF6"},
            {"type": "Edit", "count": edit_c, "percentage": pct(edit_c), "color": "#F97316"},
        ],
    }


@router.get("/top-documents", response_model=list[TopDocumentItem])
async def get_top_documents_by_grants(
    range: str | None = Query(default="30d"),
    limit: int = Query(default=5, ge=1, le=20),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return top documents ranked by number of permission grants."""
    now = utc_now()
    start_dt, end_dt, _, _ = _resolve_date_boundaries(range, None, None, now)

    filters = [Document.status == "ACTIVE", Document.deleted_at.is_(None)]
    if start_dt:
        filters.append(DocumentPermission.granted_at >= start_dt)
    if end_dt:
        filters.append(DocumentPermission.granted_at <= end_dt)

    rows = db.execute(
        select(
            Document.id,
            Document.title,
            DocumentVersion.file_extension,
            func.count(DocumentPermission.id).label("grant_count"),
        )
        .join(DocumentPermission, DocumentPermission.document_id == Document.id)
        .outerjoin(DocumentVersion, DocumentVersion.id == Document.current_version_id)
        .where(*filters)
        .group_by(Document.id, Document.title, DocumentVersion.file_extension)
        .order_by(func.count(DocumentPermission.id).desc(), Document.title)
        .limit(limit)
    ).all()

    if not rows:
        return []

    max_count = rows[0].grant_count if rows else 1
    return [
        {
            "id": row.id,
            "title": row.title,
            "file_extension": row.file_extension,
            "grant_count": row.grant_count,
            "percentage": round((row.grant_count / max_count * 100), 1) if max_count else 0.0,
        }
        for row in rows
    ]


@router.get("/records", response_model=PermissionRecordsPage)
async def list_admin_permission_records(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=150),
    document_id: str | None = Query(default=None),
    owner_id: uuid.UUID | None = None,
    user_id: str | None = Query(default=None),
    permission_type: str | None = Query(default=None, max_length=30),
    status: str | None = Query(default=None, max_length=20),
    permission_status: str | None = Query(default=None, max_length=20),
    sort_by: str | None = Query(default=None),
    sort_order: str | None = Query(default=None),
    range: str | None = Query(default=None),
    grant_from: date | None = None,
    grant_to: date | None = None,
    expires_from: date | None = None,
    expires_to: date | None = None,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return real grant rows with flexible filtering, sorting, and pagination."""
    now = utc_now()
    owner = aliased(User)
    recipient = aliased(User)
    grantor = aliased(User)
    revoker = aliased(User)

    effective_status = status or permission_status

    statement = (
        select(DocumentPermission, Document, owner, recipient, grantor, revoker)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(owner, owner.id == Document.owner_user_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .outerjoin(revoker, revoker.id == DocumentPermission.revoked_by_user_id)
        .options(joinedload(Document.current_version))
    )

    filters = []

    if document_id and document_id != "all":
        try:
            filters.append(Document.id == uuid.UUID(document_id))
        except ValueError:
            pass

    if owner_id is not None:
        filters.append(Document.owner_user_id == owner_id)

    if user_id and user_id != "all":
        try:
            filters.append(DocumentPermission.user_id == uuid.UUID(user_id))
        except ValueError:
            pass

    if permission_type and permission_type != "all":
        normalized_type = " ".join(permission_type.strip().lower().split())
        if normalized_type == "read":
            filters.extend([
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ])
        elif normalized_type in {"download", "read + download", "read_download"}:
            filters.extend([
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(False),
            ])
        elif normalized_type == "edit":
            filters.extend([
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(True),
            ])
        elif normalized_type in {"read + download + edit", "edit + download", "read_download_edit"}:
            filters.extend([
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(True),
                DocumentPermission.can_edit.is_(True),
            ])

    if effective_status and effective_status != "all":
        normalized_status = effective_status.strip().lower()
        if normalized_status == "active":
            filters.extend(_active_grant_conditions(now, recipient))
        elif normalized_status == "expired":
            filters.extend([
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
            ])
        elif normalized_status == "revoked":
            filters.append(DocumentPermission.revoked_at.is_not(None))

    if range and range != "all":
        start_dt, end_dt, _, _ = _resolve_date_boundaries(range, None, None, now)
        if start_dt:
            date_field = DocumentPermission.granted_at
            if effective_status == "expired":
                date_field = DocumentPermission.expires_at
            elif effective_status == "revoked":
                date_field = DocumentPermission.revoked_at
            filters.append(date_field >= start_dt)

    if grant_from is not None:
        filters.append(DocumentPermission.granted_at >= datetime.combine(grant_from, time.min, timezone.utc))
    if grant_to is not None:
        filters.append(DocumentPermission.granted_at <= datetime.combine(grant_to, time.max, timezone.utc))
    if expires_from is not None:
        filters.append(DocumentPermission.expires_at >= datetime.combine(expires_from, time.min, timezone.utc))
    if expires_to is not None:
        filters.append(DocumentPermission.expires_at <= datetime.combine(expires_to, time.max, timezone.utc))

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

    # Determine sorting
    order_clauses = [DocumentPermission.granted_at.desc(), DocumentPermission.id]
    if sort_by == "newest":
        order_clauses = [DocumentPermission.granted_at.desc(), DocumentPermission.id]
    elif sort_by == "oldest":
        order_clauses = [DocumentPermission.granted_at.asc(), DocumentPermission.id]
    elif sort_by in {"expired_date", "expired"}:
        order_clauses = [DocumentPermission.expires_at.desc().nullslast(), DocumentPermission.id]
    elif sort_by in {"revoked_date", "revoked"}:
        order_clauses = [DocumentPermission.revoked_at.desc().nullslast(), DocumentPermission.id]
    elif sort_by == "days_left":
        order_clauses = [DocumentPermission.expires_at.asc().nullslast(), DocumentPermission.id]
    elif sort_by == "title":
        order_clauses = [Document.title.asc(), DocumentPermission.id]
    elif sort_by == "user":
        order_clauses = [recipient.full_name.asc(), DocumentPermission.id]

    if sort_order == "asc" and sort_by not in {"oldest", "title", "user"}:
        order_clauses = [clause.asc() if hasattr(clause, "asc") else clause for clause in order_clauses]
    elif sort_order == "desc" and sort_by in {"oldest", "title", "user"}:
        order_clauses = [clause.desc() if hasattr(clause, "desc") else clause for clause in order_clauses]

    rows = db.execute(
        statement.where(*filters)
        .order_by(*order_clauses)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    # Calculate global summary totals
    active_conds = _active_grant_conditions(now, recipient)
    totals = db.execute(
        select(
            func.count(DocumentPermission.id).label("total_grants"),
            func.count(DocumentPermission.id).filter(*active_conds).label("active_grants"),
            func.count(DocumentPermission.id).filter(
                *active_conds,
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
            ).label("read_permissions"),
            func.count(DocumentPermission.id).filter(
                *active_conds, DocumentPermission.can_download.is_(True), DocumentPermission.can_edit.is_(False)
            ).label("download_permissions"),
            func.count(DocumentPermission.id).filter(
                *active_conds, DocumentPermission.can_edit.is_(True)
            ).label("edit_permissions"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
            ).label("expired_grants"),
            func.count(DocumentPermission.id).filter(
                DocumentPermission.revoked_at.is_not(None)
            ).label("revoked_grants"),
        )
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
    ).mappings().one()

    # Get sample owners, documents and users for filter dropdowns
    owner_options = db.execute(
        select(owner.id, owner.full_name)
        .join(Document, Document.owner_user_id == owner.id)
        .join(DocumentPermission, DocumentPermission.document_id == Document.id)
        .distinct()
        .order_by(owner.full_name)
    ).all()

    doc_options = db.execute(
        select(Document.id, Document.title)
        .join(DocumentPermission, DocumentPermission.document_id == Document.id)
        .distinct()
        .order_by(Document.title)
        .limit(50)
    ).all()

    user_options = db.execute(
        select(recipient.id, recipient.full_name)
        .join(DocumentPermission, DocumentPermission.user_id == recipient.id)
        .distinct()
        .order_by(recipient.full_name)
    ).all()

    items = []
    for permission, doc, doc_owner, user, granted_by, revoking_user in rows:
        version = doc.current_version
        stat = _permission_status(permission, doc, user, now)

        days_left = None
        expired_since = None
        if permission.expires_at:
            if permission.expires_at > now:
                days_left = max(0, (permission.expires_at.date() - now.date()).days)
            else:
                expired_since = max(0, (now.date() - permission.expires_at.date()).days)

        items.append({
            "id": permission.id,
            "document_id": doc.id,
            "document_title": doc.title,
            "document_filename": version.original_filename if version else None,
            "file_extension": version.file_extension if version else None,
            "file_size_bytes": version.size_bytes if version else None,
            "content_type": version.content_type if version else None,
            "category": doc.category,
            "document_status": doc.status,
            "owner_id": doc_owner.id,
            "owner_name": doc_owner.full_name,
            "owner_email": doc_owner.email,
            "user_id": user.id,
            "user_name": user.full_name,
            "user_email": user.email,
            "user_department": user.department,
            "permission_type": _permission_type(permission.can_view, permission.can_download, permission.can_edit),
            "can_view": permission.can_view,
            "can_download": permission.can_download,
            "can_edit": permission.can_edit,
            "granted_by_name": granted_by.full_name,
            "granted_by_email": granted_by.email,
            "granted_at": permission.granted_at,
            "expires_at": permission.expires_at,
            "days_left": days_left,
            "expired_since": expired_since,
            "status": stat,
            "revoked_at": permission.revoked_at,
            "revoked_by_name": revoking_user.full_name if revoking_user else None,
            "revocation_reason": permission.revocation_reason,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": {key: totals[key] for key in totals.keys()},
        "owners": [{"id": row.id, "name": row.full_name} for row in owner_options],
        "users": [{"id": row.id, "name": row.full_name} for row in user_options],
        "documents": [{"id": row.id, "name": row.title} for row in doc_options],
    }


@router.get("/export")
async def export_permissions_csv(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    document_id: str | None = Query(default=None),
    permission_type: str | None = Query(default=None),
    range: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Stream real database records as an authorized CSV export."""
    now = utc_now()
    owner = aliased(User)
    recipient = aliased(User)
    grantor = aliased(User)
    revoker = aliased(User)

    statement = (
        select(DocumentPermission, Document, owner, recipient, grantor, revoker)
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(owner, owner.id == Document.owner_user_id)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .outerjoin(revoker, revoker.id == DocumentPermission.revoked_by_user_id)
        .options(joinedload(Document.current_version))
    )

    filters = []
    if document_id and document_id != "all":
        try:
            filters.append(Document.id == uuid.UUID(document_id))
        except ValueError:
            pass

    if permission_type and permission_type != "all":
        norm_type = permission_type.strip().lower()
        if norm_type == "read":
            filters.extend([DocumentPermission.can_view.is_(True), DocumentPermission.can_download.is_(False), DocumentPermission.can_edit.is_(False)])
        elif norm_type in {"download", "read + download"}:
            filters.extend([DocumentPermission.can_view.is_(True), DocumentPermission.can_download.is_(True), DocumentPermission.can_edit.is_(False)])
        elif norm_type == "edit":
            filters.extend([DocumentPermission.can_view.is_(True), DocumentPermission.can_edit.is_(True)])

    if status and status != "all":
        norm_status = status.strip().lower()
        if norm_status == "active":
            filters.extend(_active_grant_conditions(now, recipient))
        elif norm_status == "expired":
            filters.extend([
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_not(None),
                DocumentPermission.expires_at <= now,
            ])
        elif norm_status == "revoked":
            filters.append(DocumentPermission.revoked_at.is_not(None))

    if range and range != "all":
        start_dt, end_dt, _, _ = _resolve_date_boundaries(range, None, None, now)
        if start_dt:
            filters.append(DocumentPermission.granted_at >= start_dt)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(
            Document.title.ilike(pattern),
            recipient.full_name.ilike(pattern),
            recipient.email.ilike(pattern),
        ))

    # Fetch up to 10,000 records for the export
    rows = db.execute(
        statement.where(*filters)
        .order_by(DocumentPermission.granted_at.desc())
        .limit(10000)
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Grant ID",
        "Document Name",
        "Document ID",
        "Grantee Name",
        "Grantee Email",
        "Grantee Department",
        "Permission Type",
        "Granted By",
        "Granted At (UTC)",
        "Expires At (UTC)",
        "Status",
        "Days Left",
        "Expired Since (Days)",
        "Revoked At (UTC)",
        "Revoked By",
        "Revocation Reason",
    ])

    for permission, doc, doc_owner, user, granted_by, revoking_user in rows:
        stat = _permission_status(permission, doc, user, now)
        days_left = ""
        expired_since = ""
        if permission.expires_at:
            if permission.expires_at > now:
                days_left = str((permission.expires_at.date() - now.date()).days)
            else:
                expired_since = str((now.date() - permission.expires_at.date()).days)

        writer.writerow([
            str(permission.id),
            doc.title,
            str(doc.id),
            user.full_name,
            user.email,
            user.department or "",
            _permission_type(permission.can_view, permission.can_download, permission.can_edit),
            granted_by.full_name,
            permission.granted_at.strftime("%Y-%m-%d %H:%M:%S") if permission.granted_at else "",
            permission.expires_at.strftime("%Y-%m-%d %H:%M:%S") if permission.expires_at else "",
            stat,
            days_left,
            expired_since,
            permission.revoked_at.strftime("%Y-%m-%d %H:%M:%S") if permission.revoked_at else "",
            revoking_user.full_name if revoking_user else "",
            permission.revocation_reason or "",
        ])

    output.seek(0)
    filename = f"suredocs_permissions_{status or 'all'}_{now.strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/documents/{document_id}", response_model=PermissionDocumentDetails)
async def get_admin_document_permission_details(
    document_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return admin-visible metadata, every grant, and recorded audit events."""
    document = db.execute(
        select(Document)
        .options(joinedload(Document.owner), joinedload(Document.current_version), joinedload(Document.versions))
        .where(Document.id == document_id)
    ).unique().scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    owner = document.owner
    version = document.current_version
    recipient = aliased(User)
    grantor = aliased(User)
    revoker = aliased(User)

    permission_rows = db.execute(
        select(DocumentPermission, recipient, grantor, revoker)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .outerjoin(revoker, revoker.id == DocumentPermission.revoked_by_user_id)
        .where(DocumentPermission.document_id == document.id)
        .order_by(DocumentPermission.granted_at.desc(), DocumentPermission.id)
    ).all()

    now = utc_now()
    grants = []
    read_cnt = 0
    download_cnt = 0
    edit_cnt = 0

    for permission, user, granting_user, revoking_user in permission_rows:
        stat = _permission_status(permission, document, user, now)
        days_rem = None
        if permission.expires_at and permission.expires_at > now:
            days_rem = max(0, (permission.expires_at.date() - now.date()).days)

        if stat == "Active":
            if permission.can_edit:
                edit_cnt += 1
            if permission.can_download:
                download_cnt += 1
            if permission.can_view:
                read_cnt += 1

        grants.append({
            "id": permission.id,
            "user_id": user.id,
            "user_name": user.full_name,
            "user_email": user.email,
            "user_department": user.department,
            "can_view": permission.can_view,
            "can_download": permission.can_download,
            "can_edit": permission.can_edit,
            "permission_type": _permission_type(permission.can_view, permission.can_download, permission.can_edit),
            "granted_by_user_id": granting_user.id,
            "granted_by_name": granting_user.full_name,
            "granted_by_email": granting_user.email,
            "granted_at": permission.granted_at,
            "expires_at": permission.expires_at,
            "days_remaining": days_rem,
            "revoked_at": permission.revoked_at,
            "revoked_by_user_id": permission.revoked_by_user_id,
            "revoked_by_name": revoking_user.full_name if revoking_user else None,
            "revocation_reason": permission.revocation_reason,
            "status": stat,
        })

    actor = aliased(User)
    target = aliased(User)
    audit_rows = db.execute(
        select(DocumentAuditLog, actor, target)
        .outerjoin(actor, actor.id == DocumentAuditLog.actor_user_id)
        .outerjoin(target, target.id == DocumentAuditLog.target_user_id)
        .where(DocumentAuditLog.document_id_snapshot == document.id)
        .order_by(DocumentAuditLog.occurred_at.desc(), DocumentAuditLog.id.desc())
        .limit(100)
    ).all()

    audit = [{
        "id": event.id,
        "actor_user_id": event.actor_user_id_snapshot or event.actor_user_id,
        "actor_name": event.actor_name_snapshot or (event_actor.full_name if event_actor else None),
        "actor_email": event.actor_email_snapshot or (event_actor.email if event_actor else None),
        "target_user_id": event.target_user_id_snapshot or event.target_user_id,
        "target_name": event.target_name_snapshot or (event_target.full_name if event_target else None),
        "target_email": event.target_email_snapshot or (event_target.email if event_target else None),
        "action_type": event.action_type,
        "result": event.result,
        "occurred_at": event.occurred_at,
        "ip_address": event.ip_address,
        "details": _safe_audit_details(event.details),
    } for event, event_actor, event_target in audit_rows]

    # Versions
    versions = [
        {
            "id": ver.id,
            "version_number": ver.version_number,
            "original_filename": ver.original_filename,
            "file_extension": ver.file_extension,
            "size_bytes": ver.size_bytes,
            "uploaded_at": ver.uploaded_at,
            "status": ver.status,
        }
        for ver in sorted(document.versions, key=lambda v: v.version_number, reverse=True)
    ]

    return {
        "document": {
            "id": document.id,
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
            "storage_location": f"S3 / {S3_BUCKET}/documents",
            "owner": {
                "id": owner.id,
                "full_name": owner.full_name,
                "email": owner.email,
                "role": owner.role.value if hasattr(owner.role, "value") else str(owner.role),
                "department": owner.department,
                "job_title": owner.job_title,
                "account_status": owner.account_status.value if hasattr(owner.account_status, "value") else str(owner.account_status),
                "created_at": owner.created_at,
            },
        },
        "permissions": grants,
        "audit": audit,
        "versions": versions,
        "overview": {
            "read_count": read_cnt,
            "download_count": download_cnt,
            "edit_count": edit_cnt,
        },
    }


@router.get("/documents/{document_id}/eligible-users", response_model=list[EligibleUserOption])
async def get_eligible_users_for_grant(
    document_id: uuid.UUID,
    search: str | None = Query(default=None, max_length=150),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return active users eligible to receive permissions on this document."""
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    query = select(User).where(
        User.account_status == AccountStatus.ACTIVE,
        User.id != doc.owner_user_id,
    )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.where(or_(
            User.full_name.ilike(pattern),
            User.email.ilike(pattern),
        ))

    users = db.execute(query.order_by(User.full_name).limit(30)).scalars().all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "department": u.department,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        }
        for u in users
    ]


@router.post("/documents/{document_id}/grants", response_model=DocumentPermissionRecord)
async def grant_admin_document_permission(
    document_id: uuid.UUID,
    body: GrantPermissionRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Grant or update document access for a user with full audit logging."""
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.current_version is None or document.current_version.status != "AVAILABLE":
        raise HTTPException(status_code=409, detail="This document is not currently available for sharing.")

    user = db.get(User, body.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Cannot grant access to an inactive user account.")
    if user.id == document.owner_user_id:
        raise HTTPException(status_code=400, detail="The document owner already has full access.")
    if body.expires_at is not None:
        if body.expires_at.tzinfo is None:
            raise HTTPException(
                status_code=422,
                detail="Expiration must include a timezone.",
            )
        if body.expires_at <= utc_now():
            raise HTTPException(
                status_code=422,
                detail="Expiration must be in the future.",
            )

    # Map permission level
    level = body.permission_level.strip().lower()
    can_view = True
    can_download = False
    can_edit = False

    if level in {"read", "view"}:
        can_view, can_download, can_edit = True, False, False
    elif level in {"read + download", "read_download", "download"}:
        can_view, can_download, can_edit = True, True, False
    elif level in {"edit"}:
        can_view, can_download, can_edit = True, False, True
    elif level in {"read + download + edit", "read_download_edit", "all"}:
        can_view, can_download, can_edit = True, True, True
    else:
        raise HTTPException(status_code=422, detail="Invalid permission level.")

    now = utc_now()
    existing_grant = db.execute(
        select(DocumentPermission)
        .where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id == user.id,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if existing_grant:
        # Reactivate or update
        existing_grant.can_view = can_view
        existing_grant.can_download = can_download
        existing_grant.can_edit = can_edit
        existing_grant.granted_by_user_id = admin.id
        existing_grant.granted_at = now
        existing_grant.expires_at = body.expires_at
        existing_grant.revoked_at = None
        existing_grant.revoked_by_user_id = None
        existing_grant.revocation_reason = None
        existing_grant.updated_at = now
        grant = existing_grant
    else:
        grant = DocumentPermission(
            document_id=document.id,
            user_id=user.id,
            can_view=can_view,
            can_download=can_download,
            can_edit=can_edit,
            granted_by_user_id=admin.id,
            granted_at=now,
            expires_at=body.expires_at,
        )
        db.add(grant)

    db.flush()
    record_audit(
        db,
        request,
        actor_user_id=admin.id,
        action_type="PERMISSION_GRANTED",
        result="SUCCESS",
        document=document,
        target_user_id=user.id,
        details={
            "permission_level": body.permission_level,
            "can_view": can_view,
            "can_download": can_download,
            "can_edit": can_edit,
            "expires_at": body.expires_at.isoformat() if body.expires_at else None,
        },
    )
    add_notification(
        db,
        recipient_user_id=user.id,
        actor_user_id=admin.id,
        notification_type="ACCESS_GRANTED",
        title="Document access granted",
        message=f"{admin.full_name} shared {document.title} with you.",
        preference_key="access_granted",
        document_id=document.id,
        metadata={"permission_id": str(grant.id)},
    )
    db.commit()
    db.refresh(grant)

    days_rem = None
    if grant.expires_at and grant.expires_at > now:
        days_rem = max(0, (grant.expires_at.date() - now.date()).days)

    return {
        "id": grant.id,
        "user_id": user.id,
        "user_name": user.full_name,
        "user_email": user.email,
        "user_department": user.department,
        "can_view": grant.can_view,
        "can_download": grant.can_download,
        "can_edit": grant.can_edit,
        "permission_type": _permission_type(grant.can_view, grant.can_download, grant.can_edit),
        "granted_by_user_id": admin.id,
        "granted_by_name": admin.full_name,
        "granted_by_email": admin.email,
        "granted_at": grant.granted_at,
        "expires_at": grant.expires_at,
        "days_remaining": days_rem,
        "revoked_at": None,
        "revoked_by_user_id": None,
        "revoked_by_name": None,
        "revocation_reason": None,
        "status": "Active",
    }


@router.delete("/documents/{document_id}/grants/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_document_permission(
    document_id: uuid.UUID,
    permission_id: uuid.UUID,
    body: RevokePermissionRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Revoke document access, persist revocation reason, and record audit event (DELETE)."""
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
        raise HTTPException(status_code=404, detail="Permission grant not found for this document.")

    if grant.user_id == document.owner_user_id:
        raise HTTPException(status_code=409, detail="The document owner cannot be revoked.")

    now = utc_now()
    if grant.revoked_at is not None or (grant.expires_at is not None and grant.expires_at <= now):
        raise HTTPException(status_code=409, detail="This permission is no longer active.")

    grant.revoked_at = now
    grant.revoked_by_user_id = admin.id
    grant.revocation_reason = body.reason.strip()
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
            "reason": body.reason.strip(),
            "can_view": grant.can_view,
            "can_download": grant.can_download,
            "can_edit": grant.can_edit,
        },
    )
    recipient = db.get(User, grant.user_id)
    if recipient is not None:
        add_notification(
            db,
            recipient_user_id=recipient.id,
            actor_user_id=admin.id,
            notification_type="ACCESS_REVOKED",
            title="Document access revoked",
            message=f"Access to {document.title} was revoked.",
            preference_key="access_revoked",
            document_id=document.id,
            metadata={"permission_id": str(grant.id)},
        )
    db.commit()


@router.post("/documents/{document_id}/grants/{permission_id}/revoke")
async def revoke_admin_document_permission(
    document_id: uuid.UUID,
    permission_id: uuid.UUID,
    body: RevokePermissionRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Revoke document access, persist revocation reason, and record audit event (POST)."""
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
        raise HTTPException(status_code=404, detail="Permission grant not found for this document.")

    if grant.user_id == document.owner_user_id:
        raise HTTPException(status_code=409, detail="The document owner cannot be revoked.")

    now = utc_now()
    if grant.revoked_at is not None or (grant.expires_at is not None and grant.expires_at <= now):
        raise HTTPException(status_code=409, detail="This permission is no longer active.")

    grant.revoked_at = now
    grant.revoked_by_user_id = admin.id
    grant.revocation_reason = body.reason.strip()
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
            "reason": body.reason.strip(),
            "can_view": grant.can_view,
            "can_download": grant.can_download,
            "can_edit": grant.can_edit,
        },
    )
    recipient = db.get(User, grant.user_id)
    if recipient is not None:
        add_notification(
            db,
            recipient_user_id=recipient.id,
            actor_user_id=admin.id,
            notification_type="ACCESS_REVOKED",
            title="Document access revoked",
            message=f"Access to {document.title} was revoked.",
            preference_key="access_revoked",
            document_id=document.id,
            metadata={"permission_id": str(grant.id)},
        )
    db.commit()
    return {"message": "Permission successfully revoked.", "permission_id": str(grant.id)}
