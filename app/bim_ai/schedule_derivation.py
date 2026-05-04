"""Derive tabular schedule rows from semantic model (server-side projection)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, RoomElem, ScheduleElem, WallElem, WindowElem


def _level_labels(doc: Document) -> dict[str, str]:
    out: dict[str, str] = {}
    for e in doc.elements.values():
        if isinstance(e, LevelElem):
            out[e.id] = e.name or e.id
    return out


def _wall_level(doc: Document) -> dict[str, str]:
    m: dict[str, str] = {}
    for e in doc.elements.values():
        if isinstance(e, WallElem):
            m[e.id] = e.level_id
    return m


def _room_polygon_area_perimeter_sqm(outline: list[dict[str, float] | tuple]) -> tuple[float, float]:
    n = len(outline)
    if n < 3:
        return 0.0, 0.0
    a2 = 0.0
    per_m = 0.0
    for i in range(n):
        p = outline[i]  # type: ignore[index]
        q = outline[(i + 1) % n]  # type: ignore[index]
        if isinstance(p, tuple):
            px, py = float(p[0]), float(p[1])
        else:
            px = float(p.get("xMm") or p.get("x_mm") or 0)
            py = float(p.get("yMm") or p.get("y_mm") or 0)
        if isinstance(q, tuple):
            qx, qy = float(q[0]), float(q[1])
        else:
            qx = float(q.get("xMm") or q.get("x_mm") or 0)
            qy = float(q.get("yMm") or q.get("y_mm") or 0)
        a2 += px * qy - qx * py
        per_m += ((qx - px) ** 2 + (qy - py) ** 2) ** 0.5 / 1000.0
    return abs(a2 / 2) / 1_000_000.0, per_m


def derive_schedule_table(doc: Document, schedule_id: str) -> dict[str, Any]:
    sch = doc.elements.get(schedule_id)
    if not isinstance(sch, ScheduleElem):
        raise ValueError(f"schedule id '{schedule_id}' not found or not a schedule")
    filt = dict(sch.filters or {})
    cat = str(filt.get("category") or filt.get("Category") or "room").lower()

    lvl_lab = _level_labels(doc)
    w_lv = _wall_level(doc)

    grouping_hint = filt.get("groupingHint") or filt.get("group_by")
    group_keys: list[str] = []
    if isinstance(grouping_hint, list):
        group_keys = [str(x) for x in grouping_hint]
    key_aliases = {"familyTypeMark": "familyTypeId"}

    rows: list[dict[str, Any]] = []

    if cat == "room":
        for e in doc.elements.values():
            if isinstance(e, RoomElem):
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.outline_mm]
                area, perimeter = _room_polygon_area_perimeter_sqm(pts)
                lev = lvl_lab.get(e.level_id, e.level_id)
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "levelId": e.level_id,
                        "level": lev,
                        "areaM2": round(area, 3),
                        "perimeterM": round(perimeter, 3),
                        "familyTypeId": "",
                    }
                )

    elif cat == "door":
        for e in doc.elements.values():
            if isinstance(e, DoorElem):
                lid = w_lv.get(e.wall_id, "")
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "wallId": e.wall_id,
                        "levelId": lid,
                        "level": lvl_lab.get(lid, lid or "—"),
                        "widthMm": e.width_mm,
                        "familyTypeId": getattr(e, "family_type_id", "") or "",
                    }
                )

    elif cat == "window":
        for e in doc.elements.values():
            if isinstance(e, WindowElem):
                lid = w_lv.get(e.wall_id, "")
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "wallId": e.wall_id,
                        "levelId": lid,
                        "level": lvl_lab.get(lid, lid or "—"),
                        "widthMm": e.width_mm,
                        "heightMm": e.height_mm,
                        "sillMm": e.sill_height_mm,
                        "familyTypeId": getattr(e, "family_type_id", "") or "",
                    }
                )

    else:
        rows = []

    # Grouping / sorting on server hint
    grouped: dict[str, list[dict[str, Any]]] | None = None
    if group_keys:

        def gkey(row: dict[str, Any]) -> tuple:
            vals = []
            for k in group_keys:
                lk = key_aliases.get(k, k)

                vals.append(row.get(lk))
            return tuple(vals)

        buckets: defaultdict[tuple, list[dict[str, Any]]] = defaultdict(list)
        for r in rows:
            buckets[gkey(r)].append(r)
        grouped = {}
        for k in sorted(buckets.keys(), key=lambda x: "".join(map(str, x))):
            sub = sorted(buckets[k], key=lambda r: str(r.get("name", "")))
            grouped[" / ".join(str(x) for x in k)] = sub

    columns = sorted({k for r in rows for k in r.keys()}) if rows else []

    sch_group = sch.grouping or {}
    stable_sort_field = sch_group.get("sortBy")

    def sort_rs(rs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if stable_sort_field and stable_sort_field in (rows[0] if rows else {}):
            return sorted(rs, key=lambda x: x.get(stable_sort_field, ""))
        return sorted(rs, key=lambda x: str(x.get("name", "") or x.get("elementId")))

    if grouped:
        grouped = {lbl: sort_rs(gs) for lbl, gs in grouped.items()}
        total_rows = sum(len(gs) for gs in grouped.values())
    else:
        rows = sort_rs(rows)
        total_rows = len(rows)

    leaf_rows: list[dict[str, Any]]
    if grouped:
        leaf_rows = []
        for grp in grouped.values():
            leaf_rows.extend(grp)
    else:
        leaf_rows = list(rows)

    totals: dict[str, Any] = {}
    if cat == "room" and leaf_rows:
        totals = {
            "kind": "room",
            "rowCount": len(leaf_rows),
            "areaM2": round(sum(float(r.get("areaM2") or 0.0) for r in leaf_rows), 4),
            "perimeterM": round(sum(float(r.get("perimeterM") or 0.0) for r in leaf_rows), 4),
        }
    elif cat == "window" and leaf_rows:
        totals = {
            "kind": "window",
            "rowCount": len(leaf_rows),
            "averageWidthMm": round(
                sum(float(r.get("widthMm") or 0.0) for r in leaf_rows) / max(len(leaf_rows), 1),
                3,
            ),
        }
    elif cat == "door" and leaf_rows:
        totals = {"kind": "door", "rowCount": len(leaf_rows)}

    out: dict[str, Any] = {
        "scheduleId": schedule_id,
        "name": sch.name,
        "category": cat,
        "columns": columns,
        "totalRows": total_rows,
        "groupKeys": group_keys,
        **({"groupedSections": grouped} if grouped else {"rows": rows}),
    }
    if totals:
        out["totals"] = totals
    return out


def list_schedule_ids(doc: Document) -> list[str]:
    return [e.id for e in doc.elements.values() if isinstance(e, ScheduleElem)]
