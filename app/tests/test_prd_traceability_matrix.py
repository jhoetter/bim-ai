"""Cross-cutting PRD→coverage traceability gate (Prompt 9 slice).

Reads ``spec/prd/revit-production-parity-ai-agent-prd.md`` as the requirements source of truth.
Fails CI when curated PRD anchors disappear or mapped verification artifacts are removed.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PRD_PATH = REPO_ROOT / "spec" / "prd" / "revit-production-parity-ai-agent-prd.md"

_TRACEABILITY_ROWS: list[dict[str, object]] = [
    {
        "id": "phase_a_golden_bundle",
        "needles": [
            "Build golden command bundle for reference two-storey house.",
        ],
        "paths": [
            "app/tests/test_one_family_bundle_roundtrip.py",
            "packages/cli/lib/one-family-home-commands.mjs",
        ],
    },
    {
        "id": "exchange_json_replay",
        "needles": [
            "JSON command bundle: canonical internal replay.",
        ],
        "paths": [
            "app/tests/test_one_family_bundle_roundtrip.py",
            "app/tests/test_undo_replay_constraint.py",
        ],
    },
    {
        "id": "verification_golden_fixture",
        "needles": [
            "Golden fixture proves replay.",
        ],
        "paths": [
            "app/tests/test_golden_exchange_fixture.py",
        ],
    },
    {
        "id": "validation_sheets_advisory",
        "needles": [
            "Sheets: missing titleblock, empty viewport, scale mismatch, crop clipping annotations.",
        ],
        "paths": [
            "app/tests/test_constraints_sheet_documentation_advisory.py",
            "app/tests/test_constraints.py",
        ],
    },
    {
        "id": "ci_pytest_gate",
        "needles": [
            "Python unit tests for each command and regeneration rule.",
        ],
        "paths": [
            ".github/workflows/ci.yml",
        ],
    },
    {
        "id": "prd_blocking_advisor_matrix",
        "needles": [
            "Validation classes:",
        ],
        "paths": [
            "app/bim_ai/prd_blocking_advisor_matrix.py",
            "app/tests/test_prd_blocking_advisor_matrix.py",
        ],
    },
]


@pytest.fixture(scope="module")
def prd_text() -> str:
    if not PRD_PATH.is_file():
        pytest.fail(f"PRD missing at expected path: {PRD_PATH}")
    return PRD_PATH.read_text(encoding="utf-8")


@pytest.mark.parametrize("row", _TRACEABILITY_ROWS, ids=lambda r: str(r["id"]))
def test_prd_anchor_and_coverage_paths_exist(prd_text: str, row: dict[str, object]) -> None:
    row_id = str(row["id"])
    needles = row["needles"]
    paths = row["paths"]
    assert isinstance(needles, list) and needles, f"{row_id}: needles must be a non-empty list"
    assert isinstance(paths, list) and paths, f"{row_id}: paths must be a non-empty list"

    missing_needles = [n for n in needles if isinstance(n, str) and n not in prd_text]
    if missing_needles:
        detail = "\n".join(f"  - missing substring: {n!r}" for n in missing_needles)
        pytest.fail(
            f"PRD traceability row {row_id!r}: anchor text not found in {PRD_PATH}.\n"
            f"Update the PRD or adjust mappings in this test in the same change-set.\n"
            f"{detail}"
        )

    rel_paths = [str(p) for p in paths]
    missing_paths = [rp for rp in rel_paths if not (REPO_ROOT / rp).exists()]
    if missing_paths:
        detail = "\n".join(f"  - missing path (relative to repo root): {p}" for p in missing_paths)
        pytest.fail(f"PRD traceability row {row_id!r}: coverage target missing.\n{detail}")
