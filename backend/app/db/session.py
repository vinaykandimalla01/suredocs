from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# Resolve the SureDocs project root.
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Read the application password from the secrets directory.
PASSWORD_FILE = (
    PROJECT_ROOT / "secrets" / "suredocs_app_password.txt"
)

if not PASSWORD_FILE.is_file():
    raise FileNotFoundError(
        f"Database password file not found: {PASSWORD_FILE}"
    )

DB_PASSWORD = PASSWORD_FILE.read_text(
    encoding="utf-8"
).strip()

if not DB_PASSWORD:
    raise RuntimeError("The database password file is empty.")


# Build the connection URL safely, including special characters
# in the database password.
DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username="suredocs_app",
    password=DB_PASSWORD,
    host="127.0.0.1",
    port=5432,
    database="suredocs",
)

# Create the SQLAlchemy engine.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

# Create database sessions for application requests.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)

# Base class for future SQLAlchemy models.
class Base(DeclarativeBase):
    pass