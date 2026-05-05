from __future__ import annotations

import hashlib
from pathlib import Path
from uuid import UUID

from bim_ai.evidence_manifest import (
    MINIMAL_PROBE_PNG_BYTES_V1,
    MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    artifact_ingest_correlation_v1,
    artifact_upload_manifest_v1,
    committed_evidence_png_fixture_dir_v1,
    evidence_closure_review_v1,
    evidence_diff_ingest_fix_loop_v1,
    evidence_lifecycle_signal_v1,
    evidence_package_semantic_digest_sha256,
    evidence_review_performance_gate_v1,
    merge_committed_png_baseline_bytes_into_evidence_closure_review_v1,
    merge_committed_png_fixture_baselines_into_evidence_closure_review_v1,
    merge_server_png_byte_ingest_into_evidence_closure_review_v1,
    parse_png_dimensions_v1,
    read_committed_evidence_png_fixture_bytes_v1,
    server_png_byte_ingest_report_v1,
)


def test_digest_stable_when_artifact_upload_manifest_differs_derivative_only() -> None:
    """artifactUploadManifest_v1 omits semantic digest."""

    root = {"format": "evidencePackage_v1", "revision": 1, "modelId": "m1"}
    a = {
        **root,
        "artifactUploadManifest_v1": {
            "format": "artifactUploadManifest_v1",
            "marker": "alpha",
        },
    }
    b = {
        **root,
        "artifactUploadManifest_v1": {
            "format": "artifactUploadManifest_v1",
            "marker": "beta",
        },
    }
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_artifact_upload_manifest_v1_expected_artifacts_sorted_by_id() -> None:
    pkg = "f" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    mid = UUID("00000000-0000-4000-8000-0000000000aa")
    out = artifact_upload_manifest_v1(
        model_id=mid,
        suggested_evidence_artifact_basename="bim-ai-evidence-ffffffffffff-r0",
        package_semantic_digest_sha256=pkg,
        evidence_closure_review=closure,
    )
    assert out["format"] == "artifactUploadManifest_v1"
    ids = [str(x.get("id") or "") for x in out["expectedArtifacts"]]
    assert ids == sorted(ids)


def test_artifact_upload_manifest_v1_side_effects_disabled_by_default_and_ci_hint_omitted() -> (
    None
):
    pkg = "c" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    mid = UUID("00000000-0000-4000-8000-0000000000bb")
    out = artifact_upload_manifest_v1(
        model_id=mid,
        suggested_evidence_artifact_basename="pfx",
        package_semantic_digest_sha256=pkg,
        evidence_closure_review=closure,
    )
    assert out["sideEffectsEnabled"] is False
    assert out["uploadEligible"] is False
    hint = out["ciProviderHint_v1"]
    assert hint["format"] == "ciProviderHint_v1"
    assert isinstance(hint.get("omittedReason"), str) and hint["omittedReason"]
    assert "repository" not in hint


def test_artifact_upload_manifest_v1_content_digests_match_closure_ingest() -> None:
    pkg = "d" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "only-viewport.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    mid = UUID("00000000-0000-4000-8000-0000000000cc")
    out = artifact_upload_manifest_v1(
        model_id=mid,
        suggested_evidence_artifact_basename="bim-ai-evidence-dddddddddddd-r1",
        package_semantic_digest_sha256=pkg,
        evidence_closure_review=closure,
    )
    ac = closure["pixelDiffExpectation"]["artifactIngestCorrelation_v1"]
    assert isinstance(ac, dict)
    expected_dig = ac["ingestManifestDigestSha256"]
    cds = out["contentDigests"]
    assert cds["format"] == "artifactUploadContentDigests_v1"
    assert cds["packageSemanticDigestSha256"] == pkg
    assert cds["artifactIngestManifestDigestSha256"] == expected_dig


