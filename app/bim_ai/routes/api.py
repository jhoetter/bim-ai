from __future__ import annotations

import logging
import re
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


def _set_plan_projection_cache(
    key: tuple[str, int, str, str, str], payload: dict[str, Any]
) -> None:
    _PLAN_PROJECTION_CACHE[key] = deepcopy(payload)
    _PLAN_PROJECTION_CACHE.move_to_end(key)
    while len(_PLAN_PROJECTION_CACHE) > _PLAN_PROJECTION_CACHE_MAX:
        _PLAN_PROJECTION_CACHE.popitem(last=False)


# PERF-F04: cross-request schedule table cache keyed by
# (model_id, revision, schedule_id, lightweight). Same LRU shape as
# _PLAN_PROJECTION_CACHE — repeated /schedules/{id}/table requests for
# unchanged revisions skip the derive_schedule_table call, which is the
# dominant ~230 ms cost on room schedules (tracker baseline). The
# `lightweight` axis is part of the key so PERF-F06 lightweight mode and
# the full derivation never collide.
_SCHEDULE_TABLE_CACHE_MAX = 128
_SCHEDULE_TABLE_CACHE: OrderedDict[tuple[str, int, str, bool], dict[str, Any]] = OrderedDict()


def _schedule_table_cache_key(
    *, model_id: UUID, revision: int, schedule_id: str, lightweight: bool = False
) -> tuple[str, int, str, bool]:
    return (str(model_id), revision, schedule_id, lightweight)


def _get_schedule_table_cache(key: tuple[str, int, str, bool]) -> dict[str, Any] | None:
    cached = _SCHEDULE_TABLE_CACHE.get(key)
    if cached is None:
        return None
    _SCHEDULE_TABLE_CACHE.move_to_end(key)
    return deepcopy(cached)


def _set_schedule_table_cache(
    key: tuple[str, int, str, bool], payload: dict[str, Any]
) -> None:
    _SCHEDULE_TABLE_CACHE[key] = deepcopy(payload)
    _SCHEDULE_TABLE_CACHE.move_to_end(key)
    while len(_SCHEDULE_TABLE_CACHE) > _SCHEDULE_TABLE_CACHE_MAX:
        _SCHEDULE_TABLE_CACHE.popitem(last=False)


