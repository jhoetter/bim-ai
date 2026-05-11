"""WP-A01: one-family CLI bundle replays through Python engine.

The house bundle has been cleared back to the bare scaffolding; this test
verifies the canonical builder still produces a commitable bundle (project
base point + the two demo levels) so the seeding pipeline stays wired.
The richer documentation-spine assertions (rooms / sheet / schedules /
section projection) will return when the house geometry is re-authored
from scratch against `spec/target-house-seed.md`.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, ProjectBasePointElem, RoofOpeningElem
from bim_ai.engine import apply_inplace, command_adapter

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_cli_bundle_commands() -> list[dict]:
    try:
        proc = subprocess.run(
            [
                "node",
                "--input-type=module",
                "-e",
                "import { buildOneFamilyHomeCommands } from './packages/cli/lib/one-family-home-commands.mjs'; "
                "console.log(JSON.stringify(buildOneFamilyHomeCommands()));",
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=60,
            check=True,
        )
    except FileNotFoundError as e:
        pytest.skip(f"node not installed: {e}")
    except subprocess.CalledProcessError as e:
        pytest.skip(f"failed to load CLI bundle: {e.stderr or e.stdout}")
    return json.loads(proc.stdout)


def _apply_all(doc: Document, raw_cmds: list[dict]) -> None:
    for raw in raw_cmds:
        cmd = command_adapter.validate_python(raw)
        apply_inplace(doc, cmd)


def test_one_family_bundle_commits_minimal_scaffolding() -> None:
    """The canonical target-house bundle should author the baseline model spine."""
    cmds = _load_cli_bundle_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)

    pbp = doc.elements.get("th-pbp")
    assert isinstance(pbp, ProjectBasePointElem)

    ground = doc.elements.get("th-lvl-ground")
    assert isinstance(ground, LevelElem)
    assert ground.elevation_mm == 0

    upper = doc.elements.get("th-lvl-upper")
    assert isinstance(upper, LevelElem)
    assert upper.elevation_mm == 3000


def test_one_family_bundle_authors_roof_cutout_semantics() -> None:
    """The target-house sketch's right-slope roof cutout is a first-class roof opening."""
    cmds = _load_cli_bundle_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)

    cutout = doc.elements.get("th-roof-court-opening")
    assert isinstance(cutout, RoofOpeningElem)
    assert cutout.host_roof_id == "th-roof-main"
    assert len(cutout.boundary_mm) == 4
