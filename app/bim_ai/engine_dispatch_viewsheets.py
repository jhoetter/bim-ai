# ruff: noqa: I001

from bim_ai.engine import (
    AddViewBreakCmd,
    Any,
    ApplyViewTemplateCmd,
    CreateDraftingViewCmd,
    CreateSheetCmd,
    CreateViewCalloutCmd,
    CreateViewTemplateCmd,
    CreateWindowLegendViewCmd,
    DEFAULT_TITLEBLOCK_TYPE,
    DeleteViewTemplateCmd,
    ElementOverrideSpec,
    HideElementInViewCmd,
    MoveViewOnSheetCmd,
    PlaceViewOnSheetCmd,
    PlanViewElem,
    RemoveViewBreakCmd,
    RemoveViewFromSheetCmd,
    SetElementOverrideCmd,
    SetSheetTitleblockCmd,
    SheetElem,
    SheetMetadata,
    SheetXY,
    UnbindViewTemplateCmd,
    UnhideElementInViewCmd,
    UpdateSheetMetadataCmd,
    UpdateViewTemplateCmd,
    ViewBreakSpec,
    ViewElem,
    ViewPlacement,
    ViewTemplateElem,
    WindowLegendViewElem,
)
from bim_ai.elements import normalize_view_template_control_matrix


def _template_field_included(tpl: ViewTemplateElem, field: str) -> bool:
    control = tpl.template_control_matrix.get(field)
    return True if control is None else control.included


def _view_template_plan_patch(tpl: ViewTemplateElem) -> dict[str, Any]:
    view_patch: dict[str, Any] = {}
    if _template_field_included(tpl, "scale") and tpl.scale is not None and isinstance(tpl.scale, int):
        view_patch["scale"] = tpl.scale
    if _template_field_included(tpl, "detailLevel") and tpl.detail_level is not None:
        view_patch["plan_detail_level"] = tpl.detail_level
    if _template_field_included(tpl, "elementOverrides") and tpl.element_overrides:
        view_patch["element_overrides"] = list(tpl.element_overrides)
    if _template_field_included(tpl, "phase") and tpl.phase is not None:
        view_patch["phase_id"] = tpl.phase
    if _template_field_included(tpl, "phaseFilter") and tpl.phase_filter is not None:
        view_patch["phase_filter"] = tpl.phase_filter
    return view_patch


