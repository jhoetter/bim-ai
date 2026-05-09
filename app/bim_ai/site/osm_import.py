"""OSM-V3-01 — fetch + parse Overpass-API building footprints into NeighborhoodMassElem."""
from __future__ import annotations

import math
from typing import Any

import httpx  # already in deps; use sync client

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_HEIGHT_MM = 8000.0
LEVELS_TO_MM = 3000.0


def fetch_buildings(lat: float, lon: float, radius_m: float = 200.0) -> list[dict]:
    """Return raw Overpass API elements for buildings within radius_m of lat/lon."""
    query = f"""
    [out:json][timeout:25];
    (way["building"](around:{radius_m},{lat},{lon});
     relation["building"](around:{radius_m},{lat},{lon}););
    out body; >; out skel qt;
    """
    resp = httpx.post(OVERPASS_URL, data={"data": query}, timeout=30)
    resp.raise_for_status()
    return resp.json().get("elements", [])


def _parse_height(tags: dict) -> float:
    if "building:height" in tags:
        try:
            return float(tags["building:height"].rstrip("m ")) * 1000
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            return float(tags["building:levels"]) * LEVELS_TO_MM
        except ValueError:
            pass
    return DEFAULT_HEIGHT_MM


def latlon_to_mm(
    lat: float, lon: float, origin_lat: float, origin_lon: float
) -> tuple[float, float]:
    """Project lat/lon to mm relative to project origin using equirectangular approx."""
    R = 6_371_000_000  # mm
    x_mm = R * math.radians(lon - origin_lon) * math.cos(math.radians(origin_lat))
    y_mm = R * math.radians(lat - origin_lat)
    return x_mm, y_mm


def douglas_peucker(
    pts: list[tuple[float, float]], epsilon: float = 500.0
) -> list[tuple[float, float]]:
    """Simplify polygon to reduce vertex count. epsilon in mm (default 0.5 m)."""
    if len(pts) <= 2:
        return pts
    # Find point with max distance from line start..end
    start, end = pts[0], pts[-1]
    max_dist, max_idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        dx, dy = end[0] - start[0], end[1] - start[1]
        denom = math.hypot(dx, dy) or 1
        dist = (
            abs(dy * pts[i][0] - dx * pts[i][1] + end[0] * start[1] - end[1] * start[0]) / denom
        )
        if dist > max_dist:
            max_dist, max_idx = dist, i
    if max_dist > epsilon:
        left = douglas_peucker(pts[: max_idx + 1], epsilon)
        right = douglas_peucker(pts[max_idx:], epsilon)
        return left[:-1] + right
    return [start, end]


def elements_to_masses(
    elements: list[dict],
    origin_lat: float,
    origin_lon: float,
) -> list[dict]:
    """Convert raw Overpass elements to NeighborhoodMassElem dicts."""
    # Build node lookup
    nodes: dict[int, tuple[float, float]] = {}
    for el in elements:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lat"], el["lon"])

    masses = []
    for el in elements:
        if el["type"] != "way" or "tags" not in el:
            continue
        tags = el.get("tags", {})
        if "building" not in tags:
            continue

        pts_latlon = [nodes[nid] for nid in el.get("nodes", []) if nid in nodes]
        if len(pts_latlon) < 3:
            continue

        pts_mm = [latlon_to_mm(lat, lon, origin_lat, origin_lon) for lat, lon in pts_latlon]
        pts_mm = douglas_peucker(pts_mm)

        height_mm = _parse_height(tags)
        masses.append(
            {
                "kind": "neighborhood_mass",
                "id": f"osm-{el['id']}",
                "osmId": str(el["id"]),
                "footprintMm": [{"xMm": x, "yMm": y} for x, y in pts_mm],
                "heightMm": height_mm,
                "baseElevationMm": 0.0,
                "source": "osm",
                "isReadOnly": True,
            }
        )
    return masses
