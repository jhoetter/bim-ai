"""Room finish schedule evidence + legend correlation (prompt-5.md)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, Vec2Mm
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.sheet_preview_svg import plan_room_programme_legend_hints_v0


def _sq(outline_mm: tuple[tuple[float, float], ...]) -> list[Vec2Mm]:
    return [Vec2Mm(x_mm=a, y_mm=b) for a, b in outline_mm]


def test_room_finish_schedule_complete_row_and_evidence() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Lab",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (5000.0, 0.0), (5000.0, 4000.0), (0.0, 4000.0))),
        programme_code="L1",
        finish_set="Paint-A",
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-room",
        name="Rooms",
        filters={"category": "room"},
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-1": rm, "sch-room": sch})
    table = derive_schedule_table(doc, "sch-room")
    row = table["rows"][0]
    assert row["finishState"] == "complete"
    assert row["legendLabel"] == "L1"
    assert row["levelPeerFinishSet"] == "Paint-A"
    assert "peerSuggestedFinishSet" not in row

    ev = table.get("roomFinishScheduleEvidence_v1") or {}
    assert ev.get("format") == "roomFinishScheduleEvidence_v1"
    assert ev.get("order") == "elementId"
    assert isinstance(ev.get("rowDigestSha256"), str) and len(ev["rowDigestSha256"]) == 64
    assert ev["summary"] == {
        "complete": 1,
        "not_required": 0,
        "missing": 0,
        "peer_suggested": 0,
    }
    assert ev["rows"][0]["finishState"] == "complete"
    assert ev["rows"][0]["roomNumber"] == ""

    totals = table.get("totals") or {}
    assert totals.get("finishCompleteCount") == 1
    assert totals.get("finishMissingCount") == 0
    assert totals.get("finishPeerSuggestedCount") == 0
    assert totals.get("finishNotRequiredCount") == 0


def test_room_finish_schedule_peer_suggested_and_missing() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm_a = RoomElem(
        kind="room",
        id="rm-a",
        name="A",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (3000.0, 0.0), (3000.0, 2000.0), (0.0, 2000.0))),
        programme_code="A1",
        finish_set=None,
    )
    rm_b = RoomElem(
        kind="room",
        id="rm-b",
        name="B",
        level_id="lv",
        outline_mm=_sq(((3100.0, 0.0), (5000.0, 0.0), (5000.0, 2000.0), (3100.0, 2000.0))),
        programme_code="B1",
        finish_set="StdPaint",
    )
    rm_c = RoomElem(
        kind="room",
        id="rm-c",
        name="C",
        level_id="lv",
        outline_mm=_sq(((0.0, 2500.0), (3000.0, 2500.0), (3000.0, 4500.0), (0.0, 4500.0))),
        programme_code="C1",
        finish_set=None,
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-r",
        name="Rooms",
        filters={"category": "room"},
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-a": rm_a, "rm-b": rm_b, "rm-c": rm_c, "sch-r": sch})
    table = derive_schedule_table(doc, "sch-r")
    by_id = {r["elementId"]: r for r in table["rows"]}
    assert by_id["rm-a"]["finishState"] == "peer_suggested"
    assert by_id["rm-a"]["peerSuggestedFinishSet"] == "StdPaint"
    assert by_id["rm-b"]["finishState"] == "complete"
    assert by_id["rm-c"]["finishState"] == "peer_suggested"
    assert by_id["rm-c"]["peerSuggestedFinishSet"] == "StdPaint"

    ev = table["roomFinishScheduleEvidence_v1"]
    assert ev["summary"]["peer_suggested"] == 2
    assert ev["summary"]["missing"] == 0
    assert ev["summary"]["complete"] == 1

    totals = table["totals"]
    assert totals["finishPeerSuggestedCount"] == 2
    assert totals["finishMissingCount"] == 0
    assert totals["finishCompleteCount"] == 1


def test_room_finish_schedule_missing_when_no_level_peer() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm_x = RoomElem(
        kind="room",
        id="rm-x",
        name="X",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (3000.0, 0.0), (3000.0, 2000.0), (0.0, 2000.0))),
        programme_code="PX",
        finish_set=None,
    )
    rm_y = RoomElem(
        kind="room",
        id="rm-y",
        name="Y",
        level_id="lv",
        outline_mm=_sq(((3100.0, 0.0), (5000.0, 0.0), (5000.0, 2000.0), (3100.0, 2000.0))),
        programme_code="PY",
        finish_set=None,
    )
    sch = ScheduleElem(kind="schedule", id="sch-m", name="Rooms", filters={"category": "room"})
    doc = Document(revision=1, elements={"lv": lv, "rm-x": rm_x, "rm-y": rm_y, "sch-m": sch})
    table = derive_schedule_table(doc, "sch-m")
    by_id = {r["elementId"]: r for r in table["rows"]}
    assert by_id["rm-x"]["finishState"] == "missing"
    assert by_id["rm-y"]["finishState"] == "missing"
    assert table["roomFinishScheduleEvidence_v1"]["summary"]["missing"] == 2


def test_room_finish_schedule_grouped_department_totals() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    r1 = RoomElem(
        kind="room",
        id="r-east",
        name="E1",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (4000.0, 0.0), (4000.0, 3000.0), (0.0, 3000.0))),
        department="East",
        programme_code="P1",
        finish_set="F1",
    )
    r2 = RoomElem(
        kind="room",
        id="r-west",
        name="W1",
        level_id="lv",
        outline_mm=_sq(((5000.0, 0.0), (9000.0, 0.0), (9000.0, 3000.0), (5000.0, 3000.0))),
        department="West",
        programme_code="P2",
        finish_set=None,
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-g",
        name="Rooms",
        filters={"category": "room", "groupingHint": ["department"]},
        grouping={"groupKeys": ["department"], "sortBy": "name"},
    )
    doc = Document(revision=1, elements={"lv": lv, "r-east": r1, "r-west": r2, "sch-g": sch})
    table = derive_schedule_table(doc, "sch-g")
    assert "groupedSections" in table
    totals = table["totals"]
    assert totals["rowCount"] == 2
    assert totals["finishCompleteCount"] == 1
    assert totals["finishPeerSuggestedCount"] == 1
    assert totals["finishMissingCount"] == 0


def test_room_finish_schedule_not_required_without_programme() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-x",
        name="Unlabeled",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (4000.0, 0.0), (4000.0, 3000.0), (0.0, 3000.0))),
        programme_code=None,
        department=None,
        finish_set=None,
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-z",
        name="Rooms",
        filters={"category": "room"},
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-x": rm, "sch-z": sch})
    table = derive_schedule_table(doc, "sch-z")
    assert table["rows"][0]["finishState"] == "not_required"
    assert table["rows"][0]["legendLabel"] == "Unlabeled"
    assert table["roomFinishScheduleEvidence_v1"]["summary"]["not_required"] == 1


def test_plan_room_legend_hints_finish_correlation_shape() -> None:
    from bim_ai.commands import (
        CreateLevelCmd,
        CreateRoomRectangleCmd,
        UpsertPlanViewCmd,
        UpsertSheetCmd,
        UpsertSheetViewportsCmd,
    )
    from bim_ai.engine import apply_inplace

    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-lab",
            name="Lab",
            levelId="lvl",
            origin={"xMm": 0, "yMm": 0},
            widthMm=3000,
            depthMm=3000,
            programmeCode="LAB",
        ),
    )
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-off",
            name="Office",
            levelId="lvl",
            origin={"xMm": 4000, "yMm": 0},
            widthMm=3000,
            depthMm=3000,
            programmeCode="OFF",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id="pv-1",
            name="Floor plan",
            levelId="lvl",
            planPresentation="room_scheme",
        ),
    )
    apply_inplace(doc, UpsertSheetCmd(id="sh-1", name="A101"))
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="sh-1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "label": "Plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 100,
                    "yMm": 200,
                    "widthMm": 5000,
                    "heightMm": 4000,
                },
            ],
        ),
    )
    sh = doc.elements["sh-1"]
    hints = plan_room_programme_legend_hints_v0(doc, list(sh.viewports_mm or []))
    h0 = hints[0]
    corr = h0.get("roomFinishLegendCorrelation_v1") or {}
    assert corr.get("format") == "roomFinishLegendCorrelation_v1"
    assert isinstance(corr.get("correlationDigestSha256"), str) and len(corr["correlationDigestSha256"]) == 64
    by_lab = {x["label"]: x for x in (corr.get("byLegendLabel") or [])}
    assert by_lab["LAB"]["roomCount"] == 1
    assert by_lab["LAB"]["missingFinishCount"] == 1
    assert by_lab["OFF"]["roomCount"] == 1
    assert by_lab["OFF"]["missingFinishCount"] == 1
