"""
SureDocs CLI — administrative commands.

Usage:
    python -m app.cli create-admin
"""

from __future__ import annotations

import getpass
import argparse
import os
import re
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select, text

from app.core.config import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH
from app.core.security import hash_password, verify_password
from app.core.config import DB_HOST, DB_NAME, DB_PORT, DB_USERNAME, PROJECT_ROOT
from app.db.session import SessionLocal, engine
from app.models.user import AccountStatus, User, UserRole


def _validate_email(email: str) -> str | None:
    """Basic email validation; returns normalized email or None."""
    email = email.strip().lower()
    if not email:
        return None
    # Simple pattern — full RFC 5322 validation is not the goal here.
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return None
    if len(email) > 320:
        return None
    return email


def _validate_password(password: str) -> str | None:
    """Validate password length. Returns error message or None."""
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters."
    if len(password) > PASSWORD_MAX_LENGTH:
        return f"Password must be at most {PASSWORD_MAX_LENGTH} characters."
    return None


def create_admin() -> None:
    """Interactive bootstrap command to create the initial administrator."""
    print("\n=== SureDocs — Create Initial Administrator ===\n")

    db = SessionLocal()
    try:
        # Refuse to create additional bootstrap admins if one already exists
        existing_admin = db.execute(
            select(User).where(User.role == UserRole.ADMIN)
        ).scalar_one_or_none()

        if existing_admin is not None:
            print(
                "ERROR: An administrator account already exists.\n"
                "Use the administrative interface to create additional accounts.\n"
            )
            sys.exit(1)

        # Collect full name
        full_name = input("Full name: ").strip()
        if not full_name or len(full_name) > 150:
            print("ERROR: Full name is required (max 150 characters).")
            sys.exit(1)

        # Collect and validate email
        raw_email = input("Work email: ").strip()
        email = _validate_email(raw_email)
        if email is None:
            print("ERROR: Invalid email address.")
            sys.exit(1)

        # Check for duplicate email
        duplicate = db.execute(
            select(User).where(func.lower(User.email) == email)
        ).scalar_one_or_none()
        if duplicate is not None:
            print("ERROR: An account with this email already exists.")
            sys.exit(1)

        # Collect and validate password (hidden input)
        password = getpass.getpass("Password: ")
        error = _validate_password(password)
        if error:
            print(f"ERROR: {error}")
            sys.exit(1)

        password_confirm = getpass.getpass("Confirm password: ")
        if password != password_confirm:
            print("ERROR: Passwords do not match.")
            sys.exit(1)

        # Hash and create
        now = datetime.now(timezone.utc)
        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            email_verified_at=now,  # Trusted bootstrap procedure
            created_at=now,
            updated_at=now,
            password_changed_at=now,
            created_by=None,  # Initial admin has no creator
        )
        db.add(user)
        db.commit()

        print(f"\nAdministrator account created successfully.")
        print(f"  Name:  {user.full_name}")
        print(f"  Email: {user.email}")
        print(f"  Role:  {user.role.value}")
        print(f"  ID:    {user.id}\n")
    finally:
        db.close()


_DEMO_USERS = (
    {"full_name": "SureDocs Demo Administrator", "email": "admin.demo@example.com",
     "role": UserRole.ADMIN, "secret_file": "demo_admin_password.txt"},
    {"full_name": "SureDocs Demo Employee", "email": "employee.demo@example.com",
     "role": UserRole.EMPLOYEE, "secret_file": "demo_employee_password.txt"},
)


def _check_development_database() -> None:
    """Require explicit development intent and identify the local SureDocs DB."""
    if os.getenv("SUREDOCS_ENV", "").strip().lower() != "development":
        raise RuntimeError("Set SUREDOCS_ENV=development for this command.")
    if os.getenv("SUREDOCS_DEVELOPMENT_DATABASE_ID", "") != "local-suredocs-compose":
        raise RuntimeError(
            "Set SUREDOCS_DEVELOPMENT_DATABASE_ID=local-suredocs-compose only "
            "after confirming this is the local SureDocs Compose database."
        )
    if (DB_HOST, DB_PORT, DB_NAME, DB_USERNAME) != ("127.0.0.1", 5432, "suredocs", "suredocs_app"):
        raise RuntimeError("Refusing to seed: unexpected configured database target.")
    with engine.connect() as connection:
        identity = connection.execute(
            text("SELECT current_database(), current_user, inet_server_port()")
        ).one()
    if tuple(identity) != ("suredocs", "suredocs_app", 5432):
        raise RuntimeError(f"Refusing unexpected database identity: {identity!r}")


