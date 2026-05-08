"""SKB-05 — architectural soundness validator pack (`architectural_soundness_v1`).

Bundles a small set of checks that catch structurally-incoherent authoring:

  (a) `wall_corner_gap_or_overlap_v1` — wall endpoints meet at corners with
      no gap or overlap > tol mm. Composes SKB-22's coincidence test.
  (b) `floor_boundary_matches_wall_enclosure_v1` — every floor's outline
      tracks the closed wall ring on its level (Hausdorff distance ≤ tol).
  (c) `levels_form_monotonic_stack_v1` — levels at the same site sorted by
      elevation never interleave; no two levels share an elevation.
  (d) `roof_contains_upper_wall_centerlines_v1` — every wall on a level
      whose `roof_attachment_id` is set has its midpoint inside that
      roof's footprint polygon. Subset of SKB-11's check (which uses
      endpoints) — the midpoint check ensures slim cantilevers also flag.

Each emits warning advisories by default; per-project flag to promote
to blocking is the engine's call (left to caller).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from bim_ai.skb.roof_wall_alignment import _distance_outside_polygon, _point_in_polygon
from bim_ai.skb.wall_graph import WallSeg

XY = tuple[float, float]


@dataclass(frozen=True)
class SoundnessAdvisory:
    rule_id: str
    severity: str
    element_ids: list[str]
    point_mm: XY | None
    message: str

    def to_dict(self) -> dict:
        d = {
            "rule_id": self.rule_id,
            "severity": self.severity,
            "element_ids": list(self.element_ids),
            "message": self.message,
        }
        if self.point_mm is not None:
            d["point_mm"] = [self.point_mm[0], self.point_mm[1]]
        return d


# ── (a) wall-corner gap-or-overlap check ────────────────────────────────


def check_wall_corner_gaps(
    walls: Sequence[WallSeg],
    join_tol_mm: float = 1.0,
    near_miss_tol_mm: float = 50.0,
) -> list[SoundnessAdvisory]:
    """For every pair of walls, find endpoints within `near_miss_tol_mm`
    but more than `join_tol_mm` apart — those are likely intended to meet
    but the agent's authoring has a gap or overlap."""
    out: list[SoundnessAdvisory] = []
    seen: set[frozenset[str]] = set()
    for i, w in enumerate(walls):
        for j in range(i + 1, len(walls)):
            other = walls[j]
            for ep_a in (w.a, w.b):
                for ep_b in (other.a, other.b):
                    dx, dy = ep_a[0] - ep_b[0], ep_a[1] - ep_b[1]
                    d2 = dx * dx + dy * dy
                    if d2 > near_miss_tol_mm * near_miss_tol_mm:
                        continue
                    if d2 < join_tol_mm * join_tol_mm:
                        continue  # truly coincident
                    key = frozenset({w.id, other.id})
                    if key in seen:
                        continue
                    seen.add(key)
                    d = d2 ** 0.5
                    out.append(
                        SoundnessAdvisory(
                            rule_id="wall_corner_gap_or_overlap_v1",
                            severity="warning",
                            element_ids=sorted([w.id, other.id]),
                            point_mm=ep_a,
                            message=(
                                f"Walls {w.id!r} and {other.id!r} have endpoints "
                                f"{d:.1f} mm apart (>{join_tol_mm:g} but <{near_miss_tol_mm:g}) — "
                                f"likely an authoring gap or overlap at the corner."
                            ),
                        )
                    )
                    break
                else:
                    continue
                break
    return out


# ── (b) floor-boundary matches wall enclosure ──────────────────────────


def _hausdorff_polygon_to_walls(
    boundary: Sequence[XY],
    walls: Sequence[WallSeg],
) -> float:
    """Symmetric (point-set) Hausdorff distance between a polygon boundary
    and a wall graph. Returns the worst (max) min-distance.

    Cheap approximation: max over polygon vertices of min distance to any
    wall segment endpoint. Sufficient for "did the agent author the floor
    boundary to roughly track the walls?".
    """
    if not boundary or not walls:
        return float("inf")
    wall_endpoints: list[XY] = []
    for w in walls:
        wall_endpoints.append(w.a)
        wall_endpoints.append(w.b)

    worst = 0.0
    for v in boundary:
        best = float("inf")
        for ep in wall_endpoints:
            dx, dy = v[0] - ep[0], v[1] - ep[1]
            d2 = dx * dx + dy * dy
            if d2 < best:
                best = d2
        worst = max(worst, best ** 0.5)
    return worst


