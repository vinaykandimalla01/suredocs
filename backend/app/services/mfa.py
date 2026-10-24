"""TOTP helpers with MFA secrets encrypted by AWS KMS at rest."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets
import struct
import time
from urllib.parse import quote

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from app.core.config import AWS_MFA_KMS_KEY_ID, AWS_REGION

logger = logging.getLogger(__name__)


class MfaServiceUnavailable(RuntimeError):
    """KMS is not configured or cannot protect an MFA secret."""


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def encrypt_totp_secret(secret: str) -> bytes:
    if not AWS_MFA_KMS_KEY_ID:
        raise MfaServiceUnavailable("MFA encryption is not configured.")
    try:
        result = boto3.client("kms", region_name=AWS_REGION).encrypt(
            KeyId=AWS_MFA_KMS_KEY_ID,
            Plaintext=base64.b32decode(secret + "=" * (-len(secret) % 8)),
        )
        return result["CiphertextBlob"]
    except (BotoCoreError, ClientError, NoCredentialsError, KeyError, ValueError) as exc:
        logger.error("MFA secret encryption failed (%s)", type(exc).__name__)
        raise MfaServiceUnavailable("MFA encryption is unavailable.") from exc


def decrypt_totp_secret(ciphertext: bytes) -> str:
    if not AWS_MFA_KMS_KEY_ID:
        raise MfaServiceUnavailable("MFA encryption is not configured.")
    try:
        result = boto3.client("kms", region_name=AWS_REGION).decrypt(
            KeyId=AWS_MFA_KMS_KEY_ID,
            CiphertextBlob=bytes(ciphertext),
        )
        return base64.b32encode(result["Plaintext"]).decode("ascii").rstrip("=")
    except (BotoCoreError, ClientError, NoCredentialsError, KeyError, ValueError) as exc:
        logger.error("MFA secret decryption failed (%s)", type(exc).__name__)
        raise MfaServiceUnavailable("MFA verification is unavailable.") from exc


def totp_counter_at(timestamp: float | None = None) -> int:
    return int((time.time() if timestamp is None else timestamp) // 30)


def _totp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 1_000_000:06d}"


def verify_totp(secret: str, code: str, *, last_used_counter: int | None = None) -> int | None:
    if not code.isdigit() or len(code) != 6:
        return None
    current = totp_counter_at()
    for counter in (current - 1, current, current + 1):
        if counter >= 0 and (last_used_counter is None or counter > last_used_counter):
            if hmac.compare_digest(_totp(secret, counter), code):
                return counter
    return None


def provisioning_uri(secret: str, email: str) -> str:
    issuer = "SureDocs"
    label = quote(f"{issuer}:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
        "&algorithm=SHA1&digits=6&period=30"
    )
