"""STL export for printer-oriented model exchange.

The STL path intentionally reuses the deterministic visual geometry kernel from
``export_gltf`` but writes printer-style coordinates: X/Y are the build plate
axes, Z is vertical, and all units are millimeters.
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from typing import Any, Literal, cast

from bim_ai.document import Document
from bim_ai.export_gltf import (
    VERT_BYTES,
    _box_interleaved_bytes,
    _collect_visual_geom_entries,
    _gable_roof_interleaved_world_m,
    _GableRoofVisual,
    _GeomBox,
    _SitePadVisual,
)

STL_BINARY_HEADER = b"bim-ai STL export; units=mm; axes=X/Y build plate, Z up"


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


def document_to_stl_triangles(doc: Document) -> list[StlTriangle]:
    """Return deterministic STL triangles in printer coordinates and millimeters."""

    triangles: list[StlTriangle] = []
    entries = _collect_visual_geom_entries(doc)
    for tag, payload in entries:
        if tag == "box":
            gb = cast(_GeomBox, payload)
            vbytes, vcount = _box_interleaved_bytes(gb.hx, gb.hy, gb.hz)
            triangles.extend(
                _iter_interleaved_triangles_mm(
                    kind=gb.kind,
                    element_id=gb.elem_id,
                    interleaved=vbytes,
                    vertex_count=vcount,
                    translation_m=gb.translation,
                    yaw_rad=gb.yaw,
                )
            )
        elif tag == "site_pad":
            sp = cast(_SitePadVisual, payload)
            triangles.extend(
                _iter_interleaved_triangles_mm(
                    kind="site",
                    element_id=sp.elem_id,
                    interleaved=sp.interleaved,
                    vertex_count=sp.vertex_count,
                    translation_m=sp.translation_m,
                    yaw_rad=sp.yaw_rad,
                )
            )
        else:
            gv = cast(_GableRoofVisual, payload)
            vbytes, vcount = _gable_roof_interleaved_world_m(gv)
            triangles.extend(
                _iter_interleaved_triangles_mm(
                    kind="roof",
                    element_id=gv.elem_id,
                    interleaved=vbytes,
                    vertex_count=vcount,
                    translation_m=(0.0, 0.0, 0.0),
                    yaw_rad=0.0,
                )
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
            "This export uses BIM AI's current deterministic visual geometry kernel.",
            "Run the STL through a slicer or mesh repair tool before production printing.",
        ],
    }