def test_digest_stable_when_follow_through_replay_hints_differ_derivative_only() -> None:
    """evidenceAgentFollowThrough_v1 (incl. collaboration replay hints docs) omits semantic digest."""
    root = {"format": "evidencePackage_v1", "revision": 1, "modelId": "m1"}
    a = {
        **root,
        "evidenceAgentFollowThrough_v1": {
            "format": "evidenceAgentFollowThrough_v1",
            "collaborationReplayConflictHints_v1": {
                "format": "collaborationReplayConflictHints_v1",
                "docVariant": "alpha",
                "replayDiagnosticsFields": ["commandCount"],
            },
        },
    }
    b = {
        **root,
        "evidenceAgentFollowThrough_v1": {
            "format": "evidenceAgentFollowThrough_v1",
            "collaborationReplayConflictHints_v1": {
                "format": "collaborationReplayConflictHints_v1",
                "docVariant": "beta",
                "replayDiagnosticsFields": ["replayPerformanceBudget_v1"],
            },
        },
    }
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_digest_stable_when_bundle_qa_checklist_differs_derivative_only() -> None:
    """agentGeneratedBundleQaChecklist_v1 omits semantic digest."""

    root = {"format": "evidencePackage_v1", "revision": 1, "modelId": "m1"}
    a = {
        **root,
        "agentGeneratedBundleQaChecklist_v1": {
            "format": "agentGeneratedBundleQaChecklist_v1",
            "schemaVersion": 1,
            "marker": "alpha",
        },
    }
    b = {
        **root,
        "agentGeneratedBundleQaChecklist_v1": {
            "format": "agentGeneratedBundleQaChecklist_v1",
            "schemaVersion": 1,
            "marker": "beta",
        },
    }
    assert evidence_package_semantic_digest_sha256(a) == evidence_package_semantic_digest_sha256(b)


def test_evidence_closure_review_inventory_lists_sorted_png_basenames() -> None:
    pkg = "f" * 64
    sheet = [
        {
            "sheetId": "s1",
            "playwrightSuggestedFilenames": {
                "pngViewport": "a-viewport.png",
                "pngFullSheet": "z-full.png",
            },
            "correlation": {"semanticDigestSha256": pkg},
        }
    ]
    plan = [
        {
            "planViewId": "p1",
            "playwrightSuggestedFilenames": {"pngPlanCanvas": "m-plan.png"},
            "correlation": {"semanticDigestSha256": pkg},
        }
    ]
    sec = [
        {
            "sectionCutId": "c1",
            "playwrightSuggestedFilenames": {"pngSectionViewport": "s-sec.png"},
            "correlation": {"semanticDigestSha256": pkg},
        }
    ]
    out = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=sheet,
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=plan,
        deterministic_section_cut_evidence=sec,
    )
    assert out["format"] == "evidenceClosureReview_v1"
    assert out["expectedDeterministicPngBasenames"] == [
        "a-viewport.png",
        "m-plan.png",
        "s-sec.png",
        "z-full.png",
    ]
    assert out["primaryScreenshotArtifactCount"] == 4
    assert out["correlationDigestConsistency"]["isFullyConsistent"] is True
    assert out["pixelDiffExpectation"]["format"] == "pixelDiffExpectation_v1"
    pol = out["pixelDiffExpectation"].get("thresholdPolicy_v1")
    assert isinstance(pol, dict)
    assert pol.get("format") == "pixelDiffThresholdPolicy_v1"
    assert pol.get("enforcement") == "advisory_only"
    ingest = out["pixelDiffExpectation"]["ingestChecklist_v1"]
    assert ingest["format"] == "pixelDiffIngestChecklist_v1"
    assert len(ingest["targets"]) == 4
    assert ingest["targets"][0]["expectedDiffBasename"].endswith("-diff.png")
    ac = out["pixelDiffExpectation"]["artifactIngestCorrelation_v1"]
    assert isinstance(ac, dict)
    assert ac["format"] == "artifactIngestCorrelation_v1"
    assert ac["canonicalPairCount"] == len(ingest["targets"])
    dig = ac["ingestManifestDigestSha256"]
    assert isinstance(dig, str) and len(dig) == 64
    assert (
        dig == artifact_ingest_correlation_v1(list(ingest["targets"]))["ingestManifestDigestSha256"]
    )
    gaps = out["screenshotHintGaps_v1"]
    assert gaps["format"] == "screenshotHintGaps_v1"
    assert gaps["hasGaps"] is False
    assert gaps["gaps"] == []


