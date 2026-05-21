"""Final acceptance gate for source-faithful reverse-BIM runs."""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping
from typing import Any

SOURCE_BACKED_EXISTING_NONCONFORMANCE_DISPOSITIONS = {
    "existing_nonconforming_tolerated",
    "existing_nonconforming_source_backed",
}


def _summary(payload: dict[str, Any], *path: str) -> dict[str, Any]:
    current: Any = payload
    for key in path:
        if not isinstance(current, dict):
            return {}
        current = current.get(key)
    return current if isinstance(current, dict) else {}


def _count(payload: dict[str, Any], *path: str) -> int:
    value: Any = payload
    for key in path:
        if not isinstance(value, dict):
            return 0
        value = value.get(key)
    return int(value) if isinstance(value, int | float) else 0


def _finding_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[Any] = [
        payload.get("violations"),
        payload.get("findings"),
        payload.get("issues"),
    ]
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    candidates.extend([data.get("violations"), data.get("findings"), data.get("issues")])
    for candidate in candidates:
        if isinstance(candidate, list):
            return [row for row in candidate if isinstance(row, dict)]
    return []


def _checker_summary(payload: dict[str, Any], *, nested_data: bool = False) -> dict[str, Any]:
    summary = _summary(payload, "data", "summary") if nested_data else _summary(payload, "summary")
    if "severityCounts" in summary:
        return summary
    rows = _finding_rows(payload)
    if not rows:
        return summary
    severity_counts = Counter(str(row.get("severity") or "warning") for row in rows)
    rule_counts = Counter(str(row.get("ruleId") or row.get("code") or "unknown") for row in rows)
    blocking_count = sum(1 for row in rows if row.get("blocking") is True)
    return {
        **summary,
        "findingCount": len(rows),
        "severityCounts": dict(sorted(severity_counts.items())),
        "ruleCounts": dict(sorted(rule_counts.items())),
        "blockingFindingCount": blocking_count,
    }


def _gate(gate_id: str, passed: bool, summary: dict[str, Any], blocking: list[str]) -> dict[str, Any]:
    return {
        "id": gate_id,
        "passed": passed,
        "blockingReasons": blocking,
        "summary": summary,
    }


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
    return [row for row in rows if isinstance(row, dict)]


def _unresolved_rows(payload: dict[str, Any], *, source: str | None = None) -> list[dict[str, Any]]:
    out = []
    for row in _rows(payload):
        if source is not None and row.get("source") != source:
            continue
        if row.get("blocking") and row.get("disposition") == "unresolved":
            out.append(row)
    return out


def _is_valid_existing_condition_tolerance(row: Mapping[str, Any]) -> bool:
    """Return true only for source-backed existing-condition tolerances.

    This intentionally rejects broad "reviewed" or "source-limited" warning
    dispositions. Existing-building acceptance can tolerate documented existing
    nonconformance; it cannot tolerate bad authoring.
    """

    disposition = str(row.get("disposition") or "")
    if disposition not in SOURCE_BACKED_EXISTING_NONCONFORMANCE_DISPOSITIONS:
        return False
    return bool(
        _disposition_source_fact_ids(row)
        and _disposition_reason(row)
        and _disposition_accepted_by(row)
    )


def _disposition_decision(row: Mapping[str, Any]) -> Mapping[str, Any]:
    value = row.get("dispositionDecision")
    return value if isinstance(value, Mapping) else {}


def _disposition_source_fact_ids(row: Mapping[str, Any]) -> list[str]:
    decision = _disposition_decision(row)
    raw = (
        row.get("sourceFactIds")
        or decision.get("sourceFactIds")
        or decision.get("sourceFacts")
        or row.get("evidenceFactIds")
    )
    if not isinstance(raw, list):
        return []
    return [str(item) for item in raw if item]


def _disposition_reason(row: Mapping[str, Any]) -> str:
    decision = _disposition_decision(row)
    return str(row.get("reason") or decision.get("reason") or "")


