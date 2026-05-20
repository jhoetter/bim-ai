"""Source-level opening reconciliation for reverse-BIM handoff packages."""

from __future__ import annotations

from typing import Any


def build_source_opening_reconciliation(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Find duplicate/source-host issues for door/window facts before authoring."""

    openings = [_opening_row(fact) for fact in facts if isinstance(fact, dict) and fact.get("kind") in {"opening", "door", "window"}]
    actions = []
    for opening in openings:
        host_kind = opening["hostKind"]
        if host_kind == "wall":
            required_resolvers = ["resolve.wall_by_line", "query.nearest_wall"]
        elif host_kind == "roof":
            required_resolvers = ["resolve.roof_host_region", "resolve.roof_position_from_source_point"]
        elif host_kind == "dormer":
            required_resolvers = ["resolve.dormer_opening_host"]
        else:
            required_resolvers = ["source_repair.opening_host_kind"]
        actions.append(
            {
                "id": f"opening-host:{opening['factId']}",
                "kind": "opening_host_resolution",
                "status": "blocked_needs_resolver" if required_resolvers else "ready",
                "factId": opening["factId"],
                "openingKind": opening["openingKind"],
                "hostKind": host_kind,
                "requiredResolvers": required_resolvers,
                "provenance": opening.get("provenance"),
            }
        )

    for left_idx, left in enumerate(openings):
        for right in openings[left_idx + 1 :]:
            if _duplicate_candidate(left, right):
                actions.append(
                    {
                        "id": f"opening-duplicate:{left['factId']}:{right['factId']}",
                        "kind": "opening_duplicate_candidate",
                        "status": "blocked_needs_disposition",
                        "factIds": [left["factId"], right["factId"]],
                        "reason": "Openings share level, kind, and similar dimensions across source pages.",
                        "requiredDisposition": "same_element | distinct_elements | source_repair_required",
                        "evidence": {
                            "left": _duplicate_evidence(left),
                            "right": _duplicate_evidence(right),
                        },
                    }
                )

    counts: dict[str, int] = {}
    for action in actions:
        kind = str(action.get("kind") or "")
        counts[kind] = counts.get(kind, 0) + 1
    return {
        "format": "reverseBimSourceOpeningReconciliation_v1",
        "summary": {
            "openingCount": len(openings),
            "actionCount": len(actions),
            "blockedActionCount": sum(
                1 for action in actions if str(action.get("status") or "").startswith("blocked")
            ),
            "kindCounts": counts,
        },
        "openings": openings,
        "actions": actions,
    }


def _opening_row(fact: dict[str, Any]) -> dict[str, Any]:
    value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
    opening_kind = str(value.get("openingKind") or value.get("openingType") or fact.get("kind") or "opening").lower()
    return {
        "factId": str(fact.get("factId") or ""),
        "levelId": value.get("levelId"),
        "openingKind": _canonical_opening_kind(opening_kind),
        "hostKind": _host_kind(value),
        "hostWallRef": value.get("hostWallRef"),
        "widthMm": _number(value.get("widthMm")),
        "heightMm": _number(value.get("heightMm")),
        "sillHeightMm": _number(value.get("sillHeightMm")),
        "position": value.get("position") or value.get("sourcePositionMm"),
        "sourcePositionMm": value.get("sourcePositionMm"),
        "confidence": fact.get("confidence"),
        "status": fact.get("status"),
        "provenance": fact.get("provenance"),
    }


def _canonical_opening_kind(raw: str) -> str:
    if "roof" in raw or "skylight" in raw:
        return "roof_window"
    if "door" in raw or "tuer" in raw or "tur" in raw:
        return "door"
    if "window" in raw or "fenster" in raw:
        return "window"
    return raw or "opening"


def _host_kind(value: dict[str, Any]) -> str:
    explicit = str(value.get("hostKind") or "").lower()
    if explicit:
        return explicit
    text = " ".join(
        str(value.get(key) or "").lower()
        for key in ("openingType", "openingKind", "hostWallRef")
    )
    if "roof" in text or "skylight" in text:
        return "roof"
    if "dormer" in text or "gaube" in text:
        return "dormer"
    if "wall" in text or "facade" in text or "fassade" in text:
        return "wall"
    return "unknown"


def _duplicate_candidate(left: dict[str, Any], right: dict[str, Any]) -> bool:
    if left.get("factId") == right.get("factId"):
        return False
    if left.get("levelId") != right.get("levelId"):
        return False
    if left.get("openingKind") != right.get("openingKind"):
        return False
    if left.get("widthMm") and right.get("widthMm") and abs(left["widthMm"] - right["widthMm"]) > 200:
        return False
    if left.get("heightMm") and right.get("heightMm") and abs(left["heightMm"] - right["heightMm"]) > 250:
        return False
    return _different_source_region(left, right)


def _different_source_region(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_prov = left.get("provenance") if isinstance(left.get("provenance"), dict) else {}
    right_prov = right.get("provenance") if isinstance(right.get("provenance"), dict) else {}
    return (
        left_prov.get("sourceDocumentId") != right_prov.get("sourceDocumentId")
        or left_prov.get("page") != right_prov.get("page")
        or left_prov.get("region") != right_prov.get("region")
    )


def _duplicate_evidence(opening: dict[str, Any]) -> dict[str, Any]:
    return {
        "factId": opening.get("factId"),
        "levelId": opening.get("levelId"),
        "openingKind": opening.get("openingKind"),
        "widthMm": opening.get("widthMm"),
        "heightMm": opening.get("heightMm"),
        "hostKind": opening.get("hostKind"),
        "provenance": opening.get("provenance"),
    }


def _number(value: Any) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    return None
