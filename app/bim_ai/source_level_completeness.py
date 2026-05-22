"""Source-level completeness checks before reverse-BIM MCP authoring."""

from __future__ import annotations

import re
import unicodedata
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
        level_key = str(level.get("levelKey") or _canonical_level_key(level_id) or level_id)
        physical = physical_by_level.get(level_key, [])
        blockers = []
        if not physical:
            blockers.append(
                "source-required level has no physical wall/room/floor/opening/stair facts"
            )
        rows.append(
            {
                "levelId": level_id,
                "name": level.get("name"),
                "canonicalLevelKey": level_key,
                "aliases": level.get("aliases") or [],
                "sourceFactId": level.get("sourceFactId"),
                "status": "complete" if not blockers else "blocked_no_physical_source_content",
                "physicalFactCount": len(physical),
                "physicalFactCountsByKind": dict(
                    sorted(Counter(row.get("kind") for row in physical).items())
                ),
                "physicalFactIds": sorted(
                    str(row.get("factId")) for row in physical if row.get("factId")
                ),
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
            "missingSourceLevelFacts": 1
            if rows and rows[0].get("status") == "blocked_missing_source_levels"
            else 0,
        },
        "levels": rows,
        "blockers": blockers,
    }


def _level_rows(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for fact in facts:
        if not isinstance(fact, dict) or str(fact.get("kind") or "") not in {"level", "storey"}:
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        raw_level_id = str(
            value.get("levelId") or value.get("name") or fact.get("factId") or ""
        ).strip()
        level_key = _canonical_level_key(raw_level_id)
        if not level_key and _is_generic_level_fact(raw_level_id):
            continue
        level_id = level_key or raw_level_id
        if not level_id or value.get("required") is False:
            continue
        if level_id in by_key:
            aliases = by_key[level_id].setdefault("aliases", [])
            name = str(value.get("name") or raw_level_id)
            if name and name not in aliases:
                aliases.append(name)
            continue
        by_key[level_id] = {
            "levelId": level_id,
            "levelKey": level_id,
            "name": _level_display_name(level_id, value.get("name") or raw_level_id),
            "aliases": [str(value.get("name") or raw_level_id)],
            "sourceFactId": fact.get("factId"),
            "provenance": fact.get("provenance"),
        }
    return list(by_key.values())


def _physical_facts_by_level(facts: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for fact in facts:
        if (
            not isinstance(fact, dict)
            or str(fact.get("kind") or "") not in PHYSICAL_LEVEL_FACT_KINDS
        ):
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        for level_id in _fact_level_ids(value):
            rows[_canonical_level_key(level_id) or level_id].append(fact)
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
    if len(unique) == 1:
        return unique[0]
    if len(unique) > 1:
        return None
    return text.upper() if len(text) <= 24 else None


def _is_generic_level_fact(value: str) -> bool:
    text = _normalize_level_text(value)
    return not text or bool(
        re.search(r"\ball\s+levels\b|\bebenen\b|\blevels\b|\belevations?\s+unavailable\b", text)
    )


def _level_display_name(level_key: str, fallback: Any) -> str:
    return {"KG": "KG", "EG": "EG", "DG": "DG"}.get(level_key, str(fallback or level_key))


def _normalize_level_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return (
        asciiish.replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").lower()
    )
