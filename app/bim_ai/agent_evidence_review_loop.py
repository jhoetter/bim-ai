"""BCF/issue review index + deterministic agent actions for evidence-package (prompt-5)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import AgentDeviationElem, BcfElem, EvidenceRef, IssueElem


def _sorted_evidence_ref_models(refs: list[EvidenceRef]) -> list[EvidenceRef]:
    return sorted(
        refs,
        key=lambda r: (
            r.kind,
            r.sheet_id or "",
            r.viewpoint_id or "",
            r.plan_view_id or "",
            r.section_cut_id or "",
            r.png_basename or "",
        ),
    )


def bcf_topics_index_v1(doc: Document) -> dict[str, Any]:
    """BCF-like topics plus Issue rows for agent coordination (deterministic order)."""

    topics: list[dict[str, Any]] = []
    for e in doc.elements.values():
        if isinstance(e, BcfElem):
            refs = _sorted_evidence_ref_models(list(e.evidence_refs))
            topics.append(
                {
                    "topicKind": "bcf",
                    "topicId": e.id,
                    "title": e.title,
                    "status": e.status,
                    "viewpointRef": e.viewpoint_ref,
                    "elementIds": sorted(e.element_ids),
                    "planViewId": e.plan_view_id,
                    "sectionCutId": e.section_cut_id,
                    "evidenceRefs": [r.model_dump(by_alias=True) for r in refs],
                }
            )
        elif isinstance(e, IssueElem):
            refs = _sorted_evidence_ref_models(list(e.evidence_refs))
            topics.append(
                {
                    "topicKind": "issue",
                    "topicId": e.id,
                    "title": e.title,
                    "status": e.status,
                    "elementIds": sorted(e.element_ids),
                    "viewpointId": e.viewpoint_id,
                    "evidenceRefs": [r.model_dump(by_alias=True) for r in refs],
                }
            )

    topics.sort(key=lambda x: (str(x.get("topicKind", "")), str(x.get("topicId", ""))))
    return {"format": "bcfTopicsIndex_v1", "topics": topics}


def _action_id_v1(prefix: str, payload: dict[str, Any]) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return f"{prefix}_{hashlib.sha256(body.encode()).hexdigest()[:16]}"


def agent_review_actions_v1(
    *,
    doc: Document,
    deterministic_sheet_evidence: list[dict[str, Any]],
    deterministic_3d_view_evidence: list[dict[str, Any]],
    deterministic_plan_view_evidence: list[dict[str, Any]],
    deterministic_section_cut_evidence: list[dict[str, Any]],
    violations: list[dict[str, Any]],
    max_violation_actions: int = 12,
) -> dict[str, Any]:
    """Deterministic guidance tying topics, deviations, and deterministic evidence rows."""

    vp_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_3d_view_evidence:
        if isinstance(row, dict):
            vid = str(row.get("viewpointId") or "")
            if vid:
                vp_by_id[vid] = row

    sheet_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_sheet_evidence:
        if isinstance(row, dict):
            sid = str(row.get("sheetId") or "")
            if sid:
                sheet_by_id[sid] = row

    plan_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_plan_view_evidence:
        if isinstance(row, dict):
            pid = str(row.get("planViewId") or "")
            if pid:
                plan_by_id[pid] = row

    sec_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_section_cut_evidence:
        if isinstance(row, dict):
            cid = str(row.get("sectionCutId") or "")
            if cid:
                sec_by_id[cid] = row

    actions: list[dict[str, Any]] = []

    bcfs = sorted(
        (e for e in doc.elements.values() if isinstance(e, BcfElem)),
        key=lambda x: x.id,
    )
    for b in bcfs:
        actions.append(
            {
                "actionId": _action_id_v1(
                    "review_topic_bcf",
                    {"bcfTopicId": b.id, "title": b.title},
                ),
                "kind": "reviewTopic",
                "target": {"topicKind": "bcf", "bcfTopicId": b.id},
                "guidance": f"Review BCF topic {b.id}: {b.title}",
            }
        )
        if b.viewpoint_ref and b.viewpoint_ref in vp_by_id:
            row = vp_by_id[b.viewpoint_ref]
            pw = row.get("playwrightSuggestedFilenames")
            png = pw.get("pngViewport") if isinstance(pw, dict) else None
            actions.append(
                {
                    "actionId": _action_id_v1(
                        "focus_evidence_viewpoint",
                        {"bcfTopicId": b.id, "viewpointId": b.viewpoint_ref},
                    ),
                    "kind": "focusDeterministicEvidenceRow",
                    "target": {
                        "deterministicRowKind": "viewpoint",
                        "viewpointId": b.viewpoint_ref,
                        "pngViewport": png,
                    },
                    "guidance": (
                        f"Capture or inspect 3D evidence PNG for topic {b.id} "
                        f"(viewpoint {b.viewpoint_ref})."
                    ),
                }
            )
        for ref in _sorted_evidence_ref_models(list(b.evidence_refs)):
            if ref.kind == "sheet" and ref.sheet_id and ref.sheet_id in sheet_by_id:
                row = sheet_by_id[ref.sheet_id]
                pw = row.get("playwrightSuggestedFilenames")
                pv_png = pf_png = None
                if isinstance(pw, dict):
                    pv_png = pw.get("pngViewport")
                    pf_png = pw.get("pngFullSheet")
                actions.append(
                    {
                        "actionId": _action_id_v1(
                            "focus_evidence_sheet",
                            {"bcfTopicId": b.id, "sheetId": ref.sheet_id},
                        ),
                        "kind": "focusDeterministicEvidenceRow",
                        "target": {
                            "deterministicRowKind": "sheet",
                            "sheetId": ref.sheet_id,
                            "pngViewport": pv_png,
                            "pngFullSheet": pf_png,
                        },
                        "guidance": f"Correlate sheet row {ref.sheet_id} with BCF topic {b.id}.",
                    }
                )
            elif ref.kind == "plan_view" and ref.plan_view_id and ref.plan_view_id in plan_by_id:
                row = plan_by_id[ref.plan_view_id]
                pw = row.get("playwrightSuggestedFilenames")
                pc = pw.get("pngPlanCanvas") if isinstance(pw, dict) else None
                actions.append(
                    {
                        "actionId": _action_id_v1(
                            "focus_evidence_plan",
                            {"bcfTopicId": b.id, "planViewId": ref.plan_view_id},
                        ),
                        "kind": "focusDeterministicEvidenceRow",
                        "target": {
                            "deterministicRowKind": "plan_view",
                            "planViewId": ref.plan_view_id,
                            "pngPlanCanvas": pc,
                        },
                        "guidance": f"Capture plan canvas PNG for topic {b.id} (plan {ref.plan_view_id}).",
                    }
                )
            elif ref.kind == "section_cut" and ref.section_cut_id and ref.section_cut_id in sec_by_id:
                row = sec_by_id[ref.section_cut_id]
                pw = row.get("playwrightSuggestedFilenames")
                ps = pw.get("pngSectionViewport") if isinstance(pw, dict) else None
                actions.append(
                    {
                        "actionId": _action_id_v1(
                            "focus_evidence_section",
                            {"bcfTopicId": b.id, "sectionCutId": ref.section_cut_id},
                        ),
                        "kind": "focusDeterministicEvidenceRow",
                        "target": {
                            "deterministicRowKind": "section_cut",
                            "sectionCutId": ref.section_cut_id,
                            "pngSectionViewport": ps,
                        },
                        "guidance": f"Capture section viewport PNG for topic {b.id} ({ref.section_cut_id}).",
                    }
                )
            elif ref.kind == "deterministic_png" and ref.png_basename:
                actions.append(
                    {
                        "actionId": _action_id_v1(
                            "focus_evidence_png",
                            {"bcfTopicId": b.id, "pngBasename": ref.png_basename},
                        ),
                        "kind": "focusDeterministicEvidenceRow",
                        "target": {
                            "deterministicRowKind": "deterministic_png",
                            "pngBasename": ref.png_basename,
                        },
                        "guidance": f"Locate PNG `{ref.png_basename}` for topic {b.id}.",
                    }
                )
            elif ref.kind == "viewpoint" and ref.viewpoint_id and ref.viewpoint_id in vp_by_id:
                row = vp_by_id[ref.viewpoint_id]
                pw = row.get("playwrightSuggestedFilenames")
                png = pw.get("pngViewport") if isinstance(pw, dict) else None
                actions.append(
                    {
                        "actionId": _action_id_v1(
                            "focus_evidence_viewpoint_ref",
                            {"bcfTopicId": b.id, "viewpointId": ref.viewpoint_id},
                        ),
                        "kind": "focusDeterministicEvidenceRow",
                        "target": {
                            "deterministicRowKind": "viewpoint",
                            "viewpointId": ref.viewpoint_id,
                            "pngViewport": png,
                        },
                        "guidance": f"Inspect viewpoint {ref.viewpoint_id} for topic {b.id}.",
                    }
                )

        if b.plan_view_id and b.plan_view_id in plan_by_id:
            row = plan_by_id[b.plan_view_id]
            pw = row.get("playwrightSuggestedFilenames")
            pc = pw.get("pngPlanCanvas") if isinstance(pw, dict) else None
            actions.append(
                {
                    "actionId": _action_id_v1(
                        "focus_plan_anchor",
                        {"bcfTopicId": b.id, "planViewId": b.plan_view_id},
                    ),
                    "kind": "focusDeterministicEvidenceRow",
                    "target": {
                        "deterministicRowKind": "plan_view",
                        "planViewId": b.plan_view_id,
                        "pngPlanCanvas": pc,
                    },
                    "guidance": f"Topic {b.id} anchors to plan view {b.plan_view_id}; capture plan evidence.",
                }
            )

        if b.section_cut_id and b.section_cut_id in sec_by_id:
            row = sec_by_id[b.section_cut_id]
            pw = row.get("playwrightSuggestedFilenames")
            ps = pw.get("pngSectionViewport") if isinstance(pw, dict) else None
            actions.append(
                {
                    "actionId": _action_id_v1(
                        "focus_section_anchor",
                        {"bcfTopicId": b.id, "sectionCutId": b.section_cut_id},
                    ),
                    "kind": "focusDeterministicEvidenceRow",
                    "target": {
                        "deterministicRowKind": "section_cut",
                        "sectionCutId": b.section_cut_id,
                        "pngSectionViewport": ps,
                    },
                    "guidance": f"Topic {b.id} anchors to section {b.section_cut_id}; capture section evidence.",
                }
            )

    issues = sorted(
        (e for e in doc.elements.values() if isinstance(e, IssueElem)),
        key=lambda x: x.id,
    )
    for iss in issues:
        if iss.status == "done":
            continue
        actions.append(
            {
                "actionId": _action_id_v1(
                    "review_topic_issue",
                    {"issueId": iss.id, "title": iss.title},
                ),
                "kind": "reviewTopic",
                "target": {"topicKind": "issue", "issueId": iss.id},
                "guidance": f"Triage open issue {iss.id}: {iss.title}",
            }
        )

    deviations = sorted(
        (e for e in doc.elements.values() if isinstance(e, AgentDeviationElem)),
        key=lambda x: x.id,
    )
    for d in deviations:
        actions.append(
            {
                "actionId": _action_id_v1(
                    "address_deviation",
                    {"agentDeviationId": d.id, "severity": d.severity},
                ),
                "kind": "addressDeviation",
                "target": {
                    "agentDeviationId": d.id,
                    "severity": d.severity,
                    "relatedAssumptionId": d.related_assumption_id,
                    "relatedElementIds": sorted(d.related_element_ids),
                },
                "guidance": f"Resolve recorded deviation ({d.severity}) {d.id}: {d.statement}",
            }
        )

    viol_candidates = sorted(
        [v for v in violations if isinstance(v, dict)],
        key=lambda v: (
            0 if v.get("blocking") else 1,
            str(v.get("severity", "")),
            str(v.get("ruleId", "")),
            str(v.get("message", "")),
            json.dumps(v.get("elementIds") or [], sort_keys=True, default=str),
        ),
    )
    v_ct = 0
    for v in viol_candidates:
        if v_ct >= max_violation_actions:
            break
        if not (v.get("blocking") or v.get("severity") == "error"):
            continue
        eids = sorted(str(x) for x in (v.get("elementIds") or []) if x)
        actions.append(
            {
                "actionId": _action_id_v1(
                    "address_violation",
                    {
                        "ruleId": str(v.get("ruleId", "")),
                        "elementIds": eids,
                        "message": str(v.get("message", "")),
                    },
                ),
                "kind": "addressViolation",
                "target": {
                    "ruleId": v.get("ruleId"),
                    "severity": v.get("severity"),
                    "blocking": v.get("blocking"),
                    "elementIds": eids,
                    "message": v.get("message"),
                },
                "guidance": f"Fix validation {v.get('ruleId')}: {v.get('message')}",
            }
        )
        v_ct += 1

    actions.sort(key=lambda a: str(a.get("actionId", "")))
    return {"format": "agentReviewActions_v1", "actions": actions}
