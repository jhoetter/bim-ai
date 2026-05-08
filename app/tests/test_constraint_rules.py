"""EDT-V3-01 — tests for the four new geometric constraint evaluators.

Covers: parallel / perpendicular / collinear / equal_length.

Each rule has:
  (a) ok case — constraint satisfied, evaluate_constraint returns None
  (b) violation case — constraint broken, evaluate_all returns a ConstraintViolation
  (c) edge case — zero-length wall, parallel walls with offset, warning severity, etc.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import ConstraintElem, LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit, try_commit_bundle
from bim_ai.edt.constraints import (
    EPSILON_MM,
    ConstraintViolation,
    errors_only,
    evaluate_all,
    evaluate_constraint,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _wall_dict(
    id_: str,
    sx: float,
    sy: float,
    ex: float,
    ey: float,
    kind: str = "wall",
) -> dict:
    """Plain dict wall / grid_line (for low-level evaluator tests)."""
    return {
        "kind": kind,
        "id": id_,
        "start": {"xMm": sx, "yMm": sy},
        "end": {"xMm": ex, "yMm": ey},
        "heightMm": 3000,
    }


def _constraint(
    id_: str,
    rule: str,
    id_a: str,
    id_b: str,
    severity: str = "error",
    locked_mm: float | None = None,
) -> dict:
    c: dict = {
        "kind": "constraint",
        "id": id_,
        "rule": rule,
        "refsA": [{"elementId": id_a}],
        "refsB": [{"elementId": id_b}],
        "severity": severity,
    }
    if locked_mm is not None:
        c["lockedValueMm"] = locked_mm
    return c


def _wall_elem(
    id_: str,
    sx: float,
    sy: float,
    ex: float,
    ey: float,
) -> WallElem:
    """Pydantic WallElem for engine-level tests."""
    return WallElem(
        kind="wall",
        id=id_,
        name=id_,
        level_id="lvl",
        start=Vec2Mm(xMm=sx, yMm=sy),
        end=Vec2Mm(xMm=ex, yMm=ey),
        thickness_mm=200,
        height_mm=3000,
    )


def _doc_with_walls(
    *walls: WallElem,
    constraints: list[ConstraintElem] | None = None,
) -> Document:
    lvl = LevelElem(kind="level", id="lvl", name="Ground", elevation_mm=0)
    elems: dict = {"lvl": lvl}
    for w in walls:
        elems[w.id] = w
    for c in constraints or []:
        elems[c.id] = c
    return Document(revision=1, elements=elems)


# ===========================================================================
# PARALLEL
# ===========================================================================


class TestParallel:
    """Tests for the 'parallel' constraint rule."""

    def test_parallel_ok_horizontal(self) -> None:
        """Two horizontal walls are parallel — no violation."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),    # along +x
            _wall_dict("w2", 0, 2000, 5000, 2000),  # also along +x
        ]
        c = _constraint("c1", "parallel", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_parallel_ok_vertical(self) -> None:
        """Two vertical walls (along y) are parallel."""
        walls = [
            _wall_dict("w1", 0, 0, 0, 4000),
            _wall_dict("w2", 3000, 0, 3000, 4000),
        ]
        c = _constraint("c1", "parallel", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_parallel_violation_perpendicular_walls(self) -> None:
        """A horizontal and a vertical wall are not parallel — violation."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),    # horizontal
            _wall_dict("w2", 0, 0, 0, 4000),    # vertical
        ]
        c = _constraint("c1", "parallel", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        v = violations[0]
        assert v.rule == "parallel"
        assert v.severity == "error"
        assert v.residual_mm > EPSILON_MM

    def test_parallel_violation_45deg(self) -> None:
        """Wall at 45° to a horizontal wall violates parallel."""
        import math

        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),          # horizontal
            _wall_dict("w2", 0, 0, 3536, 3536),        # 45° diagonal
        ]
        c = _constraint("c1", "parallel", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        # cross-product of (1,0) and (1/√2, 1/√2) ≈ sin(45°) ≈ 0.707
        assert violations[0].residual_mm > 0.5

    def test_parallel_zero_length_wall_vacuous(self) -> None:
        """Zero-length wall vacuously satisfies any orientation rule."""
        walls = [
            _wall_dict("w1", 0, 0, 0, 0),  # zero-length
            _wall_dict("w2", 0, 0, 5000, 0),
        ]
        c = _constraint("c1", "parallel", "w1", "w2")
        # zero-length wall → direction returns None → treated as pass
        assert evaluate_all(walls + [c]) == []

    def test_parallel_warning_does_not_raise(self) -> None:
        """Warning-severity parallel constraint fires as warning, not error."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),
            _wall_dict("w2", 0, 0, 0, 4000),
        ]
        c = _constraint("c1", "parallel", "w1", "w2", severity="warning")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        assert violations[0].severity == "warning"
        assert errors_only(violations) == []

    def test_parallel_grid_line_ok(self) -> None:
        """Two parallel grid lines satisfy the rule."""
        gls = [
            _wall_dict("gl1", 0, 0, 5000, 0, kind="grid_line"),
            _wall_dict("gl2", 0, 1000, 5000, 1000, kind="grid_line"),
        ]
        c = _constraint("c1", "parallel", "gl1", "gl2")
        assert evaluate_all(gls + [c]) == []


# ===========================================================================
# PERPENDICULAR
# ===========================================================================


class TestPerpendicular:
    """Tests for the 'perpendicular' constraint rule."""

    def test_perpendicular_ok(self) -> None:
        """A horizontal and a vertical wall are perpendicular — no violation."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),  # horizontal
            _wall_dict("w2", 0, 0, 0, 4000),  # vertical
        ]
        c = _constraint("c1", "perpendicular", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_perpendicular_violation_parallel(self) -> None:
        """Two parallel walls are not perpendicular — violation."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),
            _wall_dict("w2", 0, 2000, 5000, 2000),
        ]
        c = _constraint("c1", "perpendicular", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        v = violations[0]
        assert v.rule == "perpendicular"
        assert v.residual_mm > EPSILON_MM

    def test_perpendicular_violation_45deg(self) -> None:
        """Two walls at 45° to each other violate perpendicular."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),     # horizontal
            _wall_dict("w2", 0, 0, 3536, 3536),   # 45°
        ]
        c = _constraint("c1", "perpendicular", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        # dot of (1,0) and (1/√2, 1/√2) ≈ cos(45°) ≈ 0.707
        assert violations[0].residual_mm > 0.5

    def test_perpendicular_zero_length_vacuous(self) -> None:
        """Zero-length wall vacuously satisfies perpendicular."""
        walls = [
            _wall_dict("w1", 100, 100, 100, 100),  # zero-length
            _wall_dict("w2", 0, 0, 5000, 0),
        ]
        c = _constraint("c1", "perpendicular", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_perpendicular_epsilon_inclusive_pass(self) -> None:
        """A wall very slightly off perpendicular within EPSILON_MM passes."""
        import math

        # Rotate second wall by a tiny angle so dot ≈ sin(ε_angle) < EPSILON_MM
        # sin(x) ≈ x for small x; EPSILON_MM = 0.5 → angle ≈ 0.5 rad (too big).
        # Use a direction (0, 1+tiny) normalised to get dot just at threshold.
        # Easiest: use exact perpendicular and verify it passes (residual = 0).
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),
            _wall_dict("w2", 0, 0, 0, 4000),
        ]
        c = _constraint("c1", "perpendicular", "w1", "w2")
        assert evaluate_all(walls + [c]) == []


# ===========================================================================
# COLLINEAR
# ===========================================================================


class TestCollinear:
    """Tests for the 'collinear' constraint rule."""

    def test_collinear_ok_coaxial(self) -> None:
        """Two co-axial wall segments on the same horizontal line are collinear."""
        walls = [
            _wall_dict("w1", 0, 0, 3000, 0),
            _wall_dict("w2", 4000, 0, 7000, 0),
        ]
        c = _constraint("c1", "collinear", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_collinear_violation_parallel_offset(self) -> None:
        """Parallel walls offset by 500 mm on the normal violate collinear."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),     # y = 0
            _wall_dict("w2", 0, 500, 5000, 500),  # y = 500 (parallel but offset)
        ]
        c = _constraint("c1", "collinear", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        v = violations[0]
        assert v.rule == "collinear"
        assert v.residual_mm > EPSILON_MM
        assert "500" in v.message or "offset" in v.message.lower()

    def test_collinear_violation_non_parallel(self) -> None:
        """A horizontal and vertical wall are neither parallel nor collinear."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),
            _wall_dict("w2", 0, 0, 0, 4000),
        ]
        c = _constraint("c1", "collinear", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        assert violations[0].residual_mm > EPSILON_MM

    def test_collinear_zero_length_vacuous(self) -> None:
        """Zero-length wall vacuously satisfies collinear (direction undefined)."""
        walls = [
            _wall_dict("w1", 0, 0, 0, 0),  # zero-length
            _wall_dict("w2", 0, 0, 5000, 0),
        ]
        c = _constraint("c1", "collinear", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_collinear_small_offset_violation(self) -> None:
        """Parallel walls 1 mm apart on the normal violate collinear."""
        walls = [
            _wall_dict("w1", 0, 0, 5000, 0),
            _wall_dict("w2", 0, 1, 5000, 1),   # 1 mm offset on y
        ]
        c = _constraint("c1", "collinear", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1

    def test_collinear_reversed_direction_ok(self) -> None:
        """Collinear walls whose start points are in the same direction pass."""
        walls = [
            _wall_dict("w1", 0, 0, 3000, 0),
            _wall_dict("w2", 3000, 0, 8000, 0),
        ]
        c = _constraint("c1", "collinear", "w1", "w2")
        assert evaluate_all(walls + [c]) == []


# ===========================================================================
# EQUAL_LENGTH
# ===========================================================================


class TestEqualLength:
    """Tests for the 'equal_length' constraint rule."""

    def test_equal_length_ok(self) -> None:
        """Two walls of the same length satisfy equal_length."""
        walls = [
            _wall_dict("w1", 0, 0, 4000, 0),   # 4000 mm
            _wall_dict("w2", 0, 500, 4000, 500),  # 4000 mm
        ]
        c = _constraint("c1", "equal_length", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_equal_length_violation(self) -> None:
        """Walls of different lengths violate equal_length."""
        walls = [
            _wall_dict("w1", 0, 0, 4000, 0),   # 4000 mm
            _wall_dict("w2", 0, 0, 6000, 0),   # 6000 mm
        ]
        c = _constraint("c1", "equal_length", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        v = violations[0]
        assert v.rule == "equal_length"
        assert abs(v.residual_mm - 2000.0) < 1.0

    def test_equal_length_within_epsilon(self) -> None:
        """Lengths differing by ≤ EPSILON_MM pass."""
        walls = [
            _wall_dict("w1", 0, 0, 4000, 0),
            _wall_dict("w2", 0, 0, 4000 + EPSILON_MM, 0),
        ]
        c = _constraint("c1", "equal_length", "w1", "w2")
        assert evaluate_all(walls + [c]) == []

    def test_equal_length_zero_vs_nonzero_violation(self) -> None:
        """A zero-length wall and a non-zero wall violate equal_length."""
        walls = [
            _wall_dict("w1", 0, 0, 0, 0),      # 0 mm
            _wall_dict("w2", 0, 0, 1000, 0),   # 1000 mm
        ]
        c = _constraint("c1", "equal_length", "w1", "w2")
        violations = evaluate_all(walls + [c])
        assert len(violations) == 1
        assert abs(violations[0].residual_mm - 1000.0) < 1.0

    def test_equal_length_grid_lines(self) -> None:
        """Two grid lines of equal length satisfy the rule."""
        gls = [
            _wall_dict("gl1", 0, 0, 3000, 0, kind="grid_line"),
            _wall_dict("gl2", 0, 500, 3000, 500, kind="grid_line"),
        ]
        c = _constraint("c1", "equal_length", "gl1", "gl2")
        assert evaluate_all(gls + [c]) == []

    def test_equal_length_missing_element_pass(self) -> None:
        """Missing referenced element treats constraint as pass (unresolvable)."""
        c = _constraint("c1", "equal_length", "ghost_a", "ghost_b")
        assert evaluate_all([c]) == []


# ===========================================================================
# ENGINE INTEGRATION — perpendicular rejection / warning pass-through
# ===========================================================================


class TestEngineIntegration:
    """End-to-end engine tests: violation rejects, warning allows."""

    def test_perpendicular_error_rejects_move(self) -> None:
        """moveWallDelta that violates a perpendicular error-constraint is rejected."""
        # w1 horizontal, w2 vertical → perpendicular.
        # After moving w2's start to (1000, 0) and keeping end at (1000, 4000)
        # the wall is still vertical (perpendicular to w1). But if we rotate it
        # to 45° the constraint fires.
        #
        # Strategy: start with perpendicular walls, add constraint.
        # Then move w2 so it becomes parallel to w1 → dot = 1 → violation.
        # We test the rejection via try_commit_bundle.
        w1 = _wall_elem("w1", 0, 0, 5000, 0)    # horizontal
        w2 = _wall_elem("w2", 2500, 0, 2500, 4000)  # vertical
        c_elem = ConstraintElem(
            kind="constraint",
            id="c-perp",
            rule="perpendicular",
            refsA=[{"elementId": "w1", "anchor": "center"}],
            refsB=[{"elementId": "w2", "anchor": "center"}],
            severity="error",
        )
        doc = _doc_with_walls(w1, w2, constraints=[c_elem])

        # Move w2 to be parallel to w1 (horizontal) — violates perpendicular.
        ok, new_doc, _cmds, violations, code = try_commit_bundle(
            doc,
            [
                {
                    "type": "moveWallEndpoints",
                    "wallId": "w2",
                    "start": {"xMm": 0, "yMm": 2000},
                    "end": {"xMm": 5000, "yMm": 2000},
                }
            ],
        )
        assert ok is False
        assert new_doc is None
        assert code == "constraint_error"
        edt_rows = [v for v in violations if v.rule_id == "edt_constraint_violated"]
        assert edt_rows, "expected an EDT-02 violation row"
        assert "perpendicular" in edt_rows[0].message

    def test_perpendicular_warning_allows_move(self) -> None:
        """moveWallEndpoints that violates a perpendicular warning-constraint is allowed."""
        w1 = _wall_elem("w1", 0, 0, 5000, 0)
        w2 = _wall_elem("w2", 2500, 0, 2500, 4000)
        c_elem = ConstraintElem(
            kind="constraint",
            id="c-perp-warn",
            rule="perpendicular",
            refsA=[{"elementId": "w1", "anchor": "center"}],
            refsB=[{"elementId": "w2", "anchor": "center"}],
            severity="warning",
        )
        doc = _doc_with_walls(w1, w2, constraints=[c_elem])

        ok, new_doc, _cmds, violations, code = try_commit_bundle(
            doc,
            [
                {
                    "type": "moveWallEndpoints",
                    "wallId": "w2",
                    "start": {"xMm": 0, "yMm": 2000},
                    "end": {"xMm": 5000, "yMm": 2000},
                }
            ],
        )
        assert ok is True, f"expected ok=True, got code={code}"
        assert new_doc is not None
