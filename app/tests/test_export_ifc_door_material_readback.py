"""IFC read-back: openings carry ``MaterialFinish`` from kernel materialKey (WP-X03)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, WallElem
from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step

pytestmark = pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed")


def test_ifc_read_back_door_finish_material_matches_kernel_material_key() -> None:

    doc = Document(

        revision=3,

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

            "d1": DoorElem(

                kind="door",

                id="d1",

                name="Door",

                wallId="w-a",

                alongT=0.4,

                widthMm=900,

                materialKey="thermPowder_white9010",

            ),

        },

    )

    step = export_ifc_model_step(doc)

    import ifcopenshell
    import ifcopenshell.util.element as elem_util

    model = ifcopenshell.file.from_string(step)

    doors = model.by_type("IfcDoor") or []

    assert len(doors) >= 1

    ps = elem_util.get_psets(doors[0])

    assert ps.get("Pset_DoorCommon", {}).get("MaterialFinish") == "thermPowder_white9010"
