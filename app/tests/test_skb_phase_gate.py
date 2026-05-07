"""Tests for SKB-10 per-phase visual-verification gate."""

from __future__ import annotations

from bim_ai.skb.phase_gate import (
    PhaseGateConfig,
    evaluate_gate,
    gate_phase_commit,
)
from bim_ai.skb.visual_checkpoint import CheckpointReport


def _report(delta: float) -> CheckpointReport:
    return CheckpointReport(
        actual_png="actual.png",
        target_png="target.png",
        overall_delta_normalised=delta,
        threshold=0.05,
    )


def test_pass_when_delta_below_threshold() -> None:
    cfg = PhaseGateConfig(threshold=0.1, slack=0.05)
    out = evaluate_gate("massing", _report(0.05), cfg)
    assert out.kind == "pass"
    assert out.to_advisory_dict() is None


def test_advisory_within_slack() -> None:
    cfg = PhaseGateConfig(threshold=0.1, slack=0.05)
    out = evaluate_gate("envelope", _report(0.13), cfg)
    assert out.kind == "advisory"
    d = out.to_advisory_dict()
    assert d is not None
    assert d["severity"] == "warning"
    assert d["rule_id"] == "phase_visual_gate_v1"


def test_reject_when_block_on_fail_true() -> None:
    cfg = PhaseGateConfig(threshold=0.1, slack=0.05, block_on_fail=True)
    out = evaluate_gate("openings", _report(0.5), cfg)
    assert out.kind == "reject"
    d = out.to_advisory_dict()
    assert d is not None
    assert d["severity"] == "error"


def test_advisory_when_block_on_fail_false_even_if_far_over() -> None:
    cfg = PhaseGateConfig(threshold=0.1, slack=0.05, block_on_fail=False)
    out = evaluate_gate("interior", _report(0.5), cfg)
    assert out.kind == "advisory"


def test_gate_phase_commit_orchestrates() -> None:
    cfg = PhaseGateConfig(threshold=0.1, slack=0.05)
    out = gate_phase_commit(
        phase="skeleton",
        config=cfg,
        run_checkpoint=lambda: _report(0.04),
    )
    assert out.kind == "pass"
    assert out.delta == 0.04


def test_outcome_carries_report() -> None:
    cfg = PhaseGateConfig(threshold=0.1)
    rpt = _report(0.05)
    out = evaluate_gate("massing", rpt, cfg)
    assert out.report is rpt
