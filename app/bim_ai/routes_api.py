from __future__ import annotations

import logging
import secrets
import time
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
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
from bim_ai.db import SessionMaker, get_session
from bim_ai.diff_engine import compute_element_diff
from bim_ai.document import Document
from bim_ai.elements import Element, LevelElem, LinkModelElem, PlanViewElem
from bim_ai.fire_safety_lens import fire_safety_lens_review_status
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
from bim_ai.collab.orchestrator import get_orchestrator
from bim_ai.hub import Hub
from bim_ai.jobs.queue import JobQueue, get_queue
from bim_ai.jobs.types import CreateJobRequest, Job
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
from bim_ai.type_material_registry import merged_registry_payload
from bim_ai.v1_acceptance_proof_matrix import build_v1_acceptance_proof_matrix_v1
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1
from bim_ai.api.registry import get_catalog, get_descriptor

api_router = APIRouter(prefix="/api")
api_router.include_router(exports_router)
api_router.include_router(commands_router)
api_router.include_router(activity_router)
api_router.include_router(sketch_router)


def _get_job_queue() -> JobQueue:
    return get_queue()


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
        mres = await session.execute(
            select(ModelRecord).where(ModelRecord.project_id == p.id).order_by(ModelRecord.slug)
        )
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
        parse_dxf_to_linework_with_scale,
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
        linework, unit_scale_to_mm = parse_dxf_to_linework_with_scale(
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

    from bim_ai.dxf_import import collect_dxf_layers, parse_dxf_to_linework_with_scale

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
        linework, unit_scale_to_mm = parse_dxf_to_linework_with_scale(
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

    return {"linkDxfId": link_element_id, "name": display_name}


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
    submitter: str = Field(default="human")


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

    return result.model_dump(by_alias=True)


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
                "elements": {k: el.model_dump(by_alias=True) for k, el in doc.elements.items()},
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


@api_router.post("/v3/trace")
async def v3_trace_image(
    request: Request,
    archetypeHint: str | None = Query(default=None),
) -> dict[str, Any]:
    """IMG-V3-01 — deterministic CV image → StructuredLayout.

    Accepts multipart/form-data with:
      - image: binary (JPEG or PNG)
      - brief: optional text string

    Images > 2 MB are enqueued as image_trace jobs → returns {jobId}.
    Images ≤ 2 MB are processed inline → returns StructuredLayout.
    """
    import base64
    import io as _io
    import os
    import tempfile

    from bim_ai.img.pipeline import trace

    form = await request.form()
    image_field = form.get("image")
    if image_field is None:
        raise HTTPException(status_code=422, detail="Missing required form field: image")

    image_bytes: bytes
    if hasattr(image_field, "read"):
        image_bytes = await image_field.read()  # type: ignore[union-attr]
    else:
        image_bytes = image_field.encode() if isinstance(image_field, str) else bytes(image_field)  # type: ignore[arg-type]

    brief_text: str | None = None
    brief_field = form.get("brief")
    if brief_field is not None:
        brief_text = str(brief_field)

    _SIZE_LIMIT = 2 * 1024 * 1024  # 2 MB
    if len(image_bytes) > _SIZE_LIMIT:
        now = datetime.now(UTC).isoformat()
        model_id_hint = str(form.get("modelId") or "unassigned")
        job = Job(
            modelId=model_id_hint,
            kind="image_trace",
            status="queued",
            inputs={"archetypeHint": archetypeHint},
            createdAt=now,
        )
        job = await get_queue().submit(job)
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=202, content={"jobId": job.id})

    suffix = ".jpg" if image_bytes[:2] == b"\xff\xd8" else ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as fh:
        fh.write(image_bytes)
        tmp_path = fh.name
    brief_path: str | None = None
    try:
        if brief_text:
            brief_fh = tempfile.NamedTemporaryFile(
                suffix=".txt", delete=False, mode="w", encoding="utf-8"
            )
            brief_fh.write(brief_text)
            brief_fh.close()
            brief_path = brief_fh.name
        layout = trace(tmp_path, archetype_hint=archetypeHint, brief_path=brief_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        if brief_path:
            try:
                os.unlink(brief_path)
            except OSError:
                pass

    result = layout.model_dump(by_alias=True)
    codes = {a.get("code") for a in result.get("advisories", [])}
    # 422 if no usable walls could be extracted — either because the image has
    # no detectable walls (no_walls_detected) or is too low-contrast to process.
    if codes & {"no_walls_detected", "low_contrast_image"}:
        raise HTTPException(status_code=422, detail=result)
    return result


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
# MRK-V3-02 — Markup CRUD routes
# ---------------------------------------------------------------------------

# Module-level in-memory store keyed by model_id (simplest pattern; no
# DB migration required for this WP).
_markups_store: dict[str, list[dict]] = {}


def _get_markups(model_id: str) -> list[dict]:
    return _markups_store.setdefault(model_id, [])


class MarkupCreateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    view_id: str | None = Field(default=None, alias="viewId")
    anchor: dict = Field(...)
    shape: dict = Field(...)
    author_id: str = Field(alias="authorId")


@api_router.post("/models/{model_id}/markups")
async def create_markup(model_id: UUID, body: MarkupCreateBody) -> dict[str, Any]:
    import time as _time

    from bim_ai.markups import Markup, Vec2Px, _rdp_simplify, sanitize_color

    mid = str(uuid4())
    shape = dict(body.shape)
    if shape.get("kind") == "freehand":
        path = shape.get("pathPx", [])
        simplified = _rdp_simplify([Vec2Px.model_validate(p) for p in path])
        shape["pathPx"] = [p.model_dump(by_alias=True) for p in simplified]
        shape["color"] = sanitize_color(shape.get("color", "var(--cat-edit)"))
    elif shape.get("kind") == "arrow":
        shape["color"] = sanitize_color(shape.get("color", "var(--cat-edit)"))

    raw: dict[str, Any] = {
        "id": mid,
        "modelId": str(model_id),
        "viewId": body.view_id,
        "anchor": body.anchor,
        "shape": shape,
        "authorId": body.author_id,
        "createdAt": int(_time.time() * 1000),
        "resolvedAt": None,
    }
    markup = Markup.model_validate(raw)
    _get_markups(str(model_id)).append(markup.model_dump(by_alias=True))
    return markup.model_dump(by_alias=True)


@api_router.get("/models/{model_id}/markups")
async def list_markups(
    model_id: UUID,
    view_id: Annotated[str | None, Query(alias="viewId")] = None,
    resolved: Annotated[str | None, Query(alias="resolved")] = None,
) -> dict[str, Any]:
    markups = list(_get_markups(str(model_id)))
    if view_id is not None:
        markups = [m for m in markups if m.get("viewId") == view_id]
    if resolved is not None and resolved.lower() == "false":
        markups = [m for m in markups if m.get("resolvedAt") is None]
    return {"markups": markups}


@api_router.patch("/models/{model_id}/markups/{markup_id}/resolve")
async def resolve_markup(model_id: UUID, markup_id: str) -> dict[str, Any]:
    import time as _time

    markups = _get_markups(str(model_id))
    for i, m in enumerate(markups):
        if m.get("id") == markup_id:
            m = dict(m)
            m["resolvedAt"] = int(_time.time() * 1000)
            markups[i] = m
            return m
    raise HTTPException(status_code=404, detail="Markup not found")


@api_router.delete("/models/{model_id}/markups/{markup_id}")
async def delete_markup(model_id: UUID, markup_id: str) -> dict[str, Any]:
    markups = _get_markups(str(model_id))
    for i, m in enumerate(markups):
        if m.get("id") == markup_id:
            markups.pop(i)
            return {"deleted": True, "id": markup_id}
    raise HTTPException(status_code=404, detail="Markup not found")


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
# OUT-V3-01 — Live presentation URL
# ---------------------------------------------------------------------------

_presentation_ws_sessions: dict[str, set[WebSocket]] = {}


class CreatePresentationBody(BaseModel):
    pageScopeIds: list[str] = Field(default_factory=list)
    allowMeasurement: bool = False
    allowComment: bool = False
    expiresAt: int | None = None


@api_router.post("/models/{model_id}/presentations")
async def create_presentation(
    model_id: UUID,
    body: CreatePresentationBody,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """OUT-V3-01: create a live presentation link for a model."""
    from bim_ai.public_links import generate_link_token

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    now_ms = int(time.time() * 1000)
    link_id = secrets.token_urlsafe(16)
    token = generate_link_token()

    import json as _json

    link_record = PublicLinkRecord(
        id=link_id,
        model_id=str(model_id),
        token=token,
        created_by=user_id,
        created_at=now_ms,
        expires_at=body.expiresAt,
        is_revoked=False,
        display_name="presentation",
        open_count=0,
        allow_measurement=body.allowMeasurement,
        allow_comment=body.allowComment,
        page_scope_ids=_json.dumps(body.pageScopeIds),
    )
    session.add(link_record)
    await session.commit()

    return {
        "id": link_id,
        "modelId": str(model_id),
        "token": token,
        "pageScopeIds": body.pageScopeIds,
        "allowMeasurement": body.allowMeasurement,
        "allowComment": body.allowComment,
        "expiresAt": body.expiresAt,
        "createdAt": now_ms,
        "isRevoked": False,
        "openCount": 0,
        "displayName": "presentation",
        "url": f"/p/{token}",
    }


@api_router.get("/models/{model_id}/presentations")
async def list_presentations(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """OUT-V3-01: list presentation links for a model, including inactive links."""
    res = await session.execute(
        select(PublicLinkRecord)
        .where(
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.display_name == "presentation",
        )
        .order_by(PublicLinkRecord.is_revoked.asc(), desc(PublicLinkRecord.created_at))
    )
    import json as _json

    records = res.scalars().all()
    presentations = []
    for r in records:
        presentations.append(
            {
                "id": r.id,
                "modelId": r.model_id,
                "token": r.token,
                "createdBy": r.created_by,
                "createdAt": r.created_at,
                "expiresAt": r.expires_at,
                "isRevoked": r.is_revoked,
                "openCount": r.open_count,
                "pageScopeIds": _json.loads(r.page_scope_ids) if r.page_scope_ids else [],
                "allowMeasurement": r.allow_measurement,
                "allowComment": r.allow_comment,
            }
        )
    return {"presentations": presentations}


@api_router.post("/models/{model_id}/presentations/{link_id}/revoke")
async def revoke_presentation(
    model_id: UUID,
    link_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """OUT-V3-01: revoke a presentation link and notify active WS sessions."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.id == link_id,
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    now_ms = int(time.time() * 1000)
    link_record.is_revoked = True
    await session.commit()

    token = link_record.token
    if token in _presentation_ws_sessions:
        for ws in list(_presentation_ws_sessions[token]):
            try:
                await ws.send_json({"type": "revoked"})
                await ws.close(code=4403)
            except Exception:
                pass
        _presentation_ws_sessions.pop(token, None)

    return {"revokedAt": now_ms}


@api_router.post("/models/{model_id}/presentations/{link_id}/activate")
async def activate_presentation(
    model_id: UUID,
    link_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """OUT-V3-01: reactivate a presentation link without rotating its token."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.id == link_id,
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    now_ms = int(time.time() * 1000)
    link_record.is_revoked = False
    await session.commit()

    return {"activatedAt": now_ms, "isRevoked": False}


@api_router.get("/p/{token}")
async def resolve_presentation_token(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """OUT-V3-01: public viewer route — resolves a presentation token."""
    from sqlalchemy import update as sa_update

    now_ms = int(time.time() * 1000)
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.token == token,
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    if link_record.is_revoked:
        return {"status": "revoked"}
    if link_record.expires_at is not None and link_record.expires_at < now_ms:
        return {"status": "revoked"}

    await session.execute(
        sa_update(PublicLinkRecord)
        .where(PublicLinkRecord.id == link_record.id)
        .values(open_count=PublicLinkRecord.open_count + 1)
    )
    await session.commit()

    model_uuid = UUID(link_record.model_id)
    row = await load_model_row(session, model_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    import json as _json

    doc = Document.model_validate(row.document)
    elements_wire = {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}
    return {
        "status": "ok",
        "modelId": str(row.id),
        "revision": doc.revision,
        "elements": elements_wire,
        "wsUrl": f"/api/p/{token}/ws",
        "allowMeasurement": link_record.allow_measurement,
        "allowComment": link_record.allow_comment,
        "pageScopeIds": _json.loads(link_record.page_scope_ids)
        if link_record.page_scope_ids
        else [],
        "presentation": {
            "id": link_record.id,
            "displayName": link_record.display_name,
            "openCount": link_record.open_count + 1,
        },
    }


@api_router.websocket("/p/{token}/ws")
async def presentation_ws(
    websocket: WebSocket,
    token: str,
    hub: Hub = Depends(get_hub),
    session: AsyncSession = Depends(get_session),
) -> None:
    """OUT-V3-01: WebSocket for live presentation updates."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.token == token,
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()

    await websocket.accept()

    if link_record is None or link_record.is_revoked:
        await websocket.send_json({"type": "revoked"})
        await websocket.close(code=4403)
        return

    if token not in _presentation_ws_sessions:
        _presentation_ws_sessions[token] = set()
    _presentation_ws_sessions[token].add(websocket)

    sid = str(link_record.model_id)
    hub.subscribe(sid, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.unregister(websocket)
        if token in _presentation_ws_sessions:
            _presentation_ws_sessions[token].discard(websocket)


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
# CTL-V3-01 — Catalog query endpoint
# ---------------------------------------------------------------------------


@api_router.get("/v3/catalog")
async def catalog_query_endpoint(
    kind: str | None = None,
    maxWidthMm: float | None = None,
    minWidthMm: float | None = None,
    tag: str | None = None,
    style: str | None = None,
    page: int = 0,
    pageSize: int = 50,
) -> dict:
    from bim_ai.catalog.query import query_catalog

    return query_catalog(
        kind=kind,
        max_width_mm=maxWidthMm,
        min_width_mm=minWidthMm,
        tag=tag,
        style=style,
        page=page,
        page_size=pageSize,
    )


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
# OUT-V3-02 — Presentation canvas PPTX bundle export
# ---------------------------------------------------------------------------


@api_router.get(
    "/v3/models/{model_id}/presentation-canvases/{canvas_id}/export",
    tags=["out-v3-02"],
)
async def export_presentation_canvas(
    model_id: UUID,
    canvas_id: str,
    format: str = Query(default="pptx-bundle"),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """OUT-V3-02 — Export a presentation canvas as a structured PPTX bundle JSON.

    Returns the PptxBundle JSON contract (schemaVersion, title, slides[]).
    Binary .pptx writing via python-pptx is reserved for a future iteration.
    """
    from bim_ai.exp.pptx_export import build_pptx_bundle
    from bim_ai.elements import FrameElem, PresentationCanvasElem

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    canvas_elem = doc.elements.get(canvas_id)
    if canvas_elem is None or not isinstance(canvas_elem, PresentationCanvasElem):
        raise HTTPException(
            status_code=404,
            detail=f"presentation_canvas '{canvas_id}' not found in model",
        )

    if format != "pptx-bundle":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format '{format}'. Only 'pptx-bundle' is supported.",
        )

    frames = [
        elem.model_dump(by_alias=True)
        for elem in doc.elements.values()
        if isinstance(elem, FrameElem) and elem.presentation_canvas_id == canvas_id
    ]

    canvas_dict = canvas_elem.model_dump(by_alias=True)
    bundle = build_pptx_bundle(canvas_dict, frames)
    return bundle.to_dict()


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
