"""Database-backed, administrator-only dashboard analytics."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, String, and_, case, cast, distinct, func, literal, literal_column, or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.documents import Document, DocumentAuditLog, DocumentVersion
from app.models.user import AccountStatus, User
from app.schemas.dashboard import (
    AdminDashboardStorageResponse,
    AdminDashboardSummaryResponse,
    AdminDeniedRequestsResponse,
    AdminOperationsResponse,
    DashboardDocumentCounts,
    DashboardMetricTrend,
    DashboardUserCounts,
    DeniedRequestDay,
    OperationDay,
    OperationTotals,
    OperationTypeSummary,
    StorageCategory,
)

router = APIRouter(
    prefix="/api/admin/dashboard",
    tags=["admin-dashboard"],
    dependencies=[Depends(require_admin)],
)

_STORED_VERSION_STATUSES = ("AVAILABLE", "PENDING_SCAN", "QUARANTINED", "PURGE_PENDING")
_VALID_DAYS = (7, 30, 90)

_OPERATION_TYPES = {
    "read_view": "Read / View",
    "download": "Download",
    "upload": "Upload",
    "edit_replace": "Edit / Replace",
    "delete": "Delete",
    "permission_changes": "Permission changes",
    "other": "Other",
}
_DOCUMENT_OPERATION_ACTIONS = (
    "DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED", "DOCUMENT_UPLOADED",
    "DOCUMENT_METADATA_UPDATED", "DOCUMENT_VERSION_CREATED", "DOCUMENT_DELETED",
    "DOCUMENT_RESTORED", "PERMISSION_GRANTED", "PERMISSION_REVOKED",
    "UPLOAD_REJECTED", "ACCESS_DENIED", "ACCESS_REQUEST_SUBMITTED",
    "ACCESS_REQUEST_APPROVED", "ACCESS_REQUEST_DENIED", "ACCESS_REQUEST_CANCELLED",
    "DOCUMENT_SCAN_COMPLETED",
)


def _range(days: int) -> tuple[datetime, datetime, datetime]:
    """Return the selected inclusive-day window and its preceding equal window in UTC."""
    today = datetime.now(timezone.utc).date()
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    start = end - timedelta(days=days)
    previous_start = start - timedelta(days=days)
    return start, end, previous_start


def _utc_day(column):
    return cast(func.timezone(literal_column("'UTC'"), column), Date)


def _json_text(column, key: str):
    """Extract a fixed server-owned JSON key without bind parameters in GROUP BY."""
    return column.op("->>")(literal_column(f"'{key}'"))


def _percentage(current: int, previous: int) -> float | None:
    if previous <= 0:
        return None
    return round((current - previous) * 100.0 / previous, 1)


def _validated_days(days: int) -> int:
    if days not in _VALID_DAYS:
        raise HTTPException(status_code=422, detail="Days must be one of 7, 30, or 90.")
    return days


def _user_status_counts_before(db: Session, boundary: datetime) -> dict[str, int]:
    """Reconstruct account status immediately before a boundary from persisted transitions."""
    prior = (
        select(
            AuthEvent.user_id.label("user_id"),
            _json_text(AuthEvent.details, "after").label("status"),
            func.row_number().over(
                partition_by=AuthEvent.user_id,
                order_by=(AuthEvent.occurred_at.desc(), AuthEvent.id.desc()),
            ).label("rank"),
        )
        .where(
            AuthEvent.event_type == AuthEventType.USER_STATUS_CHANGED,
            AuthEvent.user_id.is_not(None),
            AuthEvent.occurred_at < boundary,
        )
        .subquery("user_status_before")
    )
    following = (
        select(
            AuthEvent.user_id.label("user_id"),
            _json_text(AuthEvent.details, "before").label("status"),
            func.row_number().over(
                partition_by=AuthEvent.user_id,
                order_by=(AuthEvent.occurred_at.asc(), AuthEvent.id.asc()),
            ).label("rank"),
        )
        .where(
            AuthEvent.event_type == AuthEventType.USER_STATUS_CHANGED,
            AuthEvent.user_id.is_not(None),
            AuthEvent.occurred_at >= boundary,
        )
        .subquery("user_status_after")
    )
    historical_status = case(
        (prior.c.rank == 1, prior.c.status),
        (following.c.rank == 1, following.c.status),
        else_=cast(User.account_status, String),
    )
    row = db.execute(
        select(
            func.count(User.id),
            func.coalesce(func.sum(case((historical_status == "ACTIVE", 1), else_=0)), 0),
            func.coalesce(func.sum(case((historical_status == "DISABLED", 1), else_=0)), 0),
        )
        .select_from(User)
        .outerjoin(prior, and_(prior.c.user_id == User.id, prior.c.rank == 1))
        .outerjoin(following, and_(following.c.user_id == User.id, following.c.rank == 1))
        .where(User.created_at < boundary)
    ).one()
    return {"total": int(row[0] or 0), "active": int(row[1] or 0), "disabled": int(row[2] or 0)}


def _document_count_before(db: Session, boundary: datetime) -> int:
    """Reconstruct published logical documents before a boundary from version/audit history."""
    first_published = (
        select(
            DocumentVersion.document_id.label("document_id"),
            func.min(func.coalesce(DocumentVersion.scan_completed_at, DocumentVersion.uploaded_at)).label("published_at"),
        )
        .where(
            or_(
                DocumentVersion.status == "AVAILABLE",
                and_(
                    DocumentVersion.status.in_(("PURGE_PENDING", "PURGED")),
                    DocumentVersion.scan_completed_at.is_not(None),
                ),
            ),
        )
        .group_by(DocumentVersion.document_id)
        .subquery("first_published_document_version")
    )
    following = (
        select(
            DocumentAuditLog.document_id_snapshot.label("document_id"),
            DocumentAuditLog.action_type.label("action"),
            func.row_number().over(
                partition_by=DocumentAuditLog.document_id_snapshot,
                order_by=(DocumentAuditLog.occurred_at.asc(), DocumentAuditLog.id.asc()),
            ).label("rank"),
        )
        .where(
            DocumentAuditLog.action_type.in_(("DOCUMENT_DELETED", "DOCUMENT_RESTORED")),
            DocumentAuditLog.result == "SUCCESS",
            DocumentAuditLog.occurred_at >= boundary,
        )
        .subquery("document_lifecycle_after")
    )
    live_at_boundary = case(
        (following.c.action == "DOCUMENT_DELETED", literal(True)),
        (following.c.action == "DOCUMENT_RESTORED", literal(False)),
        else_=and_(Document.status != "DELETED", Document.deleted_at.is_(None)),
    )
    return int(db.scalar(
        select(func.count(Document.id))
        .select_from(Document)
        .join(first_published, first_published.c.document_id == Document.id)
        .outerjoin(following, and_(following.c.document_id == Document.id, following.c.rank == 1))
        .where(first_published.c.published_at < boundary, live_at_boundary)
    ) or 0)


def _snapshot_counts(db: Session) -> tuple[DashboardUserCounts, DashboardDocumentCounts]:
    row = db.execute(
        select(
            select(func.count()).select_from(User).scalar_subquery(),
            select(func.count()).select_from(User).where(
                User.account_status == AccountStatus.ACTIVE,
            ).scalar_subquery(),
            select(func.count()).select_from(User).where(
                User.account_status == AccountStatus.DISABLED,
            ).scalar_subquery(),
            select(func.count()).select_from(Document).where(
                Document.status != "DELETED", Document.deleted_at.is_(None),
                Document.current_version_id.is_not(None),
            ).scalar_subquery(),
        )
    ).one()
    return (
        DashboardUserCounts(total=int(row[0]), active=int(row[1]), disabled=int(row[2])),
        DashboardDocumentCounts(total=int(row[3])),
    )


def _daily_summary_points(
    db: Session,
    *,
    days: int,
    start: datetime,
    end: datetime,
    user_start: dict[str, int],
    document_start: int,
) -> dict[str, list[int]]:
    date_values = [start.date() + timedelta(days=index) for index in range(days)]
    user_points = {"users": [], "active": [], "disabled": []}
    document_points: list[int] = []
    current_users = dict(user_start)
    current_documents = document_start

    day = _utc_day(User.created_at)
    created_status = (
        select(
            AuthEvent.user_id.label("user_id"),
            _json_text(AuthEvent.details, "before").label("initial_status"),
            func.row_number().over(
                partition_by=AuthEvent.user_id,
                order_by=(AuthEvent.occurred_at.asc(), AuthEvent.id.asc()),
            ).label("rank"),
        )
        .where(
            AuthEvent.event_type == AuthEventType.USER_STATUS_CHANGED,
            AuthEvent.user_id.is_not(None),
        )
        .subquery("first_user_status_change")
    )
    initial_status = func.coalesce(created_status.c.initial_status, cast(User.account_status, String))
    user_creations = db.execute(
        select(day.label("day"), initial_status.label("status"), func.count(User.id))
        .select_from(User)
        .outerjoin(created_status, and_(created_status.c.user_id == User.id, created_status.c.rank == 1))
        .where(User.created_at >= start, User.created_at < end)
        .group_by(day, initial_status)
    ).all()
    creations_by_day: dict[date, dict[str, int]] = {}
    for row in user_creations:
        creations_by_day.setdefault(row.day, {})[str(row.status)] = int(row[2])

    event_day = _utc_day(AuthEvent.occurred_at)
    transitions = db.execute(
        select(
            event_day.label("day"),
            _json_text(AuthEvent.details, "before").label("before_status"),
            _json_text(AuthEvent.details, "after").label("after_status"),
            func.count(AuthEvent.id),
        )
        .where(
            AuthEvent.event_type == AuthEventType.USER_STATUS_CHANGED,
            AuthEvent.occurred_at >= start,
            AuthEvent.occurred_at < end,
        )
        .group_by(event_day, _json_text(AuthEvent.details, "before"), _json_text(AuthEvent.details, "after"))
    ).all()
    transitions_by_day: dict[date, list[tuple[str, str, int]]] = {}
    for row in transitions:
        transitions_by_day.setdefault(row.day, []).append((str(row.before_status), str(row.after_status), int(row[3])))

    published_at = func.coalesce(DocumentVersion.scan_completed_at, DocumentVersion.uploaded_at)
    first_published = (
        select(
            DocumentVersion.document_id.label("document_id"),
            func.min(published_at).label("published_at"),
        )
        .where(
            or_(
                DocumentVersion.status == "AVAILABLE",
                and_(
                    DocumentVersion.status.in_(("PURGE_PENDING", "PURGED")),
                    DocumentVersion.scan_completed_at.is_not(None),
                ),
            ),
        )
        .group_by(DocumentVersion.document_id)
        .subquery("first_published_document_version")
    )
    published_day = _utc_day(first_published.c.published_at)
    document_creations = db.execute(
        select(published_day.label("day"), func.count(first_published.c.document_id))
        .where(first_published.c.published_at >= start, first_published.c.published_at < end)
        .group_by(published_day)
    ).all()
    documents_created_by_day = {row.day: int(row[1]) for row in document_creations}

    lifecycle_day = _utc_day(DocumentAuditLog.occurred_at)
    lifecycle_rows = db.execute(
        select(lifecycle_day.label("day"), DocumentAuditLog.action_type, func.count(DocumentAuditLog.id))
        .where(
            DocumentAuditLog.action_type.in_(("DOCUMENT_DELETED", "DOCUMENT_RESTORED")),
            DocumentAuditLog.result == "SUCCESS",
            DocumentAuditLog.occurred_at >= start,
            DocumentAuditLog.occurred_at < end,
        )
        .group_by(lifecycle_day, DocumentAuditLog.action_type)
    ).all()
    lifecycle_by_day: dict[date, dict[str, int]] = {}
    for row in lifecycle_rows:
        lifecycle_by_day.setdefault(row.day, {})[row.action_type] = int(row[2])

    for current_day in date_values:
        daily_creations = creations_by_day.get(current_day, {})
        total_created = sum(daily_creations.values())
        current_users["total"] += total_created
        current_users["active"] += daily_creations.get("ACTIVE", 0)
        current_users["disabled"] += daily_creations.get("DISABLED", 0)
        for before_status, after_status, count in transitions_by_day.get(current_day, []):
            if before_status == "ACTIVE":
                current_users["active"] -= count
            if after_status == "ACTIVE":
                current_users["active"] += count
            if before_status == "DISABLED":
                current_users["disabled"] -= count
            if after_status == "DISABLED":
                current_users["disabled"] += count
        user_points["users"].append(current_users["total"])
        user_points["active"].append(current_users["active"])
        user_points["disabled"].append(current_users["disabled"])

        current_documents += documents_created_by_day.get(current_day, 0)
        lifecycle = lifecycle_by_day.get(current_day, {})
        current_documents -= lifecycle.get("DOCUMENT_DELETED", 0)
        current_documents += lifecycle.get("DOCUMENT_RESTORED", 0)
        document_points.append(current_documents)

    user_points["documents"] = document_points
    return user_points


@router.get("/summary", response_model=AdminDashboardSummaryResponse)
async def get_dashboard_summary(
    days: int = Query(default=7, ge=7, le=90),
    db: Session = Depends(get_db),
) -> AdminDashboardSummaryResponse:
    days = _validated_days(days)
    now = datetime.now(timezone.utc)
    start, _, _ = _range(days)
    users, documents = _snapshot_counts(db)
    users_at_start = _user_status_counts_before(db, start)
    documents_at_start = _document_count_before(db, start)
    points = _daily_summary_points(
        db,
        days=days,
        start=start,
        end=datetime.combine(now.date() + timedelta(days=1), time.min, tzinfo=timezone.utc),
        user_start=users_at_start,
        document_start=documents_at_start,
    )
    trends = {
        "users": DashboardMetricTrend(
            change=users.total - users_at_start["total"],
            change_percent=_percentage(users.total, users_at_start["total"]),
            points=points["users"],
        ),
        "active": DashboardMetricTrend(
            change=users.active - users_at_start["active"],
            change_percent=_percentage(users.active, users_at_start["active"]),
            points=points["active"],
        ),
        "disabled": DashboardMetricTrend(
            change=users.disabled - users_at_start["disabled"],
            change_percent=_percentage(users.disabled, users_at_start["disabled"]),
            points=points["disabled"],
        ),
        "documents": DashboardMetricTrend(
            change=documents.total - documents_at_start,
            change_percent=_percentage(documents.total, documents_at_start),
            points=points["documents"],
        ),
    }
    return AdminDashboardSummaryResponse(
        users=users,
        documents=documents,
        period_days=days,
        as_of=now,
        trends=trends,
    )


def _storage_category_expression():
    extension = func.lower(func.coalesce(DocumentVersion.file_extension, ""))
    content_type = func.lower(func.coalesce(DocumentVersion.content_type, ""))
    office_extensions = ("doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp")
    image_extensions = ("png", "jpg", "jpeg", "webp", "gif", "svg", "tif", "tiff", "bmp", "avif")
    return case(
        (or_(extension == "pdf", content_type == "application/pdf"), literal("pdf")),
        (
            or_(
                extension.in_(office_extensions),
                content_type.like("application/vnd.openxmlformats-officedocument.%"),
                content_type.in_((
                    "application/msword", "application/vnd.ms-excel",
                    "application/vnd.ms-powerpoint", "application/vnd.oasis.opendocument.text",
                    "application/vnd.oasis.opendocument.spreadsheet",
                    "application/vnd.oasis.opendocument.presentation",
                )),
            ),
            literal("office"),
        ),
        (or_(extension.in_(image_extensions), content_type.like("image/%")), literal("images")),
        else_=literal("other"),
    )


@router.get("/storage", response_model=AdminDashboardStorageResponse)
async def get_dashboard_storage(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
) -> AdminDashboardStorageResponse:
    days = _validated_days(days)
    start, end, _ = _range(days)
    category = _storage_category_expression()
    grouped = db.execute(
        select(category.label("category"), func.count(DocumentVersion.id), func.coalesce(func.sum(DocumentVersion.size_bytes), 0))
        .where(DocumentVersion.status.in_(_STORED_VERSION_STATUSES))
        .group_by(category)
    ).all()
    totals = {key: {"files": 0, "bytes": 0} for key in ("pdf", "office", "images", "other")}
    for row in grouped:
        key = str(row.category)
        if key in totals:
            totals[key] = {"files": int(row[1]), "bytes": int(row[2])}
    total_bytes = sum(item["bytes"] for item in totals.values())

    added_bytes = int(db.scalar(
        select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0)).where(
            DocumentVersion.status.in_(_STORED_VERSION_STATUSES),
            DocumentVersion.uploaded_at >= start,
            DocumentVersion.uploaded_at < end,
        )
    ) or 0)
    has_untracked_removals = bool(db.scalar(
        select(func.count()).select_from(DocumentVersion).where(DocumentVersion.status == "PURGED")
    ) or 0)
    starting_bytes = total_bytes - added_bytes
    growth_percent = (
        None if has_untracked_removals or starting_bytes < 0
        else _percentage(total_bytes, starting_bytes)
    )
    logical_documents = int(db.scalar(
        select(func.count(Document.id)).where(
            Document.status != "DELETED", Document.deleted_at.is_(None),
            Document.current_version_id.is_not(None),
        )
    ) or 0)
    labels = {"pdf": "PDF", "office": "Office", "images": "Images", "other": "Other"}
    return AdminDashboardStorageResponse(
        period_days=days,
        total_bytes=total_bytes,
        added_bytes=added_bytes,
        growth_percent=growth_percent,
        logical_documents=logical_documents,
        categories=[
            StorageCategory(
                key=key,
                label=labels[key],
                files=value["files"],
                bytes=value["bytes"],
                percent=round(value["bytes"] * 100.0 / total_bytes, 1) if total_bytes else 0.0,
            )
            for key, value in totals.items()
        ],
        metadata_source="S3-verified document-version metadata in PostgreSQL",
        as_of=datetime.now(timezone.utc),
    )


def _denied_access_condition():
    operation = _json_text(DocumentAuditLog.details, "operation")
    return or_(
        and_(
            DocumentAuditLog.action_type == "ACCESS_DENIED",
            DocumentAuditLog.result == "DENIED",
            operation.in_(("view", "download", "edit", "edit_metadata", "replace", "delete")),
        ),
        and_(
            DocumentAuditLog.action_type.in_(("DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED")),
            DocumentAuditLog.result == "DENIED",
        ),
    )


@router.get("/denied-requests", response_model=AdminDeniedRequestsResponse)
async def get_denied_requests(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
) -> AdminDeniedRequestsResponse:
    days = _validated_days(days)
    start, end, _ = _range(days)
    denied_condition = _denied_access_condition()
    range_filter = and_(DocumentAuditLog.occurred_at >= start, DocumentAuditLog.occurred_at < end)
    denial_rows = db.execute(
        select(
            _utc_day(DocumentAuditLog.occurred_at).label("day"),
            func.count(DocumentAuditLog.id),
        )
        .where(range_filter, denied_condition)
        .group_by(_utc_day(DocumentAuditLog.occurred_at))
        .order_by(_utc_day(DocumentAuditLog.occurred_at))
    ).all()
    denied = int(db.scalar(
        select(func.count(DocumentAuditLog.id)).where(range_filter, denied_condition)
    ) or 0)
    unique_users = int(db.scalar(
        select(func.count(distinct(DocumentAuditLog.actor_user_id_snapshot))).where(
            range_filter, denied_condition,
            DocumentAuditLog.actor_user_id_snapshot.is_not(None),
        )
    ) or 0)
    distinct_documents = int(db.scalar(
        select(func.count(distinct(DocumentAuditLog.document_id_snapshot))).where(range_filter, denied_condition)
    ) or 0)
    successful_access_actions = (
        "DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED", "DOCUMENT_METADATA_UPDATED",
        "DOCUMENT_VERSION_CREATED", "DOCUMENT_DELETED", "DOCUMENT_RESTORED",
    )
    total_access_attempts = int(db.scalar(
        select(func.count(DocumentAuditLog.id)).where(
            range_filter,
            or_(
                and_(
                    DocumentAuditLog.result == "SUCCESS",
                    DocumentAuditLog.action_type.in_(successful_access_actions),
                ),
                denied_condition,
            ),
        )
    ) or 0)
    by_day = {row.day: int(row[1]) for row in denial_rows}
    daily = [
        DeniedRequestDay(date=start.date() + timedelta(days=index), count=by_day.get(start.date() + timedelta(days=index), 0))
        for index in range(days)
    ]
    return AdminDeniedRequestsResponse(
        period_days=days,
        denied=denied,
        total_access_attempts=total_access_attempts,
        unique_users=unique_users,
        distinct_documents=distinct_documents,
        denial_percent=round(denied * 100.0 / total_access_attempts, 1) if total_access_attempts else None,
        daily=daily,
    )


def _operation_category_expression():
    action = DocumentAuditLog.action_type
    operation = _json_text(DocumentAuditLog.details, "operation")
    denied_category = case(
        (operation == "view", literal("read_view")),
        (operation == "download", literal("download")),
        (operation.in_(("edit", "edit_metadata", "replace")), literal("edit_replace")),
        (operation == "delete", literal("delete")),
        (operation.in_(("share", "manage_permissions", "list_permissions", "grant_permission", "revoke_permission")), literal("permission_changes")),
        else_=literal("other"),
    )
    return case(
        (action == "DOCUMENT_VIEWED", literal("read_view")),
        (action == "DOCUMENT_DOWNLOADED", literal("download")),
        (action.in_(("DOCUMENT_UPLOADED", "UPLOAD_REJECTED")), literal("upload")),
        (action.in_(("DOCUMENT_METADATA_UPDATED", "DOCUMENT_VERSION_CREATED", "DOCUMENT_RESTORED")), literal("edit_replace")),
        (action == "DOCUMENT_DELETED", literal("delete")),
        (action.in_((
            "PERMISSION_GRANTED", "PERMISSION_REVOKED", "ACCESS_REQUEST_SUBMITTED",
            "ACCESS_REQUEST_APPROVED", "ACCESS_REQUEST_DENIED", "ACCESS_REQUEST_CANCELLED",
        )), literal("permission_changes")),
        (action == "ACCESS_DENIED", denied_category),
        else_=literal("other"),
    )


def _operation_rows(db: Session, start: datetime, end: datetime, operation_filter: str):
    category = _operation_category_expression()
    criteria = [
        DocumentAuditLog.occurred_at >= start,
        DocumentAuditLog.occurred_at < end,
        DocumentAuditLog.action_type.in_(_DOCUMENT_OPERATION_ACTIONS),
        DocumentAuditLog.result.in_(("SUCCESS", "DENIED")),
    ]
    if operation_filter != "all":
        criteria.append(category == operation_filter)
    rows = db.execute(
        select(
            _utc_day(DocumentAuditLog.occurred_at).label("day"),
            category.label("category"),
            DocumentAuditLog.result.label("result"),
            func.count(DocumentAuditLog.id),
        )
        .where(*criteria)
        .group_by(_utc_day(DocumentAuditLog.occurred_at), category, DocumentAuditLog.result)
        .order_by(_utc_day(DocumentAuditLog.occurred_at), category, DocumentAuditLog.result)
    ).all()
    return rows


@router.get("/operations", response_model=AdminOperationsResponse)
async def get_dashboard_operations(
    days: int = Query(default=30, ge=7, le=90),
    operation: Literal["all", "read_view", "download", "upload", "edit_replace", "delete", "permission_changes", "other"] = "all",
    db: Session = Depends(get_db),
) -> AdminOperationsResponse:
    days = _validated_days(days)
    start, end, previous_start = _range(days)
    current_rows = _operation_rows(db, start, end, operation)
    previous_rows = _operation_rows(db, previous_start, start, operation)

    current_by_day: dict[date, dict[str, int]] = {}
    current_by_type: dict[str, dict[str, int]] = {}
    for row in current_rows:
        result_key = "success" if row.result == "SUCCESS" else "denied"
        current_by_day.setdefault(row.day, {"success": 0, "denied": 0})[result_key] += int(row[3])
        current_by_type.setdefault(str(row.category), {"success": 0, "denied": 0})[result_key] += int(row[3])

    previous_totals = {"success": 0, "denied": 0}
    for row in previous_rows:
        previous_totals["success" if row.result == "SUCCESS" else "denied"] += int(row[3])
    success = sum(item["success"] for item in current_by_day.values())
    denied = sum(item["denied"] for item in current_by_day.values())
    previous_total = previous_totals["success"] + previous_totals["denied"]
    total = success + denied
    selected_types = [operation] if operation != "all" else list(_OPERATION_TYPES)
    if operation == "all" and current_by_type.get("other", {}).get("success", 0) + current_by_type.get("other", {}).get("denied", 0) == 0:
        selected_types.remove("other")
    daily = [
        OperationDay(
            date=start.date() + timedelta(days=index),
            success=current_by_day.get(start.date() + timedelta(days=index), {}).get("success", 0),
            denied=current_by_day.get(start.date() + timedelta(days=index), {}).get("denied", 0),
        )
        for index in range(days)
    ]
    by_type = [
        OperationTypeSummary(
            key=key,
            label=_OPERATION_TYPES[key],
            success=current_by_type.get(key, {}).get("success", 0),
            denied=current_by_type.get(key, {}).get("denied", 0),
        )
        for key in selected_types
    ]
    return AdminOperationsResponse(
        period_days=days,
        operation=operation,
        totals=OperationTotals(
            success=success,
            denied=denied,
            total=total,
            previous_success=previous_totals["success"],
            previous_denied=previous_totals["denied"],
            previous_total=previous_total,
            success_change_percent=_percentage(success, previous_totals["success"]),
            denied_change_percent=_percentage(denied, previous_totals["denied"]),
            total_change_percent=_percentage(total, previous_total),
        ),
        daily=daily,
        by_type=by_type,
    )
