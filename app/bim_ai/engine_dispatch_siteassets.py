# ruff: noqa: I001

from bim_ai.engine import (
    AgentDeviationElem,
    AssetLibraryEntryElem,
    AssetParamEntry,
    ColumnElem,
    CreateDecalCmd,
    CreateGradedRegionCmd,
    CreateToposolidCmd,
    CreateToposolidExcavationCmd,
    CreateToposolidSubdivisionCmd,
    DecalElem,
    DeleteGradedRegionCmd,
    DeleteToposolidCmd,
    DeleteToposolidExcavationCmd,
    DeleteToposolidSubdivisionCmd,
    FamilyInstanceElem,
    FamilyKitInstanceElem,
    FamilyTypeElem,
    FloorElem,
    GradedRegionElem,
    IndexAssetCmd,
    KitComponent,
    LevelElem,
    MaterialElem,
    MoveAssetDeltaCmd,
    MoveColumnDeltaCmd,
    MoveElementsDeltaCmd,
    PlaceAssetCmd,
    PlaceFamilyInstanceCmd,
    PlaceKitCmd,
    PlacedAssetElem,
    RotateElementsCmd,
    SetToolPrefCmd,
    ToposolidElem,
    ToposolidExcavationElem,
    ToposolidSubdivisionElem,
    TraceImageCmd,
    UpdateGradedRegionCmd,
    UpdateKitComponentCmd,
    UpdateMaterialPbrCmd,
    UpdateToposolidCmd,
    UpdateToposolidExcavationCmd,
    UpdateToposolidSubdivisionCmd,
    Vec2Mm,
    WallElem,
    WallOpeningElem,
    new_id,
)


def _family_param_number(
    family_type: FamilyTypeElem, overrides: dict[str, object], names: tuple[str, ...]
) -> float | None:
    for name in names:
        raw = overrides.get(name, family_type.parameters.get(name))
        if isinstance(raw, bool):
            continue
        if isinstance(raw, (int, float)):
            return float(raw)
        if isinstance(raw, str):
            try:
                return float(raw.strip())
            except ValueError:
                continue
    return None


def _opening_dimensions_for_family_type(
    family_type: FamilyTypeElem, overrides: dict[str, object], host: WallElem
) -> tuple[float, float, float]:
    width = _family_param_number(
        family_type,
        overrides,
        ("Width", "widthMm", "width_mm", "Rough Width", "roughWidthMm", "rough_width_mm"),
    )
    height = _family_param_number(
        family_type,
        overrides,
        ("Height", "heightMm", "height_mm", "Rough Height", "roughHeightMm", "rough_height_mm"),
    )
    sill = _family_param_number(
        family_type,
        overrides,
        ("Sill Height", "sillHeightMm", "sill_height_mm", "Sill_Height", "SillHeight"),
    )
    if width is None or width <= 0:
        width = 900.0 if family_type.discipline != "window" else 1200.0
    if height is None or height <= 0:
        height = 2100.0 if family_type.discipline != "window" else 1500.0
    if sill is None or sill < 0:
        sill = 900.0 if family_type.discipline == "window" else 0.0
    head = min(host.height_mm, sill + height)
    if head <= sill:
        sill = 0.0
        head = min(host.height_mm, max(height, 1.0))
    return width, sill, head


def _plan_points(element) -> list[tuple[float, float]]:
    if isinstance(element, FloorElem):
        return [(float(point.x_mm), float(point.y_mm)) for point in element.boundary_mm]
    if isinstance(element, ToposolidElem):
        return [(float(point.x_mm), float(point.y_mm)) for point in element.boundary_mm]
    footprint = getattr(element, "footprint_mm", None)
    if footprint:
        return [(float(point.x_mm), float(point.y_mm)) for point in footprint]
    return []


