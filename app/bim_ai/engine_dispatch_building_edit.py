# ruff: noqa: I001

from bim_ai.engine import (
    AlignElementToReferenceCmd,
    Any,
    AreaElem,
    BalconyElem,
    ColumnElem,
    CreateAreaCmd,
    CreateBalconyCmd,
    CreateDormerCmd,
    CreateMaskingRegionCmd,
    CreateProjectBasePointCmd,
    CreateRailingCmd,
    CreateSunSettingsCmd,
    CreateSurveyPointCmd,
    CreateSweepCmd,
    DEFAULT_DISCIPLINE_BY_KIND,
    DeleteAreaCmd,
    DeleteMaskingRegionCmd,
    DoorElem,
    DormerElem,
    Element,
    JoinGeometryElem,
    LevelElem,
    MaskingRegionElem,
    MoveProjectBasePointCmd,
    MoveSurveyPointCmd,
    PlacedAssetElem,
    ProjectBasePointElem,
    RailingElem,
    RoofElem,
    RotateProjectBasePointCmd,
    SUN_SETTINGS_ID,
    SetRailingBalusterPatternCmd,
    SetRailingHandrailSupportsCmd,
    SetWallJoinDisallowCmd,
    SetWallJoinVariantCmd,
    SetWallRecessZonesCmd,
    SlabOpeningElem,
    SplitWallAtCmd,
    SunSettingsElem,
    SunSettingsTimeOfDay,
    SurveyPointElem,
    SweepElem,
    TrimElementToReferenceCmd,
    TrimExtendToCornerCmd,
    UpdateAreaCmd,
    UpdateMaskingRegionCmd,
    UpdateSunSettingsCmd,
    Vec2Mm,
    WallElem,
    WallOpeningElem,
    WindowElem,
    _dormer_footprint_polygon_mm,
    _resolve_dormer_host_floor,
    _validate_baluster_pattern,
    _validate_handrail_supports,
    new_id,
    resolve_material,
)


