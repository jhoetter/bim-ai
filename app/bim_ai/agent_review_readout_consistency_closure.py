"""Deterministic consistency closure across Agent Review readouts (WP-A02/A04/F02/F03/V01)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

FORMAT = "agentReviewReadoutConsistencyClosure_v1"
SCHEMA_VERSION = 1

# Stable readout row order — must not change across revisions.
READOUT_ROW_ORDER: tuple[str, ...] = (
    "briefAcceptance",
    "bundleQaChecklist",
    "mergePreflight",
    "baselineLifecycle",
    "browserRenderingBudget",
)

# Expected top-level field names per readout type.
_EXPECTED_FIELDS: dict[str, tuple[str, ...]] = {
    "briefAcceptance": ("format", "schemaVersion", "rows"),
    "bundleQaChecklist": ("format", "rows"),
    "mergePreflight": (
        "format",
        "reasonCode",
        "safeRetryClassification",
        "missingReferenceHints",
        "evidenceDigestSha256",
    ),
    "baselineLifecycle": (
        "format",
        "ingestTargetCount",
        "rollupDigestCorrelationStatus",
        "rollupSuggestedNextAction",
        "rollupCiGateHint",
        "fixLoopBlockerCodes",
        "gateClosed",
        "rows",
    ),
    "browserRenderingBudget": (
        "format",
        "rows",
        "largeModelProofSummary",
        "suggestedInvestigationRoute",
    ),
}

# Advisory rule IDs emitted by this module.
ADVISORY_BUNDLE_ID_DRIFT = "agent_review_readout_bundle_id_drift"
ADVISORY_DIGEST_DRIFT = "agent_review_readout_digest_drift"
ADVISORY_MISSING_FIELDS = "agent_review_readout_missing_fields"

ConsistencyToken = str  # "aligned" | "bundle_id_drift" | "digest_drift" | "missing_fields"


def _extract_bundle_id(readout_id: str, payload: dict[str, Any] | None) -> str | None:
    """Extract the bundle artifact basename from a readout payload, if discoverable."""
    if payload is None:
        return None
    if readout_id == "briefAcceptance":
        rows = payload.get("rows")
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                arts = row.get("expectedEvidenceArtifacts")
                if isinstance(arts, list) and arts:
                    first = arts[0]
                    if isinstance(first, str) and first:
                        return first
        return None
    if readout_id == "baselineLifecycle":
        ids = payload.get("expectedBaselineIds")
        if isinstance(ids, list) and ids:
            first = ids[0]
            if isinstance(first, str) and first:
                return first
        return None
    return None


def _extract_evidence_digest(readout_id: str, payload: dict[str, Any] | None) -> str | None:
    """Extract evidence digest SHA-256 from a readout payload, if present."""
    if payload is None:
        return None
    if readout_id == "mergePreflight":
        d = payload.get("evidenceDigestSha256")
        if isinstance(d, str) and len(d) == 64:
            return d
    return None


def _consistency_token(
    *,
    has_missing_fields: bool,
    bundle_id_seen: str | None,
    evidence_digest_seen: str | None,
    all_bundle_ids: list[str],
    all_digests: list[str],
) -> ConsistencyToken:
    if has_missing_fields:
        return "missing_fields"
    if bundle_id_seen is not None and len(all_bundle_ids) > 1:
        non_null = [b for b in all_bundle_ids if b is not None]
        if len(set(non_null)) > 1:
            return "bundle_id_drift"
    if evidence_digest_seen is not None and len(all_digests) > 1:
        non_null = [d for d in all_digests if d is not None]
        if len(set(non_null)) > 1:
            return "digest_drift"
    return "aligned"


def _build_row(
    readout_id: str,
    payload: dict[str, Any] | None,
    *,
    all_bundle_ids: list[str],
    all_digests: list[str],
) -> dict[str, Any]:
    expected = list(_EXPECTED_FIELDS.get(readout_id, ()))
    if payload is None:
        return {
            "readoutId": readout_id,
            "expectedFieldNames": expected,
            "presentFieldNames": [],
            "missingFieldNames": expected,
            "bundleIdSeen": None,
            "evidenceDigestSeen": None,
            "consistencyToken": "missing_fields",
        }
    present = [f for f in expected if f in payload]
    missing = [f for f in expected if f not in payload]
    bundle_id = _extract_bundle_id(readout_id, payload)
    digest = _extract_evidence_digest(readout_id, payload)
    token = _consistency_token(
        has_missing_fields=bool(missing),
        bundle_id_seen=bundle_id,
        evidence_digest_seen=digest,
        all_bundle_ids=all_bundle_ids,
        all_digests=all_digests,
    )
    return {
        "readoutId": readout_id,
        "expectedFieldNames": expected,
        "presentFieldNames": present,
        "missingFieldNames": missing,
        "bundleIdSeen": bundle_id,
        "evidenceDigestSeen": digest,
        "consistencyToken": token,
    }


def _advisory_findings(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for row in rows:
        token = row.get("consistencyToken", "")
        rid = str(row.get("readoutId", ""))
        if token == "missing_fields":
            findings.append(
                {
                    "ruleId": ADVISORY_MISSING_FIELDS,
                    "readoutId": rid,
                    "severity": "info",
                    "message": (
                        f"Readout '{rid}' is missing fields: "
                        + ", ".join(row.get("missingFieldNames") or [])
                    ),
                }
            )
        elif token == "bundle_id_drift":
            findings.append(
                {
                    "ruleId": ADVISORY_BUNDLE_ID_DRIFT,
                    "readoutId": rid,
                    "severity": "warn",
                    "message": (
                        f"Readout '{rid}' bundle id '{row.get('bundleIdSeen')}' "
                        "disagrees with other readouts."
                    ),
                }
            )
        elif token == "digest_drift":
            findings.append(
                {
                    "ruleId": ADVISORY_DIGEST_DRIFT,
                    "readoutId": rid,
                    "severity": "warn",
                    "message": (
                        f"Readout '{rid}' evidence digest '{row.get('evidenceDigestSeen')}' "
                        "disagrees with other readouts."
                    ),
                }
            )
    return findings


def _digest_rows(rows: list[dict[str, Any]]) -> str:
    canonical = json.dumps(rows, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def agent_review_readout_consistency_closure_v1(
    *,
    readout_brief_acceptance: dict[str, Any] | None,
    readout_bundle_qa_checklist: dict[str, Any] | None,
    readout_merge_preflight: dict[str, Any] | None,
    readout_baseline_lifecycle: dict[str, Any] | None,
    readout_browser_rendering_budget: dict[str, Any] | None,
    closure_hints: dict[str, Any],
) -> dict[str, Any]:
    """Cross-check Agent Review readouts for field presence, bundle id, and evidence digest drift.

    Uses closure_hints field path names (from agent_evidence_closure_hints) to reference
    canonical readout keys without duplicating field discovery logic.
    """
    payloads: dict[str, dict[str, Any] | None] = {
        "briefAcceptance": readout_brief_acceptance,
        "bundleQaChecklist": readout_bundle_qa_checklist,
        "mergePreflight": readout_merge_preflight,
        "baselineLifecycle": readout_baseline_lifecycle,
        "browserRenderingBudget": readout_browser_rendering_budget,
    }

    # Collect all non-null bundle ids and digests for drift detection.
    all_bundle_ids: list[str] = []
    all_digests: list[str] = []
    for rid in READOUT_ROW_ORDER:
        p = payloads[rid]
        b = _extract_bundle_id(rid, p)
        d = _extract_evidence_digest(rid, p)
        if b is not None:
            all_bundle_ids.append(b)
        if d is not None:
            all_digests.append(d)

    rows: list[dict[str, Any]] = []
    for readout_id in READOUT_ROW_ORDER:
        rows.append(
            _build_row(
                readout_id,
                payloads[readout_id],
                all_bundle_ids=all_bundle_ids,
                all_digests=all_digests,
            )
        )

    assert tuple(r["readoutId"] for r in rows) == READOUT_ROW_ORDER

    advisory_findings = _advisory_findings(rows)

    # Canonical field path reference: use hints to surface field keys without duplicating them.
    readout_field_refs = {
        "briefAcceptance": closure_hints.get("agentBriefAcceptanceReadoutField"),
        "bundleQaChecklist": closure_hints.get("agentGeneratedBundleQaChecklistField"),
        "baselineLifecycle": closure_hints.get("evidenceBaselineLifecycleReadoutField"),
    }

    return {
        "format": FORMAT,
        "schemaVersion": SCHEMA_VERSION,
        "semanticDigestExclusionNote": (
            "agentReviewReadoutConsistencyClosure_v1 is derivative; "
            "excluded from semanticDigestSha256."
        ),
        "readoutFieldRefs": readout_field_refs,
        "rows": rows,
        "advisoryFindings": advisory_findings,
        "agentReviewReadoutConsistencyClosureDigestSha256": _digest_rows(rows),
    }