def _bbox_overlap_area_mm2(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> float:
    if len(a) < 3 or len(b) < 3:
        return 0.0
    min_ax, max_ax = min(p[0] for p in a), max(p[0] for p in a)
    min_ay, max_ay = min(p[1] for p in a), max(p[1] for p in a)
    min_bx, max_bx = min(p[0] for p in b), max(p[0] for p in b)
    min_by, max_by = min(p[1] for p in b), max(p[1] for p in b)
    width = min(max_ax, max_bx) - max(min_ax, min_bx)
    depth = min(max_ay, max_by) - max(min_ay, min_by)
    return max(0.0, width) * max(0.0, depth)


def _estimate_excavation_volume_m3(
    host: ToposolidElem,
    cutter,
    *,
    cut_mode: str,
    offset_mm: float,
    custom_depth_mm: float | None,
) -> float | None:
    overlap = _bbox_overlap_area_mm2(_plan_points(host), _plan_points(cutter))
    if overlap <= 1.0:
        return None
    depth = custom_depth_mm if cut_mode == "custom_depth" else None
    if depth is None and isinstance(cutter, FloorElem):
        depth = float(cutter.thickness_mm)
    if depth is None:
        depth = float(getattr(host, "thickness_mm", 1500.0) or 1500.0)
    depth = max(1.0, float(depth) + float(offset_mm))
    return round((overlap * depth) / 1_000_000_000.0, 3)


def try_apply_siteassets_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateToposolidCmd():
            tid = cmd.toposolid_id
            if tid in els:
                raise ValueError(f"createToposolid: element '{tid}' already exists")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createToposolid.boundaryMm requires at least 3 boundary points")
            if cmd.height_samples and cmd.heightmap_grid_mm is not None:
                raise ValueError(
                    "createToposolid: supply heightSamples or heightmapGridMm, not both"
                )
            from bim_ai.elements import HeightmapGrid, HeightSample
            from bim_ai.elements import Vec2Mm as _Vec2Mm

            boundary = [_Vec2Mm(**pt) for pt in cmd.boundary_mm]
            samples = [HeightSample(**s) for s in cmd.height_samples]
            grid = HeightmapGrid(**cmd.heightmap_grid_mm) if cmd.heightmap_grid_mm else None
            els[tid] = ToposolidElem(
                kind="toposolid",
                id=tid,
                name=cmd.name,
                boundaryMm=boundary,
                heightSamples=samples,
                heightmapGridMm=grid,
                thicknessMm=cmd.thickness_mm,
                baseElevationMm=cmd.base_elevation_mm,
                defaultMaterialKey=cmd.default_material_key,
            )

        case UpdateToposolidCmd():
            existing = els.get(cmd.toposolid_id)
            if not isinstance(existing, ToposolidElem):
                raise ValueError(
                    f"updateToposolid: no toposolid element with id '{cmd.toposolid_id}'"
                )
            patch: dict[str, object] = {}
            if cmd.name is not None:
                patch["name"] = cmd.name
            if cmd.thickness_mm is not None:
                patch["thickness_mm"] = cmd.thickness_mm
            if cmd.base_elevation_mm is not None:
                patch["base_elevation_mm"] = cmd.base_elevation_mm
            if cmd.default_material_key is not None:
                patch["default_material_key"] = cmd.default_material_key
            if cmd.pinned is not None:
                patch["pinned"] = cmd.pinned
            els[cmd.toposolid_id] = existing.model_copy(update=patch)

        case DeleteToposolidCmd():
            existing = els.get(cmd.toposolid_id)
            if not isinstance(existing, ToposolidElem):
                raise ValueError(
                    f"deleteToposolid: no toposolid element with id '{cmd.toposolid_id}'"
                )
            # Warn if any floor element's host_id points to this toposolid
            hosted_floors = [
                eid
                for eid, el in els.items()
                if isinstance(el, FloorElem) and getattr(el, "host_id", None) == cmd.toposolid_id
            ]
            if hosted_floors:
                dev_id = new_id()
                els[dev_id] = AgentDeviationElem(
                    kind="agent_deviation",
                    id=dev_id,
                    statement=(
                        f"Toposolid '{cmd.toposolid_id}' deleted while "
                        f"{len(hosted_floors)} floor(s) reference it as host "
                        f"({', '.join(hosted_floors)}). Floors may lose elevation reference."
                    ),
                    severity="warning",
                    related_element_ids=[cmd.toposolid_id, *hosted_floors],
                )
            del els[cmd.toposolid_id]

        # -----------------------------------------------------------------
        # TOP-V3-02 — Toposolid subdivision commands
        # -----------------------------------------------------------------

        case CreateToposolidSubdivisionCmd():
            sid = cmd.id
            if sid in els:
                raise ValueError(f"create_toposolid_subdivision: element '{sid}' already exists")
            host = els.get(cmd.host_toposolid_id)
            if not isinstance(host, ToposolidElem):
                raise ValueError(
                    f"create_toposolid_subdivision: host toposolid '{cmd.host_toposolid_id}'"
                    " does not exist"
                )
            if len(cmd.boundary_mm) < 3:
                raise ValueError(
                    "create_toposolid_subdivision.boundaryMm requires at least 3 points"
                )
            host_xs = [
                pt.get("xMm", pt.get("x_mm", 0)) for pt in host.boundary_mm if isinstance(pt, dict)
            ]
            host_ys = [
                pt.get("yMm", pt.get("y_mm", 0)) for pt in host.boundary_mm if isinstance(pt, dict)
            ]
            if not host_xs:
                host_xs = [getattr(pt, "x_mm", 0) for pt in host.boundary_mm]
                host_ys = [getattr(pt, "y_mm", 0) for pt in host.boundary_mm]
            host_min_x = min(host_xs) if host_xs else 0
            host_max_x = max(host_xs) if host_xs else 0
            host_min_y = min(host_ys) if host_ys else 0
            host_max_y = max(host_ys) if host_ys else 0
            sub_xs = [pt.get("xMm", 0) for pt in cmd.boundary_mm]
            sub_ys = [pt.get("yMm", 0) for pt in cmd.boundary_mm]
            outside = (
                min(sub_xs) < host_min_x - 1
                or max(sub_xs) > host_max_x + 1
                or min(sub_ys) < host_min_y - 1
                or max(sub_ys) > host_max_y + 1
            )
            if outside:
                dev_id = new_id()
                els[dev_id] = AgentDeviationElem(
                    kind="agent_deviation",
                    id=dev_id,
                    statement=(
                        f"Subdivision '{sid}' boundary extends outside host toposolid "
                        f"'{cmd.host_toposolid_id}'. Engine accepted but clipped to host boundary."
                    ),
                    severity="warning",
                    related_element_ids=[sid, cmd.host_toposolid_id],
                )
            els[sid] = ToposolidSubdivisionElem(
                kind="toposolid_subdivision",
                id=sid,
                name=cmd.name,
                hostToposolidId=cmd.host_toposolid_id,
                boundaryMm=cmd.boundary_mm,
                finishCategory=cmd.finish_category,
                materialKey=cmd.material_key,
            )

        case UpdateToposolidSubdivisionCmd():
            existing = els.get(cmd.id)
            if not isinstance(existing, ToposolidSubdivisionElem):
                raise ValueError(
                    f"update_toposolid_subdivision: no subdivision element with id '{cmd.id}'"
                )
            patch: dict[str, object] = {}
            if cmd.name is not None:
                patch["name"] = cmd.name
            if cmd.boundary_mm is not None:
                patch["boundary_mm"] = cmd.boundary_mm
            if cmd.finish_category is not None:
                patch["finish_category"] = cmd.finish_category
            if cmd.material_key is not None:
                patch["material_key"] = cmd.material_key
            els[cmd.id] = existing.model_copy(update=patch)

        case DeleteToposolidSubdivisionCmd():
            existing = els.get(cmd.id)
            if not isinstance(existing, ToposolidSubdivisionElem):
                raise ValueError(
                    f"delete_toposolid_subdivision: no subdivision element with id '{cmd.id}'"
                )
            del els[cmd.id]

        # -----------------------------------------------------------------
        # TOP-V3-04 — Graded region commands
        # -----------------------------------------------------------------

        case CreateGradedRegionCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"CreateGradedRegion: duplicate element id '{eid}'")
            if not isinstance(els.get(cmd.host_toposolid_id), ToposolidElem):
                raise ValueError(
                    f"CreateGradedRegion.hostToposolidId '{cmd.host_toposolid_id}' does not reference an existing toposolid"
                )
            if len(cmd.boundary_mm) < 3:
                raise ValueError(
                    "CreateGradedRegion.boundaryMm requires at least 3 boundary points"
                )
            if cmd.target_mode == "flat":
                if cmd.target_z_mm is None:
                    raise ValueError("CreateGradedRegion: targetZMm is required for flat mode")
            elif cmd.target_mode == "slope":
                if cmd.slope_axis_deg is None or cmd.slope_deg_percent is None:
                    raise ValueError(
                        "CreateGradedRegion: slopeAxisDeg and slopeDegPercent are required for slope mode"
                    )
            els[eid] = GradedRegionElem(
                kind="graded_region",
                id=eid,
                hostToposolidId=cmd.host_toposolid_id,
                boundaryMm=cmd.boundary_mm,
                targetMode=cmd.target_mode,
                targetZMm=cmd.target_z_mm,
                slopeAxisDeg=cmd.slope_axis_deg,
                slopeDegPercent=cmd.slope_deg_percent,
            )

        case UpdateGradedRegionCmd():
            existing = els.get(cmd.id)
            if not isinstance(existing, GradedRegionElem):
                raise ValueError(f"UpdateGradedRegion: no graded_region element with id '{cmd.id}'")
            patch: dict[str, object] = {}
            if cmd.boundary_mm is not None:
                if len(cmd.boundary_mm) < 3:
                    raise ValueError(
                        "UpdateGradedRegion.boundaryMm requires at least 3 boundary points"
                    )
                patch["boundary_mm"] = cmd.boundary_mm
            if cmd.target_mode is not None:
                patch["target_mode"] = cmd.target_mode
            if cmd.target_z_mm is not None:
                patch["target_z_mm"] = cmd.target_z_mm
            if cmd.slope_axis_deg is not None:
                patch["slope_axis_deg"] = cmd.slope_axis_deg
            if cmd.slope_deg_percent is not None:
                patch["slope_deg_percent"] = cmd.slope_deg_percent
            els[cmd.id] = existing.model_copy(update=patch)

        case DeleteGradedRegionCmd():
            existing = els.get(cmd.id)
            if not isinstance(existing, GradedRegionElem):
                raise ValueError(f"DeleteGradedRegion: no graded_region element with id '{cmd.id}'")
            del els[cmd.id]

        # -----------------------------------------------------------------
        # TOP-V3-05 — Toposolid excavation relation commands
        # -----------------------------------------------------------------

        case CreateToposolidExcavationCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"CreateToposolidExcavation: duplicate element id '{eid}'")
            host = els.get(cmd.host_toposolid_id)
            if not isinstance(host, ToposolidElem):
                raise ValueError(
                    f"CreateToposolidExcavation.hostToposolidId '{cmd.host_toposolid_id}' does not reference an existing toposolid"
                )
            cutter = els.get(cmd.cutter_element_id)
            if not isinstance(cutter, (FloorElem, ToposolidElem)) and getattr(cutter, "kind", None) != "roof":
                raise ValueError(
                    f"CreateToposolidExcavation.cutterElementId '{cmd.cutter_element_id}' must reference a floor, roof, or toposolid"
                )
            overlap = _bbox_overlap_area_mm2(_plan_points(host), _plan_points(cutter))
            if overlap <= 1.0:
                raise ValueError(
                    "CreateToposolidExcavation: cutter footprint must overlap hostToposolidId in plan"
                )
            if cmd.cut_mode == "custom_depth" and cmd.custom_depth_mm is None:
                raise ValueError("CreateToposolidExcavation.customDepthMm is required for custom_depth mode")
            estimated = cmd.estimated_volume_m3
            if estimated is None:
                estimated = _estimate_excavation_volume_m3(
                    host,
                    cutter,
                    cut_mode=cmd.cut_mode,
                    offset_mm=cmd.offset_mm,
                    custom_depth_mm=cmd.custom_depth_mm,
                )
            els[eid] = ToposolidExcavationElem(
                kind="toposolid_excavation",
                id=eid,
                hostToposolidId=cmd.host_toposolid_id,
                cutterElementId=cmd.cutter_element_id,
                cutMode=cmd.cut_mode,
                offsetMm=cmd.offset_mm,
                customDepthMm=cmd.custom_depth_mm,
                estimatedVolumeM3=estimated,
            )

        case UpdateToposolidExcavationCmd():
            existing = els.get(cmd.id)
            if not isinstance(existing, ToposolidExcavationElem):
                raise ValueError(
                    f"UpdateToposolidExcavation: no toposolid_excavation element with id '{cmd.id}'"
                )
            patch: dict[str, object | None] = {}
            next_cut_mode = cmd.cut_mode or existing.cut_mode
            next_custom_depth = (
                cmd.custom_depth_mm if cmd.custom_depth_mm is not None else existing.custom_depth_mm
            )
            if next_cut_mode == "custom_depth" and next_custom_depth is None:
                raise ValueError("UpdateToposolidExcavation.customDepthMm is required for custom_depth mode")
            if cmd.cut_mode is not None:
                patch["cut_mode"] = cmd.cut_mode
            if cmd.offset_mm is not None:
                patch["offset_mm"] = cmd.offset_mm
            if cmd.custom_depth_mm is not None:
                patch["custom_depth_mm"] = cmd.custom_depth_mm
            if cmd.estimated_volume_m3 is not None:
                patch["estimated_volume_m3"] = cmd.estimated_volume_m3
            els[cmd.id] = existing.model_copy(update=patch)

        case DeleteToposolidExcavationCmd():
            existing = els.get(cmd.id)
            if not isinstance(existing, ToposolidExcavationElem):
                raise ValueError(
                    f"DeleteToposolidExcavation: no toposolid_excavation element with id '{cmd.id}'"
                )
            del els[cmd.id]

        # -----------------------------------------------------------------
        # AST-V3-01 — Asset library commands
        # -----------------------------------------------------------------

        case IndexAssetCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"IndexAsset: duplicate element id '{eid}'")
            param_schema = None
            if cmd.param_schema:
                param_schema = [
                    AssetParamEntry.model_validate(p) if isinstance(p, dict) else p
                    for p in cmd.param_schema
                ]
            els[eid] = AssetLibraryEntryElem(
                kind="asset_library_entry",
                id=eid,
                assetKind=cmd.asset_kind,
                name=cmd.name,
                tags=cmd.tags,
                category=cmd.category,
                disciplineTags=cmd.discipline_tags,
                thumbnailKind=cmd.thumbnail_kind,
                thumbnailWidthMm=cmd.thumbnail_width_mm,
                thumbnailHeightMm=cmd.thumbnail_height_mm,
                planSymbolKind=cmd.plan_symbol_kind,
                renderProxyKind=cmd.render_proxy_kind,
                paramSchema=param_schema,
                publishedFromOrgId=cmd.published_from_org_id,
                description=cmd.description,
            )

        case PlaceAssetCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"PlaceAsset: duplicate element id '{eid}'")
            asset = els.get(cmd.asset_id)
            if not isinstance(asset, AssetLibraryEntryElem):
                raise ValueError(
                    f"PlaceAsset: assetId '{cmd.asset_id}' is not an AssetLibraryEntry"
                )
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("PlaceAsset: levelId must reference an existing Level")
            els[eid] = PlacedAssetElem(
                kind="placed_asset",
                id=eid,
                name=cmd.name or asset.name,
                assetId=cmd.asset_id,
                levelId=cmd.level_id,
                positionMm=cmd.position_mm,
                rotationDeg=cmd.rotation_deg,
                paramValues=cmd.param_values,
                hostElementId=cmd.host_element_id,
            )

        case PlaceFamilyInstanceCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"placeFamilyInstance: duplicate element id '{eid}'")
            family_type = els.get(cmd.family_type_id)
            if not isinstance(family_type, FamilyTypeElem):
                raise ValueError(
                    f"placeFamilyInstance: familyTypeId '{cmd.family_type_id}' is not a FamilyType"
                )
            if cmd.level_id is not None and (
                cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem)
            ):
                raise ValueError("placeFamilyInstance.levelId must reference an existing Level")
            if cmd.host_view_id is not None:
                view = els.get(cmd.host_view_id)
                if view is None or view.kind not in {"plan_view", "section_cut", "elevation_view"}:
                    raise ValueError(
                        "placeFamilyInstance.hostViewId must reference plan_view/section_cut/elevation_view"
                    )
            if cmd.host_element_id is not None:
                host = els.get(cmd.host_element_id)
                if host is None:
                    raise ValueError("placeFamilyInstance.hostElementId must reference an element")
                if cmd.host_along_t is not None and host.kind != "wall":
                    raise ValueError("placeFamilyInstance.hostAlongT requires a wall host")
            els[eid] = FamilyInstanceElem(
                kind="family_instance",
                id=eid,
                name=cmd.name or family_type.name,
                familyTypeId=cmd.family_type_id,
                levelId=cmd.level_id,
                hostViewId=cmd.host_view_id,
                positionMm=cmd.position_mm,
                rotationDeg=cmd.rotation_deg,
                paramValues=cmd.param_values,
                hostElementId=cmd.host_element_id,
                hostAlongT=cmd.host_along_t,
            )
            if cmd.host_element_id is not None and cmd.host_along_t is not None:
                host = els.get(cmd.host_element_id)
                if isinstance(host, WallElem):
                    opening_id = f"{eid}_opening"
                    if opening_id in els:
                        raise ValueError(
                            f"placeFamilyInstance: duplicate hosted opening id '{opening_id}'"
                        )
                    dx = host.end.x_mm - host.start.x_mm
                    dy = host.end.y_mm - host.start.y_mm
                    wall_len = max((dx * dx + dy * dy) ** 0.5, 1.0)
                    width, sill, head = _opening_dimensions_for_family_type(
                        family_type, dict(cmd.param_values), host
                    )
                    half_t = min(0.49, max(1.0, width) / wall_len / 2.0)
                    center_t = max(0.0, min(1.0, cmd.host_along_t))
                    along_start = max(0.0, center_t - half_t)
                    along_end = min(1.0, center_t + half_t)
                    if along_start >= along_end:
                        along_start = max(0.0, center_t - 0.01)
                        along_end = min(1.0, center_t + 0.01)
                    els[opening_id] = WallOpeningElem(
                        kind="wall_opening",
                        id=opening_id,
                        name=f"{cmd.name or family_type.name} opening",
                        hostWallId=cmd.host_element_id,
                        alongTStart=along_start,
                        alongTEnd=along_end,
                        sillHeightMm=sill,
                        headHeightMm=head,
                        discipline="arch",
                    )

        case MoveAssetDeltaCmd():
            el = els.get(cmd.element_id)
            if not isinstance(el, PlacedAssetElem):
                raise ValueError(
                    f"moveAssetDelta: elementId '{cmd.element_id}' must reference a placed_asset"
                )
            new_pos = Vec2Mm(
                xMm=el.position_mm.x_mm + cmd.dx_mm,
                yMm=el.position_mm.y_mm + cmd.dy_mm,
            )
            els[cmd.element_id] = el.model_copy(update={"position_mm": new_pos})

        case MoveColumnDeltaCmd():
            el = els.get(cmd.element_id)
            if not isinstance(el, ColumnElem):
                raise ValueError(
                    f"moveColumnDelta: elementId '{cmd.element_id}' must reference a column"
                )
            new_pos = Vec2Mm(
                xMm=el.position_mm.x_mm + cmd.dx_mm,
                yMm=el.position_mm.y_mm + cmd.dy_mm,
            )
            els[cmd.element_id] = el.model_copy(update={"position_mm": new_pos})

        case MoveElementsDeltaCmd():
            for eid in cmd.element_ids:
                el = els.get(eid)
                if el is None:
                    continue
                match el.kind:
                    case "wall":
                        els[eid] = el.model_copy(
                            update={
                                "start": Vec2Mm(
                                    xMm=el.start.x_mm + cmd.dx_mm, yMm=el.start.y_mm + cmd.dy_mm
                                ),
                                "end": Vec2Mm(
                                    xMm=el.end.x_mm + cmd.dx_mm, yMm=el.end.y_mm + cmd.dy_mm
                                ),
                            }
                        )
                    case "column":
                        els[eid] = el.model_copy(
                            update={
                                "position_mm": Vec2Mm(
                                    xMm=el.position_mm.x_mm + cmd.dx_mm,
                                    yMm=el.position_mm.y_mm + cmd.dy_mm,
                                ),
                            }
                        )
                    case "placed_asset":
                        els[eid] = el.model_copy(
                            update={
                                "position_mm": Vec2Mm(
                                    xMm=el.position_mm.x_mm + cmd.dx_mm,
                                    yMm=el.position_mm.y_mm + cmd.dy_mm,
                                ),
                            }
                        )
                    case "floor":
                        new_pts = [
                            Vec2Mm(xMm=p.x_mm + cmd.dx_mm, yMm=p.y_mm + cmd.dy_mm)
                            for p in el.boundary_mm
                        ]
                        els[eid] = el.model_copy(update={"boundary_mm": new_pts})
                    case "room":
                        new_pts = [
                            Vec2Mm(xMm=p.x_mm + cmd.dx_mm, yMm=p.y_mm + cmd.dy_mm)
                            for p in el.outline_mm
                        ]
                        els[eid] = el.model_copy(update={"outline_mm": new_pts})
                    case "area":
                        new_pts = [
                            Vec2Mm(xMm=p.x_mm + cmd.dx_mm, yMm=p.y_mm + cmd.dy_mm)
                            for p in el.boundary_mm
                        ]
                        els[eid] = el.model_copy(update={"boundary_mm": new_pts})

        case RotateElementsCmd():
            import math as _math

            cx = cmd.center_x_mm
            cy = cmd.center_y_mm
            rad = _math.radians(cmd.angle_deg)
            cos_a = _math.cos(rad)
            sin_a = _math.sin(rad)

            def _rotate_pt(x: float, y: float) -> tuple[float, float]:
                dx, dy = x - cx, y - cy
                return cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a

            for eid in cmd.element_ids:
                el = els.get(eid)
                if el is None:
                    continue
                match el.kind:
                    case "wall":
                        nx0, ny0 = _rotate_pt(el.start.x_mm, el.start.y_mm)
                        nx1, ny1 = _rotate_pt(el.end.x_mm, el.end.y_mm)
                        els[eid] = el.model_copy(
                            update={
                                "start": Vec2Mm(xMm=nx0, yMm=ny0),
                                "end": Vec2Mm(xMm=nx1, yMm=ny1),
                            }
                        )
                    case "column":
                        nx, ny = _rotate_pt(el.position_mm.x_mm, el.position_mm.y_mm)
                        new_rot = (el.rotation_deg + cmd.angle_deg) % 360
                        els[eid] = el.model_copy(
                            update={
                                "position_mm": Vec2Mm(xMm=nx, yMm=ny),
                                "rotation_deg": new_rot,
                            }
                        )
                    case "placed_asset":
                        nx, ny = _rotate_pt(el.position_mm.x_mm, el.position_mm.y_mm)
                        new_rot = (el.rotation_deg + cmd.angle_deg) % 360
                        els[eid] = el.model_copy(
                            update={
                                "position_mm": Vec2Mm(xMm=nx, yMm=ny),
                                "rotation_deg": new_rot,
                            }
                        )
                    case "floor":
                        new_pts = []
                        for pt in el.boundary_mm:
                            nx, ny = _rotate_pt(pt.x_mm, pt.y_mm)
                            new_pts.append(Vec2Mm(xMm=nx, yMm=ny))
                        els[eid] = el.model_copy(update={"boundary_mm": new_pts})
                    case "room":
                        new_pts = []
                        for pt in el.outline_mm:
                            nx, ny = _rotate_pt(pt.x_mm, pt.y_mm)
                            new_pts.append(Vec2Mm(xMm=nx, yMm=ny))
                        els[eid] = el.model_copy(update={"outline_mm": new_pts})
                    case "area":
                        new_pts = []
                        for pt in el.boundary_mm:
                            nx, ny = _rotate_pt(pt.x_mm, pt.y_mm)
                            new_pts.append(Vec2Mm(xMm=nx, yMm=ny))
                        els[eid] = el.model_copy(update={"boundary_mm": new_pts})

        # -----------------------------------------------------------------
        # AST-V3-04 — Parametric kitchen kit
        # -----------------------------------------------------------------

        case PlaceKitCmd():
            wall = els.get(cmd.host_wall_id)
            if wall is None or wall.kind != "wall":
                raise ValueError(f"place_kit: hostWallId '{cmd.host_wall_id}' is not a wall")
            kit = FamilyKitInstanceElem(
                id=cmd.id,
                kitId=cmd.kit_id,
                hostWallId=cmd.host_wall_id,
                startMm=cmd.start_mm,
                endMm=cmd.end_mm,
                components=[KitComponent(**c) for c in cmd.components],
                countertopDepthMm=cmd.countertop_depth_mm,
                countertopThicknessMm=cmd.countertop_thickness_mm,
                countertopMaterialId=cmd.countertop_material_id,
            )
            els[cmd.id] = kit

        case UpdateKitComponentCmd():
            kit = els.get(cmd.id)
            if kit is None or kit.kind != "family_kit_instance":
                raise ValueError(f"update_kit_component: '{cmd.id}' is not a family_kit_instance")
            if cmd.component_index >= len(kit.components):
                raise ValueError(f"update_kit_component: index {cmd.component_index} out of range")
            comps = list(kit.components)
            patch: dict = {}
            if cmd.width_mm is not None:
                patch["width_mm"] = cmd.width_mm
            if cmd.door_style is not None:
                patch["door_style"] = cmd.door_style
            if cmd.material_id is not None:
                patch["material_id"] = cmd.material_id
            comps[cmd.component_index] = comps[cmd.component_index].model_copy(update=patch)
            els[cmd.id] = kit.model_copy(update={"components": comps})

        case UpdateMaterialPbrCmd():
            mat = els.get(cmd.id)
            if mat is None:
                raise ValueError(f"UpdateMaterialPbr: material '{cmd.id}' not found")
            if not isinstance(mat, MaterialElem):
                raise ValueError(f"UpdateMaterialPbr: element '{cmd.id}' is not a material")
            if cmd.name is not None:
                mat.name = cmd.name
            if cmd.albedo_color is not None:
                mat.albedo_color = cmd.albedo_color
            if cmd.albedo_map_id is not None:
                mat.albedo_map_id = cmd.albedo_map_id
            if cmd.normal_map_id is not None:
                mat.normal_map_id = cmd.normal_map_id
            if cmd.roughness_map_id is not None:
                mat.roughness_map_id = cmd.roughness_map_id
            if cmd.metallic_map_id is not None:
                mat.metallic_map_id = cmd.metallic_map_id
            if cmd.height_map_id is not None:
                mat.height_map_id = cmd.height_map_id
            if cmd.uv_scale_mm is not None:
                mat.uv_scale_mm = cmd.uv_scale_mm
            if cmd.uv_rotation_deg is not None:
                mat.uv_rotation_deg = cmd.uv_rotation_deg
            if cmd.hatch_pattern_id is not None:
                mat.hatch_pattern_id = cmd.hatch_pattern_id

        case CreateDecalCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"CreateDecal: duplicate element id '{eid}'")
            if cmd.parent_element_id not in els:
                raise ValueError(
                    f"CreateDecal: parentElementId '{cmd.parent_element_id}' not found"
                )
            els[eid] = DecalElem(
                kind="decal",
                id=eid,
                parentElementId=cmd.parent_element_id,
                parentSurface=cmd.parent_surface,
                imageAssetId=cmd.image_asset_id,
                uvRect=cmd.uv_rect,
                opacity=cmd.opacity,
            )

        case SetToolPrefCmd():
            # CHR-V3-08: store sticky modifier preference on the document.
            doc.tool_prefs.setdefault(cmd.tool, {})[cmd.pref_key] = cmd.pref_value
        case TraceImageCmd():
            raise ValueError(
                "TraceImageCmd cannot be applied in a bundle; "
                "use POST /api/v3/trace or engine.handle_trace_image_cmd() instead"
            )
        case _:
            return False
    return True
