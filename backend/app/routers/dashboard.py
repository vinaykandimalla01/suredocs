"""Database-backed summary metrics for the administrator dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.documents import Document
from app.models.user import AccountStatus, User
from app.schemas.dashboard import (
    AdminDashboardSummaryResponse,
    DashboardDocumentCounts,
    DashboardUserCounts,
)

router = APIRouter(
    prefix="/api/admin/dashboard",
    tags=["admin-dashboard"],
    dependencies=[Depends(require_admin)],
)


@router.get("/summary", response_model=AdminDashboardSummaryResponse)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
) -> AdminDashboardSummaryResponse:
    """Return counts only; account records have no deleted status in this schema."""
    total_users = select(func.count()).select_from(User).scalar_subquery()
    active_users = (
        select(func.count())
        .select_from(User)
        .where(User.account_status == AccountStatus.ACTIVE)
        .scalar_subquery()
    )
    disabled_users = (
        select(func.count())
        .select_from(User)
        .where(User.account_status == AccountStatus.DISABLED)
        .scalar_subquery()
    )
    active_documents = (
        select(func.count())
        .select_from(Document)
        .where(Document.status != "DELETED")
        .scalar_subquery()
    )
    row = db.execute(
        select(total_users, active_users, disabled_users, active_documents)
    ).one()

    return AdminDashboardSummaryResponse(
        users=DashboardUserCounts(total=row[0], active=row[1], disabled=row[2]),
        documents=DashboardDocumentCounts(total=row[3]),
    )
