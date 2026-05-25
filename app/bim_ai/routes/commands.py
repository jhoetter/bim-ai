from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.brief_acceptance_readout import agent_brief_acceptance_readout_v1
from bim_ai.brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.bundle_qa_checklist import (
    agent_generated_bundle_qa_checklist_v1,
    validate_checks_wire,
)
from bim_ai.review_readout_consistency_closure import (
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.db import find_idempotent_undo_record, get_session
from bim_ai.document import Document
from bim_ai.elements import ExternalLinkElem, LinkDxfElem, LinkModelElem
from bim_ai.engine import (
    bundle_replay_diagnostics,
    clone_document,
    command_supports_fast_validation_path,
    compute_delta_wire,
    compute_view_template_propagation,
    diff_undo_cmds,
    replay_bundle_diagnostics_for_outcome,
    try_commit,
    try_commit_bundle,
)
from bim_ai.evidence.level_datum_propagation_evidence import (
    build_level_elevation_propagation_evidence_v0,
)
from bim_ai.evidence_manifest import (
    agent_evidence_closure_hints,
    export_link_map,
)
from bim_ai.hub import Hub
from bim_ai.link_expansion import SourceDocProvider
from bim_ai.model_summary import compute_model_summary
from bim_ai.routes.deps import (
    _commands_include_move_level_elevation,
    delete_redos,
    document_to_wire,
    get_hub,
    load_model_row,
    violations_wire,
)
from bim_ai.schedule_derivation import list_schedule_ids
from bim_ai.tables import ModelRecord, RedoStackRecord, UndoStackRecord
from bim_ai.transaction_metadata import build_transaction_metadata, command_bundle_digest
from bim_ai.transaction_safety import (
    assess_transaction_safety,
    build_dry_run_evidence,
    build_transaction_preflight_audit,
    build_undo_redo_integrity_metadata,
)
from bim_ai.versioning import current_commit_id

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

    from bim_ai.dxf_import import (
        collect_dxf_layers,
        dxf_source_metadata,
        parse_dxf_to_linework_with_diagnostics,
    )

    path = Path(source_path)
    if not path.is_file():
        return {
            **base,
            "reloadStatus": "source_missing",
            "lastReloadMessage": f"DXF source file not found: {source_path}",
            "loaded": False,
        }
    try:
        unit_override = command.get("unitOverride", link.unit_override)
        linework, unit_scale_to_mm, dxf_import_readback = parse_dxf_to_linework_with_diagnostics(
            path,
            unit_override=unit_override,
        )
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
        "unitOverride": unit_override,
        "unitScaleToMm": unit_scale_to_mm,
        "cadReferenceType": "linked",
        "sourceMetadata": {
            **dxf_source_metadata(path),
            "unitOverride": unit_override,
            "unitScaleToMm": unit_scale_to_mm,
            "dxfImportReadbackContract_v1": dxf_import_readback,
        },
        "reloadStatus": "ok",
        "lastReloadMessage": f"Reloaded from {path}",
        "loaded": True,
    }


def _external_source_metadata(path: Any) -> dict[str, Any]:
    from pathlib import Path

    p = Path(str(path))
    stat = p.stat()
    return {
        "path": str(p),
        "sourceName": p.name,
        "sizeBytes": stat.st_size,
        "mtimeMs": int(stat.st_mtime * 1000),
    }


def _expand_external_link_reload_command(doc: Document, command: dict[str, Any]) -> dict[str, Any]:
    """Materialise updateExternalLink.reloadSource into status/source metadata."""

    if not isinstance(command, dict):
        return command
    if command.get("type") != "updateExternalLink" or command.get("reloadSource") is not True:
        return command

    link_id = command.get("linkId")
    link = doc.elements.get(str(link_id)) if link_id is not None else None
    if not isinstance(link, ExternalLinkElem):
        return command

    source_path = str(command.get("sourcePath") or link.source_path or "").strip()
    base: dict[str, Any] = {
        **{k: v for k, v in command.items() if k != "reloadSource"},
        "sourcePath": source_path or link.source_path,
    }
    if not source_path:
        return {
            **base,
            "reloadStatus": "source_missing",
            "lastReloadMessage": "External link has no source path",
            "loaded": False,
        }

    from pathlib import Path

    path = Path(source_path)
    if not path.is_file():
        return {
            **base,
            "reloadStatus": "source_missing",
            "lastReloadMessage": f"External link source file not found: {source_path}",
            "loaded": False,
        }

    return {
        **base,
        "sourceName": path.name,
        "sourceMetadata": _external_source_metadata(path),
        "reloadStatus": "ok",
        "lastReloadMessage": f"Reloaded from {path}",
        "loaded": True,
    }


