from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.engine import try_commit_bundle
from bim_ai.integrity_preflight import (
    DEFAULT_PROFILE_COMPARISON_PROFILES,
    build_integrity_preflight_report,
    build_multi_profile_comparison,
)
from bim_ai.routes_deps import load_model_row
from bim_ai.transaction_safety import build_dry_run_evidence

integrity_router = APIRouter()


@integrity_router.get("/models/{model_id}/qa/integrity-preflight")
async def integrity_preflight_route(
    model_id: UUID,
    changed_element_ids: str | None = Query(None, alias="changedElementIds"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    return build_integrity_preflight_report(
        doc,
        revision=doc.revision,
        model_id=str(model_id),
        changed_element_ids=_csv(changed_element_ids),
    )


@integrity_router.get("/models/{model_id}/qa/profile-comparison")
async def profile_comparison_route(
    model_id: UUID,
    profiles: str | None = Query(None),
    changed_element_ids: str | None = Query(None, alias="changedElementIds"),
    session: AsyncSession = Depends(get_session),
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
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
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
        dry_runs.append(
            {
                "proposalId": proposal.get("proposalId"),
                "ok": ok,
                "reason": code,
                "commands": commands,
                "violations": [v.model_dump(by_alias=True) for v in violations],
                "dryRunEvidence": build_dry_run_evidence(
                    parent_revision=doc.revision,
                    commands=commands,
                    ok=ok,
                    reason=code,
                    violations=[v.model_dump(by_alias=True) for v in violations],
                    evidence_path="integrity-remediation-dry-run.json",
                ),
            }
        )
    return {
        "format": "integrityRemediationDryRun_v1",
        "modelId": str(model_id),
        "revision": doc.revision,
        "proposalCount": len(proposals),
        "dryRuns": dry_runs,
        "commitRoute": "/api/models/{model_id}/commands/bundle",
        "recaptureEvidenceRoute": "/api/models/{model_id}/qa/integrity-preflight",
    }


def _csv(value: str | None) -> list[str]:
    if value is None:
        return []
    return [chunk.strip() for chunk in value.split(",") if chunk.strip()]
