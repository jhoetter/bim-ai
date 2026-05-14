from __future__ import annotations

from bim_ai.coordination_lens import build_coordination_lens_snapshot
from bim_ai.document import Document
from bim_ai.elements import (
    ClashResultSpec,
    ClashTestElem,
    ConstructabilityIssueElem,
    ExternalLinkElem,
    IssueElem,
)
from bim_ai.engine import try_commit


def test_coordination_lens_snapshot_surfaces_health_clash_issue_and_link_rows() -> None:
    doc = Document(
        revision=7,
        elements={
            "issue-1": IssueElem(
                kind="issue",
                id="issue-1",
                title="Door host missing",
                issue_type="missing_host",
                severity="error",
                responsible_discipline="architecture",
                responsible_team="Arch lead",
                element_ids=["door-ghost"],
                due_date="2026-05-20",
            ),
            "ci-1": ConstructabilityIssueElem(
                kind="constructability_issue",
                id="ci-1",
                fingerprint="fp-1",
                rule_id="physical_hard_clash",
                element_ids=["wall-1", "duct-1"],
                status="active",
                severity="error",
                discipline="coordination",
                message="Wall and duct overlap.",
            ),
            "ct-1": ClashTestElem(
                kind="clash_test",
                id="ct-1",
                name="Arch vs MEP",
                set_a_ids=[],
                set_b_ids=[],
                tolerance_mm=0,
                results=[
                    ClashResultSpec(
                        element_id_a="wall-1",
                        element_id_b="duct-1",
                        distance_mm=0,
                    )
                ],
            ),
            "ifc-1": ExternalLinkElem(
                kind="link_external",
                id="ifc-1",
                name="Coordination IFC",
                external_link_type="ifc",
                source_path="/models/coordination.ifc",
                reload_status="source_missing",
                last_reload_message="source file not found",
            ),
        },
    )

    payload = build_coordination_lens_snapshot(doc, model_id="model-1")

    assert payload["format"] == "coordinationLensSnapshot_v1"
    assert payload["modelId"] == "model-1"
    assert payload["lens"]["id"] == "coordination"
    assert payload["lens"]["germanName"] == "Koordination"
    assert payload["lens"]["ownsGeometry"] is False
    assert payload["summary"]["clashCount"] >= 1
    assert payload["summary"]["openIssueCount"] == 2
    assert any(row["id"] == "ct-1:result:0" for row in payload["clashes"])
    assert any(row["id"] == "issue-1" and row["dueDate"] == "2026-05-20" for row in payload["issues"])
    assert any(row["id"] == "ifc-1" and row["drifted"] is True for row in payload["linkedElements"])
    assert any(row["type"] == "broken_reference" for row in payload["modelHealthWarnings"])
    assert {row["name"] for row in payload["schedules"]["requiredDefaults"]} >= {
        "Clash report",
        "Issue list",
        "Opening requests",
        "Model health report",
        "Change impact report",
        "Linked model drift report",
    }


def test_coordination_lens_change_review_extracts_consultant_sensitive_deltas() -> None:
    doc = Document(revision=3, elements={})
    change_diff = {
        "fromRevision": 1,
        "toRevision": 3,
        "added": [{"kind": "wall", "id": "wall-new"}],
        "removed": [{"kind": "comment", "id": "comment-old"}],
        "modified": [
            {
                "id": "pipe-1",
                "kind": "pipe",
                "fieldChanges": [
                    {"field": "diameterMm", "from": 80, "to": 100},
                    {"field": "name", "from": "A", "to": "B"},
                ],
            }
        ],
        "summary": {"addedCount": 1, "removedCount": 1, "modifiedCount": 1},
    }

    payload = build_coordination_lens_snapshot(doc, change_diff=change_diff)

    change_review = payload["changeReview"]
    assert change_review["available"] is True
    assert change_review["summary"]["consultantSensitiveDeltaCount"] == 2
    assert change_review["consultantSensitiveDeltas"][0] == {
        "change": "added",
        "id": "wall-new",
        "kind": "wall",
    }
    assert change_review["consultantSensitiveDeltas"][1]["fieldChanges"] == [
        {"field": "diameterMm", "from": 80, "to": 100}
    ]


def test_update_issue_status_records_lifecycle_history() -> None:
    doc = Document(
        revision=4,
        elements={
            "issue-1": IssueElem(kind="issue", id="issue-1", title="Review opening"),
        },
    )

    ok, new_doc, _commentary, _violations, _code = try_commit(
        doc,
        {
            "type": "updateIssueStatus",
            "issueId": "issue-1",
            "status": "resolved",
            "comment": "Opening accepted by structure.",
            "actor": "bim-coordinator",
        },
    )

    assert ok
    assert new_doc is not None
    issue = new_doc.elements["issue-1"]
    assert isinstance(issue, IssueElem)
    assert issue.status == "resolved"
    assert issue.resolution_history == [
        {
            "status": "resolved",
            "comment": "Opening accepted by structure.",
            "actor": "bim-coordinator",
            "revision": 4,
        }
    ]
