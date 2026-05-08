"""Tests for SKB-02 mass element kind (load-bearing slice)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from bim_ai.elements import MassElem


def test_mass_creates_with_required_fields() -> None:
    m = MassElem(
        id="m1",
        name="Main mass",
        levelId="lvl-ground",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 5000, "yMm": 0},
            {"xMm": 5000, "yMm": 8000},
            {"xMm": 0, "yMm": 8000},
        ],
        heightMm=6000,
    )
    assert m.kind == "mass"
    assert m.height_mm == 6000
    assert len(m.footprint_mm) == 4


def test_mass_requires_positive_height() -> None:
    with pytest.raises(ValidationError):
        MassElem(
            id="m1",
            levelId="lvl-1",
            footprintMm=[{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}, {"xMm": 1000, "yMm": 1000}],
            heightMm=0,
        )


def test_mass_default_phase_is_massing() -> None:
    m = MassElem(
        id="m1",
        levelId="lvl-1",
        footprintMm=[{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}, {"xMm": 1000, "yMm": 1000}],
    )
    assert m.phase_id == "massing"


def test_mass_round_trips_via_alias() -> None:
    m = MassElem(
        id="m1",
        levelId="lvl-1",
        footprintMm=[{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}, {"xMm": 1000, "yMm": 1000}],
        rotationDeg=15.0,
        materialKey="render_white",
    )
    out = m.model_dump(by_alias=True)
    assert out["kind"] == "mass"
    assert out["levelId"] == "lvl-1"
    assert out["footprintMm"][0] == {"xMm": 0, "yMm": 0}
    assert out["rotationDeg"] == 15.0
    assert out["materialKey"] == "render_white"
    assert out["phaseId"] == "massing"


def test_mass_can_be_validated_via_pydantic_discriminated_union() -> None:
    """Round-trip via TypeAdapter to confirm `mass` is in the discriminated
    union so snapshot deserialisation will accept it."""
    from pydantic import TypeAdapter

    from bim_ai.elements import Element

    adapter = TypeAdapter(Element)
    payload = {
        "kind": "mass",
        "id": "m1",
        "name": "Demo mass",
        "levelId": "lvl-1",
        "footprintMm": [
            {"xMm": 0, "yMm": 0},
            {"xMm": 1000, "yMm": 0},
            {"xMm": 1000, "yMm": 1000},
        ],
        "heightMm": 3000,
    }
    el = adapter.validate_python(payload)
    assert el.kind == "mass"
