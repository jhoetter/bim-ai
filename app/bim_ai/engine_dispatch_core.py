# ruff: noqa: I001

from bim_ai.engine import (
    CreateDimensionCmd,
    CreateGridLineCmd,
    CreateIssueFromViolationCmd,
    CreateLevelCmd,
    CreateRoomOutlineCmd,
    CreateRoomPolyCmd,
    CreateRoomRectangleCmd,
    CreateWallChainCmd,
    CreateWallCmd,
    DEFAULT_DISCIPLINE_BY_KIND,
    DeleteElementCmd,
    DeleteElementsCmd,
    DimensionElem,
    DoorElem,
    GridLineElem,
    InsertDoorOnWallCmd,
    InsertWindowOnWallCmd,
    IssueElem,
    LevelElem,
    MoveBeamEndpointsCmd,
    MoveGridLineEndpointsCmd,
    MoveLevelElevationCmd,
    MoveWallDeltaCmd,
    MoveWallEndpointsCmd,
    PlaceRoomAtPointCmd,
    PlanViewElem,
    RestoreElementCmd,
    RoomElem,
    SetCurtainPanelOverrideCmd,
    ToposolidElem,
    Vec2Mm,
    WallElem,
    WallStack,
    WallStackComponent,
    WindowElem,
    _recompute_constrained_wall_heights,
    _resolve_wall_height_mm,
    _room_programme_field_updates,
    _validate_wall_lean_taper,
    _validate_wall_stack,
    _wall_thickness_from_type,
    element_adapter,
    expected_level_elevation_from_parent,
    new_id,
    propagate_dependent_level_elevations,
)


