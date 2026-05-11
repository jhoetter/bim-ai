from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.constructability_geometry import AABB, physical_participant_for_element
from bim_ai.constructability_issues import ConstructabilityIssue
from bim_ai.constructability_report import build_constructability_report
from bim_ai.elements import Element


def build_constructability_bcf_export(
    elements: dict[str, Element],
    *,
    revision: str | int,
    previous_issues: Iterable[ConstructabilityIssue | Mapping[str, Any]] = (),
) -> dict[str, Any]:
    report = build_constructability_report(
        elements,
        revision=revision,
        previous_issues=previous_issues,
    )
    participant_bboxes = _participant_bboxes(elements)

    topics: list[dict[str, Any]] = []
    viewpoints: list[dict[str, Any]] = []
    for issue in report["issues"]:
        if issue.get("status") == "resolved":
            continue
        topic = _topic_for_issue(issue)
        viewpoint = _viewpoint_for_issue(issue, participant_bboxes)
        if viewpoint is not None:
            topic["viewpointRef"] = viewpoint["viewpointId"]
            topic["evidenceRefs"] = [
                {"kind": "viewpoint", "viewpointId": viewpoint["viewpointId"]}
            ]
            viewpoints.append(viewpoint)
        topics.append(topic)

    topics.sort(key=lambda row: str(row.get("stableTopicId") or ""))
    viewpoints.sort(key=lambda row: str(row.get("viewpointId") or ""))
    return {
        "format": "constructabilityBcfExport_v1",
        "revision": revision,
        "profile": report["profile"],
        "topicCount": len(topics),
        "viewpointCount": len(viewpoints),
        "topics": topics,
        "viewpoints": viewpoints,
    }


def _participant_bboxes(elements: dict[str, Element]) -> dict[str, AABB]:
    out: dict[str, AABB] = {}
    for element_id, element in elements.items():
        participant = physical_participant_for_element(element, elements)
        if participant is not None:
            out[str(element_id)] = participant.aabb
    return out


def _topic_for_issue(issue: Mapping[str, Any]) -> dict[str, Any]:
    fingerprint = str(issue.get("fingerprint") or "")
    topic_id = f"bcf-constructability-{fingerprint[:16]}"
    rule_id = str(issue.get("ruleId") or "")
    element_ids = [str(eid) for eid in issue.get("elementIds") or []]
    return {
        "stableTopicId": f"bcf:{topic_id}",
        "topicKind": "bcf",
        "topicId": topic_id,
        "title": _title_for_issue(issue),
        "status": _bcf_status(issue),
        "elementIds": element_ids,
        "violationRuleIds": [rule_id] if rule_id else [],
        "constructabilityIssueFingerprint": fingerprint,
        "severity": issue.get("severity"),
        "discipline": issue.get("discipline"),
        "blockingClass": issue.get("blockingClass"),
        "recommendation": issue.get("recommendation"),
        "message": issue.get("message"),
        "evidenceRefs": [],
    }


def _viewpoint_for_issue(
    issue: Mapping[str, Any],
    participant_bboxes: Mapping[str, AABB],
) -> dict[str, Any] | None:
    element_ids = [str(eid) for eid in issue.get("elementIds") or []]
    bbox = _union_bbox([participant_bboxes[eid] for eid in element_ids if eid in participant_bboxes])
    if bbox is None:
        return None

    fingerprint = str(issue.get("fingerprint") or "")
    viewpoint_id = f"vp-constructability-{fingerprint[:16]}"
    center = {
        "xMm": (bbox.min_x + bbox.max_x) / 2.0,
        "yMm": (bbox.min_y + bbox.max_y) / 2.0,
        "zMm": (bbox.min_z + bbox.max_z) / 2.0,
    }
    span = max(bbox.width_mm, bbox.depth_mm, bbox.height_mm, 1000.0)
    return {
        "viewpointId": viewpoint_id,
        "name": _title_for_issue(issue),
        "mode": "orbit_3d",
        "elementIds": element_ids,
        "bboxMm": _bbox_dict(bbox),
        "camera": {
            "position": {
                "xMm": center["xMm"] + span,
                "yMm": center["yMm"] - span,
                "zMm": center["zMm"] + span * 0.75,
            },
            "target": center,
            "up": {"xMm": 0.0, "yMm": 0.0, "zMm": 1.0},
        },
        "sectionBoxMinMm": {
            "xMm": bbox.min_x,
            "yMm": bbox.min_y,
            "zMm": bbox.min_z,
        },
        "sectionBoxMaxMm": {
            "xMm": bbox.max_x,
            "yMm": bbox.max_y,
            "zMm": bbox.max_z,
        },
    }


def _union_bbox(boxes: list[AABB]) -> AABB | None:
    if not boxes:
        return None
    return AABB(
        min(box.min_x for box in boxes),
        min(box.min_y for box in boxes),
        min(box.min_z for box in boxes),
        max(box.max_x for box in boxes),
        max(box.max_y for box in boxes),
        max(box.max_z for box in boxes),
    )


def _bbox_dict(bbox: AABB) -> dict[str, float]:
    return {
        "minX": bbox.min_x,
        "minY": bbox.min_y,
        "minZ": bbox.min_z,
        "maxX": bbox.max_x,
        "maxY": bbox.max_y,
        "maxZ": bbox.max_z,
    }


def _title_for_issue(issue: Mapping[str, Any]) -> str:
    rule_id = str(issue.get("ruleId") or "constructability_issue")
    message = str(issue.get("message") or "").strip()
    if message:
        return message
    return rule_id.replace("_", " ").title()


def _bcf_status(issue: Mapping[str, Any]) -> str:
    status = str(issue.get("status") or "open")
    if status in {"reviewed", "approved", "not_an_issue", "suppressed"}:
        return status
    return "open"
