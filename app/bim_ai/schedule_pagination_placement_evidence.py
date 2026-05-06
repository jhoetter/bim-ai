"""Deterministic schedule pagination / sheet placement evidence (WP-G01 / WP-C05 / WP-A02)."""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import ScheduleElem, SheetElem

# Deterministic print-surrogate row budget: title band + header reserve, then fixed pitch.
SCHEDULE_PLACEMENT_HEADER_RESERVE_MM = 12.0
SCHEDULE_PLACEMENT_ROW_PITCH_MM = 4.5

FORMAT_V0 = "schedulePaginationPlacementEvidence_v0"

ADV_UNPLACED = "schedule_pagination_unplaced"
ADV_VIEWPORT_MISSING = "schedule_pagination_viewport_missing"
ADV_MULTI_SEGMENT = "schedule_pagination_multi_segment"
ADV_GEOMETRY_DEGENERATE = "schedule_pagination_geometry_degenerate"


def flatten_leaf_rows_from_schedule_table_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Match CSV / table body order: grouped sections in payload key order, else flat rows."""

    gs = payload.get("groupedSections")
    if isinstance(gs, dict) and gs:
        out: list[dict[str, Any]] = []
        for _label, grp in gs.items():
            if not isinstance(grp, list):
                continue
            for r in grp:
                if isinstance(r, dict):
                    out.append(r)
        return out
    rows = payload.get("rows")
    if isinstance(rows, list):
        return [r for r in rows if isinstance(r, dict)]
    return []


def _stable_row_key(row: dict[str, Any], row_index: int) -> str:
    eid = row.get("elementId") if "elementId" in row else row.get("element_id")
    if eid is not None and str(eid).strip():
        return str(eid).strip()
    return f"__row_{row_index}"


def _viewport_height_mm(vp: dict[str, Any]) -> float:
    try:
        h = float(
            vp.get("heightMm") if vp.get("heightMm") is not None else vp.get("height_mm") or 0.0
        )
    except (TypeError, ValueError):
        return 0.0
    return h


def find_schedule_viewport_for_sheet(
    doc: Document, sheet_id: str, schedule_id: str
) -> tuple[dict[str, Any] | None, str | None]:
    """First matching ``schedule:<schedule_id>`` viewport on the sheet, stable by viewport id."""

    sh = doc.elements.get(sheet_id)
    if not isinstance(sh, SheetElem):
        return None, None
    raw = sh.viewports_mm or ()
    candidates: list[tuple[str, dict[str, Any]]] = []
    for i, vp_any in enumerate(raw):
        if not isinstance(vp_any, dict):
            continue
        vp = vp_any
        vr_raw = vp.get("viewRef") or vp.get("view_ref")
        if not isinstance(vr_raw, str) or ":" not in vr_raw:
            continue
        kind_raw, ref_raw = vr_raw.split(":", 1)
        if kind_raw.strip().lower() != "schedule" or ref_raw.strip() != schedule_id:
            continue
        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
        if not vid:
            vid = f"__implicit_{i}"
        candidates.append((vid, vp))
    if not candidates:
        return None, None
    candidates.sort(key=lambda t: t[0])
    vid0, vp0 = candidates[0]
    return vp0, vid0


def _rows_per_segment_for_height(viewport_height_mm: float) -> tuple[int, bool]:
    """Return (rows_per_segment, geometry_degenerate)."""

    if not math.isfinite(viewport_height_mm) or viewport_height_mm <= 0:
        return 1, True
    usable = viewport_height_mm - SCHEDULE_PLACEMENT_HEADER_RESERVE_MM
    if usable <= 0:
        return 1, True
    rps = int(math.floor(usable / SCHEDULE_PLACEMENT_ROW_PITCH_MM))
    rps = max(1, rps)
    return rps, False


def build_schedule_pagination_placement_evidence_v0(
    doc: Document,
    schedule_id: str,
    *,
    schedule_el: ScheduleElem,
    leaf_rows: list[dict[str, Any]],
    total_rows: int,
    viewport_height_mm: float | None = None,
    sheet_viewport_id: str | None = None,
) -> dict[str, Any]:
    """
    Build ``schedulePaginationPlacementEvidence_v0``.

    When ``viewport_height_mm`` / ``sheet_viewport_id`` are omitted, resolves placement from
    ``schedule_el.sheetId`` and the first matching schedule viewport on that sheet.
    When provided (sheet manifest hints), uses that viewport geometry for pagination.
    """

    leaf_keys = [_stable_row_key(r, i) for i, r in enumerate(leaf_rows)]
    if total_rows != len(leaf_rows):
        total_rows = len(leaf_rows)

    advisories: set[str] = set()
    placement_sid = (schedule_el.sheet_id or "").strip()

    resolved_vp: dict[str, Any] | None = None
    resolved_vid: str | None = None
    height_for_pagination: float | None = None
    placement_status: str

    hint_scoped = (
        viewport_height_mm is not None
        and sheet_viewport_id is not None
        and math.isfinite(float(viewport_height_mm))
    )
    if hint_scoped:
        placement_status = "placed"
        resolved_vid = sheet_viewport_id.strip() or None
        height_for_pagination = float(viewport_height_mm)
    elif not placement_sid:
        placement_status = "unplaced"
        advisories.add(ADV_UNPLACED)
    else:
        pel = doc.elements.get(placement_sid)
        if not isinstance(pel, SheetElem):
            placement_status = "viewport_missing"
            advisories.add(ADV_VIEWPORT_MISSING)
        else:
            vp_row, vid = find_schedule_viewport_for_sheet(doc, placement_sid, schedule_id)
            if vp_row is None or not vid:
                placement_status = "viewport_missing"
                advisories.add(ADV_VIEWPORT_MISSING)
            else:
                resolved_vp = vp_row
                resolved_vid = vid
                placement_status = "placed"
                height_for_pagination = _viewport_height_mm(vp_row)

    rows_per_segment: int
    geom_degenerate = False

    if height_for_pagination is None:
        rows_per_segment = max(1, total_rows) if total_rows > 0 else 1
    else:
        rows_per_segment, geom_degenerate = _rows_per_segment_for_height(
            float(height_for_pagination)
        )
        if geom_degenerate:
            advisories.add(ADV_GEOMETRY_DEGENERATE)

    if total_rows == 0:
        segment_count = 1
        segments: list[dict[str, Any]] = []
    else:
        segment_count = max(1, math.ceil(total_rows / rows_per_segment))
        segments = []
        for idx in range(0, total_rows, rows_per_segment):
            chunk = leaf_keys[idx : idx + rows_per_segment]
            segments.append(
                {
                    "index": len(segments),
                    "rowCount": len(chunk),
                    "firstRowKey": chunk[0],
                    "lastRowKey": chunk[-1],
                }
            )

    if segment_count > 1:
        advisories.add(ADV_MULTI_SEGMENT)

    if total_rows == 0:
        clip_status = "fits"
    elif segment_count > 1:
        clip_status = "multi_segment"
    else:
        clip_status = "fits"

    if placement_status in {"unplaced", "viewport_missing"}:
        clip_status = "unknown"

    digest_obj: dict[str, Any] = {
        "rowsPerSegment": rows_per_segment,
        "scheduleId": schedule_id,
        "segments": segments,
        "totalRows": total_rows,
    }
    digest_sha = hashlib.sha256(
        json.dumps(digest_obj, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()

    out: dict[str, Any] = {
        "format": FORMAT_V0,
        "scheduleId": schedule_id,
        "totalRows": total_rows,
        "rowsPerSegment": rows_per_segment,
        "segmentCount": segment_count,
        "segments": segments,
        "sheetViewportId": resolved_vid,
        "placementStatus": placement_status,
        "clipStatus": clip_status,
        "digestSha256": digest_sha,
        "advisoryReasonCodes": sorted(advisories),
    }
    if resolved_vp is not None and not hint_scoped:
        out["viewportHeightMm"] = round(_viewport_height_mm(resolved_vp), 3)
    elif height_for_pagination is not None and math.isfinite(float(height_for_pagination)):
        out["viewportHeightMm"] = round(float(height_for_pagination), 3)

    return out
