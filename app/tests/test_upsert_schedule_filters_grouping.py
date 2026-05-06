"""upsertScheduleFilters merges filters and optional grouping."""

from bim_ai.commands import UpsertScheduleFiltersCmd
from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, RoomElem, ScheduleElem, WallElem
from bim_ai.engine import apply_inplace
from bim_ai.schedule_derivation import derive_schedule_table


def test_upsert_schedule_filters_merges_grouping() -> None:
    doc = Document(
        revision=1,
        elements={
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door", "groupingHint": ["levelId"]},
                grouping={"sortBy": "name"},
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-1",
            filters={"sortBy": "widthMm", "groupingHint": ["familyTypeId"]},
            grouping={"sortBy": "widthMm", "groupKeys": ["familyTypeId"]},
        ),
    )
    sch = doc.elements["sch-1"]
    assert isinstance(sch, ScheduleElem)
    assert sch.filters["category"] == "door"
    assert sch.filters["sortBy"] == "widthMm"
    assert sch.filters["groupingHint"] == ["familyTypeId"]
    assert sch.grouping.get("sortBy") == "widthMm"
    assert sch.grouping.get("groupKeys") == ["familyTypeId"]


def test_upsert_schedule_filters_persists_sort_descending_replay() -> None:
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
                name="A",
                wallId="wa",
                alongT=0.5,
                widthMm=800,
            ),
            "d2": DoorElem(
                kind="door",
                id="d2",
                name="B",
                wallId="wa",
                alongT=0.2,
                widthMm=1100,
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door"},
                grouping={"sortBy": "widthMm"},
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-1",
            filters={"sortDescending": True},
            grouping={"sortDescending": True},
        ),
    )
    tbl = derive_schedule_table(doc, "sch-1")
    assert tbl["scheduleEngine"].get("sortDescending") is True
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["d2", "d1"]


def test_upsert_schedule_filters_persists_filter_rules_gt_replay() -> None:
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
                name="A",
                wallId="wa",
                alongT=0.5,
                widthMm=800,
            ),
            "d2": DoorElem(
                kind="door",
                id="d2",
                name="B",
                wallId="wa",
                alongT=0.2,
                widthMm=1100,
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door"},
                grouping={"sortBy": "name"},
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-1",
            filters={"filterRules": [{"field": "widthMm", "op": "gt", "value": 900}]},
        ),
    )
    sch = doc.elements["sch-1"]
    assert isinstance(sch, ScheduleElem)
    assert sch.filters.get("filterRules") == [{"field": "widthMm", "op": "gt", "value": 900}]
    tbl = derive_schedule_table(doc, "sch-1")
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["d2"]
    assert (tbl.get("scheduleEngine") or {}).get("filterRules") == [
        {"field": "widthMm", "op": "gt", "value": 900.0},
    ]


def test_upsert_schedule_filters_persists_filter_rules_lt_replay() -> None:
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
                name="A",
                wallId="wa",
                alongT=0.5,
                widthMm=800,
            ),
            "d2": DoorElem(
                kind="door",
                id="d2",
                name="B",
                wallId="wa",
                alongT=0.2,
                widthMm=1100,
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door"},
                grouping={"sortBy": "name"},
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-1",
            filters={"filterRules": [{"field": "widthMm", "op": "lt", "value": 1000}]},
        ),
    )
    sch = doc.elements["sch-1"]
    assert isinstance(sch, ScheduleElem)
    assert sch.filters.get("filterRules") == [{"field": "widthMm", "op": "lt", "value": 1000}]
    tbl = derive_schedule_table(doc, "sch-1")
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["d1"]
    assert (tbl.get("scheduleEngine") or {}).get("filterRules") == [
        {"field": "widthMm", "op": "lt", "value": 1000.0},
    ]


def test_upsert_schedule_filters_persists_room_area_filter_rules_replay() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),
            "r-small": RoomElem(
                kind="room",
                id="r-small",
                name="Small",
                levelId="lv",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
            ),
            "r-large": RoomElem(
                kind="room",
                id="r-large",
                name="Large",
                levelId="lv",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Rooms",
                filters={"category": "room"},
                grouping={"sortBy": "name"},
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-1",
            filters={"filterRules": [{"field": "areaM2", "op": "gt", "value": 10}]},
        ),
    )
    sch = doc.elements["sch-1"]
    assert isinstance(sch, ScheduleElem)
    assert sch.filters.get("filterRules") == [{"field": "areaM2", "op": "gt", "value": 10}]
    tbl = derive_schedule_table(doc, "sch-1")
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["r-large"]
    assert (tbl.get("scheduleEngine") or {}).get("filterRules") == [
        {"field": "areaM2", "op": "gt", "value": 10.0},
    ]
