"""Tests for SKB-22 wall-corner auto-join."""

from __future__ import annotations

from bim_ai.skb.wall_corner_auto_join import (
    WallSeg,
    detect_abutment_joins,
    detect_all_joins,
    detect_corner_joins,
    existing_join_pairs,
    joins_missing_from_existing,
)


RECT = [
    WallSeg("w-s", (0.0, 0.0), (5000.0, 0.0)),
    WallSeg("w-e", (5000.0, 0.0), (5000.0, 5000.0)),
    WallSeg("w-n", (5000.0, 5000.0), (0.0, 5000.0)),
    WallSeg("w-w", (0.0, 5000.0), (0.0, 0.0)),
]


def test_clean_rectangle_emits_4_corner_joins() -> None:
    joins = detect_corner_joins(RECT)
    assert len(joins) == 4
    assert all(j.kind == "corner" for j in joins)


def test_corner_joins_dedupe_pair_directions() -> None:
    # Each pair appears only once regardless of which wall is "first"
    joins = detect_corner_joins(RECT)
    pair_set = {frozenset({j.wall_a_id, j.wall_b_id}) for j in joins}
    assert len(pair_set) == 4


def test_endpoints_within_tolerance_count_as_coincident() -> None:
    walls = [
        WallSeg("w1", (0.0, 0.0), (5000.0, 0.0)),
        WallSeg("w2", (5005.0, 0.0), (5005.0, 5000.0)),  # 5 mm gap
    ]
    joins = detect_corner_joins(walls, tol_mm=10.0)
    assert len(joins) == 1


def test_endpoints_outside_tolerance_no_join() -> None:
    walls = [
        WallSeg("w1", (0.0, 0.0), (5000.0, 0.0)),
        WallSeg("w2", (5050.0, 0.0), (5050.0, 5000.0)),  # 50 mm gap
    ]
    joins = detect_corner_joins(walls, tol_mm=10.0)
    assert joins == []


def test_t_intersection_emits_abutment() -> None:
    walls = list(RECT) + [WallSeg("w-partition", (2500.0, 0.0), (2500.0, 3000.0))]
    abuts = detect_abutment_joins(walls)
    ids = [a.wall_a_id for a in abuts]
    assert "w-partition" in ids


def test_detect_all_joins_returns_union() -> None:
    walls = list(RECT) + [WallSeg("w-partition", (2500.0, 0.0), (2500.0, 3000.0))]
    out = detect_all_joins(walls)
    kinds = {j.kind for j in out}
    assert "corner" in kinds
    assert "abutment" in kinds


def test_join_pair_to_element_dict_shape() -> None:
    walls = RECT[:2]
    pair = detect_corner_joins(walls)[0]
    d = pair.to_element_dict("jg-1")
    assert d["kind"] == "join_geometry"
    assert d["id"] == "jg-1"
    assert sorted(d["joinedElementIds"]) == sorted([pair.wall_a_id, pair.wall_b_id])
    assert "SKB-22 auto-join" in d["notes"]


def test_existing_join_pairs_round_trips() -> None:
    existing = existing_join_pairs([["w-s", "w-e"], ["w-n", "w-w"]])
    assert frozenset({"w-s", "w-e"}) in existing
    assert frozenset({"w-n", "w-w"}) in existing
    assert frozenset({"w-s", "w-w"}) not in existing


def test_joins_missing_from_existing_dedupes() -> None:
    detected = detect_corner_joins(RECT)
    existing = existing_join_pairs([["w-s", "w-e"]])  # one already covered
    out = joins_missing_from_existing(detected, existing)
    pair_set = {frozenset({p.wall_a_id, p.wall_b_id}) for p in out}
    assert frozenset({"w-s", "w-e"}) not in pair_set
    assert frozenset({"w-e", "w-n"}) in pair_set
