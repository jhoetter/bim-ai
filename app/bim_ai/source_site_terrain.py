"""Source-level site, parcel, and terrain decision checks for reverse-BIM."""

from __future__ import annotations

from typing import Any


def build_source_site_terrain_report(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Return site/terrain authoring decisions and source blockers."""

    parcels = []
    terrains = []
    contexts = []
    actions = []

    for fact in facts:
        if not isinstance(fact, dict):
            continue
        kind = str(fact.get("kind") or "")
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        if kind == "parcel_boundary":
            row = _parcel_row(fact, value)
            parcels.append(row)
            actions.extend(_parcel_actions(row))
        elif kind == "terrain":
            row = _terrain_row(fact, value)
            terrains.append(row)
            actions.extend(_terrain_actions(row))
        elif kind == "site_context":
            row = _site_context_row(fact, value)
            contexts.append(row)
            actions.extend(_site_context_actions(row))

    if not parcels and not terrains and not contexts:
        actions.append(
            {
                "id": "site-source:missing-site-evidence",
                "kind": "site_context_setup_required",
                "status": "blocked_needs_source_package",
                "requiredSourceFields": [
                    "parcel id",
                    "property boundary or explicit context-only decision",
                    "building footprint placement relative to parcel/road",
                    "terrain evidence or explicit source-limited terrain tolerance",
                ],
                "sourcePrompt": (
                    "Read site, legal, cadastral, and topology documents. Return parcel, "
                    "building placement, road relationship, and terrain evidence facts."
                ),
            }
        )

    return {
        "format": "reverseBimSourceSiteTerrainReport_v1",
        "summary": {
            "parcelCount": len(parcels),
            "terrainCount": len(terrains),
            "siteContextCount": len(contexts),
            "exactToposolidCandidateCount": sum(
                1 for terrain in terrains if terrain.get("terrainDecision") == "exact_toposolid_possible"
            ),
            "contextOnlyTerrainCount": sum(
                1 for terrain in terrains if terrain.get("terrainDecision") == "context_only_or_tolerance_required"
            ),
            "buildingPlacementKnownCount": sum(1 for context in contexts if context.get("buildingPlacementStatus") == "source_backed"),
            "actionCount": len(actions),
            "blockedActionCount": sum(
                1 for action in actions if str(action.get("status") or "").startswith("blocked")
            ),
            "kindCounts": _kind_counts(actions),
        },
        "parcels": parcels,
        "terrain": terrains,
        "siteContexts": contexts,
        "actions": actions,
    }


def apply_source_site_terrain_decisions(
    report: dict[str, Any],
    decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    """Apply explicit site/terrain repair or tolerance decisions to a report."""

    rows = _decision_rows(decisions)
    decisions_by_action_id = {
        str(row.get("actionId") or row.get("id") or ""): row
        for row in rows
        if isinstance(row, dict)
    }
    actions = []
    dispositions = []
    for action in report.get("actions") or []:
        if not isinstance(action, dict):
            continue
        action_id = str(action.get("id") or "")
        decision = decisions_by_action_id.get(action_id)
        if not decision:
            actions.append(action)
            continue
        errors = _validate_decision(action, decision)
        disposition = {
            "actionId": action_id,
            "decision": decision.get("decision"),
            "accepted": not errors,
            "errors": errors,
        }
        if errors:
            actions.append(action)
        else:
            resolved = {
                **action,
                "status": "resolved_with_decision",
                "disposition": {
                    "decision": decision.get("decision"),
                    "reason": decision.get("reason"),
                    "decidedBy": decision.get("decidedBy"),
                    "sourceRefs": decision.get("sourceRefs") or [],
                    "tolerance": decision.get("tolerance"),
                    "buildingPlacement": decision.get("buildingPlacement"),
                    "roadRelationship": decision.get("roadRelationship"),
                },
            }
            actions.append(resolved)
            disposition["resolvedAction"] = resolved
        dispositions.append(disposition)

    updated = {**report, "actions": actions}
    updated["summary"] = {
        **(report.get("summary") if isinstance(report.get("summary"), dict) else {}),
        "actionCount": len(actions),
        "blockedActionCount": sum(
            1 for action in actions if str(action.get("status") or "").startswith("blocked")
        ),
        "resolvedActionCount": sum(1 for action in actions if action.get("status") == "resolved_with_decision"),
        "kindCounts": _kind_counts(actions),
    }
    return {
        "format": "reverseBimSourceSiteTerrainDecisionReport_v1",
        "accepted": updated["summary"]["blockedActionCount"] == 0,
        "summary": {
            "decisionCount": len(dispositions),
            "acceptedDecisionCount": sum(1 for row in dispositions if row.get("accepted")),
            "invalidDecisionCount": sum(1 for row in dispositions if not row.get("accepted")),
            "blockedActionCount": updated["summary"]["blockedActionCount"],
        },
        "siteTerrainReport": updated,
        "dispositions": dispositions,
    }


def _parcel_row(fact: dict[str, Any], value: dict[str, Any]) -> dict[str, Any]:
    boundary = value.get("boundary") if isinstance(value.get("boundary"), list) else []
    return {
        "factId": fact.get("factId"),
        "parcelId": value.get("parcelId"),
        "areaM2": value.get("areaM2"),
        "boundaryPointCount": len(boundary),
        "closedBoundary": _closed_boundary(boundary),
        "coordinateFrameId": value.get("coordinateFrameId"),
        "sourcePrecision": _source_precision(fact),
        "status": fact.get("status"),
        "confidence": fact.get("confidence"),
        "provenance": fact.get("provenance"),
    }


def _terrain_row(fact: dict[str, Any], value: dict[str, Any]) -> dict[str, Any]:
    has_elevations = bool(value.get("elevationPoints") or value.get("contours") or value.get("mesh"))
    return {
        "factId": fact.get("factId"),
        "siteRef": value.get("siteRef"),
        "method": value.get("method"),
        "hasElevationPoints": bool(value.get("elevationPoints")),
        "hasContours": bool(value.get("contours")),
        "hasMesh": bool(value.get("mesh")),
        "terrainDecision": "exact_toposolid_possible" if has_elevations else "context_only_or_tolerance_required",
        "sourcePrecision": _source_precision(fact),
        "status": fact.get("status"),
        "confidence": fact.get("confidence"),
        "confidenceNote": value.get("confidenceNote"),
        "provenance": fact.get("provenance"),
    }


def _site_context_row(fact: dict[str, Any], value: dict[str, Any]) -> dict[str, Any]:
    placement = value.get("buildingPlacement") or value.get("buildingPlacementMm") or value.get("footprintPlacement")
    return {
        "factId": fact.get("factId"),
        "locationDescription": value.get("locationDescription"),
        "parcelReference": value.get("parcelReference"),
        "roadRelationship": value.get("roadRelationship"),
        "buildingPlacement": placement,
        "buildingPlacementStatus": "source_backed" if placement else "needs_building_placement",
        "status": fact.get("status"),
        "confidence": fact.get("confidence"),
        "provenance": fact.get("provenance"),
    }


def _parcel_actions(parcel: dict[str, Any]) -> list[dict[str, Any]]:
    missing = []
    if not parcel.get("parcelId"):
        missing.append("parcelId")
    if not parcel.get("boundaryPointCount"):
        missing.append("boundary")
    if parcel.get("closedBoundary") is not True:
        missing.append("closedBoundary")
    if parcel.get("areaM2") in (None, ""):
        missing.append("areaM2")
    if not parcel.get("coordinateFrameId"):
        missing.append("coordinateFrameId")

    actions = []
    if missing or parcel.get("sourcePrecision") != "source_measured":
        actions.append(
            {
                "id": f"parcel-precision:{parcel.get('factId')}",
                "kind": "parcel_precision_repair",
                "status": "blocked_needs_source_precision",
                "factId": parcel.get("factId"),
                "missingFields": missing,
                "sourcePrecision": parcel.get("sourcePrecision"),
                "requiredSourceFields": [
                    "parcel id",
                    "closed property boundary points",
                    "parcel area",
                    "source coordinate frame",
                    "context-only tolerance when cadastral source is only raster/uncertain",
                ],
                "sourcePrompt": (
                    "Re-read cadastral/site evidence. Return measured parcel boundary and area, "
                    "or explicitly mark the parcel as context-only if exact authoring is not supported."
                ),
                "provenance": parcel.get("provenance"),
            }
        )
    return actions


def _terrain_actions(terrain: dict[str, Any]) -> list[dict[str, Any]]:
    if terrain.get("terrainDecision") == "exact_toposolid_possible" and terrain.get("sourcePrecision") == "source_measured":
        return []
    return [
        {
            "id": f"terrain-decision:{terrain.get('factId')}",
            "kind": "terrain_source_repair_or_tolerance",
            "status": "blocked_needs_source_precision_or_tolerance",
            "factId": terrain.get("factId"),
            "terrainDecision": terrain.get("terrainDecision"),
            "sourcePrecision": terrain.get("sourcePrecision"),
            "requiredSourceFields": [
                "spot elevations, contour polylines, or terrain mesh",
                "terrain coordinate frame",
                "explicit context-only/tolerance decision if numeric topology is unavailable",
            ],
            "sourcePrompt": (
                "Re-read topographic/site evidence. Return numeric terrain points/contours/mesh "
                "when visible; otherwise return an explicit context-only terrain tolerance decision."
            ),
            "provenance": terrain.get("provenance"),
        }
    ]


def _site_context_actions(context: dict[str, Any]) -> list[dict[str, Any]]:
    if context.get("buildingPlacementStatus") == "source_backed" and context.get("roadRelationship"):
        return []
    missing = []
    if context.get("buildingPlacementStatus") != "source_backed":
        missing.append("buildingPlacement")
    if not context.get("roadRelationship"):
        missing.append("roadRelationship")
    return [
        {
            "id": f"building-placement:{context.get('factId')}",
            "kind": "building_placement_alignment_required",
            "status": "blocked_needs_source_alignment",
            "factId": context.get("factId"),
            "missingFields": missing,
            "requiredSourceFields": [
                "building footprint placement relative to parcel",
                "setback/road relationship",
                "target-building scope on parcel or duplex half",
                "source coordinate frame/control points",
            ],
            "sourcePrompt": (
                "Re-read site and legal documents. Return the target building placement relative "
                "to parcel/property line and road, including source references and uncertainty."
            ),
            "provenance": context.get("provenance"),
        }
    ]


def _closed_boundary(boundary: list[Any]) -> bool:
    if len(boundary) < 4:
        return False
    first = boundary[0] if isinstance(boundary[0], dict) else {}
    last = boundary[-1] if isinstance(boundary[-1], dict) else {}
    return _point_xy(first) == _point_xy(last)


def _point_xy(point: dict[str, Any]) -> tuple[float, float]:
    return (float(point.get("xMm") or point.get("x") or 0), float(point.get("yMm") or point.get("y") or 0))


def _source_precision(fact: dict[str, Any]) -> str:
    status = str(fact.get("status") or "").lower()
    confidence = fact.get("confidence")
    if "uncertain" in status or "limitation" in status or "estimate" in status or "inferred" in status:
        return "estimated_or_limited"
    if isinstance(confidence, int | float) and confidence < 0.75:
        return "estimated_or_limited"
    return "source_measured"


def _kind_counts(actions: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for action in actions:
        kind = str(action.get("kind") or "")
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def _decision_rows(decisions: list[dict[str, Any]] | dict[str, Any] | None) -> list[dict[str, Any]]:
    if decisions is None:
        return []
    if isinstance(decisions, dict) and isinstance(decisions.get("decisions"), list):
        return [row for row in decisions["decisions"] if isinstance(row, dict)]
    if isinstance(decisions, dict):
        return [
            {**value, "actionId": key}
            for key, value in decisions.items()
            if isinstance(value, dict)
        ]
    return [row for row in decisions if isinstance(row, dict)]


def _validate_decision(action: dict[str, Any], decision: dict[str, Any]) -> list[str]:
    errors = []
    for field in ("decision", "reason", "decidedBy", "sourceRefs"):
        if decision.get(field) in (None, "", []):
            errors.append(f"missing required field: {field}")
    allowed = {
        "parcel_precision_repair": {"accept_context_only", "accept_measured_parcel"},
        "terrain_source_repair_or_tolerance": {"accept_context_only_no_toposolid", "accept_measured_toposolid"},
        "building_placement_alignment_required": {"accept_building_placement"},
        "site_context_setup_required": {"defer_site_out_of_scope", "accept_site_source_package"},
    }.get(str(action.get("kind") or ""), set())
    if allowed and decision.get("decision") not in allowed:
        errors.append(f"invalid decision for {action.get('kind')}: {decision.get('decision')}")
    if action.get("kind") == "building_placement_alignment_required":
        if not decision.get("buildingPlacement"):
            errors.append("missing required field: buildingPlacement")
        if not decision.get("roadRelationship"):
            errors.append("missing required field: roadRelationship")
    if action.get("kind") == "terrain_source_repair_or_tolerance" and decision.get("decision") == "accept_context_only_no_toposolid":
        tolerance = decision.get("tolerance") if isinstance(decision.get("tolerance"), dict) else {}
        if not tolerance.get("findingCodes"):
            errors.append("missing required field: tolerance.findingCodes")
    return errors
