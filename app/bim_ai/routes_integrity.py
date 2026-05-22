from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.engine import try_commit_bundle
from bim_ai.integrity_preflight import (
    DEFAULT_PROFILE_COMPARISON_PROFILES,
    build_integrity_preflight_report,
    build_multi_profile_comparison,
    build_source_command_index_from_transactions,
)
from bim_ai.model_integrity import model_integrity_smoke_command_evidence_v1
from bim_ai.routes_deps import load_model_row
from bim_ai.tables import UndoStackRecord
from bim_ai.transaction_safety import build_dry_run_evidence

integrity_router = APIRouter()
_SESSION_DEPENDENCY = Depends(get_session)
_EMPTY_BODY = Body(default_factory=dict)


@integrity_router.post("/v3/invariants/smoke")
async def invariant_smoke_route(body: dict[str, Any] = _EMPTY_BODY) -> dict[str, Any]:
    return model_integrity_smoke_command_evidence_v1(body)


@integrity_router.get("/models/{model_id}/qa/integrity-preflight")
async def integrity_preflight_route(
    model_id: UUID,
    changed_element_ids: str | None = Query(None, alias="changedElementIds"),
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    source_command_index = await _source_command_index(session, model_id)
    return build_integrity_preflight_report(
        doc,
        revision=doc.revision,
        model_id=str(model_id),
        changed_element_ids=_csv(changed_element_ids),
        source_command_index=source_command_index,
    )


@integrity_router.get("/models/{model_id}/qa/profile-comparison")
async def profile_comparison_route(
    model_id: UUID,
    profiles: str | None = Query(None),
    changed_element_ids: str | None = Query(None, alias="changedElementIds"),
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return {
        "modelId": str(model_id),
        **build_multi_profile_comparison(
            doc.elements,
            revision=doc.revision,
            profiles=_csv(profiles) or DEFAULT_PROFILE_COMPARISON_PROFILES,
            changed_element_ids=_csv(changed_element_ids),
        ),
    }


@integrity_router.post("/models/{model_id}/qa/integrity-remediation")
async def integrity_remediation_route(
    model_id: UUID,
    body: dict[str, Any] = _EMPTY_BODY,
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    mode = str(body.get("mode") or "dry_run")
    if mode != "dry_run":
        raise HTTPException(
            status_code=400,
            detail="Use /commands/bundle to commit accepted fixes after a matching dry-run.",
        )
    accepted_ids = {str(value) for value in body.get("proposalIds") or [] if value}
    report = build_integrity_preflight_report(doc, revision=doc.revision, model_id=str(model_id))
    proposals = [
        proposal
        for proposal in report["remediation"]["proposals"]
        if not accepted_ids or str(proposal.get("proposalId")) in accepted_ids
    ]
    dry_runs = []
    for proposal in proposals:
        commands = [dict(command) for command in proposal.get("commands") or []]
        ok, _new_doc, _cmds, violations, code = try_commit_bundle(doc, commands)
        dry_run_evidence = build_dry_run_evidence(
            parent_revision=doc.revision,
            commands=commands,
            ok=ok,
            reason=code,
            violations=[v.model_dump(by_alias=True) for v in violations],
            evidence_path="integrity-remediation-dry-run.json",
        )
        dry_runs.append(
            {
                "proposalId": proposal.get("proposalId"),
                "ok": ok,
                "reason": code,
                "commands": commands,
                "violations": [v.model_dump(by_alias=True) for v in violations],
                "dryRunEvidence": dry_run_evidence,
                "commitRequest": {
                    "route": "/api/models/{model_id}/bundles",
                    "method": "POST",
                    "body": {
                        "mode": "commit",
                        "actorKind": "agent",
                        "submitter": "agent-remediation",
                        "dryRunEvidence": dry_run_evidence,
                        "bundle": {
                            "schemaVersion": "cmd-v3.0",
                            "parentRevision": doc.revision,
                            "commands": commands,
                            "assumptions": [],
                        },
                    },
                },
            }
        )
    return {
        "format": "integrityRemediationDryRun_v1",
        "modelId": str(model_id),
        "revision": doc.revision,
        "proposalCount": len(proposals),
        "dryRuns": dry_runs,
        "commitRoute": "/api/models/{model_id}/commands/bundle",
        "explicitCommitRoute": "/api/models/{model_id}/bundles",
        "commitPolicy": {
            "defaultMode": "dry_run",
            "requiresProposalIds": True,
            "requiresPassingDryRunEvidence": True,
            "silentMutationAllowed": False,
        },
        "recaptureEvidenceRoute": "/api/models/{model_id}/qa/integrity-preflight",
    }


def _csv(value: str | None) -> list[str]:
    if value is None:
        return []
    return [chunk.strip() for chunk in value.split(",") if chunk.strip()]


async def _source_command_index(
    session: AsyncSession,
    model_id: UUID,
) -> dict[str, list[dict[str, Any]]]:
    res = await session.execute(
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(desc(UndoStackRecord.id))
        .limit(250)
    )
    transactions = [
        {
            "id": row.id,
            "revisionAfter": row.revision_after,
            "appliedCommands": list(row.forward_commands),
            "transactionMetadata": row.transaction_metadata,
        }
        for row in res.scalars().all()
    ]
    return build_source_command_index_from_transactions(transactions)
