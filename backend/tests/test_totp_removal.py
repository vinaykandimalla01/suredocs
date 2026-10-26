from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

from app.main import app
from app.models import persistence
from app.schemas.auth import LoginRequest
from app.schemas.users import EmployeeMyProfileResponse


def test_login_schema_has_only_password_credentials():
    assert set(LoginRequest.model_fields) == {"email", "password"}


def test_active_totp_models_routes_and_response_fields_are_absent():
    assert not hasattr(persistence, "UserMfaMethod")
    assert "two_factor_enabled" not in EmployeeMyProfileResponse.model_fields

    openapi = app.openapi()
    route_paths = set(openapi["paths"])
    assert "/api/auth/login" in route_paths
    assert not any("/2fa" in path.lower() or "totp" in path.lower() for path in route_paths)

    login_schema = openapi["components"]["schemas"]["LoginRequest"]
    assert set(login_schema["properties"]) == {"email", "password"}


def test_application_imports_without_totp_configuration():
    environment = os.environ.copy()
    for name in (
        "AWS_MFA_KMS_KEY_ID",
        "SUREDOCS_MFA_KMS_KEY_ID",
        "DATABASE_URL",
        "DATABASE_URL_UNPOOLED",
        "DB_PASSWORD",
        "SUREDOCS_DB_HOST",
        "SUREDOCS_DB_PORT",
        "SUREDOCS_DB_USER",
        "SUREDOCS_DB_NAME",
    ):
        environment.pop(name, None)
    environment["VERCEL"] = "1"
    environment["SESSION_SECRET"] = "test-session-secret-that-is-at-least-32-chars"
    environment["SUREDOCS_S3_BUCKET"] = "suredocs-private-test"

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.main import app; from app.core import config; "
            "assert app is not None; assert not hasattr(config, 'AWS_MFA_KMS_KEY_ID')",
        ],
        cwd=Path(__file__).resolve().parents[1],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
