"""Bounded room-loop preview from orthogonal walls (WP-B06 / WP-C04 / WP-F0x).

Heuristic: four axis-aligned wall segments on the same level that close a rectangle.
Non-orthogonal walls are ignored; no automatic room elements are created.
Review endpoints attach stable ids + suggested ``createRoomOutline`` commands only.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import math
from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import GridLineElem, LevelElem, RoomElem, RoomSeparationElem, WallElem
from bim_ai.plan_aa_room_separation import axis_aligned_room_separation_splits_rectangle

_SNAP_MM = 50.0


def _snap(mm: float) -> float:
    return round(mm / _SNAP_MM) * _SNAP_MM


def _aa_rect_intersection_area_m2(
    ax0: float, ay0: float, ax1: float, ay1: float, bx0: float, by0: float, bx1: float, by1: float
) -> float:
    ix0 = max(min(ax0, ax1), min(bx0, bx1))
    iy0 = max(min(ay0, ay1), min(by0, by1))
    ix1 = min(max(ax0, ax1), max(bx0, bx1))
    iy1 = min(max(ay0, ay1), max(by1, by1))
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) / 1000.0 * (iy1 - iy0) / 1000.0


def _outline_aa_bbox_mm(rm: RoomElem) -> dict[str, dict[str, float]] | None:
    pts = [(p.x_mm, p.y_mm) for p in rm.outline_mm]
    if len(pts) < 3:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return {
        "min": {"x": float(min(xs)), "y": float(min(ys))},
        "max": {"x": float(max(xs)), "y": float(max(ys))},
    }


def _grid_lines_along_aa_bbox_boundary(doc: Document, *, level_id: str, bbox: dict[str, Any]) -> list[str]:
    tol = _SNAP_MM * 1.25
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    try:
        x0 = float(mn.get("x") or 0)
        y0 = float(mn.get("y") or 0)
        x1 = float(mx.get("x") or 0)
        y1 = float(mx.get("y") or 0)
    except (TypeError, ValueError):
        return []
    if x1 <= x0 or y1 <= y0:
        return []

    found: list[str] = []
    for e in doc.elements.values():
        if not isinstance(e, GridLineElem):
            continue
        if e.level_id and e.level_id != level_id:
            continue

        xa, ya = e.start.x_mm, e.start.y_mm
        xb, yb = e.end.x_mm, e.end.y_mm

        if abs(xa - xb) < 25.0:
            xv = float((xa + xb) / 2)
            ys_rng = sorted((ya, yb))

            if min(abs(xv - x0), abs(xv - x1)) <= tol and not (
                ys_rng[1] < y0 - tol or ys_rng[0] > y1 + tol

            ):
                found.append(e.id)

        elif abs(ya - yb) < 25.0:
            yh = float((ya + yb) / 2)
            xs_rng = sorted((xa, xb))

            if min(abs(yh - y0), abs(yh - y1)) <= tol and not (
                xs_rng[1] < x0 - tol or xs_rng[0] > x1 + tol

            ):
                found.append(e.id)

    return sorted(set(found))


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


def _authored_room_overlaps_candidate_bbox(rooms: list[RoomElem], cand_bbox: dict[str, Any]) -> bool:
    mn = cand_bbox.get("min") or {}
    mx = cand_bbox.get("max") or {}
    cx0 = float(mn.get("x") or 0)
    cy0 = float(mn.get("y") or 0)
    cx1 = float(mx.get("x") or 0)
    cy1 = float(mx.get("y") or 0)
    if cx1 <= cx0 or cy1 <= cy0:
        return False
    for rm in rooms:
        bb = _outline_aa_bbox_mm(rm)
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
        if _aa_rect_intersection_area_m2(cx0, cy0, cx1, cy1, rx0, ry0, rx1, ry1) > 1e-12:
            return True
    return False


def _separation_ids_splitting_candidate_bbox(
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

    authored_by_level: defaultdict[str, list[RoomElem]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, RoomElem):
            authored_by_level[ent.level_id].append(ent)

    warnings: list[dict[str, Any]] = []
    for cand in sorted(dedup.values(), key=_sig):
        lid = str(cand.get("levelId") or "")
        bbox = cand.get("bboxMm") if isinstance(cand.get("bboxMm"), dict) else {}
        sep_ids = _separation_ids_splitting_candidate_bbox(doc, level_id=lid, bbox=bbox)
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

        authored = authored_by_level.get(lid, [])
        if _authored_room_overlaps_candidate_bbox(authored, bbox):
            continue
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
        "heuristicVersion": "room_deriv_preview_v2",
        "axisAlignedRectangleCandidates": sorted(dedup.values(), key=_sig),
        "candidateCount": len(dedup),
        "warnings": warnings,
    }


def _candidate_id_stable(c: dict[str, Any]) -> str:
    canon = {
        "levelId": str(c.get("levelId") or ""),
        "wallIds": sorted(c.get("wallIds") or []),
        "bbox": c.get("bboxMm"),
        "kind": str(c.get("kind") or ""),
    }
    body = json.dumps(canon, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()[:24]


def _outline_mm_ccw_rectangle(bbox: dict[str, Any]) -> list[dict[str, float]]:
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


def room_derivation_candidates_review(doc: Document) -> dict[str, Any]:
    """Review payload: deterministic ids + explicit assumptions + suggested outline-only command."""

    preview = room_derivation_preview(doc)
    out_candidates: list[dict[str, Any]] = []

    authored_by_level: defaultdict[str, list[RoomElem]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, RoomElem):
            authored_by_level[ent.level_id].append(ent)

    base_assumptions = (
        "Heuristic detects axis-aligned rectangles from four orthogonal wall segments only.",
        "Suggested command uses createRoomOutline (room only; respects existing perimeter walls).",
        "Comparison loop flags overlaps with authored rooms and neighbouring candidates (bbox proxy).",
        "Axis-aligned separators that pierce derived bbox interiors emit derivedRectangleInteriorRoomSeparation.",
    )

    def _candidate_bbox_nums(b: dict[str, Any]) -> tuple[float, float, float, float, float]:
        mn0 = b.get("min") or {}
        mx0 = b.get("max") or {}
        x_lo = float(mn0.get("x") or 0)
        y_lo = float(mn0.get("y") or 0)
        x_hi = float(mx0.get("x") or 0)
        y_hi = float(mx0.get("y") or 0)
        area = max(0.0, (x_hi - x_lo) / 1000.0) * max(0.0, (y_hi - y_lo) / 1000.0)
        return x_lo, y_lo, x_hi, y_hi, area

    for raw in preview.get("axisAlignedRectangleCandidates") or []:
        if not isinstance(raw, dict):
            continue
        cid = _candidate_id_stable(raw)
        bbox = raw.get("bboxMm") if isinstance(raw.get("bboxMm"), dict) else {}
        outline = _outline_mm_ccw_rectangle(bbox)
        lvl_id = str(raw.get("levelId") or "")

        suggested = {
            "type": "createRoomOutline",
            "name": f"Derived-{cid[:8]}",
            "levelId": lvl_id,
            "outlineMm": outline,
        }

        cx_lo, cy_lo, cx_hi, cy_hi, cand_area_m2 = _candidate_bbox_nums(bbox)
        perim_m = 0.0
        if cx_hi > cx_lo and cy_hi > cy_lo:
            perim_m = round(2.0 * ((cx_hi - cx_lo) + (cy_hi - cy_lo)) / 1000.0, 4)

        grid_hints = _grid_lines_along_aa_bbox_boundary(doc, level_id=lvl_id, bbox=bbox)

        warnings_local: list[dict[str, Any]] = []
        comparison_rows: list[dict[str, Any]] = []
        overlap_best = 0.0

        sep_rs = _separation_ids_splitting_candidate_bbox(doc, level_id=lvl_id, bbox=bbox)
        if sep_rs:
            warnings_local.append(
                {
                    "code": "derivedRectangleInteriorRoomSeparation",
                    "severity": "warning",
                    "levelId": lvl_id,
                    "wallIds": sorted(raw.get("wallIds") or []),
                    "separationIds": sep_rs,
                    "message": (
                        "An axis-aligned room separation pierces this derived rectangle bbox interior; "
                        "expect multiple rooms or adjust separators before trusting a single createRoomOutline."
                    ),
                }
            )

        for rm in authored_by_level.get(lvl_id, ()):

            abb = _outline_aa_bbox_mm(rm)
            if abb is None:
                continue

            rx_lo, ry_lo, rx_hi, ry_hi, room_area_m2 = _candidate_bbox_nums(abb)

            inter_m2 = _aa_rect_intersection_area_m2(cx_lo, cy_lo, cx_hi, cy_hi, rx_lo, ry_lo, rx_hi, ry_hi)

            if inter_m2 <= 0:

                continue

            union_den = cand_area_m2 + room_area_m2 - inter_m2

            iou_approx = round(inter_m2 / union_den, 4) if union_den > 1e-9 else 0.0

            cov_cand = round(inter_m2 / cand_area_m2, 4) if cand_area_m2 > 1e-9 else 0.0

            cov_rm = round(inter_m2 / room_area_m2, 4) if room_area_m2 > 1e-9 else 0.0

            overlap_best = max(overlap_best, cov_cand)

            comparison_rows.append(
                {
                    "roomId": rm.id,

                    "roomName": rm.name or rm.id,

                    "iouApprox": iou_approx,

                    "intersectionAreaM2": round(inter_m2, 4),

                    "coverageOfCandidate": cov_cand,

                    "coverageOfAuthoredRoom": cov_rm,

                }

            )

        comparison_rows.sort(key=lambda r: (-float(r.get("iouApprox") or 0.0), str(r.get("roomId"))))

        if overlap_best >= 0.82:

            warnings_local.append(
                {

                    "code": "overlap_authored_room",

                    "severity": "warning",

                    "message": (

                        "Candidate footprint largely coincides with an authored room bbox on the same level."

                    ),

                }

            )

        scheme_hint = "#38bdf8"

        if warnings_local:

            scheme_hint = "#fbbf24"

        item = {
            **raw,
            "candidateId": cid,
            "assumptions": list(base_assumptions),
            "suggestedCommand": suggested,
            "suggestedBundleCommands": [suggested],
            "perimeterApproxM": perim_m,
            "separationHintGridLineIds": grid_hints,
            "classificationHints": {
                "planCategory": "axis_aligned_rectangle",
                "schemeColorHint": scheme_hint,
            },
            "comparisonToAuthoredRooms": comparison_rows,
            "warnings": warnings_local,
        }
        out_candidates.append(item)

    for i, a in enumerate(out_candidates):
        bbox_a = a.get("bboxMm") if isinstance(a.get("bboxMm"), dict) else {}
        ax_lo, ay_lo, ax_hi, ay_hi, area_a = _candidate_bbox_nums(bbox_a)
        if area_a <= 1e-9:
            continue
        for j in range(i + 1, len(out_candidates)):
            b = out_candidates[j]
            if str(b.get("levelId") or "") != str(a.get("levelId") or ""):
                continue
            bbox_b = b.get("bboxMm") if isinstance(b.get("bboxMm"), dict) else {}
            bx_lo, by_lo, bx_hi, by_hi, area_b = _candidate_bbox_nums(bbox_b)
            if area_b <= 1e-9:
                continue
            inter_m2 = _aa_rect_intersection_area_m2(ax_lo, ay_lo, ax_hi, ay_hi, bx_lo, by_lo, bx_hi, by_hi)
            smaller = min(area_a, area_b)
            if smaller <= 0:
                continue
            if inter_m2 / smaller >= 0.12:

                wa = a.setdefault("warnings", [])

                wb = b.setdefault("warnings", [])

                if isinstance(wa, list):

                    wa.append(
                        {
                            "code": "candidate_overlap_sibling",
                            "severity": "info",
                            "message": (
                                "Another derived candidate on this level shares footprint with this bbox proxy."
                            ),
                        }

                    )

                if isinstance(wb, list):

                    wb.append(
                        {
                            "code": "candidate_overlap_sibling",
                            "severity": "info",
                            "message": (
                                "Another derived candidate on this level shares footprint with this bbox proxy."
                            ),
                        }

                    )

                hints_a = a.setdefault("classificationHints", {})

                hints_b = b.setdefault("classificationHints", {})

                if isinstance(hints_a, dict):

                    hints_a["schemeColorHint"] = "#fb7185"

                if isinstance(hints_b, dict):

                    hints_b["schemeColorHint"] = "#fb7185"

    return {
        "format": "roomDerivationCandidates_v1",
        "heuristicVersion": preview.get("heuristicVersion"),
        "candidateCount": len(out_candidates),
        "candidates": sorted(out_candidates, key=lambda x: (x.get("levelId", ""), x.get("candidateId", ""))),
    }
