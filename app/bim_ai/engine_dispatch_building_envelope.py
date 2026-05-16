# ruff: noqa: I001

from bim_ai.engine import (
    Any,
    AttachWallTopToRoofCmd,
    AttachWallTopCmd,
    DetachWallTopCmd,
    CreateEdgeProfileRunCmd,
    CreateFloorCmd,
    CreateRoofCmd,
    CreateRoofJoinCmd,
    CreateRoofOpeningCmd,
    CreateSlabOpeningCmd,
    CreateSoffitCmd,
    CreateStairCmd,
    CreateText3dCmd,
    CreateWallOpeningCmd,
    DEFAULT_DISCIPLINE_BY_KIND,
    EdgeProfileRunElem,
    ExtendFloorInsulationCmd,
    FloorElem,
    LevelElem,
    RoofElem,
    RoofJoinElem,
    RoofOpeningElem,
    RoofTypeElem,
    SetEdgeProfileRunModeCmd,
    SetStairSubKindCmd,
    SlabOpeningElem,
    SoffitElem,
    StairElem,
    StairTreadLine,
    Text3dElem,
    UpdateStairTreadsCmd,
    UpdateWallOpeningCmd,
    WallElem,
    WallOpeningElem,
    _balance_tread_risers,
    _floor_dims_from_type,
    _materialize_stair_runs_and_landings,
    _parse_wall_edge_spec,
    _toposolid_elevation_at_centroid_mm,
    _validate_stair_boundary,
    _validate_stair_sub_kind,
    _validate_wall_edge_profile_run,
    assert_valid_gable_pitched_rectangle_footprint_mm,
    assert_valid_hip_footprint_mm,
    assert_valid_l_shape_footprint_mm,
    edge_profile_run_path_mm,
    new_id,
    outer_rect_extent,
)


