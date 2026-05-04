from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field, TypeAdapter
from sqlalchemy import delete, desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from bim_ai.agent_evidence_review_loop import agent_review_actions_v1, bcf_topics_index_v1
from bim_ai.codes import BUILDING_PRESETS
from bim_ai.commands import Command
from bim_ai.constraints import evaluate
from bim_ai.db import SessionMaker, get_session
from bim_ai.document import Document
from bim_ai.elements import BcfElem, Element, LevelElem, PlanViewElem
from bim_ai.engine import (
    bundle_replay_diagnostics,
    clone_document,
    compute_delta_wire,
    diff_undo_cmds,
    replay_bundle_diagnostics_for_outcome,
    try_commit,
    try_commit_bundle,
)
from bim_ai.evidence_manifest import (
    agent_evidence_closure_hints,
    deterministic_3d_view_evidence_manifest,
    deterministic_plan_view_evidence_manifest,
    deterministic_section_cut_evidence_manifest,
    deterministic_sheet_evidence_manifest,
    evidence_agent_follow_through_v1,
    evidence_closure_review_v1,
    evidence_lifecycle_signal_v1,
    evidence_package_semantic_digest_sha256,
    expected_screenshot_captures,
    export_link_map,
    plan_view_wire_index,
)
from bim_ai.export_gltf import build_visual_export_manifest, document_to_glb_bytes, document_to_gltf
from bim_ai.export_ifc import export_ifc_model_step
from bim_ai.hub import Hub
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload, minimal_empty_ifc_skeleton
from bim_ai.model_summary import compute_model_summary
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
    section_cut_projection_wire,
)
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table, list_schedule_ids
from bim_ai.sheet_preview_pdf import sheet_elem_to_pdf_bytes
from bim_ai.sheet_preview_svg import (
    SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1,
    pick_sheet,
    sheet_elem_to_svg,
    sheet_print_raster_placeholder_png_bytes_v1,
    sheet_svg_utf8_sha256,
)
from bim_ai.tables import (
    CommentRecord,
    ModelRecord,
    ProjectRecord,
    RedoStackRecord,
    UndoStackRecord,
)
from bim_ai.type_material_registry import merged_registry_payload


def get_hub(request: Request) -> Hub:
    return request.app.state.hub


def document_to_wire(doc: Document) -> dict[str, Any]:
    return {
        "revision": doc.revision,
        "elements": {kid: elem.model_dump(by_alias=True) for kid, elem in doc.elements.items()},
    }


async def load_model_row(session: AsyncSession, model_id: UUID) -> ModelRecord | None:
    res = await session.execute(select(ModelRecord).where(ModelRecord.id == model_id))
    return res.scalar_one_or_none()


def violations_wire(elements: dict) -> list[dict[str, Any]]:
    viols_list = evaluate(elements)  # type: ignore[arg-type]
    return [v.model_dump(by_alias=True) for v in viols_list]


async def delete_redos(session: AsyncSession, model_id: UUID, user_id: str) -> None:
    await session.execute(
        delete(RedoStackRecord).where(
            RedoStackRecord.model_id == model_id,
            RedoStackRecord.user_id == user_id,
        ),
    )


api_router = APIRouter(prefix="/api")

PERSPECTIVE_IDS = sorted(
    [
        "architecture",
        "construction",
        "coordination",
        "mep",
        "structure",
        "agent",
    ]
)

WORKSPACE_LAYOUT_PRESET_IDS = [
    "classic",
    "split_plan_3d",
    "split_plan_section",
    "coordination",
    "schedules_focus",
    "agent_review",
]


@api_router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "bim-ai"}


@api_router.get("/schema")
async def api_schema() -> dict[str, Any]:
    return {
        "version": "0.5",
        "commandsUnionSchema": TypeAdapter(Command).json_schema(),
        "elementUnionSchema": TypeAdapter(Element).json_schema(),
        "buildingPresetIds": sorted(BUILDING_PRESETS.keys()),
        "perspectiveIds": PERSPECTIVE_IDS,
        "workspaceLayoutPresetIds": WORKSPACE_LAYOUT_PRESET_IDS,
        "deltaWire": {
            "description": "Emitted on commits and WS type=delta",
            "fields": {"revision": "int", "removedIds": "[string]", "elements": "object"},
        },
    }


