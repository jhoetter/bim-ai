"""Tests for EDT-02 constraint evaluator (load-bearing slice)."""

from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from bim_ai.edt.constraints import (
    EPSILON_MM,
    ConstraintViolation,
    errors_only,
    evaluate_all,
    evaluate_constraint,
    make_locked_distance_constraint,
)
from bim_ai.elements import ConstraintElem, Element


def _wall(id_: str, sx: float, sy: float, ex: float, ey: float) -> dict:
    return {
        "kind": "wall",
        "id": id_,
        "start": {"xMm": sx, "yMm": sy},
        "end": {"xMm": ex, "yMm": ey},
        "heightMm": 3000,
    }


def test_constraint_elem_round_trips_via_alias() -> None:
    c = ConstraintElem(
        id="c1",
        rule="equal_distance",
        refsA=[{"elementId": "w1", "anchor": "center"}],
        refsB=[{"elementId": "w2", "anchor": "center"}],
        lockedValueMm=4000.0,
    )
    out = c.model_dump(by_alias=True)
    assert out["kind"] == "constraint"
    assert out["lockedValueMm"] == 4000.0
    assert out["refsA"][0]["elementId"] == "w1"


def test_constraint_in_discriminated_union() -> None:
    payload = {
        "kind": "constraint",
        "id": "c1",
        "rule": "equal_distance",
        "refsA": [{"elementId": "w1"}],
        "refsB": [{"elementId": "w2"}],
        "lockedValueMm": 5000.0,
    }
    el = TypeAdapter(Element).validate_python(payload)
    assert el.kind == "constraint"


def test_unknown_rule_treated_as_pass() -> None:
    c = {
        "kind": "constraint",
        "id": "c1",
        "rule": "alien_rule",
        "refsA": [{"elementId": "w1"}],
        "refsB": [{"elementId": "w2"}],
    }
    assert evaluate_constraint(c, {}) is None


def test_locked_distance_pass_within_epsilon() -> None:
    walls = [
        _wall("w1", 0, 0, 0, 0),       # centre at (0,0)
        _wall("w2", 5000, 0, 5000, 0), # centre at (5000,0)
    ]
    c = make_locked_distance_constraint(
        constraint_id="c1", wall_a_id="w1", wall_b_id="w2", locked_mm=5000.0
    )
    assert evaluate_all(walls + [c]) == []


def test_locked_distance_violation_caught() -> None:
    walls = [
        _wall("w1", 0, 0, 0, 0),
        _wall("w2", 5100, 0, 5100, 0),  # 100mm too far
    ]
    c = make_locked_distance_constraint(
        constraint_id="c1", wall_a_id="w1", wall_b_id="w2", locked_mm=5000.0
    )
    violations = evaluate_all(walls + [c])
    assert len(violations) == 1
    v = violations[0]
    assert isinstance(v, ConstraintViolation)
    assert v.rule == "equal_distance"
    assert v.severity == "error"
    assert 99.0 < v.residual_mm < 101.0


def test_epsilon_threshold_is_inclusive_pass() -> None:
    walls = [
        _wall("w1", 0, 0, 0, 0),
        _wall("w2", 5000 + EPSILON_MM, 0, 5000 + EPSILON_MM, 0),
    ]
    c = make_locked_distance_constraint(
        constraint_id="c1", wall_a_id="w1", wall_b_id="w2", locked_mm=5000.0
    )
    # residual == EPSILON_MM should NOT count as violation
    assert evaluate_all(walls + [c]) == []


def test_missing_referenced_element_treated_as_pass() -> None:
    c = make_locked_distance_constraint(
        constraint_id="c1", wall_a_id="ghost", wall_b_id="phantom", locked_mm=1.0
    )
    assert evaluate_all([c]) == []


def test_warning_severity_filtered_from_errors_only() -> None:
    walls = [
        _wall("w1", 0, 0, 0, 0),
        _wall("w2", 6000, 0, 6000, 0),  # off by 1000mm
    ]
    c = make_locked_distance_constraint(
        constraint_id="c1",
        wall_a_id="w1",
        wall_b_id="w2",
        locked_mm=5000.0,
        severity="warning",
    )
    violations = evaluate_all(walls + [c])
    assert len(violations) == 1
    assert errors_only(violations) == []


def test_make_locked_distance_constraint_shape() -> None:
    out = make_locked_distance_constraint(
        constraint_id="c-locked-front",
        wall_a_id="w-front",
        wall_b_id="w-rear",
        locked_mm=8500.0,
    )
    assert out["kind"] == "constraint"
    assert out["rule"] == "equal_distance"
    assert out["lockedValueMm"] == 8500.0
    assert out["refsA"] == [{"elementId": "w-front", "anchor": "center"}]
    assert out["refsB"] == [{"elementId": "w-rear", "anchor": "center"}]


def test_anchor_start_uses_wall_endpoint() -> None:
    walls = [
        # wall-w1 ends at (5000,0), wall-w2 starts at (5000,0)
        _wall("w1", 0, 0, 5000, 0),
        _wall("w2", 5000, 0, 5000, 4000),
    ]
    # Locked distance between w1.end and w2.start = 0
    c = {
        "kind": "constraint",
        "id": "c-corner",
        "rule": "equal_distance",
        "refsA": [{"elementId": "w1", "anchor": "end"}],
        "refsB": [{"elementId": "w2", "anchor": "start"}],
        "lockedValueMm": 0.0,
    }
    assert evaluate_all(walls + [c]) == []


def test_constraint_severity_must_be_warning_or_error() -> None:
    with pytest.raises(ValidationError):
        ConstraintElem(
            id="c1",
            rule="equal_distance",
            refsA=[{"elementId": "w1"}],
            refsB=[{"elementId": "w2"}],
            lockedValueMm=1.0,
            severity="critical",  # not allowed
        )
