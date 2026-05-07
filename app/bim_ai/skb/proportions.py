"""SKB-06 — architectural proportions linter (`architectural_proportions_v1`).

Pure-data advisory rules with sane upper / lower bounds for typical
residential / small-commercial proportions. Anything outside the bounds
emits an informational violation the agent can react to without being
blocked.

The thresholds are intentionally _wide_: the goal is to catch egregious
authoring mistakes (700 mm wall heights, 12 m doors), not to enforce a
particular architectural opinion. Tightening the bounds is a per-project
concern.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class ProportionRange:
    """Inclusive `[lo, hi]` range with a human-readable message."""

    lo: float
    hi: float
    message: str

    def contains(self, x: float) -> bool:
        return self.lo <= x <= self.hi

    def violation_for(self, x: float) -> str | None:
        if self.contains(x):
            return None
        if x < self.lo:
            return f"{self.message}: actual {x:g} is below {self.lo:g}"
        return f"{self.message}: actual {x:g} is above {self.hi:g}"


# Logical-name → range. Add more as authoring patterns surface.
PROPORTION_RANGES: dict[str, ProportionRange] = {
    "wall.height_mm": ProportionRange(
        lo=2200, hi=4500,
        message="Residential wall height typically 2200-4500 mm",
    ),
    "wall.thickness_mm": ProportionRange(
        lo=80, hi=600,
        message="Wall thickness typically 80-600 mm",
    ),
    "door.width_mm": ProportionRange(
        lo=700, hi=2400,
        message="Door width typically 700-2400 mm (singles 800-1000, doubles 1500-2000)",
    ),
    "door.height_mm": ProportionRange(
        lo=1900, hi=3500,
        message="Door height typically 1900-3500 mm",
    ),
    "window.width_mm": ProportionRange(
        lo=300, hi=4000,
        message="Window width typically 300-4000 mm",
    ),
    "window.height_mm": ProportionRange(
        lo=300, hi=3500,
        message="Window height typically 300-3500 mm",
    ),
    "window.sill_mm": ProportionRange(
        lo=80, hi=1500,
        message="Window sill typically 80-1500 mm above the floor",
    ),
    "roof.slope_deg": ProportionRange(
        lo=0, hi=70,
        message="Roof slope typically 0-70 degrees (≥45° often impractical for residential)",
    ),
    "roof.ridge_to_eave_ratio": ProportionRange(
        lo=1.05, hi=2.5,
        message="Ridge height / eave height ratio typically 1.05-2.5 for residential gables",
    ),
    "room.aspect_ratio": ProportionRange(
        lo=0.4, hi=3.0,
        message="Room aspect ratio (longer/shorter side) typically 0.4-3.0",
    ),
    "stair.tread_mm": ProportionRange(
        lo=220, hi=320,
        message="Stair tread typically 220-320 mm (residential code minimums vary)",
    ),
    "stair.riser_mm": ProportionRange(
        lo=120, hi=210,
        message="Stair riser typically 120-210 mm",
    ),
}


@dataclass(frozen=True)
class ProportionViolation:
    """One proportion-rule failure."""

    field: str            # e.g. "wall.height_mm"
    element_id: str
    actual: float
    message: str

    def to_advisory_dict(self) -> dict:
        return {
            "rule_id": "architectural_proportions_v1",
            "severity": "info",
            "field": self.field,
            "element_id": self.element_id,
            "actual": self.actual,
            "message": self.message,
        }


def check_value(field: str, element_id: str, value: float) -> ProportionViolation | None:
    """Run the proportions check for one (field, value) pair.

    Returns None when value is within range OR when the field has no
    registered range (silence is safer than spurious advisories).
    """
    rng = PROPORTION_RANGES.get(field)
    if rng is None:
        return None
    msg = rng.violation_for(value)
    if msg is None:
        return None
    return ProportionViolation(
        field=field,
        element_id=element_id,
        actual=value,
        message=msg,
    )


def check_many(items: Iterable[tuple[str, str, float]]) -> list[ProportionViolation]:
    """Convenience: run check_value over many (field, element_id, value)
    triples and return only the violations.
    """
    out: list[ProportionViolation] = []
    for field, eid, val in items:
        v = check_value(field, eid, val)
        if v is not None:
            out.append(v)
    return out


def known_fields() -> list[str]:
    """Sorted list of supported field names."""
    return sorted(PROPORTION_RANGES.keys())
