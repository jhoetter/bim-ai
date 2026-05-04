"""IFC4 export using IfcOpenShell — building storey + IfcWall + IfcSlab (bim-ai kernel subset)."""

from __future__ import annotations

import math
from typing import Any

import numpy as np

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

KERNEL_IFC_DOMINANT_KINDS: frozenset[str] = frozenset(
    {"level", "wall", "floor", "door", "window", "room", "roof", "stair", "slab_opening"}
)
IFC_ENCODING_KERNEL_V1 = "bim_ai_ifc_kernel_v1"

# Semantic geometry kinds emitted as physical IFC bodies in kernel export (for advisor parity).
IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS: frozenset[str] = frozenset(
    {"wall", "floor", "door", "window", "room", "roof", "stair", "slab_opening"}
)

try:
    import ifcopenshell  # noqa: F401

    IFC_AVAILABLE = True
except ImportError:
    IFC_AVAILABLE = False


def ifcopenshell_available() -> bool:
    return IFC_AVAILABLE


def kernel_export_eligible(doc: Document) -> bool:
    if not IFC_AVAILABLE:
        return False
    wal = sum(1 for e in doc.elements.values() if isinstance(e, WallElem))
    fl = sum(
        1 for e in doc.elements.values() if isinstance(e, FloorElem) and len(e.boundary_mm) >= 3
    )
    return wal + fl > 0


def ifc_kernel_geometry_skip_counts(doc: Document) -> dict[str, int]:
    """Counts semantic instances the kernel IFC exporter will not physicalize (parity transparency)."""

    skips: dict[str, int] = {}
    wall_ids = {eid for eid, e in doc.elements.items() if isinstance(e, WallElem)}
    floors_with_slab = {
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, FloorElem) and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    }
    level_ids = {eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)}

    for e in doc.elements.values():
        if isinstance(e, DoorElem):
            if e.wall_id not in wall_ids:
                skips["door_missing_host_wall"] = skips.get("door_missing_host_wall", 0) + 1
        elif isinstance(e, WindowElem):
            if e.wall_id not in wall_ids:
                skips["window_missing_host_wall"] = skips.get("window_missing_host_wall", 0) + 1
        elif isinstance(e, SlabOpeningElem):
            boundary = getattr(e, "boundary_mm", ()) or ()
            bad_host = e.host_floor_id not in floors_with_slab
            bad_outline = len(boundary) < 3
            if bad_host or bad_outline:
                skips["slab_opening_void_skipped"] = skips.get("slab_opening_void_skipped", 0) + 1
        elif isinstance(e, RoofElem):
            fp = getattr(e, "footprint_mm", ()) or ()
            if len(fp) < 3:
                skips["roof_product_skipped"] = skips.get("roof_product_skipped", 0) + 1
        elif isinstance(e, StairElem):
            missing_lv = e.base_level_id not in level_ids or e.top_level_id not in level_ids
            if missing_lv:
                skips["stair_product_skipped"] = skips.get("stair_product_skipped", 0) + 1
        elif isinstance(e, RoomElem):
            outl = getattr(e, "outline_mm", ()) or ()
            if len(outl) < 3:
                skips["room_space_skipped"] = skips.get("room_space_skipped", 0) + 1

    return skips


