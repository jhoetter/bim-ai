"""Gable roof footprint math shared by glTF export (WP-B04 / WP-X02)."""

from __future__ import annotations

import math
from typing import Literal

RoofGeometryMode = Literal["mass_box", "gable_pitched_rectangle"]

FootprintPlanWinding = Literal["ccw", "cw", "degenerate"]
RidgeAxisPlan = Literal["alongX", "alongZ"]


def outer_rect_extent(pts: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    """Axis-aligned bounds on the plan footprint; maps to world X and Z."""
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    return float(min(xs)), float(max(xs)), float(min(zs)), float(max(zs))


def gable_half_run_mm_and_ridge_axis(span_x: float, span_z: float) -> tuple[float, str]:
    """Ridge parallels the shorter footprint span; slope half-run is half the longer span (mm)."""
    if span_x <= span_z:
        return span_z / 2.0, "alongX"
    return span_x / 2.0, "alongZ"


def gable_ridge_rise_mm(span_x: float, span_z: float, slope_deg: float) -> tuple[float, str]:
    half_run, axis = gable_half_run_mm_and_ridge_axis(span_x, span_z)
    rise_mm = half_run * math.tan(math.radians(slope_deg))
    return rise_mm, axis


def plan_polygon_signed_area_mm2(pts: list[tuple[float, float]]) -> float:
    """Signed shoelace area on plan coordinates (x, z aliases stored as xMm/yMm)."""

    n = len(pts)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % n]
        s += x1 * z2 - x2 * z1
    return s * 0.5


def plan_polygon_winding_token(area_mm2: float, *, eps_mm2: float = 1.0) -> FootprintPlanWinding:
    if abs(area_mm2) <= eps_mm2:
        return "degenerate"
    return "ccw" if area_mm2 > 0 else "cw"


def footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm: list[tuple[float, float]]) -> bool:
    """Same geometric predicate as assert_valid_gable_pitched_rectangle_footprint_mm, non-throwing."""

    if len(footprint_mm) != 4:
        return False
    xs = [p[0] for p in footprint_mm]
    zs = [p[1] for p in footprint_mm]
    x0, x1 = min(xs), max(xs)
    z0, z1 = min(zs), max(zs)
    tol = 1.0
    corners = {(x0, z0), (x0, z1), (x1, z0), (x1, z1)}
    hit: set[tuple[float, float]] = set()
    for p in footprint_mm:
        matched = False
        for c in corners:
            if abs(p[0] - c[0]) <= tol and abs(p[1] - c[1]) <= tol:
                hit.add(c)
                matched = True
                break
        if not matched:
            return False
    return len(hit) == 4


def gable_ridge_segment_plan_mm(
    x0_mm: float,
    x1_mm: float,
    z0_mm: float,
    z1_mm: float,
    ridge_axis: RidgeAxisPlan,
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Ridge centerline in plan mm between footprint extents (parallel to ridge_axis)."""

    if ridge_axis == "alongX":
        zm = (z0_mm + z1_mm) * 0.5
        return (x0_mm, zm), (x1_mm, zm)
    xm = (x0_mm + x1_mm) * 0.5
    return (xm, z0_mm), (xm, z1_mm)


def mass_box_roof_proxy_peak_z_mm(reference_level_elevation_mm: float, slope_deg: float | None) -> float:
    """Section/plan proxy peak for roofGeometryMode=mass_box (800 mm nominal half-run heuristic)."""

    slope = float(slope_deg if slope_deg is not None else 25.0)
    rise = 800.0 * math.tan(math.radians(slope))
    return float(reference_level_elevation_mm) + rise


def assert_valid_gable_pitched_rectangle_footprint_mm(
    footprint_mm: list[tuple[float, float]],
) -> None:
    """Require four axis-aligned rectangle corners (plan mm)."""
    if len(footprint_mm) != 4:
        raise ValueError(
            "gable_pitched_rectangle footprintMm must be exactly 4 vertices (axis-aligned rectangle)"
        )
    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "gable_pitched_rectangle footprintMm must be an axis-aligned rectangle (corners only)"
        )
