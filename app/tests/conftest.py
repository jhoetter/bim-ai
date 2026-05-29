"""Shared pytest hooks.

PERF-C05 added a process-level LRU cache for room-boundary derivation
keyed on `(revision, len(elements), sorted(element ids))`, and PERF-C06
layered a per-level slice cache on top keyed on
`(level_id, level_element_fingerprint, settings_digest)`. Tests that
construct documents with overlapping fingerprints (same revision, same
element set, different monkey-patched globals or different model
contents from a previous test) can hit a stale cache entry in either
layer. `reset_room_boundary_doc_cache` clears both, so each
`compute_room_boundary_derivation` call runs against the document the
test built.

TEST-CQ-10: per-file coverage gates. coverage.py 7.x does not yet
support per-file `fail_under`, so we enforce the floors ourselves at
`pytest_sessionfinish` time by reading the `.coverage` data file
that pytest-cov has already written. Failures are reported with the
offending file + observed % and force a non-zero exit. See
`spec/trackers/code-quality-debt-tracker.md` § TEST-CQ-10.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from bim_ai.room_derivation import reset_room_boundary_doc_cache

# Files held to per-file coverage floors, per TEST-CQ-10. Paths are
# package-relative (i.e. relative to `app/`), matching what
# coverage.py records in the data file.
PER_FILE_COVERAGE_FLOORS: dict[str, float] = {
    "bim_ai/versioning.py": 85.0,
    "bim_ai/skb/calibrator.py": 80.0,
    "bim_ai/skb/colour_sampler.py": 80.0,
    "bim_ai/tkn/diff.py": 80.0,
    "bim_ai/site/toposolid.py": 85.0,
}

# Env opt-out so adhoc test invocations (e.g. running a single test
# file with `-k`) don't tank the run on artificially low coverage.
# CI sets nothing → enforcement is on by default. Set
# `BIM_AI_SKIP_PER_FILE_COVERAGE_GATE=1` locally to skip.
_SKIP_ENV = "BIM_AI_SKIP_PER_FILE_COVERAGE_GATE"

# Marker used by the synthetic gate-failure test (see
# tests/test_per_file_coverage_gate.py). When set, the post-run
# hook injects a synthetic low coverage observation for one of
# the gated files and exercises the failure path without
# requiring an actual code drop.
_FORCE_FAILURE_ENV = "BIM_AI_PER_FILE_COVERAGE_GATE_FORCE_FAILURE"


@pytest.fixture(autouse=True)
def _reset_room_boundary_doc_cache() -> None:
    reset_room_boundary_doc_cache()


def _compute_per_file_coverage_violations(
    floors: dict[str, float],
    *,
    coverage_data_file: Path,
    app_root: Path,
    force_failure: str | None = None,
) -> list[tuple[str, float, float]]:
    """Return [(rel_path, observed_pct, floor_pct), ...] for files below floor.

    Uses the same coverage.py API pytest-cov uses, so the numbers
    line up with what `--cov-report=term-missing` already printed.
    `force_failure` (used by the synthetic gate-failure test)
    pretends the named file came in at 0.0% — the violation list
    then exercises the same reporting path real drops would.
    """
    try:
        import coverage  # noqa: PLC0415 — lazy: only needed when run under coverage.
    except ImportError:  # pragma: no cover — coverage is a dev-only dep.
        return []

    if not coverage_data_file.exists():
        # No coverage data → either we ran with --no-cov or the
        # session crashed before writing the file. Either way, the
        # global gate will already have flagged it; bail.
        return []

    cov = coverage.Coverage(data_file=str(coverage_data_file))
    cov.load()
    data = cov.get_data()

    # measured_files() returns absolute paths; normalise to the
    # package-relative paths the floor table is keyed on.
    measured_by_rel: dict[str, str] = {}
    for abs_path in data.measured_files():
        try:
            rel = Path(abs_path).resolve().relative_to(app_root).as_posix()
        except ValueError:
            continue
        measured_by_rel[rel] = abs_path

    violations: list[tuple[str, float, float]] = []
    for rel_path, floor in floors.items():
        abs_path = measured_by_rel.get(rel_path)
        if abs_path is None:
            # File wasn't imported during the test run — that is a
            # gate failure (the gated module is hot-path, it should
            # be touched by the suite).
            violations.append((rel_path, 0.0, floor))
            continue

        analysis = cov.analysis2(abs_path)
        # analysis2 → (filename, statements, excluded, missing, missing_formatted).
        statements = analysis[1]
        missing = analysis[3]
        if not statements:
            observed = 100.0
        else:
            covered = len(statements) - len(missing)
            observed = (covered / len(statements)) * 100.0

        if force_failure == rel_path:
            observed = 0.0

        if observed + 1e-6 < floor:
            violations.append((rel_path, observed, floor))

    return violations


def pytest_terminal_summary(terminalreporter, exitstatus: int, config) -> None:
    """Enforce per-file coverage floors (TEST-CQ-10).

    Runs after pytest-cov has written the `.coverage` data file
    and after its own terminal report. If any gated file is below
    its floor, we print a clear violation block and bump the
    session exit status to a non-zero value so CI catches it.
    """
    if os.environ.get(_SKIP_ENV):
        return

    # When `-m integration` (or another marker that skips the unit
    # lane) is the only thing running, the coverage numbers are
    # artificially low because most of the codebase isn't touched.
    # Detect that and skip — the gate is for the default unit lane.
    markexpr = getattr(config.option, "markexpr", "") or ""
    if "integration" in markexpr and "not integration" not in markexpr:
        return

    app_root = Path(__file__).resolve().parent.parent
    coverage_data_file = app_root / ".coverage"

    violations = _compute_per_file_coverage_violations(
        PER_FILE_COVERAGE_FLOORS,
        coverage_data_file=coverage_data_file,
        app_root=app_root,
        force_failure=os.environ.get(_FORCE_FAILURE_ENV),
    )

    if not violations:
        terminalreporter.write_sep(
            "=",
            "TEST-CQ-10: per-file coverage gates green",
            green=True,
        )
        return

    terminalreporter.write_sep(
        "=",
        "TEST-CQ-10: per-file coverage gate FAILED",
        red=True,
    )
    for rel_path, observed, floor in violations:
        terminalreporter.write_line(
            f"  {rel_path}: observed {observed:.2f}% < floor {floor:.2f}%",
            red=True,
        )
    terminalreporter.write_line(
        "  See spec/trackers/code-quality-debt-tracker.md § TEST-CQ-10.",
    )

    # Force the suite red. pytest-cov already does this via
    # --cov-fail-under for the global floor; we mirror that for
    # per-file gates.
    config._per_file_coverage_failed = True  # noqa: SLF001
    if exitstatus == 0:
        # pytest reads session.exitstatus to compute the final
        # process exit code. Setting it here is the supported
        # idiom (see pytest-cov's own --cov-fail-under handler).
        terminalreporter._session.exitstatus = 1  # noqa: SLF001


def pytest_sessionfinish(session, exitstatus: int) -> None:
    """Mirror the gate decision onto the session exit code.

    pytest_terminal_summary runs late enough that pytest's own
    session.exitstatus is already set; we set it there. This hook
    is a belt-and-braces guard in case the terminal summary path
    didn't run (e.g. --no-summary).
    """
    config = session.config
    if getattr(config, "_per_file_coverage_failed", False) and exitstatus == 0:
        session.exitstatus = 1
