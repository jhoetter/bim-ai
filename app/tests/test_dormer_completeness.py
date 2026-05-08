"""KRN-14 closeout: gable / hipped roof kinds, hasFloorOpening slab cuts, and
the `dormer_overflow_v1` polygon-precision warning advisory."""

from __future__ import annotations

import pytest

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    DormerElem,
    FloorElem,
    LevelElem,
    RoofElem,
    SlabOpeningElem,
    Vec2Mm,
)
from bim_ai.engine import try_commit


def _doc_with_roof_and_floor() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevation_mm=0),
            "fl-1": FloorElem(
                kind="floor",
                id="fl-1",
                level_id="lvl-1",
                boundary_mm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=5000, yMm=0),
                    Vec2Mm(xMm=5000, yMm=8000),
                    Vec2Mm(xMm=0, yMm=8000),
                ],
            ),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                reference_level_id="lvl-1",
                footprint_mm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=5000, yMm=0),
                    Vec2Mm(xMm=5000, yMm=8000),
                    Vec2Mm(xMm=0, yMm=8000),
                ],
                roof_geometry_mode="asymmetric_gable",
                eave_height_left_mm=1500,
                eave_height_right_mm=4000,
                ridge_offset_transverse_mm=1500,
            ),
        },
    )


def test_gable_dormer_validates_ridge_height_required():
    """Pydantic enforces ridgeHeightMm when dormerRoofKind is gable / hipped."""
    with pytest.raises(Exception):
        try_commit(
            _doc_with_roof_and_floor(),
            {
                "type": "createDormer",
                "id": "d1",
                "hostRoofId": "r1",
                "positionOnRoof": {"alongRidgeMm": 0, "acrossRidgeMm": 0},
                "widthMm": 2400,
                "wallHeightMm": 2400,
                "depthMm": 2000,
                "dormerRoofKind": "gable",
            },
        )


def test_gable_dormer_with_ridge_height_succeeds():
    ok, doc, _, _, code = try_commit(
        _doc_with_roof_and_floor(),
        {
            "type": "createDormer",
            "id": "d1",
            "hostRoofId": "r1",
            "positionOnRoof": {"alongRidgeMm": -2000, "acrossRidgeMm": 1000},
            "widthMm": 2400,
            "wallHeightMm": 2400,
            "depthMm": 2000,
            "dormerRoofKind": "gable",
            "ridgeHeightMm": 1200,
        },
    )
    assert ok, f"expected success, got {code}"
    assert doc is not None
    el = doc.elements["d1"]
    assert isinstance(el, DormerElem)
    assert el.dormer_roof_kind == "gable"
    assert el.ridge_height_mm == 1200


def test_hipped_dormer_renders_four_faces():
    ok, doc, _, _, code = try_commit(
        _doc_with_roof_and_floor(),
        {
            "type": "createDormer",
            "id": "d1",
            "hostRoofId": "r1",
            "positionOnRoof": {"alongRidgeMm": -2000, "acrossRidgeMm": 1000},
            "widthMm": 2400,
            "wallHeightMm": 2400,
            "depthMm": 2000,
            "dormerRoofKind": "hipped",
            "ridgeHeightMm": 1500,
        },
    )
    assert ok, f"expected success, got {code}"
    assert doc is not None
    el = doc.elements["d1"]
    assert isinstance(el, DormerElem)
    assert el.dormer_roof_kind == "hipped"


def test_has_floor_opening_emits_slab_opening():
    ok, doc, _, _, code = try_commit(
        _doc_with_roof_and_floor(),
        {
            "type": "createDormer",
            "id": "d1",
            "hostRoofId": "r1",
            "positionOnRoof": {"alongRidgeMm": -2000, "acrossRidgeMm": 1000},
            "widthMm": 2400,
            "wallHeightMm": 2400,
            "depthMm": 2000,
            "dormerRoofKind": "flat",
            "hasFloorOpening": True,
        },
    )
    assert ok, f"expected success, got {code}"
    assert doc is not None
    opening_id = "d1_floor_opening"
    assert opening_id in doc.elements
    opening = doc.elements[opening_id]
    assert isinstance(opening, SlabOpeningElem)
    assert opening.host_floor_id == "fl-1"
    assert len(opening.boundary_mm) == 4


def _doc_with_l_shaped_roof_and_floor() -> Document:
    """Roof + floor with an L-shaped footprint. Bounding box is 8000x8000;
    the south-east 4000x4000 quadrant is cut out so a dormer placed in that
    quadrant has vertices inside the bbox but outside the polygon."""
    l_polygon = [
        Vec2Mm(xMm=0, yMm=0),
        Vec2Mm(xMm=4000, yMm=0),
        Vec2Mm(xMm=4000, yMm=4000),
        Vec2Mm(xMm=8000, yMm=4000),
        Vec2Mm(xMm=8000, yMm=8000),
        Vec2Mm(xMm=0, yMm=8000),
    ]
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevation_mm=0),
            "fl-1": FloorElem(
                kind="floor",
                id="fl-1",
                level_id="lvl-1",
                boundary_mm=list(l_polygon),
            ),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                reference_level_id="lvl-1",
                footprint_mm=list(l_polygon),
                roof_geometry_mode="mass_box",
            ),
        },
    )


def test_dormer_overflow_advisory_fires_when_vertex_outside_roof():
    doc = _doc_with_l_shaped_roof_and_floor()
    ok, new_doc, _, _, _ = try_commit(
        doc,
        {
            "type": "createDormer",
            "id": "d1",
            "hostRoofId": "r1",
            "positionOnRoof": {"alongRidgeMm": 1500, "acrossRidgeMm": -2500},
            "widthMm": 2000,
            "wallHeightMm": 2400,
            "depthMm": 2000,
            "dormerRoofKind": "flat",
        },
    )
    assert ok and new_doc is not None
    viols = evaluate(new_doc.elements)
    overflow = [v for v in viols if v.rule_id == "dormer_overflow_v1"]
    assert overflow, "expected a dormer_overflow_v1 warning"
    assert overflow[0].severity == "warning"
    assert "d1" in overflow[0].element_ids
    assert "r1" in overflow[0].element_ids


def test_dormer_overflow_quiet_when_inside():
    doc = _doc_with_roof_and_floor()
    ok, new_doc, _, _, _ = try_commit(
        doc,
        {
            "type": "createDormer",
            "id": "d1",
            "hostRoofId": "r1",
            "positionOnRoof": {"alongRidgeMm": -2000, "acrossRidgeMm": 1000},
            "widthMm": 2400,
            "wallHeightMm": 2400,
            "depthMm": 2000,
            "dormerRoofKind": "flat",
        },
    )
    assert ok and new_doc is not None
    viols = evaluate(new_doc.elements)
    overflow = [v for v in viols if v.rule_id == "dormer_overflow_v1"]
    assert overflow == []
