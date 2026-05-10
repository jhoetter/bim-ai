# ruff: noqa: I001

from bim_ai.engine import (
    AgentDeviationElem,
    Any,
    AssignOpeningFamilyCmd,
    BeamElem,
    CeilingElem,
    ColumnElem,
    ConstraintElem,
    ConstraintRefRow,
    CreateBeamCmd,
    CreateCeilingCmd,
    CreateColumnCmd,
    CreateConstraintCmd,
    CreateMassCmd,
    CreateRoomSeparationCmd,
    CreateVoidCutCmd,
    DEFAULT_DISCIPLINE_BY_KIND,
    DoorElem,
    FamilyCatalogSource,
    FamilyTypeElem,
    FloorElem,
    LevelElem,
    MassElem,
    MaterializeMassToWallsCmd,
    RoofElem,
    RoomSeparationElem,
    UpdateOpeningCleanroomCmd,
    UpsertFamilyTypeCmd,
    VoidCutElem,
    WallElem,
    WindowElem,
    new_id,
)


def try_apply_structure_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateColumnCmd():
            cid = cmd.id or new_id()
            if cid in els:
                raise ValueError(f"duplicate element id '{cid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createColumn.levelId must reference an existing Level")
            els[cid] = ColumnElem(
                kind="column",
                id=cid,
                name=cmd.name,
                level_id=cmd.level_id,
                position_mm=cmd.position_mm,
                b_mm=cmd.b_mm,
                h_mm=cmd.h_mm,
                height_mm=cmd.height_mm,
                rotation_deg=cmd.rotation_deg,
                material_key=cmd.material_key,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("column", "arch"),
            )

        case CreateBeamCmd():
            bid = cmd.id or new_id()
            if bid in els:
                raise ValueError(f"duplicate element id '{bid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createBeam.levelId must reference an existing Level")
            if cmd.start_mm.x_mm == cmd.end_mm.x_mm and cmd.start_mm.y_mm == cmd.end_mm.y_mm:
                raise ValueError("createBeam.startMm and endMm must differ")
            els[bid] = BeamElem(
                kind="beam",
                id=bid,
                name=cmd.name,
                level_id=cmd.level_id,
                start_mm=cmd.start_mm,
                end_mm=cmd.end_mm,
                width_mm=cmd.width_mm,
                height_mm=cmd.height_mm,
                material_key=cmd.material_key,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("beam", "arch"),
            )

        case CreateCeilingCmd():
            cid = cmd.id or new_id()
            if cid in els:
                raise ValueError(f"duplicate element id '{cid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createCeiling.levelId must reference an existing Level")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createCeiling.boundaryMm requires ≥3 vertices")
            els[cid] = CeilingElem(
                kind="ceiling",
                id=cid,
                name=cmd.name,
                level_id=cmd.level_id,
                boundary_mm=cmd.boundary_mm,
                height_offset_mm=cmd.height_offset_mm,
                thickness_mm=cmd.thickness_mm,
                ceiling_type_id=cmd.ceiling_type_id,
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("ceiling", "arch"),
            )

        case CreateMassCmd():
            mid = cmd.id or new_id()
            if mid in els:
                raise ValueError(f"duplicate element id '{mid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createMass.levelId must reference an existing Level")
            if len(cmd.footprint_mm) < 3:
                raise ValueError("createMass.footprintMm requires ≥3 vertices")
            els[mid] = MassElem(
                kind="mass",
                id=mid,
                name=cmd.name,
                level_id=cmd.level_id,
                footprint_mm=list(cmd.footprint_mm),
                height_mm=cmd.height_mm,
                rotation_deg=cmd.rotation_deg,
                material_key=cmd.material_key,
                phase_id="massing",
                discipline=DEFAULT_DISCIPLINE_BY_KIND.get("mass", "arch"),
            )

        case MaterializeMassToWallsCmd():
            mass = els.get(cmd.mass_id)
            if not isinstance(mass, MassElem):
                raise ValueError(
                    f"materializeMassToWalls.massId '{cmd.mass_id}' "
                    "must reference an existing mass element"
                )
            level = els.get(mass.level_id)
            if not isinstance(level, LevelElem):
                raise ValueError(
                    "materializeMassToWalls: mass.levelId must reference an existing Level"
                )
            footprint = list(mass.footprint_mm)
            n = len(footprint)
            if n < 3:
                raise ValueError("materializeMassToWalls: mass.footprintMm requires ≥3 vertices")

            emitted_ids: list[str] = []
            for i in range(n):
                a = footprint[i]
                b = footprint[(i + 1) % n]
                wid = f"{mass.id}-w{i}"
                if wid in els:
                    raise ValueError(
                        f"materializeMassToWalls: target wall id '{wid}' already exists"
                    )
                els[wid] = WallElem(
                    kind="wall",
                    id=wid,
                    name=f"{mass.name} wall {i}",
                    level_id=mass.level_id,
                    start=a,
                    end=b,
                    height_mm=mass.height_mm,
                    material_key=mass.material_key,
                    phase_id="skeleton",
                )
                emitted_ids.append(wid)

            fid = f"{mass.id}-f"
            if fid in els:
                raise ValueError(f"materializeMassToWalls: target floor id '{fid}' already exists")
            els[fid] = FloorElem(
                kind="floor",
                id=fid,
                name=f"{mass.name} floor",
                level_id=mass.level_id,
                boundary_mm=footprint,
                phase_id="skeleton",
            )
            emitted_ids.append(fid)

            rid = f"{mass.id}-r"
            if rid in els:
                raise ValueError(f"materializeMassToWalls: target roof id '{rid}' already exists")
            els[rid] = RoofElem(
                kind="roof",
                id=rid,
                name=f"{mass.name} roof",
                reference_level_id=mass.level_id,
                footprint_mm=footprint,
                slope_deg=0.0,
                roof_geometry_mode="flat",
                eave_height_left_mm=mass.height_mm,
                eave_height_right_mm=mass.height_mm,
                material_key=mass.material_key,
                phase_id="skeleton",
            )
            emitted_ids.append(rid)

            dev_id = new_id()
            els[dev_id] = AgentDeviationElem(
                kind="agent_deviation",
                id=dev_id,
                statement=(
                    f"Mass {mass.id} materialised to {n} wall(s), 1 floor, 1 roof "
                    f"(phase 'massing' → 'skeleton')."
                ),
                severity="warning",
                related_element_ids=[mass.id, *emitted_ids],
            )

            del els[mass.id]

        case CreateVoidCutCmd():
            vid = cmd.id or new_id()
            if vid in els:
                raise ValueError(f"duplicate element id '{vid}'")
            host = els.get(cmd.host_element_id)
            if host is None:
                raise ValueError("createVoidCut.hostElementId must reference an existing element")
            if len(cmd.profile_mm) < 3:
                raise ValueError("createVoidCut.profileMm requires ≥3 vertices")
            els[vid] = VoidCutElem(
                kind="void_cut",
                id=vid,
                host_element_id=cmd.host_element_id,
                profile_mm=list(cmd.profile_mm),
                depth_mm=cmd.depth_mm,
            )
            dev_id = new_id()
            els[dev_id] = AgentDeviationElem(
                kind="agent_deviation",
                id=dev_id,
                statement=(
                    f"Void cut {vid} authored against host element "
                    f"{cmd.host_element_id} (depth {cmd.depth_mm:.0f} mm)."
                ),
                severity="warning",
                related_element_ids=[vid, cmd.host_element_id],
            )

        case CreateConstraintCmd():
            kid = cmd.id or new_id()
            if kid in els:
                raise ValueError(f"duplicate element id '{kid}'")
            if not cmd.refs_a or not cmd.refs_b:
                raise ValueError("createConstraint.refsA and refsB each require at least one ref")
            els[kid] = ConstraintElem(
                kind="constraint",
                id=kid,
                name=cmd.name or "",
                rule=cmd.rule,
                refs_a=[
                    ConstraintRefRow(elementId=r.element_id, anchor=r.anchor) for r in cmd.refs_a
                ],
                refs_b=[
                    ConstraintRefRow(elementId=r.element_id, anchor=r.anchor) for r in cmd.refs_b
                ],
                locked_value_mm=cmd.locked_value_mm,
                severity=cmd.severity,
            )

        case UpsertFamilyTypeCmd():
            fid = cmd.id or new_id()
            kwargs: dict[str, Any] = {
                "kind": "family_type",
                "id": fid,
                "name": cmd.name or str(cmd.parameters.get("name") or ""),
                "familyId": cmd.family_id or str(cmd.parameters.get("familyId") or ""),
                "discipline": cmd.discipline,
                "parameters": dict(cmd.parameters),
            }
            if cmd.catalog_source is not None:
                kwargs["catalog_source"] = FamilyCatalogSource(
                    catalogId=cmd.catalog_source.catalog_id,
                    familyId=cmd.catalog_source.family_id,
                    version=cmd.catalog_source.version,
                )
            els[fid] = FamilyTypeElem(**kwargs)

        case AssignOpeningFamilyCmd():
            op = els.get(cmd.opening_id)
            if not isinstance(op, (DoorElem, WindowElem)):
                raise ValueError("assignOpeningFamily.openingId must reference door or window")
            extra: dict[str, Any] = {"family_type_id": cmd.family_type_id}
            if cmd.cut_depth_mm is not None:
                extra["host_cut_depth_mm"] = cmd.cut_depth_mm
            if cmd.reveal_interior_mm is not None:
                extra["reveal_interior_mm"] = cmd.reveal_interior_mm
            els[cmd.opening_id] = op.model_copy(update=extra)

        case UpdateOpeningCleanroomCmd():
            op = els.get(cmd.opening_id)
            if not isinstance(op, (DoorElem, WindowElem)):
                raise ValueError("updateOpeningCleanroom.openingId must reference door or window")
            extra: dict[str, Any] = {}
            if cmd.interlock_grade is not None:
                extra["interlock_grade"] = cmd.interlock_grade
            if cmd.seal_rebate_mm is not None:
                extra["seal_rebate_mm"] = cmd.seal_rebate_mm
            if cmd.lod_plan is not None and cmd.lod_plan in {"simple", "detailed"}:
                extra["lod_plan"] = cmd.lod_plan
            els[cmd.opening_id] = op.model_copy(update=extra)

        case CreateRoomSeparationCmd():
            rsid = cmd.id or new_id()
            if rsid in els:
                raise ValueError(f"duplicate element id '{rsid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createRoomSeparation.levelId must reference Level")
            els[rsid] = RoomSeparationElem(
                kind="room_separation",
                id=rsid,
                name=cmd.name,
                level_id=cmd.level_id,
                start=cmd.start,
                end=cmd.end,
            )
        case _:
            return False
    return True
