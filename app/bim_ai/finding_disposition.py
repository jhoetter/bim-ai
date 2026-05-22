"""Finding disposition ledger for reverse-BIM phase acceptance."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import StairElem


def _advisor_findings(advisor: Mapping[str, Any]) -> list[dict[str, Any]]:
    data = advisor.get("data") if isinstance(advisor.get("data"), Mapping) else advisor
    findings = data.get("findings") if isinstance(data, Mapping) else []
    return [dict(item) for item in findings if isinstance(item, Mapping)]


def _integrity_findings(integrity: Mapping[str, Any]) -> list[dict[str, Any]]:
    findings = integrity.get("findings") or []
    return [dict(item) for item in findings if isinstance(item, Mapping)]


def _area_rows(area_reconciliation: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows = area_reconciliation.get("rows") or []
    return [dict(item) for item in rows if isinstance(item, Mapping)]


def _source_blockers(coverage: Mapping[str, Any]) -> list[str]:
    raw = coverage.get("unmodeledBlockingFactIds") or []
    return [str(item) for item in raw]


def _stair_tolerance_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for element in sorted(doc.elements.values(), key=lambda item: getattr(item, "id", "")):
        if not isinstance(element, StairElem):
            continue
        props = element.props or {}
        tolerance = props.get("existingConditionTolerance")
        if not isinstance(tolerance, Mapping):
            continue
        rows.append(
            {
                "id": f"tolerance:{element.id}:existingConditionTolerance",
                "source": "model_tolerance",
                "kind": "existing_nonconformance_tolerance",
                "elementIds": [element.id],
                "findingCodes": list(tolerance.get("findingCodes") or []),
                "sourceFactIds": list(tolerance.get("sourceFactIds") or []),
                "disposition": "existing_nonconforming_tolerated",
                "blocking": False,
                "reason": tolerance.get("reason"),
                "reviewer": tolerance.get("reviewer"),
            }
        )
    return rows


def build_finding_disposition_ledger(
    model_id: str,
    doc: Document,
    *,
    advisor: Mapping[str, Any],
    integrity: Mapping[str, Any],
    area_reconciliation: Mapping[str, Any],
    coverage: Mapping[str, Any],
    dispositions: list[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build one required-disposition row per current finding/source blocker."""

    rows: list[dict[str, Any]] = []
    for index, finding in enumerate(_advisor_findings(advisor), start=1):
        rows.append(
            {
                "id": f"advisor:{index}:{finding.get('ruleId')}",
                "source": "advisor",
                "kind": "advisor_finding",
                "ruleId": finding.get("ruleId"),
                "severity": finding.get("severity"),
                "elementIds": list(finding.get("elementIds") or []),
                "message": finding.get("message"),
                "disposition": "unresolved",
                "blocking": str(finding.get("severity") or "").lower() in {"error", "warning"},
                "requiredAction": finding.get("recommendation"),
            }
        )
    for index, finding in enumerate(_integrity_findings(integrity), start=1):
        rows.append(
            {
                "id": f"integrity:{index}:{finding.get('code')}",
                "source": "integrity_preflight",
                "kind": "integrity_finding",
                "ruleId": finding.get("ruleId"),
                "code": finding.get("code"),
                "severity": finding.get("severity"),
                "elementIds": list(finding.get("elementIds") or []),
                "message": finding.get("message"),
                "disposition": "unresolved",
                "blocking": True,
                "requiredAction": finding.get("recommendation"),
            }
        )
    for row in _area_rows(area_reconciliation):
        if row.get("status") == "within_tolerance":
            continue
        rows.append(
            {
                "id": f"area:{row.get('factId') or row.get('modelRoomId')}",
                "source": "area_reconciliation",
                "kind": "area_reconciliation_row",
                "factId": row.get("factId"),
                "modelRoomId": row.get("modelRoomId"),
                "status": row.get("status"),
                "levelId": row.get("levelId"),
                "name": row.get("name"),
                "sourceAreaM2": row.get("sourceAreaM2"),
                "modelAreaM2": row.get("modelAreaM2"),
                "deltaM2": row.get("deltaM2"),
                "disposition": "unresolved",
                "blocking": True,
                "requiredAction": "Reconcile source area row to modeled room geometry, total, or explicit area-basis disposition.",
            }
        )
    for fact_id in _source_blockers(coverage):
        rows.append(
            {
                "id": f"source_blocker:{fact_id}",
                "source": "source_coverage",
                "kind": "unmodeled_blocking_fact",
                "factId": fact_id,
                "disposition": "unresolved",
                "blocking": True,
                "requiredAction": "Model the source fact, mark it context-only/duplicate, or record source-unavailable tolerance.",
            }
        )
    rows.extend(_stair_tolerance_rows(doc))
    if dispositions:
        rows = [_apply_disposition(row, dispositions) for row in rows]

    counts: dict[str, int] = {}
    blocking_count = 0
    unresolved_by_source: dict[str, int] = {}
    for row in rows:
        disposition = str(row.get("disposition") or "unknown")
        counts[disposition] = counts.get(disposition, 0) + 1
        if row.get("blocking") and disposition == "unresolved":
            blocking_count += 1
            source = str(row.get("source") or "unknown")
            unresolved_by_source[source] = unresolved_by_source.get(source, 0) + 1
    return {
        "format": "findingDispositionLedger_v1",
        "modelId": model_id,
        "revision": doc.revision,
        "summary": {
            "rowCount": len(rows),
            "dispositionCounts": counts,
            "unresolvedBlockingCount": blocking_count,
            "unresolvedBlockingCountsBySource": dict(sorted(unresolved_by_source.items())),
            "accepted": blocking_count == 0,
        },
        "rows": rows,
    }


def _apply_disposition(
    row: dict[str, Any], dispositions: list[Mapping[str, Any]]
) -> dict[str, Any]:
    decision = next((item for item in dispositions if _matches_disposition(row, item)), None)
    if not decision:
        return row
    disposition = str(decision.get("disposition") or decision.get("decision") or "")
    reason = decision.get("reason")
    accepted_by = (
        decision.get("acceptedBy") or decision.get("decidedBy") or decision.get("reviewer")
    )
    if not disposition or disposition in {"unresolved", "blocked"} or not reason or not accepted_by:
        return {
            **row,
            "invalidDispositionAttempt": {
                "disposition": disposition or None,
                "reason": reason,
                "acceptedBy": accepted_by,
            },
        }
    return {
        **row,
        "disposition": disposition,
        "blocking": False,
        "dispositionDecision": {
            **dict(decision),
            "disposition": disposition,
            "reason": reason,
            "acceptedBy": accepted_by,
        },
    }


def _matches_disposition(row: Mapping[str, Any], decision: Mapping[str, Any]) -> bool:
    if decision.get("findingId") and str(decision.get("findingId")) == str(row.get("id")):
        return True
    if decision.get("factId") and str(decision.get("factId")) == str(row.get("factId")):
        return True
    rule_id = decision.get("ruleId")
    if rule_id and str(rule_id) != str(row.get("ruleId")):
        return False
    source = decision.get("source")
    if source and str(source) != str(row.get("source")):
        return False
    element_ids = {str(item) for item in decision.get("elementIds") or []}
    if element_ids:
        row_element_ids = {str(item) for item in row.get("elementIds") or []}
        return element_ids.issubset(row_element_ids)
    return bool(rule_id or source)
