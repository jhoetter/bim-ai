from __future__ import annotations

import logging
import time
from collections import OrderedDict
from copy import deepcopy
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel, Field, TypeAdapter, ValidationError
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai._io.log import get_logger as _ws_log_factory
from bim_ai.activity import emit_activity_row
from bim_ai.ai_boundary import empty_external_model_call_audit_csv, load_bill_of_rights_markdown
from bim_ai.architecture_lens_query import build_architecture_lens_query
from bim_ai.assets import search_assets
from bim_ai.brief_acceptance_readout import agent_brief_acceptance_readout_v1
from bim_ai.brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.bundle_qa_checklist import (
    agent_generated_bundle_qa_checklist_v1,
)
from bim_ai.codes import BUILDING_PRESETS
from bim_ai.commands import Command
from bim_ai.constructability_bcf import build_constructability_bcf_export
from bim_ai.constructability_report import (
    build_constructability_report,
    build_constructability_summary_v1,
)
from bim_ai.construction_lens import build_construction_lens_payload
from bim_ai.coordination_lens import build_coordination_lens_snapshot
from bim_ai.cost_quantity import cost_quantity_lens_review_status
from bim_ai.db import SessionMaker, get_session
from bim_ai.diff_engine import compute_element_diff
from bim_ai.document import Document
from bim_ai.elements import Element, LevelElem, LinkModelElem, PlanViewElem
from bim_ai.energy_lens import build_energy_handoff_payload
from bim_ai.engine import (
    clone_document,
    compute_delta_wire,
    ensure_cardinal_elevation_views,
    ensure_internal_origin,
    ensure_seed_hatches,
    ensure_sun_settings,
    try_commit_bundle,
)
from bim_ai.evidence.room_color_scheme_override_evidence import (
    build_room_color_scheme_override_evidence_v1,
    roomColourSchemeLegendEvidence_v1,
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
from bim_ai.evidence_review_loop import agent_review_actions_v1, bcf_topics_index_v1
from bim_ai.fire_safety_lens import fire_safety_lens_review_status
from bim_ai.hub import Hub
from bim_ai.jobs.evidence_package import (
    EvidencePackageJobStore,
    get_evidence_package_job_store,
    submit_evidence_package_job,
)
from bim_ai.jobs.queue import JobQueue, get_queue
from bim_ai.jobs.types import CreateJobRequest, Job
from bim_ai.link_expansion import expand_links
from bim_ai.mep_lens import build_mep_lens_payload
from bim_ai.model_summary import compute_model_summary

# SemanticAuthoringRequest model deleted with the semantic-authoring route
# (moved to bim-agent in the 2026-05-25 clean-separation work).
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
    section_cut_projection_wire,
)
from bim_ai.prd_blocking_advisor_matrix import build_prd_blocking_advisor_matrix
from bim_ai.renderer_diagnostic_persistence import (
    latest_renderer_diagnostic_packet_for_evidence,
    renderer_diagnostic_packet_embedding,
)
from bim_ai.review_readout_consistency_closure import (
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)
from bim_ai.routes.activity import activity_router
from bim_ai.routes.bundles import bundles_router
from bim_ai.routes.catalogs import catalogs_router
from bim_ai.routes.commands import commands_router
from bim_ai.routes.concept_seeds import concept_seeds_router
from bim_ai.routes.deps import (
    PERSPECTIVE_IDS,
    WORKSPACE_LAYOUT_PRESET_IDS,
    document_to_wire,
    get_hub,
    load_model_row,
    violations_wire,
)
from bim_ai.routes.exports import exports_router
from bim_ai.routes.imports import imports_router
from bim_ai.routes.integrity import integrity_router
from bim_ai.routes.markups import markups_router
from bim_ai.routes.milestones import milestones_router
from bim_ai.routes.pixel_map import pixel_map_router
from bim_ai.routes.presentation import presentation_router
from bim_ai.routes.query_resolve import query_resolve_router
from bim_ai.routes.render_export import render_export_router
from bim_ai.routes.renderer_diagnostics import renderer_diagnostics_router
from bim_ai.routes.schedules import schedules_router
from bim_ai.routes.sharing import sharing_router
from bim_ai.routes.site_import import site_import_router
from bim_ai.routes.sketch import sketch_router
from bim_ai.routes.sketch_product import sketch_product_router
from bim_ai.routes.tokens import tokens_router
from bim_ai.routes.v3_capture import v3_capture_router
from bim_ai.routes.v3_meta import v3_meta_router
from bim_ai.routes.ws_bootstrap import ws_bootstrap_router
from bim_ai.schedule_derivation import list_schedule_ids
from bim_ai.seed_library import is_seed_library_project_id
from bim_ai.services.iterate_loop import (
    AgentIterateRequest,
    AgentIterateResponse,
    generate_patch,
)