def _disposition_accepted_by(row: Mapping[str, Any]) -> str:
    decision = _disposition_decision(row)
    return str(
        row.get("acceptedBy")
        or row.get("reviewer")
        or decision.get("acceptedBy")
        or decision.get("reviewer")
        or ""
    )


def _existing_condition_tolerance_rows(finding_disposition: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in _rows(finding_disposition):
        if not _is_valid_existing_condition_tolerance(row):
            continue
        rows.append(
            {
                "id": row.get("id") or row.get("findingId"),
                "source": row.get("source"),
                "ruleId": row.get("ruleId") or row.get("code"),
                "severity": row.get("severity"),
                "disposition": row.get("disposition"),
                "elementIds": [str(item) for item in row.get("elementIds") or [] if item],
                "sourceFactIds": _disposition_source_fact_ids(row),
                "reason": _disposition_reason(row),
                "acceptedBy": _disposition_accepted_by(row),
            }
        )
    return rows


def _blocking_warning_count(
    finding_disposition: dict[str, Any],
    *,
    source: str,
    warning_count: int,
) -> int:
    if warning_count <= 0:
        return 0
    warning_rows = [
        row
        for row in _rows(finding_disposition)
        if row.get("source") == source
        and str(row.get("severity") or "").lower() == "warning"
    ]
    if not warning_rows:
        return warning_count
    blocked = sum(1 for row in warning_rows if not _is_valid_existing_condition_tolerance(row))
    # If the ledger has fewer rows than the current checker reports, the
    # unrepresented warnings are unresolved by definition.
    blocked += max(0, warning_count - len(warning_rows))
    return blocked


def _source_blocker_fact_ids(coverage: dict[str, Any]) -> list[str]:
    explicit = coverage.get("unmodeledBlockingFactIds") or coverage.get("uncoveredBlockingFactIds")
    if isinstance(explicit, list):
        return [str(item) for item in explicit if item]
    rows = coverage.get("rows") if isinstance(coverage.get("rows"), list) else []
    blocked = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        status = str(row.get("coverageStatus") or row.get("sourceStatus") or "")
        element_ids = row.get("elementIds") if isinstance(row.get("elementIds"), list) else []
        if status in {"candidate", "accepted", "conflicting"} and not element_ids:
            blocked.append(str(row.get("factId") or ""))
    uncovered_count = int(coverage.get("uncoveredBlockingFactCount") or 0)
    if uncovered_count and not blocked:
        return [f"uncovered-source-fact-{idx + 1}" for idx in range(uncovered_count)]
    return [fact_id for fact_id in blocked if fact_id]


def _accepted_report_summary(report: dict[str, Any] | None) -> tuple[bool, dict[str, Any], list[str]]:
    if not isinstance(report, dict) or not report:
        return False, {"accepted": False, "missing": True}, ["required report is missing"]
    summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
    accepted = bool(summary.get("accepted") or report.get("accepted") or report.get("ok"))
    blocking: list[str] = []
    for key in (
        "blockingCount",
        "blockerCount",
        "blockingFindingCount",
        "emptyRequiredLevelCount",
        "unbackedPhysicalRoomCount",
        "unhostedOpeningCount",
        "stairClashCount",
        "missingRequiredViewCount",
        "failedViewCount",
        "missingScreenshotCount",
    ):
        count = int(summary.get(key) or 0)
        if count:
            blocking.append(f"{count} {key} remain")
    if not accepted and not blocking:
        blocking.append("report is not accepted")
    return accepted, summary, blocking


def build_final_acceptance_report(
    model_id: str,
    *,
    advisor: dict[str, Any] | None = None,
    constructability: dict[str, Any] | None = None,
    integrity: dict[str, Any] | None = None,
    area_reconciliation: dict[str, Any] | None = None,
    coverage: dict[str, Any] | None = None,
    finding_disposition: dict[str, Any] | None = None,
    room_access_graph: dict[str, Any] | None = None,
    room_boundary_edges: dict[str, Any] | None = None,
    room_topology_repair: dict[str, Any] | None = None,
    level_completeness: dict[str, Any] | None = None,
    physical_topology: dict[str, Any] | None = None,
    source_overlay: dict[str, Any] | None = None,
    ui_evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a deterministic acceptance report for an existing-building model."""

    advisor = advisor or {}
    constructability = constructability or {}
    integrity = integrity or {}
    area_reconciliation = area_reconciliation or {}
    coverage = coverage or {}
    finding_disposition = finding_disposition or {}
    room_access_graph = room_access_graph or {}
    room_boundary_edges = room_boundary_edges or {}
    room_topology_repair = room_topology_repair or {}

    advisor_summary = _checker_summary(advisor, nested_data=True)
    constructability_summary = _checker_summary(constructability)
    integrity_summary = _summary(integrity, "summary")
    area_summary = _summary(area_reconciliation, "summary")
    disposition_summary = _summary(finding_disposition, "summary")
    room_graph = _summary(room_access_graph, "data", "graph")
    room_edge_summary = _summary(room_boundary_edges, "data", "boundaryEdges", "summary")
    topology_repair_summary = _summary(room_topology_repair, "summary")

    advisor_errors = _count(advisor_summary, "severityCounts", "error")
    advisor_warnings = _count(advisor_summary, "severityCounts", "warning")
    constructability_errors = _count(constructability_summary, "severityCounts", "error")
    constructability_warnings = _count(constructability_summary, "severityCounts", "warning")
    integrity_blockers = _count(integrity_summary, "blockingFindingCount")
    area_blockers = _count(area_summary, "blockingCount")
    unresolved_blockers = _count(disposition_summary, "unresolvedBlockingCount")
    unmodeled_fact_ids = _source_blocker_fact_ids(coverage)
    inaccessible_room_ids = room_graph.get("inaccessibleRoomIds") or []
    unbacked_edges = _count(room_edge_summary, "unbackedEdgeCount")
    partial_edges = _count(room_edge_summary, "partialEdgeCount")
    topology_blocked = _count(topology_repair_summary, "blockedActionCount")
    blocking_advisor_warning_count = _blocking_warning_count(
        finding_disposition,
        source="advisor",
        warning_count=advisor_warnings,
    )
    blocking_constructability_warning_count = _blocking_warning_count(
        finding_disposition,
        source="constructability",
        warning_count=constructability_warnings,
    )
    unresolved_source_blocker_rows = _unresolved_rows(
        finding_disposition, source="source_coverage"
    )
    source_coverage_rows = [
        row
        for row in finding_disposition.get("rows", [])
        if isinstance(row, dict) and row.get("source") == "source_coverage"
    ]
    if unmodeled_fact_ids and not source_coverage_rows:
        unresolved_source_blocker_rows = [
            {"factId": fact_id} for fact_id in unmodeled_fact_ids
        ]
    level_complete, level_summary, level_blocking = _accepted_report_summary(level_completeness)
    physical_topology_complete, physical_topology_summary, physical_topology_blocking = (
        _accepted_report_summary(physical_topology)
    )
    source_overlay_complete, source_overlay_summary, source_overlay_blocking = (
        _accepted_report_summary(source_overlay)
    )
    ui_evidence_complete, ui_evidence_summary, ui_evidence_blocking = _accepted_report_summary(
        ui_evidence
    )
    existing_condition_tolerances = _existing_condition_tolerance_rows(finding_disposition)
    existing_condition_tolerance_counts = Counter(
        str(row.get("source") or "unknown") for row in existing_condition_tolerances
    )

    gates = [
        _gate(
            "advisor_clean",
            advisor_errors == 0 and blocking_advisor_warning_count == 0,
            {
                **advisor_summary,
                "blockingAdvisorWarningCount": blocking_advisor_warning_count,
            },
            [
                reason
                for reason, active in (
                    (f"{advisor_errors} Advisor errors remain", advisor_errors > 0),
                    (
                        f"{blocking_advisor_warning_count} blocking Advisor warnings remain",
                        blocking_advisor_warning_count > 0,
                    ),
                )
                if active
            ],
        ),
        _gate(
            "constructability_clean",
            constructability_errors == 0
            and blocking_constructability_warning_count == 0,
            {
                **constructability_summary,
                "blockingConstructabilityWarningCount": blocking_constructability_warning_count,
            },
            [
                reason
                for reason, active in (
                    (
                        f"{constructability_errors} constructability errors remain",
                        constructability_errors > 0,
                    ),
                    (
                        f"{blocking_constructability_warning_count} blocking constructability warnings remain",
                        blocking_constructability_warning_count > 0,
                    ),
                )
                if active
            ],
        ),
        _gate(
            "integrity_clean",
            integrity_blockers == 0,
            integrity_summary,
            [f"{integrity_blockers} integrity blockers remain"] if integrity_blockers else [],
        ),
        _gate(
            "source_coverage_complete",
            len(unresolved_source_blocker_rows) == 0,
            {
                "modeledFactCount": coverage.get("modeledFactCount", 0),
                "unmodeledBlockingFactIds": unmodeled_fact_ids,
                "unresolvedSourceBlockerFactIds": [
                    row.get("factId") for row in unresolved_source_blocker_rows
                ],
            },
            [f"{len(unresolved_source_blocker_rows)} source blockers remain"]
            if unresolved_source_blocker_rows
            else [],
        ),
        _gate(
            "area_reconciled",
            bool(area_summary.get("accepted") or area_reconciliation.get("accepted") or area_reconciliation.get("ok")),
            area_summary,
            [f"{area_blockers} area reconciliation blockers remain"] if area_blockers else [],
        ),
        _gate(
            "level_completeness",
            level_complete,
            level_summary,
            level_blocking,
        ),
        _gate(
            "room_topology_complete",
            len(inaccessible_room_ids) == 0
            and unbacked_edges == 0
            and partial_edges == 0
            and topology_blocked == 0,
            {
                "inaccessibleRoomIds": inaccessible_room_ids,
                "unbackedEdgeCount": unbacked_edges,
                "partialEdgeCount": partial_edges,
                "topologyBlockedActionCount": topology_blocked,
            },
            [
                reason
                for reason, active in (
                    (f"{len(inaccessible_room_ids)} inaccessible rooms remain", bool(inaccessible_room_ids)),
                    (f"{unbacked_edges} unbacked room boundary edges remain", unbacked_edges > 0),
                    (f"{partial_edges} partial room boundary edges remain", partial_edges > 0),
                    (f"{topology_blocked} topology/access actions are blocked", topology_blocked > 0),
                )
                if active
            ],
        ),
        _gate(
            "physical_topology",
            physical_topology_complete,
            physical_topology_summary,
            physical_topology_blocking,
        ),
        _gate(
            "source_overlay_evidence",
            source_overlay_complete,
            source_overlay_summary,
            source_overlay_blocking,
        ),
        _gate(
            "ui_evidence",
            ui_evidence_complete,
            ui_evidence_summary,
            ui_evidence_blocking,
        ),
        _gate(
            "findings_disposed",
            bool(disposition_summary.get("accepted")),
            disposition_summary,
            [f"{unresolved_blockers} unresolved finding dispositions remain"]
            if unresolved_blockers
            else [],
        ),
    ]

    blocking_gates = [gate for gate in gates if not gate["passed"]]
    return {
        "format": "reverseBimFinalAcceptance_v1",
        "policyVersion": "reverseBimFinalAcceptancePolicy_v2",
        "modelId": model_id,
        "accepted": not blocking_gates,
        "summary": {
            "gateCount": len(gates),
            "passedGateCount": len(gates) - len(blocking_gates),
            "blockingGateCount": len(blocking_gates),
            "blockingGateIds": [gate["id"] for gate in blocking_gates],
            "existingConditionToleranceCount": len(existing_condition_tolerances),
            "existingConditionToleranceCountsBySource": dict(
                sorted(existing_condition_tolerance_counts.items())
            ),
        },
        "existingConditionTolerances": {
            "format": "reverseBimExistingConditionToleranceReport_v1",
            "policy": (
                "Warnings may be tolerated only when they document a source-backed existing "
                "condition. Errors and fixable authoring defects remain blocking."
            ),
            "rows": existing_condition_tolerances,
        },
        "gates": gates,
    }
