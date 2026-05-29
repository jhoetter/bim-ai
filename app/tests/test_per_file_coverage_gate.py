"""TEST-CQ-10 — per-file coverage gate self-test.

Verifies that the conftest-level per-file coverage floors actually
fire when a covered file drops below its threshold. The strategy:

  1. Build a synthetic `.coverage` data file in a `tmp_path` with
     controlled line counts (we control how many lines were
     "executed" out of how many "exist"), then ask the helper to
     compute violations. This lets us exercise both the green path
     (coverage above floor) and the red path (file dropped below
     floor) without depending on the *live* `.coverage` file that
     pytest-cov writes mid-session.
  2. End-to-end subprocess test: spawn a pytest run with the
     synthetic-failure env var set and confirm the gate fires red.

Together these prove the gate fails when a covered file drops below
its floor (the TEST-CQ-10 acceptance criterion).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import coverage
import pytest

from tests.conftest import (  # type: ignore[import-not-found]
    PER_FILE_COVERAGE_FLOORS,
    _compute_per_file_coverage_violations,
)

APP_ROOT = Path(__file__).resolve().parent.parent


def _build_synthetic_coverage(
    data_file: Path,
    *,
    file_observations: dict[str, tuple[int, int]],
) -> None:
    """Write a `.coverage` file with controlled per-file numbers.

    `file_observations` maps an *absolute file path* to
    `(total_lines, covered_lines)`. We synthesise contexts/arcs as
    line-number sets — coverage.py's `analysis2` then reports
    `len(statements) - len(missing)` covered out of `len(statements)`,
    matching our gate helper's math.
    """
    cov_data = coverage.CoverageData(basename=str(data_file))
    line_data: dict[str, list[int]] = {}
    file_tracers: dict[str, str] = {}
    for abs_path, (_total, covered) in file_observations.items():
        # Lines 1..covered are "hit", lines covered+1.._total exist
        # but weren't executed. coverage.CoverageData.add_lines
        # records the set of executed line numbers; analysis2 uses
        # the AST of the file on disk to determine the universe of
        # statements, so the test fixtures must be real .py files
        # whose AST has at least `_total` statement-bearing lines.
        line_data[abs_path] = list(range(1, covered + 1)) if covered > 0 else []
        file_tracers[abs_path] = ""
    cov_data.add_lines(line_data)
    if file_tracers:
        cov_data.add_file_tracers(file_tracers)
    cov_data.write()


def test_floors_cover_the_files_named_in_the_tracker() -> None:
    """Floors table mirrors spec/trackers/code-quality-debt-tracker.md."""
    assert PER_FILE_COVERAGE_FLOORS == {
        "bim_ai/versioning.py": 85.0,
        "bim_ai/skb/calibrator.py": 80.0,
        "bim_ai/skb/colour_sampler.py": 80.0,
        "bim_ai/tkn/diff.py": 80.0,
        "bim_ai/site/toposolid.py": 85.0,
    }


def test_violation_helper_reports_dropped_file(tmp_path: Path) -> None:
    """Gate fires red when a gated file drops below its floor.

    Build a synthetic `.coverage` where `bim_ai/versioning.py` was
    measured but only at 10%, simulating a regression. The gate
    helper must include it in the violation list.
    """
    versioning_abs = APP_ROOT / "bim_ai" / "versioning.py"
    if not versioning_abs.exists():
        pytest.skip("versioning.py not present — sanity guard")

    # Read the file to learn its real statement count, then
    # synthesise "only 10% covered" by reporting the first ~10% of
    # statement lines as executed.
    cov_probe = coverage.Coverage()
    cov_probe.start()
    cov_probe.stop()
    _, statements, _, _, _ = cov_probe.analysis2(str(versioning_abs))
    if not statements:
        pytest.skip("versioning.py has no statements per coverage analysis")

    total = len(statements)
    # Hit the first 10% of statement-bearing lines.
    covered = max(1, total // 10)
    executed_lines = sorted(statements)[:covered]

    data_file = tmp_path / ".coverage"
    cov_data = coverage.CoverageData(basename=str(data_file))
    cov_data.add_lines({str(versioning_abs): executed_lines})
    cov_data.write()

    floors = {"bim_ai/versioning.py": 85.0}
    violations = _compute_per_file_coverage_violations(
        floors,
        coverage_data_file=data_file,
        app_root=APP_ROOT,
    )

    assert len(violations) == 1, f"expected 1 violation, got {violations}"
    rel_path, observed, floor = violations[0]
    assert rel_path == "bim_ai/versioning.py"
    assert observed < 85.0
    assert floor == 85.0


def test_violation_helper_passes_when_file_is_above_floor(tmp_path: Path) -> None:
    """Gate stays green when a gated file's coverage is well above its floor."""
    versioning_abs = APP_ROOT / "bim_ai" / "versioning.py"
    if not versioning_abs.exists():
        pytest.skip("versioning.py not present — sanity guard")

    cov_probe = coverage.Coverage()
    cov_probe.start()
    cov_probe.stop()
    _, statements, _, _, _ = cov_probe.analysis2(str(versioning_abs))
    if not statements:
        pytest.skip("versioning.py has no statements per coverage analysis")

    # Hit 99% of statement-bearing lines — well above 85%.
    total = len(statements)
    covered = max(1, int(total * 0.99))
    executed_lines = sorted(statements)[:covered]

    data_file = tmp_path / ".coverage"
    cov_data = coverage.CoverageData(basename=str(data_file))
    cov_data.add_lines({str(versioning_abs): executed_lines})
    cov_data.write()

    floors = {"bim_ai/versioning.py": 85.0}
    violations = _compute_per_file_coverage_violations(
        floors,
        coverage_data_file=data_file,
        app_root=APP_ROOT,
    )

    assert violations == [], f"expected no violations, got {violations}"


