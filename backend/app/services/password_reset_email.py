"""Password-reset email delivery using the configured SMTP relay."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlencode, urlsplit, urlunsplit

from app.core.config import (
    PUBLIC_APP_URL,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
)


class PasswordResetEmailConfigurationError(RuntimeError):
    """Raised when secure password-reset email delivery is not configured."""


def ensure_password_reset_email_configured() -> None:
    if not SMTP_HOST or not SMTP_FROM_EMAIL or not PUBLIC_APP_URL:
        raise PasswordResetEmailConfigurationError(
            "Configure SUREDOCS_SMTP_HOST, SUREDOCS_SMTP_FROM_EMAIL, and SUREDOCS_PUBLIC_APP_URL."
        )
    if bool(SMTP_USERNAME) != bool(SMTP_PASSWORD):
        raise PasswordResetEmailConfigurationError(
            "Configure both SUREDOCS_SMTP_USERNAME and SUREDOCS_SMTP_PASSWORD, or neither."
        )
    parsed = urlsplit(PUBLIC_APP_URL)
    is_local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (
        parsed.scheme not in ({"https", "http"} if is_local else {"https"})
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise PasswordResetEmailConfigurationError(
            "SUREDOCS_PUBLIC_APP_URL must be a trusted HTTPS application origin."
        )


def _password_reset_url(token: str) -> str:
    ensure_password_reset_email_configured()
    parsed = urlsplit(PUBLIC_APP_URL or "")
    return urlunsplit((
        parsed.scheme,
        parsed.netloc,
        "/reset-password",
        urlencode({"token": token}),
        "",
    ))


def send_password_reset_email(email: str, token: str) -> None:
    """Send a one-time reset link without logging the recipient or token."""
    ensure_password_reset_email_configured()
    reset_url = _password_reset_url(token)
    message = EmailMessage()
    message["Subject"] = "SureDocs Password Reset"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        "Hello,\n\n"
        "We received a request to reset the password for your SureDocs account.\n\n"
        "Use the secure link below to choose a new password. For your security, "
        "this link expires after a limited time and can only be used once.\n\n"
        f"{reset_url}\n\n"
        "If you did not request a password reset, you can ignore this email.\n\n"
        "SureDocs Security Team\n"
    )

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        if SMTP_USERNAME and SMTP_PASSWORD:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)
