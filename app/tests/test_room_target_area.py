"""Room target programme area: commands, property updates, schedule columns."""

from __future__ import annotations

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, Vec2Mm
from bim_ai.engine import apply_inplace
from bim_ai.schedule_derivation import derive_schedule_table


def _sq(outline_mm: tuple[tuple[float, float], ...]) -> list[Vec2Mm]:
    return [Vec2Mm(x_mm=a, y_mm=b) for a, b in outline_mm]


def test_update_element_property_room_target_area_m2_roundtrip() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="R",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (2000.0, 0.0), (2000.0, 1000.0), (0.0, 1000.0))),
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-1": rm})
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="rm-1", key="targetAreaM2", value="12.5"))
    r = doc.elements["rm-1"]
    assert isinstance(r, RoomElem)
    assert r.target_area_m2 == 12.5
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="rm-1", key="targetAreaM2", value=""))
    r2 = doc.elements["rm-1"]
    assert isinstance(r2, RoomElem)
    assert r2.target_area_m2 is None


def test_create_room_rectangle_with_target_area_m2() -> None:
    from bim_ai.engine import try_commit

    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevation_mm=0)
    doc = Document(revision=1, elements={"lvl-1": lvl})
    ok, new_doc, _, _, code = try_commit(
        doc,
        {
            "type": "createRoomRectangle",
            "levelId": "lvl-1",
            "origin": {"xMm": 0, "yMm": 0},
            "widthMm": 5000,
            "depthMm": 4000,
            "targetAreaM2": 19.5,
        },
    )
    assert ok is True and code == "ok"
    rooms = [e for e in new_doc.elements.values() if isinstance(e, RoomElem)]
    assert len(rooms) == 1
    assert rooms[0].target_area_m2 == 19.5


def test_derive_room_schedule_includes_target_and_delta() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Lab",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (10000.0, 0.0), (10000.0, 2000.0), (0.0, 2000.0))),
        programme_code="L1",
        finish_set="A",
        target_area_m2=10.0,
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-room",
        name="Rooms",
        filters={"category": "room"},
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-1": rm, "sch-room": sch})
    table = derive_schedule_table(doc, "sch-room")
    rows = table.get("rows")
    assert isinstance(rows, list) and len(rows) == 1
    row = rows[0]
    assert row.get("targetAreaM2") == 10.0
    assert row.get("areaDeltaM2") == 10.0
    totals = table.get("totals")
    assert isinstance(totals, dict)
    assert totals.get("targetAreaM2") == 10.0


def test_room_finish_metadata_hint_when_programme_but_no_finish() -> None:
    from bim_ai.constraints import evaluate

    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="R",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (5000.0, 0.0), (5000.0, 4000.0), (0.0, 4000.0))),
        programme_code="P1",
        finish_set=None,
    )
    doc = {"lv": lv, "rm-1": rm}
    vs = evaluate(doc)
    hits = [v for v in vs if getattr(v, "rule_id", None) == "room_finish_metadata_hint"]
    assert len(hits) == 1
    assert "rm-1" in (getattr(hits[0], "element_ids", []) or [])


def test_room_target_area_mismatch_advisory() -> None:
    from bim_ai.constraints import evaluate

    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    # 20 m * 1 m = 20 m² outline; target 10 → delta 10 > max(0.25, 0.5)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="R",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (20000.0, 0.0), (20000.0, 1000.0), (0.0, 1000.0))),
        target_area_m2=10.0,
    )
    doc = {"lv": lv, "rm-1": rm}
    vs = evaluate(doc)
    hits = [v for v in vs if getattr(v, "rule_id", None) == "room_target_area_mismatch"]
    assert len(hits) == 1
