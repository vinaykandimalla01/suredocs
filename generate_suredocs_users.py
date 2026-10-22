#!/usr/bin/env python3
"""Generate and seed synthetic SureDocs user records.

Save this file in the SureDocs backend/project root. The integration names below
must match the existing project's SQLAlchemy session, User model, and password
hashing helper. The follow-up integration step should inspect the repository and
adjust those names rather than create a second authentication implementation.

What this script does:
  * Generates 1,000 synthetic users in memory: 10 ADMIN and 990 EMPLOYEE.
  * Keeps all 10 administrators ACTIVE while preserving 700 ACTIVE, 200 DISABLED,
    and 100 PENDING accounts overall (so 690 employees are ACTIVE).
  * Hashes each generated password with SureDocs' EXISTING password hasher.
  * Inserts the users into the existing users table in one database transaction.
  * Writes only username/password pairs to credentials.csv after a successful
    database commit. The CSV is local test material and must not be committed.
  * Never seeds sessions or fabricated authentication events, because no real
    login/session event has occurred.

Run from the project root after confirming the schema has been migrated:
    python generate_suredocs_users.py --confirm

By default the script refuses to proceed if credentials.csv already exists, if
seed emails already exist, or if required model columns are missing.
"""
from __future__ import annotations

import argparse
import csv
import getpass
import importlib
import os
import secrets
import string
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

# ---------------------------------------------------------------------------
# PROJECT INTEGRATION SETTINGS
# Update these import paths to the exact modules used by the existing project.
# Do not implement a new hasher here; use the one already used by login.
# They can alternatively be overridden using the environment variables below.
# ---------------------------------------------------------------------------
DATABASE_MODULE = os.getenv("SUREDOCS_DATABASE_MODULE", "app.db.session")
SESSION_FACTORY_NAME = os.getenv("SUREDOCS_SESSION_FACTORY", "SessionLocal")
USER_MODEL_MODULE = os.getenv("SUREDOCS_USER_MODEL_MODULE", "app.models.user")
USER_MODEL_NAME = os.getenv("SUREDOCS_USER_MODEL", "User")
PASSWORD_HASHER_MODULE = os.getenv("SUREDOCS_PASSWORD_HASHER_MODULE", "app.core.security")
PASSWORD_HASHER_NAME = os.getenv("SUREDOCS_PASSWORD_HASHER", "hash_password")
PASSWORD_VERIFIER_NAME = os.getenv("SUREDOCS_PASSWORD_VERIFIER", "verify_password")

# Dataset distribution based on the SureDocs test-data requirements.
TOTAL_USERS = 1000
ADMIN_USERS = 10
EMPLOYEE_USERS = TOTAL_USERS - ADMIN_USERS  # 990
ACTIVE_USERS = 700       # includes all 10 administrators
DISABLED_USERS = 200
PENDING_USERS = 100

# These three attributes are proposed in the pasted SureDocs data model and are
# required by this script. The actual SQLAlchemy model and DB migration must
# contain them before the script is run. phone_number/deactivated_at are optional.
REQUIRED_PROFILE_COLUMNS = {"employee_code", "department", "job_title"}
CORE_DB_COLUMNS = {
    "id", "full_name", "email", "password_hash", "role", "account_status",
    "email_verified_at", "last_login_at", "created_at", "updated_at",
    "password_changed_at", "created_by", "failed_login_attempts", "locked_until",
    "must_change_password",
}

