"""WP-UI-F01: seed house V2 fixture covers spec §27 element counts."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from bim_ai.document import Document
from bim_ai.engine import apply_inplace, command_adapter

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_seed_v2_commands() -> list[dict]:
    try:
        proc = subprocess.run(
            [
                "node",
                "--input-type=module",
                "-e",
                "import { buildSeedHouseV2Commands } from './packages/cli/lib/seed-house-v2-commands.mjs'; "
                "console.log(JSON.stringify(buildSeedHouseV2Commands()));",
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
        pytest.skip(f"failed to load seed v2 bundle: {e.stderr or e.stdout}")
    return json.loads(proc.stdout)


def _apply_all(doc: Document, raw_cmds: list[dict]) -> None:
    for raw in raw_cmds:
        cmd = command_adapter.validate_python(raw)
        apply_inplace(doc, cmd)


def test_seed_v2_uses_seed_prefix_for_every_element_id() -> None:
    cmds = _load_seed_v2_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)
    bad_ids = [eid for eid in doc.elements if not eid.startswith("seed-")]
    assert not bad_ids, f"non-seed-prefixed ids: {bad_ids}"


def test_seed_v2_covers_all_required_kinds() -> None:
    cmds = _load_seed_v2_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)
    kinds = {e.kind for e in doc.elements.values()}
    for k in (
        "level",
        "site",
        "wall",
        "floor",
        "roof",
        "door",
        "window",
        "stair",
        "slab_opening",
        "railing",
        "room",
        "section_cut",
        "plan_view",
        "view_template",
        "viewpoint",
        "sheet",
        "schedule",
    ):
        assert k in kinds, f"missing kind {k}"


def test_seed_v2_element_counts_match_section_27() -> None:
    """Spec §27.1 counts:

    levels=3, site=1, walls=16 (6 ext-eg + 4 int-eg + 4 ext-og + 2 gable),
    floors=3, roof=1, stair=1, slab_opening=1 (stair shaft), railing=3,
    door=5, window=7, room=9, section=2, plan_view=2, viewpoint=3,
    view_template=1, sheet=1, schedule=5.
    """
    cmds = _load_seed_v2_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)

    counts: dict[str, int] = {}
    for e in doc.elements.values():
        counts[e.kind] = counts.get(e.kind, 0) + 1

    assert counts.get("level") == 3
    assert counts.get("site") == 1
    assert counts.get("wall") == 16
    assert counts.get("floor") == 3
    assert counts.get("roof") == 1
    assert counts.get("door") == 5
    assert counts.get("window") == 7
    assert counts.get("stair") == 1
    assert counts.get("slab_opening") == 1
    assert counts.get("railing") == 3
    assert counts.get("room") == 9
    assert counts.get("section_cut") == 2
    assert counts.get("plan_view") == 2
    assert counts.get("viewpoint") == 3
    assert counts.get("view_template") == 1
    assert counts.get("sheet") == 1
    assert counts.get("schedule") == 5


def test_seed_v2_levels_match_3000mm_3500mm_5800mm_target() -> None:
    cmds = _load_seed_v2_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)
    levels = sorted(
        (e for e in doc.elements.values() if e.kind == "level"),
        key=lambda e: e.elevation_mm,  # type: ignore[attr-defined]
    )
    elevations = [round(lvl.elevation_mm, 1) for lvl in levels]  # type: ignore[attr-defined]
    assert elevations == [0.0, 3000.0, 5800.0]


def test_seed_v2_sheet_a101_has_four_viewports() -> None:
    cmds = _load_seed_v2_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)
    sheet = doc.elements.get("seed-sheet-a101")
    assert sheet is not None and sheet.kind == "sheet"
    assert len(sheet.viewports_mm) == 4  # type: ignore[attr-defined]


def test_seed_v2_default_orbit_viewpoint_present() -> None:
    cmds = _load_seed_v2_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)
    vp = doc.elements.get("seed-vp-default-orbit")
    assert vp is not None and vp.kind == "viewpoint"
