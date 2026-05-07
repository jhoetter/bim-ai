"""Tests for SKB-08 phase + sketch anchor on AgentAssumptionElem."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from bim_ai.elements import AgentAssumptionElem


def test_assumption_accepts_phase_id() -> None:
    a = AgentAssumptionElem(
        id="a1",
        statement="Ridge height inferred from gable proportion.",
        phaseId="massing",  # type: ignore[call-arg]
    )
    assert a.phase_id == "massing"


def test_assumption_phase_id_optional_for_legacy() -> None:
    a = AgentAssumptionElem(id="a2", statement="legacy assumption with no phase")
    assert a.phase_id is None
    assert a.sketch_anchor_mm is None


def test_assumption_rejects_invalid_phase() -> None:
    with pytest.raises(ValidationError):
        AgentAssumptionElem(
            id="a3",
            statement="bad phase",
            phaseId="not_a_real_phase",  # type: ignore[call-arg]
        )


def test_assumption_accepts_sketch_anchor() -> None:
    a = AgentAssumptionElem(
        id="a4",
        statement="South facade right-of-center door",
        phaseId="openings",  # type: ignore[call-arg]
        sketchAnchorMm={"panel": "front-elev", "xPx": 482, "yPx": 720},  # type: ignore[call-arg]
    )
    assert a.sketch_anchor_mm == {"panel": "front-elev", "xPx": 482, "yPx": 720}


def test_assumption_round_trips_via_alias() -> None:
    a = AgentAssumptionElem(
        id="a5",
        statement="x",
        phaseId="envelope",  # type: ignore[call-arg]
        sketchAnchorMm={"polygon": "south-recessed-back-wall"},  # type: ignore[call-arg]
    )
    out = a.model_dump(by_alias=True)
    assert out["phaseId"] == "envelope"
    assert out["sketchAnchorMm"] == {"polygon": "south-recessed-back-wall"}
