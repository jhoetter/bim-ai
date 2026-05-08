"""SKB-15 — recursive refine loop (formal agent workflow).

After every phase commit, the agent runs a bounded iteration loop:

  1. commit phase bundle
  2. checkpoint() — render + compare to target (SKB-03)
  3. if delta > threshold:
        identify worst region
        emit 1-2 corrective updateElementProperty / moveWall* commands
  4. re-checkpoint
  5. cap at `max_iterations` per phase before escalating to assumption-log

This module is the deterministic _shape_ of that loop. It accepts
callables for `checkpoint` and `propose_correction` so the loop is
testable without actually wiring SKB-03 (Playwright) or an LLM.

Each iteration result is recorded so the evidence log carries the
agent's chain of reasoning.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any

from bim_ai.elements import SkbPhaseId


@dataclass(frozen=True)
class CheckpointResult:
    """One visual-checkpoint outcome (SKB-03 produces this shape)."""

    delta: float                               # 0.0 = identical to target, higher = worse
    threshold: float                           # acceptance threshold for this phase
    note: str = ""                             # free-form commentary

    @property
    def passed(self) -> bool:
        return self.delta <= self.threshold


@dataclass(frozen=True)
class CorrectionProposal:
    """Agent's proposal to fix the worst delta region."""

    commands: list[dict[str, Any]]             # 1-2 corrective commands
    rationale: str                             # why the agent thinks these will reduce the delta


@dataclass(frozen=True)
class RefineIteration:
    """One step of the loop, suitable for evidence-log serialisation."""

    iteration: int                             # 1-based
    checkpoint: CheckpointResult
    correction: CorrectionProposal | None      # None on the final iteration if accepted
    applied: bool = False                      # whether the correction was committed


@dataclass(frozen=True)
class RefineLoopOutcome:
    """Final state of the loop for one phase."""

    phase: SkbPhaseId
    iterations: list[RefineIteration] = field(default_factory=list)
    final_checkpoint: CheckpointResult | None = None
    converged: bool = False                    # delta ≤ threshold at exit
    escalated: bool = False                    # hit max iterations without converging

    def to_evidence_dict(self) -> dict:
        return {
            "phase": self.phase,
            "converged": self.converged,
            "escalated": self.escalated,
            "iterations": [
                {
                    "iteration": it.iteration,
                    "checkpoint": {
                        "delta": it.checkpoint.delta,
                        "threshold": it.checkpoint.threshold,
                        "passed": it.checkpoint.passed,
                        "note": it.checkpoint.note,
                    },
                    "correction": (
                        {
                            "commands": list(it.correction.commands),
                            "rationale": it.correction.rationale,
                            "applied": it.applied,
                        }
                        if it.correction is not None
                        else None
                    ),
                }
                for it in self.iterations
            ],
            "final_checkpoint": (
                {
                    "delta": self.final_checkpoint.delta,
                    "threshold": self.final_checkpoint.threshold,
                    "passed": self.final_checkpoint.passed,
                }
                if self.final_checkpoint is not None
                else None
            ),
        }


def run_refine_loop(
    *,
    phase: SkbPhaseId,
    checkpoint: Callable[[], CheckpointResult],
    propose_correction: Callable[[CheckpointResult], CorrectionProposal | None],
    apply_correction: Callable[[Iterable[dict[str, Any]]], bool],
    max_iterations: int = 5,
) -> RefineLoopOutcome:
    """Bounded refinement loop. Returns the full outcome.

    Args:
      checkpoint(): runs the visual checkpoint and returns delta/threshold
      propose_correction(checkpoint): returns the agent's next 1-2
        commands, or None to give up
      apply_correction(commands): applies the corrections; returns True
        on success, False on rejection
      max_iterations: hard cap (default 5)
    """
    iterations: list[RefineIteration] = []
    final = checkpoint()

    if final.passed:
        return RefineLoopOutcome(
            phase=phase,
            iterations=[RefineIteration(iteration=0, checkpoint=final, correction=None)],
            final_checkpoint=final,
            converged=True,
        )

    for i in range(1, max_iterations + 1):
        proposal = propose_correction(final)
        if proposal is None:
            iterations.append(
                RefineIteration(iteration=i, checkpoint=final, correction=None)
            )
            return RefineLoopOutcome(
                phase=phase,
                iterations=iterations,
                final_checkpoint=final,
                converged=False,
                escalated=True,
            )
        applied = apply_correction(proposal.commands)
        iterations.append(
            RefineIteration(
                iteration=i,
                checkpoint=final,
                correction=proposal,
                applied=applied,
            )
        )
        final = checkpoint()
        if final.passed:
            return RefineLoopOutcome(
                phase=phase,
                iterations=iterations,
                final_checkpoint=final,
                converged=True,
            )

    return RefineLoopOutcome(
        phase=phase,
        iterations=iterations,
        final_checkpoint=final,
        converged=False,
        escalated=True,
    )