def test_evidence_closure_review_flags_stale_correlation_digest() -> None:
    pkg = "a" * 64
    stale_digest = "b" * 64
    sheet = [
        {
            "sheetId": "s1",
            "playwrightSuggestedFilenames": {"pngViewport": "x.png"},
            "correlation": {"semanticDigestSha256": stale_digest},
        }
    ]
    out = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=sheet,
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    cons = out["correlationDigestConsistency"]
    assert cons["isFullyConsistent"] is False
    assert cons["rowsMissingCorrelationDigest"] == []
    assert len(cons["staleRowsRelativeToPackageDigest"]) == 1
    row = cons["staleRowsRelativeToPackageDigest"][0]
    assert row["kind"] == "sheet"
    assert row["id"] == "s1"
    assert row["correlationSemanticDigestSha256"] == stale_digest


def test_evidence_closure_review_flags_missing_row_digest() -> None:
    pkg = "c" * 64
    vp = [
        {
            "viewpointId": "v1",
            "playwrightSuggestedFilenames": {"pngViewport": "v.png"},
            "correlation": {},
        }
    ]
    out = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=vp,
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    cons = out["correlationDigestConsistency"]
    assert cons["isFullyConsistent"] is False
    assert cons["staleRowsRelativeToPackageDigest"] == []
    assert cons["rowsMissingCorrelationDigest"] == [{"kind": "viewpoint", "id": "v1"}]


def test_evidence_lifecycle_signal_v1_matches_closure_review() -> None:
    pkg = "e" * 64
    suggested_basename = "bim-ai-evidence-eeeeeeeeeeee-r9"
    sheet = [
        {
            "sheetId": "s1",
            "playwrightSuggestedFilenames": {"pngViewport": "only-viewport.png"},
            "correlation": {"semanticDigestSha256": pkg},
        }
    ]
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=sheet,
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    sig = evidence_lifecycle_signal_v1(
        package_semantic_digest_sha256=pkg,
        suggested_evidence_artifact_basename=suggested_basename,
        evidence_closure_review=closure,
    )
    assert sig["format"] == "evidenceLifecycleSignal_v1"
    assert sig["packageSemanticDigestSha256"] == pkg
    assert sig["suggestedEvidenceArtifactBasename"] == suggested_basename
    bn = closure["expectedDeterministicPngBasenames"]
    assert isinstance(bn, list)
    assert sig["expectedDeterministicPngCount"] == len(bn)
    shot_gaps = closure["screenshotHintGaps_v1"]
    gap_rows = shot_gaps.get("gaps")
    assert isinstance(gap_rows, list)
    assert shot_gaps.get("hasGaps") is True
    assert len(gap_rows) == 1
    assert gap_rows[0]["missingPlaywrightFilenameSlots"] == ["pngFullSheet"]
    assert sig["screenshotHintGapRowCount"] == len(gap_rows)
    assert sig["correlationFullyConsistent"] is True
    pix = closure["pixelDiffExpectation"]
    ingest = pix["ingestChecklist_v1"]
    targets = ingest["targets"]
    assert sig["pixelDiffIngestTargetCount"] == len(targets)
    corr_ac = pix["artifactIngestCorrelation_v1"]
    assert isinstance(corr_ac, dict)
    corr_dig = corr_ac["ingestManifestDigestSha256"]
    assert isinstance(corr_dig, str) and len(corr_dig) == 64
    assert sig["artifactIngestManifestDigestSha256"] == corr_dig

    stale_pkg = "f" * 64
    stale_closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=stale_pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s9",
                "playwrightSuggestedFilenames": {"pngViewport": "x.png", "pngFullSheet": "y.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    stale_sig = evidence_lifecycle_signal_v1(
        package_semantic_digest_sha256=stale_pkg,
        suggested_evidence_artifact_basename=suggested_basename,
        evidence_closure_review=stale_closure,
    )
    assert stale_sig["correlationFullyConsistent"] is False


def test_evidence_review_performance_gate_closed_when_fix_loop_clear() -> None:
    pkg = "f" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "a.png", "pngFullSheet": "b.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        closure,
        png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    )
    fl = evidence_diff_ingest_fix_loop_v1(merged)
    gate = evidence_review_performance_gate_v1(fl)
    assert gate["format"] == "evidenceReviewPerformanceGate_v1"
    assert gate["probeKind"] == "deterministic_contract_v1"
    assert gate["enforcement"] == "advisory_mock"
    assert gate["gateClosed"] is True
    assert gate["blockerCodesEcho"] == []
    hints = gate["advisoryBudgetHintsMs_v1"]
    assert isinstance(hints, dict)
    assert hints.get("format") == "advisoryBudgetHintsMs_v1"
    assert hints.get("evidencePackageJsonParse") == 50


