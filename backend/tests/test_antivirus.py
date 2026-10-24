from __future__ import annotations

import struct

import pytest

from app.services.antivirus import (
    MalwareDetectedError,
    ScannerUnavailableError,
    scan_document_bytes,
)


class FakeSocket:
    def __init__(self, response: bytes) -> None:
        self.response = response
        self.sent: list[bytes] = []
        self.timeout: float | None = None

    def __enter__(self) -> "FakeSocket":
        return self

    def __exit__(self, *args) -> None:
        return None

    def settimeout(self, timeout: float) -> None:
        self.timeout = timeout

    def sendall(self, value: bytes) -> None:
        self.sent.append(value)

    def recv(self, size: int) -> bytes:
        response, self.response = self.response, b""
        return response


def _decode_stream(parts: list[bytes]) -> tuple[bytes, int]:
    assert parts[0] == b"zINSTREAM\0"
    wire = b"".join(parts[1:])
    offset = 0
    chunks: list[bytes] = []
    while True:
        size = struct.unpack("!I", wire[offset : offset + 4])[0]
        offset += 4
        if size == 0:
            break
        chunks.append(wire[offset : offset + size])
        offset += size
    assert offset == len(wire)
    return b"".join(chunks), len(chunks)


def test_scan_document_bytes_sends_chunked_instream_and_accepts_clean_verdict(monkeypatch):
    content = b"a" * (128 * 1024 + 17)
    fake = FakeSocket(b"stream: OK\0")
    monkeypatch.setattr("app.services.antivirus.CLAMAV_HOST", "127.0.0.1")
    monkeypatch.setattr("app.services.antivirus.CLAMAV_PORT", 3310)
    monkeypatch.setattr("app.services.antivirus.CLAMAV_STREAM_CHUNK_BYTES", 64 * 1024)
    monkeypatch.setattr("app.services.antivirus.socket.create_connection", lambda *args, **kwargs: fake)

    scan_document_bytes(content)

    streamed, chunk_count = _decode_stream(fake.sent)
    assert streamed == content
    assert chunk_count == 3


def test_scan_document_bytes_raises_for_infected_verdict(monkeypatch):
    fake = FakeSocket(b"stream: Eicar-Test-Signature FOUND\0")
    monkeypatch.setattr("app.services.antivirus.socket.create_connection", lambda *args, **kwargs: fake)

    with pytest.raises(MalwareDetectedError):
        scan_document_bytes(b"eicar test")


def test_scan_document_bytes_fails_closed_when_daemon_is_unavailable(monkeypatch):
    def unavailable(*args, **kwargs):
        raise TimeoutError("timeout")

    monkeypatch.setattr("app.services.antivirus.socket.create_connection", unavailable)

    with pytest.raises(ScannerUnavailableError):
        scan_document_bytes(b"document")
