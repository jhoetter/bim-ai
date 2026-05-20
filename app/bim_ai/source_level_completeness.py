"""Source-level completeness checks before reverse-BIM MCP authoring."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

PHYSICAL_LEVEL_FACT_KINDS = {
    "wall_line",
    "wall_chain",
    "floor_boundary",
    "room",
    "opening",
    "door",
    "window",
    "stair",
    "slab_opening",
    "basement",
}


def build_source_level_completeness_report(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Check that every source-required level has physical source content."""

    level_rows = _level_rows(facts)
    physical_by_level = _physical_facts_by_level(facts)
    rows = []
    for level in level_rows:
        level_id = str(level.get("levelId") or level.get("name") or "")
        physical = physical_by_level.get(level_id, [])
        blockers = []
        if not physical:
            blockers.append("source-required level has no physical wall/room/floor/opening/stair facts")
        rows.append(
            {
                "levelId": level_id,
                "name": level.get("name"),
                "sourceFactId": level.get("sourceFactId"),
                "status": "complete" if not blockers else "blocked_no_physical_source_content",
                "physicalFactCount": len(physical),
                "physicalFactCountsByKind": dict(sorted(Counter(row.get("kind") for row in physical).items())),
                "physicalFactIds": sorted(str(row.get("factId")) for row in physical if row.get("factId")),
                "blockingReasons": blockers,
                "provenance": level.get("provenance"),
            }
        )
    if not rows:
        rows.append(
            {
                "status": "blocked_missing_source_levels",
                "physicalFactCount": 0,
                "blockingReasons": ["no source-required level/storey facts were supplied"],
            }
        )
    blockers = [row for row in rows if row.get("blockingReasons")]
    return {
        "format": "reverseBimSourceLevelCompleteness_v1",
        "ok": not blockers,
        "summary": {
            "requiredLevelCount": len(level_rows),
            "blockingCount": len(blockers),
            "emptySourceLevelCount": sum(
                1 for row in rows if row.get("status") == "blocked_no_physical_source_content"
            ),
            "missingSourceLevelFacts": 1 if rows and rows[0].get("status") == "blocked_missing_source_levels" else 0,
        },
        "levels": rows,
        "blockers": blockers,
    }


def _level_rows(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    seen = set()
    for fact in facts:
        if not isinstance(fact, dict) or str(fact.get("kind") or "") not in {"level", "storey"}:
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        level_id = str(value.get("levelId") or value.get("name") or fact.get("factId") or "").strip()
        if not level_id or level_id in seen or value.get("required") is False:
            continue
        seen.add(level_id)
        rows.append(
            {
                "levelId": level_id,
                "name": value.get("name") or level_id,
                "sourceFactId": fact.get("factId"),
                "provenance": fact.get("provenance"),
            }
        )
    return rows


def _physical_facts_by_level(facts: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for fact in facts:
        if not isinstance(fact, dict) or str(fact.get("kind") or "") not in PHYSICAL_LEVEL_FACT_KINDS:
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        for level_id in _fact_level_ids(value):
            rows[level_id].append(fact)
    return rows


def _fact_level_ids(value: dict[str, Any]) -> list[str]:
    candidates = [
        value.get("levelId"),
        value.get("baseLevelId"),
        value.get("fromLevelId"),
        value.get("toLevelId"),
        value.get("referenceLevelId"),
    ]
    out = []
    for candidate in candidates:
        if isinstance(candidate, list):
            out.extend(str(item) for item in candidate if str(item or "").strip())
        elif str(candidate or "").strip():
            out.append(str(candidate))
    return sorted(set(out))
