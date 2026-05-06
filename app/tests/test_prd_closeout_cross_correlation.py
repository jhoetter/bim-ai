"""Tests for the PRD closeout cross-correlation manifest (Wave 3 / WP-A01/A02/A04/F01/V01).

Validates:
- Manifest is deterministic and has a SHA-256 digest
- Every PRD advisor section has a cross-correlation row
- Every row has a valid crossCorrelationToken
- Rows are sorted by prdSectionId with no duplicates
- Advisory findings identify PRD section ids
- reason_code_drift fires for deferred sections with waiver codes not mirrored in readiness
- advisor_only fires for sections without specific readiness gate or traceability coverage
- Cross-correlation manifest is embedded in v1 closeout readiness manifest
- Token counts sum to total rows
"""

from __future__ import annotations

from bim_ai.prd_blocking_advisor_matrix import build_prd_blocking_advisor_matrix
from bim_ai.prd_closeout_cross_correlation import (
    CROSS_CORRELATION_TOKENS,
    build_prd_closeout_cross_correlation_manifest_v1,
    prd_closeout_advisory_violations,
)
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1

# ── Determinism ───────────────────────────────────────────────────────────────


def test_cross_correlation_manifest_is_deterministic() -> None:
    a = build_prd_closeout_cross_correlation_manifest_v1()
    b = build_prd_closeout_cross_correlation_manifest_v1()
    assert a == b


def test_cross_correlation_manifest_digest_is_sha256() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    dig = m.get("prdCloseoutCrossCorrelationDigestSha256")
    assert isinstance(dig, str) and len(dig) == 64, f"expected 64-char hex digest, got {dig!r}"


def test_cross_correlation_manifest_digest_stable_across_calls() -> None:
    a = build_prd_closeout_cross_correlation_manifest_v1()
    b = build_prd_closeout_cross_correlation_manifest_v1()
    assert (
        a["prdCloseoutCrossCorrelationDigestSha256"] == b["prdCloseoutCrossCorrelationDigestSha256"]
    )


# ── Row shape ─────────────────────────────────────────────────────────────────


def test_every_advisor_section_has_cross_correlation_row() -> None:
    advisor_matrix = build_prd_blocking_advisor_matrix()
    cross_corr = build_prd_closeout_cross_correlation_manifest_v1()
    advisor_ids = {r["id"] for r in advisor_matrix["rows"]}
    corr_ids = {r["prdSectionId"] for r in cross_corr["rows"]}
    assert advisor_ids == corr_ids, (
        f"Advisor sections not in cross-correlation: {advisor_ids - corr_ids}; "
        f"Extra cross-correlation sections: {corr_ids - advisor_ids}"
    )


def test_every_row_has_required_fields() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for row in m["rows"]:
        sid = row.get("prdSectionId")
        assert sid, f"Row missing prdSectionId: {row!r}"
        assert row.get("prdSection"), f"{sid}: missing prdSection"
        assert row.get("prdSectionTitle"), f"{sid}: missing prdSectionTitle"
        assert "advisorMatrixStatus" in row, f"{sid}: missing advisorMatrixStatus"
        assert "readinessGateIds" in row, f"{sid}: missing readinessGateIds"
        assert isinstance(row["readinessGateIds"], list), f"{sid}: readinessGateIds must be list"
        assert "traceabilityTestIds" in row, f"{sid}: missing traceabilityTestIds"
        assert isinstance(row["traceabilityTestIds"], list), (
            f"{sid}: traceabilityTestIds must be list"
        )
        assert "crossCorrelationToken" in row, f"{sid}: missing crossCorrelationToken"


def test_rows_sorted_by_prd_section_id() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    ids = [r["prdSectionId"] for r in m["rows"]]
    assert ids == sorted(ids), f"Rows not sorted by prdSectionId; got {ids}"


def test_row_prd_section_ids_are_unique() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    ids = [r["prdSectionId"] for r in m["rows"]]
    assert len(ids) == len(set(ids)), (
        f"Duplicate prdSectionIds: {[x for x in ids if ids.count(x) > 1]}"
    )


# ── Token validation ──────────────────────────────────────────────────────────


