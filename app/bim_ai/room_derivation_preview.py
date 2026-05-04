"""Bounded room-loop preview from orthogonal walls (WP-B06 / WP-C04 / WP-F0x).

Heuristic: four axis-aligned wall segments on the same level that close a rectangle.
Non-orthogonal walls are ignored; no automatic room elements are created.
"""

from __future__ import annotations

import itertools
import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem

_SNAP_MM = 50.0


def _snap(mm: float) -> float:
    return round(mm / _SNAP_MM) * _SNAP_MM


def _axis_aligned_segment(w: WallElem) -> tuple[str, float, float, float, str] | None:
    x0, y0 = w.start.x_mm, w.start.y_mm
    x1, y1 = w.end.x_mm, w.end.y_mm
    if math.hypot(x1 - x0, y1 - y0) < 80.0:
        return None
    if abs(x0 - x1) < 25.0:
        return "v", _snap((x0 + x1) / 2.0), _snap(min(y0, y1)), _snap(max(y0, y1)), w.id
    if abs(y0 - y1) < 25.0:
        return "h", _snap((y0 + y1) / 2.0), _snap(min(x0, x1)), _snap(max(x0, x1)), w.id
    return None


def _quad_closes_rectangle(
    segs: tuple[tuple[str, float, float, float, str], ...],
) -> dict[str, Any] | None:
    if len(segs) != 4:
        return None
    kinds = {s[0] for s in segs}
    if kinds != {"h", "v"}:
        return None

    pts: list[tuple[float, float]] = []
    for s in segs:
        kind = s[0]
        if kind == "h":
            _k, y, xa, xb, _wid = s
            pts.append((xa, y))
            pts.append((xb, y))
        else:
            _k, x, ya, yb, _wid = s
            pts.append((x, ya))
            pts.append((x, yb))

    uniq: set[tuple[float, float]] = set()
    for px, py in pts:
        uniq.add((_snap(px), _snap(py)))
    if len(uniq) != 4:
        return None

    xs = {p[0] for p in uniq}
    ys = {p[1] for p in uniq}
    if len(xs) != 2 or len(ys) != 2:
        return None
    x_lo, x_hi = min(xs), max(xs)
    y_lo, y_hi = min(ys), max(ys)
    tol = _SNAP_MM * 1.4
    for s in segs:
        if s[0] == "h":
            _k, y, xa, xb, _wid = s
            if min(abs(y - y_lo), abs(y - y_hi)) > tol:
                return None
            if abs(min(xa, xb) - x_lo) > tol or abs(max(xa, xb) - x_hi) > tol:
                return None
        else:
            _k, x, ya, yb, _wid = s
            if min(abs(x - x_lo), abs(x - x_hi)) > tol:
                return None
            if abs(min(ya, yb) - y_lo) > tol or abs(max(ya, yb) - y_hi) > tol:
                return None

    area_m2 = max(0.0, (x_hi - x_lo) / 1000.0) * max(0.0, (y_hi - y_lo) / 1000.0)
    wall_ids_sorted = tuple(sorted({s[4] for s in segs}))
    return {
        "kind": "axis_aligned_rectangle",
        "levelPlane": "bim_xy_mm",
        "bboxMm": {"min": {"x": x_lo, "y": y_lo}, "max": {"x": x_hi, "y": y_hi}},
        "wallIds": sorted(wall_ids_sorted),
        "approxAreaM2": round(area_m2, 4),
        "note": (
            "Heuristic orthogonal loop only; authoritative rooms remain authored RoomElem outlines."
        ),
    }


def room_derivation_preview(doc: Document) -> dict[str, Any]:
    """Return deterministic facts for agent/UI comparison surfaces."""

    lvl_names = {e.id: e.name or e.id for e in doc.elements.values() if isinstance(e, LevelElem)}
    segments_by_level: dict[str, list[tuple[str, float, float, float, str]]] = {}

    for w in doc.elements.values():
        if not isinstance(w, WallElem):
            continue
        seg = _axis_aligned_segment(w)
        if not seg:
            continue
        segments_by_level.setdefault(w.level_id, []).append(seg)

    candidates: list[dict[str, Any]] = []
    for lid, seglist in segments_by_level.items():
        if len(seglist) < 4:
            continue
        for quad in itertools.combinations(seglist, 4):
            closed = _quad_closes_rectangle(quad)
            if not closed:
                continue
            closed["levelId"] = lid
            closed["levelName"] = lvl_names.get(lid, lid)
            candidates.append(closed)

    def _sig(c: dict[str, Any]) -> tuple:
        b = c.get("bboxMm") or {}
        mn = b.get("min") or {}
        mx = b.get("max") or {}
        return (str(c.get("levelId")), tuple(c.get("wallIds") or ()), mn.get("x"), mn.get("y"), mx.get("x"), mx.get("y"))

    dedup: dict[tuple, dict[str, Any]] = {}
    for c in sorted(candidates, key=_sig):
        dedup[_sig(c)] = c

    return {
        "heuristicVersion": "room_deriv_preview_v1",
        "axisAlignedRectangleCandidates": sorted(dedup.values(), key=_sig),
        "candidateCount": len(dedup),
    }
