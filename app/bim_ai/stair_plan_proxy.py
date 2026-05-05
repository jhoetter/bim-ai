"""Stair plan/section proxy counts aligned with level rise (WP-B05 slice)."""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import LevelElem, StairElem

_STAIR_DOC_Z_EPS_MM = 1e-3
_STAIR_DOC_RANGE_EPS_MM = 1e-6


def stair_riser_count_plan_proxy(doc: Document, stair: StairElem, *, run_length_mm: float) -> int:
    """Interior division count along the stair run (2–36) for plan/section hints.

    When base and top levels resolve, uses ``round(rise_mm / riser_mm)`` so tread lines
    match the modeled story height. Otherwise falls back to run length / tread depth.
    """
    bl = doc.elements.get(stair.base_level_id)
    tl = doc.elements.get(stair.top_level_id)
    if isinstance(bl, LevelElem) and isinstance(tl, LevelElem):
        rise_mm = abs(float(tl.elevation_mm) - float(bl.elevation_mm))
        if rise_mm > 1e-3:
            r = float(stair.riser_mm)
            if r > 1e-6:
                n = int(round(rise_mm / r))
                return max(2, min(36, n))

    t = float(stair.tread_mm)
    if t > 1e-6 and run_length_mm > 1e-6:
        n2 = int(round(run_length_mm / t))
        return max(2, min(36, n2))

    return 2


def stair_tread_count_straight_plan_proxy(riser_count_plan_proxy: int) -> int:
    """Straight-run documentation tread count (interior treads = risers − 1), clamped 0–35."""
    n = int(riser_count_plan_proxy)
    if n < 2:
        return 0
    return max(0, min(35, n - 1))


def stair_run_bearing_deg_ccw_from_plan_x(
    x0_mm: float, y0_mm: float, x1_mm: float, y1_mm: float
) -> float:
    """Run direction in degrees CCW from +X (plan X right), for documentation arrows."""
    dx = float(x1_mm) - float(x0_mm)
    dy = float(y1_mm) - float(y0_mm)
    return round(math.degrees(math.atan2(dy, dx)), 3)


def stair_plan_up_down_label(base_z_mm: float, top_z_mm: float) -> str:
    """Ascending label along the modeled level jump (+Z top versus base)."""
    d = float(top_z_mm) - float(base_z_mm)
    if d > _STAIR_DOC_Z_EPS_MM:
        return "UP"
    if d < -_STAIR_DOC_Z_EPS_MM:
        return "DOWN"
    return "FLAT"


def stair_plan_break_visibility_token(
    view_range_clip_mm: tuple[float, float, float],
    sz0: float,
    sz1: float,
) -> str | None:
    """Plan view-range / cut-plane token when vertical span is resolved.

    Tokens: ``cutSplitsSpan``, ``spanFullyBelowCut``, ``spanFullyAboveCut``.
    Returns ``None`` when classification does not apply.
    """
    _lo, _hi, cut_z = view_range_clip_mm
    a0, a1 = (float(sz0), float(sz1)) if float(sz0) <= float(sz1) else (float(sz1), float(sz0))
    if a1 - a0 <= _STAIR_DOC_Z_EPS_MM:
        return None
    if a0 + _STAIR_DOC_RANGE_EPS_MM < cut_z < a1 - _STAIR_DOC_RANGE_EPS_MM:
        return "cutSplitsSpan"
    if cut_z >= a1 - _STAIR_DOC_RANGE_EPS_MM:
        return "spanFullyBelowCut"
    if cut_z <= a0 + _STAIR_DOC_RANGE_EPS_MM:
        return "spanFullyAboveCut"
    return None


def stair_documentation_diagnostics(
    doc: Document,
    stair: StairElem,
    *,
    riser_count_plan_proxy: int,
) -> list[dict[str, Any]]:
    """Non-authoritative documentation diagnostics (parallel to advisor constraints)."""
    out: list[dict[str, Any]] = []
    bl = doc.elements.get(stair.base_level_id)
    tl = doc.elements.get(stair.top_level_id)
    if not isinstance(bl, LevelElem):
        out.append({"code": "stair_missing_level", "role": "base"})
    if not isinstance(tl, LevelElem):
        out.append({"code": "stair_missing_level", "role": "top"})
    if not isinstance(bl, LevelElem) or not isinstance(tl, LevelElem):
        return out
    z_lo = float(min(bl.elevation_mm, tl.elevation_mm))
    z_hi = float(max(bl.elevation_mm, tl.elevation_mm))
    rise_story = z_hi - z_lo
    if rise_story <= _STAIR_DOC_Z_EPS_MM:
        out.append({"code": "stair_invalid_level_rise"})
        return out
    r_mm = float(stair.riser_mm)
    if r_mm > 1e-6 and riser_count_plan_proxy >= 2:
        modeled = float(riser_count_plan_proxy) * r_mm
        tol = max(50.0, 0.15 * rise_story)
        if abs(modeled - rise_story) > tol:
            out.append(
                {
                    "code": "stair_riser_rise_mismatch",
                    "riseStoryMm": round(rise_story, 3),
                    "riserCountPlanProxy": riser_count_plan_proxy,
                    "riserMm": round(r_mm, 3),
                }
            )
    return out
