"""MF-modeling-3a (#56) — RoofElem.edge_overhang_mm per-edge cantilever overrides.

The single scalar ``overhang_mm`` field cannot represent asymmetric cantilevers
(terraces, entry canopies). ``edge_overhang_mm`` adds an optional per-cardinal
override map; missing keys fall back to the scalar; back-compat is preserved
when the map is absent.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from bim_ai.elements import RoofElem

_RECT_FP = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 6000, "yMm": 0},
    {"xMm": 6000, "yMm": 4000},
    {"xMm": 0, "yMm": 4000},
]


def _roof(**overrides: object) -> RoofElem:
    base = dict(
        id="r-cantilever",
        name="Roof",
        referenceLevelId="lvl",
        footprintMm=_RECT_FP,
        overhangMm=400,
    )
    base.update(overrides)
    return RoofElem.model_validate(base)


def test_back_compat_when_edge_overhang_omitted() -> None:
    roof = _roof()
    assert roof.edge_overhang_mm is None
    assert roof.overhang_mm == 400


def test_accepts_full_cardinal_map() -> None:
    roof = _roof(edgeOverhangMm={"n": 300, "e": 2500, "s": 300, "w": 300})
    assert roof.edge_overhang_mm is not None
    assert roof.edge_overhang_mm["e"] == 2500
    # Round-trip via alias-aware dump preserves the camelCase key.
    payload = roof.model_dump(by_alias=True)
    assert payload["edgeOverhangMm"] == {"n": 300, "e": 2500, "s": 300, "w": 300}


def test_accepts_partial_cardinal_map() -> None:
    """Only the east edge is overridden — the others should fall back to the scalar."""
    roof = _roof(edgeOverhangMm={"e": 2500})
    assert roof.edge_overhang_mm is not None
    assert set(roof.edge_overhang_mm.keys()) == {"e"}
    assert roof.edge_overhang_mm["e"] == 2500
    # The scalar is still the source-of-truth for unspecified edges.
    assert roof.overhang_mm == 400


def test_rejects_unknown_cardinal_key() -> None:
    with pytest.raises(ValidationError):
        _roof(edgeOverhangMm={"northeast": 1000})


def test_all_edges_equal_is_equivalent_to_scalar() -> None:
    """When every cardinal key is set to the scalar value, the per-edge map is
    observably equivalent to the scalar (renderer/exporter parity)."""
    scalar = _roof(overhangMm=400)
    per_edge = _roof(
        overhangMm=400,
        edgeOverhangMm={"n": 400, "e": 400, "s": 400, "w": 400},
    )
    # Same scalar fallback, fully-specified map at the same value.
    assert scalar.overhang_mm == per_edge.overhang_mm
    assert per_edge.edge_overhang_mm == {"n": 400, "e": 400, "s": 400, "w": 400}


def test_snake_case_field_name_also_accepted() -> None:
    """Pydantic ``populate_by_name`` is enabled — both alias and field name work."""
    roof = _roof(edge_overhang_mm={"e": 2500})
    assert roof.edge_overhang_mm == {"e": 2500}


def test_zero_overhang_on_specific_edge_is_distinct_from_unset() -> None:
    """An explicit 0 for an edge must override the scalar (e.g. flush eave on
    the gable end while keeping a deep overhang on the rake)."""
    roof = _roof(overhangMm=400, edgeOverhangMm={"n": 0, "s": 0})
    assert roof.edge_overhang_mm == {"n": 0, "s": 0}
    assert roof.overhang_mm == 400
