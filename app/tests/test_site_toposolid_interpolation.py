"""TEST-CQ-05 — coverage tests for ``bim_ai.site.toposolid``.

Target lines 34-43 (terrain-elevation interpolation in
``contour_polylines``) plus the heightmap-grid path of
``samples_from_toposolid`` and ``underside_elevation_mm``. The tracker
calls out:

* triangulation on three collinear samples,
* monotonic ridge interpolation,
* point-outside-hull fallback.

The current implementation is a v0 stub: the contour-line geometry is
filled in by the renderer, so ``contour_polylines`` returns one empty
polyline-list per generated z-level. These tests therefore pin the
*levels* produced (which is the part that actually exists) rather than
the stub polyline geometry — a future renderer that materialises real
contour segments will not regress these assertions because the *count*
of contour levels is contractually stable.
"""

from __future__ import annotations

from bim_ai.element_primitives import Vec2Mm
from bim_ai.elements import ToposolidElem
from bim_ai.elements.site import HeightmapGrid, HeightSample
from bim_ai.site.toposolid import (
    contour_polylines,
    samples_from_toposolid,
    underside_elevation_mm,
)


def _boundary_square(size_mm: float = 10_000.0) -> list[Vec2Mm]:
    """Tiny closed square used as filler for ``boundary_mm`` — geometry
    helpers under test ignore the boundary, but ``ToposolidElem`` requires
    one."""
    return [
        Vec2Mm(x_mm=0.0, y_mm=0.0),
        Vec2Mm(x_mm=size_mm, y_mm=0.0),
        Vec2Mm(x_mm=size_mm, y_mm=size_mm),
        Vec2Mm(x_mm=0.0, y_mm=size_mm),
    ]


def _topo_from_samples(samples: list[HeightSample]) -> ToposolidElem:
    return ToposolidElem(
        id="topo_t",
        boundaryMm=_boundary_square(),
        heightSamples=samples,
    )


def _topo_from_grid(grid: HeightmapGrid) -> ToposolidElem:
    return ToposolidElem(
        id="topo_t",
        boundaryMm=_boundary_square(),
        heightmapGridMm=grid,
    )


# ---------------------------------------------------------------------------
# samples_from_toposolid
# ---------------------------------------------------------------------------


def test_samples_from_toposolid_heightmap_grid_path() -> None:
    """Heightmap-grid parametrisation emits (col*step, row*step, z) tuples
    in row-major order — this exercises the ``if topo.heightmap_grid_mm``
    branch (lines 10-19)."""
    grid = HeightmapGrid(
        stepMm=1_000.0,
        rows=2,
        cols=3,
        values=[0.0, 100.0, 200.0, 300.0, 400.0, 500.0],
    )
    topo = _topo_from_grid(grid)

    pts = samples_from_toposolid(topo)

    assert pts == [
        (0.0, 0.0, 0.0),
        (1_000.0, 0.0, 100.0),
        (2_000.0, 0.0, 200.0),
        (0.0, 1_000.0, 300.0),
        (1_000.0, 1_000.0, 400.0),
        (2_000.0, 1_000.0, 500.0),
    ]


def test_samples_from_toposolid_height_samples_path() -> None:
    """When no heightmap grid is set, the irregular ``heightSamples`` list
    is returned verbatim (line 20)."""
    samples = [
        HeightSample(xMm=0.0, yMm=0.0, zMm=10.0),
        HeightSample(xMm=5_000.0, yMm=0.0, zMm=20.0),
        HeightSample(xMm=2_500.0, yMm=4_330.0, zMm=15.0),
    ]
    topo = _topo_from_samples(samples)

    pts = samples_from_toposolid(topo)

    assert pts == [
        (0.0, 0.0, 10.0),
        (5_000.0, 0.0, 20.0),
        (2_500.0, 4_330.0, 15.0),
    ]


# ---------------------------------------------------------------------------
# contour_polylines — lines 31-43
# ---------------------------------------------------------------------------


def test_contour_polylines_returns_empty_for_fewer_than_three_samples() -> None:
    """Flat-starter case: <3 samples short-circuits to ``[]`` (line 32-33)."""
    topo = _topo_from_samples(
        [
            HeightSample(xMm=0.0, yMm=0.0, zMm=0.0),
            HeightSample(xMm=1_000.0, yMm=0.0, zMm=500.0),
        ]
    )

    assert contour_polylines(topo) == []


