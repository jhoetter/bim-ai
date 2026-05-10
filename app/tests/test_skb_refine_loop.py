"""Tests for SKB-15 recursive refine loop."""

from __future__ import annotations

from bim_ai.skb.refine_loop import (
    CheckpointResult,
    CorrectionProposal,
    RefineLoopOutcome,
    run_refine_loop,
)


def test_passes_first_checkpoint_returns_converged() -> None:
    cps = iter([CheckpointResult(delta=0.05, threshold=0.1)])
    out = run_refine_loop(
        phase="massing",
        checkpoint=lambda: next(cps),
        propose_correction=lambda _: None,
        apply_correction=lambda cmds: True,
    )
    assert out.converged
    assert not out.escalated
    assert out.final_checkpoint is not None
    assert out.final_checkpoint.passed
    assert len(out.iterations) == 1


def test_iterates_until_converges() -> None:
    deltas = iter([0.5, 0.3, 0.05])  # third call passes

    def cps():
        return CheckpointResult(delta=next(deltas), threshold=0.1)

    def proposals(_cp):
        return CorrectionProposal(commands=[{"type": "noop"}], rationale="reduce delta")

    out = run_refine_loop(
        phase="envelope",
        checkpoint=cps,
        propose_correction=proposals,
        apply_correction=lambda cmds: True,
        max_iterations=5,
    )
    assert out.converged
    assert len(out.iterations) == 2  # 2 corrective iterations until 3rd checkpoint passes


def test_escalates_after_max_iterations() -> None:
    def cps():
        return CheckpointResult(delta=0.5, threshold=0.1)

    def proposals(_cp):
        return CorrectionProposal(commands=[{"type": "noop"}], rationale="x")

    out = run_refine_loop(
        phase="skeleton",
        checkpoint=cps,
        propose_correction=proposals,
        apply_correction=lambda cmds: True,
        max_iterations=3,
    )
    assert not out.converged
    assert out.escalated
    assert len(out.iterations) == 3


def test_giving_up_proposal_escalates() -> None:
    def cps():
        return CheckpointResult(delta=0.5, threshold=0.1)

    out = run_refine_loop(
        phase="openings",
        checkpoint=cps,
        propose_correction=lambda _cp: None,  # immediately gives up
        apply_correction=lambda cmds: True,
    )
    assert not out.converged
    assert out.escalated
    assert len(out.iterations) == 1


def test_outcome_serialises_to_evidence_dict() -> None:
    out = RefineLoopOutcome(
        phase="massing",
        iterations=[],
        final_checkpoint=CheckpointResult(
            delta=0.05,
            threshold=0.1,
            advisor_findings=[
                {
                    "code": "room_target_area_mismatch",
                    "elementIds": ["hf-room-bath"],
                }
            ],
        ),
        converged=True,
    )
    d = out.to_evidence_dict()
    assert d["phase"] == "massing"
    assert d["converged"] is True
    assert d["final_checkpoint"]["passed"] is True
    assert d["final_checkpoint"]["advisor_findings"] == [
        {
            "code": "room_target_area_mismatch",
            "elementIds": ["hf-room-bath"],
        }
    ]


def test_apply_correction_failure_recorded() -> None:
    deltas = iter([0.5, 0.5, 0.05])

    def cps():
        return CheckpointResult(delta=next(deltas), threshold=0.1)

    def proposals(_cp):
        return CorrectionProposal(commands=[{"type": "noop"}], rationale="x")

    out = run_refine_loop(
        phase="detail",
        checkpoint=cps,
        propose_correction=proposals,
        apply_correction=lambda cmds: False,  # always rejects
    )
    # Loop continues even if apply fails — eventually converges via 3rd checkpoint
    assert out.converged
    assert all(not it.applied for it in out.iterations)


def test_advisor_findings_are_available_to_correction_proposal() -> None:
    checkpoints = iter(
        [
            CheckpointResult(
                delta=0.5,
                threshold=0.1,
                advisor_findings=[
                    {
                        "code": "stair_comfort_eu_proxy",
                        "elementIds": ["hf-stair-main"],
                    }
                ],
            ),
            CheckpointResult(delta=0.05, threshold=0.1),
        ]
    )
    seen_codes: list[str] = []

    def proposals(cp: CheckpointResult) -> CorrectionProposal:
        seen_codes.extend(f["code"] for f in cp.advisor_findings)
        return CorrectionProposal(commands=[{"type": "noop"}], rationale="fix advisor finding")

    out = run_refine_loop(
        phase="interior",
        checkpoint=lambda: next(checkpoints),
        propose_correction=proposals,
        apply_correction=lambda cmds: True,
    )
    assert out.converged
    assert seen_codes == ["stair_comfort_eu_proxy"]
    assert out.iterations[0].checkpoint.advisor_findings == [
        {
            "code": "stair_comfort_eu_proxy",
            "elementIds": ["hf-stair-main"],
        }
    ]
