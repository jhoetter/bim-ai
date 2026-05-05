"""Schedule sheet/export cross-format parity evidence (Wave-3 Prompt-3 re-run).

For every schedule placed on a sheet (``schedule:`` viewport), this module
produces a deterministic row that compares row counts across the four
schedule export surfaces:

- ``csvRowCount`` from :func:`schedule_csv.schedule_payload_to_csv`
- ``jsonRowCount`` from :func:`schedule_derivation.derive_schedule_table` (``totalRows``)
- ``svgListingRowCount`` parsed from the sheet viewport listing segment
  produced by :func:`sheet_preview_svg.format_schedule_viewport_documentation_segment`
- ``paginationSegmentCount`` from
  :func:`schedule_pagination_placement_evidence.build_schedule_pagination_placement_evidence_v0`

The parity token classifies any divergence so advisor rules can fire and
the schedule rail UI can surface the mismatch.

This layer intentionally **does not** introduce a new export pipeline,
HTTP endpoint, pagination engine, schedule kind, schema, or CI baseline
gate.  It only re-reads the existing helpers and asserts cross-format
consistency.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import ScheduleElem, SheetElem
from bim_ai.schedule_csv import schedule_payload_to_csv
from bim_ai.schedule_pagination_placement_evidence import (
    build_schedule_pagination_placement_evidence_v0,
    flatten_leaf_rows_from_schedule_table_payload,
)

FORMAT_V1 = "scheduleSheetExportParityEvidence_v1"

PARITY_ALIGNED = "aligned"
PARITY_CSV_DIVERGES = "csv_diverges"
PARITY_JSON_DIVERGES = "json_diverges"
PARITY_LISTING_DIVERGES = "listing_diverges"
PARITY_PLACEMENT_MISSING = "placement_missing"

ADV_CSV_DIVERGES = "schedule_sheet_export_parity_csv_diverges"
ADV_JSON_DIVERGES = "schedule_sheet_export_parity_json_diverges"
ADV_LISTING_DIVERGES = "schedule_sheet_export_parity_listing_diverges"

_LISTING_ROWS_RE = re.compile(r"\brows=(-?\d+)")


def _csv_data_row_count(csv_text: str) -> int:
    """Count CSV body rows, excluding the header and the optional totals tail block.

    The totals appender emits a blank row followed by a row whose first cell is
    ``__schedule_totals_v1__``; everything from the blank row onward is excluded.
    Returns 0 when the payload has no rows (CSV is empty).
    """
    if not csv_text:
        return 0
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        return 0
    body = rows[1:]
    count = 0
    for r in body:
        if not r or all((c or "") == "" for c in r):
            break
        if r and str(r[0]) == "__schedule_totals_v1__":
            break
        count += 1
    return count


def _listing_row_count_from_segment(seg: str) -> int | None:
    """Extract the ``rows=N`` integer from the schedule listing segment, if present."""
    if not seg:
        return None
    m = _LISTING_ROWS_RE.search(seg)
    if not m:
        return None
    try:
        return int(m.group(1))
    except (TypeError, ValueError):
        return None


def _classify_parity(
    *,
    csv_count: int,
    json_count: int,
    listing_count: int,
    leaf_count: int,
    placement_status: str,
) -> str:
    if placement_status != "placed":
        return PARITY_PLACEMENT_MISSING
    if json_count != leaf_count:
        return PARITY_JSON_DIVERGES
    if csv_count != json_count:
        return PARITY_CSV_DIVERGES
    if listing_count != json_count:
        return PARITY_LISTING_DIVERGES
    return PARITY_ALIGNED


def build_schedule_sheet_export_parity_row(
    doc: Document,
    sch: ScheduleElem,
    *,
    payload: dict[str, Any],
    pagination_evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build one parity row for *sch* using its derived ``payload``.

    Reuses the existing CSV serializer, pagination evidence, and the schedule
    listing segment helper. Does not mutate ``payload``.
    """
    # Local import: sheet_preview_svg pulls in schedule_derivation, which embeds
    # this module's evidence into derive_schedule_table — a top-level import would
    # form a cycle with the schedule_derivation -> schedule_sheet_export_parity edge.
    from bim_ai.sheet_preview_svg import (
        format_schedule_viewport_documentation_segment_from_payload,
    )

    sheet_id = (sch.sheet_id or "").strip()
    leaf_rows = flatten_leaf_rows_from_schedule_table_payload(payload)
    leaf_count = len(leaf_rows)
    try:
        json_count = int(payload.get("totalRows") or 0)
    except (TypeError, ValueError):
        json_count = 0

    if pagination_evidence is None:
        pagination_evidence = build_schedule_pagination_placement_evidence_v0(
            doc,
            sch.id,
            schedule_el=sch,
            leaf_rows=leaf_rows,
            total_rows=leaf_count,
        )

    placement_status = str(pagination_evidence.get("placementStatus") or "")
    viewport_id = pagination_evidence.get("sheetViewportId")
    try:
        segment_count = int(pagination_evidence.get("segmentCount") or 0)
    except (TypeError, ValueError):
        segment_count = 0

    csv_text = schedule_payload_to_csv(payload)
    csv_count = _csv_data_row_count(csv_text)

    listing_count = 0
    if placement_status == "placed":
        listing_seg = format_schedule_viewport_documentation_segment_from_payload(
            payload, fallback_schedule_id=sch.id
        )
        parsed = _listing_row_count_from_segment(listing_seg)
        listing_count = parsed if parsed is not None else 0

    token = _classify_parity(
        csv_count=csv_count,
        json_count=json_count,
        listing_count=listing_count,
        leaf_count=leaf_count,
        placement_status=placement_status,
    )

    row: dict[str, Any] = {
        "scheduleId": sch.id,
        "sheetId": sheet_id or None,
        "viewportId": (viewport_id or None) if isinstance(viewport_id, str) else None,
        "csvRowCount": csv_count,
        "jsonRowCount": json_count,
        "svgListingRowCount": listing_count,
        "paginationSegmentCount": segment_count,
        "crossFormatParityToken": token,
    }
    return row


