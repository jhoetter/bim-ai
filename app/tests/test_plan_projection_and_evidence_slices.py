"""WP-C01/C02 projection wire + deterministic evidence helpers."""

from __future__ import annotations

import hashlib
import json
from uuid import uuid4

import pytest

from bim_ai.commands import (
    CreateFloorCmd,
    CreateGridLineCmd,
    CreateLevelCmd,
    CreateRoofCmd,
    CreateRoomRectangleCmd,
    CreateSlabOpeningCmd,
    CreateWallCmd,
    UpsertPlanViewCmd,
    UpsertRoomColorSchemeCmd,
    UpsertScheduleCmd,
    UpsertScheduleFiltersCmd,
    UpsertSheetCmd,
    UpsertSheetViewportsCmd,
    UpsertViewTemplateCmd,
)
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    GridLineElem,
    LevelElem,
    PlanCategoryGraphicRow,
    PlanTagStyleElem,
    PlanViewElem,
    RoomColorSchemeRow,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    SlabOpeningElem,
    StairElem,
    ViewTemplateElem,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
    WindowElem,
)
from bim_ai.engine import apply_inplace
from bim_ai.evidence_manifest import (
    agent_evidence_closure_hints,
    deterministic_plan_view_evidence_manifest,
    deterministic_section_cut_evidence_manifest,
    deterministic_sheet_evidence_manifest,
    evidence_package_semantic_digest_sha256,
)
from bim_ai.plan_projection_wire import (
    BUILTIN_PLAN_TAG_OPENING_ID,
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
    section_cut_projection_wire,
)
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.sheet_preview_svg import (
    format_plan_projection_export_segment,
    format_room_programme_legend_documentation_segment,
    format_section_viewport_documentation_segment,
    plan_room_programme_legend_hints_v0,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_viewport_export_listing_lines,
    validate_sheet_print_raster_print_contract_v3,
    viewport_evidence_hints_v1,
)
from bim_ai.type_material_registry import merged_registry_payload


def test_plan_projection_wire_counts_visible_walls() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "w": WallElem(
                kind="wall",
                id="w",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    assert out["format"] == "planProjectionWire_v1"
    assert out["activeLevelId"] == "lvl"
    assert out["countsByVisibleKind"].get("wall") == 1
    prim = out.get("primitives") or {}
    assert prim.get("format") == "planProjectionPrimitives_v1"
    assert len(prim.get("walls") or []) == 1


def test_plan_projection_wire_emits_room_separations_and_counts() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    sep = RoomSeparationElem(
        kind="room_separation",
        id="rs-1",
        name="Sep",
        levelId="lvl",
        start={"xMm": 1500.0, "yMm": 0.0},
        end={"xMm": 1500.0, "yMm": 3000.0},
    )
    doc = Document(revision=2, elements={"lvl": lvl, "rs-1": sep})
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    assert out["countsByVisibleKind"].get("room_separation") == 1
    prim = out.get("primitives") or {}
    rss = prim.get("roomSeparations") or []
    assert len(rss) == 1
    row = rss[0]
    assert row["id"] == "rs-1"
    assert row["name"] == "Sep"
    assert row["lengthMm"] == 3000.0
    assert row["axisAlignedBoundarySegmentEligible"] is True
    assert "axisBoundarySegmentExcludedReason" not in row
    assert row["onAuthoritativeDerivedFootprintBoundary"] is False
    assert row["piercesDerivedRectangleInterior"] is False


def test_plan_projection_wire_room_separation_axis_excluded_reasons() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    short = RoomSeparationElem(
        kind="room_separation",
        id="rs-short",
        name="Short",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 40.0, "yMm": 0.0},
    )
    diagonal = RoomSeparationElem(
        kind="room_separation",
        id="rs-diag",
        name="Diag",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 3000.0, "yMm": 3000.0},
    )
    doc = Document(revision=1, elements={"lvl": lvl, "rs-short": short, "rs-diag": diagonal})
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    prim = out.get("primitives") or {}
    by_id = {r["id"]: r for r in prim.get("roomSeparations") or []}
    assert by_id["rs-short"]["axisAlignedBoundarySegmentEligible"] is False
    assert by_id["rs-short"]["axisBoundarySegmentExcludedReason"] == "too_short"
    assert by_id["rs-diag"]["axisAlignedBoundarySegmentEligible"] is False
    assert by_id["rs-diag"]["axisBoundarySegmentExcludedReason"] == "non_axis_aligned"


def test_plan_projection_wire_room_separation_interior_pierce_flag() -> None:
    """Axis-aligned rectangle + vertical separator through interior → pierce flag on wire row."""
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    sep = RoomSeparationElem(
        kind="room_separation",
        id="rs-mid",
        name="Mid",
        levelId="lvl-1",
        start={"xMm": 2000, "yMm": 500},
        end={"xMm": 2000, "yMm": 3500},
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "rs-mid": sep, **{w.id: w for w in walls}})
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl-1")
    rss = (out.get("primitives") or {}).get("roomSeparations") or []
    assert len(rss) == 1
    assert rss[0]["id"] == "rs-mid"
    assert rss[0]["piercesDerivedRectangleInterior"] is True
    assert rss[0]["axisAlignedBoundarySegmentEligible"] is True


def test_section_projection_wire_reports_missing_section() -> None:
    doc = Document(revision=1, elements={})
    out = section_cut_projection_wire(doc, "nope")
    assert out["format"] == "sectionProjectionWire_v1"
    assert out.get("errors")


def test_section_projection_wire_emits_wall_u_span_for_perpendicular_cut() -> None:
    """Horizontal wall + vertical cut plane: wall is seen 'edge-on' → thickness-sized u span."""
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=300.0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -5000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 5000.0},
        cropDepthMm=9000.0,
    )
    doc = Document(revision=1, elements={"lvl": lvl, "w1": wall, "sec-a": sec})
    out = section_cut_projection_wire(doc, "sec-a")
    assert not out.get("errors")
    prim = out.get("primitives") or {}
    assert prim.get("format") == "sectionProjectionPrimitives_v1"
    ws = prim.get("walls") or []
    assert len(ws) == 1
    span = float(ws[0]["uEndMm"]) - float(ws[0]["uStartMm"])
    assert span > 150.0 and span < 260.0
    assert ws[0]["elementId"] == "w1"
    assert ws[0]["cutHatchKind"] == "edgeOn"
    assert out["countsByVisibleKind"]["wall"] == 1
    markers = prim.get("levelMarkers") or []
    assert len(markers) == 1
    assert markers[0]["id"] == "lvl"
    assert markers[0]["elevationMm"] == 300.0
    ext = prim.get("sectionGeometryExtentMm")
    assert isinstance(ext, dict)
    assert abs(float(ext["uMaxMm"]) - float(ext["uMinMm"]) - span) < 1.0
    assert float(ext["zMinMm"]) == float(ws[0]["zBottomMm"])
    assert float(ext["zMaxMm"]) == float(ws[0]["zTopMm"])
    hints = prim.get("sectionDocMaterialHints") or []
    assert len(hints) == 1
    assert hints[0]["tokenId"] == ws[0]["id"]
    assert hints[0]["wallElementId"] == "w1"
    assert hints[0]["materialLabel"] == "structure"
    assert hints[0]["cutPatternHint"] == "edgeOn"
    assert float(hints[0]["uAnchorMm"]) == round(
        0.5 * (float(ws[0]["uStartMm"]) + float(ws[0]["uEndMm"])), 3
    )


def test_section_projection_wire_wall_parallel_to_cut_is_along_cut_hatch() -> None:
    """Vertical wall offset from a vertical cut plane: large U span → alongCut classification."""
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0.0)
    wall = WallElem(
        kind="wall",
        id="w-along",
        name="W",
        levelId="lvl",
        start={"xMm": 3100.0, "yMm": -1000.0},
        end={"xMm": 3100.0, "yMm": 6000.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -5000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 5000.0},
        cropDepthMm=9000.0,
    )
    doc = Document(revision=1, elements={"lvl": lvl, "w-along": wall, "sec-a": sec})
    out = section_cut_projection_wire(doc, "sec-a")
    ws = (out.get("primitives") or {}).get("walls") or []
    assert len(ws) == 1
    assert ws[0]["cutHatchKind"] == "alongCut"
    hints = (out.get("primitives") or {}).get("sectionDocMaterialHints") or []
    assert len(hints) == 1
    assert hints[0]["cutPatternHint"] == "alongCut"
    assert hints[0]["materialLabel"] == "structure"