def check_floor_matches_walls(
    floor_id: str,
    floor_boundary: Sequence[XY],
    walls_on_level: Sequence[WallSeg],
    tol_mm: float = 200.0,
) -> SoundnessAdvisory | None:
    """Floor outline must track the wall graph within `tol_mm`."""
    h = _hausdorff_polygon_to_walls(floor_boundary, walls_on_level)
    if h <= tol_mm:
        return None
    return SoundnessAdvisory(
        rule_id="floor_boundary_matches_wall_enclosure_v1",
        severity="warning",
        element_ids=[floor_id, *[w.id for w in walls_on_level]],
        point_mm=None,
        message=(
            f"Floor {floor_id!r} boundary diverges from wall enclosure by "
            f"{h:.0f} mm (tolerance {tol_mm:g} mm) — boundary may not match "
            f"the closed wall ring on this level."
        ),
    )


# ── (c) levels form a monotonic stack ──────────────────────────────────


@dataclass(frozen=True)
class LevelInfo:
    id: str
    elevation_mm: float


def check_levels_monotonic_stack(levels: Sequence[LevelInfo]) -> list[SoundnessAdvisory]:
    """Detect: (1) two levels with the same elevation, (2) levels with
    duplicate ids."""
    out: list[SoundnessAdvisory] = []
    by_elev: dict[float, list[str]] = {}
    by_id: dict[str, int] = {}
    for lvl in levels:
        by_elev.setdefault(lvl.elevation_mm, []).append(lvl.id)
        by_id[lvl.id] = by_id.get(lvl.id, 0) + 1

    for elev, ids in by_elev.items():
        if len(ids) > 1:
            out.append(
                SoundnessAdvisory(
                    rule_id="levels_form_monotonic_stack_v1",
                    severity="warning",
                    element_ids=sorted(ids),
                    point_mm=None,
                    message=(
                        f"Levels {sorted(ids)!r} share elevation {elev:g} mm — "
                        f"levels should never interleave."
                    ),
                )
            )
    for lid, count in by_id.items():
        if count > 1:
            out.append(
                SoundnessAdvisory(
                    rule_id="levels_form_monotonic_stack_v1",
                    severity="warning",
                    element_ids=[lid],
                    point_mm=None,
                    message=f"Duplicate level id {lid!r} ({count} entries).",
                )
            )
    return out


# ── (d) roof footprint contains every upper-floor wall centerline ──────


def check_roof_contains_wall_midpoint(
    wall_id: str,
    wall_a: XY,
    wall_b: XY,
    roof_id: str,
    roof_footprint: Sequence[XY],
    tolerance_mm: float = 1.0,
) -> SoundnessAdvisory | None:
    """Wall's midpoint must lie inside the host roof's footprint."""
    mid = (0.5 * (wall_a[0] + wall_b[0]), 0.5 * (wall_a[1] + wall_b[1]))
    if _point_in_polygon(mid, roof_footprint):
        return None
    d = _distance_outside_polygon(mid, roof_footprint)
    if d <= tolerance_mm:
        return None
    return SoundnessAdvisory(
        rule_id="roof_contains_upper_wall_centerlines_v1",
        severity="warning",
        element_ids=[wall_id, roof_id],
        point_mm=mid,
        message=(
            f"Wall {wall_id!r} midpoint at ({mid[0]:.0f}, {mid[1]:.0f}) is "
            f"{d:.0f} mm outside roof {roof_id!r}'s footprint — slim cantilever?"
        ),
    )


# ── pack runner ─────────────────────────────────────────────────────────


@dataclass(frozen=True)
class SoundnessInput:
    """Bundle of inputs for the full soundness pack."""

    walls: Sequence[WallSeg]
    floors: Sequence[tuple[str, Sequence[XY], Sequence[WallSeg]]]   # (floor_id, boundary, level walls)
    levels: Sequence[LevelInfo]
    roofed_walls: Sequence[tuple[str, XY, XY, str, Sequence[XY]]]  # (wall_id, a, b, roof_id, footprint)


def run_pack(inp: SoundnessInput) -> list[SoundnessAdvisory]:
    """Run all four checks and return the union of advisories."""
    out: list[SoundnessAdvisory] = []
    out.extend(check_wall_corner_gaps(inp.walls))
    for fid, boundary, walls in inp.floors:
        adv = check_floor_matches_walls(fid, boundary, walls)
        if adv is not None:
            out.append(adv)
    out.extend(check_levels_monotonic_stack(inp.levels))
    for wid, a, b, rid, fp in inp.roofed_walls:
        adv = check_roof_contains_wall_midpoint(wid, a, b, rid, fp)
        if adv is not None:
            out.append(adv)
    return out
