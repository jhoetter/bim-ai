"""Pre-authoring source area consistency checks for reverse-BIM packages."""

from __future__ import annotations

import re
import unicodedata
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
    if raw is None:
        return None
    if _is_non_physical_area_level(raw):
        return None
    return _canonical_level_key(raw) or str(raw)


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
    if any(
        isinstance(value.get(key), list) and bool(value.get(key))
        for key in ("boundaryMm", "boundaryPointsMm", "outlineMm")
    ):
        return True
    return (
        bool(value.get("boundaryRef"))
        and isinstance(value.get("boundaryEdges"), list)
        and bool(value.get("boundaryEdges"))
    )


def _has_explicit_disposition(fact: dict[str, Any]) -> bool:
    value = _value(fact)
    disposition = (
        value.get("disposition")
        or value.get("areaDisposition")
        or value.get("areaReconciliationDisposition")
    )
    if isinstance(disposition, dict):
        return bool(
            disposition.get("acceptedBy") or disposition.get("reason") or disposition.get("status")
        )
    return bool(disposition)


def _row_from_fact(fact: dict[str, Any], role: str, area: float) -> dict[str, Any]:
    value = _value(fact)
    raw_level_id = value.get("levelId") or value.get("storeyId") or fact.get("levelId")
    return {
        "factId": fact.get("factId") or fact.get("id"),
        "kind": fact.get("kind"),
        "role": role,
        "levelId": _level_id(fact),
        "sourceLevelId": str(raw_level_id) if raw_level_id is not None else None,
        "name": _name(fact),
        "scope": _scope(fact),
        "areaM2": area,
        "hasBoundary": _has_room_boundary(fact),
        "boundaryRef": value.get("boundaryRef"),
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
            row = _row_from_fact(
                fact,
                "modelable_room" if _has_room_boundary(fact) else "room_area_row",
                area,
            )
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

    area_only_room_rows, duplicate_area_checks = _dedupe_reference_rows(
        area_only_room_rows,
        role="room_area_row",
        tolerance_m2=tolerance_m2,
    )
    level_total_rows, duplicate_total_checks = _dedupe_reference_rows(
        level_total_rows,
        role="level_total",
        tolerance_m2=tolerance_m2,
    )
    deduped_room_rows, duplicate_checks = _dedupe_modelable_room_rows(
        room_rows, tolerance_m2=tolerance_m2
    )

    room_key_to_rows: dict[tuple[str | None, str], list[dict[str, Any]]] = defaultdict(list)
    for row in deduped_room_rows:
        room_key_to_rows[(row.get("levelId"), _room_name_key(row.get("name")))].append(row)

    checks: list[dict[str, Any]] = (
        list(duplicate_checks) + duplicate_area_checks + duplicate_total_checks
    )
    for area_row in area_only_room_rows:
        matches = room_key_to_rows.get(
            (area_row.get("levelId"), _room_name_key(area_row.get("name"))), []
        )
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
            if status == "blocked" and (
                area_row.get("hasExplicitDisposition") or match.get("hasExplicitDisposition")
            ):
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

    for total in level_total_rows:
        level_id = total.get("levelId")
        source_total = float(total["areaM2"])
        comparable_rows = _room_rows_for_total(total, deduped_room_rows)
        room_sum = sum(float(row["areaM2"]) for row in comparable_rows)
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
                "roomFactIds": sorted(
                    str(row.get("factId")) for row in comparable_rows if row.get("factId")
                ),
                "scopeMatch": _row_scope_key(total),
            }
        )
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
            "deduplicatedModelableRoomAreaFactCount": len(deduped_room_rows),
            "roomAreaScheduleRowCount": len(area_only_room_rows),
            "levelTotalAreaFactCount": len(level_total_rows),
            "checkCount": len(checks),
            "statusCounts": dict(sorted(status_counts.items())),
            "blockingCount": blocking_count,
            "accepted": blocking_count == 0,
        },
        "modelableRoomAreas": room_rows,
        "deduplicatedModelableRoomAreas": deduped_room_rows,
        "roomAreaScheduleRows": area_only_room_rows,
        "levelTotals": level_total_rows,
        "checks": checks,
        "blockers": [row for row in checks if row.get("status") == "blocked"],
    }