def test_violation_helper_flags_missing_files(tmp_path: Path) -> None:
    """A gated file with zero observations counts as a 0% violation.

    Catches the case where a refactor accidentally drops a hot-path
    module from the import graph that the suite exercises.
    """
    data_file = tmp_path / ".coverage"
    # Empty coverage data — no files measured.
    cov_data = coverage.CoverageData(basename=str(data_file))
    cov_data.add_lines({})
    cov_data.write()

    floors = {"bim_ai/versioning.py": 85.0}
    violations = _compute_per_file_coverage_violations(
        floors,
        coverage_data_file=data_file,
        app_root=APP_ROOT,
    )

    assert len(violations) == 1
    rel_path, observed, floor = violations[0]
    assert rel_path == "bim_ai/versioning.py"
    assert observed == 0.0
    assert floor == 85.0


def test_forced_failure_subprocess_exits_nonzero() -> None:
    """End-to-end gate fires red when a covered file drops.

    Run a single trivial test under `pytest` with the synthetic
    failure env var set and confirm the gate brings the process to
    a non-zero exit even though no real test failed. This is the
    PR-body evidence that the gate actually wires through to the
    process exit code.
    """
    env = os.environ.copy()
    # Make sure the subprocess does NOT inherit a SKIP env from the
    # parent test driver (we set it on the outer test runner to
    # avoid recursive gate failures), otherwise the gate would
    # silently no-op inside the subprocess too.
    env.pop("BIM_AI_SKIP_PER_FILE_COVERAGE_GATE", None)
    env["BIM_AI_PER_FILE_COVERAGE_GATE_FORCE_FAILURE"] = "bim_ai/versioning.py"

    # Run only this one self-test file with a minimal addopts so we
    # don't recurse / re-trigger the synthetic gate failure on the
    # outer process. We override --cov-fail-under to 0 so that the
    # *global* floor doesn't fire first and mask the per-file gate.
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_per_file_coverage_gate.py::test_floors_cover_the_files_named_in_the_tracker",
            "-q",
            "--cov=bim_ai",
            "--cov-fail-under=0",
            "--no-header",
        ],
        cwd=str(APP_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )

    combined = proc.stdout + proc.stderr
    assert "TEST-CQ-10: per-file coverage gate FAILED" in combined, (
        f"expected failure banner in output, got:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert "bim_ai/versioning.py" in combined, (
        f"expected gated file name in output, got:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert proc.returncode != 0, (
        f"expected non-zero exit code, got {proc.returncode}\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