def test_section_projection_primitives_degenerate_cut_emits_empty_section_doc_material_hints() -> (
    None
):
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-degen",
        name="X",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 0.0, "yMm": 0.0},
        cropDepthMm=1000.0,
    )
    doc = Document(revision=1, elements={"sec-degen": sec})
    prim, _w = build_section_projection_primitives(doc, sec)
    assert prim.get("sectionDocMaterialHints") == []


def test_section_projection_wire_typed_wall_material_hint_uses_builtin_display_label() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=300.0)
    wt = WallTypeElem(
        kind="wall_type",
        id="wt",
        name="WT",
        layers=[
            WallTypeLayer(
                thicknessMm=200,
                layer_function="structure",
                materialKey="mat-concrete-structure-v1",
            ),
        ],
    )
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
        wallTypeId="wt",
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -5000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 5000.0},
        cropDepthMm=9000.0,
    )
    doc = Document(revision=1, elements={"lvl": lvl, "wt": wt, "w1": wall, "sec-a": sec})
    out = section_cut_projection_wire(doc, "sec-a")
    hints = (out.get("primitives") or {}).get("sectionDocMaterialHints") or []
    assert len(hints) == 1
    assert hints[0]["materialLabel"] == "Concrete structure"
    assert hints[0]["wallElementId"] == "w1"


def test_section_projection_wire_emits_door_when_cut_hits_host_wall() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0.0)
    wall = WallElem(
        kind="wall",
        id="w-host",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    door = DoorElem(kind="door", id="d1", name="D", wallId="w-host", alongT=0.5, widthMm=900.0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -8000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 8000.0},
        cropDepthMm=12000.0,
    )
    doc = Document(revision=1, elements={"lvl": lvl, "w-host": wall, "d1": door, "sec-a": sec})
    out = section_cut_projection_wire(doc, "sec-a")
    ds = (out.get("primitives") or {}).get("doors") or []
    assert len(ds) == 1
    assert ds[0]["elementId"] == "d1"
    assert out["countsByVisibleKind"]["door"] == 1
    markers = (out.get("primitives") or {}).get("levelMarkers") or []
    assert markers == [{"id": "lvl", "name": "L", "elevationMm": 0.0}]


def test_section_projection_wire_door_reveal_widens_opening_half_width_and_emits_hint() -> None:
    """Interior reveal expands rough opening along U; section row carries revealInteriorMm when set."""
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0.0)
    wall = WallElem(
        kind="wall",
        id="w-host",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    door_plain = DoorElem(
        kind="door",
        id="d-plain",
        name="D",
        wallId="w-host",
        alongT=0.5,
        widthMm=900.0,
    )
    door_rev = DoorElem(
        kind="door",
        id="d-rev",
        name="D",
        wallId="w-host",
        alongT=0.5,
        widthMm=900.0,
        revealInteriorMm=80.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -8000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 8000.0},
        cropDepthMm=12000.0,
    )
    doc_plain = Document(
        revision=1, elements={"lvl": lvl, "w-host": wall, "d-plain": door_plain, "sec-a": sec}
    )
    doc_rev = Document(
        revision=1, elements={"lvl": lvl, "w-host": wall, "d-rev": door_rev, "sec-a": sec}
    )
    out_plain = section_cut_projection_wire(doc_plain, "sec-a")
    out_rev = section_cut_projection_wire(doc_rev, "sec-a")
    ds_plain = (out_plain.get("primitives") or {}).get("doors") or []
    ds_rev = (out_rev.get("primitives") or {}).get("doors") or []
    assert len(ds_plain) == 1 and len(ds_rev) == 1
    hw0 = float(ds_plain[0]["openingHalfWidthAlongUMm"])
    hw1 = float(ds_rev[0]["openingHalfWidthAlongUMm"])
    assert hw1 > hw0
    assert ds_plain[0].get("revealInteriorMm") is None
    assert ds_rev[0]["revealInteriorMm"] == 80.0


def test_section_floor_emits_multiple_panels_when_slab_opening_subtracts_outer_rect() -> None:
    """Rectangular floor minus one slab void: section uses same pane bands as cut kernel / glTF."""
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0.0)
    floor = FloorElem(
        kind="floor",
        id="fl",
        name="F",
        levelId="lvl",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 5000, "yMm": 0},
            {"xMm": 5000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
        thicknessMm=220.0,
    )
    slab_open = SlabOpeningElem(
        kind="slab_opening",
        id="so",
        name="O",
        hostFloorId="fl",
        boundaryMm=[
            {"xMm": 900, "yMm": 900},
            {"xMm": 1900, "yMm": 900},
            {"xMm": 1900, "yMm": 1700},
            {"xMm": 900, "yMm": 1700},
        ],
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 2500.0, "yMm": -1000.0},
        lineEndMm={"xMm": 2500.0, "yMm": 5000.0},
        cropDepthMm=8000.0,
    )
    doc = Document(
        revision=1,
        elements={"lvl": lvl, "fl": floor, "so": slab_open, "sec-a": sec},
    )
    out = section_cut_projection_wire(doc, "sec-a")
    assert not out.get("errors")
    prim = out.get("primitives") or {}
    fls = prim.get("floors") or []
    assert len(fls) >= 3
    ids = {str(f["id"]) for f in fls}
    assert "floor:fl:pane-1" in ids
    assert "floor:fl:pane-4" in ids
    assert all(str(f.get("elementId")) == "fl" for f in fls)
    assert out["countsByVisibleKind"]["floor"] == len(fls)
    so_ev = prim.get("slabOpeningDocumentationEvidence_v0") or {}
    so_rows = so_ev.get("rows") or []
    assert len(so_rows) == 1
    assert so_rows[0]["openingId"] == "so"
    assert so_rows[0]["skipReason"] is None
    assert so_rows[0]["panelSplitEvidence"]["eligible"] is True
    sec_seg = format_section_viewport_documentation_segment(doc, "section:sec-a")
    assert "soDoc[n=1" in sec_seg


def test_plan_wire_slab_opening_documentation_evidence_v0() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(doc, UpsertPlanViewCmd(id="pv", name="P", level_id="lvl"))
    apply_inplace(
        doc,
        CreateFloorCmd(
            id="fl",
            name="Slab",
            level_id="lvl",
            boundary_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
            thickness_mm=220,
        ),
    )
    apply_inplace(
        doc,
        CreateSlabOpeningCmd(
            id="so-1",
            name="Lobby",
            host_floor_id="fl",
            boundary_mm=[
                {"xMm": 900, "yMm": 900},
                {"xMm": 1900, "yMm": 900},
                {"xMm": 1900, "yMm": 1700},
                {"xMm": 900, "yMm": 1700},
            ],
        ),
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id="pv")
    ev = wire.get("slabOpeningDocumentationEvidence_v0") or {}
    rows = ev.get("rows") or []
    assert len(rows) == 1
    r0 = rows[0]
    assert r0["openingId"] == "so-1"
    assert r0["hostFloorId"] == "fl"
    assert r0["axisAlignedBoundsMm"] == {
        "minX": 900.0,
        "minY": 900.0,
        "maxX": 1900.0,
        "maxY": 1700.0,
    }
    assert r0["areaMm2"] == 800000.0
    assert r0["perimeterMm"] == 3600.0
    assert r0["skipReason"] is None
    assert r0["panelSplitEvidence"]["eligible"] is True
    assert r0["documentationToken"] == "so/so-1@host/fl"
    seg = format_plan_projection_export_segment(wire)
    assert "soDoc[n=1" in seg


def test_plan_wire_wall_corner_join_summary_v1_and_listing_segment() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
            "wh": WallElem(
                kind="wall",
                id="wh",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wv": WallElem(
                kind="wall",
                id="wv",
                name="V",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 0, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id=None)
    wjs = wire.get("wallCornerJoinSummary_v1")
    assert isinstance(wjs, dict)
    assert wjs["format"] == "wallCornerJoinSummary_v1"
    assert len(wjs["joins"]) == 1
    assert wjs["joins"][0]["joinKind"] == "butt"
    seg = format_plan_projection_export_segment(wire)
    assert "wjSum[n=1 h=" in seg


