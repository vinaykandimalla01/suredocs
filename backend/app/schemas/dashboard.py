"""Minimal, display-safe response models for the administrator dashboard."""

from pydantic import BaseModel


class DashboardUserCounts(BaseModel):
    total: int
    active: int
    disabled: int


class DashboardDocumentCounts(BaseModel):
    total: int


class AdminDashboardSummaryResponse(BaseModel):
    users: DashboardUserCounts
    documents: DashboardDocumentCounts