def test_evidence_review_performance_gate_open_echoes_sorted_blockers() -> None:
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
    fl = evidence_diff_ingest_fix_loop_v1(closure)
    gate = evidence_review_performance_gate_v1(fl)
    assert gate["gateClosed"] is False
    assert gate["blockerCodesEcho"] == ["correlation_digest_stale_or_missing"]


def test_evidence_diff_ingest_fix_loop_clear_when_pixel_marked_ingested() -> None:
    pkg = "f" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "a.png", "pngFullSheet": "b.png"},
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
    pix["status"] = "ingested"
    closure2 = {**closure, "pixelDiffExpectation": pix}
    fl = evidence_diff_ingest_fix_loop_v1(closure2)
    assert fl["format"] == "evidence_diff_ingest_fix_loop_v1"
    assert fl["needsFixLoop"] is False
    assert fl["blockerCodes"] == []


def test_evidence_diff_ingest_fix_loop_correlation_blocker() -> None:
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
    fl = evidence_diff_ingest_fix_loop_v1(closure)
    assert fl["needsFixLoop"] is True
    assert fl["blockerCodes"] == ["correlation_digest_stale_or_missing"]


def test_evidence_diff_ingest_fix_loop_screenshot_gaps_suppresses_pixel_pending() -> None:
    pkg = "e" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "only-viewport.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    fl = evidence_diff_ingest_fix_loop_v1(closure)
    assert fl["blockerCodes"] == ["screenshot_filename_slots_incomplete"]


def test_evidence_diff_ingest_fix_loop_flags_artifact_ingest_correlation_digest_mismatch() -> None:
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
    fl = evidence_diff_ingest_fix_loop_v1(tampered)
    assert fl["needsFixLoop"] is True
    ingest = tampered["pixelDiffExpectation"]["ingestChecklist_v1"]
    assert isinstance(ingest, dict)
    targets = ingest["targets"]
    assert isinstance(targets, list)
    expected_digest = artifact_ingest_correlation_v1(list(targets))["ingestManifestDigestSha256"]
    assert isinstance(expected_digest, str) and len(expected_digest) == 64
    assert expected_digest != "0" * 64
    assert fl["blockerCodes"] == [
        "artifact_ingest_correlation_digest_mismatch",
        "pixel_diff_ingest_pending",
    ]


def test_evidence_diff_ingest_fix_loop_pixel_pending_when_inventory_complete() -> None:
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
    fl = evidence_diff_ingest_fix_loop_v1(closure)
    assert fl["needsFixLoop"] is True
    assert fl["blockerCodes"] == ["pixel_diff_ingest_pending"]


def test_parse_png_dimensions_v1_minimal_probe() -> None:
    w, h = parse_png_dimensions_v1(MINIMAL_PROBE_PNG_BYTES_V1)
    assert (w, h) == (1, 1)


def test_minimal_probe_png_sha256_constant_matches_bytes() -> None:
    assert (
        hashlib.sha256(MINIMAL_PROBE_PNG_BYTES_V1).hexdigest()
        == MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1
    )


def test_server_png_byte_ingest_report_v1_match_and_skipped() -> None:
    rep_match = server_png_byte_ingest_report_v1(
        MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    )
    assert rep_match["format"] == "serverPngByteIngest_v1"
    assert rep_match["canonicalDigestSha256"] == MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1
    assert rep_match["byteLength"] == len(MINIMAL_PROBE_PNG_BYTES_V1)
    comp = rep_match["comparison"]
    assert isinstance(comp, dict)
    assert comp["result"] == "match"

    rep_skip = server_png_byte_ingest_report_v1(
        MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=None,
    )
    assert rep_skip["comparison"]["result"] == "skipped_no_baseline"


def test_server_png_byte_ingest_report_v1_mismatch() -> None:
    rep = server_png_byte_ingest_report_v1(
        MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline="0" * 64,
    )
    assert rep["comparison"]["result"] == "mismatch"


