"""Stable numeric-aware schedule row ordering (WP-D01 tie-break + sortDescending)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, WallElem, WindowElem
from bim_ai.schedule_derivation import derive_schedule_table


def _square_outline(side_mm: float) -> list[dict[str, float]]:
    return [
        {"xMm": 0, "yMm": 0},
        {"xMm": side_mm, "yMm": 0},
        {"xMm": side_mm, "yMm": side_mm},
        {"xMm": 0, "yMm": side_mm},
    ]


def test_schedule_sort_by_numeric_width_orders_numbers_not_lexicographically() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "w": WallElem(
                kind="wall",
                id="w",
                name="Wall",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wa": WindowElem(
                kind="window",
                id="wa",
                name="Wide",
                wallId="w",
                alongT=0.25,
                widthMm=1200,
            ),
            "wb": WindowElem(
                kind="window",
                id="wb",
                name="Narrow",
                wallId="w",
                alongT=0.65,
                widthMm=900,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Win",
                filters={"category": "window", "sortBy": "widthMm"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["wb", "wa"]


def test_schedule_sort_tie_break_uses_stable_element_id() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "r-b": RoomElem(
                kind="room",
                id="r-b",
                name="B-room",
                levelId="lvl",
                outlineMm=_square_outline(1000),
            ),
            "r-a": RoomElem(
                kind="room",
                id="r-a",
                name="A-room",
                levelId="lvl",
                outlineMm=_square_outline(1000),
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={"category": "room", "sortBy": "areaM2"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    assert tbl["scheduleEngine"].get("sortTieBreak") == "elementId"
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["r-a", "r-b"], "same primary key; alphabetical elementId wins"


def test_schedule_sort_descending_flip() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "r1": RoomElem(
                kind="room",
                id="r1",
                name="Small",
                levelId="lvl",
                outlineMm=_square_outline(1000),
            ),
            "r2": RoomElem(
                kind="room",
                id="r2",
                name="Large",
                levelId="lvl",
                outlineMm=_square_outline(2000),
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={"category": "room"},
                grouping={"sortBy": "areaM2", "sortDescending": True},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    eng = tbl["scheduleEngine"]
    assert eng.get("sortBy") == "areaM2"
    assert eng.get("sortDescending") is True
    areas = [float(r["areaM2"]) for r in tbl["rows"]]
    assert areas == sorted(areas, reverse=True)


def test_schedule_sort_descending_snake_case_alias() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "r1": RoomElem(
                kind="room",
                id="r1",
                name="Small",
                levelId="lvl",
                outlineMm=_square_outline(1000),
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={"category": "room", "sortBy": "areaM2", "sort_descending": True},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    assert tbl["scheduleEngine"].get("sortDescending") is True


def test_schedule_grouped_sections_inner_sort_respects_stable_numeric_sort() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "r1": RoomElem(
                kind="room",
                id="z-room",
                name="ZZZ",
                levelId="lvl",
                outlineMm=_square_outline(1000),
            ),
            "r2": RoomElem(
                kind="room",
                id="a-room",
                name="AAA",
                levelId="lvl",
                outlineMm=_square_outline(1000),
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={"category": "room", "groupingHint": ["levelId"], "sortBy": "elementId"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    gs = tbl.get("groupedSections")
    assert isinstance(gs, dict)
    leaf = next(iter(gs.values()))
    ids = [r["elementId"] for r in leaf]
    assert ids == sorted(ids)
