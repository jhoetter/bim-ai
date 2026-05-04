"""Authoritative slice: deterministic axis-aligned rectangles from orthogonal walls ± separators."""

from __future__ import annotations

import hashlib
import itertools
import json
import math
from collections import defaultdict
from typing import Any, Literal

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, RoomSeparationElem, WallElem
from bim_ai.plan_aa_room_separation import axis_aligned_room_separation_splits_rectangle

BOUNDARY_SEGMENT_VERSION_V1 = "boundary_segment_v1"

# Shared with preview (orthogonal snap / closure tests)
_SNAP_MM = 50.0


def snap_mm(mm: float) -> float:
    return round(mm / _SNAP_MM) * _SNAP_MM


def aa_rect_intersection_area_m2(
    ax0: float, ay0: float, ax1: float, ay1: float, bx0: float, by0: float, bx1: float, by1: float
) -> float:
    ix0 = max(min(ax0, ax1), min(bx0, bx1))
    iy0 = max(min(ay0, ay1), min(by0, by1))
    ix1 = min(max(ax0, ax1), max(bx0, bx1))
    iy1 = min(max(ay0, ay1), max(by1, by1))
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) / 1000.0 * (iy1 - iy0) / 1000.0


def outline_aa_bbox_mm(rm: RoomElem) -> dict[str, dict[str, float]] | None:
    pts = [(p.x_mm, p.y_mm) for p in rm.outline_mm]
    if len(pts) < 3:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return {
        "min": {"x": float(min(xs)), "y": float(min(ys))},
        "max": {"x": float(max(xs)), "y": float(max(ys))},
    }


# Segment: kind 'h'|'v', canonical coordinate, extent min, extent max, element_id, boundary_kind
BoundaryKind = Literal["wall", "room_separation"]
AxisSeg = tuple[str, float, float, float, str, BoundaryKind]


def axis_aligned_wall_segment(w: WallElem) -> AxisSeg | None:
    x0, y0 = w.start.x_mm, w.start.y_mm
    x1, y1 = w.end.x_mm, w.end.y_mm
    if math.hypot(x1 - x0, y1 - y0) < 80.0:
        return None
    if abs(x0 - x1) < 25.0:
        return (
            "v",
            snap_mm((x0 + x1) / 2.0),
            snap_mm(min(y0, y1)),
            snap_mm(max(y0, y1)),
            w.id,
            "wall",
        )
    if abs(y0 - y1) < 25.0:
        return (
            "h",
            snap_mm((y0 + y1) / 2.0),
            snap_mm(min(x0, x1)),
            snap_mm(max(x0, x1)),
            w.id,
            "wall",
        )
    return None


def axis_aligned_room_separation_segment(r: RoomSeparationElem) -> AxisSeg | None:
    x0, y0 = r.start.x_mm, r.start.y_mm
    x1, y1 = r.end.x_mm, r.end.y_mm
    if math.hypot(x1 - x0, y1 - y0) < 80.0:
        return None
    if abs(x0 - x1) < 25.0:
        return (
            "v",
            snap_mm((x0 + x1) / 2.0),
            snap_mm(min(y0, y1)),
            snap_mm(max(y0, y1)),
            r.id,
            "room_separation",
        )
    if abs(y0 - y1) < 25.0:
        return (
            "h",
            snap_mm((y0 + y1) / 2.0),
            snap_mm(min(x0, x1)),
            snap_mm(max(x0, x1)),
            r.id,
            "room_separation",
        )
    return None


