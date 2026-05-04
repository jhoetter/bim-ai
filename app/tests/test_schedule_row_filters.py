"""Row-level ``filterEquals`` on derived schedules (prompt-3 / WP-D01)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem
from bim_ai.schedule_derivation import derive_schedule_table


def test_schedule_filter_equals_level_reduces_rows() -> None:
    doc = Document(
        revision=1,
        elements={
            "l1": LevelElem(kind="level", id="l1", name="L1", elevationMm=0),
            "l2": LevelElem(kind="level", id="l2", name="L2", elevationMm=2800),
            "r1": RoomElem(
                kind="room",
                id="r1",
                name="A",
                levelId="l1",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                ],
            ),
            "r2": RoomElem(
                kind="room",
                id="r2",
                name="B",
                levelId="l2",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                ],
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={"category": "room", "filterEquals": {"levelId": "l2"}},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    rows = tbl.get("rows") or []
    assert len(rows) == 1
    assert rows[0].get("elementId") == "r2"
    eng = tbl.get("scheduleEngine") or {}
    assert eng.get("filterEquals") == {"levelId": "l2"}


def test_schedule_group_keys_from_grouping_when_no_grouping_hint() -> None:
    doc = Document(
        revision=1,
        elements={
            "l1": LevelElem(kind="level", id="l1", name="L1", elevationMm=0),
            "r1": RoomElem(
                kind="room",
                id="r1",
                name="Zeta",
                levelId="l1",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                ],
            ),
            "r2": RoomElem(
                kind="room",
                id="r2",
                name="Alpha",
                levelId="l1",
                outlineMm=[
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 1000},
                ],
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={"category": "room"},
                grouping={"groupKeys": ["levelId"]},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    assert tbl.get("groupKeys") == ["levelId"]
    gs = tbl.get("groupedSections")
    assert isinstance(gs, dict)
    assert len(gs) >= 1
