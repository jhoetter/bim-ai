"""VAL-01: topological room-enclosure check (room_unenclosed advisory).

Distinct from the centroid heuristic ``room_no_door`` rule: each polygon
edge must be backed by a continuous run of walls and/or room-separation
lines on the same level (within a tolerance proportional to wall
thickness). Rooms whose boundary has any uncovered edge emit a
``room_unenclosed`` advisory.
"""

from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.elements import LevelElem, RoomElem, RoomSeparationElem, WallElem


def _level() -> LevelElem:
    return LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0)


def _wall(wall_id: str, x0: float, y0: float, x1: float, y1: float, thk: float = 200.0) -> WallElem:
    return WallElem(
        kind="wall",
        id=wall_id,
        name="W",
        levelId="lvl-g",
        start={"xMm": x0, "yMm": y0},
        end={"xMm": x1, "yMm": y1},
        thicknessMm=thk,
        heightMm=2800,
    )


def _square_room(room_id: str = "rm-a", side_mm: float = 4000.0) -> RoomElem:
    return RoomElem(
        kind="room",
        id=room_id,
        name="Room",
        levelId="lvl-g",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": side_mm, "yMm": 0},
            {"xMm": side_mm, "yMm": side_mm},
            {"xMm": 0, "yMm": side_mm},
        ],
    )


def _enclosed_walls(side_mm: float = 4000.0) -> list[WallElem]:
    """Four walls forming a closed square around a centered room."""
    return [
        _wall("w-bottom", 0, 0, side_mm, 0),
        _wall("w-right", side_mm, 0, side_mm, side_mm),
        _wall("w-top", 0, side_mm, side_mm, side_mm),
        _wall("w-left", 0, 0, 0, side_mm),
    ]


def _viol_ids(viols, rule: str) -> set[str]:
    return {tuple(v.element_ids)[0] for v in viols if v.rule_id == rule and v.element_ids}


def test_fully_enclosed_room_emits_no_room_unenclosed_advisory() -> None:
    side = 4000.0
    elements: dict[str, object] = {"lvl-g": _level(), **{w.id: w for w in _enclosed_walls(side)}}
    elements["rm-a"] = _square_room("rm-a", side)
    viols = evaluate(elements)  # type: ignore[arg-type]
    assert "rm-a" not in _viol_ids(viols, "room_unenclosed"), [
        v.message for v in viols if v.rule_id == "room_unenclosed"
    ]


def test_room_with_missing_wall_emits_room_unenclosed_advisory() -> None:
    side = 4000.0
    elements: dict[str, object] = {"lvl-g": _level()}
    # Drop the top wall so the boundary has an uncovered edge.
    for w in _enclosed_walls(side):
        if w.id == "w-top":
            continue
        elements[w.id] = w
    elements["rm-a"] = _square_room("rm-a", side)
    viols = evaluate(elements)  # type: ignore[arg-type]
    advisories = [v for v in viols if v.rule_id == "room_unenclosed" and "rm-a" in v.element_ids]
    assert advisories, "expected room_unenclosed advisory for room with missing wall"


def test_room_with_separation_line_filling_gap_passes() -> None:
    side = 4000.0
    elements: dict[str, object] = {"lvl-g": _level()}
    for w in _enclosed_walls(side):
        if w.id == "w-top":
            continue
        elements[w.id] = w
    elements["sep-top"] = RoomSeparationElem(
        kind="room_separation",
        id="sep-top",
        name="Top sep",
        levelId="lvl-g",
        start={"xMm": 0, "yMm": side},
        end={"xMm": side, "yMm": side},
    )
    elements["rm-a"] = _square_room("rm-a", side)
    viols = evaluate(elements)  # type: ignore[arg-type]
    assert "rm-a" not in _viol_ids(viols, "room_unenclosed"), [
        v.message for v in viols if v.rule_id == "room_unenclosed"
    ]


def test_room_with_partial_wall_coverage_emits_advisory() -> None:
    """A wall covering only half the edge leaves a gap; rule should fire."""
    side = 4000.0
    elements: dict[str, object] = {"lvl-g": _level()}
    elements["w-bottom"] = _wall("w-bottom", 0, 0, side, 0)
    elements["w-right"] = _wall("w-right", side, 0, side, side)
    elements["w-left"] = _wall("w-left", 0, 0, 0, side)
    # Top wall only covers the left half — leaves a 2 m gap on the right half.
    elements["w-top-half"] = _wall("w-top-half", 0, side, side / 2, side)
    elements["rm-a"] = _square_room("rm-a", side)
    viols = evaluate(elements)  # type: ignore[arg-type]
    advisories = [v for v in viols if v.rule_id == "room_unenclosed" and "rm-a" in v.element_ids]
    assert advisories, "expected room_unenclosed advisory for room with half-covered top edge"


def test_room_unenclosed_distinct_from_room_no_door_rule_id() -> None:
    """Sanity: the new rule is a distinct rule_id from room_no_door."""
    side = 4000.0
    elements: dict[str, object] = {"lvl-g": _level()}
    for w in _enclosed_walls(side):
        if w.id == "w-top":
            continue
        elements[w.id] = w
    elements["rm-a"] = _square_room("rm-a", side)
    viols = evaluate(elements)  # type: ignore[arg-type]
    rule_ids = {v.rule_id for v in viols if "rm-a" in v.element_ids}
    assert "room_unenclosed" in rule_ids
