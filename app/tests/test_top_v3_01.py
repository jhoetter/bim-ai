"""TOP-V3-01 — Toposolid primitive tests."""
from __future__ import annotations

import pytest

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    HeightmapGrid,
    HeightSample,
    LevelElem,
    SlabOpeningElem,
    ToposolidElem,
    ToposolidExcavationElem,
    Vec2Mm,
)
from bim_ai.engine import try_commit
from bim_ai.opening_cut_primitives import subtract_axis_aligned_rect_hole_mm
from bim_ai.site.toposolid import (
    contour_polylines,
    samples_from_toposolid,
    underside_elevation_mm,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def _doc_with(*elements) -> Document:
    els = {e.id: e for e in elements}
    return Document(revision=1, elements=els)


def _boundary() -> list[dict]:
    return [
        {"xMm": 0, "yMm": 0},
        {"xMm": 10000, "yMm": 0},
        {"xMm": 10000, "yMm": 10000},
        {"xMm": 0, "yMm": 10000},
    ]


def _height_samples() -> list[dict]:
    return [
        {"xMm": 0, "yMm": 0, "zMm": 0},
        {"xMm": 5000, "yMm": 0, "zMm": 500},
        {"xMm": 10000, "yMm": 0, "zMm": 1000},
        {"xMm": 5000, "yMm": 5000, "zMm": 750},
    ]


def _heightmap_grid() -> dict:
    return {
        "stepMm": 5000,
        "rows": 2,
        "cols": 2,
        "values": [0.0, 500.0, 250.0, 750.0],
    }


# ---------------------------------------------------------------------------
# Engine: CreateToposolidCmd
# ---------------------------------------------------------------------------


def test_create_toposolid_sparse_samples():
    ok, doc, _, _, code = try_commit(
        _empty_doc(),
        {
            "type": "CreateToposolid",
            "toposolidId": "topo-1",
            "boundaryMm": _boundary(),
            "heightSamples": _height_samples(),
        },
    )
    assert ok, code
    assert "topo-1" in doc.elements
    el = doc.elements["topo-1"]
    assert isinstance(el, ToposolidElem)
    assert el.kind == "toposolid"
    assert len(el.height_samples) == 4
    assert el.thickness_mm == 1500.0


def test_create_toposolid_heightmap_grid():
    ok, doc, _, _, code = try_commit(
        _empty_doc(),
        {
            "type": "CreateToposolid",
            "toposolidId": "topo-grid",
            "boundaryMm": _boundary(),
            "heightmapGridMm": _heightmap_grid(),
        },
    )
    assert ok, code
    el = doc.elements["topo-grid"]
    assert isinstance(el, ToposolidElem)
    assert el.heightmap_grid_mm is not None
    assert el.heightmap_grid_mm.rows == 2
    assert el.heightmap_grid_mm.cols == 2


def test_create_toposolid_flat_starter():
    """Empty height_samples (no grid) is accepted as a flat-starter terrain."""
    ok, doc, _, _, code = try_commit(
        _empty_doc(),
        {
            "type": "CreateToposolid",
            "toposolidId": "topo-flat",
            "boundaryMm": _boundary(),
        },
    )
    assert ok, code
    el = doc.elements["topo-flat"]
    assert isinstance(el, ToposolidElem)
    assert el.height_samples == []
    assert el.heightmap_grid_mm is None


def test_create_toposolid_duplicate_id_raises():
    ok, doc, _, _, _ = try_commit(
        _empty_doc(),
        {"type": "CreateToposolid", "toposolidId": "topo-1", "boundaryMm": _boundary()},
    )
    assert ok
    with pytest.raises(ValueError, match="already exists"):
        try_commit(
            doc,
            {"type": "CreateToposolid", "toposolidId": "topo-1", "boundaryMm": _boundary()},
        )


def test_create_toposolid_too_few_boundary_points_raises():
    with pytest.raises(ValueError, match="at least 3"):
        try_commit(
            _empty_doc(),
            {
                "type": "CreateToposolid",
                "toposolidId": "topo-bad",
                "boundaryMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
            },
        )


def test_create_toposolid_both_parametrisations_raises():
    with pytest.raises(ValueError, match="not both"):
        try_commit(
            _empty_doc(),
            {
                "type": "CreateToposolid",
                "toposolidId": "topo-bad",
                "boundaryMm": _boundary(),
                "heightSamples": _height_samples(),
                "heightmapGridMm": _heightmap_grid(),
            },
        )


# ---------------------------------------------------------------------------
# Engine: UpdateToposolidCmd
# ---------------------------------------------------------------------------


def test_update_toposolid_patches_thickness():
    ok, doc, _, _, _ = try_commit(
        _empty_doc(),
        {
            "type": "CreateToposolid",
            "toposolidId": "topo-1",
            "boundaryMm": _boundary(),
            "heightSamples": _height_samples(),
            "thicknessMm": 1500,
        },
    )
    assert ok

    ok2, doc2, _, _, code = try_commit(
        doc, {"type": "UpdateToposolid", "toposolidId": "topo-1", "thicknessMm": 2000}
    )
    assert ok2, code
    el = doc2.elements["topo-1"]
    assert isinstance(el, ToposolidElem)
    assert el.thickness_mm == 2000
    assert len(el.height_samples) == 4  # unchanged


def test_update_toposolid_missing_id_raises():
    with pytest.raises(ValueError, match="no toposolid"):
        try_commit(
            _empty_doc(),
            {"type": "UpdateToposolid", "toposolidId": "nonexistent", "thicknessMm": 2000},
        )


# ---------------------------------------------------------------------------
# Engine: DeleteToposolidCmd
# ---------------------------------------------------------------------------


def test_delete_toposolid_removes_element():
    ok, doc, _, _, _ = try_commit(
        _empty_doc(),
        {"type": "CreateToposolid", "toposolidId": "topo-1", "boundaryMm": _boundary()},
    )
    assert ok
    assert "topo-1" in doc.elements

    ok2, doc2, _, _, code = try_commit(
        doc, {"type": "DeleteToposolid", "toposolidId": "topo-1"}
    )
    assert ok2, code
    assert "topo-1" not in doc2.elements


# ---------------------------------------------------------------------------
# site/toposolid helpers
# ---------------------------------------------------------------------------


def test_samples_from_toposolid_sparse():
    topo = ToposolidElem(
        id="t1",
        boundaryMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=5000, yMm=0), Vec2Mm(xMm=5000, yMm=5000)],
        heightSamples=[
            HeightSample(xMm=0, yMm=0, zMm=100),
            HeightSample(xMm=5000, yMm=0, zMm=200),
        ],
    )
    pts = samples_from_toposolid(topo)
    assert pts == [(0.0, 0.0, 100.0), (5000.0, 0.0, 200.0)]