def ifc_manifest_artifact_hints(doc: Document, *, emitting_kernel_body: bool) -> dict[str, Any]:
    storey_n = sum(1 for e in doc.elements.values() if isinstance(e, LevelElem))
    wal_n = sum(1 for e in doc.elements.values() if isinstance(e, WallElem))
    slab_n = sum(
        1 for e in doc.elements.values() if isinstance(e, FloorElem) and len(e.boundary_mm) >= 3
    )
    if storey_n == 0 and wal_n + slab_n > 0:
        storey_n = 1

    hinted: dict[str, Any] = {
        "exportedIfcKindsInArtifact": {},
        "ifcEmittedKernelKinds": sorted(KERNEL_IFC_DOMINANT_KINDS),
        "kernelNote": (
            "Kernel IFC encodes storey graph, walls+floors, roofs (IfcRoof prism), stairs (IfcStair run prism), "
            "hosted door/window openings, slab voids via IfcOpeningElement on host IfcSlab, and rooms as IfcSpace "
            "footprints; IfcOpenShell emits minimal IFC4 **property sets** (e.g. Pset_*Common `Reference` "
            "from kernel ids on physical products); **narrow `Qto_*` quantities** attach to walls/fillings/slab/space "
            "when IfcOpenShell qto helpers succeed. IFC import and full boolean regeneration remain deferred."
        ),
    }

    skip_summary = ifc_kernel_geometry_skip_counts(doc)
    nonzero_skip = {k: v for k, v in sorted(skip_summary.items()) if v}
    if nonzero_skip:
        hinted["ifcKernelGeometrySkippedCounts"] = nonzero_skip

    if not IFC_AVAILABLE or not emitting_kernel_body:
        hinted["ifcEmittedKernelKinds"] = []
        return hinted

    wall_ids = {eid for eid, e in doc.elements.items() if isinstance(e, WallElem)}
    door_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, DoorElem) and e.wall_id in wall_ids
    )
    win_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, WindowElem) and e.wall_id in wall_ids
    )
    room_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, RoomElem) and len(e.outline_mm) >= 3
    )
    roof_emit = sum(
        1 for e in doc.elements.values() if isinstance(e, RoofElem) and len(e.footprint_mm) >= 3
    )
    level_ids_eff = {eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)}
    stair_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, StairElem)
        and e.base_level_id in level_ids_eff
        and e.top_level_id in level_ids_eff
    )
    floors_with_slab = {
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, FloorElem) and len(e.boundary_mm) >= 3
    }
    slab_open_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, SlabOpeningElem)
        and e.host_floor_id in floors_with_slab
        and len(e.boundary_mm) >= 3
    )

    kinds: dict[str, int] = {}
    if storey_n:
        kinds["level"] = storey_n
    if wal_n:
        kinds["wall"] = wal_n
    if slab_n:
        kinds["floor"] = slab_n
    if door_emit:
        kinds["door"] = door_emit
    if win_emit:
        kinds["window"] = win_emit
    if room_emit:
        kinds["room"] = room_emit
    if roof_emit:
        kinds["roof"] = roof_emit
    if stair_emit:
        kinds["stair"] = stair_emit
    if slab_open_emit:
        kinds["slab_opening"] = slab_open_emit
    hinted["exportedIfcKindsInArtifact"] = dict(sorted(kinds.items()))
    return hinted


def serialize_ifc_artifact(doc: Document) -> tuple[str, str, bool]:
    """(spf_text, encoding_id, artifact_has_physical_geometry)."""

    from bim_ai.ifc_stub import IFC_ENCODING_EMPTY_SHELL, minimal_empty_ifc_skeleton

    hull = minimal_empty_ifc_skeleton()
    if not IFC_AVAILABLE:
        return hull, IFC_ENCODING_EMPTY_SHELL, False

    serialized, geo_n = try_build_kernel_ifc(doc)
    if not serialized or geo_n == 0:
        return hull, IFC_ENCODING_EMPTY_SHELL, False
    return serialized, IFC_ENCODING_KERNEL_V1, True


def export_ifc_model_step(doc: Document) -> str:
    """IFC STEP text suitable for *.ifc download."""

    step, _, _ = serialize_ifc_artifact(doc)
    return step


def _kernel_ifc_space_export_props(rm: RoomElem) -> dict[str, str]:
    """Optional Pset_SpaceCommon fields for IDS / room programme read-back (kernel slice)."""

    out: dict[str, str] = {}
    if rm.programme_code:
        out["ProgrammeCode"] = rm.programme_code
    if rm.department:
        out["Department"] = rm.department
    if rm.function_label:
        out["FunctionLabel"] = rm.function_label
    if rm.finish_set:
        out["FinishSet"] = rm.finish_set
    return out