# Synthetic values only; these are not intended to represent real employees.
FIRST_NAMES = [
    "Aarav", "Aditi", "Akash", "Ananya", "Arjun", "Bhavana", "Charan",
    "Deepa", "Dev", "Divya", "Gaurav", "Harini", "Ishaan", "Kavya",
    "Kiran", "Lakshmi", "Manoj", "Meera", "Mohit", "Nandini", "Naveen",
    "Neha", "Pooja", "Pranav", "Priya", "Rahul", "Ravi", "Riya", "Sanjay",
    "Shreya", "Siddharth", "Sneha", "Suresh", "Tanvi", "Varun", "Vikram",
    "Vishal", "Yamini", "Zoya", "Adarsh", "Anil", "Bhargavi", "Chaitanya",
    "Dhanush", "Farhan", "Geetha", "Hemanth", "Indira", "Jaya", "Keerthi",
]
LAST_NAMES = [
    "Sharma", "Reddy", "Kumar", "Patel", "Rao", "Verma", "Singh", "Nair",
    "Gupta", "Mehta", "Iyer", "Das", "Joshi", "Mishra", "Naidu", "Pillai",
    "Chowdhury", "Kapoor", "Bose", "Kulkarni", "Agarwal", "Menon", "Shetty",
    "Chandra", "Desai", "Jain", "Saxena", "Malhotra", "Bhat", "Srinivasan",
    "Rajan", "Murthy", "Ghosh", "Sethi", "Pandey", "Banerjee", "Prasad",
    "Khan", "Thomas", "Fernandes", "Rana", "Sahni", "Roy", "Dutta", "Hegde",
    "Krishnan", "Yadav", "Chopra", "Mohan", "Rastogi",
]
DEPARTMENTS = [
    "Engineering", "Security", "IT Operations", "Human Resources", "Finance",
    "Legal", "Compliance", "Document Operations", "Customer Success", "Product",
    "Data Analytics", "Administration", "Quality Assurance", "Research",
]
JOB_TITLES = {
    "Engineering": ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Engineering Lead"],
    "Security": ["Security Analyst", "Security Engineer", "Security Administrator"],
    "IT Operations": ["Systems Administrator", "IT Support Engineer", "Cloud Operations Engineer"],
    "Human Resources": ["HR Associate", "HR Manager", "People Operations Specialist"],
    "Finance": ["Financial Analyst", "Accounts Associate", "Finance Manager"],
    "Legal": ["Legal Associate", "Legal Counsel", "Contracts Specialist"],
    "Compliance": ["Compliance Analyst", "Risk Analyst", "Compliance Manager"],
    "Document Operations": ["Document Controller", "Records Specialist", "Operations Analyst"],
    "Customer Success": ["Customer Success Associate", "Support Specialist", "Customer Success Manager"],
    "Product": ["Product Analyst", "Product Manager", "UX Researcher"],
    "Data Analytics": ["Data Analyst", "BI Engineer", "Data Engineer"],
    "Administration": ["Office Administrator", "Administrative Coordinator", "Operations Manager"],
    "Quality Assurance": ["QA Analyst", "Test Engineer", "QA Lead"],
    "Research": ["Research Associate", "Research Analyst", "Research Engineer"],
}

SCRIPT_DIR = Path(__file__).resolve().parent
CREDENTIALS_PATH = SCRIPT_DIR / "credentials.csv"


def import_attribute(module_name: str, attribute_name: str) -> Any:
    """Import one configured application attribute with an actionable error."""
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        raise RuntimeError(
            f"Could not import '{module_name}'. Update the PROJECT INTEGRATION SETTINGS "
            "at the top of generate_suredocs_users.py to match the existing repository. "
            f"Original error: {exc}"
        ) from exc
    try:
        return getattr(module, attribute_name)
    except AttributeError as exc:
        raise RuntimeError(
            f"'{module_name}' has no attribute '{attribute_name}'. Update the PROJECT "
            "INTEGRATION SETTINGS to use the existing project object."
        ) from exc


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def random_past_time(start: datetime, end: datetime) -> datetime:
    """Return a timezone-aware random timestamp between start and end."""
    if end <= start:
        return start
    seconds = int((end - start).total_seconds())
    return start + timedelta(seconds=secrets.randbelow(seconds + 1))


def secure_test_password() -> str:
    """Create a unique test password without storing it outside memory/CSV."""
    # Strong random suffix; the password is for local synthetic test accounts.
    alphabet = string.ascii_letters + string.digits + "!@#$%_-"
    suffix = "".join(secrets.choice(alphabet) for _ in range(22))
    return f"SdTest-{suffix}"