def _digest_for_rows(rows: list[dict[str, Any]]) -> str:
    canon = json.dumps(rows, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def build_schedule_sheet_export_parity_evidence_v1_for_schedule(
    doc: Document,
    sch: ScheduleElem,
    *,
    payload: dict[str, Any],
    pagination_evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the single-schedule parity payload (embedded in derive_schedule_table)."""
    sheet_id = (sch.sheet_id or "").strip()
    if not sheet_id:
        rows: list[dict[str, Any]] = []
    else:
        rows = [
            build_schedule_sheet_export_parity_row(
                doc,
                sch,
                payload=payload,
                pagination_evidence=pagination_evidence,
            )
        ]
    return {
        "format": FORMAT_V1,
        "scheduleId": sch.id,
        "rows": rows,
        "scheduleSheetExportParityDigestSha256": _digest_for_rows(rows),
    }


def build_schedule_sheet_export_parity_evidence_v1_for_sheet(
    doc: Document, sh: SheetElem
) -> dict[str, Any]:
    """Build the parity payload for all schedules placed on *sh* (sheet manifest embed)."""
    # Local import — see build_schedule_sheet_export_parity_row for cycle rationale.
    from bim_ai.schedule_derivation import derive_schedule_table

    placed_schedule_ids: list[str] = []
    seen: set[str] = set()
    for vp in sh.viewports_mm or ():
        if not isinstance(vp, dict):
            continue
        vr = vp.get("viewRef") or vp.get("view_ref")
        if not isinstance(vr, str) or ":" not in vr:
            continue
        kind_raw, ref_raw = vr.split(":", 1)
        if kind_raw.strip().lower() != "schedule":
            continue
        sid = ref_raw.strip()
        if not sid or sid in seen:
            continue
        el = doc.elements.get(sid)
        if not isinstance(el, ScheduleElem):
            continue
        seen.add(sid)
        placed_schedule_ids.append(sid)

    placed_schedule_ids.sort()

    rows: list[dict[str, Any]] = []
    for sid in placed_schedule_ids:
        sch = doc.elements.get(sid)
        if not isinstance(sch, ScheduleElem):
            continue
        try:
            payload = derive_schedule_table(doc, sid)
        except (ValueError, TypeError, KeyError):
            continue
        row = build_schedule_sheet_export_parity_row(doc, sch, payload=payload)
        rows.append(row)

    rows.sort(key=lambda r: (str(r.get("scheduleId") or ""), str(r.get("viewportId") or "")))

    return {
        "format": FORMAT_V1,
        "sheetId": sh.id,
        "rows": rows,
        "scheduleSheetExportParityDigestSha256": _digest_for_rows(rows),
    }


def collect_schedule_sheet_export_parity_rows_for_doc(
    doc: Document,
) -> list[dict[str, Any]]:
    """Whole-doc parity rows (used by the constraint advisor)."""
    from bim_ai.schedule_derivation import derive_schedule_table

    schedules: list[ScheduleElem] = sorted(
        (e for e in doc.elements.values() if isinstance(e, ScheduleElem)),
        key=lambda s: s.id,
    )
    rows: list[dict[str, Any]] = []
    for sch in schedules:
        if not (sch.sheet_id or "").strip():
            continue
        try:
            payload = derive_schedule_table(doc, sch.id)
        except (ValueError, TypeError, KeyError):
            continue
        rows.append(build_schedule_sheet_export_parity_row(doc, sch, payload=payload))
    return rows
