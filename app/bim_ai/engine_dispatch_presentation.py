# ruff: noqa: I001

from bim_ai.engine import (
    BrandTemplateElem,
    ColumnElem,
    CommitConceptSeedCmd,
    ConceptSeedElem,
    ConsumeConceptSeedCmd,
    CreateBrandTemplateCmd,
    CreateConceptSeedCmd,
    CreateFrameCmd,
    CreatePresentationCanvasCmd,
    CreateSavedViewCmd,
    DeleteBrandTemplateCmd,
    DeleteFrameCmd,
    DeleteImageUnderlayCmd,
    DeleteSavedViewCmd,
    DetailRegionElem,
    DoorElem,
    DrawDetailRegionCmd,
    FrameElem,
    ImageUnderlayElem,
    ImportImageUnderlayCmd,
    MoveImageUnderlayCmd,
    PresentationCanvasElem,
    ReorderFrameCmd,
    ReorderViewCmd,
    RotateImageUnderlayCmd,
    SavedViewElem,
    ScaleImageUnderlayCmd,
    ToposolidElem,
    UTC,
    UpdateBrandTemplateCmd,
    UpdateColumnCmd,
    UpdateDetailRegionCmd,
    UpdateDoorCmd,
    UpdateFrameCmd,
    UpdatePresentationCanvasCmd,
    UpdateSavedViewCmd,
    UpdateWallCmd,
    UpdateWindowCmd,
    Vec2Mm,
    WallElem,
    WindowElem,
    _ALLOWED_IMAGE_PREFIXES,
    _MAX_SRC_BYTES,
    datetime,
    new_id,
)


