from __future__ import annotations

import pytest

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, WallElem
from bim_ai.export_ifc import IFC_AVAILABLE

pytestmark = pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')")


def test_exchange_advisory_info_when_ifc_skips_instances() -> None:
    doc = Document(
        revision=88,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
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
            "fl-a": FloorElem(
                kind="floor",
                id="fl-a",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
            ),
            "door-bad": DoorElem(
                kind="door",
                id="door-bad",
                name="Ghost",
                wallId="ghost-wall",
                alongT=0.5,
                widthMm=800,
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    infos = [
        v
        for v in viols
        if getattr(v, "rule_id", None) == "exchange_ifc_kernel_geometry_skip_summary"
    ]
    assert len(infos) == 1
    assert infos[0].severity == "info"
    assert "door_missing_host_wall" in infos[0].message
