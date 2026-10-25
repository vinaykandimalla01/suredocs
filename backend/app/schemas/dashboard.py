"""Display-safe response models for the administrator dashboard."""

from datetime import date, datetime

from pydantic import BaseModel


class DashboardUserCounts(BaseModel):
    total: int
    active: int
    disabled: int


class DashboardDocumentCounts(BaseModel):
    total: int


class DashboardMetricTrend(BaseModel):
    change: int
    change_percent: float | None
    points: list[int]


class DashboardTrends(BaseModel):
    users: DashboardMetricTrend
    active: DashboardMetricTrend
    disabled: DashboardMetricTrend
    documents: DashboardMetricTrend


class AdminDashboardSummaryResponse(BaseModel):
    users: DashboardUserCounts
    documents: DashboardDocumentCounts
    period_days: int
    as_of: datetime
    trends: DashboardTrends


class StorageCategory(BaseModel):
    key: str
    label: str
    files: int
    bytes: int
    percent: float


class AdminDashboardStorageResponse(BaseModel):
    period_days: int
    total_bytes: int
    added_bytes: int
    growth_percent: float | None
    logical_documents: int
    categories: list[StorageCategory]
    metadata_source: str
    as_of: datetime


class DeniedRequestDay(BaseModel):
    date: date
    count: int


class AdminDeniedRequestsResponse(BaseModel):
    period_days: int
    denied: int
    total_access_attempts: int
    unique_users: int
    distinct_documents: int
    denial_percent: float | None
    daily: list[DeniedRequestDay]


class OperationDay(BaseModel):
    date: date
    success: int
    denied: int


class OperationTypeSummary(BaseModel):
    key: str
    label: str
    success: int
    denied: int


class OperationTotals(BaseModel):
    success: int
    denied: int
    total: int
    previous_success: int
    previous_denied: int
    previous_total: int
    success_change_percent: float | None
    denied_change_percent: float | None
    total_change_percent: float | None


class AdminOperationsResponse(BaseModel):
    period_days: int
    operation: str
    totals: OperationTotals
    daily: list[OperationDay]
    by_type: list[OperationTypeSummary]
