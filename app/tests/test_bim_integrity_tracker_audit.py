"""Smoke tests for BIM integrity tracker completion accounting."""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT = REPO_ROOT / "scripts" / "audit-bim-integrity-tracker.mjs"
REPORT = REPO_ROOT / "spec" / "generated" / "bim-integrity-tracker-status.md"


def test_bim_integrity_tracker_audit_report_is_current() -> None:
    result = subprocess.run(
        ["node", str(SCRIPT), "--check"],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr + result.stdout


def test_bim_integrity_tracker_audit_report_has_core_accounting_sections() -> None:
    report = REPORT.read_text(encoding="utf8")

    assert "## Overall" in report
    assert "## By Priority" in report
    assert "## By Tracker Section" in report
    assert "## By Milestone / Wave Mapping" in report
    assert "## Wave 7 Feature Coverage Dashboard Data" in report
    assert "## Implementation Evidence Accounting" in report
    assert "Done quality gate passed" in report
    assert "| BIR-T through BIR-W |" in report
    assert "Duplicate ids: 0" in report
    assert "Invalid rows / missing wave references: 0" in report


def test_done_quality_gate_rejects_missing_implementation_evidence(tmp_path: Path) -> None:
    tracker = REPO_ROOT / "spec" / "bim-integrity-rendering-sketch-methodology-tracker.md"
    broken_tracker = tmp_path / "tracker.md"
    generated = tmp_path / "generated.md"
    source = tracker.read_text(encoding="utf8")
    source = source.replace(
        "| `BIR-W05` | `scripts/audit-bim-integrity-tracker.mjs` | `app/tests/test_bim_integrity_tracker_audit.py` | `spec/generated/bim-integrity-tracker-status.md` | Wave 7 Worker E local commit | Gate covers `Done` tracker status; it does not certify `Partial` rows. |\n",
        "",
    )
    broken_tracker.write_text(source, encoding="utf8")

    result = subprocess.run(
        [
            "node",
            str(SCRIPT),
            "--tracker",
            str(broken_tracker),
            "--out",
            str(generated),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    assert "BIR-W05" in result.stderr
    assert "Done item lacks implementation evidence row with tests" in result.stderr
