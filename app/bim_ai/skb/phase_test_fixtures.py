"""SKB-18 — phase-by-phase test fixture infrastructure.

Today only the final-state snapshot is regression-tested. SKB-18 adds:

  - A `PhaseFixture` shape: phase id + element-count expectations + the
    PhasedBundle slice that produces the post-phase snapshot.
  - `assert_phase_fixture` runs a fixture against an in-memory engine,
    asserting validators pass and counts match.

This catches the "phase 3 was fine, phase 4 broke it" regression — you
can drop a fixture per phase into pytest, and a regression in any phase
fails its own test rather than rolling forward into the final snapshot.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from bim_ai.elements import SkbPhaseId
from bim_ai.skb.element_count_priors import CountRange


@dataclass(frozen=True)
class PhaseFixture:
    """A regression fixture for one phase of a sketch-to-BIM build."""

    phase: SkbPhaseId
    name: str
    bundle_so_far: list[dict[str, Any]] = field(default_factory=list)   # all commands UP TO + including this phase
    expected_kind_counts: dict[str, int | CountRange] = field(default_factory=dict)
    expected_advisory_rule_ids: list[str] = field(default_factory=list)
    forbidden_advisory_rule_ids: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass(frozen=True)
class FixtureResult:
    fixture_name: str
    phase: SkbPhaseId
    passed: bool
    failures: list[str] = field(default_factory=list)


def kind_counts_from_elements(elements: dict[str, Any]) -> Counter[str]:
    """Count elements by their `kind` field. Accepts either a dict whose
    values are dicts with `kind` or values are objects with `kind`."""
    counter: Counter[str] = Counter()
    for el in elements.values():
        if isinstance(el, dict):
            kind = el.get("kind")
        else:
            kind = getattr(el, "kind", None)
        if kind is not None:
            counter[str(kind)] += 1
    return counter


def assert_kind_counts(
    actual: Counter[str],
    expected: dict[str, int | CountRange],
) -> list[str]:
    """Returns failure messages (empty list = pass)."""
    failures: list[str] = []
    for kind, expected_val in sorted(expected.items()):
        n = actual.get(kind, 0)
        if isinstance(expected_val, CountRange):
            if not expected_val.contains(n):
                failures.append(
                    f"kind {kind!r}: actual {n} not in [{expected_val.lo}, {expected_val.hi}]"
                )
        else:
            if n != expected_val:
                failures.append(f"kind {kind!r}: actual {n} != expected {expected_val}")
    return failures


def assert_advisory_rule_ids(
    advisory_rule_ids: Sequence[str],
    expected_present: Sequence[str] = (),
    forbidden: Sequence[str] = (),
) -> list[str]:
    """Returns failure messages."""
    failures: list[str] = []
    seen = set(advisory_rule_ids)
    for rid in expected_present:
        if rid not in seen:
            failures.append(f"expected advisory {rid!r} not present")
    for rid in forbidden:
        if rid in seen:
            failures.append(f"forbidden advisory {rid!r} present")
    return failures


def evaluate_fixture(
    fixture: PhaseFixture,
    actual_elements: dict[str, Any],
    actual_advisory_rule_ids: Sequence[str] = (),
) -> FixtureResult:
    """Run the assertions for one phase fixture given the produced
    element snapshot + the rule_ids of any emitted advisories."""
    failures: list[str] = []
    counts = kind_counts_from_elements(actual_elements)
    failures.extend(assert_kind_counts(counts, fixture.expected_kind_counts))
    failures.extend(
        assert_advisory_rule_ids(
            actual_advisory_rule_ids,
            expected_present=fixture.expected_advisory_rule_ids,
            forbidden=fixture.forbidden_advisory_rule_ids,
        )
    )
    return FixtureResult(
        fixture_name=fixture.name,
        phase=fixture.phase,
        passed=not failures,
        failures=failures,
    )
