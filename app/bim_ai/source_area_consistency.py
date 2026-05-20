"""Pre-authoring source area consistency checks for reverse-BIM packages."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any


def _norm_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def _value(fact: dict[str, Any]) -> dict[str, Any]:
    raw = fact.get("value")
    if isinstance(raw, dict):
        return raw
    return fact


def _area_m2(fact: dict[str, Any]) -> float | None:
    value = _value(fact)
    area = value.get("areaM2") or value.get("targetAreaM2")
    if area is None:
        return None
    try:
        return float(area)
    except (TypeError, ValueError):
        return None


def _level_id(fact: dict[str, Any]) -> str | None:
    value = _value(fact)
    raw = value.get("levelId") or value.get("storeyId") or fact.get("levelId")
    return str(raw) if raw is not None else None


def _name(fact: dict[str, Any]) -> str | None:
    value = _value(fact)
    raw = value.get("name") or value.get("roomName") or fact.get("name")
    return str(raw) if raw is not None else None


def _scope(fact: dict[str, Any]) -> str | None:
    value = _value(fact)
    raw = value.get("scope") or fact.get("scope")
    return str(raw) if raw is not None else None


def _has_room_boundary(fact: dict[str, Any]) -> bool:
    value = _value(fact)
    return any(
        isinstance(value.get(key), list)
        for key in ("boundaryMm", "boundaryPointsMm", "outlineMm")
    )


def _has_explicit_disposition(fact: dict[str, Any]) -> bool:
    value = _value(fact)
    disposition = value.get("disposition") or value.get("areaDisposition") or value.get("areaReconciliationDisposition")
    if isinstance(disposition, dict):
        return bool(disposition.get("acceptedBy") or disposition.get("reason") or disposition.get("status"))
    return bool(disposition)


def _row_from_fact(fact: dict[str, Any], role: str, area: float) -> dict[str, Any]:
    value = _value(fact)
    return {
        "factId": fact.get("factId") or fact.get("id"),
        "kind": fact.get("kind"),
        "role": role,
        "levelId": _level_id(fact),
        "name": _name(fact),
        "scope": _scope(fact),
        "areaM2": area,
        "hasBoundary": _has_room_boundary(fact),
        "hasExplicitDisposition": _has_explicit_disposition(fact),
        "areaBasis": value.get("areaBasis"),
        "status": fact.get("status"),
        "provenance": fact.get("provenance"),
    }


def build_source_area_consistency_report(
    facts: list[dict[str, Any]],
    *,
    tolerance_m2: float = 0.5,
) -> dict[str, Any]:
    """Validate that source room areas and level totals are internally coherent.

    This runs before MCP authoring. It does not compare against a live model;
    instead it prevents a folder-output package from being marked handoff-ready
    when the extracted source facts already disagree with the area schedules.
    """

    room_rows: list[dict[str, Any]] = []
    area_only_room_rows: list[dict[str, Any]] = []
    level_total_rows: list[dict[str, Any]] = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        kind = str(fact.get("kind") or "")
        area = _area_m2(fact)
        if area is None:
            continue
        if kind == "room":
            row = _row_from_fact(fact, "modelable_room" if _has_room_boundary(fact) else "room_area_row", area)
            if row["role"] == "modelable_room":
                room_rows.append(row)
            else:
                area_only_room_rows.append(row)
        elif kind == "area" and _level_id(fact):
            scope = _scope(fact)
            if _name(fact) and scope in {"room", "room_area", "area_schedule_row"}:
                area_only_room_rows.append(_row_from_fact(fact, "room_area_row", area))
            else:
                level_total_rows.append(_row_from_fact(fact, "level_total", area))

    room_key_to_rows: dict[tuple[str | None, str], list[dict[str, Any]]] = defaultdict(list)
    for row in room_rows:
        room_key_to_rows[(row.get("levelId"), _norm_text(row.get("name")))].append(row)

    checks: list[dict[str, Any]] = []
    for area_row in area_only_room_rows:
        matches = room_key_to_rows.get((area_row.get("levelId"), _norm_text(area_row.get("name"))), [])
        if not matches:
            checks.append(
                {
                    "code": "source_area_room_row_without_modelable_room",
                    "severity": "error",
                    "status": "blocked",
                    "factId": area_row.get("factId"),
                    "levelId": area_row.get("levelId"),
                    "name": area_row.get("name"),
                    "message": "A room area schedule row exists, but no modelable room boundary fact exists for the same level/name.",
                }
            )
            continue
        for match in matches:
            delta = round(float(match["areaM2"]) - float(area_row["areaM2"]), 4)
            status = "accepted" if abs(delta) <= tolerance_m2 else "blocked"
            if status == "blocked" and (area_row.get("hasExplicitDisposition") or match.get("hasExplicitDisposition")):
                status = "tolerated"
            checks.append(
                {
                    "code": "source_area_room_row_crosscheck",
                    "severity": "error" if status == "blocked" else "info",
                    "status": status,
                    "factId": area_row.get("factId"),
                    "modelableRoomFactId": match.get("factId"),
                    "levelId": area_row.get("levelId"),
                    "name": area_row.get("name"),
                    "scheduleAreaM2": area_row["areaM2"],
                    "roomFactAreaM2": match["areaM2"],
                    "deltaM2": delta,
                }
            )

    room_area_by_level: dict[str | None, float] = defaultdict(float)
    room_fact_ids_by_level: dict[str | None, list[str]] = defaultdict(list)
    for row in room_rows:
        room_area_by_level[row.get("levelId")] += float(row["areaM2"])
        if row.get("factId"):
            room_fact_ids_by_level[row.get("levelId")].append(str(row["factId"]))

    seen_total_keys: dict[tuple[str | None, str | None, float], str] = {}
    for total in level_total_rows:
        level_id = total.get("levelId")
        source_total = float(total["areaM2"])
        room_sum = room_area_by_level.get(level_id, 0.0)
        delta = round(room_sum - source_total, 4)
        status = "accepted" if abs(delta) <= tolerance_m2 else "blocked"
        if status == "blocked" and total.get("hasExplicitDisposition"):
            status = "tolerated"
        checks.append(
            {
                "code": "source_area_level_total_crosscheck",
                "severity": "error" if status == "blocked" else "info",
                "status": status,
                "factId": total.get("factId"),
                "levelId": level_id,
                "name": total.get("name"),
                "scope": total.get("scope"),
                "sourceTotalAreaM2": source_total,
                "sumOfModelableRoomFactsM2": round(room_sum, 4),
                "deltaM2": delta,
                "roomFactIds": sorted(room_fact_ids_by_level.get(level_id, [])),
            }
        )
        total_key = (level_id, total.get("scope"), round(source_total, 3))
        previous_fact_id = seen_total_keys.get(total_key)
        if previous_fact_id:
            checks.append(
                {
                    "code": "source_area_duplicate_level_total",
                    "severity": "info",
                    "status": "accepted",
                    "factId": total.get("factId"),
                    "duplicateOfFactId": previous_fact_id,
                    "levelId": level_id,
                    "scope": total.get("scope"),
                    "areaM2": source_total,
                }
            )
        else:
            seen_total_keys[total_key] = str(total.get("factId") or "")

    status_counts: dict[str, int] = {}
    for check in checks:
        status = str(check.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    blocking_count = status_counts.get("blocked", 0)
    return {
        "format": "reverseBimSourceAreaConsistencyReport_v1",
        "toleranceM2": tolerance_m2,
        "summary": {
            "modelableRoomAreaFactCount": len(room_rows),
            "roomAreaScheduleRowCount": len(area_only_room_rows),
            "levelTotalAreaFactCount": len(level_total_rows),
            "checkCount": len(checks),
            "statusCounts": dict(sorted(status_counts.items())),
            "blockingCount": blocking_count,
            "accepted": blocking_count == 0,
        },
        "modelableRoomAreas": room_rows,
        "roomAreaScheduleRows": area_only_room_rows,
        "levelTotals": level_total_rows,
        "checks": checks,
        "blockers": [row for row in checks if row.get("status") == "blocked"],
    }
