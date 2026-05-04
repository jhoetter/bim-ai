"""Tests for shared opening/cut rectangles (WP-B02/B03/E03 groundwork)."""

from __future__ import annotations

from bim_ai.elements import DoorElem, WallElem
from bim_ai.opening_cut_primitives import (
    complement_vertical_spans_m,
    floor_panels_axis_aligned_rect_with_single_hole_mm,
    hosted_opening_t_span_normalized,
)


def test_hosted_opening_t_span_normalized_clamps_mid_span() -> None:
    wall = WallElem(
        kind="wall",
        id="w1",
        name="",
        level_id="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 10000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(
        kind="door",
        id="d1",
        name="D",
        wall_id="w1",
        along_t=0.5,
        width_mm=1000,
    )
    rn = hosted_opening_t_span_normalized(door, wall)
    assert rn is not None
    t0, t1 = rn
    assert t0 <= t1 and 0.449 <= t0 < 0.551 and 0.449 < t1 <= 0.551


def test_complement_vertical_spans_keeps_floor_to_ceiling_gaps() -> None:
    free = complement_vertical_spans_m(
        0.0,
        3.0,
        [(1.0, 1.9), (2.5, 2.7)],
    )
    assert (0.0, 1.0) in free
    assert (1.9, 2.5) in free
    assert (2.7, 3.0) in free


def test_floor_panels_rectangle_with_rectangular_void_splits_to_l_shape() -> None:
    floor = [(0.0, 0.0), (10000.0, 0.0), (10000.0, 8000.0), (0.0, 8000.0)]
    hole = [(3000.0, 2000.0), (7000.0, 2000.0), (7000.0, 5000.0), (3000.0, 5000.0)]
    panels = floor_panels_axis_aligned_rect_with_single_hole_mm(floor, hole, min_gap_mm=40)
    assert panels is not None
    assert len(panels) >= 2