def _expand_link_reload_command(doc: Document, command: dict[str, Any]) -> dict[str, Any]:
    return _expand_external_link_reload_command(doc, _expand_dxf_reload_command(doc, command))


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
    parent_revision: int | None = Field(default=None, alias="parentRevision")


class BundleEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    commands: list[dict[str, Any]]
    user_id: str | None = Field(default=None, alias="userId")
    client_op_id: str | None = Field(default=None, alias="clientOpId")
    parent_revision: int | None = Field(default=None, alias="parentRevision")


class UndoRedoEnvelope(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str | None = Field(default="local-dev", alias="userId")
    parent_revision: int | None = Field(default=None, alias="parentRevision")


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
    viols_wire = delta["violations"]

    return {
        "ok": True,
        "modelId": str(model_uuid),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "delta": delta,
    }


def _idempotent_command_payload(
    *,
    row: ModelRecord,
    model_id: UUID,
    undo_row: UndoStackRecord,
    client_op_id: str | None,
    single_command: bool,
) -> dict[str, Any]:
    doc = Document.model_validate(row.document)
    wire_doc = document_to_wire(doc)
    metadata = undo_row.transaction_metadata or {}
    delta = (metadata.get("collaborationDelta") if isinstance(metadata, dict) else None) or {}
    if client_op_id:
        delta = {**delta, "clientOpId": client_op_id}
    payload: dict[str, Any] = {
        "ok": True,
        "modelId": str(model_id),
        "revision": undo_row.revision_after,
        "currentRevision": row.revision,
        "elements": wire_doc["elements"],
        "violations": violations_wire(doc.elements),
        "clientOpId": client_op_id,
        "delta": delta,
        "transactionMetadata": metadata,
        "idempotentReplay": True,
        "idempotencyMatch": metadata.get("idempotency") if isinstance(metadata, dict) else None,
    }
    if single_command:
        payload["appliedCommand"] = list(undo_row.forward_commands)[0]
    else:
        payload["appliedCommands"] = list(undo_row.forward_commands)
        payload["replayDiagnostics"] = bundle_replay_diagnostics(list(undo_row.forward_commands))
    return payload


def _transaction_safety_wire(
    *,
    current_revision: int,
    parent_revision: int,
    mode: str,
    surface: str,
    commands: list[dict[str, Any]],
    actor_kind: str = "human",
) -> dict[str, Any]:
    decision = assess_transaction_safety(
        current_revision=current_revision,
        parent_revision=parent_revision,
        mode=mode,  # type: ignore[arg-type]
        surface=surface,  # type: ignore[arg-type]
        actor_kind=actor_kind,  # type: ignore[arg-type]
        commands=commands,
    )
    return decision.model_dump(by_alias=True)


def _preflight_or_409(
    *,
    current_revision: int,
    parent_revision: int,
    mode: str,
    surface: str,
    commands: list[dict[str, Any]],
    actor_kind: str = "human",
) -> tuple[dict[str, Any], dict[str, Any]]:
    decision = assess_transaction_safety(
        current_revision=current_revision,
        parent_revision=parent_revision,
        mode=mode,  # type: ignore[arg-type]
        surface=surface,  # type: ignore[arg-type]
        actor_kind=actor_kind,  # type: ignore[arg-type]
        commands=commands,
    )
    decision_wire = decision.model_dump(by_alias=True)
    audit = build_transaction_preflight_audit(
        current_revision=current_revision,
        parent_revision=parent_revision,
        mode=mode,  # type: ignore[arg-type]
        surface=surface,  # type: ignore[arg-type]
        actor_kind=actor_kind,  # type: ignore[arg-type]
        commands=commands,
        decision=decision,
    )
    if not decision.ok:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": decision.reason_code,
                "transactionSafety": decision_wire,
                "transactionPreflightAudit": audit,
            },
        )
    return decision_wire, audit


