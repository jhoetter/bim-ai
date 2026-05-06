"""Tests for section material hatch hints, viewport scale evidence, and annotation stubs (WP-E04/C03)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    GridLineElem,
    LevelElem,
    PlanViewElem,
    RoofElem,
    SectionCutElem,
    SheetElem,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)
from bim_ai.plan_category_graphics import build_plan_section_mark_ref_evidence_v1
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.sheet_preview_svg import (
    build_section_viewport_scale_evidence_v1,
    format_section_viewport_documentation_segment,
)


def _wall_doc_with_materials() -> tuple[Document, SectionCutElem]:
    """Minimal doc with a wall with known material layers, cut by a section."""
    wall_type = WallTypeElem(
        kind="wall_type",
        id="wt-1",
        name="Concrete 200",
        layers=[
            WallTypeLayer(
                thicknessMm=200.0,
                function="structure",
                materialKey="mat-concrete",
            )
        ],
    )
    wall = WallElem(
        kind="wall",
        id="w-1",
        name="Wall A",
        levelId="lvl-1",
        start={"xMm": -2000.0, "yMm": 0.0},
        end={"xMm": 2000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
        wallTypeId="wt-1",
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="Section A",
        lineStartMm={"xMm": 0.0, "yMm": -5000.0},
        lineEndMm={"xMm": 0.0, "yMm": 5000.0},
        cropDepthMm=6000.0,
    )
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    doc = Document(
        revision=1,
        elements={"lvl-1": lvl, "wt-1": wall_type, "w-1": wall, "sec-1": sec},
    )
    return doc, sec


# ---------------------------------------------------------------------------
# sectionCutMaterialHints_v1
# ---------------------------------------------------------------------------


def test_section_cut_material_hints_v1_present_for_wall() -> None:
    doc, sec = _wall_doc_with_materials()
    prim, _ = build_section_projection_primitives(doc, sec)
    hints = prim.get("sectionCutMaterialHints_v1")
    assert isinstance(hints, list)
    assert len(hints) == 1
    hint = hints[0]
    assert hint["elementId"] == "w-1"
    assert hint["elementKind"] == "wall"
    assert hint["materialId"] == "mat-concrete"
    assert hint["hatchPatternToken"] in ("hatch_edgeOn_v1", "hatch_alongCut_v1")
    assert hint["cutFaceMm2"] > 0


def test_section_cut_material_hints_v1_edge_on_hatch_token() -> None:
    doc, sec = _wall_doc_with_materials()
    prim, _ = build_section_projection_primitives(doc, sec)
    walls_raw = prim.get("walls") or []
    hints = prim.get("sectionCutMaterialHints_v1") or []
    edge_on_walls = [w for w in walls_raw if w.get("cutHatchKind") == "edgeOn"]
    along_cut_walls = [w for w in walls_raw if w.get("cutHatchKind") == "alongCut"]
    edge_on_hints = [h for h in hints if h["hatchPatternToken"] == "hatch_edgeOn_v1"]
    along_cut_hints = [h for h in hints if h["hatchPatternToken"] == "hatch_alongCut_v1"]
    assert len(edge_on_hints) == len(edge_on_walls)
    assert len(along_cut_hints) == len(along_cut_walls)


def test_section_cut_material_hints_v1_floor() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    floor = FloorElem(
        kind="floor",
        id="fl-1",
        name="Floor",
        levelId="lvl-1",
        boundaryMm=[
            {"xMm": -3000.0, "yMm": -3000.0},
            {"xMm": 3000.0, "yMm": -3000.0},
            {"xMm": 3000.0, "yMm": 3000.0},
            {"xMm": -3000.0, "yMm": 3000.0},
        ],
        thicknessMm=220.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": -5000.0, "yMm": 0.0},
        lineEndMm={"xMm": 5000.0, "yMm": 0.0},
        cropDepthMm=4000.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "fl-1": floor, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    hints = prim.get("sectionCutMaterialHints_v1") or []
    floor_hints = [h for h in hints if h["elementKind"] == "floor"]
    assert len(floor_hints) == 1
    assert floor_hints[0]["elementId"] == "fl-1"
    assert floor_hints[0]["hatchPatternToken"] == "hatch_structure_v1"
    assert floor_hints[0]["cutFaceMm2"] > 0


def test_section_cut_material_hints_v1_roof() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    roof = RoofElem(
        kind="roof",
        id="rf-1",
        name="Roof",
        referenceLevelId="lvl-1",
        footprintMm=[
            {"xMm": -3000.0, "yMm": -3000.0},
            {"xMm": 3000.0, "yMm": -3000.0},
            {"xMm": 3000.0, "yMm": 3000.0},
            {"xMm": -3000.0, "yMm": 3000.0},
        ],
        roofGeometryMode="mass_box",
        slopeDeg=25.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": -5000.0, "yMm": 0.0},
        lineEndMm={"xMm": 5000.0, "yMm": 0.0},
        cropDepthMm=4000.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "rf-1": roof, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    hints = prim.get("sectionCutMaterialHints_v1") or []
    roof_hints = [h for h in hints if h["elementKind"] == "roof"]
    assert len(roof_hints) == 1
    assert roof_hints[0]["elementId"] == "rf-1"
    assert roof_hints[0]["hatchPatternToken"] == "hatch_structure_v1"
    assert roof_hints[0]["cutFaceMm2"] >= 0


def test_section_cut_material_hints_v1_empty_when_nothing_cut() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -1000.0},
        lineEndMm={"xMm": 0.0, "yMm": 1000.0},
        cropDepthMm=10.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    hints = prim.get("sectionCutMaterialHints_v1")
    assert hints == []


def test_section_cut_material_hints_v1_degenerate_cut_is_empty() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 0.0, "yMm": 0.0},
        cropDepthMm=100.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    assert prim.get("sectionCutMaterialHints_v1") == []


# ---------------------------------------------------------------------------
# sectionViewportScaleEvidence_v1
# ---------------------------------------------------------------------------


def test_section_viewport_scale_evidence_v1_resolves_scale() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w-1",
        levelId="lvl-1",
        start={"xMm": -2000.0, "yMm": 0.0},
        end={"xMm": 2000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -3000.0},
        lineEndMm={"xMm": 0.0, "yMm": 3000.0},
        cropDepthMm=8000.0,
    )
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 400,
                "heightMm": 300,
            }
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "w-1": wall, "sec-1": sec, "sh-1": sh})
    ev = build_section_viewport_scale_evidence_v1(doc, sh)
    assert ev["format"] == "sectionViewportScaleEvidence_v1"
    assert ev["sheetId"] == "sh-1"
    assert len(ev["rows"]) == 1
    row = ev["rows"][0]
    assert row["viewportId"] == "vp-1"
    assert row["sectionId"] == "sec-1"
    assert row["sheetId"] == "sh-1"
    assert row["scaleResolved"] is True
    assert "scaleFactor" in row
    assert row["scaleFactor"] > 0


def test_section_viewport_scale_evidence_v1_no_geometry_extent() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -1000.0},
        lineEndMm={"xMm": 0.0, "yMm": 1000.0},
        cropDepthMm=10.0,
    )
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 400,
                "heightMm": 300,
            }
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec, "sh-1": sh})
    ev = build_section_viewport_scale_evidence_v1(doc, sh)
    assert len(ev["rows"]) == 1
    row = ev["rows"][0]
    assert row["scaleResolved"] is False
    assert "scaleFactor" not in row


def test_section_viewport_scale_evidence_v1_skips_plan_viewports() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "plan:pv-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 400,
                "heightMm": 300,
            }
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sh-1": sh})
    ev = build_section_viewport_scale_evidence_v1(doc, sh)
    assert ev["rows"] == []


def test_section_viewport_scale_evidence_v1_sorted_by_viewport_id() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -1000.0},
        lineEndMm={"xMm": 0.0, "yMm": 1000.0},
        cropDepthMm=100.0,
    )
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-z",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 200,
                "heightMm": 150,
            },
            {
                "viewportId": "vp-a",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 200,
                "widthMm": 200,
                "heightMm": 150,
            },
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec, "sh-1": sh})
    ev = build_section_viewport_scale_evidence_v1(doc, sh)
    assert len(ev["rows"]) == 2
    assert ev["rows"][0]["viewportId"] == "vp-a"
    assert ev["rows"][1]["viewportId"] == "vp-z"


# ---------------------------------------------------------------------------
# secDoc[…] mh= count from sectionCutMaterialHints_v1
# ---------------------------------------------------------------------------


def test_sec_doc_includes_mh_count_from_material_hints() -> None:
    doc, sec = _wall_doc_with_materials()
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 400,
                "heightMm": 300,
            }
        ],
    )
    elements = dict(doc.elements)
    elements["sh-1"] = sh
    doc2 = Document(revision=1, elements=elements)
    seg = format_section_viewport_documentation_segment(doc2, "section:sec-1")
    assert "mh=" in seg
    assert "mh=1" in seg


def test_sec_doc_mh_absent_when_no_cut_elements() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -1000.0},
        lineEndMm={"xMm": 0.0, "yMm": 1000.0},
        cropDepthMm=10.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec})
    seg = format_section_viewport_documentation_segment(doc, "section:sec-1")
    assert "mh=" not in seg


# ---------------------------------------------------------------------------
# sectionAnnotationStubs_v1
# ---------------------------------------------------------------------------


def test_section_annotation_stubs_v1_includes_level_lines() -> None:
    lvl1 = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    lvl2 = LevelElem(kind="level", id="lvl-2", name="L1", elevationMm=3200)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": -5000.0, "yMm": 0.0},
        lineEndMm={"xMm": 5000.0, "yMm": 0.0},
        cropDepthMm=4000.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl1, "lvl-2": lvl2, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    stubs = prim.get("sectionAnnotationStubs_v1") or []
    level_stubs = [s for s in stubs if s["stubKind"] == "level_line"]
    assert len(level_stubs) == 2
    ref_ids = {s["referenceId"] for s in level_stubs}
    assert "lvl-1" in ref_ids
    assert "lvl-2" in ref_ids
    for s in level_stubs:
        assert s["annotationToken"] == "level_line_v1"
        assert s["annotationLabel"]


def test_section_annotation_stubs_v1_includes_grid_intersections() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    grid = GridLineElem(
        kind="grid_line",
        id="grid-A",
        name="Grid",
        label="A",
        start={"xMm": -1000.0, "yMm": 0.0},
        end={"xMm": 1000.0, "yMm": 0.0},
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -5000.0},
        lineEndMm={"xMm": 0.0, "yMm": 5000.0},
        cropDepthMm=6000.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "grid-A": grid, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    stubs = prim.get("sectionAnnotationStubs_v1") or []
    grid_stubs = [s for s in stubs if s["stubKind"] == "grid_intersection"]
    assert len(grid_stubs) == 1
    assert grid_stubs[0]["referenceId"] == "grid-A"
    assert grid_stubs[0]["annotationLabel"] == "A"
    assert grid_stubs[0]["annotationToken"] == "grid_intersection_v1"
    assert "uAnchorMm" in grid_stubs[0]


def test_section_annotation_stubs_v1_grid_outside_crop_excluded() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    grid = GridLineElem(
        kind="grid_line",
        id="grid-B",
        name="Grid B",
        label="B",
        start={"xMm": 5000.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -500.0},
        lineEndMm={"xMm": 0.0, "yMm": 500.0},
        cropDepthMm=100.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "grid-B": grid, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    stubs = prim.get("sectionAnnotationStubs_v1") or []
    grid_stubs = [s for s in stubs if s["stubKind"] == "grid_intersection"]
    assert grid_stubs == []


def test_section_annotation_stubs_v1_degenerate_is_empty() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 0.0, "yMm": 0.0},
        cropDepthMm=100.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec})
    prim, _ = build_section_projection_primitives(doc, sec)
    assert prim.get("sectionAnnotationStubs_v1") == []


# ---------------------------------------------------------------------------
# planSectionMarkRefEvidence_v1
# ---------------------------------------------------------------------------


def test_plan_section_mark_ref_evidence_v1_no_crop_includes_all_sections() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S-A",
        lineStartMm={"xMm": 0.0, "yMm": -5000.0},
        lineEndMm={"xMm": 0.0, "yMm": 5000.0},
        cropDepthMm=4000.0,
    )
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="Level 1", levelId="lvl-1")
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec, "pv-1": pv})
    ev = build_plan_section_mark_ref_evidence_v1(doc, pv)
    assert ev["format"] == "planSectionMarkRefEvidence_v1"
    assert ev["planViewId"] == "pv-1"
    assert len(ev["rows"]) == 1
    assert ev["rows"][0]["sectionId"] == "sec-1"
    assert ev["rows"][0]["sectionMarkRefToken"] == "section_mark_plan_ref_v1"
    assert ev["rows"][0]["sectionName"] == "S-A"


def test_plan_section_mark_ref_evidence_v1_crop_excludes_distant_section() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec_near = SectionCutElem(
        kind="section_cut",
        id="sec-near",
        name="Near",
        lineStartMm={"xMm": 100.0, "yMm": -500.0},
        lineEndMm={"xMm": 100.0, "yMm": 500.0},
        cropDepthMm=4000.0,
    )
    sec_far = SectionCutElem(
        kind="section_cut",
        id="sec-far",
        name="Far",
        lineStartMm={"xMm": 50000.0, "yMm": -500.0},
        lineEndMm={"xMm": 50000.0, "yMm": 500.0},
        cropDepthMm=4000.0,
    )
    pv = PlanViewElem(
        kind="plan_view",
        id="pv-1",
        name="Level 1",
        levelId="lvl-1",
        cropMinMm={"xMm": 0.0, "yMm": -1000.0},
        cropMaxMm={"xMm": 1000.0, "yMm": 1000.0},
    )
    doc = Document(
        revision=1,
        elements={"lvl-1": lvl, "sec-near": sec_near, "sec-far": sec_far, "pv-1": pv},
    )
    ev = build_plan_section_mark_ref_evidence_v1(doc, pv)
    section_ids = [r["sectionId"] for r in ev["rows"]]
    assert "sec-near" in section_ids
    assert "sec-far" not in section_ids


def test_plan_section_mark_ref_evidence_v1_none_plan_view() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="S",
        lineStartMm={"xMm": 0.0, "yMm": -500.0},
        lineEndMm={"xMm": 0.0, "yMm": 500.0},
        cropDepthMm=4000.0,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec})
    ev = build_plan_section_mark_ref_evidence_v1(doc, None)
    assert ev["planViewId"] is None
    assert len(ev["rows"]) == 1
    assert ev["rows"][0]["sectionId"] == "sec-1"
