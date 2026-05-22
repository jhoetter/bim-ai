"""IFC, DXF, and material-asset upload routes extracted from routes_api.

Routes mounted here cover ``/api/models/{host_id}/import-ifc``,
``/api/models/{host_id}/import-dxf``, ``/api/models/{host_id}/upload-dxf-file``,
and ``/api/material-assets/validate-upload``.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import (
    ensure_internal_origin,
    ensure_seed_hatches,
    ensure_sun_settings,
    try_commit_bundle,
)
from bim_ai.hub import Hub
from bim_ai.material_image_assets import (
    ImageAssetUpload,
    build_image_asset_from_upload,
)
from bim_ai.routes.deps import document_to_wire, get_hub, load_model_row
from bim_ai.tables import ModelRecord

imports_router = APIRouter()


# ---------------------------------------------------------------------------
# FED-04 — IFC → shadow-model link import
# ---------------------------------------------------------------------------


class ImportIfcBody(BaseModel):
    """FED-04: payload for ``POST /api/models/{host_id}/import-ifc``.

    Either ``file_text`` (inline IFC STEP) or ``file_path`` (server-side path
    readable by the FastAPI process) must be supplied. ``slug`` names the new
    shadow-model row; ``link_name`` is the host-side display name for the
    auto-created ``link_model`` element. Both have sensible defaults so a
    minimal request just sends the IFC bytes.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    file_text: str | None = Field(default=None, alias="fileText")
    file_path: str | None = Field(default=None, alias="filePath")
    slug: str = Field(default="ifc-import", min_length=1, max_length=128)
    link_name: str = Field(default="Linked IFC", alias="linkName")


@imports_router.post("/models/{host_id}/import-ifc")
async def import_ifc_to_shadow_link(
    host_id: UUID,
    body: ImportIfcBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
) -> dict[str, Any]:
    """FED-04: import an IFC file as a brand-new shadow bim-ai model + auto-
    create a ``link_model`` row in the host pointing at it.

    Round-trip: parse IFC → ``authoritativeReplay_v0`` command bundle →
    apply to a fresh ``ModelRecord`` in the same project → run
    ``createLinkModel`` against the host. The shadow model is independent
    from then on (host edits never reach back into it; the host treats its
    elements as read-only renderable context per FED-01).
    """

    from bim_ai.engine import (
        try_apply_kernel_ifc_authoritative_replay_v0,
        try_commit,
    )
    from bim_ai.export_ifc import build_kernel_ifc_authoritative_replay_sketch_v0

    # Resolve host first so we can mirror its project_id onto the shadow.
    host_row = await load_model_row(session, host_id)
    if host_row is None:
        raise HTTPException(status_code=404, detail="Host model not found")

    # Read the IFC text. The endpoint accepts either inline text or a path.
    if body.file_text is not None:
        step_text = body.file_text
    elif body.file_path is not None:
        try:
            with open(body.file_path, encoding="utf-8") as fh:
                step_text = fh.read()
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Cannot read IFC file: {exc}") from exc
    else:
        raise HTTPException(
            status_code=400,
            detail="import-ifc requires either fileText or filePath in the request body",
        )

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step_text)
    if sketch.get("available") is not True:
        raise HTTPException(
            status_code=400,
            detail={
                "reason": "ifc_replay_unavailable",
                "ifcReason": sketch.get("reason"),
            },
        )

    # 1. Create the shadow model row in the host's project.
    shadow_id = uuid4()
    shadow_doc: Document = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(shadow_doc)
    ensure_sun_settings(shadow_doc)
    ensure_seed_hatches(shadow_doc)

    # 2. Apply the replay bundle in-memory.
    ok, replayed_doc, applied_cmds, _viols, code = try_apply_kernel_ifc_authoritative_replay_v0(
        shadow_doc, sketch
    )
    if not ok or replayed_doc is None:
        raise HTTPException(
            status_code=400,
            detail={"reason": "ifc_replay_failed", "code": code},
        )

    # 3. Persist the shadow model.
    shadow_row = ModelRecord(
        id=shadow_id,
        project_id=host_row.project_id,
        slug=body.slug,
        revision=replayed_doc.revision,
        document=document_to_wire(replayed_doc),
    )
    session.add(shadow_row)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Shadow model slug already exists for this project — pass a unique 'slug'",
        ) from None

    # 4. Build a createLinkModel command and apply it to the host.
    suggested_position = {"xMm": 0.0, "yMm": 0.0, "zMm": 0.0}
    host_doc = Document.model_validate(host_row.document)
    create_link = {
        "type": "createLinkModel",
        "name": body.link_name,
        "sourceModelId": str(shadow_id),
        "positionMm": suggested_position,
        "rotationDeg": 0.0,
        "originAlignmentMode": "origin_to_origin",
    }
    try:
        host_ok, new_host_doc, _cmd, host_viols, host_code = try_commit(host_doc, create_link)
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"createLinkModel failed: {exc}") from exc
    if not host_ok or new_host_doc is None:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "reason": host_code,
                "violations": [v.model_dump(by_alias=True) for v in host_viols],
            },
        )

    # The new link_model element id is the only one missing from doc_before.
    new_link_ids = set(new_host_doc.elements.keys()) - set(host_doc.elements.keys())
    if len(new_link_ids) != 1:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Internal: createLinkModel did not produce exactly one new element",
        )
    link_element_id = next(iter(new_link_ids))

    # Persist the host. Keep the undo-stack record so the import is undoable.
    host_row.document = document_to_wire(new_host_doc)  # type: ignore[assignment]
    host_row.revision = new_host_doc.revision
    await session.commit()

    # Broadcast the host's delta so connected clients pick up the link.
    try:
        await hub.publish(
            host_id,
            {
                "type": "delta",
                "modelId": str(host_id),
                "revision": new_host_doc.revision,
            },
        )
    except Exception:
        # Hub failures must not roll back the import.
        pass

    return {
        "linkedModelId": str(shadow_id),
        "linkElementId": link_element_id,
        "suggestedLinkPosition": suggested_position,
        "appliedReplayCommandCount": len(applied_cmds),
        "shadowModelSlug": body.slug,
    }


