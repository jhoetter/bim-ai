"""glTF 2.0 JSON export — axis-aligned boxes + TRS nodes aligned with packages/web/src/Viewport.tsx."""

from __future__ import annotations

import base64
import json
import math
import struct
from dataclasses import dataclass
from typing import Any, Literal, cast

from bim_ai.cut_solid_kernel import (
    collect_hosted_cut_manifest_warnings,
    collect_wall_floor_slab_cut_boxes,
)
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.material_assembly_resolve import material_assembly_manifest_evidence
from bim_ai.opening_cut_primitives import xz_bounds_mm_from_poly
from bim_ai.roof_geometry import gable_ridge_rise_mm, outer_rect_extent
from bim_ai.stair_plan_proxy import stair_riser_count_plan_proxy
from bim_ai.wall_join_evidence import collect_wall_corner_join_evidence_v0

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


def roof_geometry_manifest_evidence_v0(doc: Document) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, RoofElem) or e.roof_geometry_mode != "gable_pitched_rectangle":
            continue
        pts = [(p.x_mm, p.y_mm) for p in e.footprint_mm]
        x0_mm, x1_mm, z0_mm, z1_mm = outer_rect_extent(pts)
        span_x = float(x1_mm - x0_mm)
        span_z = float(z1_mm - z0_mm)
        slope = float(e.slope_deg or 25.0)
        rise_mm, axis = gable_ridge_rise_mm(span_x, span_z, slope)
        rows.append(
            {
                "elementId": eid,
                "roofGeometryMode": "gable_pitched_rectangle",
                "ridgeAxisPlan": axis,
                "spanXmMm": round(span_x, 3),
                "spanZmMm": round(span_z, 3),
                "ridgeRiseMm": round(rise_mm, 3),
                "slopeDeg": round(slope, 3),
                "overhangMm": round(float(e.overhang_mm), 3),
            }
        )
    if not rows:
        return None
    return {"format": "roofGeometryEvidence_v0", "roofs": rows}


def stair_geometry_manifest_evidence_v0(doc: Document) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, StairElem):
            continue
        bl = doc.elements.get(e.base_level_id)
        tl = doc.elements.get(e.top_level_id)
        if not isinstance(bl, LevelElem) or not isinstance(tl, LevelElem):
            continue
        z_lo = float(min(bl.elevation_mm, tl.elevation_mm))
        z_hi = float(max(bl.elevation_mm, tl.elevation_mm))
        rise_story = z_hi - z_lo
        if rise_story <= 1e-3:
            continue
        rx0, ry0 = float(e.run_start.x_mm), float(e.run_start.y_mm)
        rx1, ry1 = float(e.run_end.x_mm), float(e.run_end.y_mm)
        run_len = math.hypot(rx1 - rx0, ry1 - ry0)
        rc_proxy = stair_riser_count_plan_proxy(doc, e, run_length_mm=run_len)
        rows.append(
            {
                "elementId": eid,
                "baseLevelId": e.base_level_id,
                "topLevelId": e.top_level_id,
                "storyRiseMm": round(rise_story, 3),
                "midRunElevationMm": round(z_lo + rise_story * 0.5, 3),
                "riserCountPlanProxy": rc_proxy,
            }
        )
    if not rows:
        return None
    return {"format": "stairGeometryEvidence_v0", "stairs": rows}


def export_manifest_extension_payload(doc: Document) -> dict[str, Any]:
    parity = exchange_parity_manifest_fields_from_document(doc)
    cut_warns = collect_hosted_cut_manifest_warnings(doc)
    rgeom_roofs = roof_geometry_manifest_evidence_v0(doc)
    stair_geom = stair_geometry_manifest_evidence_v0(doc)
    corner_joins = collect_wall_corner_join_evidence_v0(doc)
    mesh_enc = "bim_ai_box_primitive_v0"
    if rgeom_roofs:
        mesh_enc += "+bim_ai_gable_roof_v0"
    if corner_joins:
        mesh_enc += "+bim_ai_wall_corner_joins_v0"
    base: dict[str, Any] = {
        **parity,
        "meshEncoding": mesh_enc,
        "hint": "Meshes: GET /api/models/{id}/exports/model.gltf",
    }
    if cut_warns:
        base["hostedCutApproximationWarnings"] = cut_warns
    asm_ev = material_assembly_manifest_evidence(doc)
    if asm_ev:
        base["materialAssemblyEvidence_v0"] = asm_ev
    if rgeom_roofs:
        base["roofGeometryEvidence_v0"] = rgeom_roofs
    if stair_geom:
        base["stairGeometryEvidence_v0"] = stair_geom
    if corner_joins:
        base["wallCornerJoinEvidence_v0"] = corner_joins
    return base


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


