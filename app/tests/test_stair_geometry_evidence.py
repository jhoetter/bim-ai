"""Stair rise / mid-run evidence on plan wire, section primitives, and glTF manifest (WP-B05 / WP-X02)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, SectionCutElem, StairElem
from bim_ai.export_gltf import export_manifest_extension_payload
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
)
from bim_ai.section_projection_primitives import build_section_projection_primitives


def test_plan_section_gltf_stair_story_rise_agree_when_levels_resolve() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "pv": PlanViewElem(kind="plan_view", id="pv-st", name="P", levelId="lvl0"),
            "s1": StairElem(
                kind="stair",
                id="s1",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 5000, "yMm": 0},
                widthMm=1100,
                riserMm=160,
                treadMm=280,
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-st",
                name="Sec",
                line_start_mm={"xMm": 2500, "yMm": -2000},
                line_end_mm={"xMm": 2500, "yMm": 8000},
                crop_depth_mm=12000,
            ),
        },
    )
    out = resolve_plan_projection_wire(doc, plan_view_id="pv-st", fallback_level_id="lvl0")
    p_st = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert p_st["storyRiseMm"] == pytest.approx(3200.0)
    assert p_st["midRunElevationMm"] == pytest.approx(1600.0)

    sec_prim, _w = build_section_projection_primitives(doc, doc.elements["sec"])
    s_st = (sec_prim.get("stairs") or [])[0]
    assert s_st["storyRiseMm"] == pytest.approx(3200.0)
    assert s_st["midRunElevationMm"] == pytest.approx(1600.0)
    assert s_st["riserCountPlanProxy"] == p_st["riserCountPlanProxy"]

    ext = export_manifest_extension_payload(doc)
    sg = ext.get("stairGeometryEvidence_v0")
    assert sg is not None and sg.get("format") == "stairGeometryEvidence_v0"
    stairs_ev = sg.get("stairs") or []
    assert len(stairs_ev) == 1
    row = stairs_ev[0]
    assert row["elementId"] == "s1"
    assert row["storyRiseMm"] == pytest.approx(3200.0)
    assert row["midRunElevationMm"] == pytest.approx(1600.0)
    assert row["riserCountPlanProxy"] == p_st["riserCountPlanProxy"]


def test_plan_wire_without_resolved_levels_omits_stair_story_mm() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
            "s-bad": StairElem(
                kind="stair",
                id="s-bad",
                name="S",
                baseLevelId="lvl",
                topLevelId="missing-top",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 4000, "yMm": 0},
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id="lvl")
    rows = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert "storyRiseMm" not in rows
    assert "midRunElevationMm" not in rows
