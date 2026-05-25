"""Seed artifact bundles replay through the Python engine without hard-coded houses."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

from bim_ai.elements import LevelElem, ProjectBasePointElem
from scripts import seed
from scripts.seed import (
    EMPTY_SEED_MODEL_ID,
    EMPTY_SEED_MODEL_SLUG,
    SEED_PROJECT_ID,
    _delete_model_records,
    _load_artifact,
    _materialize,
    _purge_disposable_projects,
    seed_async,
)


def test_seed_artifact_bundle_commits_minimal_model(tmp_path: Path) -> None:
    artifact_dir = tmp_path / "clean-seed"
    artifact_dir.mkdir()
    (artifact_dir / "manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": "bim-ai.seed-artifact.v1",
                "name": "clean-seed",
                "title": "Clean Seed",
                "bundle": "bundle.json",
            }
        ),
        encoding="utf8",
    )
    (artifact_dir / "bundle.json").write_text(
        json.dumps(
            {
                "schemaVersion": "cmd-v3.0",
                "commands": [
                    {
                        "type": "createProjectBasePoint",
                        "id": "seed-pbp",
                        "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
                        "angleToTrueNorthDeg": 0,
                    },
                    {
                        "type": "createLevel",
                        "id": "seed-lvl-ground",
                        "name": "Ground Floor",
                        "elevationMm": 0,
                    },
                ],
            }
        ),
        encoding="utf8",
    )

    artifact = _load_artifact(artifact_dir)
    doc, wire = _materialize(artifact)

    assert doc.revision == 1
    assert isinstance(doc.elements.get("seed-pbp"), ProjectBasePointElem)
    assert isinstance(doc.elements.get("seed-lvl-ground"), LevelElem)
    assert wire["revision"] == 1
    assert set(wire["elements"]) >= {"seed-pbp", "seed-lvl-ground"}


def test_targeted_seed_rebuilds_seed_project(monkeypatch, tmp_path: Path) -> None:
    artifact_dir = tmp_path / "sample-house-3"
    artifact_dir.mkdir()
    (artifact_dir / "manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": "bim-ai.seed-artifact.v1",
                "name": "sample-house-3",
                "title": "Sample House 3",
                "bundle": "bundle.json",
            }
        ),
        encoding="utf8",
    )
    (artifact_dir / "bundle.json").write_text(
        json.dumps(
            {
                "schemaVersion": "cmd-v3.0",
                "commands": [
                    {
                        "type": "createProjectBasePoint",
                        "id": "seed-pbp",
                        "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
                        "angleToTrueNorthDeg": 0,
                    },
                    {
                        "type": "createLevel",
                        "id": "seed-lvl-ground",
                        "name": "Ground Floor",
                        "elevationMm": 0,
                    },
                ],
            }
        ),
        encoding="utf8",
    )

    calls: list[tuple[str, UUID]] = []

    async def init_db_schema_stub() -> None:
        calls.append(("init", SEED_PROJECT_ID))

    async def clear_legacy_seed_stub(session) -> int:
        calls.append(("clear_legacy", SEED_PROJECT_ID))
        return 0

    async def clear_project_stub(session, project_id: UUID) -> int:
        calls.append(("clear_project", project_id))
        return 2

    async def purge_disposable_projects_stub(session) -> int:
        calls.append(("purge_disposable", SEED_PROJECT_ID))
        return 0

    async def delete_model_records_stub(session, model_ids) -> None:
        calls.append(("delete_model", model_ids[0]))

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, model, record_id):
            return None

        def add(self, row) -> None:
            pass

        async def flush(self) -> None:
            pass

        async def commit(self) -> None:
            calls.append(("commit", SEED_PROJECT_ID))

    monkeypatch.setattr(seed, "init_db_schema", init_db_schema_stub)
    monkeypatch.setattr(seed, "_clear_legacy_seed", clear_legacy_seed_stub)
    monkeypatch.setattr(seed, "_clear_project", clear_project_stub)
    monkeypatch.setattr(seed, "_purge_disposable_projects", purge_disposable_projects_stub)
    monkeypatch.setattr(seed, "_delete_model_records", delete_model_records_stub)
    monkeypatch.setattr(seed, "SessionMaker", lambda: FakeSession())

    asyncio.run(seed_async(name="sample-house-3", root=tmp_path, clear_only=False))

    assert ("clear_project", SEED_PROJECT_ID) in calls
    assert ("purge_disposable", SEED_PROJECT_ID) in calls
    assert calls.index(("clear_project", SEED_PROJECT_ID)) < calls.index(
        ("delete_model", _load_artifact(artifact_dir).model_id)
    )


def test_seed_without_artifacts_creates_empty_dev_model(monkeypatch, tmp_path: Path) -> None:
    calls: list[tuple[str, UUID]] = []
    added: list[object] = []

    async def init_db_schema_stub() -> None:
        calls.append(("init", SEED_PROJECT_ID))

    async def clear_legacy_seed_stub(session) -> int:
        calls.append(("clear_legacy", SEED_PROJECT_ID))
        return 0

    async def clear_project_stub(session, project_id: UUID) -> int:
        calls.append(("clear_project", project_id))
        return 0

    async def purge_disposable_projects_stub(session) -> int:
        calls.append(("purge_disposable", SEED_PROJECT_ID))
        return 0

    async def delete_model_records_stub(session, model_ids) -> None:
        calls.append(("delete_model", model_ids[0]))

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, model, record_id):
            return None

        def add(self, row) -> None:
            added.append(row)

        async def commit(self) -> None:
            calls.append(("commit", SEED_PROJECT_ID))

    monkeypatch.setattr(seed, "init_db_schema", init_db_schema_stub)
    monkeypatch.setattr(seed, "_clear_legacy_seed", clear_legacy_seed_stub)
    monkeypatch.setattr(seed, "_clear_project", clear_project_stub)
    monkeypatch.setattr(seed, "_purge_disposable_projects", purge_disposable_projects_stub)
    monkeypatch.setattr(seed, "_delete_model_records", delete_model_records_stub)
    monkeypatch.setattr(seed, "SessionMaker", lambda: FakeSession())

    asyncio.run(seed_async(name=None, root=tmp_path, clear_only=False))

    model_rows = [row for row in added if getattr(row, "slug", None) == EMPTY_SEED_MODEL_SLUG]
    assert len(model_rows) == 1
    assert model_rows[0].id == EMPTY_SEED_MODEL_ID
    assert model_rows[0].project_id == SEED_PROJECT_ID
    assert model_rows[0].revision == 1
    assert "internal_origin" in model_rows[0].document["elements"]
    assert "elevation-north" in model_rows[0].document["elements"]
    assert ("delete_model", EMPTY_SEED_MODEL_ID) in calls
    assert calls[-1] == ("commit", SEED_PROJECT_ID)


def test_seed_purge_removes_disposable_local_evidence_projects(monkeypatch) -> None:
    disposable_id = uuid4()
    safe_id = uuid4()
    projects = [
        SimpleNamespace(
            id=disposable_id,
            slug="m2-wave5-1234abcd",
            title="M2 Wave 5 disposable local evidence project",
        ),
        SimpleNamespace(
            id=safe_id,
            slug="client-wave-house",
            title="Client Wave House",
        ),
        SimpleNamespace(
            id=SEED_PROJECT_ID,
            slug="seeds",
            title="Seed Library",
        ),
    ]
    cleared: list[UUID] = []

    class FakeScalars:
        def all(self):
            return projects

    class FakeResult:
        def scalars(self):
            return FakeScalars()

    class FakeSession:
        async def execute(self, stmt):
            return FakeResult()

    async def clear_project_stub(session, project_id: UUID) -> int:
        cleared.append(project_id)
        return 3

    monkeypatch.setattr(seed, "_clear_project", clear_project_stub)

    removed = asyncio.run(_purge_disposable_projects(FakeSession()))

    assert removed == 3
    assert cleared == [disposable_id]


# The previous seed-artifact portability test was removed
# 2026-05-25 along with that artifact. The portability surface it covered
# (manifest schema, bundle hash, materialization) is exercised by the
# tmp-path roundtrip above.


def test_delete_model_records_cascades_in_fk_safe_order() -> None:
    """Regression test for issue #22.

    ``make seed`` was crashing with ``ForeignKeyViolationError`` whenever an
    interrupted iter session left behind ``bim_model_commits`` /
    ``bim_model_snapshots`` / ``bim_undo_stack`` / ``bim_redo_stack`` /
    ``bim_comments`` rows that still referenced the model row being deleted.
    The cascade order here mirrors ``scripts/testhouse_purge.py`` and must
    keep every dependent table ahead of ``bim_models``.
    """

    from sqlalchemy.sql.dml import Delete, Update

    from bim_ai.tables import (
        ActivityRowRecord,
        CommentRecord,
        MilestoneRecord,
        ModelCommitRecord,
        ModelRecord,
        ModelSnapshotRecord,
        PublicLinkRecord,
        RedoStackRecord,
        RoleAssignmentRecord,
        UndoStackRecord,
    )

    captured: list[tuple[str, type]] = []

    class RecordingSession:
        async def execute(self, stmt):
            if isinstance(stmt, Delete):
                captured.append(("delete", stmt.entity_description["entity"]))
            elif isinstance(stmt, Update):
                captured.append(("update", stmt.entity_description["entity"]))
            return None

    model_id = uuid4()
    asyncio.run(_delete_model_records(RecordingSession(), [model_id]))

    table_order = [entity for _, entity in captured]
    delete_order = [entity for op, entity in captured if op == "delete"]

    # Update (NULL snapshot_id) must come before deleting snapshots / commits.
    assert ("update", ModelCommitRecord) in captured
    update_idx = captured.index(("update", ModelCommitRecord))
    assert captured.index(("delete", ModelSnapshotRecord)) > update_idx
    assert captured.index(("delete", ModelCommitRecord)) > update_idx

    # bim_models must be the very last delete — every dependent table ahead.
    assert delete_order[-1] is ModelRecord

    # Each dependent that the issue calls out is purged before bim_models.
    bim_models_idx = table_order.index(ModelRecord)
    for dependent in (
        UndoStackRecord,
        RedoStackRecord,
        CommentRecord,
        ModelCommitRecord,
        ModelSnapshotRecord,
        ActivityRowRecord,
        MilestoneRecord,
        RoleAssignmentRecord,
        PublicLinkRecord,
    ):
        assert dependent in table_order, dependent
        assert table_order.index(dependent) < bim_models_idx, dependent
