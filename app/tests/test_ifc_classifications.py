"""IFC-04 — IfcClassificationReference attachment when an element carries
``ifc_classification_code``.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.export_ifc import (
    IFC_AVAILABLE,
    export_ifc_model_step,
)

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


def _doc_with_classifications() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "lvl-r": LevelElem(kind="level", id="lvl-r", name="R", elevationMm=3000),
            "wal-1": WallElem(
                kind="wall",
                id="wal-1",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                materialKey="cladding_warm_wood",
                ifcClassificationCode="Uniclass:Pr_30_31_22",
            ),
            "fl-1": FloorElem(
                kind="floor",
                id="fl-1",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=8000, yMm=0),
                    Vec2Mm(xMm=8000, yMm=6000),
                    Vec2Mm(xMm=0, yMm=6000),
                ],
                ifcClassificationCode="OmniClass:23-13-15",
            ),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="Roof",
                referenceLevelId="lvl-r",
                footprintMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=8000, yMm=0),
                    Vec2Mm(xMm=8000, yMm=6000),
                    Vec2Mm(xMm=0, yMm=6000),
                ],
                materialKey="metal_standing_seam_dark_grey",
                ifcClassificationCode="OmniClass:23-13-21",
            ),
            "door-1": DoorElem(
                kind="door",
                id="door-1",
                name="D",
                wallId="wal-1",
                alongT=0.4,
                widthMm=900,
                materialKey="aluminium_dark_grey",
                ifcClassificationCode="OmniClass:23-21-15",
            ),
            "room-1": RoomElem(
                kind="room",
                id="room-1",
                name="Living",
                levelId="lvl-g",
                outlineMm=[
                    Vec2Mm(xMm=200, yMm=200),
                    Vec2Mm(xMm=4000, yMm=200),
                    Vec2Mm(xMm=4000, yMm=3000),
                    Vec2Mm(xMm=200, yMm=3000),
                ],
                ifcClassificationCode="NRM:23-Living",
            ),
        },
    )


def test_classification_codes_emit_ifc_classification_reference() -> None:
    doc = _doc_with_classifications()
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert u.count("IFCCLASSIFICATIONREFERENCE") >= 4
    assert u.count("IFCRELASSOCIATESCLASSIFICATION") >= 4
    assert "UNICLASS:PR_30_31_22" in u
    assert "OMNICLASS:23-13-15" in u
    assert "OMNICLASS:23-13-21" in u
    assert "OMNICLASS:23-21-15" in u
    assert "NRM:23-LIVING" in u


def test_no_classification_field_means_no_ifc_classification() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "w": WallElem(
                kind="wall",
                id="w",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "f": FloorElem(
                kind="floor",
                id="f",
                name="F",
                levelId="lvl",
                boundaryMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=4000, yMm=0),
                    Vec2Mm(xMm=4000, yMm=4000),
                    Vec2Mm(xMm=0, yMm=4000),
                ],
            ),
        },
    )
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "IFCCLASSIFICATIONREFERENCE" not in u
    assert "IFCRELASSOCIATESCLASSIFICATION" not in u