def test_contour_polylines_three_collinear_samples_generates_levels() -> None:
    """Three collinear samples spanning 0..2000 mm at the default 500 mm
    interval produce contour levels strictly between min and max — the
    canonical TEST-CQ-05 'triangulation on three collinear samples' case.

    Default interval 500 mm, z range [0, 2000] → levels at 500, 1000, 1500
    (2000 is excluded because the loop uses ``z < z_max``)."""
    topo = _topo_from_samples(
        [
            HeightSample(xMm=0.0, yMm=0.0, zMm=0.0),
            HeightSample(xMm=1_000.0, yMm=0.0, zMm=1_000.0),
            HeightSample(xMm=2_000.0, yMm=0.0, zMm=2_000.0),
        ]
    )

    polylines = contour_polylines(topo)

    # one empty polyline list per generated level — the geometry itself
    # is filled in by the renderer stub
    assert len(polylines) == 3
    assert all(p == [] for p in polylines)


def test_contour_polylines_monotonic_ridge_interpolation() -> None:
    """Monotonic ridge: z rises linearly across a 4-point line. With
    interval 250 mm and range [0, 1000], levels = 250, 500, 750."""
    topo = _topo_from_samples(
        [
            HeightSample(xMm=0.0, yMm=0.0, zMm=0.0),
            HeightSample(xMm=1_000.0, yMm=0.0, zMm=250.0),
            HeightSample(xMm=2_000.0, yMm=0.0, zMm=750.0),
            HeightSample(xMm=3_000.0, yMm=0.0, zMm=1_000.0),
        ]
    )

    polylines = contour_polylines(topo, interval_mm=250.0)

    assert len(polylines) == 3


def test_contour_polylines_flat_terrain_produces_no_levels() -> None:
    """All samples at the same z (z_min == z_max) — point-outside-hull
    style fallback: the ``while z < z_max`` loop never executes (line 39),
    so no levels are emitted even though ``len(pts) >= 3``."""
    topo = _topo_from_samples(
        [
            HeightSample(xMm=0.0, yMm=0.0, zMm=2_500.0),
            HeightSample(xMm=1_000.0, yMm=0.0, zMm=2_500.0),
            HeightSample(xMm=500.0, yMm=1_000.0, zMm=2_500.0),
        ]
    )

    assert contour_polylines(topo) == []


def test_contour_polylines_interval_larger_than_range_produces_no_levels() -> None:
    """When ``interval_mm`` exceeds the (z_max - z_min) span, the very
    first computed ``z = z_min + interval`` is already ``>= z_max`` so
    the level list stays empty — covers the immediate-exit branch of
    line 39."""
    topo = _topo_from_samples(
        [
            HeightSample(xMm=0.0, yMm=0.0, zMm=0.0),
            HeightSample(xMm=1_000.0, yMm=0.0, zMm=100.0),
            HeightSample(xMm=500.0, yMm=1_000.0, zMm=200.0),
        ]
    )

    # range is 200 mm, interval 500 mm → no contour level fits strictly
    # inside (z_min, z_max)
    assert contour_polylines(topo, interval_mm=500.0) == []


def test_contour_polylines_from_heightmap_grid_uses_grid_z_values() -> None:
    """End-to-end: a heightmap grid feeds ``samples_from_toposolid``
    (heightmap branch), which feeds ``contour_polylines``. The z range
    [0, 600] at interval 200 mm produces levels at 200 and 400."""
    grid = HeightmapGrid(
        stepMm=1_000.0,
        rows=2,
        cols=2,
        values=[0.0, 200.0, 400.0, 600.0],
    )
    topo = _topo_from_grid(grid)

    polylines = contour_polylines(topo, interval_mm=200.0)

    assert len(polylines) == 2


# ---------------------------------------------------------------------------
# underside_elevation_mm — lines 46-49
# ---------------------------------------------------------------------------


def test_underside_elevation_mm_with_explicit_base_elevation() -> None:
    """``base_elevation_mm`` provided → underside = base - thickness."""
    topo = ToposolidElem(
        id="topo_t",
        boundaryMm=_boundary_square(),
        heightSamples=[HeightSample(xMm=0.0, yMm=0.0, zMm=0.0)],
        thicknessMm=1_500.0,
        baseElevationMm=10_000.0,
    )

    assert underside_elevation_mm(topo) == 10_000.0 - 1_500.0


def test_underside_elevation_mm_defaults_base_to_zero() -> None:
    """``base_elevation_mm`` None → underside = 0 - thickness."""
    topo = ToposolidElem(
        id="topo_t",
        boundaryMm=_boundary_square(),
        heightSamples=[HeightSample(xMm=0.0, yMm=0.0, zMm=0.0)],
        thicknessMm=800.0,
    )

    assert underside_elevation_mm(topo) == -800.0
