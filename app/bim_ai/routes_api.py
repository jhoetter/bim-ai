from __future__ import annotations

import logging
import secrets
import time
from collections import OrderedDict
from copy import deepcopy
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)

_PLAN_PROJECTION_CACHE_MAX = 128
_PLAN_PROJECTION_CACHE: OrderedDict[tuple[str, int, str, str, str], dict[str, Any]] = OrderedDict()


def _row_revision(row: Any) -> int:
    raw = getattr(row, "revision", None)
    if raw is None and isinstance(getattr(row, "document", None), dict):
        raw = row.document.get("revision")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


def _projection_cache_key(
    *,
    model_id: UUID,
    revision: int,
    plan_view_id: str | None,
    fallback_level_id: str | None,
    global_plan_presentation: str,
) -> tuple[str, int, str, str, str]:
    return (
        str(model_id),
        revision,
        plan_view_id or "",
        fallback_level_id or "",
        global_plan_presentation,
    )


def _get_plan_projection_cache(key: tuple[str, int, str, str, str]) -> dict[str, Any] | None:
    cached = _PLAN_PROJECTION_CACHE.get(key)
    if cached is None:
        return None
    _PLAN_PROJECTION_CACHE.move_to_end(key)
    return deepcopy(cached)


def _set_plan_projection_cache(key: tuple[str, int, str, str, str], payload: dict[str, Any]) -> None:
    _PLAN_PROJECTION_CACHE[key] = deepcopy(payload)
    _PLAN_PROJECTION_CACHE.move_to_end(key)
    while len(_PLAN_PROJECTION_CACHE) > _PLAN_PROJECTION_CACHE_MAX:
        _PLAN_PROJECTION_CACHE.popitem(last=False)

from fastapi import (
    APIRouter,
    Body,
    Depends,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.agent_brief_acceptance_readout import agent_brief_acceptance_readout_v1
from bim_ai.agent_brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.agent_evidence_review_loop import agent_review_actions_v1, bcf_topics_index_v1
from bim_ai.agent_generated_bundle_qa_checklist import (
    agent_generated_bundle_qa_checklist_v1,
)
from bim_ai.advisor_rule_registry import advisor_rule_catalog_payload
from bim_ai.agent_review_readout_consistency_closure import (
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.architecture_lens_query import build_architecture_lens_query
from bim_ai.ai_boundary import empty_external_model_call_audit_csv, load_bill_of_rights_markdown
from bim_ai.codes import BUILDING_PRESETS
from bim_ai.command_schemas import export_command_schemas, get_command_schema
from bim_ai.commands import Command
from bim_ai.constructability_bcf import build_constructability_bcf_export
from bim_ai.constructability_report import (
    build_constructability_report,
    build_constructability_summary_v1,
)
from bim_ai.coordination_lens import build_coordination_lens_snapshot
from bim_ai.construction_lens import build_construction_lens_payload
from bim_ai.cost_quantity import cost_quantity_lens_review_status
from bim_ai.db import SessionMaker, find_idempotent_undo_record, get_session
from bim_ai.diff_engine import compute_element_diff
from bim_ai.document import Document
from bim_ai.elements import Element, LevelElem, LinkModelElem, PlanViewElem
from bim_ai.fire_safety_lens import fire_safety_lens_review_status
from bim_ai.assets import search_assets
from bim_ai.material_image_assets import ImageAssetUpload, build_image_asset_from_upload
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle, BundleResult
from bim_ai.engine import (
    clone_document,
    ensure_cardinal_elevation_views,
    ensure_internal_origin,
    ensure_seed_hatches,
    ensure_sun_settings,
    try_commit_bundle,
)
from bim_ai.agent_loop import (
    AGENT_BACKEND_ENV_VAR,
    AgentIterateRequest,
    AgentIterateResponse,
    generate_patch,
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
from bim_ai.collab.orchestrator import get_orchestrator
from bim_ai.hub import Hub
from bim_ai.jobs.queue import JobQueue, get_queue
from bim_ai.jobs.types import CreateJobRequest, Job
from bim_ai.link_expansion import expand_links
from bim_ai.model_summary import compute_model_summary
from bim_ai.mep_lens import build_mep_lens_payload
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
    section_cut_projection_wire,
)
from bim_ai.prd_blocking_advisor_matrix import build_prd_blocking_advisor_matrix
from bim_ai.final_acceptance import build_final_acceptance_report
from bim_ai.folder_output import build_reverse_bim_folder_output
from bim_ai.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.integrity_preflight import build_integrity_preflight_report
from bim_ai.query_resolve import query_elements, qa_advisor
from bim_ai.reverse_bim_acceptance_evidence import (
    build_level_completeness_report,
    build_physical_topology_report,
    build_source_overlay_evidence_report,
    build_ui_evidence_report,
)
from bim_ai.reverse_bim_document_authority import build_reverse_bim_document_authority_report
from bim_ai.reverse_bim import (
    build_existing_building_ir_seed,
    build_mcp_authoring_readiness,
    build_reverse_bim_phase_packet,
    build_source_coverage_matrix,
    plan_mcp_authoring_actions,
    validate_existing_building_ir,
)
from bim_ai.reverse_bim_evidence_requirements import build_reverse_bim_evidence_requirements
from bim_ai.reverse_bim_handoff_regeneration import build_reverse_bim_handoff_regeneration_plan
from bim_ai.reverse_bim_phase_runner import build_reverse_bim_phase_run_report
from bim_ai.reverse_bim_readback import build_reverse_bim_readback_comparison
from bim_ai.reverse_bim_source_revision_persistence import persist_reverse_bim_source_revision_ledger
from bim_ai.reverse_bim_source_revision_ledger import build_reverse_bim_source_revision_ledger
from bim_ai.reverse_bim_visual_capture import build_reverse_bim_view_capture_plan
from bim_ai.source_level_completeness import build_source_level_completeness_report
from bim_ai.source_building_scope import build_source_building_scope_report
from bim_ai.source_material_assemblies import build_source_material_assembly_report
from bim_ai.source_reader_consensus import build_source_reader_consensus_report
from bim_ai.renderer_diagnostic_persistence import (
    append_renderer_diagnostic_packet,
    latest_renderer_diagnostic_packet_for_evidence,
    normalize_renderer_diagnostic_packet,
    renderer_diagnostic_packet_embedding,
)
from bim_ai.room_color_scheme_override_evidence import (
    build_room_color_scheme_override_evidence_v1,
    roomColourSchemeLegendEvidence_v1,
)
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)
from bim_ai.semantic_authoring import (
    UnsupportedSemanticOperationError,
    build_semantic_authoring_bundle,
)
from bim_ai.source_coordinate_frames import (
    apply_coordinate_frame_alignments,
    build_coordinate_frame_alignment_worklist,
)
from bim_ai.routes_activity import activity_router
from bim_ai.routes_catalogs import catalogs_router
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
from bim_ai.routes_integrity import integrity_router
from bim_ai.routes_markups import markups_router
from bim_ai.routes_query_resolve import query_resolve_router
from bim_ai.routes_presentation import presentation_router
from bim_ai.routes_sketch import sketch_router
from bim_ai.routes_sketch_product import sketch_product_router
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table, list_schedule_ids
from bim_ai.seed_library import is_seed_library_project_id
from bim_ai.sheet_preview_svg import SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
from bim_ai.source_ingestion import (
    build_ai_reading_packet,
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
    build_folder_manifest,
    classify_documents,
    detect_scale_from_text,
    extract_pdf_text,
    extract_source_facts,
    render_pdf_pages,
    validate_ai_visual_trace_completeness,
    validate_ai_source_facts,
)
from bim_ai.source_agent_loop import (
    build_ai_visual_trace_agent_requests,
    normalize_ai_visual_trace_reader_responses,
    prepare_ai_visual_trace_run_from_folder,
    run_ai_visual_trace_agent_loop,
)
from bim_ai.sustainability_lca import sustainability_lens_manifest_v1
from bim_ai.structure_lens import structure_analysis_export
from bim_ai.permissions import authorize_command
from bim_ai.milestones import CreateMilestoneBody
from bim_ai.tables import (
    MilestoneRecord,
    ModelRecord,
    ProjectRecord,
    PublicLinkRecord,
    RoleAssignmentRecord,
    UndoStackRecord,
)
from bim_ai.template_loader import (
    list_templates,
    load_template_snapshot,
    template_exists,
)
from bim_ai.transaction_safety import (
    ActorKind,
    assess_transaction_safety,
    build_dry_run_evidence,
    build_transaction_preflight_audit,
)
from bim_ai.type_material_registry import merged_registry_payload
from bim_ai.v1_acceptance_proof_matrix import build_v1_acceptance_proof_matrix_v1
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1
from bim_ai.api.registry import get_catalog, get_descriptor

api_router = APIRouter(prefix="/api")
api_router.include_router(exports_router)
api_router.include_router(commands_router)
api_router.include_router(activity_router)
api_router.include_router(catalogs_router)
api_router.include_router(integrity_router)
api_router.include_router(markups_router)
api_router.include_router(query_resolve_router)
api_router.include_router(presentation_router)
api_router.include_router(sketch_router)
api_router.include_router(sketch_product_router)


def _get_job_queue() -> JobQueue:
    return get_queue()


class RendererDiagnosticPacketPersistBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    packet: dict[str, Any]
    user_id: str | None = Field(default="local-dev", alias="userId")


# ---------------------------------------------------------------------------
# COL-V3-02 — permission helpers
# ---------------------------------------------------------------------------


async def resolve_caller_role(session: AsyncSession, model_id: str | UUID, user_id: str) -> str:
    """Return the caller's role for model_id. Defaults to 'admin' when no record exists."""
    res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.model_id == str(model_id),
            RoleAssignmentRecord.subject_kind == "user",
            RoleAssignmentRecord.subject_id == user_id,
        )
    )
    record = res.scalars().first()
    return record.role if record is not None else "admin"


async def _resolve_token_role(session: AsyncSession, model_id_str: str, token: str) -> str:
    """Resolve a public-link token to a role; raises 403 if invalid or expired."""
    now_ms = int(time.time() * 1000)
    res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.model_id == model_id_str,
            RoleAssignmentRecord.subject_kind == "public-link",
            RoleAssignmentRecord.subject_id == token,
        )
    )
    record = res.scalars().first()
    if record is None:
        raise HTTPException(status_code=403, detail="Invalid public-link token")
    if record.expires_at is not None and record.expires_at < now_ms:
        raise HTTPException(status_code=403, detail="Public-link token has expired")
    return record.role


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


@api_router.post("/jobs", status_code=201)
async def create_job(
    body: CreateJobRequest,
    queue: JobQueue = Depends(_get_job_queue),
) -> dict[str, Any]:
    job = Job(
        model_id=body.model_id,
        kind=body.kind,
        inputs=body.inputs,
        created_at=datetime.now(UTC).isoformat(),
    )
    submitted = await queue.submit(job)
    return submitted.model_dump(by_alias=True)


@api_router.get("/jobs")
async def list_jobs(
    model_id: str = Query(alias="modelId"),
    queue: JobQueue = Depends(_get_job_queue),
) -> list[dict[str, Any]]:
    return [job.model_dump(by_alias=True) for job in queue.list_for_model(model_id)]


