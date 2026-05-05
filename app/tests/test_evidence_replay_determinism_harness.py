"""Replay-stability harness tests — determinism across all evidence manifest emitters."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    LevelElem,
    PlanViewElem,
    SectionCutElem,
    SheetElem,
    Vec2Mm,
    Vec3Mm,
    ViewpointElem,
)
from bim_ai.evidence_replay_determinism_harness import (
    EmitterRef,
    enumerate_evidence_emitters_v1,
    run_replay_stability_pass_v1,
)


def _seeded_doc() -> Document:
    """Representative document exercising all evidence manifest emitters."""
    camera = CameraMm(
        position=Vec3Mm(xMm=0.0, yMm=0.0, zMm=5000.0),
        target=Vec3Mm(xMm=0.0, yMm=0.0, zMm=0.0),
        up=Vec3Mm(xMm=0.0, yMm=1.0, zMm=0.0),
    )
    return Document(
        revision=1,
        elements={
            "lv1": LevelElem(kind="level", id="lv1", name="Level 1", elevationMm=0.0),
            "pv1": PlanViewElem(kind="plan_view", id="pv1", name="Level 1 Plan", levelId="lv1"),
            "sh1": SheetElem(kind="sheet", id="sh1", name="Sheet A"),
            "vp1": ViewpointElem(kind="viewpoint", id="vp1", name="3D View", mode="orbit_3d", camera=camera),
            "sc1": SectionCutElem(
                kind="section_cut",
                id="sc1",
                name="Section 1",
                lineStartMm=Vec2Mm(xMm=0.0, yMm=0.0),
                lineEndMm=Vec2Mm(xMm=5000.0, yMm=0.0),
            ),
        },
    )


def test_all_emitters_stable_on_seeded_doc() -> None:
    """Every discovered emitter produces byte-identical JSON on two consecutive runs."""
    doc = _seeded_doc()
    result = run_replay_stability_pass_v1(doc)
    harness = result["replayStabilityHarness_v1"]
    assert harness["unstableEmitters"] == [], f"Unstable emitters: {harness['unstableEmitters']}"
    for key, row in result["emitters"].items():
        assert row["stable"] is True, f"Emitter {key!r} not stable"


def test_harness_aggregate_digest_stable_across_two_runs() -> None:
    """The aggregate harness digest is itself identical across two full passes."""
    doc = _seeded_doc()
    r1 = run_replay_stability_pass_v1(doc)
    r2 = run_replay_stability_pass_v1(doc)
    d1 = r1["replayStabilityHarness_v1"]["digest"]
    d2 = r2["replayStabilityHarness_v1"]["digest"]
    assert d1 == d2, "Aggregate harness digest differs between runs"


def test_unstable_emitter_surfaces_clearly() -> None:
    """A deliberately unstable stub surfaces in unstableEmitters; real emitters stay clean."""
    counter = [0]

    def _unstable_stub(doc: Document) -> Any:
        counter[0] += 1
        return {"nonce": counter[0]}

    real_emitters = enumerate_evidence_emitters_v1()
    patched = list(real_emitters) + [EmitterRef("_test_unstable_stub", _unstable_stub)]

    doc = _seeded_doc()
    result = run_replay_stability_pass_v1(doc, emitters=patched)

    harness = result["replayStabilityHarness_v1"]
    assert "_test_unstable_stub" in harness["unstableEmitters"], (
        "Unstable stub not reported in unstableEmitters"
    )
    assert result["emitters"]["_test_unstable_stub"]["stable"] is False

    for ref in real_emitters:
        assert result["emitters"][ref.manifest_key]["stable"] is True, (
            f"Real emitter {ref.manifest_key!r} should remain stable"
        )


def test_enumerate_returns_alphabetized_manifest_keys() -> None:
    """enumerate_evidence_emitters_v1 returns keys in alphabetical order."""
    emitters = enumerate_evidence_emitters_v1()
    keys = [e.manifest_key for e in emitters]
    assert keys == sorted(keys), f"Keys not alphabetized: {keys}"


def test_emitter_count_matches_harness_token() -> None:
    """replayStabilityHarness_v1.emitterCount matches len(enumerate_evidence_emitters_v1())."""
    doc = _seeded_doc()
    result = run_replay_stability_pass_v1(doc)
    expected_count = len(enumerate_evidence_emitters_v1())
    assert result["replayStabilityHarness_v1"]["emitterCount"] == expected_count
