from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.agent_brief_acceptance_readout import agent_brief_acceptance_readout_v1
from bim_ai.agent_brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.agent_evidence_review_loop import agent_review_actions_v1, bcf_topics_index_v1
from bim_ai.agent_generated_bundle_qa_checklist import (
    agent_generated_bundle_qa_checklist_v1,
)
from bim_ai.agent_review_readout_consistency_closure import (
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.codes import BUILDING_PRESETS
from bim_ai.commands import Command
from bim_ai.db import SessionMaker, get_session
from bim_ai.diff_engine import compute_element_diff
from bim_ai.document import Document
from bim_ai.elements import Element, LevelElem, LinkModelElem, PlanViewElem
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle, BundleResult
from bim_ai.engine import clone_document, ensure_internal_origin, ensure_sun_settings, try_commit_bundle
from bim_ai.agent_loop import (
    AGENT_BACKEND_ENV_VAR,
    AgentIterateRequest,
    AgentIterateResponse,
    generate_patch,
)
from bim_ai.family_catalog_format import (
    load_catalog_by_id,
    load_catalog_index,
)
from bim_ai.evidence_manifest import (
    MINIMAL_PROBE_PNG_BYTES_V1,
    MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    agent_evidence_closure_hints,
    artifact_upload_manifest_v1,
    deterministic_3d_view_evidence_manifest,
    deterministic_plan_view_evidence_manifest,
    deterministic_section_cut_evidence_manifest,
    deterministic_sheet_evidence_manifest,
    evidence_agent_follow_through_v1,
    evidence_baseline_lifecycle_readout_v1,
    evidence_closure_review_v1,
    evidence_diff_ingest_fix_loop_v1,
    evidence_lifecycle_signal_v1,
    evidence_package_digest_invariants_v1,
    evidence_package_semantic_digest_sha256,
    evidence_review_performance_gate_v1,
    expected_screenshot_captures,
    export_link_map,
    merge_committed_png_fixture_baselines_into_evidence_closure_review_v1,
    merge_server_png_byte_ingest_into_evidence_closure_review_v1,
    plan_view_wire_index,
    sheetProductionEvidenceBaseline_v1,
)
from bim_ai.hub import Hub
from bim_ai.link_expansion import expand_links
from bim_ai.model_summary import compute_model_summary
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
    section_cut_projection_wire,
)
from bim_ai.prd_blocking_advisor_matrix import build_prd_blocking_advisor_matrix
from bim_ai.room_color_scheme_override_evidence import (
    build_room_color_scheme_override_evidence_v1,
    roomColourSchemeLegendEvidence_v1,
)
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)
from bim_ai.routes_activity import activity_router
from bim_ai.routes_commands import commands_router
from bim_ai.routes_deps import (
    PERSPECTIVE_IDS,
    WORKSPACE_LAYOUT_PRESET_IDS,
    document_to_wire,
    get_hub,
    load_model_row,
    violations_wire,
)
from bim_ai.routes_exports import exports_router
from bim_ai.routes_sketch import sketch_router
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table, list_schedule_ids
from bim_ai.sheet_preview_svg import SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
from bim_ai.tables import ModelRecord, ProjectRecord, UndoStackRecord
from bim_ai.template_loader import (
    list_templates,
    load_template_snapshot,
    template_exists,
)
from bim_ai.type_material_registry import merged_registry_payload
from bim_ai.v1_acceptance_proof_matrix import build_v1_acceptance_proof_matrix_v1
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1
from bim_ai.api.registry import get_catalog, get_descriptor

api_router = APIRouter(prefix="/api")
api_router.include_router(exports_router)
api_router.include_router(commands_router)
api_router.include_router(activity_router)
api_router.include_router(sketch_router)


