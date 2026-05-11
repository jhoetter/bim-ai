from __future__ import annotations

import math
import re
from dataclasses import dataclass

from bim_ai.elements import Vec2Mm

_QUADRANT_RE = re.compile(
    r"^\s*([NS])\s*"
    r"([0-9]+(?:\.[0-9]+)?)"
    r"(?:\s*[°d]\s*([0-9]+(?:\.[0-9]+)?)?)?"
    r"(?:\s*['m]\s*([0-9]+(?:\.[0-9]+)?)?)?"
    r'\s*(?:"|s)?\s*([EW])\s*$',
    re.IGNORECASE,
)
_DECIMAL_RE = re.compile(r"^\s*(-?[0-9]+(?:\.[0-9]+)?)\s*(?:°|deg|d)?\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class BearingWalkResult:
    points_mm: list[Vec2Mm]
    closure_error_mm: float


def parse_bearing_degrees(text: str) -> float:
    """Return azimuth degrees clockwise from north.

    Supports surveyor quadrant notation like ``N 45°12'38" E`` and decimal
    azimuth notation like ``45.21°``.
    """

    match = _DECIMAL_RE.match(text)
    if match:
        return float(match.group(1)) % 360.0

    match = _QUADRANT_RE.match(text)
    if not match:
        raise ValueError(f"unsupported bearing '{text}'")

    north_south, deg_raw, min_raw, sec_raw, east_west = match.groups()
    angle = float(deg_raw)
    if min_raw is not None:
        angle += float(min_raw) / 60.0
    if sec_raw is not None:
        angle += float(sec_raw) / 3600.0
    if angle > 90:
        raise ValueError(f"quadrant bearing angle must be <= 90 degrees: '{text}'")

    ns = north_south.upper()
    ew = east_west.upper()
    if ns == "N" and ew == "E":
        return angle
    if ns == "S" and ew == "E":
        return 180.0 - angle
    if ns == "S" and ew == "W":
        return 180.0 + angle
    return 360.0 - angle


def walk_bearing_table(
    start_mm: Vec2Mm,
    rows: list[tuple[str, float]],
    closes_at: Vec2Mm | None = None,
) -> BearingWalkResult:
    points = [start_mm]
    x = start_mm.x_mm
    y = start_mm.y_mm

    for bearing, distance_mm in rows:
        if distance_mm <= 0 or not math.isfinite(distance_mm):
            raise ValueError("bearing table distances must be positive finite millimetres")
        azimuth_rad = math.radians(parse_bearing_degrees(bearing))
        x += math.sin(azimuth_rad) * distance_mm
        y += math.cos(azimuth_rad) * distance_mm
        points.append(Vec2Mm(xMm=x, yMm=y))

    target = closes_at or start_mm
    closure_error_mm = math.hypot(points[-1].x_mm - target.x_mm, points[-1].y_mm - target.y_mm)
    return BearingWalkResult(points_mm=points, closure_error_mm=closure_error_mm)