# ---------------------------------------------------------------------------
# FED-04 — DXF underlay import
# ---------------------------------------------------------------------------


class ImportDxfBody(BaseModel):
    """FED-04: payload for ``POST /api/models/{host_id}/import-dxf``.

    Either ``file_path`` (server-side path readable by the FastAPI process)
    must be supplied. ``level_id`` names the host level the underlay is
    attached to. ``origin_mm`` / ``rotation_deg`` / ``scale_factor`` let the
    caller place the linework; defaults centre on the project origin with
    no rotation.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    file_path: str = Field(alias="filePath")
    level_id: str = Field(alias="levelId")
    name: str = Field(default="DXF Underlay")
    origin_mm: dict[str, float] | None = Field(default=None, alias="originMm")
    origin_alignment_mode: str = Field(default="origin_to_origin", alias="originAlignmentMode")
    unit_override: str | int | None = Field(default=None, alias="unitOverride")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)
    color_mode: str = Field(default="black_white", alias="colorMode")
    custom_color: str | None = Field(default=None, alias="customColor")
    overlay_opacity: float = Field(default=0.5, alias="overlayOpacity", ge=0.0, le=1.0)
    hidden_layer_names: list[str] = Field(default_factory=list, alias="hiddenLayerNames")


@imports_router.post("/models/{host_id}/import-dxf")
async def import_dxf(
    host_id: UUID,
    body: ImportDxfBody,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
) -> dict[str, Any]:
    """FED-04: parse a DXF file and materialise a ``link_dxf`` element.

    The route reads the file at ``body.file_path``, runs the ``ezdxf``
    parser, then dispatches a single ``createLinkDxf`` engine command on
    the host. Returns the new ``link_dxf`` element id so the frontend can
    open ManageLinksDialog with the new entry highlighted.
    """

    from pathlib import Path as _Path

    from bim_ai.dxf_import import (
        collect_dxf_layers,
        dxf_source_metadata,
        parse_dxf_to_linework_with_diagnostics,
    )

    host_row = await load_model_row(session, host_id)
    if host_row is None:
        raise HTTPException(status_code=404, detail="Host model not found")

    dxf_path = _Path(body.file_path)
    if not dxf_path.is_file():
        raise HTTPException(
            status_code=400, detail=f"DXF file not found at filePath: {body.file_path}"
        )

    try:
        linework, unit_scale_to_mm, dxf_import_readback = parse_dxf_to_linework_with_diagnostics(
            dxf_path,
            unit_override=body.unit_override,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"DXF parse failed: {exc}") from exc

    host_doc = Document.model_validate(host_row.document)
    if body.level_id not in host_doc.elements or not isinstance(
        host_doc.elements[body.level_id], LevelElem
    ):
        raise HTTPException(
            status_code=400, detail="levelId must reference an existing Level on the host model"
        )

    create_cmd = {
        "type": "createLinkDxf",
        "name": body.name,
        "levelId": body.level_id,
        "originMm": body.origin_mm or {"xMm": 0.0, "yMm": 0.0},
        "originAlignmentMode": body.origin_alignment_mode,
        "unitOverride": body.unit_override,
        "unitScaleToMm": unit_scale_to_mm,
        "rotationDeg": float(body.rotation_deg),
        "scaleFactor": float(body.scale_factor),
        "linework": linework,
        "dxfLayers": collect_dxf_layers(linework),
        "hiddenLayerNames": body.hidden_layer_names,
        "sourcePath": str(dxf_path),
        "cadReferenceType": "linked",
        "sourceMetadata": {
            **dxf_source_metadata(dxf_path),
            "unitOverride": body.unit_override,
            "unitScaleToMm": unit_scale_to_mm,
            "dxfImportReadbackContract_v1": dxf_import_readback,
        },
        "reloadStatus": "ok",
        "lastReloadMessage": f"Loaded from {dxf_path}",
        "loaded": True,
        "colorMode": body.color_mode,
        "customColor": body.custom_color,
        "overlayOpacity": body.overlay_opacity,
    }
    try:
        ok, new_doc, _cmds, viols, code = try_commit_bundle(host_doc, [create_cmd])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"createLinkDxf failed: {exc}") from exc
    if not ok or new_doc is None:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": code,
                "violations": [v.model_dump(by_alias=True) for v in viols],
            },
        )

    new_link_dxf_ids = [
        eid
        for eid in set(new_doc.elements.keys()) - set(host_doc.elements.keys())
        if getattr(new_doc.elements[eid], "kind", None) == "link_dxf"
    ]
    if len(new_link_dxf_ids) != 1:
        raise HTTPException(
            status_code=500,
            detail="Internal: createLinkDxf did not produce exactly one new link_dxf element",
        )
    link_element_id = new_link_dxf_ids[0]

    host_row.document = document_to_wire(new_doc)  # type: ignore[assignment]
    host_row.revision = new_doc.revision
    await session.commit()

    try:
        await hub.publish(
            host_id,
            {
                "type": "delta",
                "modelId": str(host_id),
                "revision": new_doc.revision,
            },
        )
    except Exception:
        pass

    return {
        "linkedElementId": link_element_id,
        "lineworkCount": len(linework),
        "dxfImportReadbackContract_v1": dxf_import_readback,
    }


@imports_router.post("/models/{host_id}/upload-dxf-file")
async def upload_dxf_file(
    host_id: UUID,
    file: UploadFile,
    levelId: Annotated[str, Form()],
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
    name: Annotated[str, Form()] = "",
    originAlignmentMode: Annotated[str, Form()] = "origin_to_origin",
    unitOverride: Annotated[str | None, Form()] = None,
    colorMode: Annotated[str, Form()] = "black_white",
    customColor: Annotated[str | None, Form()] = None,
    overlayOpacity: Annotated[float, Form()] = 0.5,
    hiddenLayerNames: Annotated[str, Form()] = "",
) -> dict[str, Any]:
    """FED-04b: upload a DXF file directly from the browser and materialise it as link_dxf.

    Accepts multipart/form-data with:
      - file: binary DXF file
      - levelId: ID of the host level
      - name: optional display name (defaults to filename without extension)
    """
    import os
    import tempfile
    from pathlib import Path as _Path

    from bim_ai.dxf_import import collect_dxf_layers, parse_dxf_to_linework_with_diagnostics

    host_row = await load_model_row(session, host_id)
    if host_row is None:
        raise HTTPException(status_code=404, detail="Host model not found")

    # Validate level exists
    host_doc = Document.model_validate(host_row.document)
    if levelId not in host_doc.elements or not isinstance(host_doc.elements[levelId], LevelElem):
        raise HTTPException(status_code=400, detail="levelId must reference an existing Level")

    # Use filename without extension as name if not provided
    display_name = name.strip() or _Path(file.filename or "DXF Underlay").stem

    # Save to temp file, parse, clean up
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        linework, unit_scale_to_mm, dxf_import_readback = parse_dxf_to_linework_with_diagnostics(
            _Path(tmp_path),
            unit_override=unitOverride,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"DXF parse failed: {exc}") from exc
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    hidden_layer_names = [name.strip() for name in hiddenLayerNames.split(",") if name.strip()]

    create_cmd = {
        "type": "createLinkDxf",
        "name": display_name,
        "levelId": levelId,
        "originMm": {"xMm": 0.0, "yMm": 0.0},
        "originAlignmentMode": originAlignmentMode,
        "unitOverride": unitOverride,
        "unitScaleToMm": unit_scale_to_mm,
        "rotationDeg": 0.0,
        "scaleFactor": 1.0,
        "linework": linework,
        "dxfLayers": collect_dxf_layers(linework),
        "hiddenLayerNames": hidden_layer_names,
        "sourcePath": file.filename or display_name,
        "cadReferenceType": "embedded",
        "sourceMetadata": {
            "fileName": file.filename or display_name,
            "sizeBytes": len(content),
            "unitOverride": unitOverride,
            "unitScaleToMm": unit_scale_to_mm,
            "dxfImportReadbackContract_v1": dxf_import_readback,
        },
        "reloadStatus": "embedded",
        "lastReloadMessage": "Embedded CAD import has no reloadable source path",
        "loaded": True,
        "colorMode": colorMode,
        "customColor": customColor,
        "overlayOpacity": overlayOpacity,
    }
    try:
        ok, new_doc, _cmds, viols, code = try_commit_bundle(host_doc, [create_cmd])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not ok or new_doc is None:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": code,
                "violations": [v.model_dump(by_alias=True) for v in viols],
            },
        )

    new_link_dxf_ids = [
        eid
        for eid in set(new_doc.elements.keys()) - set(host_doc.elements.keys())
        if getattr(new_doc.elements[eid], "kind", None) == "link_dxf"
    ]
    if len(new_link_dxf_ids) != 1:
        raise HTTPException(
            status_code=500,
            detail="Internal: createLinkDxf did not produce exactly one new link_dxf element",
        )
    link_element_id = new_link_dxf_ids[0]

    host_row.document = document_to_wire(new_doc)  # type: ignore[assignment]
    host_row.revision = new_doc.revision
    await session.commit()

    try:
        await hub.publish(
            host_id,
            {
                "type": "delta",
                "modelId": str(host_id),
                "revision": new_doc.revision,
            },
        )
    except Exception:
        pass

    return {
        "linkDxfId": link_element_id,
        "name": display_name,
        "dxfImportReadbackContract_v1": dxf_import_readback,
    }


@imports_router.post("/material-assets/validate-upload")
async def validate_material_asset_upload(
    file: UploadFile,
    mapUsageHint: Annotated[str, Form()] = "albedo",
    source: Annotated[str | None, Form()] = None,
    license: Annotated[str | None, Form()] = None,
    provenance: Annotated[str | None, Form()] = None,
) -> dict[str, Any]:
    """MAT-11: validate an uploaded texture map and return image_asset metadata."""

    if mapUsageHint not in {"albedo", "normal", "roughness", "metalness", "height", "opacity"}:
        raise HTTPException(status_code=400, detail="mapUsageHint is not supported")
    content = await file.read()
    try:
        asset = build_image_asset_from_upload(
            ImageAssetUpload(
                filename=file.filename or "texture",
                mime_type=file.content_type or "",
                data=content,
                map_usage_hint=mapUsageHint,  # type: ignore[arg-type]
                source=source,
                license=license,
                provenance=provenance,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return asset.model_dump(by_alias=True)
