from __future__ import annotations

from typing import Any

import pytest

from bim_ai.agent_generated_bundle_qa_checklist import (
    ROW_ORDER,
    agent_generated_bundle_qa_checklist_v1,
    validate_checks_wire,
)


def _brief_proto(
    *,
    proposed_count: int,
    unresolved: list[str] | None = None,
) -> dict[str, Any]:
    ub = unresolved if unresolved is not None else []
    return {
        "format": "agentBriefCommandProtocol_v1",
        "schemaVersion": 1,
        "proposedCommandCount": proposed_count,
        "unresolvedBlockers": ub,
    }


def test_row_order_stable() -> None:
    out = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=_brief_proto(proposed_count=1),
        validate=validate_checks_wire([]),
        schedule_ids=[{"id": "s1", "name": "n"}],
        export_links={"a": "/x"},
        deterministic_sheet_evidence=[{"sheetId": "sh"}],
        deterministic_plan_view_evidence=[{"planViewId": "p"}],
        evidence_diff_ingest_fix_loop={"format": "evidence_diff_ingest_fix_loop_v1", "needsFixLoop": False, "blockerCodes": []},
        evidence_review_performance_gate={"format": "evidenceReviewPerformanceGate_v1", "gateClosed": True},
        evidence_ref_resolution={"format": "evidenceRefResolution_v1", "hasUnresolvedEvidenceRefs": False},
    )
    assert out["format"] == "agentGeneratedBundleQaChecklist_v1"
    assert out["schemaVersion"] == 1
    ids = [r["id"] for r in out["rows"]]
    assert ids == ROW_ORDER


@pytest.mark.parametrize(
    ("props", "expected_status"),
    [
        (0, "fail"),
        (3, "pass"),
    ],
)
def test_model_command_coverage_by_count(props: int, expected_status: str) -> None:
    out = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=_brief_proto(proposed_count=props),
        validate=validate_checks_wire([]),
        schedule_ids=[],
        export_links={"k": "v"},
        deterministic_sheet_evidence=[{}],
        deterministic_plan_view_evidence=[{}],
        evidence_diff_ingest_fix_loop={"needsFixLoop": False, "blockerCodes": []},
        evidence_review_performance_gate={"gateClosed": True},
        evidence_ref_resolution={"hasUnresolvedEvidenceRefs": False},
    )
    row = next(r for r in out["rows"] if r["id"] == "model_command_coverage")
    assert row["status"] == expected_status


def test_plan_evidence_unknown_when_list_omitted() -> None:
    out = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=_brief_proto(proposed_count=1),
        validate=validate_checks_wire([]),
        schedule_ids=[],
        export_links=None,
        deterministic_sheet_evidence=None,
        deterministic_plan_view_evidence=None,
        evidence_diff_ingest_fix_loop=None,
        evidence_review_performance_gate=None,
        evidence_ref_resolution=None,
    )
    plan = next(r for r in out["rows"] if r["id"] == "plan_evidence_presence")
    assert plan["status"] == "unknown"
    art = next(r for r in out["rows"] if r["id"] == "artifact_evidence_closure")
    assert art["status"] == "unknown"


def test_unresolved_refs_symbol_in_aggregate() -> None:
    out = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=_brief_proto(proposed_count=1, unresolved=[]),
        validate=validate_checks_wire([]),
        schedule_ids=[],
        export_links={"k": "v"},
        deterministic_sheet_evidence=[{}],
        deterministic_plan_view_evidence=[{}],
        evidence_diff_ingest_fix_loop={"needsFixLoop": False, "blockerCodes": []},
        evidence_review_performance_gate={"gateClosed": True},
        evidence_ref_resolution={
            "format": "evidenceRefResolution_v1",
            "hasUnresolvedEvidenceRefs": True,
        },
    )
    row = next(r for r in out["rows"] if r["id"] == "unresolved_blockers_summary")
    assert row["status"] == "fail"
    assert "evidence_refs_unresolved" in row["detail"]


def test_validation_fails_with_errors() -> None:
    viols = [{"severity": "error", "ruleId": "r1", "blocking": False}]
    out = agent_generated_bundle_qa_checklist_v1(
        brief_protocol=_brief_proto(proposed_count=1),
        validate=validate_checks_wire(viols),
        schedule_ids=[{"id": "s"}],
        export_links={"e": "/p"},
        deterministic_sheet_evidence=[{"sheetId": "x"}],
        deterministic_plan_view_evidence=[{"planViewId": "p"}],
        evidence_diff_ingest_fix_loop={"needsFixLoop": False, "blockerCodes": []},
        evidence_review_performance_gate={"gateClosed": True},
        evidence_ref_resolution={"hasUnresolvedEvidenceRefs": False},
    )
    row = next(r for r in out["rows"] if r["id"] == "validation_advisor_status")
    assert row["status"] == "fail"
    assert "errors=1" in row["detail"]