def quad_closes_rectangle(
    segs: tuple[AxisSeg, AxisSeg, AxisSeg, AxisSeg],
) -> dict[str, Any] | None:
    plain = tuple(
        # legacy quad format: (kind, c0, mn, mx, id)
        (s[0], s[1], s[2], s[3], s[4])
        for s in segs
    )
    if len(plain) != 4:
        return None
    kinds = {s[0] for s in plain}
    if kinds != {"h", "v"}:
        return None

    pts: list[tuple[float, float]] = []
    for s in plain:
        kind = s[0]
        if kind == "h":
            _, y, xa, xb, _wid = s
            pts.append((xa, y))
            pts.append((xb, y))
        else:
            _, x, ya, yb, _wid = s
            pts.append((x, ya))
            pts.append((x, yb))

    uniq: set[tuple[float, float]] = set()
    for px, py in pts:
        uniq.add((snap_mm(px), snap_mm(py)))
    if len(uniq) != 4:
        return None

    xs = {p[0] for p in uniq}
    ys = {p[1] for p in uniq}
    if len(xs) != 2 or len(ys) != 2:
        return None
    x_lo, x_hi = min(xs), max(xs)
    y_lo, y_hi = min(ys), max(ys)
    tol = _SNAP_MM * 1.4
    for s in plain:
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
    wall_ids = sorted({s[4] for s in segs if s[5] == "wall"})
    sep_ids = sorted({s[4] for s in segs if s[5] == "room_separation"})
    perimeter_ids_sorted = tuple(sorted(s[4] for s in segs))
    return {
        "kind": "axis_aligned_rectangle",
        "levelPlane": "bim_xy_mm",
        "bboxMm": {"min": {"x": x_lo, "y": y_lo}, "max": {"x": x_hi, "y": y_hi}},
        "wallIds": wall_ids,
        "boundarySeparationIds": sep_ids,
        "perimeterSegmentIdsSorted": perimeter_ids_sorted,
        "boundarySegmentEncoding": BOUNDARY_SEGMENT_VERSION_V1,
        "approxAreaM2": round(area_m2, 4),
        "note": (
            "Axis-aligned orthogonal loop from wall and/or axis-aligned room separation segments; "
            "authoritative derivation when interior is unambiguous and does not intersect authored outlines."
        ),
    }


def separation_ids_splitting_candidate_bbox(
    doc: Document,
    *,
    level_id: str,
    bbox: dict[str, Any],
) -> list[str]:
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    bx_lo = float(mn.get("x") or 0)
    by_lo = float(mn.get("y") or 0)
    bx_hi = float(mx.get("x") or 0)
    by_hi = float(mx.get("y") or 0)
    if bx_hi <= bx_lo or by_hi <= by_lo:
        return []
    found: list[str] = []
    for ent in doc.elements.values():
        if not isinstance(ent, RoomSeparationElem):
            continue
        if ent.level_id != level_id:
            continue
        if axis_aligned_room_separation_splits_rectangle(
            ent.start.x_mm,
            ent.start.y_mm,
            ent.end.x_mm,
            ent.end.y_mm,
            bx_lo,
            bx_hi,
            by_lo,
            by_hi,
        ):
            found.append(ent.id)
    return sorted(found)


def authored_room_overlaps_candidate_bbox(rooms: list[RoomElem], cand_bbox: dict[str, Any]) -> bool:
    mn = cand_bbox.get("min") or {}
    mx = cand_bbox.get("max") or {}
    cx0 = float(mn.get("x") or 0)
    cy0 = float(mn.get("y") or 0)
    cx1 = float(mx.get("x") or 0)
    cy1 = float(mx.get("y") or 0)
    if cx1 <= cx0 or cy1 <= cy0:
        return False
    for rm in rooms:
        bb = outline_aa_bbox_mm(rm)
        if bb is None:
            continue
        mn_r = bb["min"]
        mx_r = bb["max"]
        rx0 = float(mn_r["x"])
        ry0 = float(mn_r["y"])
        rx1 = float(mx_r["x"])
        ry1 = float(mx_r["y"])
        if rx1 <= rx0 or ry1 <= ry0:
            continue
        if aa_rect_intersection_area_m2(cx0, cy0, cx1, cy1, rx0, ry0, rx1, ry1) > 1e-12:
            return True
    return False


def _segment_signature(seg: AxisSeg) -> tuple:
    return (seg[0], round(seg[1], 8), round(seg[2], 8), round(seg[3], 8), seg[4], seg[5])


def collect_axis_aligned_boundary_segments(doc: Document) -> dict[str, list[AxisSeg]]:
    segments_by_level: defaultdict[str, list[AxisSeg]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, WallElem):
            s = axis_aligned_wall_segment(ent)
            if s:
                segments_by_level[ent.level_id].append(s)
        elif isinstance(ent, RoomSeparationElem):
            s = axis_aligned_room_separation_segment(ent)
            if s:
                segments_by_level[ent.level_id].append(s)
    for lid in segments_by_level:
        segments_by_level[lid].sort(key=_segment_signature)
    return dict(segments_by_level)


HEURISTIC_VERSION = "room_deriv_preview_v3"
# Bounding combinations(seglist,4); huge parallel wall pools are non-closing-only-h edges.
ROOM_AX_RECT_SEGMENT_ENUM_CAP = 72