# bim_ai.services.semantic_authoring moved to bim-agent — see
# spec/trackers/bim-ai-bim-agent-clean-separation-tracker.md phase 3
from bim_ai.sheet_preview_svg import SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
from bim_ai.structure_lens import structure_analysis_export
from bim_ai.sustainability_lca import sustainability_lens_manifest_v1
from bim_ai.tables import (
    ActivityRowRecord,
    ModelRecord,
    ProjectRecord,
    UndoStackRecord,
)
from bim_ai.template_loader import (
    list_templates,
    load_template_snapshot,
    template_exists,
)
from bim_ai.type_material_registry import merged_registry_payload
from bim_ai.v1_acceptance_proof_matrix import build_v1_acceptance_proof_matrix_v1
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1

logger = logging.getLogger(__name__)

# PERF-F03: cross-request plan-projection cache keyed by
# (model_id, revision, plan_view_id, fallback_level_id, presentation).
# Repeated /projection/plan requests for unchanged revisions skip the
# plan_projection_wire_from_request call which is the dominant cost.
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
api_router.include_router(sharing_router)
api_router.include_router(sketch_router)
api_router.include_router(sketch_product_router)
api_router.include_router(v3_meta_router)
api_router.include_router(v3_capture_router)
# BRT-24: route families extracted from this file.
api_router.include_router(bundles_router)
api_router.include_router(schedules_router)
api_router.include_router(tokens_router)
api_router.include_router(milestones_router)
api_router.include_router(pixel_map_router)
api_router.include_router(site_import_router)
api_router.include_router(concept_seeds_router)
api_router.include_router(render_export_router)
api_router.include_router(renderer_diagnostics_router)
api_router.include_router(ws_bootstrap_router)


def _get_job_queue() -> JobQueue:
    return get_queue()


def _get_evidence_package_job_store() -> EvidencePackageJobStore:
    return get_evidence_package_job_store()


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


@api_router.get("/jobs/{job_id}/result")
async def get_job_result(
    job_id: str,
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
    evidence_store: Annotated[
        EvidencePackageJobStore, Depends(_get_evidence_package_job_store)
    ],
) -> dict[str, Any]:
    """PERF-D07: fetch a completed job's payload.

    Currently supports ``kind="evidence_package"`` only — the payload is
    returned shape-identical to the sync ``GET /api/models/{id}/evidence-package``
    response. Returns 404 if the job is unknown, 409 if it has not finished
    yet, and 410 if its result was evicted from the in-memory LRU.
    """

    job = queue.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if job.kind != "evidence_package":
        raise HTTPException(
            status_code=400,
            detail=f"result endpoint not supported for job kind {job.kind!r}",
        )
    if job.status == "errored":
        raise HTTPException(
            status_code=500,
            detail=job.error_message or "job errored",
        )
    if job.status in ("queued", "running"):
        raise HTTPException(status_code=409, detail="job not finished")
    if job.status == "cancelled":
        raise HTTPException(status_code=409, detail="job was cancelled")
    result = evidence_store.get(job_id)
    if result is None:
        raise HTTPException(
            status_code=410,
            detail="job result evicted from cache; resubmit",
        )
    return {
        "jobId": job_id,
        "modelId": job.model_id,
        "sourceDigestSha256": result.source_digest_sha256,
        "mode": result.mode,
        "completedAt": result.completed_at,
        "payload": result.payload,
    }


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
    _time = time

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
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    queue: Annotated[JobQueue, Depends(_get_job_queue)],
    evidence_store: Annotated[
        EvidencePackageJobStore, Depends(_get_evidence_package_job_store)
    ],
    mode: Annotated[str, Query()] = "default",
    debug: Annotated[bool, Query()] = False,
    async_run: Annotated[bool, Query(alias="async")] = False,
) -> dict[str, Any]:
    """PERF-D06: mode=summary|default|full.

    - `summary` skips the deterministic*Evidence + evidenceClosureReview
      chain and the downstream agentReview*/agentBrief*/QA-checklist
      readouts. Use it for UI panels that just need
      validate/scheduleIds/summary/elementCount.
    - `default` is the historical full payload (back-compat).
    - `full` is currently identical to `default`; kept as a forward seat
      for verbose debug/profiling additions.

    PERF-A05: when `debug=true`, response includes `_perfDebug` with
    docValidateMs, packageBuildMs, totalMs phase timings.

    PERF-D07: when `?async=true`, the build moves off the request path
    onto an in-process background task tracked by the existing job queue.
    The response returns 202 + ``{ "jobId": "...", "status": "queued",
    "sourceDigestSha256": "...", "modelId": "...", "mode": "..." }``;
    poll ``GET /api/jobs/{jobId}`` for status and ``GET
    /api/jobs/{jobId}/result`` once status is ``done`` to fetch the
    same payload shape as the sync path. Sync (default) callers are
    unaffected.
    """
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    normalised = mode.strip().lower()
    if normalised not in {"summary", "default", "full"}:
        raise HTTPException(
            status_code=400, detail="mode must be one of summary|default|full"
        )
    if async_run:
        # PERF-D07: hand the build to the in-process worker and return
        # immediately with a job id. The wire shape on the polled result
        # endpoint matches the sync response exactly.
        doc = Document.model_validate(row.document)
        source_digest = evidence_package_semantic_digest_sha256(
            {"revision": doc.revision, "modelId": str(model_id), "mode": normalised}
        )
        submitted = await submit_evidence_package_job(
            queue=queue,
            store=evidence_store,
            model_id=model_id,
            mode=normalised,
            debug=debug,
            doc=doc,
            source_document=row.document,
            source_digest_sha256=source_digest,
            builder=build_evidence_package_payload,
        )
        response.status_code = 202
        return {
            "jobId": submitted.id,
            "modelId": str(model_id),
            "mode": normalised,
            "status": submitted.status,
            "sourceDigestSha256": source_digest,
            "pollJobHref": f"/api/jobs/{submitted.id}",
            "pollResultHref": f"/api/jobs/{submitted.id}/result",
        }
    # PERF-D08: surface wall-clock probe in the payload so the Agent Review
    # performance gate can flip from advisory mock to a real budget-backed
    # warning. Budget threshold (ms) here matches the small.evidence_package
    # CI budget (1500 ms); larger fixtures will need their own thresholds.
    _ep_time = time

    _ep_start = _ep_time.perf_counter()
    _t0 = _ep_time.perf_counter()
    doc = Document.model_validate(row.document)
    doc_validate_ms = (_ep_time.perf_counter() - _t0) * 1000.0
    _t0 = _ep_time.perf_counter()
    payload = build_evidence_package_payload(
        model_id=model_id,
        doc=doc,
        source_document=row.document,
        mode=normalised,
    )
    package_build_ms = (_ep_time.perf_counter() - _t0) * 1000.0
    payload["_packageGenerationMs"] = round((_ep_time.perf_counter() - _ep_start) * 1000.0, 2)
    payload["_packageGenerationBudgetMs"] = 1500.0
    payload["_packageGenerationOverBudget"] = bool(
        payload["_packageGenerationMs"] > payload["_packageGenerationBudgetMs"]
    )
    if debug:
        payload["_perfDebug"] = {
            "totalMs": round((_ep_time.perf_counter() - _ep_start) * 1000.0, 3),
            "docValidateMs": round(doc_validate_ms, 3),
            "packageBuildMs": round(package_build_ms, 3),
            "mode": normalised,
        }
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
    _time = time

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


