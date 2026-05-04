from __future__ import annotations

from bim_ai.evidence_manifest import (
    artifact_ingest_correlation_v1,
    evidence_closure_review_v1,
    evidence_diff_ingest_fix_loop_v1,
    evidence_lifecycle_signal_v1,
)


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
    assert dig == artifact_ingest_correlation_v1(list(ingest["targets"]))["ingestManifestDigestSha256"]
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
