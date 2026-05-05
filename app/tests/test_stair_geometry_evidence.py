"""Stair rise / mid-run evidence on plan wire, section primitives, and glTF manifest (WP-B05 / WP-X02)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, ScheduleElem, SectionCutElem, StairElem
from bim_ai.export_gltf import export_manifest_extension_payload
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
)
from bim_ai.schedule_derivation import derive_schedule_table
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
            "sch-st": ScheduleElem(
                kind="schedule",
                id="sch-st",
                name="Stairs",
                filters={"category": "stair"},
            ),
        },
    )
    out = resolve_plan_projection_wire(doc, plan_view_id="pv-st", fallback_level_id="lvl0")
    p_st = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert p_st["storyRiseMm"] == pytest.approx(3200.0)
    assert p_st["midRunElevationMm"] == pytest.approx(1600.0)
    assert p_st["totalRiseMm"] == pytest.approx(3200.0)
    assert p_st["treadCountPlanProxy"] == p_st["riserCountPlanProxy"] - 1
    assert p_st["runBearingDegCcFromPlanX"] == pytest.approx(0.0)
    assert p_st["baseLevelName"] == "G"
    assert p_st["topLevelName"] == "L1"
    assert p_st["planUpDownLabel"] == "UP"
    assert "stairPlanBreakVisibilityToken" not in p_st

    ph_p = p_st["stairDocumentationPlaceholders_v0"]
    assert ph_p["stairRailingGuardPlaceholderSideTokens"] == [
        "rail_guard_left_of_run",
        "rail_guard_right_of_run",
    ]
    assert ph_p["stairPlanSectionDocumentationLabel"] == p_st["stairPlanSectionDocumentationLabel"]
    assert ph_p["bottomLandingFootprintBoundsMm"] == {
        "minXmMm": -560.0,
        "maxXmMm": 0.0,
        "minYmMm": -550.0,
        "maxYmMm": 550.0,
    }
    assert ph_p["topLandingFootprintBoundsMm"] == {
        "minXmMm": 5000.0,
        "maxXmMm": 5560.0,
        "minYmMm": -550.0,
        "maxYmMm": 550.0,
    }
    assert ph_p["stairTotalRunLandingFootprintBoundsMm"] == {
        "minXmMm": -560.0,
        "maxXmMm": 5560.0,
        "minYmMm": -550.0,
        "maxYmMm": 550.0,
    }

    sec_prim, _w = build_section_projection_primitives(doc, doc.elements["sec"])
    s_st = (sec_prim.get("stairs") or [])[0]
    assert s_st["storyRiseMm"] == pytest.approx(3200.0)
    assert s_st["midRunElevationMm"] == pytest.approx(1600.0)
    assert s_st["riserCountPlanProxy"] == p_st["riserCountPlanProxy"]
    assert s_st["treadCountPlanProxy"] == p_st["treadCountPlanProxy"]
    assert s_st["totalRiseMm"] == pytest.approx(3200.0)
    assert s_st["planUpDownLabel"] == "UP"
    assert s_st["runBearingDegCcFromPlanX"] == pytest.approx(0.0)
    assert "stairPlanBreakVisibilityToken" not in s_st
    assert s_st["stairDocumentationPlaceholders_v0"] == ph_p
    assert s_st["stairPlanSectionDocumentationLabel"] == ph_p["stairPlanSectionDocumentationLabel"]

    ext = export_manifest_extension_payload(doc)
    sg = ext.get("stairGeometryEvidence_v0")
    assert sg is not None and sg.get("format") == "stairGeometryEvidence_v0"
    stairs_ev = sg.get("stairs") or []
    assert len(stairs_ev) == 1
    row = stairs_ev[0]
    assert row["elementId"] == "s1"
    assert row["storyRiseMm"] == pytest.approx(3200.0)
    assert row["midRunElevationMm"] == pytest.approx(1600.0)
    assert row["totalRiseMm"] == pytest.approx(3200.0)
    assert row["riserCountPlanProxy"] == p_st["riserCountPlanProxy"]
    assert row["treadCountPlanProxy"] == p_st["treadCountPlanProxy"]
    assert row["planUpDownLabel"] == "UP"
    assert row["baseLevelName"] == "G"
    assert row["topLevelName"] == "L1"
    assert row["stairDocumentationPlaceholders_v0"] == ph_p

    st_tab = derive_schedule_table(doc, "sch-st")
    sch_row = st_tab["rows"][0]
    corr = sch_row["stairScheduleCorrelationToken"]
    assert corr == p_st["stairScheduleCorrelationToken"]
    assert corr == s_st["stairScheduleCorrelationToken"]
    assert corr == row["stairScheduleCorrelationToken"]


def test_plan_stair_break_visibility_span_fully_below_cut() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "pv": PlanViewElem(
                kind="plan_view",
                id="pv",
                name="P",
                levelId="lvl",
                viewRangeBottomMm=-800,
                viewRangeTopMm=4800,
                cutPlaneOffsetMm=3500,
            ),
            "st": StairElem(
                kind="stair",
                id="st",
                name="S",
                baseLevelId="lvl",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
                riserMm=160,
                treadMm=280,
            ),
        },
    )
    out = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lvl")
    st = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert st["stairPlanBreakVisibilityToken"] == "spanFullyBelowCut"


def test_plan_stair_break_visibility_span_fully_above_cut() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "pv": PlanViewElem(
                kind="plan_view",
                id="pv",
                name="P",
                levelId="lvl",
                viewRangeBottomMm=-800,
                viewRangeTopMm=4800,
                cutPlaneOffsetMm=-200,
            ),
            "st": StairElem(
                kind="stair",
                id="st",
                name="S",
                baseLevelId="lvl",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
                riserMm=160,
                treadMm=280,
            ),
        },
    )
    out = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lvl")
    st = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert st["stairPlanBreakVisibilityToken"] == "spanFullyAboveCut"


def test_plan_stair_placeholder_omitted_when_run_length_degenerate() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl0"),
            "sx": StairElem(
                kind="stair",
                id="sx",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 500.0, "yMm": 100.0},
                runEndMm={"xMm": 500.0, "yMm": 100.0},
                widthMm=1000,
                riserMm=160,
                treadMm=280,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id="lvl0")
    row = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert "stairDocumentationPlaceholders_v0" not in row
    assert "stairPlanSectionDocumentationLabel" not in row
    codes = {d["code"] for d in (row.get("stairDocumentationDiagnostics") or [])}
    assert "stair_run_length_degenerate" in codes


def test_plan_stair_break_visibility_respects_cut_plane() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "pv": PlanViewElem(
                kind="plan_view",
                id="pv",
                name="P",
                levelId="lvl",
                viewRangeBottomMm=-800,
                viewRangeTopMm=4800,
                cutPlaneOffsetMm=1600,
            ),
            "st": StairElem(
                kind="stair",
                id="st",
                name="S",
                baseLevelId="lvl",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
                riserMm=160,
                treadMm=280,
            ),
        },
    )
    out = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lvl")
    st = ((out.get("primitives") or {}).get("stairs") or [])[0]
    assert st["stairPlanBreakVisibilityToken"] == "cutSplitsSpan"


def test_plan_stair_diagnostics_invalid_level_rise_and_mismatch() -> None:
    doc_flat = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "lvl_dup": LevelElem(kind="level", id="lvl_dup", name="Ldup", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
            "st": StairElem(
                kind="stair",
                id="st",
                name="S",
                baseLevelId="lvl",
                topLevelId="lvl_dup",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 2000, "yMm": 0},
                riserMm=175,
            ),
        },
    )
    out_flat = plan_projection_wire_from_request(doc_flat, plan_view_id="pv", fallback_level_id="lvl")
    st_flat = ((out_flat.get("primitives") or {}).get("stairs") or [])[0]
    codes_f = {d["code"] for d in (st_flat.get("stairDocumentationDiagnostics") or [])}
    assert "stair_invalid_level_rise" in codes_f

    doc_bad = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl0"),
            "st": StairElem(
                kind="stair",
                id="st",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 5000, "yMm": 0},
                riserMm=50,
                treadMm=280,
            ),
        },
    )
    out_bad = plan_projection_wire_from_request(doc_bad, plan_view_id="pv", fallback_level_id="lvl0")
    st_bad = ((out_bad.get("primitives") or {}).get("stairs") or [])[0]
    codes_b = {d["code"] for d in (st_bad.get("stairDocumentationDiagnostics") or [])}
    assert "stair_riser_rise_mismatch" in codes_b


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
    diags = rows.get("stairDocumentationDiagnostics") or []
    assert any(d.get("code") == "stair_missing_level" and d.get("role") == "top" for d in diags)
    ph = rows.get("stairDocumentationPlaceholders_v0")
    assert ph is not None
    assert ph["stairPlanSectionDocumentationLabel"].startswith("—·")
    assert "stairRailingGuardPlaceholderSideTokens" in ph
