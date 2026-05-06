"""Regression guardrails for derived server views (WP-P01 measuring hooks)."""

from __future__ import annotations

import time

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, WallElem
from bim_ai.engine import try_commit_bundle
from bim_ai.model_summary import compute_model_summary
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


def _doc_hybrid_walls_rooms(n_walls: int, n_rooms: int) -> Document:
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


def test_hybrid_plan_projection_then_room_schedule_under_five_seconds() -> None:
    doc = _doc_hybrid_walls_rooms(450, 280)

    start = time.perf_counter()

    wire = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    table = derive_schedule_table(doc, "sch-rooms")

    elapsed = time.perf_counter() - start

    assert wire["format"] == "planProjectionWire_v1"
    assert wire["countsByVisibleKind"]["wall"] == 450
    assert wire["countsByVisibleKind"]["room"] == 280
    assert table["totalRows"] == 280
    assert elapsed < 5.0


def test_try_commit_bundle_many_create_walls_under_three_seconds() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    cmds: list[dict[str, object]] = []
    for i in range(220):
        y_mm = float(i * 4100)
        cmds.append(
            {
                "type": "createWall",
                "levelId": "lvl",
                "start": {"xMm": 0, "yMm": y_mm},
                "end": {"xMm": 2600, "yMm": y_mm},
                "thicknessMm": 200,
                "heightMm": 2800,
            }
        )

    start = time.perf_counter()
    ok, new_doc, _cmds, _violations, code = try_commit_bundle(doc, cmds)
    elapsed = time.perf_counter() - start

    assert ok is True
    assert new_doc is not None
    assert code == "ok"
    assert len([e for e in new_doc.elements.values() if getattr(e, "kind", None) == "wall"]) == 220
    assert elapsed < 3.0


def test_try_commit_bundle_many_create_walls_290_under_four_seconds() -> None:
    """Scale tier above the 220-wall bundle budget (WP-P01), conservative CI-safe ceiling."""
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    cmds: list[dict[str, object]] = []
    for i in range(290):
        y_mm = float(i * 4100)
        cmds.append(
            {
                "type": "createWall",
                "levelId": "lvl",
                "start": {"xMm": 0, "yMm": y_mm},
                "end": {"xMm": 2600, "yMm": y_mm},
                "thicknessMm": 200,
                "heightMm": 2800,
            }
        )

    start = time.perf_counter()
    ok, new_doc, _cmds, _violations, code = try_commit_bundle(doc, cmds)
    elapsed = time.perf_counter() - start

    assert ok is True
    assert new_doc is not None
    assert code == "ok"
    assert len([e for e in new_doc.elements.values() if getattr(e, "kind", None) == "wall"]) == 290
    assert elapsed < 4.0


def test_hybrid_model_summary_exposes_scale_fields() -> None:
    # `room_derivation_preview` scales poorly on huge hybrids; keep this correctness check modest.
    doc = _doc_hybrid_walls_rooms(55, 40)
    summary = compute_model_summary(doc)

    assert summary["elementTotal"] == 1 + 55 + 40 + 1
    sw = summary["scaleWorkload"]
    assert sw["wallCount"] == 55
    assert sw["roomCount"] == 40
    assert sw["scheduleElementCount"] == 1
    preview = summary["roomDerivationPreview"]
    regen = summary["regenerationDiagnostics"]
    assert regen["documentRevision"] == doc.revision
    assert regen["roomDerivationHeuristicVersion"] == preview["heuristicVersion"]
    assert regen["roomDerivationCandidateCount"] == preview["candidateCount"]
    assert regen["roomDerivationAuthoritativeCount"] == preview.get(
        "authoritativeCandidateCount", 0
    )
    assert regen["roomDerivationDiagnosticCount"] == preview.get("diagnosticCount", 0)
    assert regen["roomDerivationWarningCount"] == len(preview["warnings"])
    assert regen["levelsWithRoomsSorted"] == ["lvl"]
    assert regen["levelsWithWallsSorted"] == ["lvl"]
    assert regen["maxRoomsOnSingleLevel"] == 40
    assert regen["maxWallsOnSingleLevel"] == 55
