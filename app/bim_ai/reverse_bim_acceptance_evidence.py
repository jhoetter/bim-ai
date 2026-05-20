"""Deterministic evidence reports for strict reverse-BIM acceptance."""

from __future__ import annotations

from typing import Any


def _as_rows(value: Any) -> list[dict[str, Any]]:
    return [row for row in (value or []) if isinstance(row, dict)]


def _fact_value(fact: dict[str, Any]) -> dict[str, Any]:
    value = fact.get("value")
    return value if isinstance(value, dict) else {}


def _level_key(row: dict[str, Any]) -> str:
    return str(row.get("levelId") or row.get("id") or row.get("name") or "").strip()


def _source_level_rows(
    *,
    source_facts: list[dict[str, Any]] | None,
    required_levels: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if required_levels:
        return [
            {
                "sourceFactId": row.get("sourceFactId") or row.get("factId"),
                "levelId": row.get("levelId") or row.get("id") or row.get("name"),
                "name": row.get("name") or row.get("levelId") or row.get("id"),
                "required": row.get("required", True),
            }
            for row in _as_rows(required_levels)
        ]
    rows = []
    for fact in _as_rows(source_facts):
        kind = str(fact.get("kind") or "")
        if kind not in {"level", "storey", "basement"}:
            continue
        value = _fact_value(fact)
        level_id = value.get("levelId") or fact.get("levelId") or value.get("name") or fact.get("factId")
        rows.append(
            {
                "sourceFactId": fact.get("factId"),
                "levelId": level_id,
                "name": value.get("name") or level_id,
                "required": value.get("required", True),
                "provenance": fact.get("provenance"),
            }
        )
    return rows


def _model_level_index(
    *,
    model_summary: dict[str, Any] | None,
    model_level_summaries: list[dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for row in _as_rows(model_level_summaries):
        key = _level_key(row)
        if key:
            rows[key] = row
    summary = model_summary or {}
    walls_by_level = summary.get("wallsByLevelId") if isinstance(summary.get("wallsByLevelId"), dict) else {}
    rooms_by_level = summary.get("roomsByLevelId") if isinstance(summary.get("roomsByLevelId"), dict) else {}
    for level in _as_rows(summary.get("levels")):
        keys = {str(level.get("id") or ""), str(level.get("name") or "")}
        physical_count = int(walls_by_level.get(str(level.get("id") or ""), 0) or 0) + int(
            rooms_by_level.get(str(level.get("id") or ""), 0) or 0
        )
        row = {
            "levelId": level.get("id"),
            "name": level.get("name"),
            "modeledPhysicalElementCount": physical_count,
            "elementCountsByKind": {
                "wall": int(walls_by_level.get(str(level.get("id") or ""), 0) or 0),
                "room": int(rooms_by_level.get(str(level.get("id") or ""), 0) or 0),
            },
        }
        for key in keys:
            if key:
                rows.setdefault(key, row)
    return rows


def build_level_completeness_report(
    *,
    source_facts: list[dict[str, Any]] | None = None,
    model_summary: dict[str, Any] | None = None,
    required_levels: list[dict[str, Any]] | None = None,
    model_level_summaries: list[dict[str, Any]] | None = None,
    min_physical_elements_per_required_level: int = 1,
) -> dict[str, Any]:
    """Check that every source-required level has real model content."""

    source_levels = [row for row in _source_level_rows(source_facts=source_facts, required_levels=required_levels) if row.get("required") is not False]
    model_levels = _model_level_index(
        model_summary=model_summary,
        model_level_summaries=model_level_summaries,
    )
    rows = []
    for source_level in source_levels:
        level_key = _level_key(source_level)
        model_level = model_levels.get(level_key) or model_levels.get(str(source_level.get("name") or ""))
        modeled_count = int((model_level or {}).get("modeledPhysicalElementCount") or 0)
        status = "complete"
        blockers = []
        if not model_level:
            status = "missing_model_level"
            blockers.append("source-required level does not exist in the model")
        elif modeled_count < min_physical_elements_per_required_level:
            status = "empty_or_incomplete"
            blockers.append("source-required level has no physical modeled content")
        rows.append(
            {
                "sourceFactId": source_level.get("sourceFactId"),
                "levelId": source_level.get("levelId"),
                "name": source_level.get("name"),
                "modelLevelId": (model_level or {}).get("levelId"),
                "modeledPhysicalElementCount": modeled_count,
                "status": status,
                "blockingReasons": blockers,
                "provenance": source_level.get("provenance"),
            }
        )
    if not source_levels:
        rows.append(
            {
                "status": "missing_source_levels",
                "blockingReasons": ["no source-required levels were supplied"],
            }
        )
    blockers = [row for row in rows if row.get("blockingReasons")]
    return {
        "format": "reverseBimLevelCompleteness_v1",
        "ok": not blockers,
        "summary": {
            "accepted": not blockers,
            "requiredLevelCount": len(source_levels),
            "blockingCount": len(blockers),
            "emptyRequiredLevelCount": sum(1 for row in rows if row.get("status") == "empty_or_incomplete"),
            "missingRequiredLevelCount": sum(1 for row in rows if row.get("status") == "missing_model_level"),
            "emptyRequiredLevelIds": [
                row.get("levelId")
                for row in rows
                if row.get("status") in {"empty_or_incomplete", "missing_model_level"}
            ],
        },
        "levels": rows,
    }


def _advisor_stair_clash_count(advisor: dict[str, Any] | None) -> int:
    data = advisor.get("data") if isinstance(advisor, dict) and isinstance(advisor.get("data"), dict) else advisor or {}
    findings = data.get("findings") if isinstance(data, dict) else []
    count = 0
    for finding in _as_rows(findings):
        code = str(finding.get("ruleId") or finding.get("code") or "").lower()
        if "stair" in code and ("clash" in code or "collision" in code):
            count += 1
    return count


def build_physical_topology_report(
    *,
    room_boundary_edges: dict[str, Any] | None = None,
    room_access_graph: dict[str, Any] | None = None,
    openings: list[dict[str, Any]] | None = None,
    stairs: list[dict[str, Any]] | None = None,
    advisor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Check physical topology, not just analytical room graph reachability."""

    edge_summary = (
        ((room_boundary_edges or {}).get("data") or {}).get("boundaryEdges") or {}
    ).get("summary") or {}
    room_graph = ((room_access_graph or {}).get("data") or {}).get("graph") or {}
    inaccessible_rooms = room_graph.get("inaccessibleRoomIds") or []
    unbacked_edges = int(edge_summary.get("unbackedEdgeCount") or 0)
    partial_edges = int(edge_summary.get("partialEdgeCount") or 0)
    analytical_only_rooms = int(edge_summary.get("analyticalOnlyRoomCount") or 0)
    unhosted_openings = [
        row
        for row in _as_rows(openings)
        if not (row.get("hostId") or row.get("hostWallId") or row.get("hostElementId"))
    ]
    stair_rows = _as_rows(stairs)
    stair_clash_count = _advisor_stair_clash_count(advisor) + sum(
        1 for row in stair_rows if row.get("hasClash") or row.get("collision")
    )
    blocking = []
    if inaccessible_rooms:
        blocking.append(f"{len(inaccessible_rooms)} inaccessible rooms remain")
    if unbacked_edges:
        blocking.append(f"{unbacked_edges} unbacked room boundary edges remain")
    if partial_edges:
        blocking.append(f"{partial_edges} partial room boundary edges remain")
    if analytical_only_rooms:
        blocking.append(f"{analytical_only_rooms} analytical-only rooms remain")
    if unhosted_openings:
        blocking.append(f"{len(unhosted_openings)} unhosted openings remain")
    if stair_clash_count:
        blocking.append(f"{stair_clash_count} stair clash findings remain")
    return {
        "format": "reverseBimPhysicalTopology_v1",
        "ok": not blocking,
        "summary": {
            "accepted": not blocking,
            "blockingCount": len(blocking),
            "inaccessibleRoomCount": len(inaccessible_rooms),
            "unbackedPhysicalRoomCount": unbacked_edges + partial_edges + analytical_only_rooms,
            "unhostedOpeningCount": len(unhosted_openings),
            "stairClashCount": stair_clash_count,
        },
        "blockingReasons": blocking,
        "unhostedOpenings": unhosted_openings,
    }


def build_source_overlay_evidence_report(
    *,
    required_views: list[dict[str, Any]] | None = None,
    overlay_results: list[dict[str, Any]] | None = None,
    default_tolerance_mm: float = 50.0,
) -> dict[str, Any]:
    """Require source/model overlay evidence for plans, sections, elevations, and site."""

    required = _as_rows(required_views)
    overlays_by_key = {
        str(row.get("viewId") or row.get("sourcePageId") or row.get("kind") or ""): row
        for row in _as_rows(overlay_results)
    }
    rows = []
    for required_view in required:
        key = str(required_view.get("viewId") or required_view.get("sourcePageId") or required_view.get("kind") or "")
        overlay = overlays_by_key.get(key, {})
        max_deviation = overlay.get("maxDeviationMm")
        tolerance = float(required_view.get("toleranceMm") or overlay.get("toleranceMm") or default_tolerance_mm)
        blockers = []
        if not overlay:
            blockers.append("required source overlay is missing")
        elif overlay.get("status") not in {"passed", "accepted"}:
            blockers.append("source overlay did not pass")
        if isinstance(max_deviation, int | float) and max_deviation > tolerance:
            blockers.append("source overlay deviation exceeds tolerance")
        if overlay and not (overlay.get("screenshotPath") or overlay.get("evidencePath")):
            blockers.append("source overlay screenshot/evidence path is missing")
        rows.append(
            {
                "viewId": key,
                "kind": required_view.get("kind"),
                "status": "passed" if not blockers else "blocked",
                "maxDeviationMm": max_deviation,
                "toleranceMm": tolerance,
                "blockingReasons": blockers,
            }
        )
    if not required:
        rows.append(
            {
                "status": "blocked",
                "blockingReasons": ["no required source overlay views were supplied"],
            }
        )
    blockers = [row for row in rows if row.get("blockingReasons")]
    return {
        "format": "reverseBimSourceOverlayEvidence_v1",
        "ok": not blockers,
        "summary": {
            "accepted": not blockers,
            "requiredViewCount": len(required),
            "blockingCount": len(blockers),
            "missingRequiredViewCount": sum(
                1
                for row in rows
                if "required source overlay is missing" in (row.get("blockingReasons") or [])
            ),
            "failedViewCount": sum(1 for row in rows if row.get("status") == "blocked"),
        },
        "views": rows,
    }


def build_ui_evidence_report(
    *,
    required_views: list[dict[str, Any]] | None = None,
    screenshots: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Require human-inspectable UI evidence from the live model."""

    required = _as_rows(required_views)
    screenshots_by_key = {
        str(row.get("viewId") or row.get("kind") or row.get("name") or ""): row
        for row in _as_rows(screenshots)
    }
    rows = []
    for required_view in required:
        key = str(required_view.get("viewId") or required_view.get("kind") or required_view.get("name") or "")
        screenshot = screenshots_by_key.get(key, {})
        blockers = []
        if not screenshot:
            blockers.append("required UI screenshot is missing")
        elif screenshot.get("status") not in {"captured", "passed", "accepted"}:
            blockers.append("UI screenshot did not pass review")
        if screenshot and not (screenshot.get("path") or screenshot.get("screenshotPath")):
            blockers.append("UI screenshot path is missing")
        rows.append(
            {
                "viewId": key,
                "kind": required_view.get("kind"),
                "status": "passed" if not blockers else "blocked",
                "blockingReasons": blockers,
            }
        )
    if not required:
        rows.append(
            {
                "status": "blocked",
                "blockingReasons": ["no required UI evidence views were supplied"],
            }
        )
    blockers = [row for row in rows if row.get("blockingReasons")]
    return {
        "format": "reverseBimUiEvidence_v1",
        "ok": not blockers,
        "summary": {
            "accepted": not blockers,
            "requiredViewCount": len(required),
            "blockingCount": len(blockers),
            "missingScreenshotCount": sum(
                1
                for row in rows
                if "required UI screenshot is missing" in (row.get("blockingReasons") or [])
            ),
        },
        "views": rows,
    }
