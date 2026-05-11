"""Pure-Python helper for summarising a CI gate run — no subprocess execution."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bim_ai.constructability_report import build_constructability_report
from bim_ai.elements import Element

_SCHEMA_VERSION = "v1"


def summarize_ci_gate_run_v1(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Return a deterministic ciGateRunSummary_v1 manifest from per-gate result rows.

    Each row must contain at least {"name": str, "result": "ok" | "fail" | "warn"}.
    Verdict is "fail" when any row has result == "fail"; "warn" rows do not flip it.
    """
    gates = [dict(r) for r in rows]
    canonical = json.dumps(gates, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    has_failure = any(r.get("result") == "fail" for r in gates)
    return {
        "format": "ciGateRunSummary_v1",
        "schemaVersion": _SCHEMA_VERSION,
        "gates": gates,
        "aggregateDigestSha256": digest,
        "verdict": "fail" if has_failure else "pass",
    }


def constructability_ci_gate_rows_v1(
    elements: dict[str, Element],
    *,
    revision: str | int,
    fail_on_constructability_error: bool = False,
    profile: str = "construction_readiness",
) -> list[dict[str, Any]]:
    """Return deterministic CI gate rows for a constructability report.

    This is the pure helper behind a future ``--fail-on-constructability-error`` CLI flag.
    Default authoring workflows can call it with the flag disabled and still receive counts.
    """

    report = build_constructability_report(elements, revision=revision, profile=profile)
    summary = report["summary"]
    severity_counts = summary.get("severityCounts") or {}
    status_counts = summary.get("statusCounts") or {}
    error_count = int(severity_counts.get("error") or 0)
    suppressed_count = int(summary.get("suppressedFindingCount") or 0)

    rows = [
        {
            "name": "constructability_profile_recorded",
            "result": "ok" if report.get("profile") else "fail",
            "profile": report.get("profile"),
        },
        {
            "name": "constructability_no_open_errors",
            "result": "fail" if fail_on_constructability_error and error_count > 0 else "ok",
            "errorCount": error_count,
            "failOnConstructabilityError": fail_on_constructability_error,
        },
        {
            "name": "constructability_suppression_audit",
            "result": "ok",
            "suppressedFindingCount": suppressed_count,
            "suppressedIssueCount": int(status_counts.get("suppressed") or 0),
        },
    ]
    return rows


def summarize_constructability_ci_gate_v1(
    elements: dict[str, Element],
    *,
    revision: str | int,
    fail_on_constructability_error: bool = False,
    profile: str = "construction_readiness",
) -> dict[str, Any]:
    rows = constructability_ci_gate_rows_v1(
        elements,
        revision=revision,
        fail_on_constructability_error=fail_on_constructability_error,
        profile=profile,
    )
    return summarize_ci_gate_run_v1(rows)
