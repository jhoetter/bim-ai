"""SKT-04 — pairwise floor / slab overlap warning.

Authoring two overlapping floors on the same level emits a `floor_overlap`
advisory (severity warning, not blocking). Non-overlapping floors do not.
"""

from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.elements import FloorElem, LevelElem, Vec2Mm


def _square(x0: float, y0: float, side: float) -> list[Vec2Mm]:
    return [
        Vec2Mm(xMm=x0, yMm=y0),
        Vec2Mm(xMm=x0 + side, yMm=y0),
        Vec2Mm(xMm=x0 + side, yMm=y0 + side),
        Vec2Mm(xMm=x0, yMm=y0 + side),
    ]


def _floor(fid: str, level_id: str, boundary_mm: list[Vec2Mm]) -> FloorElem:
    return FloorElem(
        kind="floor",
        id=fid,
        name=fid,
        level_id=level_id,
        boundary_mm=boundary_mm,
        thickness_mm=220,
        structure_thickness_mm=140,
        finish_thickness_mm=0,
    )


def test_two_overlapping_floors_emit_advisory():
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    a = _floor("f-a", "lvl-1", _square(0, 0, 4000))
    # Square b overlaps a by a 1m × 1m corner (1 m² = 1_000_000 mm² ≫ 1 mm² threshold).
    b = _floor("f-b", "lvl-1", _square(3000, 3000, 4000))
    viols = evaluate({"lvl-1": lvl, "f-a": a, "f-b": b})
    overlap = [v for v in viols if v.rule_id == "floor_overlap"]
    assert overlap
    assert overlap[0].severity == "warning"
    assert sorted(overlap[0].element_ids) == ["f-a", "f-b"]


def test_non_overlapping_floors_no_advisory():
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    a = _floor("f-a", "lvl-1", _square(0, 0, 1000))
    b = _floor("f-b", "lvl-1", _square(5000, 5000, 1000))
    viols = evaluate({"lvl-1": lvl, "f-a": a, "f-b": b})
    assert not [v for v in viols if v.rule_id == "floor_overlap"]


def test_floors_on_different_levels_no_advisory():
    lvl1 = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    lvl2 = LevelElem(kind="level", id="lvl-2", name="01", elevationMm=3000)
    a = _floor("f-a", "lvl-1", _square(0, 0, 4000))
    b = _floor("f-b", "lvl-2", _square(0, 0, 4000))  # identical footprint, but different level
    viols = evaluate({"lvl-1": lvl1, "lvl-2": lvl2, "f-a": a, "f-b": b})
    assert not [v for v in viols if v.rule_id == "floor_overlap"]


def test_floor_overlap_l_shape_overlap():
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    # Concave L-shaped floor.
    l_shape = [
        Vec2Mm(xMm=0, yMm=0),
        Vec2Mm(xMm=2000, yMm=0),
        Vec2Mm(xMm=2000, yMm=1000),
        Vec2Mm(xMm=1000, yMm=1000),
        Vec2Mm(xMm=1000, yMm=2000),
        Vec2Mm(xMm=0, yMm=2000),
    ]
    a = _floor("f-a", "lvl-1", l_shape)
    # Square b overlaps the L's lower-left corner.
    b = _floor("f-b", "lvl-1", _square(-500, -500, 1000))
    viols = evaluate({"lvl-1": lvl, "f-a": a, "f-b": b})
    overlap = [v for v in viols if v.rule_id == "floor_overlap"]
    assert overlap