def test_plan_wire_slab_opening_documentation_multi_void_skip() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(doc, UpsertPlanViewCmd(id="pv", name="P", level_id="lvl"))
    apply_inplace(
        doc,
        CreateFloorCmd(
            id="fl",
            name="Slab",
            level_id="lvl",
            boundary_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateSlabOpeningCmd(
            id="so-a",
            name="A",
            host_floor_id="fl",
            boundary_mm=[
                {"xMm": 500, "yMm": 500},
                {"xMm": 700, "yMm": 500},
                {"xMm": 700, "yMm": 700},
                {"xMm": 500, "yMm": 700},
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateSlabOpeningCmd(
            id="so-b",
            name="B",
            host_floor_id="fl",
            boundary_mm=[
                {"xMm": 900, "yMm": 900},
                {"xMm": 1100, "yMm": 900},
                {"xMm": 1100, "yMm": 1100},
                {"xMm": 900, "yMm": 1100},
            ],
        ),
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id="pv")
    rows = (wire.get("slabOpeningDocumentationEvidence_v0") or {}).get("rows") or []
    assert len(rows) == 2
    assert all(r["skipReason"] == "multi_slab_void_on_host" for r in rows)
    assert all(r["panelSplitEvidence"]["eligible"] is False for r in rows)


def test_plan_wire_slab_opening_documentation_non_axis_aligned_opening() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(doc, UpsertPlanViewCmd(id="pv", name="P", level_id="lvl"))
    apply_inplace(
        doc,
        CreateFloorCmd(
            id="fl",
            name="Slab",
            level_id="lvl",
            boundary_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateSlabOpeningCmd(
            id="so-t",
            name="Tri",
            host_floor_id="fl",
            boundary_mm=[
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 2000, "yMm": 1000},
                {"xMm": 1500, "yMm": 1800},
            ],
        ),
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id="pv")
    rows = (wire.get("slabOpeningDocumentationEvidence_v0") or {}).get("rows") or []
    assert len(rows) == 1
    assert rows[0]["skipReason"] == "non_axis_aligned_opening_outline"
    assert rows[0]["panelSplitEvidence"]["eligible"] is False


def test_merged_registry_has_builtin_format() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    pay = merged_registry_payload(doc)
    assert pay["format"] == "typeMaterialRegistry_v1"
    assert pay["builtin"]["format"] == "bimAiBuiltinRegistry_v1"


def test_deterministic_sheet_evidence_rows_stable() -> None:
    sid = uuid4()
    doc = Document(
        revision=2,
        elements={
            "sheet-a": SheetElem(kind="sheet", id="sheet-a", name="A1"),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="pfx",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    assert len(rows) == 1
    assert rows[0]["sheetId"] == "sheet-a"
    assert "svgHref" in rows[0]
    assert rows[0]["printRasterPngHref"].endswith("/exports/sheet-print-raster.png?sheetId=sheet-a")
    ingest = rows[0].get("sheetPrintRasterIngest_v1") or {}
    assert ingest.get("format") == "sheetPrintRasterIngest_v1"
    assert ingest.get("contract") == "sheetPrintRasterPrintSurrogate_v2"
    assert ingest.get("svgContentSha256") and ingest.get("placeholderPngSha256")
    diffc = ingest.get("diffCorrelation") or {}
    assert diffc.get("format") == "sheetPrintRasterDiffCorrelation_v1"
    assert diffc.get("playwrightBaselineSlot") == "pngFullSheet"
    pw = rows[0]["playwrightSuggestedFilenames"]
    assert pw["rasterPlaceholderProbe"] == "pfx-sheet-sheet-a.raster-placeholder.png"
    assert rows[0]["playwrightSuggestedFilenames"]["pngViewport"].startswith("pfx-sheet-sheet-a")
    assert rows[0]["playwrightSuggestedFilenames"]["pngFullSheet"] == "pfx-sheet-sheet-a-full.png"
    assert rows[0].get("viewportEvidenceHints_v0") == []
    assert rows[0].get("detailCalloutReadout_v0") == []
    assert rows[0].get("planRoomProgrammeLegendHints_v0") == []
    corr = rows[0].get("correlation") or {}
    assert corr.get("semanticDigestPrefix16") == "a" * 16
    assert corr.get("modelRevision") == 2
    assert corr.get("suggestedEvidenceBundleEvidencePackageJson") == "pfx-evidence-package.json"

    sh_ev = doc.elements["sheet-a"]
    assert isinstance(sh_ev, SheetElem)
    svg_body = sheet_elem_to_svg(doc, sh_ev)
    placeholder_png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh_ev, svg_body)
    ingest_png_sha = (rows[0].get("sheetPrintRasterIngest_v1") or {}).get("placeholderPngSha256")
    assert ingest_png_sha == hashlib.sha256(placeholder_png).hexdigest()
    v3 = rows[0].get("sheetPrintRasterPrintContract_v3") or {}
    assert v3.get("format") == "sheetPrintRasterPrintContract_v3"
    assert v3.get("pngByteSha256") == ingest_png_sha
    ok_rows, errs_rows = validate_sheet_print_raster_print_contract_v3(
        v3, placeholder_png, doc, sh_ev, svg_body
    )
    assert ok_rows, errs_rows


def test_deterministic_sheet_evidence_viewport_hints_v0_sorted_and_crop() -> None:
    sid = uuid4()
    doc = Document(
        revision=5,
        elements={
            "sheet-b": SheetElem(
                kind="sheet",
                id="sheet-b",
                name="S",
                viewportsMm=[
                    {"viewportId": "z", "xMm": 1, "yMm": 2, "widthMm": 100, "heightMm": 100},
                    {
                        "viewportId": "a",
                        "xMm": 5,
                        "yMm": 6,
                        "widthMm": 120,
                        "heightMm": 90,
                        "cropMinMm": {"xMm": 7, "yMm": 8},
                        "cropMaxMm": {"xMm": 9, "yMm": 11},
                    },
                ],
            ),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="pfx",
        semantic_digest_sha256="b" * 64,
        semantic_digest_prefix16="b" * 16,
    )
    hints = rows[0]["viewportEvidenceHints_v0"]
    assert [h["viewportId"] for h in hints] == ["a", "z"]
    zrow = next(h for h in hints if h["viewportId"] == "z")
    assert zrow["crop"] == "omit"
    arow = next(h for h in hints if h["viewportId"] == "a")
    assert arow["crop"] == "mn=7,8 mx=9,11"
    assert arow.get("planProjectionSegment") == ""
    assert arow.get("sectionDocumentationSegment") == ""
    assert arow.get("scheduleDocumentationSegment") == ""
    assert zrow.get("detailCalloutDocumentationSegment") == ""
    assert arow.get("detailCalloutDocumentationSegment") == ""


def test_deterministic_sheet_detail_callout_readout_v0_sorted_and_resolution() -> None:
    sid = uuid4()
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    doc = Document(
        revision=9,
        elements={
            "lvl": lvl,
            "pv1": PlanViewElem(kind="plan_view", id="pv1", name="EG", levelId="lvl"),
            "sec1": SectionCutElem(
                kind="section_cut",
                id="sec1",
                name="Cut A",
                lineStartMm={"xMm": 0, "yMm": 0},
                lineEndMm={"xMm": 1000, "yMm": 0},
            ),
            "sh-dc": SheetElem(
                kind="sheet",
                id="sh-dc",
                name="DC",
                viewportsMm=[
                    {
                        "viewportId": "vp-b",
                        "viewportRole": "detail_callout",
                        "viewRef": "plan:no-such-plan",
                        "detailNumber": "2",
                        "label": "B",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 1000,
                        "heightMm": 800,
                    },
                    {
                        "viewportId": "vp-a",
                        "viewport_role": "detail_callout",
                        "viewRef": "sec:sec1",
                        "detailNumber": "1",
                        "label": "A",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 1000,
                        "heightMm": 800,
                    },
                ],
            ),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="pfx",
        semantic_digest_sha256="c" * 64,
        semantic_digest_prefix16="c" * 16,
    )
    dc = rows[0]["detailCalloutReadout_v0"]
    assert [r["viewportId"] for r in dc] == ["vp-a", "vp-b"]
    ra = next(r for r in dc if r["viewportId"] == "vp-a")
    assert ra["referencedViewRefNormalized"] == "section:sec1"
    assert ra["resolvedTargetTitle"] == "Cut A"
    assert ra["placeholderDetailTitle"] == "Detail 1 — Cut A"
    assert ra["unresolvedReason"] == ""
    rb = next(r for r in dc if r["viewportId"] == "vp-b")
    assert rb["unresolvedReason"] == "unresolved_plan_view"
    assert rb["placeholderDetailTitle"] == "Detail 2 — unresolved"


def test_viewport_evidence_hints_v1_schedule_documentation_segment_sorted() -> None:
    doc = Document(
        revision=3,
        elements={
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door"},
            ),
            "sheet-b": SheetElem(
                kind="sheet",
                id="sheet-b",
                name="S",
                viewportsMm=[
                    {
                        "viewportId": "z-sch",
                        "viewRef": "schedule:sch-1",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 100,
                        "heightMm": 100,
                    },
                    {
                        "viewportId": "a-bad",
                        "viewRef": "schedule:no-such-schedule",
                        "xMm": 10,
                        "yMm": 10,
                        "widthMm": 50,
                        "heightMm": 50,
                    },
                ],
            ),
        },
    )
    sh = doc.elements["sheet-b"]
    assert isinstance(sh, SheetElem)
    hints = viewport_evidence_hints_v1(doc, list(sh.viewports_mm or []))
    assert [h["viewportId"] for h in hints] == ["a-bad", "z-sch"]

    bad = next(h for h in hints if h["viewportId"] == "a-bad")
    assert bad.get("scheduleDocumentationSegment") == "schDoc[missing_schedule_element]"

    good = next(h for h in hints if h["viewportId"] == "z-sch")
    tbl = derive_schedule_table(doc, "sch-1")
    cat = str(tbl.get("category") or "")
    ncols = len(tbl.get("columns") or [])
    try:
        nrows = int(tbl.get("totalRows", 0))
    except (TypeError, ValueError):
        nrows = 0
    assert good.get("scheduleDocumentationSegment") == (
        f"schDoc[id=sch-1 rows={nrows} cols={ncols} cat={cat}]"
    )


def test_sheet_preview_svg_includes_schedule_documentation_token() -> None:
    doc = Document(
        revision=1,
        elements={
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="W",
                filters={"category": "window"},
            ),
            "sheet-s": SheetElem(
                kind="sheet",
                id="sheet-s",
                name="S",
                viewportsMm=[
                    {
                        "viewportId": "v1",
                        "viewRef": "schedule:sch-1",
                        "xMm": 1000,
                        "yMm": 1000,
                        "widthMm": 8000,
                        "heightMm": 6000,
                    },
                ],
            ),
        },
    )
    sh = doc.elements["sheet-s"]
    assert isinstance(sh, SheetElem)
    svg = sheet_elem_to_svg(doc, sh)
    assert 'data-schedule-doc-token="scheduleDocumentationSegment"' in svg
    assert "schDoc[" in svg


def test_deterministic_plan_view_evidence_rows_sorted_and_stems() -> None:
    sid = uuid4()
    doc = Document(
        revision=3,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "z-pv": PlanViewElem(
                kind="plan_view",
                id="z-pv",
                name="Z",
                levelId="lvl",
                planPresentation="room_scheme",
            ),
            "a-pv": PlanViewElem(kind="plan_view", id="a-pv", name="A", levelId="lvl"),
        },
    )
    rows = deterministic_plan_view_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="pfx",
        semantic_digest_sha256="c" * 64,
        semantic_digest_prefix16="c" * 16,
    )
    assert [r["planViewId"] for r in rows] == ["a-pv", "z-pv"]
    assert rows[0]["playwrightSuggestedFilenames"]["pngPlanCanvas"] == "pfx-plan-a-pv.png"
    assert rows[0]["correlation"]["format"] == "evidencePlanViewCorrelation_v1"
    assert rows[0]["correlation"]["modelRevision"] == 3


def test_deterministic_section_cut_evidence_quotes_id_in_href() -> None:
    sid = uuid4()
    mid_str = str(sid)
    doc = Document(
        revision=1,
        elements={
            "sec/a": SectionCutElem(
                kind="section_cut",
                id="sec/a",
                name="Cut",
                lineStartMm={"xMm": 0, "yMm": 0},
                lineEndMm={"xMm": 0, "yMm": 1000},
            ),
        },
    )
    rows = deterministic_section_cut_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="pfx",
        semantic_digest_sha256="d" * 64,
        semantic_digest_prefix16="d" * 16,
    )
    assert len(rows) == 1
    assert rows[0]["projectionWireHref"] == f"/api/models/{mid_str}/projection/section/sec%2Fa"
    assert rows[0]["playwrightSuggestedFilenames"]["pngSectionViewport"] == "pfx-section-seca.png"
    assert rows[0]["correlation"]["format"] == "evidenceSectionCutCorrelation_v1"


def test_agent_evidence_closure_hints_shape() -> None:
    h = agent_evidence_closure_hints()
    assert h["format"] == "agentEvidenceClosureHints_v1"
    assert h.get("evidenceClosureReviewField") == "evidenceClosureReview_v1"
    assert h.get("pixelDiffExpectationNestedField") == "pixelDiffExpectation"
    assert h.get("deterministicPngBasenamesField") == "expectedDeterministicPngBasenames"
    assert h.get("screenshotHintGapsField") == "screenshotHintGaps_v1"
    assert h.get("pixelDiffIngestChecklistField") == "ingestChecklist_v1"
    assert h.get("artifactIngestCorrelationNestedField") == "artifactIngestCorrelation_v1"
    assert h.get("artifactIngestCorrelationFullPath") == (
        "evidenceClosureReview_v1.pixelDiffExpectation.artifactIngestCorrelation_v1"
    )
    assert h.get("artifactIngestManifestDigestSha256LifecycleField") == (
        "artifactIngestManifestDigestSha256"
    )
    assert h.get("evidenceLifecycleSignalField") == "evidenceLifecycleSignal_v1"
    assert h.get("evidenceDiffIngestFixLoopField") == "evidenceDiffIngestFixLoop_v1"
    assert h.get("evidenceAgentFollowThroughField") == "evidenceAgentFollowThrough_v1"
    assert h.get("artifactUploadManifestField") == "artifactUploadManifest_v1"
    assert h.get("semanticDigestOmitsDerivativeSummariesNote")
    cmds = h["suggestedRegenerationCommands"]
    assert isinstance(cmds, list)
    assert any("pytest" in str(c) for c in cmds)
    assert any("test_evidence_manifest_closure.py" in str(c) for c in cmds)
    assert any("test_evidence_agent_follow_through.py" in str(c) for c in cmds)
    assert any("playwright" in str(c) for c in cmds)
    assert "packages/web/playwright-report/index.html" in h["ciArtifactRelativePaths"]


def test_evidence_digest_sorts_nested_registry_and_candidates() -> None:
    cand_a = {
        "candidateId": "zzz",
        "levelId": "l1",
        "wallIds": ["w2"],
        "kind": "axis_aligned_rectangle",
    }
    cand_b = {
        "candidateId": "aaa",
        "levelId": "l1",
        "wallIds": ["w1"],
        "kind": "axis_aligned_rectangle",
    }
    ft_b = {"id": "ft-b", "kind": "family_type", "discipline": "door"}
    ft_a = {"id": "ft-a", "kind": "family_type", "discipline": "door"}
    base = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "modelId": "x",
        "roomDerivationCandidates": {"format": "x", "candidates": [cand_a, cand_b]},
        "typeMaterialRegistry": {
            "format": "t",
            "document": {"familyTypes": [ft_b, ft_a], "wallTypes": []},
        },
    }
    swapped = dict(base)
    swapped["roomDerivationCandidates"] = dict(base["roomDerivationCandidates"])
    swapped["roomDerivationCandidates"]["candidates"] = [cand_b, cand_a]

    swapped_t = dict(swapped["typeMaterialRegistry"])
    swapped_t_doc = dict(swapped_t["document"])
    swapped_t_doc["familyTypes"] = [ft_a, ft_b]
    swapped_t["document"] = swapped_t_doc
    swapped["typeMaterialRegistry"] = swapped_t

    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(
        swapped
    )


