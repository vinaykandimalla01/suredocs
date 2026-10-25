"""
Alembic environment configuration.

Imports all SQLAlchemy models for autogenerate support and uses the
database URL from centralized configuration.
"""

from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url

from alembic import context

from app.core.config import DATABASE_URL, DATABASE_URL_UNPOOLED

# ---------------------------------------------------------------------------
# Import the application's database engine and model metadata.
# Importing models/__init__.py ensures all models are registered with Base.
# ---------------------------------------------------------------------------
from app.db.session import Base, engine
import app.models  # noqa: F401  — triggers model registration

if engine is None:
    raise RuntimeError(
        "Alembic requires database configuration. Set DATABASE_URL or "
        "SUREDOCS_DB_USER, SUREDOCS_DB_HOST, SUREDOCS_DB_NAME, and DB_PASSWORD."
    )
if (
    DATABASE_URL
    and "-pooler" in (engine.url.host or "")
    and not DATABASE_URL_UNPOOLED
):
    raise RuntimeError(
        "Set DATABASE_URL_UNPOOLED to a direct PostgreSQL connection for Neon migrations."
    )

# Alembic Config object — provides access to the .ini file values.
config = context.config

# Set up Python logging from the config file.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The target metadata for 'autogenerate' support.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just the URL so SQL can be emitted
    without needing a live database connection.
    """
    url = (
        str(make_url(DATABASE_URL_UNPOOLED))
        if DATABASE_URL_UNPOOLED
        else str(engine.url)
    )
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Uses the application's configured engine directly.
    """
    connectable = (
        create_engine(
            make_url(DATABASE_URL_UNPOOLED).set(drivername="postgresql+psycopg"),
            poolclass=pool.NullPool,
        )
        if DATABASE_URL_UNPOOLED
        else engine
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
