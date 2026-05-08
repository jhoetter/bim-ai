"""Tests for SKB-05 architectural soundness pack."""

from __future__ import annotations

from bim_ai.skb.soundness import (
    LevelInfo,
    SoundnessInput,
    check_floor_matches_walls,
    check_levels_monotonic_stack,
    check_roof_contains_wall_midpoint,
    check_wall_corner_gaps,
    run_pack,
)
from bim_ai.skb.wall_graph import WallSeg

RECT = [
    WallSeg("w-s", (0.0, 0.0), (5000.0, 0.0)),
    WallSeg("w-e", (5000.0, 0.0), (5000.0, 5000.0)),
    WallSeg("w-n", (5000.0, 5000.0), (0.0, 5000.0)),
    WallSeg("w-w", (0.0, 5000.0), (0.0, 0.0)),
]
RECT_BOUNDARY = [(0.0, 0.0), (5000.0, 0.0), (5000.0, 5000.0), (0.0, 5000.0)]


def test_clean_rectangle_no_corner_gaps() -> None:
    assert check_wall_corner_gaps(RECT) == []


def test_near_miss_corner_flagged() -> None:
    walls = [
        WallSeg("w1", (0.0, 0.0), (5000.0, 0.0)),
        WallSeg("w2", (5005.0, 5.0), (5005.0, 5000.0)),  # 5+ mm off
    ]
    advisories = check_wall_corner_gaps(walls)
    assert len(advisories) == 1
    assert advisories[0].rule_id == "wall_corner_gap_or_overlap_v1"


def test_far_apart_walls_not_flagged() -> None:
    walls = [
        WallSeg("w1", (0.0, 0.0), (5000.0, 0.0)),
        WallSeg("w2", (10000.0, 0.0), (10000.0, 5000.0)),  # 5000 mm apart
    ]
    assert check_wall_corner_gaps(walls) == []


def test_floor_matching_walls_no_violation() -> None:
    adv = check_floor_matches_walls("f1", RECT_BOUNDARY, RECT)
    assert adv is None


def test_floor_diverging_from_walls_flagged() -> None:
    weird = [(0.0, 0.0), (8000.0, 0.0), (8000.0, 8000.0), (0.0, 8000.0)]
    adv = check_floor_matches_walls("f1", weird, RECT, tol_mm=200.0)
    assert adv is not None
    assert adv.rule_id == "floor_boundary_matches_wall_enclosure_v1"


def test_levels_monotonic_no_violation() -> None:
    levels = [LevelInfo("L1", 0), LevelInfo("L2", 3000), LevelInfo("L3", 6000)]
    assert check_levels_monotonic_stack(levels) == []


def test_levels_at_same_elevation_flagged() -> None:
    levels = [LevelInfo("L1", 0), LevelInfo("L2", 3000), LevelInfo("L2-bis", 3000)]
    advs = check_levels_monotonic_stack(levels)
    assert len(advs) == 1
    assert "share elevation" in advs[0].message


def test_duplicate_level_id_flagged() -> None:
    levels = [LevelInfo("L1", 0), LevelInfo("L1", 3000)]
    advs = check_levels_monotonic_stack(levels)
    rules = [a.rule_id for a in advs]
    assert rules.count("levels_form_monotonic_stack_v1") >= 1


def test_wall_inside_roof_no_violation() -> None:
    fp = RECT_BOUNDARY
    adv = check_roof_contains_wall_midpoint(
        "w1", (1000.0, 1000.0), (4000.0, 1000.0), "r1", fp,
    )
    assert adv is None


def test_wall_outside_roof_flagged() -> None:
    fp = RECT_BOUNDARY
    adv = check_roof_contains_wall_midpoint(
        "w1", (5000.0, 1000.0), (8000.0, 1000.0), "r1", fp,
    )
    assert adv is not None
    assert adv.rule_id == "roof_contains_upper_wall_centerlines_v1"


def test_run_pack_returns_union() -> None:
    inp = SoundnessInput(
        walls=RECT[:3],   # missing west wall — but corner check tolerates that
        floors=[("f1", RECT_BOUNDARY, RECT)],   # boundary matches
        levels=[LevelInfo("L1", 0), LevelInfo("L2", 3000), LevelInfo("L2-bis", 3000)],  # collision
        roofed_walls=[
            ("w-out", (5000.0, 1000.0), (8000.0, 1000.0), "r1", RECT_BOUNDARY),  # midpoint outside
        ],
    )
    advs = run_pack(inp)
    rules = {a.rule_id for a in advs}
    assert "levels_form_monotonic_stack_v1" in rules
    assert "roof_contains_upper_wall_centerlines_v1" in rules