# ---------------------------------------------------------------------------
# System routes
# ---------------------------------------------------------------------------


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
    # VIE-06: optional template id (e.g. "residential-eu") to seed the model.
    template_id: str | None = Field(default=None, alias="templateId")


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

    if body.template_id:
        if not template_exists(body.template_id):
            raise HTTPException(status_code=404, detail=f"Template '{body.template_id}' not found")
        try:
            seed_doc = load_template_snapshot(body.template_id)
        except (FileNotFoundError, LookupError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        # Reset revision so the new model starts at 1 regardless of template state.
        seed_doc.revision = 1
    else:
        seed_doc = Document(revision=1, elements={})  # type: ignore[arg-type]

    # KRN-06: every new model has the singleton internal_origin from inception.
    ensure_internal_origin(seed_doc)
    ensure_sun_settings(seed_doc)
    wire = document_to_wire(seed_doc)
    row = ModelRecord(
        id=mid,
        project_id=project_id,
        slug=body.slug,
        revision=seed_doc.revision,
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
    return {
        "id": str(mid),
        "projectId": str(project_id),
        "slug": body.slug,
        "revision": row.revision,
        "templateId": body.template_id,
    }


@api_router.get("/templates")
async def list_template_catalog() -> dict[str, Any]:
    """VIE-06: enumerate built-in project templates."""
    rows = list_templates()
    return {
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "thumbnailUrl": t.thumbnail_url,
            }
            for t in rows
        ]
    }


# ---------------------------------------------------------------------------
# Model read routes
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/snapshot")
async def snapshot(
    model_id: UUID,
    expandLinks: bool = False,  # noqa: N803 — wire-format alias
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    # KRN-06: backfill internal_origin for legacy models that pre-date this WP.
    # Read-only — we don't persist; the next command commit will pick it up.
    ensure_internal_origin(doc)
    ensure_sun_settings(doc)
    elements_wire = {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}
    if expandLinks:
        # FED-01: inline every linked source's elements with provenance markers
        # so renderers can ghost them. Default snapshot omits these to keep the
        # payload small.
        elements_wire = await _expand_host_links(session, doc, elements_wire)
    link_source_revisions = await _resolve_link_source_revisions(session, doc)
    out: dict[str, Any] = {
        "modelId": str(row.id),
        "revision": doc.revision,
        "elements": elements_wire,
        "violations": violations_wire(doc.elements),
    }
    if link_source_revisions:
        # FED-01 polish: per-source current revisions so the UI can render
        # drift badges on pinned links without an extra round-trip.
        out["linkSourceRevisions"] = link_source_revisions
    return out


async def _resolve_link_source_revisions(
    session: AsyncSession, host_doc: Document
) -> dict[str, int]:
    """Look up the current revision of every distinct source UUID referenced
    by a ``link_model`` element in ``host_doc``. Missing sources are omitted
    from the result. Used by the FED-01 drift-badge UI."""

    out: dict[str, int] = {}
    for elem in host_doc.elements.values():
        if not isinstance(elem, LinkModelElem):
            continue
        src_uuid_str = elem.source_model_id
        if src_uuid_str in out:
            continue
        try:
            src_uuid = UUID(src_uuid_str)
        except ValueError:
            continue
        src_row = await load_model_row(session, src_uuid)
        if src_row is None:
            continue
        try:
            src_doc = Document.model_validate(src_row.document)
        except Exception:
            continue
        out[src_uuid_str] = int(src_doc.revision)
    return out


async def _expand_host_links(
    session: AsyncSession,
    host_doc: Document,
    host_elements_wire: dict[str, Any],
) -> dict[str, Any]:
    """FED-01: resolve every ``link_model`` row's source document from DB and
    pass it through ``expand_links`` to inline transformed source elements.

    Sources are loaded at their pinned revision when set (replayed via the
    undo stack), or at their current revision otherwise. Missing sources are
    skipped silently — the host is still authoritative.
    """

    cache: dict[tuple[str, int | None], Document | None] = {}

    async def _load_source(source_uuid_str: str, source_rev: int | None) -> Document | None:
        cache_key = (source_uuid_str, source_rev)
        if cache_key in cache:
            return cache[cache_key]
        try:
            source_uuid = UUID(source_uuid_str)
        except ValueError:
            cache[cache_key] = None
            return None
        src_row = await load_model_row(session, source_uuid)
        if src_row is None:
            cache[cache_key] = None
            return None
        current = Document.model_validate(src_row.document)
        if source_rev is None or source_rev == current.revision:
            cache[cache_key] = current
            return current
        # Replay backwards through the undo stack to land at the requested
        # revision (mirrors the diff endpoint's logic).
        try:
            doc_at = await _document_at_revision(session, source_uuid, current, source_rev)
        except HTTPException:
            cache[cache_key] = None
            return None
        cache[cache_key] = doc_at
        return doc_at

    # Pre-load every link's source synchronously (the providers callable in
    # ``expand_links`` is sync; we resolve up-front).
    for elem in host_doc.elements.values():
        if isinstance(elem, LinkModelElem):
            await _load_source(elem.source_model_id, elem.source_model_revision)

    def _provider(source_uuid_str: str, source_rev: int | None) -> Document | None:
        return cache.get((source_uuid_str, source_rev))

    return expand_links(host_doc, host_elements_wire, _provider)


async def _document_at_revision(
    session: AsyncSession, model_id: UUID, current: Document, target_rev: int
) -> Document:
    """Reconstruct ``current`` rolled back to ``target_rev`` by replaying
    undo bundles in reverse-revision order. Returns a fresh ``Document``;
    the ``revision`` attribute is informational and may not equal
    ``target_rev`` after the engine bumps the counter — element state is
    what matters for diff.
    """
    if target_rev == current.revision:
        return clone_document(current)
    res = await session.execute(
        select(UndoStackRecord)
        .where(
            UndoStackRecord.model_id == model_id,
            UndoStackRecord.revision_after > target_rev,
            UndoStackRecord.revision_after <= current.revision,
        )
        .order_by(desc(UndoStackRecord.revision_after), desc(UndoStackRecord.id))
    )
    rolling = clone_document(current)
    for entry in res.scalars().all():
        ok, new_doc, _cmds, _viols, _code = try_commit_bundle(rolling, list(entry.undo_commands))
        if ok and new_doc is not None:
            rolling = new_doc
        else:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cannot reconstruct historical revision — undo replay failed at "
                    f"revision_after={entry.revision_after}"
                ),
            )
    return rolling


