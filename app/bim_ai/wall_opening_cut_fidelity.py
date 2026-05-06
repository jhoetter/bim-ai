"""Hosted wall opening cut fidelity slice for plan, section, and glTF manifest (WP-B02 / WP-E03).

Deterministic join-aware status for doors/windows on walls: full rectangular cut path vs proxy/skew,
outside-host spans, missing hosts, and proximity to axis-aligned L-corner joins.
"""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import DoorElem, WallElem, WindowElem
from bim_ai.opening_cut_primitives import (
    hosted_opening_half_span_mm,
    hosted_opening_t_span_normalized,
    hosted_opening_u_projection_scale,
    wall_plan_axis_aligned_xy,
)
from bim_ai.wall_join_evidence import (
    CORNER_JOIN_BAND_CLEARANCE_MM,
    collect_wall_corner_join_evidence_v0,
)

_EPS = 1e-6


def _wall_length_mm(w: WallElem) -> float:
    return float(
        math.hypot(float(w.end.x_mm - w.start.x_mm), float(w.end.y_mm - w.start.y_mm)),
    )


def _hosted_anchor_xy_mm(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx, sy = float(wall.start.x_mm), float(wall.start.y_mm)
    dx = float(wall.end.x_mm) - sx
    dy = float(wall.end.y_mm) - sy
    length_mm = max(_EPS, math.hypot(dx, dy))
    ux, uy = dx / length_mm, dy / length_mm
    return sx + ux * float(opening.along_t) * length_mm, sy + uy * float(
        opening.along_t
    ) * length_mm


def _perp_mm(
    x: float,
    y: float,
    *,
    p0x: float,
    p0y: float,
    nx: float,
    ny: float,
) -> float:
    return (x - p0x) * nx + (y - p0y) * ny


def _u_mm(
    x: float,
    y: float,
    *,
    p0x: float,
    p0y: float,
    tx: float,
    ty: float,
) -> float:
    return (x - p0x) * tx + (y - p0y) * ty


def corner_join_rows_for_document(doc: Document) -> list[dict[str, Any]]:
    ev = collect_wall_corner_join_evidence_v0(doc)
    if not ev:
        return []
    rows = ev.get("joins")
    return list(rows) if isinstance(rows, list) else []


def opening_visible_in_section_cut_strip(
    opening: DoorElem | WindowElem,
    wall: WallElem,
    *,
    wall_clip_by_id: dict[str, tuple[float, float]],
    p0x: float,
    p0y: float,
    tx: float,
    ty: float,
    nx: float,
    ny: float,
    half: float,
) -> bool:
    """Same geometric gate as ``section_projection_primitives`` door/window primitive emission."""

    span_u = wall_clip_by_id.get(wall.id)
    if span_u is None:
        return False
    px_mm, py_mm = _hosted_anchor_xy_mm(opening, wall)
    if abs(_perp_mm(px_mm, py_mm, p0x=p0x, p0y=p0y, nx=nx, ny=ny)) > half + _EPS:
        return False

    u_scale = max(_EPS, hosted_opening_u_projection_scale(wall, tx, ty))
    half_du = hosted_opening_half_span_mm(opening) * u_scale

    u_c = _u_mm(px_mm, py_mm, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
    u_lo_w, u_hi_w = span_u
    if u_c + half_du < u_lo_w - _EPS or u_c - half_du > u_hi_w + _EPS:
        return False
    return True


def _pick_corner_interaction(
    opening: DoorElem | WindowElem,
    wall: WallElem,
    joins: list[dict[str, Any]],
) -> tuple[str, str, dict[str, float]] | None:
    ax, ay = _hosted_anchor_xy_mm(opening, wall)
    half_m = hosted_opening_half_span_mm(opening)
    th_half = float(wall.thickness_mm) * 0.5
    radius = half_m + th_half + CORNER_JOIN_BAND_CLEARANCE_MM

    picked: tuple[float, str, float, float] | None = None
    for j in joins:
        wids_raw = j.get("wallIds")
        if not isinstance(wids_raw, list):
            continue
        wids = [str(x) for x in wids_raw]
        if wall.id not in wids:
            continue
        vm = j.get("vertexMm")
        if not isinstance(vm, dict):
            continue
        try:
            vx = float(vm.get("xMm"))
            vy = float(vm.get("yMm"))
        except (TypeError, ValueError):
            continue
        dist = math.hypot(ax - vx, ay - vy)
        if dist > radius + _EPS:
            continue
        others = [wid for wid in wids if wid != wall.id]
        if len(others) != 1:
            continue
        adj = others[0]
        cand = (dist, adj, vx, vy)
        if picked is None:
            picked = cand
            continue
        if cand[0] < picked[0] - _EPS:
            picked = cand
        elif abs(cand[0] - picked[0]) <= _EPS and cand[1] < picked[1]:
            picked = cand

    if picked is None:
        return None
    _, adjacent_wall_id, vx, vy = picked
    return (
        "nearLCornerJoin",
        adjacent_wall_id,
        {"xMm": round(vx, 3), "yMm": round(vy, 3)},
    )


def build_wall_opening_cut_fidelity_row(
    doc: Document,
    opening: DoorElem | WindowElem,
    *,
    corner_joins: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Single deterministic evidence row (document-wide semantics; callers filter by view)."""

    joins = corner_joins or []
    half_mm = round(hosted_opening_half_span_mm(opening), 3)
    nominal_w = round(float(opening.width_mm), 3)

    wall_any = doc.elements.get(opening.wall_id)
    if not isinstance(wall_any, WallElem):
        return {
            "openingId": opening.id,
            "kind": opening.kind,
            "hostWallId": opening.wall_id,
            "openingTSpanNormalized": None,
            "halfSpanAlongWallMm": half_mm,
            "nominalWidthMm": nominal_w,
            "cutStatus": "unsafe_host",
            "skipReason": "missing_host_wall",
            "cornerInteractionToken": None,
            "cornerAdjacentWallId": None,
            "cornerVertexMm": None,
        }

    w = wall_any
    wl_mm = _wall_length_mm(w)
    tspan = hosted_opening_t_span_normalized(opening, w)

    skip_reason: str | None = None
    if tspan is None:
        cut_status = "outside_host"
        skip_reason = (
            "degenerate_wall_length" if wl_mm < 10.0 else "opening_exceeds_wall_clear_span"
        )
        t_norm: list[float] | None = None
    elif not wall_plan_axis_aligned_xy(w):
        cut_status = "proxy_cut"
        t_norm = [round(float(tspan[0]), 6), round(float(tspan[1]), 6)]
    else:
        cut_status = "full_cut"
        t_norm = [round(float(tspan[0]), 6), round(float(tspan[1]), 6)]

    corner_token: str | None = None
    corner_adj: str | None = None
    corner_v: dict[str, float] | None = None
    if cut_status != "unsafe_host":
        corner_pick = _pick_corner_interaction(opening, w, joins)
        if corner_pick is not None:
            corner_token, corner_adj, corner_v = corner_pick

    row: dict[str, Any] = {
        "openingId": opening.id,
        "kind": opening.kind,
        "hostWallId": w.id,
        "openingTSpanNormalized": t_norm,
        "halfSpanAlongWallMm": half_mm,
        "nominalWidthMm": nominal_w,
        "cutStatus": cut_status,
        "skipReason": skip_reason,
        "cornerInteractionToken": corner_token,
        "cornerAdjacentWallId": corner_adj,
        "cornerVertexMm": corner_v,
    }
    return row


def collect_wall_opening_cut_fidelity_evidence_v1(doc: Document) -> dict[str, Any] | None:
    """All hosted openings in document order for glTF extension manifest."""

    joins = corner_join_rows_for_document(doc)
    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if isinstance(e, (DoorElem, WindowElem)):
            rows.append(build_wall_opening_cut_fidelity_row(doc, e, corner_joins=joins))
    if not rows:
        return None
    rows.sort(key=lambda r: (str(r["hostWallId"]), str(r["openingId"])))
    return {"format": "wallOpeningCutFidelityEvidence_v1", "rows": rows}
