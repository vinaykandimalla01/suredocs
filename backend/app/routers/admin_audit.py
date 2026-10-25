"""Administrator audit views built from persisted document and auth events."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import String, and_, case, cast, distinct, func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.documents import Document, DocumentAuditLog, DocumentVersion
from app.models.user import User

router = APIRouter(
    prefix="/api/admin/audit",
    tags=["admin-audit"],
    dependencies=[Depends(require_admin)],
)
DocumentOwner = User.__table__.alias("document_owner")
TargetUser = User.__table__.alias("target_user")
DocumentActor = User.__table__.alias("document_actor")
AuthActor = User.__table__.alias("auth_actor")
AuthTarget = User.__table__.alias("auth_target")

_SENSITIVE_DETAIL_KEYS = (
    "password", "token", "secret", "credential", "authorization", "cookie",
    "session", "presigned", "storage_key", "s3_key", "bucket", "object_key",
)


def _safe_details(value: Any) -> Any:
    """Redact credentials and storage locators from administrator-visible details."""
    if isinstance(value, dict):
        return {
            str(key): _safe_details(item)
            for key, item in value.items()
            if not any(part in str(key).lower().replace("-", "_") for part in _SENSITIVE_DETAIL_KEYS)
        }
    if isinstance(value, list):
        return [_safe_details(item) for item in value[:100]]
    if isinstance(value, str):
        return value[:2000]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:2000]


def _event_rows():
    """Build one read-only row shape for the two existing audit stores."""
    document_action = case(
        (DocumentAuditLog.action_type == "DOCUMENT_VIEWED", "Document viewed"),
        (DocumentAuditLog.action_type == "DOCUMENT_DOWNLOADED", "Document downloaded"),
        (DocumentAuditLog.action_type == "DOCUMENT_UPLOADED", "Document uploaded"),
        (DocumentAuditLog.action_type == "DOCUMENT_METADATA_UPDATED", "Document edited"),
        (DocumentAuditLog.action_type == "DOCUMENT_VERSION_CREATED", "Version created"),
        (DocumentAuditLog.action_type == "DOCUMENT_SCAN_COMPLETED", "Document scan completed"),
        (DocumentAuditLog.action_type == "DOCUMENT_DELETED", "Document deleted"),
        (DocumentAuditLog.action_type == "DOCUMENT_RESTORED", "Document restored"),
        (DocumentAuditLog.action_type == "PERMISSION_GRANTED", "Permission granted"),
        (DocumentAuditLog.action_type == "PERMISSION_REVOKED", "Permission revoked"),
        (DocumentAuditLog.action_type == "UPLOAD_REJECTED", "Upload rejected"),
        (DocumentAuditLog.action_type == "ACCESS_DENIED", "Access denied"),
        else_=DocumentAuditLog.action_type,
    )
    document_category = case(
        (DocumentAuditLog.action_type.in_(("PERMISSION_GRANTED", "PERMISSION_REVOKED")), "Permission"),
        else_="Document",
    )
    document_event = (
        select(
            func.concat("document:", cast(DocumentAuditLog.id, String)).label("id"),
            literal("document").label("source"),
            DocumentAuditLog.occurred_at.label("occurred_at"),
            DocumentAuditLog.action_type.label("action_type"),
            document_action.label("action"),
            document_category.label("category"),
            DocumentAuditLog.result.label("result"),
            cast(func.coalesce(DocumentAuditLog.actor_user_id_snapshot, DocumentAuditLog.actor_user_id), String).label("actor_id"),
            func.coalesce(DocumentAuditLog.actor_name_snapshot, DocumentActor.c.full_name).label("actor_name"),
            func.coalesce(DocumentAuditLog.actor_email_snapshot, DocumentActor.c.email).label("actor_email"),
            func.coalesce(DocumentAuditLog.actor_role_snapshot, cast(DocumentActor.c.role, String)).label("actor_role"),
            cast(func.coalesce(DocumentAuditLog.target_user_id_snapshot, DocumentAuditLog.target_user_id), String).label("target_user_id"),
            func.coalesce(DocumentAuditLog.target_name_snapshot, TargetUser.c.full_name).label("target_user_name"),
            func.coalesce(DocumentAuditLog.target_email_snapshot, TargetUser.c.email).label("target_user_email"),
            cast(DocumentAuditLog.document_id_snapshot, String).label("document_id"),
            func.coalesce(DocumentVersion.original_filename, Document.title).label("document_name"),
            func.coalesce(DocumentVersion.file_extension, literal("")).label("file_type"),
            DocumentVersion.size_bytes.label("file_size_bytes"),
            Document.category.label("document_category"),
            Document.status.label("document_status"),
            cast(Document.owner_user_id, String).label("document_owner_id"),
            func.coalesce(DocumentOwner.c.full_name, literal("")).label("document_owner"),
            DocumentAuditLog.ip_address.label("ip_address"),
            DocumentAuditLog.user_agent.label("user_agent"),
            DocumentAuditLog.request_id.label("request_id"),
            DocumentAuditLog.details.label("details"),
        )
        .select_from(DocumentAuditLog)
        .outerjoin(
            DocumentActor,
            DocumentActor.c.id == func.coalesce(DocumentAuditLog.actor_user_id_snapshot, DocumentAuditLog.actor_user_id),
        )
        .outerjoin(Document, Document.id == DocumentAuditLog.document_id_snapshot)
        .outerjoin(
            DocumentVersion,
            and_(
                DocumentVersion.document_id == Document.id,
                DocumentVersion.id == Document.current_version_id,
            ),
        )
        .outerjoin(DocumentOwner, DocumentOwner.c.id == Document.owner_user_id)
        .outerjoin(
            TargetUser,
            TargetUser.c.id == func.coalesce(DocumentAuditLog.target_user_id_snapshot, DocumentAuditLog.target_user_id),
        )
    )

    auth_action = case(
        (AuthEvent.event_type == AuthEventType.LOGIN_SUCCESS, "Login successful"),
        (AuthEvent.event_type == AuthEventType.LOGIN_FAILED, "Login failed"),
        (AuthEvent.event_type == AuthEventType.LOGOUT, "Logged out"),
        (AuthEvent.event_type == AuthEventType.ACCOUNT_LOCKED, "Account locked"),
        (AuthEvent.event_type == AuthEventType.SESSION_REVOKED, "Session revoked"),
        (AuthEvent.event_type == AuthEventType.AUTH_REJECTED_INACTIVE, "Login blocked"),
        (AuthEvent.event_type == AuthEventType.USER_ROLE_CHANGED, "User role changed"),
        (AuthEvent.event_type == AuthEventType.USER_STATUS_CHANGED, "User status changed"),
        else_=cast(AuthEvent.event_type, String),
    )
    auth_result = case(
        (AuthEvent.event_type == AuthEventType.AUTH_REJECTED_INACTIVE, "DENIED"),
        (AuthEvent.event_type.in_((AuthEventType.LOGIN_FAILED, AuthEventType.ACCOUNT_LOCKED, AuthEventType.MFA_REJECTED)), "FAILED"),
        else_="SUCCESS",
    )
    auth_actor_id = func.coalesce(
        AuthEvent.details["actor_user_id"].as_string(),
        cast(AuthEvent.user_id, String),
    )
    auth_target_id = case(
        (AuthEvent.event_type.in_((AuthEventType.USER_ROLE_CHANGED, AuthEventType.USER_STATUS_CHANGED)), cast(AuthEvent.user_id, String)),
        else_=literal(None, type_=String),
    )
    auth_category = case(
        (AuthEvent.event_type.in_((AuthEventType.ACCOUNT_LOCKED, AuthEventType.SESSION_REVOKED)), "Security"),
        else_="Authentication",
    )
    auth_event = (
        select(
            func.concat("auth:", cast(AuthEvent.id, String)).label("id"),
            literal("auth").label("source"),
            AuthEvent.occurred_at.label("occurred_at"),
            cast(AuthEvent.event_type, String).label("action_type"),
            auth_action.label("action"),
            auth_category.label("category"),
            auth_result.label("result"),
            auth_actor_id.label("actor_id"),
            AuthActor.c.full_name.label("actor_name"),
            AuthActor.c.email.label("actor_email"),
            cast(AuthActor.c.role, String).label("actor_role"),
            auth_target_id.label("target_user_id"),
            AuthTarget.c.full_name.label("target_user_name"),
            AuthTarget.c.email.label("target_user_email"),
            literal(None, type_=String).label("document_id"),
            literal(None, type_=String).label("document_name"),
            literal(None, type_=String).label("file_type"),
            literal(None).label("file_size_bytes"),
            literal(None, type_=String).label("document_category"),
            literal(None, type_=String).label("document_status"),
            literal(None, type_=String).label("document_owner_id"),
            literal(None, type_=String).label("document_owner"),
            AuthEvent.ip_address.label("ip_address"),
            AuthEvent.user_agent.label("user_agent"),
            literal(None, type_=String).label("request_id"),
            AuthEvent.details.label("details"),
        )
        .select_from(AuthEvent)
        .outerjoin(AuthActor, cast(AuthActor.c.id, String) == auth_actor_id)
        .outerjoin(AuthTarget, cast(AuthTarget.c.id, String) == cast(AuthEvent.user_id, String))
    )
    return union_all(document_event, auth_event).subquery("audit_events")


def _as_dict(row: Any) -> dict[str, Any]:
    value = dict(row._mapping) if hasattr(row, "_mapping") else dict(row)
    details = _safe_details(value.get("details") or {})
    reason = details.get("reason") if isinstance(details, dict) else None
    operation = details.get("operation") if isinstance(details, dict) else None
    if reason:
        description = str(reason).replace("_", " ").capitalize()
    elif value.get("result") == "DENIED" and operation:
        description = f"Access denied while attempting to {operation}"
    elif value.get("action_type") == "DOCUMENT_VIEWED":
        description = "Viewed document details"
    elif value.get("action_type") == "DOCUMENT_DOWNLOADED":
        description = "Document download completed"
    elif value.get("action_type") == "DOCUMENT_UPLOADED":
        description = "New document uploaded"
    elif value.get("action_type") == "DOCUMENT_METADATA_UPDATED":
        description = "Document metadata updated"
    elif value.get("action_type") == "PERMISSION_GRANTED":
        description = "Document permission granted"
    elif value.get("action_type") == "PERMISSION_REVOKED":
        description = "Document permission revoked"
    else:
        description = value.get("action") or value.get("action_type") or "Audit event"

    result = value.get("result") or ""
    outcome = {"SUCCESS": "Success", "DENIED": "Denied", "FAILED": "Failed"}.get(result, result.title())
    actor_name = value.get("actor_name") or "Unknown user"
    return {
        "id": value.get("id"),
        "source": value.get("source"),
        "timestamp": value.get("occurred_at").isoformat() if value.get("occurred_at") else None,
        "action": value.get("action"),
        "actionType": value.get("action_type"),
        "category": value.get("category"),
        "description": description,
        "outcome": outcome,
        "severity": "High" if result in ("DENIED", "FAILED") else "Info",
        "actor": {
            "id": value.get("actor_id"),
            "name": actor_name,
            "email": value.get("actor_email"),
            "role": (value.get("actor_role") or "").replace("_", " ").title() or "Unknown",
        },
        "targetUser": {
            "id": value.get("target_user_id"),
            "name": value.get("target_user_name"),
            "email": value.get("target_user_email"),
        } if value.get("target_user_id") else None,
        "document": {
            "id": value.get("document_id"),
            "name": value.get("document_name"),
            "fileType": (value.get("file_type") or "").upper(),
            "fileSizeBytes": value.get("file_size_bytes"),
            "category": value.get("document_category"),
            "status": value.get("document_status"),
            "ownerId": value.get("document_owner_id"),
            "owner": value.get("document_owner"),
        } if value.get("document_id") else None,
        "ipAddress": value.get("ip_address"),
        "userAgent": value.get("user_agent"),
        "requestId": value.get("request_id"),
        "details": details,
        "reason": reason,
    }


def _date_bounds(from_date: date | None, to_date: date | None) -> tuple[datetime | None, datetime | None]:
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    start = datetime.combine(from_date, time.min, tzinfo=timezone.utc) if from_date else None
    end = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=timezone.utc) if to_date else None
    return start, end


def _criteria(
    events,
    *,
    from_date: date | None,
    to_date: date | None,
    action: str | None,
    actor_id: str | None,
    document_id: str | None,
    result: str | None,
    search: str | None,
):
    conditions = []
    start, end = _date_bounds(from_date, to_date)
    if start:
        conditions.append(events.c.occurred_at >= start)
    if end:
        conditions.append(events.c.occurred_at < end)
    if action:
        conditions.append(events.c.action == action)
    if actor_id:
        conditions.append(events.c.actor_id == actor_id)
    if document_id:
        conditions.append(events.c.document_id == document_id)
    if result:
        conditions.append(events.c.result == result.upper())
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(or_(
            func.lower(events.c.id).like(term),
            func.lower(func.coalesce(events.c.actor_name, "")).like(term),
            func.lower(func.coalesce(events.c.document_name, "")).like(term),
            func.lower(func.coalesce(events.c.request_id, "")).like(term),
            func.lower(events.c.action).like(term),
        ))
    return conditions


def _list_params(
    from_date: date | None,
    to_date: date | None,
    action: str | None,
    actor_id: str | None,
    document_id: str | None,
    result: str | None,
    search: str | None,
):
    return dict(
        from_date=from_date,
        to_date=to_date,
        action=action,
        actor_id=actor_id,
        document_id=document_id,
        result=result,
        search=search,
    )


@router.get("/events")
async def list_audit_events(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    action: str | None = None,
    actor_id: str | None = None,
    document_id: str | None = None,
    result: str | None = None,
    search: str | None = None,
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    activity_days: int = Query(default=7, ge=7, le=90),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if from_date is None and to_date is None:
        operational_date = datetime.now(timezone.utc).date()
        from_date = operational_date.replace(day=1)
        to_date = operational_date
    events = _event_rows()
    params = _list_params(from_date, to_date, action, actor_id, document_id, result, search)
    conditions = _criteria(events, **params)
    filtered = select(events).where(*conditions)
    count = db.scalar(select(func.count()).select_from(filtered.subquery())) or 0
    direction = events.c.occurred_at.desc() if sort == "newest" else events.c.occurred_at.asc()
    rows = db.execute(
        filtered.order_by(direction, events.c.id.asc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    filtered_rows = filtered.subquery("filtered_audit_events")
    total_expr = select(func.count()).select_from(filtered_rows).scalar_subquery()
    success_expr = select(func.count()).select_from(filtered_rows).where(filtered_rows.c.result == "SUCCESS").scalar_subquery()
    denied_expr = select(func.count()).select_from(filtered_rows).where(filtered_rows.c.result == "DENIED").scalar_subquery()
    unique_expr = select(func.count(distinct(filtered_rows.c.actor_id))).select_from(filtered_rows).scalar_subquery()
    metric_values = db.execute(select(total_expr, success_expr, denied_expr, unique_expr)).one()

    start, end = _date_bounds(from_date, to_date)
    end = end or datetime.combine(datetime.now(timezone.utc).date() + timedelta(days=1), time.min, tzinfo=timezone.utc)
    start = start or end - timedelta(days=30)
    span = end - start
    previous_conditions = _criteria(
        events,
        from_date=(start - span).date(),
        to_date=(start - timedelta(days=1)).date(),
        action=action,
        actor_id=actor_id,
        document_id=document_id,
        result=result,
        search=search,
    )
    previous = select(events).where(*previous_conditions).subquery()
    previous_total, previous_success, previous_denied, previous_unique = db.execute(select(
        select(func.count()).select_from(previous).scalar_subquery(),
        select(func.count()).select_from(previous).where(previous.c.result == "SUCCESS").scalar_subquery(),
        select(func.count()).select_from(previous).where(previous.c.result == "DENIED").scalar_subquery(),
        select(func.count(distinct(previous.c.actor_id))).select_from(previous).scalar_subquery(),
    )).one()

    # The selected chart window is intersected with the applied date filters.
    chart_end = end
    chart_start = max(start, chart_end - timedelta(days=activity_days))
    chart_conditions = _criteria(events, **{**params, "from_date": chart_start.date(), "to_date": (chart_end - timedelta(days=1)).date()})
    chart_rows = db.execute(
        select(
            func.date(events.c.occurred_at).label("day"),
            events.c.result,
            func.count().label("count"),
        ).where(*chart_conditions).group_by(func.date(events.c.occurred_at), events.c.result)
        .order_by(func.date(events.c.occurred_at))
    ).all()
    chart_by_day: dict[str, dict[str, Any]] = {}
    for row in chart_rows:
        day = row.day.isoformat()
        chart_by_day.setdefault(day, {"date": day, "success": 0, "denied": 0, "failed": 0})
        chart_by_day[day][{"SUCCESS": "success", "DENIED": "denied", "FAILED": "failed"}.get(row.result, "failed")] = row.count
    chart = [
        chart_by_day.get((chart_start.date() + timedelta(days=offset)).isoformat(), {
            "date": (chart_start.date() + timedelta(days=offset)).isoformat(),
            "success": 0, "denied": 0, "failed": 0,
        })
        for offset in range(max(1, (chart_end.date() - chart_start.date()).days))
    ]

    trend_start = max(start, end - timedelta(days=30))
    trend_conditions = _criteria(
        events,
        **{**params, "from_date": trend_start.date(), "to_date": (end - timedelta(days=1)).date()},
    )
    trend_rows = db.execute(
        select(
            func.date(events.c.occurred_at).label("day"),
            func.count().label("total"),
            func.sum(case((events.c.result == "SUCCESS", 1), else_=0)).label("success"),
            func.sum(case((events.c.result == "DENIED", 1), else_=0)).label("denied"),
            func.count(distinct(events.c.actor_id)).label("uniqueUsers"),
        ).where(*trend_conditions)
        .group_by(func.date(events.c.occurred_at))
    ).all()
    trend_by_day = {row.day.isoformat(): row for row in trend_rows}
    trends = []
    for offset in range(max(1, (end.date() - trend_start.date()).days)):
        day = (trend_start.date() + timedelta(days=offset)).isoformat()
        row = trend_by_day.get(day)
        trends.append({
            "date": day,
            "total": row.total if row else 0,
            "success": row.success if row else 0,
            "denied": row.denied if row else 0,
            "uniqueUsers": row.uniqueUsers if row else 0,
        })

    top_rows = db.execute(
        select(events.c.action, func.count().label("count"))
        .where(*conditions).group_by(events.c.action).order_by(func.count().desc(), events.c.action.asc()).limit(10)
    ).all()
    security_rows = db.execute(
        filtered.where(events.c.result.in_(("DENIED", "FAILED")))
        .order_by(events.c.occurred_at.desc()).limit(4)
    ).all()

    actions = [row[0] for row in db.execute(select(events.c.action).distinct().order_by(events.c.action)).all()]
    users = [
        {"id": row.id, "name": row.name}
        for row in db.execute(
            select(events.c.actor_id.label("id"), events.c.actor_name.label("name"))
            .where(events.c.actor_id.is_not(None), events.c.actor_name.is_not(None))
            .distinct().order_by(events.c.actor_name)
        ).all()
    ]
    documents = [
        {"id": row.id, "name": row.name}
        for row in db.execute(
            select(events.c.document_id.label("id"), events.c.document_name.label("name"))
            .where(events.c.document_id.is_not(None), events.c.document_name.is_not(None))
            .distinct().order_by(events.c.document_name)
        ).all()
    ]

    return {
        "events": [_as_dict(row) for row in rows],
        "total": count,
        "page": page,
        "pageSize": page_size,
        "pageCount": max(1, (count + page_size - 1) // page_size),
        "metrics": {
            "total": metric_values[0],
            "success": metric_values[1],
            "denied": metric_values[2],
            "uniqueUsers": metric_values[3],
            "previous": {
                "total": previous_total,
                "success": previous_success,
                "denied": previous_denied,
                "uniqueUsers": previous_unique,
            },
        },
        "activity": chart,
        "trends": trends,
        "topActivities": [{"action": row.action, "count": row.count} for row in top_rows],
        "securityEvents": [_as_dict(row) for row in security_rows],
        "filters": {"actions": actions, "users": users, "documents": documents, "results": ["SUCCESS", "DENIED", "FAILED"]},
        "source": "live",
    }


@router.get("/events/{event_id}")
async def get_audit_event(event_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    events = _event_rows()
    selected = db.execute(select(events).where(events.c.id == event_id)).first()
    if selected is None:
        raise HTTPException(status_code=404, detail="Audit event not found.")
    event = _as_dict(selected)
    timeline = [event]
    actor_id = selected._mapping.get("actor_id")
    occurred_at = selected._mapping.get("occurred_at")
    if actor_id:
        prior_rows = db.execute(
            select(events)
            .where(events.c.actor_id == actor_id, events.c.occurred_at <= occurred_at)
            .order_by(events.c.occurred_at.desc(), events.c.id.desc())
            .limit(5)
        ).all()
        following_rows = db.execute(
            select(events)
            .where(events.c.actor_id == actor_id, events.c.occurred_at > occurred_at)
            .order_by(events.c.occurred_at.asc(), events.c.id.asc())
            .limit(1)
        ).all()
        timeline = [_as_dict(row) for row in [*reversed(prior_rows), *following_rows]]
    event["timeline"] = timeline
    return event


@router.get("/export.csv")
async def export_audit_events(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    action: str | None = None,
    actor_id: str | None = None,
    document_id: str | None = None,
    result: str | None = None,
    search: str | None = None,
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    events = _event_rows()
    conditions = _criteria(events, **_list_params(from_date, to_date, action, actor_id, document_id, result, search))
    direction = events.c.occurred_at.desc() if sort == "newest" else events.c.occurred_at.asc()
    rows = db.execute(select(events).where(*conditions).order_by(direction, events.c.id.asc())).yield_per(500)

    def csv_rows():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Timestamp", "Event ID", "Action", "Category", "Actor", "Actor ID", "Role", "Document", "Document ID", "Result", "IP Address", "Request ID"])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for row in rows:
            event = _as_dict(row)
            document = event.get("document") or {}
            writer.writerow([
                event.get("timestamp"), event.get("id"), event.get("action"), event.get("category"),
                event["actor"].get("name"), event["actor"].get("id"), event["actor"].get("role"),
                document.get("name"), document.get("id"), event.get("outcome"), event.get("ipAddress"), event.get("requestId"),
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    return StreamingResponse(
        csv_rows(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=suredocs-audit-events.csv"},
    )
