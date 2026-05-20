"""Source-level roof and dormer precision checks for reverse-BIM handoff."""

from __future__ import annotations

from typing import Any

ROOF_REQUIRED_FIELDS = [
    "roofType",
    "boundaryMm",
    "pitchDeg",
    "eaveHeightMm",
    "ridgeHeightMm",
]

DORMER_REQUIRED_FIELDS = [
    "hostRoofRef",
    "position",
    "widthMm",
    "heightMm",
    "depthMm",
]


def build_source_roof_dormer_report(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Return roof/dormer precision blockers before final roof authoring."""

    roof_rows = []
    dormer_rows = []
    opening_rows = []
    actions = []

    for fact in facts:
        if not isinstance(fact, dict):
            continue
        kind = str(fact.get("kind") or "")
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        if kind == "roof":
            missing = _missing_fields(value, ROOF_REQUIRED_FIELDS)
            source_precision = _source_precision(fact)
            roof_rows.append(_row(fact, missing, source_precision))
            if missing or source_precision != "source_measured":
                actions.append(_repair_action(fact, "roof_precision_repair", missing, source_precision))
        elif kind == "dormer":
            missing = _missing_fields(value, DORMER_REQUIRED_FIELDS)
            source_precision = _source_precision(fact)
            dormer_rows.append(_row(fact, missing, source_precision))
            if missing or source_precision != "source_measured":
                actions.append(_repair_action(fact, "dormer_precision_repair", missing, source_precision))
        elif kind in {"opening", "roof_opening"} and _is_roof_opening(value):
            missing = [
                field
                for field in ("hostRoofRef", "position", "widthMm", "heightMm")
                if value.get(field) in (None, "", [], {})
            ]
            source_precision = _source_precision(fact)
            opening_rows.append(_row(fact, missing, source_precision))
            if missing or source_precision != "source_measured":
                actions.append(_repair_action(fact, "roof_opening_precision_repair", missing, source_precision))

    counts: dict[str, int] = {}
    for action in actions:
        kind = str(action.get("kind") or "")
        counts[kind] = counts.get(kind, 0) + 1
    return {
        "format": "reverseBimSourceRoofDormerReport_v1",
        "summary": {
            "roofCount": len(roof_rows),
            "dormerCount": len(dormer_rows),
            "roofOpeningCount": len(opening_rows),
            "actionCount": len(actions),
            "blockedActionCount": sum(
                1 for action in actions if str(action.get("status") or "").startswith("blocked")
            ),
            "kindCounts": counts,
        },
        "roofs": roof_rows,
        "dormers": dormer_rows,
        "roofOpenings": opening_rows,
        "actions": actions,
    }


def _row(fact: dict[str, Any], missing: list[str], source_precision: str) -> dict[str, Any]:
    return {
        "factId": fact.get("factId"),
        "kind": fact.get("kind"),
        "status": fact.get("status"),
        "confidence": fact.get("confidence"),
        "sourcePrecision": source_precision,
        "missingFields": missing,
        "provenance": fact.get("provenance"),
    }


def _repair_action(
    fact: dict[str, Any],
    kind: str,
    missing: list[str],
    source_precision: str,
) -> dict[str, Any]:
    return {
        "id": f"{kind}:{fact.get('factId')}",
        "kind": kind,
        "status": "blocked_needs_source_precision",
        "factId": fact.get("factId"),
        "sourcePrecision": source_precision,
        "missingFields": missing,
        "requiredSourceFields": _required_source_fields(kind),
        "sourcePrompt": (
            "Re-read roof/section/elevation evidence and return measured roof-local geometry. "
            "Do not accept proportional estimates as final geometry unless explicitly tolerated."
        ),
        "provenance": fact.get("provenance"),
    }


def _required_source_fields(kind: str) -> list[str]:
    if kind == "roof_precision_repair":
        return [
            "roof boundary/ridge/eave refs",
            "pitch source",
            "eave/ridge height source",
            "overhang/eave semantics",
        ]
    if kind == "dormer_precision_repair":
        return [
            "host roof ref",
            "roof-local position",
            "width/depth/height",
            "dormer roof type and source section/elevation refs",
        ]
    return ["host roof ref", "roof-local position", "width/height", "sill/head or roof-plane relation"]


def _missing_fields(value: dict[str, Any], fields: list[str]) -> list[str]:
    return [field for field in fields if value.get(field) in (None, "", [], {})]


def _source_precision(fact: dict[str, Any]) -> str:
    status = str(fact.get("status") or "").lower()
    confidence = fact.get("confidence")
    if "estimate" in status or "uncertain" in status or "inferred" in status:
        return "estimated"
    if isinstance(confidence, int | float) and confidence < 0.75:
        return "estimated"
    return "source_measured"


def _is_roof_opening(value: dict[str, Any]) -> bool:
    text = " ".join(str(value.get(key) or "").lower() for key in ("openingKind", "openingType", "hostWallRef"))
    return "roof" in text or "skylight" in text