from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import PlainTextResponse
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
from bim_ai.agent_review_readout_consistency_closure import (
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.architecture_lens_query import build_architecture_lens_query
from bim_ai.ai_boundary import empty_external_model_call_audit_csv, load_bill_of_rights_markdown
from bim_ai.codes import BUILDING_PRESETS
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
from bim_ai.services.agent_loop import (
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
from bim_ai.services.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.integrity_preflight import build_integrity_preflight_report
from bim_ai.query_resolve import query_elements, qa_advisor
from bim_ai.reverse_bim import (
    build_mcp_authoring_readiness,
    build_reverse_bim_phase_packet,
)
from bim_ai.reverse_bim.evidence_requirements import build_reverse_bim_evidence_requirements
from bim_ai.reverse_bim.handoff_regeneration import build_reverse_bim_handoff_regeneration_plan
from bim_ai.reverse_bim.readback import build_reverse_bim_readback_comparison
from bim_ai.reverse_bim.source_revision_persistence import (
    persist_reverse_bim_source_revision_ledger,
)
from bim_ai.reverse_bim.source_revision_ledger import build_reverse_bim_source_revision_ledger
from bim_ai.reverse_bim.visual_capture import build_reverse_bim_view_capture_plan
from bim_ai.renderer_diagnostic_persistence import (
    append_renderer_diagnostic_packet,
    latest_renderer_diagnostic_packet_for_evidence,
    normalize_renderer_diagnostic_packet,
    renderer_diagnostic_packet_embedding,
)
from bim_ai.evidence.room_color_scheme_override_evidence import (
    build_room_color_scheme_override_evidence_v1,
    roomColourSchemeLegendEvidence_v1,
)
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)
from bim_ai.models.api_requests import (
    ReverseBimHybridRunExecuteRequest,
    ReverseBimHybridSliceExecuteRequest,
    SemanticAuthoringRequest,
)
from bim_ai.services.semantic_authoring import (
    UnsupportedSemanticOperationError,
    build_semantic_authoring_bundle,
)
from bim_ai.routes.activity import activity_router
from bim_ai.routes.catalogs import catalogs_router
from bim_ai.routes.commands import commands_router
from bim_ai.routes.deps import (
    PERSPECTIVE_IDS,
    WORKSPACE_LAYOUT_PRESET_IDS,
    document_to_wire,
    get_hub,
    load_model_row,
    resolve_caller_role,
    resolve_token_role,
    violations_wire,
)
from bim_ai.routes.exports import exports_router
from bim_ai.routes.integrity import integrity_router
from bim_ai.routes.markups import markups_router
from bim_ai.routes.imports import imports_router
from bim_ai.routes.query_resolve import query_resolve_router
from bim_ai.routes.presentation import presentation_router
from bim_ai.routes.reverse_bim import reverse_bim_router
from bim_ai.routes.sharing import sharing_router
from bim_ai.routes.sketch import sketch_router
from bim_ai.routes.sketch_product import sketch_product_router
from bim_ai.routes.v3_meta import v3_meta_router
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table, list_schedule_ids
from bim_ai.seed_library import is_seed_library_project_id
from bim_ai.sheet_preview_svg import SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
from bim_ai.sustainability_lca import sustainability_lens_manifest_v1
from bim_ai.structure_lens import structure_analysis_export
from bim_ai.permissions import authorize_command
from bim_ai.milestones import CreateMilestoneBody
from bim_ai.tables import (
    MilestoneRecord,
    ModelRecord,
    ProjectRecord,
    UndoStackRecord,
)
from bim_ai.versioning import commit_context, current_commit_id
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

api_router = APIRouter(prefix="/api")
api_router.include_router(exports_router)
api_router.include_router(commands_router)
api_router.include_router(activity_router)
api_router.include_router(catalogs_router)
api_router.include_router(integrity_router)
api_router.include_router(markups_router)
api_router.include_router(imports_router)
api_router.include_router(query_resolve_router)
api_router.include_router(presentation_router)
api_router.include_router(reverse_bim_router)
api_router.include_router(sharing_router)
api_router.include_router(sketch_router)
api_router.include_router(sketch_product_router)
api_router.include_router(v3_meta_router)


def _get_job_queue() -> JobQueue:
    return get_queue()


class RendererDiagnosticPacketPersistBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    packet: dict[str, Any]
    user_id: str | None = Field(default="local-dev", alias="userId")


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
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
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
    model_id: Annotated[str, Query(alias="modelId")],
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
) -> list[dict[str, Any]]:
    return [job.model_dump(by_alias=True) for job in queue.list_for_model(model_id)]


@api_router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
) -> dict[str, Any]:
    job = queue.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.model_dump(by_alias=True)


@api_router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
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
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
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
async def bootstrap(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, Any]:
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    expandLinks: bool = False,  # noqa: N803 — wire-format alias
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
    session: Annotated[AsyncSession, Depends(get_session)],
    query: str = "",
    category: str | None = None,
    disciplineTag: Annotated[str | None, Query()] = None,  # noqa: N803 — wire-format alias
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
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
    session: Annotated[AsyncSession, Depends(get_session)],
    fromRev: Annotated[int | None, Query(ge=1)] = None,  # noqa: N803 — wire-format alias
    toRev: Annotated[int | None, Query(ge=1)] = None,  # noqa: N803
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    debug: Annotated[bool, Query()] = False,
) -> dict[str, Any]:
    """PERF-A05: when `debug=true`, response includes `_perfDebug` with
    docValidateMs, violationsMs, summaryMs, totalMs phase timings.
    """
    import time as _time

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    total_start = _time.perf_counter()
    t0 = _time.perf_counter()
    doc = Document.model_validate(row.document)
    validate_ms = (_time.perf_counter() - t0) * 1000.0
    t0 = _time.perf_counter()
    viols = violations_wire(doc.elements)
    violations_ms = (_time.perf_counter() - t0) * 1000.0
    t0 = _time.perf_counter()
    summary = compute_model_summary(doc)
    summary_ms = (_time.perf_counter() - t0) * 1000.0
    err_ct = sum(1 for x in viols if x.get("severity") == "error")
    block_ct = sum(1 for x in viols if x.get("blocking") is True)
    payload: dict[str, Any] = {
        "modelId": str(model_id),
        "revision": doc.revision,
        "violations": viols,
        "summary": summary,
        "checks": {"errorViolationCount": err_ct, "blockingViolationCount": block_ct},
    }
    if debug:
        payload["_perfDebug"] = {
            "totalMs": round((_time.perf_counter() - total_start) * 1000.0, 3),
            "docValidateMs": round(validate_ms, 3),
            "violationsMs": round(violations_ms, 3),
            "summaryMs": round(summary_ms, 3),
        }
    return payload


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
    session: Annotated[AsyncSession, Depends(get_session)],
    profile: Annotated[str, Query()] = "authoring_default",
    phase_filter: Annotated[str, Query(alias="phaseFilter")] = "all",
    option_locks: Annotated[str | None, Query(alias="optionLocks")] = None,
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
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {"modelId": str(model_id), **fire_safety_lens_review_status(doc)}


