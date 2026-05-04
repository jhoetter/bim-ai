"""Golden snapshot loads for deterministic exchange/evidence scaffolding."""

from __future__ import annotations

import json
from pathlib import Path

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.schedule_derivation import derive_schedule_table


def _golden_doc() -> Document:
    p = Path(__file__).resolve().parent / "fixtures" / "golden_exchange_snapshot.json"
    wire = json.loads(p.read_text(encoding="utf-8"))
    return Document.model_validate(wire)


def test_golden_exchange_snapshot_loads() -> None:
    doc = _golden_doc()
    assert doc.elements["lvl-eg"].kind == "level"
    assert doc.revision >= 2


def test_golden_snapshot_contains_exchange_documentation_kinds() -> None:
    doc = _golden_doc()
    kinds = {getattr(e, "kind", "?") for e in doc.elements.values()}
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
        "sheet",
        "schedule",
    ):
        assert k in kinds, f"missing {k} in golden fixture"


def test_golden_snapshot_has_no_exchange_ifc_unhandled_geometry_warnings() -> None:
    doc = _golden_doc()

    els = dict(doc.elements)
    vs = evaluate(els)

    warns = [v for v in vs if v.rule_id == "exchange_ifc_unhandled_geometry_present"]

    assert warns == [], [w.message for w in warns]


def test_golden_fixture_schedule_categories_derive_rows() -> None:
    doc = _golden_doc()

    room_tbl = derive_schedule_table(doc, "sch-room")
    assert room_tbl["category"] == "room" and room_tbl["totalRows"] >= 1

    door_tbl = derive_schedule_table(doc, "sch-door")
    assert door_tbl["category"] == "door" and door_tbl["totalRows"] >= 1

    win_tbl = derive_schedule_table(doc, "sch-window")
    assert win_tbl["category"] == "window" and win_tbl["totalRows"] >= 1

    fl_tbl = derive_schedule_table(doc, "sch-floor")
    assert fl_tbl["category"] == "floor" and fl_tbl["totalRows"] >= 1

    rf_tbl = derive_schedule_table(doc, "sch-roof")
    assert rf_tbl["category"] == "roof" and rf_tbl["totalRows"] >= 1

    st_tbl = derive_schedule_table(doc, "sch-stair")
    assert st_tbl["category"] == "stair" and st_tbl["totalRows"] >= 1

    sh_tbl = derive_schedule_table(doc, "sch-sheet")
    assert sh_tbl["category"] == "sheet" and sh_tbl["totalRows"] >= 1

    pv_tbl = derive_schedule_table(doc, "sch-plan-view")
    assert pv_tbl["category"] == "plan_view" and pv_tbl["totalRows"] >= 1
