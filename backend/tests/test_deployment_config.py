from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.core import config


def test_session_secret_uses_environment_value(monkeypatch):
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setenv("SESSION_SECRET", "s" * 48)

    assert config._load_or_create_session_secret() == "s" * 48


def test_production_requires_a_strong_session_secret(monkeypatch):
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.delenv("SESSION_SECRET", raising=False)

    with pytest.raises(RuntimeError, match="SESSION_SECRET is required"):
        config._load_or_create_session_secret()

    monkeypatch.setenv("SESSION_SECRET", "too-short")
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        config._load_or_create_session_secret()


def test_local_session_secret_still_uses_secret_file(monkeypatch, tmp_path):
    secret_path = tmp_path / "session_secret.txt"
    secret_path.write_text("local-secret", encoding="utf-8")
    monkeypatch.setattr(config, "IS_PRODUCTION", False)
    monkeypatch.setattr(config, "_SESSION_SECRET_PATH", secret_path)
    monkeypatch.delenv("SESSION_SECRET", raising=False)

    assert config._load_or_create_session_secret() == "local-secret"


def test_database_password_uses_environment_in_production(monkeypatch):
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setenv("DB_PASSWORD", "test-only-database-password")

    assert config._load_database_password() == "test-only-database-password"

    monkeypatch.delenv("DB_PASSWORD")
    assert config._load_database_password() is None


def test_database_password_keeps_local_secret_file_fallback(monkeypatch, tmp_path):
    secret_path = tmp_path / "suredocs_app_password.txt"
    secret_path.write_text("local-only-test-password", encoding="utf-8")
    monkeypatch.setattr(config, "IS_PRODUCTION", False)
    monkeypatch.setattr(
        config, "_read_secret_file", lambda _: secret_path.read_text().strip()
    )
    monkeypatch.delenv("DB_PASSWORD", raising=False)

    assert config._load_database_password() == "local-only-test-password"


def _production_environment() -> dict[str, str]:
    env = os.environ.copy()
    for name in (
        "DB_PASSWORD",
        "DATABASE_URL",
        "DATABASE_URL_UNPOOLED",
        "SESSION_SECRET",
        "SUREDOCS_DB_USER",
        "SUREDOCS_DB_HOST",
        "SUREDOCS_DB_PORT",
        "SUREDOCS_DB_NAME",
        "SUREDOCS_CORS_ORIGINS",
        "SUREDOCS_ENVIRONMENT",
        "VERCEL",
        "VERCEL_ENV",
    ):
        env.pop(name, None)
    env["VERCEL"] = "1"
    return env


def _run_backend_snippet(
    code: str, env: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    backend_root = Path(__file__).resolve().parents[1]
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )


