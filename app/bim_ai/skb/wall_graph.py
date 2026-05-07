"""SKB-19 — wall-graph closure validator (stronger than VAL-01).

VAL-01 detects unbounded rooms. SKB-19 extends to whole-graph patterns:

  (a) `orphan_wall_v1`: a wall whose endpoints don't coincide with any
      other wall's endpoint (within tolerance). Catches the agent that
      forgot the north wall and only authored 3 sides.
  (b) `non_orthogonal_wall_v1`: a wall whose direction is not within
      tolerance of one of the cardinal axes (0°, 90°, 180°, 270°). Most
      residential authoring is rectilinear — this surfaces unintentional
      drift.
  (c) `t_intersection_no_join_v1`: a wall endpoint lies on another wall's
      interior (T-junction) without a `join_geometry` marker. Visible as
      a wall poking through another wall.

All advisories are `warning` severity by default; emit-only, never blocking.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence


XY = tuple[float, float]


@dataclass(frozen=True)
class WallSeg:
    """Minimal wall representation for the validator: id + endpoints."""

    id: str
    a: XY
    b: XY


@dataclass(frozen=True)
class WallGraphAdvisory:
    rule_id: str
    severity: str
    wall_id: str
    related_wall_id: str | None
    point_mm: XY | None
    message: str

    def to_dict(self) -> dict:
        d = {
            "rule_id": self.rule_id,
            "severity": self.severity,
            "wall_id": self.wall_id,
            "message": self.message,
        }
        if self.related_wall_id is not None:
            d["related_wall_id"] = self.related_wall_id
        if self.point_mm is not None:
            d["point_mm"] = [self.point_mm[0], self.point_mm[1]]
        return d


def _coincide(p: XY, q: XY, tol_mm: float) -> bool:
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) <= tol_mm * tol_mm


def _wall_angle_deg(seg: WallSeg) -> float:
    """Returns 0..360. 0° = along +X (east), 90° = along +Y (north)."""
    import math
    dx, dy = seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]
    if dx == 0 and dy == 0:
        return 0.0
    a = math.degrees(math.atan2(dy, dx))
    return a if a >= 0 else a + 360.0


def _angle_off_axis_deg(angle: float) -> float:
    """Degrees off the nearest cardinal (0/90/180/270)."""
    d = angle % 90
    return min(d, 90 - d)


def _point_on_segment_interior(point: XY, seg: WallSeg, tol_mm: float) -> bool:
    """True iff `point` lies on the open interior of segment ab (not at endpoints).
    """
    px, py = point
    ax, ay = seg.a
    bx, by = seg.b

    if _coincide(point, seg.a, tol_mm) or _coincide(point, seg.b, tol_mm):
        return False

    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return False
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    if t <= 1e-9 or t >= 1.0 - 1e-9:
        return False
    qx, qy = ax + t * dx, ay + t * dy
    perp_d = ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5
    return perp_d <= tol_mm


def find_orphan_walls(
    walls: Sequence[WallSeg],
    tol_mm: float = 10.0,
) -> list[WallGraphAdvisory]:
    """A wall is `orphan` when neither endpoint coincides with any other
    wall's endpoint within tolerance.
    """
    out: list[WallGraphAdvisory] = []
    for i, w in enumerate(walls):
        a_matched = False
        b_matched = False
        for j, other in enumerate(walls):
            if i == j:
                continue
            for ep in (other.a, other.b):
                if not a_matched and _coincide(w.a, ep, tol_mm):
                    a_matched = True
                if not b_matched and _coincide(w.b, ep, tol_mm):
                    b_matched = True
            if a_matched and b_matched:
                break
        if not (a_matched and b_matched):
            out.append(
                WallGraphAdvisory(
                    rule_id="orphan_wall_v1",
                    severity="warning",
                    wall_id=w.id,
                    related_wall_id=None,
                    point_mm=w.a if not a_matched else w.b,
                    message=(
                        f"Wall {w.id!r} has at least one endpoint that does not coincide "
                        f"with any other wall's endpoint within {tol_mm:g} mm — "
                        f"likely missing a connecting wall (orphan wall)."
                    ),
                )
            )
    return out


def find_non_orthogonal_walls(
    walls: Sequence[WallSeg],
    tol_deg: float = 1.0,
) -> list[WallGraphAdvisory]:
    """A wall is non-orthogonal when its direction is more than `tol_deg`
    away from all four cardinal axes.
    """
    out: list[WallGraphAdvisory] = []
    for w in walls:
        angle = _wall_angle_deg(w)
        off = _angle_off_axis_deg(angle)
        if off > tol_deg:
            out.append(
                WallGraphAdvisory(
                    rule_id="non_orthogonal_wall_v1",
                    severity="warning",
                    wall_id=w.id,
                    related_wall_id=None,
                    point_mm=None,
                    message=(
                        f"Wall {w.id!r}: direction {angle:.2f}° is {off:.2f}° off "
                        f"the nearest cardinal axis (residential authoring is usually "
                        f"orthogonal — was this intentional?)."
                    ),
                )
            )
    return out


def find_t_intersections_without_join(
    walls: Sequence[WallSeg],
    joined_pairs: Iterable[tuple[str, str]] = (),
    tol_mm: float = 10.0,
) -> list[WallGraphAdvisory]:
    """A T-intersection is an endpoint of wall A on the open interior of
    wall B. If (A,B) (or (B,A)) is not in `joined_pairs`, emit an advisory.
    """
    joins: set[frozenset[str]] = {frozenset(p) for p in joined_pairs}
    out: list[WallGraphAdvisory] = []
    for a in walls:
        for b in walls:
            if a.id == b.id:
                continue
            for ep in (a.a, a.b):
                if _point_on_segment_interior(ep, b, tol_mm):
                    if frozenset({a.id, b.id}) in joins:
                        continue
                    out.append(
                        WallGraphAdvisory(
                            rule_id="t_intersection_no_join_v1",
                            severity="warning",
                            wall_id=a.id,
                            related_wall_id=b.id,
                            point_mm=ep,
                            message=(
                                f"Wall {a.id!r} endpoint at ({ep[0]:.0f}, {ep[1]:.0f}) "
                                f"meets wall {b.id!r} interior — author a join_geometry "
                                f"marker or split {b.id!r} for a clean T-junction."
                            ),
                        )
                    )
    return out


def check_wall_graph(
    walls: Sequence[WallSeg],
    joined_pairs: Iterable[tuple[str, str]] = (),
    coincide_tol_mm: float = 10.0,
    angle_tol_deg: float = 1.0,
) -> list[WallGraphAdvisory]:
    """Runs all three SKB-19 checks; returns the union."""
    out: list[WallGraphAdvisory] = []
    out.extend(find_orphan_walls(walls, tol_mm=coincide_tol_mm))
    out.extend(find_non_orthogonal_walls(walls, tol_deg=angle_tol_deg))
    out.extend(find_t_intersections_without_join(walls, joined_pairs=joined_pairs, tol_mm=coincide_tol_mm))
    return out