def compute_room_boundary_derivation(doc: Document) -> dict[str, Any]:
    """Single deterministic bundle: candidates, classification, diagnostics, preview warnings."""
    lvl_names = {e.id: e.name or e.id for e in doc.elements.values() if isinstance(e, LevelElem)}
    segments_by_level = collect_axis_aligned_boundary_segments(doc)

    candidates: list[dict[str, Any]] = []
    for lid, seglist in segments_by_level.items():
        axes = {s[0] for s in seglist}
        if "h" not in axes or "v" not in axes:
            continue
        if len(seglist) < 4:
            continue
        if len(seglist) > ROOM_AX_RECT_SEGMENT_ENUM_CAP:
            continue
        for quad in itertools.combinations(seglist, 4):
            qs = quad_closes_rectangle(quad)
            if not qs:
                continue
            qs["levelId"] = lid
            qs["levelName"] = lvl_names.get(lid, lid)
            candidates.append(qs)

    def _sig(cand: dict[str, Any]) -> tuple:
        b = cand.get("bboxMm") or {}
        mn = b.get("min") or {}
        mx = b.get("max") or {}
        return (
            str(cand.get("levelId")),
            tuple(cand.get("wallIds") or ()),
            tuple(cand.get("boundarySeparationIds") or ()),
            tuple(cand.get("perimeterSegmentIdsSorted") or ()),
            mn.get("x"),
            mn.get("y"),
            mx.get("x"),
            mx.get("y"),
        )

    dedup: dict[tuple, dict[str, Any]] = {}
    for c in sorted(candidates, key=_sig):
        dedup[_sig(c)] = c

    authored_by_level: defaultdict[str, list[RoomElem]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, RoomElem):
            authored_by_level[ent.level_id].append(ent)

    diagnostics: list[dict[str, Any]] = []
    for lid, segs in sorted(segments_by_level.items(), key=lambda x: x[0]):
        if not segs:
            continue
        if len(segs) < 4:
            wall_ids_lvl = sorted(s[4] for s in segs if s[5] == "wall")
            sep_ids_lvl = sorted(s[4] for s in segs if s[5] == "room_separation")
            diagnostics.append(
                {
                    "code": "axis_segments_insufficient_for_closure",
                    "severity": "info",
                    "levelId": lid,
                    "diagnosticId": _stable_diag_id_axis_insufficient(lid, wall_ids_lvl, sep_ids_lvl),
                    "segmentCounts": {"wall": len(wall_ids_lvl), "room_separation": len(sep_ids_lvl)},
                    "elementIds": sorted(set(wall_ids_lvl) | set(sep_ids_lvl)),
                    "message": (
                        "Orthogonal wall and/or room separation segments exist on this level but fewer than four; "
                        "cannot close an axis-aligned rectangle."
                    ),
                }
            )

    warnings: list[dict[str, Any]] = []
    enriched: list[dict[str, Any]] = []
    auth_count = 0
    ambiguous_diag_ids: set[str] = set()

    for cand in sorted(dedup.values(), key=_sig):
        lid = str(cand.get("levelId") or "")
        bbox = cand.get("bboxMm") if isinstance(cand.get("bboxMm"), dict) else {}
        sep_ids = separation_ids_splitting_candidate_bbox(doc, level_id=lid, bbox=bbox)
        authored = authored_by_level.get(lid, [])
        pierce = bool(sep_ids)
        overlap_auth = authored_room_overlaps_candidate_bbox(authored, bbox)

        authority_reasons: list[str] = []
        if pierce:
            authority_reasons.append("ambiguous_interior_separation")
            amb_id = _stable_diag_id_ambiguous(lid, bbox, sep_ids)
            if amb_id not in ambiguous_diag_ids:
                ambiguous_diag_ids.add(amb_id)
                diagnostics.append(
                    {
                        "code": "ambiguous_interior_separation",
                        "severity": "warning",
                        "levelId": lid,
                        "diagnosticId": amb_id,
                        "separationIds": sep_ids,
                        "wallIds": list(cand.get("wallIds") or []),
                        "boundarySeparationIds": list(cand.get("boundarySeparationIds") or []),
                        "message": (
                            "An axis-aligned room separation pierces this derived rectangle interior; "
                            "footprint is ambiguous for a single authoritative cell."
                        ),
                    }
                )
        if overlap_auth:
            authority_reasons.append("overlaps_authored_room_bbox")

        if pierce or overlap_auth:
            derivation_authority: Literal["authoritative", "preview_heuristic"] = "preview_heuristic"
        else:
            derivation_authority = "authoritative"
            auth_count += 1

        ec = dict(cand)
        ec["derivationAuthority"] = derivation_authority
        ec["authorityReasonCodes"] = sorted(set(authority_reasons))
        enriched.append(ec)

        if sep_ids:
            warnings.append(
                {
                    "code": "derivedRectangleInteriorRoomSeparation",
                    "severity": "warning",
                    "levelId": lid,
                    "wallIds": sorted(cand.get("wallIds") or []),
                    "separationIds": sep_ids,
                    "message": (
                        "An axis-aligned room separation pierces this derived rectangle bbox interior; "
                        "expect multiple rooms or adjust separators before trusting a single createRoomOutline."
                    ),
                }
            )

        if not overlap_auth:
            warnings.append(
                {
                    "code": "derivedRectangleWithoutAuthoredRoom",
                    "severity": "info",
                    "levelId": lid,
                    "wallIds": sorted(cand.get("wallIds") or []),
                    "message": (
                        "Heuristic axis-aligned rectangle from walls does not overlap any authored RoomElem "
                        "bounding box on this level; consider createRoomOutline or verify closure."
                    ),
                }
            )

    return {
        "heuristicVersion": HEURISTIC_VERSION,
        "axisAlignedRectangleCandidates": sorted(enriched, key=_sig),
        "candidateCount": len(dedup),
        "authoritativeCandidateCount": auth_count,
        "diagnostics": sorted(diagnostics, key=lambda d: (str(d.get("levelId")), str(d.get("code")), str(d.get("diagnosticId")))),
        "warnings": warnings,
    }