@api_router.get("/models/{model_id}/diff")
async def model_diff(
    model_id: UUID,
    fromRev: Annotated[int | None, Query(ge=1)] = None,  # noqa: N803 — wire-format alias
    toRev: Annotated[int | None, Query(ge=1)] = None,  # noqa: N803
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    current = Document.model_validate(row.document)

    to_rev = toRev if toRev is not None else current.revision
    from_rev = fromRev if fromRev is not None else max(1, to_rev - 1)

    if from_rev > current.revision or to_rev > current.revision:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Revision out of range: model is at revision {current.revision} "
                f"(fromRev={from_rev}, toRev={to_rev})."
            ),
        )

    doc_to = await _document_at_revision(session, model_id, current, to_rev)
    doc_from = await _document_at_revision(session, model_id, current, from_rev)

    elements_from = {k: v.model_dump(by_alias=True) for k, v in doc_from.elements.items()}
    elements_to = {k: v.model_dump(by_alias=True) for k, v in doc_to.elements.items()}

    diff = compute_element_diff(elements_from, elements_to)
    return {
        "modelId": str(model_id),
        "fromRevision": from_rev,
        "toRevision": to_rev,
        **diff,
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
        "expectedScreenshotCaptures": expected_screenshot_captures(
            [str(p["id"]) for p in pv_index]
        ),
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
            "`GET …/exports/sheet-print-raster.png` returns a deterministic 128×112 RGB8 **print-surrogate** PNG "
            f"(`{SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2}`: 96px viewport layout stamp + 16px titleblock "
            "metadata strip + SVG UTF-8 salt) for CI correlation — not a true raster of the sheet SVG; use Playwright "
            "captures for baseline PNG diffing."
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
    payload["advisorSeveritySummary_v1"] = {
        "format": "advisorSeveritySummary_v1",
        "error": sum(1 for x in viols if x.get("severity") == "error"),
        "warning": sum(1 for x in viols if x.get("severity") == "warning"),
        "info": sum(1 for x in viols if x.get("severity") == "info"),
    }
    payload["semanticDigestSha256"] = evidence_package_semantic_digest_sha256(payload)
    digest = str(payload["semanticDigestSha256"])
    payload["semanticDigestPrefix16"] = digest[:16]
    payload["suggestedEvidenceArtifactBasename"] = f"bim-ai-evidence-{digest[:16]}-r{doc.revision}"
    payload["suggestedEvidenceBundleFilenames"] = {
        "format": "evidenceBundleFilenames_v1",
        "evidencePackageJson": f"{payload['suggestedEvidenceArtifactBasename']}-evidence-package.json",
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
    payload["evidenceClosureReview_v1"] = (
        merge_committed_png_fixture_baselines_into_evidence_closure_review_v1(
            merge_server_png_byte_ingest_into_evidence_closure_review_v1(
                evidence_closure_review_v1(
                    package_semantic_digest_sha256=digest,
                    deterministic_sheet_evidence=payload["deterministicSheetEvidence"],
                    deterministic_3d_view_evidence=payload["deterministic3dViewEvidence"],
                    deterministic_plan_view_evidence=payload["deterministicPlanViewEvidence"],
                    deterministic_section_cut_evidence=payload["deterministicSectionCutEvidence"],
                ),
                png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
                expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
            )
        )
    )
    payload["evidenceDiffIngestFixLoop_v1"] = evidence_diff_ingest_fix_loop_v1(
        payload["evidenceClosureReview_v1"]
    )
    payload["evidenceReviewPerformanceGate_v1"] = evidence_review_performance_gate_v1(
        payload["evidenceDiffIngestFixLoop_v1"]
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
        evidence_closure_review=payload["evidenceClosureReview_v1"],
    )
    payload["agentBriefCommandProtocol_v1"] = agent_brief_command_protocol_v1(
        doc=doc,
        proposed_commands=[],
        validation_violations=viols,
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
        violations=viols,
        evidence_closure_review=payload["evidenceClosureReview_v1"],
        evidence_diff_ingest_fix_loop=payload["evidenceDiffIngestFixLoop_v1"],
    )
    payload["artifactUploadManifest_v1"] = artifact_upload_manifest_v1(
        model_id=model_id,
        suggested_evidence_artifact_basename=str(payload["suggestedEvidenceArtifactBasename"]),
        package_semantic_digest_sha256=digest,
        evidence_closure_review=payload["evidenceClosureReview_v1"],
    )
    follow_raw = payload.get("evidenceAgentFollowThrough_v1")
    ref_res = (
        follow_raw.get("evidenceRefResolution_v1")
        if isinstance(follow_raw, dict)
        and isinstance(follow_raw.get("evidenceRefResolution_v1"), dict)
        else None
    )
    payload["agentGeneratedBundleQaChecklist_v1"] = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=payload["agentBriefCommandProtocol_v1"],
        validate=payload["validate"],
        schedule_ids=payload["scheduleIds"],
        export_links=payload["exportLinks"],
        deterministic_sheet_evidence=payload["deterministicSheetEvidence"],
        deterministic_plan_view_evidence=payload["deterministicPlanViewEvidence"],
        evidence_diff_ingest_fix_loop=payload["evidenceDiffIngestFixLoop_v1"],
        evidence_review_performance_gate=payload["evidenceReviewPerformanceGate_v1"],
        evidence_ref_resolution=ref_res,
    )
    payload["agentBriefAcceptanceReadout_v1"] = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=payload["agentBriefCommandProtocol_v1"],
        qa_checklist=payload["agentGeneratedBundleQaChecklist_v1"],
        artifact_upload_manifest=payload.get("artifactUploadManifest_v1"),
        validation_violations=viols,
    )
    payload["evidenceBaselineLifecycleReadout_v1"] = evidence_baseline_lifecycle_readout_v1(
        evidence_closure_review=payload["evidenceClosureReview_v1"],
        evidence_diff_ingest_fix_loop=payload["evidenceDiffIngestFixLoop_v1"],
        evidence_review_performance_gate=payload["evidenceReviewPerformanceGate_v1"],
    )
    payload["agentReviewReadoutConsistencyClosure_v1"] = (
        agent_review_readout_consistency_closure_v1(
            readout_brief_acceptance=payload.get("agentBriefAcceptanceReadout_v1"),
            readout_bundle_qa_checklist=payload.get("agentGeneratedBundleQaChecklist_v1"),
            readout_merge_preflight=None,
            readout_baseline_lifecycle=payload.get("evidenceBaselineLifecycleReadout_v1"),
            readout_browser_rendering_budget=None,
            closure_hints=payload["agentEvidenceClosureHints"],
        )
    )
    payload["v1AcceptanceProofMatrix_v1"] = build_v1_acceptance_proof_matrix_v1(doc)
    payload["v1CloseoutReadinessManifest_v1"] = build_v1_closeout_readiness_manifest_v1()
    payload["prdAdvisorMatrix_v1"] = build_prd_blocking_advisor_matrix()
    scheme_elem = next(
        (e for e in doc.elements.values() if hasattr(e, "kind") and e.kind == "room_color_scheme"),
        None,
    )
    payload["roomColorSchemeOverrideEvidence_v1"] = build_room_color_scheme_override_evidence_v1(
        scheme_elem
    )
    payload["roomColourSchemeLegendEvidence_v1"] = roomColourSchemeLegendEvidence_v1(doc)
    payload["sheetProductionBaseline_v1"] = sheetProductionEvidenceBaseline_v1(doc)
    payload["evidencePackageDigestInvariants_v1"] = evidence_package_digest_invariants_v1(payload)
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


