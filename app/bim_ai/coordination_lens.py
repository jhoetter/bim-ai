from __future__ import annotations

from collections import Counter
from typing import Any

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    ClashTestElem,
    ConstructabilityIssueElem,
    ExternalLinkElem,
    IssueElem,
    LinkDxfElem,
    LinkModelElem,
    PlanViewElem,
    ScheduleElem,
    SheetElem,
)

COORDINATION_SCHEDULE_DEFAULTS: list[dict[str, Any]] = [
    {
        "id": "coordination-clash-report",
        "name": "Clash report",
        "category": "coordination",
        "fields": ["issueType", "severity", "elementIds", "status", "responsibleDiscipline"],
    },
    {
        "id": "coordination-issue-list",
        "name": "Issue list",
        "category": "issue",
        "fields": ["title", "status", "responsibleTeam", "dueDate", "linkedView"],
    },
    {
        "id": "coordination-opening-requests",
        "name": "Opening requests",
        "category": "opening_request",
        "fields": ["elementId", "hostId", "responsibleDiscipline", "status"],
    },
    {
        "id": "coordination-model-health-report",
        "name": "Model health report",
        "category": "model_health",
        "fields": ["ruleId", "severity", "message", "elementIds"],
    },
    {
        "id": "coordination-change-impact-report",
        "name": "Change impact report",
        "category": "change_review",
        "fields": ["kind", "elementId", "field", "from", "to"],
    },
    {
        "id": "coordination-linked-model-drift",
        "name": "Linked model drift report",
        "category": "link_drift",
        "fields": ["linkId", "source", "reloadStatus", "driftedFields"],
    },
]

COORDINATION_VIEW_DEFAULTS: list[dict[str, Any]] = [
    {"id": "coordination-3d", "name": "Coordination 3D", "mode": "3d"},
    {"id": "clash-isolation", "name": "Clash isolation views", "mode": "3d"},
    {"id": "issue-sheets", "name": "Issue sheets", "mode": "sheet"},
    {"id": "cross-discipline-sections", "name": "Cross-discipline sections", "mode": "section"},
    {"id": "saved-review-viewpoints", "name": "Saved review viewpoints", "mode": "viewpoint"},
]

ISSUE_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "open": ["in_progress", "resolved", "closed"],
    "in_progress": ["reviewed", "resolved", "open"],
    "reviewed": ["resolved", "in_progress", "not_an_issue"],
    "resolved": ["closed", "open"],
    "closed": ["open"],
    "done": ["open"],
    "new": ["active", "reviewed", "suppressed", "not_an_issue"],
    "active": ["reviewed", "resolved", "suppressed", "not_an_issue"],
    "approved": ["resolved", "active"],
    "not_an_issue": ["active"],
    "suppressed": ["active", "resolved"],
}

_MODEL_HEALTH_RULE_HINTS = (
    "missing",
    "orphan",
    "invalid",
    "stale",
    "drift",
    "unresolved",
    "unknown_ref",
    "zero_extent",
    "inverted",
    "schedule_",
    "sheet_",
    "viewport_",
    "monitored_",
)

_CLASH_RULE_HINTS = (
    "clash",
    "clearance",
    "penetration",
    "duplicate",
    "opening",
    "host_conflict",
    "mismatch",
)

_CONSULTANT_SENSITIVE_KINDS = {
    "wall",
    "floor",
    "roof",
    "door",
    "window",
    "wall_opening",
    "slab_opening",
    "roof_opening",
    "shaft",
    "column",
    "beam",
    "pipe",
    "duct",
    "plan_view",
    "schedule",
    "sheet",
    "link_model",
    "link_dxf",
    "link_external",
}

_CONSULTANT_SENSITIVE_FIELDS = {
    "start",
    "end",
    "boundaryMm",
    "outlineMm",
    "levelId",
    "typeId",
    "wallTypeId",
    "floorTypeId",
    "roofTypeId",
    "familyTypeId",
    "hostWallId",
    "wallId",
    "widthMm",
    "heightMm",
    "diameterMm",
    "positionMm",
    "rotationDeg",
    "viewTemplateId",
    "columns",
    "filters",
}

