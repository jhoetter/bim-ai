"""Stair plan/section proxy counts aligned with level rise (WP-B05 slice)."""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import LevelElem, StairElem

_STAIR_DOC_Z_EPS_MM = 1e-3
_STAIR_DOC_RANGE_EPS_MM = 1e-6
_STAIR_RUN_LENGTH_DOC_EPS_MM = 1e-3
_STAIR_SCHEDULE_CORR_LABEL_SENTINEL = "__no_label__"


def _axis_aligned_bounds_mm(pts: list[tuple[float, float]]) -> dict[str, float]:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return {
        "minXmMm": round(float(min(xs)), 3),
        "maxXmMm": round(float(max(xs)), 3),
        "minYmMm": round(float(min(ys)), 3),
        "maxYmMm": round(float(max(ys)), 3),
    }


def stair_landing_placeholder_depth_mm(tread_mm: float) -> float:
    """Deterministic landing slab depth for documentation placeholders (mm)."""
    t = float(tread_mm)
    return max(400.0, min(1200.0, 2.0 * t))


def stair_plan_section_documentation_label_v0(
    *,
    plan_up_down_label: str,
    riser_count_plan_proxy: int,
    tread_count_plan_proxy: int,
    width_mm: float,
) -> str:
    """Single-line plan/section documentation token (deterministic, no levels text)."""
    ud = plan_up_down_label.strip() or "—"
    rc = int(riser_count_plan_proxy)
    tc = int(tread_count_plan_proxy)
    w = round(float(width_mm), 3)
    return f"{ud}·R{rc}·T{tc}·W{w}"


def stair_documentation_placeholders_v0(
    stair: StairElem,
    *,
    run_length_mm: float,
    plan_up_down_label: str,
    riser_count_plan_proxy: int,
    tread_count_plan_proxy: int,
) -> dict[str, Any] | None:
    """Landing AABBs, combined footprint, railing side tokens, display label (straight-run proxy).

    Returns ``None`` when the run length is degenerate (no stable hull).
    """
    if run_length_mm <= _STAIR_RUN_LENGTH_DOC_EPS_MM:
        return None
    rx0, ry0 = float(stair.run_start.x_mm), float(stair.run_start.y_mm)
    rx1, ry1 = float(stair.run_end.x_mm), float(stair.run_end.y_mm)
    dx = rx1 - rx0
    dy = ry1 - ry0
    ln = math.hypot(dx, dy)
    if ln <= _STAIR_RUN_LENGTH_DOC_EPS_MM:
        return None
    ux = dx / ln
    uy = dy / ln
    hww = float(stair.width_mm) * 0.5
    px = -uy * hww
    py = ux * hww
    depth = stair_landing_placeholder_depth_mm(float(stair.tread_mm))

    bx0, by0 = rx0 - ux * depth, ry0 - uy * depth
    bottom = [
        (rx0 + px, ry0 + py),
        (rx0 - px, ry0 - py),
        (bx0 - px, by0 - py),
        (bx0 + px, by0 + py),
    ]

    tx1, ty1 = rx1 + ux * depth, ry1 + uy * depth
    top = [
        (rx1 + px, ry1 + py),
        (rx1 - px, ry1 - py),
        (tx1 - px, ty1 - py),
        (tx1 + px, ty1 + py),
    ]
    run_strip = [
        (rx0 + px, ry0 + py),
        (rx1 + px, ry1 + py),
        (rx1 - px, ry1 - py),
        (rx0 - px, ry0 - py),
    ]
    all_pts = bottom + top + run_strip
    label = stair_plan_section_documentation_label_v0(
        plan_up_down_label=plan_up_down_label,
        riser_count_plan_proxy=riser_count_plan_proxy,
        tread_count_plan_proxy=tread_count_plan_proxy,
        width_mm=float(stair.width_mm),
    )
    side_tokens = sorted(("rail_guard_left_of_run", "rail_guard_right_of_run"))
    return {
        "bottomLandingFootprintBoundsMm": _axis_aligned_bounds_mm(bottom),
        "topLandingFootprintBoundsMm": _axis_aligned_bounds_mm(top),
        "stairTotalRunLandingFootprintBoundsMm": _axis_aligned_bounds_mm(all_pts),
        "stairRailingGuardPlaceholderSideTokens": list(side_tokens),
        "stairPlanSectionDocumentationLabel": label,
    }


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
    run_length_mm: float | None = None,
) -> list[dict[str, Any]]:
    """Non-authoritative documentation diagnostics (parallel to advisor constraints)."""
    out: list[dict[str, Any]] = []
    if run_length_mm is not None and run_length_mm <= _STAIR_RUN_LENGTH_DOC_EPS_MM:
        out.append({"code": "stair_run_length_degenerate"})
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