# ---------------------------------------------------------------------------
# Projection routes
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Schedule table route
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# FAM-08 — Family catalog endpoints
# ---------------------------------------------------------------------------


@api_router.get("/family-catalogs")
async def list_family_catalogs() -> dict[str, Any]:
    """Return the index of bundled external family catalogs."""
    entries = load_catalog_index()
    return {"catalogs": [e.model_dump(by_alias=True) for e in entries]}


@api_router.get("/family-catalogs/{catalog_id}")
async def get_family_catalog(catalog_id: str) -> dict[str, Any]:
    """Return the full payload of one external family catalog."""
    payload = load_catalog_by_id(catalog_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return payload.model_dump(by_alias=True)


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


@api_router.post("/models/{host_id}/import-ifc")
async def import_ifc_to_shadow_link(
    host_id: UUID,
    body: ImportIfcBody,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    """FED-04: import an IFC file as a brand-new shadow bim-ai model + auto-
    create a ``link_model`` row in the host pointing at it.

    Round-trip: parse IFC → ``authoritativeReplay_v0`` command bundle →
    apply to a fresh ``ModelRecord`` in the same project → run
    ``createLinkModel`` against the host. The shadow model is independent
    from then on (host edits never reach back into it; the host treats its
    elements as read-only renderable context per FED-01).
    """

    from bim_ai.export_ifc import build_kernel_ifc_authoritative_replay_sketch_v0
    from bim_ai.engine import (
        try_apply_kernel_ifc_authoritative_replay_v0,
        try_commit,
    )

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
            raise HTTPException(
                status_code=400, detail=f"Cannot read IFC file: {exc}"
            ) from exc
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
        raise HTTPException(
            status_code=400, detail=f"createLinkModel failed: {exc}"
        ) from exc
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
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)


@api_router.post("/models/{host_id}/import-dxf")
async def import_dxf(
    host_id: UUID,
    body: ImportDxfBody,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    """FED-04: parse a DXF file and materialise a ``link_dxf`` element.

    The route reads the file at ``body.file_path``, runs the ``ezdxf``
    parser, then dispatches a single ``createLinkDxf`` engine command on
    the host. Returns the new ``link_dxf`` element id so the frontend can
    open ManageLinksDialog with the new entry highlighted.
    """

    from pathlib import Path as _Path

    from bim_ai.dxf_import import parse_dxf_to_linework

    host_row = await load_model_row(session, host_id)
    if host_row is None:
        raise HTTPException(status_code=404, detail="Host model not found")

    dxf_path = _Path(body.file_path)
    if not dxf_path.is_file():
        raise HTTPException(
            status_code=400, detail=f"DXF file not found at filePath: {body.file_path}"
        )

    try:
        linework = parse_dxf_to_linework(dxf_path)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"DXF parse failed: {exc}"
        ) from exc

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
        "rotationDeg": float(body.rotation_deg),
        "scaleFactor": float(body.scale_factor),
        "linework": linework,
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
    }


