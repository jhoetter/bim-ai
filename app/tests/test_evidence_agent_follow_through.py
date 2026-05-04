from __future__ import annotations

from uuid import UUID

from bim_ai.agent_evidence_review_loop import bcf_topics_index_v1
from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    CameraMm,
    EvidenceRef,
    SheetElem,
    Vec3Mm,
    ViewpointElem,
)
from bim_ai.evidence_manifest import (
    agent_evidence_closure_hints,
    bcf_issue_coordination_check_v1,
    collaboration_replay_conflict_hints_v1,
    evidence_agent_follow_through_v1,
    evidence_ref_resolution_v1,
)


def test_evidence_agent_follow_through_v1_shape() -> None:
    mid = UUID("00000000-0000-0000-0000-000000000001")
    doc = Document(revision=0, elements={})
    bcf_idx = bcf_topics_index_v1(doc)
    ft = evidence_agent_follow_through_v1(
        model_id=mid,
        doc=doc,
        package_semantic_digest_sha256="a" * 64,
        suggested_evidence_artifact_basename="bim-ai-evidence-aaaaaaaaaaaa-r0",
        bcf_topics_index=bcf_idx,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    assert ft["format"] == "evidenceAgentFollowThrough_v1"
    assert ft["stagedArtifactUrlPlaceholders_v1"]["format"] == "stagedArtifactUrlPlaceholders_v1"
    chk = ft["bcfIssueCoordinationCheck_v1"]
    assert chk["format"] == "bcfIssueCoordinationCheck_v1"
    assert chk["bcfIndexedTopicCountMatchesDocument"] is True
    assert chk["issueIndexedTopicCountMatchesDocument"] is True
    assert chk["issueTopicsNotInBcfTopicsJsonExport"] is True
    res = ft["evidenceRefResolution_v1"]
    assert res["format"] == "evidenceRefResolution_v1"
    assert res["unresolvedCount"] == 0
    assert res["hasUnresolvedEvidenceRefs"] is False
    assert ft["collaborationReplayConflictHints_v1"]["format"] == "collaborationReplayConflictHints_v1"


def test_bcf_issue_coordination_mismatch_when_index_corrupt() -> None:
    doc = Document(
        revision=1,
        elements={"b": BcfElem(kind="bcf", id="b", title="t")},
    )
    bad_index = {"format": "bcfTopicsIndex_v1", "topics": []}
    chk = bcf_issue_coordination_check_v1(doc=doc, bcf_topics_index=bad_index)
    assert chk["documentBcfTopicCount"] == 1
    assert chk["indexedBcfTopicCount"] == 0
    assert chk["bcfIndexedTopicCountMatchesDocument"] is False


def test_evidence_ref_resolution_flags_missing_sheet() -> None:
    idx = {
        "format": "bcfTopicsIndex_v1",
        "topics": [
            {
                "topicKind": "bcf",
                "topicId": "t1",
                "evidenceRefs": [{"kind": "sheet", "sheetId": "missing-sheet"}],
            }
        ],
    }
    sheet_rows: list[dict] = [
        {"sheetId": "s-other", "playwrightSuggestedFilenames": {"pngViewport": "x.png"}},
    ]
    res = evidence_ref_resolution_v1(
        bcf_topics_index=idx,
        deterministic_sheet_evidence=sheet_rows,
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    assert res["unresolvedCount"] == 1
    assert res["hasUnresolvedEvidenceRefs"] is True
    row = res["unresolvedEvidenceRefs"][0]
    assert row["topicId"] == "t1"
    assert row["evidenceRef"]["sheetId"] == "missing-sheet"


def test_collaboration_replay_hints_lists_409_fields() -> None:
    h = collaboration_replay_conflict_hints_v1()
    assert h["constraintRejectedHttpStatus"] == 409
    assert "replayDiagnostics" in h["typicalErrorBodyFields"]
    assert "firstBlockingCommandIndex" in h["replayDiagnosticsFields"]


def test_agent_evidence_closure_hints_names_follow_through_field() -> None:
    h = agent_evidence_closure_hints()
    assert h.get("evidenceAgentFollowThroughField") == "evidenceAgentFollowThrough_v1"
    assert "evidenceAgentFollowThrough_v1" in str(h.get("semanticDigestOmitsDerivativeSummariesNote"))


def test_follow_through_with_realistic_bcf_and_rows() -> None:
    cam = CameraMm(
        position=Vec3Mm(x_mm=0, y_mm=0, z_mm=5000),
        target=Vec3Mm(x_mm=0, y_mm=0, z_mm=0),
        up=Vec3Mm(x_mm=0, y_mm=1, z_mm=0),
    )
    doc = Document(
        revision=1,
        elements={
            "vp-1": ViewpointElem(
                kind="viewpoint",
                id="vp-1",
                name="V",
                mode="orbit_3d",
                camera=cam,
            ),
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="S",
            ),
            "bcf-1": BcfElem(
                kind="bcf",
                id="bcf-1",
                title="Clash",
                viewpoint_ref="vp-1",
                evidence_refs=[EvidenceRef(kind="sheet", sheet_id="s1")],
            ),
        },
    )
    idx = bcf_topics_index_v1(doc)
    mid = UUID("00000000-0000-0000-0000-000000000042")
    sheet_rows = [
        {
            "sheetId": "s1",
            "playwrightSuggestedFilenames": {"pngViewport": "a.png", "pngFullSheet": "b.png"},
            "correlation": {},
        }
    ]
    vp_rows = [
        {
            "viewpointId": "vp-1",
            "playwrightSuggestedFilenames": {"pngViewport": "v.png"},
            "correlation": {},
        }
    ]
    ft = evidence_agent_follow_through_v1(
        model_id=mid,
        doc=doc,
        package_semantic_digest_sha256="c" * 64,
        suggested_evidence_artifact_basename="pfx",
        bcf_topics_index=idx,
        deterministic_sheet_evidence=sheet_rows,
        deterministic_3d_view_evidence=vp_rows,
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    assert ft["bcfIssueCoordinationCheck_v1"]["documentBcfTopicCount"] == 1
    assert ft["evidenceRefResolution_v1"]["unresolvedCount"] == 0
