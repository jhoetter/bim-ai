from __future__ import annotations

from bim_ai.agent_brief_acceptance_readout import GATE_ORDER, agent_brief_acceptance_readout_v1
from bim_ai.agent_brief_command_protocol import agent_brief_command_protocol_v1
from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import AgentAssumptionElem, AgentDeviationElem, BcfElem


def _brief(
    doc: Document,
    *,
    proposed_commands: list[dict[str, object]] | None = None,
    validation_violations: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return agent_brief_command_protocol_v1(
        doc=doc,
        proposed_commands=list(proposed_commands or []),
        validation_violations=list(validation_violations or []),
    )


def _doc_tracker_ok() -> Document:
    return Document(
        revision=1,
        elements={"b1": BcfElem(kind="bcf", id="b1", title="Topic")},
    )


def test_gate_rows_ordering_matches_module() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc)
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest={
            "format": "artifactUploadManifest_v1",
            "expectedArtifacts": [{"id": "x"}],
        },
        validation_violations=[],
    )
    assert [str(r["gateId"]) for r in out["rows"]] == list(GATE_ORDER)


def test_unresolved_assumption_missing_ref_and_open_status() -> None:
    doc = Document(
        revision=1,
        elements={
            "bcf1": BcfElem(kind="bcf", id="bcf1", title="T"),
            "as1": AgentAssumptionElem(kind="agent_assumption", id="as1", statement="s"),
            "dv1": AgentDeviationElem(
                kind="agent_deviation",
                id="dv1",
                statement="d",
                related_assumption_id="ghost",
            ),
        },
    )
    proto = _brief(doc)
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=None,
        validation_violations=[],
        validation_command_labels=["x"],
    )
    row = out["rows"][0]
    assert row["gateId"] == "assumptions_linked_resolved"
    assert row["status"] == "fail"
    assert row["failureReasonCode"] == "unresolved_assumption"

    doc_open = Document(
        revision=1,
        elements={
            "bcf1": BcfElem(kind="bcf", id="bcf1", title="T"),
            "as2": AgentAssumptionElem(
                kind="agent_assumption",
                id="as2",
                statement="open",
                closure_status="open",
            ),
        },
    )
    proto2 = _brief(doc_open)
    out2 = agent_brief_acceptance_readout_v1(
        doc=doc_open,
        brief_protocol=proto2,
        qa_checklist=None,
        artifact_upload_manifest=None,
        validation_violations=[],
        validation_command_labels=["x"],
    )
    assert out2["rows"][0]["status"] == "fail"


def test_unacknowledged_deviation() -> None:
    doc = Document(
        revision=1,
        elements={
            "bcf1": BcfElem(kind="bcf", id="bcf1", title="T"),
            "dv1": AgentDeviationElem(
                kind="agent_deviation",
                id="dv1",
                statement="x",
                acknowledged=False,
            ),
        },
    )
    proto = _brief(doc)
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=None,
        validation_violations=[],
        validation_command_labels=["x"],
    )
    dev_row = next(r for r in out["rows"] if r["gateId"] == "deviations_acknowledged")
    assert dev_row["status"] == "fail"
    assert dev_row["failureReasonCode"] == "unacknowledged_deviation"


def test_empty_validation_command_labels_fail_gate() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc)
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=None,
        validation_violations=[],
        validation_command_labels=[],
    )
    val_row = next(r for r in out["rows"] if r["gateId"] == "validation_commands_present")
    assert val_row["status"] == "fail"
    assert val_row["failureReasonCode"] == "missing_validation_command"


def test_evidence_package_sorted_artifact_ids_from_manifest() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc)
    mani: dict[str, object] = {
        "format": "artifactUploadManifest_v1",
        "expectedArtifacts": [{"id": "z"}, {"id": "a"}, {"id": "m"}],
    }
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=mani,
        validation_violations=[],
    )
    ev_row = next(r for r in out["rows"] if r["gateId"] == "evidence_artifacts_expected")
    assert ev_row["expectedEvidenceArtifacts"] == ["a", "m", "z"]


def test_empty_expected_artifacts_in_manifest_fails() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc)
    mani: dict[str, object] = {"format": "artifactUploadManifest_v1", "expectedArtifacts": []}
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=mani,
        validation_violations=[],
    )
    ev_row = next(r for r in out["rows"] if r["gateId"] == "evidence_artifacts_expected")
    assert ev_row["status"] == "fail"
    assert ev_row["failureReasonCode"] == "missing_evidence_artifact_expectation"


def test_dry_run_style_manifest_none_marks_evidence_gate_na() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc)
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=None,
        validation_violations=[],
    )
    ev_row = next(r for r in out["rows"] if r["gateId"] == "evidence_artifacts_expected")
    assert ev_row["status"] == "not_applicable"
    assert ev_row["failureReasonCode"] == "no_failure"


def test_advisor_evaluate_emits_agent_brief_rule_ids() -> None:
    doc = Document(
        revision=1,
        elements={
            "dv1": AgentDeviationElem(
                kind="agent_deviation",
                id="dv1",
                statement="d",
                acknowledged=False,
                related_assumption_id="missing-assumption",
            ),
        },
    )
    viols = evaluate(doc.elements)
    ids = {v.rule_id for v in viols}
    assert "agent_brief_deviation_unacknowledged" in ids
    assert "agent_brief_assumption_reference_broken" in ids


def test_malformed_proposed_commands_warn_validation_gate() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc, proposed_commands=[{}, "bad"])  # type: ignore[list-item]
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest=None,
        validation_violations=[],
    )
    val_row = next(r for r in out["rows"] if r["gateId"] == "validation_commands_present")
    assert val_row["status"] == "warn"
    assert val_row["failureReasonCode"] == "protocol_command_missing_or_malformed"


def test_meta_failure_reason_codes_row_passes_for_coherent_readout() -> None:
    doc = _doc_tracker_ok()
    proto = _brief(doc)
    out = agent_brief_acceptance_readout_v1(
        doc=doc,
        brief_protocol=proto,
        qa_checklist=None,
        artifact_upload_manifest={
            "format": "artifactUploadManifest_v1",
            "expectedArtifacts": [{"id": "p"}],
        },
        validation_violations=[],
    )
    meta = out["rows"][-1]
    assert meta["gateId"] == "failure_reason_codes"
    assert meta["status"] == "pass"
