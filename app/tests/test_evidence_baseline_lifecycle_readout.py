from __future__ import annotations

from pathlib import Path

from bim_ai.evidence_manifest import (
    MINIMAL_PROBE_PNG_BYTES_V1,
    MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    evidence_baseline_lifecycle_readout_v1,
    evidence_closure_review_v1,
    evidence_diff_ingest_fix_loop_v1,
    evidence_review_performance_gate_v1,
    merge_committed_png_baseline_bytes_into_evidence_closure_review_v1,
    merge_server_png_byte_ingest_into_evidence_closure_review_v1,
)

EVIDENCE_PNG_FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "evidence"
FIX_PARITY_BN = "committed-baseline-probe-parity-v1.png"
FIX_ALT_BN = "committed-baseline-alt-1x1-v1.png"


def _readout(closure: dict) -> dict:
    fl = evidence_diff_ingest_fix_loop_v1(closure)
    pg = evidence_review_performance_gate_v1(fl)
    return evidence_baseline_lifecycle_readout_v1(
        evidence_closure_review=closure,
        evidence_diff_ingest_fix_loop=fl,
        evidence_review_performance_gate=pg,
    )


def test_evidence_baseline_lifecycle_readout_v1_clean_accept_path() -> None:
    pkg = "a" * 64
    parity = (EVIDENCE_PNG_FIXTURE_DIR / FIX_PARITY_BN).read_bytes()
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[
            {
                "sheetId": "s1",
                "playwrightSuggestedFilenames": {
                    "pngViewport": FIX_PARITY_BN,
                    "pngFullSheet": FIX_PARITY_BN,
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
        baseline_png_bytes_by_basename={FIX_PARITY_BN: parity},
    )
    merged2 = merge_server_png_byte_ingest_into_evidence_closure_review_v1(
        merged,
        png_bytes=MINIMAL_PROBE_PNG_BYTES_V1,
        expected_canonical_sha256_baseline=MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1,
    )
    out = _readout(merged2)
    assert out["format"] == "evidenceBaselineLifecycleReadout_v1"
    assert out["ingestTargetCount"] == 1
    assert out["expectedBaselineIds"] == [FIX_PARITY_BN]
    assert out["rollupDigestCorrelationStatus"] == "aligned"
    assert out["rollupSuggestedNextAction"] == "accept_baseline"
    assert out["gateClosed"] is True
    assert out["fixLoopBlockerCodes"] == []
    assert len(out["rows"]) == 1
    row = out["rows"][0]
    assert row["baselinePngBasename"] == FIX_PARITY_BN
    assert row["committedFixtureStatus"] == "present"
    assert row["suggestedNextAction"] == "accept_baseline"
    assert row["digestCorrelationStatus"] == "aligned"
    assert "performance_gate_gateClosed=true" in row["ciGateHint"]


def test_evidence_baseline_lifecycle_readout_v1_missing_committed_fixture() -> None:
    pkg = "b" * 64
    parity = (EVIDENCE_PNG_FIXTURE_DIR / FIX_PARITY_BN).read_bytes()
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
        baseline_png_bytes_by_basename={FIX_PARITY_BN: parity},
    )
    out = _readout(merged)
    assert out["rollupSuggestedNextAction"] == "missing_artifact"
    assert out["ingestTargetCount"] == 2
    basenames = [r["baselinePngBasename"] for r in out["rows"]]
    assert basenames == sorted([FIX_ALT_BN, FIX_PARITY_BN])
    by_bn = {r["baselinePngBasename"]: r for r in out["rows"]}
    assert by_bn[FIX_PARITY_BN]["committedFixtureStatus"] == "present"
    assert by_bn[FIX_ALT_BN]["committedFixtureStatus"] == "missing"
    assert by_bn[FIX_ALT_BN]["suggestedNextAction"] == "missing_artifact"


def test_evidence_baseline_lifecycle_readout_v1_digest_mismatch_investigate() -> None:
    pkg = "c" * 64
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
    out = _readout(tampered)
    assert "artifact_ingest_correlation_digest_mismatch" in out["fixLoopBlockerCodes"]
    assert out["rollupSuggestedNextAction"] == "investigate_diff"
    assert out["rollupDigestCorrelationStatus"] == "mismatch"
    assert out["gateClosed"] is False
    for r in out["rows"]:
        assert r["suggestedNextAction"] == "investigate_diff"
        assert r["digestCorrelationStatus"] == "mismatch"


def test_evidence_baseline_lifecycle_readout_v1_no_baseline_targets() -> None:
    pkg = "d" * 64
    closure = evidence_closure_review_v1(
        package_semantic_digest_sha256=pkg,
        deterministic_sheet_evidence=[],
        deterministic_3d_view_evidence=[],
        deterministic_plan_view_evidence=[],
        deterministic_section_cut_evidence=[],
    )
    out = _readout(closure)
    assert out["ingestTargetCount"] == 0
    assert out["expectedBaselineIds"] == []
    assert out["rows"] == []
    assert out["rollupDigestCorrelationStatus"] == "not_applicable"
    assert out["rollupSuggestedNextAction"] == "noop_no_baseline_targets"
    assert out["gateClosed"] is True
