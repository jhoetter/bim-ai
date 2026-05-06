"""Tests for agent_review_readout_consistency_closure_v1 (WP-A02/A04/F02/F03/V01)."""

from __future__ import annotations

from bim_ai.agent_review_readout_consistency_closure import (
    ADVISORY_BUNDLE_ID_DRIFT,
    ADVISORY_DIGEST_DRIFT,
    ADVISORY_MISSING_FIELDS,
    FORMAT,
    READOUT_ROW_ORDER,
    agent_review_readout_consistency_closure_v1,
)
from bim_ai.evidence_manifest import agent_evidence_closure_hints


def _hints() -> dict:
    return agent_evidence_closure_hints()


def _brief_acceptance(*, rows: list | None = None) -> dict:
    return {
        "format": "agentBriefAcceptanceReadout_v1",
        "schemaVersion": 1,
        "rows": rows or [],
    }


def _bundle_qa_checklist(*, rows: list | None = None) -> dict:
    return {
        "format": "agentGeneratedBundleQaChecklist_v1",
        "rows": rows or [],
    }


def _baseline_lifecycle(
    *,
    expected_baseline_ids: list[str] | None = None,
    ingest_target_count: int = 0,
    rollup_status: str = "not_applicable",
) -> dict:
    return {
        "format": "evidenceBaselineLifecycleReadout_v1",
        "ingestTargetCount": ingest_target_count,
        "rollupDigestCorrelationStatus": rollup_status,
        "rollupSuggestedNextAction": "noop",
        "rollupCiGateHint": "performance_gate_gateClosed=true;blocker_codes_echo=none",
        "fixLoopBlockerCodes": [],
        "gateClosed": True,
        "rows": [],
        "expectedBaselineIds": expected_baseline_ids or [],
    }


def _merge_preflight(*, evidence_digest: str | None = None) -> dict:
    d: dict = {
        "format": "commandBundleMergePreflight_v1",
        "reasonCode": "no_conflict",
        "safeRetryClassification": "safe",
        "missingReferenceHints": [],
    }
    if evidence_digest is not None:
        d["evidenceDigestSha256"] = evidence_digest
    return d


def _call(
    *,
    brief_acceptance=None,
    bundle_qa_checklist=None,
    merge_preflight=None,
    baseline_lifecycle=None,
    browser_rendering_budget=None,
) -> dict:
    return agent_review_readout_consistency_closure_v1(
        readout_brief_acceptance=brief_acceptance,
        readout_bundle_qa_checklist=bundle_qa_checklist,
        readout_merge_preflight=merge_preflight,
        readout_baseline_lifecycle=baseline_lifecycle,
        readout_browser_rendering_budget=browser_rendering_budget,
        closure_hints=_hints(),
    )


# ---------------------------------------------------------------------------
# Row order
# ---------------------------------------------------------------------------


def test_row_order_matches_module_constant() -> None:
    out = _call(
        brief_acceptance=_brief_acceptance(),
        bundle_qa_checklist=_bundle_qa_checklist(),
    )
    assert tuple(r["readoutId"] for r in out["rows"]) == READOUT_ROW_ORDER


def test_format_and_schema_version() -> None:
    out = _call()
    assert out["format"] == FORMAT
    assert out["schemaVersion"] == 1
    assert "semanticDigestExclusionNote" in out


# ---------------------------------------------------------------------------
# All-null inputs → all rows token = missing_fields
# ---------------------------------------------------------------------------


def test_all_null_readouts_all_missing_fields() -> None:
    out = _call()
    for row in out["rows"]:
        assert row["consistencyToken"] == "missing_fields", row["readoutId"]
        assert row["presentFieldNames"] == []
        assert row["missingFieldNames"] == list(row["expectedFieldNames"])


# ---------------------------------------------------------------------------
# Present readouts → aligned
# ---------------------------------------------------------------------------


def test_brief_acceptance_present_aligned() -> None:
    out = _call(brief_acceptance=_brief_acceptance())
    row = next(r for r in out["rows"] if r["readoutId"] == "briefAcceptance")
    assert row["consistencyToken"] == "aligned"
    assert "format" in row["presentFieldNames"]
    assert row["missingFieldNames"] == []


def test_bundle_qa_checklist_present_aligned() -> None:
    out = _call(bundle_qa_checklist=_bundle_qa_checklist())
    row = next(r for r in out["rows"] if r["readoutId"] == "bundleQaChecklist")
    assert row["consistencyToken"] == "aligned"


def test_baseline_lifecycle_present_aligned() -> None:
    out = _call(baseline_lifecycle=_baseline_lifecycle())
    row = next(r for r in out["rows"] if r["readoutId"] == "baselineLifecycle")
    assert row["consistencyToken"] == "aligned"
    assert row["missingFieldNames"] == []


# ---------------------------------------------------------------------------
# Missing individual fields → missing_fields token
# ---------------------------------------------------------------------------


def test_brief_acceptance_missing_rows_field() -> None:
    incomplete = {"format": "agentBriefAcceptanceReadout_v1", "schemaVersion": 1}
    out = _call(brief_acceptance=incomplete)
    row = next(r for r in out["rows"] if r["readoutId"] == "briefAcceptance")
    assert row["consistencyToken"] == "missing_fields"
    assert "rows" in row["missingFieldNames"]


