"""Smoke tests for constraint evaluation and IFC exchange payloads (prompt validation entry)."""

from __future__ import annotations

import json

import pytest

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    FloorElem,
    GridLineElem,
    LevelElem,
    PlanViewElem,
    SheetElem,
    StairElem,
    WallElem,
)
from bim_ai.engine import try_commit
from bim_ai.export_ifc import IFC_AVAILABLE
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload
from bim_ai.sheet_titleblock_revision_issue_v1 import normalize_titleblock_revision_issue_v1


def test_evaluate_returns_list_for_minimal_wall_document() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    assert isinstance(viols, list)


@pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')")
def test_ifc_manifest_exports_property_coverage_slice_when_kernel_eligible() -> None:
    doc = Document(
        revision=2,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="S",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4500, "yMm": 0},
                    {"xMm": 4500, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                thicknessMm=200,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    ev = mf.get("ifcPropertySetCoverageEvidence_v0") or {}
    assert ev.get("format") == "ifcPropertySetCoverageEvidence_v0"
    assert ev.get("available") is True


def test_sheet_revision_issue_metadata_missing_when_vp_and_titleblock_empty_metadata() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="PV", levelId="lvl"),
            "sx": SheetElem(
                kind="sheet",
                id="sx",
                name="S",
                titleBlock="TB",
                viewportsMm=[
                    {"viewportId": "vp1", "viewRef": "plan:pv", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 100},
                ],
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    assert any(v.rule_id == "sheet_revision_issue_metadata_missing" for v in viols)


def test_sheet_revision_issue_metadata_missing_not_fired_when_code_present() -> None:
    doc = Document(
        revision=2,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="PV", levelId="lvl"),
            "sx": SheetElem(
                kind="sheet",
                id="sx",
                name="S",
                titleBlock="TB",
                titleblock_parameters={"revision": "A"},
                viewportsMm=[
                    {"viewportId": "vp1", "viewRef": "plan:pv", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 100},
                ],
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    assert not any(v.rule_id == "sheet_revision_issue_metadata_missing" for v in viols)


def test_sheet_revision_issue_quick_fix_merge_titleblock_patch() -> None:
    doc = Document(
        revision=3,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="PV", levelId="lvl"),
            "sx": SheetElem(
                kind="sheet",
                id="sx",
                name="S",
                titleBlock="TB",
                viewportsMm=[
                    {"viewportId": "vp1", "viewRef": "plan:pv", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 100},
                ],
            ),
        },
    )
    viol = next(v for v in evaluate(dict(doc.elements)) if v.rule_id == "sheet_revision_issue_metadata_missing")
    qf = viol.quick_fix_command
    assert isinstance(qf, dict)
    assert qf.get("type") == "updateElementProperty"
    assert qf.get("key") == "titleblockParametersPatch"

    ok, new_doc, _cmd, _viols, err = try_commit(doc, qf)
    assert ok and err == "ok" and new_doc is not None

    sx2 = new_doc.elements["sx"]
    assert isinstance(sx2, SheetElem)
    params = normalize_titleblock_revision_issue_v1(dict(sx2.titleblock_parameters or {}))

    patch_obj = json.loads(str(qf.get("value") or "{}"))
    assert isinstance(patch_obj, dict)

    ids = {(params["revisionId"], params["revisionCode"])}
    assert ids == {(str(patch_obj.get("revisionId") or "").strip(), str(patch_obj.get("revisionCode") or "").strip())}


def test_stair_schedule_degenerate_run_advisories() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "sx": StairElem(
                kind="stair",
                id="sx",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 100.0, "yMm": 200.0},
                runEndMm={"xMm": 100.0, "yMm": 200.0},
                widthMm=1000,
                riserMm=160,
                treadMm=280,
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    ids = {v.rule_id for v in viols}
    assert "stair_schedule_degenerate_run" in ids
    assert "stair_schedule_guardrail_placeholder_uncorrelated" in ids


def test_stair_schedule_incomplete_riser_tread_advisory() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "sx": StairElem(
                kind="stair",
                id="sx",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 4000, "yMm": 0},
                widthMm=1000,
                riserMm=0,
                treadMm=280,
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    assert any(v.rule_id == "stair_schedule_incomplete_riser_tread" for v in viols)


def test_constraints_level_parent_unresolved() -> None:
    root = LevelElem(kind="level", id="r", name="R", elevationMm=0)
    child = LevelElem(
        kind="level",
        id="c",
        name="C",
        elevationMm=100,
        parentLevelId="missing",
        offsetFromParentMm=50,
    )
    viols = evaluate({"r": root, "c": child})
    v = next(x for x in viols if x.rule_id == "level_parent_unresolved")
    assert v.severity == "error"
    assert sorted(v.element_ids) == sorted(["c", "missing"])


def test_constraints_datum_grid_reference_missing() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    g = GridLineElem(
        kind="grid_line",
        id="g1",
        name="G",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 0, "yMm": 1000},
        levelId="nope",
    )
    viols = evaluate({"lvl": lvl, "g1": g})
    v = next(x for x in viols if x.rule_id == "datum_grid_reference_missing")
    assert v.element_ids == ["g1"]


def test_constraints_elevation_marker_view_unresolved() -> None:
    pv = PlanViewElem(kind="plan_view", id="pv", name="P", levelId="nope")
    viols = evaluate({"pv": pv})
    v = next(x for x in viols if x.rule_id == "elevation_marker_view_unresolved")
    assert v.element_ids == ["pv"]


def test_constraints_section_level_reference_missing() -> None:
    b = BcfElem(
        kind="bcf",
        id="bcf1",
        title="T",
        sectionCutId="not-a-section",
    )
    viols = evaluate({"bcf1": b})
    v = next(x for x in viols if x.rule_id == "section_level_reference_missing")
    assert sorted(v.element_ids) == sorted(["bcf1", "not-a-section"])


def test_material_catalog_missing_layer_stack_advisory() -> None:
    els = {
        "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        "w-a": WallElem(
            kind="wall",
            id="w-a",
            name="W",
            levelId="lvl-g",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
    }
    viols = evaluate(els)
    assert any(v.rule_id == "material_catalog_missing_layer_stack" for v in viols)


def test_material_catalog_stale_assembly_reference_advisory() -> None:
    els = {
        "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        "w-a": WallElem(
            kind="wall",
            id="w-a",
            name="W",
            levelId="lvl-g",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
            wallTypeId="missing-type",
        ),
    }
    viols = evaluate(els)
    assert any(v.rule_id == "material_catalog_stale_assembly_reference" for v in viols)

