from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import BcfElem, BrandTemplateElem
from bim_ai.engine import (
    bundle_replay_diagnostics,
    clone_document,
    compute_delta_wire,
    diff_undo_cmds,
    replay_bundle_diagnostics_for_outcome,
    try_commit_bundle,
)
from bim_ai.export_3mf import (
    THREEMF_PACKAGE_CONTENT_TYPE,
    build_3mf_export_manifest,
    document_to_3mf_bytes,
)
from bim_ai.export_gltf import build_visual_export_manifest, document_to_glb_bytes, document_to_gltf
from bim_ai.export_ifc import export_ifc_model_step
from bim_ai.export_stl import (
    StlExportOptions,
    build_stl_export_manifest,
    document_to_binary_stl_bytes,
    stl_export_options,
)
from bim_ai.hub import Hub
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload, minimal_empty_ifc_skeleton
from bim_ai.routes_deps import (
    delete_redos,
    document_to_wire,
    get_hub,
    load_model_row,
    violations_wire,
)
from bim_ai.sheet_preview_pdf import sheet_elem_to_pdf_bytes
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    SHEET_PRINT_RASTER_STAMP_WIDTH_PX,
    SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX,
    pick_sheet,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_svg_utf8_sha256,
)
from bim_ai.sustainability_lca import sustainability_lca_export_v1
from bim_ai.tables import UndoStackRecord

exports_router = APIRouter()