def _stable_diag_id_axis_insufficient(level_id: str, wall_ids: list[str], sep_ids: list[str]) -> str:
    body = json.dumps(
        {"levelId": level_id, "wallIds": wall_ids, "sepIds": sep_ids},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _stable_diag_id_ambiguous(level_id: str, bbox: dict[str, Any], sep_ids: list[str]) -> str:
    body = json.dumps({"levelId": level_id, "bboxMm": bbox, "sepIds": sep_ids}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def authoritative_vacant_area_m2_filtered(
    doc: Document,
    *,
    allowed_level_ids: frozenset[str] | None = None,
) -> tuple[float, int]:
    """Sum area and count of authoritative vacant rectangles, optionally restricted to levels."""
    bundle = compute_room_boundary_derivation(doc)
    total_area = 0.0
    n = 0
    for c in bundle.get("axisAlignedRectangleCandidates") or []:
        if not isinstance(c, dict):
            continue
        if c.get("derivationAuthority") != "authoritative":
            continue
        lid = str(c.get("levelId") or "")
        if allowed_level_ids is not None and lid not in allowed_level_ids:
            continue
        try:
            total_area += float(c.get("approxAreaM2") or 0.0)
        except (TypeError, ValueError):
            continue
        n += 1
    return round(total_area, 4), n


def authoritative_vacant_footprints_m2_summary(doc: Document) -> tuple[float, int]:
    """Sum of authoritative vacant rectangles (deterministic subset). Used by schedules."""
    return authoritative_vacant_area_m2_filtered(doc, allowed_level_ids=None)


def stable_footprint_id(cand_dict: dict[str, Any]) -> str:
    """Stable id for authoritative evidence rows (candidate dict from bundle)."""
    canon = {
        "levelId": str(cand_dict.get("levelId") or ""),
        "wallIds": sorted(cand_dict.get("wallIds") or []),
        "boundarySeparationIds": sorted(cand_dict.get("boundarySeparationIds") or []),
        "bbox": cand_dict.get("bboxMm"),
        "kind": str(cand_dict.get("kind") or ""),
        "boundarySegmentEncoding": str(cand_dict.get("boundarySegmentEncoding") or ""),
    }
    body = json.dumps(canon, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()[:24]


def footprint_outline_mm_rectangle(bbox: dict[str, Any]) -> list[dict[str, float]]:
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    x0 = float(mn.get("x") or 0)
    y0 = float(mn.get("y") or 0)
    x1 = float(mx.get("x") or 0)
    y1 = float(mx.get("y") or 0)
    return [
        {"xMm": x0, "yMm": y0},
        {"xMm": x1, "yMm": y0},
        {"xMm": x1, "yMm": y1},
        {"xMm": x0, "yMm": y1},
    ]
