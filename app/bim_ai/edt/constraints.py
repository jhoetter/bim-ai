"""EDT-02 — geometric constraint evaluator (load-bearing slice).

A constraint is a small Pydantic record (``ConstraintElem``) whose
``rule`` ties two element groups together. After every command apply,
the engine asks this module to evaluate every constraint against the
new world. If any ``error``-severity constraint reports a residual
greater than ``EPSILON_MM``, the command is rejected and the world
rolls back.

The padlock UI authors a single constraint per click: clicking the
padlock on a temporary dimension between two walls captures the
current distance as ``locked_value_mm`` on a fresh ``equal_distance``
constraint between those walls.

The slice supports the most common rule (``equal_distance`` between
two walls' centres) — enough to make the engine behaviour testable
end-to-end. Other rules (parallel / perpendicular / collinear /
equal_length) are stubbed with pass-through evaluators that return
``ok`` so the engine never blocks on a rule it does not yet fully
implement; future work can fill those in without changing the
calling protocol.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import hypot
from typing import Any

EPSILON_MM = 0.5


@dataclass(frozen=True)
class ConstraintViolation:
    constraint_id: str
    rule: str
    severity: str
    residual_mm: float
    message: str


def _wall_anchor_xy(wall: dict[str, Any], anchor: str) -> tuple[float, float]:
    s = wall.get("start") or {}
    e = wall.get("end") or {}
    sx = float(s.get("xMm", 0))
    sy = float(s.get("yMm", 0))
    ex = float(e.get("xMm", 0))
    ey = float(e.get("yMm", 0))
    if anchor == "start":
        return sx, sy
    if anchor == "end":
        return ex, ey
    return (sx + ex) / 2.0, (sy + ey) / 2.0


def _anchor_xy(elem: dict[str, Any], anchor: str) -> tuple[float, float] | None:
    kind = elem.get("kind")
    if kind == "wall":
        return _wall_anchor_xy(elem, anchor)
    return None


def _distance(p: tuple[float, float], q: tuple[float, float]) -> float:
    return hypot(p[0] - q[0], p[1] - q[1])


def _resolve_anchor(
    elements_by_id: dict[str, dict[str, Any]],
    refs: list[dict[str, Any]],
) -> tuple[float, float] | None:
    """Average of all referenced anchor points (only walls supported in slice)."""
    points: list[tuple[float, float]] = []
    for ref in refs:
        eid = ref.get("elementId")
        anchor = ref.get("anchor", "center")
        if not eid:
            continue
        elem = elements_by_id.get(eid)
        if elem is None:
            return None
        p = _anchor_xy(elem, anchor)
        if p is None:
            return None
        points.append(p)
    if not points:
        return None
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    return cx, cy


def evaluate_constraint(
    constraint: dict[str, Any],
    elements_by_id: dict[str, dict[str, Any]],
) -> ConstraintViolation | None:
    """Return a violation if the constraint is broken, else None.

    Unknown rules and unresolvable references return None (treated as
    pass) so the engine never blocks on incomplete data — it is the
    rule author's job to add a real evaluator before relying on it.
    """
    rule = constraint.get("rule")
    cid = constraint.get("id", "")
    severity = constraint.get("severity", "error")
    refs_a = constraint.get("refsA") or constraint.get("refs_a") or []
    refs_b = constraint.get("refsB") or constraint.get("refs_b") or []
    locked = constraint.get("lockedValueMm")
    if locked is None:
        locked = constraint.get("locked_value_mm")

    if rule == "equal_distance":
        pa = _resolve_anchor(elements_by_id, refs_a)
        pb = _resolve_anchor(elements_by_id, refs_b)
        if pa is None or pb is None or locked is None:
            return None
        actual = _distance(pa, pb)
        residual = abs(actual - float(locked))
        if residual > EPSILON_MM:
            return ConstraintViolation(
                constraint_id=cid,
                rule=rule,
                severity=severity,
                residual_mm=residual,
                message=(
                    f"distance {actual:.1f}mm differs from locked "
                    f"{float(locked):.1f}mm by {residual:.1f}mm"
                ),
            )
        return None

    return None


def evaluate_all(
    elements: list[dict[str, Any]],
) -> list[ConstraintViolation]:
    """Evaluate every constraint element against the current world.

    Returns the list of violations (empty if all constraints hold or
    there are no constraint elements).
    """
    by_id: dict[str, dict[str, Any]] = {
        e["id"]: e for e in elements if "id" in e
    }
    constraints = [e for e in elements if e.get("kind") == "constraint"]
    out: list[ConstraintViolation] = []
    for c in constraints:
        v = evaluate_constraint(c, by_id)
        if v is not None:
            out.append(v)
    return out


def errors_only(
    violations: list[ConstraintViolation],
) -> list[ConstraintViolation]:
    """Filter to error-severity violations (the ones the engine must reject on)."""
    return [v for v in violations if v.severity == "error"]


def make_locked_distance_constraint(
    *,
    constraint_id: str,
    wall_a_id: str,
    wall_b_id: str,
    locked_mm: float,
    name: str = "",
    severity: str = "error",
) -> dict[str, Any]:
    """Padlock-UI helper: capture a current distance as a locked constraint.

    Returns a plain dict (alias-form) ready to be sent through a
    `createConstraint` engine command.
    """
    return {
        "kind": "constraint",
        "id": constraint_id,
        "name": name,
        "rule": "equal_distance",
        "refsA": [{"elementId": wall_a_id, "anchor": "center"}],
        "refsB": [{"elementId": wall_b_id, "anchor": "center"}],
        "lockedValueMm": float(locked_mm),
        "severity": severity,
    }
