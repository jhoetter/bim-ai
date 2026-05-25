"""Issue #111 — visible exposed Fachwerk (half-timbering) on facade.

Tests the parametric `FachwerkPattern` overlay schema and its
`fachwerk_pattern` carrier field on `WallElem`. Geometric authoring of
per-Ständer / per-Riegel timber is deferred to a follow-up — the v0
contract pinned here is:

  • `WallElem.fachwerk_pattern` defaults to `None` (no overlay).
  • A pattern can be authored with sensible defaults (1.5 m post spacing,
    140 mm timber posts, sill / top-plate bands).
  • Mid-rail heights are stored sorted and deduplicated.
  • Diagonal mode accepts only the documented Strebe directions.
  • Camel-case aliases round-trip (matches the TS schema in
    packages/core/src/index.ts).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from bim_ai.elements.walls import FachwerkPattern, WallElem


def make_wall(**overrides: object) -> WallElem:
    payload: dict[str, object] = {
        "id": "wall-1",
        "levelId": "lvl-1",
        "start": {"x_mm": 0, "y_mm": 0},
        "end": {"x_mm": 6000, "y_mm": 0},
        "thicknessMm": 300,
        "heightMm": 3000,
        "materialKey": "brick_red",
    }
    payload.update(overrides)
    return WallElem.model_validate(payload)


def test_wall_fachwerk_pattern_defaults_to_none() -> None:
    wall = make_wall()
    assert wall.fachwerk_pattern is None


def test_fachwerk_pattern_default_values() -> None:
    fp = FachwerkPattern()
    assert fp.post_spacing_mm == 1500.0
    assert fp.post_width_mm == 140.0
    assert fp.rail_height_mm == 140.0
    assert fp.sill_height_mm == 200.0
    assert fp.top_plate_height_mm == 200.0
    assert fp.mid_rail_heights_mm == []
    assert fp.diagonals_per_panel == "none"
    assert fp.diagonal_width_mm == 120.0
    assert fp.timber_material_key == "timber_dark_oak"
    assert fp.proud_mm == 10.0


def test_fachwerk_pattern_round_trips_via_camel_case_alias() -> None:
    payload = {
        "postSpacingMm": 1200,
        "postWidthMm": 160,
        "railHeightMm": 150,
        "sillHeightMm": 220,
        "topPlateHeightMm": 220,
        "midRailHeightsMm": [1500.0, 2400.0],
        "diagonalsPerPanel": "andreas_kreuz",
        "diagonalWidthMm": 110,
        "timberMaterialKey": "timber_dark_oak",
        "proudMm": 12,
    }
    fp = FachwerkPattern.model_validate(payload)
    assert fp.post_spacing_mm == 1200
    assert fp.diagonals_per_panel == "andreas_kreuz"
    # Dumped JSON uses the alias so it lines up with the TS schema / web wire.
    dumped = fp.model_dump(by_alias=True)
    assert dumped["postSpacingMm"] == 1200
    assert dumped["diagonalsPerPanel"] == "andreas_kreuz"
    assert dumped["midRailHeightsMm"] == [1500.0, 2400.0]


def test_fachwerk_pattern_mid_rails_sort_and_dedupe() -> None:
    fp = FachwerkPattern.model_validate({"midRailHeightsMm": [2400, 1500, 1500, 800]})
    assert fp.mid_rail_heights_mm == [800.0, 1500.0, 2400.0]


def test_fachwerk_pattern_rejects_negative_mid_rail() -> None:
    with pytest.raises(ValidationError):
        FachwerkPattern.model_validate({"midRailHeightsMm": [-10]})


def test_fachwerk_pattern_rejects_unknown_diagonal_mode() -> None:
    with pytest.raises(ValidationError):
        FachwerkPattern.model_validate({"diagonalsPerPanel": "spiderweb"})


def test_fachwerk_pattern_rejects_zero_post_spacing() -> None:
    with pytest.raises(ValidationError):
        FachwerkPattern.model_validate({"postSpacingMm": 0})


def test_wall_fachwerk_pattern_attaches_via_camel_alias() -> None:
    wall = make_wall(
        fachwerkPattern={
            "postSpacingMm": 1500,
            "diagonalsPerPanel": "vee",
            "midRailHeightsMm": [1500],
        }
    )
    assert wall.fachwerk_pattern is not None
    assert wall.fachwerk_pattern.post_spacing_mm == 1500
    assert wall.fachwerk_pattern.diagonals_per_panel == "vee"
    assert wall.fachwerk_pattern.mid_rail_heights_mm == [1500.0]


def test_wall_fachwerk_pattern_round_trips_via_alias_dump() -> None:
    wall = make_wall(fachwerkPattern={"diagonalsPerPanel": "left"})
    dumped = wall.model_dump(by_alias=True)
    assert "fachwerkPattern" in dumped
    assert dumped["fachwerkPattern"]["diagonalsPerPanel"] == "left"