def test_plan_projection_wire_includes_floor_count() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
        },
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl-g")
    assert wire["countsByVisibleKind"]["wall"] >= 1
    assert wire["countsByVisibleKind"]["floor"] == 1


def test_plan_projection_room_primitives_include_programme_and_color() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rm": RoomElem(
                kind="room",
                id="rm",
                name="Office",
                levelId="lvl",
                programmeCode="OFF",
                roomFillOverrideHex="#123456",
                roomFillPatternOverride="crosshatch",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    rooms = (out.get("primitives") or {}).get("rooms") or []
    assert len(rooms) == 1
    assert rooms[0].get("programmeCode") == "OFF"
    assert str(rooms[0].get("schemeColorHex", "")).startswith("#")
    assert rooms[0].get("roomFillOverrideHex") == "#123456"
    assert rooms[0].get("roomFillPatternOverride") == "crosshatch"


def test_plan_projection_annotation_hints_emit_plan_tag_labels_when_enabled() -> None:
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="vt-an",
        name="Annot T",
        planShowOpeningTags=True,
        planShowRoomLabels=False,
    )
    pv = PlanViewElem(
        kind="plan_view",
        id="pv-an",
        name="Annotated",
        levelId="lvl",
        viewTemplateId="vt-an",
        planShowRoomLabels=True,
    )
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w-h",
        name="Host",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 6000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(kind="door", id="d-a", name="Entry", wallId="w-h", alongT=0.5, widthMm=900)
    window = WindowElem(
        kind="window",
        id="win-a",
        name="Kitchen win",
        wallId="w-h",
        alongT=0.25,
        widthMm=1200,
        sillHeightMm=900,
        heightMm=1500,
    )
    room = RoomElem(
        kind="room",
        id="r-a",
        name="Kitchen",
        levelId="lvl",
        programmeCode="KIT",
        outlineMm=[
            {"xMm": 500, "yMm": -2000},
            {"xMm": 5500, "yMm": -2000},
            {"xMm": 5500, "yMm": 2500},
            {"xMm": 500, "yMm": 2500},
        ],
    )
    doc = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "vt-an": tmpl,
            "pv-an": pv,
            "w-h": wall,
            "d-a": door,
            "win-a": window,
            "r-a": room,
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv-an", fallback_level_id=None)
    ann = out.get("planAnnotationHints") or {}
    assert ann["openingTagsVisible"] is True
    assert ann["roomLabelsVisible"] is True
    prim = out.get("primitives") or {}
    doors_row = prim.get("doors") or []
    wins_row = prim.get("windows") or []
    rooms_row = prim.get("rooms") or []
    assert any(r.get("id") == "d-a" and "planTagLabel" in r for r in doors_row)
    assert any(r.get("id") == "win-a" and "planTagLabel" in r for r in wins_row)
    assert any(r.get("id") == "r-a" and "planTagLabel" in r for r in rooms_row)


