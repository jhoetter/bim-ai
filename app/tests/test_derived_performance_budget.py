"""Regression guardrails for derived server views (WP-P01 measuring hooks)."""

from __future__ import annotations

import time

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, WallElem
from bim_ai.plan_projection_wire import plan_projection_wire_from_request
from bim_ai.schedule_derivation import derive_schedule_table


def _doc_many_walls(n_walls: int) -> Document:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    elems: dict[str, object] = {"lvl": lvl}
    for i in range(n_walls):
        y_mm = float(i * 4100)
        elems[f"w{i}"] = WallElem(
            kind="wall",
            id=f"w{i}",
            name="W",
            levelId="lvl",
            start={"xMm": 0, "yMm": y_mm},
            end={"xMm": 2600, "yMm": y_mm},
            thicknessMm=200,
            heightMm=2800,
        )

    sch = ScheduleElem(
        kind="schedule",
        id="sch-door",
        name="Door table",
        filters={"category": "door"},
    )
    elems["sch-door"] = sch
    return Document(revision=1, elements=elems)


def _doc_many_rooms(n_rooms: int) -> Document:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    elems: dict[str, object] = {"lvl": lvl}
    grid = max(2, int(n_rooms**0.5) + 1)
    stride = 5500
    for i in range(n_rooms):
        gx = i % grid
        gy = i // grid
        x0 = gx * stride
        y0 = gy * stride
        rid = f"r{i}"
        elems[rid] = RoomElem(
            kind="room",
            id=rid,
            name=f"Rm{i}",
            levelId="lvl",
            outlineMm=[
                {"xMm": x0, "yMm": y0},
                {"xMm": x0 + 4000, "yMm": y0},
                {"xMm": x0 + 4000, "yMm": y0 + 4000},
                {"xMm": x0, "yMm": y0 + 4000},
            ],
        )
    elems["sch-rooms"] = ScheduleElem(
        kind="schedule",
        id="sch-rooms",
        name="Rooms",
        filters={"category": "room"},
    )
    return Document(revision=1, elements=elems)


def test_plan_projection_wire_budget_1200_walls_under_two_seconds() -> None:
    doc = _doc_many_walls(1200)

    start = time.perf_counter()

    wire = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")

    elapsed = time.perf_counter() - start

    assert wire["format"] == "planProjectionWire_v1"
    assert wire["countsByVisibleKind"]["wall"] == 1200
    assert elapsed < 2.8


def test_room_schedule_derivation_budget_900_rooms_under_two_seconds() -> None:
    doc = _doc_many_rooms(900)

    start = time.perf_counter()

    table = derive_schedule_table(doc, "sch-rooms")

    elapsed = time.perf_counter() - start

    assert table["totalRows"] == 900
    assert elapsed < 2.8
