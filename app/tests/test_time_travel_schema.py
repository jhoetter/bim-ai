"""Schema-shape tests for the time-travel tables.

These tests exercise the SQLAlchemy ORM definitions without requiring a
live postgres. The actual DDL execution path is covered by the
integration tests under app/tests/integration/.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql

from bim_ai.tables import (
    Base,
    ModelCommitRecord,
    ModelSnapshotRecord,
    UndoStackRecord,
)


def test_model_commit_record_table_shape() -> None:
    t = ModelCommitRecord.__table__
    assert t.name == "bim_model_commits"
    cols = {c.name: c for c in t.columns}
    assert set(cols) == {
        "commit_id",
        "model_id",
        "parent_commit_id",
        "first_revision",
        "last_revision",
        "state",
        "summary",
        "context",
        "created_at",
        "closed_at",
        "snapshot_id",
    }
    assert cols["commit_id"].primary_key
    assert cols["commit_id"].type.length == 26  # type: ignore[attr-defined]
    assert cols["parent_commit_id"].nullable
    assert cols["snapshot_id"].nullable
    assert not cols["first_revision"].nullable
    assert not cols["last_revision"].nullable
    assert not cols["state"].nullable

    fk_names = {fk.target_fullname for fk in t.foreign_keys}
    assert "bim_models.id" in fk_names
    assert "bim_model_snapshots.id" in fk_names
    assert "bim_model_commits.commit_id" in fk_names  # self-FK on parent


def test_model_snapshot_record_table_shape() -> None:
    t = ModelSnapshotRecord.__table__
    assert t.name == "bim_model_snapshots"
    cols = {c.name: c for c in t.columns}
    assert set(cols) == {
        "id",
        "model_id",
        "commit_id",
        "revision",
        "document",
        "document_sha256",
        "document_size_bytes",
        "element_counts",
        "created_at",
    }
    assert cols["id"].primary_key
    assert cols["commit_id"].unique
    assert not cols["document"].nullable
    assert cols["document_sha256"].type.length == 64  # type: ignore[attr-defined]


def test_undo_stack_record_gains_commit_id() -> None:
    t = UndoStackRecord.__table__
    cols = {c.name: c for c in t.columns}
    assert "commit_id" in cols
    # Nullable so existing rows do not need backfill before the column lands.
    assert cols["commit_id"].nullable
    # FK targets bim_model_commits.commit_id.
    fk_targets = {fk.target_fullname for fk in cols["commit_id"].foreign_keys}
    assert fk_targets == {"bim_model_commits.commit_id"}


def test_create_all_emits_new_tables() -> None:
    """The new tables should be present in Base.metadata and compile to DDL."""

    names = set(Base.metadata.tables)
    assert "bim_model_commits" in names
    assert "bim_model_snapshots" in names

    # Compile create-table DDL against the postgres dialect (no connection
    # required) to catch column/type mistakes early.
    dialect = postgresql.dialect()
    from sqlalchemy.schema import CreateTable

    commit_ddl = str(CreateTable(ModelCommitRecord.__table__).compile(dialect=dialect))
    snapshot_ddl = str(CreateTable(ModelSnapshotRecord.__table__).compile(dialect=dialect))

    assert "bim_model_commits" in commit_ddl
    assert "JSONB" in commit_ddl
    assert "bim_model_snapshots" in snapshot_ddl
    assert "JSONB" in snapshot_ddl
