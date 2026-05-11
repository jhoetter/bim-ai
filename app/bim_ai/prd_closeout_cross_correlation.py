"""PRD closeout cross-correlation manifest (Wave 3 / WP-A01/A02/A04/F01/V01).

Cross-correlates PRD §11–§15 advisor matrix sections with v1 closeout readiness
manifest gates and prd traceability test rows. Produces a deterministic manifest
with one row per PRD section and a crossCorrelationToken per row.

Surfaces:
  - prdAdvisorMatrix_v1 (advisor matrix status per section)
  - v1CloseoutReadinessManifest_v1 (CI gates)
  - prd_traceability_matrix test rows

Token vocabulary (in priority order):
  status_drift       — advisor section has block status but no readiness gate is failing
  reason_code_drift  — deferred section waiver code not explicitly mirrored in readiness
  advisor_only       — section in advisor matrix only; no specific readiness gate or traceability
  aligned            — section has specific readiness gate AND traceability test coverage
  readiness_only     — gate in readiness manifest with no advisor matrix section (rare)

Note: this module intentionally does NOT import v1_closeout_readiness_manifest to avoid
a circular dependency (the readiness manifest embeds this manifest). Gate structural status
is computed directly from file-system checks (same logic as the readiness manifest gates).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]

CROSS_CORRELATION_TOKENS: frozenset[str] = frozenset(
    {
        "aligned",
        "advisor_only",
        "readiness_only",
        "status_drift",
        "reason_code_drift",
    }
)

# Traceability test row IDs per advisor matrix section id.
# Source: test_prd_traceability_matrix._TRACEABILITY_ROWS
_ADVISOR_TO_TRACEABILITY_IDS: dict[str, list[str]] = {
    "prd_s11_sheets": ["validation_sheets_advisory"],
    "prd_s12_exchange_replay": ["exchange_json_replay"],
    "prd_s14_golden_bundle": ["phase_a_golden_bundle"],
    "prd_s15_golden_fixture": ["verification_golden_fixture"],
    "prd_s15_python_unit_tests": ["ci_pytest_gate"],
}

# Specific (non-holistic) readiness gate IDs per advisor matrix section id.
# These are gates in v1CloseoutReadinessManifest_v1 that explicitly cover the section.
_ADVISOR_TO_SPECIFIC_READINESS_GATES: dict[str, list[str]] = {
    "prd_s11_sheets": ["pytest_prd_traceability_matrix"],
    "prd_s12_exchange_replay": [
        "pytest_seed_artifact_roundtrip",
        "pytest_prd_traceability_matrix",
    ],
    "prd_s14_golden_bundle": [
        "seed_artifact_contract",
        "pytest_seed_artifact_roundtrip",
        "pytest_prd_traceability_matrix",
    ],
    "prd_s15_golden_fixture": ["pytest_prd_traceability_matrix"],
    "prd_s15_python_unit_tests": [
        "github_workflows_ci_pytest",
        "pytest_prd_traceability_matrix",
    ],
}

# This gate holistically covers all PRD advisor sections (runs test_prd_blocking_advisor_matrix).
_HOLISTIC_READINESS_GATE_ID = "pytest_prd_blocking_advisor_matrix"

# Deferred blocker IDs in the readiness manifest that explicitly mirror waiver reason codes.
# Currently the readiness manifest has only general deferred blockers without per-waiver-code
# entries, so deferred sections with explicit waiver reason codes get `reason_code_drift`.
_READINESS_DEFERRED_BLOCKER_IDS_WITH_WAIVER_CODES: frozenset[str] = frozenset()


def _compute_cross_correlation_token(
    *,
    advisor_status: str,
    waiver_reason_code: str | None,
    specific_readiness_gate_ids: list[str],
    traceability_test_ids: list[str],
    holistic_gate_structuralok: bool,
) -> str:
    """Derive the cross-correlation token for one PRD section row."""
    # status_drift: block status in advisor but no readiness gate is failing
    if advisor_status == "block" and holistic_gate_structuralok:
        return "status_drift"

    # reason_code_drift: deferred section with waiver code not mirrored in readiness manifest
    if advisor_status == "deferred" and waiver_reason_code:
        mirrored = waiver_reason_code in _READINESS_DEFERRED_BLOCKER_IDS_WITH_WAIVER_CODES
        if not mirrored:
            return "reason_code_drift"

    # advisor_only: no specific readiness gate and no traceability entry
    if not specific_readiness_gate_ids and not traceability_test_ids:
        return "advisor_only"

    return "aligned"


def _holistic_gate_structuralok() -> bool:
    """Check whether the holistic PRD blocking advisor gate is structurally ok.

    Replicates the same file-existence check used by v1_closeout_readiness_manifest
    for the pytest_prd_blocking_advisor_matrix gate, avoiding a circular import.
    """
    return (_REPO_ROOT / "app" / "tests" / "test_prd_blocking_advisor_matrix.py").is_file()


def build_prd_closeout_cross_correlation_manifest_v1() -> dict[str, Any]:
    """Build the deterministic PRD closeout cross-correlation manifest.

    Cross-correlates every PRD advisor matrix section with readiness manifest gates
    and traceability test IDs. Returns a dict with rows sorted by prdSectionId and
    a SHA-256 content digest.
    """
    from bim_ai.prd_blocking_advisor_matrix import build_prd_blocking_advisor_matrix

    advisor_matrix = build_prd_blocking_advisor_matrix()
    holistic_ok = _holistic_gate_structuralok()

    rows: list[dict[str, Any]] = []
    for advisor_row in advisor_matrix["rows"]:
        section_id = str(advisor_row["id"])
        advisor_status = str(advisor_row.get("status") or "")
        waiver_code = advisor_row.get("waiverReasonCode")

        specific_gates = sorted(_ADVISOR_TO_SPECIFIC_READINESS_GATES.get(section_id, []))
        traceability_ids = sorted(_ADVISOR_TO_TRACEABILITY_IDS.get(section_id, []))

        # All readiness gates for this section = holistic + specific
        all_readiness_gate_ids = sorted(set([_HOLISTIC_READINESS_GATE_ID] + specific_gates))

        token = _compute_cross_correlation_token(
            advisor_status=advisor_status,
            waiver_reason_code=waiver_code if isinstance(waiver_code, str) else None,
            specific_readiness_gate_ids=specific_gates,
            traceability_test_ids=traceability_ids,
            holistic_gate_structuralok=holistic_ok,
        )

        row: dict[str, Any] = {
            "prdSectionId": section_id,
            "prdSection": str(advisor_row.get("prdSection") or ""),
            "prdSectionTitle": str(advisor_row.get("prdSectionTitle") or ""),
            "advisorMatrixStatus": advisor_status,
            "readinessGateIds": all_readiness_gate_ids,
            "specificReadinessGateIds": specific_gates,
            "traceabilityTestIds": traceability_ids,
            "crossCorrelationToken": token,
        }
        if waiver_code:
            row["waiverReasonCode"] = waiver_code
        rows.append(row)

    rows.sort(key=lambda r: str(r["prdSectionId"]))

    # Token summary counts
    token_counts: dict[str, int] = {t: 0 for t in sorted(CROSS_CORRELATION_TOKENS)}
    for row in rows:
        t = str(row.get("crossCorrelationToken") or "")
        if t in token_counts:
            token_counts[t] += 1

    # Advisory violations embedded in the manifest
    advisory_findings = _build_advisory_findings(rows)

    body: dict[str, Any] = {
        "format": "prdCloseoutCrossCorrelationManifest_v1",
        "schemaVersion": 1,
        "rows": rows,
        "tokenCounts": token_counts,
        "allowedTokens": sorted(CROSS_CORRELATION_TOKENS),
        "advisoryFindings": advisory_findings,
        "note": (
            "Deterministic PRD closeout cross-correlation for WP-A01/A02/A04/F01/V01 wave 3. "
            "Does not claim v1 completion. advisor_only and reason_code_drift tokens indicate "
            "surfaces where additional explicit cross-referencing would improve coverage evidence."
        ),
    }

    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**body, "prdCloseoutCrossCorrelationDigestSha256": digest}


def _build_advisory_findings(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Generate structured advisory findings for cross-correlation drift rows."""
    findings: list[dict[str, Any]] = []
    for row in rows:
        token = str(row.get("crossCorrelationToken") or "")
        section_id = str(row.get("prdSectionId") or "")

        if token == "status_drift":
            findings.append(
                {
                    "ruleId": "prd_closeout_advisor_readiness_status_drift",
                    "severity": "warning",
                    "prdSectionId": section_id,
                    "message": (
                        f"PRD section {section_id!r} has 'block' status in the advisor matrix "
                        "but no readiness manifest gate is failing for it (status_drift)."
                    ),
                }
            )
        elif token == "reason_code_drift":
            waiver_code = str(row.get("waiverReasonCode") or "")
            findings.append(
                {
                    "ruleId": "prd_closeout_reason_code_drift",
                    "severity": "info",
                    "prdSectionId": section_id,
                    "message": (
                        f"PRD section {section_id!r} has waiverReasonCode {waiver_code!r} in "
                        "the advisor matrix but this code is not explicitly mirrored in the "
                        "readiness manifest deferred blockers (reason_code_drift)."
                    ),
                }
            )
        elif token == "advisor_only":
            findings.append(
                {
                    "ruleId": "prd_closeout_section_missing_in_readiness",
                    "severity": "info",
                    "prdSectionId": section_id,
                    "message": (
                        f"PRD section {section_id!r} has only holistic readiness gate coverage "
                        "and no direct traceability test entry (advisor_only). "
                        "Consider adding a dedicated traceability row."
                    ),
                }
            )

    findings.sort(key=lambda f: (str(f.get("prdSectionId") or ""), str(f.get("ruleId") or "")))
    return findings


def prd_closeout_advisory_violations(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return structured advisory findings for the given cross-correlation rows.

    Findings use rule IDs registered in constraints._RULE_DISCIPLINE:
      prd_closeout_advisor_readiness_status_drift
      prd_closeout_section_missing_in_readiness
      prd_closeout_reason_code_drift
    """
    return _build_advisory_findings(rows)