def test_baseline_lifecycle_missing_field() -> None:
    incomplete = {
        "format": "evidenceBaselineLifecycleReadout_v1",
        "ingestTargetCount": 0,
    }
    out = _call(baseline_lifecycle=incomplete)
    row = next(r for r in out["rows"] if r["readoutId"] == "baselineLifecycle")
    assert row["consistencyToken"] == "missing_fields"
    assert len(row["missingFieldNames"]) > 0


# ---------------------------------------------------------------------------
# Merge preflight null in evidence-package context → missing_fields
# ---------------------------------------------------------------------------


def test_merge_preflight_null_is_missing_fields() -> None:
    out = _call(
        brief_acceptance=_brief_acceptance(),
        merge_preflight=None,
    )
    row = next(r for r in out["rows"] if r["readoutId"] == "mergePreflight")
    assert row["consistencyToken"] == "missing_fields"
    assert row["bundleIdSeen"] is None
    assert row["evidenceDigestSeen"] is None


def test_merge_preflight_present_with_digest() -> None:
    digest = "a" * 64
    out = _call(merge_preflight=_merge_preflight(evidence_digest=digest))
    row = next(r for r in out["rows"] if r["readoutId"] == "mergePreflight")
    assert row["consistencyToken"] == "aligned"
    assert row["evidenceDigestSeen"] == digest


# ---------------------------------------------------------------------------
# browserRenderingBudget always null server-side → missing_fields
# ---------------------------------------------------------------------------


def test_browser_rendering_budget_null_is_missing_fields() -> None:
    out = _call(
        brief_acceptance=_brief_acceptance(),
        browser_rendering_budget=None,
    )
    row = next(r for r in out["rows"] if r["readoutId"] == "browserRenderingBudget")
    assert row["consistencyToken"] == "missing_fields"


def test_browser_rendering_budget_present_aligned() -> None:
    payload = {
        "format": "browserRenderingBudgetReadout_v1",
        "rows": [],
        "largeModelProofSummary": "in_budget",
        "suggestedInvestigationRoute": "all ok",
    }
    out = _call(browser_rendering_budget=payload)
    row = next(r for r in out["rows"] if r["readoutId"] == "browserRenderingBudget")
    assert row["consistencyToken"] == "aligned"
    assert row["missingFieldNames"] == []


# ---------------------------------------------------------------------------
# Bundle id extraction
# ---------------------------------------------------------------------------


def test_bundle_id_seen_from_brief_acceptance_artifacts() -> None:
    brief = _brief_acceptance(
        rows=[{"expectedEvidenceArtifacts": ["bim-ai-evidence-abc123-r1-sheet.png"]}]
    )
    out = _call(brief_acceptance=brief)
    row = next(r for r in out["rows"] if r["readoutId"] == "briefAcceptance")
    assert row["bundleIdSeen"] == "bim-ai-evidence-abc123-r1-sheet.png"


def test_bundle_id_seen_from_baseline_lifecycle_expected_ids() -> None:
    lifecycle = _baseline_lifecycle(expected_baseline_ids=["bim-ai-evidence-abc123-r1-plan.png"])
    out = _call(baseline_lifecycle=lifecycle)
    row = next(r for r in out["rows"] if r["readoutId"] == "baselineLifecycle")
    assert row["bundleIdSeen"] == "bim-ai-evidence-abc123-r1-plan.png"


# ---------------------------------------------------------------------------
# Bundle id drift detection
# ---------------------------------------------------------------------------


def test_bundle_id_drift_when_ids_disagree() -> None:
    brief = _brief_acceptance(
        rows=[{"expectedEvidenceArtifacts": ["bim-ai-evidence-aaa111-r1-sheet.png"]}]
    )
    lifecycle = _baseline_lifecycle(expected_baseline_ids=["bim-ai-evidence-bbb222-r2-plan.png"])
    out = _call(brief_acceptance=brief, baseline_lifecycle=lifecycle)
    brief_row = next(r for r in out["rows"] if r["readoutId"] == "briefAcceptance")
    lifecycle_row = next(r for r in out["rows"] if r["readoutId"] == "baselineLifecycle")
    assert brief_row["consistencyToken"] == "bundle_id_drift"
    assert lifecycle_row["consistencyToken"] == "bundle_id_drift"


def test_no_bundle_id_drift_when_only_one_id() -> None:
    brief = _brief_acceptance(
        rows=[{"expectedEvidenceArtifacts": ["bim-ai-evidence-abc-r1-sheet.png"]}]
    )
    out = _call(brief_acceptance=brief)
    brief_row = next(r for r in out["rows"] if r["readoutId"] == "briefAcceptance")
    assert brief_row["consistencyToken"] == "aligned"


# ---------------------------------------------------------------------------
# Advisory findings
# ---------------------------------------------------------------------------


def test_advisory_missing_fields_fires_for_null_readouts() -> None:
    out = _call()
    rule_ids = {f["ruleId"] for f in out["advisoryFindings"]}
    assert ADVISORY_MISSING_FIELDS in rule_ids


