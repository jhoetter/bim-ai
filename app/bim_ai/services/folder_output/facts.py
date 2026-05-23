"""Phase 3: derive facts-for-handoff and the per-aspect source reports.

Also contains helpers for source-page index and document registry, both of
which depend on classification labels and the cross-phase shared helpers.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from bim_ai.services.folder_output._shared import (
    PHASE_BY_FACT_KIND,
    _classification_labels,
    _modeling_use_for_classification,
    _role_for_classification,
)
from bim_ai.services.folder_output.state import FolderOutputPhaseState
from bim_ai.source_area_consistency import build_source_area_consistency_report
from bim_ai.source_building_scope import build_source_building_scope_report
from bim_ai.source_level_completeness import build_source_level_completeness_report
from bim_ai.source_openings import build_source_opening_reconciliation
from bim_ai.source_roof_dormer import build_source_roof_dormer_report
from bim_ai.source_room_topology import build_source_room_topology_report


def _phase_facts_derivation(
    state: FolderOutputPhaseState,
    *,
    building_scope_decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> None:
    """Phase 3: derive facts-for-handoff and the per-aspect source reports."""
    state.facts = _facts_for_handoff(loop=state.loop, normalized=state.normalized)
    state.source_building_scope = build_source_building_scope_report(
        state.facts,
        scope_decisions=building_scope_decisions,
    )
    state.source_level_completeness = build_source_level_completeness_report(state.facts)
    state.room_topology = build_source_room_topology_report(state.facts)
    state.source_area_consistency = build_source_area_consistency_report(state.facts)
    state.opening_reconciliation = build_source_opening_reconciliation(state.facts)
    state.roof_dormer = build_source_roof_dormer_report(state.facts)


def _facts_for_handoff(*, loop: dict[str, Any], normalized: dict[str, Any]) -> list[dict[str, Any]]:
    facts = loop.get("allReturnedFacts")
    if isinstance(facts, list):
        return [fact for fact in facts if isinstance(fact, dict)]
    out: list[dict[str, Any]] = []
    for response in normalized.get("responses") or []:
        if isinstance(response, dict):
            out.extend(fact for fact in response.get("facts") or [] if isinstance(fact, dict))
    return out


def _build_document_registry(
    manifest: dict[str, Any],
    classifications: dict[str, Any],
) -> dict[str, Any]:
    class_by_id = {
        str(row.get("sourceDocumentId")): row
        for row in classifications.get("documents") or []
        if isinstance(row, dict)
    }
    documents = []
    for row in manifest.get("files") or []:
        if not isinstance(row, dict):
            continue
        cls = class_by_id.get(str(row.get("sourceDocumentId")), {})
        classification = str(cls.get("classification") or "unknown")
        documents.append(
            {
                "sourceDocumentId": row.get("sourceDocumentId"),
                "relativePath": row.get("relativePath"),
                "absolutePath": row.get("absolutePath"),
                "sha256": row.get("sha256"),
                "kind": row.get("kind"),
                "pageCount": (
                    (row.get("pdf") or {}).get("pageCount")
                    if isinstance(row.get("pdf"), dict)
                    else None
                ),
                "classification": classification,
                "classificationConfidence": cls.get("confidence", 0),
                "classificationRoles": cls.get("classificationRoles") or [],
                "secondaryClassifications": cls.get("secondaryClassifications") or [],
                "roleInModeling": _role_for_classification(classification),
                "status": "unknown_needs_review"
                if classification == "unknown"
                else "accepted_for_modeling",
                "method": cls.get("method"),
            }
        )
    return {
        "format": "reverseBimSourceDocumentRegistry_v1",
        "documentCount": len(documents),
        "documents": documents,
    }


def _build_source_page_index(
    *,
    rendered_pages: list[dict[str, Any]],
    classifications: dict[str, Any],
    text_extractions: list[dict[str, Any]],
    coordinate_frames: dict[str, Any],
) -> dict[str, Any]:
    class_by_path = {
        str(row.get("sourcePath")): row
        for row in classifications.get("documents") or []
        if isinstance(row, dict)
    }
    text_by_path_page = {}
    for extraction in text_extractions:
        if not isinstance(extraction, dict):
            continue
        for page in extraction.get("pages") or []:
            if isinstance(page, dict):
                text_by_path_page[
                    (str(extraction.get("sourcePath")), int(page.get("page") or 0))
                ] = page
    frame_by_page = {
        str(frame.get("sourcePageId")): frame.get("coordinateFrameId")
        for frame in coordinate_frames.get("coordinateFrames") or []
        if isinstance(frame, dict)
    }
    rows = []
    for render in rendered_pages:
        if not isinstance(render, dict):
            continue
        source_path = str(render.get("sourcePath") or "")
        cls = class_by_path.get(source_path, {})
        for page in render.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_num = int(page.get("page") or 0)
            source_page_id = f"{cls.get('sourceDocumentId') or source_path}:p{page_num}"
            image = page.get("image") if isinstance(page.get("image"), dict) else {}
            text_page = text_by_path_page.get((source_path, page_num), {})
            rows.append(
                {
                    "sourcePageId": source_page_id,
                    "sourceDocumentId": cls.get("sourceDocumentId"),
                    "page": page_num,
                    "classification": cls.get("classification") or "unknown",
                    "classificationRoles": cls.get("classificationRoles") or [],
                    "matchedClassifications": [
                        role.get("classification")
                        for role in cls.get("classificationRoles") or []
                        if isinstance(role, dict) and role.get("classification")
                    ],
                    "renderedPagePath": page.get("path"),
                    "widthPx": image.get("widthPx"),
                    "heightPx": image.get("heightPx"),
                    "dpi": render.get("dpi"),
                    "sha256": page.get("sha256"),
                    "nativeTextAvailable": bool(str(text_page.get("text") or "").strip()),
                    "coordinateFrameId": frame_by_page.get(source_page_id),
                    "modelingUse": _modeling_use_for_classification(
                        str(cls.get("classification") or "unknown")
                    ),
                    "modelingUses": sorted(
                        {
                            _modeling_use_for_classification(label)
                            for label in _classification_labels(cls)
                            if _modeling_use_for_classification(label) != "ignored_with_reason"
                        }
                    ),
                }
            )
    return {
        "format": "reverseBimSourcePageIndex_v1",
        "sourcePageCount": len(rows),
        "pages": rows,
    }


def _build_source_fact_ledger(facts: list[dict[str, Any]]) -> dict[str, Any]:
    rows = []
    for fact in facts:
        kind = str(fact.get("kind") or "")
        rows.append(
            {
                **fact,
                "status": _canonical_fact_status(str(fact.get("status") or "candidate")),
                "scope": fact.get("scope") or "source_package",
                "modelingPhase": PHASE_BY_FACT_KIND.get(kind, "P0-source-inventory"),
                "conflictIds": fact.get("conflictIds")
                or ([] if kind != "conflict" else [str(fact.get("factId") or "")]),
                "notes": fact.get("notes") or [],
            }
        )
    return {
        "format": "reverseBimSourceFactLedger_v1",
        "factCount": len(rows),
        "factCountsByKind": dict(
            sorted(Counter(str(row.get("kind") or "") for row in rows).items())
        ),
        "facts": rows,
    }


def _canonical_fact_status(status: str) -> str:
    if status in {"observed", "extracted", "observed_with_uncertainty", "inferred", "uncertain"}:
        return "candidate"
    if status in {"open_uncertainty", "conflict"}:
        return "conflicting"
    if status in {
        "accepted",
        "candidate",
        "conflicting",
        "deferred",
        "rejected",
        "superseded",
        "modeled",
    }:
        return status
    return "candidate"