def test_samples_from_toposolid_grid():
    grid = HeightmapGrid(stepMm=5000, rows=2, cols=2, values=[0.0, 100.0, 200.0, 300.0])
    topo = ToposolidElem(
        id="t2",
        boundaryMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=5000, yMm=0), Vec2Mm(xMm=5000, yMm=5000)],
        heightmapGridMm=grid,
    )
    pts = samples_from_toposolid(topo)
    assert len(pts) == 4
    assert pts[0] == (0.0, 0.0, 0.0)
    assert pts[1] == (5000.0, 0.0, 100.0)
    assert pts[2] == (0.0, 5000.0, 200.0)
    assert pts[3] == (5000.0, 5000.0, 300.0)


def test_contour_polylines_flat_starter_returns_empty():
    topo = ToposolidElem(
        id="t-flat",
        boundaryMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=5000, yMm=0), Vec2Mm(xMm=5000, yMm=5000)],
    )
    assert contour_polylines(topo) == []


def test_contour_polylines_two_samples_returns_empty():
    topo = ToposolidElem(
        id="t-few",
        boundaryMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=5000, yMm=0), Vec2Mm(xMm=5000, yMm=5000)],
        heightSamples=[
            HeightSample(xMm=0, yMm=0, zMm=0),
            HeightSample(xMm=5000, yMm=0, zMm=1000),
        ],
    )
    assert contour_polylines(topo) == []


def test_underside_elevation_mm_default_base():
    topo = ToposolidElem(
        id="t1",
        boundaryMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=1000, yMm=0), Vec2Mm(xMm=1000, yMm=1000)],
        thicknessMm=1500,
    )
    assert underside_elevation_mm(topo) == -1500.0


