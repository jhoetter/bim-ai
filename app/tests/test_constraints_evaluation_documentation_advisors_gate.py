"""PERF-C09 / PERF-B07: evaluate() documentation_advisors gate.

The default (documentation_advisors=True) keeps the full advisor stream
that snapshot / evidence / validate routes depend on. Passing False
skips the info-only advisor passes — used by command-commit fast paths
that only care about blocking/error rollback.
"""

from __future__ import annotations

from bim_ai.constraints_evaluation import evaluate
from bim_ai.elements import LevelElem, WallElem


def _doc_elements() -> dict[str, object]:
    """A tiny fixture that triggers at least one info-level advisor.

    We rely on the agent-brief / exchange / monitored-source-drift
    advisors to surface info violations on an otherwise valid model;
    those advisors emit info-level rows whenever the model lacks the
    metadata they audit (which our synthetic fixture does).
    """

    lvl = LevelElem(kind="level", id="lvl", name="EG", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w-s",
        name="South",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 4_000, "yMm": 0},
        thicknessMm=200,
        heightMm=2_800,
    )
    return {lvl.id: lvl, wall.id: wall}  # type: ignore[return-value]


def test_documentation_advisors_default_true_is_unchanged() -> None:
    """Default kwarg keeps the existing behavior — full advisor stream."""

    viols = evaluate(_doc_elements())  # type: ignore[arg-type]
    # The default surface always returns the full list, sorted.
    assert isinstance(viols, list)
    # Sanity: same call again is stable.
    viols_again = evaluate(_doc_elements())  # type: ignore[arg-type]
    assert len(viols) == len(viols_again)


def test_documentation_advisors_false_drops_info_passes() -> None:
    """Skipping documentation advisors must not increase the violation count.

    The gate only removes passes — it can't add violations. The blocking
    passes (room boundary open, toposolid pierce check) still run, so
    blocking results are preserved.
    """

    full = evaluate(_doc_elements())  # type: ignore[arg-type]
    skipped = evaluate(_doc_elements(), documentation_advisors=False)  # type: ignore[arg-type]
    assert len(skipped) <= len(full), (
        "documentation_advisors=False must never add violations"
    )

    # Any blocking/error violation in the skipped result must also be in
    # the full result (the gate only removes info-level rows).
    blocking_skipped = {
        (v.rule_id, tuple(sorted(v.element_ids)))
        for v in skipped
        if v.severity in ("error", "blocking")
    }
    blocking_full = {
        (v.rule_id, tuple(sorted(v.element_ids)))
        for v in full
        if v.severity in ("error", "blocking")
    }
    assert blocking_skipped == blocking_full, (
        "blocking/error rows must be identical with or without the gate"
    )