def test_plan_projection_annotation_off_omits_plan_tag_label_keys() -> None:
    tpl = ViewTemplateElem(
        kind="view_template",
        id="vt-off",
        name="Quiet",
        planShowOpeningTags=False,
        planShowRoomLabels=False,
    )
    pv = PlanViewElem(
        kind="plan_view",
        id="pv-off",
        name="Off",
        levelId="lvl",
        viewTemplateId="vt-off",
    )
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w2",
        name="W",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 4000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(kind="door", id="d2", name="D", wallId="w2", alongT=0.5, widthMm=900)
    room = RoomElem(
        kind="room",
        id="rm-off",
        name="R",
        levelId="lvl",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 4000, "yMm": 0},
            {"xMm": 4000, "yMm": 2500},
            {"xMm": 0, "yMm": 2500},
        ],
    )
    doc = Document(
        revision=1,
        elements={"lvl": lvl, "vt-off": tpl, "pv-off": pv, "w2": wall, "d2": door, "rm-off": room},
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv-off", fallback_level_id=None)
    ann = out.get("planAnnotationHints") or {}
    assert ann.get("openingTagsVisible") is False
    assert ann.get("roomLabelsVisible") is False
    prim = out.get("primitives") or {}
    for row in prim.get("doors") or []:
        assert "planTagLabel" not in row
    for row in prim.get("rooms") or []:
        assert "planTagLabel" not in row


def test_plan_projection_unpinned_wire_omits_plan_annotation_hints_payload() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    assert "planAnnotationHints" not in out


def test_plan_projection_room_legend_matches_primitives_when_programme_shared() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rm1": RoomElem(
                kind="room",
                id="rm1",
                name="Office A",
                levelId="lvl",
                programmeCode="OFF",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
            "rm2": RoomElem(
                kind="room",
                id="rm2",
                name="Office B",
                levelId="lvl",
                programmeCode="OFF",
                outlineMm=[
                    {"xMm": 2100, "yMm": 0},
                    {"xMm": 4100, "yMm": 0},
                    {"xMm": 4100, "yMm": 2000},
                    {"xMm": 2100, "yMm": 2000},
                ],
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    rooms = (out.get("primitives") or {}).get("rooms") or []
    assert len(rooms) == 2
    hx0 = rooms[0].get("schemeColorHex")
    hx1 = rooms[1].get("schemeColorHex")
    assert isinstance(hx0, str) and hx0 == hx1
    legend = out.get("roomColorLegend") or []
    assert len(legend) == 1
    assert legend[0].get("label") == "OFF"
    assert legend[0].get("schemeColorHex") == hx0
    leg_ev = out.get("roomProgrammeLegendEvidence_v0") or {}
    assert leg_ev.get("format") == "roomProgrammeLegendEvidence_v0"
    assert leg_ev.get("rowCount") == 1
    assert (
        isinstance(leg_ev.get("legendDigestSha256"), str)
        and len(leg_ev["legendDigestSha256"]) == 64
    )


def test_plan_projection_crop_authored_composes_with_view_range_clip() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                cropMinMm={"xMm": -500, "yMm": -500},
                cropMaxMm={"xMm": 9500, "yMm": 6500},
                viewRangeBottomMm=-1200,
                viewRangeTopMm=4200,
            ),
            "w": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w-out": WallElem(
                kind="wall",
                id="w-out",
                name="Far",
                levelId="lvl",
                start={"xMm": 12000, "yMm": 0},
                end={"xMm": 14000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1", fallback_level_id="lvl")
    codes = {w.get("code") for w in out.get("warnings", []) if isinstance(w, dict)}
    assert "cropBoxNotApplied" not in codes
    assert "viewRangeNotApplied" not in codes
    ev = out.get("planViewRangeEvidence_v0") or {}
    assert ev.get("format") == "planViewRangeEvidence_v0"
    assert ev.get("bottomZMm") == -1200.0
    assert ev.get("topZMm") == 4200.0
    assert ev.get("cutPlaneZMm") == 0.0
    walls = (out.get("primitives") or {}).get("walls") or []
    assert [w.get("id") for w in walls] == ["w-a"]


def test_plan_projection_view_range_excludes_wall_below_clip() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                viewRangeBottomMm=3000,
                viewRangeTopMm=5000,
            ),
            "w": WallElem(
                kind="wall",
                id="w-low",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1", fallback_level_id="lvl")
    assert (out.get("primitives") or {}).get("walls") == []


def test_plan_projection_view_range_excludes_wall_above_clip() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                viewRangeBottomMm=-8000,
                viewRangeTopMm=-500,
            ),
            "w": WallElem(
                kind="wall",
                id="w-above",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1", fallback_level_id="lvl")
    assert (out.get("primitives") or {}).get("walls") == []


def test_plan_projection_view_range_normalizes_inverted_bottom_top_offsets() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                viewRangeBottomMm=800,
                viewRangeTopMm=-200,
                cutPlaneOffsetMm=300,
            ),
            "w": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1", fallback_level_id="lvl")
    ev = out.get("planViewRangeEvidence_v0") or {}
    assert ev.get("bottomZMm") == -200.0
    assert ev.get("topZMm") == 800.0
    assert ev.get("cutPlaneZMm") == 300.0
    walls = (out.get("primitives") or {}).get("walls") or []
    assert [x.get("id") for x in walls] == ["w-a"]


def test_plan_projection_view_range_incomplete_authorship_warns() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                viewRangeBottomMm=500,
            ),
            "w": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1", fallback_level_id="lvl")
    codes = {w.get("code") for w in out.get("warnings", []) if isinstance(w, dict)}
    assert "viewRangeNotApplied" in codes
    assert out.get("planViewRangeEvidence_v0") is None


