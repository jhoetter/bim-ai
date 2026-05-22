"""Source area to model room reconciliation for reverse-BIM handoff."""

from __future__ import annotations

import re
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import RoomElem


def _norm_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def _room_area_m2(room: RoomElem) -> float:
    points = room.outline_mm
    if len(points) < 3:
        return 0.0
    area = 0.0
    for idx, pt in enumerate(points):
        nxt = points[(idx + 1) % len(points)]
        area += pt.x_mm * nxt.y_mm - nxt.x_mm * pt.y_mm
    return abs(area) / 2_000_000.0


def _source_area_facts(source_facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for fact in source_facts:
        if not isinstance(fact, dict):
            continue
        fact_kind = str(fact.get("kind") or "area")
        if fact_kind not in {"room", "area"}:
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else fact
        if not isinstance(value, dict):
            continue
        area = value.get("areaM2") or value.get("targetAreaM2")
        if area is None:
            continue
        try:
            area_m2 = float(area)
        except (TypeError, ValueError):
            continue
        scope = value.get("scope")
        row_kind = (
            "room"
            if fact_kind == "area" and scope in {"room", "room_area", "area_schedule_row"}
            else fact_kind
        )
        rows.append(
            {
                "factId": fact.get("factId") or fact.get("id"),
                "kind": row_kind,
                "status": fact.get("status"),
                "name": value.get("name") or value.get("roomName"),
                "levelId": value.get("levelId"),
                "roomId": value.get("roomId") or value.get("modelRoomId"),
                "scope": value.get("scope"),
                "sourceAreaM2": area_m2,
                "provenance": fact.get("provenance"),
            }
        )
    return rows


def build_area_reconciliation_report(
    model_id: str,
    doc: Document,
    source_facts: list[dict[str, Any]],
    *,
    tolerance_m2: float = 0.5,
) -> dict[str, Any]:
    """Compare source-derived room/area facts with current model room outlines."""

    rooms = sorted(
        (e for e in doc.elements.values() if isinstance(e, RoomElem)),
        key=lambda room: (room.level_id, _norm_text(room.name), room.id),
    )
    rooms_by_id = {room.id: room for room in rooms}
    rooms_by_key: dict[tuple[str | None, str], list[RoomElem]] = {}
    rooms_by_level: dict[str | None, list[RoomElem]] = {}
    for room in rooms:
        rooms_by_key.setdefault((room.level_id, _norm_text(room.name)), []).append(room)
        rooms_by_level.setdefault(room.level_id, []).append(room)
    facts = _source_area_facts(source_facts)

    rows: list[dict[str, Any]] = []
    matched_room_ids: set[str] = set()
    for fact in facts:
        if fact.get("kind") == "area":
            level_rooms = rooms_by_level.get(fact.get("levelId"), [])
            if not level_rooms:
                rows.append(
                    {
                        **fact,
                        "modelRoomIds": [],
                        "modelAreaM2": None,
                        "deltaM2": None,
                        "status": "missing_model_level_total",
                    }
                )
                continue
            model_area = sum(_room_area_m2(room) for room in level_rooms)
            delta = round(model_area - fact["sourceAreaM2"], 4)
            status = "within_tolerance" if abs(delta) <= tolerance_m2 else "total_mismatch"
            rows.append(
                {
                    **fact,
                    "modelRoomIds": [room.id for room in level_rooms],
                    "modelAreaM2": round(model_area, 4),
                    "deltaM2": delta,
                    "status": status,
                }
            )
            continue
        room = rooms_by_id.get(str(fact["roomId"])) if fact.get("roomId") else None
        if room is None and fact.get("name"):
            matches = rooms_by_key.get((fact.get("levelId"), _norm_text(fact["name"]))) or []
            if len(matches) == 1:
                room = matches[0]
            elif not matches and fact.get("levelId") is None:
                cross_level = [
                    candidate
                    for candidate in rooms
                    if _norm_text(candidate.name) == _norm_text(fact["name"])
                ]
                if len(cross_level) == 1:
                    room = cross_level[0]
        if room is None:
            rows.append(
                {
                    **fact,
                    "modelRoomId": None,
                    "modelAreaM2": None,
                    "deltaM2": None,
                    "status": "missing_model_room",
                }
            )
            continue
        matched_room_ids.add(room.id)
        model_area = _room_area_m2(room)
        delta = round(model_area - fact["sourceAreaM2"], 4)
        status = "within_tolerance" if abs(delta) <= tolerance_m2 else "mismatch"
        rows.append(
            {
                **fact,
                "modelRoomId": room.id,
                "modelAreaM2": round(model_area, 4),
                "targetAreaM2": room.target_area_m2,
                "deltaM2": delta,
                "status": status,
            }
        )

    for room in rooms:
        if room.id in matched_room_ids:
            continue
        rows.append(
            {
                "factId": None,
                "kind": "model_room",
                "name": room.name,
                "levelId": room.level_id,
                "sourceAreaM2": None,
                "modelRoomId": room.id,
                "modelAreaM2": round(_room_area_m2(room), 4),
                "targetAreaM2": room.target_area_m2,
                "deltaM2": None,
                "status": "missing_source_area",
                "provenance": None,
            }
        )

    counts: dict[str, int] = {}
    for row in rows:
        counts[str(row["status"])] = counts.get(str(row["status"]), 0) + 1
    blocking = (
        counts.get("mismatch", 0)
        + counts.get("total_mismatch", 0)
        + counts.get("missing_model_room", 0)
        + counts.get("missing_model_level_total", 0)
    )
    return {
        "format": "areaReconciliationReport_v1",
        "modelId": model_id,
        "revision": doc.revision,
        "toleranceM2": tolerance_m2,
        "summary": {
            "rowCount": len(rows),
            "statusCounts": counts,
            "blockingCount": blocking,
            "accepted": blocking == 0,
        },
        "rows": rows,
    }
