"""Tests for shared opening/cut rectangles (WP-B02/B03/E03 groundwork)."""

from __future__ import annotations

import pytest

from bim_ai.elements import DoorElem, WallElem
from bim_ai.opening_cut_primitives import (
    complement_vertical_spans_m,
    floor_panels_axis_aligned_rect_with_single_hole_mm,
    hosted_opening_half_span_mm,
    hosted_opening_t_span_normalized,
    hosted_opening_u_projection_scale,
    wall_plan_axis_aligned_xy,
    wall_plan_yaw_deg,
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


def test_hosted_opening_reveal_widens_normalized_t_span() -> None:
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
    door_plain = DoorElem(
        kind="door",
        id="d0",
        name="D",
        wall_id="w1",
        along_t=0.5,
        width_mm=1000,
    )
    door_reveal = DoorElem(
        kind="door",
        id="d1",
        name="D",
        wall_id="w1",
        along_t=0.5,
        width_mm=1000,
        reveal_interior_mm=150.0,
    )
    sp0 = hosted_opening_t_span_normalized(door_plain, wall)
    sp1 = hosted_opening_t_span_normalized(door_reveal, wall)
    assert sp0 is not None and sp1 is not None
    assert (sp1[1] - sp1[0]) > (sp0[1] - sp0[0])
    assert hosted_opening_half_span_mm(door_plain) == 500.0
    assert hosted_opening_half_span_mm(door_reveal) == 650.0


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


def test_wall_plan_axis_aligned_and_yaw() -> None:
    east = WallElem(
        kind="wall",
        id="w",
        name="",
        level_id="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 8000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    diag = WallElem(
        kind="wall",
        id="w2",
        name="",
        level_id="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 5000, "yMm": 5000},
        thicknessMm=200,
        heightMm=2800,
    )
    assert wall_plan_axis_aligned_xy(east) is True
    assert wall_plan_axis_aligned_xy(diag) is False
    assert wall_plan_yaw_deg(east) == 0.0
    assert wall_plan_yaw_deg(diag) == 45.0


def test_hosted_opening_u_projection_scale_diagonal_wall_vs_cardinal_cut() -> None:
    wall = WallElem(
        kind="wall",
        id="w",
        name="",
        level_id="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 5000, "yMm": 5000},
        thicknessMm=200,
        heightMm=2800,
    )
    # Cut tangent along +X: scale |ŵ·(1,0)| = cos(45°)
    s_x = hosted_opening_u_projection_scale(wall, 1.0, 0.0)
    assert s_x == pytest.approx(2**0.5 / 2, rel=1e-9)
    # Cut tangent along +Y: same by symmetry
    s_y = hosted_opening_u_projection_scale(wall, 0.0, 1.0)
    assert s_y == pytest.approx(2**0.5 / 2, rel=1e-9)

