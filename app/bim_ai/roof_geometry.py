"""Gable roof footprint math shared by glTF export (WP-B04 / WP-X02)."""

from __future__ import annotations

import math
from typing import Literal

RoofGeometryMode = Literal["mass_box", "gable_pitched_rectangle"]


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
            raise ValueError(
                "gable_pitched_rectangle footprintMm must be an axis-aligned rectangle (corners only)"
            )
    if len(hit) != 4:
        raise ValueError(
            "gable_pitched_rectangle footprintMm must include four distinct rectangle corners"
        )