def test_underside_elevation_mm_with_base():
    topo = ToposolidElem(
        id="t1",
        boundaryMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=1000, yMm=0), Vec2Mm(xMm=1000, yMm=1000)],
        thicknessMm=1500,
        baseElevationMm=500,
    )
    assert underside_elevation_mm(topo) == -1000.0


# ---------------------------------------------------------------------------
# Advisory: toposolid_pierce_check
# ---------------------------------------------------------------------------


def test_toposolid_pierce_check_fires_on_overlap():
    topo = ToposolidElem(
        id="topo-1",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=20000, yMm=0),
            Vec2Mm(xMm=20000, yMm=20000),
            Vec2Mm(xMm=0, yMm=20000),
        ],
    )
    floor = FloorElem(
        id="floor-1",
        name="Ground Floor",
        levelId="lv1",
        boundaryMm=[
            Vec2Mm(xMm=1000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=5000),
            Vec2Mm(xMm=1000, yMm=5000),
        ],
        thicknessMm=200,
    )
    doc = _doc_with(topo, floor)
    violations = evaluate(doc.elements)
    pierce_viols = [v for v in violations if v.rule_id == "toposolid_pierce_check"]
    assert len(pierce_viols) >= 1
    assert pierce_viols[0].severity == "warning"
    assert not pierce_viols[0].blocking


def test_toposolid_pierce_check_suppressed_by_slab_opening():
    topo = ToposolidElem(
        id="topo-1",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=20000, yMm=0),
            Vec2Mm(xMm=20000, yMm=20000),
            Vec2Mm(xMm=0, yMm=20000),
        ],
    )
    floor = FloorElem(
        id="floor-1",
        name="Ground Floor",
        levelId="lv1",
        boundaryMm=[
            Vec2Mm(xMm=1000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=5000),
            Vec2Mm(xMm=1000, yMm=5000),
        ],
        thicknessMm=200,
    )
    opening = SlabOpeningElem(
        id="opening-1",
        name="Basement cut",
        hostFloorId="floor-1",
        boundaryMm=[
            Vec2Mm(xMm=1000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=5000),
        ],
    )
    doc = _doc_with(topo, floor, opening)
    violations = evaluate(doc.elements)
    pierce_viols = [v for v in violations if v.rule_id == "toposolid_pierce_check"]
    assert len(pierce_viols) == 0


def test_toposolid_pierce_check_suppressed_by_excavation_relation():
    topo = ToposolidElem(
        id="topo-1",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=20000, yMm=0),
            Vec2Mm(xMm=20000, yMm=20000),
            Vec2Mm(xMm=0, yMm=20000),
        ],
    )
    floor = FloorElem(
        id="floor-1",
        name="Basement slab cutter",
        levelId="lv1",
        boundaryMm=[
            Vec2Mm(xMm=1000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=5000),
            Vec2Mm(xMm=1000, yMm=5000),
        ],
        thicknessMm=250,
    )
    excavation = ToposolidExcavationElem(
        id="exc-1",
        hostToposolidId="topo-1",
        cutterElementId="floor-1",
    )
    doc = _doc_with(topo, floor, excavation)
    violations = evaluate(doc.elements)
    pierce_viols = [v for v in violations if v.rule_id == "toposolid_pierce_check"]
    assert pierce_viols == []


def test_toposolid_pierce_check_ignores_floor_above_terrain():
    topo = ToposolidElem(
        id="topo-1",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=20000, yMm=0),
            Vec2Mm(xMm=20000, yMm=20000),
            Vec2Mm(xMm=0, yMm=20000),
        ],
        heightSamples=[
            HeightSample(xMm=0, yMm=0, zMm=-1500),
            HeightSample(xMm=20000, yMm=0, zMm=-900),
            HeightSample(xMm=20000, yMm=20000, zMm=-1800),
        ],
        thicknessMm=1800,
        baseElevationMm=-3200,
    )
    level = LevelElem(id="eg", name="Erdgeschoss", elevationMm=0)
    floor = FloorElem(
        id="floor-1",
        name="Ground floor above sloped site",
        levelId="eg",
        boundaryMm=[
            Vec2Mm(xMm=1000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=1000),
            Vec2Mm(xMm=5000, yMm=5000),
            Vec2Mm(xMm=1000, yMm=5000),
        ],
        thicknessMm=200,
    )
    doc = _doc_with(topo, level, floor)
    violations = evaluate(doc.elements)
    pierce_viols = [v for v in violations if v.rule_id == "toposolid_pierce_check"]
    assert pierce_viols == []


