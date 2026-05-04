"""CSV serialization for derived schedule payloads (paired with derive_schedule_table)."""

from __future__ import annotations

import csv
import io
from typing import Any


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


def schedule_payload_to_csv(payload: dict[str, Any]) -> str:
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
            return buf.getvalue()
        w.writerow(["Group", *keys])
        for label, grp in grouped.items():
            if not isinstance(grp, list):
                continue
            for r in grp:
                if not isinstance(r, dict):
                    continue
                w.writerow([str(label), *[str(r.get(k, "")) for k in keys]])
        return buf.getvalue()

    rows_raw = payload.get("rows")
    if not isinstance(rows_raw, list) or not rows_raw:
        return buf.getvalue()

    rows = [r for r in rows_raw if isinstance(r, dict)]
    if not rows:
        return buf.getvalue()

    keys = cols if cols else sorted({k for r in rows for k in r})
    w.writerow(keys)
    for r in rows:
        w.writerow([str(r.get(k, "")) for k in keys])

    return buf.getvalue()