def try_apply_presentation_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case UpdateWallCmd():
            import math

            wall = els.get(cmd.id)
            if not isinstance(wall, WallElem):
                raise ValueError(f"updateWall: element {cmd.id!r} is not a wall")
            updates: dict = {}
            if cmd.length_mm is not None:
                dx = wall.end.x_mm - wall.start.x_mm
                dy = wall.end.y_mm - wall.start.y_mm
                current_len = math.sqrt(dx * dx + dy * dy)
                if current_len < 1e-6:
                    raise ValueError("updateWall: cannot set length on a zero-length wall")
                scale = cmd.length_mm / current_len
                updates["end"] = Vec2Mm(
                    x_mm=wall.start.x_mm + dx * scale,
                    y_mm=wall.start.y_mm + dy * scale,
                )
            if cmd.thickness_mm is not None:
                updates["thickness_mm"] = cmd.thickness_mm
            # TOP-V3-04: update site host binding.
            if cmd.site_host_id is not None:
                if not isinstance(els.get(cmd.site_host_id), ToposolidElem):
                    raise ValueError(
                        f"updateWall.siteHostId '{cmd.site_host_id}' does not reference an existing toposolid"
                    )
                updates["site_host_id"] = cmd.site_host_id
            els[cmd.id] = wall.model_copy(update=updates)

        case UpdateDoorCmd():
            door = els.get(cmd.id)
            if not isinstance(door, DoorElem):
                raise ValueError(f"updateDoor: element {cmd.id!r} is not a door")
            updates = {}
            if cmd.width_mm is not None:
                updates["width_mm"] = cmd.width_mm
            els[cmd.id] = door.model_copy(update=updates)

        case UpdateWindowCmd():
            win = els.get(cmd.id)
            if not isinstance(win, WindowElem):
                raise ValueError(f"updateWindow: element {cmd.id!r} is not a window")
            updates = {}
            if cmd.width_mm is not None:
                updates["width_mm"] = cmd.width_mm
            if cmd.sill_height_mm is not None:
                updates["sill_height_mm"] = cmd.sill_height_mm
            if cmd.height_mm is not None:
                updates["height_mm"] = cmd.height_mm
            els[cmd.id] = win.model_copy(update=updates)

        case UpdateColumnCmd():
            col = els.get(cmd.id)
            if not isinstance(col, ColumnElem):
                raise ValueError(f"updateColumn: element {cmd.id!r} is not a column")
            updates = {}
            if cmd.b_mm is not None:
                updates["b_mm"] = cmd.b_mm
            if cmd.h_mm is not None:
                updates["h_mm"] = cmd.h_mm
            els[cmd.id] = col.model_copy(update=updates)

        case DrawDetailRegionCmd():
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            view = els.get(cmd.view_id)
            valid_view_kinds = {"plan_view", "section_cut", "elevation_view", "view", "callout"}
            if view is None or view.kind not in valid_view_kinds:
                raise ValueError(
                    "create_detail_region.viewId must reference a plan/section/elevation/drafting/callout view"
                )
            if len(cmd.vertices) < 2:
                raise ValueError("create_detail_region.vertices must contain at least 2 points")
            els[cmd.id] = DetailRegionElem(
                id=cmd.id,
                viewId=cmd.view_id,
                vertices=cmd.vertices,
                closed=cmd.closed,
                hatchId=cmd.hatch_id,
                lineweightOverride=cmd.lineweight_override,
                phaseCreated=cmd.phase_created,
            )

        case UpdateDetailRegionCmd():
            existing = els.get(cmd.id)
            if existing is None or existing.kind != "detail_region":
                raise ValueError(f"No detail_region element with id '{cmd.id}'")
            patch: dict = {}
            if cmd.vertices is not None:
                patch["vertices"] = cmd.vertices
            if cmd.closed is not None:
                patch["closed"] = cmd.closed
            if cmd.hatch_id is not None:
                patch["hatch_id"] = cmd.hatch_id
            if cmd.lineweight_override is not None:
                patch["lineweight_override"] = cmd.lineweight_override
            if cmd.phase_demolished is not None:
                patch["phase_demolished"] = cmd.phase_demolished
            els[cmd.id] = existing.model_copy(update=patch)

        # -----------------------------------------------------------------------
        # IMP-V3-01 — Image-as-underlay import + manipulation
        # -----------------------------------------------------------------------

        case ImportImageUnderlayCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"ImportImageUnderlay: duplicate element id '{eid}'")
            if not any(cmd.src.startswith(prefix) for prefix in _ALLOWED_IMAGE_PREFIXES):
                raise ValueError(
                    "ImportImageUnderlay: src must be a data URI starting with "
                    "data:image/png, data:image/jpeg, or data:application/pdf"
                )
            if len(cmd.src.encode()) > _MAX_SRC_BYTES:
                raise ValueError("ImportImageUnderlay: src exceeds maximum allowed size of 50 MB")
            els[eid] = ImageUnderlayElem(
                kind="image_underlay",
                id=eid,
                src=cmd.src,
                rectMm=cmd.rect_mm,
                rotationDeg=cmd.rotation_deg,
                opacity=cmd.opacity,
                lockedScale=cmd.locked_scale,
            )

        case MoveImageUnderlayCmd():
            underlay = els.get(cmd.id)
            if not isinstance(underlay, ImageUnderlayElem):
                raise ValueError(f"MoveImageUnderlay: element '{cmd.id}' is not an image_underlay")
            existing_rect = underlay.rect_mm
            new_rect = {
                "xMm": cmd.rect_mm.get("xMm", existing_rect.get("xMm", 0)),
                "yMm": cmd.rect_mm.get("yMm", existing_rect.get("yMm", 0)),
                "widthMm": existing_rect.get("widthMm", cmd.rect_mm.get("widthMm", 0)),
                "heightMm": existing_rect.get("heightMm", cmd.rect_mm.get("heightMm", 0)),
            }
            els[cmd.id] = underlay.model_copy(update={"rect_mm": new_rect})

        case ScaleImageUnderlayCmd():
            underlay = els.get(cmd.id)
            if not isinstance(underlay, ImageUnderlayElem):
                raise ValueError(f"ScaleImageUnderlay: element '{cmd.id}' is not an image_underlay")
            existing_rect = underlay.rect_mm
            new_rect = {
                "xMm": existing_rect.get("xMm", 0),
                "yMm": existing_rect.get("yMm", 0),
                "widthMm": cmd.width_mm,
                "heightMm": cmd.height_mm,
            }
            els[cmd.id] = underlay.model_copy(update={"rect_mm": new_rect})

        case RotateImageUnderlayCmd():
            underlay = els.get(cmd.id)
            if not isinstance(underlay, ImageUnderlayElem):
                raise ValueError(
                    f"RotateImageUnderlay: element '{cmd.id}' is not an image_underlay"
                )
            els[cmd.id] = underlay.model_copy(update={"rotation_deg": cmd.rotation_deg})

        case DeleteImageUnderlayCmd():
            underlay = els.get(cmd.id)
            if not isinstance(underlay, ImageUnderlayElem):
                raise ValueError(
                    f"DeleteImageUnderlay: element '{cmd.id}' is not an image_underlay"
                )
            del els[cmd.id]

        # -----------------------------------------------------------------------
        # CON-V3-02 — concept seed lifecycle
        # -----------------------------------------------------------------------

        case CreateConceptSeedCmd():
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            if not cmd.model_id:
                raise ValueError("create_concept_seed.modelId must be a non-empty string")
            els[cmd.id] = ConceptSeedElem(
                id=cmd.id,
                modelId=cmd.model_id,
                sourceUnderlayId=cmd.source_underlay_id,
                envelopeTokens=cmd.envelope_tokens,
                kernelElementDrafts=cmd.kernel_element_drafts,
                assumptionsLog=cmd.assumptions_log,
                status="draft",
            )

        case CommitConceptSeedCmd():
            existing = els.get(cmd.id)
            if existing is None or existing.kind != "concept_seed":
                raise ValueError(f"commit_concept_seed: no ConceptSeedElem with id '{cmd.id}'")
            if existing.status != "draft":
                raise ValueError(
                    f"commit_concept_seed: seed '{cmd.id}' is already '{existing.status}' "
                    "(must be 'draft')"
                )
            patch_cs: dict = {
                "status": "committed",
                "committed_at": datetime.now(tz=UTC).isoformat(),
            }
            if cmd.envelope_tokens is not None:
                patch_cs["envelope_tokens"] = existing.envelope_tokens + cmd.envelope_tokens
            if cmd.kernel_element_drafts is not None:
                patch_cs["kernel_element_drafts"] = (
                    existing.kernel_element_drafts + cmd.kernel_element_drafts
                )
            if cmd.assumptions_log is not None:
                patch_cs["assumptions_log"] = existing.assumptions_log + cmd.assumptions_log
            els[cmd.id] = existing.model_copy(update=patch_cs)

        case ConsumeConceptSeedCmd():
            existing = els.get(cmd.id)
            if existing is None or existing.kind != "concept_seed":
                raise ValueError(f"consume_concept_seed: no ConceptSeedElem with id '{cmd.id}'")
            if existing.status != "committed":
                raise ValueError(
                    f"consume_concept_seed: seed '{cmd.id}' is '{existing.status}' "
                    "(must be 'committed')"
                )
            els[cmd.id] = existing.model_copy(update={"status": "consumed"})

        # ------------------------------------------------------------------ #
        # OUT-V3-02 — Presentation canvas, frames, saved views                #
        # ------------------------------------------------------------------ #

        case CreatePresentationCanvasCmd():
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            els[cmd.id] = PresentationCanvasElem(
                id=cmd.id,
                name=cmd.name,
            )

        case UpdatePresentationCanvasCmd():
            canvas = els.get(cmd.id)
            if not isinstance(canvas, PresentationCanvasElem):
                raise ValueError(
                    f"update_presentation_canvas: element '{cmd.id}' is not a presentation_canvas"
                )
            patch = {}
            if cmd.name is not None:
                patch["name"] = cmd.name
            els[cmd.id] = canvas.model_copy(update=patch)

        case CreateFrameCmd():
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            canvas = els.get(cmd.presentation_canvas_id)
            if not isinstance(canvas, PresentationCanvasElem):
                raise ValueError(
                    f"create_frame: presentationCanvasId '{cmd.presentation_canvas_id}' "
                    "does not reference a presentation_canvas element"
                )
            els[cmd.id] = FrameElem(
                id=cmd.id,
                presentationCanvasId=cmd.presentation_canvas_id,
                viewId=cmd.view_id,
                positionMm=cmd.position_mm,
                sizeMm=cmd.size_mm,
                caption=cmd.caption,
                brandTemplateId=cmd.brand_template_id,
                sortOrder=cmd.sort_order,
            )
            new_frame_ids = list(canvas.frame_ids) + [cmd.id]
            els[cmd.presentation_canvas_id] = canvas.model_copy(update={"frame_ids": new_frame_ids})

        case UpdateFrameCmd():
            frame = els.get(cmd.id)
            if not isinstance(frame, FrameElem):
                raise ValueError(f"update_frame: element '{cmd.id}' is not a frame")
            patch = {}
            if cmd.caption is not None:
                patch["caption"] = cmd.caption
            if cmd.position_mm is not None:
                patch["position_mm"] = cmd.position_mm
            if cmd.size_mm is not None:
                patch["size_mm"] = cmd.size_mm
            if cmd.sort_order is not None:
                patch["sort_order"] = cmd.sort_order
            els[cmd.id] = frame.model_copy(update=patch)

        case DeleteFrameCmd():
            frame = els.get(cmd.id)
            if not isinstance(frame, FrameElem):
                raise ValueError(f"delete_frame: element '{cmd.id}' is not a frame")
            canvas = els.get(frame.presentation_canvas_id)
            if isinstance(canvas, PresentationCanvasElem):
                new_frame_ids = [fid for fid in canvas.frame_ids if fid != cmd.id]
                els[frame.presentation_canvas_id] = canvas.model_copy(
                    update={"frame_ids": new_frame_ids}
                )
            del els[cmd.id]

        case ReorderFrameCmd():
            frame = els.get(cmd.id)
            if not isinstance(frame, FrameElem):
                raise ValueError(f"reorder_frame: element '{cmd.id}' is not a frame")
            els[cmd.id] = frame.model_copy(update={"sort_order": cmd.new_sort_order})
            canvas_id = frame.presentation_canvas_id
            canvas_frames = [
                (eid, e)
                for eid, e in els.items()
                if isinstance(e, FrameElem) and e.presentation_canvas_id == canvas_id
            ]
            canvas_frames.sort(key=lambda kv: kv[1].sort_order)
            for idx, (fid, f) in enumerate(canvas_frames):
                if f.sort_order != idx:
                    els[fid] = f.model_copy(update={"sort_order": idx})

        case CreateSavedViewCmd():
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            els[cmd.id] = SavedViewElem(
                id=cmd.id,
                baseViewId=cmd.base_view_id,
                name=cmd.name,
                cameraState=cmd.camera_state,
                visibilityOverrides=cmd.visibility_overrides,
                detailLevel=cmd.detail_level,
            )

        case UpdateSavedViewCmd():
            sv = els.get(cmd.id)
            if not isinstance(sv, SavedViewElem):
                raise ValueError(f"update_saved_view: element '{cmd.id}' is not a saved_view")
            patch = {}
            if cmd.name is not None:
                patch["name"] = cmd.name
            if cmd.camera_state is not None:
                patch["camera_state"] = cmd.camera_state
            if cmd.visibility_overrides is not None:
                patch["visibility_overrides"] = cmd.visibility_overrides
            if cmd.detail_level is not None:
                patch["detail_level"] = cmd.detail_level
            if cmd.thumbnail_data_uri is not None:
                patch["thumbnail_data_uri"] = cmd.thumbnail_data_uri
            els[cmd.id] = sv.model_copy(update=patch)

        case DeleteSavedViewCmd():
            sv = els.get(cmd.id)
            if not isinstance(sv, SavedViewElem):
                raise ValueError(f"delete_saved_view: element '{cmd.id}' is not a saved_view")
            del els[cmd.id]

        # ------------------------------------------------------------------ #
        # OUT-V3-03 — BrandTemplate CRUD                                       #
        # ------------------------------------------------------------------ #

        case CreateBrandTemplateCmd():
            import re as _re

            _hex_re = _re.compile(r"^#[0-9a-fA-F]{6}$")
            if not _hex_re.match(cmd.accent_hex):
                raise ValueError(
                    f"create_brand_template.accentHex must be #RRGGBB, got '{cmd.accent_hex}'"
                )
            if not _hex_re.match(cmd.accent_foreground_hex):
                raise ValueError(
                    f"create_brand_template.accentForegroundHex must be #RRGGBB, got '{cmd.accent_foreground_hex}'"
                )
            if cmd.id in els:
                raise ValueError(f"duplicate element id '{cmd.id}'")
            els[cmd.id] = BrandTemplateElem(
                id=cmd.id,
                name=cmd.name,
                accentHex=cmd.accent_hex,
                accentForegroundHex=cmd.accent_foreground_hex,
                typeface=cmd.typeface,
                logoMarkSvgUri=cmd.logo_mark_svg_uri,
                cssOverrideSnippet=cmd.css_override_snippet,
            )

        case UpdateBrandTemplateCmd():
            import re as _re

            _hex_re = _re.compile(r"^#[0-9a-fA-F]{6}$")
            existing = els.get(cmd.id)
            if existing is None or existing.kind != "brand_template":
                raise ValueError(f"No brand_template element with id '{cmd.id}'")
            patch_bt: dict = {}
            if cmd.name is not None:
                patch_bt["name"] = cmd.name
            if cmd.accent_hex is not None:
                if not _hex_re.match(cmd.accent_hex):
                    raise ValueError(
                        f"update_brand_template.accentHex must be #RRGGBB, got '{cmd.accent_hex}'"
                    )
                patch_bt["accent_hex"] = cmd.accent_hex
            if cmd.accent_foreground_hex is not None:
                if not _hex_re.match(cmd.accent_foreground_hex):
                    raise ValueError(
                        f"update_brand_template.accentForegroundHex must be #RRGGBB, got '{cmd.accent_foreground_hex}'"
                    )
                patch_bt["accent_foreground_hex"] = cmd.accent_foreground_hex
            if cmd.typeface is not None:
                patch_bt["typeface"] = cmd.typeface
            if cmd.logo_mark_svg_uri is not None:
                patch_bt["logo_mark_svg_uri"] = cmd.logo_mark_svg_uri
            if cmd.css_override_snippet is not None:
                patch_bt["css_override_snippet"] = cmd.css_override_snippet
            els[cmd.id] = existing.model_copy(update=patch_bt)

        case DeleteBrandTemplateCmd():
            existing = els.get(cmd.id)
            if existing is None or existing.kind != "brand_template":
                raise ValueError(f"No brand_template element with id '{cmd.id}'")
            del els[cmd.id]

        case ReorderViewCmd():
            if cmd.view_id in els:
                els[cmd.view_id] = els[cmd.view_id].model_copy(
                    update={"sort_order": cmd.new_sort_order}
                )
        case _:
            return False
    return True
