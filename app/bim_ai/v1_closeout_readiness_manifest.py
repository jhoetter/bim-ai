"""Deterministic v1 closeout / CI readiness manifest (prompt-8/prompt-7 / WP-A01,A02,A04,V01,F01).

Built from repo-local structural checks only (paths, gate substrings). No network or timing.
Includes PRD advisor matrix summary from prd_blocking_advisor_matrix.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Literal

_REPO_ROOT = Path(__file__).resolve().parents[2]

_CI_YML_PATH = _REPO_ROOT / ".github" / "workflows" / "ci.yml"


def _deferred_blockers_v1() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = [
        {
            "id": "prd_wide_blocking_validation",
            "reason": (
                "PRD-wide blocking validation for Revit parity v1 remains incomplete. "
                "The PRD blocking advisor matrix (prdAdvisorMatrix_v1) covers §11–§15 sections "
                "but roof validation and full IFC/IDS enforcement are deferred or partially covered."
            ),
            "blocksClassification": True,
            "countsAsCompletedWork": False,
        },
        {
            "id": "revit_production_parity_v1_scope",
            "reason": (
                "Revit production parity v1 is a scoped program; tracker and PRD still list partial "
                "and deferred subsystem work."
            ),
            "blocksClassification": True,
            "countsAsCompletedWork": False,
        },
    ]
    rows.sort(key=lambda r: str(r["id"]))
    return rows


def _gate_rows(*, ci_yml_text: str | None) -> list[dict[str, Any]]:
    gates: list[dict[str, Any]] = []

    def add_path_gate(
        *,
        gate_id: str,
        gate_kind: str,
        rel_path: str,
        note: str | None = None,
    ) -> None:
        p = _REPO_ROOT / rel_path
        row: dict[str, Any] = {
            "id": gate_id,
            "gateKind": gate_kind,
            "path": rel_path.replace("\\", "/"),
            "structuralOk": p.is_file(),
        }
        if note:
            row["note"] = note
        gates.append(row)

    add_path_gate(
        gate_id="seed_artifact_contract",
        gate_kind="seed_artifact_contract",
        rel_path="spec/seed-artifacts.md",
        note="Named seed artifact contract for clean sketch-to-BIM seed handoff.",
    )
    add_path_gate(
        gate_id="pytest_evidence_manifest_closure",
        gate_kind="required_pytest_module",
        rel_path="app/tests/test_evidence_manifest_closure.py",
    )
    add_path_gate(
        gate_id="pytest_seed_artifact_roundtrip",
        gate_kind="seed_artifact_roundtrip",
        rel_path="app/tests/test_seed_artifact_roundtrip.py",
        note="Python engine replay of a named seed artifact bundle.",
    )
    add_path_gate(
        gate_id="pytest_prd_blocking_advisor_matrix",
        gate_kind="required_pytest_module",
        rel_path="app/tests/test_prd_blocking_advisor_matrix.py",
        note="PRD blocking advisor matrix tests (WP-V01/A01/A02/A04/F01 v1 closeout wave 2).",
    )
    add_path_gate(
        gate_id="pytest_prd_traceability_matrix",
        gate_kind="required_pytest_module",
        rel_path="app/tests/test_prd_traceability_matrix.py",
    )

    ci_ok = False
    if ci_yml_text:
        ci_ok = "pytest" in ci_yml_text and "python:" in ci_yml_text and "jobs:" in ci_yml_text
    gates.append(
        {
            "id": "github_workflows_ci_pytest",
            "gateKind": "ci_path_mapping",
            "path": str(_CI_YML_PATH.relative_to(_REPO_ROOT)).replace("\\", "/"),
            "structuralOk": _CI_YML_PATH.is_file() and ci_ok,
            "note": "ci.yml must exist and include python job and pytest.",
        }
    )

    gates.sort(key=lambda r: str(r["id"]))
    return gates


def _release_classification_v1(
    *,
    gates: list[dict[str, Any]],
    deferred: list[dict[str, Any]],
) -> tuple[
    Literal["release_ready", "not_release_ready", "blocked_deferred"],
    dict[str, Any],
]:
    has_blocking_deferral = any(
        bool(d.get("blocksClassification")) is True for d in deferred if isinstance(d, dict)
    )
    required_fail = any(bool(g.get("structuralOk")) is False for g in gates if isinstance(g, dict))

    details: dict[str, Any] = {
        "allRequiredGatesStructuralOk": not required_fail,
        "blockingDeferredCount": sum(
            1
            for d in deferred
            if isinstance(d, dict) and bool(d.get("blocksClassification")) is True
        ),
    }

    if has_blocking_deferral:
        return "blocked_deferred", {**details, "conservativeNote": None}

    if required_fail:
        return "not_release_ready", {
            **details,
            "conservativeNote": "One or more structural gates failed (missing path or tracker row).",
        }

    return "not_release_ready", {
        **details,
        "conservativeNote": (
            "Structural gates pass locally, but v1 closeout release is not claimed: parity scope and "
            "PRD-wide blocking validation remain open per manifest deferrals if re-enabled."
        ),
    }


def _prd_advisor_summary_safe() -> dict[str, Any]:
    from bim_ai.prd_blocking_advisor_matrix import prd_advisor_matrix_summary  # lazy import

    return prd_advisor_matrix_summary()


def _prd_closeout_cross_correlation_safe() -> dict[str, Any] | None:
    try:
        from bim_ai.prd_closeout_cross_correlation import (  # lazy import
            build_prd_closeout_cross_correlation_manifest_v1,
        )

        return build_prd_closeout_cross_correlation_manifest_v1()
    except Exception:
        return None


def build_v1_closeout_readiness_manifest_v1() -> dict[str, Any]:
    ci_yml_text: str | None
    try:
        ci_yml_text = _CI_YML_PATH.read_text(encoding="utf-8") if _CI_YML_PATH.is_file() else None
    except OSError:
        ci_yml_text = None

    deferred = _deferred_blockers_v1()
    gates = _gate_rows(ci_yml_text=ci_yml_text)
    classification, cls_details = _release_classification_v1(gates=gates, deferred=deferred)

    cross_correlation = _prd_closeout_cross_correlation_safe()

    manifest_body: dict[str, Any] = {
        "format": "v1CloseoutReadinessManifest_v1",
        "schemaVersion": 1,
        "gates": gates,
        "deferredBlockers": deferred,
        "releaseClassification": classification,
        "releaseClassificationDetails": cls_details,
        "prdAdvisorMatrixSummary": _prd_advisor_summary_safe(),
        "prdCloseoutCrossCorrelationManifest_v1": cross_correlation,
        "agentNextActions": sorted(
            [
                "Do not claim v1 or workpackage done unless tracker Done Rule and evidence match.",
                "Run focused closeout pytest: test_seed_artifact_roundtrip.py, "
                "test_evidence_manifest_closure.py",
                "Read spec/workpackage-master-tracker.md before closing a backlog item.",
                "Use GET …/evidence-package field v1CloseoutReadinessManifest_v1 for gate rows; "
                "deferredBlockers are not completed work.",
            ]
        ),
    }

    canonical = json.dumps(manifest_body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**manifest_body, "manifestContentDigestSha256": digest}
