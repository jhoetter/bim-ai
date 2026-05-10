from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.agent_brief_acceptance_readout import agent_brief_acceptance_readout_v1
from bim_ai.agent_brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.agent_generated_bundle_qa_checklist import (
    agent_generated_bundle_qa_checklist_v1,
    validate_checks_wire,
)
from bim_ai.agent_review_readout_consistency_closure import (
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import LinkDxfElem, LinkModelElem
from bim_ai.engine import (
    bundle_replay_diagnostics,
    clone_document,
    compute_delta_wire,
    compute_view_template_propagation,
    diff_undo_cmds,
    replay_bundle_diagnostics_for_outcome,
    try_commit,
    try_commit_bundle,
)
from bim_ai.evidence_manifest import (
    agent_evidence_closure_hints,
    export_link_map,
)
from bim_ai.hub import Hub
from bim_ai.level_datum_propagation_evidence import build_level_elevation_propagation_evidence_v0
from bim_ai.link_expansion import SourceDocProvider
from bim_ai.model_summary import compute_model_summary
from bim_ai.routes_deps import (
    _commands_include_move_level_elevation,
    delete_redos,
    document_to_wire,
    get_hub,
    load_model_row,
    violations_wire,
)
from bim_ai.schedule_derivation import list_schedule_ids
from bim_ai.tables import ModelRecord, RedoStackRecord, UndoStackRecord

commands_router = APIRouter()


async def _build_link_source_provider(
    session: AsyncSession, host_doc: Document
) -> SourceDocProvider:
    """FED-02: pre-load every linked source document referenced by ``host_doc``
    and return a sync provider callable for the engine.

    The engine's ``RunClashTestCmd`` apply path needs to walk linked sources to
    transform their AABBs. This helper resolves them up-front so the
    synchronous engine apply path can call back into a plain dict lookup.
    Pinned revisions are resolved through the same undo-replay path that
    ``_expand_host_links`` uses; here we keep it simple and only resolve at
    each link's current pinned revision (or latest) — replay-to-revision is
    deferred for clash-test purposes.
    """

    cache: dict[tuple[str, int | None], Document | None] = {}
    for elem in host_doc.elements.values():
        if not isinstance(elem, LinkModelElem):
            continue
        if elem.hidden:
            continue
        key = (elem.source_model_id, elem.source_model_revision)
        if key in cache:
            continue
        try:
            source_uuid = UUID(elem.source_model_id)
        except ValueError:
            cache[key] = None
            continue
        src_row = await load_model_row(session, source_uuid)
        if src_row is None:
            cache[key] = None
            continue
        cache[key] = Document.model_validate(src_row.document)

    def _provider(source_uuid_str: str, source_rev: int | None) -> Document | None:
        return cache.get((source_uuid_str, source_rev))

    return _provider


_COMMANDS_NEEDING_LINK_SOURCES: frozenset[str] = frozenset(
    {
        # FED-02: clash-test resolves selection sets across linked models.
        "runClashTest",
        # FED-03: drift detection + reconcile read from linked source models.
        "bumpMonitoredRevisions",
        "reconcileMonitoredElement",
    }
)


def _command_needs_link_sources(command: dict[str, Any]) -> bool:
    """FED-02 / FED-03: which command types consult linked source documents."""
    return isinstance(command, dict) and command.get("type") in _COMMANDS_NEEDING_LINK_SOURCES


def _expand_dxf_reload_command(doc: Document, command: dict[str, Any]) -> dict[str, Any]:
    """Materialise updateLinkDxf.reloadSource into parsed linework/layer updates.

    The engine remains pure and undoable: the route reads the current source
    file once, then commits a normal updateLinkDxf payload containing the
    refreshed primitives and source metadata.
    """

    if not isinstance(command, dict):
        return command
    if command.get("type") != "updateLinkDxf" or command.get("reloadSource") is not True:
        return command

    link_id = command.get("linkId")
    link = doc.elements.get(str(link_id)) if link_id is not None else None
    if not isinstance(link, LinkDxfElem):
        return command

    source_path = str(command.get("sourcePath") or link.source_path or "").strip()
    base: dict[str, Any] = {
        **{k: v for k, v in command.items() if k != "reloadSource"},
        "sourcePath": source_path or link.source_path,
    }
    if link.cad_reference_type != "linked":
        return {
            **base,
            "reloadStatus": "embedded",
            "lastReloadMessage": "Embedded CAD import has no reloadable source path",
            "loaded": bool(command.get("loaded", link.loaded)),
        }
    if not source_path:
        return {
            **base,
            "reloadStatus": "source_missing",
            "lastReloadMessage": "Linked DXF has no source path",
            "loaded": False,
        }

    from pathlib import Path

    from bim_ai.dxf_import import collect_dxf_layers, dxf_source_metadata, parse_dxf_to_linework

    path = Path(source_path)
    if not path.is_file():
        return {
            **base,
            "reloadStatus": "source_missing",
            "lastReloadMessage": f"DXF source file not found: {source_path}",
            "loaded": False,
        }
    try:
        linework = parse_dxf_to_linework(path)
    except Exception as exc:
        return {
            **base,
            "reloadStatus": "parse_error",
            "lastReloadMessage": f"DXF parse failed: {exc}",
            "loaded": False,
        }

    return {
        **base,
        "linework": linework,
        "dxfLayers": collect_dxf_layers(linework),
        "cadReferenceType": "linked",
        "sourceMetadata": dxf_source_metadata(path),
        "reloadStatus": "ok",
        "lastReloadMessage": f"Reloaded from {path}",
        "loaded": True,
    }


async def _validate_link_model_command_against_db(
    session: AsyncSession,
    host_model_id: UUID,
    command: dict[str, Any],
) -> None:
    """FED-01: pre-validate ``createLinkModel`` against DB.

    Engine-level apply only sees one document at a time, so the cross-model
    invariants — source exists, host ≠ source, link graph is acyclic — live
    here. Raises ``HTTPException(400)`` on violation; silently returns
    otherwise.
    """

    if str(command.get("type") or "") != "createLinkModel":
        return
    raw_source = command.get("sourceModelId") or command.get("source_model_id")
    if not isinstance(raw_source, str) or not raw_source.strip():
        raise HTTPException(
            status_code=400,
            detail="createLinkModel.sourceModelId must be a non-empty UUID",
        )
    try:
        source_uuid = UUID(raw_source.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"createLinkModel.sourceModelId is not a valid UUID: {raw_source}",
        ) from exc
    if source_uuid == host_model_id:
        raise HTTPException(
            status_code=400,
            detail="createLinkModel: a model cannot link to itself",
        )
    src_row = await load_model_row(session, source_uuid)
    if src_row is None:
        raise HTTPException(
            status_code=400,
            detail=f"createLinkModel.sourceModelId '{source_uuid}' not found",
        )
    # BFS the link graph from the proposed source: if any descendant link
    # points back at the host, accepting this link would close a cycle.
    visited: set[UUID] = set()
    queue: list[UUID] = [source_uuid]
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        if current == host_model_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"createLinkModel: link graph cycle — source '{source_uuid}' "
                    f"already links (transitively) back to host '{host_model_id}'"
                ),
            )
        row = await load_model_row(session, current)
        if row is None:
            continue
        try:
            doc = Document.model_validate(row.document)
        except Exception:
            continue
        for el in doc.elements.values():
            if isinstance(el, LinkModelElem):
                try:
                    queue.append(UUID(el.source_model_id))
                except ValueError:
                    continue


class CommandEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    command: dict[str, Any]
    client_op_id: str | None = Field(default=None, alias="clientOpId")
    user_id: str | None = Field(default="local-dev", alias="userId")


class BundleEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    commands: list[dict[str, Any]]
    user_id: str | None = Field(default=None, alias="userId")
    client_op_id: str | None = Field(default=None, alias="clientOpId")


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
    await hub.publish(model_uuid, {"type": "delta", "modelId": str(model_uuid), **delta})

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


@commands_router.get("/models/{model_id}/command-log")
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


@commands_router.post("/models/{model_id}/commands")
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
    command_for_commit = _expand_dxf_reload_command(baseline_doc, body.command)

    await _validate_link_model_command_against_db(session, model_id, command_for_commit)

    doc_before = clone_document(baseline_doc)

    src_provider: SourceDocProvider | None = None
    if _command_needs_link_sources(command_for_commit):
        src_provider = await _build_link_source_provider(session, baseline_doc)

    try:
        ok, new_doc, _cmd_obj, violations, code = try_commit(
            baseline_doc, command_for_commit, source_provider=src_provider
        )
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
        forward_commands=[command_for_commit],
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

    payload: dict[str, Any] = {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommand": command_for_commit,
        "clientOpId": body.client_op_id,
        "delta": delta,
    }
    if _commands_include_move_level_elevation([body.command]):
        payload["levelElevationPropagationEvidence_v0"] = (
            build_level_elevation_propagation_evidence_v0(
                doc_before,
                new_doc,
                applied_commands=[command_for_commit],
            )
        )
    vt_prop = compute_view_template_propagation(doc_before, new_doc, _cmd_obj)
    if vt_prop is not None:
        payload["viewTemplatePropagation"] = vt_prop
    return payload


