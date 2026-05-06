"""Tests for derived schedule payloads including pagination / placement evidence (Prompt 6)."""

from __future__ import annotations

import csv
import io

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, SheetElem, StairElem
from bim_ai.schedule_csv import schedule_payload_to_csv
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.schedule_pagination_placement_evidence import (
    ADV_MULTI_SEGMENT,
    ADV_UNPLACED,
    ADV_VIEWPORT_MISSING,
)


def test_schedule_pagination_evidence_unplaced() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "rm-1": RoomElem(
                kind="room",
                id="rm-1",
                name="A",
                levelId="lvl",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Rooms",
                filters={"category": "room"},
            ),
        },
    )
    out = derive_schedule_table(doc, "sch-1")
    ev = out.get("schedulePaginationPlacementEvidence_v0") or {}
    assert ev.get("format") == "schedulePaginationPlacementEvidence_v0"
    assert ev.get("placementStatus") == "unplaced"
    assert ev.get("clipStatus") == "unknown"
    assert ev.get("sheetViewportId") is None
    assert ADV_UNPLACED in (ev.get("advisoryReasonCodes") or [])
    assert int(ev.get("totalRows") or 0) == 1
    assert ev.get("segmentCount") == 1
    segs = ev.get("segments") or []
    assert len(segs) == 1
    assert segs[0]["firstRowKey"] == "rm-1"
    assert segs[0]["lastRowKey"] == "rm-1"


def test_schedule_pagination_evidence_placed_one_segment() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "rm-1": RoomElem(
                kind="room",
                id="rm-1",
                name="A",
                levelId="lvl",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
            "sh-1": SheetElem(
                kind="sheet",
                id="sh-1",
                name="S1",
                viewportsMm=[
                    {
                        "viewportId": "vp-sch",
                        "viewRef": "schedule:sch-1",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 5000,
                        "heightMm": 8000,
                    },
                ],
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Rooms",
                sheetId="sh-1",
                filters={"category": "room"},
            ),
        },
    )
    out = derive_schedule_table(doc, "sch-1")
    ev = out.get("schedulePaginationPlacementEvidence_v0") or {}
    assert ev.get("placementStatus") == "placed"
    assert ev.get("sheetViewportId") == "vp-sch"
    assert ev.get("clipStatus") == "fits"
    assert ev.get("segmentCount") == 1
    assert ADV_VIEWPORT_MISSING not in (ev.get("advisoryReasonCodes") or [])
    assert ADV_MULTI_SEGMENT not in (ev.get("advisoryReasonCodes") or [])


def test_schedule_pagination_evidence_overflow_multi_segment() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    elems: dict[str, object] = {"lvl": lvl}
    for i in range(25):
        rid = f"z{i:02d}"
        elems[rid] = RoomElem(
            kind="room",
            id=rid,
            name=f"R{i}",
            levelId="lvl",
            outlineMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 2000, "yMm": 0},
                {"xMm": 2000, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
        )
    elems["sh-1"] = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-sch",
                "viewRef": "schedule:sch-1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 5000,
                "heightMm": 50,
            },
        ],
    )
    elems["sch-1"] = ScheduleElem(
        kind="schedule",
        id="sch-1",
        name="Rooms",
        sheetId="sh-1",
        filters={"category": "room", "sortBy": "elementId"},
    )
    doc = Document(revision=1, elements=elems)  # type: ignore[arg-type]
    out = derive_schedule_table(doc, "sch-1")
    ev = out.get("schedulePaginationPlacementEvidence_v0") or {}
    assert int(ev.get("totalRows") or 0) == 25
    assert int(ev.get("segmentCount") or 0) > 1
    assert ev.get("clipStatus") == "multi_segment"
    assert ADV_MULTI_SEGMENT in (ev.get("advisoryReasonCodes") or [])
    codes_sorted = [str(x) for x in (ev.get("advisoryReasonCodes") or [])]
    assert codes_sorted == sorted(set(codes_sorted))
    segs = ev.get("segments") or []
    assert len(segs) == int(ev.get("segmentCount") or 0)
    # elementId order matches zero-padded ids when sortBy=elementId
    assert segs[0]["firstRowKey"] == "z00"
    assert segs[-1]["lastRowKey"] == "z24"


def test_schedule_pagination_evidence_csv_row_count_matches_total_rows() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    elems: dict[str, object] = {"lvl": lvl}
    for i in range(7):
        rid = f"rm-{i}"
        elems[rid] = RoomElem(
            kind="room",
            id=rid,
            name=f"N{i}",
            levelId="lvl",
            outlineMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 2000, "yMm": 0},
                {"xMm": 2000, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
        )
    elems["sch-rooms"] = ScheduleElem(
        kind="schedule",
        id="sch-rooms",
        name="R",
        filters={"category": "room"},
    )
    doc = Document(revision=1, elements=elems)  # type: ignore[arg-type]
    out = derive_schedule_table(doc, "sch-rooms")
    d1 = str((out.get("schedulePaginationPlacementEvidence_v0") or {}).get("digestSha256") or "")
    csv_body = schedule_payload_to_csv(out, include_totals_csv=False)
    buf = io.StringIO(csv_body)
    reader = csv.reader(buf)
    rows = list(reader)
    assert len(rows) >= 2
    body = rows[1:]
    keys_row = rows[0]
    if keys_row and keys_row[0] == "Group":
        data_rows = [r for r in body if len(r) > 1]
    else:
        data_rows = body
    assert len(data_rows) == int(out.get("totalRows") or 0)

    out2 = derive_schedule_table(doc, "sch-rooms")
    d2 = str((out2.get("schedulePaginationPlacementEvidence_v0") or {}).get("digestSha256") or "")
    assert d1 == d2


def test_stair_schedule_derives_quantities_and_correlation_token() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3200),
            "s1": StairElem(
                kind="stair",
                id="s1",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 5000, "yMm": 0},
                widthMm=1100,
                riserMm=160,
                treadMm=280,
            ),
            "sch-s": ScheduleElem(
                kind="schedule", id="sch-s", name="Stairs", filters={"category": "stair"}
            ),
        },
    )
    out = derive_schedule_table(doc, "sch-s")
    assert len(out["rows"]) == 1
    r = out["rows"][0]
    assert r["stairQuantityDerivationStatus"] == "complete"
    assert r["landingCount"] == 2
    assert str(r["stairScheduleCorrelationToken"]).startswith("stairSchCorr_v0|s1|")
    assert r["totalRiseMm"] == pytest.approx(3200.0)
    assert r["totalRunMm"] == pytest.approx(5000.0)
