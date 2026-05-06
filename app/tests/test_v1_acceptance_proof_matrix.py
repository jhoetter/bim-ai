from __future__ import annotations

import hashlib
import json

from bim_ai.document import Document
from bim_ai.evidence_manifest import DIGEST_EXCLUDED_KEYS
from bim_ai.v1_acceptance_proof_matrix import (
    ALLOWED_AXIS_STATES,
    AXIS_IDS,
    build_v1_acceptance_proof_matrix_v1,
)


def _empty_doc() -> Document:
    return Document(elements={})


# ── Determinism ───────────────────────────────────────────────────────────────


def test_two_builds_on_same_doc_are_byte_identical() -> None:
    doc = _empty_doc()
    a = json.dumps(build_v1_acceptance_proof_matrix_v1(doc), sort_keys=True, separators=(",", ":"))
    b = json.dumps(build_v1_acceptance_proof_matrix_v1(doc), sort_keys=True, separators=(",", ":"))
    assert a == b


def test_digest_is_64_hex_chars() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    digest = result["manifestContentDigestSha256"]
    assert isinstance(digest, str)
    assert len(digest) == 64
    assert all(c in "0123456789abcdef" for c in digest)


def test_digest_matches_canonical_body() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    body = {
        k: v
        for k, v in result.items()
        if k not in {"manifestContentDigestSha256", "v1AcceptanceProofMatrix_v1"}
    }
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    assert result["manifestContentDigestSha256"] == expected


# ── Schema shape ──────────────────────────────────────────────────────────────


def test_format_field_is_correct() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    assert result["format"] == "v1AcceptanceProofMatrix_v1"


def test_schema_version_is_one() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    assert result["schemaVersion"] == 1


def test_subsystem_rows_present_and_non_empty() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    rows = result["subsystemRows"]
    assert isinstance(rows, list)
    assert len(rows) > 0


def test_every_subsystem_row_has_seven_axes() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    for row in result["subsystemRows"]:
        axes = row["axes"]
        assert set(axes.keys()) == set(AXIS_IDS), f"Row {row['subsystemId']!r} has wrong axis keys"
        assert len(axes) == 7


def test_every_axis_state_is_allowed() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    for row in result["subsystemRows"]:
        for axis, state in row["axes"].items():
            assert state in ALLOWED_AXIS_STATES, (
                f"Row {row['subsystemId']!r} axis {axis!r} has invalid state {state!r}"
            )


def test_subsystem_rows_sorted_by_subsystem_id() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    ids = [r["subsystemId"] for r in result["subsystemRows"]]
    assert ids == sorted(ids)


def test_axes_keys_sorted_within_each_row() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    for row in result["subsystemRows"]:
        axis_keys = list(row["axes"].keys())
        assert axis_keys == sorted(axis_keys)


def test_evidence_tokens_sorted_within_each_row() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    for row in result["subsystemRows"]:
        tokens = row["evidenceTokens"]
        assert tokens == sorted(tokens)


def test_tracker_refs_sorted_within_each_row() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    for row in result["subsystemRows"]:
        refs = row["trackerRefs"]
        assert refs == sorted(refs)


def test_axis_coverage_present_at_top_level() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    coverage = result["axisCoverage"]
    assert isinstance(coverage, dict)
    for axis in AXIS_IDS:
        assert axis in coverage
        for state in ALLOWED_AXIS_STATES:
            assert state in coverage[axis]


def test_axis_coverage_counts_sum_to_subsystem_row_count() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    n_rows = len(result["subsystemRows"])
    for axis, counts in result["axisCoverage"].items():
        total = sum(counts.values())
        assert total == n_rows, f"Axis {axis!r} coverage counts sum to {total}, expected {n_rows}"


# ── v1AcceptanceProofMatrix_v1 token ─────────────────────────────────────────


def test_summary_token_present() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    token = result["v1AcceptanceProofMatrix_v1"]
    assert isinstance(token, dict)


def test_summary_token_has_schema_version() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    assert result["v1AcceptanceProofMatrix_v1"]["schemaVersion"] == 1


def test_summary_token_has_axis_coverage() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    assert "axisCoverage" in result["v1AcceptanceProofMatrix_v1"]


def test_summary_token_has_digest() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    digest = result["v1AcceptanceProofMatrix_v1"]["digest"]
    assert len(digest) == 64


def test_summary_token_digest_matches_manifest_digest() -> None:
    result = build_v1_acceptance_proof_matrix_v1(_empty_doc())
    assert result["v1AcceptanceProofMatrix_v1"]["digest"] == result["manifestContentDigestSha256"]


# ── Evidence manifest aggregation ────────────────────────────────────────────


def test_v1_acceptance_proof_matrix_key_is_in_digest_excluded_keys() -> None:
    """Matrix appears under the expected key in the aggregated evidence manifest."""
    assert "v1AcceptanceProofMatrix_v1" in DIGEST_EXCLUDED_KEYS