def try_apply_building_envelope_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateFloorCmd():
            fid = cmd.id or new_id()
            if fid in els:
                raise ValueError(f"duplicate element id '{fid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createFloor.levelId must reference an existing Level")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createFloor.boundaryMm requires ≥3 vertices")
            dims = _floor_dims_from_type(els, cmd.floor_type_id)
            if dims is not None:
                t_mm, s_mm, f_mm = dims
            else:
                t_mm, s_mm, f_mm = (
                    cmd.thickness_mm,
                    cmd.structure_thickness_mm,
                    cmd.finish_thickness_mm,
                )
            # TOP-V3-01: check if any toposolid covers the floor centroid.
            topo_elev = _toposolid_elevation_at_centroid_mm(els, cmd.boundary_mm)
            els[fid] = FloorElem(
                kind="floor",
                id=fid,
                name=cmd.name,
                level_id=cmd.level_id,
                boundary_mm=cmd.boundary_mm,
                thickness_mm=t_mm,
                structure_thickness_mm=s_mm,
                finish_thickness_mm=f_mm,
                floor_type_id=cmd.floor_type_id,
                room_bounded=cmd.room_bounded,
                toposolid_elevation_mm=topo_elev,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("floor", "arch"),
            )

        case CreateRoofCmd():
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate element id '{rid}'")
            if cmd.reference_level_id not in els or not isinstance(
                els[cmd.reference_level_id], LevelElem
            ):
                raise ValueError("createRoof.referenceLevelId must reference an existing Level")
            if len(cmd.footprint_mm) < 3:
                raise ValueError("createRoof.footprintMm requires ≥3 vertices")
            rtid = cmd.roof_type_id
            if rtid is not None:
                rtid = str(rtid).strip() or None
                if rtid is not None:
                    rt_el = els.get(rtid)
                    if not isinstance(rt_el, RoofTypeElem):
                        raise ValueError(
                            "createRoof.roofTypeId must reference an existing roof_type"
                        )
            if cmd.roof_geometry_mode in ("gable_pitched_rectangle", "asymmetric_gable"):
                assert_valid_gable_pitched_rectangle_footprint_mm(
                    [(p.x_mm, p.y_mm) for p in cmd.footprint_mm]
                )
            elif cmd.roof_geometry_mode == "gable_pitched_l_shape":
                assert_valid_l_shape_footprint_mm([(p.x_mm, p.y_mm) for p in cmd.footprint_mm])
            elif cmd.roof_geometry_mode == "hip":
                assert_valid_hip_footprint_mm([(p.x_mm, p.y_mm) for p in cmd.footprint_mm])
            els[rid] = RoofElem(
                kind="roof",
                id=rid,
                name=cmd.name,
                reference_level_id=cmd.reference_level_id,
                footprint_mm=cmd.footprint_mm,
                overhang_mm=cmd.overhang_mm,
                slope_deg=cmd.slope_deg,
                roof_geometry_mode=cmd.roof_geometry_mode,
                ridge_offset_transverse_mm=cmd.ridge_offset_transverse_mm,
                eave_height_left_mm=cmd.eave_height_left_mm,
                eave_height_right_mm=cmd.eave_height_right_mm,
                roof_type_id=rtid,
                material_key=cmd.material_key,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("roof", "arch"),
            )

        case ExtendFloorInsulationCmd():
            fl = els.get(cmd.floor_id)
            if not isinstance(fl, FloorElem):
                raise ValueError("extendFloorInsulation.floorId must reference a floor")
            els[cmd.floor_id] = fl.model_copy(
                update={"insulation_extension_mm": cmd.insulation_extension_mm}
            )

        case AttachWallTopToRoofCmd():
            w = els.get(cmd.wall_id)
            r = els.get(cmd.roof_id)
            if not isinstance(w, WallElem):
                raise ValueError("attachWallTopToRoof.wallId must reference a Wall")
            if not isinstance(r, RoofElem):
                raise ValueError("attachWallTopToRoof.roofId must reference a Roof")
            els[cmd.wall_id] = w.model_copy(update={"roof_attachment_id": cmd.roof_id})

        case AttachWallTopCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("attachWallTop.wallId must reference a Wall")
            target = els.get(cmd.target_id)
            if target is None:
                raise ValueError("attachWallTop.targetId must reference an existing element")
            valid_kinds = {"roof", "floor", "ceiling"}
            if target.kind not in valid_kinds:
                raise ValueError(
                    f"attachWallTop.targetId must reference a roof, floor, or ceiling element"
                )
            face = cmd.host_face if cmd.host_face in ("bottom", "top") else "bottom"
            els[cmd.wall_id] = w.model_copy(
                update={
                    "top_constraint_host_id": cmd.target_id,
                    "top_constraint_host_face": face,
                }
            )

        case DetachWallTopCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("detachWallTop.wallId must reference a Wall")
            els[cmd.wall_id] = w.model_copy(
                update={"top_constraint_host_id": None, "top_constraint_host_face": None}
            )

        case CreateStairCmd():
            sid = cmd.id or new_id()
            if sid in els:
                raise ValueError(f"duplicate element id '{sid}'")
            for lid in (cmd.base_level_id, cmd.top_level_id):
                if lid not in els or not isinstance(els[lid], LevelElem):
                    raise ValueError("createStair base/top level must reference existing Level")
            if cmd.authoring_mode == "by_sketch" and cmd.tread_lines and cmd.boundary_mm:
                _validate_stair_boundary(cmd.boundary_mm)
            _validate_stair_sub_kind(
                cmd.sub_kind,
                cmd.floating_host_wall_id,
                cmd.floating_tread_depth_mm,
                els,
            )
            stair_runs, stair_landings = _materialize_stair_runs_and_landings(cmd)
            # Balance tread risers for by_sketch mode (fill in null riserHeightMm values).
            balanced_tread_lines = cmd.tread_lines
            if cmd.authoring_mode == "by_sketch" and cmd.tread_lines and cmd.total_rise_mm:
                balanced = _balance_tread_risers(cmd.tread_lines, cmd.total_rise_mm)
                balanced_tread_lines = [
                    tl.model_copy(update={"riser_height_mm": r})
                    for tl, r in zip(cmd.tread_lines, balanced, strict=False)
                ]
            els[sid] = StairElem(
                kind="stair",
                id=sid,
                name=cmd.name,
                base_level_id=cmd.base_level_id,
                top_level_id=cmd.top_level_id,
                run_start=cmd.run_start_mm,
                run_end=cmd.run_end_mm,
                width_mm=cmd.width_mm,
                riser_mm=cmd.riser_mm,
                tread_mm=cmd.tread_mm,
                shape=cmd.shape,
                runs=stair_runs,
                landings=stair_landings,
                center_mm=cmd.center_mm,
                inner_radius_mm=cmd.inner_radius_mm,
                outer_radius_mm=cmd.outer_radius_mm,
                total_rotation_deg=cmd.total_rotation_deg,
                sketch_path_mm=cmd.sketch_path_mm,
                authoring_mode=cmd.authoring_mode,
                boundary_mm=cmd.boundary_mm,
                tread_lines=balanced_tread_lines,
                total_rise_mm=cmd.total_rise_mm,
                sub_kind=cmd.sub_kind,
                monolithic_material=cmd.monolithic_material,
                floating_tread_depth_mm=cmd.floating_tread_depth_mm,
                floating_host_wall_id=cmd.floating_host_wall_id,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("stair", "arch"),
            )

        case SetStairSubKindCmd():
            stair = els.get(cmd.stair_id)
            if not isinstance(stair, StairElem):
                raise ValueError("setStairSubKind.stairId must reference a Stair")
            _validate_stair_sub_kind(
                cmd.sub_kind,
                cmd.floating_host_wall_id,
                cmd.floating_tread_depth_mm,
                els,
            )
            els[cmd.stair_id] = stair.model_copy(
                update={
                    "sub_kind": cmd.sub_kind,
                    "monolithic_material": cmd.monolithic_material,
                    "floating_tread_depth_mm": cmd.floating_tread_depth_mm,
                    "floating_host_wall_id": cmd.floating_host_wall_id,
                }
            )

        case UpdateStairTreadsCmd():
            stair = els.get(cmd.id)
            if stair is None or stair.kind != "stair":
                raise ValueError(f"update_stair_treads: element '{cmd.id}' is not a stair")
            if stair.authoring_mode != "by_sketch":
                raise ValueError("update_stair_treads only applies to by_sketch stairs")
            new_tread_lines = [StairTreadLine(**t) for t in cmd.tread_lines]
            els[cmd.id] = stair.model_copy(update={"tread_lines": new_tread_lines})

        case CreateSlabOpeningCmd():
            oid = cmd.id or new_id()
            if oid in els:
                raise ValueError(f"duplicate element id '{oid}'")
            host = els.get(cmd.host_floor_id)
            if not isinstance(host, FloorElem):
                raise ValueError("createSlabOpening.hostFloorId must reference a floor")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createSlabOpening.boundaryMm requires ≥3 vertices")
            els[oid] = SlabOpeningElem(
                kind="slab_opening",
                id=oid,
                name=cmd.name,
                host_floor_id=cmd.host_floor_id,
                boundary_mm=cmd.boundary_mm,
                is_shaft=cmd.is_shaft,
            )

        case CreateRoofOpeningCmd():
            oid = cmd.id or new_id()
            if oid in els:
                raise ValueError(f"duplicate element id '{oid}'")
            host = els.get(cmd.host_roof_id)
            if not isinstance(host, RoofElem):
                raise ValueError("createRoofOpening.hostRoofId must reference a roof")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createRoofOpening.boundaryMm requires ≥3 vertices")
            els[oid] = RoofOpeningElem(
                kind="roof_opening",
                id=oid,
                name=cmd.name,
                host_roof_id=cmd.host_roof_id,
                boundary_mm=cmd.boundary_mm,
            )

        # TODO API-V3-01
        case CreateRoofJoinCmd():
            jid = cmd.id or new_id()
            if jid in els:
                raise ValueError(f"duplicate element id '{jid}'")
            primary = els.get(cmd.primary_roof_id)
            secondary = els.get(cmd.secondary_roof_id)
            if not isinstance(primary, RoofElem):
                raise ValueError("createRoofJoin.primaryRoofId must reference a roof")
            if not isinstance(secondary, RoofElem):
                raise ValueError("createRoofJoin.secondaryRoofId must reference a roof")
            if cmd.primary_roof_id == cmd.secondary_roof_id:
                raise ValueError("createRoofJoin: primaryRoofId and secondaryRoofId must differ")
            pts_a = [(p.x_mm, p.y_mm) for p in primary.footprint_mm]
            pts_b = [(p.x_mm, p.y_mm) for p in secondary.footprint_mm]
            ax0, ax1, az0, az1 = outer_rect_extent(pts_a)
            bx0, bx1, bz0, bz1 = outer_rect_extent(pts_b)
            if ax1 < bx0 or bx1 < ax0 or az1 < bz0 or bz1 < az0:
                raise ValueError("createRoofJoin: roof footprints do not intersect")
            els[jid] = RoofJoinElem(
                kind="roof_join",
                id=jid,
                name=cmd.name,
                primary_roof_id=cmd.primary_roof_id,
                secondary_roof_id=cmd.secondary_roof_id,
                seam_mode=cmd.seam_mode,
            )

        # TODO API-V3-01
        case CreateEdgeProfileRunCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"duplicate element id '{eid}'")
            host_el = els.get(cmd.host_element_id)
            if host_el is None:
                raise ValueError(
                    f"createEdgeProfileRun.hostElementId '{cmd.host_element_id}' not found"
                )
            if not cmd.profile_family_id:
                raise ValueError("createEdgeProfileRun.profileFamilyId must be a non-empty string")
            if cmd.miter_mode not in ("auto", "manual"):
                raise ValueError("createEdgeProfileRun.miterMode must be 'auto' or 'manual'")
            if isinstance(host_el, WallElem):
                wall_edge = _parse_wall_edge_spec(cmd.host_edge)
                if wall_edge is None:
                    raise ValueError(
                        "createEdgeProfileRun.hostEdge must be a WallEdgeFixed {'kind': 'top'|'bottom'} "
                        "or WallEdgeSpan {'startMm': ..., 'endMm': ...} when hostElementId is a wall"
                    )
                _validate_wall_edge_profile_run(host_el, wall_edge, cmd.mode)
                resolved_host_edge: Any = wall_edge
            elif isinstance(host_el, RoofElem):
                if isinstance(cmd.host_edge, str):
                    pts = [(p.x_mm, p.y_mm) for p in host_el.footprint_mm]
                    if len(pts) >= 3:
                        edge_profile_run_path_mm(
                            pts,
                            cmd.host_edge,
                            overhang_mm=host_el.overhang_mm,
                            slope_deg=host_el.slope_deg,
                        )
                resolved_host_edge = cmd.host_edge
            else:
                raise ValueError(
                    f"createEdgeProfileRun.hostElementId '{cmd.host_element_id}' must reference a Wall or Roof"
                )
            els[eid] = EdgeProfileRunElem(
                kind="edge_profile_run",
                id=eid,
                name=cmd.name,
                host_element_id=cmd.host_element_id,
                host_edge=resolved_host_edge,
                profile_family_id=cmd.profile_family_id,
                offset_mm=cmd.offset_mm,
                miter_mode=cmd.miter_mode,
                mode=cmd.mode,
            )

        case SetEdgeProfileRunModeCmd():
            run = els.get(cmd.run_id)
            if not isinstance(run, EdgeProfileRunElem):
                raise ValueError(
                    f"setEdgeProfileRunMode.runId '{cmd.run_id}' must reference an EdgeProfileRun"
                )
            els[cmd.run_id] = run.model_copy(update={"mode": cmd.mode})

        # TODO API-V3-01
        case CreateSoffitCmd():
            sid = cmd.id or new_id()
            if sid in els:
                raise ValueError(f"duplicate element id '{sid}'")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createSoffit.boundaryMm requires ≥3 vertices")
            if cmd.thickness_mm <= 0:
                raise ValueError("createSoffit.thicknessMm must be > 0")
            host_roof: RoofElem | None = None
            if cmd.host_roof_id is not None:
                hr = els.get(cmd.host_roof_id)
                if not isinstance(hr, RoofElem):
                    raise ValueError(
                        f"createSoffit.hostRoofId '{cmd.host_roof_id}' must reference a roof"
                    )
                host_roof = hr
            z_mm = cmd.z_mm
            if z_mm is None:
                if host_roof is not None:
                    level = els.get(host_roof.reference_level_id)
                    z_mm = float(getattr(level, "elevation_mm", 0))
                else:
                    z_mm = 0.0
            els[sid] = SoffitElem(
                kind="soffit",
                id=sid,
                name=cmd.name,
                boundary_mm=cmd.boundary_mm,
                host_roof_id=cmd.host_roof_id,
                thickness_mm=cmd.thickness_mm,
                z_mm=z_mm,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("soffit", "arch"),
            )

        case CreateText3dCmd():
            tid = cmd.id or new_id()
            if tid in els:
                raise ValueError(f"duplicate element id '{tid}'")
            if not cmd.text:
                raise ValueError("createText3d.text must be a non-empty string")
            els[tid] = Text3dElem(
                kind="text_3d",
                id=tid,
                text=cmd.text,
                font_family=cmd.font_family,
                font_size_mm=cmd.font_size_mm,
                depth_mm=cmd.depth_mm,
                position_mm=cmd.position_mm,
                rotation_deg=cmd.rotation_deg,
                material_key=cmd.material_key,
            )

        case CreateWallOpeningCmd():
            oid = cmd.id or new_id()
            if oid in els:
                raise ValueError(f"duplicate element id '{oid}'")
            host = els.get(cmd.host_wall_id)
            if not isinstance(host, WallElem):
                raise ValueError("createWallOpening.hostWallId must reference a wall")
            if cmd.along_t_start >= cmd.along_t_end:
                raise ValueError("createWallOpening.alongTStart must be < alongTEnd")
            if cmd.head_height_mm <= cmd.sill_height_mm:
                raise ValueError("createWallOpening.headHeightMm must be > sillHeightMm")
            if cmd.head_height_mm > host.height_mm:
                raise ValueError("createWallOpening.headHeightMm must not exceed host wall height")
            els[oid] = WallOpeningElem(
                kind="wall_opening",
                id=oid,
                name=cmd.name,
                host_wall_id=cmd.host_wall_id,
                along_t_start=cmd.along_t_start,
                along_t_end=cmd.along_t_end,
                sill_height_mm=cmd.sill_height_mm,
                head_height_mm=cmd.head_height_mm,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("wall_opening", "arch"),
            )

        case UpdateWallOpeningCmd():
            wo = els.get(cmd.opening_id)
            if not isinstance(wo, WallOpeningElem):
                raise ValueError("updateWallOpening.openingId must reference a wall_opening")
            host_wall = els.get(wo.host_wall_id)
            if not isinstance(host_wall, WallElem):
                raise ValueError("updateWallOpening host wall missing")
            new_along_start = (
                cmd.along_t_start if cmd.along_t_start is not None else wo.along_t_start
            )
            new_along_end = cmd.along_t_end if cmd.along_t_end is not None else wo.along_t_end
            new_sill = cmd.sill_height_mm if cmd.sill_height_mm is not None else wo.sill_height_mm
            new_head = cmd.head_height_mm if cmd.head_height_mm is not None else wo.head_height_mm
            if new_along_start >= new_along_end:
                raise ValueError("updateWallOpening alongTStart must be < alongTEnd")
            if new_head <= new_sill:
                raise ValueError("updateWallOpening headHeightMm must be > sillHeightMm")
            if new_head > host_wall.height_mm:
                raise ValueError("updateWallOpening headHeightMm must not exceed host wall height")
            els[cmd.opening_id] = wo.model_copy(
                update={
                    "along_t_start": new_along_start,
                    "along_t_end": new_along_end,
                    "sill_height_mm": new_sill,
                    "head_height_mm": new_head,
                }
            )
        case _:
            return False
    return True
