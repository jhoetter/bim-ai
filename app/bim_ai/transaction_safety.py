from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

TRANSACTION_SAFETY_SCHEMA_VERSION = "transactionSafety_v1"
DRY_RUN_EVIDENCE_SCHEMA_VERSION = "dryRunEvidence_v1"
REMEDIATION_PROPOSAL_SCHEMA_VERSION = "agentRemediationProposal_v1"
TRANSACTION_PREFLIGHT_AUDIT_SCHEMA_VERSION = "transactionPreflightAudit_v1"
UNDO_REDO_INTEGRITY_METADATA_SCHEMA_VERSION = "undoRedoIntegrityMetadata_v1"

TransactionMode = Literal["dry_run", "commit", "undo", "redo"]
TransactionSurface = Literal[
    "dry-run",
    "commit",
    "bundle-commit",
    "ui-command-commit",
    "mcp-mutation",
    "undo",
    "redo",
]
ActorKind = Literal["human", "agent", "ci", "mcp-client"]
FixSafety = Literal["safe_automatic", "review_required", "destructive", "needs_user_intent"]
PermissionScope = Literal["mutation", "export", "external_service", "destructive"]

_VALID_FIX_SAFETY: frozenset[str] = frozenset(
    {"safe_automatic", "review_required", "destructive", "needs_user_intent"}
)
_SAFE_AUTOMATIC_COMMANDS: frozenset[str] = frozenset(
    {
        "createComment",
        "resolveComment",
        "placeTag",
        "setElementDiscipline",
        "setElementParameter",
    }
)
_DESTRUCTIVE_TOKENS: tuple[str, ...] = (
    "delete",
    "remove",
    "purge",
    "demolish",
    "restore",
    "force",
)
_EXPORT_TOKENS: tuple[str, ...] = ("export", "publish", "download")
_EXTERNAL_TOKENS: tuple[str, ...] = ("external", "upload", "sync", "reloadlink", "link")
_FIX_SAFETY_RANK: dict[FixSafety, int] = {
    "safe_automatic": 0,
    "review_required": 1,
    "needs_user_intent": 2,
    "destructive": 3,
}


