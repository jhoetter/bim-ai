"""Shared rectangular opening / cut helpers for visual exchange (glTF, future section/cut views).

WP-B02 / WP-B03 / WP-E03: deterministic axis-aligned rough openings on walls and slab floors.
Non-rectangular outlines stay on the proxy/bounding-box path in callers.
"""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, SlabOpeningElem, WallElem, WindowElem

# Same gap as section_projection_primitives / cut_solid_kernel floor panelization.
SLAB_OPENING_PANEL_GAP_MM = 40.0


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def wall_plan_axis_aligned_xy(w: WallElem, *, angle_tol_deg: float = 2.5) -> bool:
    """True when the wall runs ~N/E/S/W in plan (cut-solid warnings, join filters, section/plan evidence)."""

    dx = float(w.end.x_mm - w.start.x_mm)
    dy = float(w.end.y_mm - w.start.y_mm)
    span = max(math.hypot(dx, dy), 1e-6)
    if span < 1e-3:
        return True
    ang = math.degrees(math.atan2(abs(dy), abs(dx)))
    axial_slack = ang % 90.0
    axial_slack = min(axial_slack, 90.0 - axial_slack)
    return axial_slack <= angle_tol_deg + 1e-9


def wall_plan_yaw_deg(w: WallElem) -> float:
    """Plan yaw in degrees (atan2 dy,dx), rounded for manifest and plan wire."""

    dx = float(w.end.x_mm - w.start.x_mm)
    dy = float(w.end.y_mm - w.start.y_mm)
    return round(float(math.degrees(math.atan2(dy, dx))), 3)


def hosted_opening_u_projection_scale(w: WallElem, cut_tx: float, cut_ty: float) -> float:
    """|wall_unit · cut_tangent| — scales rough-opening half-width on section axis ``u`` (WP-E04)."""

    ux = float(w.end.x_mm - w.start.x_mm)
    uy = float(w.end.y_mm - w.start.y_mm)
    w_len = max(1e-6, math.hypot(ux, uy))
    wux, wuy = ux / w_len, uy / w_len
    return abs(wux * cut_tx + wuy * cut_ty)


def xz_bounds_mm_from_poly(poly_mm: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly_mm]
    zs = [p[1] for p in poly_mm]
    mn_x, mx_x = min(xs), max(xs)
    mn_z, mx_z = min(zs), max(zs)
    span_x = max(mx_x - mn_x, 1.0)
    span_z = max(mx_z - mn_z, 1.0)
    cx = (mn_x + mx_x) / 2.0
    cz = (mn_z + mx_z) / 2.0
    return cx, cz, span_x, span_z


def outer_rect_extent_mm(poly_mm: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly_mm]
    ys = [p[1] for p in poly_mm]
    return float(min(xs)), float(max(xs)), float(min(ys)), float(max(ys))


def is_axis_aligned_rectangle_outline_mm(poly_mm: list[tuple[float, float]]) -> bool:
    if len(poly_mm) < 4:
        return False
    xs = {round(p[0], 3) for p in poly_mm}
    ys = {round(p[1], 3) for p in poly_mm}
    return len(xs) <= 2 and len(ys) <= 2


def subtract_axis_aligned_rect_hole_mm(
    fx0: float,
    fx1: float,
    fy0: float,
    fy1: float,
    ox0: float,
    ox1: float,
    oy0: float,
    oy1: float,
    *,
    min_gap_mm: float,
) -> list[tuple[float, float, float, float]] | None:
    """Return up to three outer rectangles covering floor area minus hole, or ``None`` if invalid/over-wide."""
    if ox0 >= ox1 - min_gap_mm or oy0 >= oy1 - min_gap_mm:
        return None
    if fx0 >= fx1 - min_gap_mm or fy0 >= fy1 - min_gap_mm:
        return None
    if ox0 <= fx0 + min_gap_mm and ox1 >= fx1 - min_gap_mm:
        return None
    if oy0 <= fy0 + min_gap_mm and oy1 >= fy1 - min_gap_mm:
        return None
    if ox0 < fx0 - 1.0 or ox1 > fx1 + 1.0 or oy0 < fy0 - 1.0 or oy1 > fy1 + 1.0:
        return None

    ix0 = max(ox0, fx0)
    ix1 = min(ox1, fx1)
    iy0 = max(oy0, fy0)
    iy1 = min(oy1, fy1)

    out: list[tuple[float, float, float, float]] = []

    if iy0 > fy0 + min_gap_mm:
        out.append((fx0, fx1, fy0, iy0))
    if iy1 < fy1 - min_gap_mm:
        out.append((fx0, fx1, iy1, fy1))

    mid_y0 = max(fy0, iy0)
    mid_y1 = min(fy1, iy1)
    if mid_y1 > mid_y0 + min_gap_mm:
        if ix0 > fx0 + min_gap_mm:
            out.append((fx0, ix0, mid_y0, mid_y1))
        if ix1 < fx1 - min_gap_mm:
            out.append((ix1, fx1, mid_y0, mid_y1))

    return out if out else None


