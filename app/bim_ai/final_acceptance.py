"""Final acceptance gate for source-faithful reverse-BIM runs."""

from __future__ import annotations

from typing import Any


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


def _gate(gate_id: str, passed: bool, summary: dict[str, Any], blocking: list[str]) -> dict[str, Any]:
    return {
        "id": gate_id,
        "passed": passed,
        "blockingReasons": blocking,
        "summary": summary,
    }


def _unresolved_rows(payload: dict[str, Any], *, source: str | None = None) -> list[dict[str, Any]]:
    rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if source is not None and row.get("source") != source:
            continue
        if row.get("blocking") and row.get("disposition") == "unresolved":
            out.append(row)
    return out


def build_final_acceptance_report(
    model_id: str,
    *,
    advisor: dict[str, Any],
    constructability: dict[str, Any],
    integrity: dict[str, Any],
    area_reconciliation: dict[str, Any],
    coverage: dict[str, Any],
    finding_disposition: dict[str, Any],
    room_access_graph: dict[str, Any],
    room_boundary_edges: dict[str, Any],
    room_topology_repair: dict[str, Any],
) -> dict[str, Any]:
    """Build a deterministic acceptance report for an existing-building model."""

    advisor_summary = _summary(advisor, "data", "summary")
    constructability_summary = _summary(constructability, "summary")
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
    unmodeled_fact_ids = coverage.get("unmodeledBlockingFactIds") or []
    inaccessible_room_ids = room_graph.get("inaccessibleRoomIds") or []
    unbacked_edges = _count(room_edge_summary, "unbackedEdgeCount")
    partial_edges = _count(room_edge_summary, "partialEdgeCount")
    topology_blocked = _count(topology_repair_summary, "blockedActionCount")
    unresolved_advisor_rows = _unresolved_rows(finding_disposition, source="advisor")
    advisor_rows = [
        row
        for row in finding_disposition.get("rows", [])
        if isinstance(row, dict) and row.get("source") == "advisor"
    ]
    unresolved_advisor_warning_count = sum(
        1 for row in unresolved_advisor_rows if str(row.get("severity") or "").lower() == "warning"
    )
    if advisor_warnings and not advisor_rows:
        unresolved_advisor_warning_count = advisor_warnings
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

    gates = [
        _gate(
            "advisor_clean",
            advisor_errors == 0 and unresolved_advisor_warning_count == 0,
            {
                **advisor_summary,
                "unresolvedAdvisorWarningCount": unresolved_advisor_warning_count,
            },
            [
                reason
                for reason, active in (
                    (f"{advisor_errors} Advisor errors remain", advisor_errors > 0),
                    (
                        f"{unresolved_advisor_warning_count} unresolved Advisor warnings remain",
                        unresolved_advisor_warning_count > 0,
                    ),
                )
                if active
            ],
        ),
        _gate(
            "constructability_clean",
            constructability_errors == 0
            and (constructability_warnings == 0 or unresolved_advisor_warning_count == 0),
            {
                **constructability_summary,
                "unresolvedConstructabilityWarningCount": unresolved_advisor_warning_count
                if constructability_warnings
                else 0,
            },
            [
                reason
                for reason, active in (
                    (
                        f"{constructability_errors} constructability errors remain",
                        constructability_errors > 0,
                    ),
                    (
                        f"{unresolved_advisor_warning_count} unresolved constructability warnings remain",
                        constructability_warnings > 0 and unresolved_advisor_warning_count > 0,
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
            bool(area_summary.get("accepted")),
            area_summary,
            [f"{area_blockers} area reconciliation blockers remain"] if area_blockers else [],
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
        "modelId": model_id,
        "accepted": not blocking_gates,
        "summary": {
            "gateCount": len(gates),
            "passedGateCount": len(gates) - len(blocking_gates),
            "blockingGateCount": len(blocking_gates),
            "blockingGateIds": [gate["id"] for gate in blocking_gates],
        },
        "gates": gates,
    }