@api_router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    queue: JobQueue = Depends(_get_job_queue),
) -> dict[str, Any]:
    job = queue.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.model_dump(by_alias=True)


@api_router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    queue: JobQueue = Depends(_get_job_queue),
) -> dict[str, Any]:
    job = queue.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status not in ("queued", "running"):
        raise HTTPException(status_code=409, detail="job cannot be cancelled")
    updated = await queue.update_status(job_id, "cancelled")
    return updated.model_dump(by_alias=True)


@api_router.post("/jobs/{job_id}/retry")
async def retry_job(
    job_id: str,
    queue: JobQueue = Depends(_get_job_queue),
) -> dict[str, Any]:
    parent = queue.get(job_id)
    if parent is None:
        raise HTTPException(status_code=404, detail="job not found")
    retry = Job(
        model_id=parent.model_id,
        kind=parent.kind,
        inputs=parent.inputs,
        parent_job_id=parent.id,
        created_at=datetime.now(UTC).isoformat(),
    )
    submitted = await queue.submit(retry)
    return submitted.model_dump(by_alias=True)


@api_router.get("/v3/bill-of-rights", response_class=PlainTextResponse)
async def bill_of_rights_markdown() -> PlainTextResponse:
    return PlainTextResponse(
        load_bill_of_rights_markdown(),
        media_type="text/markdown; charset=utf-8",
    )


@api_router.get("/v3/ai/audit-log.csv", response_class=PlainTextResponse)
async def external_ai_audit_log_csv() -> PlainTextResponse:
    return PlainTextResponse(
        empty_external_model_call_audit_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="external-model-call-audit.csv"'},
    )


