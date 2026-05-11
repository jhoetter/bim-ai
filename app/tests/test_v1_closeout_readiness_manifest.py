from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from bim_ai import v1_closeout_readiness_manifest as v1_manifest
from bim_ai.evidence_manifest import agent_evidence_closure_hints
from bim_ai.v1_closeout_readiness_manifest import build_v1_closeout_readiness_manifest_v1

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _canonical_without_digest(manifest: dict) -> str:
    body = {k: v for k, v in manifest.items() if k != "manifestContentDigestSha256"}
    return json.dumps(body, sort_keys=True, separators=(",", ":"))


def test_closeout_manifest_is_deterministic_across_calls() -> None:
    a = build_v1_closeout_readiness_manifest_v1()
    b = build_v1_closeout_readiness_manifest_v1()
    assert a == b
    dig_a = a.get("manifestContentDigestSha256")
    dig_b = b.get("manifestContentDigestSha256")
    assert isinstance(dig_a, str) and len(dig_a) == 64
    assert dig_a == dig_b


def test_manifest_digest_matches_canonical_body() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    expected = hashlib.sha256(_canonical_without_digest(m).encode("utf-8")).hexdigest()
    assert m.get("manifestContentDigestSha256") == expected


def test_required_gate_paths_and_kinds() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    assert m.get("format") == "v1CloseoutReadinessManifest_v1"
    gates = m.get("gates")
    assert isinstance(gates, list)
    by_id = {str(g["id"]): g for g in gates if isinstance(g, dict)}
    assert (
        by_id["pytest_prd_traceability_matrix"]["path"]
        == "app/tests/test_prd_traceability_matrix.py"
    )
    assert (
        by_id["pytest_seed_artifact_roundtrip"]["path"]
        == "app/tests/test_seed_artifact_roundtrip.py"
    )
    assert by_id["seed_artifact_contract"]["path"] == "spec/seed-artifacts.md"
    assert (
        by_id["pytest_evidence_manifest_closure"]["path"]
        == "app/tests/test_evidence_manifest_closure.py"
    )
    assert by_id["seed_artifact_contract"]["gateKind"] == "seed_artifact_contract"
    assert by_id["pytest_seed_artifact_roundtrip"]["gateKind"] == "seed_artifact_roundtrip"
    gate_ids = [str(g["id"]) for g in gates if isinstance(g, dict)]
    assert gate_ids == sorted(gate_ids)


def test_seed_artifact_contract_gate_structural_ok_in_repo() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    gates = {g["id"]: g for g in m["gates"] if isinstance(g, dict)}
    g = gates["seed_artifact_contract"]
    assert g["structuralOk"] is True
    p = REPO_ROOT / g["path"]
    assert p.is_file()


def test_deferred_blockers_not_completed_work() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    for row in m["deferredBlockers"]:
        assert row.get("countsAsCompletedWork") is False
    ids = [str(r["id"]) for r in m["deferredBlockers"]]
    assert "prd_wide_blocking_validation" in ids
    assert sorted(ids) == ids


def test_default_classification_blocked_by_deferrals_never_release_ready() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    assert m["releaseClassification"] == "blocked_deferred"
    assert m["releaseClassification"] != "release_ready"


def test_classification_not_release_ready_when_deferrals_cleared(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(v1_manifest, "_deferred_blockers_v1", lambda: [])
    m = build_v1_closeout_readiness_manifest_v1()
    assert m["releaseClassification"] == "not_release_ready"
    assert m["releaseClassification"] != "release_ready"


def test_classification_not_release_ready_when_gate_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(v1_manifest, "_deferred_blockers_v1", lambda: [])

    def bad_gates(
        *,
        ci_yml_text: str | None = None,
    ) -> list[dict]:
        return [
            {
                "id": "pytest_evidence_manifest_closure",
                "gateKind": "required_pytest_module",
                "path": "app/tests/test_evidence_manifest_closure.py",
                "structuralOk": False,
            }
        ]

    monkeypatch.setattr(v1_manifest, "_gate_rows", bad_gates)
    m = build_v1_closeout_readiness_manifest_v1()
    assert m["releaseClassification"] == "not_release_ready"
    details = m.get("releaseClassificationDetails")
    assert isinstance(details, dict)
    assert details.get("allRequiredGatesStructuralOk") is False


def test_agent_evidence_closure_hints_names_manifest_field() -> None:
    hints = agent_evidence_closure_hints()
    assert hints.get("v1CloseoutReadinessManifestField") == "v1CloseoutReadinessManifest_v1"
    note = str(hints.get("semanticDigestOmitsDerivativeSummariesNote") or "")
    assert "v1CloseoutReadinessManifest_v1" in note


def test_agent_evidence_closure_hints_names_prd_advisor_matrix_field() -> None:
    hints = agent_evidence_closure_hints()
    assert hints.get("prdAdvisorMatrixField") == "prdAdvisorMatrix_v1"
    note = str(hints.get("semanticDigestOmitsDerivativeSummariesNote") or "")
    assert "prdAdvisorMatrix_v1" in note


def test_manifest_includes_prd_advisor_matrix_summary() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    summary = m.get("prdAdvisorMatrixSummary")
    assert isinstance(summary, dict), "manifest must include prdAdvisorMatrixSummary"
    assert summary.get("format") == "prdAdvisorMatrixSummary_v1"
    assert isinstance(summary.get("totalSections"), int) and summary["totalSections"] > 0
    assert "statusCounts" in summary
    assert "deferredCount" in summary
    assert "passCount" in summary


def test_manifest_prd_advisor_matrix_summary_deferred_count_positive() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    summary = m["prdAdvisorMatrixSummary"]
    assert summary["deferredCount"] > 0, (
        "At least one PRD section must be deferred in the closeout manifest summary"
    )


def test_manifest_gates_include_prd_blocking_advisor_matrix() -> None:
    m = build_v1_closeout_readiness_manifest_v1()
    gates = {g["id"]: g for g in m.get("gates", []) if isinstance(g, dict)}
    assert "pytest_prd_blocking_advisor_matrix" in gates
    gate = gates["pytest_prd_blocking_advisor_matrix"]
    assert gate["path"] == "app/tests/test_prd_blocking_advisor_matrix.py"
    assert gate["gateKind"] == "required_pytest_module"
    assert gate["structuralOk"] is True
