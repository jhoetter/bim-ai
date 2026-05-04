from __future__ import annotations

from bim_ai.evidence_manifest import evidence_closure_review_v1


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