def test_plan_projection_sheet_viewport_crop_intersects_plan_crop() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                cropMinMm={"xMm": -500, "yMm": -500},
                cropMaxMm={"xMm": 9500, "yMm": 6500},
            ),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="A",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w-b": WallElem(
                kind="wall",
                id="w-b",
                name="B",
                levelId="lvl",
                start={"xMm": 5000, "yMm": 0},
                end={"xMm": 7000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    vp_crop = {
        "cropMinMm": {"xMm": 0, "yMm": -200},
        "cropMaxMm": {"xMm": 3000, "yMm": 200},
    }
    out_plain = resolve_plan_projection_wire(
        doc,
        plan_view_id="pv1",
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=None,
    )
    out_sheet = resolve_plan_projection_wire(
        doc,
        plan_view_id="pv1",
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=vp_crop,
    )
    plain_wall_ids = [w.get("id") for w in (out_plain.get("primitives") or {}).get("walls") or []]
    sheet_wall_ids = [w.get("id") for w in (out_sheet.get("primitives") or {}).get("walls") or []]
    assert plain_wall_ids == ["w-a", "w-b"]
    assert sheet_wall_ids == ["w-a"]
    sheet_codes = {w.get("code") for w in out_sheet.get("warnings") or [] if isinstance(w, dict)}
    assert "sheetViewportCropNotApplied" not in sheet_codes


def test_plan_projection_sheet_viewport_crop_partial_emits_warning() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                cropMinMm={"xMm": -500, "yMm": -500},
                cropMaxMm={"xMm": 9500, "yMm": 6500},
            ),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="A",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    vp_partial = {"cropMinMm": {"xMm": 0, "yMm": 0}}
    out = resolve_plan_projection_wire(
        doc,
        plan_view_id="pv1",
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=vp_partial,
    )
    codes = {w.get("code") for w in out.get("warnings") or [] if isinstance(w, dict)}
    assert "sheetViewportCropNotApplied" in codes
    plain = resolve_plan_projection_wire(
        doc,
        plan_view_id="pv1",
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=None,
    )
    assert (out.get("primitives") or {}).get("walls") == (plain.get("primitives") or {}).get(
        "walls"
    )


def test_plan_projection_derived_room_boundary_evidence_v0_authoritative() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    doc = Document(
        revision=10,
        elements={
            "lvl-1": lvl,
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl-1",
                cropMinMm={"xMm": -500, "yMm": -500},
                cropMaxMm={"xMm": 9500, "yMm": 9500},
            ),
            **{w.id: w for w in walls},
        },
    )
    out = resolve_plan_projection_wire(
        doc,
        plan_view_id="pv1",
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=None,
    )
    ev = out.get("derivedRoomBoundaryEvidence_v0") or []
    assert len(ev) >= 1
    assert ev[0].get("derivationAuthority") == "authoritative"
    assert sorted(ev[0].get("boundaryWallIds") or []) == sorted(w.id for w in walls)
    diag = out.get("derivedRoomBoundaryDiagnostics_v0") or {}
    assert diag.get("format") == "derivedRoomBoundaryDiagnostics_v0"
    assert diag.get("boundaryHeuristicVersion") == "room_deriv_preview_v4"
    assert diag.get("activeLevelId") == "lvl-1"
    assert diag.get("authoritativeFootprintCountIntersectingCrop") >= 1
    assert diag.get("previewHeuristicFootprintCountIntersectingCrop") == 0


def test_plan_projection_derived_room_boundary_evidence_v0_filtered_by_crop() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    doc = Document(
        revision=11,
        elements={
            "lvl-1": lvl,
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl-1",
                cropMinMm={"xMm": 9000, "yMm": 9000},
                cropMaxMm={"xMm": 9100, "yMm": 9100},
            ),
            **{w.id: w for w in walls},
        },
    )
    out = resolve_plan_projection_wire(
        doc,
        plan_view_id="pv1",
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=None,
    )
    assert (out.get("derivedRoomBoundaryEvidence_v0") or []) == []
    diag = out.get("derivedRoomBoundaryDiagnostics_v0") or {}
    assert diag.get("authoritativeFootprintCountIntersectingCrop") == 0
    assert diag.get("previewHeuristicFootprintCountIntersectingCrop") == 0


def test_plan_projection_includes_stair_primitive() -> None:
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "st": StairElem(
                kind="stair",
                id="st1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 1000, "yMm": 500},
                runEndMm={"xMm": 1000, "yMm": 3500},
                widthMm=1100,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="l0")
    sts = (out.get("primitives") or {}).get("stairs") or []
    assert len(sts) == 1
    assert sts[0]["id"] == "st1"
    assert sts[0]["topLevelId"] == "l1"
    assert sts[0]["riserMm"] == 175
    assert sts[0]["treadMm"] == 275
    assert sts[0]["riserCountPlanProxy"] == 16
    assert sts[0]["treadCountPlanProxy"] == 15
    assert sts[0]["runBearingDegCcFromPlanX"] == pytest.approx(90.0)
    assert sts[0]["planUpDownLabel"] == "UP"
    assert sts[0]["baseLevelName"] == "G"
    assert sts[0]["topLevelName"] == "OG"


def test_section_projection_stair_includes_riser_count_plan_proxy() -> None:
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "st": StairElem(
                kind="stair",
                id="st1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 1000.0, "yMm": 500.0},
                runEndMm={"xMm": 1000.0, "yMm": 3500.0},
                widthMm=1100,
            ),
            "sec-a": SectionCutElem(
                kind="section_cut",
                id="sec-a",
                name="A-A",
                lineStartMm={"xMm": 1000.0, "yMm": -8000.0},
                lineEndMm={"xMm": 1000.0, "yMm": 8000.0},
                cropDepthMm=12000.0,
            ),
        },
    )
    out = section_cut_projection_wire(doc, "sec-a")
    assert not out.get("errors")
    sts = (out.get("primitives") or {}).get("stairs") or []
    assert len(sts) == 1
    assert sts[0]["elementId"] == "st1"
    assert sts[0]["riserCountPlanProxy"] == 16
    assert sts[0]["treadCountPlanProxy"] == 15
    assert sts[0]["planUpDownLabel"] == "UP"
    assert sts[0]["runBearingDegCcFromPlanX"] == pytest.approx(90.0)
    assert sts[0]["riserMm"] == 175
    assert sts[0]["treadMm"] == 275
    assert sts[0]["baseLevelName"] == "G"
    assert sts[0]["topLevelName"] == "OG"


def test_plan_projection_wire_plan_graphic_hints_order_coarse_vs_fine() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    vt_fine = ViewTemplateElem(
        kind="view_template", id="vt-f", name="Fine", plan_detail_level="fine"
    )
    vt_coarse = ViewTemplateElem(
        kind="view_template",
        id="vt-c",
        name="Coarse",
        plan_detail_level="coarse",
    )
    wall = WallElem(
        kind="wall",
        id="w",
        name="W",
        levelId=lvl.id,
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 3000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    pv_fine = PlanViewElem(
        kind="plan_view",
        id="pv-f",
        name="VF",
        levelId=lvl.id,
        viewTemplateId="vt-f",
    )
    pv_coarse = PlanViewElem(
        kind="plan_view",
        id="pv-c",
        name="VC",
        levelId=lvl.id,
        viewTemplateId="vt-c",
    )
    doc_fine = Document(
        revision=1, elements={"lvl": lvl, "vt-f": vt_fine, "w": wall, "pv-f": pv_fine}
    )
    doc_coarse = Document(
        revision=1, elements={"lvl": lvl, "vt-c": vt_coarse, "w": wall, "pv-c": pv_coarse}
    )

    out_fine = plan_projection_wire_from_request(
        doc_fine, plan_view_id="pv-f", fallback_level_id=None
    )
    out_coarse = plan_projection_wire_from_request(
        doc_coarse, plan_view_id="pv-c", fallback_level_id=None
    )

    hints_fine = out_fine["planGraphicHints"]
    hints_coarse = out_coarse["planGraphicHints"]
    assert hints_fine["detailLevel"] == "fine"
    assert hints_coarse["detailLevel"] == "coarse"


def test_plan_category_graphic_hints_v0_and_primitives() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        UpsertViewTemplateCmd(
            id="vt",
            name="T",
            plan_category_graphics=[
                PlanCategoryGraphicRow(category_key="wall", line_weight_factor=1.25),
                PlanCategoryGraphicRow(category_key="grid_line", line_pattern_token="dash_short"),
            ],
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id="pv",
            name="P",
            level_id="lvl",
            view_template_id="vt",
            plan_category_graphics=[
                PlanCategoryGraphicRow(category_key="grid_line", line_pattern_token="dot"),
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateWallCmd(
            id="w",
            name="W",
            level_id="lvl",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 3000, "yMm": 0},
        ),
    )
    apply_inplace(
        doc,
        CreateGridLineCmd(
            id="g1",
            name="A",
            level_id="lvl",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 5000},
        ),
    )

    out = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id=None)
    cat = out["planCategoryGraphicHints_v0"]
    assert cat["format"] == "planCategoryGraphicHints_v0"
    assert "rowsDigestSha256" in cat
    wall_row = next(r for r in cat["rows"] if r["categoryKey"] == "wall")
    assert wall_row["lineWeightFactor"] == 1.25
    assert wall_row["lineWeightSource"] == "template"
    grid_row = next(r for r in cat["rows"] if r["categoryKey"] == "grid_line")
    assert grid_row["linePatternToken"] == "dot"
    assert grid_row["linePatternSource"] == "plan_view"

    prim = out["primitives"]
    wprim = next(w for w in prim["walls"] if w["id"] == "w")
    assert wprim["lineWeightHint"] == pytest.approx(1.25, rel=0, abs=1e-3)
    gprim = next(g for g in prim["gridLines"] if g["id"] == "g1")
    assert gprim["linePatternToken"] == "dot"
    assert gprim["lineWeightHint"] == pytest.approx(1.0, rel=0, abs=1e-3)