@api_router.get("/models/{model_id}/cost-quantity-lens")
async def cost_quantity_lens_status(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {"modelId": str(model_id), **cost_quantity_lens_review_status(doc)}


@api_router.get("/models/{model_id}/constructability-bcf")
async def constructability_bcf_export(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    profile: Annotated[str, Query()] = "authoring_default",
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
    session: Annotated[AsyncSession, Depends(get_session)],
    from_revision: Annotated[int | None, Query(alias="fromRevision")] = None,
    to_revision: Annotated[int | None, Query(alias="toRevision")] = None,
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {"modelId": str(model_id), "revision": doc.revision, **build_mep_lens_payload(doc)}


@api_router.get("/models/{model_id}/sustainability")
async def sustainability_lens_projection(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    mode: Annotated[str, Query()] = "default",
) -> dict[str, Any]:
    """PERF-D06: mode=summary|default|full.

    - `summary` skips the deterministic*Evidence + evidenceClosureReview
      chain and the downstream agentReview*/agentBrief*/QA-checklist
      readouts. Use it for UI panels that just need
      validate/scheduleIds/summary/elementCount.
    - `default` is the historical full payload (back-compat).
    - `full` is currently identical to `default`; kept as a forward seat
      for verbose debug/profiling additions.
    """
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    normalised = mode.strip().lower()
    if normalised not in {"summary", "default", "full"}:
        raise HTTPException(
            status_code=400, detail="mode must be one of summary|default|full"
        )
    doc = Document.model_validate(row.document)
    # PERF-D08: surface wall-clock probe in the payload so the Agent Review
    # performance gate can flip from advisory mock to a real budget-backed
    # warning. Budget threshold (ms) here matches the small.evidence_package
    # CI budget (1500 ms); larger fixtures will need their own thresholds.
    import time as _ep_time

    _ep_start = _ep_time.perf_counter()
    payload = build_evidence_package_payload(
        model_id=model_id,
        doc=doc,
        source_document=row.document,
        mode=normalised,
    )
    payload["_packageGenerationMs"] = round((_ep_time.perf_counter() - _ep_start) * 1000.0, 2)
    payload["_packageGenerationBudgetMs"] = 1500.0
    payload["_packageGenerationOverBudget"] = bool(
        payload["_packageGenerationMs"] > payload["_packageGenerationBudgetMs"]
    )
    return payload


def build_evidence_package_payload(
    *,
    model_id: UUID,
    doc: Document,
    source_document: dict[str, Any] | None = None,
    mode: str = "default",
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
    payload["_packageMode"] = mode
    if mode == "summary":
        # PERF-D06: short-circuit before the deterministic*Evidence +
        # evidenceClosureReview + agentReview*/agentBrief*/QA chain. The
        # caller asked for the lightweight summary surface (validate +
        # planViews + scheduleIds + summary + digest).
        return payload
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return room_derivation_candidates_review(doc)


@api_router.get("/models/{model_id}/registry/type-material")
async def type_material_registry(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    plan_view_id: Annotated[str | None, Query(alias="planViewId")] = None,
    fallback_level_id: Annotated[str | None, Query(alias="fallbackLevelId")] = None,
    global_plan_presentation: Annotated[str, Query(alias="globalPresentation")] = "default",
    debug: Annotated[bool, Query()] = False,
) -> dict[str, Any]:
    """PERF-F03: when `debug=true`, the response includes a `_perfDebug`
    block (totalMs, cacheHit, docValidateMs, projectionMs, primitiveCount).
    Debug requests bypass the cross-request cache so the timings reflect
    actual recomputation cost; default requests are unchanged.
    """
    import time as _time

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
    if not debug:
        cached = _get_plan_projection_cache(cache_key)
        if cached is not None:
            return cached
    total_start = _time.perf_counter()
    validate_start = _time.perf_counter()
    doc = Document.model_validate(row.document)
    validate_ms = (_time.perf_counter() - validate_start) * 1000.0
    proj_start = _time.perf_counter()
    payload = plan_projection_wire_from_request(
        doc,
        plan_view_id=plan_view_id,
        fallback_level_id=fallback_level_id,
        global_plan_presentation=global_plan_presentation,
    )
    proj_ms = (_time.perf_counter() - proj_start) * 1000.0
    _set_plan_projection_cache(cache_key, payload)
    if debug:
        total_ms = (_time.perf_counter() - total_start) * 1000.0
        prims = payload.get("primitives")
        primitive_count = len(prims) if isinstance(prims, list) else None
        out = deepcopy(payload)
        out["_perfDebug"] = {
            "totalMs": round(total_ms, 3),
            "cacheHit": False,
            "docValidateMs": round(validate_ms, 3),
            "projectionMs": round(proj_ms, 3),
            "primitiveCount": primitive_count,
        }
        return out
    return deepcopy(payload)


@api_router.get("/models/{model_id}/projection/section/{section_cut_id}")
async def projection_section_wire_route(
    model_id: UUID,
    section_cut_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    body: SemanticAuthoringRequest,
) -> Any:
    operation = _SEMANTIC_SURFACE_ALIASES.get(surface_id, surface_id)
    try:
        bundle = build_semantic_authoring_bundle(operation, body.model_dump(by_alias=True))
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


@api_router.post("/v3/models/{model_id}/reverse-bim/hybrid-slice-execute")
async def reverse_bim_hybrid_slice_execute_route(
    model_id: UUID,
    body: ReverseBimHybridSliceExecuteRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
    token: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """Run one hybrid reverse-BIM authoring slice through the live bundle route."""

    body_dict: dict[str, Any] = body.model_dump(by_alias=True)
    phase = body_dict.get("phase") if isinstance(body_dict.get("phase"), dict) else {}
    phase_id = str(phase.get("phaseId") or phase.get("id") or body_dict.get("phaseId") or "unknown")
    source_facts = (
        body_dict.get("facts")
        or body_dict.get("sourceFacts")
        or body_dict.get("extractedFacts")
        or []
    )
    mcp_readiness = body_dict.get("mcpReadiness") or body_dict.get("mcp_readiness")
    if not isinstance(mcp_readiness, dict) and isinstance(source_facts, list):
        mcp_readiness = build_mcp_authoring_readiness(
            facts=source_facts,
            target_phase=phase_id,
        )
    if not isinstance(mcp_readiness, dict):
        mcp_readiness = {"ok": True, "summary": {"blockerCount": 0}, "rows": []}

    expected_readback = _hybrid_expected_readback(body_dict, phase)
    source_fact_ids = _hybrid_source_fact_ids(body_dict, phase, expected_readback)
    if int((mcp_readiness.get("summary") or {}).get("blockerCount") or 0) and not body_dict.get(
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

    bundle_payload = body_dict.get("bundle") or body_dict.get("commandBundle")
    if not isinstance(bundle_payload, dict):
        raise HTTPException(status_code=422, detail="bundle or commandBundle is required")

    user_id = str(body_dict.get("userId") or body_dict.get("user_id") or "local-dev")
    submitter = str(body_dict.get("submitter") or "agent")
    actor_kind = body_dict.get("actorKind") or body_dict.get("actor_kind") or "agent"
    client_op_id = body_dict.get("clientOpId") or body_dict.get("client_op_id")
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
    dry_run_evidence = (
        dry_run_result.get("dryRunEvidence") if isinstance(dry_run_result, dict) else None
    )
    commit_requested = bool(body_dict.get("commit") or body_dict.get("mode") == "commit")
    commit_result: dict[str, Any] | None = None
    if (
        commit_requested
        and isinstance(dry_run_evidence, dict)
        and dry_run_evidence.get("ok") is True
    ):
        commit_request = _hybrid_bundle_request(
            bundle_payload=bundle_payload,
            mode="commit",
            user_id=user_id,
            submitter=submitter,
            actor_kind=actor_kind,
            client_op_id=client_op_id,
            dry_run_evidence=dry_run_evidence,
        )
        slice_ctx = _hybrid_slice_commit_context(
            body_dict=body_dict,
            phase=phase,
            phase_id=phase_id,
            source_fact_ids=source_fact_ids,
            user_id=user_id,
            submitter=submitter,
        )
        slice_summary = f"hybrid slice: phase={phase_id}"
        async with commit_context(
            session,
            model_id=model_id,
            summary=slice_summary,
            context=slice_ctx,
        ):
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
    queried_elements = (query_result.get("data") or {}).get("elements") or []
    readback_comparison = build_reverse_bim_readback_comparison(
        expected_readback=expected_readback,
        model_readback=body_dict.get("modelReadback") or body_dict.get("readback"),
        elements=queried_elements,
        tolerance_defaults=body_dict.get("toleranceDefaults")
        or body_dict.get("tolerance_defaults"),
    )
    advisor = qa_advisor(
        str(model_id),
        doc,
        {"profile": body_dict.get("advisorProfile") or "authoring_default", "limit": 500},
    )
    constructability = {
        "modelId": str(model_id),
        **build_constructability_report(
            doc.elements,
            revision=doc.revision,
            profile=str(body_dict.get("constructabilityProfile") or "authoring_default"),
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
        source_overlay=body_dict.get("sourceOverlay") or body_dict.get("source_overlay"),
        advisor=advisor,
        constructability=constructability,
        integrity=integrity,
        facts=source_facts if isinstance(source_facts, list) else [],
    )
    source_revision_ledger = build_reverse_bim_source_revision_ledger(
        facts=source_facts if isinstance(source_facts, list) else [],
        source_spec_revision=source_spec_revision,
        existing_ledger=body_dict.get("sourceRevisionLedger")
        or body_dict.get("source_revision_ledger"),
        phase_authoring_spec=body_dict.get("phaseAuthoringSpec") or body_dict.get("phaseSpec"),
    )
    source_revision_ledger_persistence = None
    output_dir = body_dict.get("outputDir") or body_dict.get("output_dir")
    if output_dir:
        source_revision_ledger_persistence = persist_reverse_bim_source_revision_ledger(
            output_dir=output_dir,
            source_revision_ledger=source_revision_ledger,
            run_id=body_dict.get("runId") or body_dict.get("run_id") or phase_id,
        )
    evidence_package = {
        "modelSummary": compute_model_summary(doc),
        "queryElements": query_result,
        "readbackComparison": readback_comparison,
        "sourceSpecRevision": source_spec_revision,
        "sourceRevisionLedger": source_revision_ledger,
        "sourceRevisionLedgerPersistence": source_revision_ledger_persistence,
    }
    phase_packet = build_reverse_bim_phase_packet(
        phase_id=phase_id,
        start_revision=(
            bundle_payload.get("parentRevision") if isinstance(bundle_payload, dict) else None
        ),
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
        finding_dispositions=body_dict.get("findingDispositions") or [],
    )
    evidence_requirements = body_dict.get("evidenceRequirements") or body_dict.get(
        "evidence_requirements"
    )
    if not isinstance(evidence_requirements, dict) and (
        body_dict.get("sourcePageIndex")
        or body_dict.get("source_page_index")
        or body_dict.get("requireVisualEvidence")
        or body_dict.get("require_visual_evidence")
    ):
        evidence_requirements = build_reverse_bim_evidence_requirements(
            source_page_index=body_dict.get("sourcePageIndex")
            or body_dict.get("source_page_index"),
            source_facts=source_facts if isinstance(source_facts, list) else [],
            phase_authoring_spec=body_dict.get("phaseAuthoringSpec") or body_dict.get("phaseSpec"),
        )
    view_capture_plan = body_dict.get("viewCapturePlan") or body_dict.get("view_capture_plan")
    if not isinstance(view_capture_plan, dict) and isinstance(evidence_requirements, dict):
        required_evidence_count = int(
            (evidence_requirements.get("summary") or {}).get("requiredEvidenceCount") or 0
        )
        capture_output_dir = (
            body_dict.get("viewCaptureOutputDir")
            or body_dict.get("view_capture_output_dir")
            or body_dict.get("outputDir")
            or body_dict.get("output_dir")
        )
        if required_evidence_count and capture_output_dir:
            view_capture_plan = build_reverse_bim_view_capture_plan(
                model_id=str(model_id),
                required_ui_views=evidence_requirements.get("requiredUiViews")
                or evidence_requirements.get("required_ui_views"),
                required_overlay_views=evidence_requirements.get("requiredOverlayViews")
                or evidence_requirements.get("required_overlay_views"),
                output_dir=str(capture_output_dir),
                base_url=body_dict.get("viewCaptureBaseUrl")
                or body_dict.get("view_capture_base_url")
                or body_dict.get("baseUrl")
                or body_dict.get("base_url"),
                run_id=body_dict.get("runId") or body_dict.get("run_id") or phase_id,
                viewport=body_dict.get("captureViewport") or body_dict.get("viewport"),
            )
    source_overlay = body_dict.get("sourceOverlay") or body_dict.get("source_overlay")
    ui_evidence = body_dict.get("uiEvidence") or body_dict.get("ui_evidence")
    slice_report = build_hybrid_reverse_bim_slice_report(
        phase={"phaseId": phase_id},
        mcp_readiness=mcp_readiness,
        readback_comparison=readback_comparison,
        phase_packet=phase_packet if commit_result else None,
        source_spec_revision=source_spec_revision,
        source_overlay=source_overlay,
        ui_evidence=ui_evidence,
        evidence_requirements=evidence_requirements
        if isinstance(evidence_requirements, dict)
        else None,
        view_capture_plan=view_capture_plan if isinstance(view_capture_plan, dict) else None,
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
        "sourceRevisionLedgerPersistence": source_revision_ledger_persistence,
        "evidenceRequirements": evidence_requirements,
        "viewCapturePlan": view_capture_plan,
        "phasePacket": phase_packet,
        "sliceReport": slice_report,
        "nextStep": slice_report.get("nextStep"),
    }


@api_router.post("/v3/models/{model_id}/reverse-bim/hybrid-run-execute")
async def reverse_bim_hybrid_run_execute_route(
    model_id: UUID,
    body: ReverseBimHybridRunExecuteRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
    token: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """Execute an ordered list of reverse-BIM slices and stop on blockers."""

    body_dict: dict[str, Any] = body.model_dump(by_alias=True)
    slices = [row for row in body_dict.get("slices") or [] if isinstance(row, dict)]
    if not slices:
        raise HTTPException(status_code=422, detail="slices must contain at least one slice body")
    continue_on_blockers = bool(
        body_dict.get("continueOnBlockers") or body_dict.get("continue_on_blockers")
    )
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
        "evidenceRequirements",
        "evidence_requirements",
        "sourcePageIndex",
        "source_page_index",
        "viewCapturePlan",
        "view_capture_plan",
        "viewCaptureOutputDir",
        "view_capture_output_dir",
        "viewCaptureBaseUrl",
        "view_capture_base_url",
        "captureViewport",
        "requireVisualEvidence",
        "require_visual_evidence",
        "outputDir",
        "output_dir",
        "runId",
        "run_id",
    }
    common = {key: body_dict[key] for key in common_keys if key in body_dict}
    results = []
    stopped = False
    for slice_body in slices:
        merged_body = {**common, **slice_body}
        result = await reverse_bim_hybrid_slice_execute_route(
            model_id,
            ReverseBimHybridSliceExecuteRequest.model_validate(merged_body),
            session=session,
            hub=hub,
            token=token,
        )
        results.append(result)
        if result.get("ok") is not True and not continue_on_blockers:
            stopped = True
            break

    phase_packets = [
        row.get("phasePacket") for row in results if isinstance(row.get("phasePacket"), dict)
    ]
    slice_reports = [
        row.get("sliceReport") for row in results if isinstance(row.get("sliceReport"), dict)
    ]
    run_report = build_hybrid_reverse_bim_run_report(
        phase_authoring_spec=body_dict.get("phaseAuthoringSpec")
        or body_dict.get("phaseSpec")
        or {},
        phase_packets=phase_packets,
        slice_reports=slice_reports,
        package_acceptance=body_dict.get("packageAcceptance") or body_dict.get("folderOutput"),
    )
    latest_source_revision_ledger = None
    for row in reversed(results):
        if isinstance(row.get("sourceRevisionLedger"), dict):
            latest_source_revision_ledger = row.get("sourceRevisionLedger")
            break
    handoff_regeneration = None
    if latest_source_revision_ledger:
        handoff_regeneration = build_reverse_bim_handoff_regeneration_plan(
            facts=body_dict.get("facts")
            or body_dict.get("sourceFacts")
            or body_dict.get("extractedFacts"),
            source_revision_ledger=latest_source_revision_ledger,
            phase_authoring_spec=body_dict.get("phaseAuthoringSpec") or body_dict.get("phaseSpec"),
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
        "latestSourceRevisionLedger": latest_source_revision_ledger,
        "handoffRegeneration": handoff_regeneration,
        "runReport": run_report,
        "nextStep": (
            "All requested slices executed and accepted."
            if run_report.get("ok") and not stopped
            else "Repair the first blocked slice using handoffRegeneration/readerRepairRequests when present, then rerun from that slice."
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


def _hybrid_expected_readback(
    body_dict: dict[str, Any], phase: dict[str, Any]
) -> list[dict[str, Any]]:
    direct = (
        body_dict.get("expectedReadback")
        or body_dict.get("expected_readback")
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
    body_dict: dict[str, Any],
    phase: dict[str, Any],
    expected_readback: list[dict[str, Any]],
) -> list[str]:
    ids = []
    for value in (
        body_dict.get("sourceFactIds"),
        body_dict.get("source_fact_ids"),
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


_ITERATION_PATH_RE = re.compile(r"(?:^|/)iter[-_]?(\d+[a-z]?)(?:[-_/]|$)", re.IGNORECASE)
_HOUSE_PATH_RE = re.compile(r"(?:^|/)house[-_/]([a-z0-9]+)(?:[-_/]|$)", re.IGNORECASE)


def _infer_iteration_label(*candidates: Any) -> str | None:
    for value in candidates:
        if not isinstance(value, str):
            continue
        match = _ITERATION_PATH_RE.search(value)
        if match:
            return f"iter-{match.group(1).lower()}"
    return None


def _infer_house_name(*candidates: Any) -> str | None:
    for value in candidates:
        if not isinstance(value, str):
            continue
        match = _HOUSE_PATH_RE.search(value)
        if match:
            return match.group(1).lower()
    return None


def _hybrid_slice_commit_context(
    *,
    body_dict: dict[str, Any],
    phase: dict[str, Any],
    phase_id: str,
    source_fact_ids: list[str],
    user_id: str,
    submitter: str,
) -> dict[str, Any]:
    """Build the agent-context payload for a hybrid-slice commit.

    See spec/model-time-travel-tracker.md "Commit Semantics" for the
    conventional fields. Missing fields are tolerated by the inspector.
    """

    slice_id = (
        body_dict.get("sliceId")
        or body_dict.get("slice_id")
        or phase.get("sliceId")
        or phase.get("slice_id")
    )
    output_dir = body_dict.get("outputDir") or body_dict.get("output_dir")
    iteration_label = (
        body_dict.get("iterationLabel")
        or body_dict.get("iteration_label")
        or phase.get("iterationLabel")
        or phase.get("iteration_label")
        or _infer_iteration_label(output_dir)
    )
    house_name = (
        body_dict.get("houseName")
        or body_dict.get("house_name")
        or phase.get("houseName")
        or phase.get("house_name")
        or _infer_house_name(output_dir)
    )
    session_id = (
        body_dict.get("sessionId")
        or body_dict.get("session_id")
        or body_dict.get("clientOpId")
        or body_dict.get("client_op_id")
    )
    return {
        "source": "mcp_slice",
        "phaseId": phase_id,
        "sliceId": str(slice_id) if slice_id else None,
        "iterationLabel": str(iteration_label) if iteration_label else None,
        "houseName": str(house_name) if house_name else None,
        "outputDir": str(output_dir) if output_dir else None,
        "sessionId": str(session_id) if session_id else None,
        "submitter": submitter,
        "userId": user_id,
        "factIds": list(source_fact_ids),
        "methodologyVersion": "2026-05-22",
        "commandSchemaVersion": "2026-05-22",
    }


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


# ---------------------------------------------------------------------------
# Structure lens handoff route
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/structure/analysis-export")
async def structure_analysis_export_route(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    fmt: Annotated[str, Query(alias="format")] = "json",
    columns: Annotated[str | None, Query(alias="columns")] = None,
    include_schedule_totals_csv: Annotated[bool, Query(alias="includeScheduleTotalsCsv")] = False,
    lightweight: Annotated[bool, Query()] = False,
) -> dict[str, Any] | PlainTextResponse:
    """PERF-F06: `?lightweight=true` skips the expensive room programme
    closure pass (peer_finish_set_by_level +
    room_finish_schedule_row_extensions) for room/finish schedules. Other
    category types are unaffected. Use for lightweight grid display
    surfaces that don't need the finish-set closure.
    """
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    # PERF-F04: cross-request cache keyed by
    # (model_id, revision, schedule_id, lightweight).
    # columns/format/totals only affect post-processing, not the derivation.
    cache_key = _schedule_table_cache_key(
        model_id=model_id,
        revision=_row_revision(row),
        schedule_id=schedule_id,
        lightweight=lightweight,
    )
    payload = _get_schedule_table_cache(cache_key)
    if payload is None:
        doc = Document.model_validate(row.document)
        try:
            payload = derive_schedule_table(doc, schedule_id, lightweight=lightweight)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        _set_schedule_table_cache(cache_key, payload)
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
# AGT-01 — Agent iterate endpoint
# ---------------------------------------------------------------------------


@api_router.post("/models/{model_id}/agent-iterate")
async def agent_iterate(
    model_id: UUID,
    body: AgentIterateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
    token: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """CMD-V3-01: submit a CommandBundle; returns BundleResult.

    mode='dry_run' (default) — validates without mutating.
    mode='commit'            — commits if no blocking advisories fire.
    HTTP 409 on revision_conflict or assumption_log_required / malformed.
    HTTP 403 when the caller's role forbids the command verb (COL-V3-02).
    """
    from datetime import UTC, datetime

    from bim_ai.engine import compute_delta_wire, diff_undo_cmds
    from bim_ai.routes.deps import delete_redos, document_to_wire
    from bim_ai.tables import UndoStackRecord
    from bim_ai.transaction_metadata import build_transaction_metadata, command_bundle_digest

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    # COL-V3-02: resolve caller role and gate commands.
    if token:
        caller_role = await resolve_token_role(session, str(model_id), token)
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
                commit_id=current_commit_id(),
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
# VER-V3-01 — Activity stream routes
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/activity")
async def list_activity(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = 50,
    before: int | None = None,
    kind: str | None = None,
    author_id: Annotated[str | None, Query(alias="authorId")] = None,
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
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
) -> dict[str, Any]:
    from bim_ai.activity import emit_activity_row
    from bim_ai.engine import compute_delta_wire
    from bim_ai.routes.deps import document_to_wire
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

    # PERF-E04: websocket bootstrap timing telemetry.
    import time as _time

    from bim_ai._io.log import get_logger as _ws_get_logger

    _ws_log = _ws_get_logger("bim_ai.ws_bootstrap")
    bootstrap_start = _time.perf_counter()
    try:
        if resume_from is None:
            doc = Document.model_validate(row.document)
            should_send_snapshot = send_initial_snapshot or (
                snapshot_revision is not None and snapshot_revision != doc.revision
            )
            if should_send_snapshot:
                violations_start = _time.perf_counter()
                viols = violations_wire(doc.elements)
                violations_ms = (_time.perf_counter() - violations_start) * 1000.0
                send_start = _time.perf_counter()
                snapshot_payload = {
                    "type": "snapshot",
                    "modelId": sid,
                    "revision": doc.revision,
                    "elements": {
                        k: el.model_dump(by_alias=True) for k, el in doc.elements.items()
                    },
                    "violations": viols,
                }
                await websocket.send_json(snapshot_payload)
                send_ms = (_time.perf_counter() - send_start) * 1000.0
                _ws_log.info(
                    "ws snapshot send",
                    extra={
                        "model_id": sid,
                        "revision": doc.revision,
                        "element_count": len(doc.elements),
                        "violations_count": len(viols),
                        "violations_ms": round(violations_ms, 2),
                        "send_ms": round(send_ms, 2),
                        "total_bootstrap_ms": round(
                            (_time.perf_counter() - bootstrap_start) * 1000.0, 2
                        ),
                        "mode": "snapshot",
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
                _ws_log.info(
                    "ws snapshot skip",
                    extra={
                        "model_id": sid,
                        "revision": doc.revision,
                        "mode": "skip",
                        "total_bootstrap_ms": round(
                            (_time.perf_counter() - bootstrap_start) * 1000.0, 2
                        ),
                    },
                )
        else:
            replayed = hub.resume(sid, resume_from)
            if replayed is None:
                await websocket.send_json({"type": "RESYNC", "modelId": sid})
                _ws_log.info(
                    "ws resume RESYNC",
                    extra={
                        "model_id": sid,
                        "resume_from": resume_from,
                        "mode": "resync",
                        "total_bootstrap_ms": round(
                            (_time.perf_counter() - bootstrap_start) * 1000.0, 2
                        ),
                    },
                )
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
                _ws_log.info(
                    "ws resume replay",
                    extra={
                        "model_id": sid,
                        "resume_from": resume_from,
                        "replay_count": len(replayed),
                        "mode": "replay",
                        "total_bootstrap_ms": round(
                            (_time.perf_counter() - bootstrap_start) * 1000.0, 2
                        ),
                    },
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
    subspace: Annotated[str, Query()] = "kernel",
    token: Annotated[str | None, Query()] = None,
    user_id: Annotated[str, Query(alias="userId")] = "local-dev",
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
                caller_role = await resolve_token_role(session, str(model_id), token)
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
# TKN-V3-01 — token encode / decode / diff endpoints
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/tokens/encode")
async def tokens_encode(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
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
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: Annotated[str, Query(alias="userId")] = "local-dev",
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
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: Annotated[str, Query(alias="userId")] = "local-dev",
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
    session: Annotated[AsyncSession, Depends(get_session)],
    status: Annotated[str | None, Query()] = None,
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
    session: Annotated[AsyncSession, Depends(get_session)],
    format: Annotated[str, Query()] = "metadata-only",
    viewId: Annotated[str | None, Query()] = None,
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
