"""Authenticated administrator recovery path for pending ClamAV scans."""

from __future__ import annotations

import base64
import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import MAX_DOCUMENT_SIZE_BYTES, S3_BUCKET
from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.documents import Document, DocumentScan, DocumentVersion
from app.models.user import User
from app.schemas.document_scans import (
    PendingDocumentScanBatchResponse,
    PendingDocumentScanResult,
)
from app.services.antivirus import (
    MalwareDetectedError,
    ScannerUnavailableError,
    get_scanner_version,
    ping_scanner,
    scan_document_bytes,
)
from app.services.document_access import record_audit, utc_now
from app.services.s3_storage import (
    StorageUnavailableError,
    copy_document_object,
    delete_document_object,
    get_document as get_s3_document,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/document-scans", tags=["admin-document-scans"])


class ScanSourceIntegrityError(RuntimeError):
    """The stored object does not match the pending version metadata."""


def _quarantine_candidates(version: DocumentVersion) -> list[str]:
    return [
        f"documents/quarantine/{version.document_id}/versions/{version.id}/content",
        f"quarantine/{version.storage_key}",
    ]


def _read_verified_version(version: DocumentVersion) -> tuple[bytes, bool, str | None]:
    if version.storage_bucket != S3_BUCKET:
        raise ScanSourceIntegrityError("The stored version references an unexpected bucket.")

    stored = None
    quarantine_key: str | None = None
    is_quarantined = False
    for qk in _quarantine_candidates(version):
        try:
            stored = get_s3_document(qk, version.s3_version_id)
            is_quarantined = True
            quarantine_key = qk
            break
        except Exception:
            continue

    if stored is None:
        stored = get_s3_document(version.storage_key, version.s3_version_id)

    body = stored["Body"]
    try:
        content = body.read(MAX_DOCUMENT_SIZE_BYTES + 1)
    finally:
        body.close()

    if len(content) > MAX_DOCUMENT_SIZE_BYTES or len(content) != version.size_bytes:
        raise ScanSourceIntegrityError("The stored version size does not match its metadata.")
    if hashlib.sha256(content).hexdigest().casefold() != version.checksum_sha256.casefold():
        raise ScanSourceIntegrityError("The stored version checksum does not match its metadata.")

    stored_checksum = stored.get("Metadata", {}).get("sha256")
    expected_s3_checksum = base64.b64encode(
        bytes.fromhex(version.checksum_sha256),
    ).decode("ascii")
    if stored_checksum and stored_checksum != expected_s3_checksum:
        raise ScanSourceIntegrityError("The S3 checksum metadata does not match the version.")
    return content, is_quarantined, quarantine_key


def _record_scan_event(
    db: Session,
    request: Request,
    *,
    actor: User,
    document: Document,
    version: DocumentVersion,
    result: str,
    details: dict[str, str],
) -> None:
    record_audit(
        db,
        request,
        actor_user_id=actor.id,
        action_type="DOCUMENT_SCAN_COMPLETED",
        result=result,
        document=document,
        details={
            "version_id": str(version.id),
            "version_number": str(version.version_number),
            **details,
        },
    )


@router.post("/pending", response_model=PendingDocumentScanBatchResponse)
async def scan_pending_document_versions(
    request: Request,
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PendingDocumentScanBatchResponse:
    version_ids = db.scalars(
        select(DocumentVersion.id)
        .where(DocumentVersion.status == "PENDING_SCAN")
        .order_by(DocumentVersion.uploaded_at, DocumentVersion.id)
        .limit(limit)
    ).all()

    results: list[PendingDocumentScanResult] = []
    for version_id in version_ids:
        version = db.execute(
            select(DocumentVersion)
            .where(DocumentVersion.id == version_id)
            .with_for_update(skip_locked=True)
        ).scalar_one_or_none()
        if version is None or version.status != "PENDING_SCAN":
            continue

        document = db.execute(
            select(Document)
            .where(Document.id == version.document_id)
            .with_for_update()
        ).scalar_one_or_none()
        if document is None or document.status != "ACTIVE" or document.deleted_at is not None:
            results.append(PendingDocumentScanResult(
                document_id=version.document_id,
                version_id=version.id,
                status="PENDING_SCAN",
                reason="document_inactive",
            ))
            db.rollback()
            continue

        try:
            content, is_quarantined, q_key = await run_in_threadpool(_read_verified_version, version)
            await run_in_threadpool(scan_document_bytes, content)
        except MalwareDetectedError as exc:
            version.status = "QUARANTINED"
            version.scan_completed_at = utc_now()
            detection = getattr(exc, "detection_name", None) or "Malware detected"
            scan_rec = DocumentScan(
                document_id=document.id,
                version_id=version.id,
                scan_status="INFECTED",
                original_filename=version.original_filename,
                file_hash_sha256=version.checksum_sha256,
                file_size_bytes=len(content),
                scanner_name="ClamAV",
                scanner_version=get_scanner_version(),
                detection_name=detection,
                scan_started_at=utc_now(),
                scan_completed_at=utc_now(),
            )
            db.add(scan_rec)
            if is_quarantined and q_key:
                try:
                    await run_in_threadpool(delete_document_object, q_key, version.s3_version_id)
                except Exception as del_exc:
                    logger.warning("Quarantine cleanup: %s", del_exc)
            _record_scan_event(
                db,
                request,
                actor=current_user,
                document=document,
                version=version,
                result="FAILED",
                details={"verdict": "infected", "reason": "malware_detected", "detection": detection},
            )
            db.commit()
            results.append(PendingDocumentScanResult(
                document_id=document.id,
                version_id=version.id,
                status=version.status,
                reason="malware_detected",
            ))
            continue
        except ScannerUnavailableError as exc:
            scan_rec = DocumentScan(
                document_id=document.id,
                version_id=version.id,
                scan_status="SCAN_FAILED",
                original_filename=version.original_filename,
                file_hash_sha256=version.checksum_sha256,
                file_size_bytes=len(content) if 'content' in locals() else version.size_bytes,
                scanner_name="ClamAV",
                failure_reason=str(exc),
                retry_count=1,
                scan_started_at=utc_now(),
                scan_completed_at=utc_now(),
            )
            db.add(scan_rec)
            _record_scan_event(
                db,
                request,
                actor=current_user,
                document=document,
                version=version,
                result="FAILED",
                details={"verdict": "unavailable", "reason": "scanner_unavailable"},
            )
            db.commit()
            results.append(PendingDocumentScanResult(
                document_id=document.id,
                version_id=version.id,
                status=version.status,
                reason="scanner_unavailable",
            ))
            continue
        except (OSError, ScanSourceIntegrityError, StorageUnavailableError):
            _record_scan_event(
                db,
                request,
                actor=current_user,
                document=document,
                version=version,
                result="FAILED",
                details={"verdict": "unavailable", "reason": "source_integrity_or_storage_error"},
            )
            db.commit()
            results.append(PendingDocumentScanResult(
                document_id=document.id,
                version_id=version.id,
                status=version.status,
                reason="source_integrity_or_storage_error",
            ))
            continue

        if is_quarantined and q_key:
            base64_sha256 = base64.b64encode(bytes.fromhex(version.checksum_sha256)).decode("ascii")
            try:
                s3_ver = await run_in_threadpool(
                    copy_document_object,
                    q_key,
                    version.storage_key,
                    content_type=version.content_type,
                    checksum_sha256=base64_sha256,
                    source_version_id=version.s3_version_id,
                )
            except Exception:
                s3_ver = await run_in_threadpool(
                    get_s3_document,
                    version.storage_key,
                    version.s3_version_id,
                )
            if s3_ver and isinstance(s3_ver, str):
                version.s3_version_id = s3_ver
            try:
                await run_in_threadpool(delete_document_object, q_key, version.s3_version_id)
            except Exception:
                pass

        version.status = "AVAILABLE"
        version.scan_completed_at = utc_now()
        scan_rec = DocumentScan(
            document_id=document.id,
            version_id=version.id,
            scan_status="CLEAN",
            original_filename=version.original_filename,
            file_hash_sha256=version.checksum_sha256,
            file_size_bytes=len(content),
            scanner_name="ClamAV",
            scanner_version=get_scanner_version(),
            scan_started_at=utc_now(),
            scan_completed_at=utc_now(),
        )
        db.add(scan_rec)
        current_version = (
            db.get(DocumentVersion, document.current_version_id)
            if document.current_version_id is not None
            else None
        )
        if current_version is None or current_version.version_number < version.version_number:
            document.current_version_id = version.id
            document.updated_at = utc_now()
        _record_scan_event(
            db,
            request,
            actor=current_user,
            document=document,
            version=version,
            result="SUCCESS",
            details={"verdict": "clean"},
        )
        db.commit()
        results.append(PendingDocumentScanResult(
            document_id=document.id,
            version_id=version.id,
            status=version.status,
        ))

    available = sum(result.status == "AVAILABLE" for result in results)
    quarantined = sum(result.status == "QUARANTINED" for result in results)
    pending = sum(result.status == "PENDING_SCAN" for result in results)
    return PendingDocumentScanBatchResponse(
        processed=len(results),
        available=available,
        quarantined=quarantined,
        still_pending=pending,
        results=results,
    )


@router.get("/status")
async def get_clamav_status(current_user: User = Depends(require_admin)):
    """Operational status and signature database version of ClamAV daemon."""
    ready = ping_scanner()
    version = get_scanner_version() if ready else "unavailable"
    return {
        "status": "ready" if ready else "unavailable",
        "scanner_name": "ClamAV",
        "version": version,
    }


@router.get("")
async def list_document_scans(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List historical ClamAV scan records for security auditing."""
    query = select(DocumentScan).order_by(DocumentScan.created_at.desc())
    if status:
        query = query.where(DocumentScan.scan_status == status.upper())
    total = db.scalar(select(func.count(DocumentScan.id))) or 0
    scans = db.scalars(query.offset(offset).limit(limit)).all()
    return {
        "items": [
            {
                "id": str(s.id),
                "document_id": str(s.document_id),
                "version_id": str(s.version_id) if s.version_id else None,
                "scan_status": s.scan_status,
                "original_filename": s.original_filename,
                "file_hash_sha256": s.file_hash_sha256,
                "file_size_bytes": s.file_size_bytes,
                "scanner_name": s.scanner_name,
                "scanner_version": s.scanner_version,
                "detection_name": s.detection_name,
                "failure_reason": s.failure_reason,
                "retry_count": s.retry_count,
                "scan_started_at": s.scan_started_at.isoformat() if s.scan_started_at else None,
                "scan_completed_at": s.scan_completed_at.isoformat() if s.scan_completed_at else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in scans
        ],
        "total": total,
    }


@router.post("/{document_id}/retry")
async def retry_document_scan(
    document_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retry scanning a specific document whose scan failed or is pending."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    version = db.execute(
        select(DocumentVersion)
        .where(
            DocumentVersion.document_id == doc.id,
            DocumentVersion.status.in_(["PENDING_SCAN", "FAILED"]),
        )
        .order_by(DocumentVersion.version_number.desc())
    ).scalars().first()

    if version is None:
        raise HTTPException(
            status_code=400,
            detail="Document has no pending or failed version eligible for scan retry.",
        )

    try:
        content, is_quarantined, q_key = await run_in_threadpool(_read_verified_version, version)
        await run_in_threadpool(scan_document_bytes, content)
    except MalwareDetectedError as exc:
        version.status = "QUARANTINED"
        version.scan_completed_at = utc_now()
        detection = getattr(exc, "detection_name", None) or "Malware detected"
        scan_rec = DocumentScan(
            document_id=doc.id,
            version_id=version.id,
            scan_status="INFECTED",
            original_filename=version.original_filename,
            file_hash_sha256=version.checksum_sha256,
            file_size_bytes=len(content),
            scanner_name="ClamAV",
            scanner_version=get_scanner_version(),
            detection_name=detection,
            scan_started_at=utc_now(),
            scan_completed_at=utc_now(),
        )
        db.add(scan_rec)
        db.commit()
        return {"status": "QUARANTINED", "message": f"Malware detected: {detection}"}
    except ScannerUnavailableError as exc:
        return {"status": "PENDING_SCAN", "message": f"Scanner unavailable: {exc}"}

    if is_quarantined and q_key:
        base64_sha256 = base64.b64encode(bytes.fromhex(version.checksum_sha256)).decode("ascii")
        try:
            s3_ver = await run_in_threadpool(
                copy_document_object,
                q_key,
                version.storage_key,
                content_type=version.content_type,
                checksum_sha256=base64_sha256,
                source_version_id=version.s3_version_id,
            )
            if s3_ver:
                version.s3_version_id = s3_ver
        except Exception:
            pass
        try:
            await run_in_threadpool(delete_document_object, q_key, version.s3_version_id)
        except Exception:
            pass

    version.status = "AVAILABLE"
    version.scan_completed_at = utc_now()
    doc.current_version_id = version.id
    doc.updated_at = utc_now()
    scan_rec = DocumentScan(
        document_id=doc.id,
        version_id=version.id,
        scan_status="CLEAN",
        original_filename=version.original_filename,
        file_hash_sha256=version.checksum_sha256,
        file_size_bytes=len(content),
        scanner_name="ClamAV",
        scanner_version=get_scanner_version(),
        scan_started_at=utc_now(),
        scan_completed_at=utc_now(),
    )
    db.add(scan_rec)
    db.commit()
    return {"status": "AVAILABLE", "message": "Scan passed and document is now available."}
