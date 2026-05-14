from __future__ import annotations

from bim_ai.architecture_lens_query import build_architecture_lens_query
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    PlanViewElem,
    RoomElem,
    ScheduleElem,
    SheetElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
)


def test_architecture_lens_query_buckets_model_data_without_ui_state() -> None:
    doc = Document(
        revision=7,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Level 1", elevationMm=0),
            "wt": WallTypeElem(kind="wall_type", id="wt", name="Generic 200"),
            "wall": WallElem(
                kind="wall",
                id="wall",
                name="Exterior wall",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                wallTypeId="wt",
            ),
            "room": RoomElem(
                kind="room",
                id="room",
                name="Office",
                levelId="lvl",
                outlineMm=[
                    Vec2Mm(x_mm=0, y_mm=0),
                    Vec2Mm(x_mm=3000, y_mm=0),
                    Vec2Mm(x_mm=3000, y_mm=2000),
                    Vec2Mm(x_mm=0, y_mm=2000),
                ],
                department="Design",
                finishSet="Paint-A",
            ),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="Level 1 Plan", levelId="lvl"),
            "sheet": SheetElem(kind="sheet", id="sheet", name="A101"),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Room Schedule", category="room"),
        },
    )

    payload = build_architecture_lens_query(doc)

    assert payload["lens"]["id"] == "architecture"
    assert payload["lens"]["germanName"] == "Architektur"
    assert payload["revision"] == 7
    assert payload["counts"] == {
        "geometry": 2,
        "types": 1,
        "rooms": 1,
        "areas": 0,
        "views": 1,
        "sheets": 1,
        "schedules": 1,
    }
    assert payload["geometry"][0]["kind"] == "level"
    assert payload["rooms"][0]["finishSet"] == "Paint-A"
    assert "lensMode" not in str(payload)