def build_unique_people(count: int) -> list[tuple[str, str]]:
    """Generate unique synthetic name pairs from curated lists."""
    combinations = [(first, last) for first in FIRST_NAMES for last in LAST_NAMES]
    # Shuffle without relying on global random state.
    for i in range(len(combinations) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        combinations[i], combinations[j] = combinations[j], combinations[i]
    if count > len(combinations):
        raise RuntimeError("Not enough synthetic name combinations defined in this script.")
    return combinations[:count]


def build_records(password_hasher: Callable[[str], str], model_columns: set[str]) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Build all 1,000 rows in memory and hash passwords with the app hasher."""
    if ADMIN_USERS + EMPLOYEE_USERS != TOTAL_USERS:
        raise RuntimeError("The configured role distribution does not equal TOTAL_USERS.")
    if ACTIVE_USERS + DISABLED_USERS + PENDING_USERS != TOTAL_USERS:
        raise RuntimeError("The configured account-status distribution does not equal TOTAL_USERS.")
    if ACTIVE_USERS < ADMIN_USERS:
        raise RuntimeError("All seeded administrators are configured as ACTIVE, so ACTIVE_USERS must be >= ADMIN_USERS.")

    now = utc_now()
    admin_ids = [uuid.uuid4() for _ in range(ADMIN_USERS)]
    # 9 named administrators plus 990 employees; the first administrator uses
    # the stable seed email admin@suredocs.test as the creator/root account.
    generated_people = build_unique_people(TOTAL_USERS - 1)
    extra_admin_people = generated_people[: ADMIN_USERS - 1]
    employee_people = generated_people[ADMIN_USERS - 1 :]

    records: list[dict[str, Any]] = []
    credentials: list[dict[str, str]] = []

    def make_admin_record(index: int, person: tuple[str, str] | None) -> tuple[dict[str, Any], dict[str, str]]:
        if index == 0:
            full_name = "SureDocs Test Administrator"
            email = "admin@suredocs.test"
        else:
            assert person is not None
            first, last = person
            full_name = f"{first} {last}"
            email = f"{first.lower()}.{last.lower()}.admin{index + 1:02d}@suredocs.test"

        password = secure_test_password()
        user_id = admin_ids[index]
        created_at = now - timedelta(days=secrets.randbelow(180) + 180)
        record = {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "password_hash": password_hasher(password),
            "role": "ADMIN",
            "account_status": "ACTIVE",
            "email_verified_at": created_at + timedelta(hours=2),
            "last_login_at": None,
            "created_at": created_at,
            "updated_at": random_past_time(created_at, now),
            "password_changed_at": created_at + timedelta(hours=3),
            # First administrator is the root seed account; the other nine were
            # notionally created by it, satisfying the self-referencing FK.
            "created_by": None if index == 0 else admin_ids[0],
            "failed_login_attempts": 0,
            "locked_until": None,
            "must_change_password": False,
            "employee_code": f"SD-ADMIN-{index + 1:04d}",
            "department": "Administration",
            "job_title": "System Administrator",
            "phone_number": None,
            "deactivated_at": None,
        }
        record = {key: value for key, value in record.items() if key in model_columns}
        return record, {"username": email, "password": password}

    for admin_index in range(ADMIN_USERS):
        person = None if admin_index == 0 else extra_admin_people[admin_index - 1]
        record, credential = make_admin_record(admin_index, person)
        records.append(record)
        credentials.append(credential)

    # Preserve the total status distribution while keeping all 10 admins ACTIVE:
    # 690 active employees + 200 disabled + 100 pending + 10 active admins.
    employee_statuses = (
        ["ACTIVE"] * (ACTIVE_USERS - ADMIN_USERS)
        + ["DISABLED"] * DISABLED_USERS
        + ["PENDING"] * PENDING_USERS
    )
    for i in range(len(employee_statuses) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        employee_statuses[i], employee_statuses[j] = employee_statuses[j], employee_statuses[i]

    for index, ((first, last), status) in enumerate(zip(employee_people, employee_statuses), start=1):
        user_id = uuid.uuid4()
        full_name = f"{first} {last}"
        email = f"{first.lower()}.{last.lower()}.{index:04d}@suredocs.test"
        password = secure_test_password()
        created_at = now - timedelta(days=secrets.randbelow(650) + 1)
        updated_at = random_past_time(created_at, now)
        department = secrets.choice(DEPARTMENTS)
        job_title = secrets.choice(JOB_TITLES[department])

        if status == "PENDING":
            email_verified_at = None
            last_login_at = None
            password_changed_at = None
            must_change_password = True
            deactivated_at = None
        else:
            email_verified_at = random_past_time(created_at, now)
            last_login_at = None
            password_changed_at = random_past_time(created_at, now)
            must_change_password = False
            deactivated_at = random_past_time(created_at, now) if status == "DISABLED" else None

        row = {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "password_hash": password_hasher(password),
            "role": "EMPLOYEE",
            "account_status": status,
            "email_verified_at": email_verified_at,
            "last_login_at": last_login_at,
            "created_at": created_at,
            "updated_at": updated_at,
            "password_changed_at": password_changed_at,
            "created_by": admin_ids[0],
            "failed_login_attempts": 0,
            "locked_until": None,
            "must_change_password": must_change_password,
            "employee_code": f"SD-EMP-{index:04d}",
            "department": department,
            "job_title": job_title,
            "phone_number": None,
            "deactivated_at": deactivated_at,
        }
        row = {key: value for key, value in row.items() if key in model_columns}
        records.append(row)
        credentials.append({"username": email, "password": password})

    if len(records) != TOTAL_USERS or len(credentials) != TOTAL_USERS:
        raise RuntimeError("Generated record/credential count is not exactly TOTAL_USERS.")
    if sum(1 for row in records if row["role"] == "ADMIN") != ADMIN_USERS:
        raise RuntimeError("Generated administrator count does not match ADMIN_USERS.")
    if sum(1 for row in records if row["role"] == "EMPLOYEE") != EMPLOYEE_USERS:
        raise RuntimeError("Generated employee count does not match EMPLOYEE_USERS.")
    if len({row["email"].lower() for row in records}) != TOTAL_USERS:
        raise RuntimeError("Generated user emails are not unique.")

    return records, credentials


def restrict_file_permissions(path: Path) -> None:
    """Restrict credentials to the current user before any database commit."""
    if os.name == "nt":
        result = subprocess.run(
            [
                "icacls",
                str(path),
                "/inheritance:r",
                "/grant:r",
                f"{getpass.getuser()}:(F)",
            ],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            raise OSError("Could not restrict credentials file permissions.")
        return

    os.chmod(path, 0o600)
    if path.stat().st_mode & 0o077:
        raise OSError("Credentials file permissions are not private.")


def write_credentials_temp(credentials: list[dict[str, str]]) -> Path:
    """Write a protected temporary credential file ready for atomic publication."""
    fd, raw_path = tempfile.mkstemp(prefix=".credentials-", suffix=".tmp", dir=SCRIPT_DIR, text=True)
    temp_path = Path(raw_path)
    try:
        restrict_file_permissions(temp_path)
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=["username", "password"])
            writer.writeheader()
            writer.writerows(credentials)
            handle.flush()
            os.fsync(handle.fileno())
        return temp_path
    except Exception:
        try:
            os.close(fd)
        except OSError:
            pass
        temp_path.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate and seed 1,000 synthetic SureDocs users (10 admins, 990 employees).")
    parser.add_argument("--confirm", action="store_true", help="Required confirmation before database writes.")
    args = parser.parse_args()

    if not args.confirm:
        parser.error("No database changes were made. Re-run with --confirm after checking the target database.")

    if CREDENTIALS_PATH.exists():
        raise SystemExit(
            f"Refusing to overwrite existing {CREDENTIALS_PATH.name}."
        )

    environment = " ".join([
        os.getenv("ENVIRONMENT", ""), os.getenv("APP_ENV", ""), os.getenv("SUREDOCS_ENV", "")
    ]).lower()
    if any(word in environment.split() for word in {"prod", "production"}):
        raise SystemExit("Refusing to seed a production environment. Use a dedicated local/test database.")

    backend_path = str(SCRIPT_DIR / "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    SessionFactory = import_attribute(DATABASE_MODULE, SESSION_FACTORY_NAME)
    User = import_attribute(USER_MODEL_MODULE, USER_MODEL_NAME)
    password_hasher = import_attribute(PASSWORD_HASHER_MODULE, PASSWORD_HASHER_NAME)
    password_verifier = import_attribute(PASSWORD_HASHER_MODULE, PASSWORD_VERIFIER_NAME)
    database_config = importlib.import_module("app.core.config")
    DB_HOST = database_config.DB_HOST
    DB_NAME = database_config.DB_NAME
    DB_USERNAME = database_config.DB_USERNAME

    try:
        model_columns = set(User.__table__.columns.keys())
    except Exception as exc:
        raise SystemExit("Configured User object is not a SQLAlchemy mapped model with __table__.columns.") from exc

    missing_core = sorted(CORE_DB_COLUMNS - model_columns)
    missing_profile = sorted(REQUIRED_PROFILE_COLUMNS - model_columns)
    if missing_core or missing_profile:
        messages = []
        if missing_core:
            messages.append("Missing existing-schema columns: " + ", ".join(missing_core))
        if missing_profile:
            messages.append("Missing required proposed profile columns: " + ", ".join(missing_profile))
        raise SystemExit(
            "Seeder stopped before creating data because the ORM model is not ready.\n"
            + "\n".join(messages)
            + "\nReconcile SQLAlchemy models and apply a reviewed Alembic migration first."
        )

    records, credentials = build_records(password_hasher, model_columns)
    if not password_verifier(credentials[0]["password"], records[0]["password_hash"]):
        raise SystemExit("The configured SureDocs password verifier rejected the generated test hash.")
    expected_emails = [row["email"].lower() for row in records]
    if len(set(expected_emails)) != TOTAL_USERS:
        raise SystemExit("Generated emails are not unique; no database changes were made.")

    # Write temporary credentials before commit so filesystem errors are detected
    # before inserting data. The final credentials.csv is only published on success.
    temp_credentials_path: Path | None = None
    db = None
    committed = False
    try:
        temp_credentials_path = write_credentials_temp(credentials)
        if DB_HOST.strip().lower() not in {"localhost", "127.0.0.1", "::1"}:
            raise RuntimeError("Configured database host is not a local loopback address.")
        db = SessionFactory()
        from sqlalchemy import text
        actual_database, actual_username = db.execute(
            text("SELECT current_database(), current_user")
        ).one()
        if actual_database != DB_NAME or actual_username != DB_USERNAME:
            raise RuntimeError("Connected database identity does not match the backend configuration.")
        # Case-insensitive collision check mirrors the lower(email) unique index.
        from sqlalchemy import func
        existing = db.query(User.email).filter(func.lower(User.email).in_(expected_emails)).first()
        if existing:
            raise RuntimeError(
                "At least one generated @suredocs.test email already exists in the database. "
                "No records were inserted; choose a clean test database or remove only the intended seed records manually."
            )

        # Insert administrator first to satisfy users.created_by self-FK references.
        admin_record = records[0]
        admin_obj = User(**admin_record)
        db.add(admin_obj)
        db.flush()
        for row in records[1:]:
            db.add(User(**row))
        db.flush()
        if db.query(User).filter(func.lower(User.email).in_(expected_emails)).count() != TOTAL_USERS:
            raise RuntimeError("Post-insert verification failed; transaction will be rolled back.")
        db.commit()
        committed = True

        # A hard link publishes the file atomically without replacing an existing path.
        os.link(temp_credentials_path, CREDENTIALS_PATH)
        temp_credentials_path.unlink()
        temp_credentials_path = None

        print(f"Successfully inserted {TOTAL_USERS} synthetic SureDocs users.")
        print(f"  ADMIN: {sum(1 for r in records if r['role'] == 'ADMIN')} (expected {ADMIN_USERS})")
        print(f"  EMPLOYEE: {sum(1 for r in records if r['role'] == 'EMPLOYEE')} (expected {EMPLOYEE_USERS})")
        for status in ("ACTIVE", "DISABLED", "PENDING"):
            print(f"  {status}: {sum(1 for r in records if r['account_status'] == status)}")
        print(f"Credentials file: {CREDENTIALS_PATH}")
        print("Passwords were hashed by the configured SureDocs password helper before database insertion.")
        print("No session or auth-event rows were fabricated. Credentials contain plaintext test passwords; do not commit/share the file.")
        return 0
    except Exception as exc:
        if db is not None and not committed:
            try:
                db.rollback()
            except Exception:
                pass
        print(f"ERROR: Seed operation failed ({type(exc).__name__}).", file=sys.stderr)
        if committed and temp_credentials_path is not None and temp_credentials_path.exists():
            print(
                "The database commit succeeded, but credentials.csv could not be published. "
                f"Protected recovery file: {temp_credentials_path}",
                file=sys.stderr,
            )
        elif not committed:
            print("The database transaction was rolled back where possible.", file=sys.stderr)
        return 1
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass
        if temp_credentials_path is not None and not committed:
            try:
                temp_credentials_path.unlink(missing_ok=True)
            except OSError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
