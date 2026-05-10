from __future__ import annotations

import pytest

from bim_ai.constraints import _opening_t_interval_on_wall, _wall_length_mm
from bim_ai.constraints_wall_geometry import (
    hosted_t_bounds,
    interval_union_uncovered,
    opening_plan_midpoint,
    opening_t_interval_on_wall,
    room_bbox,
    segment_axis_coverage,
    wall_corner_or_t_overlap_exempt,
    wall_length_mm,
    wall_unit_dir,
)
from bim_ai.elements import DoorElem, RoomElem, WallElem


def _wall(
    wall_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    level_id: str = "L1",
    thickness_mm: float = 200.0,
) -> WallElem:
    return WallElem(
        id=wall_id,
        levelId=level_id,
        start={"xMm": start[0], "yMm": start[1]},
        end={"xMm": end[0], "yMm": end[1]},
        thicknessMm=thickness_mm,
    )


def test_room_bbox_and_axis_coverage_helpers() -> None:
    room = RoomElem(
        id="r1",
        levelId="L1",
        outlineMm=[
            {"xMm": 0.0, "yMm": 0.0},
            {"xMm": 3000.0, "yMm": 0.0},
            {"xMm": 3000.0, "yMm": 2000.0},
            {"xMm": 0.0, "yMm": 2000.0},
        ],
    )

    assert room_bbox(room) == (0.0, 3000.0, 0.0, 2000.0)
    assert segment_axis_coverage(
        (0.0, 0.0), (3000.0, 0.0), (250.0, 25.0), (2250.0, 25.0), 50.0
    ) == pytest.approx((250.0, 2250.0))
    assert (
        segment_axis_coverage((0.0, 0.0), (3000.0, 0.0), (250.0, 200.0), (2250.0, 200.0), 50.0)
        is None
    )


def test_interval_union_uncovered_bridges_small_gaps() -> None:
    uncovered = interval_union_uncovered([(0.0, 1000.0), (1030.0, 2000.0)], 3000.0)

    assert uncovered == [(2000.0, 3000.0)]


def test_wall_and_opening_helpers_preserve_legacy_aliases() -> None:
    wall = _wall("w1", (0.0, 0.0), (4000.0, 0.0))
    door = DoorElem(id="d1", wallId="w1", alongT=0.5, widthMm=1000.0)

    assert wall_length_mm(wall) == 4000.0
    assert _wall_length_mm(wall) == 4000.0
    assert wall_unit_dir(wall) == (1.0, 0.0)
    assert hosted_t_bounds(wall, 1000.0) == pytest.approx((0.125, 0.875))
    assert opening_plan_midpoint(door, wall) == (2000.0, 0.0)
    assert opening_t_interval_on_wall(door, wall) == pytest.approx((0.375, 0.625))
    assert _opening_t_interval_on_wall(door, wall) == pytest.approx((0.375, 0.625))


def test_wall_corner_or_t_overlap_exempt_handles_corner_joint() -> None:
    horizontal = _wall("wh", (0.0, 0.0), (4000.0, 0.0))
    vertical = _wall("wv", (4000.0, 0.0), (4000.0, 2500.0))
    unrelated = _wall("wu", (1000.0, 1000.0), (5000.0, 1000.0))

    assert wall_corner_or_t_overlap_exempt(horizontal, vertical)
    assert not wall_corner_or_t_overlap_exempt(horizontal, unrelated)
