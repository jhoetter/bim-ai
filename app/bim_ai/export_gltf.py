"""glTF 2.0 JSON export — axis-aligned boxes + TRS nodes aligned with packages/web/src/Viewport.tsx."""

from __future__ import annotations

import base64
import json
import math
import struct
from dataclasses import dataclass
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.opening_cut_primitives import (
    complement_unit_segments,
    complement_vertical_spans_m,
    floor_panels_axis_aligned_rect_with_single_hole_mm,
    hosted_opening_t_span_normalized,
    merge_unit_spans,
    xz_bounds_mm_from_poly,
)

EXPORT_GEOMETRY_KINDS: frozenset[str] = frozenset(
    {"wall", "floor", "roof", "door", "window", "room", "stair", "slab_opening"}
)
VERT_BYTES = 6 * 4  # POSITION(vec3)+NORMAL(vec3) as f32


def _kind_counts(doc: Document) -> dict[str, int]:
    kinds: dict[str, int] = {}
    for e in doc.elements.values():
        k = getattr(e, "kind", "?")
        kinds[k] = kinds.get(k, 0) + 1
    return kinds


def _unsupported_geometry_entries(counts_by_kind: dict[str, int]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for k in sorted(counts_by_kind.keys()):
        if k in EXPORT_GEOMETRY_KINDS or k == "level":
            continue
        out.append({"kind": k, "count": counts_by_kind[k]})
    return out


def _exported_geometry_counts(counts_by_kind: dict[str, int]) -> dict[str, int]:
    return {k: counts_by_kind[k] for k in sorted(EXPORT_GEOMETRY_KINDS) if counts_by_kind.get(k)}


def exchange_parity_manifest_fields_from_document(doc: Document) -> dict[str, Any]:
    """Shared kernel statistics for exchange manifests (IFC/glTF symmetry)."""

    counts = _kind_counts(doc)
    return {
        "elementCount": len(doc.elements),
        "countsByKind": dict(sorted(counts.items())),
        "exportedGeometryKinds": _exported_geometry_counts(counts),
        "unsupportedDocumentKindsDetailed": _unsupported_geometry_entries(counts),
    }


def exchange_parity_manifest_fields(
    *,
    element_count: int,
    counts_by_kind: dict[str, int],
) -> dict[str, Any]:
    """Parity subset when only aggregated counts exist (fixtures / tests)."""

    return {
        "elementCount": element_count,
        "countsByKind": dict(sorted(counts_by_kind.items())),
        "exportedGeometryKinds": _exported_geometry_counts(counts_by_kind),
        "unsupportedDocumentKindsDetailed": _unsupported_geometry_entries(counts_by_kind),
    }


def export_manifest_extension_payload(doc: Document) -> dict[str, Any]:
    parity = exchange_parity_manifest_fields_from_document(doc)
    return {
        **parity,
        "meshEncoding": "bim_ai_box_primitive_v0",
        "hint": "Meshes: GET /api/models/{id}/exports/model.gltf",
    }


def build_visual_export_manifest(doc: Document) -> dict[str, Any]:
    ext_payload = export_manifest_extension_payload(doc)
    return {
        "asset": {"version": "2.0", "generator": "bim-ai/export_manifest_v1"},
        "extensionsUsed": ["BIM_AI_exportManifest_v0"],
        "extensions": {"BIM_AI_exportManifest_v0": ext_payload},
        "scenes": [{"nodes": []}],
        "scene": 0,
        "nodes": [],
        "meshes": [],
    }


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _elev_m(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return el.elevation_mm / 1000.0 if isinstance(el, LevelElem) else 0.0


def _hosted_xz_m(hosted: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx = wall.start.x_mm / 1000.0
    sz = wall.start.y_mm / 1000.0
    dx = wall.end.x_mm / 1000.0 - sx
    dz = wall.end.y_mm / 1000.0 - sz
    length = max(1e-6, math.hypot(dx, dz))
    ux = dx / length
    uz = dz / length
    return sx + ux * hosted.along_t * length, sz + uz * hosted.along_t * length


def _wall_yaw(wall: WallElem) -> float:
    sx = wall.start.x_mm / 1000.0
    sz = wall.start.y_mm / 1000.0
    return math.atan2(wall.end.y_mm / 1000.0 - sz, wall.end.x_mm / 1000.0 - sx)


def _quat_yaw_y_rad(yaw: float) -> list[float]:
    """Unit quaternion [qx,qy,qz,qw] for RHS rotation yaw about +Y."""
    half = yaw * 0.5
    return [0.0, math.sin(half), 0.0, math.cos(half)]


def _emit_tri(
    buf: bytearray,
    v0: tuple[float, float, float],
    v1: tuple[float, float, float],
    v2: tuple[float, float, float],
    n: tuple[float, float, float],
) -> None:
    for p in (v0, v1, v2):
        buf.extend(struct.pack("<ffffff", p[0], p[1], p[2], n[0], n[1], n[2]))


def _box_interleaved_bytes(hx: float, hy: float, hz: float) -> tuple[bytes, int]:
    """36 vertices × 6 floats — axis-aligned [-hx,+hx]×[-hy,+hy]×[-hz,+hz]; 36 unique verts (indexed)."""
    x, y, z = hx, hy, hz
    buf = bytearray()
    nz_p = (0.0, 0.0, 1.0)
    _emit_tri(buf, (-x, -y, z), (x, -y, z), (x, y, z), nz_p)
    _emit_tri(buf, (-x, -y, z), (x, y, z), (-x, y, z), nz_p)

    nz_m = (0.0, 0.0, -1.0)
    _emit_tri(buf, (x, -y, -z), (-x, -y, -z), (-x, y, -z), nz_m)
    _emit_tri(buf, (x, -y, -z), (-x, y, -z), (x, y, -z), nz_m)

    nx_p = (1.0, 0.0, 0.0)
    _emit_tri(buf, (x, -y, -z), (x, -y, z), (x, y, z), nx_p)
    _emit_tri(buf, (x, -y, -z), (x, y, z), (x, y, -z), nx_p)

    nx_m = (-1.0, 0.0, 0.0)
    _emit_tri(buf, (-x, -y, z), (-x, -y, -z), (-x, y, -z), nx_m)
    _emit_tri(buf, (-x, -y, z), (-x, y, -z), (-x, y, z), nx_m)

    ny_p = (0.0, 1.0, 0.0)
    _emit_tri(buf, (-x, y, -z), (-x, y, z), (x, y, z), ny_p)
    _emit_tri(buf, (-x, y, -z), (x, y, z), (x, y, -z), ny_p)

    ny_m = (0.0, -1.0, 0.0)
    _emit_tri(buf, (-x, -y, z), (-x, -y, -z), (x, -y, -z), ny_m)
    _emit_tri(buf, (-x, -y, z), (x, -y, -z), (x, -y, z), ny_m)

    vcount = len(buf) // VERT_BYTES
    return bytes(buf), vcount


@dataclass(frozen=True, slots=True)
class _GeomBox:
    kind: str
    elem_id: str
    translation: tuple[float, float, float]
    yaw: float
    hx: float
    hy: float
    hz: float


def _collect_geom_boxes(doc: Document) -> list[_GeomBox]:
    boxes: list[_GeomBox] = []

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
            seg_norm = [
                sg for sg in cand_raw if sg[1] - sg[0] >= min_seg_frac - 1e-12
            ]

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
                    _clamp(win.sill_height_mm / 1000.0, 0.06, max(0.1, height_m - 0.12))
                )
                h_win_m = float(
                    _clamp(
                        win.height_mm / 1000.0,
                        0.05,
                        max(0.1, height_m - sill_m - 0.06),
                    )
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
                    _GeomBox(
                        "wall",
                        uid_wall,

                        (cx_world, cy_wall, cz_world),

                        yaw_wall,

                        seg_len_half,

                        hy_wall,

                        thick_half,
                    )

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
                    _GeomBox(
                        "floor",
                        pane_id,
                        (cx_mm_p / 1000.0, ty, cz_mm_p / 1000.0),

                        0.0,

                        hx_p,

                        th / 2.0,

                        hz_p,
                    )
                )

        else:

            cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts)

            tx = cx_mm / 1000.0

            tz = cz_mm / 1000.0

            hx = (span_x / 1000.0) / 2.0

            hz = (span_z / 1000.0) / 2.0

            boxes.append(_GeomBox("floor", fid, (tx, ty, tz), 0.0, hx, th / 2.0, hz))

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
            _GeomBox(
                "slab_opening",
                oid,
                (cx_mm / 1000.0, ty_so, cz_mm / 1000.0),
                0.0,
                hx_so,
                hy_so,
                hz_so,
            )
        )

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        pts = [(p.x_mm, p.y_mm) for p in rf.footprint_mm]
        if len(pts) < 3:
            continue
        cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts)
        ov = _clamp(float(rf.overhang_mm or 0) / 1000.0, 0.0, 5.0)
        elev = _elev_m(doc, rf.reference_level_id)
        rise = _clamp(float(rf.slope_deg or 25) / 70.0, 0.25, 2.8)
        sx_m = max(span_x / 1000.0 + ov * 0.08, 3.0)
        sz_m = max(span_z / 1000.0 + ov * 0.08, 3.0)
        tx = cx_mm / 1000.0
        tz = cz_mm / 1000.0
        ty = elev + ov * 0.12 + rise / 2.0
        boxes.append(_GeomBox("roof", rid, (tx, ty, tz), 0.0, sx_m / 2.0, rise / 2.0, sz_m / 2.0))

    for sid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, StairElem)):
        st = doc.elements[sid]
        assert isinstance(st, StairElem)
        sx = st.run_start.x_mm / 1000.0
        sz = st.run_start.y_mm / 1000.0
        dx = st.run_end.x_mm / 1000.0 - sx
        dz = st.run_end.y_mm / 1000.0 - sz
        length = max(1e-3, math.hypot(dx, dz))
        width = _clamp(st.width_mm / 1000.0, 0.3, 4.0)
        bl = doc.elements.get(st.base_level_id)
        tl = doc.elements.get(st.top_level_id)
        rise_mm = (
            abs(tl.elevation_mm - bl.elevation_mm)
            if isinstance(bl, LevelElem) and isinstance(tl, LevelElem)
            else float(st.riser_mm) * 16.0
        )
        rise = _clamp(rise_mm / 1000.0, 0.5, 12.0)
        elev_base = _elev_m(doc, st.base_level_id)
        yaw_stair = math.atan2(dx, dz)
        boxes.append(
            _GeomBox("stair", sid, (sx + dx * 0.5, elev_base + rise / 2.0, sz + dz * 0.5), yaw_stair, length / 2.0, rise / 2.0, width / 2.0)
        )

    for did in sorted(eid for eid, e in doc.elements.items() if isinstance(e, DoorElem)):
        d = doc.elements[did]
        assert isinstance(d, DoorElem)
        wall = doc.elements.get(d.wall_id)
        if not isinstance(wall, WallElem):
            continue
        px, pz = _hosted_xz_m(d, wall)
        elev = _elev_m(doc, wall.level_id)
        height = _clamp((wall.height_mm / 1000.0) * 0.86, 0.6, 2.2)
        width_d = _clamp(d.width_mm / 1000.0, 0.35, 4.0)
        depth = _clamp(wall.thickness_mm / 1000.0 + 0.08, 0.08, 2.0)
        yaw = _wall_yaw(wall)
        hy = height / 2.0
        boxes.append(_GeomBox("door", did, (px, elev + hy, pz), yaw, width_d / 2.0, hy, depth / 2.0))

    for zid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WindowElem)):
        win = doc.elements[zid]
        assert isinstance(win, WindowElem)
        wall = doc.elements.get(win.wall_id)
        if not isinstance(wall, WallElem):
            continue
        px, pz = _hosted_xz_m(win, wall)
        elev = _elev_m(doc, wall.level_id)
        sill = _clamp(win.sill_height_mm / 1000.0, 0.06, wall.height_mm / 1000.0 - 0.08)
        h_win = _clamp(
            win.height_mm / 1000.0,
            0.05,
            wall.height_mm / 1000.0 - sill - 0.06,
        )
        width_w = _clamp(win.width_mm / 1000.0, 0.14, 4.0)
        depth = _clamp(wall.thickness_mm / 1000.0 + 0.02, 0.06, 1.5)
        yaw = _wall_yaw(wall)
        boxes.append(_GeomBox("window", zid, (px, elev + sill + h_win / 2.0, pz), yaw, width_w / 2.0, h_win / 2.0, depth / 2.0))

    for rm_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoomElem)):
        rm = doc.elements[rm_id]
        assert isinstance(rm, RoomElem)
        pts = [(p.x_mm, p.y_mm) for p in rm.outline_mm]
        if len(pts) < 3:
            continue
        cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts)
        elev = _elev_m(doc, rm.level_id)
        slab_half = 0.035  # ±0.035 m ≈ viewport ribbon slab
        ty = elev + slab_half + 1e-6
        hx = (span_x / 1000.0) / 2.0
        hz = (span_z / 1000.0) / 2.0
        boxes.append(_GeomBox("room", rm_id, (cx_mm / 1000.0, ty, cz_mm / 1000.0), 0.0, hx, slab_half, hz))

    return boxes


