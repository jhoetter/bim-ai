from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import pytest

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
    artifact_upload_manifest_v1,
    bcf_issue_coordination_check_v1,
    collaboration_replay_conflict_hints_v1,
    evidence_agent_follow_through_v1,
    evidence_closure_review_v1,
    evidence_ref_resolution_v1,
    staged_artifact_links_v1,
)


def _mapping_key_strings(obj: Any, acc: set[str]) -> None:
    if isinstance(obj, Mapping):
        for k, v in obj.items():
            acc.add(str(k))
            _mapping_key_strings(v, acc)
    elif isinstance(obj, list):
        for x in obj:
            _mapping_key_strings(x, acc)


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
    assert "stagedArtifactUrlPlaceholders_v1" not in ft
    sal = ft["stagedArtifactLinks_v1"]
    assert sal["format"] == "stagedArtifactLinks_v1"
    assert sal["resolutionMode"] == "local_relative"
    assert sal["sideEffectsEnabled"] is False
    assert sal["modelId"] == str(mid)
    assert sal["suggestedEvidenceArtifactBasename"] == "bim-ai-evidence-aaaaaaaaaaaa-r0"
    assert sal["packageSemanticDigestSha256"] == "a" * 64
    assert sal["bundleFilenameHints"]["evidencePackageJson"] == (
        "bim-ai-evidence-aaaaaaaaaaaa-r0-evidence-package.json"
    )
    erp = sal["exportRelativePaths"]
    assert erp["evidencePackage"] == f"/api/models/{mid}/evidence-package"
    assert erp["snapshot"] == f"/api/models/{mid}/snapshot"
    assert erp["validate"] == f"/api/models/{mid}/validate"
    assert erp["bcfTopicsJsonExport"] == f"/api/models/{mid}/exports/bcf-topics-json"
    assert erp["bcfTopicsJsonImport"] == f"/api/models/{mid}/imports/bcf-topics-json"
    assert sal["githubActionsResolution"] is None
    row_ids = [r["id"] for r in sal["stagedLinkRows"]]
    assert row_ids == sorted(row_ids)
    pw = next(r for r in sal["stagedLinkRows"] if r["id"] == "playwright_evidence_ci_bundle")
    assert "resolvedArtifactName" not in pw
    assert "githubActionsRunArtifactsWebUrl" not in pw
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
    rts = ft["bcfRoundtripEvidenceSummary_v1"]
    assert rts["format"] == "bcfRoundtripEvidenceSummary_v1"
    assert rts["bcfTopicCount"] == 0
    assert rts["viewpointAndScreenshotRefCount"] == 0
    assert rts["modelElementReferenceCount"] == 0
    assert rts["unresolvedReferenceCount"] == 0
    assert rts["topicsWithLinkedViolationRuleIds"] == []


def test_staged_artifact_links_v1_github_actions_mode_without_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BIM_AI_STAGED_ARTIFACT_LINKS", "1")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/sample-repo")
    monkeypatch.setenv("GITHUB_RUN_ID", "4242")
    monkeypatch.setenv("GITHUB_SHA", "deadbeef" * 5)
    monkeypatch.setenv("GITHUB_TOKEN", "must-not-appear-in-manifest")

    mid = UUID("00000000-0000-0000-0000-000000000099")
    out = staged_artifact_links_v1(
        model_id=mid,
        suggested_evidence_artifact_basename="pfx",
        package_semantic_digest_sha256="d" * 64,
    )
    assert out["format"] == "stagedArtifactLinks_v1"
    assert out["resolutionMode"] == "github_actions"
    assert out["sideEffectsEnabled"] is True
    gar = out["githubActionsResolution"]
    assert isinstance(gar, dict)
    assert gar["repository"] == "owner/sample-repo"
    assert gar["runId"] == "4242"
    assert gar["runArtifactsWebUrl"] == "https://github.com/owner/sample-repo/actions/runs/4242#artifacts"
    assert gar["commitSha"] == "deadbeef" * 5
    pw = next(r for r in out["stagedLinkRows"] if r["id"] == "playwright_evidence_ci_bundle")
    assert pw["resolvedArtifactName"] == "evidence-web-4242-playwright"
    assert pw["githubActionsRunArtifactsWebUrl"] == gar["runArtifactsWebUrl"]

    blob = json.dumps(out, sort_keys=True)
    assert "must-not-appear-in-manifest" not in blob
    assert "GITHUB_TOKEN" not in blob
    keys: set[str] = set()
    _mapping_key_strings(out, keys)
    lowered = {k.lower() for k in keys}
    assert "github_token" not in lowered
    assert "authorization" not in lowered


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


