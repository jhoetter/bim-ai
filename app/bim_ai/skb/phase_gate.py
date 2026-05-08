"""SKB-10 — per-phase visual-verification gate.

Wires SKB-03 into per-phase commits: when a `PhasedBundle` carries
`expected_silhouette_png` metadata for a phase, the gate runs the
visual checkpoint after committing that phase and either:

  - rejects the commit (severity 'error') when the score is far below
    threshold, OR
  - downgrades to advisory (severity 'warning') when within slack.

The actual `try_commit_bundle` integration is a thin caller; this
module owns the gate's data shape + decision logic so it's testable
without the engine.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from bim_ai.elements import SkbPhaseId
from bim_ai.skb.visual_checkpoint import CheckpointReport

GateOutcomeKind = Literal["pass", "advisory", "reject"]


@dataclass(frozen=True)
class PhaseGateConfig:
    """Per-phase configuration for the visual gate."""

    threshold: float                     # SKB-03 normalised delta threshold for hard pass
    slack: float = 0.05                  # additional tolerance before reject
    block_on_fail: bool = False          # default: emit advisory rather than reject

    @property
    def reject_threshold(self) -> float:
        return self.threshold + self.slack


@dataclass(frozen=True)
class PhaseGateOutcome:
    phase: SkbPhaseId
    kind: GateOutcomeKind
    delta: float
    threshold: float
    reject_threshold: float
    message: str
    report: CheckpointReport | None = None

    def to_advisory_dict(self) -> dict | None:
        """Returns a `phase_visual_gate_v1` advisory dict when not 'pass'."""
        if self.kind == "pass":
            return None
        return {
            "rule_id": "phase_visual_gate_v1",
            "severity": "error" if self.kind == "reject" else "warning",
            "phase": self.phase,
            "delta": self.delta,
            "threshold": self.threshold,
            "reject_threshold": self.reject_threshold,
            "message": self.message,
        }


def evaluate_gate(
    phase: SkbPhaseId,
    report: CheckpointReport,
    config: PhaseGateConfig,
) -> PhaseGateOutcome:
    """Decide pass / advisory / reject given a checkpoint report."""
    delta = report.overall_delta_normalised
    if delta <= config.threshold:
        return PhaseGateOutcome(
            phase=phase,
            kind="pass",
            delta=delta,
            threshold=config.threshold,
            reject_threshold=config.reject_threshold,
            message=f"phase {phase!r} visual delta {delta:.4f} ≤ threshold {config.threshold:.4f}",
            report=report,
        )
    if delta <= config.reject_threshold:
        return PhaseGateOutcome(
            phase=phase,
            kind="advisory",
            delta=delta,
            threshold=config.threshold,
            reject_threshold=config.reject_threshold,
            message=(
                f"phase {phase!r} visual delta {delta:.4f} above threshold "
                f"{config.threshold:.4f} but within slack — proceeding with warning"
            ),
            report=report,
        )
    if not config.block_on_fail:
        return PhaseGateOutcome(
            phase=phase,
            kind="advisory",
            delta=delta,
            threshold=config.threshold,
            reject_threshold=config.reject_threshold,
            message=(
                f"phase {phase!r} visual delta {delta:.4f} exceeds reject threshold "
                f"{config.reject_threshold:.4f}; block_on_fail=False → emit advisory only"
            ),
            report=report,
        )
    return PhaseGateOutcome(
        phase=phase,
        kind="reject",
        delta=delta,
        threshold=config.threshold,
        reject_threshold=config.reject_threshold,
        message=(
            f"phase {phase!r} visual delta {delta:.4f} > reject threshold "
            f"{config.reject_threshold:.4f} — phase commit rejected"
        ),
        report=report,
    )


def gate_phase_commit(
    *,
    phase: SkbPhaseId,
    config: PhaseGateConfig,
    run_checkpoint: Callable[[], CheckpointReport],
) -> PhaseGateOutcome:
    """High-level entry: caller (try_commit_bundle wrapper) provides a
    `run_checkpoint()` callable; gate evaluates the report.
    """
    report = run_checkpoint()
    return evaluate_gate(phase=phase, report=report, config=config)