_EXTERNAL_REFERENCE_ID_FIELDS = {
    "sourceModelId",
    "bundleId",
    "catalogId",
    "familyId",
    "modelId",
    "projectId",
}


def build_coordination_lens_snapshot(
    doc: Document,
    *,
    model_id: str | None = None,
    change_diff: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the Coordination Lens read API payload.

    The lens owns review data and snapshots, not geometry. Element authoring
    remains with architecture, structure, and MEP commands.
    """

    violations = [v.model_dump(by_alias=True) for v in evaluate(doc.elements)]
    health_warnings = _model_health_warnings(doc, violations)
    clash_rows = _clash_rows(doc, violations)
    issues = _issue_rows(doc)
    link_rows = _linked_model_rows(doc)
    review_snapshots = _review_snapshot_rows(doc)
    change_review = _change_review(change_diff)

    severity_counts = Counter(str(row.get("severity") or "info") for row in health_warnings)
    issue_status_counts = Counter(str(row.get("status") or "open") for row in issues)

    payload: dict[str, Any] = {
        "format": "coordinationLensSnapshot_v1",
        "lens": {
            "id": "coordination",
            "name": "Coordination",
            "germanName": "Koordination",
            "role": "model-health, clash, issue, version, and review lens",
            "ownsGeometry": False,
        },
        "revision": doc.revision,
        "summary": {
            "modelHealthWarningCount": len(health_warnings),
            "clashCount": len(clash_rows),
            "openIssueCount": sum(
                1
                for row in issues
                if str(row.get("status") or "open")
                not in {"done", "resolved", "closed", "not_an_issue"}
            ),
            "linkedModelCount": len(link_rows),
            "reviewSnapshotCount": len(review_snapshots),
            "healthSeverityCounts": dict(sorted(severity_counts.items())),
            "issueStatusCounts": dict(sorted(issue_status_counts.items())),
        },
        "modelHealthWarnings": health_warnings,
        "clashes": clash_rows,
        "issues": issues,
        "linkedElements": link_rows,
        "statusTransitions": ISSUE_STATUS_TRANSITIONS,
        "schedules": {
            "requiredDefaults": COORDINATION_SCHEDULE_DEFAULTS,
            "existing": _existing_schedule_rows(doc),
        },
        "viewsAndSheets": {
            "requiredDefaults": COORDINATION_VIEW_DEFAULTS,
            "existingViews": _existing_view_rows(doc),
            "existingSheets": _existing_sheet_rows(doc),
            "reviewSnapshots": review_snapshots,
        },
        "changeReview": change_review,
        "exports": {
            "bcfTopics": [row for row in review_snapshots if row["kind"] == "bcf"],
            "supportedArtifacts": ["bcf", "reviewSnapshot", "issueList", "clashReport"],
        },
        "api": {
            "issues": "/models/{modelId}/coordination-lens#issues",
            "clashes": "/models/{modelId}/coordination-lens#clashes",
            "modelHealthWarnings": "/models/{modelId}/coordination-lens#modelHealthWarnings",
            "statusTransitions": "/models/{modelId}/coordination-lens#statusTransitions",
            "reviewSnapshots": "/models/{modelId}/coordination-lens#viewsAndSheets.reviewSnapshots",
        },
    }
    if model_id is not None:
        payload["modelId"] = model_id
    return payload


def _model_health_warnings(doc: Document, violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for v in violations:
        rule_id = str(v.get("ruleId") or v.get("rule_id") or "")
        if _is_model_health_rule(rule_id):
            rows.append(_health_row_from_violation(v))

    for element_id, elem in doc.elements.items():
        missing_refs = _missing_reference_fields(elem, doc.elements)
        if missing_refs:
            rows.append(
                {
                    "id": f"missing-reference:{element_id}",
                    "type": "broken_reference",
                    "severity": "error",
                    "ruleId": "coordination_broken_reference",
                    "message": f"{element_id} references missing element ids.",
                    "elementIds": [element_id],
                    "missingReferences": missing_refs,
                    "responsibleDiscipline": _discipline_for(elem),
                }
            )
        if getattr(elem, "hidden", False) and getattr(elem, "kind", "") not in {
            "link_model",
            "link_external",
        }:
            rows.append(
                {
                    "id": f"hidden-element:{element_id}",
                    "type": "hidden_or_orphaned_element",
                    "severity": "warning",
                    "ruleId": "coordination_hidden_element",
                    "message": f"{element_id} is hidden in the model.",
                    "elementIds": [element_id],
                    "responsibleDiscipline": _discipline_for(elem),
                }
            )
        if getattr(elem, "reload_status", None) in {"source_missing", "parse_error"}:
            rows.append(
                {
                    "id": f"stale-link:{element_id}",
                    "type": "stale_link",
                    "severity": "error",
                    "ruleId": "coordination_stale_link",
                    "message": getattr(elem, "last_reload_message", None)
                    or f"{element_id} link reload status is {elem.reload_status}.",
                    "elementIds": [element_id],
                    "responsibleDiscipline": "coordination",
                }
            )
    return sorted(rows, key=lambda row: (str(row["severity"]), str(row["id"])))


def _clash_rows(doc: Document, violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for element_id, elem in doc.elements.items():
        if isinstance(elem, ClashTestElem):
            for idx, result in enumerate(elem.results or []):
                rows.append(
                    {
                        "id": f"{element_id}:result:{idx}",
                        "source": "clash_test",
                        "issueType": "hard_clash"
                        if float(result.distance_mm) <= 0
                        else "clearance_clash",
                        "severity": "error" if float(result.distance_mm) <= 0 else "warning",
                        "clashTestId": element_id,
                        "clashTestName": elem.name,
                        "elementIds": [result.element_id_a, result.element_id_b],
                        "linkedElementIds": _linked_result_ids(result.model_dump(by_alias=True)),
                        "distanceMm": result.distance_mm,
                        "status": "open",
                        "responsibleDiscipline": "coordination",
                    }
                )
    for v in violations:
        rule_id = str(v.get("ruleId") or v.get("rule_id") or "")
        if _is_clash_rule(rule_id):
            rows.append(
                {
                    "id": f"violation:{rule_id}:{'::'.join(_element_ids(v))}",
                    "source": "validation",
                    "issueType": _issue_type_for_rule(rule_id),
                    "severity": v.get("severity") or "warning",
                    "ruleId": rule_id,
                    "message": v.get("message"),
                    "elementIds": _element_ids(v),
                    "status": "open",
                    "responsibleDiscipline": v.get("discipline") or "coordination",
                }
            )
    return sorted(rows, key=lambda row: str(row["id"]))


def _issue_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for element_id, elem in doc.elements.items():
        if isinstance(elem, IssueElem):
            rows.append(
                {
                    "id": element_id,
                    "kind": "issue",
                    "issueType": elem.issue_type,
                    "title": elem.title,
                    "severity": elem.severity,
                    "responsibleDiscipline": elem.responsible_discipline,
                    "responsibleTeam": elem.responsible_team or elem.assignee_placeholder,
                    "linkedElementIds": sorted(elem.element_ids),
                    "linkedView": elem.viewpoint_id,
                    "status": elem.status,
                    "dueDate": elem.due_date,
                    "resolutionHistory": elem.resolution_history,
                    "evidenceRefs": [ref.model_dump(by_alias=True) for ref in elem.evidence_refs],
                }
            )
        elif isinstance(elem, ConstructabilityIssueElem):
            rows.append(
                {
                    "id": element_id,
                    "kind": "constructability_issue",
                    "issueType": elem.rule_id,
                    "title": elem.message or elem.rule_id,
                    "severity": elem.severity or "warning",
                    "responsibleDiscipline": elem.discipline or "coordination",
                    "responsibleTeam": elem.assignee_placeholder,
                    "linkedElementIds": sorted(elem.element_ids),
                    "linkedView": None,
                    "status": elem.status,
                    "dueDate": None,
                    "resolutionHistory": [
                        {
                            "status": elem.status,
                            "revision": elem.resolved_revision or elem.last_seen_revision,
                            "comment": elem.resolution_comment,
                        }
                    ]
                    if elem.resolution_comment or elem.resolved_revision is not None
                    else [],
                    "evidenceRefs": [ref.model_dump(by_alias=True) for ref in elem.evidence_refs],
                }
            )
    return sorted(rows, key=lambda row: str(row["id"]))


def _linked_model_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for element_id, elem in doc.elements.items():
        if isinstance(elem, LinkModelElem):
            rows.append(
                {
                    "id": element_id,
                    "kind": elem.kind,
                    "name": elem.name,
                    "source": elem.source_model_id,
                    "sourceRevision": elem.source_model_revision,
                    "reloadStatus": "ok",
                    "hidden": elem.hidden,
                    "pinned": elem.pinned,
                    "originAlignmentMode": elem.origin_alignment_mode,
                    "drifted": False,
                    "driftedFields": [],
                }
            )
        elif isinstance(elem, LinkDxfElem):
            rows.append(
                {
                    "id": element_id,
                    "kind": elem.kind,
                    "name": elem.name,
                    "source": elem.source_path,
                    "sourceRevision": None,
                    "reloadStatus": elem.reload_status,
                    "hidden": False,
                    "pinned": elem.pinned,
                    "originAlignmentMode": elem.origin_alignment_mode,
                    "drifted": elem.reload_status not in {"ok", "embedded"},
                    "driftedFields": ["sourcePath"] if elem.reload_status == "source_missing" else [],
                }
            )
        elif isinstance(elem, ExternalLinkElem):
            rows.append(
                {
                    "id": element_id,
                    "kind": elem.kind,
                    "name": elem.name,
                    "source": elem.source_name or elem.source_path,
                    "sourceRevision": None,
                    "reloadStatus": elem.reload_status,
                    "hidden": elem.hidden,
                    "pinned": elem.pinned,
                    "originAlignmentMode": elem.origin_alignment_mode,
                    "drifted": elem.reload_status != "ok",
                    "driftedFields": ["sourcePath"] if elem.reload_status == "source_missing" else [],
                }
            )
    return sorted(rows, key=lambda row: str(row["id"]))


def _change_review(change_diff: dict[str, Any] | None) -> dict[str, Any]:
    if change_diff is None:
        return {
            "available": False,
            "summary": {
                "addedCount": 0,
                "removedCount": 0,
                "modifiedCount": 0,
                "consultantSensitiveDeltaCount": 0,
            },
            "consultantSensitiveDeltas": [],
        }

    deltas: list[dict[str, Any]] = []
    for row in change_diff.get("added", []) or []:
        if str(row.get("kind")) in _CONSULTANT_SENSITIVE_KINDS:
            deltas.append({"change": "added", "id": row.get("id"), "kind": row.get("kind")})
    for row in change_diff.get("removed", []) or []:
        if str(row.get("kind")) in _CONSULTANT_SENSITIVE_KINDS:
            deltas.append({"change": "removed", "id": row.get("id"), "kind": row.get("kind")})
    for row in change_diff.get("modified", []) or []:
        kind = str(row.get("kind"))
        sensitive_fields = [
            fc
            for fc in row.get("fieldChanges", []) or []
            if str(fc.get("field")) in _CONSULTANT_SENSITIVE_FIELDS
        ]
        if kind in _CONSULTANT_SENSITIVE_KINDS and sensitive_fields:
            deltas.append(
                {
                    "change": "modified",
                    "id": row.get("id"),
                    "kind": kind,
                    "fieldChanges": sensitive_fields,
                }
            )

    summary = dict(change_diff.get("summary") or {})
    summary["consultantSensitiveDeltaCount"] = len(deltas)
    return {
        "available": True,
        "summary": summary,
        "consultantSensitiveDeltas": deltas,
        "rawDiff": change_diff,
    }


def _existing_schedule_rows(doc: Document) -> list[dict[str, Any]]:
    return sorted(
        [
            {
                "id": element_id,
                "name": elem.name,
                "category": elem.category,
                "sheetId": elem.sheet_id,
                "columnKeys": [str(col.get("key")) for col in elem.columns],
            }
            for element_id, elem in doc.elements.items()
            if isinstance(elem, ScheduleElem)
        ],
        key=lambda row: str(row["id"]),
    )


def _existing_view_rows(doc: Document) -> list[dict[str, Any]]:
    return sorted(
        [
            {
                "id": element_id,
                "name": elem.name,
                "discipline": elem.discipline,
                "viewSubdiscipline": elem.view_subdiscipline,
                "planViewSubtype": elem.plan_view_subtype,
                "defaultLens": elem.default_lens,
            }
            for element_id, elem in doc.elements.items()
            if isinstance(elem, PlanViewElem)
        ],
        key=lambda row: str(row["id"]),
    )


def _existing_sheet_rows(doc: Document) -> list[dict[str, Any]]:
    return sorted(
        [
            {
                "id": element_id,
                "name": elem.name,
                "number": elem.number,
                "viewPlacementCount": len(elem.view_placements),
            }
            for element_id, elem in doc.elements.items()
            if isinstance(elem, SheetElem)
        ],
        key=lambda row: str(row["id"]),
    )


def _review_snapshot_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for element_id, elem in doc.elements.items():
        if isinstance(elem, BcfElem):
            rows.append(
                {
                    "id": element_id,
                    "kind": "bcf",
                    "title": elem.title,
                    "elementIds": sorted(elem.element_ids),
                    "viewpointRef": elem.viewpoint_ref,
                    "planViewId": elem.plan_view_id,
                    "sectionCutId": elem.section_cut_id,
                    "evidenceRefs": [ref.model_dump(by_alias=True) for ref in elem.evidence_refs],
                }
            )
    return sorted(rows, key=lambda row: str(row["id"]))


def _missing_reference_fields(elem: Any, elements: dict[str, Any]) -> list[dict[str, str]]:
    data = elem.model_dump(by_alias=True) if hasattr(elem, "model_dump") else {}
    rows: list[dict[str, str]] = []
    for key, value in data.items():
        if key == "id" or key in _EXTERNAL_REFERENCE_ID_FIELDS:
            continue
        if key.endswith("Id") and isinstance(value, str) and value and value not in elements:
            rows.append({"field": key, "missingId": value})
        elif key.endswith("Ids") and isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item and item not in elements:
                    rows.append({"field": key, "missingId": item})
    return rows


def _health_row_from_violation(v: dict[str, Any]) -> dict[str, Any]:
    rule_id = str(v.get("ruleId") or v.get("rule_id") or "")
    return {
        "id": f"violation:{rule_id}:{'::'.join(_element_ids(v))}",
        "type": "model_health",
        "severity": v.get("severity") or "warning",
        "ruleId": rule_id,
        "message": v.get("message"),
        "elementIds": _element_ids(v),
        "responsibleDiscipline": v.get("discipline") or "coordination",
    }


def _element_ids(v: dict[str, Any]) -> list[str]:
    raw = v.get("elementIds") or v.get("element_ids") or []
    return sorted(str(item) for item in raw if isinstance(item, str))


def _linked_result_ids(result: dict[str, Any]) -> list[str]:
    out: list[str] = []
    if result.get("linkChainA"):
        out.append(str(result.get("elementIdA")))
    if result.get("linkChainB"):
        out.append(str(result.get("elementIdB")))
    return out


def _discipline_for(elem: Any) -> str:
    raw = getattr(elem, "discipline", None)
    if raw in {"arch", "architecture"}:
        return "architecture"
    if raw in {"struct", "structure"}:
        return "structure"
    if raw == "mep":
        return "mep"
    return "coordination"


def _is_model_health_rule(rule_id: str) -> bool:
    low = rule_id.lower()
    return any(hint in low for hint in _MODEL_HEALTH_RULE_HINTS)


def _is_clash_rule(rule_id: str) -> bool:
    low = rule_id.lower()
    return any(hint in low for hint in _CLASH_RULE_HINTS)


def _issue_type_for_rule(rule_id: str) -> str:
    low = rule_id.lower()
    if "clearance" in low:
        return "clearance_clash"
    if "duplicate" in low:
        return "duplicate_element"
    if "opening" in low or "penetration" in low:
        return "opening_conflict"
    if "host" in low:
        return "host_conflict"
    if "mismatch" in low:
        return "level_grid_mismatch"
    return "hard_clash"
