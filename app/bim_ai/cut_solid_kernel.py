"""Shared cut-solid derivation for hosted wall gaps and slab floor panels (WP-B02/B03/E03).

glTF meshing and future plan/section consumers should derive rectangular rough cuts from this module
instead of duplicating segmentation logic in exporters.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, SlabOpeningElem, WallElem, WindowElem
from bim_ai.opening_cut_primitives import (
    complement_unit_segments,
    complement_vertical_spans_m,
    floor_panels_axis_aligned_rect_with_single_hole_mm,
    hosted_opening_half_span_mm,
    hosted_opening_t_span_normalized,
    merge_unit_spans,
    wall_plan_axis_aligned_xy,
    wall_plan_yaw_deg,
    xz_bounds_mm_from_poly,
)


def collect_hosted_cut_manifest_warnings(doc: Document) -> list[dict[str, Any]]:
    """Explicit manifest rows when rectangular gap segmentation may be approximate on skew walls."""

    hosted_by_wall: dict[str, list[DoorElem | WindowElem]] = {}
    for e in doc.elements.values():
        if isinstance(e, DoorElem):
            hosted_by_wall.setdefault(e.wall_id, []).append(e)
        elif isinstance(e, WindowElem):
            hosted_by_wall.setdefault(e.wall_id, []).append(e)

    out: list[dict[str, Any]] = []

    for wid, e in doc.elements.items():
        if not isinstance(e, WallElem):
            continue
        kids = hosted_by_wall.get(wid, [])
        if not kids:
            continue
        if wall_plan_axis_aligned_xy(e):
            continue
        out.append(
            {
                "code": "nonAxisAlignedWallHostedCutsApproximated",
                "message": (
                    "Wall is skewed vs world XY; hosted door/window rectangular cuts reuse the same "
                    "segmented prism kernel as cardinal walls — validate in views where precision matters."
                ),
                "wallId": wid,
                "hostedOpeningIds": sorted(k.id for k in kids),
                "hostedOpeningKinds": sorted({k.kind for k in kids}),
            }
        )

    return sorted(out, key=lambda row: str(row["wallId"]))


def collect_skew_wall_hosted_opening_evidence_v0(doc: Document) -> dict[str, Any] | None:
    """Deterministic manifest rows for hosted openings on non-axis-aligned walls (WP-B02 / E03 / X02)."""

    rows: list[dict[str, Any]] = []

    for e in doc.elements.values():
        if not isinstance(e, (DoorElem, WindowElem)):
            continue
        w = doc.elements.get(e.wall_id)
        if not isinstance(w, WallElem):
            continue
        if wall_plan_axis_aligned_xy(w):
            continue
        tspan = hosted_opening_t_span_normalized(e, w)
        if tspan is None:
            continue
        t0, t1 = tspan
        rows.append(
            {
                "openingId": e.id,
                "kind": e.kind,
                "wallId": w.id,
                "openingTSpanNormalized": [round(float(t0), 6), round(float(t1), 6)],
                "wallYawDeg": wall_plan_yaw_deg(w),
                "halfSpanAlongWallMm": round(hosted_opening_half_span_mm(e), 3),
            },
        )

    if not rows:
        return None

    rows.sort(key=lambda r: (str(r["wallId"]), str(r["openingId"])))
    return {"format": "skewWallHostedOpeningEvidence_v0", "openings": rows}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _elev_m(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return el.elevation_mm / 1000.0 if isinstance(el, LevelElem) else 0.0


@dataclass(frozen=True, slots=True)
class CutSolidBox:
    """Axis-aligned yaw-Y box primitive in world metres (matches glTF wall/floor/slab_opening slicing)."""

    kind: str
    elem_id: str
    translation: tuple[float, float, float]
    yaw: float
    hx: float
    hy: float
    hz: float


def collect_wall_floor_slab_cut_boxes(doc: Document) -> list[CutSolidBox]:
    """Wall prisms segmented by hosted door spans + vertical window spans; floors with rectangular void panels."""

    boxes: list[CutSolidBox] = []

    hosted_by_wall: dict[str, list[DoorElem | WindowElem]] = {}
    for e in doc.elements.values():
        if isinstance(e, DoorElem):
            hosted_by_wall.setdefault(e.wall_id, []).append(e)
        elif isinstance(e, WindowElem):
            hosted_by_wall.setdefault(e.wall_id, []).append(e)

    for wid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = doc.elements[wid]
        assert isinstance(w, WallElem)
        sx = w.start.x_mm / 1000.0
        sz = w.start.y_mm / 1000.0
        dx_m = (w.end.x_mm - w.start.x_mm) / 1000.0
        dz_m = (w.end.y_mm - w.start.y_mm) / 1000.0
        length_m = max(1e-3, math.hypot(dx_m, dz_m))
        ux, uz = (dx_m / length_m), (dz_m / length_m)
        height_m = _clamp(w.height_mm / 1000.0, 0.25, 40.0)
        thick_half = _clamp(w.thickness_mm / 1000.0, 0.05, 2.0) / 2.0
        elev_z = _elev_m(doc, w.level_id)
        yaw_wall = math.atan2(dz_m, dx_m)

        blocked_norm: list[tuple[float, float]] = []
        for dn in sorted(hosted_by_wall.get(wid, ()), key=lambda dr: (dr.along_t, dr.id)):
            if not isinstance(dn, DoorElem):
                continue
            rn = hosted_opening_t_span_normalized(dn, w)
            if rn:
                blocked_norm.append(rn)

        blocked_norm.sort(key=lambda lr: lr[0])
        min_seg_frac = max(65.0 / (length_m * 1000.0), 8e-4)
        if not blocked_norm:
            seg_norm = [(0.0, 1.0)]
        else:
            cand_raw = complement_unit_segments(merge_unit_spans(blocked_norm))
            seg_norm = [sg for sg in cand_raw if sg[1] - sg[0] >= min_seg_frac - 1e-12]

        seg_ix = 0
        for ta, tb in seg_norm:
            seg_ix += 1
            seg_frac_len = tb - ta
            if seg_frac_len < min_seg_frac:
                continue
            cen_t = (ta + tb) * 0.5
            seg_len_half = seg_frac_len * length_m * 0.5
            cx_world = sx + ux * cen_t * length_m
            cz_world = sz + uz * cen_t * length_m

            uid_base = wid if not blocked_norm else f"{wid}:seg-{seg_ix}"

            windows_here: list[WindowElem] = []
            for h in hosted_by_wall.get(wid, ()):
                if not isinstance(h, WindowElem):
                    continue
                o_seg = hosted_opening_t_span_normalized(h, w)
                if not o_seg:
                    continue
                wo0, wo1 = o_seg
                overlap = min(tb, wo1) - max(ta, wo0)
                if overlap <= 1e-5:
                    continue
                windows_here.append(h)

            wall_top_y = elev_z + height_m
            blocked_vertical: list[tuple[float, float]] = []
            for win in sorted(windows_here, key=lambda ww: (ww.sill_height_mm / 1000.0, ww.id)):
                sill_m = float(
                    _clamp(win.sill_height_mm / 1000.0, 0.06, max(0.1, height_m - 0.12)),
                )
                h_win_m = float(
                    _clamp(
                        win.height_mm / 1000.0,
                        0.05,
                        max(0.1, height_m - sill_m - 0.06),
                    ),
                )
                y0w = elev_z + sill_m
                y1w = elev_z + sill_m + h_win_m
                blocked_vertical.append((y0w, y1w))

            vertical_bands = complement_vertical_spans_m(elev_z, wall_top_y, blocked_vertical)
            if not vertical_bands:
                vertical_bands = [(elev_z, wall_top_y)]

            band_ix = 0
            for yb, yt in vertical_bands:
                band_h = yt - yb
                if band_h < 0.038:
                    continue
                band_ix += 1
                cy_wall = (yb + yt) * 0.5
                hy_wall = band_h / 2.0
                uid_wall = uid_base + ("" if len(vertical_bands) == 1 else f":yv{band_ix}")

                boxes.append(
                    CutSolidBox(
                        "wall",
                        uid_wall,
                        (cx_world, cy_wall, cz_world),
                        yaw_wall,
                        seg_len_half,
                        hy_wall,
                        thick_half,
                    ),
                )

    openings_by_floor: dict[str, list[SlabOpeningElem]] = {}
    for e in doc.elements.values():
        if isinstance(e, SlabOpeningElem):
            openings_by_floor.setdefault(e.host_floor_id, []).append(e)

    gap_mm_floor = 40.0
    for fid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = doc.elements[fid]
        assert isinstance(fl, FloorElem)
        pts = [(p.x_mm, p.y_mm) for p in fl.boundary_mm]
        if len(pts) < 3:
            continue

        elev = _elev_m(doc, fl.level_id)
        th = _clamp(fl.thickness_mm / 1000.0, 0.05, 1.8)
        ty = elev + th / 2.0

        panel_rects_mm: list[tuple[float, float, float, float]] | None = None
        fl_ops = openings_by_floor.get(fid, [])
        if len(fl_ops) == 1:
            op_only = fl_ops[0]
            op_pts = [(p.x_mm, p.y_mm) for p in op_only.boundary_mm]
            if len(op_pts) >= 3:
                panel_rects_mm = floor_panels_axis_aligned_rect_with_single_hole_mm(
                    pts,
                    op_pts,
                    min_gap_mm=gap_mm_floor,
                )

        if panel_rects_mm:
            for pi, (px0, px1, py0, py1) in enumerate(panel_rects_mm):
                cx_mm_p = (px0 + px1) / 2.0
                cz_mm_p = (py0 + py1) / 2.0
                span_x_p = px1 - px0
                span_z_p = py1 - py0
                hx_p = (span_x_p / 1000.0) / 2.0
                hz_p = (span_z_p / 1000.0) / 2.0
                pane_id = f"{fid}:pane-{pi + 1}"
                boxes.append(
                    CutSolidBox(
                        "floor",
                        pane_id,
                        (cx_mm_p / 1000.0, ty, cz_mm_p / 1000.0),
                        0.0,
                        hx_p,
                        th / 2.0,
                        hz_p,
                    ),
                )
        else:
            cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts)
            tx = cx_mm / 1000.0
            tz = cz_mm / 1000.0
            hx = (span_x / 1000.0) / 2.0
            hz = (span_z / 1000.0) / 2.0
            boxes.append(CutSolidBox("floor", fid, (tx, ty, tz), 0.0, hx, th / 2.0, hz))

    for oid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, SlabOpeningElem)):
        sop = doc.elements[oid]
        assert isinstance(sop, SlabOpeningElem)
        host_floor = doc.elements.get(sop.host_floor_id)
        if not isinstance(host_floor, FloorElem):
            continue
        pts_so = [(p.x_mm, p.y_mm) for p in sop.boundary_mm]
        if len(pts_so) < 3:
            continue
        cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts_so)
        elev_so = _elev_m(doc, host_floor.level_id)
        th_so = _clamp(host_floor.thickness_mm / 1000.0, 0.05, 1.8)
        ty_so = elev_so + th_so / 2.0
        hx_so = max((span_x / 1000.0) / 2.0, 0.05)
        hz_so = max((span_z / 1000.0) / 2.0, 0.05)
        hy_so = max(th_so * 0.42, 0.03)
        boxes.append(
            CutSolidBox(
                "slab_opening",
                oid,
                (cx_mm / 1000.0, ty_so, cz_mm / 1000.0),
                0.0,
                hx_so,
                hy_so,
                hz_so,
            ),
        )

    return boxes
