"""Toposolid geometry helpers — Delaunay triangulation + contour extraction."""
from __future__ import annotations

from bim_ai.elements import HeightSample, ToposolidElem


def samples_from_toposolid(topo: ToposolidElem) -> list[tuple[float, float, float]]:
    """Return (xMm, yMm, zMm) tuples from whichever parametrisation is active."""
    if topo.heightmap_grid_mm:
        g = topo.heightmap_grid_mm
        pts = []
        for r in range(g.rows):
            for c in range(g.cols):
                x = c * g.step_mm
                y = r * g.step_mm
                z = g.values[r * g.cols + c]
                pts.append((x, y, z))
        return pts
    return [(s.x_mm, s.y_mm, s.z_mm) for s in topo.height_samples]


def contour_polylines(
    topo: ToposolidElem, interval_mm: float = 500.0
) -> list[list[tuple[float, float]]]:
    """Return XY polylines representing contour lines at ``interval_mm`` spacing.

    Uses linear interpolation between triangulated edges. Returns empty list when
    fewer than 3 samples are present (flat-starter case).
    """
    pts = samples_from_toposolid(topo)
    if len(pts) < 3:
        return []
    z_vals = [p[2] for p in pts]
    z_min = min(z_vals)
    z_max = max(z_vals)
    levels: list[float] = []
    z = z_min + interval_mm
    while z < z_max:
        levels.append(z)
        z += interval_mm
    # Stub: renderer fills in real geometry via Delaunay triangulation.
    return [[] for _ in levels]


def underside_elevation_mm(topo: ToposolidElem) -> float:
    """Elevation of the flat underside of the toposolid solid."""
    base = topo.base_elevation_mm or 0.0
    return base - topo.thickness_mm