@commands_router.get("/models/{model_id}/command-log")
async def command_log_full(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = 120,
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
                "transactionMetadata": u.transaction_metadata,
            }
        )

    return {"modelId": str(row.id), "entries": entries}


@commands_router.post("/models/{model_id}/commands")
async def apply_command(
    model_id: UUID,
    body: CommandEnvelope,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"

    baseline_doc = Document.model_validate(row.document)
    command_for_commit = _expand_link_reload_command(baseline_doc, body.command)
    command_digest = command_bundle_digest(
        [command_for_commit],
        submitter="raw-command",
        route="/api/models/{model_id}/commands",
    )
    prior = await find_idempotent_undo_record(
        session,
        model_id=model_id,
        client_op_id=body.client_op_id,
        bundle_digest=command_digest if body.client_op_id is None else None,
        user_id=uid,
    )
    if prior is not None:
        return _idempotent_command_payload(
            row=row,
            model_id=model_id,
            undo_row=prior,
            client_op_id=body.client_op_id,
            single_command=True,
        )

    await _validate_link_model_command_against_db(session, model_id, command_for_commit)

    doc_before = clone_document(baseline_doc)
    parent_revision = (
        body.parent_revision if body.parent_revision is not None else doc_before.revision
    )
    transaction_safety, transaction_preflight_audit = _preflight_or_409(
        current_revision=doc_before.revision,
        parent_revision=parent_revision,
        mode="commit",
        surface="ui-command-commit",
        commands=[command_for_commit],
    )

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
    transaction_metadata = build_transaction_metadata(
        doc_before=doc_before,
        new_doc=new_doc,
        commands=[command_for_commit],
        user_id=uid,
        submitter="raw-command",
        parent_revision=parent_revision,
        client_op_id=body.client_op_id,
        workflow={
            "route": "/api/models/{model_id}/commands",
            "entryPoint": "raw-command",
            "surface": "api-v2",
        },
        bundle_digest=command_digest,
    )
    transaction_metadata["transactionSafety"] = transaction_safety
    transaction_metadata["transactionPreflightAudit"] = transaction_preflight_audit
    await delete_redos(session, model_id, uid)

    undo_row = UndoStackRecord(
        model_id=model_id,
        user_id=uid,
        revision_after=new_doc.revision,
        forward_commands=[command_for_commit],
        undo_commands=undo_cmds,
        transaction_metadata=transaction_metadata,
        commit_id=current_commit_id(),
        created_at=datetime.now(UTC),
    )
    session.add(undo_row)

    wire_doc = document_to_wire(new_doc)
    row.document = wire_doc  # type: ignore[assignment]
    row.revision = new_doc.revision
    await session.commit()

    # PERF-B07: when try_commit took the fast path (hosted-opening insert
    # / wall endpoint move), stamp validationScope='blocking_only' so the
    # FE preserves prior info-level rows instead of dropping them on
    # replace.
    fast_path = command_supports_fast_validation_path(command_for_commit)
    delta = compute_delta_wire(
        doc_before,
        new_doc,
        violations=violations,
        validation_scope="blocking_only" if fast_path else "full",
    )
    if body.client_op_id:
        delta["clientOpId"] = body.client_op_id

    await hub.publish(
        model_id,
        {"type": "delta", "modelId": str(model_id), **delta},
    )

    elems_out = wire_doc["elements"]
    viols_wire = delta["violations"]

    payload: dict[str, Any] = {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommand": command_for_commit,
        "clientOpId": body.client_op_id,
        "delta": delta,
        "transactionMetadata": transaction_metadata,
        "transactionSafety": transaction_safety,
        "transactionPreflightAudit": transaction_preflight_audit,
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
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    baseline_doc = Document.model_validate(row.document)
    baseline_summary = compute_model_summary(baseline_doc)
    command_for_commit = _expand_link_reload_command(baseline_doc, body.command)
    parent_revision = (
        body.parent_revision if body.parent_revision is not None else baseline_doc.revision
    )
    transaction_safety, transaction_preflight_audit = _preflight_or_409(
        current_revision=baseline_doc.revision,
        parent_revision=parent_revision,
        mode="dry_run",
        surface="dry-run",
        commands=[command_for_commit],
    )

    try:
        ok, new_doc, _cmd_obj, violations, code = try_commit(baseline_doc, command_for_commit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid command: {exc}") from exc

    viols_wire = [v.model_dump(by_alias=True) for v in violations]
    summary_after = compute_model_summary(new_doc) if ok and new_doc is not None else None
    dry_run_evidence = build_dry_run_evidence(
        parent_revision=parent_revision,
        commands=[command_for_commit],
        ok=ok and new_doc is not None,
        reason=code,
        violations=viols_wire,
        summary_before=baseline_summary,
        summary_after=summary_after,
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
            "appliedCommandPreview": command_for_commit,
            "dryRunEvidence": dry_run_evidence,
            "transactionSafety": transaction_safety,
            "transactionPreflightAudit": transaction_preflight_audit,
        }

    return {
        "ok": True,
        "modelId": str(model_id),
        "reason": code,
        "violations": viols_wire,
        "summaryBefore": baseline_summary,
        "summaryAfter": summary_after,
        "wouldRevision": new_doc.revision,
        "appliedCommandPreview": command_for_commit,
        "dryRunEvidence": dry_run_evidence,
        "transactionSafety": transaction_safety,
        "transactionPreflightAudit": transaction_preflight_audit,
    }


@commands_router.post("/models/{model_id}/commands/bundle")
async def apply_command_bundle(
    model_id: UUID,
    body: BundleEnvelope,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    uid = body.user_id or "local-dev"
    baseline_doc = Document.model_validate(row.document)
    commands_for_commit = [_expand_link_reload_command(baseline_doc, c) for c in body.commands]
    bundle_digest = command_bundle_digest(
        commands_for_commit,
        submitter="raw-bundle",
        route="/api/models/{model_id}/commands/bundle",
    )
    prior = await find_idempotent_undo_record(
        session,
        model_id=model_id,
        client_op_id=body.client_op_id,
        bundle_digest=bundle_digest,
        user_id=uid,
    )
    if prior is not None:
        return _idempotent_command_payload(
            row=row,
            model_id=model_id,
            undo_row=prior,
            client_op_id=body.client_op_id,
            single_command=False,
        )
    doc_before = clone_document(baseline_doc)
    parent_revision = (
        body.parent_revision if body.parent_revision is not None else doc_before.revision
    )
    transaction_safety, transaction_preflight_audit = _preflight_or_409(
        current_revision=doc_before.revision,
        parent_revision=parent_revision,
        mode="commit",
        surface="bundle-commit",
        commands=commands_for_commit,
    )

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
    transaction_metadata = build_transaction_metadata(
        doc_before=doc_before,
        new_doc=new_doc,
        commands=commands_for_commit,
        user_id=uid,
        submitter="raw-bundle",
        parent_revision=parent_revision,
        client_op_id=body.client_op_id,
        workflow={
            "route": "/api/models/{model_id}/commands/bundle",
            "entryPoint": "raw-bundle",
            "surface": "api-v2",
        },
        bundle_digest=bundle_digest,
    )
    transaction_metadata["transactionSafety"] = transaction_safety
    transaction_metadata["transactionPreflightAudit"] = transaction_preflight_audit

    await delete_redos(session, model_id, uid)

    undo_row = UndoStackRecord(
        model_id=model_id,
        user_id=uid,
        revision_after=new_doc.revision,
        forward_commands=commands_for_commit,
        undo_commands=undo_cmds,
        transaction_metadata=transaction_metadata,
        commit_id=current_commit_id(),
        created_at=datetime.now(UTC),
    )

    session.add(undo_row)

    wire_doc = document_to_wire(new_doc)

    row.document = wire_doc  # type: ignore[assignment]
    row.revision = new_doc.revision

    await session.commit()

    delta = compute_delta_wire(doc_before, new_doc, violations=violations)

    if body.client_op_id:
        delta["clientOpId"] = body.client_op_id

    await hub.publish(
        model_id,
        {"type": "delta", "modelId": str(model_id), **delta},
    )

    elems_out = wire_doc["elements"]

    viols_wire = delta["violations"]

    payload: dict[str, Any] = {
        "ok": True,
        "modelId": str(model_id),
        "revision": new_doc.revision,
        "elements": elems_out,
        "violations": viols_wire,
        "appliedCommands": commands_for_commit,
        "clientOpId": body.client_op_id,
        "delta": delta,
        "transactionMetadata": transaction_metadata,
        "transactionSafety": transaction_safety,
        "transactionPreflightAudit": transaction_preflight_audit,
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
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    baseline_doc = Document.model_validate(row.document)
    baseline_summary = compute_model_summary(baseline_doc)
    commands_for_commit = [_expand_link_reload_command(baseline_doc, c) for c in body.commands]
    parent_revision = (
        body.parent_revision if body.parent_revision is not None else baseline_doc.revision
    )
    transaction_safety, transaction_preflight_audit = _preflight_or_409(
        current_revision=baseline_doc.revision,
        parent_revision=parent_revision,
        mode="dry_run",
        surface="dry-run",
        commands=commands_for_commit,
    )

    try:
        ok, new_doc, _cmds, violations, code = try_commit_bundle(baseline_doc, commands_for_commit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid bundle: {exc}") from exc

    viols_wire = [v.model_dump(by_alias=True) for v in violations]
    summary_after = compute_model_summary(new_doc) if ok and new_doc is not None else None
    dry_run_evidence = build_dry_run_evidence(
        parent_revision=parent_revision,
        commands=commands_for_commit,
        ok=ok and new_doc is not None,
        reason=code,
        violations=viols_wire,
        summary_before=baseline_summary,
        summary_after=summary_after,
    )

    brief_proto = agent_brief_command_protocol_v1(
        doc=baseline_doc,
        proposed_commands=list(commands_for_commit),
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
            "appliedCommandsPreview": commands_for_commit,
            "replayDiagnostics": replay_bundle_diagnostics_for_outcome(
                baseline_doc,
                commands_for_commit,
                outcome_code=code,
            ),
            "agentBriefCommandProtocol_v1": brief_proto,
            "agentGeneratedBundleQaChecklist_v1": qa_checklist,
            "agentBriefAcceptanceReadout_v1": accept_readout,
            "agentReviewReadoutConsistencyClosure_v1": consistency_closure,
            "dryRunEvidence": dry_run_evidence,
            "transactionSafety": transaction_safety,
            "transactionPreflightAudit": transaction_preflight_audit,
        }

    return {
        "ok": True,
        "modelId": str(model_id),
        "reason": code,
        "violations": viols_wire,
        "summaryBefore": baseline_summary,
        "summaryAfter": summary_after,
        "wouldRevision": new_doc.revision,
        "appliedCommandsPreview": commands_for_commit,
        "replayDiagnostics": bundle_replay_diagnostics(commands_for_commit),
        "agentBriefCommandProtocol_v1": brief_proto,
        "agentGeneratedBundleQaChecklist_v1": qa_checklist,
        "agentBriefAcceptanceReadout_v1": accept_readout,
        "agentReviewReadoutConsistencyClosure_v1": consistency_closure,
        "dryRunEvidence": dry_run_evidence,
        "transactionSafety": transaction_safety,
        "transactionPreflightAudit": transaction_preflight_audit,
    }


@commands_router.post("/models/{model_id}/undo")
async def undo_model(
    model_id: UUID,
    body: UndoRedoEnvelope,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
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
    parent_revision = (
        body.parent_revision if body.parent_revision is not None else undo_row.revision_after
    )
    transaction_safety, transaction_preflight_audit = _preflight_or_409(
        current_revision=baseline.revision,
        parent_revision=parent_revision,
        mode="undo",
        surface="undo",
        commands=list(undo_row.undo_commands),
    )
    if undo_row.revision_after != baseline.revision:
        _preflight_or_409(
            current_revision=baseline.revision,
            parent_revision=undo_row.revision_after,
            mode="undo",
            surface="undo",
            commands=list(undo_row.undo_commands),
        )

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
    transaction_metadata = build_transaction_metadata(
        doc_before=baseline,
        new_doc=new_doc,
        commands=list(undo_row.undo_commands),
        user_id=uid,
        submitter="undo",
        parent_revision=baseline.revision,
        action="undo",
        workflow={
            "route": "/api/models/{model_id}/undo",
            "entryPoint": "undo",
            "surface": "api-v2",
        },
    )
    transaction_metadata["transactionSafety"] = transaction_safety
    transaction_metadata["transactionPreflightAudit"] = transaction_preflight_audit
    transaction_metadata["undoRedoIntegrityMetadata"] = build_undo_redo_integrity_metadata(
        original_transaction_metadata=undo_row.transaction_metadata,
        action="undo",
        revision_before=baseline.revision,
        revision_after=new_doc.revision,
    )
    session.add(
        RedoStackRecord(
            model_id=model_id,
            user_id=uid,
            revision_after=new_doc.revision,
            forward_commands=list(undo_row.forward_commands),
            transaction_metadata=undo_row.transaction_metadata,
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
    out["transactionMetadata"] = transaction_metadata
    out["transactionSafety"] = transaction_safety
    out["transactionPreflightAudit"] = transaction_preflight_audit
    out["undoRedoIntegrityMetadata"] = transaction_metadata["undoRedoIntegrityMetadata"]
    return out


@commands_router.post("/models/{model_id}/redo")
async def redo_model(
    model_id: UUID,
    body: UndoRedoEnvelope,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
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
    parent_revision = (
        body.parent_revision if body.parent_revision is not None else redo_row.revision_after
    )
    transaction_safety, transaction_preflight_audit = _preflight_or_409(
        current_revision=baseline.revision,
        parent_revision=parent_revision,
        mode="redo",
        surface="redo",
        commands=list(redo_row.forward_commands),
    )
    if redo_row.revision_after != baseline.revision:
        _preflight_or_409(
            current_revision=baseline.revision,
            parent_revision=redo_row.revision_after,
            mode="redo",
            surface="redo",
            commands=list(redo_row.forward_commands),
        )

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
    transaction_metadata = build_transaction_metadata(
        doc_before=baseline,
        new_doc=new_doc,
        commands=list(redo_row.forward_commands),
        user_id=uid,
        submitter="redo",
        parent_revision=baseline.revision,
        action="redo",
        workflow={
            "route": "/api/models/{model_id}/redo",
            "entryPoint": "redo",
            "surface": "api-v2",
        },
    )
    transaction_metadata["transactionSafety"] = transaction_safety
    transaction_metadata["transactionPreflightAudit"] = transaction_preflight_audit
    transaction_metadata["undoRedoIntegrityMetadata"] = build_undo_redo_integrity_metadata(
        original_transaction_metadata=redo_row.transaction_metadata,
        action="redo",
        revision_before=baseline.revision,
        revision_after=new_doc.revision,
    )

    await session.delete(redo_row)
    session.add(
        UndoStackRecord(
            model_id=model_id,
            user_id=uid,
            revision_after=new_doc.revision,
            forward_commands=list(redo_row.forward_commands),
            undo_commands=undo_cmds,
            transaction_metadata=transaction_metadata,
            commit_id=current_commit_id(),
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
    out["transactionMetadata"] = transaction_metadata
    out["transactionSafety"] = transaction_safety
    out["transactionPreflightAudit"] = transaction_preflight_audit
    out["undoRedoIntegrityMetadata"] = transaction_metadata["undoRedoIntegrityMetadata"]
    return out
