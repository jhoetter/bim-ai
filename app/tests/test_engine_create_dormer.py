"""KRN-14: tests for the createDormer command + DormerElem validation."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import DormerElem, LevelElem, RoofElem, Vec2Mm
from bim_ai.engine import try_commit


def _doc_with_roof() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevation_mm=0),
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


def test_create_dormer_minimal_succeeds():
    ok, new_doc, _, _, code = try_commit(
        _doc_with_roof(),
        {
            "type": "createDormer",
            "id": "d1",
            "name": "East dormer",
            "hostRoofId": "r1",
            "positionOnRoof": {"alongRidgeMm": -2000, "acrossRidgeMm": 1000},
            "widthMm": 2400,
            "wallHeightMm": 2400,
            "depthMm": 2000,
            "dormerRoofKind": "flat",
            "wallMaterialKey": "white_render",
            "hasFloorOpening": False,
        },
    )
    assert ok, f"expected success, got {code}"
    assert new_doc is not None
    el = new_doc.elements["d1"]
    assert isinstance(el, DormerElem)
    assert el.host_roof_id == "r1"
    assert el.width_mm == 2400
    assert el.dormer_roof_kind == "flat"
    assert el.wall_material_key == "white_render"


def test_create_dormer_unknown_roof_rejected():
    with pytest.raises(ValueError, match="roof"):
        try_commit(
            _doc_with_roof(),
            {
                "type": "createDormer",
                "id": "d1",
                "hostRoofId": "no-such-roof",
                "positionOnRoof": {"alongRidgeMm": 0, "acrossRidgeMm": 0},
                "widthMm": 2400,
                "wallHeightMm": 2400,
                "depthMm": 2000,
            },
        )


def test_create_dormer_overflow_along_ridge_rejected():
    # Roof half-along is 4000mm; alongRidgeMm 4000 + halfWidth 1200 = 5200 > 4000.
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_roof(),
            {
                "type": "createDormer",
                "id": "d1",
                "hostRoofId": "r1",
                "positionOnRoof": {"alongRidgeMm": 4000, "acrossRidgeMm": 0},
                "widthMm": 2400,
                "wallHeightMm": 2400,
                "depthMm": 2000,
            },
        )


def test_create_dormer_unknown_material_rejected():
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_roof(),
            {
                "type": "createDormer",
                "id": "d1",
                "hostRoofId": "r1",
                "positionOnRoof": {"alongRidgeMm": 0, "acrossRidgeMm": 1000},
                "widthMm": 2400,
                "wallHeightMm": 2400,
                "depthMm": 2000,
                "wallMaterialKey": "no_such_material",
            },
        )


def test_create_dormer_zero_width_rejected():
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_roof(),
            {
                "type": "createDormer",
                "id": "d1",
                "hostRoofId": "r1",
                "positionOnRoof": {"alongRidgeMm": 0, "acrossRidgeMm": 0},
                "widthMm": 0,
                "wallHeightMm": 2400,
                "depthMm": 2000,
            },
        )