def inspect_kernel_ifc_semantics(
    *,
    doc: Document | None = None,
    step_text: str | None = None,
) -> dict[str, Any]:
    """Structured read-back matrix for kernel IFC (WP-X03/X05) — JSON-serializable.

    Does not add fields to the IFC↔glTF parity manifest slice in ``constraints``.

    - Without IfcOpenShell, returns ``available=False`` and optional skip counts when ``doc`` is set.
    - With ``doc`` only, parses nothing when the document is not ``kernel_export_eligible``.
    - With ``step_text``, parses that STEP when IfcOpenShell is available (for tests over fixed strings).
    """

    matrix_version = 1
    skip_counts: dict[str, int] = {}
    if doc is not None:
        skip_counts = {k: v for k, v in sorted(ifc_kernel_geometry_skip_counts(doc).items()) if v}

    if not IFC_AVAILABLE:
        return {
            "matrixVersion": matrix_version,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            **({"ifcKernelGeometrySkippedCounts": skip_counts} if skip_counts else {}),
        }

    text: str | None = step_text
    if text is None and doc is not None:
        if not kernel_export_eligible(doc):
            return {
                "matrixVersion": matrix_version,
                "available": False,
                "reason": "kernel_not_eligible",
                **({"ifcKernelGeometrySkippedCounts": skip_counts} if skip_counts else {}),
            }
        text = export_ifc_model_step(doc)

    if text is None:
        return {
            "matrixVersion": matrix_version,
            "available": False,
            "reason": "no_document_or_step",
            **({"ifcKernelGeometrySkippedCounts": skip_counts} if skip_counts else {}),
        }

    import ifcopenshell
    import ifcopenshell.util.element as elem_util

    model = ifcopenshell.file.from_string(text)

    storeys = model.by_type("IfcBuildingStorey") or []
    n_storey = len(storeys)
    elevations_present = 0
    for st in storeys:
        el = getattr(st, "Elevation", None)
        if el is not None and isinstance(el, (int, float)):
            elevations_present += 1

    walls = model.by_type("IfcWall") or []
    openings = model.by_type("IfcOpeningElement") or []
    doors = model.by_type("IfcDoor") or []
    windows = model.by_type("IfcWindow") or []
    spaces = model.by_type("IfcSpace") or []
    qtys = model.by_type("IfcElementQuantity") or []

    def _count_pset_ref(ifc_products: list[Any], pset_name: str) -> int:
        c = 0
        for p in ifc_products:
            ps = elem_util.get_psets(p)
            bucket = ps.get(pset_name) or {}
            if bucket.get("Reference"):
                c += 1
        return c

    def _count_space_programme(pset_name: str, key: str) -> int:
        c = 0
        for sp in spaces:
            ps = elem_util.get_psets(sp)
            bucket = ps.get(pset_name) or {}
            if bucket.get(key):
                c += 1
        return c

    qto_names = sorted({str(q.Name) for q in qtys if getattr(q, "Name", None)})

    out: dict[str, Any] = {
        "matrixVersion": matrix_version,
        "available": True,
        "buildingStorey": {
            "count": n_storey,
            "elevationsPresent": elevations_present,
        },
        "products": {
            "IfcWall": len(walls),
            "IfcOpeningElement": len(openings),
            "IfcDoor": len(doors),
            "IfcWindow": len(windows),
            "IfcSpace": len(spaces),
        },
        "identityPsets": {
            "wallWithPsetWallCommonReference": _count_pset_ref(list(walls), "Pset_WallCommon"),
            "spaceWithPsetSpaceCommonReference": _count_pset_ref(list(spaces), "Pset_SpaceCommon"),
            "doorWithPsetDoorCommonReference": _count_pset_ref(list(doors), "Pset_DoorCommon"),
            "windowWithPsetWindowCommonReference": _count_pset_ref(list(windows), "Pset_WindowCommon"),
        },
        "spaceProgrammeFields": {
            "ProgrammeCode": _count_space_programme("Pset_SpaceCommon", "ProgrammeCode"),
            "Department": _count_space_programme("Pset_SpaceCommon", "Department"),
            "FunctionLabel": _count_space_programme("Pset_SpaceCommon", "FunctionLabel"),
            "FinishSet": _count_space_programme("Pset_SpaceCommon", "FinishSet"),
        },
        "qtoTemplates": qto_names,
    }
    if skip_counts:
        out["ifcKernelGeometrySkippedCounts"] = skip_counts
    return out


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _polygon_area_m2_xy_mm(poly_mm: list[tuple[float, float]]) -> float:
    n = len(poly_mm)
    if n < 3:
        return 0.0
    a = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a / 2.0) / 1e6


def _polygon_perimeter_m_xy_mm(poly_mm: list[tuple[float, float]]) -> float:
    n = len(poly_mm)
    if n < 2:
        return 0.0
    p = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        p += math.hypot(x2 - x1, y2 - y1)
    return p / 1000.0


def _try_attach_qto(f: Any, product: Any, qto_name: str, properties: dict[str, float]) -> None:
    """Narrow QTO slice (WP-X03) — ignored when IfcOpenShell build lacks qto use-cases."""

    try:
        from ifcopenshell.api.pset.add_qto import add_qto  # type: ignore import-not-found
        from ifcopenshell.api.pset.edit_qto import edit_qto  # type: ignore import-not-found

        qto = add_qto(f, product=product, name=qto_name)
        edit_qto(f, qto=qto, properties=dict(properties))
    except Exception:
        return