def test_merge_server_png_byte_ingest_into_closure_review_v1() -> None:
    pkg = "a" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "x.png", "pngFullSheet": "y.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        closure,
        png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    )
    pix = merged["pixelDiffExpectation"]
    assert isinstance(pix, dict)
    assert pix["status"] == "compared"
    spi = pix.get("serverPngByteIngest_v1")
    assert isinstance(spi, dict)
    assert spi.get("linkedBaselinePngBasename") == "x.png"
    assert spi["comparison"]["result"] == "match"


def test_merge_server_png_byte_ingest_skipped_without_baseline_sets_ingested() -> None:
    pkg = "b" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": "only.png",
                    "pngFullSheet": "full.png",
                },
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        closure,
        png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=None,
    )
    pix = merged["pixelDiffExpectation"]
    assert isinstance(pix, dict)
    assert pix["status"] == "ingested"
    assert pix["serverPngByteIngest_v1"]["comparison"]["result"] == "skipped_no_baseline"


def test_merge_server_png_byte_ingest_mismatch_sets_status_mismatch() -> None:
    pkg = "d" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "x.png", "pngFullSheet": "y.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        closure,
        png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline="a" * 64,
    )
    pix = merged["pixelDiffExpectation"]
    assert isinstance(pix, dict)
    assert pix["status"] == "mismatch"
    assert pix["serverPngByteIngest_v1"]["comparison"]["result"] == "mismatch"


def test_merge_server_png_byte_ingest_invalid_png_sets_parse_failure() -> None:
    pkg = "c" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "x.png", "pngFullSheet": "y.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        closure,
        png_bytes=b"not-a-png",
        expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    )
    pix = merged["pixelDiffExpectation"]
    assert isinstance(pix, dict)
    assert pix["status"] == "ingested"
    spi = pix["serverPngByteIngest_v1"]
    assert spi["canonicalDigestSha256"] is None
    assert "png_parse_failed" in str(spi["comparison"].get("skippedReason", ""))


def test_evidence_diff_ingest_fix_loop_clear_when_server_png_probe_merged() -> None:
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
    merged = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        closure,
        png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    )
    fl = evidence_diff_ingest_fix_loop_v1(merged)
    assert fl["needsFixLoop"] is False
    assert fl["blockerCodes"] == []


EVIDENCE_PNG_FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "evidence"
FIX_PARITY_BN = "committed-baseline-probe-parity-v1.png"
FIX_ALT_BN = "committed-baseline-alt-1x1-v1.png"


def test_read_committed_evidence_png_fixture_bytes_matches_minimal_probe() -> None:
    data = read_committed_evidence_png_fixture_bytes_v1(FIX_PARITY_BN)
    assert data == MINIMAL_PROBE_PNG_BYTES_V1


def test_merge_committed_png_baseline_bytes_ingests_sorted_fixture_rows() -> None:
    pkg = "9" * 64
    parity = (EVIDENCE_PNG_FIXTURE_DIR / FIX_PARITY_BN).read_bytes()
    alt = (EVIDENCE_PNG_FIXTURE_DIR / FIX_ALT_BN).read_bytes()
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": FIX_PARITY_BN,
                    "pngFullSheet": FIX_ALT_BN,
                },
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    expected_digest = closure["packageSemanticDigestSha256"]
    merged = merge_committed_png_baseline_bytes_into_evidence_closure_review_v1(
        closure,
        baseline_png_bytes_by_basename={FIX_PARITY_BN: parity, FIX_ALT_BN: alt},
    )
    assert merged["packageSemanticDigestSha256"] == expected_digest
    cpi = merged["pixelDiffExpectation"]["committedPngBaselineIngests_v1"]
    assert cpi["format"] == "committedPngBaselineIngests_v1"
    entries = cpi["entries"]
    assert [e["baselinePngBasename"] for e in entries] == sorted([FIX_ALT_BN, FIX_PARITY_BN])
    for e in entries:
        spi = e["serverPngByteIngest_v1"]
        assert spi["format"] == "serverPngByteIngest_v1"
        assert spi["ingestSourceKind"] == "committed_repository_fixture"
        assert spi["comparison"]["result"] == "match"
        assert spi["width"] == 1 and spi["height"] == 1
        bn = e["baselinePngBasename"]
        raw = parity if bn == FIX_PARITY_BN else alt
        assert spi["canonicalDigestSha256"] == hashlib.sha256(raw).hexdigest()


