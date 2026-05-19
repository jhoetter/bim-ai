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
    assert "Duplicate ids: 0" in report
    assert "Invalid rows / missing wave references: 0" in report
