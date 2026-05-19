from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any, Literal

AdvisorSurface = Literal["api_snapshot", "cli_advisor", "constructability_report", "ui_right_rail"]


def advisor_group_key(row: Mapping[str, Any]) -> str:
    rule_id = str(row.get("ruleId") or row.get("code") or row.get("advisoryClass") or "unknown")
    severity = str(row.get("severity") or "warning")
    element_ids = _string_list(row.get("elementIds") or row.get("affectedElementIds"))
    return "|".join([severity, rule_id, ",".join(element_ids)])


def normalize_advisor_findings_for_surface(
    surface: AdvisorSurface,
    payload: Mapping[str, Any] | Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Normalize Advisor rows from product surfaces into one grouped parity shape."""

    if surface in {"api_snapshot", "ui_right_rail"}:
        rows = _sequence(payload.get("violations") if isinstance(payload, Mapping) else payload)
    elif surface == "cli_advisor":
        rows = _cli_group_rows(payload)
    else:
        rows = _sequence(_constructability_body(payload).get("findings"))

    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        rule_id = str(row.get("ruleId") or row.get("code") or row.get("advisoryClass") or "unknown")
        severity = str(row.get("severity") or "warning")
        element_ids = _string_list(row.get("elementIds") or row.get("affectedElementIds"))
        key = "|".join([severity, rule_id, ",".join(element_ids)])
        existing = grouped.setdefault(
            key,
            {
                "severity": severity,
                "ruleId": rule_id,
                "elementIds": element_ids,
                "count": 0,
            },
        )
        existing["count"] += int(row.get("count") or 1)
    return sorted(
        grouped.values(),
        key=lambda row: (_severity_rank(row["severity"]), row["ruleId"], row["elementIds"]),
    )


def build_advisor_four_surface_parity(
    *,
    profile: str,
    api_snapshot: Mapping[str, Any] | Iterable[Mapping[str, Any]],
    cli_advisor: Mapping[str, Any],
    constructability_report: Mapping[str, Any],
    ui_right_rail: Mapping[str, Any] | Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    """Compare grouped Advisor findings across the four product surfaces."""

    normalized = {
        "api_snapshot": normalize_advisor_findings_for_surface("api_snapshot", api_snapshot),
        "cli_advisor": normalize_advisor_findings_for_surface("cli_advisor", cli_advisor),
        "constructability_report": normalize_advisor_findings_for_surface(
            "constructability_report", constructability_report
        ),
        "ui_right_rail": normalize_advisor_findings_for_surface("ui_right_rail", ui_right_rail),
    }
    key_sets = {
        surface: Counter(advisor_group_key(row) for row in rows)
        for surface, rows in normalized.items()
    }
    canonical = key_sets["constructability_report"]
    mismatches: list[dict[str, Any]] = []
    for surface, keys in sorted(key_sets.items()):
        missing = sorted((canonical - keys).elements())
        unexpected = sorted((keys - canonical).elements())
        if missing or unexpected:
            mismatches.append(
                {
                    "surface": surface,
                    "missingGroups": missing,
                    "unexpectedGroups": unexpected,
                }
            )

    return {
        "format": "advisorFourSurfaceParity_v1",
        "profile": profile,
        "ok": not mismatches,
        "surfaces": normalized,
        "summary": {
            "surfaceCount": len(normalized),
            "groupCountBySurface": {surface: len(rows) for surface, rows in normalized.items()},
            "mismatchCount": len(mismatches),
        },
        "mismatches": mismatches,
    }


def _constructability_body(payload: Mapping[str, Any] | Iterable[Mapping[str, Any]]) -> Mapping[str, Any]:
    if not isinstance(payload, Mapping):
        return {"findings": list(payload)}
    body = payload.get("body")
    if isinstance(body, Mapping):
        return body
    return payload


def _cli_group_rows(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    groups = _sequence(payload.get("groups"))
    rows: list[Mapping[str, Any]] = []
    for group in groups:
        rows.append(
            {
                "ruleId": group.get("ruleId") or group.get("code"),
                "severity": group.get("severity"),
                "elementIds": group.get("elementIds"),
                "count": group.get("count") or 1,
            }
        )
    return rows


def _sequence(value: Any) -> list[Mapping[str, Any]]:
    if not isinstance(value, Iterable) or isinstance(value, (str, bytes, Mapping)):
        return []
    return [row for row in value if isinstance(row, Mapping)]


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return sorted({str(item).strip() for item in value if str(item).strip()})


def _severity_rank(severity: str) -> int:
    return {"error": 0, "warning": 1, "info": 2}.get(severity, 9)
