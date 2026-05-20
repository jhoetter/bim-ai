"""Source material and assembly readiness for reverse-BIM handoff packages."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

MODELABLE_ASSEMBLY_FACT_KINDS = {
    "wall_line",
    "wall_chain",
    "wall_thickness",
    "floor_boundary",
    "roof",
}


def build_source_material_assembly_report(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Return material/type evidence needed before MCP wall/floor/roof authoring.

    The report is intentionally conservative for existing-building digitization:
    modelable wall/floor/roof scopes need source-backed material semantics and
    either a layer stack or an explicit source-unavailable disposition. This
    prevents a later authoring agent from using generic type defaults without
    recording that the source folder did not contain the assembly data.
    """

    scopes: dict[str, dict[str, Any]] = {}
    history_rows: list[dict[str, Any]] = []

    for fact in facts:
        if not isinstance(fact, dict):
            continue
        kind = str(fact.get("kind") or "")
        value = _value(fact)
        if kind in MODELABLE_ASSEMBLY_FACT_KINDS:
            key, label = _scope_key_and_label(fact, value, fallback=fact.get("factId"))
            row = _scope_row(scopes, key, label, _element_kind(kind, value))
            row["modelableFactIds"].append(str(fact.get("factId") or ""))
            row["sourceFactIds"].append(str(fact.get("factId") or ""))
            row["levelIds"].update(_string_values(value.get("levelId") or value.get("referenceLevelId")))
            if kind == "wall_thickness" or value.get("thicknessMm") is not None:
                row["thicknessEvidence"].append(_thickness_evidence(fact, value))
            row["provenance"].append(fact.get("provenance"))
            _merge_disposition(row, value)
            continue

        if kind == "material":
            key, label = _scope_key_and_label(fact, value, fallback=value.get("elementScope"))
            row = _scope_row(scopes, key, label, _element_kind(kind, value))
            row["sourceFactIds"].append(str(fact.get("factId") or ""))
            row["materialEvidence"].append(_material_evidence(fact, value))
            row["levelIds"].update(_string_values(value.get("levelId")))
            row["provenance"].append(fact.get("provenance"))
            _merge_disposition(row, value)
            continue

        if kind == "construction_history":
            history_rows.append(
                {
                    "factId": fact.get("factId"),
                    "event": value.get("event") or value.get("description") or value.get("note"),
                    "year": value.get("year"),
                    "elementScope": value.get("elementScope") or value.get("scope") or "building",
                    "provenance": fact.get("provenance"),
                }
            )

    rows = [_finalize_scope_row(row) for row in scopes.values()]
    status_counts = Counter(str(row.get("status") or "unknown") for row in rows)
    blockers = [
        requirement
        for row in rows
        for requirement in row.get("requiredBeforeMcp") or []
        if requirement.get("severity") == "error"
    ]
    return {
        "format": "reverseBimSourceMaterialAssemblies_v1",
        "summary": {
            "assemblyScopeCount": len(rows),
            "modelableAssemblyScopeCount": sum(1 for row in rows if row.get("modelableFactIds")),
            "materialEvidenceCount": sum(len(row.get("materialEvidence") or []) for row in rows),
            "thicknessEvidenceCount": sum(len(row.get("thicknessEvidence") or []) for row in rows),
            "historyEventCount": len(history_rows),
            "readyAssemblyCount": status_counts.get("ready_for_type_authoring", 0),
            "sourceLimitedAssemblyCount": status_counts.get("source_limited_explicit", 0),
            "blockedAssemblyCount": status_counts.get("blocked_needs_source_or_disposition", 0),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "assemblyScopes": rows,
        "constructionHistory": history_rows,
        "blockers": blockers,
    }


def _scope_row(
    scopes: dict[str, dict[str, Any]],
    key: str,
    label: str,
    element_kind: str,
) -> dict[str, Any]:
    row = scopes.get(key)
    if row is None:
        row = {
            "scopeId": f"assembly-scope:{key}",
            "scopeKey": key,
            "elementScope": label,
            "elementKind": element_kind,
            "levelIds": set(),
            "modelableFactIds": [],
            "sourceFactIds": [],
            "materialEvidence": [],
            "thicknessEvidence": [],
            "provenance": [],
            "disposition": None,
        }
        scopes[key] = row
    elif row.get("elementKind") in {"unknown", "general"} and element_kind not in {"unknown", "general"}:
        row["elementKind"] = element_kind
    return row


def _finalize_scope_row(row: dict[str, Any]) -> dict[str, Any]:
    material_evidence = row.get("materialEvidence") or []
    thickness_evidence = row.get("thicknessEvidence") or []
    material = _first_non_empty(material_evidence, "materialName")
    layers = _first_layers(material_evidence)
    thickness = _first_thickness(thickness_evidence) or _first_thickness(material_evidence)
    explicit_limited = _has_explicit_source_limited_disposition(row)
    required = []

    if row.get("modelableFactIds"):
        if not material:
            required.append(
                {
                    "code": "source_material_missing",
                    "severity": "error",
                    "message": "Modelable wall/floor/roof scope has no source-backed material fact.",
                    "requiredSourceFields": ["material.elementScope", "material.materialName"],
                }
            )
        if row.get("elementKind") == "wall" and thickness is None:
            required.append(
                {
                    "code": "source_wall_thickness_missing",
                    "severity": "error",
                    "message": "Wall scope needs source-backed thickness before wall type authoring.",
                    "requiredSourceFields": ["wall_thickness.thicknessMm", "wall_thickness.appliesTo"],
                }
            )
        if not layers and not explicit_limited:
            required.append(
                {
                    "code": "source_layer_stack_missing_or_unavailable",
                    "severity": "error",
                    "message": "Layer stack is not captured and has no explicit source-unavailable disposition.",
                    "requiredSourceFields": [
                        "material.layerStack or material.layers",
                        "or disposition.decision=tolerate_unavailable with reason",
                    ],
                }
            )

    if required:
        status = "blocked_needs_source_or_disposition"
    elif explicit_limited:
        status = "source_limited_explicit"
    elif row.get("modelableFactIds") or material_evidence:
        status = "ready_for_type_authoring"
    else:
        status = "metadata_only"

    return {
        "scopeId": row.get("scopeId"),
        "scopeKey": row.get("scopeKey"),
        "elementScope": row.get("elementScope"),
        "elementKind": row.get("elementKind"),
        "levelIds": sorted(row.get("levelIds") or []),
        "modelableFactIds": sorted(set(row.get("modelableFactIds") or [])),
        "sourceFactIds": sorted(set(row.get("sourceFactIds") or [])),
        "materialName": material,
        "thicknessMm": thickness,
        "layers": layers,
        "assemblyTotalThicknessMm": _assembly_total_thickness(layers) or thickness,
        "materialEvidence": material_evidence,
        "thicknessEvidence": thickness_evidence,
        "disposition": row.get("disposition"),
        "status": status,
        "requiredBeforeMcp": required,
        "mcpAuthoringHints": _mcp_authoring_hints(row, material, thickness, layers, explicit_limited),
        "provenance": [prov for prov in row.get("provenance") or [] if isinstance(prov, dict)],
    }


def _mcp_authoring_hints(
    row: dict[str, Any],
    material: str | None,
    thickness: float | None,
    layers: list[dict[str, Any]],
    explicit_limited: bool,
) -> dict[str, Any]:
    element_kind = str(row.get("elementKind") or "unknown")
    if element_kind == "wall":
        tool = "type.wall.upsert_or_select"
    elif element_kind == "roof":
        tool = "type.roof.upsert_or_select"
    elif element_kind == "floor":
        tool = "type.floor.upsert_or_select"
    else:
        tool = "material.assign"
    return {
        "preferredTool": tool,
        "createTypeBeforeGeometry": element_kind in {"wall", "roof", "floor"},
        "draft": {
            "elementKind": element_kind,
            "name": row.get("elementScope"),
            "materialName": material,
            "thicknessMm": thickness,
            "layers": layers,
            "sourceLimited": explicit_limited,
        },
    }


def _value(fact: dict[str, Any]) -> dict[str, Any]:
    value = fact.get("value")
    return value if isinstance(value, dict) else fact


def _scope_key_and_label(
    fact: dict[str, Any],
    value: dict[str, Any],
    *,
    fallback: Any,
) -> tuple[str, str]:
    candidates = [
        value.get("elementScope"),
        value.get("appliesTo"),
        value.get("scope"),
        value.get("wallRef"),
        value.get("hostWallRef"),
        value.get("roofRef"),
        value.get("hostRoofRef"),
        value.get("typeRef"),
        value.get("name"),
        fallback,
        fact.get("factId"),
    ]
    label = next((str(item).strip() for item in candidates if str(item or "").strip()), "unknown")
    return _norm_scope(label), label


def _element_kind(kind: str, value: dict[str, Any]) -> str:
    if kind in {"wall_line", "wall_chain", "wall_thickness"}:
        return "wall"
    if kind == "floor_boundary":
        return "floor"
    if kind == "roof":
        return "roof"
    text = " ".join(
        str(value.get(key) or "")
        for key in ("elementScope", "appliesTo", "scope", "name", "materialName")
    ).casefold()
    if any(token in text for token in ("wall", "wand", "fassade", "facade", "masonry")):
        return "wall"
    if any(token in text for token in ("roof", "dach")):
        return "roof"
    if any(token in text for token in ("floor", "slab", "decke", "boden")):
        return "floor"
    if not text or "general" in text or "unknown" in text:
        return "general"
    return "unknown"


def _material_evidence(fact: dict[str, Any], value: dict[str, Any]) -> dict[str, Any]:
    return {
        "factId": fact.get("factId"),
        "materialName": value.get("materialName") or value.get("material"),
        "assemblyName": value.get("assemblyName") or value.get("constructionType"),
        "thicknessMm": _number(
            value.get("thicknessMm")
            or value.get("totalThicknessMm")
            or value.get("assemblyTotalThicknessMm")
        ),
        "layers": _layers(value),
        "sourceAvailability": value.get("sourceAvailability"),
        "confidence": fact.get("confidence"),
        "provenance": fact.get("provenance"),
    }


def _thickness_evidence(fact: dict[str, Any], value: dict[str, Any]) -> dict[str, Any]:
    return {
        "factId": fact.get("factId"),
        "thicknessMm": _number(
            value.get("thicknessMm")
            or value.get("totalThicknessMm")
            or value.get("assemblyTotalThicknessMm")
        ),
        "appliesTo": value.get("appliesTo") or value.get("elementScope") or value.get("scope"),
        "confidence": fact.get("confidence"),
        "provenance": fact.get("provenance"),
    }


def _layers(value: dict[str, Any]) -> list[dict[str, Any]]:
    raw = (
        value.get("layerStack")
        or value.get("layers")
        or value.get("materialLayers")
        or value.get("assemblyLayers")
    )
    assembly = value.get("assembly") if isinstance(value.get("assembly"), dict) else {}
    if raw is None:
        raw = assembly.get("layers")
    if not isinstance(raw, list):
        return []
    rows = []
    for idx, layer in enumerate(raw):
        if not isinstance(layer, dict):
            continue
        rows.append(
            {
                "index": int(layer.get("index") or idx),
                "function": layer.get("function") or layer.get("layerFunction"),
                "materialName": layer.get("materialName") or layer.get("material"),
                "materialKey": layer.get("materialKey"),
                "thicknessMm": _number(layer.get("thicknessMm")),
            }
        )
    return rows


def _merge_disposition(row: dict[str, Any], value: dict[str, Any]) -> None:
    disposition = value.get("disposition")
    if not isinstance(disposition, dict):
        source_availability = str(value.get("sourceAvailability") or "").casefold()
        reason = value.get("reason") or value.get("confidenceNote")
        if source_availability in {"unavailable", "unknown", "not_in_sources", "source_limited"}:
            disposition = {
                "decision": "tolerate_unavailable",
                "reason": reason or "Source folder does not contain this material assembly detail.",
                "sourceAvailability": value.get("sourceAvailability"),
            }
    if isinstance(disposition, dict) and disposition:
        row["disposition"] = disposition


def _has_explicit_source_limited_disposition(row: dict[str, Any]) -> bool:
    disposition = row.get("disposition") if isinstance(row.get("disposition"), dict) else {}
    decision = str(disposition.get("decision") or disposition.get("status") or "").casefold()
    return decision in {
        "tolerate_unavailable",
        "source_unavailable",
        "accept_source_limited",
        "accepted_source_limited",
    } and bool(disposition.get("reason") or disposition.get("toleranceReason"))


def _first_non_empty(rows: list[dict[str, Any]], key: str) -> str | None:
    for row in rows:
        value = str(row.get(key) or "").strip()
        if value:
            return value
    return None


def _first_layers(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        layers = row.get("layers")
        if isinstance(layers, list) and layers:
            return layers
    return []


def _first_thickness(rows: list[dict[str, Any]]) -> float | None:
    for row in rows:
        value = _number(row.get("thicknessMm"))
        if value is not None:
            return value
    return None


def _assembly_total_thickness(layers: list[dict[str, Any]]) -> float | None:
    values = [_number(layer.get("thicknessMm")) for layer in layers]
    numbers = [value for value in values if value is not None]
    if not numbers:
        return None
    return round(sum(numbers), 4)


def _string_values(raw: Any) -> set[str]:
    if isinstance(raw, list):
        return {str(item) for item in raw if str(item or "").strip()}
    if str(raw or "").strip():
        return {str(raw)}
    return set()


def _number(value: Any) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value.replace(",", "."))
        except ValueError:
            return None
    return None


def _norm_scope(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return text or "unknown"
