from __future__ import annotations

from typing import Any

import numpy as np

try:
    import ifcopenshell.util.element as ifc_elem_util
    import ifcopenshell.util.placement as ifc_placement
except ImportError:
    ifc_elem_util = None  # type: ignore[misc, assignment]
    ifc_placement = None  # type: ignore[misc, assignment]


def _references_from_products(products: list[Any], pset_name: str, *, limit: int) -> list[str]:
    if ifc_elem_util is None:
        return []

    refs: set[str] = set()
    for p in products:
        ps = ifc_elem_util.get_psets(p)
        bucket = ps.get(pset_name) or {}
        ref = bucket.get("Reference")
        if isinstance(ref, str) and ref.strip():
            refs.add(ref.strip())
        if len(refs) >= limit:
            break
    return sorted(refs)


def _ifc_global_id_slug(raw: Any) -> str:
    s = str(raw or "").strip()
    if not s:
        return "ifc_empty_gid"
    return "".join(ch if ch.isalnum() else "_" for ch in s)


def _product_host_storey_global_id(product: Any) -> str | None:
    """Host ``IfcBuildingStorey`` from spatial containment or aggregate."""

    for rel in getattr(product, "ContainedInStructure", None) or []:
        st = getattr(rel, "RelatingStructure", None)
        if st is None:
            continue
        try:
            if st.is_a("IfcBuildingStorey"):
                gid = getattr(st, "GlobalId", None)
                return str(gid) if gid else None
        except Exception:
            continue
    for rel in getattr(product, "Decomposes", None) or []:
        try:
            if not rel.is_a("IfcRelAggregates"):
                continue
        except Exception:
            continue
        st = getattr(rel, "RelatingObject", None)
        if st is None:
            continue
        try:
            if st.is_a("IfcBuildingStorey"):
                gid = getattr(st, "GlobalId", None)
                return str(gid) if gid else None
        except Exception:
            continue
    return None


def _profile_xy_polyline_mm(outer_curve: Any) -> list[tuple[float, float]] | None:
    """2D profile vertices (mm) for kernel-style wall section in the extrusion local frame."""

    try:
        if outer_curve.is_a("IfcIndexedPolyCurve"):
            pts = outer_curve.Points
            if pts is None:
                return None
            out: list[tuple[float, float]] = []
            for row in pts.CoordList or []:
                if len(row) >= 2:
                    out.append((float(row[0]), float(row[1])))
            return out or None
        if outer_curve.is_a("IfcPolyline"):
            out2: list[tuple[float, float]] = []
            for p in outer_curve.Points or []:
                c = p.Coordinates
                if len(c) >= 2:
                    out2.append((float(c[0]), float(c[1])))
            return out2 or None
    except Exception:
        return None
    return None


def _first_body_extruded_area_solid(product: Any) -> Any | None:
    pdef = getattr(product, "Representation", None)
    if pdef is None:
        return None
    for rep in pdef.Representations or []:
        try:
            if getattr(rep, "RepresentationIdentifier", None) != "Body":
                continue
        except Exception:
            continue
        for it in rep.Items or []:
            try:
                if it.is_a("IfcExtrudedAreaSolid"):
                    return it
            except Exception:
                continue
    return None


def _kernel_wall_plan_geometry_mm(wall: Any) -> dict[str, float] | None:
    """Recover createWall-style spine + thickness + height from kernel extruded wall body."""

    if ifc_placement is None:
        return None
    ex = _first_body_extruded_area_solid(wall)
    if ex is None:
        return None
    try:
        depth = float(ex.Depth)
    except Exception:
        return None
    if depth <= 1e-6:
        return None

    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 3:
        return None

    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    length_mm = max_x - min_x
    thick_mm = max_y - min_y
    if length_mm < 1e-3 or thick_mm < 1e-3:
        return None

    M = ifc_placement.get_local_placement(wall.ObjectPlacement)
    lx0, ly0 = float(min_x), float(min_y)
    lx1, ly1 = float(max_x), float(min_y)
    v0 = M @ np.array([lx0, ly0, 0.0, 1.0])
    v1 = M @ np.array([lx1, ly1, 0.0, 1.0])

    return {
        "start_x_mm": float(v0[0]),
        "start_y_mm": float(v0[1]),
        "end_x_mm": float(v1[0]),
        "end_y_mm": float(v1[1]),
        "thickness_mm": thick_mm,
        "height_mm": depth,
    }


