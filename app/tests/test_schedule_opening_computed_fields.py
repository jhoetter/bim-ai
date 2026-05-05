"""Door/window computed schedule columns and CSV export (prompt-2)."""

from __future__ import annotations

import csv
from io import StringIO

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, ScheduleElem, WallElem, WallTypeElem, WindowElem
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
    assert row["roughOpeningWidthMm"] == 900
    assert row["roughOpeningHeightMm"] == 2800
    assert row["hostWallTypeId"] == ""
    assert row["hostWallTypeDisplay"] == ""
    assert row["roughOpeningAreaM2"] == 2.52
    assert tbl["totals"]["roughOpeningAreaM2"] == 2.52
    assert tbl["totals"]["sumRoughOpeningWidthMm"] == 900
    assert tbl["totals"]["sumRoughOpeningHeightMm"] == 2800


def test_door_schedule_rough_opening_includes_interior_reveal() -> None:
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
                revealInteriorMm=50,
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Dr", filters={"category": "door"}),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    want = (900.0 + 100.0) * 2800.0 / 1_000_000.0
    assert row["roughOpeningWidthMm"] == 1000
    assert row["roughOpeningHeightMm"] == 2800
    assert row["roughOpeningAreaM2"] == round(want, 6)
    assert tbl["totals"]["roughOpeningAreaM2"] == round(want, 6)


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
    assert row["roughOpeningWidthMm"] == 1200
    assert row["roughOpeningHeightMm"] == 1500
    assert row["roughOpeningAreaM2"] == 1.8
    assert row["aspectRatio"] == 0.8
    assert row["headHeightMm"] == 2400.0
    assert tbl["totals"]["totalOpeningAreaM2"] == 1.8
    assert tbl["totals"]["roughOpeningAreaM2"] == 1.8
    assert tbl["totals"]["sumRoughOpeningWidthMm"] == 1200
    assert tbl["totals"]["sumRoughOpeningHeightMm"] == 1500


def test_window_schedule_rough_opening_includes_interior_reveal() -> None:
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
                revealInteriorMm=40,
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Win", filters={"category": "window"}),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    want_rough = (1200.0 + 80.0) * 1500.0 / 1_000_000.0
    assert row["openingAreaM2"] == 1.8
    assert row["roughOpeningAreaM2"] == round(want_rough, 6)
    assert tbl["totals"]["roughOpeningAreaM2"] == round(want_rough, 6)
    assert tbl["totals"]["totalOpeningAreaM2"] == 1.8
    assert row["roughOpeningWidthMm"] == 1280


def test_door_schedule_host_wall_type_labels_resolve_wall_type_element() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),
            "wt-x": WallTypeElem(kind="wall_type", id="wt-x", name="Partition 100"),
            "wa": WallElem(
                kind="wall",
                id="wa",
                name="W",
                levelId="lv",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=100,
                heightMm=2800,
                wallTypeId="wt-x",
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
    assert row["hostWallTypeId"] == "wt-x"
    assert row["hostWallTypeDisplay"] == "Partition 100"


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


def test_door_schedule_csv_totals_footer_includes_rough_opening() -> None:
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
    csv_txt = schedule_payload_to_csv(tbl, include_totals_csv=True)
    assert "__schedule_totals_v1__" in csv_txt
    assert "roughOpeningAreaM2" in csv_txt
    assert "kind" in csv_txt


def test_window_schedule_csv_totals_footer_sorted_metric_keys() -> None:
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
    csv_txt = schedule_payload_to_csv(tbl, include_totals_csv=True)
    lines = csv_txt.splitlines()
    start = next(i for i, ln in enumerate(lines) if "__schedule_totals_v1__" in ln)
    keys: list[str] = []
    for ln in lines[start + 2 :]:
        if not ln.strip():
            break
        row = next(csv.reader(StringIO(ln)))
        if len(row) >= 3 and row[1].strip():
            keys.append(row[1].strip())
    assert keys == sorted(keys)
