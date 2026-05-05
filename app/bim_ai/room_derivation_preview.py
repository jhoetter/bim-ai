"""Bounded room-loop preview from orthogonal walls ± separators (WP-B06 / WP-C04).

Delegates deterministic closure and authority classification to :mod:`bim_ai.room_derivation`.
Review payloads attach stable ids + suggested ``createRoomOutline`` commands only.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import GridLineElem, RoomElem
from bim_ai.room_derivation import (
    aa_rect_intersection_area_m2,
    compute_room_boundary_derivation,
    footprint_outline_mm_rectangle,
    outline_aa_bbox_mm,
    separation_ids_splitting_candidate_bbox,
    stable_footprint_id,
)

_SNAP_MM = 50.0


def _grid_lines_along_aa_bbox_boundary(
    doc: Document, *, level_id: str, bbox: dict[str, Any]
) -> list[str]:
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


def room_derivation_preview(doc: Document) -> dict[str, Any]:
    """Return deterministic facts for agent/UI comparison surfaces."""

    bundle = compute_room_boundary_derivation(doc)
    diagnostics_sorted = sorted(
        bundle.get("diagnostics") or [],
        key=lambda x: (
            str(x.get("levelId")),
            str(x.get("code")),
            str(x.get("diagnosticId")),
        ),
    )

    preview_out = dict(bundle)
    preview_out["diagnostics"] = diagnostics_sorted
    preview_out["diagnosticCount"] = len(diagnostics_sorted)
    preview_out["authorityVersion"] = "axis_aa_authoritative_v2"
    return preview_out


def _candidate_id_stable(c: dict[str, Any]) -> str:
    return stable_footprint_id(c)


def room_derivation_candidates_review(doc: Document) -> dict[str, Any]:
    """Review payload: deterministic ids + explicit assumptions + suggested outline-only command."""

    preview = room_derivation_preview(doc)
    out_candidates: list[dict[str, Any]] = []

    authored_by_level: defaultdict[str, list[RoomElem]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, RoomElem):
            authored_by_level[ent.level_id].append(ent)

    base_assumptions = (
        "Orthogonal rectangles from merged axis-aligned walls and axis-aligned room separation segments.",
        "Suggested command uses createRoomOutline (room only; respects existing perimeter walls).",
        "Comparison loop flags overlaps with authored rooms and neighbouring candidates (bbox proxy).",
        "Axis-aligned separators piercing derived bbox interiors emit derivedRectangleInteriorRoomSeparation.",
        "Derivation authority authoritative only when perimeter is unambiguous and footprint is vacant.",
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
        outline = footprint_outline_mm_rectangle(bbox)

        lvl_id = str(raw.get("levelId") or "")

        suggested = {
            "type": "createRoomOutline",
            "name": f"Derived-{cid[:8]}",
            "levelId": lvl_id,
            "outlineMm": [{"xMm": float(p["xMm"]), "yMm": float(p["yMm"])} for p in outline],
        }

        cx_lo, cy_lo, cx_hi, cy_hi, cand_area_m2 = _candidate_bbox_nums(bbox)
        perim_m = (
            round(2.0 * ((cx_hi - cx_lo) + (cy_hi - cy_lo)) / 1000.0, 4)
            if cx_hi > cx_lo and cy_hi > cy_lo
            else 0.0
        )

        grid_hints = _grid_lines_along_aa_bbox_boundary(doc, level_id=lvl_id, bbox=bbox)

        warnings_local: list[dict[str, Any]] = []
        comparison_rows: list[dict[str, Any]] = []
        overlap_best = 0.0

        sep_rs = separation_ids_splitting_candidate_bbox(doc, level_id=lvl_id, bbox=bbox)
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
            abb = outline_aa_bbox_mm(rm)
            if abb is None:
                continue
            rx_lo, ry_lo, rx_hi, ry_hi, room_area_m2 = _candidate_bbox_nums(abb)
            inter_m2 = aa_rect_intersection_area_m2(
                cx_lo, cy_lo, cx_hi, cy_hi, rx_lo, ry_lo, rx_hi, ry_hi
            )
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

        comparison_rows.sort(
            key=lambda r: (-float(r.get("iouApprox") or 0.0), str(r.get("roomId")))
        )

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
        authority = raw.get("derivationAuthority")
        if sep_rs:
            scheme_hint = "#fbbf24"
        elif authority == "authoritative":
            scheme_hint = "#22c55e"

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
                "derivationAuthority": authority,
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
            inter_m2 = aa_rect_intersection_area_m2(
                ax_lo, ay_lo, ax_hi, ay_hi, bx_lo, by_lo, bx_hi, by_hi
            )
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
        "candidates": sorted(
            out_candidates, key=lambda x: (x.get("levelId", ""), x.get("candidateId", ""))
        ),
    }


_outline_aa_bbox_mm = outline_aa_bbox_mm
_aa_rect_intersection_area_m2 = aa_rect_intersection_area_m2
_separation_ids_splitting_candidate_bbox = separation_ids_splitting_candidate_bbox
