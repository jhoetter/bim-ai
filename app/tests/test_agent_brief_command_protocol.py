from __future__ import annotations

from bim_ai.agent_brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.document import Document
from bim_ai.elements import (
    AgentAssumptionElem,
    AgentDeviationElem,
    BcfElem,
    IssueElem,
)


def test_protocol_selects_first_bcf_by_sorted_id() -> None:
    doc = Document(
        revision=1,
        elements={
            "z-bcf": BcfElem(kind="bcf", id="z-bcf", title="Zed"),
            "a-bcf": BcfElem(kind="bcf", id="a-bcf", title="Alpha"),
            "iss": IssueElem(kind="issue", id="iss", title="Should not win"),
        },
    )
    out = agent_brief_command_protocol_v1(doc=doc, proposed_commands=[], validation_violations=[])
    assert out["sourceBrief"] == {
        "briefKind": "bcf",
        "briefId": "a-bcf",
        "briefTitle": "Alpha",
    }


def test_protocol_falls_back_to_open_issue_when_no_bcf() -> None:
    doc = Document(
        revision=1,
        elements={
            "z-iss": IssueElem(kind="issue", id="z-iss", title="Later", status="open"),
            "a-iss": IssueElem(kind="issue", id="a-iss", title="First open", status="open"),
        },
    )
    out = agent_brief_command_protocol_v1(doc=doc, proposed_commands=[], validation_violations=[])
    assert out["sourceBrief"]["briefKind"] == "issue"
    assert out["sourceBrief"]["briefId"] == "a-iss"
    assert out["sourceBrief"]["briefTitle"] == "First open"


def test_protocol_skips_done_issues_for_source_brief() -> None:
    doc = Document(
        revision=1,
        elements={
            "done-iss": IssueElem(
                kind="issue",
                id="done-iss",
                title="Done",
                status="done",
            ),
            "open-iss": IssueElem(
                kind="issue",
                id="open-iss",
                title="Still open",
                status="open",
            ),
        },
    )
    out = agent_brief_command_protocol_v1(doc=doc, proposed_commands=[], validation_violations=[])
    assert out["sourceBrief"]["briefId"] == "open-iss"


def test_missing_assumption_references_stable_order() -> None:
    doc = Document(
        revision=1,
        elements={
            "dv2": AgentDeviationElem(
                kind="agent_deviation",
                id="dv2",
                statement="two",
                related_assumption_id="ghost-b",
            ),
            "as1": AgentAssumptionElem(kind="agent_assumption", id="as1", statement="kept"),
            "dv1": AgentDeviationElem(
                kind="agent_deviation",
                id="dv1",
                statement="one",
                related_assumption_id="ghost-a",
            ),
        },
    )
    out = agent_brief_command_protocol_v1(doc=doc, proposed_commands=[], validation_violations=[])
    assert out["assumptionIds"] == ["as1"]
    assert out["deviationIds"] == ["dv1", "dv2"]
    assert out["missingAssumptionReferences"] == [
        {"deviationId": "dv1", "relatedAssumptionId": "ghost-a"},
        {"deviationId": "dv2", "relatedAssumptionId": "ghost-b"},
    ]


def test_command_type_histogram_sorted_keys_and_malformed_commands() -> None:
    doc = Document(revision=1, elements={})
    cmds: list[dict[object, object]] = [  # type: ignore[assignment]
        {"type": "createWall"},
        {"type": "createLevel"},
        {"type": "createWall"},
        "not-a-dict",  # type: ignore[list-item]
        {},
    ]
    out = agent_brief_command_protocol_v1(
        doc=doc,
        proposed_commands=cmds,  # type: ignore[arg-type]
        validation_violations=[],
    )
    assert list(out["commandTypeHistogram"].keys()) == ["?", "createLevel", "createWall"]
    assert out["commandTypeHistogram"]["createWall"] == 2
    assert out["commandTypeHistogram"]["createLevel"] == 1
    assert out["commandTypeHistogram"]["?"] == 2
    assert out["proposedCommandCount"] == 5


def test_validation_rule_and_blocker_derivation() -> None:
    doc = Document(revision=1, elements={})
    viols = [
        {"ruleId": "z_warn", "severity": "warning", "elementIds": ["b", "a"]},
        {"ruleId": "a_block", "blocking": True, "elementIds": ["c"]},
        {"ruleId": "e_only", "severity": "error", "elementIds": ["d"]},
    ]
    out = agent_brief_command_protocol_v1(
        doc=doc, proposed_commands=[], validation_violations=viols
    )
    assert out["validationRuleIds"] == ["a_block", "e_only", "z_warn"]
    assert out["validationTargetElementIds"] == ["a", "b", "c", "d"]
    assert out["unresolvedBlockers"] == ["a_block", "e_only"]
