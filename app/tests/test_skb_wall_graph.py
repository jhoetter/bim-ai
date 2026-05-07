"""Tests for SKB-19 wall-graph closure validator."""

from __future__ import annotations

from bim_ai.skb.wall_graph import (
    WallSeg,
    check_wall_graph,
    find_non_orthogonal_walls,
    find_orphan_walls,
    find_t_intersections_without_join,
)


# A clean rectangle: 4 walls, every endpoint shared at corners.
RECT = [
    WallSeg("w-s", (0.0, 0.0), (5000.0, 0.0)),     # south
    WallSeg("w-e", (5000.0, 0.0), (5000.0, 5000.0)),  # east
    WallSeg("w-n", (5000.0, 5000.0), (0.0, 5000.0)),  # north
    WallSeg("w-w", (0.0, 5000.0), (0.0, 0.0)),     # west
]


def test_clean_rectangle_no_orphans() -> None:
    assert find_orphan_walls(RECT) == []


def test_three_walls_one_orphan_flagged() -> None:
    walls = RECT[:3]  # missing west wall
    out = find_orphan_walls(walls)
    ids = {a.wall_id for a in out}
    # Both south and north are now orphans (south's west endpoint, north's west endpoint)
    assert "w-s" in ids
    assert "w-n" in ids


def test_clean_rectangle_no_non_orthogonal() -> None:
    assert find_non_orthogonal_walls(RECT) == []


def test_diagonal_wall_flagged_non_orthogonal() -> None:
    walls = list(RECT) + [WallSeg("w-diag", (0.0, 0.0), (5000.0, 5000.0))]
    out = find_non_orthogonal_walls(walls)
    ids = [a.wall_id for a in out]
    assert ids == ["w-diag"]


def test_no_t_intersection_in_clean_rectangle() -> None:
    assert find_t_intersections_without_join(RECT) == []


def test_t_intersection_flagged() -> None:
    # internal partition wall whose west end touches the south wall's interior
    walls = list(RECT) + [WallSeg("w-partition", (2500.0, 0.0), (2500.0, 3000.0))]
    out = find_t_intersections_without_join(walls)
    ids = [a.wall_id for a in out]
    assert "w-partition" in ids


def test_t_intersection_with_explicit_join_silenced() -> None:
    walls = list(RECT) + [WallSeg("w-partition", (2500.0, 0.0), (2500.0, 3000.0))]
    out = find_t_intersections_without_join(walls, joined_pairs=[("w-partition", "w-s")])
    ids = [a.wall_id for a in out]
    assert "w-partition" not in ids


def test_check_wall_graph_returns_union() -> None:
    walls = list(RECT)[:3] + [WallSeg("w-diag", (0.0, 0.0), (5000.0, 5000.0))]
    out = check_wall_graph(walls)
    rule_ids = {a.rule_id for a in out}
    assert "orphan_wall_v1" in rule_ids
    assert "non_orthogonal_wall_v1" in rule_ids