def test_merge_committed_png_fixture_baselines_from_disc() -> None:
    assert committed_evidence_png_fixture_dir_v1().resolve() == EVIDENCE_PNG_FIXTURE_DIR.resolve()
    pkg = "8" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": FIX_PARITY_BN,
                    "pngFullSheet": FIX_ALT_BN,
                },
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_committed_png_fixture_baselines_into_evidence_closure_review_v1(closure)
    assert merged["pixelDiffExpectation"]["committedPngBaselineIngests_v1"]["format"] == (
        "committedPngBaselineIngests_v1"
    )
    assert len(merged["pixelDiffExpectation"]["committedPngBaselineIngests_v1"]["entries"]) == 2


def test_committed_ingest_preserves_artifact_correlation_and_lifecycle_digest() -> None:
    pkg = "7" * 64
    parity = (EVIDENCE_PNG_FIXTURE_DIR / FIX_PARITY_BN).read_bytes()
    alt = (EVIDENCE_PNG_FIXTURE_DIR / FIX_ALT_BN).read_bytes()
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": FIX_PARITY_BN,
                    "pngFullSheet": FIX_ALT_BN,
                },
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    pix_before = closure["pixelDiffExpectation"]
    ac_dig = pix_before["artifactIngestCorrelation_v1"]["ingestManifestDigestSha256"]
    merged = merge_committed_png_baseline_bytes_into_evidence_closure_review_v1(
        closure,
        baseline_png_bytes_by_basename={FIX_PARITY_BN: parity, FIX_ALT_BN: alt},
    )
    pix = merged["pixelDiffExpectation"]
    assert pix["artifactIngestCorrelation_v1"]["ingestManifestDigestSha256"] == ac_dig
    sig = evidence_lifecycle_signal_v1(
        package_semantic_digest_sha256=pkg,
        suggested_evidence_artifact_basename="bim-test",
        evidence_closure_review=merged,
    )
    assert sig["artifactIngestManifestDigestSha256"] == ac_dig


def test_committed_ingest_coexists_with_artifact_ingest_correlation_digest_mismatch() -> None:
    pkg = "6" * 64
    parity = (EVIDENCE_PNG_FIXTURE_DIR / FIX_PARITY_BN).read_bytes()
    alt = (EVIDENCE_PNG_FIXTURE_DIR / FIX_ALT_BN).read_bytes()
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": FIX_PARITY_BN,
                    "pngFullSheet": FIX_ALT_BN,
                },
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_committed_png_baseline_bytes_into_evidence_closure_review_v1(
        closure,
        baseline_png_bytes_by_basename={FIX_PARITY_BN: parity, FIX_ALT_BN: alt},
    )
    pix = dict(merged["pixelDiffExpectation"])
    ac_raw = pix["artifactIngestCorrelation_v1"]
    ac = dict(ac_raw)
    ac["ingestManifestDigestSha256"] = "1" * 64
    pix["artifactIngestCorrelation_v1"] = ac
    tampered = {**merged, "pixelDiffExpectation": pix}
    fl = evidence_diff_ingest_fix_loop_v1(tampered)
    assert "artifact_ingest_correlation_digest_mismatch" in fl["blockerCodes"]
    assert tampered["pixelDiffExpectation"]["committedPngBaselineIngests_v1"]["entries"]


def test_merge_committed_png_baseline_bytes_invalid_png_records_parse_failure() -> None:
    pkg = "5" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {"pngViewport": "x.png", "pngFullSheet": "y.png"},
                "correlation": {"semanticDigestSha256": pkg},
            }
        ],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    merged = merge_committed_png_baseline_bytes_into_evidence_closure_review_v1(
        closure,
        baseline_png_bytes_by_basename={"x.png": b"not-a-png"},
    )
    e0 = merged["pixelDiffExpectation"]["committedPngBaselineIngests_v1"]["entries"][0]
    assert e0["baselinePngBasename"] == "x.png"
    comp = e0["serverPngByteIngest_v1"]["comparison"]
    assert "png_parse_failed" in str(comp.get("skippedReason", ""))