def _dedupe_modelable_room_rows(
    rows: list[dict[str, Any]],
    *,
    tolerance_m2: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    groups: dict[tuple[str | None, str, str | None], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[(row.get("levelId"), _room_name_key(row.get("name")), _row_scope_key(row))].append(
            row
        )

    deduped: list[dict[str, Any]] = []
    checks: list[dict[str, Any]] = []
    for key, group in groups.items():
        primary = group[0]
        deduped.append(primary)
        if len(group) <= 1:
            continue
        primary_area = float(primary["areaM2"])
        for duplicate in group[1:]:
            delta = round(float(duplicate["areaM2"]) - primary_area, 4)
            status = "accepted" if abs(delta) <= tolerance_m2 else "blocked"
            if status == "blocked" and (
                primary.get("hasExplicitDisposition") or duplicate.get("hasExplicitDisposition")
            ):
                status = "tolerated"
            checks.append(
                {
                    "code": "source_area_duplicate_modelable_room_crosscheck",
                    "severity": "error" if status == "blocked" else "info",
                    "status": status,
                    "factId": duplicate.get("factId"),
                    "primaryRoomFactId": primary.get("factId"),
                    "levelId": key[0],
                    "name": duplicate.get("name"),
                    "scopeMatch": key[2],
                    "primaryAreaM2": primary_area,
                    "duplicateAreaM2": duplicate["areaM2"],
                    "deltaM2": delta,
                }
            )
    return deduped, checks


def _dedupe_reference_rows(
    rows: list[dict[str, Any]],
    *,
    role: str,
    tolerance_m2: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    groups: dict[tuple[str | None, str, str | None], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        name_key = (
            _room_name_key(row.get("name"))
            if role == "room_area_row"
            else _norm_text(row.get("name"))
        )
        groups[
            (row.get("levelId"), name_key, _row_scope_key(row) or _norm_text(row.get("scope")))
        ].append(row)

    deduped: list[dict[str, Any]] = []
    checks: list[dict[str, Any]] = []
    for key, group in groups.items():
        primary = group[0]
        deduped.append(primary)
        if len(group) <= 1:
            continue
        primary_area = float(primary["areaM2"])
        for duplicate in group[1:]:
            delta = round(float(duplicate["areaM2"]) - primary_area, 4)
            status = "accepted" if abs(delta) <= tolerance_m2 else "blocked"
            if status == "blocked" and (
                primary.get("hasExplicitDisposition") or duplicate.get("hasExplicitDisposition")
            ):
                status = "tolerated"
            checks.append(
                {
                    "code": f"source_area_duplicate_{role}_crosscheck",
                    "severity": "error" if status == "blocked" else "info",
                    "status": status,
                    "factId": duplicate.get("factId"),
                    "primaryFactId": primary.get("factId"),
                    "levelId": key[0],
                    "name": duplicate.get("name"),
                    "scopeMatch": key[2],
                    "primaryAreaM2": primary_area,
                    "duplicateAreaM2": duplicate["areaM2"],
                    "deltaM2": delta,
                }
            )
    return deduped, checks


def _room_rows_for_total(total: dict[str, Any], rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    level_id = total.get("levelId")
    level_rows = [row for row in rows if row.get("levelId") == level_id]
    scope_key = _row_scope_key(total)
    if scope_key in {"left", "right"}:
        return [row for row in level_rows if _row_scope_key(row) == scope_key]
    if scope_key == "one_half":
        side_counts = {
            side: sum(1 for row in level_rows if _row_scope_key(row) == side)
            for side in ("left", "right")
        }
        present_sides = [side for side, count in side_counts.items() if count]
        if len(present_sides) == 1:
            return [row for row in level_rows if _row_scope_key(row) == present_sides[0]]
    return level_rows


def _row_scope_key(row: dict[str, Any]) -> str | None:
    text = _normalize_level_text(" ".join(str(row.get(key) or "") for key in ("name", "scope")))
    if re.search(r"\b(left|links)\b", text):
        return "left"
    if re.search(r"\b(right|rechts)\b", text):
        return "right"
    if re.search(r"\b(both|whole|gesamt|insgesamt|two|double|doppelhaus)\b", text):
        return "whole"
    if re.search(
        r"\b(one|single|marketed|target|dwelling|unit|half|haelfte|halfte|bauhaelfte|bauhalfte)\b",
        text,
    ):
        return "one_half"
    return None


def _room_name_key(value: Any) -> str:
    text = str(value or "").casefold()
    text = _strip_diacritics(text)
    text = re.sub(r"\bwohnzi\.?\b", "wohnzimmer", text)
    text = re.sub(r"\bschlafzi\.?\b", "schlafzimmer", text)
    text = re.sub(r"\bkinderzi\.?\b", "kinderzimmer", text)
    text = text.replace("kueche", "kuche")
    text = re.sub(r"\bbad\s*(?:u\.?|und|/|\+)\s*w\.?\s*c\.?\b", "bad wc", text)
    text = re.sub(
        r"\b(left|right|links|rechts|target|context|unit|half|dwelling|apartment|seite|haelfte|halfte|bauhaelfte|bauhalfte)\b",
        " ",
        text,
    )
    return _norm_text(text)


def _canonical_level_key(value: Any) -> str | None:
    text = _normalize_level_text(str(value or ""))
    if not text:
        return None
    matches: list[str] = []
    if re.search(r"\bkg\b|\bkellergeschoss\b|\buntergeschoss\b|\bbasement\b|level-kg", text):
        matches.append("KG")
    if re.search(r"\beg\b|\berdgeschoss\b|\bground\s*floor\b|level-eg", text):
        matches.append("EG")
    if re.search(r"\bdg\b|\bdachgeschoss\b|\battic\b|level-dg", text):
        matches.append("DG")
    unique = []
    for match in matches:
        if match not in unique:
            unique.append(match)
    return unique[0] if len(unique) == 1 else None


def _is_non_physical_area_level(value: Any) -> bool:
    text = _normalize_level_text(str(value or ""))
    return bool(
        re.search(
            r"\ball\b|\ball-|site|grundstueck|parcel|footprint|bebaute|wohnflaeche|nutzflaeche|residential|nonresidential|gebaeude|building",
            text,
        )
    )


def _normalize_level_text(value: str) -> str:
    return _strip_diacritics(value).lower()


def _strip_diacritics(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return asciiish.replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
