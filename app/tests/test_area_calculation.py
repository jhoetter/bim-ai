"""KRN-08: area_calculation rule-set tests (gross / net / no_rules)."""

from __future__ import annotations

import pytest

from bim_ai.area_calculation import compute_area_sq_mm, recompute_all_areas
from bim_ai.elements import AreaElem, FloorElem, LevelElem, SlabOpeningElem, Vec2Mm


def _v(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _porch_area(rule: str) -> AreaElem:
    return AreaElem(
        kind="area",
        id="a1",
        name="Porch",
        levelId="lvl_g",
        boundaryMm=[
            _v(0, 0),
            _v(4000, 0),
            _v(4000, 5000),
            _v(0, 5000),
        ],
        ruleSet=rule,
    )


def _shaft_inside_porch() -> SlabOpeningElem:
    # 1m × 1m shaft tucked inside the porch boundary.
    return SlabOpeningElem(
        kind="slab_opening",
        id="shaft1",
        name="Shaft",
        hostFloorId="floor1",
        boundaryMm=[
            _v(1000, 1000),
            _v(2000, 1000),
            _v(2000, 2000),
            _v(1000, 2000),
        ],
        isShaft=True,
    )


def test_gross_returns_polygon_area() -> None:
    a = _porch_area("gross")
    elements: dict = {"a1": a}
    assert compute_area_sq_mm(a, elements) == pytest.approx(20_000_000.0)


def test_no_rules_returns_polygon_area() -> None:
    a = _porch_area("no_rules")
    elements: dict = {"a1": a}
    assert compute_area_sq_mm(a, elements) == pytest.approx(20_000_000.0)


def test_net_subtracts_contained_shaft() -> None:
    a = _porch_area("net")
    shaft = _shaft_inside_porch()
    floor = FloorElem(
        kind="floor",
        id="floor1",
        name="Floor",
        levelId="lvl_g",
        boundaryMm=[_v(0, 0), _v(4000, 0), _v(4000, 5000), _v(0, 5000)],
        thicknessMm=200,
    )
    elements: dict = {"a1": a, "floor1": floor, "shaft1": shaft}
    # 4m × 5m gross = 20_000_000 sq mm. Shaft 1m × 1m = 1_000_000 sq mm.
    # Net = 19_000_000 sq mm.
    assert compute_area_sq_mm(a, elements) == pytest.approx(19_000_000.0)


def test_net_ignores_shafts_outside_polygon() -> None:
    a = _porch_area("net")
    shaft = SlabOpeningElem(
        kind="slab_opening",
        id="outside",
        name="Outside shaft",
        hostFloorId="floor1",
        boundaryMm=[
            _v(10_000, 10_000),
            _v(11_000, 10_000),
            _v(11_000, 11_000),
            _v(10_000, 11_000),
        ],
    )
    elements: dict = {"a1": a, "outside": shaft}
    assert compute_area_sq_mm(a, elements) == pytest.approx(20_000_000.0)


def test_net_with_no_shafts_equals_gross() -> None:
    a = _porch_area("net")
    elements: dict = {"a1": a}
    assert compute_area_sq_mm(a, elements) == pytest.approx(20_000_000.0)


def test_recompute_all_areas_writes_back_in_place() -> None:
    a = _porch_area("gross")
    elements: dict = {"a1": a}
    recompute_all_areas(elements)
    refreshed = elements["a1"]
    assert isinstance(refreshed, AreaElem)
    assert refreshed.computed_area_sq_mm == pytest.approx(20_000_000.0)


def test_recompute_handles_no_areas() -> None:
    lvl = LevelElem(kind="level", id="lvl_g", name="Ground", elevation_mm=0)
    elements: dict = {"lvl_g": lvl}
    recompute_all_areas(elements)
    assert elements == {"lvl_g": lvl}