def test_every_row_has_valid_cross_correlation_token() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for row in m["rows"]:
        token = row["crossCorrelationToken"]
        assert token in CROSS_CORRELATION_TOKENS, (
            f"Row {row['prdSectionId']!r}: invalid token {token!r}; "
            f"allowed: {sorted(CROSS_CORRELATION_TOKENS)}"
        )


def test_token_counts_sum_to_total_rows() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    total = sum(m["tokenCounts"].values())
    assert total == len(m["rows"]), f"tokenCounts sum {total} != len(rows) {len(m['rows'])}"


def test_manifest_has_at_least_one_aligned_row() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    aligned = [r for r in m["rows"] if r["crossCorrelationToken"] == "aligned"]
    assert aligned, "Matrix must contain at least one aligned row"


def test_manifest_has_at_least_one_advisor_only_row() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    advisor_only = [r for r in m["rows"] if r["crossCorrelationToken"] == "advisor_only"]
    assert advisor_only, "Matrix must contain at least one advisor_only row"


def test_manifest_has_at_least_one_reason_code_drift_row() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    drift = [r for r in m["rows"] if r["crossCorrelationToken"] == "reason_code_drift"]
    assert drift, "Matrix must contain at least one reason_code_drift row (deferred sections)"


# ── Deferred rows get reason_code_drift ──────────────────────────────────────


def test_deferred_rows_get_reason_code_drift_token() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for row in m["rows"]:
        if row["advisorMatrixStatus"] == "deferred":
            assert row["crossCorrelationToken"] == "reason_code_drift", (
                f"Deferred row {row['prdSectionId']!r} should have reason_code_drift token, "
                f"got {row['crossCorrelationToken']!r}"
            )


def test_deferred_rows_have_waiver_reason_code_in_cross_corr_row() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for row in m["rows"]:
        if row["advisorMatrixStatus"] == "deferred":
            assert "waiverReasonCode" in row, (
                f"Deferred row {row['prdSectionId']!r} must carry waiverReasonCode"
            )


# ── Aligned rows have traceability coverage ──────────────────────────────────


def test_aligned_rows_have_traceability_test_ids() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for row in m["rows"]:
        if row["crossCorrelationToken"] == "aligned":
            assert row.get("traceabilityTestIds"), (
                f"aligned row {row['prdSectionId']!r} must have traceabilityTestIds"
            )


def test_aligned_rows_have_specific_readiness_gate_ids() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for row in m["rows"]:
        if row["crossCorrelationToken"] == "aligned":
            assert row.get("specificReadinessGateIds"), (
                f"aligned row {row['prdSectionId']!r} must have specificReadinessGateIds"
            )


# ── Advisory findings ─────────────────────────────────────────────────────────


def test_advisory_findings_identify_prd_section_ids() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for finding in m["advisoryFindings"]:
        assert finding.get("prdSectionId"), f"Advisory finding must have prdSectionId: {finding!r}"
        assert finding.get("ruleId"), f"Advisory finding must have ruleId: {finding!r}"
        assert finding.get("message"), f"Advisory finding must have message: {finding!r}"


def test_advisory_findings_have_valid_rule_ids() -> None:
    valid_rule_ids = {
        "prd_closeout_advisor_readiness_status_drift",
        "prd_closeout_section_missing_in_readiness",
        "prd_closeout_reason_code_drift",
    }
    m = build_prd_closeout_cross_correlation_manifest_v1()
    for finding in m["advisoryFindings"]:
        assert finding["ruleId"] in valid_rule_ids, (
            f"Unexpected finding ruleId {finding['ruleId']!r}; allowed: {sorted(valid_rule_ids)}"
        )


def test_reason_code_drift_findings_fire_for_deferred_sections() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    deferred_ids = {r["prdSectionId"] for r in m["rows"] if r["advisorMatrixStatus"] == "deferred"}
    drift_finding_ids = {
        f["prdSectionId"]
        for f in m["advisoryFindings"]
        if f["ruleId"] == "prd_closeout_reason_code_drift"
    }
    assert deferred_ids == drift_finding_ids, (
        f"reason_code_drift findings must cover all deferred sections. "
        f"Missing: {deferred_ids - drift_finding_ids}, extra: {drift_finding_ids - deferred_ids}"
    )