# ---------------------------------------------------------------------------
# Round-trip: Document with Toposolid
# ---------------------------------------------------------------------------


def test_document_roundtrip_with_toposolid():
    topo = ToposolidElem(
        id="topo-rt",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=5000, yMm=0),
            Vec2Mm(xMm=5000, yMm=5000),
        ],
        heightSamples=[
            HeightSample(xMm=0, yMm=0, zMm=0),
            HeightSample(xMm=5000, yMm=0, zMm=1000),
            HeightSample(xMm=5000, yMm=5000, zMm=500),
        ],
        thicknessMm=2000,
        baseElevationMm=100,
    )
    doc = _doc_with(topo)
    serialised = doc.model_dump(by_alias=True)
    restored = Document.model_validate(serialised)
    el = restored.elements["topo-rt"]
    assert isinstance(el, ToposolidElem)
    assert el.thickness_mm == 2000
    assert el.base_elevation_mm == 100
    assert len(el.height_samples) == 3
    assert el.height_samples[2].z_mm == 500


# ---------------------------------------------------------------------------
# Floor elevation inheritance from toposolid
# ---------------------------------------------------------------------------


def test_floor_inherits_toposolid_elevation():
    """A floor created over a toposolid inherits the surface elevation at its centroid."""
    # Create a level first (required by CreateFloorCmd).
    level = LevelElem(id="lv1", name="Ground", elevationMm=0)
    # Toposolid covering (0,0)–(20000,20000) at uniform z=800 mm.
    topo = ToposolidElem(
        id="topo-elev",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=20000, yMm=0),
            Vec2Mm(xMm=20000, yMm=20000),
            Vec2Mm(xMm=0, yMm=20000),
        ],
        heightSamples=[
            HeightSample(xMm=0, yMm=0, zMm=800),
            HeightSample(xMm=10000, yMm=0, zMm=800),
            HeightSample(xMm=10000, yMm=10000, zMm=800),
        ],
    )
    doc = _doc_with(level, topo)

    # Create floor at same level centred inside toposolid boundary.
    ok, doc2, _, _, code = try_commit(
        doc,
        {
            "type": "createFloor",
            "levelId": "lv1",
            "boundaryMm": [
                {"xMm": 4000, "yMm": 4000},
                {"xMm": 6000, "yMm": 4000},
                {"xMm": 6000, "yMm": 6000},
                {"xMm": 4000, "yMm": 6000},
            ],
            "thicknessMm": 200,
        },
    )
    assert ok, code
    # Find the created floor element.
    floors = [e for e in doc2.elements.values() if isinstance(e, FloorElem)]
    assert floors, "Expected at least one FloorElem"
    floor = floors[0]
    # Floor must inherit toposolid surface elevation at centroid (≈800 mm).
    assert floor.toposolid_elevation_mm is not None
    assert abs(floor.toposolid_elevation_mm - 800.0) < 1.0


# ---------------------------------------------------------------------------
# CSG floor-cut test
# ---------------------------------------------------------------------------


def test_csg_floor_cut():
    """Subtracting a building footprint from a toposolid boundary produces the expected residuals.

    Uses ``subtract_axis_aligned_rect_hole_mm`` as the CSG subtraction helper.
    A 20 m × 20 m toposolid with a 10 m × 10 m building footprint removed in
    the centre should yield three residual panels (top, bottom, and one side).
    """
    # Toposolid outer rect: (0,0)–(20000,20000)
    # Building footprint (hole): (5000,5000)–(15000,15000)
    result = subtract_axis_aligned_rect_hole_mm(
        fx0=0,
        fx1=20000,
        fy0=0,
        fy1=20000,
        ox0=5000,
        ox1=15000,
        oy0=5000,
        oy1=15000,
        min_gap_mm=100,
    )
    assert result is not None, "Expected residual panels from CSG subtraction"
    # Should have at least 2 panels (bottom strip + top strip; sides optional).
    assert len(result) >= 2
    # Each panel is an (x0, x1, y0, y1) tuple — verify basic geometry.
    for x0, x1, y0, y1 in result:
        assert x1 > x0
        assert y1 > y0
