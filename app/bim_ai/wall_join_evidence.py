"""Deterministic wall corner join evidence for exchange manifests (WP-B02 / WP-X02).

``collect_wall_corner_join_evidence_v0`` documents axis-aligned L-corner topology only.
``collect_wall_corner_join_summary_v1`` adds richer join classification without changing v0 rows.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import DoorElem, WallElem, WindowElem
from bim_ai.opening_cut_primitives import hosted_opening_half_span_mm, wall_plan_axis_aligned_xy

# Extra plan clearance beyond reveal-expanded half-width + half wall thickness for L-corner band.
CORNER_JOIN_BAND_CLEARANCE_MM = 150.0

_EPS_MM = 1e-3
_PARALLEL_DOT = 0.95
_PERP_DOT = 0.05


def _endpoints_rounded_mm(w: WallElem, eps_mm: float = 1.0) -> set[tuple[float, float]]:
    return {
        (round(w.start.x_mm / eps_mm) * eps_mm, round(w.start.y_mm / eps_mm) * eps_mm),
        (round(w.end.x_mm / eps_mm) * eps_mm, round(w.end.y_mm / eps_mm) * eps_mm),
    }


def _wall_unit_xy(w: WallElem) -> tuple[float, float] | None:
    dx = float(w.end.x_mm - w.start.x_mm)
    dy = float(w.end.y_mm - w.start.y_mm)
    span = math.hypot(dx, dy)
    if span < 1e-3:
        return None
    return dx / span, dy / span


def _hosted_anchor_xy_mm(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx, sy = float(wall.start.x_mm), float(wall.start.y_mm)
    dx = float(wall.end.x_mm) - sx
    dy = float(wall.end.y_mm) - sy
    length_mm = max(_EPS_MM, math.hypot(dx, dy))
    ux, uy = dx / length_mm, dy / length_mm
    return sx + ux * float(opening.along_t) * length_mm, sy + uy * float(
        opening.along_t
    ) * length_mm


def _corner_join_id(level_id: str, vx: float, vy: float, w0: str, w1: str) -> str:
    return f"join:{level_id}:{vx}:{vy}:{w0}:{w1}"


def _overlap_join_id(
    level_id: str,
    w0: str,
    w1: str,
    *,
    axis_key: str,
    anchor: float,
    lo: float,
    hi: float,
) -> str:
    return (
        f"joinOv:{level_id}:{w0}:{w1}:{axis_key}:"
        f"{round(float(anchor), 3)}:{round(float(lo), 3)}:{round(float(hi), 3)}"
    )


def _plan_token_for_kind(kind: str) -> str:
    return {
        "butt": "WJ_BUTT_AA",
        "miter_candidate": "WJ_MITER_CAND",
        "unsupported_skew": "WJ_UNSUPPORTED_SKEW",
        "proxy_overlap": "WJ_PROXY_OVERLAP",
    }[kind]


def _aa_wall_dom_axis_interval(w: WallElem) -> tuple[str, float, float, float] | None:
    """Axis-aligned wall as overlap interval on the dominant axis."""

    if not wall_plan_axis_aligned_xy(w):
        return None
    x0, y0 = float(w.start.x_mm), float(w.start.y_mm)
    x1, y1 = float(w.end.x_mm), float(w.end.y_mm)
    if abs(y1 - y0) <= _EPS_MM:
        return ("h", (y0 + y1) * 0.5, min(x0, x1), max(x0, x1))
    if abs(x1 - x0) <= _EPS_MM:
        return ("v", (x0 + x1) * 0.5, min(y0, y1), max(y0, y1))
    return None


def _collect_affected_opening_ids_corner(
    doc: Document,
    *,
    wall_a: WallElem,
    wall_b: WallElem,
    vx: float,
    vy: float,
) -> list[str]:
    walls = {wall_a.id, wall_b.id}
    out: list[str] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, (DoorElem, WindowElem)):
            continue
        if e.wall_id not in walls:
            continue
        w = doc.elements.get(e.wall_id)
        if not isinstance(w, WallElem):
            continue
        ax, ay = _hosted_anchor_xy_mm(e, w)
        half_m = hosted_opening_half_span_mm(e)
        th_half = float(w.thickness_mm) * 0.5
        radius = half_m + th_half + CORNER_JOIN_BAND_CLEARANCE_MM
        if math.hypot(ax - vx, ay - vy) <= radius + _EPS_MM:
            out.append(e.id)
    return sorted(out)


def _opening_near_horizontal_overlap_segment(
    opening: DoorElem | WindowElem,
    wall: WallElem,
    *,
    y_line: float,
    x_lo: float,
    x_hi: float,
) -> bool:
    ax, ay = _hosted_anchor_xy_mm(opening, wall)
    half_m = hosted_opening_half_span_mm(opening)
    th_half = float(wall.thickness_mm) * 0.5
    band = half_m + th_half + CORNER_JOIN_BAND_CLEARANCE_MM
    if abs(ay - y_line) > band + _EPS_MM:
        return False
    return not (ax + half_m < x_lo - _EPS_MM or ax - half_m > x_hi + _EPS_MM)


def _opening_near_vertical_overlap_segment(
    opening: DoorElem | WindowElem,
    wall: WallElem,
    *,
    x_line: float,
    y_lo: float,
    y_hi: float,
) -> bool:
    ax, ay = _hosted_anchor_xy_mm(opening, wall)
    half_m = hosted_opening_half_span_mm(opening)
    th_half = float(wall.thickness_mm) * 0.5
    band = half_m + th_half + CORNER_JOIN_BAND_CLEARANCE_MM
    if abs(ax - x_line) > band + _EPS_MM:
        return False
    return not (ay + half_m < y_lo - _EPS_MM or ay - half_m > y_hi + _EPS_MM)


def _collect_affected_opening_ids_overlap_h(
    doc: Document,
    *,
    wall_a: WallElem,
    wall_b: WallElem,
    y_line: float,
    x_lo: float,
    x_hi: float,
) -> list[str]:
    walls = {wall_a.id, wall_b.id}
    out: list[str] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, (DoorElem, WindowElem)):
            continue
        if e.wall_id not in walls:
            continue
        w = doc.elements.get(e.wall_id)
        if not isinstance(w, WallElem):
            continue
        if _opening_near_horizontal_overlap_segment(e, w, y_line=y_line, x_lo=x_lo, x_hi=x_hi):
            out.append(e.id)
    return sorted(out)


def _collect_affected_opening_ids_overlap_v(
    doc: Document,
    *,
    wall_a: WallElem,
    wall_b: WallElem,
    x_line: float,
    y_lo: float,
    y_hi: float,
) -> list[str]:
    walls = {wall_a.id, wall_b.id}
    out: list[str] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, (DoorElem, WindowElem)):
            continue
        if e.wall_id not in walls:
            continue
        w = doc.elements.get(e.wall_id)
        if not isinstance(w, WallElem):
            continue
        if _opening_near_vertical_overlap_segment(e, w, x_line=x_line, y_lo=y_lo, y_hi=y_hi):
            out.append(e.id)
    return sorted(out)


def collect_wall_corner_join_evidence_v0(doc: Document) -> dict[str, Any] | None:
    """Pairs of axis-aligned walls on one level sharing exactly one snapped vertex, directions ~perpendicular."""

    walls = [e for e in doc.elements.values() if isinstance(e, WallElem)]
    by_id: dict[str, WallElem] = {w.id: w for w in walls}

    joins: list[dict[str, Any]] = []

    # Pre-compute per-wall data; skip non-axis-aligned walls early.
    unit_by_wall: dict[str, tuple[float, float]] = {}
    pts_by_wall: dict[str, set[tuple[float, float]]] = {}
    walls_by_endpoint: defaultdict[tuple[float, float], list[str]] = defaultdict(list)
    for w in walls:
        if not wall_plan_axis_aligned_xy(w):
            continue
        u = _wall_unit_xy(w)
        if u is None:
            continue
        unit_by_wall[w.id] = u
        pts = _endpoints_rounded_mm(w)
        pts_by_wall[w.id] = pts
        for pt in pts:
            walls_by_endpoint[pt].append(w.id)

    # Only check pairs that share at least one endpoint — avoids O(n²) all-pairs scan.
    corner_checked: set[tuple[str, str]] = set()
    for wlist in walls_by_endpoint.values():
        for i in range(len(wlist)):
            ia = wlist[i]
            for j in range(i + 1, len(wlist)):
                ib = wlist[j]
                pair_key = (min(ia, ib), max(ia, ib))
                if pair_key in corner_checked:
                    continue
                corner_checked.add(pair_key)
                wa = by_id[ia]
                wb = by_id[ib]
                if wb.level_id != wa.level_id:
                    continue
                ua = unit_by_wall[ia]
                ub = unit_by_wall[ib]
                if abs(ua[0] * ub[0] + ua[1] * ub[1]) > 0.05:
                    continue
                common = pts_by_wall[ia] & pts_by_wall[ib]
                if len(common) != 1:
                    continue
                vx, vy = next(iter(common))
                joins.append(
                    {
                        "wallIds": sorted([wa.id, wb.id]),
                        "vertexMm": {"xMm": round(vx, 3), "yMm": round(vy, 3)},
                        "levelId": wa.level_id,
                        "joinKind": "corner",
                    }
                )

    if not joins:
        return None

    joins.sort(
        key=lambda row: (
            str(row["levelId"]),
            float(row["vertexMm"]["xMm"]),
            float(row["vertexMm"]["yMm"]),
            row["wallIds"][0],
            row["wallIds"][1],
        )
    )
    return {"format": "wallCornerJoinEvidence_v0", "joins": joins}


def collect_wall_corner_join_summary_v1(doc: Document) -> dict[str, Any] | None:
    """Deterministic wall join summary: corners (butt/miter/skew) + parallel proxy overlaps."""

    walls = [e for e in doc.elements.values() if isinstance(e, WallElem)]
    wall_ids = sorted(w.id for w in walls)
    by_id: dict[str, WallElem] = {w.id: w for w in walls}

    joins: list[dict[str, Any]] = []

    # Pre-compute per-wall data and group by endpoint to avoid O(n²) all-pairs scan.
    unit_by_wall: dict[str, tuple[float, float] | None] = {}
    pts_by_wall: dict[str, set[tuple[float, float]]] = {}
    walls_by_endpoint: defaultdict[tuple[float, float], list[str]] = defaultdict(list)
    for wid in wall_ids:
        w = by_id[wid]
        unit_by_wall[wid] = _wall_unit_xy(w)
        if unit_by_wall[wid] is None:
            continue
        pts = _endpoints_rounded_mm(w)
        pts_by_wall[wid] = pts
        for pt in pts:
            walls_by_endpoint[pt].append(wid)

    # Only check pairs that share at least one endpoint (corner candidates).
    corner_checked: set[tuple[str, str]] = set()
    for wlist in walls_by_endpoint.values():
        for i in range(len(wlist)):
            ia = wlist[i]
            for j in range(i + 1, len(wlist)):
                ib = wlist[j]
                pair_key = (min(ia, ib), max(ia, ib))
                if pair_key in corner_checked:
                    continue
                corner_checked.add(pair_key)
                wa = by_id[ia]
                wb = by_id[ib]
                if wb.level_id != wa.level_id:
                    continue
                ua = unit_by_wall[ia]
                ub = unit_by_wall[ib]
                if ua is None or ub is None:
                    continue
                dot = abs(ua[0] * ub[0] + ua[1] * ub[1])
                common = pts_by_wall[ia] & pts_by_wall[ib]
                if len(common) != 1:
                    continue
                vx, vy = next(iter(common))
                vx_r = round(float(vx), 3)
                vy_r = round(float(vy), 3)
                wids = sorted([wa.id, wb.id])

                if dot >= _PARALLEL_DOT:
                    continue

                aa_a = wall_plan_axis_aligned_xy(wa)
                aa_b = wall_plan_axis_aligned_xy(wb)

                if dot <= _PERP_DOT:
                    if aa_a and aa_b:
                        kind = "butt"
                        skip_reason = None
                    else:
                        kind = "miter_candidate"
                        skip_reason = None
                else:
                    kind = "unsupported_skew"
                    skip_reason = "non_square_corner"

                affected = _collect_affected_opening_ids_corner(
                    doc, wall_a=wa, wall_b=wb, vx=vx_r, vy=vy_r
                )
                joins.append(
                    {
                        "joinId": _corner_join_id(wa.level_id, vx_r, vy_r, wids[0], wids[1]),
                        "wallIds": wids,
                        "vertexMm": {"xMm": vx_r, "yMm": vy_r},
                        "levelId": wa.level_id,
                        "joinKind": kind,
                        "planDisplayToken": _plan_token_for_kind(kind),
                        "affectedOpeningIds": affected,
                        "skipReason": skip_reason,
                    }
                )

    # Group axis-aligned walls by (level, axis-kind, rounded anchor) to find overlapping pairs
    # without an O(n²) all-pairs scan.
    ax_cache: dict[str, tuple[str, float, float, float] | None] = {}
    ax_groups: defaultdict[tuple[str, str, float], list[str]] = defaultdict(list)
    for wid in wall_ids:
        iax = _aa_wall_dom_axis_interval(by_id[wid])
        ax_cache[wid] = iax
        if iax is None:
            continue
        ax_groups[(by_id[wid].level_id, iax[0], round(iax[1], 3))].append(wid)

    overlap_keys: set[tuple[str, str, str, float, float]] = set()
    for group_wids in ax_groups.values():
        for i in range(len(group_wids)):
            ia = group_wids[i]
            wa = by_id[ia]
            iax = ax_cache[ia]
            if iax is None:
                continue
            kind_ax, anchor_a, lo_a, hi_a = iax
            for j in range(i + 1, len(group_wids)):
                ib = group_wids[j]
                wb = by_id[ib]
                ibx = ax_cache[ib]
                if ibx is None:
                    continue
                _, anchor_b, lo_b, hi_b = ibx
                if kind_ax == "h":
                    if abs(anchor_a - anchor_b) > _EPS_MM:
                        continue
                    lo = max(lo_a, lo_b)
                    hi = min(hi_a, hi_b)
                    overlap_len = hi - lo
                    if overlap_len <= _EPS_MM:
                        continue
                    y_line = (anchor_a + anchor_b) * 0.5
                    cx = round((lo + hi) * 0.5, 3)
                    cy = round(y_line, 3)
                    wids = sorted([wa.id, wb.id])
                    dedupe = (wa.level_id, wids[0], wids[1], round(lo, 3), round(hi, 3))
                    if dedupe in overlap_keys:
                        continue
                    overlap_keys.add(dedupe)
                    jid = _overlap_join_id(
                        wa.level_id,
                        wids[0],
                        wids[1],
                        axis_key="h",
                        anchor=y_line,
                        lo=lo,
                        hi=hi,
                    )
                    affected = _collect_affected_opening_ids_overlap_h(
                        doc,
                        wall_a=wa,
                        wall_b=wb,
                        y_line=y_line,
                        x_lo=lo,
                        x_hi=hi,
                    )
                else:
                    if abs(anchor_a - anchor_b) > _EPS_MM:
                        continue
                    lo = max(lo_a, lo_b)
                    hi = min(hi_a, hi_b)
                    overlap_len = hi - lo
                    if overlap_len <= _EPS_MM:
                        continue
                    x_line = (anchor_a + anchor_b) * 0.5
                    cx = round(x_line, 3)
                    cy = round((lo + hi) * 0.5, 3)
                    wids = sorted([wa.id, wb.id])
                    dedupe = (wa.level_id, wids[0], wids[1], round(lo, 3), round(hi, 3))
                    if dedupe in overlap_keys:
                        continue
                    overlap_keys.add(dedupe)
                    jid = _overlap_join_id(
                        wa.level_id,
                        wids[0],
                        wids[1],
                        axis_key="v",
                        anchor=x_line,
                        lo=lo,
                        hi=hi,
                    )
                    affected = _collect_affected_opening_ids_overlap_v(
                        doc,
                        wall_a=wa,
                        wall_b=wb,
                        x_line=x_line,
                        y_lo=lo,
                        y_hi=hi,
                    )

                joins.append(
                    {
                        "joinId": jid,
                        "wallIds": wids,
                        "vertexMm": {"xMm": cx, "yMm": cy},
                        "levelId": wa.level_id,
                        "joinKind": "proxy_overlap",
                        "planDisplayToken": _plan_token_for_kind("proxy_overlap"),
                        "affectedOpeningIds": affected,
                        "skipReason": "overlap_proxy_join",
                    }
                )

    if not joins:
        return None

    joins.sort(
        key=lambda row: (
            str(row["levelId"]),
            str(row["joinKind"]),
            float(row["vertexMm"]["xMm"]),
            float(row["vertexMm"]["yMm"]),
            row["wallIds"][0],
            row["wallIds"][1],
            str(row["joinId"]),
        )
    )
    return {"format": "wallCornerJoinSummary_v1", "joins": joins}
