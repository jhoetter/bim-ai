"""Deterministic axis-aligned L-corner join evidence for exchange manifests (WP-B02 / WP-X02).

Does not merge geometry; documents perpendicular walls sharing one vertex snapped to a 1 mm grid.
"""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import WallElem
from bim_ai.opening_cut_primitives import wall_plan_axis_aligned_xy


def _endpoints_rounded_mm(w: WallElem, eps_mm: float = 1.0) -> set[tuple[float, float]]:
    return {
        (round(w.start.x_mm / eps_mm) * eps_mm, round(w.start.y_mm / eps_mm) * eps_mm),
        (round(w.end.x_mm / eps_mm) * eps_mm, round(w.end.y_mm / eps_mm) * eps_mm),
    }


def _wall_unit_xy(w: WallElem) -> tuple[float, float] | None:
    dx = float(w.end.x_mm - w.start.x_mm)
    dy = float(w.end.y_mm - w.start.y_mm)
    span = math.hypot(dx, dy)
    if span < 1e-3:
        return None
    return dx / span, dy / span


def collect_wall_corner_join_evidence_v0(doc: Document) -> dict[str, Any] | None:
    """Pairs of axis-aligned walls on one level sharing exactly one snapped vertex, directions ~perpendicular."""

    walls = [e for e in doc.elements.values() if isinstance(e, WallElem)]
    wall_ids = sorted(w.id for w in walls)
    by_id: dict[str, WallElem] = {w.id: w for w in walls}

    joins: list[dict[str, Any]] = []

    for i, ia in enumerate(wall_ids):
        wa = by_id[ia]
        if not wall_plan_axis_aligned_xy(wa):
            continue
        ua = _wall_unit_xy(wa)
        if ua is None:
            continue
        for ib in wall_ids[i + 1 :]:
            wb = by_id[ib]
            if wb.level_id != wa.level_id:
                continue
            if not wall_plan_axis_aligned_xy(wb):
                continue
            ub = _wall_unit_xy(wb)
            if ub is None:
                continue
            if abs(ua[0] * ub[0] + ua[1] * ub[1]) > 0.05:
                continue
            pts_a = _endpoints_rounded_mm(wa)
            pts_b = _endpoints_rounded_mm(wb)
            common = pts_a & pts_b
            if len(common) != 1:
                continue
            vx, vy = next(iter(common))
            joins.append(
                {
                    "wallIds": sorted([wa.id, wb.id]),
                    "vertexMm": {"xMm": round(vx, 3), "yMm": round(vy, 3)},
                    "levelId": wa.level_id,
                    "joinKind": "corner",
                }
            )

    if not joins:
        return None

    joins.sort(
        key=lambda row: (
            str(row["levelId"]),
            float(row["vertexMm"]["xMm"]),
            float(row["vertexMm"]["yMm"]),
            row["wallIds"][0],
            row["wallIds"][1],
        )
    )
    return {"format": "wallCornerJoinEvidence_v0", "joins": joins}
