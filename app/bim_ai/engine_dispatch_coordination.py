# ruff: noqa: I001

from bim_ai.engine import (
    AddOptionCmd,
    AgentAssumptionElem,
    AgentDeviationElem,
    Any,
    AssignElementToOptionCmd,
    BcfElem,
    BumpMonitoredRevisionsCmd,
    ClashResultSpec,
    ClashTestElem,
    CreateAgentAssumptionCmd,
    CreateAgentDeviationCmd,
    CreateBcfTopicCmd,
    CreateLinkDxfCmd,
    CreateLinkModelCmd,
    CreateOptionSetCmd,
    CreatePhaseCmd,
    DEFAULT_DISCIPLINE_BY_KIND,
    DeleteLinkModelCmd,
    DeletePhaseCmd,
    DoorElem,
    LINKED_ID_SEPARATOR,
    LevelElem,
    LinkDxfElem,
    LinkModelElem,
    MirrorElementsCmd,
    MoveElementCmd,
    PhaseElem,
    PhaseFilter,
    PinElementCmd,
    PlanViewElem,
    ReconcileMonitoredElementCmd,
    RemoveOptionCmd,
    RenamePhaseCmd,
    ReorderPhaseCmd,
    RunClashTestCmd,
    SectionCutElem,
    SelectionSetElem,
    SelectionSetRuleSpec,
    SetElementDisciplineCmd,
    SetElementPhaseCmd,
    SetPrimaryOptionCmd,
    SetViewLensCmd,
    SetViewOptionLockCmd,
    SetViewPhaseCmd,
    SetViewPhaseFilterCmd,
    SetWallLeanTaperCmd,
    SetWallStackCmd,
    SiteElem,
    UnpinElementCmd,
    UpdateLinkDxfCmd,
    UpdateLinkModelCmd,
    UpsertClashTestCmd,
    UpsertSelectionSetCmd,
    UpsertSiteCmd,
    UpsertValidationRuleCmd,
    ValidationRuleElem,
    WallElem,
    WallStack,
    WallStackComponent,
    WindowElem,
    _apply_mirror_elements_impl,
    _canonical_site_boundary_mm,
    _canonical_site_context_rows,
    _no_source_provider,
    is_element_pinned,
    _supports_pin,
    _validate_wall_lean_taper,
    _validate_wall_stack,
    bump_monitored_revisions,
    cast,
    new_id,
    reconcile_monitored_element,
    run_clash_test,
)
from bim_ai.elements import DxfLayerMeta


def _derive_dxf_layers(linework: list[Any]) -> list[dict[str, Any]]:
    layers: dict[str, dict[str, Any]] = {}
    for prim in linework:
        name = getattr(prim, "layer_name", None) or "0"
        row = layers.setdefault(name, {"name": name, "primitiveCount": 0})
        row["primitiveCount"] += 1
        color = getattr(prim, "layer_color", None)
        if color and "color" not in row:
            row["color"] = color
    return sorted(layers.values(), key=lambda row: str(row["name"]).casefold())


