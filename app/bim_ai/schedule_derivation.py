"""Derive tabular schedule rows from semantic model (server-side projection)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    PlanViewElem,
    RoofElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.schedule_field_registry import column_metadata_bundle, stable_column_keys
from bim_ai.type_material_registry import family_type_display_label, material_display_label

_NUMERIC_SCHEDULE_FIELDS: frozenset[str] = frozenset(
    {
        "areaM2",
        "perimeterM",
        "widthMm",
        "heightMm",
        "sillMm",
        "thicknessMm",
        "viewportCount",
        "overhangMm",
        "slopeDeg",
        "footprintAreaM2",
        "footprintPerimeterM",
        "riseMm",
        "runMm",
        "cropDepthMm",
    }
)


def _resolve_sort_descending(filt: dict[str, Any], sch_group: dict[str, Any]) -> bool:
    for d in (filt, sch_group):
        v = d.get("sortDescending")
        if v is None:
            v = d.get("sort_descending")
        if isinstance(v, bool):
            return v
        if isinstance(v, str) and v.strip().lower() in {"true", "1", "yes"}:
            return True
    return False


def _scalar_for_group_bucket(v: Any) -> tuple[int, Any]:
    """Deterministic ordering for group-key tuples (bucket labels)."""

    if v is None:
        return (0, "")
    if isinstance(v, bool):
        return (1, int(v))
    if isinstance(v, int | float) and not isinstance(v, bool):
        return (2, float(v))
    return (3, str(v).strip().lower())


def _group_bucket_sort_key(bucket_tuple: tuple[Any, ...]) -> tuple[tuple[int, Any], ...]:
    return tuple(_scalar_for_group_bucket(x) for x in bucket_tuple)


def _coerce_float_for_sort(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return float(int(raw))
    if isinstance(raw, int | float):
        return float(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            return float(raw)
        except ValueError:
            return None
    return None


def _primary_sort_key_part(row: dict[str, Any], field: str) -> tuple[int, float | str]:
    """Lower tuple orders first when sort ascending (ties use stable elementId pass)."""

    raw = row.get(field)
    if field in _NUMERIC_SCHEDULE_FIELDS:
        fv = _coerce_float_for_sort(raw)
        if fv is not None:
            return (0, fv)
        return (1, str(raw if raw is not None else "").strip().lower())
    if raw is None:
        return (2, "")
    if isinstance(raw, bool):
        return (2, str(int(raw)))
    if isinstance(raw, int | float) and not isinstance(raw, bool):
        return (0, float(raw))
    return (2, str(raw).strip().lower())


def _sort_rows_stable(
    rs: list[dict[str, Any]],
    *,
    sort_field: str | None,
    key_aliases: dict[str, str],
    sort_descending: bool,
    default_name_fallback: bool,
) -> list[dict[str, Any]]:
    """Stable sort: primary key with optional desc; Python stable sort + elementId prefetch fixes ties."""

    if not rs:
        return rs
    eid_ordered = sorted(rs, key=lambda r: str(r.get("elementId", "")))
    lk = key_aliases.get(sort_field, sort_field) if sort_field else None
    if sort_field and lk is not None and any(lk in r for r in rs):
        return sorted(
            eid_ordered,
            key=lambda r, lk=lk: _primary_sort_key_part(r, lk),
            reverse=sort_descending,
        )
    if default_name_fallback:
        return sorted(
            eid_ordered,
            key=lambda r: str(r.get("name", "") or r.get("elementId", "")).strip().lower(),
            reverse=sort_descending,
        )
    return eid_ordered


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


def _room_polygon_area_perimeter_sqm(
    outline: list[dict[str, float] | tuple],
) -> tuple[float, float]:
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


def _filter_equals_from_filters(filt: dict[str, Any]) -> dict[str, Any]:
    """Optional AND equality filters on derived row keys (``filterEquals`` / ``filter_equals``)."""

    raw = filt.get("filterEquals") or filt.get("filter_equals")
    if not isinstance(raw, dict) or not raw:
        return {}
    out: dict[str, Any] = {}
    for k, v in raw.items():
        sk = str(k).strip()
        if sk and v is not None:
            out[sk] = v
    return out


def _filter_value_matches(want: Any, got: Any) -> bool:
    if got is None and want not in (False, 0, 0.0, ""):
        return False
    if isinstance(want, bool):
        return bool(got) == want
    if isinstance(want, int | float) and not isinstance(want, bool):
        try:
            return float(got) == float(want)
        except (TypeError, ValueError):
            return False
    if isinstance(want, str):
        return str(got).strip() == want.strip()
    return got == want


def _rows_after_filter_equals(
    rows: list[dict[str, Any]], feq: dict[str, Any]
) -> list[dict[str, Any]]:
    if not feq:
        return rows
    return [
        r
        for r in rows
        if all(_filter_value_matches(want, r.get(field)) for field, want in feq.items())
    ]


def _resolve_group_keys(filt: dict[str, Any], sch_grouping: dict[str, Any]) -> list[str]:
    """Prefer ``filters.groupingHint``; else ``grouping.groupKeys`` (persisted canonical)."""

    hint = filt.get("groupingHint") or filt.get("group_by")
    if isinstance(hint, list) and hint:
        return [str(x) for x in hint]
    gk = sch_grouping.get("groupKeys") or sch_grouping.get("group_keys")
    if isinstance(gk, list) and gk:
        return [str(x) for x in gk]
    return []


def derive_schedule_table(doc: Document, schedule_id: str) -> dict[str, Any]:
    sch = doc.elements.get(schedule_id)
    if not isinstance(sch, ScheduleElem):
        raise ValueError(f"schedule id '{schedule_id}' not found or not a schedule")
    filt = dict(sch.filters or {})
    cat = str(filt.get("category") or filt.get("Category") or "room").lower()
    sch_group = dict(sch.grouping or {})

    lvl_lab = _level_labels(doc)
    w_lv = _wall_level(doc)

    group_keys = _resolve_group_keys(filt, sch_group)
    filter_equals = _filter_equals_from_filters(filt)
    sort_descending = _resolve_sort_descending(filt, sch_group)
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
                        "programmeCode": (e.programme_code or "").strip(),
                        "department": (e.department or "").strip(),
                        "functionLabel": (e.function_label or "").strip(),
                        "finishSet": (e.finish_set or "").strip(),
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
                        "materialKey": (getattr(e, "material_key", None) or "").strip(),
                        "materialDisplay": material_display_label(
                            doc,
                            getattr(e, "material_key", None),
                        ),
                        "familyTypeDisplay": family_type_display_label(
                            doc, getattr(e, "family_type_id", None)
                        ),
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
                        "materialKey": (getattr(e, "material_key", None) or "").strip(),
                        "materialDisplay": material_display_label(
                            doc,
                            getattr(e, "material_key", None),
                        ),
                        "familyTypeDisplay": family_type_display_label(
                            doc, getattr(e, "family_type_id", None)
                        ),
                    }
                )

    elif cat == "floor":
        for e in doc.elements.values():
            if isinstance(e, FloorElem):
                lev = lvl_lab.get(e.level_id, e.level_id)
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.boundary_mm]
                area, perimeter = _room_polygon_area_perimeter_sqm(pts)
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "levelId": e.level_id,
                        "level": lev,
                        "thicknessMm": round(float(e.thickness_mm), 3),
                        "areaM2": round(area, 3),
                        "perimeterM": round(perimeter, 3),
                        "familyTypeId": "",
                    }
                )

    elif cat == "roof":
        for e in doc.elements.values():
            if isinstance(e, RoofElem):
                rl = lvl_lab.get(e.reference_level_id, e.reference_level_id or "—")
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.footprint_mm]
                area, perimeter = _room_polygon_area_perimeter_sqm(pts)
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "referenceLevelId": e.reference_level_id,
                        "referenceLevel": rl,
                        "overhangMm": round(float(e.overhang_mm or 0.0), 3),
                        "slopeDeg": round(float(e.slope_deg or 0.0), 3),
                        "footprintAreaM2": round(area, 3),
                        "footprintPerimeterM": round(perimeter, 3),
                        "familyTypeId": "",
                    }
                )

    elif cat == "stair":
        bl = {eid: el for eid, el in doc.elements.items() if isinstance(el, LevelElem)}
        for e in doc.elements.values():
            if isinstance(e, StairElem):
                bs = bl.get(e.base_level_id)
                ts = bl.get(e.top_level_id)
                rise_mm = (
                    abs(ts.elevation_mm - bs.elevation_mm)
                    if isinstance(bs, LevelElem) and isinstance(ts, LevelElem)
                    else float(getattr(e, "riser_mm", 0.0)) * 16.0
                )
                p0 = e.run_start.x_mm, e.run_start.y_mm
                p1 = e.run_end.x_mm, e.run_end.y_mm
                run_mm = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "baseLevelId": e.base_level_id,
                        "topLevelId": e.top_level_id,
                        "baseLevel": lvl_lab.get(e.base_level_id, e.base_level_id),
                        "topLevel": lvl_lab.get(e.top_level_id, e.top_level_id),
                        "riseMm": round(float(rise_mm), 3),
                        "runMm": round(float(run_mm), 3),
                        "widthMm": round(float(e.width_mm), 3),
                        "familyTypeId": "",
                    }
                )

    elif cat == "sheet":
        for e in doc.elements.values():
            if isinstance(e, SheetElem):
                vps = getattr(e, "viewports_mm", ()) or ()
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "titleBlock": getattr(e, "title_block", "") or "",
                        "viewportCount": len(vps),
                        "familyTypeId": "",
                    }
                )

    elif cat in {"plan_view", "planview"}:
        for e in doc.elements.values():
            if isinstance(e, PlanViewElem):
                lev = lvl_lab.get(e.level_id, e.level_id)
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "levelId": e.level_id,
                        "level": lev,
                        "planPresentation": e.plan_presentation,
                        "discipline": getattr(e, "discipline", "") or "",
                        "familyTypeId": "",
                    }
                )

    elif cat in {"section_cut", "sectioncut"}:
        for e in doc.elements.values():
            if isinstance(e, SectionCutElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "cropDepthMm": round(float(e.crop_depth_mm), 3),
                        "familyTypeId": "",
                    }
                )

    else:
        rows = []

    rows = _rows_after_filter_equals(rows, filter_equals)

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
        for k in sorted(buckets.keys(), key=_group_bucket_sort_key):
            grouped[" / ".join(str(x) for x in k)] = list(buckets[k])

    stable_sort_field = filt.get("sortBy") or filt.get("SortBy") or sch_group.get("sortBy")
    ssf = str(stable_sort_field).strip() if stable_sort_field else None

    if grouped:
        grouped = {
            lbl: _sort_rows_stable(
                gs,
                sort_field=ssf,
                key_aliases=key_aliases,
                sort_descending=sort_descending,
                default_name_fallback=True,
            )
            for lbl, gs in grouped.items()
        }
        total_rows = sum(len(gs) for gs in grouped.values())
    else:
        rows = _sort_rows_stable(
            rows,
            sort_field=ssf,
            key_aliases=key_aliases,
            sort_descending=sort_descending,
            default_name_fallback=True,
        )
        total_rows = len(rows)

    leaf_rows: list[dict[str, Any]]
    if grouped:
        leaf_rows = []
        for grp in grouped.values():
            leaf_rows.extend(grp)
    else:
        leaf_rows = list(rows)

    observed_keys = {k for r in leaf_rows for k in r.keys()} if leaf_rows else set()
    columns = stable_column_keys(cat, observed_keys)
    dck_raw = filt.get("displayColumnKeys") or filt.get("display_column_keys")
    if isinstance(dck_raw, list) and dck_raw:
        want_list = [str(x) for x in dck_raw if str(x).strip()]
        if want_list:
            want_set = set(want_list)
            narrowed = [c for c in columns if c in want_set]
            if narrowed:
                columns = narrowed

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
    elif cat == "floor" and leaf_rows:
        totals = {
            "kind": "floor",
            "rowCount": len(leaf_rows),
            "areaM2": round(sum(float(r.get("areaM2") or 0.0) for r in leaf_rows), 4),
        }
    elif cat == "roof" and leaf_rows:
        totals = {
            "kind": "roof",
            "rowCount": len(leaf_rows),
            "footprintAreaM2": round(
                sum(float(r.get("footprintAreaM2") or 0.0) for r in leaf_rows), 4
            ),
        }
    elif cat == "stair" and leaf_rows:
        totals = {
            "kind": "stair",
            "rowCount": len(leaf_rows),
            "totalRunMm": round(sum(float(r.get("runMm") or 0.0) for r in leaf_rows), 4),
        }
    elif cat == "sheet" and leaf_rows:
        totals = {
            "kind": "sheet",
            "rowCount": len(leaf_rows),
            "totalViewports": int(sum(int(r.get("viewportCount") or 0) for r in leaf_rows)),
        }

    out: dict[str, Any] = {
        "scheduleId": schedule_id,
        "name": sch.name,
        "category": cat,
        "columns": columns,
        "columnMetadata": column_metadata_bundle(cat),
        "scheduleEngine": {
            "format": "scheduleDerivationEngine_v1",
            "category": cat,
            "groupKeys": group_keys,
            "sortBy": ssf,
            "sortTieBreak": "elementId",
            "supportsCsv": True,
            **({"sortDescending": True} if sort_descending else {}),
            **({"filterEquals": filter_equals} if filter_equals else {}),
        },
        "totalRows": total_rows,
        "groupKeys": group_keys,
        **({"groupedSections": grouped} if grouped else {"rows": rows}),
    }
    if totals:
        out["totals"] = totals
    return out


def list_schedule_ids(doc: Document) -> list[str]:
    return [e.id for e in doc.elements.values() if isinstance(e, ScheduleElem)]
