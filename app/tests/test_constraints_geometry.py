from __future__ import annotations

import pytest

from bim_ai.constraints import _polygon_overlap_area_mm2
from bim_ai.constraints_geometry import (
    ear_clip_triangulate,
    polygon_area_abs_mm2,
    polygon_bbox,
    polygon_overlap_area_mm2,
    polygon_signed_area,
)


def test_polygon_area_bbox_and_orientation() -> None:
    square = [(0.0, 0.0), (2000.0, 0.0), (2000.0, 1000.0), (0.0, 1000.0)]

    assert polygon_area_abs_mm2(square) == 2_000_000.0
    assert polygon_signed_area(square) == 2_000_000.0
    assert polygon_signed_area(list(reversed(square))) == -2_000_000.0
    assert polygon_bbox(square) == (0.0, 0.0, 2000.0, 1000.0)


def test_concave_polygon_triangulation_preserves_area() -> None:
    concave = [
        (0.0, 0.0),
        (3000.0, 0.0),
        (3000.0, 1000.0),
        (1000.0, 1000.0),
        (1000.0, 3000.0),
        (0.0, 3000.0),
    ]

    triangles = ear_clip_triangulate(concave)
    triangle_area = sum(polygon_area_abs_mm2([*tri]) for tri in triangles)

    assert len(triangles) == 4
    assert triangle_area == pytest.approx(polygon_area_abs_mm2(concave))


def test_polygon_overlap_area_handles_rectangles_and_legacy_alias() -> None:
    a = [(0.0, 0.0), (2000.0, 0.0), (2000.0, 2000.0), (0.0, 2000.0)]
    b = [(1000.0, 1000.0), (3000.0, 1000.0), (3000.0, 3000.0), (1000.0, 3000.0)]

    assert polygon_overlap_area_mm2(a, b) == pytest.approx(1_000_000.0)
    assert _polygon_overlap_area_mm2(a, b) == pytest.approx(1_000_000.0)
    assert (
        polygon_overlap_area_mm2(a, [(3000.0, 3000.0), (4000.0, 3000.0), (4000.0, 4000.0)]) == 0.0
    )
