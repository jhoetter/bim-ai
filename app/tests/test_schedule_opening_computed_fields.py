"""Door/window computed schedule columns and CSV export (prompt-2)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, ScheduleElem, WallElem, WindowElem
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table


def test_door_schedule_rough_opening_from_host_wall_height() -> None:
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
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Dr", filters={"category": "door"}),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert row["hostHeightMm"] == 2800
    assert row["roughOpeningAreaM2"] == 2.52
    assert tbl["totals"]["roughOpeningAreaM2"] == 2.52


def test_window_schedule_opening_area_aspect_head_height() -> None:
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
            "w1": WindowElem(
                kind="window",
                id="w1",
                name="W1",
                wallId="wa",
                alongT=0.3,
                widthMm=1200,
                heightMm=1500,
                sillHeightMm=900,
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Win", filters={"category": "window"}),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert row["openingAreaM2"] == 1.8
    assert row["aspectRatio"] == 0.8
    assert row["headHeightMm"] == 2400.0
    assert tbl["totals"]["totalOpeningAreaM2"] == 1.8


def test_window_schedule_csv_subset_includes_computed_columns() -> None:
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
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wa2": WindowElem(
                kind="window",
                id="wa2",
                name="Small",
                wallId="wa",
                alongT=0.2,
                widthMm=600,
                heightMm=900,
            ),
            "wb2": WindowElem(
                kind="window",
                id="wb2",
                name="Wide",
                wallId="wa",
                alongT=0.7,
                widthMm=1200,
                heightMm=900,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Win",
                filters={"category": "window", "sortBy": "openingAreaM2"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    ids = [r["elementId"] for r in tbl["rows"]]
    assert ids == ["wa2", "wb2"]

    want = ["elementId", "openingAreaM2", "headHeightMm"]
    sub = schedule_payload_with_column_subset(tbl, want)
    csv_txt = schedule_payload_to_csv(sub)
    lines = csv_txt.strip().splitlines()
    assert lines[0] == "elementId,openingAreaM2,headHeightMm"
    assert "0.54" in lines[1] or "0.540000" in lines[1]
    assert "1.08" in lines[2] or "1.080000" in lines[2]