def _stl_options_from_query(
    *,
    print_profile: str | None,
    include_kinds: str | None,
    exclude_kinds: str | None,
    min_feature_mm: float | None,
) -> StlExportOptions:
    try:
        return stl_export_options(
            print_profile=print_profile,
            include_kinds=include_kinds,
            exclude_kinds=exclude_kinds,
            min_feature_mm=min_feature_mm,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@exports_router.get("/models/{model_id}/exports/gltf-manifest")
async def export_gltf_manifest(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_visual_export_manifest(doc)


@exports_router.get("/models/{model_id}/exports/model.gltf")
async def export_model_gltf_json(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    body = document_to_gltf(doc)
    return JSONResponse(
        content=body,
        media_type="model/gltf+json",
        headers={"Content-Disposition": 'attachment; filename="model.gltf"'},
    )


@exports_router.get("/models/{model_id}/exports/model.glb")
async def export_model_glb_bundle(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    blob = document_to_glb_bytes(doc)
    return Response(
        content=blob,
        media_type="model/gltf-binary",
        headers={
            "Content-Disposition": 'attachment; filename="model.glb"',
            "Cache-Control": "public, max-age=60",
        },
    )


@exports_router.get("/models/{model_id}/exports/stl-manifest")
async def export_stl_manifest(
    model_id: UUID,
    print_profile: Annotated[str | None, Query(alias="printProfile")] = None,
    include_kinds: Annotated[str | None, Query(alias="includeKinds")] = None,
    exclude_kinds: Annotated[str | None, Query(alias="excludeKinds")] = None,
    min_feature_mm: Annotated[float | None, Query(alias="minFeatureMm", ge=0)] = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    options = _stl_options_from_query(
        print_profile=print_profile,
        include_kinds=include_kinds,
        exclude_kinds=exclude_kinds,
        min_feature_mm=min_feature_mm,
    )
    return build_stl_export_manifest(doc, options=options)


@exports_router.get("/models/{model_id}/exports/model.stl")
async def export_model_stl_bundle(
    model_id: UUID,
    print_profile: Annotated[str | None, Query(alias="printProfile")] = None,
    include_kinds: Annotated[str | None, Query(alias="includeKinds")] = None,
    exclude_kinds: Annotated[str | None, Query(alias="excludeKinds")] = None,
    min_feature_mm: Annotated[float | None, Query(alias="minFeatureMm", ge=0)] = None,
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    options = _stl_options_from_query(
        print_profile=print_profile,
        include_kinds=include_kinds,
        exclude_kinds=exclude_kinds,
        min_feature_mm=min_feature_mm,
    )
    blob = document_to_binary_stl_bytes(doc, options=options)
    return Response(
        content=blob,
        media_type="model/stl",
        headers={
            "Content-Disposition": 'attachment; filename="model.stl"',
            "Cache-Control": "public, max-age=60",
        },
    )


@exports_router.get("/models/{model_id}/exports/3mf-manifest")
async def export_3mf_manifest(
    model_id: UUID,
    print_profile: Annotated[str | None, Query(alias="printProfile")] = None,
    include_kinds: Annotated[str | None, Query(alias="includeKinds")] = None,
    exclude_kinds: Annotated[str | None, Query(alias="excludeKinds")] = None,
    min_feature_mm: Annotated[float | None, Query(alias="minFeatureMm", ge=0)] = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    options = _stl_options_from_query(
        print_profile=print_profile,
        include_kinds=include_kinds,
        exclude_kinds=exclude_kinds,
        min_feature_mm=min_feature_mm,
    )
    return build_3mf_export_manifest(doc, options=options)


@exports_router.get("/models/{model_id}/exports/model.3mf")
async def export_model_3mf_bundle(
    model_id: UUID,
    print_profile: Annotated[str | None, Query(alias="printProfile")] = None,
    include_kinds: Annotated[str | None, Query(alias="includeKinds")] = None,
    exclude_kinds: Annotated[str | None, Query(alias="excludeKinds")] = None,
    min_feature_mm: Annotated[float | None, Query(alias="minFeatureMm", ge=0)] = None,
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    options = _stl_options_from_query(
        print_profile=print_profile,
        include_kinds=include_kinds,
        exclude_kinds=exclude_kinds,
        min_feature_mm=min_feature_mm,
    )
    blob = document_to_3mf_bytes(doc, options=options)
    return Response(
        content=blob,
        media_type=THREEMF_PACKAGE_CONTENT_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="model.3mf"',
            "Cache-Control": "public, max-age=60",
        },
    )


@exports_router.get("/models/{model_id}/exports/sheet-preview.svg")
async def sheet_preview_svg_export(
    model_id: UUID,
    sheet_id: Annotated[str | None, Query(alias="sheetId")] = None,
    session: AsyncSession = Depends(get_session),
) -> PlainTextResponse:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    try:
        sh = pick_sheet(doc, sheet_id or None)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlainTextResponse(
        sheet_elem_to_svg(doc, sh),
        media_type="image/svg+xml; charset=utf-8",
        headers={"Cache-Control": "public, max-age=60"},
    )


@exports_router.get("/models/{model_id}/exports/sheet-preview.pdf")
async def sheet_preview_pdf_export(
    model_id: UUID,
    sheet_id: Annotated[str | None, Query(alias="sheetId")] = None,
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    try:
        sh = pick_sheet(doc, sheet_id or None)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    pdf_blob = sheet_elem_to_pdf_bytes(doc, sh)

    fname = (
        "".join(ch for ch in getattr(sh, "id", "") if ch.isalnum() or ch in ("-", "_")) or "sheet"
    )

    return Response(
        content=pdf_blob,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="bim-ai-model-{model_id}-{fname}.pdf"',
            "Cache-Control": "public, max-age=60",
        },
    )


@exports_router.get("/models/{model_id}/exports/sheet-print-raster.png")
async def sheet_print_raster_png_export(
    model_id: UUID,
    sheet_id: Annotated[str | None, Query(alias="sheetId")] = None,
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    try:
        sh = pick_sheet(doc, sheet_id or None)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    svg = sheet_elem_to_svg(doc, sh)
    blob = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    svg_sha = sheet_svg_utf8_sha256(svg)
    png_digest = hashlib.sha256(blob).hexdigest()
    return Response(
        content=blob,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=60",
            "X-Bim-Ai-Sheet-Print-Raster-Contract": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
            "X-Bim-Ai-Sheet-Print-Raster-Full-Raster-Status": FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
            "X-Bim-Ai-Sheet-Svg-Sha256": svg_sha,
            "X-Bim-Ai-Sheet-Print-Raster-Png-Sha256": png_digest,
            "X-Bim-Ai-Sheet-Print-Raster-Width": str(SHEET_PRINT_RASTER_STAMP_WIDTH_PX),
            "X-Bim-Ai-Sheet-Print-Raster-Height": str(SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX),
        },
    )


@exports_router.get("/models/{model_id}/exports/ifc-manifest")
async def export_ifc_manifest_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_ifc_exchange_manifest_payload(doc)


@exports_router.get("/models/{model_id}/exports/sustainability-lca.json")
async def export_sustainability_lca_json(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return JSONResponse(
        content=sustainability_lca_export_v1(doc),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="sustainability-lca.json"'},
    )


@exports_router.get("/models/{model_id}/exports/ifc-empty-skeleton.ifc")
async def export_ifc_skeleton(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> PlainTextResponse:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return PlainTextResponse(
        minimal_empty_ifc_skeleton(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="bim-ai-model-{model_id}-empty.ifc"'
        },
    )


@exports_router.get("/models/{model_id}/exports/model.ifc")
async def export_model_ifc_bundle(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> PlainTextResponse:
    """Canonical IFC artifact; kernel geometries emit IfcWall/IfcSlab when ifcopenshell is installed."""

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    step = export_ifc_model_step(doc)
    return PlainTextResponse(
        step,
        media_type="application/octet-stream",
        headers={"Content-Disposition": 'attachment; filename="model.ifc"'},
    )


@exports_router.get("/models/{model_id}/exports/bcf-topics-json")
async def export_bcf_topics(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    topics = [e.model_dump(by_alias=True) for e in doc.elements.values() if isinstance(e, BcfElem)]
    return {
        "modelId": str(model_id),
        "revision": doc.revision,
        "topics": topics,
    }


class BcfTopicsImportEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    topics: list[dict[str, Any]]
    user_id: str | None = Field(default=None, alias="userId")
    client_op_id: str | None = Field(default=None, alias="clientOpId")


@exports_router.post("/models/{model_id}/imports/bcf-topics-json")
async def import_bcf_topics_json(
    model_id: UUID,
    body: BcfTopicsImportEnvelope,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"
    baseline_doc = Document.model_validate(row.document)
    doc_before = clone_document(baseline_doc)

    commands: list[dict[str, Any]] = []
    batch_seen: set[str] = set()
    for t in body.topics:
        if not isinstance(t, dict):
            continue
        tid_raw = t.get("id")
        tid = str(tid_raw).strip() if tid_raw not in (None, "") else ""
        title = str(t.get("title") or "BCF topic")
        vpref = t.get("viewpointRef") or t.get("viewpoint_ref")
        if tid and tid in baseline_doc.elements:
            continue
        if tid and tid in batch_seen:
            continue
        cmd: dict[str, Any] = {"type": "createBcfTopic", "title": title}
        if tid:
            cmd["id"] = tid
            batch_seen.add(tid)
        if vpref:
            cmd["viewpointRef"] = str(vpref)
        commands.append(cmd)

    if not commands:
        return {
            "ok": True,
            "modelId": str(model_id),
            "appliedTopics": 0,
            "revision": baseline_doc.revision,
            "skippedDuplicates": True,
        }

    try:
        ok, new_doc, _cmds, violations, code = try_commit_bundle(baseline_doc, commands)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid BCF import: {exc}") from exc

    if not ok or new_doc is None:
        viols_wire = [v.model_dump(by_alias=True) for v in violations]

        raise HTTPException(
            status_code=409,
            detail={
                "reason": code,
                "violations": viols_wire,
                "replayDiagnostics": replay_bundle_diagnostics_for_outcome(
                    baseline_doc,
                    commands,
                    outcome_code=code,
                ),
            },
        )

    undo_cmds = diff_undo_cmds(doc_before, new_doc)

    await delete_redos(session, model_id, uid)

    undo_row = UndoStackRecord(
        model_id=model_id,
        user_id=uid,
        revision_after=new_doc.revision,
        forward_commands=commands,
        undo_commands=undo_cmds,
        created_at=datetime.now(UTC),
    )

    session.add(undo_row)

    wire_doc = document_to_wire(new_doc)

    row.document = wire_doc  # type: ignore[assignment]
    row.revision = new_doc.revision

    await session.commit()

    delta = compute_delta_wire(doc_before, new_doc)

    if body.client_op_id:
        delta["clientOpId"] = body.client_op_id

    await hub.publish(
        model_id,
        {"type": "delta", "modelId": str(model_id), **delta},
    )

    elems_out = wire_doc["elements"]

    viols_wire = violations_wire(new_doc.elements)

    return {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "appliedTopics": len(commands),
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommands": commands,
        "clientOpId": body.client_op_id,
        "delta": delta,
        "replayDiagnostics": bundle_replay_diagnostics(commands),
    }


# ---------------------------------------------------------------------------
# Legacy export redirects / compatibility aliases
# ---------------------------------------------------------------------------


@exports_router.get("/models/{model_id}/export/json")
async def export_model_json(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return {
        "modelId": str(model_id),
        "revision": row.revision,
        "document": row.document,
    }


@exports_router.get("/models/{model_id}/export/ifc")
async def export_model_ifc_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical IFC under /exports/model.ifc."""
    return RedirectResponse(url=f"/api/models/{model_id}/exports/model.ifc", status_code=307)


@exports_router.get("/models/{model_id}/export/gltf")
async def export_model_gltf_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical glTF under /exports/model.gltf."""
    return RedirectResponse(url=f"/api/models/{model_id}/exports/model.gltf", status_code=307)


@exports_router.get("/models/{model_id}/export/glb")
async def export_model_glb_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical binary glTF under /exports/model.glb."""
    return RedirectResponse(url=f"/api/models/{model_id}/exports/model.glb", status_code=307)


@exports_router.get("/models/{model_id}/export/stl")
async def export_model_stl_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical STL under /exports/model.stl."""
    return RedirectResponse(url=f"/api/models/{model_id}/exports/model.stl", status_code=307)


@exports_router.get("/models/{model_id}/export/bcf")
async def export_model_bcf(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    topics = [
        elem.model_dump(by_alias=True)
        for elem in doc.elements.values()
        if getattr(elem, "kind", None) == "bcf"
    ]
    return {"modelId": str(model_id), "revision": doc.revision, "topics": topics}


@exports_router.get("/v3/models/{model_id}/export/pdf")
async def export_branded_pdf(
    model_id: UUID,
    brand_template_id: str | None = Query(default=None, alias="brandTemplateId"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """OUT-V3-03: return a BrandedExportBundle JSON for PDF export.

    If brandTemplateId is provided but not found in the model → 404.
    If brandTemplateId is omitted → brandLayer is null.
    """
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    brand_layer: dict[str, Any] | None = None
    if brand_template_id is not None:
        bt_elem = doc.elements.get(brand_template_id)
        if bt_elem is None or bt_elem.kind != "brand_template":
            raise HTTPException(
                status_code=404,
                detail=f"BrandTemplate '{brand_template_id}' not found in model",
            )
        assert isinstance(bt_elem, BrandTemplateElem)
        brand_layer = {
            "accentHex": bt_elem.accent_hex,
            "accentForegroundHex": bt_elem.accent_foreground_hex,
            "typeface": bt_elem.typeface,
            "logoMarkSvgUri": bt_elem.logo_mark_svg_uri,
            "cssOverrideSnippet": bt_elem.css_override_snippet,
        }

    sheets = [
        {"sheetId": elem.id, "name": elem.name}
        for elem in doc.elements.values()
        if getattr(elem, "kind", None) == "sheet"
    ]

    return {
        "schemaVersion": "out-v3.0",
        "format": "pdf",
        "brandTemplateId": brand_template_id,
        "brandLayer": brand_layer,
        "sheets": sheets,
        "invariantCheck": "layer-c-only",
    }


@exports_router.get("/models/{model_id}/export/ids")
async def export_model_ids_report(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    viols = violations_wire(doc.elements)
    rules = [
        elem.model_dump(by_alias=True)
        for elem in doc.elements.values()
        if getattr(elem, "kind", None) == "validation_rule"
    ]
    err_ct = sum(1 for x in viols if x.get("severity") == "error")
    return {
        "modelId": str(model_id),
        "revision": doc.revision,
        "validationRules": rules,
        "violations": viols,
        "checks": {"errorViolationCount": err_ct},
    }