# ---------------------------------------------------------------------------
# AGT-01 — Agent iterate endpoint
# ---------------------------------------------------------------------------


@api_router.post("/models/{model_id}/agent-iterate")
async def agent_iterate(
    model_id: UUID,
    body: AgentIterateRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Generate one patch toward ``goal`` given the current snapshot + advisories.

    Backend selection is controlled by the ``BIM_AI_AGENT_BACKEND`` env var
    (default: shell out to ``claude`` CLI; ``test`` reads code blocks from
    the goal markdown for deterministic CI).
    """
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    response: AgentIterateResponse = generate_patch(body)
    return response.model_dump(by_alias=True)


# ---------------------------------------------------------------------------
# CMD-V3-01 — Command-bundle apply API
# ---------------------------------------------------------------------------


class CommandBundleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bundle: CommandBundle
    mode: str = Field(default="dry_run")
    user_id: str | None = Field(default="local-dev", alias="userId")


@api_router.post("/models/{model_id}/bundles")
async def apply_bundle_route(
    model_id: UUID,
    body: CommandBundleRequest,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    """CMD-V3-01: submit a CommandBundle; returns BundleResult.

    mode='dry_run' (default) — validates without mutating.
    mode='commit'            — commits if no blocking advisories fire.
    HTTP 409 on revision_conflict or assumption_log_required / malformed.
    """
    from datetime import UTC, datetime

    from bim_ai.engine import compute_delta_wire, diff_undo_cmds
    from bim_ai.routes_deps import delete_redos, document_to_wire
    from bim_ai.tables import UndoStackRecord

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    mode = body.mode if body.mode in ("dry_run", "commit") else "dry_run"

    result = _apply_bundle(doc, body.bundle, mode)  # type: ignore[arg-type]

    # Surface blocking advisory classes as HTTP 409
    _BLOCKING_ADVISORY_CLASSES = {
        "revision_conflict",
        "assumption_log_required",
        "assumption_log_malformed",
        "assumption_log_duplicate_key",
        "direct_main_commit_forbidden",
        "option_routing_not_yet_implemented",
    }
    if not result.applied and result.violations:
        blocking_classes = {v.get("advisoryClass") for v in result.violations}
        if blocking_classes & _BLOCKING_ADVISORY_CLASSES:
            raise HTTPException(
                status_code=409,
                detail={
                    "result": result.model_dump(by_alias=True),
                    "violations": result.violations,
                },
            )

    if result.applied and result.new_revision is not None:
        # Re-run engine to get new_doc for persisting (deterministic — same result)
        ok, new_doc, _cmds, _viols, _code = try_commit_bundle(doc, body.bundle.commands)
        if ok and new_doc is not None:
            uid = body.user_id or "local-dev"
            doc_before = clone_document(doc)
            undo_cmds = diff_undo_cmds(doc_before, new_doc)
            await delete_redos(session, model_id, uid)

            session.add(
                UndoStackRecord(
                    model_id=model_id,
                    user_id=uid,
                    revision_after=new_doc.revision,
                    forward_commands=body.bundle.commands,
                    undo_commands=undo_cmds,
                    created_at=datetime.now(UTC),
                )
            )

            wire_doc = document_to_wire(new_doc)
            row.document = wire_doc  # type: ignore[assignment]
            row.revision = new_doc.revision
            await session.commit()

            delta = compute_delta_wire(doc_before, new_doc)
            try:
                await hub.broadcast_json(
                    model_id, {"type": "delta", "modelId": str(model_id), **delta}
                )
            except Exception:
                pass

    return result.model_dump(by_alias=True)


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


async def websocket_loop(
    websocket: WebSocket,
    model_id: UUID,
    hub: Hub,
    resume_from: int | None = None,
) -> None:

    sid = str(model_id)

    async with SessionMaker() as session:
        row = await load_model_row(session, model_id)

    await websocket.accept()

    if row is None:
        await websocket.close(code=4404)

        return

    hub.subscribe(sid, websocket)

    if resume_from is None:
        doc = Document.model_validate(row.document)
        await websocket.send_json(
            {
                "type": "snapshot",
                "modelId": sid,
                "revision": doc.revision,
                "elements": {
                    k: el.model_dump(by_alias=True) for k, el in doc.elements.items()
                },
                "violations": violations_wire(doc.elements),
            },
        )
    else:
        replayed = hub.resume(sid, resume_from)
        if replayed is None:
            await websocket.send_json({"type": "RESYNC", "modelId": sid})
        else:
            for payload in replayed:
                await websocket.send_json(payload)
            await websocket.send_json(
                {
                    "type": "replay_done",
                    "modelId": sid,
                    "resumedFrom": resume_from,
                }
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


# ---------------------------------------------------------------------------
# API-V3-01 — Tool registry REST surface
# ---------------------------------------------------------------------------


def _descriptor_to_dict(d: Any) -> dict[str, Any]:
    from dataclasses import asdict

    return asdict(d)


@api_router.get("/v3/tools")
async def v3_list_tools() -> dict[str, Any]:
    catalog = get_catalog()
    return {
        "schemaVersion": catalog.schemaVersion,
        "tools": [_descriptor_to_dict(t) for t in catalog.tools],
    }


@api_router.get("/v3/tools/{name}")
async def v3_inspect_tool(name: str) -> dict[str, Any]:
    descriptor = get_descriptor(name)
    if descriptor is None:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found in registry.")
    return _descriptor_to_dict(descriptor)


@api_router.get("/v3/version")
async def v3_api_version() -> dict[str, str]:
    import subprocess

    try:
        build_ref = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        build_ref = "unknown"
    return {"schemaVersion": "api-v3.0", "buildRef": build_ref}


# ---------------------------------------------------------------------------
# TKN-V3-01 — token encode / decode / diff endpoints
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/tokens/encode")
async def tokens_encode(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Encode the current kernel state into a TokenSequence."""
    from bim_ai.tkn import encode

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    seq = encode(doc.elements)
    return seq.model_dump(by_alias=True)


class TknDecodeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sequence: dict[str, Any]


@api_router.post("/models/{model_id}/tokens/decode")
async def tokens_decode(
    model_id: UUID,
    body: TknDecodeRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Decode a TokenSequence into commands relative to the current kernel state."""
    from bim_ai.tkn import decode
    from bim_ai.tkn.types import TokenSequence

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    seq = TokenSequence.model_validate(body.sequence)
    cmds = decode(seq, doc.elements)
    return {"commands": cmds}


class TknDiffRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sequence_a: dict[str, Any] = Field(alias="sequenceA")
    sequence_b: dict[str, Any] = Field(alias="sequenceB")


@api_router.post("/models/{model_id}/tokens/diff")
async def tokens_diff(
    model_id: UUID,
    body: TknDiffRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Return the structural diff between two TokenSequences."""
    from bim_ai.tkn import diff
    from bim_ai.tkn.types import TokenSequence

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    seq_a = TokenSequence.model_validate(body.sequence_a)
    seq_b = TokenSequence.model_validate(body.sequence_b)
    delta = diff(seq_a, seq_b)
    return delta.model_dump(by_alias=True)