def test_plan_category_graphic_hints_floor_roof_outline_primitives() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        UpsertViewTemplateCmd(
            id="vt",
            name="T",
            plan_category_graphics=[
                PlanCategoryGraphicRow(category_key="floor", line_weight_factor=1.2),
                PlanCategoryGraphicRow(category_key="roof", line_pattern_token="dash_long"),
            ],
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id="pv",
            name="P",
            level_id="lvl",
            view_template_id="vt",
            plan_category_graphics=[
                PlanCategoryGraphicRow(category_key="roof", line_pattern_token="dot"),
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateFloorCmd(
            id="fl1",
            name="F",
            level_id="lvl",
            boundary_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 3000, "yMm": 0},
                {"xMm": 3000, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="rf1",
            name="R",
            reference_level_id="lvl",
            footprint_mm=[
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 4000, "yMm": 1000},
                {"xMm": 4000, "yMm": 3000},
                {"xMm": 1000, "yMm": 3000},
            ],
            roof_geometry_mode="mass_box",
        ),
    )

    out = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id=None)
    cat = out["planCategoryGraphicHints_v0"]
    floor_cat = next(r for r in cat["rows"] if r["categoryKey"] == "floor")
    assert floor_cat["lineWeightFactor"] == 1.2
    roof_cat = next(r for r in cat["rows"] if r["categoryKey"] == "roof")
    assert roof_cat["linePatternToken"] == "dot"
    assert roof_cat["linePatternSource"] == "plan_view"

    prim = out["primitives"]
    fprim = next(f for f in prim["floors"] if f["id"] == "fl1")
    assert fprim["linePatternToken"] == "solid"
    assert fprim["planCategoryGraphicKey"] == "floor"
    assert fprim["planOutlineSemantics"] == "slab_level_outline"
    assert fprim["lineWeightHint"] == pytest.approx(
        1.2 * float(out["planGraphicHints"]["lineWeightScale"]), rel=0, abs=0.02
    )

    rprim = next(r for r in prim["roofs"] if r["id"] == "rf1")
    assert rprim["linePatternToken"] == "dot"
    assert rprim["planCategoryGraphicKey"] == "roof"
    assert rprim["planOutlineSemantics"] == "roof_footprint_projection"
    assert rprim["lineWeightHint"] == pytest.approx(
        float(out["planGraphicHints"]["lineWeightScale"]), rel=0, abs=0.02
    )


def test_room_programme_legend_replay_matches_schedule_and_sheet_manifest() -> None:
    """Replayable slice: rooms + plan + sheet viewport + room schedule + legend evidence digests."""

    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-lab",
            name="Lab",
            levelId="lvl",
            origin={"xMm": 0, "yMm": 0},
            widthMm=3000,
            depthMm=3000,
            programmeCode="LAB",
        ),
    )
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-off",
            name="Office",
            levelId="lvl",
            origin={"xMm": 4000, "yMm": 0},
            widthMm=3000,
            depthMm=3000,
            programmeCode="OFF",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id="pv-1",
            name="Floor plan",
            levelId="lvl",
            planPresentation="room_scheme",
        ),
    )
    apply_inplace(doc, UpsertSheetCmd(id="sh-1", name="A101"))
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="sh-1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "label": "Plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 100,
                    "yMm": 200,
                    "widthMm": 5000,
                    "heightMm": 4000,
                },
            ],
        ),
    )
    apply_inplace(doc, UpsertScheduleCmd(id="sch-rooms", name="Room schedule"))
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-rooms",
            filters={"category": "room"},
            grouping={},
        ),
    )

    wire = resolve_plan_projection_wire(doc, plan_view_id="pv-1", fallback_level_id=None)
    legend = wire.get("roomColorLegend") or []
    assert len(legend) == 2
    ev = wire.get("roomProgrammeLegendEvidence_v0") or {}
    assert ev.get("format") == "roomProgrammeLegendEvidence_v0"
    assert ev.get("rowCount") == 2
    ortho = ev.get("orthogonalTo") or []
    assert "derivedRoomBoundaryEvidence_v0" in ortho
    digest = ev.get("legendDigestSha256")
    assert isinstance(digest, str) and len(digest) == 64
    canon = json.dumps(legend, sort_keys=True, separators=(",", ":"))
    assert hashlib.sha256(canon.encode("utf-8")).hexdigest() == digest

    sch = derive_schedule_table(doc, "sch-rooms")
    sch_rows = sch.get("rows") or []
    codes = {r.get("programmeCode") for r in sch_rows if isinstance(r, dict)}
    assert codes == {"LAB", "OFF"}

    boundary = wire.get("derivedRoomBoundaryEvidence_v0") or []
    assert isinstance(boundary, list)
    assert digest

    sh = doc.elements["sh-1"]
    hints = plan_room_programme_legend_hints_v0(doc, list(sh.viewports_mm or []))
    assert len(hints) == 1
    h0 = hints[0]
    assert h0["viewportId"] == "vp-plan"
    assert h0["legendDigestSha256"] == digest
    assert h0["rowCount"] == 2
    assert h0["legendTitle"] == "Room programme legend"
    legend_rows = h0["legendRows"]
    assert isinstance(legend_rows, list) and len(legend_rows) == 2
    row_labels = [str(r["label"]) for r in legend_rows]
    assert row_labels == sorted(row_labels)
    doc_seg = h0["documentationSegment"]
    assert isinstance(doc_seg, str) and doc_seg.startswith("roomLegDoc[title=Room programme legend")
    assert digest in doc_seg

    man_rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="rl",
        semantic_digest_sha256="c" * 64,
        semantic_digest_prefix16="c" * 16,
    )
    assert len(man_rows) == 1
    assert man_rows[0].get("planRoomProgrammeLegendHints_v0") == hints

    vhints = viewport_evidence_hints_v1(doc, list(sh.viewports_mm or []))
    vh0 = next(h for h in vhints if h["viewportId"] == "vp-plan")
    assert vh0["roomProgrammeLegendDocumentationSegment"] == doc_seg

    lines = sheet_viewport_export_listing_lines(doc, sh)
    assert any("roomLegDoc[n=2 sha=" in ln and digest in ln for ln in lines)

    svg = sheet_elem_to_svg(doc, sh)
    assert 'data-room-programme-legend-doc-token="roomProgrammeLegendDocumentationSegment"' in svg
    assert "roomLegDoc[" in svg


def test_room_programme_legend_documentation_sorted_labels() -> None:
    """Legend documentation segment sorts rows by label regardless of room creation order."""

    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-z",
            name="Zed",
            levelId="lvl",
            origin={"xMm": 0, "yMm": 0},
            widthMm=2000,
            depthMm=2000,
        ),
    )
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-a",
            name="Ada",
            levelId="lvl",
            origin={"xMm": 4000, "yMm": 0},
            widthMm=2000,
            depthMm=2000,
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id="pv-1",
            name="Floor plan",
            levelId="lvl",
            planPresentation="room_scheme",
        ),
    )
    apply_inplace(doc, UpsertSheetCmd(id="sh-1", name="A101"))
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="sh-1",
            viewportsMm=[
                {
                    "viewportId": "vp",
                    "label": "Plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 100,
                    "yMm": 200,
                    "widthMm": 5000,
                    "heightMm": 4000,
                },
            ],
        ),
    )
    sh = doc.elements["sh-1"]
    vp = list(sh.viewports_mm or [])[0]
    assert isinstance(vp, dict)
    seg = format_room_programme_legend_documentation_segment(doc, vp)
    assert seg.index("Ada") < seg.index("Zed")


