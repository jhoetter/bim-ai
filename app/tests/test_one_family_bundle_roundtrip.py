"""WP-A01: one-family CLI bundle replays through Python engine (docs spine coverage)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from bim_ai.document import Document
from bim_ai.elements import RoomElem, ScheduleElem, SheetElem
from bim_ai.engine import apply_inplace, command_adapter
from bim_ai.plan_projection_wire import section_cut_projection_wire
from bim_ai.schedule_derivation import derive_schedule_table

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


def test_one_family_bundle_covers_documentation_spine() -> None:
    cmds = _load_cli_bundle_commands()
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    _apply_all(doc, cmds)

    kinds = {e.kind for e in doc.elements.values()}
    for k in (
        "level",
        "wall",
        "door",
        "window",
        "floor",
        "slab_opening",
        "room",
        "roof",
        "stair",
        "plan_view",
        "section_cut",
        "sheet",
        "schedule",
        "view_template",
        "viewpoint",
        "dimension",
        "family_type",
    ):
        assert k in kinds, f"missing kind {k}"

    kitchen = doc.elements.get("hf-room-kitchen")
    assert isinstance(kitchen, RoomElem)
    assert kitchen.programme_code == "KIT-BUNDLE"

    sh = doc.elements.get("hf-sheet-ga01")
    assert isinstance(sh, SheetElem)
    assert sh.titleblock_parameters.get("projectName") == "One‑family golden"
    assert sh.paper_width_mm == 42_000

    vps = sh.viewports_mm
    assert len(vps) == 3
    assert vps[0] == {
        "viewportId": "vp-plan-eg",
        "label": "EG plan (named view)",
        "viewRef": "plan:hf-plan-eg-openings",
        "xMm": 1200,
        "yMm": 1800,
        "widthMm": 9000,
        "heightMm": 9000,
    }
    assert vps[1] == {
        "viewportId": "vp-sec-demo",
        "label": "Section scaffold",
        "viewRef": "section:hf-sec-longitudinal",
        "xMm": 10800,
        "yMm": 1800,
        "widthMm": 4200,
        "heightMm": 9000,
    }
    assert vps[2] == {
        "viewportId": "vp-sch-windows",
        "label": "Window schedule",
        "viewRef": "schedule:hf-sch-window",
        "xMm": 1200,
        "yMm": 11200,
        "widthMm": 13800,
        "heightMm": 3200,
    }

    sec = section_cut_projection_wire(doc, "hf-sec-longitudinal")
    assert not sec.get("errors")
    prim = sec.get("primitives") or {}
    assert prim.get("format") == "sectionProjectionPrimitives_v1"
    wall_count = int((sec.get("countsByVisibleKind") or {}).get("wall", 0))
    assert wall_count >= 1

    sch_room = doc.elements.get("hf-sch-room")
    assert isinstance(sch_room, ScheduleElem)
    assert sch_room.grouping.get("sortBy") == "areaM2"
    assert sch_room.grouping.get("sortDescending") is True

    for sid in (
        "hf-sch-room",
        "hf-sch-window",
        "hf-sch-door",
        "hf-sch-floor",
        "hf-sch-roof",
        "hf-sch-stair",
        "hf-sch-sheet",
        "hf-sch-plan-view",
        "hf-sch-section",
    ):
        tbl = derive_schedule_table(doc, sid)
        assert tbl["scheduleId"] == sid
        assert int(tbl.get("totalRows") or 0) >= 1, sid