@api_router.get("/building-presets")
async def building_presets() -> dict[str, Any]:
    return {"presets": BUILDING_PRESETS}


@api_router.get("/bootstrap")
async def bootstrap(session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    proj_res = await session.execute(select(ProjectRecord))
    projects_out: list[dict[str, Any]] = []
    for p in proj_res.scalars().all():
        mres = await session.execute(select(ModelRecord).where(ModelRecord.project_id == p.id))
        models = [
            {
                "id": str(m.id),
                "slug": m.slug,
                "revision": m.revision,
            }
            for m in mres.scalars().all()
        ]
        projects_out.append({"id": str(p.id), "slug": p.slug, "title": p.title, "models": models})
    return {"projects": projects_out}


class CreateEmptyModelBody(BaseModel):
    slug: str = Field(min_length=1, max_length=128)


@api_router.post("/projects/{project_id}/models")
async def create_empty_model(
    project_id: UUID,
    body: CreateEmptyModelBody,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    proj = await session.get(ProjectRecord, project_id)
    if proj is None:
        raise HTTPException(status_code=404, detail="Project not found")
    mid = uuid4()
    empty_doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    wire = document_to_wire(empty_doc)
    row = ModelRecord(
        id=mid,
        project_id=project_id,
        slug=body.slug,
        revision=empty_doc.revision,
        document=wire,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Model slug already exists for this project",
        ) from None
    return {"id": str(mid), "projectId": str(project_id), "slug": body.slug, "revision": row.revision}


@api_router.get("/models/{model_id}/snapshot")
async def snapshot(model_id: UUID, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {
        "modelId": str(row.id),
        "revision": doc.revision,
        "elements": {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()},
        "violations": violations_wire(doc.elements),
    }


@api_router.get("/models/{model_id}/summary")
async def model_summary(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {
        "modelId": str(model_id),
        "revision": doc.revision,
        "summary": compute_model_summary(doc),
    }


@api_router.get("/models/{model_id}/validate")
async def validate_model_snapshot(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    viols = violations_wire(doc.elements)
    err_ct = sum(1 for x in viols if x.get("severity") == "error")
    block_ct = sum(1 for x in viols if x.get("blocking") is True)
    return {
        "modelId": str(model_id),
        "revision": doc.revision,
        "violations": viols,
        "summary": compute_model_summary(doc),
        "checks": {"errorViolationCount": err_ct, "blockingViolationCount": block_ct},
    }


@api_router.get("/models/{model_id}/evidence-package")
async def evidence_package(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    viols = violations_wire(doc.elements)
    err_ct = sum(1 for x in viols if x.get("severity") == "error")
    block_ct = sum(1 for x in viols if x.get("blocking") is True)
    kinds: dict[str, int] = {}
    for e in doc.elements.values():
        k = getattr(e, "kind", "?")
        kinds[k] = kinds.get(k, 0) + 1

    schedules = [{"id": sid, "name": doc.elements[sid].name} for sid in list_schedule_ids(doc)]

    pv_index = plan_view_wire_index(doc)

    payload: dict[str, Any] = {
        "format": "evidencePackage_v1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "modelId": str(model_id),
        "revision": doc.revision,
        "elementCount": len(doc.elements),
        "countsByKind": kinds,
        "summary": compute_model_summary(doc),
        "validate": {
            "violations": viols,
            "checks": {"errorViolationCount": err_ct, "blockingViolationCount": block_ct},
        },
        "exportLinks": export_link_map(model_id),
        "planViews": pv_index,
        "expectedScreenshotCaptures": expected_screenshot_captures([str(p["id"]) for p in pv_index]),
        "recommendedCapture": [
            {
                "id": "cockpit_plan_3d",
                "workspaceLayoutPreset": "split_plan_3d",
                "planPresentation": ["default", "opening_focus", "room_scheme"],
                "regions": [],
            },
            {
                "id": "schedule_focus",
                "workspaceLayoutPreset": "schedules_focus",
                "planPresentation": ["opening_focus"],
            },
            {
                "id": "sections_and_plan",
                "workspaceLayoutPreset": "split_plan_section",
            },
            {
                "id": "sheet_placeholder",
                "note": "Use sheet canvas coordination layout when wired",
                "workspaceLayoutPreset": "coordination",
            },
        ],
        "scheduleIds": schedules,
        "roomDerivationPreview": room_derivation_preview(doc),
        "roomDerivationCandidates": room_derivation_candidates_review(doc),
        "typeMaterialRegistry": merged_registry_payload(doc),
        "hint": "Use Playwright to capture PNG alongside this JSON per spec §8.3 / §14 Phase A. CI attaches artifacts alongside this bundle.",
        "sheetRasterNote": (
            "Sheet SVG/PDF exports are deterministic server-side. "
            "`GET …/exports/sheet-print-raster.png` returns a hash-correlated 1x1 PNG placeholder "
            f"(`{SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1}`) for CI artifact correlation — "
            "not a visual raster of the sheet; use Playwright captures for baseline PNG diffing."
        ),
    }
    plan_ids = sorted(eid for eid, e in doc.elements.items() if isinstance(e, PlanViewElem))
    first_plan = plan_ids[0] if plan_ids else None
    levels_sorted = sorted(
        (e for e in doc.elements.values() if isinstance(e, LevelElem)),
        key=lambda le: (le.elevation_mm, le.id),
    )
    fl0 = levels_sorted[0].id if levels_sorted else None
    payload["planProjectionWireSample"] = resolve_plan_projection_wire(
        doc,
        plan_view_id=first_plan,
        fallback_level_id=fl0,
        global_plan_presentation="default",
    )
    payload["semanticDigestSha256"] = evidence_package_semantic_digest_sha256(payload)
    digest = str(payload["semanticDigestSha256"])
    payload["semanticDigestPrefix16"] = digest[:16]
    payload["suggestedEvidenceArtifactBasename"] = f"bim-ai-evidence-{digest[:16]}-r{doc.revision}"
    payload["suggestedEvidenceBundleFilenames"] = {
        "format": "evidenceBundleFilenames_v1",
        "evidencePackageJson": f'{payload["suggestedEvidenceArtifactBasename"]}-evidence-package.json',
    }
    payload["recommendedPngEvidenceBackend"] = "playwright_ci"
    payload["svgRasterBackendAvailable"] = True
    payload["deterministicSheetEvidence"] = deterministic_sheet_evidence_manifest(
        model_id=model_id,
        doc=doc,
        evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        semantic_digest_sha256=digest,
        semantic_digest_prefix16=str(payload["semanticDigestPrefix16"]),
    )
    payload["deterministic3dViewEvidence"] = deterministic_3d_view_evidence_manifest(
        model_id=model_id,
        doc=doc,
        evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        semantic_digest_sha256=digest,
        semantic_digest_prefix16=str(payload["semanticDigestPrefix16"]),
    )
    payload["deterministicPlanViewEvidence"] = deterministic_plan_view_evidence_manifest(
        model_id=model_id,
        doc=doc,
        evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        semantic_digest_sha256=digest,
        semantic_digest_prefix16=str(payload["semanticDigestPrefix16"]),
    )
    payload["deterministicSectionCutEvidence"] = deterministic_section_cut_evidence_manifest(
        model_id=model_id,
        doc=doc,
        evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        semantic_digest_sha256=digest,
        semantic_digest_prefix16=str(payload["semanticDigestPrefix16"]),
    )
    payload["evidenceClosureReview_v1"] = evidence_closure_review_v1(
        package_semantic_digest_sha256=digest,
        deterministic_sheet_evidence=payload["deterministicSheetEvidence"],
        deterministic_3d_view_evidence=payload["deterministic3dViewEvidence"],
        deterministic_plan_view_evidence=payload["deterministicPlanViewEvidence"],
        deterministic_section_cut_evidence=payload["deterministicSectionCutEvidence"],
    )
    payload["evidenceLifecycleSignal_v1"] = evidence_lifecycle_signal_v1(
        package_semantic_digest_sha256=digest,
        suggested_evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        evidence_closure_review=payload["evidenceClosureReview_v1"],
    )
    payload["agentEvidenceClosureHints"] = agent_evidence_closure_hints()
    payload["bcfTopicsIndex_v1"] = bcf_topics_index_v1(doc)
    payload["agentReviewActions_v1"] = agent_review_actions_v1(
        doc=doc,
        deterministic_sheet_evidence=payload["deterministicSheetEvidence"],
        deterministic_3d_view_evidence=payload["deterministic3dViewEvidence"],
        deterministic_plan_view_evidence=payload["deterministicPlanViewEvidence"],
        deterministic_section_cut_evidence=payload["deterministicSectionCutEvidence"],
        violations=viols,
    )
    payload["evidenceAgentFollowThrough_v1"] = evidence_agent_follow_through_v1(
        model_id=model_id,
        doc=doc,
        package_semantic_digest_sha256=digest,
        suggested_evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        bcf_topics_index=payload["bcfTopicsIndex_v1"],
        deterministic_sheet_evidence=payload["deterministicSheetEvidence"],
        deterministic_3d_view_evidence=payload["deterministic3dViewEvidence"],
        deterministic_plan_view_evidence=payload["deterministicPlanViewEvidence"],
        deterministic_section_cut_evidence=payload["deterministicSectionCutEvidence"],
    )
    return payload


@api_router.get("/models/{model_id}/room-derivation-candidates")
async def room_derivation_candidates(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return room_derivation_candidates_review(doc)


@api_router.get("/models/{model_id}/registry/type-material")
async def type_material_registry(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return merged_registry_payload(doc)


@api_router.get("/models/{model_id}/projection/plan")
async def projection_plan_wire_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
    plan_view_id: Annotated[str | None, Query(alias="planViewId")] = None,
    fallback_level_id: Annotated[str | None, Query(alias="fallbackLevelId")] = None,
    global_plan_presentation: Annotated[str, Query(alias="globalPresentation")] = "default",
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return plan_projection_wire_from_request(
        doc,
        plan_view_id=plan_view_id,
        fallback_level_id=fallback_level_id,
        global_plan_presentation=global_plan_presentation,
    )


@api_router.get("/models/{model_id}/projection/section/{section_cut_id}")
async def projection_section_wire_route(
    model_id: UUID,
    section_cut_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return section_cut_projection_wire(doc, section_cut_id)


@api_router.get(
    "/models/{model_id}/schedules/{schedule_id}/table",
    response_model=None,
)
async def schedule_derived_table(
    model_id: UUID,
    schedule_id: str,
    session: AsyncSession = Depends(get_session),
    fmt: Annotated[str, Query(alias="format")] = "json",
    columns: Annotated[str | None, Query(alias="columns")] = None,
    include_schedule_totals_csv: Annotated[bool, Query(alias="includeScheduleTotalsCsv")] = False,
) -> dict[str, Any] | PlainTextResponse:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    try:
        payload = derive_schedule_table(doc, schedule_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if fmt.strip().lower() == "csv":
        export_payload = payload
        if columns and columns.strip():
            wanted = [c.strip() for c in columns.split(",") if c.strip()]
            if wanted:
                export_payload = schedule_payload_with_column_subset(payload, wanted)
        csv_body = schedule_payload_to_csv(
            export_payload,
            include_totals_csv=include_schedule_totals_csv,
        )
        safe = "".join(ch for ch in schedule_id if ch.isalnum() or ch in ("-", "_")) or "schedule"
        return PlainTextResponse(
            csv_body,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe}.csv"'},
        )
    out = payload
    if columns and columns.strip():
        wanted = [c.strip() for c in columns.split(",") if c.strip()]
        if wanted:
            out = schedule_payload_with_column_subset(payload, wanted)
    return out


@api_router.get("/models/{model_id}/exports/gltf-manifest")
async def export_gltf_manifest(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_visual_export_manifest(doc)


@api_router.get("/models/{model_id}/exports/model.gltf")
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


@api_router.get("/models/{model_id}/exports/model.glb")
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


@api_router.get("/models/{model_id}/exports/sheet-preview.svg")
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


@api_router.get("/models/{model_id}/exports/sheet-preview.pdf")
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

    fname = "".join(ch for ch in getattr(sh, "id", "") if ch.isalnum() or ch in ("-", "_")) or "sheet"

    return Response(
        content=pdf_blob,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="bim-ai-model-{model_id}-{fname}.pdf"',
            "Cache-Control": "public, max-age=60",
        },
    )


@api_router.get("/models/{model_id}/exports/sheet-print-raster.png")
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
    blob = sheet_print_raster_placeholder_png_bytes_v1(svg)
    svg_sha = sheet_svg_utf8_sha256(svg)
    return Response(
        content=blob,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=60",
            "X-Bim-Ai-Sheet-Print-Raster-Contract": SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1,
            "X-Bim-Ai-Sheet-Svg-Sha256": svg_sha,
        },
    )


@api_router.get("/models/{model_id}/exports/ifc-manifest")
async def export_ifc_manifest_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_ifc_exchange_manifest_payload(doc)


@api_router.get("/models/{model_id}/exports/ifc-empty-skeleton.ifc")
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


@api_router.get("/models/{model_id}/exports/model.ifc")
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


@api_router.get("/models/{model_id}/exports/bcf-topics-json")
async def export_bcf_topics(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    topics = [
        e.model_dump(by_alias=True) for e in doc.elements.values() if isinstance(e, BcfElem)
    ]
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


@api_router.post("/models/{model_id}/imports/bcf-topics-json")
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

    await hub.broadcast_json(
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


@api_router.get("/models/{model_id}/command-log")
async def command_log_full(
    model_id: UUID,
    limit: int = 120,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    safe_limit = min(max(limit, 1), 250)
    res = await session.execute(
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(desc(UndoStackRecord.id))
        .limit(safe_limit),
    )
    rows = res.scalars().all()

    entries: list[dict[str, Any]] = []
    for u in rows:
        entries.append(
            {
                "id": u.id,
                "userId": u.user_id,
                "revisionAfter": u.revision_after,
                "createdAt": u.created_at.isoformat(),
                "appliedCommands": list(u.forward_commands),
            }
        )

    return {"modelId": str(row.id), "entries": entries}


class CommandEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    command: dict[str, Any]
    client_op_id: str | None = Field(default=None, alias="clientOpId")
    user_id: str | None = Field(default="local-dev", alias="userId")


@api_router.post("/models/{model_id}/commands")
async def apply_command(
    model_id: UUID,
    body: CommandEnvelope,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"

    baseline_doc = Document.model_validate(row.document)
    doc_before = clone_document(baseline_doc)

    try:
        ok, new_doc, _cmd_obj, violations, code = try_commit(baseline_doc, body.command)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid command: {exc}") from exc

    if not ok or new_doc is None:
        viols_wire = [v.model_dump(by_alias=True) for v in violations]
        raise HTTPException(status_code=409, detail={"reason": code, "violations": viols_wire})

    undo_cmds = diff_undo_cmds(doc_before, new_doc)
    await delete_redos(session, model_id, uid)

    undo_row = UndoStackRecord(
        model_id=model_id,
        user_id=uid,
        revision_after=new_doc.revision,
        forward_commands=[body.command],
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

    await hub.broadcast_json(
        model_id,
        {"type": "delta", "modelId": str(model_id), **delta},
    )

    elems_out = wire_doc["elements"]
    viols_wire = violations_wire(new_doc.elements)

    return {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommand": body.command,
        "clientOpId": body.client_op_id,
        "delta": delta,
    }


@api_router.post("/models/{model_id}/commands/dry-run")
async def dry_run_command(
    model_id: UUID,
    body: CommandEnvelope,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    baseline_doc = Document.model_validate(row.document)
    baseline_summary = compute_model_summary(baseline_doc)

    try:
        ok, new_doc, _cmd_obj, violations, code = try_commit(baseline_doc, body.command)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid command: {exc}") from exc

    viols_wire = [v.model_dump(by_alias=True) for v in violations]

    if not ok or new_doc is None:
        return {
            "ok": False,
            "modelId": str(model_id),
            "reason": code,
            "violations": viols_wire,
            "summaryBefore": baseline_summary,
            "summaryAfter": None,
            "wouldRevision": None,
            "appliedCommandPreview": body.command,
        }

    return {
        "ok": True,
        "modelId": str(model_id),
        "reason": code,
        "violations": viols_wire,
        "summaryBefore": baseline_summary,
        "summaryAfter": compute_model_summary(new_doc),
        "wouldRevision": new_doc.revision,
        "appliedCommandPreview": body.command,
    }


class BundleEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    commands: list[dict[str, Any]]

    user_id: str | None = Field(default=None, alias="userId")

    client_op_id: str | None = Field(default=None, alias="clientOpId")


@api_router.post("/models/{model_id}/commands/bundle")
async def apply_command_bundle(
    model_id: UUID,
    body: BundleEnvelope,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"
    baseline_doc = Document.model_validate(row.document)
    doc_before = clone_document(baseline_doc)

    try:
        ok, new_doc, _cmds, violations, code = try_commit_bundle(baseline_doc, body.commands)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid bundle: {exc}") from exc

    if not ok or new_doc is None:
        viols_wire = [v.model_dump(by_alias=True) for v in violations]

        raise HTTPException(
            status_code=409,
            detail={
                "reason": code,
                "violations": viols_wire,
                "replayDiagnostics": replay_bundle_diagnostics_for_outcome(
                    baseline_doc,
                    body.commands,
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
        forward_commands=body.commands,
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

    await hub.broadcast_json(
        model_id,
        {"type": "delta", "modelId": str(model_id), **delta},
    )

    elems_out = wire_doc["elements"]

    viols_wire = violations_wire(new_doc.elements)

    return {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommands": body.commands,
        "clientOpId": body.client_op_id,
        "delta": delta,
        "replayDiagnostics": bundle_replay_diagnostics(body.commands),
    }


@api_router.post("/models/{model_id}/commands/bundle/dry-run")
async def dry_run_command_bundle(
    model_id: UUID,
    body: BundleEnvelope,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    baseline_doc = Document.model_validate(row.document)
    baseline_summary = compute_model_summary(baseline_doc)

    try:
        ok, new_doc, _cmds, violations, code = try_commit_bundle(baseline_doc, body.commands)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid bundle: {exc}") from exc

    viols_wire = [v.model_dump(by_alias=True) for v in violations]

    if not ok or new_doc is None:
        return {
            "ok": False,
            "modelId": str(model_id),
            "reason": code,
            "violations": viols_wire,
            "summaryBefore": baseline_summary,
            "summaryAfter": None,
            "wouldRevision": None,
            "appliedCommandsPreview": body.commands,
            "replayDiagnostics": replay_bundle_diagnostics_for_outcome(
                baseline_doc,
                body.commands,
                outcome_code=code,
            ),
        }

    return {
        "ok": True,
        "modelId": str(model_id),
        "reason": code,
        "violations": viols_wire,
        "summaryBefore": baseline_summary,
        "summaryAfter": compute_model_summary(new_doc),
        "wouldRevision": new_doc.revision,
        "appliedCommandsPreview": body.commands,
        "replayDiagnostics": bundle_replay_diagnostics(body.commands),
    }


class UndoRedoEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str | None = Field(default="local-dev", alias="userId")


async def _commit_doc_and_broadcast(
    *,
    session: AsyncSession,
    hub: Hub,
    row: ModelRecord,
    model_uuid: UUID,
    doc_before: Document,
    new_doc: Document,
    client_op_id: str | None,
) -> dict[str, Any]:
    wire_doc = document_to_wire(new_doc)
    row.document = wire_doc  # type: ignore[assignment]
    row.revision = new_doc.revision
    await session.commit()

    delta = compute_delta_wire(doc_before, new_doc)
    if client_op_id:
        delta["clientOpId"] = client_op_id
    await hub.broadcast_json(model_uuid, {"type": "delta", "modelId": str(model_uuid), **delta})

    elems_out = wire_doc["elements"]
    viols_wire = violations_wire(new_doc.elements)

    return {
        "ok": True,
        "modelId": str(model_uuid),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "delta": delta,
    }


@api_router.post("/models/{model_id}/undo")
async def undo_model(
    model_id: UUID,
    body: UndoRedoEnvelope,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"
    undo_res = await session.execute(
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id, UndoStackRecord.user_id == uid)
        .order_by(desc(UndoStackRecord.id))
        .limit(1),
    )
    undo_row = undo_res.scalar_one_or_none()
    if undo_row is None:
        raise HTTPException(status_code=400, detail="Nothing to undo")

    current = Document.model_validate(row.document)

    baseline = clone_document(current)

    ok, new_doc, _cmds, violations, code = try_commit_bundle(current, list(undo_row.undo_commands))

    if not ok or new_doc is None:
        viols_wire = [v.model_dump(by_alias=True) for v in violations]
        undo_cmds_raw = list(undo_row.undo_commands)
        raise HTTPException(
            status_code=409,
            detail={
                "reason": code,
                "violations": viols_wire,
                "replayDiagnostics": replay_bundle_diagnostics_for_outcome(
                    current,
                    undo_cmds_raw,
                    outcome_code=code,
                ),
            },
        )

    await session.delete(undo_row)
    session.add(
        RedoStackRecord(
            model_id=model_id,
            user_id=uid,
            revision_after=new_doc.revision,
            forward_commands=list(undo_row.forward_commands),
            created_at=datetime.now(UTC),
        ),
    )

    await session.flush()
    out = await _commit_doc_and_broadcast(
        session=session,
        hub=hub,
        row=row,
        model_uuid=model_id,
        doc_before=baseline,
        new_doc=new_doc,
        client_op_id=None,
    )
    out["action"] = "undo"
    return out


@api_router.post("/models/{model_id}/redo")
async def redo_model(
    model_id: UUID,
    body: UndoRedoEnvelope,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"
    redo_res = await session.execute(
        select(RedoStackRecord)
        .where(RedoStackRecord.model_id == model_id, RedoStackRecord.user_id == uid)
        .order_by(desc(RedoStackRecord.id))
        .limit(1),
    )
    redo_row = redo_res.scalar_one_or_none()
    if redo_row is None:
        raise HTTPException(status_code=400, detail="Nothing to redo")

    current = Document.model_validate(row.document)
    baseline = clone_document(current)

    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        current,
        list(redo_row.forward_commands),
    )

    if not ok or new_doc is None:
        viols_wire = [v.model_dump(by_alias=True) for v in violations]
        forward_cmds = list(redo_row.forward_commands)
        raise HTTPException(
            status_code=409,
            detail={
                "reason": code,
                "violations": viols_wire,
                "replayDiagnostics": replay_bundle_diagnostics_for_outcome(
                    current,
                    forward_cmds,
                    outcome_code=code,
                ),
            },
        )

    undo_cmds = diff_undo_cmds(baseline, new_doc)

    await session.delete(redo_row)
    session.add(
        UndoStackRecord(
            model_id=model_id,
            user_id=uid,
            revision_after=new_doc.revision,
            forward_commands=list(redo_row.forward_commands),
            undo_commands=undo_cmds,
            created_at=datetime.now(UTC),
        ),
    )

    await session.flush()

    out = await _commit_doc_and_broadcast(
        session=session,
        hub=hub,
        row=row,
        model_uuid=model_id,
        doc_before=baseline,
        new_doc=new_doc,
        client_op_id=None,
    )
    out["action"] = "redo"
    return out


@api_router.get("/models/{model_id}/activity")
async def model_activity(
    model_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    res = await session.execute(
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(desc(UndoStackRecord.id))
        .limit(50),
    )
    rows = res.scalars().all()
    events: list[dict[str, Any]] = []

    for u in rows:
        forwards = list(u.forward_commands)
        summaries: list[str] = []
        for cmd in forwards:
            if isinstance(cmd, dict):
                summaries.append(str(cmd.get("type", "?")))
            else:
                summaries.append("?")

        events.append(
            {
                "id": u.id,
                "userId": u.user_id,
                "revisionAfter": u.revision_after,
                "createdAt": u.created_at.isoformat(),
                "commandTypes": summaries,
            },
        )

    return {"modelId": str(model_id), "events": events}


class CommentCreateBody(BaseModel):
    model_config = {"populate_by_name": True}

    user_display: str = Field(alias="userDisplay")

    body: str
    element_id: str | None = Field(default=None, alias="elementId")
    level_id: str | None = Field(default=None, alias="levelId")

    anchor_x_mm: float | None = Field(default=None, alias="anchorXMm")

    anchor_y_mm: float | None = Field(default=None, alias="anchorYMm")


class CommentResolveBody(BaseModel):
    resolved: bool = True


def _wire_comment(row: CommentRecord) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "modelId": str(row.model_id),
        "userDisplay": row.user_display,
        "body": row.body,
        "elementId": row.element_id,
        "levelId": row.level_id,
        "anchorXMm": row.anchor_x_mm,
        "anchorYMm": row.anchor_y_mm,
        "resolved": row.resolved,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }


@api_router.get("/models/{model_id}/comments")
async def list_comments(
    model_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    res = await session.execute(
        select(CommentRecord)
        .where(CommentRecord.model_id == model_id)
        .order_by(desc(CommentRecord.created_at)),
    )
    crs = list(res.scalars().all())

    return {
        "modelId": str(model_id),
        "comments": [_wire_comment(c) for c in crs],
    }


@api_router.post("/models/{model_id}/comments")
async def create_comment(
    model_id: UUID,
    body: CommentCreateBody,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)

    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    cid = uuid4()

    now = datetime.now(UTC)

    crow = CommentRecord(
        id=cid,
        model_id=model_id,
        user_display=body.user_display,
        body=body.body.strip(),
        element_id=body.element_id,
        level_id=body.level_id,
        anchor_x_mm=body.anchor_x_mm,
        anchor_y_mm=body.anchor_y_mm,
        resolved=False,
        created_at=now,
        updated_at=now,
    )

    session.add(crow)

    await session.commit()

    wired = _wire_comment(crow)

    await hub.broadcast_json(
        model_id, {"type": "comment_event", "modelId": str(model_id), "payload": wired}
    )

    return wired


@api_router.patch("/models/{model_id}/comments/{comment_id}")
async def patch_comment(
    model_id: UUID,
    comment_id: UUID,
    body: CommentResolveBody,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:

    row_c = await session.get(CommentRecord, comment_id)

    if row_c is None or row_c.model_id != model_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    row_c.resolved = body.resolved

    row_c.updated_at = datetime.now(UTC)

    session.add(row_c)

    await session.commit()

    wired = _wire_comment(row_c)

    await hub.broadcast_json(
        model_id, {"type": "comment_event", "modelId": str(model_id), "payload": wired}
    )

    return wired


@api_router.get("/models/{model_id}/export/json")
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


@api_router.get("/models/{model_id}/export/ifc")
async def export_model_ifc_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical IFC under /exports/model.ifc."""

    return RedirectResponse(url=f"/api/models/{model_id}/exports/model.ifc", status_code=307)


@api_router.get("/models/{model_id}/export/gltf")
async def export_model_gltf_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical glTF under /exports/model.gltf."""
    return RedirectResponse(
        url=f"/api/models/{model_id}/exports/model.gltf",
        status_code=307,
    )


@api_router.get("/models/{model_id}/export/glb")
async def export_model_glb_redirect(model_id: UUID) -> RedirectResponse:
    """Legacy path → canonical binary glTF under /exports/model.glb."""
    return RedirectResponse(url=f"/api/models/{model_id}/exports/model.glb", status_code=307)


@api_router.get("/models/{model_id}/export/bcf")
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


@api_router.get("/models/{model_id}/export/ids")
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


async def websocket_loop(websocket: WebSocket, model_id: UUID, hub: Hub) -> None:

    sid = str(model_id)

    async with SessionMaker() as session:
        row = await load_model_row(session, model_id)

    await websocket.accept()

    if row is None:
        await websocket.close(code=4404)

        return

    doc = Document.model_validate(row.document)

    hub.subscribe(sid, websocket)

    await websocket.send_json(
        {
            "type": "snapshot",
            "modelId": sid,
            "revision": doc.revision,
            "elements": {k: el.model_dump(by_alias=True) for k, el in doc.elements.items()},
            "violations": violations_wire(doc.elements),
        },
    )

    try:
        while True:
            msg = await websocket.receive_json()

            mt = msg.get("type")

            if mt == "presence_update":
                pid = msg.get("peerId")

                if not isinstance(pid, str) or not pid:
                    continue

                hub.set_peer_id(websocket, pid)

                patch = {str(k): v for k, v in msg.items() if k != "type"}

                hub.touch_presence(sid, pid, patch)

                await hub.broadcast_presence(sid)

            elif mt == "presence":
                # legacy noop relay

                payload = msg.get("payload", {})

                await hub.broadcast_json(
                    sid, {"type": "presence", "modelId": sid, "payload": payload}
                )

    except WebSocketDisconnect:
        pass

    finally:
        hub.unregister(websocket)
