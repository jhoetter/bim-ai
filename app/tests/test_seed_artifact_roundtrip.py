"""Seed artifact bundles replay through the Python engine without hard-coded houses."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from uuid import UUID

from bim_ai.elements import LevelElem, ProjectBasePointElem
from scripts import seed
from scripts.seed import SEED_PROJECT_ID, _load_artifact, _materialize, seed_async

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


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
    artifact_dir = tmp_path / "target-house-3"
    artifact_dir.mkdir()
    (artifact_dir / "manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": "bim-ai.seed-artifact.v1",
                "name": "target-house-3",
                "title": "Target House 3",
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
    monkeypatch.setattr(seed, "_delete_model_records", delete_model_records_stub)
    monkeypatch.setattr(seed, "SessionMaker", lambda: FakeSession())

    asyncio.run(seed_async(name="target-house-3", root=tmp_path, clear_only=False))

    assert ("clear_project", SEED_PROJECT_ID) in calls
    assert calls.index(("clear_project", SEED_PROJECT_ID)) < calls.index(
        ("delete_model", _load_artifact(artifact_dir).model_id)
    )


def test_checked_in_target_house_seed_artifact_is_portable_and_loadable() -> None:
    artifact_dir = REPO_ROOT / "seed-artifacts" / "target-house-1"
    manifest_text = (artifact_dir / "manifest.json").read_text(encoding="utf8")
    assert "/Users/" not in manifest_text
    assert str(REPO_ROOT) not in manifest_text

    artifact = _load_artifact(artifact_dir)
    manifest = artifact.manifest

    assert manifest["name"] == "target-house-1"
    assert manifest["sourceRoot"] == "source"
    assert manifest["bundle"] == "bundle.json"
    assert (artifact_dir / "source" / "target-house-seed.md").is_file()

    bundle = json.loads((artifact_dir / "bundle.json").read_text(encoding="utf8"))
    commands = bundle["commands"]
    command_types = {command["type"] for command in commands}
    assert "createMass" not in command_types
    assert "deleteElement" not in command_types
    assert "createRoofOpening" in command_types
    assert (artifact_dir / "evidence" / "target-house-1.recipe.json").is_file()
    assert (artifact_dir / "evidence" / "sketch-ir.json").is_file()

    doc, wire = _materialize(artifact)

    assert manifest["commandCount"] > 0
    assert doc.revision >= 1
    assert isinstance(doc.elements.get("hf-pbp"), ProjectBasePointElem)
    assert isinstance(doc.elements.get("hf-lvl-ground"), LevelElem)
    assert "hf-roof-main" in wire["elements"]
    assert "hf-roof-court-opening" in wire["elements"]