def merge_metric_spans(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    parts = sorted((float(min(a, b)), float(max(a, b))) for a, b in spans if b > a + 1e-6)
    merged: list[tuple[float, float]] = []
    for a0, b0 in parts:
        if not merged or merged[-1][1] < a0 - 1e-6:
            merged.append((a0, b0))
        else:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b0))
    return merged


def complement_vertical_spans_m(y_floor: float, y_top: float, blocked: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if y_top <= y_floor + 1e-6:
        return []
    spans = merge_metric_spans(blocked)
    free: list[tuple[float, float]] = []
    cursor = y_floor
    for a0, b0 in spans:
        a0 = max(a0, y_floor)
        b0 = min(b0, y_top)
        if b0 <= a0:
            continue
        if a0 > cursor + 1e-6:
            free.append((cursor, a0))
        cursor = max(cursor, b0)
    if cursor < y_top - 1e-6:
        free.append((cursor, y_top))
    return free


def merge_unit_spans(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    parts = sorted((float(min(a, b)), float(max(a, b))) for a, b in spans if b > a + 1e-9)

    merged: list[tuple[float, float]] = []

    for a0, b0 in parts:
        if not merged or merged[-1][1] < a0 - 1e-6:
            merged.append((max(0.0, a0), min(1.0, b0)))
        else:
            merged[-1] = (merged[-1][0], max(merged[-1][1], min(1.0, b0)))

    out: list[tuple[float, float]] = []
    for a1, b1 in merged:
        if b1 <= 1e-6 or a1 >= 1 - 1e-6:
            continue
        out.append((max(0.0, a1), min(1.0, b1)))
    return out


def complement_unit_segments(blocked: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not blocked:
        return [(0.0, 1.0)]

    spans = merge_unit_spans(blocked)

    free: list[tuple[float, float]] = []
    cursor = 0.0
    for a0, b0 in spans:
        if a0 > cursor + 1e-6:
            free.append((cursor, a0))
        cursor = max(cursor, b0)

    if cursor < 1.0 - 1e-6:
        free.append((cursor, 1.0))

    return free


def hosted_opening_half_span_mm(opening: DoorElem | WindowElem) -> float:
    """Half-width along wall baseline for cut/projection: nominal width/2 plus interior reveal.

    Does not change persisted ``widthMm`` on the element; used only for rough-opening segmentation.
    """
    reveal = float(opening.reveal_interior_mm or 0.0)
    if reveal < 0.0:
        reveal = 0.0
    return float(opening.width_mm) * 0.5 + reveal


def hosted_opening_t_span_normalized(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float] | None:
    """Rough opening ``t`` extent along the wall baseline in normalized [0,1] coordinates."""
    wl_mm = math.hypot(wall.end.x_mm - wall.start.x_mm, wall.end.y_mm - wall.start.y_mm)

    if wl_mm < 10.0:
        return None

    usable_half = hosted_opening_half_span_mm(opening) / wl_mm

    usable_t0 = usable_half

    usable_t1 = 1.0 - usable_half

    if usable_t1 <= usable_t0:
        return None

    ct_clamped = float(clamp(opening.along_t, usable_t0, usable_t1))

    return ct_clamped - usable_half, ct_clamped + usable_half


def floor_panels_axis_aligned_rect_with_single_hole_mm(
    floor_outline_mm: list[tuple[float, float]],
    opening_outline_mm: list[tuple[float, float]],
    *,
    min_gap_mm: float,
) -> list[tuple[float, float, float, float]] | None:
    """When both outlines are axis-aligned rectangles, return floor panels after one rectangular void."""
    if not is_axis_aligned_rectangle_outline_mm(floor_outline_mm):
        return None
    if not is_axis_aligned_rectangle_outline_mm(opening_outline_mm):
        return None
    fx0, fx1, fy0, fy1 = outer_rect_extent_mm(floor_outline_mm)
    ox0, ox1, oy0, oy1 = outer_rect_extent_mm(opening_outline_mm)
    return subtract_axis_aligned_rect_hole_mm(
        fx0, fx1, fy0, fy1,
        ox0, ox1, oy0, oy1,
        min_gap_mm=min_gap_mm,
    )


def _polygon_area_abs_mm2(poly_mm: list[tuple[float, float]]) -> float:
    if len(poly_mm) < 3:
        return 0.0
    s = 0.0
    for i, (x1, y1) in enumerate(poly_mm):
        x2, y2 = poly_mm[(i + 1) % len(poly_mm)]
        s += x1 * y2 - x2 * y1
    return abs(s) * 0.5


def _polygon_perimeter_closed_mm(poly_mm: list[tuple[float, float]]) -> float:
    if len(poly_mm) < 2:
        return 0.0
    n = len(poly_mm)
    t = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        t += math.hypot(x2 - x1, y2 - y1)
    return t


def _slab_openings_per_host_floor(doc: Document) -> dict[str, int]:
    out: dict[str, int] = {}
    for e in doc.elements.values():
        if isinstance(e, SlabOpeningElem):
            hid = e.host_floor_id
            out[hid] = out.get(hid, 0) + 1
    return out


def slab_opening_documentation_row_v0(doc: Document, opening: SlabOpeningElem) -> dict[str, Any] | None:
    """Deterministic slab void documentation row (plan/section/export readouts; WP-B03)."""

    host_any = doc.elements.get(opening.host_floor_id)
    if not isinstance(host_any, FloorElem):
        return None
    host = host_any

    op_pts = [(float(p.x_mm), float(p.y_mm)) for p in opening.boundary_mm]
    if len(op_pts) < 3:
        return None

    per_host = _slab_openings_per_host_floor(doc)
    n_host = int(per_host.get(host.id, 0))

    fx0, fx1, fy0, fy1 = outer_rect_extent_mm(op_pts)
    bounds = {
        "minX": round(fx0, 3),
        "minY": round(fy0, 3),
        "maxX": round(fx1, 3),
        "maxY": round(fy1, 3),
    }
    area = round(_polygon_area_abs_mm2(op_pts), 3)
    perim = round(_polygon_perimeter_closed_mm(op_pts), 3)

    skip_reason: str | None = None
    if n_host > 1:
        skip_reason = "multi_slab_void_on_host"
    else:
        floor_pts = [(float(p.x_mm), float(p.y_mm)) for p in host.boundary_mm]
        if len(floor_pts) < 3:
            skip_reason = "non_axis_aligned_floor_outline"
        elif not is_axis_aligned_rectangle_outline_mm(floor_pts):
            skip_reason = "non_axis_aligned_floor_outline"
        elif not is_axis_aligned_rectangle_outline_mm(op_pts):
            skip_reason = "non_axis_aligned_opening_outline"
        else:
            panels = floor_panels_axis_aligned_rect_with_single_hole_mm(
                floor_pts,
                op_pts,
                min_gap_mm=SLAB_OPENING_PANEL_GAP_MM,
            )
            if panels is None:
                skip_reason = "void_panels_unresolved"

    eligible = n_host == 1 and skip_reason is None

    row: dict[str, Any] = {
        "format": "slabOpeningDocumentationRow_v0",
        "hostFloorId": host.id,
        "hostFloorName": (host.name or "").strip() or host.id,
        "openingId": opening.id,
        "openingName": (opening.name or "").strip() or opening.id,
        "documentationToken": f"so/{opening.id}@host/{host.id}",
        "axisAlignedBoundsMm": bounds,
        "areaMm2": area,
        "perimeterMm": perim,
        "panelSplitEvidence": {"eligible": eligible},
        "skipReason": skip_reason,
    }
    if opening.is_shaft:
        row["isShaft"] = True
    return row