class DryRunEvidence(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: str = Field(default=DRY_RUN_EVIDENCE_SCHEMA_VERSION, alias="schemaVersion")
    parent_revision: int = Field(alias="parentRevision")
    command_digest_sha256: str = Field(alias="commandDigestSha256")
    ok: bool
    evidence_path: str | None = Field(default=None, alias="evidencePath")
    summary_digest_sha256: str | None = Field(default=None, alias="summaryDigestSha256")


class ActorIdentity(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    actor_kind: ActorKind = Field(alias="actorKind")
    actor_id: str = Field(alias="actorId")


class FixProvenance(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_finding_id: str = Field(alias="sourceFindingId")
    affected_element_ids: list[str] = Field(alias="affectedElementIds")
    before_summary: str = Field(alias="beforeSummary")
    after_summary: str = Field(alias="afterSummary")
    actor_identity: ActorIdentity = Field(alias="actorIdentity")
    evidence_path: str = Field(alias="evidencePath")


class TransactionConflict(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reason_code: str = Field(alias="reasonCode")
    current_revision: int = Field(alias="currentRevision")
    parent_revision: int | None = Field(default=None, alias="parentRevision")
    retry_safe: bool = Field(alias="retrySafe")
    message: str


class TransactionSafetyDecision(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: str = Field(
        default=TRANSACTION_SAFETY_SCHEMA_VERSION, alias="schemaVersion"
    )
    ok: bool
    reason_code: str = Field(alias="reasonCode")
    current_revision: int = Field(alias="currentRevision")
    parent_revision: int | None = Field(default=None, alias="parentRevision")
    command_digest_sha256: str = Field(alias="commandDigestSha256")
    required_permission_scopes: list[PermissionScope] = Field(
        default_factory=list, alias="requiredPermissionScopes"
    )
    dry_run_required: bool = Field(default=False, alias="dryRunRequired")
    undoable: bool = False
    inspectable: bool = False
    conflict: TransactionConflict | None = None
    rollback_guidance: str = Field(alias="rollbackGuidance")
    retry_guidance: str = Field(alias="retryGuidance")


_INTEGRITY_METADATA_KEYS: tuple[str, ...] = (
    "transactionSafety",
    "dryRunEvidence",
    "integrityPreflight",
    "remediation",
    "sourceCommands",
    "sourceCommandLinks",
)


def canonical_command_digest(commands: list[Mapping[str, Any]]) -> str:
    """Return a stable digest for command bundles before dry-run or commit."""

    canonical = json.dumps(commands, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def canonical_payload_digest(payload: Mapping[str, Any]) -> str:
    """Return a stable digest for machine-readable dry-run or safety summaries."""

    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_dry_run_evidence(
    *,
    parent_revision: int,
    commands: list[Mapping[str, Any]],
    ok: bool,
    reason: str | None = None,
    violations: list[Mapping[str, Any]] | None = None,
    summary_before: Mapping[str, Any] | None = None,
    summary_after: Mapping[str, Any] | None = None,
    evidence_path: str | None = None,
) -> dict[str, Any]:
    """Build deterministic evidence an agent/MCP commit must replay exactly."""

    command_digest = canonical_command_digest(commands)
    summary_payload: dict[str, Any] = {
        "schemaVersion": DRY_RUN_EVIDENCE_SCHEMA_VERSION,
        "parentRevision": parent_revision,
        "commandDigestSha256": command_digest,
        "ok": ok,
        "reason": reason,
        "violations": violations or [],
        "summaryBefore": summary_before,
        "summaryAfter": summary_after,
    }
    return DryRunEvidence(
        parent_revision=parent_revision,
        command_digest_sha256=command_digest,
        ok=ok,
        evidence_path=evidence_path,
        summary_digest_sha256=canonical_payload_digest(summary_payload),
    ).model_dump(by_alias=True)


def build_transaction_preflight_audit(
    *,
    current_revision: int,
    parent_revision: int | None,
    mode: TransactionMode,
    surface: TransactionSurface,
    actor_kind: ActorKind,
    commands: list[Mapping[str, Any]],
    decision: TransactionSafetyDecision | Mapping[str, Any],
) -> dict[str, Any]:
    """Return deterministic audit metadata for the pre-mutation safety gate."""

    decision_wire = (
        decision.model_dump(by_alias=True)
        if isinstance(decision, TransactionSafetyDecision)
        else dict(decision)
    )
    payload = {
        "schemaVersion": TRANSACTION_PREFLIGHT_AUDIT_SCHEMA_VERSION,
        "currentRevision": current_revision,
        "parentRevision": parent_revision,
        "mode": mode,
        "surface": surface,
        "actorKind": actor_kind,
        "commandDigestSha256": canonical_command_digest(commands),
        "commandCount": len(commands),
        "decisionReasonCode": decision_wire.get("reasonCode"),
        "decisionOk": decision_wire.get("ok") is True,
        "mutationPolicy": "candidate_document_only_until_safety_gate_passes",
    }
    payload["digestSha256"] = canonical_payload_digest(payload)
    return payload


def build_undo_redo_integrity_metadata(
    *,
    original_transaction_metadata: Mapping[str, Any] | None,
    action: Literal["undo", "redo"],
    revision_before: int,
    revision_after: int,
) -> dict[str, Any]:
    """Carry integrity/audit metadata across undo and redo without replay mutation side effects."""

    original = dict(original_transaction_metadata or {})
    preserved = {
        key: original[key]
        for key in _INTEGRITY_METADATA_KEYS
        if key in original and original[key] is not None
    }
    payload = {
        "schemaVersion": UNDO_REDO_INTEGRITY_METADATA_SCHEMA_VERSION,
        "action": action,
        "revisionBefore": revision_before,
        "revisionAfter": revision_after,
        "sourceAction": original.get("action"),
        "sourceRevisionAfter": original.get("revisionAfter"),
        "preservedKeys": sorted(preserved),
        "preserved": preserved,
    }
    payload["digestSha256"] = canonical_payload_digest(payload)
    return payload


def _command_type(command: Mapping[str, Any]) -> str:
    value = command.get("type")
    return str(value) if value is not None else ""


def _command_types(commands: list[Mapping[str, Any]]) -> list[str]:
    return [_command_type(command) for command in commands]


def _command_has_destructive_intent(command: Mapping[str, Any]) -> bool:
    ctype = _command_type(command).lower()
    if any(token in ctype for token in _DESTRUCTIVE_TOKENS):
        return True
    return bool(command.get("forcePinOverride") or command.get("destructive"))


def infer_permission_scopes(commands: list[Mapping[str, Any]]) -> list[PermissionScope]:
    """Infer coarse approval scopes for agent/MCP clients from command payloads."""

    scopes: set[PermissionScope] = set()
    if commands:
        scopes.add("mutation")
    for command in commands:
        ctype = _command_type(command).lower()
        if _command_has_destructive_intent(command):
            scopes.add("destructive")
        if any(token in ctype for token in _EXPORT_TOKENS):
            scopes.add("export")
        if any(token in ctype for token in _EXTERNAL_TOKENS):
            scopes.add("external_service")
        for key in ("sourceUrl", "externalUrl", "service", "webhookUrl"):
            if command.get(key):
                scopes.add("external_service")
    order: list[PermissionScope] = ["mutation", "export", "external_service", "destructive"]
    return [scope for scope in order if scope in scopes]


def classify_fix_safety(
    finding: Mapping[str, Any],
    commands: list[Mapping[str, Any]],
) -> FixSafety:
    """Classify remediation intent without executing commands."""

    explicit = finding.get("fixSafety") or finding.get("fix_safety")
    if isinstance(explicit, str) and explicit in _VALID_FIX_SAFETY:
        return explicit  # type: ignore[return-value]
    if finding.get("requiresUserIntent") is True:
        return "needs_user_intent"
    if not commands:
        return "needs_user_intent"
    if any(_command_has_destructive_intent(command) for command in commands):
        return "destructive"
    command_types = set(_command_types(commands))
    if command_types and command_types.issubset(_SAFE_AUTOMATIC_COMMANDS):
        return "safe_automatic"
    return "review_required"


def _overall_fix_safety(classifications: list[FixSafety]) -> FixSafety:
    if not classifications:
        return "needs_user_intent"
    return max(classifications, key=lambda value: _FIX_SAFETY_RANK[value])


def validate_fix_provenance(records: list[FixProvenance | Mapping[str, Any]]) -> dict[str, Any]:
    """Return deterministic audit-readiness metadata for automatic/agent fixes."""

    missing: list[dict[str, Any]] = []
    typed_records = [
        record if isinstance(record, FixProvenance) else FixProvenance.model_validate(record)
        for record in records
    ]
    for index, record in enumerate(typed_records):
        if not record.source_finding_id.strip():
            missing.append({"index": index, "field": "sourceFindingId"})
        if not record.affected_element_ids:
            missing.append({"index": index, "field": "affectedElementIds"})
        if not record.before_summary.strip():
            missing.append({"index": index, "field": "beforeSummary"})
        if not record.after_summary.strip():
            missing.append({"index": index, "field": "afterSummary"})
        if not record.actor_identity.actor_id.strip():
            missing.append({"index": index, "field": "actorIdentity.actorId"})
        if not record.evidence_path.strip():
            missing.append({"index": index, "field": "evidencePath"})
    return {
        "schemaVersion": "fixProvenanceValidation_v1",
        "ok": not missing,
        "recordCount": len(typed_records),
        "missing": missing,
    }


def validate_undo_redo_contract(
    *,
    transaction_metadata: Mapping[str, Any],
    forward_commands: list[Mapping[str, Any]],
    undo_commands: list[Mapping[str, Any]],
    original_transaction_metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Check that a committed remediation transaction is inspectable and undoable."""

    failures: list[str] = []
    if not forward_commands:
        failures.append("forward_commands_required")
    if not undo_commands:
        failures.append("undo_commands_required")
    undo_meta = transaction_metadata.get("undo")
    if not isinstance(undo_meta, Mapping) or undo_meta.get("available") is not True:
        failures.append("undo_metadata_available_required")
    if not transaction_metadata.get("changedIds"):
        collab_delta = transaction_metadata.get("collaborationDelta")
        if not isinstance(collab_delta, Mapping) or not collab_delta.get("changedIds"):
            failures.append("changed_ids_required")
    if transaction_metadata.get("revisionBefore") == transaction_metadata.get("revisionAfter"):
        failures.append("revision_must_advance")
    original_integrity_keys = sorted(
        key
        for key in _INTEGRITY_METADATA_KEYS
        if original_transaction_metadata
        and key in original_transaction_metadata
        and original_transaction_metadata[key] is not None
    )
    if original_integrity_keys:
        preserved = transaction_metadata.get("undoRedoIntegrityMetadata")
        if not isinstance(preserved, Mapping):
            failures.append("undo_redo_integrity_metadata_required")
        else:
            preserved_keys = sorted(str(key) for key in preserved.get("preservedKeys") or [])
            if preserved_keys != original_integrity_keys:
                failures.append("undo_redo_integrity_metadata_mismatch")
    return {
        "schemaVersion": "undoRedoContract_v1",
        "ok": not failures,
        "inspectable": not failures,
        "undoable": not failures,
        "failures": failures,
        "integrityMetadataPreserved": not original_integrity_keys
        or "undo_redo_integrity_metadata_required" not in failures
        and "undo_redo_integrity_metadata_mismatch" not in failures,
    }


def assess_transaction_safety(
    *,
    current_revision: int,
    parent_revision: int | None,
    mode: TransactionMode,
    surface: TransactionSurface,
    actor_kind: ActorKind,
    commands: list[Mapping[str, Any]],
    dry_run_evidence: DryRunEvidence | Mapping[str, Any] | None = None,
) -> TransactionSafetyDecision:
    """Validate transaction boundaries before any caller mutates shared state."""

    digest = canonical_command_digest(commands)
    scopes = infer_permission_scopes(commands)
    dry_run_required = actor_kind in {"agent", "mcp-client"} and mode == "commit"

    def blocked(reason: str, message: str, retry: str) -> TransactionSafetyDecision:
        return TransactionSafetyDecision(
            ok=False,
            reason_code=reason,
            current_revision=current_revision,
            parent_revision=parent_revision,
            command_digest_sha256=digest,
            required_permission_scopes=scopes,
            dry_run_required=dry_run_required,
            conflict=TransactionConflict(
                reason_code=reason,
                current_revision=current_revision,
                parent_revision=parent_revision,
                retry_safe=True,
                message=message,
            ),
            rollback_guidance="Model remains unchanged; do not append undo or redo rows.",
            retry_guidance=retry,
        )

    mutation_surface = surface in {
        "dry-run",
        "commit",
        "bundle-commit",
        "ui-command-commit",
        "mcp-mutation",
    }
    if mutation_surface and parent_revision is None:
        return blocked(
            "missing_parent_revision",
            "Mutation surfaces must include the revision they were based on.",
            "Reload the model revision and rebuild the dry-run or command bundle.",
        )
    if parent_revision is not None and parent_revision != current_revision:
        return blocked(
            "revision_conflict",
            f"parentRevision {parent_revision} does not match current revision {current_revision}.",
            "Reload the latest model, rebase the commands, and run a new dry-run.",
        )

    if dry_run_required:
        if dry_run_evidence is None:
            return blocked(
                "dry_run_required",
                "Agent and MCP commits require successful dry-run evidence.",
                "Run dry-run against the current revision before committing.",
            )
        evidence = (
            dry_run_evidence
            if isinstance(dry_run_evidence, DryRunEvidence)
            else DryRunEvidence.model_validate(dry_run_evidence)
        )
        if evidence.parent_revision != current_revision:
            return blocked(
                "dry_run_stale",
                "Dry-run evidence was produced against a different revision.",
                "Run dry-run again against the current revision.",
            )
        if evidence.command_digest_sha256 != digest:
            return blocked(
                "dry_run_command_mismatch",
                "Dry-run evidence does not match the commands being committed.",
                "Commit the exact dry-run bundle or produce new dry-run evidence.",
            )
        if not evidence.ok:
            return blocked(
                "dry_run_failed",
                "Dry-run evidence reported a failed bundle.",
                "Resolve dry-run violations, then retry with passing evidence.",
            )

    return TransactionSafetyDecision(
        ok=True,
        reason_code="ok",
        current_revision=current_revision,
        parent_revision=parent_revision,
        command_digest_sha256=digest,
        required_permission_scopes=scopes,
        dry_run_required=dry_run_required,
        undoable=mode in {"commit", "undo", "redo"},
        inspectable=mode in {"commit", "undo", "redo"},
        rollback_guidance="If apply fails after this gate, discard the candidate document.",
        retry_guidance="Safe to retry unchanged while current revision and dry-run digest match.",
    )


def build_agent_remediation_proposal(
    *,
    current_revision: int,
    findings: list[Mapping[str, Any]],
    commands: list[Mapping[str, Any]],
    actor_identity: ActorIdentity | Mapping[str, Any],
    evidence_path: str,
) -> dict[str, Any]:
    """Build the non-mutating proposal object an agent must dry-run before commit."""

    actor = (
        actor_identity
        if isinstance(actor_identity, ActorIdentity)
        else ActorIdentity.model_validate(actor_identity)
    )
    classifications = [classify_fix_safety(finding, commands) for finding in findings]
    provenance: list[FixProvenance] = []
    affected_ids: set[str] = set()
    finding_ids: list[str] = []
    for index, finding in enumerate(findings):
        source_finding_id = str(
            finding.get("id") or finding.get("findingId") or finding.get("ruleId") or index
        )
        finding_ids.append(source_finding_id)
        raw_ids = finding.get("elementIds") or finding.get("affectedElementIds") or []
        element_ids = sorted(str(value) for value in raw_ids if value)
        affected_ids.update(element_ids)
        before = str(finding.get("beforeSummary") or finding.get("message") or "Finding present.")
        after = str(
            finding.get("afterSummary")
            or finding.get("recommendation")
            or "Apply proposed command bundle."
        )
        provenance.append(
            FixProvenance(
                source_finding_id=source_finding_id,
                affected_element_ids=element_ids or ["unknown"],
                before_summary=before,
                after_summary=after,
                actor_identity=actor,
                evidence_path=evidence_path,
            )
        )

    digest = canonical_command_digest(commands)
    safety = assess_transaction_safety(
        current_revision=current_revision,
        parent_revision=current_revision,
        mode="dry_run",
        surface="mcp-mutation",
        actor_kind=actor.actor_kind,
        commands=commands,
    )
    return {
        "schemaVersion": REMEDIATION_PROPOSAL_SCHEMA_VERSION,
        "parentRevision": current_revision,
        "dryRunRequired": True,
        "commitAllowedWithoutDryRun": False,
        "commandDigestSha256": digest,
        "commands": list(commands),
        "findingIds": finding_ids,
        "affectedElementIds": sorted(affected_ids),
        "fixSafety": _overall_fix_safety(classifications),
        "fixSafetyByFinding": [
            {"findingId": finding_id, "fixSafety": classification}
            for finding_id, classification in zip(finding_ids, classifications, strict=True)
        ],
        "requiredPermissionScopes": safety.required_permission_scopes,
        "provenance": [record.model_dump(by_alias=True) for record in provenance],
        "provenanceValidation": validate_fix_provenance(provenance),
        "rollbackGuidance": "Dry-run and failed commit paths leave the source model unchanged.",
        "retryGuidance": "Refresh revision, regenerate commands, dry-run, then commit matching digest.",
    }


__all__ = [
    "ActorIdentity",
    "DryRunEvidence",
    "FixProvenance",
    "assess_transaction_safety",
    "build_dry_run_evidence",
    "build_agent_remediation_proposal",
    "canonical_command_digest",
    "canonical_payload_digest",
    "classify_fix_safety",
    "build_transaction_preflight_audit",
    "build_undo_redo_integrity_metadata",
    "infer_permission_scopes",
    "validate_fix_provenance",
    "validate_undo_redo_contract",
]
