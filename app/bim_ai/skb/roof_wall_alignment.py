"""SKB-11 — roof-wall alignment validator.

Checks that every wall whose top is logically attached to a roof has its
top-line wholly inside the roof's footprint polygon. Catches the failure
mode where the agent authors a roof footprint smaller than the upper-floor
walls — the wall would extend through the roof in 3D.

Pure geometric check; emits one `roof_wall_alignment_v1` advisory per
wall whose centerline (or either endpoint) lies outside the host roof
footprint.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence


XY = tuple[float, float]


@dataclass(frozen=True)
class RoofWallAlignmentViolation:
    """One wall-outside-roof finding."""

    wall_id: str
    roof_id: str
    sample_outside: XY                    # the worst offending point
    distance_outside_mm: float            # how far outside the roof footprint
    message: str

    def to_advisory_dict(self) -> dict:
        return {
            "rule_id": "roof_wall_alignment_v1",
            "severity": "warning",
            "wall_id": self.wall_id,
            "roof_id": self.roof_id,
            "sample_outside_mm": [self.sample_outside[0], self.sample_outside[1]],
            "distance_outside_mm": self.distance_outside_mm,
            "message": self.message,
        }


def _point_in_polygon(point: XY, polygon: Sequence[XY]) -> bool:
    """Ray-casting point-in-polygon. Polygon assumed closed (last==first or
    implicit closure via the segment from polygon[-1] to polygon[0])."""
    px, py = point
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersects = ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _segment_distance(p: XY, a: XY, b: XY) -> float:
    """Distance from point p to segment ab (in same units as inputs)."""
    px, py = p
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def _distance_outside_polygon(point: XY, polygon: Sequence[XY]) -> float:
    """Min distance from point to the polygon perimeter when point is outside."""
    n = len(polygon)
    if n < 2:
        return 0.0
    return min(_segment_distance(point, polygon[i], polygon[(i + 1) % n]) for i in range(n))


def check_alignment(
    wall_id: str,
    wall_start: XY,
    wall_end: XY,
    roof_id: str,
    roof_footprint: Sequence[XY],
    tolerance_mm: float = 1.0,
) -> RoofWallAlignmentViolation | None:
    """Returns a violation when either wall endpoint is outside the roof
    footprint by more than `tolerance_mm`.
    """
    worst: XY | None = None
    worst_dist = 0.0
    for endpoint in (wall_start, wall_end):
        if _point_in_polygon(endpoint, roof_footprint):
            continue
        d = _distance_outside_polygon(endpoint, roof_footprint)
        if d > tolerance_mm and d > worst_dist:
            worst = endpoint
            worst_dist = d
    if worst is None:
        return None
    return RoofWallAlignmentViolation(
        wall_id=wall_id,
        roof_id=roof_id,
        sample_outside=worst,
        distance_outside_mm=worst_dist,
        message=(
            f"Wall {wall_id!r}: endpoint at ({worst[0]:.0f}, {worst[1]:.0f}) "
            f"is {worst_dist:.0f} mm outside roof {roof_id!r}'s footprint."
        ),
    )


def check_alignments(
    walls: Iterable[tuple[str, XY, XY, str]],
    roof_footprints: dict[str, Sequence[XY]],
    tolerance_mm: float = 1.0,
) -> list[RoofWallAlignmentViolation]:
    """Convenience: run the check for many (wall_id, start, end, roof_id)
    rows. Skips walls whose declared roof_id has no footprint registered.
    """
    out: list[RoofWallAlignmentViolation] = []
    for wid, start, end, rid in walls:
        fp = roof_footprints.get(rid)
        if fp is None:
            continue
        v = check_alignment(wid, start, end, rid, fp, tolerance_mm=tolerance_mm)
        if v is not None:
            out.append(v)
    return out