@dataclass(frozen=True, slots=True)
class _GableRoofVisual:
    elem_id: str
    xmin_m: float
    xmax_m: float
    zmin_m: float
    zmax_m: float
    y_eave_m: float
    y_ridge_m: float
    ridge_axis: str


def _triangle_unit_normal(
    v0: tuple[float, float, float],
    v1: tuple[float, float, float],
    v2: tuple[float, float, float],
) -> tuple[float, float, float]:
    ax = v1[0] - v0[0]
    ay = v1[1] - v0[1]
    az = v1[2] - v0[2]
    bx = v2[0] - v0[0]
    by = v2[1] - v0[1]
    bz = v2[2] - v0[2]
    nx = ay * bz - az * by
    ny = az * bx - ax * bz
    nz = ax * by - ay * bx
    L = math.hypot(nx, ny, nz)
    if L < 1e-12:
        return (0.0, 1.0, 0.0)
    return nx / L, ny / L, nz / L


def _gable_roof_interleaved_world_m(gr: _GableRoofVisual) -> tuple[bytes, int]:
    buf = bytearray()
    xmin, xmax = gr.xmin_m, gr.xmax_m
    zmin, zmax = gr.zmin_m, gr.zmax_m
    ye, yr = gr.y_eave_m, gr.y_ridge_m
    xc = 0.5 * (xmin + xmax)
    zc = 0.5 * (zmin + zmax)
    if max(xmax - xmin, zmax - zmin) < 1e-9:
        return bytes(buf), 0
    if gr.ridge_axis == "alongX":
        a0 = (xmin, ye, zmax)
        a1 = (xmax, ye, zmax)
        a2 = (xmax, yr, zc)
        a3 = (xmin, yr, zc)
        _emit_tri(buf, a0, a1, a2, _triangle_unit_normal(a0, a1, a2))
        _emit_tri(buf, a0, a2, a3, _triangle_unit_normal(a0, a2, a3))
        b0 = (xmax, ye, zmin)
        b1 = (xmin, ye, zmin)
        b2 = (xmin, yr, zc)
        b3 = (xmax, yr, zc)
        _emit_tri(buf, b0, b1, b2, _triangle_unit_normal(b0, b1, b2))
        _emit_tri(buf, b0, b2, b3, _triangle_unit_normal(b0, b2, b3))
        c0 = (xmin, ye, zmax)
        c1 = (xmax, ye, zmax)
        c2 = (xc, yr, zc)
        _emit_tri(buf, c0, c1, c2, _triangle_unit_normal(c0, c1, c2))
        d0 = (xmax, ye, zmin)
        d1 = (xmin, ye, zmin)
        d2 = (xc, yr, zc)
        _emit_tri(buf, d0, d1, d2, _triangle_unit_normal(d0, d1, d2))
    else:
        p0 = (xmax, ye, zmax)
        p1 = (xmax, ye, zmin)
        p2 = (xc, yr, zmin)
        p3 = (xc, yr, zmax)
        _emit_tri(buf, p0, p1, p2, _triangle_unit_normal(p0, p1, p2))
        _emit_tri(buf, p0, p2, p3, _triangle_unit_normal(p0, p2, p3))
        q0 = (xmin, ye, zmin)
        q1 = (xmin, ye, zmax)
        q2 = (xc, yr, zmax)
        q3 = (xc, yr, zmin)
        _emit_tri(buf, q0, q1, q2, _triangle_unit_normal(q0, q1, q2))
        _emit_tri(buf, q0, q2, q3, _triangle_unit_normal(q0, q2, q3))
        r0 = (xmax, ye, zmax)
        r1 = (xmax, ye, zmin)
        r2 = (xc, yr, zc)
        _emit_tri(buf, r0, r1, r2, _triangle_unit_normal(r0, r1, r2))
        s0 = (xmin, ye, zmin)
        s1 = (xmin, ye, zmax)
        s2 = (xc, yr, zc)
        _emit_tri(buf, s0, s1, s2, _triangle_unit_normal(s0, s1, s2))
    vcount = len(buf) // VERT_BYTES
    return bytes(buf), vcount


def _collect_gable_roof_visual_slices(doc: Document) -> list[_GableRoofVisual]:
    out: list[_GableRoofVisual] = []
    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        if rf.roof_geometry_mode != "gable_pitched_rectangle":
            continue
        pts = [(p.x_mm, p.y_mm) for p in rf.footprint_mm]
        x0_mm, x1_mm, z0_mm, z1_mm = outer_rect_extent(pts)
        rise_mm, axis = gable_ridge_rise_mm(
            float(x1_mm - x0_mm), float(z1_mm - z0_mm), float(rf.slope_deg or 25.0)
        )
        ye = _elev_m(doc, rf.reference_level_id)
        yr = ye + rise_mm / 1000.0
        out.append(
            _GableRoofVisual(
                elem_id=rid,
                xmin_m=x0_mm / 1000.0,
                xmax_m=x1_mm / 1000.0,
                zmin_m=z0_mm / 1000.0,
                zmax_m=z1_mm / 1000.0,
                y_eave_m=ye,
                y_ridge_m=yr,
                ridge_axis=axis,
            )
        )
    return out


