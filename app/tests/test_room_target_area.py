"""Room target programme area: commands, property updates, schedule columns."""

from __future__ import annotations

import pytest

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import (
    AreaElem,
    LevelElem,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    Vec2Mm,
    WallElem,
)
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


def test_update_element_property_room_fill_override_hex_roundtrip() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="R",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (2000.0, 0.0), (2000.0, 1000.0), (0.0, 1000.0))),
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-1": rm})
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="rm-1", key="roomFillOverrideHex", value="#ABCDEF"),
    )
    r = doc.elements["rm-1"]
    assert isinstance(r, RoomElem)
    assert r.room_fill_override_hex == "#abcdef"
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="rm-1", key="roomFillOverrideHex", value="")
    )
    r2 = doc.elements["rm-1"]
    assert isinstance(r2, RoomElem)
    assert r2.room_fill_override_hex is None


def test_update_element_property_room_fill_pattern_override_validates() -> None:
    lv = LevelElem(kind="level", id="lv", name="L1", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="R",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (2000.0, 0.0), (2000.0, 1000.0), (0.0, 1000.0))),
    )
    doc = Document(revision=1, elements={"lv": lv, "rm-1": rm})
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="rm-1", key="roomFillPatternOverride", value="crosshatch"
        ),
    )
    r = doc.elements["rm-1"]
    assert isinstance(r, RoomElem)
    assert r.room_fill_pattern_override == "crosshatch"
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="rm-1", key="roomFillPatternOverride", value="")
    )
    r2 = doc.elements["rm-1"]
    assert isinstance(r2, RoomElem)
    assert r2.room_fill_pattern_override is None

    with pytest.raises(ValueError, match="roomFillPatternOverride"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(
                elementId="rm-1", key="roomFillPatternOverride", value="diagonal"
            ),
        )


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


def test_create_area_accepts_arbitrary_closed_loop_with_scheme_and_computed_area() -> None:
    from bim_ai.engine import try_commit

    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevation_mm=0)
    doc = Document(revision=1, elements={"lvl-1": lvl})
    ok, new_doc, _, _, code = try_commit(
        doc,
        {
            "type": "createArea",
            "id": "area-l",
            "name": "L Area",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 1000},
                {"xMm": 1500, "yMm": 1000},
                {"xMm": 1500, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
            "ruleSet": "net",
            "areaScheme": "rentable",
            "applyAreaRules": True,
        },
    )
    assert ok is True and code == "ok"
    area = new_doc.elements["area-l"]
    assert isinstance(area, AreaElem)
    assert area.area_scheme == "rentable"
    assert area.rule_set == "net"
    assert area.computed_area_sq_mm == pytest.approx(7_000_000.0)


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


def test_derive_room_schedule_includes_room_programme_closure_v0_when_no_room_rows() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevation_mm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    sch = ScheduleElem(kind="schedule", id="sch-room", name="Rooms", filters={"category": "room"})
    doc = Document(revision=2, elements={"lvl-1": lvl, **{w.id: w for w in walls}, "sch-room": sch})
    table = derive_schedule_table(doc, "sch-room")
    assert table.get("rows") == []
    closure = table.get("roomProgrammeClosure_v0")
    assert isinstance(closure, dict)
    assert closure.get("authoritativeVacantDerivedAreaM2") == pytest.approx(16.0, rel=1e-2)
    assert closure.get("authoritativeVacantFootprintCount") == 1
    assert closure.get("previewHeuristicVacantDerivedAreaM2") == pytest.approx(0.0, abs=1e-4)
    assert closure.get("previewHeuristicVacantFootprintCount") == 0
    assert closure.get("authoritativeVacantClosureComplete") is True
    assert closure.get("nonAuthoritativeReasonCodes") == []
    axis = closure.get("roomSeparationAxisSummary_v0") or {}
    assert axis.get("format") == "roomSeparationAxisSummary_v0"
    assert axis.get("totalCount") == 0
    assert axis.get("axisAlignedEligibleCount") == 0


def test_derive_room_schedule_closure_includes_room_separation_axis_summary() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevation_mm=0)
    sep = RoomSeparationElem(
        kind="room_separation",
        id="rs-1",
        name="S",
        levelId="lvl-1",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 2000.0, "yMm": 0.0},
    )
    sch = ScheduleElem(kind="schedule", id="sch-room", name="Rooms", filters={"category": "room"})
    doc = Document(revision=1, elements={"lvl-1": lvl, "rs-1": sep, "sch-room": sch})
    table = derive_schedule_table(doc, "sch-room")
    closure = table.get("roomProgrammeClosure_v0") or {}
    axis = closure.get("roomSeparationAxisSummary_v0") or {}
    assert axis.get("format") == "roomSeparationAxisSummary_v0"
    assert axis.get("totalCount") == 1
    assert axis.get("axisAlignedEligibleCount") == 1
    assert axis.get("nonAxisAlignedOrShortCount") == 0


def test_derive_room_schedule_programme_residual_without_vacant_footprint() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Lab",
        level_id="lvl-1",
        outline_mm=_sq(((0.0, 0.0), (4000.0, 0.0), (4000.0, 4000.0), (0.0, 4000.0))),
        target_area_m2=22.5,
    )
    sch = ScheduleElem(kind="schedule", id="sch-room", name="Rooms", filters={"category": "room"})
    doc = Document(revision=2, elements={"lvl-1": lvl, "rm-1": rm, "sch-room": sch})
    table = derive_schedule_table(doc, "sch-room")
    closure = table.get("roomProgrammeClosure_v0")
    totals = table.get("totals")
    assert totals and totals.get("targetAreaM2") == pytest.approx(22.5, rel=1e-3)
    assert totals.get("areaM2") == pytest.approx(16.0, rel=1e-2)
    assert closure.get("authoritativeVacantDerivedAreaM2") == pytest.approx(0.0, abs=1e-4)
    assert closure.get("programmeScheduleResidualM2") == pytest.approx(6.5, rel=1e-2)
    assert closure.get("previewHeuristicVacantDerivedAreaM2") == pytest.approx(0.0, abs=1e-4)
    assert closure.get("previewHeuristicVacantFootprintCount") == 0
    assert closure.get("authoritativeVacantClosureComplete") is True
    assert closure.get("nonAuthoritativeReasonCodes") == []


def test_derive_room_schedule_closure_flags_preview_derived_when_walls_conflict_with_room() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevation_mm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Lab",
        level_id="lvl-1",
        outline_mm=_sq(((0.0, 0.0), (4000.0, 0.0), (4000.0, 4000.0), (0.0, 4000.0))),
        target_area_m2=22.5,
    )
    sch = ScheduleElem(kind="schedule", id="sch-room", name="Rooms", filters={"category": "room"})
    doc = Document(
        revision=2,
        elements={"lvl-1": lvl, **{w.id: w for w in walls}, "rm-1": rm, "sch-room": sch},
    )
    closure = derive_schedule_table(doc, "sch-room").get("roomProgrammeClosure_v0") or {}
    assert closure.get("previewHeuristicVacantDerivedAreaM2") == pytest.approx(16.0, rel=1e-2)
    assert closure.get("authoritativeVacantClosureComplete") is False
    nar = closure.get("nonAuthoritativeReasonCodes") or []
    assert "preview_heuristic_vacant_footprints_not_in_closure_totals" in nar
    assert "authoritative_vacant_unavailable_but_preview_present" in nar
