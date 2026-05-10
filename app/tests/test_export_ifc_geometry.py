from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, Vec2Mm, WallElem
from bim_ai.export_ifc_geometry import (
    clamp,
    level_elevation_m,
    polygon_area_m2_xy_mm,
    polygon_perimeter_m_xy_mm,
    room_outline_mm,
    room_vertical_span_m,
    wall_local_to_world_m,
    xz_bounds_mm,
)


def test_polygon_metrics_and_bounds_are_deterministic() -> None:
    poly = [(0.0, 0.0), (4000.0, 0.0), (4000.0, 3000.0), (0.0, 3000.0)]

    assert clamp(12.0, 0.0, 10.0) == 10.0
    assert polygon_area_m2_xy_mm(poly) == 12.0
    assert polygon_perimeter_m_xy_mm(poly) == 14.0
    assert xz_bounds_mm(poly) == (2000.0, 1500.0, 4000.0, 3000.0)


def test_wall_local_to_world_matches_wall_axis_and_length() -> None:
    wall = WallElem(
        id="w-1",
        levelId="lvl-1",
        start=Vec2Mm(xMm=1000, yMm=2000),
        end=Vec2Mm(xMm=4000, yMm=6000),
    )

    mat, length_m = wall_local_to_world_m(wall, 3.5)

    assert length_m == pytest.approx(5.0)
    assert mat[0, 0] == pytest.approx(0.6)
    assert mat[1, 0] == pytest.approx(0.8)
    assert mat[0, 3] == pytest.approx(1.0)
    assert mat[1, 3] == pytest.approx(2.0)
    assert mat[2, 3] == pytest.approx(3.5)


def test_level_and_room_vertical_span_helpers() -> None:
    room = RoomElem(
        id="r-1",
        levelId="lvl-1",
        upperLimitLevelId="lvl-2",
        volumeCeilingOffsetMm=500,
        outlineMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=1000, yMm=0),
            Vec2Mm(xMm=1000, yMm=1000),
        ],
    )
    doc = Document(
        elements={
            "lvl-1": LevelElem(id="lvl-1", elevationMm=0),
            "lvl-2": LevelElem(id="lvl-2", elevationMm=3200),
            room.id: room,
        }
    )

    assert level_elevation_m(doc, "lvl-2") == 3.2
    assert room_outline_mm(room) == [(0.0, 0.0), (1000.0, 0.0), (1000.0, 1000.0)]
    assert room_vertical_span_m(doc, room, 0.0) == (0.0, 2.7)