def test_evidence_ref_resolution_flags_unresolved_bcf_viewpoint_ref_anchor() -> None:
    idx = {
        "format": "bcfTopicsIndex_v1",
        "topics": [
            {
                "topicKind": "bcf",
                "topicId": "t-bcf",
                "elementIds": [],
                "viewpointRef": "vp-missing",
                "evidenceRefs": [],
            }
        ],
    }
    res = evidence_ref_resolution_v1(
        bcf_topics_index=idx,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    assert res["unresolvedCount"] == 1
    row = res["unresolvedEvidenceRefs"][0]
    assert row["evidenceRef"]["kind"] == "bcf_viewpoint_ref"
    assert row["evidenceRef"]["viewpointId"] == "vp-missing"


def test_collaboration_replay_hints_lists_409_fields() -> None:
    h = collaboration_replay_conflict_hints_v1()
    assert h["constraintRejectedHttpStatus"] == 409
    assert "replayDiagnostics" in h["typicalErrorBodyFields"]
    fields = h["replayDiagnosticsFields"]
    assert "firstBlockingCommandIndex" in fields
    assert "blockingViolationRuleIds" in fields
    assert "replayPerformanceBudget_v1" in fields
    assert "replayPerformanceBudgetNote" in h


def test_agent_evidence_closure_hints_names_follow_through_field() -> None:
    h = agent_evidence_closure_hints()
    assert h.get("evidenceAgentFollowThroughField") == "evidenceAgentFollowThrough_v1"
    assert h.get("bcfRoundtripEvidenceSummaryField") == "bcfRoundtripEvidenceSummary_v1"
    assert h.get("artifactUploadManifestField") == "artifactUploadManifest_v1"
    assert h.get("agentGeneratedBundleQaChecklistField") == "agentGeneratedBundleQaChecklist_v1"
    note = str(h.get("semanticDigestOmitsDerivativeSummariesNote"))
    assert "evidenceAgentFollowThrough_v1" in note
    assert "artifactUploadManifest_v1" in note
    assert "agentGeneratedBundleQaChecklist_v1" in note


def test_artifact_upload_manifest_v1_github_actions_hint_without_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BIM_AI_STAGED_ARTIFACT_LINKS", "1")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/sample-repo")
    monkeypatch.setenv("GITHUB_RUN_ID", "4242")
    monkeypatch.setenv("GITHUB_SHA", "deadbeef" * 5)
    monkeypatch.setenv("GITHUB_TOKEN", "must-not-appear-in-manifest")

    mid = UUID("00000000-0000-0000-0000-000000000099")
    pkg = "a" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    out = artifact_upload_manifest_v1(
        model_id=mid,
        suggested_evidence_artifact_basename="pfx",
        package_semantic_digest_sha256=pkg,
        evidence_closure_review=closure,
    )
    assert out["format"] == "artifactUploadManifest_v1"
    assert out["sideEffectsEnabled"] is True
    hint = out["ciProviderHint_v1"]
    assert hint["format"] == "ciProviderHint_v1"
    assert hint.get("repository") == "owner/sample-repo"
    assert hint.get("runId") == "4242"
    assert hint.get("runArtifactsWebUrl") == (
        "https://github.com/owner/sample-repo/actions/runs/4242#artifacts"
    )
    assert hint.get("commitSha") == "deadbeef" * 5
    assert "omittedReason" not in hint

    blob = json.dumps(out, sort_keys=True)
    assert "must-not-appear-in-manifest" not in blob
    assert "GITHUB_TOKEN" not in blob
    keys: set[str] = set()
    _mapping_key_strings(out, keys)
    lowered = {k.lower() for k in keys}
    assert "github_token" not in lowered
    assert "authorization" not in lowered


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
    rts = ft["bcfRoundtripEvidenceSummary_v1"]
    assert rts["bcfTopicCount"] == 1
    assert rts["viewpointAndScreenshotRefCount"] == 1
    assert rts["modelElementReferenceCount"] == 0
    assert rts["unresolvedReferenceCount"] == 0
    assert rts["topicsWithLinkedViolationRuleIds"] == []