@commands_router.post("/models/{model_id}/commands/dry-run")
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


@commands_router.post("/models/{model_id}/commands/bundle")
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
    commands_for_commit = [_expand_dxf_reload_command(baseline_doc, c) for c in body.commands]
    doc_before = clone_document(baseline_doc)

    src_provider: SourceDocProvider | None = None
    if any(_command_needs_link_sources(c) for c in commands_for_commit):
        src_provider = await _build_link_source_provider(session, baseline_doc)

    try:
        ok, new_doc, _cmds, violations, code = try_commit_bundle(
            baseline_doc, commands_for_commit, source_provider=src_provider
        )
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
                    commands_for_commit,
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
        forward_commands=commands_for_commit,
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

    payload: dict[str, Any] = {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommands": commands_for_commit,
        "clientOpId": body.client_op_id,
        "delta": delta,
        "replayDiagnostics": bundle_replay_diagnostics(commands_for_commit),
    }
    if _commands_include_move_level_elevation(commands_for_commit):
        payload["levelElevationPropagationEvidence_v0"] = (
            build_level_elevation_propagation_evidence_v0(
                doc_before,
                new_doc,
                applied_commands=commands_for_commit,
            )
        )
    for raw_cmd in commands_for_commit:
        try:
            from bim_ai.commands import Command  # noqa: PLC0415

            cmd_obj = Command.model_validate(raw_cmd)
            vt_prop = compute_view_template_propagation(doc_before, new_doc, cmd_obj)
            if vt_prop is not None:
                payload["viewTemplatePropagation"] = vt_prop
                break
        except Exception:
            pass
    return payload


@commands_router.post("/models/{model_id}/commands/bundle/dry-run")
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

    brief_proto = agent_brief_command_protocol_v1(
        doc=baseline_doc,
        proposed_commands=list(body.commands),
        validation_violations=viols_wire,
    )
    schedule_rows = [
        {"id": sid, "name": baseline_doc.elements[sid].name}
        for sid in list_schedule_ids(baseline_doc)
    ]
    qa_checklist = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=brief_proto,
        validate=validate_checks_wire(viols_wire),
        schedule_ids=schedule_rows,
        export_links=export_link_map(model_id),
        deterministic_sheet_evidence=None,
        deterministic_plan_view_evidence=None,
        evidence_diff_ingest_fix_loop=None,
        evidence_review_performance_gate=None,
        evidence_ref_resolution=None,
    )
    accept_readout = agent_brief_acceptance_readout_v1(
        doc=baseline_doc,
        brief_protocol=brief_proto,
        qa_checklist=qa_checklist,
        artifact_upload_manifest=None,
        validation_violations=viols_wire,
    )
    dry_run_closure_hints = agent_evidence_closure_hints()
    consistency_closure = agent_review_readout_consistency_closure_v1(
        readout_brief_acceptance=accept_readout,
        readout_bundle_qa_checklist=qa_checklist,
        readout_merge_preflight=None,
        readout_baseline_lifecycle=None,
        readout_browser_rendering_budget=None,
        closure_hints=dry_run_closure_hints,
    )
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
            "agentBriefCommandProtocol_v1": brief_proto,
            "agentGeneratedBundleQaChecklist_v1": qa_checklist,
            "agentBriefAcceptanceReadout_v1": accept_readout,
            "agentReviewReadoutConsistencyClosure_v1": consistency_closure,
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
        "agentBriefCommandProtocol_v1": brief_proto,
        "agentGeneratedBundleQaChecklist_v1": qa_checklist,
        "agentBriefAcceptanceReadout_v1": accept_readout,
        "agentReviewReadoutConsistencyClosure_v1": consistency_closure,
    }


@commands_router.post("/models/{model_id}/undo")
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


@commands_router.post("/models/{model_id}/redo")
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