def test_production_app_imports_without_database_or_secret_files():
    env = _production_environment()
    env["SESSION_SECRET"] = "s" * 48
    result = _run_backend_snippet(
        "from fastapi.testclient import TestClient\n"
        "from app.main import app\n"
        "from app.db.session import engine\n"
        "assert engine is None\n"
        "response = TestClient(app).get('/api/auth/health')\n"
        "assert response.status_code == 503, response.text\n"
        "assert 'SUREDOCS_DB_HOST' in response.json()['detail']\n"
        "print('import=ok database=unconfigured response=503')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "import=ok database=unconfigured response=503" in result.stdout


def test_production_import_reports_missing_session_secret():
    result = _run_backend_snippet(
        "try:\n"
        "    import app.main\n"
        "except RuntimeError as exc:\n"
        "    assert 'SESSION_SECRET' in str(exc)\n"
        "    print('missing SESSION_SECRET reported')\n"
        "else:\n"
        "    raise AssertionError('production import accepted missing SESSION_SECRET')\n",
        _production_environment(),
    )

    assert result.returncode == 0, result.stderr
    assert "missing SESSION_SECRET reported" in result.stdout


def test_vercel_production_env_loads_secret_without_writing_files():
    env = _production_environment()
    env.pop("VERCEL")
    env["VERCEL_ENV"] = "production"
    env["SESSION_SECRET"] = "s" * 48
    result = _run_backend_snippet(
        "from pathlib import Path\n"
        "def reject_write_text(*args, **kwargs):\n"
        "    raise AssertionError('production attempted to write a secret file')\n"
        "Path.write_text = reject_write_text\n"
        "from app.core import config\n"
        "assert config.IS_PRODUCTION\n"
        "assert config.SESSION_SECRET == 's' * 48\n"
        "print('VERCEL_ENV production secret loaded without file writes')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "VERCEL_ENV production secret loaded without file writes" in result.stdout


def test_vercel_production_without_secret_fails_without_writing_files():
    env = _production_environment()
    env.pop("VERCEL")
    env["VERCEL_ENV"] = "production"
    result = _run_backend_snippet(
        "from pathlib import Path\n"
        "def reject_write_text(*args, **kwargs):\n"
        "    raise AssertionError('production attempted to write a secret file')\n"
        "Path.write_text = reject_write_text\n"
        "try:\n"
        "    import app.main\n"
        "except RuntimeError as exc:\n"
        "    assert 'SESSION_SECRET is required' in str(exc)\n"
        "    print('missing production SESSION_SECRET rejected without file writes')\n"
        "else:\n"
        "    raise AssertionError('production import accepted missing SESSION_SECRET')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "missing production SESSION_SECRET rejected without file writes" in result.stdout


def test_production_database_uses_configured_host_and_environment_password():
    env = _production_environment()
    env.update(
        {
            "SESSION_SECRET": "s" * 48,
            "SUREDOCS_DB_USER": "deployment-test-user",
            "SUREDOCS_DB_HOST": "database.example.test",
            "SUREDOCS_DB_PORT": "6543",
            "SUREDOCS_DB_NAME": "deployment_test",
            "DB_PASSWORD": "test-only-database-password",
        }
    )
    result = _run_backend_snippet(
        "from app.db.session import engine\n"
        "assert engine is not None\n"
        "assert engine.url.username == 'deployment-test-user'\n"
        "assert engine.url.host == 'database.example.test'\n"
        "assert engine.url.port == 6543\n"
        "assert engine.url.database == 'deployment_test'\n"
        "assert engine.url.password == 'test-only-database-password'\n"
        "print('configured non-local database settings accepted')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "configured non-local database settings accepted" in result.stdout


def test_neon_pooled_database_url_is_supported_in_production():
    env = _production_environment()
    env.update(
        {
            "SESSION_SECRET": "s" * 48,
            "DATABASE_URL": (
                "postgresql://deployment-test-user:test-only-password@"
                "ep-test-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
            ),
            "DATABASE_URL_UNPOOLED": (
                "postgresql://deployment-test-user:test-only-password@"
                "ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require"
            ),
        }
    )
    result = _run_backend_snippet(
        "from app.core.config import DATABASE_URL_UNPOOLED\n"
        "from app.db.session import engine\n"
        "assert engine is not None\n"
        "assert engine.url.drivername == 'postgresql+psycopg'\n"
        "assert engine.url.host == 'ep-test-pooler.us-east-2.aws.neon.tech'\n"
        "assert DATABASE_URL_UNPOOLED is not None\n"
        "print('Neon pooled PostgreSQL URL accepted')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "Neon pooled PostgreSQL URL accepted" in result.stdout


def test_production_rejects_localhost_database_url():
    env = _production_environment()
    env.update(
        {
            "SESSION_SECRET": "s" * 48,
            "DATABASE_URL": "postgresql://user:password@localhost:5432/suredocs",
        }
    )
    result = _run_backend_snippet(
        "try:\n"
        "    import app.core.config\n"
        "except RuntimeError as exc:\n"
        "    assert 'hosted PostgreSQL' in str(exc)\n"
        "    print('local production database rejected')\n"
        "else:\n"
        "    raise AssertionError('production accepted localhost PostgreSQL')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "local production database rejected" in result.stdout


def test_cors_accepts_explicit_production_and_local_origins():
    env = _production_environment()
    env["SESSION_SECRET"] = "s" * 48
    env["SUREDOCS_CORS_ORIGINS"] = (
        "https://frontend.example.test,http://localhost:5173"
    )
    result = _run_backend_snippet(
        "from fastapi.testclient import TestClient\n"
        "from app.core.config import CORS_ORIGINS\n"
        "from app.main import app\n"
        "assert CORS_ORIGINS == "
        "['https://frontend.example.test', 'http://localhost:5173']\n"
        "client = TestClient(app)\n"
        "headers = {'Origin': 'https://frontend.example.test', "
        "'Access-Control-Request-Method': 'GET'}\n"
        "response = client.options('/api/auth/health', headers=headers)\n"
        "assert response.headers.get('access-control-allow-origin') == headers['Origin']\n"
        "headers['Origin'] = 'https://not-allowed.example.test'\n"
        "response = client.options('/api/auth/health', headers=headers)\n"
        "assert 'access-control-allow-origin' not in response.headers\n"
        "print('explicit CORS origins accepted; unlisted origin rejected')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "explicit CORS origins accepted; unlisted origin rejected" in result.stdout


def test_local_cors_origins_keep_development_defaults():
    env = _production_environment()
    env.pop("VERCEL")
    env["SESSION_SECRET"] = "local-test-session-secret"
    result = _run_backend_snippet(
        "from app.core.config import CORS_ORIGINS\n"
        "assert CORS_ORIGINS == "
        "['http://localhost:5173', 'http://127.0.0.1:5173']\n"
        "print('local CORS defaults preserved')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "local CORS defaults preserved" in result.stdout


def test_production_database_never_falls_back_to_localhost_without_password():
    env = _production_environment()
    env.update(
        {
            "SESSION_SECRET": "s" * 48,
            "SUREDOCS_DB_USER": "deployment-test-user",
            "SUREDOCS_DB_HOST": "database.example.test",
            "SUREDOCS_DB_NAME": "deployment_test",
        }
    )
    result = _run_backend_snippet(
        "from app.core.config import DB_HOST\n"
        "from app.db.session import engine\n"
        "assert DB_HOST == 'database.example.test'\n"
        "assert engine is None\n"
        "print('missing production password does not use a local database')\n",
        env,
    )

    assert result.returncode == 0, result.stderr
    assert "missing production password does not use a local database" in result.stdout
