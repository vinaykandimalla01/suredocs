"""
Alembic environment configuration.

Imports all SQLAlchemy models for autogenerate support and loads the
database URL from the centralized config (which reads secrets from files).
"""

from logging.config import fileConfig

from sqlalchemy import pool

from alembic import context

# ---------------------------------------------------------------------------
# Import the application's database engine and model metadata.
# Importing models/__init__.py ensures all models are registered with Base.
# ---------------------------------------------------------------------------
from app.db.session import Base, engine
import app.models  # noqa: F401  — triggers model registration

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
    url = str(engine.url)
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

    Uses the application's engine directly so the database URL
    (including the password loaded from the secrets file) is consistent.
    """
    connectable = engine

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
