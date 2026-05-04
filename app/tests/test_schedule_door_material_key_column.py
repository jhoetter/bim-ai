"""Door schedule derivation surfaces optional material keys (WP-P01 data-path smoke)."""

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, ScheduleElem, WallElem
from bim_ai.schedule_derivation import derive_schedule_table


def test_door_schedule_includes_material_key_field() -> None:
    doc = Document(
        revision=1,

        elements={

            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),

            "wa": WallElem(

                kind="wall",

                id="wa",

                name="W",

                levelId="lv",

                start={"xMm": 0, "yMm": 0},

                end={"xMm": 5000, "yMm": 0},

                thicknessMm=200,

                heightMm=2800,

            ),

            "d1": DoorElem(

                kind="door",

                id="d1",

                name="D",

                wallId="wa",

                alongT=0.5,

                widthMm=900,

                materialKey="steel_white",

            ),

            "sch": ScheduleElem(kind="schedule", id="sch", name="Dr", filters={"category": "door"}),

        },

    )

    tbl = derive_schedule_table(doc, "sch")

    rows = tbl.get("rows") or []

    assert len(rows) == 1

    assert rows[0].get("materialKey") == "steel_white"