def try_apply_building_edit_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateProjectBasePointCmd():
            if any(isinstance(e, ProjectBasePointElem) for e in els.values()):
                raise ValueError(
                    "createProjectBasePoint: a project_base_point already exists (singleton)"
                )
            pid = cmd.id or new_id()
            if pid in els:
                raise ValueError(f"duplicate element id '{pid}'")
            els[pid] = ProjectBasePointElem(
                kind="project_base_point",
                id=pid,
                position_mm=cmd.position_mm,
                angle_to_true_north_deg=cmd.angle_to_true_north_deg,
                clipped=cmd.clipped,
            )

        case MoveProjectBasePointCmd():
            target_id = next(
                (eid for eid, e in els.items() if isinstance(e, ProjectBasePointElem)),
                None,
            )
            if target_id is None:
                raise ValueError(
                    "moveProjectBasePoint: no project_base_point exists (create one first)"
                )
            existing = els[target_id]
            assert isinstance(existing, ProjectBasePointElem)
            els[target_id] = existing.model_copy(update={"position_mm": cmd.position_mm})

        case RotateProjectBasePointCmd():
            target_id = next(
                (eid for eid, e in els.items() if isinstance(e, ProjectBasePointElem)),
                None,
            )
            if target_id is None:
                raise ValueError(
                    "rotateProjectBasePoint: no project_base_point exists (create one first)"
                )
            existing = els[target_id]
            assert isinstance(existing, ProjectBasePointElem)
            els[target_id] = existing.model_copy(
                update={"angle_to_true_north_deg": cmd.angle_to_true_north_deg}
            )

        case CreateSurveyPointCmd():
            if any(isinstance(e, SurveyPointElem) for e in els.values()):
                raise ValueError("createSurveyPoint: a survey_point already exists (singleton)")
            sid = cmd.id or new_id()
            if sid in els:
                raise ValueError(f"duplicate element id '{sid}'")
            els[sid] = SurveyPointElem(
                kind="survey_point",
                id=sid,
                position_mm=cmd.position_mm,
                shared_elevation_mm=cmd.shared_elevation_mm,
                clipped=cmd.clipped,
            )

        case MoveSurveyPointCmd():
            target_id = next(
                (eid for eid, e in els.items() if isinstance(e, SurveyPointElem)),
                None,
            )
            if target_id is None:
                raise ValueError("moveSurveyPoint: no survey_point exists (create one first)")
            existing = els[target_id]
            assert isinstance(existing, SurveyPointElem)
            update: dict[str, Any] = {"position_mm": cmd.position_mm}
            if cmd.shared_elevation_mm is not None:
                update["shared_elevation_mm"] = cmd.shared_elevation_mm
            els[target_id] = existing.model_copy(update=update)

        case CreateSunSettingsCmd():
            if any(isinstance(e, SunSettingsElem) for e in els.values()):
                raise ValueError(
                    "createSunSettings: a sun_settings already exists (use updateSunSettings)"
                )
            sid = cmd.id or SUN_SETTINGS_ID
            if sid in els:
                raise ValueError(f"duplicate element id '{sid}'")
            tod = cmd.time_of_day or {"hours": 14, "minutes": 30}
            els[sid] = SunSettingsElem(
                kind="sun_settings",
                id=sid,
                latitude_deg=cmd.latitude_deg,
                longitude_deg=cmd.longitude_deg,
                date_iso=cmd.date_iso,
                time_of_day=SunSettingsTimeOfDay(
                    hours=tod.get("hours", 14), minutes=tod.get("minutes", 30)
                ),
                daylight_saving_strategy=cmd.daylight_saving_strategy,
            )

        case UpdateSunSettingsCmd():
            target_sun_id = next(
                (eid for eid, e in els.items() if isinstance(e, SunSettingsElem)), None
            )
            if target_sun_id is None:
                raise ValueError(
                    "updateSunSettings: no sun_settings exists (createSunSettings first)"
                )
            existing_sun = els[target_sun_id]
            assert isinstance(existing_sun, SunSettingsElem)
            sun_update: dict[str, Any] = {}
            if cmd.latitude_deg is not None:
                sun_update["latitude_deg"] = cmd.latitude_deg
            if cmd.longitude_deg is not None:
                sun_update["longitude_deg"] = cmd.longitude_deg
            if cmd.date_iso is not None:
                sun_update["date_iso"] = cmd.date_iso
            if cmd.time_of_day is not None:
                tod2 = cmd.time_of_day
                sun_update["time_of_day"] = SunSettingsTimeOfDay(
                    hours=tod2.get("hours", existing_sun.time_of_day.hours),
                    minutes=tod2.get("minutes", existing_sun.time_of_day.minutes),
                )
            if cmd.daylight_saving_strategy is not None:
                sun_update["daylight_saving_strategy"] = cmd.daylight_saving_strategy
            els[target_sun_id] = existing_sun.model_copy(update=sun_update)

        case CreateBalconyCmd():
            bid = cmd.id or new_id()
            if bid in els:
                raise ValueError(f"duplicate element id '{bid}'")
            if cmd.wall_id not in els or not isinstance(els[cmd.wall_id], WallElem):
                raise ValueError("createBalcony.wallId must reference an existing wall")
            els[bid] = BalconyElem(
                kind="balcony",
                id=bid,
                name=cmd.name,
                wall_id=cmd.wall_id,
                elevation_mm=cmd.elevation_mm,
                projection_mm=cmd.projection_mm,
                slab_thickness_mm=cmd.slab_thickness_mm,
                balustrade_height_mm=cmd.balustrade_height_mm,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("balcony", "arch"),
            )

        case CreateSweepCmd():
            sid = cmd.id or new_id()
            if sid in els:
                raise ValueError(f"duplicate element id '{sid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createSweep.levelId must reference an existing Level")
            if len(cmd.path_mm) < 2:
                raise ValueError("createSweep.pathMm requires ≥2 points")
            if len(cmd.profile_mm) < 3:
                raise ValueError("createSweep.profileMm requires ≥3 points (closed loop)")
            if cmd.profile_plane not in ("normal_to_path_start", "work_plane"):
                raise ValueError(
                    "createSweep.profilePlane must be 'normal_to_path_start' or 'work_plane'"
                )
            if cmd.material_key is not None and resolve_material(cmd.material_key) is None:
                raise ValueError(
                    f"createSweep.materialKey '{cmd.material_key}' is not in the material catalog"
                )
            els[sid] = SweepElem(
                kind="sweep",
                id=sid,
                name=cmd.name,
                level_id=cmd.level_id,
                path_mm=list(cmd.path_mm),
                profile_mm=list(cmd.profile_mm),
                profile_plane=cmd.profile_plane,
                material_key=cmd.material_key,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("sweep", "arch"),
            )

        case CreateDormerCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            host = els.get(cmd.host_roof_id)
            if not isinstance(host, RoofElem):
                raise ValueError("createDormer.hostRoofId must reference an existing roof")
            if cmd.width_mm <= 0 or cmd.depth_mm <= 0 or cmd.wall_height_mm <= 0:
                raise ValueError("createDormer width/depth/wallHeight must all be > 0")
            if cmd.dormer_roof_kind not in ("flat", "shed", "gable", "hipped"):
                raise ValueError("createDormer.dormerRoofKind invalid")
            if cmd.dormer_roof_kind in ("gable", "hipped"):
                if cmd.ridge_height_mm is None or cmd.ridge_height_mm <= 0:
                    raise ValueError(
                        "createDormer.ridgeHeightMm must be > 0 when dormerRoofKind is "
                        "'gable' or 'hipped'"
                    )
            for key, label in (
                (cmd.wall_material_key, "wallMaterialKey"),
                (cmd.roof_material_key, "roofMaterialKey"),
            ):
                if key is not None and resolve_material(key) is None:
                    raise ValueError(f"createDormer.{label} '{key}' is not in the material catalog")
            # Footprint-fit sanity check. Ridge axis follows the renderer's
            # heuristic: the longer plan dimension is the ridge axis.
            host_xs = [p.x_mm for p in host.footprint_mm]
            host_ys = [p.y_mm for p in host.footprint_mm]
            span_x = max(host_xs) - min(host_xs)
            span_y = max(host_ys) - min(host_ys)
            ridge_along_x = span_x >= span_y
            half_along = (span_x if ridge_along_x else span_y) / 2
            half_across = (span_y if ridge_along_x else span_x) / 2
            if abs(cmd.position_on_roof.along_ridge_mm) + cmd.width_mm / 2 > half_along + 1e-3:
                raise ValueError("createDormer footprint exceeds host roof along-ridge extent")
            if abs(cmd.position_on_roof.across_ridge_mm) + cmd.depth_mm / 2 > half_across + 1e-3:
                raise ValueError("createDormer footprint exceeds host roof across-ridge extent")
            els[did] = DormerElem(
                kind="dormer",
                id=did,
                name=cmd.name,
                host_roof_id=cmd.host_roof_id,
                position_on_roof=cmd.position_on_roof,
                width_mm=cmd.width_mm,
                wall_height_mm=cmd.wall_height_mm,
                depth_mm=cmd.depth_mm,
                dormer_roof_kind=cmd.dormer_roof_kind,
                dormer_roof_pitch_deg=cmd.dormer_roof_pitch_deg,
                ridge_height_mm=cmd.ridge_height_mm,
                wall_material_key=cmd.wall_material_key,
                roof_material_key=cmd.roof_material_key,
                has_floor_opening=cmd.has_floor_opening,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("dormer", "arch"),
            )
            if cmd.has_floor_opening:
                fp_vertices = _dormer_footprint_polygon_mm(
                    host, cmd.position_on_roof, cmd.width_mm, cmd.depth_mm
                )
                target_floor = _resolve_dormer_host_floor(els, host, fp_vertices)
                if target_floor is None:
                    raise ValueError(
                        "createDormer.hasFloorOpening: no floor element on host roof's "
                        "reference level matches the dormer footprint"
                    )
                opening_id = f"{did}_floor_opening"
                if opening_id in els:
                    raise ValueError(f"duplicate element id '{opening_id}'")
                els[opening_id] = SlabOpeningElem(
                    kind="slab_opening",
                    id=opening_id,
                    name=f"{cmd.name} floor opening",
                    host_floor_id=target_floor.id,
                    boundary_mm=[Vec2Mm(xMm=x, yMm=y) for (x, y) in fp_vertices],
                    is_shaft=False,
                )

        case SetWallRecessZonesCmd():
            wall = els.get(cmd.wall_id)
            if not isinstance(wall, WallElem):
                raise ValueError("setWallRecessZones.wallId must reference an existing wall")
            zones = list(cmd.recess_zones)
            # Validate per-zone bounds
            for z in zones:
                if not (0.0 <= z.along_t_start < z.along_t_end <= 1.0):
                    raise ValueError("setWallRecessZones: alongTStart < alongTEnd, both in [0,1]")
                if z.setback_mm <= 0:
                    raise ValueError("setWallRecessZones.setbackMm must be > 0")
                if z.setback_mm >= wall.thickness_mm * 8:
                    raise ValueError(
                        "setWallRecessZones.setbackMm sanity bound: must be < thicknessMm × 8"
                    )
                if z.sill_height_mm is not None and z.head_height_mm is not None:
                    if z.head_height_mm <= z.sill_height_mm:
                        raise ValueError("setWallRecessZones: headHeightMm must be > sillHeightMm")
            # Non-overlap: sort by start, ensure each end ≤ next start
            sorted_zones = sorted(zones, key=lambda z: z.along_t_start)
            for i in range(1, len(sorted_zones)):
                if sorted_zones[i].along_t_start < sorted_zones[i - 1].along_t_end:
                    raise ValueError("setWallRecessZones: recess zones must not overlap")
            els[cmd.wall_id] = wall.model_copy(update={"recess_zones": zones if zones else None})

        case CreateAreaCmd():
            aid = cmd.id or new_id()
            if aid in els:
                raise ValueError(f"duplicate element id '{aid}'")
            lvl = els.get(cmd.level_id)
            if not isinstance(lvl, LevelElem):
                raise ValueError("createArea.levelId must reference an existing Level")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createArea.boundaryMm must contain at least 3 points")
            els[aid] = AreaElem(
                kind="area",
                id=aid,
                name=cmd.name,
                level_id=cmd.level_id,
                boundary_mm=list(cmd.boundary_mm),
                rule_set=cmd.rule_set,
                area_scheme=cmd.area_scheme,
                apply_area_rules=cmd.apply_area_rules,
            )

        case UpdateAreaCmd():
            area = els.get(cmd.area_id)
            if not isinstance(area, AreaElem):
                raise ValueError("updateArea.areaId must reference an existing area")
            updates: dict[str, Any] = {}
            if cmd.name is not None:
                updates["name"] = cmd.name
            if cmd.boundary_mm is not None:
                if len(cmd.boundary_mm) < 3:
                    raise ValueError("updateArea.boundaryMm must contain at least 3 points")
                updates["boundary_mm"] = list(cmd.boundary_mm)
            if cmd.rule_set is not None:
                updates["rule_set"] = cmd.rule_set
            if cmd.area_scheme is not None:
                updates["area_scheme"] = cmd.area_scheme
            els[cmd.area_id] = area.model_copy(update=updates)

        case DeleteAreaCmd():
            area = els.get(cmd.area_id)
            if not isinstance(area, AreaElem):
                raise ValueError("deleteArea.areaId must reference an existing area")
            del els[cmd.area_id]

        case CreateMaskingRegionCmd():
            mid = cmd.id or new_id()
            if mid in els:
                raise ValueError(f"duplicate element id '{mid}'")
            view = els.get(cmd.host_view_id)
            if view is None or view.kind not in {"plan_view", "section_cut", "elevation_view"}:
                raise ValueError(
                    "createMaskingRegion.hostViewId must reference plan_view/section_cut/elevation_view"
                )
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createMaskingRegion.boundaryMm must contain at least 3 points")
            for void in cmd.void_boundaries_mm:
                if len(void) < 3:
                    raise ValueError(
                        "createMaskingRegion.voidBoundariesMm entries must contain at least 3 points"
                    )
            els[mid] = MaskingRegionElem(
                kind="masking_region",
                id=mid,
                host_view_id=cmd.host_view_id,
                boundary_mm=list(cmd.boundary_mm),
                void_boundaries_mm=[list(void) for void in cmd.void_boundaries_mm],
                fill_color=cmd.fill_color,
            )

        case UpdateMaskingRegionCmd():
            mr = els.get(cmd.masking_region_id)
            if not isinstance(mr, MaskingRegionElem):
                raise ValueError(
                    "updateMaskingRegion.maskingRegionId must reference an existing masking_region"
                )
            updates_mr: dict[str, Any] = {}
            if cmd.boundary_mm is not None:
                if len(cmd.boundary_mm) < 3:
                    raise ValueError(
                        "updateMaskingRegion.boundaryMm must contain at least 3 points"
                    )
                updates_mr["boundary_mm"] = list(cmd.boundary_mm)
            if cmd.void_boundaries_mm is not None:
                for void in cmd.void_boundaries_mm:
                    if len(void) < 3:
                        raise ValueError(
                            "updateMaskingRegion.voidBoundariesMm entries must contain at least 3 points"
                        )
                updates_mr["void_boundaries_mm"] = [list(void) for void in cmd.void_boundaries_mm]
            if cmd.fill_color is not None:
                updates_mr["fill_color"] = cmd.fill_color
            els[cmd.masking_region_id] = mr.model_copy(update=updates_mr)

        case DeleteMaskingRegionCmd():
            mr = els.get(cmd.masking_region_id)
            if not isinstance(mr, MaskingRegionElem):
                raise ValueError(
                    "deleteMaskingRegion.maskingRegionId must reference an existing masking_region"
                )
            del els[cmd.masking_region_id]

        case CreateRailingCmd():
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate element id '{rid}'")
            if cmd.hosted_stair_id and cmd.hosted_stair_id not in els:
                raise ValueError("createRailing.hostedStairId unknown")
            if len(cmd.path_mm) < 2:
                raise ValueError("createRailing.pathMm requires ≥2 points")
            if cmd.baluster_pattern is not None:
                _validate_baluster_pattern(cmd.baluster_pattern)
            if cmd.handrail_supports:
                _validate_handrail_supports(cmd.handrail_supports, els)
            els[rid] = RailingElem(
                kind="railing",
                id=rid,
                name=cmd.name,
                hosted_stair_id=cmd.hosted_stair_id,
                path_mm=cmd.path_mm,
                baluster_pattern=cmd.baluster_pattern,
                handrail_supports=cmd.handrail_supports or None,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("railing", "arch"),
            )

        case SetRailingBalusterPatternCmd():
            railing = els.get(cmd.railing_id)
            if not isinstance(railing, RailingElem):
                raise ValueError("setRailingBalusterPattern.railingId must reference a Railing")
            if cmd.baluster_pattern is not None:
                _validate_baluster_pattern(cmd.baluster_pattern)
            els[cmd.railing_id] = railing.model_copy(
                update={"baluster_pattern": cmd.baluster_pattern}
            )

        case SetRailingHandrailSupportsCmd():
            railing = els.get(cmd.railing_id)
            if not isinstance(railing, RailingElem):
                raise ValueError("setRailingHandrailSupports.railingId must reference a Railing")
            if cmd.handrail_supports:
                _validate_handrail_supports(cmd.handrail_supports, els)
            els[cmd.railing_id] = railing.model_copy(
                update={"handrail_supports": cmd.handrail_supports or None}
            )
        case SplitWallAtCmd():
            wall = els.get(cmd.wall_id)
            if not isinstance(wall, WallElem):
                raise ValueError("splitWallAt.wallId must reference an existing wall")
            t = cmd.along_t
            split_xy = Vec2Mm(
                xMm=wall.start.x_mm + t * (wall.end.x_mm - wall.start.x_mm),
                yMm=wall.start.y_mm + t * (wall.end.y_mm - wall.start.y_mm),
            )
            left_id = new_id()
            right_id = new_id()
            base = wall.model_dump(by_alias=False)
            base.pop("id", None)
            base.pop("kind", None)
            base.pop("start", None)
            base.pop("end", None)
            els[left_id] = WallElem(
                kind="wall",
                id=left_id,
                start=wall.start,
                end=split_xy,
                **base,
            )
            els[right_id] = WallElem(
                kind="wall",
                id=right_id,
                start=split_xy,
                end=wall.end,
                **base,
            )
            # Migrate hosted openings (doors / windows / wall_openings) to whichever
            # half they fall on, re-normalising along_t against the new host span.
            migrations: list[tuple[str, Element]] = []
            for eid, e in els.items():
                if isinstance(e, (DoorElem, WindowElem)):
                    if e.wall_id != cmd.wall_id:
                        continue
                    if e.along_t <= t:
                        new_t = e.along_t / t if t > 0 else 0.0
                        migrations.append(
                            (
                                eid,
                                e.model_copy(
                                    update={
                                        "wall_id": left_id,
                                        "along_t": max(0.0, min(1.0, new_t)),
                                    }
                                ),
                            )
                        )
                    else:
                        new_t = (e.along_t - t) / (1 - t) if t < 1 else 1.0
                        migrations.append(
                            (
                                eid,
                                e.model_copy(
                                    update={
                                        "wall_id": right_id,
                                        "along_t": max(0.0, min(1.0, new_t)),
                                    }
                                ),
                            )
                        )
                elif isinstance(e, WallOpeningElem) and e.host_wall_id == cmd.wall_id:
                    s, eend = e.along_t_start, e.along_t_end
                    mid = (s + eend) / 2
                    if mid <= t:
                        new_s = s / t if t > 0 else 0.0
                        new_e = eend / t if t > 0 else 0.0
                        migrations.append(
                            (
                                eid,
                                e.model_copy(
                                    update={
                                        "host_wall_id": left_id,
                                        "along_t_start": max(0.0, min(1.0, new_s)),
                                        "along_t_end": max(0.0, min(1.0, min(new_e, 1.0))),
                                    }
                                ),
                            )
                        )
                    else:
                        new_s = (s - t) / (1 - t) if t < 1 else 0.0
                        new_e = (eend - t) / (1 - t) if t < 1 else 1.0
                        migrations.append(
                            (
                                eid,
                                e.model_copy(
                                    update={
                                        "host_wall_id": right_id,
                                        "along_t_start": max(0.0, min(1.0, new_s)),
                                        "along_t_end": max(0.0, min(1.0, new_e)),
                                    }
                                ),
                            )
                        )
            for eid, new_e in migrations:
                els[eid] = new_e
            del els[cmd.wall_id]

        case AlignElementToReferenceCmd():
            target = els.get(cmd.target_element_id)
            if target is None:
                raise ValueError(
                    f"alignElementToReference: element {cmd.target_element_id!r} not found"
                )
            ref = cmd.reference_mm
            if isinstance(target, WallElem):
                d_start = (target.start.x_mm - ref.x_mm) ** 2 + (target.start.y_mm - ref.y_mm) ** 2
                d_end = (target.end.x_mm - ref.x_mm) ** 2 + (target.end.y_mm - ref.y_mm) ** 2
                wall_dx = abs(target.end.x_mm - target.start.x_mm)
                wall_dy = abs(target.end.y_mm - target.start.y_mm)
                align_axis = "y" if wall_dx >= wall_dy else "x"
                if d_start <= d_end:
                    if align_axis == "x":
                        dx = ref.x_mm - target.start.x_mm
                        new_start = Vec2Mm(xMm=ref.x_mm, yMm=target.start.y_mm)
                        new_end = Vec2Mm(xMm=target.end.x_mm + dx, yMm=target.end.y_mm)
                    else:
                        dy = ref.y_mm - target.start.y_mm
                        new_start = Vec2Mm(xMm=target.start.x_mm, yMm=ref.y_mm)
                        new_end = Vec2Mm(xMm=target.end.x_mm, yMm=target.end.y_mm + dy)
                else:
                    if align_axis == "x":
                        dx = ref.x_mm - target.end.x_mm
                        new_start = Vec2Mm(xMm=target.start.x_mm + dx, yMm=target.start.y_mm)
                        new_end = Vec2Mm(xMm=ref.x_mm, yMm=target.end.y_mm)
                    else:
                        dy = ref.y_mm - target.end.y_mm
                        new_start = Vec2Mm(xMm=target.start.x_mm, yMm=target.start.y_mm + dy)
                        new_end = Vec2Mm(xMm=target.end.x_mm, yMm=ref.y_mm)
                els[cmd.target_element_id] = target.model_copy(
                    update={"start": new_start, "end": new_end}
                )
            elif isinstance(target, (ColumnElem, PlacedAssetElem)):
                pos = target.position_mm
                dx_abs = abs(ref.x_mm - pos.x_mm)
                dy_abs = abs(ref.y_mm - pos.y_mm)
                new_pos = (
                    Vec2Mm(xMm=ref.x_mm, yMm=pos.y_mm)
                    if dx_abs <= dy_abs
                    else Vec2Mm(xMm=pos.x_mm, yMm=ref.y_mm)
                )
                els[cmd.target_element_id] = target.model_copy(update={"position_mm": new_pos})
            else:
                raise ValueError(
                    f"alignElementToReference: unsupported element kind {target.kind!r}"
                )

        case TrimElementToReferenceCmd():
            ref = els.get(cmd.reference_wall_id)
            tgt = els.get(cmd.target_wall_id)
            if not isinstance(ref, WallElem):
                raise ValueError("trimElementToReference.referenceWallId must reference a wall")
            if not isinstance(tgt, WallElem):
                raise ValueError("trimElementToReference.targetWallId must reference a wall")
            # Project the trimmed endpoint onto the infinite line of the reference wall.
            rx0, ry0 = ref.start.x_mm, ref.start.y_mm
            rx1, ry1 = ref.end.x_mm, ref.end.y_mm
            # Direction of the *target* wall — the endpoint moves along this.
            tx0, ty0 = tgt.start.x_mm, tgt.start.y_mm
            tx1, ty1 = tgt.end.x_mm, tgt.end.y_mm
            tdx, tdy = (tx1 - tx0), (ty1 - ty0)
            rdx, rdy = (rx1 - rx0), (ry1 - ry0)
            denom = tdx * rdy - tdy * rdx
            if abs(denom) < 1e-9:
                raise ValueError("trimElementToReference: walls are parallel; no intersection")
            # Parameter along target where it meets the reference line.
            anchor_x, anchor_y = (tx0, ty0) if cmd.end_hint == "end" else (tx1, ty1)
            # Solve for u so that (anchor + u*dir_target) lies on reference line.
            # dir_target points from anchor toward the moving endpoint.
            adx = (tx1 - tx0) if cmd.end_hint == "end" else (tx0 - tx1)
            ady = (ty1 - ty0) if cmd.end_hint == "end" else (ty0 - ty1)
            denom2 = adx * rdy - ady * rdx
            if abs(denom2) < 1e-9:
                raise ValueError("trimElementToReference: walls are parallel; no intersection")
            u = ((rx0 - anchor_x) * rdy - (ry0 - anchor_y) * rdx) / denom2
            new_x = anchor_x + u * adx
            new_y = anchor_y + u * ady
            new_endpoint = Vec2Mm(xMm=new_x, yMm=new_y)
            if cmd.end_hint == "start":
                els[cmd.target_wall_id] = tgt.model_copy(update={"start": new_endpoint})
            else:
                els[cmd.target_wall_id] = tgt.model_copy(update={"end": new_endpoint})

        case TrimExtendToCornerCmd():
            import math as _math

            wa = els.get(cmd.wall_id_a)
            wb = els.get(cmd.wall_id_b)
            if not isinstance(wa, WallElem) or not isinstance(wb, WallElem):
                raise ValueError("trimExtendToCorner: both IDs must reference walls")

            # Compute the intersection of the two wall centerlines.
            ax0, ay0 = wa.start.x_mm, wa.start.y_mm
            ax1, ay1 = wa.end.x_mm, wa.end.y_mm
            bx0, by0 = wb.start.x_mm, wb.start.y_mm
            bx1, by1 = wb.end.x_mm, wb.end.y_mm

            dax, day = ax1 - ax0, ay1 - ay0
            dbx, dby = bx1 - bx0, by1 - by0

            # Solve: ax0 + t*dax = bx0 + s*dbx, ay0 + t*day = by0 + s*dby
            det = dax * (-dby) - (-dbx) * day
            if abs(det) < 1e-6:
                raise ValueError("trimExtendToCorner: walls are parallel, no intersection")

            dx = bx0 - ax0
            dy = by0 - ay0
            t = (dx * (-dby) - (-dbx) * dy) / det

            # Intersection point
            ix = ax0 + t * dax
            iy = ay0 + t * day

            # Extend/trim wall A: move the endpoint that is closer to the intersection
            dist_a_start = _math.hypot(ax0 - ix, ay0 - iy)
            dist_a_end = _math.hypot(ax1 - ix, ay1 - iy)
            if dist_a_end < dist_a_start:
                new_wa = wa.model_copy(update={"end": Vec2Mm(xMm=ix, yMm=iy)})
            else:
                new_wa = wa.model_copy(update={"start": Vec2Mm(xMm=ix, yMm=iy)})

            # Extend/trim wall B: same logic
            dist_b_start = _math.hypot(bx0 - ix, by0 - iy)
            dist_b_end = _math.hypot(bx1 - ix, by1 - iy)
            if dist_b_end < dist_b_start:
                new_wb = wb.model_copy(update={"end": Vec2Mm(xMm=ix, yMm=iy)})
            else:
                new_wb = wb.model_copy(update={"start": Vec2Mm(xMm=ix, yMm=iy)})

            els[cmd.wall_id_a] = new_wa
            els[cmd.wall_id_b] = new_wb

        case SetWallJoinVariantCmd():
            if not cmd.wall_ids:
                raise ValueError("setWallJoinVariant.wallIds must not be empty")
            for wid in cmd.wall_ids:
                w = els.get(wid)
                if not isinstance(w, WallElem):
                    raise ValueError(
                        f"setWallJoinVariant.wallIds[{wid}] must reference an existing wall"
                    )
            # v1 records the variant choice but does not yet rebuild geometry — the
            # mesh layer joins walls implicitly. The recorded variant is persisted as
            # a join_geometry element so downstream tools can read it.
            jid = new_id()
            els[jid] = JoinGeometryElem(
                kind="join_geometry",
                id=jid,
                joined_element_ids=list(cmd.wall_ids),
                notes=f"variant={cmd.variant}",
            )

        case SetWallJoinDisallowCmd():
            wall = els.get(cmd.wall_id)
            if not isinstance(wall, WallElem):
                raise ValueError("setWallJoinDisallow.wallId must reference a Wall")
            update_field = "join_disallow_start" if cmd.endpoint == "start" else "join_disallow_end"
            els[cmd.wall_id] = wall.model_copy(update={update_field: cmd.disallow})
        case _:
            return False
    return True
