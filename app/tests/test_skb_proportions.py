"""Tests for SKB-06 architectural proportions linter."""

from __future__ import annotations

from bim_ai.skb.proportions import (
    PROPORTION_RANGES,
    check_many,
    check_value,
    known_fields,
)


def test_known_fields_sorted_and_complete() -> None:
    fields = known_fields()
    assert fields == sorted(fields)
    assert "wall.height_mm" in fields
    assert "door.width_mm" in fields
    assert "roof.slope_deg" in fields


def test_in_range_returns_none() -> None:
    assert check_value("wall.height_mm", "w1", 2800) is None
    assert check_value("door.width_mm", "d1", 900) is None
    assert check_value("roof.slope_deg", "r1", 30) is None


def test_below_lower_bound_emits_violation() -> None:
    v = check_value("wall.height_mm", "w-too-short", 1500)
    assert v is not None
    assert v.field == "wall.height_mm"
    assert v.element_id == "w-too-short"
    assert "below" in v.message


def test_above_upper_bound_emits_violation() -> None:
    v = check_value("door.width_mm", "d-too-wide", 5000)
    assert v is not None
    assert "above" in v.message


def test_unknown_field_returns_none() -> None:
    assert check_value("totally.unknown_field", "e1", 9999) is None


def test_check_many_returns_only_violations() -> None:
    items = [
        ("wall.height_mm", "w1", 2800),    # in range
        ("wall.height_mm", "w2", 800),      # too short
        ("door.width_mm", "d1", 900),       # in range
        ("door.width_mm", "d2", 50),        # too narrow
        ("unknown.field", "e1", 1234),     # unknown — silently dropped
    ]
    violations = check_many(items)
    ids = [v.element_id for v in violations]
    assert ids == ["w2", "d2"]


def test_violation_serialises_to_advisory_dict() -> None:
    v = check_value("wall.height_mm", "w1", 100)
    assert v is not None
    d = v.to_advisory_dict()
    assert d["rule_id"] == "architectural_proportions_v1"
    assert d["severity"] == "info"
    assert d["element_id"] == "w1"
    assert d["actual"] == 100


def test_all_ranges_have_sane_bounds() -> None:
    for field, rng in PROPORTION_RANGES.items():
        assert rng.lo <= rng.hi, f"{field}: lo > hi"
        assert rng.lo >= 0, f"{field}: negative lo"
