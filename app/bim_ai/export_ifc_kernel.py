from __future__ import annotations

import math
from typing import Any

import numpy as np

from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    FloorElem,
    LevelElem,
    RailingElem,
    RoofElem,
    RoofOpeningElem,
    RoomElem,
    SiteElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.export_ifc_geometry import (
    clamp,
    level_elevation_m,
    polygon_area_m2_xy_mm,
    polygon_perimeter_m_xy_mm,
    room_outline_mm,
    room_vertical_span_m,
    wall_local_to_world_m,
    xz_bounds_mm,
)
from bim_ai.export_ifc_properties import (
    attach_beam_common_pset,
    attach_ceiling_common_pset,
    attach_column_common_pset,
    attach_railing_common_pset,
    attach_stair_common_pset,
    maybe_attach_classification,
    try_attach_classification_reference,
    try_attach_qto,
)
from bim_ai.ifc_material_layer_exchange_v0 import (
    try_attach_kernel_ifc_material_layer_set,
    try_attach_kernel_ifc_single_material,
)
from bim_ai.material_assembly_resolve import (
    resolved_layers_for_floor,
    resolved_layers_for_roof,
    resolved_layers_for_wall,
)
from bim_ai.roof_geometry import (
    footprint_is_valid_axis_aligned_rectangle_mm,
    gable_half_run_mm_and_ridge_axis,
)


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


def _kernel_ifc_wall_common_props(wall: WallElem) -> dict[str, Any]:
    props: dict[str, Any] = {}
    if wall.load_bearing is not None:
        props["LoadBearing"] = bool(wall.load_bearing)
    elif wall.structural_role == "load_bearing":
        props["LoadBearing"] = True
    elif wall.structural_role == "non_load_bearing":
        props["LoadBearing"] = False
    if wall.structural_role != "unknown":
        props["BimAiStructuralRole"] = wall.structural_role
    if wall.analytical_participation:
        props["BimAiAnalyticalParticipation"] = True
    if wall.structural_material_key:
        props["BimAiStructuralMaterialKey"] = wall.structural_material_key
    if wall.structural_intent_confidence is not None:
        props["BimAiStructuralIntentConfidence"] = float(wall.structural_intent_confidence)
    return props


