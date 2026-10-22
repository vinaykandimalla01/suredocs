from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers
from sqlalchemy.schema import CreateTable

from app.db.session import Base
from app.models import (
    Document,
    DocumentAuditLog,
    DocumentPermission,
    DocumentVersion,
)


def test_document_models_are_registered_and_mappers_configure() -> None:
    configure_mappers()

    assert {
        "documents",
        "document_versions",
        "document_permissions",
        "document_audit_logs",
    }.issubset(Base.metadata.tables)
    assert Document.__table__ is Base.metadata.tables["documents"]
    assert DocumentVersion.__table__ is Base.metadata.tables["document_versions"]
    assert DocumentPermission.__table__ is Base.metadata.tables["document_permissions"]
    assert DocumentAuditLog.__table__ is Base.metadata.tables["document_audit_logs"]


def test_document_version_relationship_is_constrained_to_same_document() -> None:
    constraint = next(
        constraint
        for constraint in Document.__table__.foreign_key_constraints
        if constraint.name == "fk_documents_current_version_same_document"
    )

    assert [element.parent.name for element in constraint.elements] == [
        "id",
        "current_version_id",
    ]
    assert [element.column.name for element in constraint.elements] == [
        "document_id",
        "id",
    ]


def test_document_constraints_and_indexes_compile_for_postgresql() -> None:
    permission_grantor = next(
        column
        for column in DocumentPermission.__table__.columns
        if column.name == "granted_by_user_id"
    )
    grantor_fk = next(iter(permission_grantor.foreign_keys))

    assert permission_grantor.nullable is False
    assert grantor_fk.ondelete == "RESTRICT"
    assert {
        "uq_document_versions_document_number",
        "uq_document_versions_document_id_id",
        "uq_document_versions_storage_location",
    }.issubset(
        {constraint.name for constraint in DocumentVersion.__table__.constraints}
    )

    for table in (
        Document.__table__,
        DocumentVersion.__table__,
        DocumentPermission.__table__,
        DocumentAuditLog.__table__,
    ):
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        assert f"CREATE TABLE {table.name}" in ddl
