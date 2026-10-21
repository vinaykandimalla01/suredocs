from sqlalchemy import text

from app.core.config import DB_NAME, DB_USERNAME
from app.db.session import engine


def test_postgres_connection():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database(), current_user")
        )

        database_name, database_user = result.one()

    assert database_name == DB_NAME
    assert database_user == DB_USERNAME
