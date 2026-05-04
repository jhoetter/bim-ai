"""Row-level ``filterEquals`` on derived schedules (prompt-3 / WP-D01)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, RoomElem, ScheduleElem, WallElem
from bim_ai.schedule_csv import schedule_payload_to_csv
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


def test_schedule_filter_rules_gt_width_mm_on_doors() -> None:
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
            "d0": DoorElem(
                kind="door",
                id="d0",
                name="Narrow",
                wallId="wa",
                alongT=0.1,
                widthMm=800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="Wide",
                wallId="wa",
                alongT=0.5,
                widthMm=1100,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={
                    "category": "door",
                    "filterRules": [{"field": "widthMm", "op": "gt", "value": 900}],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    rows = tbl.get("rows") or []
    assert len(rows) == 1
    assert rows[0].get("elementId") == "d1"
    assert tbl.get("totals", {}).get("roughOpeningAreaM2") == rows[0]["roughOpeningAreaM2"]
    eng = tbl.get("scheduleEngine") or {}
    assert eng.get("filterRules") == [{"field": "widthMm", "op": "gt", "value": 900.0}]
    csv = schedule_payload_to_csv(tbl, include_totals_csv=True)
    assert csv.count("\n") >= 2
    assert "d1" in csv


def test_schedule_filter_rules_area_m2_on_rooms_grouped_totals_and_csv() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),
            "r-small": RoomElem(
                kind="room",
                id="r-small",
                name="Small",
                levelId="lv",
                department="Dept A",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
            "r-mid": RoomElem(
                kind="room",
                id="r-mid",
                name="Mid",
                levelId="lv",
                department="Dept A",
                targetAreaM2=14.0,
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            ),
            "r-large": RoomElem(
                kind="room",
                id="r-large",
                name="Large",
                levelId="lv",
                department="Dept B",
                targetAreaM2=24.0,
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Rooms",
                filters={
                    "category": "room",
                    "groupingHint": ["department"],
                    "sortBy": "areaM2",
                    "filterRules": [
                        {"field": "areaM2", "op": "gt", "value": 10},
                        {"field": "areaM2", "op": "lt", "value": 30},
                    ],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    grouped = tbl.get("groupedSections")
    assert isinstance(grouped, dict)
    assert list(grouped.keys()) == ["Dept A", "Dept B"]
    assert [r["elementId"] for rows in grouped.values() for r in rows] == ["r-mid", "r-large"]
    assert tbl["totalRows"] == 2
    assert tbl["totals"]["areaM2"] == 37.0
    assert tbl["totals"]["targetAreaM2"] == 38.0
    assert tbl["scheduleEngine"]["filterRules"] == [
        {"field": "areaM2", "op": "gt", "value": 10.0},
        {"field": "areaM2", "op": "lt", "value": 30.0},
    ]

    csv = schedule_payload_to_csv(tbl, include_totals_csv=True)
    assert csv.splitlines()[0].startswith("Group,")
    assert "r-mid" in csv
    assert "r-large" in csv
    assert "r-small" not in csv
    assert "__schedule_totals_v1__" in csv
    assert ",areaM2,37" in csv


def test_schedule_filter_rules_lt_width_mm_on_doors() -> None:
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
            "d0": DoorElem(
                kind="door",
                id="d0",
                name="Narrow",
                wallId="wa",
                alongT=0.1,
                widthMm=800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="Wide",
                wallId="wa",
                alongT=0.5,
                widthMm=1100,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={
                    "category": "door",
                    "filterRules": [{"field": "widthMm", "op": "lt", "value": 1000}],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    rows = tbl.get("rows") or []
    assert len(rows) == 1
    assert rows[0].get("elementId") == "d0"
    eng = tbl.get("scheduleEngine") or {}
    assert eng.get("filterRules") == [{"field": "widthMm", "op": "lt", "value": 1000.0}]


def test_schedule_filter_rules_gt_lt_band_width_mm_on_doors() -> None:
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
            "d0": DoorElem(
                kind="door",
                id="d0",
                name="Low",
                wallId="wa",
                alongT=0.05,
                widthMm=800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="Mid",
                wallId="wa",
                alongT=0.35,
                widthMm=900,
            ),
            "d2": DoorElem(
                kind="door",
                id="d2",
                name="High",
                wallId="wa",
                alongT=0.65,
                widthMm=1100,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={
                    "category": "door",
                    "filterRules": [
                        {"field": "widthMm", "op": "lt", "value": 1000},
                        {"field": "widthMm", "op": "gt", "value": 850},
                    ],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    rows = tbl.get("rows") or []
    assert len(rows) == 1
    assert rows[0].get("elementId") == "d1"
    eng = tbl.get("scheduleEngine") or {}
    assert eng.get("filterRules") == [
        {"field": "widthMm", "op": "gt", "value": 850.0},
        {"field": "widthMm", "op": "lt", "value": 1000.0},
    ]


def test_schedule_filter_rules_lt_ignores_non_numeric_row_values() -> None:
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
            "d0": DoorElem(
                kind="door",
                id="d0",
                name="A",
                wallId="wa",
                alongT=0.1,
                widthMm=1200,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="B",
                wallId="wa",
                alongT=0.5,
                widthMm=1300,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={
                    "category": "door",
                    "filter_rules": [{"field": "name", "op": "lt", "value": 0}],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    assert tbl.get("rows") == []


def test_schedule_filter_rules_gt_ignores_non_numeric_row_values() -> None:
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
            "d0": DoorElem(
                kind="door",
                id="d0",
                name="A",
                wallId="wa",
                alongT=0.1,
                widthMm=1200,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="B",
                wallId="wa",
                alongT=0.5,
                widthMm=1300,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={
                    "category": "door",
                    "filter_rules": [{"field": "name", "op": "gt", "value": 0}],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    assert tbl.get("rows") == []


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