def seed_demo_users(confirm_development: bool) -> None:
    """Create the two local demo users without taking over existing accounts."""
    if not confirm_development:
        raise RuntimeError("Pass --confirm-development to seed demo accounts.")
    _check_development_database()

    secret_dir = PROJECT_ROOT / "secrets"
    paths = {spec["email"]: secret_dir / spec["secret_file"] for spec in _DEMO_USERS}
    passwords: dict[str, str] = {}
    for spec in _DEMO_USERS:
        path = paths[spec["email"]]
        if path.exists():
            password = path.read_text(encoding="utf-8").strip()
            if _validate_password(password) or len(password) < 24:
                raise RuntimeError(f"Invalid password file: {path}")
            passwords[spec["email"]] = password

    db = SessionLocal()
    newly_written: list[Path] = []
    try:
        with db.begin():
            found = {
                spec["email"]: db.execute(
                    select(User).where(func.lower(User.email) == spec["email"])
                ).scalar_one_or_none()
                for spec in _DEMO_USERS
            }
            count = sum(user is not None for user in found.values())
            if count == 1:
                raise RuntimeError(
                    "Only one demo account exists. This partial seed requires manual "
                    "review; no account data was changed."
                )
            if count == 2:
                admin = found[_DEMO_USERS[0]["email"]]
                for spec in _DEMO_USERS:
                    user = found[spec["email"]]
                    if not paths[spec["email"]].is_file():
                        raise RuntimeError(
                            f"Existing demo account {spec['email']} has no local credential "
                            "file; refusing to reset or guess its password."
                        )
                    expected_creator = admin.id if spec["role"] == UserRole.EMPLOYEE else None
                    if (
                        user.full_name != spec["full_name"]
                        or user.email != spec["email"]
                        or user.role != spec["role"]
                        or user.account_status != AccountStatus.ACTIVE
                        or user.email_verified_at is None
                        or user.created_by != expected_creator
                        or not user.password_hash
                        or not verify_password(passwords[spec["email"]], user.password_hash)
                    ):
                        raise RuntimeError(
                            f"Existing record {spec['email']} conflicts with managed demo "
                            "configuration; no account data was changed."
                        )
                print("Both demo accounts already exist and match their local credentials.")
                return

            # Keep the only plaintext credential copy durable before committing users.
            for spec in _DEMO_USERS:
                email = spec["email"]
                if email not in passwords:
                    password = secrets.token_urlsafe(32)
                    if _validate_password(password):
                        raise RuntimeError("Generated password violates configured policy.")
                    path = paths[email]
                    with path.open("x", encoding="utf-8") as handle:
                        handle.write(password + "\n")
                    newly_written.append(path)
                    passwords[email] = password

            now = datetime.now(timezone.utc)
            admin = User(
                full_name=_DEMO_USERS[0]["full_name"], email=_DEMO_USERS[0]["email"],
                password_hash=hash_password(passwords[_DEMO_USERS[0]["email"]]),
                role=UserRole.ADMIN, account_status=AccountStatus.ACTIVE,
                email_verified_at=now, password_changed_at=now,
                failed_login_attempts=0, locked_until=None, must_change_password=False,
                created_by=None,
            )
            db.add(admin)
            db.flush()
            employee = User(
                full_name=_DEMO_USERS[1]["full_name"], email=_DEMO_USERS[1]["email"],
                password_hash=hash_password(passwords[_DEMO_USERS[1]["email"]]),
                role=UserRole.EMPLOYEE, account_status=AccountStatus.ACTIVE,
                email_verified_at=now, password_changed_at=now,
                failed_login_attempts=0, locked_until=None, must_change_password=False,
                created_by=admin.id,
            )
            db.add(employee)
            db.flush()
            print("Created demo administrator and employee accounts.")
    except Exception:
        for path in newly_written:
            path.unlink(missing_ok=True)
        raise
    finally:
        db.close()


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    parser.add_argument("command", choices=("create-admin", "seed-demo-users"))
    parser.add_argument("--confirm-development", action="store_true")
    args = parser.parse_args()
    if args.command == "create-admin":
        create_admin()
    elif args.command == "seed-demo-users":
        try:
            seed_demo_users(args.confirm_development)
        except Exception as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            sys.exit(1)
        sys.exit(0)


if __name__ == "__main__":
    main()