def try_apply_coordination_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateBcfTopicCmd():
            bid = cmd.id or new_id()
            if bid in els:
                raise ValueError(f"duplicate element id '{bid}'")
            pv = cmd.plan_view_id
            if pv is not None:
                pvel = els.get(pv)
                if not isinstance(pvel, PlanViewElem):
                    raise ValueError("createBcfTopic.planViewId must reference plan_view")
            sc = cmd.section_cut_id
            if sc is not None:
                scel = els.get(sc)
                if not isinstance(scel, SectionCutElem):
                    raise ValueError("createBcfTopic.sectionCutId must reference section_cut")
            refs_sorted = sorted(
                cmd.evidence_refs,
                key=lambda r: (
                    r.kind,
                    r.sheet_id or "",
                    r.viewpoint_id or "",
                    r.plan_view_id or "",
                    r.section_cut_id or "",
                    r.png_basename or "",
                ),
            )
            els[bid] = BcfElem(
                kind="bcf",
                id=bid,
                title=cmd.title,
                viewpoint_ref=cmd.viewpoint_ref,
                element_ids=sorted(cmd.element_ids),
                plan_view_id=pv,
                section_cut_id=sc,
                evidence_refs=refs_sorted,
            )

        case CreateAgentAssumptionCmd():
            aid = cmd.id or new_id()
            if aid in els:
                raise ValueError(f"duplicate element id '{aid}'")
            els[aid] = AgentAssumptionElem(
                kind="agent_assumption",
                id=aid,
                statement=cmd.statement,
                source=cmd.source,
                closure_status=cmd.closure_status,
                related_element_ids=sorted(cmd.related_element_ids),
                related_topic_id=cmd.related_topic_id,
            )

        case CreateAgentDeviationCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            els[did] = AgentDeviationElem(
                kind="agent_deviation",
                id=did,
                statement=cmd.statement,
                severity=cmd.severity,
                acknowledged=cmd.acknowledged,
                related_assumption_id=cmd.related_assumption_id,
                related_element_ids=sorted(cmd.related_element_ids),
            )

        case UpsertSiteCmd():
            sid = cmd.id
            prev_el = els.get(sid)
            if prev_el is not None and not isinstance(prev_el, SiteElem):
                raise ValueError("upsertSite.id must reference site when element exists")
            lid = cmd.reference_level_id
            if lid not in els or not isinstance(els[lid], LevelElem):
                raise ValueError("upsertSite.referenceLevelId must reference an existing Level")
            if cmd.pad_thickness_mm <= 0:
                raise ValueError("upsertSite.padThicknessMm must be > 0")
            boundary = _canonical_site_boundary_mm(list(cmd.boundary_mm))
            ctx = _canonical_site_context_rows(list(cmd.context_objects))
            us = cmd.uniform_setback_mm
            if us is not None and float(us) < 0:
                raise ValueError("upsertSite.uniformSetbackMm must be ≥ 0 when set")
            north = cmd.north_deg_cw_from_plan_x
            els[sid] = SiteElem(
                kind="site",
                id=sid,
                name=cmd.name,
                reference_level_id=lid,
                boundary_mm=boundary,
                pad_thickness_mm=float(cmd.pad_thickness_mm),
                base_offset_mm=float(cmd.base_offset_mm),
                north_deg_cw_from_plan_x=float(north) if north is not None else None,
                uniform_setback_mm=float(us) if us is not None else None,
                context_objects=ctx,
            )

        case UpsertValidationRuleCmd():
            vid = cmd.id or new_id()
            els[vid] = ValidationRuleElem(
                kind="validation_rule",
                id=vid,
                name=cmd.name,
                rule_json=dict(cmd.rule_json),
            )

        case MirrorElementsCmd():
            _apply_mirror_elements_impl(els, cmd, new_id)

        case PinElementCmd():
            target = els.get(cmd.element_id)
            if target is None:
                raise ValueError(f"pinElement.elementId unknown: '{cmd.element_id}'")
            if not _supports_pin(target):
                raise ValueError(
                    f"pinElement.elementId '{cmd.element_id}' kind '{target.kind}' is not pinnable"
                )
            els[cmd.element_id] = target.model_copy(update={"pinned": True})

        case UnpinElementCmd():
            target = els.get(cmd.element_id)
            if target is None:
                raise ValueError(f"unpinElement.elementId unknown: '{cmd.element_id}'")
            if not _supports_pin(target):
                # Unpinning a non-pinnable element is a no-op rather than an error.
                return
            els[cmd.element_id] = target.model_copy(update={"pinned": False})

        case CreateLinkModelCmd():
            lid = cmd.id or new_id()
            if lid in els:
                raise ValueError(f"duplicate element id '{lid}'")
            src = (cmd.source_model_id or "").strip()
            if not src:
                raise ValueError("createLinkModel.sourceModelId must be a non-empty UUID")
            if LINKED_ID_SEPARATOR in lid:
                raise ValueError(
                    f"createLinkModel.id '{lid}' must not contain '{LINKED_ID_SEPARATOR}' "
                    "(reserved for linked-element prefixes)"
                )
            # Self-reference at the link-id level: the link's own id must not
            # match any source id we'd resolve to. The route handler enforces
            # the harder check (sourceModelId != host model UUID + circular
            # BFS) since the engine has no DB access.
            if src == lid:
                raise ValueError("createLinkModel.sourceModelId cannot reference this link itself")
            els[lid] = LinkModelElem(
                kind="link_model",
                id=lid,
                name=cmd.name,
                source_model_id=src,
                source_model_revision=cmd.source_model_revision,
                position_mm=cmd.position_mm,
                rotation_deg=cmd.rotation_deg,
                origin_alignment_mode=cmd.origin_alignment_mode,
                visibility_mode=cmd.visibility_mode,
                hidden=cmd.hidden,
                pinned=cmd.pinned,
            )

        case UpdateLinkModelCmd():
            link = els.get(cmd.link_id)
            if not isinstance(link, LinkModelElem):
                raise ValueError("updateLinkModel.linkId must reference a link_model element")
            spatial_updates_requested = (
                cmd.position_mm is not None
                or cmd.rotation_deg is not None
                or cmd.origin_alignment_mode is not None
            )
            if spatial_updates_requested and is_element_pinned(link):
                raise ValueError(f"pinned_element_blocked: '{cmd.link_id}' is pinned; unpin first")
            updates: dict[str, Any] = {}
            if cmd.name is not None:
                updates["name"] = cmd.name
            if cmd.position_mm is not None:
                updates["position_mm"] = cmd.position_mm
            if cmd.rotation_deg is not None:
                updates["rotation_deg"] = float(cmd.rotation_deg)
            if cmd.hidden is not None:
                updates["hidden"] = bool(cmd.hidden)
            if cmd.pinned is not None:
                updates["pinned"] = bool(cmd.pinned)
            if cmd.origin_alignment_mode is not None:
                updates["origin_alignment_mode"] = cmd.origin_alignment_mode
            if cmd.visibility_mode is not None:
                updates["visibility_mode"] = cmd.visibility_mode
            if "source_model_revision" in cmd.model_fields_set:
                # Pydantic tracks fields the caller actually sent vs. omitted;
                # we use that to distinguish "unpin (explicit null)" from
                # "leave revision pinning untouched".
                updates["source_model_revision"] = cmd.source_model_revision
            els[cmd.link_id] = link.model_copy(update=updates)

        case DeleteLinkModelCmd():
            link = els.get(cmd.link_id)
            if not isinstance(link, LinkModelElem):
                raise ValueError("deleteLinkModel.linkId must reference a link_model element")
            if is_element_pinned(link):
                raise ValueError(f"pinned_element_blocked: '{cmd.link_id}' is pinned; unpin first")
            del els[cmd.link_id]

        case UpdateLinkDxfCmd():
            dxf_link = els.get(cmd.link_id)
            if not isinstance(dxf_link, LinkDxfElem):
                raise ValueError("updateLinkDxf.linkId must reference a link_dxf element")
            dxf_updates: dict[str, Any] = {}
            if cmd.color_mode is not None:
                dxf_updates["color_mode"] = cmd.color_mode
            if cmd.custom_color is not None:
                dxf_updates["custom_color"] = cmd.custom_color
            if cmd.overlay_opacity is not None:
                dxf_updates["overlay_opacity"] = float(cmd.overlay_opacity)
            if cmd.source_path is not None:
                dxf_updates["source_path"] = cmd.source_path
            if cmd.cad_reference_type is not None:
                dxf_updates["cad_reference_type"] = cmd.cad_reference_type
            if cmd.source_metadata is not None:
                dxf_updates["source_metadata"] = dict(cmd.source_metadata)
            if cmd.reload_status is not None:
                dxf_updates["reload_status"] = cmd.reload_status
            if cmd.last_reload_message is not None:
                dxf_updates["last_reload_message"] = cmd.last_reload_message
            if cmd.linework is not None:
                dxf_updates["linework"] = list(cmd.linework)
                dxf_updates["dxf_layers"] = (
                    list(cmd.dxf_layers)
                    if cmd.dxf_layers is not None
                    else [
                        DxfLayerMeta.model_validate(row)
                        for row in _derive_dxf_layers(list(cmd.linework))
                    ]
                )
            if cmd.loaded is not None:
                dxf_updates["loaded"] = bool(cmd.loaded)
            if cmd.hidden_layer_names is not None:
                layer_rows = dxf_updates.get("dxf_layers", dxf_link.dxf_layers)
                known_layers = {row.name for row in layer_rows}
                if known_layers:
                    unknown = sorted(set(cmd.hidden_layer_names) - known_layers)
                    if unknown:
                        raise ValueError(
                            "updateLinkDxf.hiddenLayerNames includes unknown DXF layer(s): "
                            + ", ".join(unknown)
                        )
                dxf_updates["hidden_layer_names"] = list(dict.fromkeys(cmd.hidden_layer_names))
            elif "dxf_layers" in dxf_updates:
                known_layers = {row.name for row in dxf_updates["dxf_layers"]}
                dxf_updates["hidden_layer_names"] = [
                    name for name in dxf_link.hidden_layer_names if name in known_layers
                ]
            if cmd.origin_alignment_mode is not None:
                dxf_updates["origin_alignment_mode"] = cmd.origin_alignment_mode
            els[cmd.link_id] = dxf_link.model_copy(update=dxf_updates)

        case CreateLinkDxfCmd():
            lid = cmd.id or new_id()
            if lid in els:
                raise ValueError(f"duplicate element id '{lid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createLinkDxf.levelId must reference an existing Level")
            els[lid] = LinkDxfElem(
                kind="link_dxf",
                id=lid,
                name=cmd.name,
                level_id=cmd.level_id,
                origin_mm=cmd.origin_mm,
                origin_alignment_mode=cmd.origin_alignment_mode,
                rotation_deg=float(cmd.rotation_deg),
                scale_factor=float(cmd.scale_factor),
                linework=list(cmd.linework),
                dxf_layers=cmd.dxf_layers or _derive_dxf_layers(list(cmd.linework)),
                hidden_layer_names=list(dict.fromkeys(cmd.hidden_layer_names)),
                pinned=bool(cmd.pinned),
                source_path=cmd.source_path,
                cad_reference_type=cmd.cad_reference_type,
                source_metadata=dict(cmd.source_metadata),
                reload_status=cmd.reload_status,
                last_reload_message=cmd.last_reload_message,
                loaded=bool(cmd.loaded),
            )

        case UpsertSelectionSetCmd():
            sid = cmd.id or new_id()
            existing = els.get(sid)
            if existing is not None and not isinstance(existing, SelectionSetElem):
                raise ValueError(
                    f"upsertSelectionSet.id '{sid}' refers to a non-selection_set element"
                )
            rules: list[SelectionSetRuleSpec] = []
            for r in cmd.filter_rules:
                rules.append(
                    SelectionSetRuleSpec(
                        field=r.field,
                        operator=r.operator,
                        value=r.value,
                        link_scope=r.link_scope,
                    )
                )
            els[sid] = SelectionSetElem(
                kind="selection_set",
                id=sid,
                name=cmd.name,
                filter_rules=rules,
            )

        case UpsertClashTestCmd():
            cid = cmd.id or new_id()
            existing = els.get(cid)
            if existing is not None and not isinstance(existing, ClashTestElem):
                raise ValueError(f"upsertClashTest.id '{cid}' refers to a non-clash_test element")
            prior_results = existing.results if isinstance(existing, ClashTestElem) else None
            els[cid] = ClashTestElem(
                kind="clash_test",
                id=cid,
                name=cmd.name,
                set_a_ids=list(cmd.set_a_ids),
                set_b_ids=list(cmd.set_b_ids),
                tolerance_mm=float(cmd.tolerance_mm),
                results=prior_results,
            )

        case RunClashTestCmd():
            target = els.get(cmd.clash_test_id)
            if not isinstance(target, ClashTestElem):
                raise ValueError("runClashTest.clashTestId must reference a clash_test element")
            provider = source_provider or _no_source_provider
            results: list[ClashResultSpec] = run_clash_test(doc, target, provider)
            els[cmd.clash_test_id] = target.model_copy(update={"results": results})

        case BumpMonitoredRevisionsCmd():
            bump_monitored_revisions(doc, source_provider or _no_source_provider)

        case ReconcileMonitoredElementCmd():
            reconcile_monitored_element(
                doc,
                cmd.element_id,
                cmd.mode,
                source_provider or _no_source_provider,
            )

        # KRN-V3-01: phasing primitive commands

        case CreatePhaseCmd():
            pid = cmd.id or new_id()
            if pid in els:
                raise ValueError(f"createPhase: duplicate element id {pid!r}")
            for el in els.values():
                if isinstance(el, PhaseElem) and el.ord == cmd.ord:
                    raise ValueError(f"createPhase: ord {cmd.ord} already used by phase {el.id!r}")
            els[pid] = PhaseElem(kind="phase", id=pid, name=cmd.name, ord=cmd.ord)

        case RenamePhaseCmd():
            ph = els.get(cmd.phase_id)
            if not isinstance(ph, PhaseElem):
                raise ValueError(
                    f"renamePhase: phaseId {cmd.phase_id!r} must reference a Phase element"
                )
            els[cmd.phase_id] = ph.model_copy(update={"name": cmd.name})

        case ReorderPhaseCmd():
            ph = els.get(cmd.phase_id)
            if not isinstance(ph, PhaseElem):
                raise ValueError(
                    f"reorderPhase: phaseId {cmd.phase_id!r} must reference a Phase element"
                )
            for el in els.values():
                if isinstance(el, PhaseElem) and el.id != cmd.phase_id and el.ord == cmd.ord:
                    raise ValueError(f"reorderPhase: ord {cmd.ord} already used by phase {el.id!r}")
            els[cmd.phase_id] = ph.model_copy(update={"ord": cmd.ord})

        case DeletePhaseCmd():
            ph = els.get(cmd.phase_id)
            if not isinstance(ph, PhaseElem):
                raise ValueError(
                    f"deletePhase: phaseId {cmd.phase_id!r} must reference a Phase element"
                )
            affected = [
                eid
                for eid, el in els.items()
                if getattr(el, "phase_created", None) == cmd.phase_id
                or getattr(el, "phase_demolished", None) == cmd.phase_id
            ]
            if affected and cmd.retarget_to_phase_id is None:
                raise ValueError(
                    f"deletePhase: {len(affected)} element(s) reference this phase; "
                    "supply retargetToPhaseId to retarget them"
                )
            if cmd.retarget_to_phase_id is not None:
                retarget = els.get(cmd.retarget_to_phase_id)
                if not isinstance(retarget, PhaseElem):
                    raise ValueError(
                        f"deletePhase: retargetToPhaseId {cmd.retarget_to_phase_id!r} "
                        "must reference a Phase element"
                    )
                for eid in affected:
                    el = els[eid]
                    updates: dict[str, object] = {}
                    if getattr(el, "phase_created", None) == cmd.phase_id:
                        updates["phase_created"] = cmd.retarget_to_phase_id
                    if getattr(el, "phase_demolished", None) == cmd.phase_id:
                        updates["phase_demolished"] = cmd.retarget_to_phase_id
                    els[eid] = el.model_copy(update=updates)
            del els[cmd.phase_id]

        case SetElementPhaseCmd():
            el = els.get(cmd.element_id)
            if el is None:
                raise ValueError(f"setElementPhase: elementId {cmd.element_id!r} not found")
            if not hasattr(el, "phase_created"):
                raise ValueError(
                    f"setElementPhase: elementId {cmd.element_id!r} ({el.kind!r}) "
                    "does not support phasing fields"
                )
            updates_ep: dict[str, object] = {}
            if cmd.phase_created_id is not None:
                pc = els.get(cmd.phase_created_id)
                if not isinstance(pc, PhaseElem):
                    raise ValueError(
                        f"setElementPhase: phaseCreatedId {cmd.phase_created_id!r} "
                        "must reference a Phase element"
                    )
                updates_ep["phase_created"] = cmd.phase_created_id
            if cmd.clear_demolished:
                updates_ep["phase_demolished"] = None
            elif cmd.phase_demolished_id is not None:
                pd = els.get(cmd.phase_demolished_id)
                if not isinstance(pd, PhaseElem):
                    raise ValueError(
                        f"setElementPhase: phaseDemolishedId {cmd.phase_demolished_id!r} "
                        "must reference a Phase element"
                    )
                created_id = updates_ep.get("phase_created") or getattr(el, "phase_created", None)
                if created_id is not None:
                    pc_el = els.get(cast(str, created_id))
                    if isinstance(pc_el, PhaseElem) and pd.ord < pc_el.ord:
                        raise ValueError(
                            "setElementPhase: phaseDemolished.ord must be >= phaseCreated.ord"
                        )
                updates_ep["phase_demolished"] = cmd.phase_demolished_id
            if updates_ep:
                els[cmd.element_id] = el.model_copy(update=updates_ep)

        case SetElementDisciplineCmd():
            valid = {"arch", "struct", "mep"}
            if cmd.discipline is not None and cmd.discipline not in valid:
                raise ValueError(
                    f"setElementDiscipline: discipline must be arch|struct|mep|null, "
                    f"got {cmd.discipline!r}"
                )
            for eid in cmd.element_ids:
                el = els.get(eid)
                if el is None:
                    raise ValueError(f"setElementDiscipline: elementId {eid!r} not found")
                if not hasattr(el, "discipline"):
                    raise ValueError(
                        f"setElementDiscipline: elementId {eid!r} ({el.kind!r}) "
                        "does not support the discipline field"
                    )
                # discipline=None means "reset to kind default"
                resolved = (
                    DEFAULT_DISCIPLINE_BY_KIND.get(el.kind, "arch")
                    if cmd.discipline is None
                    else cmd.discipline
                )
                els[eid] = el.model_copy(update={"discipline": resolved})

        case SetViewPhaseCmd():
            view = els.get(cmd.view_id)
            if not isinstance(view, PlanViewElem):
                raise ValueError(f"setViewPhase: viewId {cmd.view_id!r} must reference a plan_view")
            ph = els.get(cmd.phase_id)
            if not isinstance(ph, PhaseElem):
                raise ValueError(
                    f"setViewPhase: phaseId {cmd.phase_id!r} must reference a Phase element"
                )
            els[cmd.view_id] = view.model_copy(update={"phase_id": cmd.phase_id})

        case SetViewPhaseFilterCmd():
            view = els.get(cmd.view_id)
            if not isinstance(view, PlanViewElem):
                raise ValueError(
                    f"setViewPhaseFilter: viewId {cmd.view_id!r} must reference a plan_view"
                )
            els[cmd.view_id] = view.model_copy(
                update={"phase_filter": cast(PhaseFilter, cmd.phase_filter)}
            )

        case SetViewLensCmd():
            view = els.get(cmd.view_id)
            if view is None:
                raise ValueError(f"setViewLens: viewId {cmd.view_id!r} not found")
            els[cmd.view_id] = view.model_copy(update={"default_lens": cmd.lens})

        case MoveElementCmd():
            el = els.get(cmd.element_id)
            if isinstance(el, DoorElem):
                els[cmd.element_id] = el.model_copy(update={"along_t": cmd.t_along_host})
            elif isinstance(el, WindowElem):
                els[cmd.element_id] = el.model_copy(update={"along_t": cmd.t_along_host})
            else:
                raise ValueError(
                    f"moveElement: elementId {cmd.element_id!r} must reference a door or window"
                )

        case SetWallStackCmd():
            wall = els.get(cmd.wall_id)
            if not isinstance(wall, WallElem):
                raise ValueError("setWallStack.wallId must reference a Wall")
            if not cmd.components:
                els[cmd.wall_id] = wall.model_copy(update={"stack": None})
            else:
                _validate_wall_stack(cmd.components, wall.height_mm)
                new_stack = WallStack(
                    components=[
                        WallStackComponent(wall_type_id=c.wall_type_id, height_mm=c.height_mm)
                        for c in cmd.components
                    ]
                )
                els[cmd.wall_id] = wall.model_copy(update={"stack": new_stack})

        case SetWallLeanTaperCmd():
            wall = els.get(cmd.wall_id)
            if not isinstance(wall, WallElem):
                raise ValueError("setWallLeanTaper.wallId must reference a Wall")
            _validate_wall_lean_taper(cmd.lean_mm, cmd.taper_ratio, wall.height_mm)
            els[cmd.wall_id] = wall.model_copy(
                update={
                    "lean_mm": cmd.lean_mm,
                    "taper_ratio": cmd.taper_ratio,
                }
            )

        case CreateOptionSetCmd():
            if any(s.id == cmd.id for s in doc.design_option_sets):
                raise ValueError(f"duplicate option set id: {cmd.id!r}")
            from bim_ai.document import DesignOptionSet

            doc.design_option_sets.append(DesignOptionSet(id=cmd.id, name=cmd.name))

        case AddOptionCmd():
            the_set = next((s for s in doc.design_option_sets if s.id == cmd.option_set_id), None)
            if the_set is None:
                raise ValueError(f"option set not found: {cmd.option_set_id!r}")
            if any(o.id == cmd.option_id for o in the_set.options):
                raise ValueError(f"duplicate option id: {cmd.option_id!r}")
            from bim_ai.document import DesignOption

            if cmd.is_primary:
                for o in the_set.options:
                    o.is_primary = False
            the_set.options.append(
                DesignOption(id=cmd.option_id, name=cmd.name, is_primary=cmd.is_primary)
            )

        case RemoveOptionCmd():
            the_set = next((s for s in doc.design_option_sets if s.id == cmd.option_set_id), None)
            if the_set is None:
                raise ValueError(f"option set not found: {cmd.option_set_id!r}")
            if len(the_set.options) <= 1:
                raise ValueError("cannot remove the only option in a set")
            the_set.options = [o for o in the_set.options if o.id != cmd.option_id]
            for eid, elem in list(els.items()):
                if (
                    getattr(elem, "option_set_id", None) == cmd.option_set_id
                    and getattr(elem, "option_id", None) == cmd.option_id
                ):
                    els[eid] = elem.model_copy(update={"option_set_id": None, "option_id": None})

        case SetPrimaryOptionCmd():
            the_set = next((s for s in doc.design_option_sets if s.id == cmd.option_set_id), None)
            if the_set is None:
                raise ValueError(f"option set not found: {cmd.option_set_id!r}")
            target = next((o for o in the_set.options if o.id == cmd.option_id), None)
            if target is None:
                raise ValueError(f"option not found: {cmd.option_id!r}")
            for o in the_set.options:
                o.is_primary = o.id == cmd.option_id

        case AssignElementToOptionCmd():
            if (cmd.option_set_id is None) != (cmd.option_id is None):
                raise ValueError("optionSetId and optionId must both be null or both non-null")
            elem = els.get(cmd.element_id)
            if elem is None:
                raise ValueError(f"element not found: {cmd.element_id!r}")
            els[cmd.element_id] = elem.model_copy(
                update={"option_set_id": cmd.option_set_id, "option_id": cmd.option_id}
            )

        case SetViewOptionLockCmd():
            view = els.get(cmd.view_id)
            if view is None or not hasattr(view, "option_locks"):
                raise ValueError("viewId must reference a plan_view or viewpoint element")
            locks = dict(view.option_locks or {})
            if cmd.option_id is None:
                locks.pop(cmd.option_set_id, None)
            else:
                locks[cmd.option_set_id] = cmd.option_id
            els[cmd.view_id] = view.model_copy(update={"option_locks": locks})
        case _:
            return False
    return True
