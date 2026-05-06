"""Tests for the blocking advisor matrix (Prompt-7 / WP-V01, WP-A01, WP-A02, WP-A04, WP-F01).

Validates:
- Matrix is deterministic across repeated calls
- Every advisor section has an explicit pass/warn/block/deferred status
- Every deferred item has an allowed waiver reason code and evidence link
- Missing/invalid waiver evidence fails validation
- Blocking statuses are surfaced in the v1 closeout readiness manifest
- Golden bundle coverage paths exist in the repo
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import pytest

from bim_ai.prd_blocking_advisor_matrix import (
    ALLOWED_STATUSES,
    ALLOWED_WAIVER_REASON_CODES,
    build_prd_blocking_advisor_matrix,
    prd_advisor_matrix_summary,
    validate_prd_advisor_matrix_rows,
)
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


# ── Determinism ───────────────────────────────────────────────────────────────


def test_prd_advisor_matrix_is_deterministic() -> None:
    a = build_prd_blocking_advisor_matrix()
    b = build_prd_blocking_advisor_matrix()
    assert a == b


def test_prd_advisor_matrix_digest_is_sha256() -> None:
    m = build_prd_blocking_advisor_matrix()
    dig = m.get("matrixContentDigestSha256")
    assert isinstance(dig, str) and len(dig) == 64, f"expected 64-char hex digest, got {dig!r}"


def test_prd_advisor_matrix_digest_stable_across_calls() -> None:
    a = build_prd_blocking_advisor_matrix()
    b = build_prd_blocking_advisor_matrix()
    assert a["matrixContentDigestSha256"] == b["matrixContentDigestSha256"]


# ── Row shape and status ──────────────────────────────────────────────────────


def test_every_row_has_required_fields() -> None:
    m = build_prd_blocking_advisor_matrix()
    for row in m["rows"]:
        row_id = row.get("id")
        assert row_id, f"Row missing 'id': {row!r}"
        assert row.get("prdSection"), f"{row_id}: missing prdSection"
        assert row.get("prdSectionTitle"), f"{row_id}: missing prdSectionTitle"
        assert row.get("prdNeedle"), f"{row_id}: missing prdNeedle"
        assert "status" in row, f"{row_id}: missing status"
        assert "requiredRuleIds" in row, f"{row_id}: missing requiredRuleIds"
        assert isinstance(row["requiredRuleIds"], list), f"{row_id}: requiredRuleIds must be list"
        assert "goldenBundleCoverage" in row, f"{row_id}: missing goldenBundleCoverage"


def test_every_row_has_valid_status() -> None:
    m = build_prd_blocking_advisor_matrix()
    for row in m["rows"]:
        assert row["status"] in ALLOWED_STATUSES, (
            f"Row {row['id']!r}: invalid status {row['status']!r}; "
            f"allowed: {sorted(ALLOWED_STATUSES)}"
        )


def test_rows_sorted_by_id() -> None:
    m = build_prd_blocking_advisor_matrix()
    ids = [r["id"] for r in m["rows"]]
    assert ids == sorted(ids), f"Rows not sorted by id; got {ids}"


def test_row_ids_are_unique() -> None:
    m = build_prd_blocking_advisor_matrix()
    ids = [r["id"] for r in m["rows"]]
    assert len(ids) == len(set(ids)), f"Duplicate row ids: {[x for x in ids if ids.count(x) > 1]}"


def test_required_rule_ids_are_sorted_within_each_row() -> None:
    m = build_prd_blocking_advisor_matrix()
    for row in m["rows"]:
        rule_ids = row.get("requiredRuleIds", [])
        assert rule_ids == sorted(rule_ids), (
            f"Row {row['id']!r}: requiredRuleIds not sorted: {rule_ids}"
        )


# ── Deferred waiver validation ────────────────────────────────────────────────


def test_deferred_rows_have_valid_waiver_codes() -> None:
    m = build_prd_blocking_advisor_matrix()
    for row in m["rows"]:
        if row["status"] == "deferred":
            code = row.get("waiverReasonCode")
            assert code in ALLOWED_WAIVER_REASON_CODES, (
                f"Row {row['id']!r}: invalid waiverReasonCode {code!r}; "
                f"allowed: {sorted(ALLOWED_WAIVER_REASON_CODES)}"
            )
            assert row.get("waiverEvidenceLink"), (
                f"Row {row['id']!r}: deferred row must have waiverEvidenceLink"
            )


def test_non_deferred_rows_have_no_waiver_code() -> None:
    m = build_prd_blocking_advisor_matrix()
    for row in m["rows"]:
        if row["status"] not in ("deferred", "partial"):
            assert "waiverReasonCode" not in row, (
                f"Row {row['id']!r}: non-deferred/non-partial row must not have waiverReasonCode "
                f"(status={row['status']!r})"
            )


def test_matrix_has_at_least_one_deferred_row() -> None:
    m = build_prd_blocking_advisor_matrix()
    deferred = [r for r in m["rows"] if r["status"] == "deferred"]
    assert deferred, "Matrix must contain at least one deferred row"


def test_status_counts_sum_to_total_rows() -> None:
    m = build_prd_blocking_advisor_matrix()
    total = sum(m["statusCounts"].values())
    assert total == len(m["rows"]), f"statusCounts sum {total} != len(rows) {len(m['rows'])}"


# ── Validation function rejects bad input ─────────────────────────────────────


def test_validation_rejects_unknown_waiver_reason_code() -> None:
    bad_rows = [
        {
            "id": "test_bad_waiver",
            "prdSection": "§11",
            "prdSectionTitle": "Test Section",
            "prdNeedle": "test needle",
            "requiredRuleIds": [],
            "status": "deferred",
            "waiverReasonCode": "UNKNOWN_MADE_UP_CODE",
            "waiverEvidenceLink": "spec/workpackage-master-tracker.md",
            "goldenBundleCoverage": [],
        }
    ]
    errors = validate_prd_advisor_matrix_rows(bad_rows)
    assert any("UNKNOWN_MADE_UP_CODE" in e for e in errors), (
        f"Expected error mentioning 'UNKNOWN_MADE_UP_CODE', got: {errors}"
    )


def test_validation_rejects_deferred_row_missing_waiver_code() -> None:
    bad_rows = [
        {
            "id": "test_missing_waiver",
            "prdSection": "§11",
            "prdSectionTitle": "Test Section",
            "prdNeedle": "test needle",
            "requiredRuleIds": [],
            "status": "deferred",
            "waiverEvidenceLink": "spec/workpackage-master-tracker.md",
            "goldenBundleCoverage": [],
        }
    ]
    errors = validate_prd_advisor_matrix_rows(bad_rows)
    assert errors, "Expected validation errors for deferred row missing waiverReasonCode"


def test_validation_rejects_deferred_row_missing_evidence_link() -> None:
    bad_rows = [
        {
            "id": "test_missing_link",
            "prdSection": "§11",
            "prdSectionTitle": "Test Section",
            "prdNeedle": "test needle",
            "requiredRuleIds": [],
            "status": "deferred",
            "waiverReasonCode": "v1_scope_deferred",
            "goldenBundleCoverage": [],
        }
    ]
    errors = validate_prd_advisor_matrix_rows(bad_rows)
    assert errors, "Expected validation errors for deferred row missing waiverEvidenceLink"


def test_validation_rejects_invalid_status() -> None:
    bad_rows = [
        {
            "id": "test_bad_status",
            "prdSection": "§11",
            "prdSectionTitle": "Test Section",
            "prdNeedle": "test needle",
            "requiredRuleIds": [],
            "status": "unknown_status",
            "goldenBundleCoverage": [],
        }
    ]
    errors = validate_prd_advisor_matrix_rows(bad_rows)
    assert any("unknown_status" in e for e in errors)


def test_validation_rejects_waiver_code_on_passing_row() -> None:
    bad_rows = [
        {
            "id": "test_pass_with_waiver",
            "prdSection": "§11",
            "prdSectionTitle": "Test Section",
            "prdNeedle": "test needle",
            "requiredRuleIds": [],
            "status": "pass",
            "waiverReasonCode": "v1_scope_deferred",
            "goldenBundleCoverage": [],
        }
    ]
    errors = validate_prd_advisor_matrix_rows(bad_rows)
    assert errors, "Expected error: pass row must not have waiverReasonCode"


def test_validation_rejects_duplicate_ids() -> None:
    row = {
        "id": "dup_id",
        "prdSection": "§11",
        "prdSectionTitle": "Test",
        "prdNeedle": "test",
        "requiredRuleIds": [],
        "status": "pass",
        "goldenBundleCoverage": [],
    }
    errors = validate_prd_advisor_matrix_rows([row, deepcopy(row)])
    assert any("dup_id" in e for e in errors)


def test_canonical_rows_have_no_validation_errors() -> None:
    m = build_prd_blocking_advisor_matrix()
    assert m["validationErrors"] == [], (
        f"Canonical matrix rows have validation errors: {m['validationErrors']}"
    )


# ── Path existence ────────────────────────────────────────────────────────────


def test_golden_bundle_coverage_paths_exist() -> None:
    m = build_prd_blocking_advisor_matrix()
    missing: list[tuple[str, str]] = []
    for row in m["rows"]:
        for cov in row.get("goldenBundleCoverage", []):
            if not isinstance(cov, dict):
                continue
            kind = cov.get("kind", "")
            if kind in ("pytest_module", "golden_cli_bundle", "ci_config"):
                path = cov.get("path", "")
                if path and not (REPO_ROOT / path).exists():
                    missing.append((row["id"], path))
    if missing:
        detail = "\n".join(f"  {rid!r}: {p}" for rid, p in missing)
        pytest.fail(f"Golden bundle coverage paths missing from repo:\n{detail}")


# ── Integration with v1 closeout readiness manifest ──────────────────────────


def test_blocking_statuses_surfaced_in_readiness_manifest() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    summary = m.get("prdAdvisorMatrixSummary")
    assert isinstance(summary, dict), (
        "v1 closeout readiness manifest must include 'prdAdvisorMatrixSummary'"
    )
    assert "statusCounts" in summary
    assert "deferredCount" in summary
    assert "passCount" in summary
    assert "blockCount" in summary
    assert "matrixContentDigestSha256" in summary


def test_manifest_prd_advisor_summary_deferred_count_positive() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    summary = m["prdAdvisorMatrixSummary"]
    assert summary["deferredCount"] > 0, (
        "At least one PRD section must be deferred in the v1 closeout manifest"
    )


def test_manifest_prd_advisor_summary_deferred_section_ids_listed() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    summary = m["prdAdvisorMatrixSummary"]
    deferred_ids = summary.get("deferredSectionIds", [])
    assert isinstance(deferred_ids, list) and deferred_ids, (
        "deferredSectionIds must be a non-empty list when deferredCount > 0"
    )


def test_manifest_gate_pytest_prd_blocking_advisor_matrix_present() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    gates = {g["id"]: g for g in m.get("gates", []) if isinstance(g, dict)}
    assert "pytest_prd_blocking_advisor_matrix" in gates, (
        "Readiness manifest gates must include 'pytest_prd_blocking_advisor_matrix'"
    )
    gate = gates["pytest_prd_blocking_advisor_matrix"]
    assert gate["path"] == "app/tests/test_prd_blocking_advisor_matrix.py"
    assert gate["structuralOk"] is True


def test_manifest_gates_remain_sorted_after_new_gate() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    gate_ids = [g["id"] for g in m.get("gates", []) if isinstance(g, dict)]
    assert gate_ids == sorted(gate_ids)


# ── Summary helper ────────────────────────────────────────────────────────────


def test_prd_advisor_matrix_summary_shape() -> None:
    s = prd_advisor_matrix_summary()
    assert s["format"] == "prdAdvisorMatrixSummary_v1"
    assert isinstance(s["totalSections"], int) and s["totalSections"] > 0
    assert isinstance(s["deferredSectionIds"], list)
    assert isinstance(s["blockingSectionIds"], list)
    assert isinstance(s["validationErrors"], list)
