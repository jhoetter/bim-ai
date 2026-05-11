"""Seed artifact bundles replay through the Python engine without hard-coded houses."""

from __future__ import annotations

import json
from pathlib import Path

from bim_ai.elements import LevelElem, ProjectBasePointElem
from scripts.seed import _load_artifact, _materialize

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

    doc, wire = _materialize(artifact)

    assert manifest["commandCount"] > 0
    assert doc.revision >= 1
    assert isinstance(doc.elements.get("hf-pbp"), ProjectBasePointElem)
    assert isinstance(doc.elements.get("hf-lvl-ground"), LevelElem)
    assert "hf-roof-main" in wire["elements"]
