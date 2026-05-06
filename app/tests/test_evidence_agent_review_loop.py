from __future__ import annotations

from bim_ai.agent_evidence_review_loop import agent_review_actions_v1, bcf_topics_index_v1
from bim_ai.document import Document
from bim_ai.elements import (
    AgentAssumptionElem,
    AgentDeviationElem,
    BcfElem,
    CameraMm,
    EvidenceRef,
    LevelElem,
    PlanViewElem,
    SectionCutElem,
    SheetElem,
    Vec2Mm,
    Vec3Mm,
    ViewpointElem,
)
from bim_ai.engine import apply_inplace, coerce_command
from bim_ai.evidence_manifest import (
    artifact_ingest_correlation_v1,
    evidence_closure_review_v1,
    evidence_package_semantic_digest_sha256,
    evidence_review_performance_gate_v1,
)


def test_bcf_topics_index_v1_sorts_by_kind_then_id() -> None:
    doc = Document(
        revision=1,
        elements={
            "z-bcf": BcfElem(kind="bcf", id="z-bcf", title="Z topic"),
            "a-bcf": BcfElem(kind="bcf", id="a-bcf", title="A topic"),
        },
    )
    idx = bcf_topics_index_v1(doc)
    assert idx["format"] == "bcfTopicsIndex_v1"
    assert [t["topicId"] for t in idx["topics"]] == ["a-bcf", "z-bcf"]


def test_evidence_digest_ignores_bcf_topics_and_agent_actions_summaries() -> None:
    base = {"format": "evidencePackage_v1", "revision": 1, "modelId": "x"}
    a = {
        **base,
        "bcfTopicsIndex_v1": {"format": "bcfTopicsIndex_v1", "topics": [{"topicId": "1"}]},
    }
    b = {
        **base,
        "bcfTopicsIndex_v1": {"format": "bcfTopicsIndex_v1", "topics": [{"topicId": "9"}]},
        "agentReviewActions_v1": {
            "format": "agentReviewActions_v1",
            "actions": [{"actionId": "x", "kind": "reviewTopic", "target": {}, "guidance": "g"}],
        },
    }
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_evidence_digest_ignores_evidence_agent_follow_through_v1() -> None:
    base = {"format": "evidencePackage_v1", "revision": 1, "modelId": "x"}
    a = {
        **base,
        "evidenceAgentFollowThrough_v1": {
            "format": "evidenceAgentFollowThrough_v1",
            "bcfIssueCoordinationCheck_v1": {"indexedBcfTopicCount": 0},
        },
    }
    b = {
        **base,
        "evidenceAgentFollowThrough_v1": {
            "format": "evidenceAgentFollowThrough_v1",
            "bcfIssueCoordinationCheck_v1": {"indexedBcfTopicCount": 99},
        },
    }
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_agent_review_actions_v1_links_bcf_to_deterministic_rows() -> None:
    cam = CameraMm(
        position=Vec3Mm(xMm=0, yMm=0, zMm=5000),
        target=Vec3Mm(xMm=0, yMm=0, zMm=0),
        up=Vec3Mm(xMm=0, yMm=1, zMm=0),
    )
    doc = Document(
        revision=1,
        elements={
            "vp-1": ViewpointElem(kind="viewpoint", id="vp-1", name="V", camera=cam),
            "s1": SheetElem(kind="sheet", id="s1", name="S"),
            "bcf-1": BcfElem(
                kind="bcf",
                id="bcf-1",
                title="Clash",
                viewpoint_ref="vp-1",
                evidence_refs=[EvidenceRef(kind="sheet", sheet_id="s1")],
            ),
        },
    )
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
            "playwrightSuggestedFilenames": {"pngViewport": "vp.png"},
            "correlation": {},
        }
    ]
    out = agent_review_actions_v1(
        doc=doc,
        deterministic_sheet_evidence=sheet_rows,
        deterministic_3d_view_evidence=vp_rows,
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
        violations=[],
    )
    assert out["format"] == "agentReviewActions_v1"
    kinds = {a["kind"] for a in out["actions"]}
    assert "reviewTopic" in kinds
    assert "focusDeterministicEvidenceRow" in kinds
    sheet_targets = [
        a["target"]
        for a in out["actions"]
        if a["kind"] == "focusDeterministicEvidenceRow"
        and a["target"].get("deterministicRowKind") == "sheet"
    ]
    assert any(t.get("sheetId") == "s1" for t in sheet_targets)


