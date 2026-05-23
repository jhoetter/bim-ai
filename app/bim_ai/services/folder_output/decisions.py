"""Phase 4: apply site/conflict/coordinate-frame decisions; reconcile facts/ledgers."""

from __future__ import annotations

from typing import Any

from bim_ai.services.folder_output._shared import _classification_labels
from bim_ai.services.folder_output.facts import _build_source_fact_ledger
from bim_ai.services.folder_output.state import FolderOutputPhaseState
from bim_ai.services.source_ingestion import detect_scale_from_text
from bim_ai.source_conflicts import (
    apply_source_conflict_dispositions,
    build_source_conflict_disposition_worklist,
)
from bim_ai.source_coordinate_frames import (
    apply_coordinate_frame_alignments,
    build_coordinate_frame_alignment_worklist,
)
from bim_ai.source_material_assemblies import build_source_material_assembly_report
from bim_ai.source_site_terrain import (
    apply_source_site_terrain_decisions,
    build_source_site_terrain_report,
)


def _phase_decisions(
    state: FolderOutputPhaseState,
    *,
    conflict_decisions: list[dict[str, Any]] | dict[str, Any] | None,
    coordinate_frame_alignments: list[dict[str, Any]] | dict[str, Any] | None,
    site_terrain_decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> None:
    """Phase 4: apply site/conflict/coordinate-frame decisions; reconcile facts/ledgers."""
    state.site_terrain_decision_report = apply_source_site_terrain_decisions(
        build_source_site_terrain_report(state.facts),
        site_terrain_decisions,
    )
    state.site_terrain = state.site_terrain_decision_report["siteTerrainReport"]
    state.facts = _apply_site_terrain_decisions_to_facts(state.facts, state.site_terrain)
    conflicts = _build_conflict_ledger(state.facts, loop=state.loop)
    state.conflict_disposition_report = apply_source_conflict_dispositions(
        conflicts,
        conflict_decisions,
    )
    state.conflicts = state.conflict_disposition_report["conflictLedger"]
    state.facts = _apply_conflict_dispositions_to_facts(state.facts, state.conflicts)
    state.source_material_assemblies = build_source_material_assembly_report(state.facts)
    state.fact_ledger = _build_source_fact_ledger(state.facts)
    state.conflict_dispositions = build_source_conflict_disposition_worklist(state.conflicts)
    coordinate_frames = _build_coordinate_frames(
        rendered_pages=state.rendered_pages,
        classifications=state.classifications,
        text_extractions=state.text_extractions,
    )
    state.coordinate_frame_alignment_report = apply_coordinate_frame_alignments(
        coordinate_frames,
        coordinate_frame_alignments,
        facts=state.facts,
    )
    state.coordinate_frames = state.coordinate_frame_alignment_report["coordinateFrames"]
    state.coordinate_frame_worklist = build_coordinate_frame_alignment_worklist(
        state.coordinate_frames,
        facts=state.facts,
    )


def _apply_conflict_dispositions_to_facts(
    facts: list[dict[str, Any]],
    conflicts: dict[str, Any],
) -> list[dict[str, Any]]:
    dispositions_by_fact_id: dict[str, dict[str, Any]] = {}
    for conflict in conflicts.get("conflicts") or []:
        if not isinstance(conflict, dict) or conflict.get("status") != "resolved":
            continue
        disposition = (
            conflict.get("disposition") if isinstance(conflict.get("disposition"), dict) else {}
        )
        for fact_id in conflict.get("sourceFactIds") or []:
            if fact_id:
                dispositions_by_fact_id[str(fact_id)] = {
                    "conflictId": conflict.get("conflictId"),
                    **disposition,
                }
    if not dispositions_by_fact_id:
        return facts
    out = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        disposition = dispositions_by_fact_id.get(str(fact.get("factId") or ""))
        if not disposition:
            out.append(fact)
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        out.append(
            {
                **fact,
                "status": "resolved",
                "value": {
                    **value,
                    "disposition": disposition,
                },
            }
        )
    return out


def _apply_site_terrain_decisions_to_facts(
    facts: list[dict[str, Any]],
    site_terrain: dict[str, Any],
) -> list[dict[str, Any]]:
    dispositions_by_fact_id: dict[str, dict[str, Any]] = {}
    for action in site_terrain.get("actions") or []:
        if not isinstance(action, dict) or action.get("status") != "resolved_with_decision":
            continue
        fact_id = action.get("factId")
        disposition = (
            action.get("disposition") if isinstance(action.get("disposition"), dict) else {}
        )
        if fact_id and disposition:
            dispositions_by_fact_id[str(fact_id)] = {
                "actionId": action.get("id"),
                "actionKind": action.get("kind"),
                **disposition,
            }
    if not dispositions_by_fact_id:
        return facts
    out = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        disposition = dispositions_by_fact_id.get(str(fact.get("factId") or ""))
        if not disposition:
            out.append(fact)
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        out.append(
            {
                **fact,
                "status": "resolved",
                "value": {
                    **value,
                    "disposition": disposition,
                },
            }
        )
    return out


def _build_conflict_ledger(
    facts: list[dict[str, Any]],
    *,
    loop: dict[str, Any],
) -> dict[str, Any]:
    conflicts = []
    for fact in facts:
        if not isinstance(fact, dict) or fact.get("kind") != "conflict":
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        conflicts.append(
            {
                "conflictId": fact.get("factId"),
                "topic": value.get("topic") or "unspecified source conflict",
                "severity": "blocker",
                "candidates": value.get("candidates") or [],
                "recommendedDisposition": value.get("recommendedDisposition") or "ask_user",
                "status": "open",
                "sourceFactIds": [fact.get("factId")],
                "provenance": fact.get("provenance"),
            }
        )
    for repair in loop.get("repairRequests") or []:
        if not isinstance(repair, dict):
            continue
        conflicts.append(
            {
                "conflictId": f"repair-{repair.get('workPackageId')}",
                "topic": f"Work package requires source repair: {repair.get('workPackageId')}",
                "severity": "blocker",
                "candidates": [],
                "recommendedDisposition": "repair_ai_reader_response",
                "status": "open",
                "sourceFactIds": [],
                "findings": repair.get("findingsToFix") or [],
            }
        )
    return {
        "format": "reverseBimConflictLedger_v1",
        "conflictCount": len(conflicts),
        "openConflictCount": sum(1 for row in conflicts if row.get("status") == "open"),
        "conflicts": conflicts,
    }


def _build_coordinate_frames(
    *,
    rendered_pages: list[dict[str, Any]],
    classifications: dict[str, Any],
    text_extractions: list[dict[str, Any]],
) -> dict[str, Any]:
    class_by_path = {
        str(row.get("sourcePath")): row
        for row in classifications.get("documents") or []
        if isinstance(row, dict)
    }
    scale_by_path = _scale_candidates_by_path(text_extractions)
    frames = []
    for render in rendered_pages:
        source_path = str(render.get("sourcePath") or "")
        cls = class_by_path.get(source_path, {})
        primary_classification = str(cls.get("classification") or "unknown")
        frame_classification_set = {
            "floor_plan",
            "section",
            "elevation",
            "site_plan",
            "drainage_doc",
        }
        frame_classifications = (
            sorted(_classification_labels(cls) & frame_classification_set)
            if primary_classification in frame_classification_set
            else []
        )
        if not frame_classifications:
            continue
        for page in render.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_num = int(page.get("page") or 0)
            source_page_id = f"{cls.get('sourceDocumentId') or source_path}:p{page_num}"
            scale = scale_by_path.get((source_path, page_num)) or {}
            for classification in frame_classifications:
                suffix = "" if len(frame_classifications) == 1 else f"-{classification}"
                frames.append(
                    {
                        "coordinateFrameId": f"frame-{cls.get('sourceDocumentId')}-p{page_num}{suffix}",
                        "sourcePageId": source_page_id,
                        "sourceDocumentId": cls.get("sourceDocumentId"),
                        "page": page_num,
                        "classification": classification,
                        "classificationRoles": cls.get("classificationRoles") or [],
                        "status": "candidate_needs_alignment",
                        "scale": scale.get("scale")
                        or (
                            "1:100"
                            if classification
                            in {"floor_plan", "section", "elevation", "drainage_doc"}
                            else None
                        ),
                        "mmPerPaperUnit": scale.get("mmPerPaperUnit"),
                        "originPx": None,
                        "rotationDeg": 0,
                        "modelOriginMm": None,
                        "levelOrSiteAssociation": _level_or_site_association(
                            classification, source_path
                        ),
                        "confidence": 0.5 if scale else 0.35,
                        "notes": [
                            "Generated as a candidate frame. A modeling-ready run must align origin/rotation and confirm scale before geometry authoring."
                        ],
                    }
                )
    return {
        "format": "reverseBimCoordinateFrames_v1",
        "coordinateFrameCount": len(frames),
        "coordinateFrames": frames,
    }


def _scale_candidates_by_path(
    text_extractions: list[dict[str, Any]],
) -> dict[tuple[str, int], dict[str, Any]]:
    out: dict[tuple[str, int], dict[str, Any]] = {}
    for extraction in text_extractions:
        if not isinstance(extraction, dict):
            continue
        source_path = str(extraction.get("sourcePath") or "")
        for page in extraction.get("pages") or []:
            if not isinstance(page, dict):
                continue
            detection = detect_scale_from_text(str(page.get("text") or ""))
            candidates = (
                detection.get("candidates") if isinstance(detection.get("candidates"), list) else []
            )
            if candidates:
                out[(source_path, int(page.get("page") or 0))] = candidates[0]
    return out


def _level_or_site_association(classification: str, source_path: str) -> str:
    lower = source_path.lower()
    if classification == "site_plan":
        return "site"
    if "eg" in lower or "erdgeschoss" in lower:
        return "EG"
    if "dg" in lower or "dachgeschoss" in lower:
        return "DG"
    if "keller" in lower or "entw" in lower:
        return "KG"
    return "unknown"


def _building_scope_decision_payload(
    decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    if decisions is None:
        rows: list[dict[str, Any]] = []
    elif isinstance(decisions, dict) and isinstance(decisions.get("decisions"), list):
        rows = [row for row in decisions["decisions"] if isinstance(row, dict)]
    elif isinstance(decisions, dict) and isinstance(decisions.get("scopeDecisions"), list):
        rows = [row for row in decisions["scopeDecisions"] if isinstance(row, dict)]
    elif isinstance(decisions, dict):
        rows = [decisions]
    elif isinstance(decisions, list):
        rows = [row for row in decisions if isinstance(row, dict)]
    else:
        rows = []
    return {
        "format": "reverseBimBuildingScopeDecisions_v1",
        "decisionCount": len(rows),
        "decisions": rows,
    }
