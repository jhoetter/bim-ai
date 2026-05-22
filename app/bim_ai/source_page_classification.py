"""Per-page visual classification for compound source PDFs.

The document-level classifier in source_ingestion.classify_documents routes
whole files by filename plus optional native PDF text. For compound scanned
sources that hold plans, sections, elevations, and details in a single PDF
(typical of beta/gamma testhouses), document-level classification under-fits:
the work-order builder either routes every page of a "floor_plan" PDF to
wp-dimensional-floorplans, or — worse — an "unknown" PDF yields missing_inputs
across most packages.

This module emits dispatchable per-page classification assignments for a
multimodal reader (subagent, human, or vision API) and merges the structured
responses back into the rendered_pages stream as ``pageClassificationRoles``.
Downstream, build_ai_visual_trace_work_order.page_roles_for_routing() already
honours those roles, so the routing improvement is purely upstream.

Mirrors the existing reverse-BIM reader-dispatch shape:

* Assignment files are self-contained markdown prompts that reference rendered
  PNG paths under ``source/rendered-pages/**``.
* Responses are JSON files under
  ``ai-reading/page-classifications/responses/<sourceDocumentId>.json`` with
  shape ``{"sourceDocumentId": str, "pages": [{"page": int,
  "primaryRole": str, "additionalRoles": [str], "rotation"?: int,
  "confidence"?: float, "reason"?: str}, ...]}``.

Tracker reference: TH-X-F008 in
``spec/trackers/testhouse-hybrid-reverse-bim-tracker.md``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Roles consumed by build_ai_visual_trace_work_order.page_roles_for_routing.
KNOWN_PAGE_ROLES: tuple[str, ...] = (
    "floor_plan",
    "section",
    "elevation",
    "site_plan",
    "area_calculation",
    "energy_doc",
    "drainage_doc",
    "photo",
    "legal_admin",
    "construction_description",
    "detail",
)

# Page-count threshold per document role above which a document is "compound"
# enough to warrant per-page classification even though the document-level
# classifier already chose a primary role. Roles not listed default to 4.
_COMPOUND_THRESHOLD_BY_ROLE: dict[str, int] = {
    "floor_plan": 4,
    "section": 3,
    "elevation": 3,
    "site_plan": 4,
    "area_calculation": 6,
    "drainage_doc": 4,
    "construction_description": 6,
}

_PAGE_CLASSIFICATION_DIR = "page-classifications"
_ASSIGNMENT_SUBDIR = "assignments"
_RESPONSE_SUBDIR = "responses"


# ---------------------------------------------------------------------------
# Dispatch-plan / assignment emission
# ---------------------------------------------------------------------------


def build_page_classification_dispatch_plan(
    *,
    visual_packet: dict[str, Any],
    output_dir: str | Path,
    mode: str = "auto",
    write_assignments: bool = True,
) -> dict[str, Any]:
    """Identify documents that need per-page classification and emit prompts.

    Parameters
    ----------
    visual_packet:
        Output of ``source_ingestion.build_ai_visual_trace_packet``. The packet
        already joins document classification with rendered-page metadata, so
        we walk it directly rather than re-joining the raw inputs.
    output_dir:
        The reverse-BIM run output directory (e.g.
        ``tmp/reverse-bim/house-beta``). Assignments are written under
        ``ai-reading/page-classifications/assignments/`` when
        ``write_assignments`` is true.
    mode:
        ``"auto"`` — dispatch for documents classified ``unknown`` or with
        page count above the per-role compound threshold. ``"all"`` — dispatch
        for every multi-page document. ``"none"`` — emit no assignments
        (useful for testing the trigger logic).
    write_assignments:
        When false, assignment markdown is not written to disk. The return
        value still lists what *would* be dispatched.
    """

    out_dir = Path(output_dir).expanduser().resolve()
    assignments_dir = out_dir / "ai-reading" / _PAGE_CLASSIFICATION_DIR / _ASSIGNMENT_SUBDIR
    responses_dir = out_dir / "ai-reading" / _PAGE_CLASSIFICATION_DIR / _RESPONSE_SUBDIR

    documents = visual_packet.get("documents") or []

    assignment_rows: list[dict[str, Any]] = []
    skipped_rows: list[dict[str, Any]] = []
    triggers: list[dict[str, Any]] = []

    for doc in documents:
        if not isinstance(doc, dict):
            continue
        doc_id = str(doc.get("sourceDocumentId") or "")
        if not doc_id:
            continue
        pages = [page for page in (doc.get("renderedPages") or []) if isinstance(page, dict)]
        if not pages:
            skipped_rows.append(
                {
                    "sourceDocumentId": doc_id,
                    "reason": "no_rendered_pages",
                    "documentClassification": doc.get("classification"),
                }
            )
            continue
        trigger = _needs_page_classification(doc, pages, mode=mode)
        if trigger is None:
            skipped_rows.append(
                {
                    "sourceDocumentId": doc_id,
                    "reason": "trigger_not_met",
                    "documentClassification": doc.get("classification"),
                    "pageCount": len(pages),
                }
            )
            continue
        triggers.append(
            {
                "sourceDocumentId": doc_id,
                "reason": trigger,
                "documentClassification": doc.get("classification"),
                "pageCount": len(pages),
            }
        )
        assignment_path = assignments_dir / f"{_safe_id(doc_id)}.md"
        response_path = responses_dir / f"{_safe_id(doc_id)}.json"
        if write_assignments:
            assignments_dir.mkdir(parents=True, exist_ok=True)
            assignment_path.write_text(
                _render_assignment_markdown(
                    document=doc,
                    pages=pages,
                    output_dir=out_dir,
                    response_path=response_path,
                ),
                encoding="utf-8",
            )
        assignment_rows.append(
            {
                "sourceDocumentId": doc_id,
                "relativePath": doc.get("relativePath"),
                "documentClassification": doc.get("classification"),
                "pageCount": len(pages),
                "assignmentPath": str(assignment_path),
                "responsePath": str(response_path),
                "trigger": trigger,
            }
        )

    if assignment_rows and write_assignments:
        responses_dir.mkdir(parents=True, exist_ok=True)

    return {
        "ok": True,
        "format": "sourcePageClassificationDispatchPlan_v1",
        "outputDir": str(out_dir),
        "mode": mode,
        "assignmentCount": len(assignment_rows),
        "skippedCount": len(skipped_rows),
        "assignments": assignment_rows,
        "skipped": skipped_rows,
        "triggers": triggers,
        "responseSchema": _RESPONSE_SCHEMA_HINT,
    }


# ---------------------------------------------------------------------------
# Response normalization + application to rendered pages
# ---------------------------------------------------------------------------


def load_page_classification_responses(
    output_dir: str | Path,
) -> dict[str, Any]:
    """Read every response JSON under
    ``ai-reading/page-classifications/responses/``.

    Returns a normalized payload with one entry per ``sourceDocumentId`` and a
    list of validation diagnostics for malformed responses. Missing response
    files are not an error — they simply mean the assignment has not been
    dispatched yet.
    """

    out_dir = Path(output_dir).expanduser().resolve()
    responses_dir = out_dir / "ai-reading" / _PAGE_CLASSIFICATION_DIR / _RESPONSE_SUBDIR
    responses: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []

    if not responses_dir.exists():
        return {
            "ok": True,
            "format": "sourcePageClassificationResponseNormalization_v1",
            "outputDir": str(out_dir),
            "responseCount": 0,
            "responses": responses,
            "diagnostics": diagnostics,
        }

    for path in sorted(responses_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            diagnostics.append(
                {
                    "code": "page_classification_response_unreadable",
                    "path": str(path),
                    "message": str(exc),
                }
            )
            continue
        normalized = _normalize_response(data, path=path, diagnostics=diagnostics)
        if normalized is not None:
            responses.append(normalized)

    return {
        "ok": True,
        "format": "sourcePageClassificationResponseNormalization_v1",
        "outputDir": str(out_dir),
        "responseCount": len(responses),
        "responses": responses,
        "diagnostics": diagnostics,
    }


def apply_page_classifications(
    visual_packet: dict[str, Any],
    *,
    responses: list[dict[str, Any]],
) -> dict[str, Any]:
    """Mutate ``visual_packet`` in place, adding ``pageClassificationRoles``
    onto each matching rendered page.

    Walks ``visual_packet["documents"][].renderedPages[]`` and merges visual
    roles into the existing ``pageClassificationRoles`` (which the packet
    builder seeded from native text). Visual roles are tagged with method
    ``visual_page_classification`` so the routing function can disambiguate
    provenance.
    """

    response_index: dict[str, dict[int, dict[str, Any]]] = {}
    for response in responses:
        doc_id = str(response.get("sourceDocumentId") or "")
        if not doc_id:
            continue
        by_page = response_index.setdefault(doc_id, {})
        for entry in response.get("pages") or []:
            page_number = entry.get("page")
            if not isinstance(page_number, int):
                continue
            by_page[page_number] = entry

    applied_count = 0
    affected_documents: set[str] = set()
    for doc in visual_packet.get("documents") or []:
        if not isinstance(doc, dict):
            continue
        doc_id = str(doc.get("sourceDocumentId") or "")
        if not doc_id:
            continue
        per_page = response_index.get(doc_id)
        if not per_page:
            continue
        for page in doc.get("renderedPages") or []:
            if not isinstance(page, dict):
                continue
            page_number = page.get("page")
            if not isinstance(page_number, int):
                continue
            entry = per_page.get(page_number)
            if not entry:
                continue
            merged = _merge_roles(
                existing=page.get("pageClassificationRoles") or [],
                response_entry=entry,
            )
            if merged:
                page["pageClassificationRoles"] = merged
                applied_count += 1
                affected_documents.add(doc_id)

    return {
        "ok": True,
        "format": "sourcePageClassificationApplication_v1",
        "appliedPageCount": applied_count,
        "affectedDocumentCount": len(affected_documents),
        "affectedDocumentIds": sorted(affected_documents),
    }


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


_RESPONSE_SCHEMA_HINT: dict[str, Any] = {
    "format": "sourcePageClassificationResponse_v1",
    "shape": {
        "sourceDocumentId": "string — matches the assignment row",
        "pages": [
            {
                "page": "int — 1-based page number",
                "primaryRole": (
                    "string — one of: floor_plan, section, elevation, "
                    "site_plan, area_calculation, energy_doc, drainage_doc, "
                    "photo, legal_admin, construction_description, detail"
                ),
                "additionalRoles": "string[] — same vocabulary (optional)",
                "rotation": "int — degrees ccw to make page upright (optional)",
                "confidence": "float — 0..1 (optional)",
                "reason": "string — short evidence statement (optional)",
            }
        ],
    },
}


def _needs_page_classification(
    document: dict[str, Any],
    pages: list[dict[str, Any]],
    *,
    mode: str,
) -> str | None:
    if mode == "none":
        return None
    classification = str(document.get("classification") or "unknown")
    page_count = len(pages)
    if mode == "all":
        return "mode_all" if page_count > 1 else None
    if classification == "unknown":
        return "document_unknown"
    threshold = _COMPOUND_THRESHOLD_BY_ROLE.get(classification, 4)
    if page_count > threshold:
        return f"page_count_exceeds_{classification}_threshold_{threshold}"
    secondary = document.get("secondaryClassifications") or []
    if secondary and page_count > 1:
        return "document_has_secondary_classifications"
    return None


def _render_assignment_markdown(
    *,
    document: dict[str, Any],
    pages: list[dict[str, Any]],
    output_dir: Path,
    response_path: Path,
) -> str:
    rows: list[str] = []
    rows.append(f"# Page Classification Assignment — {document.get('relativePath')}")
    rows.append("")
    rows.append("Read each rendered page image visually and assign a per-page role.")
    rows.append(
        "This is a routing-only task: the goal is to direct each page to the "
        "right reverse-BIM work package (floor plans vs sections vs "
        "elevations vs details vs site/area/etc.)."
    )
    rows.append("")
    rows.append("## Document Metadata")
    rows.append("")
    rows.append(f"- sourceDocumentId: `{document.get('sourceDocumentId')}`")
    rows.append(f"- relativePath: `{document.get('relativePath')}`")
    rows.append(f"- documentClassification: `{document.get('classification') or 'unknown'}`")
    rows.append(f"- pageCount: {len(pages)}")
    rows.append("")
    rows.append("## Pages")
    rows.append("")
    for page in pages:
        page_no = page.get("page")
        path = page.get("path")
        try:
            rel_path = Path(str(path)).relative_to(output_dir)
            shown = str(rel_path)
        except (ValueError, TypeError):
            shown = str(path)
        rows.append(f"- p{page_no}: `{shown}`")
    rows.append("")
    rows.append("## Role Vocabulary")
    rows.append("")
    rows.append("Use exactly these strings: " + ", ".join(f"`{r}`" for r in KNOWN_PAGE_ROLES))
    rows.append("")
    rows.append("- floor_plan — orthographic plan view of a storey/level")
    rows.append("- section — vertical cut through the building")
    rows.append("- elevation — orthographic outside view of a facade")
    rows.append("- site_plan — parcel/site/topology drawing")
    rows.append("- area_calculation — schedule of Wohnflächen / Nutzflächen / volumes")
    rows.append("- drainage_doc — drainage / waste / services drawing")
    rows.append("- legal_admin — Grundbuch / Baulast / Bescheid / cover letter")
    rows.append("- construction_description — Baubeschreibung / spec text")
    rows.append("- detail — 1:10 / 1:20 callouts of eaves, ridges, dormers, stairs")
    rows.append("- photo — photograph or expose-style image")
    rows.append("- energy_doc — Energieausweis / EnEV / GEG")
    rows.append("")
    rows.append("## Response")
    rows.append("")
    rows.append(
        f"Write JSON to `{response_path.relative_to(output_dir)}` matching "
        "`sourcePageClassificationResponse_v1`:"
    )
    rows.append("")
    rows.append("```json")
    sample = {
        "sourceDocumentId": document.get("sourceDocumentId"),
        "pages": [
            {
                "page": pages[0].get("page") if pages else 1,
                "primaryRole": "floor_plan",
                "additionalRoles": [],
                "rotation": 0,
                "confidence": 0.9,
                "reason": "title block reads 'Grundriss EG'",
            }
        ],
    }
    rows.append(json.dumps(sample, indent=2, ensure_ascii=False))
    rows.append("```")
    rows.append("")
    rows.append(
        "Notes: omit `rotation` unless the page is rotated; emit "
        "`additionalRoles` only when a page legitimately fits two work "
        "packages (e.g. a sheet that contains both an elevation and a "
        "detail callout). Do not invent roles outside the vocabulary above."
    )
    rows.append("")
    return "\n".join(rows)


def _normalize_response(
    data: Any,
    *,
    path: Path,
    diagnostics: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not isinstance(data, dict):
        diagnostics.append(
            {
                "code": "page_classification_response_not_object",
                "path": str(path),
            }
        )
        return None
    doc_id = data.get("sourceDocumentId")
    if not isinstance(doc_id, str) or not doc_id:
        diagnostics.append(
            {
                "code": "page_classification_response_missing_document_id",
                "path": str(path),
            }
        )
        return None
    raw_pages = data.get("pages")
    if not isinstance(raw_pages, list):
        diagnostics.append(
            {
                "code": "page_classification_response_pages_not_list",
                "path": str(path),
                "sourceDocumentId": doc_id,
            }
        )
        return None
    normalized_pages: list[dict[str, Any]] = []
    for entry in raw_pages:
        if not isinstance(entry, dict):
            continue
        page_number = entry.get("page")
        primary = entry.get("primaryRole")
        if not isinstance(page_number, int):
            diagnostics.append(
                {
                    "code": "page_classification_response_page_number_invalid",
                    "path": str(path),
                    "sourceDocumentId": doc_id,
                    "rawPage": page_number,
                }
            )
            continue
        if not isinstance(primary, str) or primary not in KNOWN_PAGE_ROLES:
            diagnostics.append(
                {
                    "code": "page_classification_response_primary_role_invalid",
                    "path": str(path),
                    "sourceDocumentId": doc_id,
                    "page": page_number,
                    "rawPrimary": primary,
                }
            )
            continue
        additional = [
            role
            for role in entry.get("additionalRoles") or []
            if isinstance(role, str) and role in KNOWN_PAGE_ROLES and role != primary
        ]
        normalized_entry: dict[str, Any] = {
            "page": page_number,
            "primaryRole": primary,
            "additionalRoles": additional,
        }
        rotation = entry.get("rotation")
        if isinstance(rotation, int) and rotation in {0, 90, 180, 270}:
            normalized_entry["rotation"] = rotation
        confidence = entry.get("confidence")
        if isinstance(confidence, (int, float)) and 0.0 <= float(confidence) <= 1.0:
            normalized_entry["confidence"] = float(confidence)
        reason = entry.get("reason")
        if isinstance(reason, str) and reason.strip():
            normalized_entry["reason"] = reason.strip()
        normalized_pages.append(normalized_entry)
    return {
        "sourceDocumentId": doc_id,
        "responsePath": str(path),
        "pages": normalized_pages,
    }


def _merge_roles(
    *,
    existing: list[dict[str, Any]],
    response_entry: dict[str, Any],
) -> list[dict[str, Any]]:
    by_role: dict[str, dict[str, Any]] = {}
    for entry in existing:
        if isinstance(entry, dict) and entry.get("classification"):
            by_role[str(entry["classification"])] = entry
    visual_method = "visual_page_classification"
    primary = response_entry.get("primaryRole")
    if isinstance(primary, str) and primary in KNOWN_PAGE_ROLES:
        by_role[primary] = {
            "classification": primary,
            "confidence": float(response_entry.get("confidence") or 0.9),
            "method": visual_method,
            "rolePriority": "primary",
        }
    for role in response_entry.get("additionalRoles") or []:
        if role in by_role and by_role[role].get("rolePriority") == "primary":
            continue
        by_role[role] = {
            "classification": role,
            "confidence": float(response_entry.get("confidence") or 0.7),
            "method": visual_method,
            "rolePriority": "additional",
        }
    return sorted(
        by_role.values(),
        key=lambda row: (
            0 if row.get("rolePriority") == "primary" else 1,
            -(float(row.get("confidence") or 0.0)),
            str(row.get("classification") or ""),
        ),
    )


def _safe_id(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in value)
    return cleaned[:120] or "document"
