"""SKB-22 — wall-corner join markers + auto-join detection.

Today walls authored as separate elements at a shared endpoint visually
meet but aren't tagged as joined. The renderer can't mitre / butt the
corners cleanly without knowing which walls share an endpoint, so the
seed-fidelity SSW-iso shows tiny visible seams at every corner.

This module computes the auto-join set deterministically:
  - Two walls share a corner when an endpoint of one coincides (within
    tolerance, default 10 mm) with an endpoint of the other.
  - One walls share an abutment when an endpoint of one coincides with
    the open interior of the other (T-junction).
  - The detected pairs are wrapped in `JoinGeometryElem`-shaped dicts
    that the agent can include in their bundle (or the engine can emit
    on first commit).

Pure geometry. No dependency on the engine or Pydantic models.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence


XY = tuple[float, float]


@dataclass(frozen=True)
class WallSeg:
    """Minimal wall representation (id + endpoints)."""

    id: str
    a: XY
    b: XY


@dataclass(frozen=True)
class WallJoinPair:
    """One detected join between two walls."""

    wall_a_id: str
    wall_b_id: str
    kind: str                          # 'corner' | 'abutment'
    point_mm: XY                       # join location
    notes: str = ""

    def to_element_dict(self, join_id: str) -> dict:
        """Serialise to the JoinGeometryElem-shaped dict for emission."""
        return {
            "kind": "join_geometry",
            "id": join_id,
            "joinedElementIds": sorted([self.wall_a_id, self.wall_b_id]),
            "notes": (
                f"SKB-22 auto-join — {self.kind} at "
                f"({self.point_mm[0]:.0f}, {self.point_mm[1]:.0f})"
                + (f"; {self.notes}" if self.notes else "")
            ),
        }


def _coincide(p: XY, q: XY, tol_mm: float) -> bool:
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) <= tol_mm * tol_mm


def _point_on_segment_interior(point: XY, seg: WallSeg, tol_mm: float) -> bool:
    """True iff `point` lies on segment ab's open interior (not endpoints)."""
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


def detect_corner_joins(walls: Sequence[WallSeg], tol_mm: float = 10.0) -> list[WallJoinPair]:
    """Endpoints of two distinct walls coincide → corner join."""
    out: list[WallJoinPair] = []
    seen: set[frozenset[str]] = set()
    for i, w in enumerate(walls):
        for j in range(i + 1, len(walls)):
            other = walls[j]
            for ep_a in (w.a, w.b):
                for ep_b in (other.a, other.b):
                    if _coincide(ep_a, ep_b, tol_mm):
                        key = frozenset({w.id, other.id})
                        if key in seen:
                            continue
                        seen.add(key)
                        # Use whichever endpoint is in `w` as canonical point
                        out.append(
                            WallJoinPair(
                                wall_a_id=w.id,
                                wall_b_id=other.id,
                                kind="corner",
                                point_mm=ep_a,
                            )
                        )
                        break
                else:
                    continue
                break
    return out


def detect_abutment_joins(walls: Sequence[WallSeg], tol_mm: float = 10.0) -> list[WallJoinPair]:
    """Endpoint of wall A on wall B's interior → T-abutment join."""
    out: list[WallJoinPair] = []
    seen: set[tuple[str, str]] = set()  # ordered: (endpoint-owner, host)
    for a in walls:
        for b in walls:
            if a.id == b.id:
                continue
            for ep in (a.a, a.b):
                if _point_on_segment_interior(ep, b, tol_mm):
                    key = (a.id, b.id)
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append(
                        WallJoinPair(
                            wall_a_id=a.id,
                            wall_b_id=b.id,
                            kind="abutment",
                            point_mm=ep,
                            notes=f"endpoint of {a.id!r} abuts interior of {b.id!r}",
                        )
                    )
    return out


def detect_all_joins(walls: Sequence[WallSeg], tol_mm: float = 10.0) -> list[WallJoinPair]:
    """All joins: corners + abutments. Used by the engine to auto-emit
    `join_geometry` markers on first commit."""
    return [*detect_corner_joins(walls, tol_mm=tol_mm), *detect_abutment_joins(walls, tol_mm=tol_mm)]


def existing_join_pairs(joined_groups: Iterable[Sequence[str]]) -> set[frozenset[str]]:
    """Helper: convert existing `join_geometry.joinedElementIds` lists to a
    pair-set so callers can skip auto-emitting joins that already exist.
    """
    out: set[frozenset[str]] = set()
    for group in joined_groups:
        ids = list(group)
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                out.add(frozenset({ids[i], ids[j]}))
    return out


def joins_missing_from_existing(
    detected: Sequence[WallJoinPair],
    existing: set[frozenset[str]],
) -> list[WallJoinPair]:
    """Drop the detected joins that are already covered by existing
    `join_geometry` elements."""
    return [p for p in detected if frozenset({p.wall_a_id, p.wall_b_id}) not in existing]
