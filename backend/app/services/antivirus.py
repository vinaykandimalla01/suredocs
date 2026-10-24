"""Fail-closed ClamAV client for in-memory document scans."""

from __future__ import annotations

import socket
import struct

from app.core.config import (
    CLAMAV_HOST,
    CLAMAV_PORT,
    CLAMAV_STREAM_CHUNK_BYTES,
    CLAMAV_TIMEOUT_SECONDS,
)


class ScannerUnavailableError(RuntimeError):
    """ClamAV could not provide a trustworthy scan verdict."""


class MalwareDetectedError(RuntimeError):
    """ClamAV found malware in the submitted document."""


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
        raise MalwareDetectedError("ClamAV detected malware in the document.")
    raise ScannerUnavailableError("ClamAV did not return a clean or infected verdict.")
