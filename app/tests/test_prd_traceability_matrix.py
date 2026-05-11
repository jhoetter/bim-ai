"""Cross-cutting traceability gate (formerly PRD-anchored).

Asserts that each curated requirement row maps to verification paths that still
exist in the repo. The row identifiers are referenced by
``app/bim_ai/prd_closeout_cross_correlation.py`` (`_ADVISOR_TO_TRACEABILITY_IDS`)
and the readiness manifest gate `pytest_prd_traceability_matrix`.

Originally this test also asserted that each row's "needle" string appeared
verbatim in the PRD markdown. The PRD has been retired in favour of the
workpackage tracker; the in-row ``description`` field documents what the row
covers without requiring an external anchor.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

_TRACEABILITY_ROWS: list[dict[str, object]] = [
    {
        "id": "phase_a_golden_bundle",
        "description": "Seed artifact contract for clean project-initiation bundles.",
        "paths": [
            "app/tests/test_seed_artifact_roundtrip.py",
            "spec/seed-artifacts.md",
            "scripts/create-seed-artifact.mjs",
        ],
    },
    {
        "id": "exchange_json_replay",
        "description": "JSON command bundle is the canonical internal replay format.",
        "paths": [
            "app/tests/test_seed_artifact_roundtrip.py",
            "app/tests/test_undo_replay_constraint.py",
        ],
    },
    {
        "id": "verification_golden_fixture",
        "description": "Golden fixture proves replay across kernel + CLI.",
        "paths": [
            "app/tests/test_golden_exchange_fixture.py",
        ],
    },
    {
        "id": "validation_sheets_advisory",
        "description": (
            "Sheets validation: missing titleblock, empty viewport, scale mismatch, "
            "crop clipping annotations."
        ),
        "paths": [
            "app/tests/test_constraints_sheet_documentation_advisory.py",
            "app/tests/test_constraints.py",
        ],
    },
    {
        "id": "ci_pytest_gate",
        "description": "Python unit tests for each command and regeneration rule run in CI.",
        "paths": [
            ".github/workflows/ci.yml",
        ],
    },
    {
        "id": "prd_blocking_advisor_matrix",
        "description": "Validation classes are catalogued in the advisor matrix module.",
        "paths": [
            "app/bim_ai/prd_blocking_advisor_matrix.py",
            "app/tests/test_prd_blocking_advisor_matrix.py",
        ],
    },
]


@pytest.mark.parametrize("row", _TRACEABILITY_ROWS, ids=lambda r: str(r["id"]))
def test_traceability_coverage_paths_exist(row: dict[str, object]) -> None:
    row_id = str(row["id"])
    paths = row["paths"]
    assert isinstance(paths, list) and paths, f"{row_id}: paths must be a non-empty list"

    rel_paths = [str(p) for p in paths]
    missing_paths = [rp for rp in rel_paths if not (REPO_ROOT / rp).exists()]
    if missing_paths:
        detail = "\n".join(f"  - missing path (relative to repo root): {p}" for p in missing_paths)
        pytest.fail(f"Traceability row {row_id!r}: coverage target missing.\n{detail}")
