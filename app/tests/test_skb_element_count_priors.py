"""Tests for SKB-13 element-count priors."""

from __future__ import annotations

from bim_ai.skb.element_count_priors import (
    ARCHETYPE_PRIORS,
    CountRange,
    known_archetypes,
    out_of_range_kinds,
)


def test_known_archetypes_sorted_and_nonempty() -> None:
    archetypes = known_archetypes()
    assert archetypes
    assert archetypes == sorted(archetypes)
    assert "single_family_two_story_modest" in archetypes


def test_count_range_contains_inclusive() -> None:
    r = CountRange(2, 5)
    assert r.contains(2)
    assert r.contains(5)
    assert r.contains(3)
    assert not r.contains(1)
    assert not r.contains(6)


def test_known_archetype_in_range_returns_no_violations() -> None:
    counts = {
        "level": 2,
        "wall": 16,
        "door": 2,
        "window": 6,
        "floor": 2,
        "roof": 1,
        "stair": 1,
        "room": 6,
    }
    out = out_of_range_kinds("single_family_two_story_modest", counts)
    assert out == []


def test_known_archetype_too_few_walls_flagged() -> None:
    counts = {
        "level": 2,
        "wall": 3,  # way too few
        "door": 2,
        "window": 6,
        "floor": 2,
        "roof": 1,
        "stair": 1,
        "room": 6,
    }
    out = out_of_range_kinds("single_family_two_story_modest", counts)
    kinds = [k for k, _, _ in out]
    assert "wall" in kinds


def test_unknown_archetype_returns_empty() -> None:
    out = out_of_range_kinds("totally_made_up_archetype", {"wall": 9999})
    assert out == []


def test_missing_kind_treated_as_zero() -> None:
    out = out_of_range_kinds("single_family_two_story_modest", {})
    kinds = {k for k, _, _ in out}
    # Most expected kinds should flag because count = 0 is outside their range.
    assert "wall" in kinds
    assert "level" in kinds


def test_all_archetype_priors_have_sane_bounds() -> None:
    for archetype, priors in ARCHETYPE_PRIORS.items():
        for kind, r in priors.items():
            assert r.lo >= 0, f"{archetype}/{kind}: negative lower bound"
            assert r.lo <= r.hi, f"{archetype}/{kind}: lo > hi"