def try_apply_viewsheets_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case CreateSheetCmd():
            if cmd.titleblock_type_id not in els:
                els[DEFAULT_TITLEBLOCK_TYPE.id] = DEFAULT_TITLEBLOCK_TYPE
            meta_raw = cmd.metadata or {}
            meta = SheetMetadata(
                projectName=meta_raw.get("projectName", ""),
                drawnBy=meta_raw.get("drawnBy", ""),
                checkedBy=meta_raw.get("checkedBy", ""),
                date=meta_raw.get("date", ""),
                revision=meta_raw.get("revision", ""),
            )
            els[cmd.sheet_id] = SheetElem(
                kind="sheet",
                id=cmd.sheet_id,
                name=cmd.name,
                number=cmd.number,
                size=cmd.size,
                orientation=cmd.orientation,
                titleblockTypeId=cmd.titleblock_type_id,
                metadata=meta,
            )

        case PlaceViewOnSheetCmd():
            sh = els.get(cmd.sheet_id)
            if not isinstance(sh, SheetElem):
                raise ValueError(f"CreateSheet: sheetId '{cmd.sheet_id}' not found")
            placements = [vp for vp in sh.view_placements if vp.view_id != cmd.view_id]
            placements.append(
                ViewPlacement(
                    viewId=cmd.view_id,
                    minXY=SheetXY(x=cmd.min_xy.get("x", 0), y=cmd.min_xy.get("y", 0)),
                    size=SheetXY(x=cmd.size.get("x", 0), y=cmd.size.get("y", 0)),
                    scale=cmd.scale,
                )
            )
            els[cmd.sheet_id] = sh.model_copy(update={"view_placements": placements})

        case MoveViewOnSheetCmd():
            sh = els.get(cmd.sheet_id)
            if not isinstance(sh, SheetElem):
                raise ValueError(f"MoveViewOnSheet: sheetId '{cmd.sheet_id}' not found")
            placements = []
            for vp in sh.view_placements:
                if vp.view_id == cmd.view_id:
                    placements.append(
                        vp.model_copy(
                            update={
                                "min_xy": SheetXY(
                                    x=cmd.min_xy.get("x", 0), y=cmd.min_xy.get("y", 0)
                                )
                            }
                        )
                    )
                else:
                    placements.append(vp)
            els[cmd.sheet_id] = sh.model_copy(update={"view_placements": placements})

        case RemoveViewFromSheetCmd():
            sh = els.get(cmd.sheet_id)
            if not isinstance(sh, SheetElem):
                raise ValueError(f"RemoveViewFromSheet: sheetId '{cmd.sheet_id}' not found")
            placements = [vp for vp in sh.view_placements if vp.view_id != cmd.view_id]
            els[cmd.sheet_id] = sh.model_copy(update={"view_placements": placements})

        case SetSheetTitleblockCmd():
            sh = els.get(cmd.sheet_id)
            if not isinstance(sh, SheetElem):
                raise ValueError(f"SetSheetTitleblock: sheetId '{cmd.sheet_id}' not found")
            els[cmd.sheet_id] = sh.model_copy(update={"titleblock_type_id": cmd.titleblock_type_id})

        case UpdateSheetMetadataCmd():
            sh = els.get(cmd.sheet_id)
            if not isinstance(sh, SheetElem):
                raise ValueError(f"UpdateSheetMetadata: sheetId '{cmd.sheet_id}' not found")
            current = sh.metadata
            patch = cmd.metadata
            updated_meta = current.model_copy(
                update={
                    k: v
                    for k, v in {
                        "project_name": patch.get("projectName"),
                        "drawn_by": patch.get("drawnBy"),
                        "checked_by": patch.get("checkedBy"),
                        "date": patch.get("date"),
                        "revision": patch.get("revision"),
                    }.items()
                    if v is not None
                }
            )
            els[cmd.sheet_id] = sh.model_copy(update={"metadata": updated_meta})

        case CreateWindowLegendViewCmd():
            els[cmd.legend_id] = WindowLegendViewElem(
                kind="window_legend_view",
                id=cmd.legend_id,
                name=cmd.name,
                scope=cmd.scope,
                sortBy=cmd.sort_by,
                parentSheetId=cmd.parent_sheet_id,
            )

        # -----------------------------------------------------------------
        # VIE-V3-02 — Drafting view + callout + cut-profile + view-break
        # -----------------------------------------------------------------

        case CreateDraftingViewCmd():
            if cmd.view_id in els:
                raise ValueError(f"duplicate element id '{cmd.view_id}'")
            els[cmd.view_id] = ViewElem(
                kind="view",
                id=cmd.view_id,
                name=cmd.name,
                subKind="drafting",
                scale=float(cmd.scale),
            )

        case CreateViewCalloutCmd():
            if cmd.callout_view_id in els:
                raise ValueError(f"duplicate element id '{cmd.callout_view_id}'")
            parent = els.get(cmd.parent_view_id)
            if parent is None:
                raise ValueError(f"CreateCallout.parentViewId '{cmd.parent_view_id}' not found")
            els[cmd.callout_view_id] = ViewElem(
                kind="view",
                id=cmd.callout_view_id,
                name=cmd.name,
                subKind="callout",
                parentViewId=cmd.parent_view_id,
                clipRectInParent=cmd.clip_rect,
                scale=float(cmd.scale),
            )

        case SetElementOverrideCmd():
            view = els.get(cmd.view_id)
            if not isinstance(view, ViewElem):
                raise ValueError("SetElementOverride.viewId must reference a 'view' element")
            existing = [o for o in view.element_overrides if o.category_or_id != cmd.category_or_id]
            existing.append(
                ElementOverrideSpec(
                    categoryOrId=cmd.category_or_id,
                    alternateRender=cmd.alternate_render,
                )
            )
            els[cmd.view_id] = view.model_copy(update={"element_overrides": existing})

        case AddViewBreakCmd():
            if cmd.width_mm <= 0:
                raise ValueError("AddViewBreak.widthMM must be > 0")
            view = els.get(cmd.view_id)
            if not isinstance(view, ViewElem):
                raise ValueError("AddViewBreak.viewId must reference a 'view' element")
            new_break = ViewBreakSpec(axisMM=cmd.axis_mm, widthMM=cmd.width_mm)
            updated_breaks = sorted(
                list(view.breaks) + [new_break],
                key=lambda b: b.axis_mm,
            )
            els[cmd.view_id] = view.model_copy(update={"breaks": updated_breaks})

        case RemoveViewBreakCmd():
            view = els.get(cmd.view_id)
            if not isinstance(view, ViewElem):
                raise ValueError("RemoveViewBreak.viewId must reference a 'view' element")
            updated_breaks = [b for b in view.breaks if b.axis_mm != cmd.axis_mm]
            els[cmd.view_id] = view.model_copy(update={"breaks": updated_breaks})

        # F-102 — per-element hide/unhide in plan views
        case HideElementInViewCmd():
            view = els.get(cmd.plan_view_id)
            if not isinstance(view, PlanViewElem):
                raise ValueError(f"hideElementInView: {cmd.plan_view_id!r} is not a plan_view")
            updated = list(view.hidden_element_ids)
            if cmd.element_id not in updated:
                updated.append(cmd.element_id)
            els[cmd.plan_view_id] = view.model_copy(update={"hidden_element_ids": updated})

        case UnhideElementInViewCmd():
            view = els.get(cmd.plan_view_id)
            if not isinstance(view, PlanViewElem):
                raise ValueError(f"unhideElementInView: {cmd.plan_view_id!r} is not a plan_view")
            updated = [eid for eid in view.hidden_element_ids if eid != cmd.element_id]
            els[cmd.plan_view_id] = view.model_copy(update={"hidden_element_ids": updated})

        # -----------------------------------------------------------------
        # VIE-V3-03 — View templates v3 (create / update / apply / unbind / delete)
        # -----------------------------------------------------------------

        case CreateViewTemplateCmd():
            if cmd.template_id in els:
                raise ValueError(f"duplicate element id '{cmd.template_id}'")
            els[cmd.template_id] = ViewTemplateElem(
                kind="view_template",
                id=cmd.template_id,
                name=cmd.name,
                scale=cmd.scale,
                detail_level=cmd.detail_level,
                element_overrides=list(cmd.element_overrides),
                phase=cmd.phase,
                phase_filter=cmd.phase_filter,
                template_control_matrix=normalize_view_template_control_matrix(
                    cmd.template_control_matrix
                ),
            )

        case UpdateViewTemplateCmd():
            tpl = els.get(cmd.template_id)
            if not isinstance(tpl, ViewTemplateElem):
                raise ValueError("UpdateViewTemplate.templateId must reference a view_template")
            patch: dict[str, Any] = {}
            if cmd.name is not None:
                patch["name"] = cmd.name
            if cmd.scale is not None:
                patch["scale"] = cmd.scale
            if cmd.detail_level is not None:
                patch["detail_level"] = cmd.detail_level
            if cmd.element_overrides is not None:
                patch["element_overrides"] = list(cmd.element_overrides)
            if cmd.phase is not None:
                patch["phase"] = cmd.phase
            if cmd.phase_filter is not None:
                patch["phase_filter"] = cmd.phase_filter
            if "template_control_matrix" in cmd.model_fields_set:
                patch["template_control_matrix"] = normalize_view_template_control_matrix(
                    cmd.template_control_matrix,
                    base=tpl.template_control_matrix,
                )
            updated_tpl = tpl.model_copy(update=patch)
            els[cmd.template_id] = updated_tpl
            # Propagate non-None template fields to all bound views
            for elem in list(els.values()):
                if not isinstance(elem, PlanViewElem):
                    continue
                if elem.template_id != cmd.template_id:
                    continue
                view_patch = _view_template_plan_patch(updated_tpl)
                if view_patch:
                    els[elem.id] = elem.model_copy(update=view_patch)

        case ApplyViewTemplateCmd():
            view_el = els.get(cmd.view_id)
            if not isinstance(view_el, PlanViewElem):
                raise ValueError("ApplyViewTemplate.viewId must reference a plan_view")
            tpl_el = els.get(cmd.template_id)
            if not isinstance(tpl_el, ViewTemplateElem):
                raise ValueError("ApplyViewTemplate.templateId must reference a view_template")
            view_patch: dict[str, Any] = {"template_id": cmd.template_id}
            view_patch.update(_view_template_plan_patch(tpl_el))
            els[cmd.view_id] = view_el.model_copy(update=view_patch)

        case UnbindViewTemplateCmd():
            view_el = els.get(cmd.view_id)
            if not isinstance(view_el, PlanViewElem):
                raise ValueError("UnbindViewTemplate.viewId must reference a plan_view")
            els[cmd.view_id] = view_el.model_copy(update={"template_id": None})

        case DeleteViewTemplateCmd():
            if cmd.template_id not in els:
                raise ValueError(f"DeleteViewTemplate.templateId '{cmd.template_id}' not found")
            if not isinstance(els[cmd.template_id], ViewTemplateElem):
                raise ValueError("DeleteViewTemplate.templateId must reference a view_template")
            del els[cmd.template_id]
            # Implicitly unbind all views that reference this template
            for elem in list(els.values()):
                if isinstance(elem, PlanViewElem) and elem.template_id == cmd.template_id:
                    els[elem.id] = elem.model_copy(update={"template_id": None})

        # ------------------------------------------------------------------
        # TOP-V3-01 — Toposolid handlers
        # ------------------------------------------------------------------
        case _:
            return False
    return True