def test_engine_applies_enriched_bcf_and_agent_records() -> None:
    cam = CameraMm(
        position=Vec3Mm(xMm=0, yMm=0, zMm=5000),
        target=Vec3Mm(xMm=0, yMm=0, zMm=0),
        up=Vec3Mm(xMm=0, yMm=1, zMm=0),
    )
    doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevation_mm=0),
            "pv-a": PlanViewElem(kind="plan_view", id="pv-a", name="P", level_id="lvl-1"),
            "sec-a": SectionCutElem(
                kind="section_cut",
                id="sec-a",
                name="Sec",
                line_start_mm=Vec2Mm(x_mm=0, y_mm=0),
                line_end_mm=Vec2Mm(x_mm=5000, y_mm=0),
            ),
            "vp-1": ViewpointElem(kind="viewpoint", id="vp-1", name="V", camera=cam),
        },
    )
    apply_inplace(
        doc,
        coerce_command(
            {
                "type": "createBcfTopic",
                "id": "bcf-t",
                "title": "Topic",
                "viewpointRef": "vp-1",
                "elementIds": ["lvl-1"],
                "planViewId": "pv-a",
                "sectionCutId": "sec-a",
                "evidenceRefs": [{"kind": "deterministic_png", "pngBasename": "x.png"}],
            }
        ),
    )
    bcf = doc.elements["bcf-t"]
    assert isinstance(bcf, BcfElem)
    assert bcf.viewpoint_ref == "vp-1"
    assert bcf.plan_view_id == "pv-a"
    assert bcf.section_cut_id == "sec-a"
    assert bcf.element_ids == ["lvl-1"]
    assert len(bcf.evidence_refs) == 1
    assert bcf.evidence_refs[0].png_basename == "x.png"

    apply_inplace(
        doc,
        coerce_command(
            {
                "type": "createAgentAssumption",
                "id": "asm-1",
                "statement": "Units are mm",
                "source": "manual",
                "relatedTopicId": "bcf-t",
            }
        ),
    )
    asm = doc.elements["asm-1"]
    assert isinstance(asm, AgentAssumptionElem)
    assert asm.related_topic_id == "bcf-t"

    apply_inplace(
        doc,
        coerce_command(
            {
                "type": "createAgentDeviation",
                "id": "dev-1",
                "statement": "Header offset",
                "severity": "warning",
                "relatedAssumptionId": "asm-1",
            }
        ),
    )
    dev = doc.elements["dev-1"]
    assert isinstance(dev, AgentDeviationElem)
    assert dev.related_assumption_id == "asm-1"


def test_evidence_digest_ignores_evidence_review_performance_gate_v1() -> None:
    base = {"format": "evidencePackage_v1", "revision": 1, "modelId": "x"}
    open_gate = evidence_review_performance_gate_v1(
        {"needsFixLoop": True, "blockerCodes": ["z_block", "a_block"]}
    )
    closed_gate = evidence_review_performance_gate_v1({"needsFixLoop": False, "blockerCodes": []})
    a = {**base, "evidenceReviewPerformanceGate_v1": open_gate}
    b = {**base, "evidenceReviewPerformanceGate_v1": closed_gate}
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_evidence_digest_ignores_evidence_diff_ingest_fix_loop_v1() -> None:
    base = {"format": "evidencePackage_v1", "revision": 1, "modelId": "x"}
    a = {**base, "evidenceDiffIngestFixLoop_v1": {"needsFixLoop": True, "blockerCodes": ["a"]}}
    b = {**base, "evidenceDiffIngestFixLoop_v1": {"needsFixLoop": False, "blockerCodes": []}}
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_agent_review_actions_v1_adds_remediate_when_closure_needs_fix_loop() -> None:
    pkg = "a" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "x.png", "pngFullSheet": "y.png"},
                "correlation": {"semanticDigestSha256": "b" * 64},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    out = agent_review_actions_v1(
        doc=Document(revision=1, elements={}),
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
        violations=[],
        evidence_closure_review=closure,
    )
    remediate = [a for a in out["actions"] if a["kind"] == "remediateEvidenceDiffIngest"]
    assert len(remediate) == 1
    tgt = remediate[0]["target"]
    assert tgt["blockerCodes"] == ["correlation_digest_stale_or_missing"]
    pix = closure["pixelDiffExpectation"]
    ac = pix["artifactIngestCorrelation_v1"]
    assert isinstance(ac, dict)
    assert tgt["artifactIngestManifestDigestSha256"] == ac["ingestManifestDigestSha256"]
    assert tgt["artifactIngestCorrelationField"] == (
        "evidenceClosureReview_v1.pixelDiffExpectation.artifactIngestCorrelation_v1"
    )
    assert (
        tgt["playwrightEvidenceScreenshotsRootHint"] == ac["playwrightEvidenceScreenshotsRootHint"]
    )


def test_agent_review_actions_remediate_includes_expected_actual_digest_on_mismatch_blocker() -> (
    None
):
    pkg = "f" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": "a-viewport.png",
                    "pngFullSheet": "z-full.png",
                },
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    pix = closure["pixelDiffExpectation"]
    assert isinstance(pix, dict)
    pix = dict(pix)
    ac_raw = pix["artifactIngestCorrelation_v1"]
    assert isinstance(ac_raw, dict)
    ac = dict(ac_raw)
    ac["ingestManifestDigestSha256"] = "0" * 64
    pix["artifactIngestCorrelation_v1"] = ac
    tampered = {**closure, "pixelDiffExpectation": pix}
    out = agent_review_actions_v1(
        doc=Document(revision=1, elements={}),
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
        violations=[],
        evidence_closure_review=tampered,
    )
    remediate = [a for a in out["actions"] if a["kind"] == "remediateEvidenceDiffIngest"]
    assert len(remediate) == 1
    tgt = remediate[0]["target"]
    assert tgt["blockerCodes"] == [
        "artifact_ingest_correlation_digest_mismatch",
        "pixel_diff_ingest_pending",
    ]
    ingest = tampered["pixelDiffExpectation"]["ingestChecklist_v1"]
    assert isinstance(ingest, dict)
    tgts = ingest["targets"]
    assert isinstance(tgts, list)
    exp = artifact_ingest_correlation_v1(list(tgts))["ingestManifestDigestSha256"]
    assert tgt["ingestManifestDigestExpectedSha256"] == exp
    assert tgt["ingestManifestDigestActualSha256"] == "0" * 64
    assert tgt["pixelDiffIngestChecklistField"] == (
        "evidenceClosureReview_v1.pixelDiffExpectation.ingestChecklist_v1"
    )