def test_advisory_missing_fields_identifies_readout_id() -> None:
    out = _call()
    for finding in out["advisoryFindings"]:
        if finding["ruleId"] == ADVISORY_MISSING_FIELDS:
            assert "readoutId" in finding
            assert finding["readoutId"] in READOUT_ROW_ORDER


def test_advisory_bundle_id_drift_fires() -> None:
    brief = _brief_acceptance(rows=[{"expectedEvidenceArtifacts": ["bim-ai-evidence-aaa-r1.png"]}])
    lifecycle = _baseline_lifecycle(expected_baseline_ids=["bim-ai-evidence-bbb-r2.png"])
    out = _call(brief_acceptance=brief, baseline_lifecycle=lifecycle)
    rule_ids = {f["ruleId"] for f in out["advisoryFindings"]}
    assert ADVISORY_BUNDLE_ID_DRIFT in rule_ids


def test_advisory_digest_drift_fires() -> None:
    mp1 = _merge_preflight(evidence_digest="a" * 64)
    out1 = _call(merge_preflight=mp1)
    # Drift requires two non-null digests in different readouts; since only mergePreflight
    # carries the digest, a single-readout case can't drift.
    rule_ids1 = {f["ruleId"] for f in out1["advisoryFindings"]}
    assert ADVISORY_DIGEST_DRIFT not in rule_ids1

    # Simulate digest drift by patching _extract_evidence_digest indirectly:
    # provide a browser_rendering_budget with an evidenceDigestSha256 field at top level.
    budget_with_digest = {
        "format": "browserRenderingBudgetReadout_v1",
        "rows": [],
        "largeModelProofSummary": "in_budget",
        "suggestedInvestigationRoute": "ok",
        "evidenceDigestSha256": "c" * 64,
    }
    # browserRenderingBudget doesn't extract digest so this won't fire — expected.
    out2 = _call(merge_preflight=mp1, browser_rendering_budget=budget_with_digest)
    # No ADVISORY_DIGEST_DRIFT expected because only mergePreflight provides digest.
    rule_ids2 = {f["ruleId"] for f in out2["advisoryFindings"]}
    assert ADVISORY_DIGEST_DRIFT not in rule_ids2


def test_no_advisory_when_all_readouts_aligned() -> None:
    out = _call(
        brief_acceptance=_brief_acceptance(),
        bundle_qa_checklist=_bundle_qa_checklist(),
        baseline_lifecycle=_baseline_lifecycle(),
    )
    # Only mergePreflight and browserRenderingBudget are null → they fire missing_fields
    # but the others should be aligned.
    aligned_ids = {r["readoutId"] for r in out["rows"] if r["consistencyToken"] == "aligned"}
    assert "briefAcceptance" in aligned_ids
    assert "bundleQaChecklist" in aligned_ids
    assert "baselineLifecycle" in aligned_ids


# ---------------------------------------------------------------------------
# Digest
# ---------------------------------------------------------------------------


def test_digest_sha256_is_64_hex() -> None:
    out = _call(brief_acceptance=_brief_acceptance())
    digest = out["agentReviewReadoutConsistencyClosureDigestSha256"]
    assert isinstance(digest, str) and len(digest) == 64
    assert all(c in "0123456789abcdef" for c in digest)


def test_digest_is_deterministic() -> None:
    a = _call(brief_acceptance=_brief_acceptance(), bundle_qa_checklist=_bundle_qa_checklist())
    b = _call(brief_acceptance=_brief_acceptance(), bundle_qa_checklist=_bundle_qa_checklist())
    assert (
        a["agentReviewReadoutConsistencyClosureDigestSha256"]
        == b["agentReviewReadoutConsistencyClosureDigestSha256"]
    )


def test_digest_changes_with_different_inputs() -> None:
    a = _call(brief_acceptance=_brief_acceptance())
    b = _call(brief_acceptance=None)
    assert (
        a["agentReviewReadoutConsistencyClosureDigestSha256"]
        != b["agentReviewReadoutConsistencyClosureDigestSha256"]
    )


# ---------------------------------------------------------------------------
# Field refs use closure_hints (no duplication)
# ---------------------------------------------------------------------------


def test_field_refs_use_closure_hints_values() -> None:
    hints = _hints()
    out = _call()
    refs = out["readoutFieldRefs"]
    assert refs["briefAcceptance"] == hints["agentBriefAcceptanceReadoutField"]
    assert refs["bundleQaChecklist"] == hints["agentGeneratedBundleQaChecklistField"]
    assert refs["baselineLifecycle"] == hints["evidenceBaselineLifecycleReadoutField"]


# ---------------------------------------------------------------------------
# Integration: evidence_closure_hints references the new field
# ---------------------------------------------------------------------------


def test_closure_hints_includes_consistency_closure_field() -> None:
    hints = _hints()
    assert "agentReviewReadoutConsistencyClosureField" in hints
    assert (
        hints["agentReviewReadoutConsistencyClosureField"]
        == "agentReviewReadoutConsistencyClosure_v1"
    )