def stair_schedule_correlation_token_v0(*, element_id: str, documentation_label: str) -> str:
    """Stable correlation handle for schedule, plan, section, and manifest stair evidence."""
    lab = documentation_label.strip() or _STAIR_SCHEDULE_CORR_LABEL_SENTINEL
    return f"stairSchCorr_v0|{element_id}|{lab}"


def stair_schedule_row_extensions_v1(doc: Document, stair: StairElem) -> dict[str, Any]:
    """Deterministic stair schedule quantities, guardrail readback, and correlation token."""
    rx0, ry0 = float(stair.run_start.x_mm), float(stair.run_start.y_mm)
    rx1, ry1 = float(stair.run_end.x_mm), float(stair.run_end.y_mm)
    run_len_mm = math.hypot(rx1 - rx0, ry1 - ry0)

    bl = doc.elements.get(stair.base_level_id)
    tl = doc.elements.get(stair.top_level_id)
    base_ok = isinstance(bl, LevelElem)
    top_ok = isinstance(tl, LevelElem)

    ud_lab = "—"
    total_rise_mm: float | None = None
    if base_ok and top_ok:
        ble = bl if isinstance(bl, LevelElem) else None
        tle = tl if isinstance(tl, LevelElem) else None
        if ble is not None and tle is not None:
            ud_lab = stair_plan_up_down_label(float(ble.elevation_mm), float(tle.elevation_mm))
            z_lo = float(min(ble.elevation_mm, tle.elevation_mm))
            z_hi = float(max(ble.elevation_mm, tle.elevation_mm))
            rise_story = z_hi - z_lo
            if rise_story > _STAIR_DOC_Z_EPS_MM:
                total_rise_mm = round(rise_story, 3)

    rc_proxy = stair_riser_count_plan_proxy(doc, stair, run_length_mm=run_len_mm)
    tc_proxy = stair_tread_count_straight_plan_proxy(rc_proxy)

    ph = stair_documentation_placeholders_v0(
        stair,
        run_length_mm=run_len_mm,
        plan_up_down_label=ud_lab,
        riser_count_plan_proxy=rc_proxy,
        tread_count_plan_proxy=tc_proxy,
    )
    if ph is not None:
        doc_label = str(ph["stairPlanSectionDocumentationLabel"])
    else:
        doc_label = stair_plan_section_documentation_label_v0(
            plan_up_down_label=ud_lab,
            riser_count_plan_proxy=rc_proxy,
            tread_count_plan_proxy=tc_proxy,
            width_mm=float(stair.width_mm),
        )

    token = stair_schedule_correlation_token_v0(element_id=stair.id, documentation_label=doc_label)

    status = "complete"
    degenerate = run_len_mm <= _STAIR_RUN_LENGTH_DOC_EPS_MM
    if degenerate:
        status = "degenerate_run"
    elif not base_ok or not top_ok:
        status = "missing_levels"
    elif float(stair.riser_mm) <= 1e-6 or float(stair.tread_mm) <= 1e-6:
        status = "incomplete_riser_tread"

    riser_h = round(float(stair.riser_mm), 3) if float(stair.riser_mm) > 1e-6 else None
    tread_d = round(float(stair.tread_mm), 3) if float(stair.tread_mm) > 1e-6 else None

    total_run_mm: float | None = None
    if not degenerate:
        total_run_mm = round(run_len_mm, 3)

    landing_count: int | None
    landing_bounds: dict[str, float] | None
    guard_tokens: list[str]
    if ph is not None:
        landing_count = 2
        landing_bounds = dict(ph["stairTotalRunLandingFootprintBoundsMm"])
        guard_tokens = list(ph["stairRailingGuardPlaceholderSideTokens"])
    else:
        landing_count = 0
        landing_bounds = None
        guard_tokens = []
        if ph is None and not degenerate and status == "complete":
            status = "guardrail_uncorrelated"

    return {
        "riserCount": rc_proxy,
        "treadCount": tc_proxy,
        "riserHeightMm": riser_h,
        "treadDepthMm": tread_d,
        "totalRiseMm": total_rise_mm,
        "totalRunMm": total_run_mm,
        "landingCount": landing_count,
        "landingFootprintBoundsMm": landing_bounds,
        "guardrailPlaceholderSideTokens": guard_tokens,
        "stairPlanSectionDocumentationLabel": doc_label,
        "stairQuantityDerivationStatus": status,
        "baseLevelResolves": base_ok,
        "topLevelResolves": top_ok,
        "stairScheduleCorrelationToken": token,
    }