def _interleaved_position_min_max(interleaved: bytes, vcount: int) -> tuple[list[float], list[float]]:
    mn = [math.inf, math.inf, math.inf]
    mx = [-math.inf, -math.inf, -math.inf]
    for i in range(vcount):
        off = VERT_BYTES * i
        px, py, pz = struct.unpack_from("<fff", interleaved, off)
        mn[0] = min(mn[0], px)
        mn[1] = min(mn[1], py)
        mn[2] = min(mn[2], pz)
        mx[0] = max(mx[0], px)
        mx[1] = max(mx[1], py)
        mx[2] = max(mx[2], pz)
    return mn, mx


def _visual_geom_entry_sort_key(
    pair: tuple[Literal["box", "gable"], _GeomBox | _GableRoofVisual],
) -> tuple[str, str]:
    tag, payload = pair
    if tag == "box":
        gb = cast(_GeomBox, payload)
        return (gb.kind, gb.elem_id)
    gv = cast(_GableRoofVisual, payload)
    return ("roof", gv.elem_id)


def _collect_visual_geom_entries(doc: Document) -> list[tuple[Literal["box", "gable"], _GeomBox | _GableRoofVisual]]:
    entries: list[tuple[Literal["box", "gable"], _GeomBox | _GableRoofVisual]] = [
        ("box", b) for b in _collect_geom_boxes(doc)
    ]
    for gv in _collect_gable_roof_visual_slices(doc):
        entries.append(("gable", gv))
    entries.sort(key=_visual_geom_entry_sort_key)
    return entries


def _collect_geom_boxes(doc: Document) -> list[_GeomBox]:
    boxes: list[_GeomBox] = []

    for cb in collect_wall_floor_slab_cut_boxes(doc):
        boxes.append(
            _GeomBox(cb.kind, cb.elem_id, cb.translation, cb.yaw, cb.hx, cb.hy, cb.hz),
        )

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        if rf.roof_geometry_mode == "gable_pitched_rectangle":
            continue
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

    geo_entries = _collect_visual_geom_entries(doc)

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

    for tag, payload in geo_entries:
        geom_kind: str
        elem_id_f: str
        yaw: float
        trans_t: tuple[float, float, float]
        mat_kind: str
        extras: dict[str, Any]
        if tag == "box":
            gb = cast(_GeomBox, payload)
            vbytes, vcount = _box_interleaved_bytes(gb.hx, gb.hy, gb.hz)
            pos_min, pos_max = bounds_position_world_aabb_geom_box(gb)
            geom_kind = gb.kind
            elem_id_f = gb.elem_id
            yaw = gb.yaw
            trans_t = (float(gb.translation[0]), float(gb.translation[1]), float(gb.translation[2]))
            mat_kind = gb.kind
            extras = {"bimAiEncoding": mf_payload["meshEncoding"], "elementId": gb.elem_id}
        else:
            gv = cast(_GableRoofVisual, payload)
            vbytes, vcount = _gable_roof_interleaved_world_m(gv)
            if vcount <= 0:
                continue
            pos_min, pos_max = _interleaved_position_min_max(vbytes, vcount)
            geom_kind = "roof"
            elem_id_f = gv.elem_id
            yaw = 0.0
            trans_t = (0.0, 0.0, 0.0)
            mat_kind = "roof"
            extras = {
                "bimAiEncoding": mf_payload["meshEncoding"],
                "elementId": gv.elem_id,
                "bimAiRoofGeometryMode": "gable_pitched_rectangle",
            }

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
                "name": f"{geom_kind}:{elem_id_f}",
                "primitives": [
                    {
                        "attributes": {"POSITION": acc_pos, "NORMAL": acc_norm},
                        "indices": ix_acc_idx,
                        "material": _KIND_MAT_IDX[mat_kind],
                    }
                ],
            }
        )

        nodes.append(
            {
                "name": f"{geom_kind}:{elem_id_f}",
                "mesh": mesh_idx,
                "translation": [trans_t[0], trans_t[1], trans_t[2]],
                "rotation": _quat_yaw_y_rad(yaw),
                "scale": [1.0, 1.0, 1.0],
                "extras": extras,
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