def test_advisor_only_findings_fire_for_advisor_only_sections() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    advisor_only_ids = {
        r["prdSectionId"] for r in m["rows"] if r["crossCorrelationToken"] == "advisor_only"
    }
    missing_finding_ids = {
        f["prdSectionId"]
        for f in m["advisoryFindings"]
        if f["ruleId"] == "prd_closeout_section_missing_in_readiness"
    }
    assert advisor_only_ids == missing_finding_ids, (
        f"prd_closeout_section_missing_in_readiness findings must match advisor_only sections. "
        f"Missing: {advisor_only_ids - missing_finding_ids}, "
        f"extra: {missing_finding_ids - advisor_only_ids}"
    )


def test_advisory_violations_helper_returns_findings() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    rows = m["rows"]
    violations = prd_closeout_advisory_violations(rows)
    assert isinstance(violations, list)
    assert len(violations) == len(m["advisoryFindings"])


# ── Integration with v1 closeout readiness manifest ──────────────────────────


def test_cross_correlation_manifest_embedded_in_closeout_manifest() -> None:
    readiness = build_v1_closeout_readiness_manifest_v1()
    corr = readiness.get("prdCloseoutCrossCorrelationManifest_v1")
    assert isinstance(corr, dict), (
        "v1 closeout readiness manifest must include prdCloseoutCrossCorrelationManifest_v1"
    )
    assert corr.get("format") == "prdCloseoutCrossCorrelationManifest_v1"


def test_cross_correlation_manifest_in_readiness_has_rows() -> None:
    readiness = build_v1_closeout_readiness_manifest_v1()
    corr = readiness["prdCloseoutCrossCorrelationManifest_v1"]
    assert isinstance(corr.get("rows"), list) and corr["rows"], (
        "prdCloseoutCrossCorrelationManifest_v1 must have non-empty rows"
    )


def test_cross_correlation_manifest_in_readiness_has_digest() -> None:
    readiness = build_v1_closeout_readiness_manifest_v1()
    corr = readiness["prdCloseoutCrossCorrelationManifest_v1"]
    dig = corr.get("prdCloseoutCrossCorrelationDigestSha256")
    assert isinstance(dig, str) and len(dig) == 64, (
        f"Expected 64-char hex digest in embedded manifest, got {dig!r}"
    )


def test_cross_correlation_manifest_in_readiness_matches_standalone() -> None:
    readiness = build_v1_closeout_readiness_manifest_v1()
    embedded = readiness["prdCloseoutCrossCorrelationManifest_v1"]
    standalone = build_prd_closeout_cross_correlation_manifest_v1()
    assert (
        embedded["prdCloseoutCrossCorrelationDigestSha256"]
        == standalone["prdCloseoutCrossCorrelationDigestSha256"]
    ), "Embedded and standalone cross-correlation digest must match"


# ── Known specific sections ───────────────────────────────────────────────────


def test_prd_s11_sheets_is_aligned() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    rows_by_id = {r["prdSectionId"]: r for r in m["rows"]}
    row = rows_by_id.get("prd_s11_sheets")
    assert row is not None, "prd_s11_sheets must be in cross-correlation rows"
    assert row["crossCorrelationToken"] == "aligned", (
        f"prd_s11_sheets should be aligned (has traceability), got {row['crossCorrelationToken']!r}"
    )


def test_prd_s11_roofs_is_reason_code_drift() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    rows_by_id = {r["prdSectionId"]: r for r in m["rows"]}
    row = rows_by_id.get("prd_s11_roofs")
    assert row is not None, "prd_s11_roofs must be in cross-correlation rows"
    assert row["crossCorrelationToken"] == "reason_code_drift", (
        f"prd_s11_roofs (deferred) should be reason_code_drift, got {row['crossCorrelationToken']!r}"
    )


def test_prd_s14_golden_bundle_is_aligned() -> None:
    m = build_prd_closeout_cross_correlation_manifest_v1()
    rows_by_id = {r["prdSectionId"]: r for r in m["rows"]}
    row = rows_by_id.get("prd_s14_golden_bundle")
    assert row is not None
    assert row["crossCorrelationToken"] == "aligned"
    assert "phase_a_golden_bundle" in row["traceabilityTestIds"]