def _kernel_space_footprint_outline_mm(space: Any) -> list[tuple[float, float]] | None:
    """Recover plan outline (mm) from kernel-style IfcSpace slab extrusion + placement."""

    if ifc_placement is None:
        return None
    ex = _first_body_extruded_area_solid(space)
    if ex is None:
        return None
    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 3:
        return None

    M = ifc_placement.get_local_placement(space.ObjectPlacement)
    out_mm: list[tuple[float, float]] = []
    for lx, ly in poly:
        v = M @ np.array([float(lx), float(ly), 0.0, 1.0])
        out_mm.append((float(v[0]), float(v[1])))

    def _same_pt(a: tuple[float, float], b: tuple[float, float], tol: float = 1e-2) -> bool:
        return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol

    if len(out_mm) >= 2 and _same_pt(out_mm[0], out_mm[-1]):
        out_mm = out_mm[:-1]
    return out_mm if len(out_mm) >= 3 else None


def _ifc_inverse_seq_local(val: Any) -> list[Any]:
    """IfcOpenShell inverses may be ``[]``, ``()``, one entity, or None."""

    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        return [x for x in val if x is not None]
    return [val]


def _ifc_rel_voids_host_building_element(rel: Any) -> Any | None:
    """Host element from ``IfcRelVoidsElement`` (tolerate attribute naming variants)."""

    for attr in ("RelatingBuildingElement", "RelatedBuildingElement"):
        h = getattr(rel, attr, None)
        if h is not None:
            return h
    return None


def _ifc_try_product_is_a(product: Any, root: str) -> bool:
    try:
        return bool(product.is_a(root))
    except Exception:
        return False


def _kernel_horizontal_extrusion_footprint_mm_and_thickness(
    product: Any,
) -> tuple[list[tuple[float, float]], float] | None:
    """Plan outline (mm) + slab-style extrusion depth (mm) for kernel ``IfcExtrudedAreaSolid`` bodies."""

    if ifc_placement is None:
        return None
    ex = _first_body_extruded_area_solid(product)
    if ex is None:
        return None
    try:
        depth_raw = abs(float(ex.Depth))
    except Exception:
        return None
    if depth_raw <= 1e-9:
        return None
    depth_mm = depth_raw * 1000.0 if depth_raw <= 20.0 else depth_raw
    if depth_mm <= 1e-3:
        return None
    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 3:
        return None

    M = ifc_placement.get_local_placement(product.ObjectPlacement)
    out_mm: list[tuple[float, float]] = []
    for lx, ly in poly:
        v = M @ np.array([float(lx), float(ly), 0.0, 1.0])
        out_mm.append((float(v[0]), float(v[1])))

    def _same_poly_close(a: tuple[float, float], b: tuple[float, float], tol: float = 1e-2) -> bool:
        return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol

    if len(out_mm) >= 2 and _same_poly_close(out_mm[0], out_mm[-1]):
        out_mm = out_mm[:-1]
    if len(out_mm) < 3:
        return None
    return out_mm, float(depth_mm)


def _kernel_slab_opening_replay_element_id(opening: Any) -> str:
    """Recover kernel slab-opening id: export names slab voids ``op:<kernelElemId>``."""

    gid = str(getattr(opening, "GlobalId", None) or "")
    nm = str(getattr(opening, "Name", None) or "").strip()
    if nm.startswith("op:"):
        rest = nm[3:].strip()
        if rest:
            return rest
    return _ifc_global_id_slug(gid)


def _void_rel_and_host_for_opening(opening: Any, model: Any) -> tuple[Any | None, Any | None]:
    """Locate ``IfcRelVoidsElement`` + host for ``opening``."""

    og = str(getattr(opening, "GlobalId", None) or "")

    def _opening_matches(ro: Any) -> bool:
        if ro is None:
            return False
        if ro is opening:
            return True
        rg = str(getattr(ro, "GlobalId", None) or "")
        return bool(og and rg and og == rg)

    for rel in _ifc_inverse_seq_local(getattr(opening, "VoidsElements", None)):
        try:
            if not rel.is_a("IfcRelVoidsElement"):
                continue
        except Exception:
            continue
        ro = getattr(rel, "RelatedOpeningElement", None)
        if not _opening_matches(ro):
            continue
        host = _ifc_rel_voids_host_building_element(rel)
        if host is None:
            continue
        return rel, host

    for rel in model.by_type("IfcRelVoidsElement") or []:
        try:
            if not rel.is_a("IfcRelVoidsElement"):
                continue
        except Exception:
            continue
        ro = getattr(rel, "RelatedOpeningElement", None)
        if not _opening_matches(ro):
            continue
        host = _ifc_rel_voids_host_building_element(rel)
        if host is None:
            continue
        return rel, host

    return None, None


def _ifc_model_has_slab_void_opening_topology_v0(model: Any) -> bool:
    for rel in model.by_type("IfcRelVoidsElement") or []:
        try:
            if not rel.is_a("IfcRelVoidsElement"):
                continue
        except Exception:
            continue
        ro = getattr(rel, "RelatedOpeningElement", None)
        if ro is None or not _ifc_try_product_is_a(ro, "IfcOpeningElement"):
            continue
        host = _ifc_rel_voids_host_building_element(rel)
        if host is not None and _ifc_try_product_is_a(host, "IfcSlab"):
            return True
    return False