def _elev_m(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return el.elevation_mm / 1000.0 if isinstance(el, LevelElem) else 0.0


def wall_local_to_world_m(wall: WallElem, elevation_m: float) -> tuple[np.ndarray, float]:
    """4×4 homogeneous transform + wall length — matches `create_2pt_wall` placement."""

    p1_ = np.array([wall.start.x_mm / 1000.0, wall.start.y_mm / 1000.0], dtype=float)
    p2_ = np.array([wall.end.x_mm / 1000.0, wall.end.y_mm / 1000.0], dtype=float)

    dv = p2_ - p1_
    ln = float(np.linalg.norm(dv))
    length_m = ln if ln >= 1e-9 else 1e-6
    vx, vy = (dv / ln).tolist() if ln >= 1e-9 else (1.0, 0.0)

    mat = np.array(
        [
            [vx, -vy, 0.0, p1_[0]],
            [vy, vx, 0.0, p1_[1]],
            [0.0, 0.0, 1.0, elevation_m],
            [0.0, 0.0, 0.0, 1.0],
        ],
        dtype=float,
    )
    return mat, length_m


def _xz_bounds_mm(poly_mm: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly_mm]
    zs = [p[1] for p in poly_mm]
    mn_x, mx_x = min(xs), max(xs)
    mn_z, mx_z = min(zs), max(zs)
    span_x = max(mx_x - mn_x, 1.0)
    span_z = max(mx_z - mn_z, 1.0)
    cx = (mn_x + mx_x) / 2.0
    cz = (mn_z + mx_z) / 2.0
    return cx, cz, span_x, span_z


def _room_outline_mm(rm: RoomElem) -> list[tuple[float, float]]:
    return [(p.x_mm, p.y_mm) for p in rm.outline_mm]


def _vertical_span_m(doc: Document, rm: RoomElem, floor_elev_m: float) -> tuple[float, float]:
    """(base_z, ceiling_z) world elevation for crude space prism."""

    if rm.upper_limit_level_id:
        ceil_el = doc.elements.get(rm.upper_limit_level_id)
        ceiling_z = ceil_el.elevation_mm / 1000.0 if isinstance(ceil_el, LevelElem) else floor_elev_m + 2.8
    else:
        ceiling_z = floor_elev_m + 2.8
    offset = rm.volume_ceiling_offset_mm / 1000.0 if rm.volume_ceiling_offset_mm is not None else 0.0
    ceiling_z -= offset
    if ceiling_z < floor_elev_m + 1.0:
        ceiling_z = floor_elev_m + 2.2
    return floor_elev_m, ceiling_z


def try_build_kernel_ifc(doc: Document) -> tuple[str | None, int]:
    """Build IFC geometry or return `(None, 0)` to fall back to empty hull."""

    import ifcopenshell.api.aggregate
    import ifcopenshell.api.context
    import ifcopenshell.api.feature as ifc_feature
    import ifcopenshell.api.project
    import ifcopenshell.api.root
    import ifcopenshell.api.spatial
    import ifcopenshell.api.unit
    from ifcopenshell.api.geometry.add_slab_representation import add_slab_representation
    from ifcopenshell.api.geometry.add_wall_representation import add_wall_representation
    from ifcopenshell.api.geometry.assign_representation import assign_representation
    from ifcopenshell.api.geometry.create_2pt_wall import create_2pt_wall
    from ifcopenshell.api.geometry.edit_object_placement import edit_object_placement

    f = ifcopenshell.api.project.create_file(version="IFC4")

    proj = ifcopenshell.api.root.create_entity(f, ifc_class="IfcProject", name="bim-ai-export")
    site = ifcopenshell.api.root.create_entity(f, ifc_class="IfcSite", name="Site")
    building = ifcopenshell.api.root.create_entity(f, ifc_class="IfcBuilding", name="Building")

    ifcopenshell.api.unit.assign_unit(f)

    model3d = ifcopenshell.api.context.add_context(f, context_type="Model")
    body_ctx = ifcopenshell.api.context.add_context(
        f, context_identifier="Body", target_view="MODEL_VIEW", parent=model3d
    )

    ifcopenshell.api.aggregate.assign_object(f, products=[site], relating_object=proj)
    ifcopenshell.api.aggregate.assign_object(f, products=[building], relating_object=site)

    storey_by_level: dict[str, Any] = {}
    sorted_levels = sorted(
        ((eid, e) for eid, e in doc.elements.items() if isinstance(e, LevelElem)),
        key=lambda t: (t[1].elevation_mm, t[0]),
    )

    default_storey_tag = None

    if not sorted_levels:
        storey = ifcopenshell.api.root.create_entity(f, ifc_class="IfcBuildingStorey", name="Base")
        if hasattr(storey, "Elevation"):
            storey.Elevation = 0.0

        ifcopenshell.api.aggregate.assign_object(f, products=[storey], relating_object=building)

        storey_by_level[""] = storey
        default_storey_tag = storey
    else:
        for lid, lvl in sorted_levels:
            storey = ifcopenshell.api.root.create_entity(
                f, ifc_class="IfcBuildingStorey", name=lvl.name or lid
            )

            if hasattr(storey, "Elevation"):
                storey.Elevation = float(lvl.elevation_mm)

            storey_by_level[lid] = storey
            ifcopenshell.api.aggregate.assign_object(f, products=[storey], relating_object=building)

            if default_storey_tag is None:
                default_storey_tag = storey

    assert default_storey_tag is not None

    def storey_for(level_id: str) -> Any:
        return storey_by_level.get(level_id) or default_storey_tag

    geo_products = 0
    wall_products: dict[str, Any] = {}
    slab_products: dict[str, Any] = {}

    def attach_kernel_identity_pset(product: Any, pset_name: str, reference: str, **props: Any) -> None:
        try:
            from ifcopenshell.api.pset.add_pset import add_pset  # type: ignore import-not-found
            from ifcopenshell.api.pset.edit_pset import edit_pset  # type: ignore import-not-found

        except ImportError:
            return
        merged: dict[str, Any] = {"Reference": reference, **props}

        pset = add_pset(f, product=product, name=pset_name)

        edit_pset(f, pset=pset, properties=merged)

    for wid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = doc.elements[wid]

        assert isinstance(w, WallElem)
        st_inst = storey_for(w.level_id)

        sx = w.start.x_mm / 1000.0
        sy = w.start.y_mm / 1000.0

        ex = w.end.x_mm / 1000.0

        ey = w.end.y_mm / 1000.0

        ez = _elev_m(doc, w.level_id)
        height_m = _clamp(w.height_mm / 1000.0, 0.25, 40.0)
        thick_m = _clamp(w.thickness_mm / 1000.0, 0.05, 2.0)

        wal = ifcopenshell.api.root.create_entity(f, ifc_class="IfcWall", name=w.name or wid)

        rep = create_2pt_wall(f, wal, body_ctx, (sx, sy), (ex, ey), ez, height_m, thick_m)
        assign_representation(f, wal, rep)

        ifcopenshell.api.spatial.assign_container(f, products=[wal], relating_structure=st_inst)
        wall_products[wid] = wal
        geo_products += 1
        attach_kernel_identity_pset(wal, "Pset_WallCommon", wid)
        _wmat_unused, length_m = wall_local_to_world_m(w, ez)
        _try_attach_qto(
            f,
            wal,
            "Qto_WallBaseQuantities",
            {"Length": float(length_m), "Height": float(height_m), "Width": float(thick_m)},
        )

    for fid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = doc.elements[fid]
        assert isinstance(fl, FloorElem)
        pts = [(p.x_mm, p.y_mm) for p in fl.boundary_mm]
        if len(pts) < 3:

            continue
        st_inst = storey_for(fl.level_id)

        cx_mm, cz_mm, _, _ = _xz_bounds_mm(pts)
        cx_m = cx_mm / 1000.0

        cy_m = cz_mm / 1000.0

        elev_z = _elev_m(doc, fl.level_id)
        thick_m = _clamp(fl.thickness_mm / 1000.0, 0.05, 1.8)

        profile: list[tuple[float, float]] = []

        for px, py in pts:
            profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        profile.append(profile[0])

        slab_z_center = elev_z + thick_m / 2.0

        slab = ifcopenshell.api.root.create_entity(f, ifc_class="IfcSlab", name=fl.name or fid)
        rep = add_slab_representation(f, body_ctx, depth=thick_m, polyline=profile)
        mat = np.eye(4, dtype=float)
        mat[0, 3] = cx_m
        mat[1, 3] = cy_m
        mat[2, 3] = slab_z_center

        edit_object_placement(f, product=slab, matrix=mat)
        assign_representation(f, slab, rep)
        ifcopenshell.api.spatial.assign_container(f, products=[slab], relating_structure=st_inst)
        slab_products[fid] = slab
        geo_products += 1
        attach_kernel_identity_pset(slab, "Pset_SlabCommon", fid)

        slab_area_m2 = _polygon_area_m2_xy_mm(pts)
        slab_perm_m = _polygon_perimeter_m_xy_mm(
            [*pts, pts[0]] if pts else pts,
        )
        _try_attach_qto(
            f,
            slab,
            "Qto_SlabBaseQuantities",
            {
                "GrossArea": float(slab_area_m2),
                "NetArea": float(slab_area_m2),
                "Perimeter": float(slab_perm_m),
                "Width": float(thick_m),
            },
        )

    panel_thickness = 0.06

    def opening_t_extent(
        wall_ent: WallElem, opening_width_m: float, along_t: float
    ) -> tuple[float, float] | None:
        ll = np.hypot(
            (wall_ent.end.x_mm - wall_ent.start.x_mm) / 1000.0,
            (wall_ent.end.y_mm - wall_ent.start.y_mm) / 1000.0,
        )
        if ll < 10.0 / 1000.0:
            return None
        hw = opening_width_m / (2.0 * ll)

        half_t = float(_clamp(hw, 1e-4, 0.49))

        usable_t0 = half_t

        usable_t1 = 1.0 - half_t
        if usable_t1 <= usable_t0:

            return None

        ct = float(_clamp(along_t, usable_t0, usable_t1))

        return ct - half_t, ct + half_t

    def hosted_opening_bundle(
        host_wall_id: str,
        host_wall_ent: WallElem,
        *,
        filling_class: str,
        elem_name: str,
        kernel_elem_id: str,
        opening_width_mm: float,
        along_t: float,
        open_height_m: float,
        sill_offset_m: float,
        material_finish_key: str | None = None,
    ) -> None:
        nonlocal geo_products

        iw = wall_products.get(host_wall_id)

        assert iw is not None
        thick_m_host = _clamp(host_wall_ent.thickness_mm / 1000.0, 0.05, 2.0)
        elev_w = _elev_m(doc, host_wall_ent.level_id)
        wmat, len_m_host = wall_local_to_world_m(host_wall_ent, elev_w)

        width_open = _clamp(opening_width_mm / 1000.0, 0.2, len_m_host * 0.95)

        ih = open_height_m
        open_depth = float(max(thick_m_host * 1.55, panel_thickness * 2 + 1e-3, 0.35))

        tsp = opening_t_extent(host_wall_ent, width_open, along_t)
        if tsp is None:

            return
        t_left, _tr = tsp

        ox = float(t_left * len_m_host)
        oy_layer = float((thick_m_host - open_depth) / 2.0)
        oz = float(sill_offset_m)

        opening = ifcopenshell.api.root.create_entity(f, ifc_class="IfcOpeningElement", name=f"op:{elem_name}")
        rep_o = add_wall_representation(f, body_ctx, length=width_open, height=ih, thickness=open_depth)

        assign_representation(f, opening, rep_o)

        tpl = np.eye(4, dtype=float)
        tpl[0, 3] = ox

        tpl[1, 3] = oy_layer

        tpl[2, 3] = oz

        world_open = wmat @ tpl

        edit_object_placement(f, product=opening, matrix=world_open)
        ifc_feature.add_feature(f, feature=opening, element=iw)

        filler = ifcopenshell.api.root.create_entity(f, ifc_class=filling_class, name=elem_name)
        rep_f = add_wall_representation(
            f,
            body_ctx,
            length=width_open,

            height=ih,

            thickness=max(panel_thickness, thick_m_host * 0.35),

        )

        assign_representation(f, filler, rep_f)

        fill_y = float((thick_m_host - panel_thickness) / 2.0)
        tpl_f = np.eye(4, dtype=float)
        tpl_f[0, 3] = ox

        tpl_f[1, 3] = fill_y

        tpl_f[2, 3] = oz

        world_fill = wmat @ tpl_f

        edit_object_placement(f, product=filler, matrix=world_fill)
        ifc_feature.add_filling(f, opening=opening, element=filler)

        pset_name = "Pset_DoorCommon" if filling_class == "IfcDoor" else "Pset_WindowCommon"

        attach_kernel_identity_pset(
            filler,
            pset_name,
            kernel_elem_id,
            **({"MaterialFinish": material_finish_key} if material_finish_key else {}),
        )

        if filling_class == "IfcDoor":
            _try_attach_qto(
                f,
                filler,
                "Qto_DoorBaseQuantities",
                {"Width": float(width_open), "Height": float(ih)},
            )
        else:
            _try_attach_qto(
                f,
                filler,
                "Qto_WindowBaseQuantities",
                {"Width": float(width_open), "Height": float(ih)},
            )

        geo_products += 2

    for elem_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, DoorElem)):
        d = doc.elements[elem_id]
        assert isinstance(d, DoorElem)
        if d.wall_id not in wall_products:
            continue
        wh = doc.elements[d.wall_id]
        assert isinstance(wh, WallElem)
        w_h_m = _clamp(wh.height_mm / 1000.0, 0.25, 40.0)
        dh = float(_clamp(w_h_m * 0.86, 0.6, min(3.8, max(0.5, w_h_m - 0.05))))

        hosted_opening_bundle(
            d.wall_id,
            wh,
            filling_class="IfcDoor",

            elem_name=d.name or elem_id,

            kernel_elem_id=elem_id,

            opening_width_mm=d.width_mm,

            along_t=d.along_t,

            open_height_m=dh,

            sill_offset_m=0.0,
            material_finish_key=d.material_key,

        )

    for elem_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WindowElem)):
        zwin = doc.elements[elem_id]
        assert isinstance(zwin, WindowElem)
        if zwin.wall_id not in wall_products:
            continue
        wh_wall = doc.elements[zwin.wall_id]
        assert isinstance(wh_wall, WallElem)
        w_top = _elev_m(doc, wh_wall.level_id) + _clamp(wh_wall.height_mm / 1000.0, 0.25, 40.0)
        sill_z = float(_clamp(zwin.sill_height_mm / 1000.0, 0.06, max(0.2, w_top - 1.6)))
        wh_m = float(
            _clamp(
                zwin.height_mm / 1000.0,
                0.15,
                max(0.2, _clamp(wh_wall.height_mm / 1000.0, 0.25, 40.0) - sill_z - 0.08),
            )
        )

        hosted_opening_bundle(
            zwin.wall_id,
            wh_wall,
            filling_class="IfcWindow",
            elem_name=zwin.name or elem_id,

            kernel_elem_id=elem_id,

            opening_width_mm=zwin.width_mm,

            along_t=zwin.along_t,
            open_height_m=wh_m,
            sill_offset_m=sill_z,
            material_finish_key=zwin.material_key,

        )

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoomElem)):
        rm = doc.elements[rid]

        assert isinstance(rm, RoomElem)
        pts_outline = _room_outline_mm(rm)
        if len(pts_outline) < 3:
            continue

        lev_elev_m = float(_elev_m(doc, rm.level_id))
        base_z_m, ceil_z_m = _vertical_span_m(doc, rm, lev_elev_m)
        prism_h_m = float(_clamp(ceil_z_m - base_z_m, 2.2, 12.0))

        slab_z_mid = lev_elev_m + prism_h_m / 2.0

        cx_mm, cz_mm, _, _ = _xz_bounds_mm(pts_outline)

        cx_m = cx_mm / 1000.0

        cy_m = cz_mm / 1000.0

        profile_floor: list[tuple[float, float]] = []

        for px, py in pts_outline:
            profile_floor.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        profile_floor.append(profile_floor[0])

        sp = ifcopenshell.api.root.create_entity(f, ifc_class="IfcSpace", name=rm.name or rid)
        rep_sp = add_slab_representation(f, body_ctx, depth=prism_h_m, polyline=profile_floor)

        spa_mat = np.eye(4, dtype=float)

        spa_mat[0, 3] = cx_m
        spa_mat[1, 3] = cy_m
        spa_mat[2, 3] = slab_z_mid

        edit_object_placement(f, product=sp, matrix=spa_mat)
        assign_representation(f, sp, rep_sp)

        storey_sp = storey_for(rm.level_id)

        ifcopenshell.api.aggregate.assign_object(f, products=[sp], relating_object=storey_sp)
        geo_products += 1
        attach_kernel_identity_pset(sp, "Pset_SpaceCommon", rid, **_kernel_ifc_space_export_props(rm))
        gross_area = _polygon_area_m2_xy_mm(pts_outline)
        _try_attach_qto(
            f,
            sp,
            "Qto_SpaceBaseQuantities",
            {"GrossFloorArea": float(gross_area), "NetFloorArea": float(gross_area)},
        )

    for oid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, SlabOpeningElem)):
        sop = doc.elements[oid]
        assert isinstance(sop, SlabOpeningElem)
        host_slab_ent = slab_products.get(sop.host_floor_id)
        host_fl = doc.elements.get(sop.host_floor_id)
        if host_slab_ent is None or not isinstance(host_fl, FloorElem):
            continue
        op_pts_mm = [(p.x_mm, p.y_mm) for p in sop.boundary_mm]
        if len(op_pts_mm) < 3:
            continue
        cx_mm, cz_mm, _, _ = _xz_bounds_mm(op_pts_mm)
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0
        elev_z = float(_elev_m(doc, host_fl.level_id))
        thick_host = float(_clamp(host_fl.thickness_mm / 1000.0, 0.05, 1.8))
        slab_z_center = elev_z + thick_host / 2.0
        open_depth = float(max(thick_host * 2.25, 0.14))

        op_profile: list[tuple[float, float]] = []
        for px, py in op_pts_mm:
            op_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        op_profile.append(op_profile[0])

        op_el = ifcopenshell.api.root.create_entity(f, ifc_class="IfcOpeningElement", name=sop.name or oid)

        rep_op = add_slab_representation(f, body_ctx, depth=open_depth, polyline=op_profile)

        assign_representation(f, op_el, rep_op)

        omat = np.eye(4, dtype=float)
        omat[0, 3] = cx_m
        omat[1, 3] = cy_m

        omat[2, 3] = slab_z_center

        edit_object_placement(f, product=op_el, matrix=omat)
        ifc_feature.add_feature(f, feature=op_el, element=host_slab_ent)
        geo_products += 1

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        rp_mm = [(p.x_mm, p.y_mm) for p in rf.footprint_mm]
        if len(rp_mm) < 3:
            continue
        cx_mm, cz_mm, _, _ = _xz_bounds_mm(rp_mm)
        ov = _clamp(float(rf.overhang_mm or 0) / 1000.0, 0.0, 5.0)
        elev = float(_elev_m(doc, rf.reference_level_id))
        rise = float(_clamp(float(rf.slope_deg or 25) / 70.0, 0.25, 2.8))
        roof_z_center = elev + ov * 0.12 + rise / 2.0
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0

        r_profile: list[tuple[float, float]] = []
        for px, py in rp_mm:
            r_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        r_profile.append(r_profile[0])

        roof_ent = ifcopenshell.api.root.create_entity(f, ifc_class="IfcRoof", name=rf.name or rid)
        rep_rf = add_slab_representation(f, body_ctx, depth=rise, polyline=r_profile)

        rmat = np.eye(4, dtype=float)
        rmat[0, 3] = cx_m
        rmat[1, 3] = cy_m
        rmat[2, 3] = roof_z_center

        edit_object_placement(f, product=roof_ent, matrix=rmat)
        assign_representation(f, roof_ent, rep_rf)
        st_roof = storey_for(rf.reference_level_id)
        ifcopenshell.api.spatial.assign_container(f, products=[roof_ent], relating_structure=st_roof)
        geo_products += 1
        attach_kernel_identity_pset(roof_ent, "Pset_RoofCommon", rid)

    for sid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, StairElem)):
        st = doc.elements[sid]
        assert isinstance(st, StairElem)
        sx = st.run_start.x_mm / 1000.0
        sy = st.run_start.y_mm / 1000.0
        ex = st.run_end.x_mm / 1000.0
        ey = st.run_end.y_mm / 1000.0
        bl = doc.elements.get(st.base_level_id)
        tl = doc.elements.get(st.top_level_id)
        rise_mm = (
            abs(tl.elevation_mm - bl.elevation_mm)
            if isinstance(bl, LevelElem) and isinstance(tl, LevelElem)
            else float(st.riser_mm) * 16.0
        )
        rise_m = float(_clamp(rise_mm / 1000.0, 0.5, 12.0))
        elev_base = float(_elev_m(doc, st.base_level_id))
        width_m = float(_clamp(st.width_mm / 1000.0, 0.3, 4.0))

        stair_ent = ifcopenshell.api.root.create_entity(f, ifc_class="IfcStair", name=st.name or sid)
        rep_st = create_2pt_wall(f, stair_ent, body_ctx, (sx, sy), (ex, ey), elev_base, rise_m, width_m)
        assign_representation(f, stair_ent, rep_st)
        st_inst_st = storey_for(st.base_level_id)
        ifcopenshell.api.spatial.assign_container(f, products=[stair_ent], relating_structure=st_inst_st)
        geo_products += 1
        attach_kernel_identity_pset(stair_ent, "Pset_StairCommon", sid)

    if geo_products == 0:

        return None, 0

    return f.wrapped_data.to_string(), geo_products

