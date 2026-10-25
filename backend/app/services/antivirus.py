"""Fail-closed ClamAV client for in-memory document scans."""

from __future__ import annotations

import logging
import socket
import struct

from app.core.config import (
    CLAMAV_HOST,
    CLAMAV_PORT,
    CLAMAV_STREAM_CHUNK_BYTES,
    CLAMAV_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class ScannerUnavailableError(RuntimeError):
    """ClamAV could not provide a trustworthy scan verdict."""


class MalwareDetectedError(RuntimeError):
    """ClamAV found malware in the submitted document."""

    def __init__(
        self,
        message: str = "ClamAV detected malware in the document.",
        *,
        detection_name: str | None = None,
    ) -> None:
        super().__init__(message)
        self.detection_name = detection_name


def _read_response(connection: socket.socket) -> str:
    response = bytearray()
    while b"\0" not in response and b"\n" not in response:
        chunk = connection.recv(1024)
        if not chunk:
            raise ScannerUnavailableError("ClamAV closed the scan connection without a verdict.")
        response.extend(chunk)
        if len(response) > 4096:
            raise ScannerUnavailableError("ClamAV returned an oversized response.")
    return bytes(response).split(b"\0", 1)[0].split(b"\n", 1)[0].decode(
        "ascii", errors="replace",
    ).strip()


def get_scanner_version() -> str:
    """Query clamd for daemon and signature database version."""
    try:
        with socket.create_connection(
            (CLAMAV_HOST, CLAMAV_PORT),
            timeout=min(CLAMAV_TIMEOUT_SECONDS, 5.0),
        ) as connection:
            connection.settimeout(min(CLAMAV_TIMEOUT_SECONDS, 5.0))
            connection.sendall(b"zVERSION\0")
            return _read_response(connection)
    except Exception as exc:
        logger.warning("Could not retrieve ClamAV scanner version: %s", exc)
        return "ClamAV (unavailable)"


def ping_scanner() -> bool:
    """Verify clamd daemon is responsive and ready."""
    try:
        with socket.create_connection(
            (CLAMAV_HOST, CLAMAV_PORT),
            timeout=min(CLAMAV_TIMEOUT_SECONDS, 3.0),
        ) as connection:
            connection.settimeout(min(CLAMAV_TIMEOUT_SECONDS, 3.0))
            connection.sendall(b"zPING\0")
            return _read_response(connection) == "PONG"
    except Exception:
        return False


def scan_document_bytes(content: bytes) -> None:
    """Stream bytes to clamd and return only for an explicit clean verdict.

    The daemon connection carries unencrypted data, so deployments should keep
    it on a private container network or loopback-only host binding.
    """
    try:
        with socket.create_connection(
            (CLAMAV_HOST, CLAMAV_PORT),
            timeout=CLAMAV_TIMEOUT_SECONDS,
        ) as connection:
            connection.settimeout(CLAMAV_TIMEOUT_SECONDS)
            connection.sendall(b"zINSTREAM\0")
            for offset in range(0, len(content), CLAMAV_STREAM_CHUNK_BYTES):
                chunk = content[offset : offset + CLAMAV_STREAM_CHUNK_BYTES]
                connection.sendall(struct.pack("!I", len(chunk)))
                connection.sendall(chunk)
            connection.sendall(b"\0\0\0\0")
            response = _read_response(connection)
    except MalwareDetectedError:
        raise
    except ScannerUnavailableError:
        raise
    except (OSError, TimeoutError, struct.error) as exc:
        raise ScannerUnavailableError("ClamAV is unavailable or did not finish scanning.") from exc

    if response.startswith("stream: ") and response.endswith(" OK"):
        return
    if response.startswith("stream: ") and response.endswith(" FOUND"):
        detection = response[8:-6].strip()
        raise MalwareDetectedError(
            f"ClamAV detected malware ({detection}) in the document.",
            detection_name=detection,
        )
    raise ScannerUnavailableError("ClamAV did not return a clean or infected verdict.")


def scan_document_with_verdict(content: bytes) -> tuple[str, str | None, str]:
    """Scan bytes and return (verdict, detection_name, scanner_version).

    Verdicts: 'CLEAN', 'INFECTED', 'SCAN_FAILED'.
    """
    scanner_version = get_scanner_version()
    try:
        scan_document_bytes(content)
        return "CLEAN", None, scanner_version
    except MalwareDetectedError as exc:
        return "INFECTED", getattr(exc, "detection_name", None) or "Malware detected", scanner_version
    except ScannerUnavailableError:
        return "SCAN_FAILED", None, scanner_version