def bounds_position_world_aabb_geom_box(gb: _GeomBox) -> tuple[list[float], list[float]]:
    """World-space axis-aligned bounds for a yaw-Y box primitive at gb.translation."""

    yaw = gb.yaw
    c_y, s_y = math.cos(yaw), math.sin(yaw)
    mn = [math.inf, math.inf, math.inf]
    mx = [-math.inf, -math.inf, -math.inf]
    for lx in (-gb.hx, gb.hx):
        for ly in (-gb.hy, gb.hy):
            for lz in (-gb.hz, gb.hz):
                rx = lx * c_y + lz * s_y
                ry = ly
                rz = -lx * s_y + lz * c_y
                px = rx + gb.translation[0]
                py = ry + gb.translation[1]
                pz = rz + gb.translation[2]
                mn[0] = min(mn[0], px)
                mn[1] = min(mn[1], py)
                mn[2] = min(mn[2], pz)
                mx[0] = max(mx[0], px)
                mx[1] = max(mx[1], py)
                mx[2] = max(mx[2], pz)
    return mn, mx


_KIND_MAT_IDX = {
    "wall": 0,
    "floor": 1,
    "roof": 2,
    "door": 3,
    "window": 4,
    "room": 5,
    "stair": 6,
    "slab_opening": 7,
}