def test_bcf_roundtrip_summary_links_violations_to_topic_elements() -> None:
    mid = UUID("00000000-0000-0000-0000-000000000099")
    doc = Document(
        revision=1,
        elements={
            "bcf-1": BcfElem(
                kind="bcf",
                id="bcf-1",
                title="T",
                element_ids=["elem-a", "elem-b"],
            ),
        },
    )
    idx = bcf_topics_index_v1(doc)
    ft = evidence_agent_follow_through_v1(
        model_id=mid,
        doc=doc,
        package_semantic_digest_sha256="d" * 64,
        suggested_evidence_artifact_basename="pfx",
        bcf_topics_index=idx,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
        violations=[
            {"ruleId": "z_rule", "elementIds": ["elem-b"]},
            {"ruleId": "a_rule", "elementIds": ["elem-b"]},
            {"ruleId": "orphan", "elementIds": ["other"]},
        ],
    )
    rts = ft["bcfRoundtripEvidenceSummary_v1"]
    assert rts["modelElementReferenceCount"] == 2
    assert rts["topicsWithLinkedViolationRuleIds"] == [
        {"topicKind": "bcf", "topicId": "bcf-1", "violationRuleIds": ["a_rule", "z_rule"]},
    ]


def test_bcf_roundtrip_summary_unresolved_matches_anchor_resolution() -> None:
    idx = {
        "format": "bcfTopicsIndex_v1",
        "topics": [
            {
                "topicKind": "bcf",
                "topicId": "t1",
                "elementIds": [],
                "viewpointRef": "vp-x",
                "evidenceRefs": [],
            }
        ],
    }
    mid = UUID("00000000-0000-0000-0000-000000000012")
    ft = evidence_agent_follow_through_v1(
        model_id=mid,
        doc=Document(revision=0, elements={}),
        package_semantic_digest_sha256="e" * 64,
        suggested_evidence_artifact_basename="pfx",
        bcf_topics_index=idx,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    assert ft["evidenceRefResolution_v1"]["unresolvedCount"] == 1
    assert ft["bcfRoundtripEvidenceSummary_v1"]["unresolvedReferenceCount"] == 1


def test_bcf_topic_count_matches_document_after_engine_create_bcf_topic() -> None:
    from bim_ai.engine import apply_inplace, coerce_command

    doc = Document(revision=1, elements={})
    apply_inplace(
        doc,
        coerce_command({"type": "createBcfTopic", "id": "imported-bcf", "title": "Imported"}),
    )
    idx = bcf_topics_index_v1(doc)
    mid = UUID("00000000-0000-0000-0000-000000000077")
    ft = evidence_agent_follow_through_v1(
        model_id=mid,
        doc=doc,
        package_semantic_digest_sha256="f" * 64,
        suggested_evidence_artifact_basename="pfx",
        bcf_topics_index=idx,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    assert ft["bcfRoundtripEvidenceSummary_v1"]["bcfTopicCount"] == 1
    assert len([e for e in doc.elements.values() if isinstance(e, BcfElem)]) == 1
