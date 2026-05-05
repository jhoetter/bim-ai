"""CSV serialization for derived schedule payloads (paired with derive_schedule_table)."""

from __future__ import annotations

import csv
import io
import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from bim_ai.document import Document


def _schedule_row_csv_cell(v: Any) -> str:
    if v is None or v == "":
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, dict | list):
        return json.dumps(v, sort_keys=True, separators=(",", ":"))
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else f"{v:g}"
    return str(v)


def _scalar_totals_csv_cell(v: Any) -> str:
    if v is None or v == "":
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else f"{v:g}"
    return str(v)


def _append_schedule_totals_csv(buf: io.StringIO, totals: dict[str, Any]) -> None:
    scalars: dict[str, Any] = {}
    for k, v in totals.items():
        if isinstance(v, dict | list):
            continue
        scalars[str(k)] = v
    if not scalars:
        return
    w = csv.writer(buf)
    w.writerow([])
    w.writerow(["__schedule_totals_v1__", "metric", "value"])
    for key in sorted(scalars.keys()):
        w.writerow(["", key, _scalar_totals_csv_cell(scalars[key])])


def _maybe_append_totals_block(main_csv: str, payload: dict[str, Any], *, include_totals_csv: bool) -> str:
    if not include_totals_csv:
        return main_csv
    raw = payload.get("totals")
    if not isinstance(raw, dict) or not raw:
        return main_csv
    tail = io.StringIO()
    _append_schedule_totals_csv(tail, raw)
    return main_csv + tail.getvalue()


def schedule_payload_with_column_subset(payload: dict[str, Any], columns: list[str]) -> dict[str, Any]:
    """Return a shallow copy with ``columns`` restricted (CSV/query MVP)."""

    if not columns:
        return payload
    keep = list(dict.fromkeys(columns))
    keep_set = set(keep)
    p = dict(payload)
    existing = list(p.get("columns") or [])
    if existing:
        filtered = [c for c in existing if c in keep_set]
        if filtered:
            p["columns"] = filtered
        else:
            p["columns"] = [c for c in keep if c in existing]
    else:
        p["columns"] = keep
    return p


def schedule_payload_to_csv(payload: dict[str, Any], *, include_totals_csv: bool = False) -> str:
    grouped = payload.get("groupedSections")
    cols = list(payload.get("columns") or [])
    buf = io.StringIO()
    w = csv.writer(buf)

    if isinstance(grouped, dict) and grouped:
        keys = list(cols)
        if not keys:
            for grp in grouped.values():
                if isinstance(grp, list):
                    for r in grp:
                        if isinstance(r, dict):
                            keys = sorted(r.keys())
                            break
                    if keys:
                        break
        if not keys:
            return _maybe_append_totals_block(buf.getvalue(), payload, include_totals_csv=include_totals_csv)
        w.writerow(["Group", *keys])
        for label, grp in grouped.items():
            if not isinstance(grp, list):
                continue
            for r in grp:
                if not isinstance(r, dict):
                    continue
                w.writerow([str(label), *[_schedule_row_csv_cell(r.get(k, "")) for k in keys]])
        return _maybe_append_totals_block(buf.getvalue(), payload, include_totals_csv=include_totals_csv)

    rows_raw = payload.get("rows")
    if not isinstance(rows_raw, list) or not rows_raw:
        return _maybe_append_totals_block(buf.getvalue(), payload, include_totals_csv=include_totals_csv)

    rows = [r for r in rows_raw if isinstance(r, dict)]
    if not rows:
        return _maybe_append_totals_block(buf.getvalue(), payload, include_totals_csv=include_totals_csv)

    keys = cols if cols else sorted({k for r in rows for k in r})
    w.writerow(keys)
    for r in rows:
        w.writerow([_schedule_row_csv_cell(r.get(k, "")) for k in keys])

    return _maybe_append_totals_block(buf.getvalue(), payload, include_totals_csv=include_totals_csv)


def scheduleCsvExportParityEvidence_v1(doc: Document) -> dict[str, Any]:
    """Per-category row/column counts + content digest for all schedules in doc."""

    import hashlib

    from bim_ai.schedule_derivation import derive_schedule_table, list_schedule_ids

    by_cat: dict[str, Any] = {}
    for sch_id in list_schedule_ids(doc):
        try:
            payload = derive_schedule_table(doc, sch_id)
        except Exception:
            continue
        cat = str(payload.get("category") or "")
        csv_txt = schedule_payload_to_csv(payload)
        csv_lines = [ln for ln in csv_txt.splitlines() if ln.strip()]
        csv_row_count = max(0, len(csv_lines) - 1)
        cols = list(payload.get("columns") or [])
        grouped = payload.get("groupedSections")
        if isinstance(grouped, dict):
            json_row_count = sum(len(v) for v in grouped.values() if isinstance(v, list))
        else:
            rows_raw = payload.get("rows")
            json_row_count = len(rows_raw) if isinstance(rows_raw, list) else 0
        digest = hashlib.sha256(csv_txt.encode("utf-8")).hexdigest()
        by_cat[cat] = {
            "category": cat,
            "scheduleId": sch_id,
            "csvRowCount": csv_row_count,
            "jsonRowCount": json_row_count,
            "columnCount": len(cols),
            "columns": cols,
            "csvContentDigestSha256": digest,
            "parityAligned": csv_row_count == json_row_count,
        }
    return {
        "format": "scheduleCsvExportParityEvidence_v1",
        "categories": by_cat,
    }