# semantic-authoring route deleted; the build_semantic_authoring_bundle
# logic moved to bim-agent in clean-separation phase 3. Agents that want
# semantic→bundle construction should run it locally in bim-agent and
# POST the resulting CommandBundle to the slice-execute route.




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
# Energy lens handoff route
# ---------------------------------------------------------------------------


@api_router.get("/models/{model_id}/energy/handoff")
async def energy_handoff_route(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    scenario_id: Annotated[str | None, Query(alias="scenarioId")] = None,
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_energy_handoff_payload(doc, scenario_id=scenario_id)


# ---------------------------------------------------------------------------
# AGT-01 — Agent iterate endpoint
# ---------------------------------------------------------------------------


@api_router.post("/models/{model_id}/iterate")
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


@api_router.post("/models/{model_id}/agent-iterate", include_in_schema=False)
async def agent_iterate_redirect(model_id: str, request: Request) -> RedirectResponse:
    """Backward-compat: ``agent-iterate`` was renamed to ``iterate`` on 2026-05-25.

    Returns a 308 (permanent + method-preserving) redirect so existing POST
    callers forward their request body to the new URL unchanged. Kept for one
    release cycle; remove once external callers have migrated.
    """
    return RedirectResponse(
        url=str(request.url).replace("/agent-iterate", "/iterate"),
        status_code=308,
    )


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
    _time = time
    _ws_log = _ws_log_factory("bim_ai.ws_bootstrap")
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
                # PERF-E07: drop ``None``-valued fields from the initial snapshot.
                # Safe at this boundary because ``hydrateFromSnapshot`` rebuilds
                # FE state from scratch (no merge-with-prior), and all element
                # coercion paths (``packages/web/src/state/coercion/*``,
                # ``storeCoercion.ts``) use truthy / type-guard / ``!= null``
                # checks that treat ``null`` and ``undefined`` identically. The
                # single ``=== null`` branch (viewpoint
                # ``planOverlaySourcePlanViewId``) collapses to "no overlay"
                # either way, which matches the field's default. Measured
                # ~50% size reduction on the golden snapshot fixture, ~65% on
                # default-construction walls. DELTAS keep the full dump —
                # partial-merge semantics there require absent != null.
                snapshot_payload = {
                    "type": "snapshot",
                    "modelId": sid,
                    "revision": doc.revision,
                    "elements": {
                        k: el.model_dump(by_alias=True, exclude_none=True)
                        for k, el in doc.elements.items()
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