_GLB_MAT_SLOTS: tuple[tuple[str, tuple[float, float, float], float], ...] = (
    ("wall", (203 / 255, 213 / 255, 225 / 255), 0.92),
    ("floor", (34 / 255, 197 / 255, 94 / 255), 0.9),
    ("roof", (251 / 255, 146 / 255, 60 / 255), 0.74),
    ("door", (103 / 255, 232 / 255, 249 / 255), 0.88),
    ("window", (233 / 255, 213 / 255, 255 / 255), 0.9),
    ("room", (96 / 255, 165 / 255, 250 / 255), 0.85),
    ("stair", (202 / 255, 138 / 255, 4 / 255), 0.8),
    ("slab_opening", (236 / 255, 72 / 255, 153 / 255), 0.78),
)


def _category_materials_gltf() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for name, rgb, rough in _GLB_MAT_SLOTS:
        r, g, b = rgb
        out.append(
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [r, g, b, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": rough,
                },
            }
        )
    return out


def _document_to_gltf_tree_and_bins(doc: Document) -> tuple[dict[str, Any], bytes]:
    mf_payload = export_manifest_extension_payload(doc)

    meshes: list[dict[str, Any]] = []
    nodes: list[dict[str, Any]] = []
    bins = bytearray()
    buffer_views: list[dict[str, Any]] = []
    accessors: list[dict[str, Any]] = []

    def align4(off: int) -> int:
        pad = (-off) % 4
        return off + pad

    geo_boxes = sorted(_collect_geom_boxes(doc), key=lambda b: (b.kind, b.elem_id))

    for lid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)):
        lvl = doc.elements[lid]
        assert isinstance(lvl, LevelElem)
        em = lvl.elevation_mm / 1000.0
        nodes.append(
            {
                "name": f"level:{lid}",
                "rotation": _quat_yaw_y_rad(0.0),
                "scale": [1.0, 1.0, 1.0],
                "translation": [0.0, 0.0, 0.0],
                "extras": {
                    "bimAiSemantic": "level",
                    "elevationM": float(em),
                    "elementId": lid,
                    "note": "metadata node (no geometry)",
                },
            }
        )

    for gb in geo_boxes:
        vbytes, vcount = _box_interleaved_bytes(gb.hx, gb.hy, gb.hz)
        vtx_off = len(bins)
        bins.extend(vbytes)

        vtx_bvi = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": vtx_off, "byteLength": len(vbytes), "byteStride": 24, "target": 34962})

        acc_pos = len(accessors)
        accessors.append(
            {
                "bufferView": vtx_bvi,
                "byteOffset": 0,
                "componentType": 5126,
                "count": vcount,
                "type": "VEC3",
            }
        )

        accessors.append(
            {
                "bufferView": vtx_bvi,
                "byteOffset": 12,
                "componentType": 5126,
                "count": vcount,
                "type": "VEC3",
            }
        )
        acc_norm = acc_pos + 1

        tri_indices = list(range(vcount))

        pos_min, pos_max = bounds_position_world_aabb_geom_box(gb)
        accessors[acc_pos].update({"min": pos_min, "max": pos_max})

        idx_off_raw = vtx_off + len(vbytes)
        idx_off = align4(idx_off_raw)
        bins.extend(b"\x00" * (idx_off - idx_off_raw))
        ix_start = idx_off

        ix_bytes_len = len(tri_indices) * 2
        for ix in tri_indices:
            bins.extend(struct.pack("<H", ix))

        idx_bvi = len(buffer_views)

        ix_end_actual = ix_start + ix_bytes_len

        pad_after = (-ix_end_actual) % 4
        bins.extend(b"\x00" * pad_after)

        buffer_views.append(
            {"buffer": 0, "byteOffset": ix_start, "byteLength": ix_bytes_len, "target": 34963},
        )

        ix_acc_idx = len(accessors)
        accessors.append(
            {
                "bufferView": idx_bvi,
                "byteOffset": 0,
                "componentType": 5123,
                "count": len(tri_indices),
                "type": "SCALAR",
            }
        )

        mesh_idx = len(meshes)
        meshes.append(
            {
                "name": f"{gb.kind}:{gb.elem_id}",
                "primitives": [
                    {
                        "attributes": {"POSITION": acc_pos, "NORMAL": acc_norm},
                        "indices": ix_acc_idx,
                        "material": _KIND_MAT_IDX[gb.kind],
                    }
                ],
            }
        )

        nodes.append(
            {
                "name": f"{gb.kind}:{gb.elem_id}",
                "mesh": mesh_idx,
                "translation": [float(gb.translation[0]), float(gb.translation[1]), float(gb.translation[2])],
                "rotation": _quat_yaw_y_rad(gb.yaw),
                "scale": [1.0, 1.0, 1.0],
                "extras": {"bimAiEncoding": mf_payload["meshEncoding"], "elementId": gb.elem_id},
            }
        )

    mats = _category_materials_gltf()

    scene_children = list(range(len(nodes)))

    tree: dict[str, Any] = {
        "asset": {"version": "2.0", "generator": "bim-ai/visual_gltf_v0"},
        "extensionsUsed": ["BIM_AI_exportManifest_v0"],
        "extensions": {"BIM_AI_exportManifest_v0": mf_payload},
        "buffers": [{"byteLength": len(bins)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "materials": mats,
        "meshes": meshes,
        "nodes": nodes,
        "scenes": [{"nodes": scene_children}],
        "scene": 0,
    }
    return tree, bytes(bins)


def document_to_gltf(doc: Document) -> dict[str, Any]:
    tree, bins = _document_to_gltf_tree_and_bins(doc)
    tex_b64 = base64.standard_b64encode(bins).decode("ascii")
    out = dict(tree)
    out["buffers"] = [
        {"byteLength": len(bins), "uri": f"data:application/octet-stream;base64,{tex_b64}"}
    ]
    return out


_GLTF_MAGIC = 0x46546C67
_GLB_JSON_CHUNK_TYPE = 0x4E4F534A
_GLB_BIN_CHUNK_TYPE = 0x004E4942


def encode_glb(gltf_without_uri: dict[str, Any], bin_data: bytes) -> bytes:
    """Pack glTF 2 JSON (first buffer omitted `uri`) + BIN chunk into `.glb` bytes."""

    buf_len = gltf_without_uri.get("buffers", [{}])[0].get("byteLength")
    if buf_len != len(bin_data):
        raise ValueError("gltf buffers[0].byteLength must match embedded BIN chunk size")

    json_bytes = json.dumps(gltf_without_uri, separators=(",", ":")).encode("utf-8")
    json_pad = (-len(json_bytes)) % 4
    json_bytes += b" " * json_pad

    bin_pad = (-len(bin_data)) % 4
    padded_bin = bin_data + (b"\x00" * bin_pad)

    json_chunk_len = len(json_bytes)
    bin_chunk_len = len(padded_bin)
    total = 12 + 8 + json_chunk_len + 8 + bin_chunk_len

    header = struct.pack("<III", _GLTF_MAGIC, 2, total)
    json_hdr = struct.pack("<II", json_chunk_len, _GLB_JSON_CHUNK_TYPE)
    bin_hdr = struct.pack("<II", bin_chunk_len, _GLB_BIN_CHUNK_TYPE)
    return header + json_hdr + json_bytes + bin_hdr + padded_bin


def document_to_glb_bytes(doc: Document) -> bytes:
    tree, bins = _document_to_gltf_tree_and_bins(doc)
    return encode_glb(tree, bins)


def dumps_gltf_json(doc: Document) -> str:
    return json.dumps(document_to_gltf(doc), indent=2)