def test_room_color_scheme_overrides_primitive_legend_digest() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-lab",
            name="Lab",
            levelId="lvl",
            origin={"xMm": 0, "yMm": 0},
            widthMm=2500,
            depthMm=2500,
            programmeCode="LAB",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(id="pv", name="PV", levelId="lvl", planPresentation="room_scheme"),
    )
    apply_inplace(doc, UpsertScheduleCmd(id="sch-rooms", name="Rooms"))
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-rooms",
            filters={"category": "room"},
            grouping={},
        ),
    )

    baseline = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id=None)
    prim0 = ((baseline["primitives"] or {}).get("rooms") or [])[0]
    dig0 = (baseline.get("roomProgrammeLegendEvidence_v0") or {}).get("legendDigestSha256")
    assert isinstance(dig0, str)

    apply_inplace(
        doc,
        UpsertRoomColorSchemeCmd(
            scheme_rows=[RoomColorSchemeRow(programme_code="LAB", scheme_color_hex="#ABCDEf")],
        ),
    )

    out = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id=None)
    prim = ((out["primitives"] or {}).get("rooms") or [])[0]
    assert prim["schemeColorHex"] == "#ABCDEF"

    legend = out.get("roomColorLegend") or []
    legend_row = next(r for r in legend if isinstance(r, dict) and r.get("label") == "LAB")
    assert legend_row["schemeColorHex"] == "#ABCDEF"

    ev = out.get("roomProgrammeLegendEvidence_v0") or {}
    canon = json.dumps(legend, sort_keys=True, separators=(",", ":"))
    assert hashlib.sha256(canon.encode("utf-8")).hexdigest() == ev.get("legendDigestSha256")
    assert ev.get("legendDigestSha256") != dig0
    assert prim0["schemeColorHex"] != "#ABCDEF"

    assert ev.get("schemeOverridesSource") == "bim-room-color-scheme"
    assert ev.get("schemeOverrideRowCount") == 1

    sch_codes = {
        row.get("programmeCode")
        for row in (derive_schedule_table(doc, "sch-rooms").get("rows") or [])
        if isinstance(row, dict)
    }
    legend_codes = {row.get("programmeCode") for row in legend if isinstance(row, dict)}
    assert sch_codes == {"LAB"}
    assert sch_codes <= {c for c in legend_codes if c}


def test_room_color_scheme_matches_department_only_row() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-op",
            name="Op",
            levelId="lvl",
            origin={"xMm": 0, "yMm": 0},
            widthMm=2500,
            depthMm=2500,
            department="Surgery",
        ),
    )
    apply_inplace(
        doc,
        UpsertRoomColorSchemeCmd(
            scheme_rows=[
                RoomColorSchemeRow(department="Surgery", scheme_color_hex="#00FFAa"),
            ],
        ),
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    prim = ((wire["primitives"] or {}).get("rooms") or [])[0]
    assert prim["schemeColorHex"] == "#00FFAA"


def test_room_color_scheme_prefers_programme_match_over_department() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-core",
            name="Office",
            levelId="lvl",
            origin={"xMm": 0, "yMm": 0},
            widthMm=3000,
            depthMm=3000,
            programmeCode="OFF",
            department="Core",
        ),
    )
    apply_inplace(
        doc,
        UpsertRoomColorSchemeCmd(
            scheme_rows=[
                RoomColorSchemeRow(department="Core", scheme_color_hex="#111111"),
                RoomColorSchemeRow(programme_code="OFF", scheme_color_hex="#222222"),
            ],
        ),
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    prim = ((out["primitives"] or {}).get("rooms") or [])[0]
    assert prim["schemeColorHex"] == "#222222"


def test_plan_projection_plan_tag_style_hints_and_custom_opening_label() -> None:
    style = PlanTagStyleElem(
        kind="plan_tag_style",
        id="pts-elid",
        name="Ids",
        tagTarget="opening",
        labelFields=["elementId"],
        textSizePt=12,
    )
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="vt-ts",
        name="T",
        planShowOpeningTags=True,
        planShowRoomLabels=False,
        defaultPlanOpeningTagStyleId="pts-elid",
    )
    pv = PlanViewElem(
        kind="plan_view",
        id="pv-ts",
        name="P",
        levelId="lvl",
        viewTemplateId="vt-ts",
    )
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w-h",
        name="Host",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 6000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(kind="door", id="d-tg", name="Entry", wallId="w-h", alongT=0.5, widthMm=900)
    doc = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "pts-elid": style,
            "vt-ts": tmpl,
            "pv-ts": pv,
            "w-h": wall,
            "d-tg": door,
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv-ts", fallback_level_id=None)
    hints = out.get("planTagStyleHints") or {}
    oh = hints.get("opening") or {}
    assert oh.get("resolvedStyleId") == "pts-elid"
    assert oh.get("source") == "view_template"
    assert oh.get("textSizePt") == 12.0
    doors_row = (out.get("primitives") or {}).get("doors") or []
    drow = next(r for r in doors_row if r.get("id") == "d-tg")
    assert drow.get("planTagLabel") == "d-tg"


def test_plan_projection_invalid_plan_tag_style_ref_builtin_and_warning() -> None:
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="vt-bad",
        name="T",
        planShowOpeningTags=True,
        planShowRoomLabels=False,
    )
    pv = PlanViewElem(
        kind="plan_view",
        id="pv-bad",
        name="P",
        levelId="lvl",
        viewTemplateId="vt-bad",
        planOpeningTagStyleId="missing-style",
    )
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 3000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(kind="door", id="d1", name="D", wallId="w1", alongT=0.5, widthMm=900)
    doc = Document(
        revision=1,
        elements={"lvl": lvl, "vt-bad": tmpl, "pv-bad": pv, "w1": wall, "d1": door},
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv-bad", fallback_level_id=None)
    hints = out.get("planTagStyleHints") or {}
    assert (hints.get("opening") or {}).get("resolvedStyleId") == BUILTIN_PLAN_TAG_OPENING_ID
    codes = [str(w.get("code", "")) for w in (out.get("warnings") or [])]
    assert "planTagStyleRefInvalid" in codes


def test_plan_projection_wire_includes_plan_grid_datum_evidence_bad_level_reference() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="L", elevationMm=0))
    apply_inplace(
        doc,
        CreateGridLineCmd(
            id="g1",
            name="G",
            level_id="bad-lvl",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 5000, "yMm": 0},
        ),
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id=None)
    ev = out.get("planGridDatumEvidence_v0") or {}
    assert ev.get("format") == "planGridDatumEvidence_v0"
    row = next(r for r in ev["rows"] if r["gridId"] == "g1")
    assert row["referenceOk"] is False
    assert row["reasonCode"] == "datum_grid_reference_missing"


def test_section_projection_wire_includes_datum_elevation_evidence_grid_crossing_count() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=300.0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -5000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 5000.0},
        cropDepthMm=9000.0,
    )
    grid = GridLineElem(
        kind="grid_line",
        id="gh",
        name="H",
        start={"xMm": -1000.0, "yMm": 0.0},
        end={"xMm": 9000.0, "yMm": 0.0},
        levelId="lvl",
    )
    doc = Document(revision=1, elements={"lvl": lvl, "w1": wall, "sec-a": sec, "gh": grid})
    out = section_cut_projection_wire(doc, "sec-a")
    ev = out.get("sectionDatumElevationEvidence_v0") or {}
    assert ev.get("format") == "sectionDatumElevationEvidence_v0"
    assert ev.get("gridCrossingCount") == 1


def test_section_projection_wire_degenerate_cut_section_datum_reason() -> None:
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-deg",
        name="X",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 0.0, "yMm": 0.0},
        cropDepthMm=1000.0,
    )
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0.0)
    doc = Document(revision=1, elements={"lvl": lvl, "sec-deg": sec})
    out = section_cut_projection_wire(doc, "sec-deg")
    ev = out.get("sectionDatumElevationEvidence_v0") or {}
    assert ev.get("reasonCode") == "degenerateCutLine"
    assert ev.get("gridCrossingCount") is None
