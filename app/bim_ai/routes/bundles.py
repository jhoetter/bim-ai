"""CMD-V3-01 — command-bundle apply route extracted from routes/api.py (BRT-24).

Exposes ``POST /api/models/{model_id}/bundles`` plus the
``CommandBundleRequest`` wire model. Mounted into the top-level
``api_router`` in ``routes/api.py`` alongside the other route packages.

This module owns the full apply-bundle workflow: caller-role gating,
transaction-safety preflight, idempotent-replay short-circuit, undo
emission, and post-commit WS delta broadcast.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pydantic_core import InitErrorDetails, PydanticCustomError
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.activity import emit_activity_row
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.db import find_idempotent_undo_record, get_session
from bim_ai.document import Document
from bim_ai.engine import clone_document, compute_delta_wire, diff_undo_cmds
from bim_ai.hub import Hub
from bim_ai.permissions import authorize_command
from bim_ai.routes.deps import (
    delete_redos,
    document_to_wire,
    get_hub,
    load_model_row,
    resolve_caller_role,
    resolve_token_role,
)
from bim_ai.tables import UndoStackRecord
from bim_ai.transaction_metadata import build_transaction_metadata, command_bundle_digest
from bim_ai.transaction_safety import (
    ActorKind,
    assess_transaction_safety,
    build_dry_run_evidence,
    build_transaction_preflight_audit,
)
from bim_ai.versioning import current_commit_id

bundles_router = APIRouter()


# Advisory classes that surface as HTTP 409 instead of a non-applied result.
_BLOCKING_ADVISORY_CLASSES = {
    "revision_conflict",
    "assumption_log_required",
    "assumption_log_malformed",
    "assumption_log_duplicate_key",
    "direct_main_commit_forbidden",
    "option_not_found",
    "bundle_apply_failed",
}


_DRY_RUN_REQUIRED_ACTORS: frozenset[ActorKind] = frozenset({"agent", "mcp-client"})


class CommandBundleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bundle: CommandBundle
    # Literal (not free-form str) so an unknown mode 422s up front instead of
    # silently demoting to "dry_run" inside the route — see #134 (MF-mcp-2).
    mode: Literal["dry_run", "commit"] = Field(default="dry_run")
    user_id: str | None = Field(default="local-dev", alias="userId")
    client_op_id: str | None = Field(default=None, alias="clientOpId")
    submitter: str = Field(default="human")
    actor_kind: ActorKind = Field(default="human", alias="actorKind")
    dry_run_evidence: dict[str, Any] | None = Field(default=None, alias="dryRunEvidence")

    @model_validator(mode="after")
    def _require_dry_run_evidence_for_agent_commit(self) -> CommandBundleRequest:
        """Agent/MCP commits MUST carry dryRunEvidence (#134, MF-mcp-2).

        Without this guard the request silently flowed through the
        transactionSafety gate and the only signal that the commit was
        rejected was buried at ``transactionPreflightAudit.mode``. We surface
        the failure as a structured 422 with ``loc=["body", "dryRunEvidence"]``
        so the caller can fix the request without spelunking the response.
        """
        if (
            self.mode == "commit"
            and self.actor_kind in _DRY_RUN_REQUIRED_ACTORS
            and self.dry_run_evidence is None
        ):
            raise ValidationError.from_exception_data(
                title=self.__class__.__name__,
                line_errors=[
                    InitErrorDetails(
                        type=PydanticCustomError(
                            "missing",
                            "Required when mode='commit' and actorKind in "
                            "{'agent', 'mcp-client'}. Run POST "
                            "/api/models/{id}/commands/bundle/dry-run first and "
                            "pass the returned dryRunEvidence object here.",
                        ),
                        loc=("dryRunEvidence",),
                        input=None,
                    )
                ],
            )
        return self


@bundles_router.post("/models/{model_id}/bundles")
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
    # body.mode is constrained to Literal["dry_run", "commit"] so the
    # request would have 422'd by now if it were anything else.
    mode = body.mode
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