def try_build_kernel_ifc(doc: Document) -> tuple[str | None, int]:
    """Build IFC geometry or return `(None, 0)` to fall back to empty hull."""

    import ifcopenshell.api.aggregate
    import ifcopenshell.api.context
    import ifcopenshell.api.feature as ifc_feature
    import ifcopenshell.api.project
    import ifcopenshell.api.root
    import ifcopenshell.api.spatial
    import ifcopenshell.api.type
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
    slab_type_entities: dict[str, Any] = {}
    material_by_key_cache: dict[str, Any] = {}
    # IFC-04: dedupe IfcClassification + IfcClassificationReference entities
    # so multiple products with the same code share one reference.
    classification_cache: dict[str, Any] = {}
    classification_ref_cache: dict[str, Any] = {}
    # IFC-03: track roof entities by kernel id so we can attach
    # IfcOpeningElement features when the kernel has roof openings.
    roof_products: dict[str, Any] = {}
    # IFC-03: per-roof rough z-center used to position opening features.
    roof_z_center_by_id: dict[str, float] = {}
    roof_extrusion_depth_by_id: dict[str, float] = {}

    def attach_kernel_identity_pset(
        product: Any, pset_name: str, reference: str, **props: Any
    ) -> None:
        try:
            from ifcopenshell.api.pset.add_pset import add_pset  # type: ignore import-not-found
            from ifcopenshell.api.pset.edit_pset import edit_pset  # type: ignore import-not-found

        except ImportError:
            return
        merged: dict[str, Any] = {"Reference": reference, **props}

        pset = add_pset(f, product=product, name=pset_name)

        edit_pset(f, pset=pset, properties=merged)

    kernel_site_ids_sorted = sorted(
        eid for eid, e in doc.elements.items() if isinstance(e, SiteElem)
    )
    if kernel_site_ids_sorted:
        first_site_el = doc.elements[kernel_site_ids_sorted[0]]
        assert isinstance(first_site_el, SiteElem)
        site.Name = first_site_el.name or kernel_site_ids_sorted[0]
        attach_kernel_identity_pset(site, "Pset_SiteCommon", ",".join(kernel_site_ids_sorted))

    for wid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = doc.elements[wid]

        assert isinstance(w, WallElem)
        st_inst = storey_for(w.level_id)

        sx = w.start.x_mm / 1000.0
        sy = w.start.y_mm / 1000.0

        ex = w.end.x_mm / 1000.0

        ey = w.end.y_mm / 1000.0

        ez = level_elevation_m(doc, w.level_id)
        height_m = clamp(w.height_mm / 1000.0, 0.25, 40.0)
        thick_m = clamp(w.thickness_mm / 1000.0, 0.05, 2.0)

        wal = ifcopenshell.api.root.create_entity(f, ifc_class="IfcWall", name=w.name or wid)

        rep = create_2pt_wall(f, wal, body_ctx, (sx, sy), (ex, ey), ez, height_m, thick_m)
        assign_representation(f, wal, rep)

        ifcopenshell.api.spatial.assign_container(f, products=[wal], relating_structure=st_inst)
        wall_products[wid] = wal
        geo_products += 1
        attach_kernel_identity_pset(wal, "Pset_WallCommon", wid, **_kernel_ifc_wall_common_props(w))
        _wmat_unused, length_m = wall_local_to_world_m(w, ez)
        # IFC-04: gross side area of the wall + net side area (gross less the
        # area of every door/window hosted on this wall). Falls back to gross
        # when the host wall has no openings.
        gross_side_area_m2 = float(length_m) * float(height_m)
        opening_area_m2 = 0.0
        for _e in doc.elements.values():
            if isinstance(_e, DoorElem) and _e.wall_id == wid:
                wo = clamp(float(_e.width_mm) / 1000.0, 0.05, 12.0)
                ho = clamp(height_m * 0.86, 0.6, max(0.5, height_m - 0.05))
                opening_area_m2 += wo * float(ho)
            elif isinstance(_e, WindowElem) and _e.wall_id == wid:
                wo = clamp(float(_e.width_mm) / 1000.0, 0.05, 12.0)
                hwin = clamp(float(_e.height_mm) / 1000.0, 0.15, max(0.2, height_m - 0.2))
                opening_area_m2 += wo * float(hwin)
        net_side_area_m2 = max(0.0, gross_side_area_m2 - opening_area_m2)
        try_attach_qto(
            f,
            wal,
            "Qto_WallBaseQuantities",
            {
                "Length": float(length_m),
                "Height": float(height_m),
                "Width": float(thick_m),
                "GrossSideArea": gross_side_area_m2,
                "NetSideArea": net_side_area_m2,
            },
        )
        w_layers = resolved_layers_for_wall(doc, w)
        if w_layers:
            try_attach_kernel_ifc_material_layer_set(
                f,
                doc,
                wal,
                layers=w_layers,
                layer_set_display_name=f"kernel_wall:{wid}",
                material_by_key_cache=material_by_key_cache,
            )
        else:
            # IFC-04: fallback for walls without an authored wall_type — bind
            # the single materialKey via IfcRelAssociatesMaterial so QTO+
            # materials line up with the door / window path.
            try_attach_kernel_ifc_single_material(
                f,
                product=wal,
                material_key=getattr(w, "material_key", None),
                material_by_key_cache=material_by_key_cache,
            )
        try_attach_classification_reference(
            f,
            wal,
            classification_code=getattr(w, "ifc_classification_code", None),
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )

    for fid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = doc.elements[fid]
        assert isinstance(fl, FloorElem)
        pts = [(p.x_mm, p.y_mm) for p in fl.boundary_mm]
        if len(pts) < 3:
            continue
        st_inst = storey_for(fl.level_id)

        cx_mm, cz_mm, _, _ = xz_bounds_mm(pts)
        cx_m = cx_mm / 1000.0

        cy_m = cz_mm / 1000.0

        elev_z = level_elevation_m(doc, fl.level_id)
        thick_m = clamp(fl.thickness_mm / 1000.0, 0.05, 1.8)

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

        ftid = (fl.floor_type_id or "").strip()
        if ftid:
            st_ent = slab_type_entities.get(ftid)
            if st_ent is None:
                st_ent = ifcopenshell.api.root.create_entity(
                    f, ifc_class="IfcSlabType", name=fl.name or ftid
                )
                if hasattr(st_ent, "PredefinedType"):
                    st_ent.PredefinedType = "NOTDEFINED"
                attach_kernel_identity_pset(st_ent, "Pset_SlabCommon", ftid)
                slab_type_entities[ftid] = st_ent
            ifcopenshell.api.type.assign_type(
                f,
                related_objects=[slab],
                relating_type=st_ent,
                should_map_representations=False,
            )
        if hasattr(slab, "PredefinedType"):
            slab.PredefinedType = "FLOOR"

        slab_area_m2 = polygon_area_m2_xy_mm(pts)
        slab_perm_m = polygon_perimeter_m_xy_mm(
            [*pts, pts[0]] if pts else pts,
        )
        try_attach_qto(
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
        try_attach_classification_reference(
            f,
            slab,
            classification_code=getattr(fl, "ifc_classification_code", None),
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )
        fl_layers = resolved_layers_for_floor(doc, fl)
        if fl_layers:
            try_attach_kernel_ifc_material_layer_set(
                f,
                doc,
                slab,
                layers=fl_layers,
                layer_set_display_name=f"kernel_slab:{fid}",
                material_by_key_cache=material_by_key_cache,
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

        half_t = float(clamp(hw, 1e-4, 0.49))

        usable_t0 = half_t

        usable_t1 = 1.0 - half_t
        if usable_t1 <= usable_t0:
            return None

        ct = float(clamp(along_t, usable_t0, usable_t1))

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
        classification_code: str | None = None,
    ) -> None:
        nonlocal geo_products

        iw = wall_products.get(host_wall_id)

        assert iw is not None
        thick_m_host = clamp(host_wall_ent.thickness_mm / 1000.0, 0.05, 2.0)
        elev_w = level_elevation_m(doc, host_wall_ent.level_id)
        wmat, len_m_host = wall_local_to_world_m(host_wall_ent, elev_w)

        width_open = clamp(opening_width_mm / 1000.0, 0.2, len_m_host * 0.95)

        ih = open_height_m
        open_depth = float(max(thick_m_host * 1.55, panel_thickness * 2 + 1e-3, 0.35))

        tsp = opening_t_extent(host_wall_ent, width_open, along_t)
        if tsp is None:
            return
        t_left, _tr = tsp

        ox = float(t_left * len_m_host)
        oy_layer = float((thick_m_host - open_depth) / 2.0)
        oz = float(sill_offset_m)

        opening = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcOpeningElement", name=f"op:{elem_name}"
        )
        rep_o = add_wall_representation(
            f, body_ctx, length=width_open, height=ih, thickness=open_depth
        )

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
            try_attach_qto(
                f,
                filler,
                "Qto_DoorBaseQuantities",
                {
                    "Width": float(width_open),
                    "Height": float(ih),
                    # IFC-04: leaf area in m².
                    "Area": float(width_open) * float(ih),
                },
            )
        else:
            try_attach_qto(
                f,
                filler,
                "Qto_WindowBaseQuantities",
                {
                    "Width": float(width_open),
                    "Height": float(ih),
                    # IFC-04: opening area in m².
                    "Area": float(width_open) * float(ih),
                },
            )

        # IFC-04: attach single IfcMaterial when the door / window carries
        # a kernel materialKey (frame finish on doors, glass on windows).
        if material_finish_key:
            try_attach_kernel_ifc_single_material(
                f,
                product=filler,
                material_key=material_finish_key,
                material_by_key_cache=material_by_key_cache,
            )

        # IFC-04: attach IfcClassificationReference when set on the door /
        # window kernel element.
        try_attach_classification_reference(
            f,
            filler,
            classification_code=classification_code,
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )

        geo_products += 2

    for elem_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, DoorElem)):
        d = doc.elements[elem_id]
        assert isinstance(d, DoorElem)
        if d.wall_id not in wall_products:
            continue
        wh = doc.elements[d.wall_id]
        assert isinstance(wh, WallElem)
        w_h_m = clamp(wh.height_mm / 1000.0, 0.25, 40.0)
        dh = float(clamp(w_h_m * 0.86, 0.6, min(3.8, max(0.5, w_h_m - 0.05))))

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
            classification_code=getattr(d, "ifc_classification_code", None),
        )

    for elem_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WindowElem)):
        zwin = doc.elements[elem_id]
        assert isinstance(zwin, WindowElem)
        if zwin.wall_id not in wall_products:
            continue
        wh_wall = doc.elements[zwin.wall_id]
        assert isinstance(wh_wall, WallElem)
        w_top = level_elevation_m(doc, wh_wall.level_id) + clamp(
            wh_wall.height_mm / 1000.0, 0.25, 40.0
        )
        sill_z = float(clamp(zwin.sill_height_mm / 1000.0, 0.06, max(0.2, w_top - 1.6)))
        wh_m = float(
            clamp(
                zwin.height_mm / 1000.0,
                0.15,
                max(0.2, clamp(wh_wall.height_mm / 1000.0, 0.25, 40.0) - sill_z - 0.08),
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
            classification_code=getattr(zwin, "ifc_classification_code", None),
        )

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoomElem)):
        rm = doc.elements[rid]

        assert isinstance(rm, RoomElem)
        pts_outline = room_outline_mm(rm)
        if len(pts_outline) < 3:
            continue

        lev_elev_m = float(level_elevation_m(doc, rm.level_id))
        base_z_m, ceil_z_m = room_vertical_span_m(doc, rm, lev_elev_m)
        prism_h_m = float(clamp(ceil_z_m - base_z_m, 2.2, 12.0))

        slab_z_mid = lev_elev_m + prism_h_m / 2.0

        cx_mm, cz_mm, _, _ = xz_bounds_mm(pts_outline)

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
        attach_kernel_identity_pset(
            sp, "Pset_SpaceCommon", rid, **_kernel_ifc_space_export_props(rm)
        )
        gross_area = polygon_area_m2_xy_mm(pts_outline)
        net_perimeter = polygon_perimeter_m_xy_mm(pts_outline)
        net_volume = float(gross_area) * float(prism_h_m)
        try_attach_qto(
            f,
            sp,
            "Qto_SpaceBaseQuantities",
            {
                "GrossFloorArea": float(gross_area),
                "NetFloorArea": float(gross_area),
                "NetVolume": net_volume,
                "NetPerimeter": net_perimeter,
            },
        )
        try_attach_classification_reference(
            f,
            sp,
            classification_code=getattr(rm, "ifc_classification_code", None),
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
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
        cx_mm, cz_mm, _, _ = xz_bounds_mm(op_pts_mm)
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0
        elev_z = float(level_elevation_m(doc, host_fl.level_id))
        thick_host = float(clamp(host_fl.thickness_mm / 1000.0, 0.05, 1.8))
        slab_z_center = elev_z + thick_host / 2.0
        open_depth = float(max(thick_host * 2.25, 0.14))

        op_profile: list[tuple[float, float]] = []
        for px, py in op_pts_mm:
            op_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        op_profile.append(op_profile[0])

        op_el = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcOpeningElement", name=f"op:{oid}"
        )

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
        cx_mm, cz_mm, span_x_mm, span_z_mm = xz_bounds_mm(rp_mm)
        ov = clamp(float(rf.overhang_mm or 0) / 1000.0, 0.0, 5.0)
        elev = float(level_elevation_m(doc, rf.reference_level_id))
        rise = float(clamp(float(rf.slope_deg or 25) / 70.0, 0.25, 2.8))
        roof_z_center = elev + ov * 0.12 + rise / 2.0
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0

        # IFC-02: emit a gable-shaped triangular extrusion when the kernel
        # roofGeometryMode is gable_pitched_rectangle or asymmetric_gable AND
        # the footprint is a valid axis-aligned rectangle. Falls back to the
        # original flat slab prism for mass_box / flat / hip / l_shape modes.
        use_gable_body = rf.roof_geometry_mode in (
            "gable_pitched_rectangle",
            "asymmetric_gable",
        ) and footprint_is_valid_axis_aligned_rectangle_mm(rp_mm)

        if use_gable_body:
            # Eave plate elevation: walls on the reference level give the eave Y.
            walls_at_ref = [
                w
                for w in doc.elements.values()
                if isinstance(w, WallElem) and w.level_id == rf.reference_level_id
            ]
            wall_top_m = max(
                ((w.height_mm or 0) / 1000.0 for w in walls_at_ref),
                default=0.0,
            )
            eave_z_m = elev + wall_top_m

            # Determine ridge axis using the same predicate as the kernel.
            _half_run_mm, ridge_axis_token = gable_half_run_mm_and_ridge_axis(span_x_mm, span_z_mm)
            ridge_along_x = ridge_axis_token == "alongX"
            # The cross-axis is perpendicular to the ridge.
            perp_span_mm = span_z_mm if ridge_along_x else span_x_mm
            along_ridge_mm = span_x_mm if ridge_along_x else span_z_mm
            half_perp_m = perp_span_mm / 2000.0
            along_ridge_m = along_ridge_mm / 1000.0

            slope_deg = float(rf.slope_deg or 25.0)
            slope_rad = math.radians(clamp(slope_deg, 5.0, 70.0))

            ridge_offset_m = (rf.ridge_offset_transverse_mm or 0.0) / 1000.0
            # Clamp inside the rectangle so the ridge stays interior.
            ridge_offset_m = max(-half_perp_m + 1e-6, min(half_perp_m - 1e-6, ridge_offset_m))

            eave_left_z_m = (
                elev + (rf.eave_height_left_mm or 0.0) / 1000.0
                if rf.eave_height_left_mm is not None
                else eave_z_m
            )
            eave_right_z_m = (
                elev + (rf.eave_height_right_mm or 0.0) / 1000.0
                if rf.eave_height_right_mm is not None
                else eave_z_m
            )
            left_run_m = half_perp_m + ridge_offset_m
            ridge_z_m = eave_left_z_m + left_run_m * math.tan(slope_rad)
            base_z_m = min(eave_left_z_m, eave_right_z_m)

            # 2D profile in the cross-section plane (X = across-ridge horizontal,
            # Y = vertical above base_z). Anti-clockwise winding viewed from +Z.
            triangle_pts = [
                (-half_perp_m, eave_left_z_m - base_z_m),
                (half_perp_m, eave_right_z_m - base_z_m),
                (ridge_offset_m, ridge_z_m - base_z_m),
                (-half_perp_m, eave_left_z_m - base_z_m),
            ]
            polyline = f.create_entity(
                "IfcPolyline",
                Points=[
                    f.create_entity(
                        "IfcCartesianPoint",
                        Coordinates=(float(px), float(py)),
                    )
                    for px, py in triangle_pts
                ],
            )
            profile = f.create_entity(
                "IfcArbitraryClosedProfileDef",
                ProfileType="AREA",
                OuterCurve=polyline,
            )
            # Default placement: profile in local XY, extrusion along local +Z.
            extruded = f.create_entity(
                "IfcExtrudedAreaSolid",
                SweptArea=profile,
                Position=f.create_entity(
                    "IfcAxis2Placement3D",
                    Location=f.create_entity(
                        "IfcCartesianPoint",
                        Coordinates=(0.0, 0.0, 0.0),
                    ),
                    Axis=f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
                    RefDirection=f.create_entity("IfcDirection", DirectionRatios=(1.0, 0.0, 0.0)),
                ),
                ExtrudedDirection=f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
                Depth=along_ridge_m,
            )
            rep_rf = f.create_entity(
                "IfcShapeRepresentation",
                ContextOfItems=body_ctx,
                RepresentationIdentifier="Body",
                RepresentationType="SweptSolid",
                Items=(extruded,),
            )

            roof_ent = ifcopenshell.api.root.create_entity(
                f, ifc_class="IfcRoof", name=rf.name or rid
            )
            roof_products[rid] = roof_ent
            # IFC-03: gable extrusion depth equals along_ridge_m; opening
            # features hang on the roof at the gable's mid-height.
            roof_z_center_by_id[rid] = float(base_z_m + (ridge_z_m - base_z_m) / 2.0)
            roof_extrusion_depth_by_id[rid] = float(along_ridge_m)

            # Build the object placement so that:
            #   ridge_along_x → local X→world Y, local Y→world Z, local Z→world X
            #   ridge_along_z → local X→world X, local Y→world Z, local Z→world Y
            # Translate so the extrusion is centered on the rectangle center, base
            # of the cross-section sits at base_z_m.
            R = np.eye(3, dtype=float)
            if ridge_along_x:
                R = np.array(
                    [
                        [0.0, 0.0, 1.0],
                        [1.0, 0.0, 0.0],
                        [0.0, 1.0, 0.0],
                    ],
                    dtype=float,
                )
                origin_world = np.array(
                    [cx_m - along_ridge_m / 2.0, cy_m, base_z_m],
                    dtype=float,
                )
            else:
                R = np.array(
                    [
                        [1.0, 0.0, 0.0],
                        [0.0, 0.0, 1.0],
                        [0.0, 1.0, 0.0],
                    ],
                    dtype=float,
                )
                origin_world = np.array(
                    [cx_m, cy_m - along_ridge_m / 2.0, base_z_m],
                    dtype=float,
                )

            rmat = np.eye(4, dtype=float)
            rmat[:3, :3] = R
            rmat[:3, 3] = origin_world
        else:
            r_profile: list[tuple[float, float]] = []
            for px, py in rp_mm:
                r_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

            r_profile.append(r_profile[0])

            roof_ent = ifcopenshell.api.root.create_entity(
                f, ifc_class="IfcRoof", name=rf.name or rid
            )
            roof_products[rid] = roof_ent
            roof_z_center_by_id[rid] = float(roof_z_center)
            roof_extrusion_depth_by_id[rid] = float(rise)
            rep_rf = add_slab_representation(f, body_ctx, depth=rise, polyline=r_profile)

            rmat = np.eye(4, dtype=float)
            rmat[0, 3] = cx_m
            rmat[1, 3] = cy_m
            rmat[2, 3] = roof_z_center

        edit_object_placement(f, product=roof_ent, matrix=rmat)
        assign_representation(f, roof_ent, rep_rf)
        st_roof = storey_for(rf.reference_level_id)
        ifcopenshell.api.spatial.assign_container(
            f, products=[roof_ent], relating_structure=st_roof
        )
        geo_products += 1
        attach_kernel_identity_pset(roof_ent, "Pset_RoofCommon", rid)
        # IFC-01: round-trip kernel `roofTypeId` via a bim-ai-namespaced Pset.
        # Pset_RoofCommon.Reference is reserved for the kernel element id, so we
        # use a separate Pset_BimAiKernel that carries the roof_type_id literal.
        # IFC-02: also store roofGeometryMode + the rectangle plan footprint so
        # the authoritative replay can recover the kernel mode/outline without
        # having to invert the gable extrusion's placement and triangular profile.
        bim_ai_props: dict[str, Any] = {}
        if rf.roof_type_id:
            bim_ai_props["BimAiRoofTypeId"] = str(rf.roof_type_id)
        bim_ai_props["BimAiRoofGeometryMode"] = rf.roof_geometry_mode
        if use_gable_body:
            bim_ai_props["BimAiRoofPlanFootprintMm"] = ";".join(
                f"{px:.3f},{py:.3f}" for px, py in rp_mm
            )
            if rf.ridge_offset_transverse_mm is not None:
                bim_ai_props["BimAiRoofRidgeOffsetTransverseMm"] = float(
                    rf.ridge_offset_transverse_mm
                )
            if rf.eave_height_left_mm is not None:
                bim_ai_props["BimAiRoofEaveHeightLeftMm"] = float(rf.eave_height_left_mm)
            if rf.eave_height_right_mm is not None:
                bim_ai_props["BimAiRoofEaveHeightRightMm"] = float(rf.eave_height_right_mm)
        if bim_ai_props:
            attach_kernel_identity_pset(roof_ent, "Pset_BimAiKernel", rid, **bim_ai_props)
        rf_layers = resolved_layers_for_roof(doc, rf)
        if rf_layers:
            try_attach_kernel_ifc_material_layer_set(
                f,
                doc,
                roof_ent,
                layers=rf_layers,
                layer_set_display_name=f"kernel_roof:{rid}",
                material_by_key_cache=material_by_key_cache,
            )
        else:
            # IFC-04: roofs without a roof_type get a single material via
            # IfcRelAssociatesMaterial so MAT-01 metadata still ships.
            try_attach_kernel_ifc_single_material(
                f,
                product=roof_ent,
                material_key=getattr(rf, "material_key", None),
                material_by_key_cache=material_by_key_cache,
            )
        # IFC-04: roof QTO via Qto_SlabBaseQuantities (IfcRoof shares the
        # slab geometry surface). GrossArea is the plan footprint area;
        # Perimeter is the closed-loop perimeter.
        roof_area_m2 = polygon_area_m2_xy_mm(rp_mm)
        roof_perim_m = polygon_perimeter_m_xy_mm([*rp_mm, rp_mm[0]] if rp_mm else rp_mm)
        try_attach_qto(
            f,
            roof_ent,
            "Qto_SlabBaseQuantities",
            {
                "GrossArea": float(roof_area_m2),
                "NetArea": float(roof_area_m2),
                "Perimeter": float(roof_perim_m),
            },
        )
        try_attach_classification_reference(
            f,
            roof_ent,
            classification_code=getattr(rf, "ifc_classification_code", None),
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )

    # IFC-03: emit roof-hosted IfcOpeningElement features. The opening
    # extrusion is centred on the roof's z-mid and given a depth large
    # enough to fully cut through the roof body when the receiving
    # parser CSG-subtracts it. Footprint is plan-coordinates only — for
    # the load-bearing slice we don't model slope-aware projection.
    for oid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofOpeningElem)):
        rop = doc.elements[oid]
        assert isinstance(rop, RoofOpeningElem)
        host_roof_ent = roof_products.get(rop.host_roof_id)
        host_rf = doc.elements.get(rop.host_roof_id)
        if host_roof_ent is None or not isinstance(host_rf, RoofElem):
            continue
        op_pts_mm = [(p.x_mm, p.y_mm) for p in rop.boundary_mm]
        if len(op_pts_mm) < 3:
            continue
        cx_mm, cz_mm, _, _ = xz_bounds_mm(op_pts_mm)
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0
        z_center = roof_z_center_by_id.get(rop.host_roof_id, 0.0)
        depth_host = roof_extrusion_depth_by_id.get(rop.host_roof_id, 0.6)
        # Stretch the opening prism well past the roof body so the
        # parser's CSG subtraction is unambiguous regardless of slope.
        open_depth = float(max(depth_host * 2.5, 0.4))

        op_profile: list[tuple[float, float]] = []
        for px, py in op_pts_mm:
            op_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))
        op_profile.append(op_profile[0])

        op_el = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcOpeningElement", name=f"op:{oid}"
        )
        rep_op = add_slab_representation(f, body_ctx, depth=open_depth, polyline=op_profile)
        assign_representation(f, op_el, rep_op)

        omat = np.eye(4, dtype=float)
        omat[0, 3] = cx_m
        omat[1, 3] = cy_m
        omat[2, 3] = float(z_center) - open_depth / 2.0

        edit_object_placement(f, product=op_el, matrix=omat)
        ifc_feature.add_feature(f, feature=op_el, element=host_roof_ent)
        attach_kernel_identity_pset(op_el, "Pset_OpeningElementCommon", oid)
        geo_products += 1

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
        rise_m = float(clamp(rise_mm / 1000.0, 0.5, 12.0))
        elev_base = float(level_elevation_m(doc, st.base_level_id))
        width_m = float(clamp(st.width_mm / 1000.0, 0.3, 4.0))

        stair_ent = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcStair", name=st.name or sid
        )
        rep_st = create_2pt_wall(
            f, stair_ent, body_ctx, (sx, sy), (ex, ey), elev_base, rise_m, width_m
        )
        assign_representation(f, stair_ent, rep_st)
        st_inst_st = storey_for(st.base_level_id)
        ifcopenshell.api.spatial.assign_container(
            f, products=[stair_ent], relating_structure=st_inst_st
        )
        geo_products += 1
        attach_kernel_identity_pset(stair_ent, "Pset_StairCommon", sid)
        riser_mm_val = float(st.riser_mm) if st.riser_mm > 0 else 175.0
        riser_count = max(1, round(rise_mm / riser_mm_val))
        run_len_m = math.hypot(ex - sx, ey - sy)
        try_attach_qto(
            f,
            stair_ent,
            "Qto_StairBaseQuantities",
            {
                "NumberOfRisers": float(riser_count),
                "NumberOfTreads": float(max(0, riser_count - 1)),
                "Height": rise_m,
                "Length": run_len_m,
            },
        )
        # IFC-04: full Pset_StairCommon properties (NumberOfRiser /
        # NumberOfTreads / RiserHeight / TreadLength) on top of the
        # kernel-identity Reference, plus optional classification.
        attach_stair_common_pset(f, stair_ent, st, doc)
        maybe_attach_classification(
            f,
            stair_ent,
            st,
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )

    # IFC-04: column / beam / ceiling / railing export — closes out the
    # non-architectural per-kind Pset_*Common coverage.
    for cid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, ColumnElem)):
        col = doc.elements[cid]
        assert isinstance(col, ColumnElem)
        cx = float(col.position_mm.x_mm) / 1000.0
        cy = float(col.position_mm.y_mm) / 1000.0
        elev = (
            float(level_elevation_m(doc, col.level_id))
            + float(col.base_constraint_offset_mm) / 1000.0
        )
        b_m = float(clamp(col.b_mm / 1000.0, 0.05, 6.0))
        h_m = float(clamp(col.h_mm / 1000.0, 0.05, 6.0))
        height_m = float(clamp(col.height_mm / 1000.0, 0.1, 40.0))
        rot_rad = math.radians(float(col.rotation_deg))
        col_ent = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcColumn", name=col.name or cid
        )
        profile = f.create_entity(
            "IfcRectangleProfileDef",
            ProfileType="AREA",
            XDim=b_m,
            YDim=h_m,
        )
        extruded = f.create_entity(
            "IfcExtrudedAreaSolid",
            SweptArea=profile,
            Position=f.create_entity(
                "IfcAxis2Placement3D",
                Location=f.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0)),
                Axis=f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
                RefDirection=f.create_entity("IfcDirection", DirectionRatios=(1.0, 0.0, 0.0)),
            ),
            ExtrudedDirection=f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
            Depth=height_m,
        )
        rep_col = f.create_entity(
            "IfcShapeRepresentation",
            ContextOfItems=body_ctx,
            RepresentationIdentifier="Body",
            RepresentationType="SweptSolid",
            Items=(extruded,),
        )
        cmat = np.eye(4, dtype=float)
        cmat[0, 0] = math.cos(rot_rad)
        cmat[0, 1] = -math.sin(rot_rad)
        cmat[1, 0] = math.sin(rot_rad)
        cmat[1, 1] = math.cos(rot_rad)
        cmat[0, 3] = cx
        cmat[1, 3] = cy
        cmat[2, 3] = elev
        edit_object_placement(f, product=col_ent, matrix=cmat)
        assign_representation(f, col_ent, rep_col)
        ifcopenshell.api.spatial.assign_container(
            f, products=[col_ent], relating_structure=storey_for(col.level_id)
        )
        geo_products += 1
        attach_kernel_identity_pset(col_ent, "Pset_ColumnCommon", cid)
        attach_column_common_pset(f, col_ent, col)
        if col.material_key:
            try_attach_kernel_ifc_single_material(
                f,
                product=col_ent,
                material_key=col.material_key,
                material_by_key_cache=material_by_key_cache,
            )
        maybe_attach_classification(
            f,
            col_ent,
            col,
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )

    for bid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, BeamElem)):
        bm = doc.elements[bid]
        assert isinstance(bm, BeamElem)
        bsx = float(bm.start_mm.x_mm) / 1000.0
        bsy = float(bm.start_mm.y_mm) / 1000.0
        bex = float(bm.end_mm.x_mm) / 1000.0
        bey = float(bm.end_mm.y_mm) / 1000.0
        span_m = math.hypot(bex - bsx, bey - bsy)
        if span_m < 1e-6:
            continue
        elev_b = float(level_elevation_m(doc, bm.level_id))
        beam_w = float(clamp(bm.width_mm / 1000.0, 0.05, 4.0))
        beam_h = float(clamp(bm.height_mm / 1000.0, 0.05, 4.0))
        beam_ent = ifcopenshell.api.root.create_entity(f, ifc_class="IfcBeam", name=bm.name or bid)
        # Beam profile is widthMm × heightMm; extruded along the start→end
        # axis (local +Z). World placement rotates local +Z to align with
        # the beam's plan direction and lifts the beam by heightMm/2 so
        # the cross-section sits below the level top.
        profile_b = f.create_entity(
            "IfcRectangleProfileDef",
            ProfileType="AREA",
            XDim=beam_w,
            YDim=beam_h,
        )
        extruded_b = f.create_entity(
            "IfcExtrudedAreaSolid",
            SweptArea=profile_b,
            Position=f.create_entity(
                "IfcAxis2Placement3D",
                Location=f.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0)),
                Axis=f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
                RefDirection=f.create_entity("IfcDirection", DirectionRatios=(1.0, 0.0, 0.0)),
            ),
            ExtrudedDirection=f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
            Depth=span_m,
        )
        rep_b = f.create_entity(
            "IfcShapeRepresentation",
            ContextOfItems=body_ctx,
            RepresentationIdentifier="Body",
            RepresentationType="SweptSolid",
            Items=(extruded_b,),
        )
        # Local frame: +Z = beam axis (start→end horizontal), +X = vertical (Z),
        # +Y = perpendicular horizontal. Build a rotation that maps these onto
        # the world axes. Profile X = world Z (beam height), profile Y =
        # world horizontal-perpendicular (beam width); extrusion along axis.
        ax = (bex - bsx) / span_m
        ay = (bey - bsy) / span_m
        # World basis vectors of the local frame.
        local_z_world = np.array([ax, ay, 0.0], dtype=float)  # extrusion direction
        local_y_world = np.array([-ay, ax, 0.0], dtype=float)  # perpendicular horizontal
        local_x_world = np.array([0.0, 0.0, 1.0], dtype=float)  # vertical
        bmat = np.eye(4, dtype=float)
        bmat[:3, 0] = local_x_world
        bmat[:3, 1] = local_y_world
        bmat[:3, 2] = local_z_world
        bmat[0, 3] = bsx
        bmat[1, 3] = bsy
        bmat[2, 3] = elev_b - beam_h / 2.0
        edit_object_placement(f, product=beam_ent, matrix=bmat)
        assign_representation(f, beam_ent, rep_b)
        ifcopenshell.api.spatial.assign_container(
            f, products=[beam_ent], relating_structure=storey_for(bm.level_id)
        )
        geo_products += 1
        attach_kernel_identity_pset(beam_ent, "Pset_BeamCommon", bid)
        attach_beam_common_pset(f, beam_ent, bm)
        if bm.material_key:
            try_attach_kernel_ifc_single_material(
                f,
                product=beam_ent,
                material_key=bm.material_key,
                material_by_key_cache=material_by_key_cache,
            )
        maybe_attach_classification(
            f,
            beam_ent,
            bm,
            classification_cache=classification_cache,
            classification_ref_cache=classification_ref_cache,
        )

    for cid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, CeilingElem)):
        ceil = doc.elements[cid]
        assert isinstance(ceil, CeilingElem)
        cpts = [(p.x_mm, p.y_mm) for p in ceil.boundary_mm]
        if len(cpts) < 3:
            continue
        ccx_mm, ccz_mm, _, _ = xz_bounds_mm(cpts)
        ccx_m = ccx_mm / 1000.0
        ccy_m = ccz_mm / 1000.0
        ceil_elev_z = (
            float(level_elevation_m(doc, ceil.level_id)) + float(ceil.height_offset_mm) / 1000.0
        )
        ceil_thick_m = float(clamp(ceil.thickness_mm / 1000.0, 0.005, 0.5))
        ceil_profile: list[tuple[float, float]] = []
        for px, py in cpts:
            ceil_profile.append((px / 1000.0 - ccx_m, py / 1000.0 - ccy_m))
        ceil_profile.append(ceil_profile[0])
        cov_ent = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcCovering", name=ceil.name or cid
        )
        if hasattr(cov_ent, "PredefinedType"):
            cov_ent.PredefinedType = "CEILING"
        rep_cov = add_slab_representation(f, body_ctx, depth=ceil_thick_m, polyline=ceil_profile)
        cov_mat = np.eye(4, dtype=float)
        cov_mat[0, 3] = ccx_m
        cov_mat[1, 3] = ccy_m
        cov_mat[2, 3] = ceil_elev_z + ceil_thick_m / 2.0
        edit_object_placement(f, product=cov_ent, matrix=cov_mat)
        assign_representation(f, cov_ent, rep_cov)
        ifcopenshell.api.spatial.assign_container(
            f, products=[cov_ent], relating_structure=storey_for(ceil.level_id)
        )
        geo_products += 1
        attach_kernel_identity_pset(cov_ent, "Pset_CoveringCommon", cid)
        attach_ceiling_common_pset(f, cov_ent, ceil)

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RailingElem)):
        rl = doc.elements[rid]
        assert isinstance(rl, RailingElem)
        if len(rl.path_mm) < 2:
            continue
        # Place railing on the host stair's base level when bound; otherwise
        # default to elevation zero. Railings cross multiple levels in
        # general — the kernel ties them to a stair, not a level.
        railing_elev_z = 0.0
        host_storey = default_storey_tag
        if rl.hosted_stair_id:
            stair_h = doc.elements.get(rl.hosted_stair_id)
            if isinstance(stair_h, StairElem):
                railing_elev_z = float(level_elevation_m(doc, stair_h.base_level_id))
                host_storey = storey_for(stair_h.base_level_id)
        # Body: 50mm-wide × guardHeightMm tall extrusion along each
        # path segment. We emit a single representation built from the
        # first segment for compactness; downstream parsers can read
        # the full path from the kernel via Reference round-trip.
        p0 = rl.path_mm[0]
        p1 = rl.path_mm[1]
        rsx = float(p0.x_mm) / 1000.0
        rsy = float(p0.y_mm) / 1000.0
        rex = float(p1.x_mm) / 1000.0
        rey = float(p1.y_mm) / 1000.0
        rseg = math.hypot(rex - rsx, rey - rsy)
        if rseg < 1e-6:
            continue
        guard_h_m = float(clamp(rl.guard_height_mm / 1000.0, 0.4, 2.5))
        rail_w_m = 0.05
        railing_ent = ifcopenshell.api.root.create_entity(
            f, ifc_class="IfcRailing", name=rl.name or rid
        )
        rep_rail = create_2pt_wall(
            f,
            railing_ent,
            body_ctx,
            (rsx, rsy),
            (rex, rey),
            railing_elev_z,
            guard_h_m,
            rail_w_m,
        )
        assign_representation(f, railing_ent, rep_rail)
        ifcopenshell.api.spatial.assign_container(
            f, products=[railing_ent], relating_structure=host_storey
        )
        geo_products += 1
        attach_kernel_identity_pset(railing_ent, "Pset_RailingCommon", rid)
        attach_railing_common_pset(f, railing_ent, rl)

    if geo_products == 0:
        return None, 0

    return f.wrapped_data.to_string(), geo_products
