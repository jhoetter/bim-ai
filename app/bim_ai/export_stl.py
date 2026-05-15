"""STL export for printer-oriented model exchange.

The STL path builds a dedicated print mesh rather than serialising the generic
glTF visual proxy path. Browser-only documentary helpers such as rooms and
opening markers are intentionally omitted, while browser-visible building solids
are emitted as deterministic printable proxy meshes.
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from typing import Any, Literal

from bim_ai.document import Document
from bim_ai.elements import (
    BalconyElem,
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    FloorElem,
    LevelElem,
    MassElem,
    RailingElem,
    RoofElem,
    SiteElem,
    SlabOpeningElem,
    SoffitElem,
    StairElem,
    ToposolidElem,
    WallElem,
    WallOpeningElem,
    WallTypeElem,
    WindowElem,
)
from bim_ai.export_gltf import (
    VERT_BYTES,
    _box_interleaved_bytes,
)
from bim_ai.opening_cut_primitives import (
    SLAB_OPENING_PANEL_GAP_MM,
    complement_unit_segments,
    complement_vertical_spans_m,
    floor_panels_axis_aligned_rect_with_single_hole_mm,
    hosted_opening_t_span_normalized,
    merge_unit_spans,
)

STL_BINARY_HEADER = b"bim-ai STL export; units=mm; axes=X/Y build plate, Z up"

PRINT_MESH_SOURCE_TOKEN = "dedicated_print_mesh_v2"
PRINTABLE_SOLID_KINDS = {
    "balcony",
    "beam",
    "ceiling",
    "column",
    "door",
    "floor",
    "mass",
    "railing",
    "roof",
    "site",
    "soffit",
    "stair",
    "toposolid",
    "wall",
    "window",
}
NON_PRINTABLE_VISUAL_KINDS = {
    "room",
    "slab_opening",
    "roof_opening",
    "wall_opening",
    "level",
    "viewpoint",
    "grid_line",
    "reference_plane",
    "dimension",
    "text_note",
    "placed_tag",
    "detail_line",
    "detail_region",
}


@dataclass(frozen=True, slots=True)
class StlTriangle:
    kind: str
    element_id: str
    normal: tuple[float, float, float]
    vertices: tuple[
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
    ]


def _world_m_to_stl_mm(p: tuple[float, float, float]) -> tuple[float, float, float]:
    """Map Three/glTF world coordinates (X, vertical Y, plan Z) to STL millimeters."""

    return (p[0] * 1000.0, p[2] * 1000.0, p[1] * 1000.0)


def _yaw_y_transform_m(
    p: tuple[float, float, float],
    *,
    translation_m: tuple[float, float, float],
    yaw_rad: float,
) -> tuple[float, float, float]:
    cy = math.cos(yaw_rad)
    sy = math.sin(yaw_rad)
    lx, ly, lz = p
    return (
        lx * cy + lz * sy + translation_m[0],
        ly + translation_m[1],
        -lx * sy + lz * cy + translation_m[2],
    )


def _triangle_normal(
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
    ln = math.sqrt(nx * nx + ny * ny + nz * nz)
    if ln <= 1e-12:
        return (0.0, 0.0, 0.0)
    return (nx / ln, ny / ln, nz / ln)


def _triangle_area2(
    v0: tuple[float, float, float],
    v1: tuple[float, float, float],
    v2: tuple[float, float, float],
) -> float:
    ax = v1[0] - v0[0]
    ay = v1[1] - v0[1]
    az = v1[2] - v0[2]
    bx = v2[0] - v0[0]
    by = v2[1] - v0[1]
    bz = v2[2] - v0[2]
    nx = ay * bz - az * by
    ny = az * bx - ax * bz
    nz = ax * by - ay * bx
    return math.sqrt(nx * nx + ny * ny + nz * nz)


def _iter_interleaved_triangles_mm(
    *,
    kind: str,
    element_id: str,
    interleaved: bytes,
    vertex_count: int,
    translation_m: tuple[float, float, float],
    yaw_rad: float,
) -> list[StlTriangle]:
    triangles: list[StlTriangle] = []
    usable_count = vertex_count - (vertex_count % 3)
    for i in range(0, usable_count, 3):
        verts: list[tuple[float, float, float]] = []
        for j in range(3):
            off = (i + j) * VERT_BYTES
            lx, ly, lz = struct.unpack_from("<fff", interleaved, off)
            world_m = _yaw_y_transform_m((lx, ly, lz), translation_m=translation_m, yaw_rad=yaw_rad)
            verts.append(_world_m_to_stl_mm(world_m))
        v0, v1, v2 = verts
        triangles.append(
            StlTriangle(
                kind=kind,
                element_id=element_id,
                normal=_triangle_normal(v0, v1, v2),
                vertices=(v0, v1, v2),
            )
        )
    return triangles


def _append_box_mm(
    triangles: list[StlTriangle],
    *,
    kind: str,
    element_id: str,
    center_x_mm: float,
    center_y_mm: float,
    center_z_mm: float,
    size_x_mm: float,
    size_y_mm: float,
    size_z_mm: float,
    yaw_rad: float = 0.0,
) -> None:
    if min(size_x_mm, size_y_mm, size_z_mm) <= 1e-6:
        return
    vbytes, vcount = _box_interleaved_bytes(
        size_x_mm / 2000.0,
        size_y_mm / 2000.0,
        size_z_mm / 2000.0,
    )
    triangles.extend(
        _iter_interleaved_triangles_mm(
            kind=kind,
            element_id=element_id,
            interleaved=vbytes,
            vertex_count=vcount,
            translation_m=(center_x_mm / 1000.0, center_z_mm / 1000.0, center_y_mm / 1000.0),
            yaw_rad=yaw_rad,
        )
    )


def _append_world_tri(
    triangles: list[StlTriangle],
    *,
    kind: str,
    element_id: str,
    a: tuple[float, float, float],
    b: tuple[float, float, float],
    c: tuple[float, float, float],
) -> None:
    verts = (_world_m_to_stl_mm(a), _world_m_to_stl_mm(b), _world_m_to_stl_mm(c))
    if _triangle_area2(*verts) <= 1e-7:
        return
    triangles.append(
        StlTriangle(
            kind=kind,
            element_id=element_id,
            normal=_triangle_normal(*verts),
            vertices=verts,
        )
    )


def _pt_tuple_mm(p: Any) -> tuple[float, float]:
    return (float(p.x_mm), float(p.y_mm))


def _poly_points_mm(points: list[Any]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for p in points:
        x, y = _pt_tuple_mm(p)
        if not out or abs(out[-1][0] - x) > 1e-6 or abs(out[-1][1] - y) > 1e-6:
            out.append((x, y))
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) <= 1e-6 and abs(out[0][1] - out[-1][1]) <= 1e-6:
        out.pop()
    return out


def _signed_area_mm2(poly: list[tuple[float, float]]) -> float:
    area = 0.0
    for i, (x0, y0) in enumerate(poly):
        x1, y1 = poly[(i + 1) % len(poly)]
        area += x0 * y1 - x1 * y0
    return area * 0.5


def _point_in_tri_2d(
    p: tuple[float, float],
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
) -> bool:
    px, py = p
    ax, ay = a
    bx, by = b
    cx, cy = c
    v0x, v0y = cx - ax, cy - ay
    v1x, v1y = bx - ax, by - ay
    v2x, v2y = px - ax, py - ay
    den = v0x * v1y - v1x * v0y
    if abs(den) <= 1e-9:
        return False
    u = (v2x * v1y - v1x * v2y) / den
    v = (v0x * v2y - v2x * v0y) / den
    return u >= -1e-9 and v >= -1e-9 and u + v <= 1.0 + 1e-9


def _triangulate_poly_indices(poly: list[tuple[float, float]]) -> list[tuple[int, int, int]]:
    if len(poly) < 3:
        return []
    if len(poly) == 3:
        return [(0, 1, 2)]
    indices = list(range(len(poly)))
    if _signed_area_mm2(poly) < 0:
        indices.reverse()
    tris: list[tuple[int, int, int]] = []
    guard = 0
    while len(indices) > 3 and guard < len(poly) * len(poly):
        guard += 1
        clipped = False
        for pos, cur in enumerate(indices):
            prev_i = indices[(pos - 1) % len(indices)]
            next_i = indices[(pos + 1) % len(indices)]
            ax, ay = poly[prev_i]
            bx, by = poly[cur]
            cx, cy = poly[next_i]
            cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
            if cross <= 1e-9:
                continue
            if any(
                _point_in_tri_2d(poly[other], poly[prev_i], poly[cur], poly[next_i])
                for other in indices
                if other not in {prev_i, cur, next_i}
            ):
                continue
            tris.append((prev_i, cur, next_i))
            del indices[pos]
            clipped = True
            break
        if not clipped:
            return [(0, i, i + 1) for i in range(1, len(poly) - 1)]
    if len(indices) == 3:
        tris.append((indices[0], indices[1], indices[2]))
    return tris


def _append_extruded_polygon_mm(
    triangles: list[StlTriangle],
    *,
    kind: str,
    element_id: str,
    poly_mm: list[tuple[float, float]],
    base_z_mm: float,
    thickness_mm: float,
) -> None:
    if len(poly_mm) < 3 or thickness_mm <= 1e-6:
        return
    poly = poly_mm if _signed_area_mm2(poly_mm) >= 0 else list(reversed(poly_mm))
    top_z_mm = base_z_mm + thickness_mm
    bottom = [(x / 1000.0, base_z_mm / 1000.0, y / 1000.0) for x, y in poly]
    top = [(x / 1000.0, top_z_mm / 1000.0, y / 1000.0) for x, y in poly]
    for i0, i1, i2 in _triangulate_poly_indices(poly):
        _append_world_tri(triangles, kind=kind, element_id=element_id, a=top[i0], b=top[i1], c=top[i2])
        _append_world_tri(
            triangles,
            kind=kind,
            element_id=element_id,
            a=bottom[i0],
            b=bottom[i2],
            c=bottom[i1],
        )
    for i in range(len(poly)):
        j = (i + 1) % len(poly)
        _append_world_tri(triangles, kind=kind, element_id=element_id, a=bottom[i], b=bottom[j], c=top[j])
        _append_world_tri(triangles, kind=kind, element_id=element_id, a=bottom[i], b=top[j], c=top[i])


def _level_elevation_mm(doc: Document, level_id: str | None) -> float:
    level = doc.elements.get(level_id or "")
    return float(level.elevation_mm) if isinstance(level, LevelElem) else 0.0


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _wall_location_line_offset_frac(location_line: str | None) -> float:
    if location_line in {"wall-exterior-face", "finish-face-exterior", "core-face-exterior"}:
        return -0.5
    if location_line in {"wall-interior-face", "finish-face-interior", "core-face-interior"}:
        return 0.5
    return 0.0


def _wall_thickness_mm(doc: Document, wall: WallElem) -> float:
    if wall.wall_type_id:
        wall_type = doc.elements.get(wall.wall_type_id)
        if isinstance(wall_type, WallTypeElem):
            total = sum(float(layer.thickness_mm) for layer in wall_type.layers)
            if total > 1e-6:
                return total
    return float(wall.thickness_mm)


def _wall_span_z_mm(doc: Document, wall: WallElem) -> tuple[float, float]:
    base = _level_elevation_mm(doc, wall.base_constraint_level_id or wall.level_id) + float(
        wall.base_constraint_offset_mm
    )
    if wall.top_constraint_level_id:
        top = _level_elevation_mm(doc, wall.top_constraint_level_id) + float(wall.top_constraint_offset_mm)
    else:
        top = base + float(wall.height_mm)
    if top <= base + 250.0:
        top = base + 250.0
    return base, min(top, base + 40000.0)


def _wall_centerline_with_offset_mm(
    doc: Document, wall: WallElem
) -> tuple[float, float, float, float, float, float, float]:
    sx = float(wall.start.x_mm)
    sy = float(wall.start.y_mm)
    ex = float(wall.end.x_mm)
    ey = float(wall.end.y_mm)
    dx = ex - sx
    dy = ey - sy
    length = max(math.hypot(dx, dy), 1e-6)
    thick = _wall_thickness_mm(doc, wall)
    loc_frac = 0.0 if wall.wall_type_id else _wall_location_line_offset_frac(wall.location_line)
    nx = -dy / length
    ny = dx / length
    off = loc_frac * thick
    return sx + nx * off, sy + ny * off, ex + nx * off, ey + ny * off, dx / length, dy / length, length


def _hosted_wall_cut_spans(doc: Document, wall: WallElem) -> list[tuple[float, float]]:
    spans: list[tuple[float, float]] = []
    for e in doc.elements.values():
        if isinstance(e, (DoorElem, WindowElem)) and e.wall_id == wall.id:
            ts = hosted_opening_t_span_normalized(e, wall)
            if ts:
                spans.append(ts)
        elif isinstance(e, WallOpeningElem) and e.host_wall_id == wall.id:
            spans.append((float(e.along_t_start), float(e.along_t_end)))
    return merge_unit_spans(spans)


def _blocked_vertical_spans_m(doc: Document, wall: WallElem, t0: float, t1: float) -> list[tuple[float, float]]:
    blocked: list[tuple[float, float]] = []
    for e in doc.elements.values():
        if isinstance(e, DoorElem) and e.wall_id == wall.id:
            ts = hosted_opening_t_span_normalized(e, wall)
            if ts and ts[0] < t1 - 1e-6 and ts[1] > t0 + 1e-6:
                blocked.append((0.0, 2.1))
        elif isinstance(e, WindowElem) and e.wall_id == wall.id:
            ts = hosted_opening_t_span_normalized(e, wall)
            if ts and ts[0] < t1 - 1e-6 and ts[1] > t0 + 1e-6:
                blocked.append((float(e.sill_height_mm) / 1000.0, (float(e.sill_height_mm) + float(e.height_mm)) / 1000.0))
        elif isinstance(e, WallOpeningElem) and e.host_wall_id == wall.id:
            if float(e.along_t_start) < t1 - 1e-6 and float(e.along_t_end) > t0 + 1e-6:
                blocked.append((float(e.sill_height_mm) / 1000.0, float(e.head_height_mm) / 1000.0))
    return blocked


def _append_wall_print_mesh(doc: Document, triangles: list[StlTriangle], wall: WallElem) -> None:
    sx, sy, ex, ey, ux, uy, length = _wall_centerline_with_offset_mm(doc, wall)
    if length <= 10.0:
        return
    thick = _clamp(_wall_thickness_mm(doc, wall), 50.0, 2000.0)
    z_base_mm, z_top_mm = _wall_span_z_mm(doc, wall)
    total_height_m = max((z_top_mm - z_base_mm) / 1000.0, 0.25)
    yaw = math.atan2(-uy, ux)
    for t0, t1 in complement_unit_segments(_hosted_wall_cut_spans(doc, wall)):
        seg_len = max((t1 - t0) * length, 1.0)
        cx = sx + ux * ((t0 + t1) * 0.5 * length)
        cy = sy + uy * ((t0 + t1) * 0.5 * length)
        vertical_free = complement_vertical_spans_m(0.0, total_height_m, _blocked_vertical_spans_m(doc, wall, t0, t1))
        for y0_m, y1_m in vertical_free:
            if y1_m <= y0_m + 1e-6:
                continue
            part_h_mm = (y1_m - y0_m) * 1000.0
            _append_box_mm(
                triangles,
                kind="wall",
                element_id=wall.id,
                center_x_mm=cx,
                center_y_mm=cy,
                center_z_mm=z_base_mm + (y0_m + y1_m) * 500.0,
                size_x_mm=seg_len,
                size_y_mm=part_h_mm,
                size_z_mm=thick,
                yaw_rad=yaw,
            )


def _append_floor_print_mesh(doc: Document, triangles: list[StlTriangle], floor: FloorElem) -> None:
    base = _level_elevation_mm(doc, floor.level_id)
    thickness = _clamp(float(floor.thickness_mm), 50.0, 1800.0)
    floor_poly = _poly_points_mm(floor.boundary_mm)
    openings = [
        _poly_points_mm(e.boundary_mm)
        for e in doc.elements.values()
        if isinstance(e, SlabOpeningElem) and e.host_floor_id == floor.id
    ]
    if len(openings) == 1:
        panels = floor_panels_axis_aligned_rect_with_single_hole_mm(
            floor_poly,
            openings[0],
            min_gap_mm=SLAB_OPENING_PANEL_GAP_MM,
        )
        if panels:
            for x0, x1, y0, y1 in panels:
                _append_box_mm(
                    triangles,
                    kind="floor",
                    element_id=floor.id,
                    center_x_mm=(x0 + x1) / 2.0,
                    center_y_mm=(y0 + y1) / 2.0,
                    center_z_mm=base + thickness / 2.0,
                    size_x_mm=x1 - x0,
                    size_y_mm=thickness,
                    size_z_mm=y1 - y0,
                )
            return
    _append_extruded_polygon_mm(
        triangles,
        kind="floor",
        element_id=floor.id,
        poly_mm=floor_poly,
        base_z_mm=base,
        thickness_mm=thickness,
    )


def _append_rectangular_gable_roof(
    triangles: list[StlTriangle],
    *,
    roof: RoofElem,
    x0: float,
    x1: float,
    y0: float,
    y1: float,
    eave_z_mm: float,
    slope_deg: float,
) -> bool:
    span_x = x1 - x0
    span_y = y1 - y0
    if span_x <= 1e-6 or span_y <= 1e-6:
        return False
    ridge_along_x = span_x >= span_y
    rise = math.tan(math.radians(_clamp(slope_deg, 0.0, 70.0))) * (min(span_x, span_y) / 2.0)
    ridge_z = eave_z_mm + max(rise, 120.0)
    xm = (x0 + x1) / 2.0
    ym = (y0 + y1) / 2.0
    if ridge_along_x:
        faces = [
            [(x0, y0, eave_z_mm), (x1, y0, eave_z_mm), (x1, ym, ridge_z), (x0, ym, ridge_z)],
            [(x1, y1, eave_z_mm), (x0, y1, eave_z_mm), (x0, ym, ridge_z), (x1, ym, ridge_z)],
            [(x0, y1, eave_z_mm), (x0, y0, eave_z_mm), (x0, ym, ridge_z)],
            [(x1, y0, eave_z_mm), (x1, y1, eave_z_mm), (x1, ym, ridge_z)],
            [(x0, y0, eave_z_mm), (x0, y1, eave_z_mm), (x1, y1, eave_z_mm), (x1, y0, eave_z_mm)],
        ]
    else:
        faces = [
            [(x1, y0, eave_z_mm), (xm, y0, ridge_z), (xm, y1, ridge_z), (x1, y1, eave_z_mm)],
            [(x0, y1, eave_z_mm), (xm, y1, ridge_z), (xm, y0, ridge_z), (x0, y0, eave_z_mm)],
            [(x0, y0, eave_z_mm), (x1, y0, eave_z_mm), (xm, y0, ridge_z)],
            [(x1, y1, eave_z_mm), (x0, y1, eave_z_mm), (xm, y1, ridge_z)],
            [(x0, y0, eave_z_mm), (x0, y1, eave_z_mm), (x1, y1, eave_z_mm), (x1, y0, eave_z_mm)],
        ]
    for face in faces:
        pts = [(x / 1000.0, z / 1000.0, y / 1000.0) for x, y, z in face]
        for i in range(1, len(pts) - 1):
            _append_world_tri(triangles, kind="roof", element_id=roof.id, a=pts[0], b=pts[i], c=pts[i + 1])
    return True


def _append_roof_print_mesh(doc: Document, triangles: list[StlTriangle], roof: RoofElem) -> None:
    pts = _poly_points_mm(roof.footprint_mm)
    if len(pts) < 3:
        return
    ov = _clamp(float(roof.overhang_mm or 0.0), 0.0, 5000.0)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1 = min(xs) - ov, max(xs) + ov
    y0, y1 = min(ys) - ov, max(ys) + ov
    base = _level_elevation_mm(doc, roof.reference_level_id)
    mode = roof.roof_geometry_mode
    if mode in {"gable_pitched_rectangle", "asymmetric_gable", "gable_pitched_l_shape"}:
        if _append_rectangular_gable_roof(
            triangles,
            roof=roof,
            x0=x0,
            x1=x1,
            y0=y0,
            y1=y1,
            eave_z_mm=base,
            slope_deg=float(roof.slope_deg or 25.0),
        ):
            return
    thickness = 150.0 if mode == "flat" else max(250.0, min(2800.0, (max(x1 - x0, y1 - y0) / 12.0)))
    _append_extruded_polygon_mm(
        triangles,
        kind="roof",
        element_id=roof.id,
        poly_mm=[(x0, y0), (x1, y0), (x1, y1), (x0, y1)] if mode == "mass_box" else pts,
        base_z_mm=base if mode == "flat" else base,
        thickness_mm=thickness,
    )


def _append_hosted_opening_family_mesh(doc: Document, triangles: list[StlTriangle], elem: DoorElem | WindowElem) -> None:
    wall = doc.elements.get(elem.wall_id)
    if not isinstance(wall, WallElem):
        return
    sx, sy, _ex, _ey, ux, uy, length = _wall_centerline_with_offset_mm(doc, wall)
    z_base, _z_top = _wall_span_z_mm(doc, wall)
    t = _clamp(float(elem.along_t), 0.0, 1.0)
    cx = sx + ux * length * t
    cy = sy + uy * length * t
    yaw = math.atan2(-uy, ux)
    thick = max(_wall_thickness_mm(doc, wall) * 0.55, 60.0)
    if isinstance(elem, DoorElem):
        height = 2050.0
        z = z_base + height / 2.0
        kind = "door"
    else:
        height = float(elem.height_mm)
        z = z_base + float(elem.sill_height_mm) + height / 2.0
        kind = "window"
    _append_box_mm(
        triangles,
        kind=kind,
        element_id=elem.id,
        center_x_mm=cx,
        center_y_mm=cy,
        center_z_mm=z,
        size_x_mm=float(elem.width_mm),
        size_y_mm=height,
        size_z_mm=thick,
        yaw_rad=yaw,
    )


def _append_stair_print_mesh(doc: Document, triangles: list[StlTriangle], stair: StairElem) -> None:
    sx = float(stair.run_start.x_mm)
    sy = float(stair.run_start.y_mm)
    ex = float(stair.run_end.x_mm)
    ey = float(stair.run_end.y_mm)
    dx = ex - sx
    dy = ey - sy
    length = max(math.hypot(dx, dy), 1.0)
    ux, uy = dx / length, dy / length
    yaw = math.atan2(-uy, ux)
    base = _level_elevation_mm(doc, stair.base_level_id)
    top = _level_elevation_mm(doc, stair.top_level_id)
    rise_total = max(top - base, float(stair.riser_mm) * 3.0)
    risers = max(1, int(round(rise_total / max(float(stair.riser_mm), 1.0))))
    tread = _clamp(float(stair.tread_mm), 120.0, 600.0)
    width = _clamp(float(stair.width_mm), 300.0, 4000.0)
    tread_len = min(tread, length / risers)
    for i in range(risers):
        t = (i + 0.5) / risers
        cx = sx + ux * length * t
        cy = sy + uy * length * t
        tread_top = base + (i + 1) * rise_total / risers
        _append_box_mm(
            triangles,
            kind="stair",
            element_id=stair.id,
            center_x_mm=cx,
            center_y_mm=cy,
            center_z_mm=tread_top - 35.0,
            size_x_mm=tread_len,
            size_y_mm=70.0,
            size_z_mm=width,
            yaw_rad=yaw,
        )
    _append_box_mm(
        triangles,
        kind="stair",
        element_id=stair.id,
        center_x_mm=(sx + ex) / 2.0,
        center_y_mm=(sy + ey) / 2.0,
        center_z_mm=base + rise_total / 2.0,
        size_x_mm=length,
        size_y_mm=max(rise_total, 80.0),
        size_z_mm=70.0,
        yaw_rad=yaw,
    )


def _append_railing_print_mesh(doc: Document, triangles: list[StlTriangle], railing: RailingElem) -> None:
    pts = _poly_points_mm(railing.path_mm)
    if len(pts) < 2:
        return
    guard = _clamp(float(railing.guard_height_mm), 500.0, 2200.0)
    base = 0.0
    top = 0.0
    stair = doc.elements.get(railing.hosted_stair_id or "")
    if isinstance(stair, StairElem):
        base = _level_elevation_mm(doc, stair.base_level_id)
        top = _level_elevation_mm(doc, stair.top_level_id)
    lengths = [math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)]
    total = max(sum(lengths), 1.0)
    cum = 0.0
    for i, (x, y) in enumerate(pts):
        t = 0.0 if total <= 0 else cum / total
        floor = base + (top - base) * t
        _append_box_mm(
            triangles,
            kind="railing",
            element_id=railing.id,
            center_x_mm=x,
            center_y_mm=y,
            center_z_mm=floor + guard / 2.0,
            size_x_mm=50.0,
            size_y_mm=guard,
            size_z_mm=50.0,
        )
        if i < len(lengths):
            cum += lengths[i]
    cum = 0.0
    for i, seg_len in enumerate(lengths):
        a = pts[i]
        b = pts[i + 1]
        ux = (b[0] - a[0]) / max(seg_len, 1e-6)
        uy = (b[1] - a[1]) / max(seg_len, 1e-6)
        yaw = math.atan2(-uy, ux)
        t0 = cum / total
        t1 = (cum + seg_len) / total
        floor0 = base + (top - base) * t0
        floor1 = base + (top - base) * t1
        rail_z = (floor0 + floor1) / 2.0 + guard
        _append_box_mm(
            triangles,
            kind="railing",
            element_id=railing.id,
            center_x_mm=(a[0] + b[0]) / 2.0,
            center_y_mm=(a[1] + b[1]) / 2.0,
            center_z_mm=rail_z,
            size_x_mm=seg_len,
            size_y_mm=45.0,
            size_z_mm=45.0,
            yaw_rad=yaw,
        )
        spacing = float(railing.baluster_pattern.spacing_mm) if railing.baluster_pattern and railing.baluster_pattern.spacing_mm else 115.0
        if not (railing.baluster_pattern and railing.baluster_pattern.rule in {"glass_panel", "cable"}):
            for j in range(max(0, int(seg_len // spacing))):
                local_t = (j + 0.5) / max(1, int(seg_len // spacing))
                floor = floor0 + (floor1 - floor0) * local_t
                _append_box_mm(
                    triangles,
                    kind="railing",
                    element_id=railing.id,
                    center_x_mm=a[0] + (b[0] - a[0]) * local_t,
                    center_y_mm=a[1] + (b[1] - a[1]) * local_t,
                    center_z_mm=floor + guard / 2.0,
                    size_x_mm=12.0,
                    size_y_mm=guard,
                    size_z_mm=12.0,
                )
        elif railing.baluster_pattern and railing.baluster_pattern.rule == "glass_panel":
            _append_box_mm(
                triangles,
                kind="railing",
                element_id=railing.id,
                center_x_mm=(a[0] + b[0]) / 2.0,
                center_y_mm=(a[1] + b[1]) / 2.0,
                center_z_mm=(floor0 + floor1) / 2.0 + guard * 0.42,
                size_x_mm=seg_len,
                size_y_mm=guard * 0.72,
                size_z_mm=18.0,
                yaw_rad=yaw,
            )
        cum += seg_len


def _append_balcony_print_mesh(doc: Document, triangles: list[StlTriangle], balcony: BalconyElem) -> None:
    wall = doc.elements.get(balcony.wall_id)
    if not isinstance(wall, WallElem):
        return
    sx = float(wall.start.x_mm)
    sy = float(wall.start.y_mm)
    ex = float(wall.end.x_mm)
    ey = float(wall.end.y_mm)
    dx, dy = ex - sx, ey - sy
    length = max(math.hypot(dx, dy), 1.0)
    ux, uy = dx / length, dy / length
    nx, ny = uy, -ux
    proj = _clamp(float(balcony.projection_mm), 100.0, 3000.0)
    slab_h = _clamp(float(balcony.slab_thickness_mm), 50.0, 500.0)
    yaw = math.atan2(-uy, ux)
    elev = float(balcony.elevation_mm)
    _append_box_mm(
        triangles,
        kind="balcony",
        element_id=balcony.id,
        center_x_mm=(sx + ex) / 2.0 + nx * proj / 2.0,
        center_y_mm=(sy + ey) / 2.0 + ny * proj / 2.0,
        center_z_mm=elev - slab_h / 2.0,
        size_x_mm=length,
        size_y_mm=slab_h,
        size_z_mm=proj,
        yaw_rad=yaw,
    )
    bal_h = _clamp(float(balcony.balustrade_height_mm), 0.0, 2200.0)
    if bal_h > 1.0:
        _append_box_mm(
            triangles,
            kind="balcony",
            element_id=balcony.id,
            center_x_mm=(sx + ex) / 2.0 + nx * proj,
            center_y_mm=(sy + ey) / 2.0 + ny * proj,
            center_z_mm=elev + bal_h / 2.0,
            size_x_mm=length,
            size_y_mm=bal_h,
            size_z_mm=25.0,
            yaw_rad=yaw,
        )


def _append_linear_box_between(
    triangles: list[StlTriangle],
    *,
    kind: str,
    element_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    elevation_z_mm: float,
    width_mm: float,
    height_mm: float,
) -> None:
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = max(math.hypot(dx, dy), 1.0)
    yaw = math.atan2(-(dy / length), dx / length)
    _append_box_mm(
        triangles,
        kind=kind,
        element_id=element_id,
        center_x_mm=(start[0] + end[0]) / 2.0,
        center_y_mm=(start[1] + end[1]) / 2.0,
        center_z_mm=elevation_z_mm,
        size_x_mm=length,
        size_y_mm=height_mm,
        size_z_mm=width_mm,
        yaw_rad=yaw,
    )


def document_to_stl_triangles(doc: Document) -> list[StlTriangle]:
    """Return deterministic STL triangles in printer coordinates and millimeters."""

    triangles: list[StlTriangle] = []
    for elem_id in sorted(doc.elements):
        elem = doc.elements[elem_id]
        if isinstance(elem, WallElem):
            _append_wall_print_mesh(doc, triangles, elem)
        elif isinstance(elem, FloorElem):
            _append_floor_print_mesh(doc, triangles, elem)
        elif isinstance(elem, RoofElem):
            _append_roof_print_mesh(doc, triangles, elem)
        elif isinstance(elem, (DoorElem, WindowElem)):
            _append_hosted_opening_family_mesh(doc, triangles, elem)
        elif isinstance(elem, StairElem):
            _append_stair_print_mesh(doc, triangles, elem)
        elif isinstance(elem, RailingElem):
            _append_railing_print_mesh(doc, triangles, elem)
        elif isinstance(elem, SiteElem):
            base = _level_elevation_mm(doc, elem.reference_level_id) + float(elem.base_offset_mm) - float(elem.pad_thickness_mm)
            _append_extruded_polygon_mm(
                triangles,
                kind="site",
                element_id=elem.id,
                poly_mm=_poly_points_mm(elem.boundary_mm),
                base_z_mm=base,
                thickness_mm=_clamp(float(elem.pad_thickness_mm), 50.0, 2000.0),
            )
        elif isinstance(elem, BalconyElem):
            _append_balcony_print_mesh(doc, triangles, elem)
        elif isinstance(elem, ColumnElem):
            base = _level_elevation_mm(doc, elem.level_id) + float(elem.base_constraint_offset_mm)
            height = _clamp(float(elem.height_mm), 250.0, 40000.0)
            if elem.top_constraint_level_id:
                height = max(
                    250.0,
                    _level_elevation_mm(doc, elem.top_constraint_level_id)
                    + float(elem.top_constraint_offset_mm)
                    - base,
                )
            _append_box_mm(
                triangles,
                kind="column",
                element_id=elem.id,
                center_x_mm=float(elem.position_mm.x_mm),
                center_y_mm=float(elem.position_mm.y_mm),
                center_z_mm=base + height / 2.0,
                size_x_mm=_clamp(float(elem.b_mm), 50.0, 2000.0),
                size_y_mm=height,
                size_z_mm=_clamp(float(elem.h_mm), 50.0, 2000.0),
                yaw_rad=math.radians(float(elem.rotation_deg)),
            )
        elif isinstance(elem, BeamElem):
            elev = _level_elevation_mm(doc, elem.level_id) - _clamp(float(elem.height_mm), 50.0, 1000.0) / 2.0
            _append_linear_box_between(
                triangles,
                kind="beam",
                element_id=elem.id,
                start=_pt_tuple_mm(elem.start_mm),
                end=_pt_tuple_mm(elem.end_mm),
                elevation_z_mm=elev,
                width_mm=_clamp(float(elem.width_mm), 50.0, 1000.0),
                height_mm=_clamp(float(elem.height_mm), 50.0, 1000.0),
            )
        elif isinstance(elem, CeilingElem):
            _append_extruded_polygon_mm(
                triangles,
                kind="ceiling",
                element_id=elem.id,
                poly_mm=_poly_points_mm(elem.boundary_mm),
                base_z_mm=_level_elevation_mm(doc, elem.level_id) + float(elem.height_offset_mm),
                thickness_mm=_clamp(float(elem.thickness_mm), 20.0, 500.0),
            )
        elif isinstance(elem, SoffitElem):
            _append_extruded_polygon_mm(
                triangles,
                kind="soffit",
                element_id=elem.id,
                poly_mm=_poly_points_mm(elem.boundary_mm),
                base_z_mm=float(elem.z_mm),
                thickness_mm=_clamp(float(elem.thickness_mm), 10.0, 500.0),
            )
        elif isinstance(elem, MassElem):
            _append_extruded_polygon_mm(
                triangles,
                kind="mass",
                element_id=elem.id,
                poly_mm=_poly_points_mm(elem.footprint_mm),
                base_z_mm=_level_elevation_mm(doc, elem.level_id),
                thickness_mm=_clamp(float(elem.height_mm), 250.0, 40000.0),
            )
        elif isinstance(elem, ToposolidElem):
            base = float(elem.base_elevation_mm or 0.0) - _clamp(float(elem.thickness_mm), 50.0, 5000.0)
            _append_extruded_polygon_mm(
                triangles,
                kind="toposolid",
                element_id=elem.id,
                poly_mm=_poly_points_mm(elem.boundary_mm),
                base_z_mm=base,
                thickness_mm=_clamp(float(elem.thickness_mm), 50.0, 5000.0),
            )
    return triangles


def document_to_binary_stl_bytes(doc: Document) -> bytes:
    triangles = document_to_stl_triangles(doc)
    if len(triangles) > 0xFFFFFFFF:
        raise ValueError("STL triangle count exceeds uint32 limit")

    header = STL_BINARY_HEADER[:80].ljust(80, b" ")
    out = bytearray(header)
    out.extend(struct.pack("<I", len(triangles)))
    for tri in triangles:
        out.extend(struct.pack("<fff", *tri.normal))
        for vertex in tri.vertices:
            out.extend(struct.pack("<fff", *vertex))
        out.extend(struct.pack("<H", 0))
    return bytes(out)


def _fmt_float(v: float) -> str:
    if v == 0:
        return "0"
    return f"{v:.9g}"


def document_to_ascii_stl(doc: Document, *, solid_name: str = "bim_ai_model") -> str:
    safe_name = "".join(ch if ch.isalnum() or ch in ("_", "-") else "_" for ch in solid_name)
    if not safe_name:
        safe_name = "bim_ai_model"

    lines = [f"solid {safe_name}"]
    for tri in document_to_stl_triangles(doc):
        nx, ny, nz = tri.normal
        lines.append(f"  facet normal {_fmt_float(nx)} {_fmt_float(ny)} {_fmt_float(nz)}")
        lines.append("    outer loop")
        for vx, vy, vz in tri.vertices:
            lines.append(f"      vertex {_fmt_float(vx)} {_fmt_float(vy)} {_fmt_float(vz)}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append(f"endsolid {safe_name}")
    return "\n".join(lines) + "\n"


def _vertex_key(v: tuple[float, float, float]) -> tuple[int, int, int]:
    return (round(v[0] * 1000), round(v[1] * 1000), round(v[2] * 1000))


def _edge_key(
    a: tuple[float, float, float],
    b: tuple[float, float, float],
) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    ak = _vertex_key(a)
    bk = _vertex_key(b)
    return (ak, bk) if ak <= bk else (bk, ak)


def _edge_length(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt(
        (b[0] - a[0]) * (b[0] - a[0])
        + (b[1] - a[1]) * (b[1] - a[1])
        + (b[2] - a[2]) * (b[2] - a[2])
    )


def _component_count(triangles: list[StlTriangle]) -> int:
    if not triangles:
        return 0

    edge_to_triangles: dict[
        tuple[tuple[int, int, int], tuple[int, int, int]],
        list[int],
    ] = {}
    for ix, tri in enumerate(triangles):
        v0, v1, v2 = tri.vertices
        for edge in (_edge_key(v0, v1), _edge_key(v1, v2), _edge_key(v2, v0)):
            edge_to_triangles.setdefault(edge, []).append(ix)

    adjacency: list[set[int]] = [set() for _ in triangles]
    for owners in edge_to_triangles.values():
        if len(owners) < 2:
            continue
        for owner in owners:
            adjacency[owner].update(o for o in owners if o != owner)

    seen: set[int] = set()
    count = 0
    for ix in range(len(triangles)):
        if ix in seen:
            continue
        count += 1
        stack = [ix]
        seen.add(ix)
        while stack:
            cur = stack.pop()
            for nxt in adjacency[cur]:
                if nxt in seen:
                    continue
                seen.add(nxt)
                stack.append(nxt)
    return count


def _kind_counts(triangles: list[StlTriangle]) -> dict[str, int]:
    out: dict[str, int] = {}
    for tri in triangles:
        out[tri.kind] = out.get(tri.kind, 0) + 1
    return dict(sorted(out.items()))


def _element_counts_by_kind(triangles: list[StlTriangle]) -> dict[str, int]:
    seen: dict[str, set[str]] = {}
    for tri in triangles:
        seen.setdefault(tri.kind, set()).add(tri.element_id)
    return {kind: len(ids) for kind, ids in sorted(seen.items())}


def _document_kind_counts(doc: Document) -> dict[str, int]:
    counts: dict[str, int] = {}
    for elem in doc.elements.values():
        kind = str(getattr(elem, "kind", "unknown"))
        counts[kind] = counts.get(kind, 0) + 1
    return dict(sorted(counts.items()))


def _bounds_mm(triangles: list[StlTriangle]) -> dict[str, Any] | None:
    if not triangles:
        return None
    mins = [math.inf, math.inf, math.inf]
    maxs = [-math.inf, -math.inf, -math.inf]
    for tri in triangles:
        for v in tri.vertices:
            for axis in range(3):
                mins[axis] = min(mins[axis], v[axis])
                maxs[axis] = max(maxs[axis], v[axis])
    return {
        "minMm": {"xMm": mins[0], "yMm": mins[1], "zMm": mins[2]},
        "maxMm": {"xMm": maxs[0], "yMm": maxs[1], "zMm": maxs[2]},
        "sizeMm": {
            "xMm": maxs[0] - mins[0],
            "yMm": maxs[1] - mins[1],
            "zMm": maxs[2] - mins[2],
        },
    }


def build_stl_export_manifest(doc: Document) -> dict[str, Any]:
    triangles = document_to_stl_triangles(doc)
    doc_kind_counts = _document_kind_counts(doc)
    edge_counts: dict[tuple[tuple[int, int, int], tuple[int, int, int]], int] = {}
    zero_area = 0
    non_finite = 0
    min_edge_len = math.inf

    for tri in triangles:
        v0, v1, v2 = tri.vertices
        if any(not math.isfinite(coord) for vertex in tri.vertices for coord in vertex):
            non_finite += 1
            continue
        if _triangle_area2(v0, v1, v2) <= 1e-7:
            zero_area += 1
        for a, b in ((v0, v1), (v1, v2), (v2, v0)):
            min_edge_len = min(min_edge_len, _edge_length(a, b))
            edge = _edge_key(a, b)
            edge_counts[edge] = edge_counts.get(edge, 0) + 1

    boundary_edges = sum(1 for count in edge_counts.values() if count == 1)
    non_manifold_edges = sum(1 for count in edge_counts.values() if count > 2)
    if not triangles:
        readiness: Literal["empty_model", "needs_repair", "print_ready_candidate"] = "empty_model"
    elif zero_area or non_finite or boundary_edges or non_manifold_edges:
        readiness = "needs_repair"
    else:
        readiness = "print_ready_candidate"

    return {
        "format": "stlPrintExportManifest_v1",
        "meshSource": PRINT_MESH_SOURCE_TOKEN,
        "units": "millimeter",
        "axisMapping": {
            "source": "bim-ai visual world: X plan, Y elevation, Z plan",
            "stl": "X/Y build plate, Z elevation",
        },
        "encoding": "binary_stl",
        "readiness": readiness,
        "triangleCount": len(triangles),
        "binaryByteLength": 84 + len(triangles) * 50,
        "boundsMm": _bounds_mm(triangles),
        "trianglesByKind": _kind_counts(triangles),
        "elementCountsByKind": _element_counts_by_kind(triangles),
        "coverage": {
            "printableSolidKinds": sorted(PRINTABLE_SOLID_KINDS),
            "excludedNonPrintableKindsPresent": {
                kind: count
                for kind, count in doc_kind_counts.items()
                if kind in NON_PRINTABLE_VISUAL_KINDS
            },
            "documentKindsWithoutStlTriangles": {
                kind: count
                for kind, count in doc_kind_counts.items()
                if kind not in _element_counts_by_kind(triangles)
            },
        },
        "diagnostics": {
            "zeroAreaTriangleCount": zero_area,
            "nonFiniteTriangleCount": non_finite,
            "boundaryEdgeCount": boundary_edges,
            "nonManifoldEdgeCount": non_manifold_edges,
            "componentCountApprox": _component_count(triangles),
            "minimumEdgeLengthMm": None if math.isinf(min_edge_len) else min_edge_len,
        },
        "limitations": [
            "STL has no material, unit, hierarchy, or semantic metadata fields.",
            "This export uses BIM AI's dedicated print mesh kernel, not the browser runtime meshes.",
            "Rooms, slab-opening markers, roof-opening markers, wall-opening cutter records, levels, views, grids, dimensions, tags, and 2D/detail records are intentionally excluded.",
            "Hosted wall openings are represented as rectangular cuts; advanced family geometry is exported as printable proxy solids.",
            "Advanced roof/dormer/freeform sweep/MEP/asset and terrain-heightmap details may be simplified.",
            "Run the STL through a slicer or mesh repair tool before production printing.",
        ],
    }
