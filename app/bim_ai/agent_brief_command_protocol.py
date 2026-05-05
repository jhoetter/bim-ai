"""Deterministic brief → command plan protocol for agent review surfaces (WP-F01)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    AgentAssumptionElem,
    AgentDeviationElem,
    BcfElem,
    IssueElem,
)


def agent_brief_command_protocol_v1(
    *,
    doc: Document,
    proposed_commands: list[dict[str, Any]],
    validation_violations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Derive a replayable protocol object from model state, command preview, and violations."""

    bcfs = sorted(
        (e for e in doc.elements.values() if isinstance(e, BcfElem)),
        key=lambda x: x.id,
    )
    issues_open = sorted(
        (
            e
            for e in doc.elements.values()
            if isinstance(e, IssueElem) and e.status != "done"
        ),
        key=lambda x: x.id,
    )
    if bcfs:
        b0 = bcfs[0]
        source_brief: dict[str, Any] = {
            "briefKind": "bcf",
            "briefId": b0.id,
            "briefTitle": b0.title,
        }
    elif issues_open:
        i0 = issues_open[0]
        source_brief = {
            "briefKind": "issue",
            "briefId": i0.id,
            "briefTitle": i0.title,
        }
    else:
        source_brief = {"briefKind": None, "briefId": None, "briefTitle": None}

    assumption_ids = sorted(
        e.id for e in doc.elements.values() if isinstance(e, AgentAssumptionElem)
    )
    assumption_id_set = frozenset(assumption_ids)
    deviation_ids = sorted(
        e.id for e in doc.elements.values() if isinstance(e, AgentDeviationElem)
    )
    missing_refs: list[dict[str, str]] = []
    for e in sorted(
        (x for x in doc.elements.values() if isinstance(x, AgentDeviationElem)),
        key=lambda x: x.id,
    ):
        rid = e.related_assumption_id
        if rid is not None and rid.strip() and rid not in assumption_id_set:
            missing_refs.append({"deviationId": e.id, "relatedAssumptionId": rid})
    missing_refs.sort(key=lambda x: (x["deviationId"], x["relatedAssumptionId"]))

    hist: dict[str, int] = {}
    for c in proposed_commands:
        if not isinstance(c, dict):
            key = "?"
        else:
            t = c.get("type")
            key = str(t) if t is not None else "?"
        hist[key] = hist.get(key, 0) + 1
    command_type_histogram = dict(sorted(hist.items()))

    rule_ids: set[str] = set()
    blocker_rules: set[str] = set()
    target_element_ids: set[str] = set()
    for raw in validation_violations:
        if not isinstance(raw, dict):
            continue
        rid = raw.get("ruleId")
        if isinstance(rid, str) and rid:
            rule_ids.add(rid)
            if raw.get("blocking") is True or raw.get("severity") == "error":
                blocker_rules.add(rid)
        eids_raw = raw.get("elementIds")
        if isinstance(eids_raw, list):
            for x in eids_raw:
                if isinstance(x, str) and x:
                    target_element_ids.add(x)

    return {
        "format": "agentBriefCommandProtocol_v1",
        "schemaVersion": 1,
        "sourceBrief": source_brief,
        "assumptionIds": assumption_ids,
        "deviationIds": deviation_ids,
        "missingAssumptionReferences": missing_refs,
        "proposedCommandCount": len(proposed_commands),
        "commandTypeHistogram": command_type_histogram,
        "validationRuleIds": sorted(rule_ids),
        "validationTargetElementIds": sorted(target_element_ids),
        "unresolvedBlockers": sorted(blocker_rules),
    }