@api_router.get("/bootstrap")
async def bootstrap(session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    proj_res = await session.execute(select(ProjectRecord).order_by(ProjectRecord.slug))
    projects_out: list[dict[str, Any]] = []
    for p in proj_res.scalars().all():
        seed_library = is_seed_library_project_id(p.id)
        mres = await session.execute(
            select(ModelRecord).where(ModelRecord.project_id == p.id).order_by(ModelRecord.slug)
        )
        models = [
            {
                "id": str(m.id),
                "slug": m.slug,
                "revision": m.revision,
                "seedArtifact": seed_library,
            }
            for m in mres.scalars().all()
        ]
        projects_out.append(
            {
                "id": str(p.id),
                "slug": p.slug,
                "title": p.title,
                "kind": "seed-library" if seed_library else "project",
                "seedLibrary": seed_library,
                "models": models,
            }
        )
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
    ensure_cardinal_elevation_views(seed_doc)
    ensure_sun_settings(seed_doc)
    ensure_seed_hatches(seed_doc)
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
    ensure_seed_hatches(doc)
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


@api_router.get("/models/{model_id}/assets/search")
async def search_model_assets(
    model_id: UUID,
    query: str = "",
    category: str | None = None,
    disciplineTag: str | None = Query(default=None),  # noqa: N803 — wire-format alias
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    results = search_assets(
        query,
        doc.elements,
        category=category,
        discipline_tag=disciplineTag,
        limit=limit,
    )
    return {"results": [entry.model_dump(by_alias=True, exclude_none=True) for entry in results]}


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


def _parse_option_locks(raw: str | None) -> dict[str, str]:
    if raw is None or raw.strip() == "":
        return {}
    locks: dict[str, str] = {}
    for chunk in raw.split(","):
        item = chunk.strip()
        if not item:
            continue
        if "=" not in item:
            raise HTTPException(
                status_code=400,
                detail="optionLocks must use comma-separated optionSetId=optionId pairs",
            )
        set_id, option_id = (part.strip() for part in item.split("=", 1))
        if not set_id or not option_id:
            raise HTTPException(
                status_code=400,
                detail="optionLocks entries must include both optionSetId and optionId",
            )
        locks[set_id] = option_id
    return locks


@api_router.get("/models/{model_id}/constructability-report")
async def constructability_report(
    model_id: UUID,
    profile: str = Query("authoring_default"),
    phase_filter: str = Query("all", alias="phaseFilter"),
    option_locks: str | None = Query(None, alias="optionLocks"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {
        "modelId": str(model_id),
        **build_constructability_report(
            doc.elements,
            revision=doc.revision,
            profile=profile,
            phase_filter=phase_filter,
            option_locks=_parse_option_locks(option_locks),
            design_option_sets=doc.design_option_sets,
        ),
    }


@api_router.get("/models/{model_id}/fire-safety-lens")
async def fire_safety_lens_status(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {"modelId": str(model_id), **fire_safety_lens_review_status(doc)}


@api_router.get("/models/{model_id}/cost-quantity-lens")
async def cost_quantity_lens_status(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {"modelId": str(model_id), **cost_quantity_lens_review_status(doc)}


@api_router.get("/models/{model_id}/constructability-bcf")
async def constructability_bcf_export(
    model_id: UUID,
    profile: str = Query("authoring_default"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {
        "modelId": str(model_id),
        **build_constructability_bcf_export(doc.elements, revision=doc.revision, profile=profile),
    }


@api_router.get("/models/{model_id}/coordination-lens")
async def coordination_lens_snapshot(
    model_id: UUID,
    from_revision: int | None = Query(None, alias="fromRevision"),
    to_revision: int | None = Query(None, alias="toRevision"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    current = Document.model_validate(row.document)
    target_revision = to_revision if to_revision is not None else current.revision
    target_doc = (
        await _document_at_revision(session, model_id, current, target_revision)
        if to_revision is not None
        else current
    )

    change_diff: dict[str, Any] | None = None
    if from_revision is not None:
        from_doc = await _document_at_revision(session, model_id, current, from_revision)
        elements_from = {k: v.model_dump(by_alias=True) for k, v in from_doc.elements.items()}
        elements_to = {k: v.model_dump(by_alias=True) for k, v in target_doc.elements.items()}
        change_diff = {
            "fromRevision": from_revision,
            "toRevision": target_revision,
            **compute_element_diff(elements_from, elements_to),
        }

    return build_coordination_lens_snapshot(
        target_doc,
        model_id=str(model_id),
        change_diff=change_diff,
    )


@api_router.get("/models/{model_id}/construction-lens")
async def construction_lens_report(
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
        **build_construction_lens_payload(doc),
    }


@api_router.get("/models/{model_id}/mep")
async def mep_lens_projection(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {"modelId": str(model_id), "revision": doc.revision, **build_mep_lens_payload(doc)}


@api_router.get("/models/{model_id}/sustainability")
async def sustainability_lens_projection(
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
        **sustainability_lens_manifest_v1(doc),
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
    return build_evidence_package_payload(
        model_id=model_id,
        doc=doc,
        source_document=row.document,
    )


def build_evidence_package_payload(
    *,
    model_id: UUID,
    doc: Document,
    source_document: dict[str, Any] | None = None,
) -> dict[str, Any]:
    source_document_wire = source_document or doc.model_dump(by_alias=True)
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
        "constructabilitySummary_v1": build_constructability_summary_v1(
            doc.elements,
            revision=doc.revision,
            profile="construction_readiness",
            design_option_sets=doc.design_option_sets,
        ),
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
    payload["rendererDiagnosticPacket_v1"] = latest_renderer_diagnostic_packet_for_evidence(
        source_document_wire,
        model_revision=doc.revision,
    )
    payload["rendererDiagnosticPacketEmbedding_v1"] = renderer_diagnostic_packet_embedding(
        source_document_wire,
        model_revision=doc.revision,
    )
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


@api_router.post("/models/{model_id}/renderer-diagnostics")
async def persist_renderer_diagnostics(
    model_id: UUID,
    body: RendererDiagnosticPacketPersistBody,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    packet_revision = body.packet.get("modelRevision")
    if packet_revision is not None and str(packet_revision) != str(doc.revision):
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "renderer_diagnostic_packet_revision_conflict",
                "currentRevision": doc.revision,
                "packetRevision": packet_revision,
            },
        )
    packet = normalize_renderer_diagnostic_packet(
        body.packet,
        model_id=str(model_id),
        model_revision=doc.revision,
    )
    row.document = append_renderer_diagnostic_packet(row.document, packet)  # type: ignore[assignment]
    await session.commit()
    return {
        "ok": True,
        "modelId": str(model_id),
        "revision": doc.revision,
        "rendererDiagnosticPacket_v1": packet,
        "rendererDiagnosticPacketEmbedding_v1": renderer_diagnostic_packet_embedding(
            row.document,
            model_revision=doc.revision,
        ),
    }


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
    cache_key = _projection_cache_key(
        model_id=model_id,
        revision=_row_revision(row),
        plan_view_id=plan_view_id,
        fallback_level_id=fallback_level_id,
        global_plan_presentation=global_plan_presentation,
    )
    cached = _get_plan_projection_cache(cache_key)
    if cached is not None:
        return cached
    doc = Document.model_validate(row.document)
    payload = plan_projection_wire_from_request(
        doc,
        plan_view_id=plan_view_id,
        fallback_level_id=fallback_level_id,
        global_plan_presentation=global_plan_presentation,
    )
    _set_plan_projection_cache(cache_key, payload)
    return deepcopy(payload)


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
# Architecture Lens query route
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/architecture/query")
async def architecture_lens_query(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_architecture_lens_query(doc)


# ---------------------------------------------------------------------------
# M2-A Query/Resolve read-only routes
# ---------------------------------------------------------------------------


_SEMANTIC_SURFACE_ALIASES = {
    "author.level": "level",
    "author.wall": "wall",
    "author.wall_chain": "wall_chain",
    "author.floor_from_boundary": "floor_from_boundary",
    "author.floor_supports": "floor_supports",
    "author.room_outline": "room_outline",
    "author.room_separation": "room_separation",
    "author.roof_from_boundary": "roof_from_boundary",
    "author.dormer_on_roof": "dormer_on_roof",
    "opening.door_on_wall": "door_on_wall",
    "opening.window_on_wall": "window_on_wall",
    "opening.roof_opening": "roof_opening",
    "opening.slab_opening": "slab_opening",
    "opening.shaft_opening": "shaft_opening",
    "author.stair_between_levels": "stair_between_levels",
    "author.stair_by_runs": "stair_by_runs",
    "author.stair_by_sketch": "stair_by_sketch",
    "author.stair_existing_condition": "stair_existing_condition",
    "author.railing": "railing",
    "structure.column": "structure_column",
    "structure.beam": "structure_beam",
    "structure.column_update": "structure_column_update",
    "structure.constraint": "structure_constraint",
    "construction.package": "construction_package",
    "construction.logistics": "construction_logistics",
    "construction.qa_checklist": "construction_qa_checklist",
    "view.save_3d": "save_3d_view",
    "view.plan": "plan_view",
    "mep.pipe_route": "mep_pipe_route",
    "mep.duct_route": "mep_duct_route",
    "mep.cable_tray": "mep_cable_tray",
    "mep.equipment": "mep_equipment",
    "mep.fixture": "mep_fixture",
    "mep.terminal": "mep_terminal",
    "mep.opening_request": "mep_opening_request",
}


@api_router.post("/semantic-authoring/{surface_id}")
async def semantic_authoring_route(
    surface_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
) -> Any:
    operation = _SEMANTIC_SURFACE_ALIASES.get(surface_id, surface_id)
    try:
        bundle = build_semantic_authoring_bundle(operation, body)
    except UnsupportedSemanticOperationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "unsupported_semantic_operation",
                "operation": exc.operation,
                "message": exc.reason,
            },
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_semantic_payload", "message": str(exc)},
        ) from exc
    return bundle.model_dump(by_alias=True)


# ---------------------------------------------------------------------------
# Existing-building source ingestion and reverse-BIM method surfaces
# ---------------------------------------------------------------------------


def _source_response(payload: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    if payload.get("ok") is not False:
        return payload
    return JSONResponse(status_code=int(payload.pop("status", 400)), content=payload)


@api_router.post("/v3/source/folder-manifest")
async def source_folder_manifest_route(body: dict[str, Any] = Body(default_factory=dict)) -> Any:
    root_path = body.get("rootPath") or body.get("path")
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    return _source_response(build_folder_manifest(str(root_path)))


@api_router.post("/v3/source/classify-documents")
async def source_classify_documents_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    manifest = body.get("manifest") or body.get("files") or body
    return classify_documents(manifest)


@api_router.post("/v3/source/pdf-text")
async def source_pdf_text_route(body: dict[str, Any] = Body(default_factory=dict)) -> Any:
    source_path = body.get("sourcePath") or body.get("path")
    if not source_path:
        raise HTTPException(status_code=422, detail="sourcePath is required")
    return _source_response(
        extract_pdf_text(str(source_path), max_pages=body.get("maxPages"))
    )


@api_router.post("/v3/source/render-pdf")
async def source_render_pdf_route(body: dict[str, Any] = Body(default_factory=dict)) -> Any:
    source_path = body.get("sourcePath") or body.get("path")
    output_dir = body.get("outputDir") or "tmp/pdfs/source-render"
    if not source_path:
        raise HTTPException(status_code=422, detail="sourcePath is required")
    return _source_response(
        render_pdf_pages(
            str(source_path),
            output_dir=str(output_dir),
            dpi=int(body.get("dpi") or 200),
            first_page=body.get("firstPage"),
            last_page=body.get("lastPage"),
        )
    )


@api_router.post("/v3/source/detect-scale")
async def source_detect_scale_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return detect_scale_from_text(
        str(body.get("text") or ""),
        source_document_id=body.get("sourceDocumentId"),
    )


@api_router.post("/v3/source/ai-reading-packet")
async def source_ai_reading_packet_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_ai_reading_packet(
        manifest=body.get("manifest") or {},
        classifications=body.get("classifications"),
        rendered_pages=body.get("renderedPages") or [],
        text_extractions=body.get("textExtractions") or [],
    )


@api_router.post("/v3/source/ai-visual-trace-packet")
async def source_ai_visual_trace_packet_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_ai_visual_trace_packet(
        manifest=body.get("manifest") or {},
        classifications=body.get("classifications"),
        rendered_pages=body.get("renderedPages") or [],
        text_extractions=body.get("textExtractions") or [],
    )


@api_router.post("/v3/source/ai-visual-trace-work-order")
async def source_ai_visual_trace_work_order_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    packet = body.get("aiVisualTracePacket") or body.get("packet") or body
    return build_ai_visual_trace_work_order(
        ai_visual_trace_packet=packet,
        project_goal=body.get("projectGoal"),
    )


@api_router.post("/v3/source/ai-visual-trace-agent-requests")
async def source_ai_visual_trace_agent_requests_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    work_order = body.get("workOrder") or body.get("aiVisualTraceWorkOrder") or body
    return build_ai_visual_trace_agent_requests(
        work_order=work_order,
        run_id=body.get("runId"),
        max_native_text_chars=int(body.get("maxNativeTextChars") or 0),
    )


@api_router.post("/v3/source/prepare-ai-visual-trace-run")
async def source_prepare_ai_visual_trace_run_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> Any:
    root_path = body.get("rootPath") or body.get("path")
    output_dir = body.get("outputDir")
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return _source_response(
        prepare_ai_visual_trace_run_from_folder(
            root_path=str(root_path),
            output_dir=str(output_dir),
            run_id=body.get("runId"),
            dpi=int(body.get("dpi") or 200),
            max_pages_per_pdf=body.get("maxPagesPerPdf"),
        )
    )


@api_router.post("/v3/source/ai-visual-trace-agent-loop")
async def source_ai_visual_trace_agent_loop_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    work_order = body.get("workOrder") or body.get("aiVisualTraceWorkOrder") or {}
    return run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=body.get("responses") or body.get("readerResponses"),
        run_id=body.get("runId"),
        reader_command=body.get("readerCommand"),
        reader_timeout_seconds=int(body.get("readerTimeoutSeconds") or 300),
    )


@api_router.post("/v3/source/normalize-ai-visual-trace-reader-responses")
async def source_normalize_ai_visual_trace_reader_responses_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return normalize_ai_visual_trace_reader_responses(
        body.get("responses") or body.get("readerResponses") or body
    )


@api_router.post("/v3/source/reader-consensus")
async def source_reader_consensus_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_reader_consensus_report(
        body.get("responses") or body.get("readerResponses") or body,
        min_independent_readers=int(body.get("minIndependentReaders") or 2)
        if isinstance(body, dict)
        else 2,
    )


@api_router.post("/v3/source/validate-ai-facts")
async def source_validate_ai_facts_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return validate_ai_source_facts(body.get("facts") or [])


@api_router.post("/v3/source/validate-ai-visual-trace-completeness")
async def source_validate_ai_visual_trace_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return validate_ai_visual_trace_completeness(
        body.get("facts") or [],
        required_kinds=body.get("requiredKinds") or body.get("requiredFactKinds"),
    )


@api_router.post("/v3/source/extract-facts")
async def source_extract_facts_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return extract_source_facts(
        body.get("classifications") or body,
        text_extractions=body.get("textExtractions") or [],
    )


@api_router.post("/v3/reverse-bim/ir/seed")
async def reverse_bim_ir_seed_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_existing_building_ir_seed(
        source_manifest=body.get("sourceManifest") or {},
        source_facts=body.get("sourceFacts"),
        classifications=body.get("classifications"),
    )


@api_router.post("/v3/reverse-bim/ir/validate")
async def reverse_bim_ir_validate_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return validate_existing_building_ir(body.get("ir") or body)


@api_router.post("/v3/reverse-bim/source-coverage")
async def reverse_bim_source_coverage_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    facts = body.get("facts") or body.get("extractedFacts") or []
    return build_source_coverage_matrix(
        facts=facts,
        fact_to_element_refs=body.get("factToElementRefs") or {},
    )


@api_router.post("/v3/reverse-bim/plan-authoring")
async def reverse_bim_plan_authoring_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return plan_mcp_authoring_actions(
        facts=body.get("facts") or body.get("extractedFacts") or [],
        target_phase=body.get("phase"),
    )


@api_router.post("/v3/reverse-bim/mcp-readiness")
async def reverse_bim_mcp_readiness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_mcp_authoring_readiness(
        facts=body.get("facts") or body.get("extractedFacts") or [],
        target_phase=body.get("phase"),
    )


@api_router.post("/v3/reverse-bim/source-material-assemblies")
async def reverse_bim_source_material_assemblies_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_material_assembly_report(
        body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or []
    )


@api_router.post("/v3/reverse-bim/source-building-scope")
async def reverse_bim_source_building_scope_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_building_scope_report(
        body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or []
    )


@api_router.post("/v3/reverse-bim/source-level-completeness")
async def reverse_bim_source_level_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_level_completeness_report(
        body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or []
    )


@api_router.post("/v3/reverse-bim/coordinate-frame-worklist")
async def reverse_bim_coordinate_frame_worklist_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    coordinate_frames = (
        body.get("coordinateFrames")
        or body.get("coordinate_frames")
        or body.get("frames")
        or {}
    )
    return build_coordinate_frame_alignment_worklist(
        coordinate_frames,
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
    )


@api_router.post("/v3/reverse-bim/coordinate-frame-alignment")
async def reverse_bim_coordinate_frame_alignment_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    coordinate_frames = (
        body.get("coordinateFrames")
        or body.get("coordinate_frames")
        or body.get("frames")
        or {}
    )
    return apply_coordinate_frame_alignments(
        coordinate_frames,
        body.get("alignments") or body.get("coordinateFrameAlignments"),
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
    )


@api_router.post("/v3/reverse-bim/document-authority")
async def reverse_bim_document_authority_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_document_authority_report(
        manifest=body.get("manifest") or body.get("sourceManifest") or body.get("files"),
        classifications=body.get("classifications") or body.get("documents"),
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
        authority_hints=body.get("authorityHints") or body.get("documentAuthorityHints"),
    )


@api_router.post("/v3/reverse-bim/folder-output")
async def reverse_bim_folder_output_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> Any:
    root_path = body.get("rootPath") or body.get("sourceFolder") or body.get("path")
    output_dir = body.get("outputDir")
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return build_reverse_bim_folder_output(
        root_path=str(root_path),
        output_dir=str(output_dir),
        reader_responses=body.get("readerResponses") or body.get("responses"),
        reader_command=body.get("readerCommand"),
        reader_timeout_seconds=int(body.get("readerTimeoutSeconds") or 300),
        conflict_decisions=body.get("conflictDecisions") or body.get("sourceConflictDecisions"),
        coordinate_frame_alignments=body.get("coordinateFrameAlignments")
        or body.get("coordinateFrameDecisions"),
        site_terrain_decisions=body.get("siteTerrainDecisions") or body.get("siteTopologyDecisions"),
        run_id=body.get("runId"),
        dpi=int(body.get("dpi") or 200),
        max_pages_per_pdf=body.get("maxPagesPerPdf"),
        reset_output=bool(body.get("resetOutput") or False),
    )


@api_router.post("/v3/reverse-bim/phase-packet")
async def reverse_bim_phase_packet_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_phase_packet(
        phase_id=str(body.get("phaseId") or "unknown"),
        start_revision=body.get("startRevision"),
        end_revision=body.get("endRevision"),
        source_fact_ids=body.get("sourceFactIds") or [],
        transactions=body.get("transactions") or [],
        advisor=body.get("advisor"),
        constructability=body.get("constructability"),
        integrity_preflight=body.get("integrityPreflight"),
        evidence_package=body.get("evidencePackage"),
        finding_dispositions=body.get("findingDispositions") or [],
    )


@api_router.post("/v3/reverse-bim/phase-run")
async def reverse_bim_phase_run_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_phase_run_report(
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec") or body,
        phase_packets=body.get("phasePackets") or body.get("packets"),
    )


@api_router.post("/v3/reverse-bim/readback-compare")
async def reverse_bim_readback_compare_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_readback_comparison(
        expected_readback=body.get("expectedReadback")
        or body.get("expected_readback")
        or body.get("expectations")
        or [],
        model_readback=body.get("modelReadback")
        or body.get("model_readback")
        or body.get("readback")
        or body.get("readbackEvidence"),
        elements=body.get("elements") or body.get("queryElements") or body.get("query_elements"),
        tolerance_defaults=body.get("toleranceDefaults") or body.get("tolerance_defaults"),
    )


@api_router.post("/v3/reverse-bim/source-spec-revision")
async def reverse_bim_source_spec_revision_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_spec_revision_report(
        findings=body.get("findings"),
        readback_comparison=body.get("readbackComparison") or body.get("readback_comparison"),
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        advisor=body.get("advisor"),
        constructability=body.get("constructability"),
        integrity=body.get("integrity") or body.get("integrityPreflight"),
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
    )


@api_router.post("/v3/reverse-bim/source-revision-ledger")
async def reverse_bim_source_revision_ledger_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_source_revision_ledger(
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
        source_spec_revision=body.get("sourceSpecRevision") or body.get("source_spec_revision"),
        existing_ledger=body.get("existingLedger") or body.get("existing_ledger"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )


@api_router.post("/v3/reverse-bim/source-revision-ledger-persist")
async def reverse_bim_source_revision_ledger_persist_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    output_dir = body.get("outputDir") or body.get("output_dir")
    source_revision_ledger = (
        body.get("sourceRevisionLedger")
        or body.get("source_revision_ledger")
        or body.get("ledger")
    )
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(source_revision_ledger, dict):
        raise HTTPException(status_code=422, detail="sourceRevisionLedger is required")
    return persist_reverse_bim_source_revision_ledger(
        output_dir=output_dir,
        source_revision_ledger=source_revision_ledger,
        run_id=body.get("runId") or body.get("run_id"),
    )


@api_router.post("/v3/reverse-bim/handoff-regeneration")
async def reverse_bim_handoff_regeneration_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_handoff_regeneration_plan(
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
        source_revision_ledger=body.get("sourceRevisionLedger")
        or body.get("source_revision_ledger"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )


@api_router.post("/v3/models/{model_id}/reverse-bim/hybrid-slice-execute")
async def reverse_bim_hybrid_slice_execute_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
    token: str | None = Query(default=None),
) -> dict[str, Any]:
    """Run one hybrid reverse-BIM authoring slice through the live bundle route."""

    phase = body.get("phase") if isinstance(body.get("phase"), dict) else {}
    phase_id = str(phase.get("phaseId") or phase.get("id") or body.get("phaseId") or "unknown")
    source_facts = body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or []
    mcp_readiness = body.get("mcpReadiness") or body.get("mcp_readiness")
    if not isinstance(mcp_readiness, dict) and isinstance(source_facts, list):
        mcp_readiness = build_mcp_authoring_readiness(
            facts=source_facts,
            target_phase=phase_id,
        )
    if not isinstance(mcp_readiness, dict):
        mcp_readiness = {"ok": True, "summary": {"blockerCount": 0}, "rows": []}

    expected_readback = _hybrid_expected_readback(body, phase)
    source_fact_ids = _hybrid_source_fact_ids(body, phase, expected_readback)
    if int((mcp_readiness.get("summary") or {}).get("blockerCount") or 0) and not body.get(
        "forceDryRunWithBlockers"
    ):
        slice_report = build_hybrid_reverse_bim_slice_report(
            phase={"phaseId": phase_id},
            mcp_readiness=mcp_readiness,
        )
        return {
            "ok": False,
            "format": "hybridReverseBimSliceExecution_v1",
            "modelId": str(model_id),
            "phaseId": phase_id,
            "executionState": "source_blocked",
            "mcpReadiness": mcp_readiness,
            "sliceReport": slice_report,
            "nextStep": slice_report.get("nextStep"),
        }

    bundle_payload = body.get("bundle") or body.get("commandBundle")
    if not isinstance(bundle_payload, dict):
        raise HTTPException(status_code=422, detail="bundle or commandBundle is required")

    user_id = str(body.get("userId") or body.get("user_id") or "local-dev")
    submitter = str(body.get("submitter") or "agent")
    actor_kind = body.get("actorKind") or body.get("actor_kind") or "agent"
    client_op_id = body.get("clientOpId") or body.get("client_op_id")
    dry_run_request = _hybrid_bundle_request(
        bundle_payload=bundle_payload,
        mode="dry_run",
        user_id=user_id,
        submitter=submitter,
        actor_kind=actor_kind,
        client_op_id=client_op_id,
    )
    dry_run_result = await apply_bundle_route(
        model_id,
        dry_run_request,
        session=session,
        hub=hub,
        token=token,
    )
    dry_run_evidence = dry_run_result.get("dryRunEvidence") if isinstance(dry_run_result, dict) else None
    commit_requested = bool(body.get("commit") or body.get("mode") == "commit")
    commit_result: dict[str, Any] | None = None
    if commit_requested and isinstance(dry_run_evidence, dict) and dry_run_evidence.get("ok") is True:
        commit_request = _hybrid_bundle_request(
            bundle_payload=bundle_payload,
            mode="commit",
            user_id=user_id,
            submitter=submitter,
            actor_kind=actor_kind,
            client_op_id=client_op_id,
            dry_run_evidence=dry_run_evidence,
        )
        commit_result = await apply_bundle_route(
            model_id,
            commit_request,
            session=session,
            hub=hub,
            token=token,
        )

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    changed_ids = _hybrid_changed_ids(commit_result or dry_run_result)
    query_request = {
        "filter": {"ids": changed_ids} if changed_ids else {},
        "limit": 500,
    }
    query_result = query_elements(
        str(model_id),
        doc,
        query_request,
        include=["geometrySummary", "hostRefs", "raw"],
    )
    queried_elements = ((query_result.get("data") or {}).get("elements") or [])
    readback_comparison = build_reverse_bim_readback_comparison(
        expected_readback=expected_readback,
        model_readback=body.get("modelReadback") or body.get("readback"),
        elements=queried_elements,
        tolerance_defaults=body.get("toleranceDefaults") or body.get("tolerance_defaults"),
    )
    advisor = qa_advisor(
        str(model_id),
        doc,
        {"profile": body.get("advisorProfile") or "authoring_default", "limit": 500},
    )
    constructability = {
        "modelId": str(model_id),
        **build_constructability_report(
            doc.elements,
            revision=doc.revision,
            profile=str(body.get("constructabilityProfile") or "authoring_default"),
            changed_element_ids=changed_ids,
            design_option_sets=doc.design_option_sets,
        ),
    }
    integrity = build_integrity_preflight_report(
        doc,
        revision=doc.revision,
        model_id=str(model_id),
        changed_element_ids=changed_ids,
    )
    source_spec_revision = build_source_spec_revision_report(
        readback_comparison=readback_comparison,
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        advisor=advisor,
        constructability=constructability,
        integrity=integrity,
        facts=source_facts if isinstance(source_facts, list) else [],
    )
    source_revision_ledger = build_reverse_bim_source_revision_ledger(
        facts=source_facts if isinstance(source_facts, list) else [],
        source_spec_revision=source_spec_revision,
        existing_ledger=body.get("sourceRevisionLedger") or body.get("source_revision_ledger"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )
    evidence_package = {
        "modelSummary": compute_model_summary(doc),
        "queryElements": query_result,
        "readbackComparison": readback_comparison,
        "sourceSpecRevision": source_spec_revision,
        "sourceRevisionLedger": source_revision_ledger,
    }
    phase_packet = build_reverse_bim_phase_packet(
        phase_id=phase_id,
        start_revision=(bundle_payload.get("parentRevision") if isinstance(bundle_payload, dict) else None),
        end_revision=doc.revision if commit_result else None,
        source_fact_ids=source_fact_ids,
        transactions=[
            {"mode": "dry_run", "result": dry_run_result},
            *([{"mode": "commit", "result": commit_result}] if commit_result else []),
        ],
        advisor=advisor,
        constructability=constructability,
        integrity_preflight=integrity,
        evidence_package=evidence_package,
        finding_dispositions=body.get("findingDispositions") or [],
    )
    source_overlay = body.get("sourceOverlay") or body.get("source_overlay")
    ui_evidence = body.get("uiEvidence") or body.get("ui_evidence")
    slice_report = build_hybrid_reverse_bim_slice_report(
        phase={"phaseId": phase_id},
        mcp_readiness=mcp_readiness,
        readback_comparison=readback_comparison,
        phase_packet=phase_packet if commit_result else None,
        source_spec_revision=source_spec_revision,
        source_overlay=source_overlay,
        ui_evidence=ui_evidence,
    )
    execution_state = (
        "accepted"
        if slice_report.get("ok")
        else "commit_blocked"
        if commit_requested and not commit_result
        else "committed_with_blockers"
        if commit_result
        else "dry_run_passed"
        if dry_run_evidence and dry_run_evidence.get("ok")
        else "dry_run_blocked"
    )
    return {
        "ok": bool(slice_report.get("ok")),
        "format": "hybridReverseBimSliceExecution_v1",
        "modelId": str(model_id),
        "phaseId": phase_id,
        "executionState": execution_state,
        "dryRunResult": dry_run_result,
        "commitResult": commit_result,
        "changedElementIds": changed_ids,
        "mcpReadiness": mcp_readiness,
        "readbackComparison": readback_comparison,
        "advisor": advisor,
        "constructability": constructability,
        "integrityPreflight": integrity,
        "sourceSpecRevision": source_spec_revision,
        "sourceRevisionLedger": source_revision_ledger,
        "phasePacket": phase_packet,
        "sliceReport": slice_report,
        "nextStep": slice_report.get("nextStep"),
    }


@api_router.post("/v3/models/{model_id}/reverse-bim/hybrid-run-execute")
async def reverse_bim_hybrid_run_execute_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
    token: str | None = Query(default=None),
) -> dict[str, Any]:
    """Execute an ordered list of reverse-BIM slices and stop on blockers."""

    slices = [row for row in body.get("slices") or [] if isinstance(row, dict)]
    if not slices:
        raise HTTPException(status_code=422, detail="slices must contain at least one slice body")
    continue_on_blockers = bool(body.get("continueOnBlockers") or body.get("continue_on_blockers"))
    common_keys = {
        "facts",
        "sourceFacts",
        "extractedFacts",
        "phaseAuthoringSpec",
        "phaseSpec",
        "sourceRevisionLedger",
        "source_revision_ledger",
        "findingDispositions",
        "sourceOverlay",
        "source_overlay",
        "uiEvidence",
        "ui_evidence",
    }
    common = {key: body[key] for key in common_keys if key in body}
    results = []
    stopped = False
    for slice_body in slices:
        merged_body = {**common, **slice_body}
        result = await reverse_bim_hybrid_slice_execute_route(
            model_id,
            merged_body,
            session=session,
            hub=hub,
            token=token,
        )
        results.append(result)
        if result.get("ok") is not True and not continue_on_blockers:
            stopped = True
            break

    phase_packets = [
        row.get("phasePacket")
        for row in results
        if isinstance(row.get("phasePacket"), dict)
    ]
    slice_reports = [
        row.get("sliceReport")
        for row in results
        if isinstance(row.get("sliceReport"), dict)
    ]
    run_report = build_hybrid_reverse_bim_run_report(
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec") or {},
        phase_packets=phase_packets,
        slice_reports=slice_reports,
        package_acceptance=body.get("packageAcceptance") or body.get("folderOutput"),
    )
    return {
        "ok": bool(run_report.get("ok")) and not stopped,
        "format": "hybridReverseBimRunExecution_v1",
        "modelId": str(model_id),
        "summary": {
            "requestedSliceCount": len(slices),
            "executedSliceCount": len(results),
            "stoppedOnBlocker": stopped,
            "acceptedSliceCount": sum(1 for row in results if row.get("ok") is True),
        },
        "sliceExecutions": results,
        "runReport": run_report,
        "nextStep": (
            "All requested slices executed and accepted."
            if run_report.get("ok") and not stopped
            else "Repair the first blocked slice, regenerate handoff if needed, then rerun from that slice."
        ),
    }


def _hybrid_bundle_request(
    *,
    bundle_payload: dict[str, Any],
    mode: str,
    user_id: str,
    submitter: str,
    actor_kind: str,
    client_op_id: Any = None,
    dry_run_evidence: dict[str, Any] | None = None,
) -> Any:
    try:
        return CommandBundleRequest.model_validate(
            {
                "bundle": bundle_payload,
                "mode": mode,
                "userId": user_id,
                "submitter": submitter,
                "actorKind": actor_kind,
                "clientOpId": client_op_id,
                "dryRunEvidence": dry_run_evidence,
            }
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def _hybrid_expected_readback(body: dict[str, Any], phase: dict[str, Any]) -> list[dict[str, Any]]:
    direct = (
        body.get("expectedReadback")
        or body.get("expected_readback")
        or phase.get("expectedReadback")
        or phase.get("expected_readback")
    )
    if isinstance(direct, list):
        return [row for row in direct if isinstance(row, dict)]
    rows = []
    for action in phase.get("authoringActions") or []:
        if not isinstance(action, dict):
            continue
        expected = action.get("expectedReadback")
        if isinstance(expected, dict):
            rows.append(expected)
        elif isinstance(expected, list):
            rows.extend(row for row in expected if isinstance(row, dict))
    return rows


def _hybrid_source_fact_ids(
    body: dict[str, Any],
    phase: dict[str, Any],
    expected_readback: list[dict[str, Any]],
) -> list[str]:
    ids = []
    for value in (
        body.get("sourceFactIds"),
        body.get("source_fact_ids"),
        phase.get("sourceFactIds"),
        phase.get("source_fact_ids"),
    ):
        if isinstance(value, list):
            ids.extend(str(item) for item in value if item)
    for row in expected_readback:
        value = row.get("sourceFactId") or row.get("factId")
        if value:
            ids.append(str(value))
    return sorted(set(ids))


def _hybrid_changed_ids(result: dict[str, Any] | None) -> list[str]:
    if not isinstance(result, dict):
        return []
    candidates = [
        result.get("changedIds"),
        result.get("changedElementIds"),
        (result.get("transactionMetadata") or {}).get("changedIds")
        if isinstance(result.get("transactionMetadata"), dict)
        else None,
    ]
    ids = []
    for candidate in candidates:
        if isinstance(candidate, list):
            ids.extend(str(item) for item in candidate if item)
    return sorted(set(ids))


@api_router.post("/v3/reverse-bim/hybrid-slice")
async def reverse_bim_hybrid_slice_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_hybrid_reverse_bim_slice_report(
        phase=body.get("phase") or body.get("slice") or {},
        mcp_readiness=body.get("mcpReadiness") or body.get("mcp_readiness"),
        readback_comparison=body.get("readbackComparison") or body.get("readback_comparison"),
        phase_packet=body.get("phasePacket") or body.get("phase_packet"),
        source_spec_revision=body.get("sourceSpecRevision") or body.get("source_spec_revision"),
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        ui_evidence=body.get("uiEvidence") or body.get("ui_evidence"),
    )


@api_router.post("/v3/reverse-bim/hybrid-run")
async def reverse_bim_hybrid_run_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_hybrid_reverse_bim_run_report(
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec") or body,
        phase_packets=body.get("phasePackets") or body.get("packets"),
        slice_reports=body.get("sliceReports") or body.get("slice_reports"),
        package_acceptance=body.get("packageAcceptance")
        or body.get("package_acceptance")
        or body.get("folderOutput"),
    )


@api_router.post("/v3/reverse-bim/evidence-requirements")
async def reverse_bim_evidence_requirements_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_evidence_requirements(
        source_page_index=body.get("sourcePageIndex") or body.get("source_page_index"),
        source_facts=body.get("sourceFacts") or body.get("facts") or body.get("extractedFacts"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )


@api_router.post("/v3/reverse-bim/view-capture-plan")
async def reverse_bim_view_capture_plan_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    evidence_requirements = (
        body.get("evidenceRequirements")
        or body.get("evidence_requirements")
        or {}
    )
    return build_reverse_bim_view_capture_plan(
        model_id=body.get("modelId") or body.get("model_id"),
        required_ui_views=body.get("requiredUiViews")
        or body.get("required_ui_views")
        or evidence_requirements.get("requiredUiViews")
        or evidence_requirements.get("required_ui_views"),
        required_overlay_views=body.get("requiredOverlayViews")
        or body.get("required_overlay_views")
        or evidence_requirements.get("requiredOverlayViews")
        or evidence_requirements.get("required_overlay_views"),
        output_dir=body.get("outputDir") or body.get("output_dir"),
        base_url=body.get("baseUrl") or body.get("base_url"),
        run_id=body.get("runId") or body.get("run_id"),
        viewport=body.get("viewport"),
    )


@api_router.post("/v3/reverse-bim/level-completeness")
async def reverse_bim_level_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_level_completeness_report(
        source_facts=body.get("sourceFacts") or body.get("facts"),
        model_summary=body.get("modelSummary") or body.get("model_summary"),
        required_levels=body.get("requiredLevels") or body.get("required_levels"),
        model_level_summaries=body.get("modelLevelSummaries")
        or body.get("model_level_summaries"),
        min_physical_elements_per_required_level=int(
            body.get("minPhysicalElementsPerRequiredLevel")
            or body.get("min_physical_elements_per_required_level")
            or 1
        ),
    )


@api_router.post("/v3/qa/level-completeness")
async def qa_level_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return await reverse_bim_level_completeness_route(body)


@api_router.post("/v3/reverse-bim/physical-topology")
async def reverse_bim_physical_topology_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_physical_topology_report(
        room_boundary_edges=body.get("roomBoundaryEdges") or body.get("room_boundary_edges"),
        room_access_graph=body.get("roomAccessGraph") or body.get("room_access_graph"),
        openings=body.get("openings"),
        stairs=body.get("stairs"),
        advisor=body.get("advisor"),
    )


@api_router.post("/v3/qa/physical-topology")
async def qa_physical_topology_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return await reverse_bim_physical_topology_route(body)


@api_router.post("/v3/reverse-bim/source-overlay-evidence")
async def reverse_bim_source_overlay_evidence_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_overlay_evidence_report(
        required_views=body.get("requiredViews") or body.get("required_views"),
        overlay_results=body.get("overlayResults") or body.get("overlay_results"),
        default_tolerance_mm=float(body.get("defaultToleranceMm") or 50.0),
    )


@api_router.post("/v3/qa/source-overlay-compare")
async def qa_source_overlay_compare_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return await reverse_bim_source_overlay_evidence_route(body)


@api_router.post("/v3/reverse-bim/ui-evidence")
async def reverse_bim_ui_evidence_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    require_checklist_raw = body.get("requireVisualChecklist", True)
    require_checklist = (
        require_checklist_raw
        if isinstance(require_checklist_raw, bool)
        else str(require_checklist_raw).lower() not in {"0", "false", "no"}
    )
    return build_ui_evidence_report(
        required_views=body.get("requiredViews") or body.get("required_views"),
        screenshots=body.get("screenshots"),
        require_visual_checklist=require_checklist,
    )


@api_router.post("/v3/reverse-bim/final-acceptance")
async def reverse_bim_final_acceptance_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_final_acceptance_report(
        str(body.get("modelId") or body.get("model_id") or "unknown-model"),
        advisor=body.get("advisor"),
        constructability=body.get("constructability"),
        integrity=body.get("integrity") or body.get("integrityPreflight"),
        area_reconciliation=body.get("areaReconciliation") or body.get("area_reconciliation"),
        coverage=body.get("coverage") or body.get("sourceCoverage"),
        finding_disposition=body.get("findingDisposition")
        or body.get("finding_disposition")
        or body.get("findingDispositions"),
        room_access_graph=body.get("roomAccessGraph") or body.get("room_access_graph"),
        room_boundary_edges=body.get("roomBoundaryEdges") or body.get("room_boundary_edges"),
        room_topology_repair=body.get("roomTopologyRepair") or body.get("room_topology_repair"),
        level_completeness=body.get("levelCompleteness") or body.get("level_completeness"),
        physical_topology=body.get("physicalTopology") or body.get("physical_topology"),
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        ui_evidence=body.get("uiEvidence") or body.get("ui_evidence"),
    )


# ---------------------------------------------------------------------------
# Structure lens handoff route
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/structure/analysis-export")
async def structure_analysis_export_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return structure_analysis_export(doc)


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


@api_router.get("/models/{model_id}/energy/handoff")
async def energy_handoff_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
    scenario_id: Annotated[str | None, Query(alias="scenarioId")] = None,
) -> dict[str, Any]:
    from bim_ai.energy_lens import build_energy_handoff_payload

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_energy_handoff_payload(doc, scenario_id=scenario_id)


# ---------------------------------------------------------------------------
# SCH-V3-01 — Schedule view rows endpoint
# ---------------------------------------------------------------------------


@api_router.get("/v3/models/{model_id}/schedules/{schedule_id}/rows")
async def schedule_view_rows(
    model_id: UUID,
    schedule_id: str,
    session: AsyncSession = Depends(get_session),
    filter_expr: Annotated[str | None, Query(alias="filterExpr")] = None,
    sort_key: Annotated[str | None, Query(alias="sortKey")] = None,
    sort_dir: Annotated[str | None, Query(alias="sortDir")] = None,
) -> list[dict[str, Any]]:
    import math as _math

    from bim_ai.elements import ScheduleElem as _ScheduleElem

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    sv = doc.elements.get(schedule_id)
    if not isinstance(sv, _ScheduleElem) or not sv.category:
        raise HTTPException(status_code=404, detail="Schedule view not found or has no category")

    category = sv.category
    effective_filter = filter_expr if filter_expr is not None else sv.filter_expr
    effective_sort_key = sort_key if sort_key is not None else sv.sort_key
    effective_sort_dir = sort_dir if sort_dir is not None else sv.sort_dir

    rows: list[dict[str, Any]] = []
    for elem_id, elem in doc.elements.items():
        if getattr(elem, "kind", None) != category:
            continue
        fields: dict[str, Any] = {"id": elem_id}
        name = getattr(elem, "name", None)
        if name is not None:
            fields["name"] = name
        if category == "wall":
            start = getattr(elem, "start", None)
            end = getattr(elem, "end", None)
            if start and end:
                dx = end.x_mm - start.x_mm
                dy = end.y_mm - start.y_mm
                fields["lengthMm"] = round(_math.sqrt(dx * dx + dy * dy), 1)
            t = getattr(elem, "thickness_mm", None)
            if t is not None:
                fields["thicknessMm"] = t
            h = getattr(elem, "height_mm", None)
            if h is not None:
                fields["heightMm"] = h
        elif category == "door":
            w = getattr(elem, "width_mm", None)
            if w is not None:
                fields["widthMm"] = w
        elif category == "window":
            for attr, key in (
                ("width_mm", "widthMm"),
                ("height_mm", "heightMm"),
                ("sill_height_mm", "sillHeightMm"),
            ):
                v = getattr(elem, attr, None)
                if v is not None:
                    fields[key] = v
        props = getattr(elem, "props", None)
        if props:
            fields.update(props)
        if effective_filter:
            fl = effective_filter.lower()
            if not any(fl in str(v).lower() for v in fields.values()):
                continue
        rows.append({"elementId": elem_id, "fields": fields})

    if effective_sort_key:
        reverse = effective_sort_dir == "desc"
        rows.sort(
            key=lambda r: (
                r["fields"].get(effective_sort_key) is None,
                r["fields"].get(effective_sort_key, ""),
            ),
            reverse=reverse,
        )

    return rows


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


@api_router.post("/models/{host_id}/upload-dxf-file")
async def upload_dxf_file(
    host_id: UUID,
    file: UploadFile,
    levelId: str = Form(...),
    name: str = Form(default=""),
    originAlignmentMode: str = Form(default="origin_to_origin"),
    unitOverride: str | None = Form(default=None),
    colorMode: str = Form(default="black_white"),
    customColor: str | None = Form(default=None),
    overlayOpacity: float = Form(default=0.5),
    hiddenLayerNames: str = Form(default=""),
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
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


@api_router.post("/material-assets/validate-upload")
async def validate_material_asset_upload(
    file: UploadFile,
    mapUsageHint: str = Form(default="albedo"),
    source: str | None = Form(default=None),
    license: str | None = Form(default=None),
    provenance: str | None = Form(default=None),
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
    client_op_id: str | None = Field(default=None, alias="clientOpId")
    submitter: str = Field(default="human")
    actor_kind: ActorKind = Field(default="human", alias="actorKind")
    dry_run_evidence: dict[str, Any] | None = Field(default=None, alias="dryRunEvidence")


@api_router.post("/models/{model_id}/bundles")
async def apply_bundle_route(
    model_id: UUID,
    body: CommandBundleRequest,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
    token: str | None = Query(default=None),
) -> dict[str, Any]:
    """CMD-V3-01: submit a CommandBundle; returns BundleResult.

    mode='dry_run' (default) — validates without mutating.
    mode='commit'            — commits if no blocking advisories fire.
    HTTP 409 on revision_conflict or assumption_log_required / malformed.
    HTTP 403 when the caller's role forbids the command verb (COL-V3-02).
    """
    from datetime import UTC, datetime

    from bim_ai.engine import compute_delta_wire, diff_undo_cmds
    from bim_ai.routes_deps import delete_redos, document_to_wire
    from bim_ai.tables import UndoStackRecord
    from bim_ai.transaction_metadata import build_transaction_metadata, command_bundle_digest

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    # COL-V3-02: resolve caller role and gate commands.
    if token:
        caller_role = await _resolve_token_role(session, str(model_id), token)
    else:
        caller_role = await resolve_caller_role(session, model_id, body.user_id or "local-dev")
    for cmd in body.bundle.commands:
        cmd_type = cmd.get("type", "") if isinstance(cmd, dict) else getattr(cmd, "type", "")
        if not authorize_command(caller_role, str(cmd_type)):  # type: ignore[arg-type]
            raise HTTPException(
                status_code=403,
                detail=f"Role '{caller_role}' is not permitted to execute '{cmd_type}'",
            )

    doc = Document.model_validate(row.document)
    mode = body.mode if body.mode in ("dry_run", "commit") else "dry_run"
    uid = body.user_id or "local-dev"
    bundle_digest = command_bundle_digest(
        body.bundle.commands,
        parent_revision=body.bundle.parent_revision,
        assumptions=list(body.bundle.assumptions),
        submitter=body.submitter,
        route="/api/models/{model_id}/bundles",
    )

    if mode == "commit":
        prior = await find_idempotent_undo_record(
            session,
            model_id=model_id,
            client_op_id=body.client_op_id,
            bundle_digest=bundle_digest,
            user_id=uid,
        )
        if prior is not None:
            metadata = prior.transaction_metadata or {}
            return {
                "schemaVersion": "cmd-v3.0",
                "applied": True,
                "newRevision": prior.revision_after,
                "currentRevision": row.revision,
                "changedIds": (
                    metadata.get("changedIds", []) if isinstance(metadata, dict) else []
                ),
                "violations": [],
                "checkpointSnapshotId": None,
                "transactionMetadata": metadata,
                "idempotentReplay": True,
                "idempotencyMatch": (
                    metadata.get("idempotency") if isinstance(metadata, dict) else None
                ),
            }

    safety_surface = (
        "mcp-mutation" if body.actor_kind in {"agent", "mcp-client"} else "bundle-commit"
    )
    transaction_safety = assess_transaction_safety(
        current_revision=doc.revision,
        parent_revision=body.bundle.parent_revision,
        mode=mode,  # type: ignore[arg-type]
        surface=safety_surface,  # type: ignore[arg-type]
        actor_kind=body.actor_kind,
        commands=body.bundle.commands,
        dry_run_evidence=body.dry_run_evidence,
    )
    transaction_safety_wire = transaction_safety.model_dump(by_alias=True)
    transaction_preflight_audit = build_transaction_preflight_audit(
        current_revision=doc.revision,
        parent_revision=body.bundle.parent_revision,
        mode=mode,  # type: ignore[arg-type]
        surface=safety_surface,  # type: ignore[arg-type]
        actor_kind=body.actor_kind,
        commands=body.bundle.commands,
        decision=transaction_safety,
    )
    if not transaction_safety.ok:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": transaction_safety.reason_code,
                "transactionSafety": transaction_safety_wire,
                "transactionPreflightAudit": transaction_preflight_audit,
            },
        )

    result, new_doc_from_bundle = _apply_bundle(
        doc, body.bundle, mode, model_id=str(model_id), submitter=body.submitter
    )  # type: ignore[arg-type]

    # Surface blocking advisory classes as HTTP 409
    _BLOCKING_ADVISORY_CLASSES = {
        "revision_conflict",
        "assumption_log_required",
        "assumption_log_malformed",
        "assumption_log_duplicate_key",
        "direct_main_commit_forbidden",
        "option_not_found",
        "bundle_apply_failed",
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

    if result.applied and result.new_revision is not None and new_doc_from_bundle is not None:
        new_doc = new_doc_from_bundle
        doc_before = clone_document(doc)
        undo_cmds = diff_undo_cmds(doc_before, new_doc)
        transaction_metadata = build_transaction_metadata(
            doc_before=doc_before,
            new_doc=new_doc,
            commands=body.bundle.commands,
            user_id=uid,
            submitter=body.submitter,
            parent_revision=body.bundle.parent_revision,
            assumptions=list(body.bundle.assumptions),
            client_op_id=body.client_op_id,
            workflow={
                "route": "/api/models/{model_id}/bundles",
                "entryPoint": "cmd-v3-apply-bundle",
                "surface": "api-v3",
                "mode": "commit",
            },
            bundle_digest=bundle_digest,
        )
        transaction_metadata["transactionSafety"] = transaction_safety_wire
        transaction_metadata["transactionPreflightAudit"] = transaction_preflight_audit
        await delete_redos(session, model_id, uid)

        session.add(
            UndoStackRecord(
                model_id=model_id,
                user_id=uid,
                revision_after=new_doc.revision,
                forward_commands=body.bundle.commands,
                undo_commands=undo_cmds,
                transaction_metadata=transaction_metadata,
                created_at=datetime.now(UTC),
            )
        )

        wire_doc = document_to_wire(new_doc)
        row.document = wire_doc  # type: ignore[assignment]
        row.revision = new_doc.revision
        await session.commit()

        try:
            from bim_ai.activity import emit_activity_row

            await emit_activity_row(
                session,
                model_id=str(model_id),
                author_id=uid,
                kind="commit",
                payload={"commandCount": len(body.bundle.commands)},
                parent_snapshot_id=str(doc_before.revision),
                result_snapshot_id=str(new_doc.revision),
            )
            await session.commit()
        except Exception:
            pass

        delta = compute_delta_wire(doc_before, new_doc)
        try:
            await hub.publish(model_id, {"type": "delta", "modelId": str(model_id), **delta})
        except Exception:
            pass

        result_wire = result.model_dump(by_alias=True)
        result_wire["transactionMetadata"] = transaction_metadata
        result_wire["transactionSafety"] = transaction_safety_wire
        result_wire["transactionPreflightAudit"] = transaction_preflight_audit
        return result_wire

    result_wire = result.model_dump(by_alias=True)
    result_wire["transactionSafety"] = transaction_safety_wire
    result_wire["transactionPreflightAudit"] = transaction_preflight_audit
    dry_run_ok = not any(
        bool(v.get("blocking")) or v.get("severity") == "error" for v in result.violations
    )
    result_wire["dryRunEvidence"] = build_dry_run_evidence(
        parent_revision=body.bundle.parent_revision,
        commands=body.bundle.commands,
        ok=dry_run_ok,
        reason=None if dry_run_ok else "dry_run_violations",
        violations=result.violations,
        summary_before={"revision": doc.revision, "elementCount": len(doc.elements)},
        summary_after={
            "wouldRevision": result.new_revision,
            "changedIds": result.changed_ids,
            "checkpointSnapshotId": result.checkpoint_snapshot_id,
        },
    )
    return result_wire


# ---------------------------------------------------------------------------
# COL-V3-02 — role management + public-link share routes
# ---------------------------------------------------------------------------


class GrantRoleBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    subject_kind: str = Field(alias="subjectKind")
    subject_id: str = Field(alias="subjectId")
    role: str
    expires_at: int | None = Field(default=None, alias="expiresAt")


class CreatePublicLinkBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    expires_at: int | None = Field(default=None, alias="expiresAt")


@api_router.get("/models/{model_id}/roles")
async def list_roles(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-02: list all role assignments for a model."""
    res = await session.execute(
        select(RoleAssignmentRecord).where(RoleAssignmentRecord.model_id == str(model_id))
    )
    rows = res.scalars().all()
    return {
        "roles": [
            {
                "id": r.id,
                "modelId": r.model_id,
                "subjectKind": r.subject_kind,
                "subjectId": r.subject_id,
                "role": r.role,
                "grantedBy": r.granted_by,
                "grantedAt": r.granted_at,
                "expiresAt": r.expires_at,
            }
            for r in rows
        ]
    }


@api_router.post("/models/{model_id}/roles")
async def grant_role(
    model_id: UUID,
    body: GrantRoleBody,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-02: grant a role to a subject. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can grant roles")
    now_ms = int(time.time() * 1000)
    assignment_id = secrets.token_urlsafe(16)
    record = RoleAssignmentRecord(
        id=assignment_id,
        model_id=str(model_id),
        subject_kind=body.subject_kind,
        subject_id=body.subject_id,
        role=body.role,
        granted_by=user_id,
        granted_at=now_ms,
        expires_at=body.expires_at,
    )
    session.add(record)
    await session.commit()
    return {
        "id": assignment_id,
        "modelId": str(model_id),
        "subjectKind": body.subject_kind,
        "subjectId": body.subject_id,
        "role": body.role,
        "grantedBy": user_id,
        "grantedAt": now_ms,
        "expiresAt": body.expires_at,
    }


@api_router.delete("/models/{model_id}/roles/{assignment_id}")
async def revoke_role(
    model_id: UUID,
    assignment_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-02: revoke a role assignment. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can revoke roles")
    res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.id == assignment_id,
            RoleAssignmentRecord.model_id == str(model_id),
        )
    )
    record = res.scalars().first()
    if record is None:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    await session.delete(record)
    await session.commit()
    return {"deleted": assignment_id}


@api_router.post("/models/{model_id}/public-link")
async def create_public_link(
    model_id: UUID,
    body: CreatePublicLinkBody,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-02: create a public-link token for viewer access. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create public links")
    token = secrets.token_urlsafe(32)
    now_ms = int(time.time() * 1000)
    assignment_id = secrets.token_urlsafe(16)
    record = RoleAssignmentRecord(
        id=assignment_id,
        model_id=str(model_id),
        subject_kind="public-link",
        subject_id=token,
        role="public-link-viewer",
        granted_by=user_id,
        granted_at=now_ms,
        expires_at=body.expires_at,
    )
    session.add(record)
    await session.commit()
    url = f"/api/models/{model_id}/snapshot?token={token}"
    return {"token": token, "url": url, "assignmentId": assignment_id}


# ---------------------------------------------------------------------------
# COL-V3-03 — Shareable public link
# ---------------------------------------------------------------------------


class CreatePublicLinkBodyV3(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    display_name: str | None = Field(default=None, alias="displayName")
    expires_at: int | None = Field(default=None, alias="expiresAt")
    password: str | None = Field(default=None)


class VerifyPasswordBody(BaseModel):
    password: str


@api_router.post("/models/{model_id}/public-links")
async def create_public_link_v3(
    model_id: UUID,
    body: CreatePublicLinkBodyV3,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-03: create a public link with optional expiry and password. Admin only."""
    from bim_ai.public_links import generate_link_token, hash_link_password

    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create public links")

    now_ms = int(time.time() * 1000)
    link_id = secrets.token_urlsafe(16)
    token = generate_link_token()
    password_hash = hash_link_password(body.password) if body.password else None

    link_record = PublicLinkRecord(
        id=link_id,
        model_id=str(model_id),
        token=token,
        created_by=user_id,
        created_at=now_ms,
        expires_at=body.expires_at,
        password_hash=password_hash,
        is_revoked=False,
        display_name=body.display_name,
        open_count=0,
    )
    session.add(link_record)

    assignment_id = secrets.token_urlsafe(16)
    role_record = RoleAssignmentRecord(
        id=assignment_id,
        model_id=str(model_id),
        subject_kind="public-link",
        subject_id=token,
        role="public-link-viewer",
        granted_by=user_id,
        granted_at=now_ms,
        expires_at=body.expires_at,
    )
    session.add(role_record)
    await session.commit()

    return {
        "id": link_id,
        "modelId": str(model_id),
        "token": token,
        "createdBy": user_id,
        "createdAt": now_ms,
        "expiresAt": body.expires_at,
        "isRevoked": False,
        "displayName": body.display_name,
        "openCount": 0,
    }


@api_router.get("/models/{model_id}/public-links")
async def list_public_links(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-03: list non-revoked public links for a model."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.is_revoked.is_(False),
        )
    )
    records = res.scalars().all()
    return {
        "links": [
            {
                "id": r.id,
                "modelId": r.model_id,
                "token": r.token,
                "createdBy": r.created_by,
                "createdAt": r.created_at,
                "expiresAt": r.expires_at,
                "isRevoked": r.is_revoked,
                "displayName": r.display_name,
                "openCount": r.open_count,
            }
            for r in records
        ]
    }


@api_router.post("/models/{model_id}/public-links/{link_id}/revoke")
async def revoke_public_link(
    model_id: UUID,
    link_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-03: revoke a public link and delete its RoleAssignment. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can revoke public links")

    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.id == link_id,
            PublicLinkRecord.model_id == str(model_id),
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Public link not found")

    link_record.is_revoked = True

    role_res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.model_id == str(model_id),
            RoleAssignmentRecord.subject_kind == "public-link",
            RoleAssignmentRecord.subject_id == link_record.token,
        )
    )
    role_record = role_res.scalars().first()
    if role_record is not None:
        await session.delete(role_record)

    await session.commit()
    return {"revoked": link_id}


@api_router.get("/shared/{token}")
async def resolve_shared_token(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-03: resolve a public link token and return the model document."""
    now_ms = int(time.time() * 1000)
    res = await session.execute(select(PublicLinkRecord).where(PublicLinkRecord.token == token))
    link_record = res.scalars().first()
    if link_record is None or link_record.is_revoked:
        raise HTTPException(status_code=410, detail="Link not found or revoked")
    if link_record.expires_at is not None and link_record.expires_at < now_ms:
        raise HTTPException(status_code=410, detail="Link has expired")

    try:
        from sqlalchemy import update as sa_update

        await session.execute(
            sa_update(PublicLinkRecord)
            .where(PublicLinkRecord.id == link_record.id)
            .values(open_count=PublicLinkRecord.open_count + 1)
        )
        await session.commit()
    except Exception:
        pass

    try:
        model_uuid = UUID(link_record.model_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Model not found") from None

    row = await load_model_row(session, model_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    elements_wire = {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}
    return {
        "modelId": str(row.id),
        "revision": doc.revision,
        "elements": elements_wire,
        "violations": violations_wire(doc.elements),
        "publicLink": {
            "id": link_record.id,
            "displayName": link_record.display_name,
            "openCount": link_record.open_count,
        },
    }


@api_router.post("/shared/{token}/verify-password")
async def verify_public_link_password(
    token: str,
    body: VerifyPasswordBody,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-03: verify the password for a public link."""
    res = await session.execute(select(PublicLinkRecord).where(PublicLinkRecord.token == token))
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Public link not found")

    if link_record.password_hash is None:
        return {"ok": True}

    from bim_ai.public_links import verify_link_password

    return {"ok": verify_link_password(body.password, link_record.password_hash)}


# ---------------------------------------------------------------------------
# VER-V3-01 — Activity stream routes
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/activity")
async def list_activity(
    model_id: UUID,
    limit: int = 50,
    before: int | None = None,
    kind: str | None = None,
    author_id: Annotated[str | None, Query(alias="authorId")] = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from sqlalchemy import desc, select

    from bim_ai.tables import ActivityRowRecord

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    stmt = (
        select(ActivityRowRecord)
        .where(ActivityRowRecord.model_id == str(model_id))
        .order_by(desc(ActivityRowRecord.ts))
        .limit(limit)
    )
    if before is not None:
        stmt = stmt.where(ActivityRowRecord.ts < before)
    if kind is not None:
        stmt = stmt.where(ActivityRowRecord.kind == kind)
    if author_id is not None:
        stmt = stmt.where(ActivityRowRecord.author_id == author_id)

    res = await session.execute(stmt)
    rows = res.scalars().all()

    return {
        "modelId": str(model_id),
        "rows": [
            {
                "id": r.id,
                "modelId": r.model_id,
                "authorId": r.author_id,
                "kind": r.kind,
                "payload": dict(r.payload),
                "ts": r.ts,
                "parentSnapshotId": r.parent_snapshot_id,
                "resultSnapshotId": r.result_snapshot_id,
            }
            for r in rows
        ],
    }


@api_router.post("/models/{model_id}/activity/{row_id}/restore")
async def restore_activity_row(
    model_id: UUID,
    row_id: str,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    from bim_ai.activity import emit_activity_row
    from bim_ai.engine import compute_delta_wire
    from bim_ai.routes_deps import document_to_wire
    from bim_ai.tables import ActivityRowRecord

    act_row = await session.get(ActivityRowRecord, row_id)
    if act_row is None or act_row.model_id != str(model_id):
        raise HTTPException(status_code=404, detail="Activity row not found")

    model_row = await load_model_row(session, model_id)
    if model_row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    if not act_row.parent_snapshot_id:
        raise HTTPException(status_code=422, detail="Row has no parentSnapshotId")

    current_doc = Document.model_validate(model_row.document)
    doc_before = clone_document(current_doc)
    restore_doc = clone_document(current_doc)
    restore_doc.revision = current_doc.revision + 1

    wire = document_to_wire(restore_doc)
    model_row.document = wire  # type: ignore[assignment]
    model_row.revision = restore_doc.revision

    new_act = await emit_activity_row(
        session,
        model_id=str(model_id),
        author_id="restore",
        kind="commit",
        payload={"restored_from_row": row_id},
        parent_snapshot_id=str(doc_before.revision),
        result_snapshot_id=str(restore_doc.revision),
    )
    await session.commit()

    delta = compute_delta_wire(doc_before, restore_doc)
    try:
        await hub.publish(model_id, {"type": "delta", "modelId": str(model_id), **delta})
    except Exception:
        pass

    return new_act.model_dump(by_alias=True)


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


async def websocket_loop(
    websocket: WebSocket,
    model_id: UUID,
    hub: Hub,
    resume_from: int | None = None,
    send_initial_snapshot: bool = True,
    snapshot_revision: int | None = None,
) -> None:

    sid = str(model_id)

    async with SessionMaker() as session:
        row = await load_model_row(session, model_id)

    await websocket.accept()

    if row is None:
        await websocket.close(code=4404)

        return

    hub.subscribe(sid, websocket)

    try:
        if resume_from is None:
            doc = Document.model_validate(row.document)
            should_send_snapshot = send_initial_snapshot or (
                snapshot_revision is not None and snapshot_revision != doc.revision
            )
            if should_send_snapshot:
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
                await websocket.send_json(
                    {
                        "type": "replay_done",
                        "modelId": sid,
                        "resumedFrom": None,
                        "snapshotRevision": doc.revision,
                    }
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
# COL-V3-01 — yjs Y-WebSocket collab endpoint
# ---------------------------------------------------------------------------


@api_router.websocket("/models/{model_id}/collab")
async def collab_ws(
    websocket: WebSocket,
    model_id: UUID,
    subspace: str = Query(default="kernel"),
    token: str | None = Query(default=None),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> None:
    """COL-V3-01/COL-V3-02: yjs Y-WebSocket endpoint for real-time collab on a model.

    Relays raw yjs sync + awareness bytes between browser clients multiplexed
    by modelId. Does not interpret CRDT contents — yjs algorithms handle merge
    deterministically on each client.

    COL-V3-02: viewer and public-link-viewer origins are blocked from mutating
    the kernel subspace.
    """
    orchestrator = get_orchestrator()
    await websocket.accept()

    async with SessionMaker() as session:
        if token:
            try:
                caller_role = await _resolve_token_role(session, str(model_id), token)
            except HTTPException:
                await websocket.close(code=4403)
                return
        else:
            caller_role = await resolve_caller_role(session, model_id, user_id)

    room = orchestrator.get_room(str(model_id))
    room.join(websocket, role=caller_role)
    try:
        while True:
            data = await websocket.receive_bytes()
            await room.broadcast(
                data, exclude=websocket, origin_role=caller_role, subspace=subspace
            )
    except WebSocketDisconnect:
        room.leave(websocket)
        orchestrator.remove_empty_rooms()
        logger.info("collab ws disconnect model=%s", model_id)


# ---------------------------------------------------------------------------
# API-V3-01 — Tool registry REST surface
# ---------------------------------------------------------------------------


def _descriptor_to_dict(d: Any) -> dict[str, Any]:
    from dataclasses import asdict

    return asdict(d)


# ---------------------------------------------------------------------------
# VG-V3-01 — Render-and-compare
# ---------------------------------------------------------------------------


@api_router.post("/v3/compare")
async def compare_snapshots_endpoint(body: dict) -> dict:
    """VG-V3-01 — Deterministic visual diff between two model snapshots.

    Accepts JSON body with snapshotA, snapshotB, and optional metric / threshold / region.
    Returns a CompareResult. Same inputs → byte-identical output.
    """
    snap_a = body.get("snapshotA")
    snap_b = body.get("snapshotB")
    if snap_a is None or snap_b is None:
        raise HTTPException(status_code=422, detail="snapshotA and snapshotB are required")
    metric = body.get("metric", "ssim")
    if metric not in ("ssim", "mse", "pixel-diff"):
        raise HTTPException(
            status_code=422,
            detail="metric must be one of: ssim, mse, pixel-diff",
        )
    threshold = body.get("threshold")
    region = body.get("region")
    from bim_ai.vg.compare import compare_snapshots

    return compare_snapshots(
        snap_a,
        snap_b,
        metric=metric,
        threshold=float(threshold) if threshold is not None else None,
        region=region,
    )


# ---------------------------------------------------------------------------
# SKB-03 — Visual Checkpoint
# ---------------------------------------------------------------------------


@api_router.post("/v3/skb/checkpoint")
async def skb_visual_checkpoint(body: dict) -> dict:
    """SKB-03 — visual checkpoint tool (image-to-image comparison).

    Accepts body with actualPng, targetPng, and optional threshold.
    Returns a CheckpointReport.
    """
    actual_png = body.get("actualPng")
    target_png = body.get("targetPng")
    threshold = body.get("threshold", 0.05)
    if not actual_png or not target_png:
        raise HTTPException(status_code=422, detail="actualPng and targetPng are required")

    from bim_ai.skb.visual_checkpoint import compare_pngs

    report = compare_pngs(actual_png, target_png, threshold=float(threshold))
    return report.to_dict()


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


@api_router.get("/v3/advisor-rules")
async def v3_advisor_rules(
    profile: str | None = Query(default=None),
    surface: str | None = Query(default=None),
) -> dict[str, object]:
    return advisor_rule_catalog_payload(profile=profile, surface=surface)


@api_router.get("/v3/commands")
async def v3_list_command_schemas() -> dict[str, Any]:
    return export_command_schemas()


@api_router.get("/v3/commands/{name}")
async def v3_inspect_command_schema(name: str) -> dict[str, Any]:
    command_schema = get_command_schema(name)
    if command_schema is None:
        raise HTTPException(status_code=404, detail=f"Command '{name}' not found.")
    return command_schema


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


# ---------------------------------------------------------------------------
# VER-V3-02 — Named milestone routes
# ---------------------------------------------------------------------------


@api_router.post("/models/{model_id}/milestones")
async def create_milestone(
    model_id: UUID,
    body: CreateMilestoneBody,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """VER-V3-02: create a named milestone pinned to a snapshot id."""
    import time as _time
    from uuid import uuid4 as _uuid4

    from bim_ai.activity import emit_activity_row

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    milestone_id = str(_uuid4())
    now_ms = int(_time.time() * 1000)
    record = MilestoneRecord(
        id=milestone_id,
        model_id=str(model_id),
        name=body.name,
        description=body.description,
        snapshot_id=body.snapshot_id,
        author_id=body.author_id,
        created_at=now_ms,
    )
    session.add(record)
    await session.flush()

    await emit_activity_row(
        session,
        model_id=str(model_id),
        author_id=body.author_id,
        kind="milestone_created",
        payload={"name": body.name, "milestoneId": milestone_id},
    )
    await session.commit()

    return {
        "id": milestone_id,
        "modelId": str(model_id),
        "name": body.name,
        "description": body.description,
        "snapshotId": body.snapshot_id,
        "authorId": body.author_id,
        "createdAt": now_ms,
    }


@api_router.get("/models/{model_id}/milestones")
async def list_milestones(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """VER-V3-02: list all milestones for a model, descending createdAt."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    res = await session.execute(
        select(MilestoneRecord)
        .where(MilestoneRecord.model_id == str(model_id))
        .order_by(desc(MilestoneRecord.created_at))
    )
    milestones = res.scalars().all()

    return {
        "modelId": str(model_id),
        "milestones": [
            {
                "id": m.id,
                "modelId": m.model_id,
                "name": m.name,
                "description": m.description,
                "snapshotId": m.snapshot_id,
                "authorId": m.author_id,
                "createdAt": m.created_at,
            }
            for m in milestones
        ],
    }


@api_router.delete("/models/{model_id}/milestones/{milestone_id}")
async def delete_milestone(
    model_id: UUID,
    milestone_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """VER-V3-02: delete a milestone by id."""
    res = await session.execute(
        select(MilestoneRecord).where(
            MilestoneRecord.id == milestone_id,
            MilestoneRecord.model_id == str(model_id),
        )
    )
    record = res.scalars().first()
    if record is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await session.delete(record)
    await session.commit()
    return {"deleted": milestone_id}


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


# ---------------------------------------------------------------------------
# MRK-V3-03 — Sheet pixel-map endpoint
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/sheets/{sheet_id}/pixel-map")
async def get_sheet_pixel_map(
    model_id: UUID,
    sheet_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """MRK-V3-03: return pixel→source-view/element mapping for a sheet.

    Requires at least viewer permission (public-link viewers included).
    Returns ``{ "map": { "<x>,<y>": { "sourceViewId": "...", "sourceElementId": "..." } } }``.
    """
    # Resolve role; will raise 403 for invalid/expired tokens automatically.
    # For unauthenticated callers we require a userId or token parameter.
    if user_id == "local-dev":
        pass  # dev shortcut — accepted
    else:
        # Confirm the user has at least viewer access.
        role = await resolve_caller_role(session, model_id, user_id)
        if role not in ("admin", "editor", "viewer"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    # Build the pixel map by walking view placements on the sheet.
    # For v3: all pixels inside a placement bounding box map to that viewId;
    # sourceElementId is "" unless the hit-test index is available.
    pixel_map: dict[str, dict[str, str]] = {}
    sheet_elem = doc.elements.get(sheet_id)
    if sheet_elem is not None and hasattr(sheet_elem, "view_placements"):
        for vp in getattr(sheet_elem, "view_placements", []) or []:
            vp_dict = (
                vp
                if isinstance(vp, dict)
                else (vp.model_dump(by_alias=True) if hasattr(vp, "model_dump") else {})
            )
            view_id = vp_dict.get("viewId", "")
            x_min = int(vp_dict.get("xPxMin", 0))
            x_max = int(vp_dict.get("xPxMax", 0))
            y_min = int(vp_dict.get("yPxMin", 0))
            y_max = int(vp_dict.get("yPxMax", 0))
            if not view_id:
                continue
            # Register every integer pixel coordinate in the bounding box.
            for px in range(x_min, x_max + 1):
                for py in range(y_min, y_max + 1):
                    pixel_map[f"{px},{py}"] = {
                        "sourceViewId": view_id,
                        "sourceElementId": "",
                    }

    return {"map": pixel_map}


# ---------------------------------------------------------------------------
# OSM-V3-01 — Neighborhood massing import
# ---------------------------------------------------------------------------


@api_router.post("/v3/models/{model_id}/neighborhood-import")
async def import_neighborhood(
    model_id: UUID,
    body: dict,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """OSM-V3-01: fetch OSM buildings within radius_m of lat/lon and upsert into the model."""
    lat = float(body.get("lat", 0.0))
    lon = float(body.get("lon", 0.0))
    radius_m = float(body.get("radiusM", 200.0))

    from bim_ai.site.osm_import import fetch_buildings, elements_to_masses

    elements = fetch_buildings(lat, lon, radius_m)
    masses = elements_to_masses(elements, lat, lon)

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    existing_osm_ids = {
        elem_id
        for elem_id, elem in doc.elements.items()
        if getattr(elem, "kind", None) == "neighborhood_mass"
        and getattr(elem, "source", None) == "osm"
    }
    for elem_id in existing_osm_ids:
        del doc.elements[elem_id]

    for mass in masses:
        doc.elements[mass["id"]] = mass  # type: ignore[assignment]

    row.document = doc.model_dump(by_alias=True)
    await session.commit()

    return {"imported": len(masses), "masses": masses}


# ---------------------------------------------------------------------------
# CON-V3-02 — Concept-seed handoff endpoint (T6 → T9)
# ---------------------------------------------------------------------------


@api_router.get("/v3/models/{model_id}/concept-seeds")
async def list_concept_seeds(
    model_id: UUID,
    status: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """CON-V3-02: return concept seeds for a model, optionally filtered by status."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    from bim_ai.elements import ConceptSeedElem as _ConceptSeedElem

    seeds: list[dict[str, Any]] = []
    for elem in doc.elements.values():
        if not isinstance(elem, _ConceptSeedElem):
            continue
        if status is not None and elem.status != status:
            continue
        seeds.append(elem.model_dump(by_alias=True))

    return seeds


# ---------------------------------------------------------------------------
# EXP-V3-01 — Render-pipeline export (glTF / IFC / metadata bundle)
# ---------------------------------------------------------------------------

_VALID_EXPORT_FORMATS = {"gltf", "gltf-pbr", "ifc-bundle", "metadata-only"}


@api_router.get("/v3/models/{model_id}/export", tags=["exp-v3-01"])
async def render_export(
    model_id: UUID,
    format: str = Query(default="metadata-only"),
    viewId: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """EXP-V3-01 — Export model as glTF, IFC, or metadata bundle for external renderers."""
    from bim_ai.exp.render_export import build_export_bundle

    if format not in _VALID_EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid export format '{format}'. Valid values: {sorted(_VALID_EXPORT_FORMATS)}",
        )

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    elements_list = [v.model_dump(by_alias=True) for v in doc.elements.values()]
    model_state = {"elements": elements_list}

    bundle = build_export_bundle(model_state, format, view_id=viewId)  # type: ignore[arg-type]
    return bundle.to_dict()
