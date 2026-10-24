"""Responses for administrator initiated pending document scans."""

from __future__ import annotations

import uuid

from pydantic import BaseModel


class PendingDocumentScanResult(BaseModel):
    document_id: uuid.UUID
    version_id: uuid.UUID
    status: str
    reason: str | None = None


class PendingDocumentScanBatchResponse(BaseModel):
    processed: int
    available: int
    quarantined: int
    still_pending: int
    results: list[PendingDocumentScanResult]