def try_apply_core_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateLevelCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"duplicate element id '{eid}'")
            parent = cmd.parent_level_id
            if parent is not None and parent not in els:
                raise ValueError("createLevel.parentLevelId must reference an existing Level")
            if parent is not None and not isinstance(els[parent], LevelElem):
                raise ValueError("createLevel.parentLevelId must reference a Level")
            parent_el = els[parent] if parent is not None else None
            elev_mm = (
                expected_level_elevation_from_parent(parent_el, cmd.offset_from_parent_mm)
                if isinstance(parent_el, LevelElem)
                else float(cmd.elevation_mm)
            )
            els[eid] = LevelElem(
                kind="level",
                id=eid,
                name=cmd.name,
                elevation_mm=elev_mm,
                datum_kind=cmd.datum_kind,
                parent_level_id=parent,
                offset_from_parent_mm=cmd.offset_from_parent_mm,
            )
            propagate_dependent_level_elevations(els)
            # VIE-05: optionally create a companion "<name> — Plan" plan view in
            # the same step so the common path (level then plan) is one action.
            if cmd.also_create_plan_view:
                pv_id = cmd.plan_view_id or new_id()
                if pv_id in els:
                    raise ValueError(f"duplicate element id '{pv_id}'")
                els[pv_id] = PlanViewElem(
                    kind="plan_view",
                    id=pv_id,
                    name=f"{cmd.name} — Plan",
                    level_id=eid,
                )

        case CreateWallCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"duplicate element id '{eid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createWall.levelId must reference an existing Level")
            # TOP-V3-04: validate site host toposolid exists when specified.
            if cmd.site_host_id is not None:
                if not isinstance(els.get(cmd.site_host_id), ToposolidElem):
                    raise ValueError(
                        f"createWall.siteHostId '{cmd.site_host_id}' does not reference an existing toposolid"
                    )
            h_mm = _resolve_wall_height_mm(cmd, els)
            thick = _wall_thickness_from_type(els, cmd.wall_type_id, cmd.thickness_mm)
            wall_stack = None
            if cmd.stack_components:
                _validate_wall_stack(cmd.stack_components, h_mm)
                wall_stack = WallStack(
                    components=[
                        WallStackComponent(wall_type_id=c.wall_type_id, height_mm=c.height_mm)
                        for c in cmd.stack_components
                    ]
                )
            if cmd.lean_mm is not None or cmd.taper_ratio is not None:
                _validate_wall_lean_taper(cmd.lean_mm, cmd.taper_ratio, h_mm)
            els[eid] = WallElem(
                kind="wall",
                id=eid,
                name=cmd.name,
                level_id=cmd.level_id,
                start=cmd.start,
                end=cmd.end,
                wall_curve=cmd.wall_curve,
                thickness_mm=thick,
                height_mm=h_mm,
                wall_type_id=cmd.wall_type_id,
                location_line=cmd.location_line,
                base_constraint_level_id=cmd.base_constraint_level_id,
                top_constraint_level_id=cmd.top_constraint_level_id,
                base_constraint_offset_mm=cmd.base_constraint_offset_mm,
                top_constraint_offset_mm=cmd.top_constraint_offset_mm,
                insulation_extension_mm=cmd.insulation_extension_mm,
                material_key=cmd.material_key,
                load_bearing=cmd.load_bearing,
                structural_role=cmd.structural_role,
                analytical_participation=cmd.analytical_participation,
                structural_material_key=cmd.structural_material_key,
                structural_intent_confidence=cmd.structural_intent_confidence,
                is_curtain_wall=cmd.is_curtain_wall,
                stack=wall_stack,
                lean_mm=cmd.lean_mm,
                taper_ratio=cmd.taper_ratio,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("wall", "arch"),
                site_host_id=cmd.site_host_id,
            )

        case MoveWallDeltaCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("move_wall_delta.wallId must reference a Wall")
            sx = w.start.model_copy(
                update={"x_mm": w.start.x_mm + cmd.dx_mm, "y_mm": w.start.y_mm + cmd.dy_mm}
            )
            sy = w.end.model_copy(
                update={"x_mm": w.end.x_mm + cmd.dx_mm, "y_mm": w.end.y_mm + cmd.dy_mm}
            )
            els[cmd.wall_id] = w.model_copy(update={"start": sx, "end": sy})

        case MoveWallEndpointsCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("move_wall_endpoints.wallId must reference a Wall")
            els[cmd.wall_id] = w.model_copy(
                update={"start": cmd.start, "end": cmd.end, "wall_curve": None}
            )

        case MoveBeamEndpointsCmd():
            # EDT-01 propagation — beams aren't yet stored in the
            # Python engine (no `BeamElem` in elements.py). The grip
            # provider emits this command shape so the kernel slice
            # can land later without a TS rebuild. Reject explicitly so
            # bad replays surface, rather than silently no-op.
            raise ValueError(
                "moveBeamEndpoints: beam elements are not yet seeded in the engine; "
                "TS grips emit this command for forward compatibility (EDT-01 propagation)"
            )

        case SetCurtainPanelOverrideCmd():
            wall = els.get(cmd.wall_id)
            if not isinstance(wall, WallElem):
                raise ValueError("setCurtainPanelOverride.wallId must reference a Wall")
            if not wall.is_curtain_wall:
                raise ValueError("setCurtainPanelOverride target wall must be a curtain wall")
            # Validate the cell-id format up front so authors get a fast error
            # instead of a silent no-op render.
            from bim_ai.elements import parse_curtain_grid_cell_id

            parse_curtain_grid_cell_id(cmd.grid_cell_id)
            existing = dict(wall.curtain_panel_overrides or {})
            if cmd.override is None:
                existing.pop(cmd.grid_cell_id, None)
            else:
                existing[cmd.grid_cell_id] = cmd.override
            els[cmd.wall_id] = wall.model_copy(update={"curtain_panel_overrides": existing or None})

        case InsertDoorOnWallCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            host = els.get(cmd.wall_id)
            if not isinstance(host, WallElem):
                raise ValueError("insert_door_on_wall.wallId must reference a Wall")
            els[did] = DoorElem(
                kind="door",
                id=did,
                name=cmd.name,
                wall_id=cmd.wall_id,
                along_t=cmd.along_t,
                width_mm=cmd.width_mm,
                family_type_id=cmd.family_type_id,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("door", "arch"),
            )

        case InsertWindowOnWallCmd():
            wid_cmd = cmd.id or new_id()
            if wid_cmd in els:
                raise ValueError(f"duplicate element id '{wid_cmd}'")
            host = els.get(cmd.wall_id)
            if not isinstance(host, WallElem):
                raise ValueError("insertWindowOnWall.wallId must reference a Wall")
            els[wid_cmd] = WindowElem(
                kind="window",
                id=wid_cmd,
                name=cmd.name,
                wall_id=cmd.wall_id,
                along_t=cmd.along_t,
                width_mm=cmd.width_mm,
                sill_height_mm=cmd.sill_height_mm,
                height_mm=cmd.height_mm,
                family_type_id=cmd.family_type_id,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("window", "arch"),
            )

        case CreateWallChainCmd():
            if not cmd.segments:
                raise ValueError("createWallChain.segments requires at least one segment")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createWallChain.levelId must reference an existing Level")
            for idx, seg in enumerate(cmd.segments):
                eid = seg.id or new_id()
                if eid in els:
                    raise ValueError(f"duplicate segment id '{eid}'")
                name = cmd.name_prefix if len(cmd.segments) == 1 else f"{cmd.name_prefix}-{idx + 1}"
                els[eid] = WallElem(
                    kind="wall",
                    id=eid,
                    name=name,
                    level_id=cmd.level_id,
                    start=seg.start,
                    end=seg.end,
                    thickness_mm=seg.thickness_mm,
                    height_mm=seg.height_mm,
                    discipline=DEFAULT_DISCIPLINE_BY_KIND.get("wall", "arch"),
                )

        case CreateGridLineCmd():
            gid = cmd.id or new_id()
            if gid in els:
                raise ValueError(f"duplicate element id '{gid}'")
            if cmd.level_id is not None:
                lvl = els.get(cmd.level_id)
                if lvl is not None and not isinstance(lvl, LevelElem):
                    raise ValueError("createGridLine.levelId must reference a Level")
            els[gid] = GridLineElem(
                kind="grid_line",
                id=gid,
                name=cmd.name,
                start=cmd.start,
                end=cmd.end,
                label=cmd.label,
                level_id=cmd.level_id,
            )

        case MoveGridLineEndpointsCmd():
            g = els.get(cmd.grid_line_id)
            if not isinstance(g, GridLineElem):
                raise ValueError("moveGridLineEndpoints.gridLineId must reference grid_line")
            els[cmd.grid_line_id] = g.model_copy(update={"start": cmd.start, "end": cmd.end})

        case CreateDimensionCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createDimension.levelId must reference an existing Level")
            anchor_a = cmd.anchor_a
            anchor_b = cmd.anchor_b
            if anchor_a is None and cmd.ref_element_id_a:
                anchor_a = {
                    "kind": "feature",
                    "feature": {"elementId": cmd.ref_element_id_a, "anchor": "start"},
                    "fallbackPositionMm": cmd.a_mm.model_dump(by_alias=True),
                }
            if anchor_b is None and cmd.ref_element_id_b:
                anchor_b = {
                    "kind": "feature",
                    "feature": {"elementId": cmd.ref_element_id_b, "anchor": "end"},
                    "fallbackPositionMm": cmd.b_mm.model_dump(by_alias=True),
                }
            if cmd.state is not None:
                state = cmd.state
            else:
                linked_count = sum(
                    1
                    for anchor in (anchor_a, anchor_b)
                    if isinstance(anchor, dict) and anchor.get("kind") == "feature"
                )
                state = (
                    "linked"
                    if linked_count == 2
                    else "partial"
                    if linked_count == 1
                    else "unlinked"
                )
            els[did] = DimensionElem(
                kind="dimension",
                id=did,
                name=cmd.name,
                level_id=cmd.level_id,
                a_mm=cmd.a_mm,
                b_mm=cmd.b_mm,
                offset_mm=cmd.offset_mm,
                anchor_a=anchor_a,
                anchor_b=anchor_b,
                state=state,
                ref_element_id_a=cmd.ref_element_id_a,
                ref_element_id_b=cmd.ref_element_id_b,
                tag_definition_id=cmd.tag_definition_id,
                auto_generated=cmd.auto_generated,
            )

        case DeleteElementCmd():
            if cmd.element_id not in els:
                raise ValueError("deleteElement.elementId unknown")
            del els[cmd.element_id]

        case DeleteElementsCmd():
            missing = [eid for eid in cmd.element_ids if eid not in els]
            if missing:
                raise ValueError(f"deleteElements: unknown ids {sorted(missing)}")
            for eid in cmd.element_ids:
                del els[eid]

        case RestoreElementCmd():
            el = element_adapter.validate_python(cmd.element)
            els[el.id] = el

        case CreateRoomOutlineCmd():
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate element id '{rid}'")
            if len(cmd.outline_mm) < 3:
                raise ValueError("Room outline requires at least 3 vertices")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("create_room_outline.levelId must reference an existing Level")
            els[rid] = RoomElem(
                kind="room",
                id=rid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=cmd.outline_mm,
                **_room_programme_field_updates(
                    cmd.programme_code,
                    cmd.department,
                    cmd.function_label,
                    cmd.finish_set,
                    cmd.target_area_m2,
                ),
            )

        case CreateRoomRectangleCmd():
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createRoomRectangle.levelId must reference an existing Level")
            w_mm, d_mm = cmd.width_mm, cmd.depth_mm
            if w_mm < 100 or d_mm < 100:
                raise ValueError("createRoomRectangle: widthMm and depthMm must be ≥ 100")
            ox, oy = cmd.origin.x_mm, cmd.origin.y_mm
            corners = (
                Vec2Mm(x_mm=ox, y_mm=oy),
                Vec2Mm(x_mm=ox + w_mm, y_mm=oy),
                Vec2Mm(x_mm=ox + w_mm, y_mm=oy + d_mm),
                Vec2Mm(x_mm=ox, y_mm=oy + d_mm),
            )
            pairs = ((0, 1), (1, 2), (2, 3), (3, 0))
            for ia, ib in pairs:
                wid = new_id()
                if wid in els:
                    raise ValueError(f"collision allocating wall id '{wid}'")
                a, b = corners[ia], corners[ib]
                els[wid] = WallElem(
                    kind="wall",
                    id=wid,
                    name=cmd.wall_name_prefix,
                    level_id=cmd.level_id,
                    start=a,
                    end=b,
                    thickness_mm=cmd.thickness_mm,
                    height_mm=cmd.height_mm,
                )
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate room id '{rid}'")
            els[rid] = RoomElem(
                kind="room",
                id=rid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=list(corners),
                **_room_programme_field_updates(
                    cmd.programme_code,
                    cmd.department,
                    cmd.function_label,
                    cmd.finish_set,
                    cmd.target_area_m2,
                ),
            )

        case CreateRoomPolyCmd():
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createRoomPoly.levelId must reference an existing Level")
            verts = [Vec2Mm(x_mm=v.x_mm, y_mm=v.y_mm) for v in cmd.vertices_mm]
            if (
                len(verts) >= 2
                and abs(verts[0].x_mm - verts[-1].x_mm) < 1e-3
                and abs(verts[0].y_mm - verts[-1].y_mm) < 1e-3
            ):
                verts = verts[:-1]
            if len(verts) < 3:
                raise ValueError("createRoomPoly.verticesMm requires at least 3 unique corners")
            n = len(verts)
            for i in range(n):
                wid = new_id()
                if wid in els:
                    raise ValueError(f"collision allocating wall id '{wid}'")
                a, b = verts[i], verts[(i + 1) % n]
                nm = cmd.wall_name_prefix if n == 1 else f"{cmd.wall_name_prefix}-{i + 1}"
                els[wid] = WallElem(
                    kind="wall",
                    id=wid,
                    name=nm,
                    level_id=cmd.level_id,
                    start=a,
                    end=b,
                    thickness_mm=cmd.thickness_mm,
                    height_mm=cmd.height_mm,
                )
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate room id '{rid}'")
            els[rid] = RoomElem(
                kind="room",
                id=rid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=verts,
                **_room_programme_field_updates(
                    cmd.programme_code,
                    cmd.department,
                    cmd.function_label,
                    cmd.finish_set,
                    cmd.target_area_m2,
                ),
            )

        case PlaceRoomAtPointCmd():
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("placeRoomAtPoint.levelId must reference an existing Level")
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            from bim_ai.room_derivation import (
                compute_room_boundary_derivation,
                footprint_outline_mm_rectangle,
            )

            derivation = compute_room_boundary_derivation(doc)
            candidates = derivation.get("axisAlignedRectangleCandidates") or derivation.get(
                "candidates", []
            )

            best = None
            best_area = float("inf")
            for cand in candidates:
                if cand.get("levelId") != cmd.level_id:
                    continue
                bbox = cand.get("bboxMm") or {}
                mn = bbox.get("min") or {}
                mx = bbox.get("max") or {}
                x_lo = float(mn.get("x", 0))
                y_lo = float(mn.get("y", 0))
                x_hi = float(mx.get("x", 0))
                y_hi = float(mx.get("y", 0))
                if x_lo <= cmd.click_x_mm <= x_hi and y_lo <= cmd.click_y_mm <= y_hi:
                    area = (x_hi - x_lo) * (y_hi - y_lo)
                    if area < best_area:
                        best_area = area
                        best = cand

            if best is None:
                raise ValueError(
                    f"placeRoomAtPoint: no enclosed region found at ({cmd.click_x_mm}, {cmd.click_y_mm})"
                )

            bbox = best.get("bboxMm") or {}
            outline_pts = footprint_outline_mm_rectangle(bbox)
            outline_mm = [Vec2Mm(xMm=p["xMm"], yMm=p["yMm"]) for p in outline_pts]

            els[cmd.id] = RoomElem(
                kind="room",
                id=cmd.id,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=outline_mm,
            )

        case MoveLevelElevationCmd():
            lvl = els.get(cmd.level_id)
            if not isinstance(lvl, LevelElem):
                raise ValueError("moveLevelElevation.levelId must reference an existing Level")
            els[cmd.level_id] = lvl.model_copy(update={"elevation_mm": cmd.elevation_mm})
            propagate_dependent_level_elevations(els)
            _recompute_constrained_wall_heights(els)

        case CreateIssueFromViolationCmd():
            iid = new_id()
            els[iid] = IssueElem(
                kind="issue",
                id=iid,
                title=cmd.title,
                status="open",
                element_ids=cmd.element_ids,
                viewpoint_id=cmd.viewpoint_id,
            )
        case _:
            return False
    return True
