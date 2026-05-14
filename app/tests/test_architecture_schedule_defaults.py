from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    LevelElem,
    PlanViewElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    Vec2Mm,
    Vec3Mm,
    ViewpointElem,
)
from bim_ai.schedule_derivation import derive_schedule_table


def _outline() -> list[Vec2Mm]:
    return [
        Vec2Mm(x_mm=0, y_mm=0),
        Vec2Mm(x_mm=4000, y_mm=0),
        Vec2Mm(x_mm=4000, y_mm=3000),
        Vec2Mm(x_mm=0, y_mm=3000),
    ]


def test_finish_schedule_is_first_class_architecture_default() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Level 1", elevationMm=0),
            "room": RoomElem(
                kind="room",
                id="room",
                name="Office",
                levelId="lvl",
                outlineMm=_outline(),
                department="Design",
                programmeCode="OFF",
                finishSet="Paint-A",
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Finish Schedule",
                category="finish",
            ),
        },
    )

    table = derive_schedule_table(doc, "sch")

    assert table["category"] == "finish"
    assert table["columns"][:4] == ["elementId", "name", "levelId", "level"]
    assert table["rows"][0]["finishSet"] == "Paint-A"
    assert table["rows"][0]["finishState"] == "complete"
    assert table["totals"]["kind"] == "finish"
    assert table["roomFinishScheduleEvidence_v1"]["summary"]["complete"] == 1


def test_view_list_schedule_covers_plan_section_and_saved_3d_views() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Level 1", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="Level 1 Plan", levelId="lvl"),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec",
                name="Section A",
                lineStartMm={"xMm": 0, "yMm": 0},
                lineEndMm={"xMm": 3000, "yMm": 0},
            ),
            "vp": ViewpointElem(
                kind="viewpoint",
                id="vp",
                name="Axonometric",
                camera=CameraMm(
                    position=Vec3Mm(x_mm=1, y_mm=2, z_mm=3),
                    target=Vec3Mm(x_mm=0, y_mm=0, z_mm=0),
                    up=Vec3Mm(x_mm=0, y_mm=1, z_mm=0),
                ),
            ),
            "sheet": SheetElem(
                kind="sheet",
                id="sheet",
                name="A101",
                viewportsMm=[
                    {"viewportId": "v1", "viewRef": "plan:pv"},
                    {"viewportId": "v2", "viewRef": "section:sec"},
                    {"viewportId": "v3", "viewRef": "viewpoint:vp"},
                ],
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="View List", category="view"),
        },
    )

    table = derive_schedule_table(doc, "sch")
    by_id = {row["elementId"]: row for row in table["rows"]}

    assert table["category"] == "view"
    assert by_id["pv"]["viewKind"] == "plan_view"
    assert by_id["pv"]["sheetName"] == "A101"
    assert by_id["sec"]["viewKind"] == "section_cut"
    assert by_id["vp"]["viewKind"] == "viewpoint"
    assert "viewKind" in table["columns"]
