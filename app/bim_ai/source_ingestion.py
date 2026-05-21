from __future__ import annotations

import hashlib
import json
import mimetypes
import re
import struct
import subprocess
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}
PDF_EXTENSIONS = {".pdf"}
CAD_EXTENSIONS = {".dxf", ".dwg", ".ifc"}
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".xml"}

AI_VISUAL_FACT_VALUE_REQUIREMENTS: dict[str, list[str]] = {
    "level": ["name", "elevationMm"],
    "storey": ["name", "elevationMm"],
    "wall_line": ["levelId", "start", "end", "thicknessMm", "wallRole"],
    "wall_chain": ["levelId", "points", "thicknessMm", "wallRole", "closed"],
    "wall_thickness": ["thicknessMm", "appliesTo"],
    "room": ["levelId", "name", "areaM2", "boundaryRef"],
    "opening": ["levelId", "openingType", "hostWallRef", "widthMm", "heightMm", "position"],
    "door": ["levelId", "hostWallRef", "widthMm", "heightMm", "position"],
    "window": ["levelId", "hostWallRef", "widthMm", "heightMm", "sillHeightMm", "position"],
    "stair": ["fromLevelId", "toLevelId", "runs", "stepCount", "slabOpeningRef"],
    "slab_opening": ["levelId", "hostFloorRef", "boundary"],
    "roof": ["roofType", "boundaryRef", "pitchDeg", "eaveHeightMm", "ridgeHeightMm"],
    "dormer": ["hostRoofRef", "position", "widthMm", "heightMm"],
    "basement": ["levelId", "rooms"],
    "terrain": ["siteRef", "method", "confidenceNote"],
    "parcel_boundary": ["parcelId", "boundary", "areaM2"],
    "drainage": ["systemType", "elements"],
    "area": ["scope", "levelId", "name", "areaM2"],
    "volume": ["scope", "volumeM3"],
    "material": ["elementScope", "materialName"],
    "construction_history": ["event", "year"],
    "photo_observation": ["observation", "elementScope"],
    "building_scope": ["scopeType", "modeledExtent", "evidenceSummary"],
    "conflict": ["topic", "candidates", "recommendedDisposition"],
}

AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE: dict[str, list[str]] = {
    "wp-current-condition": ["photo_observation", "material", "construction_history"],
    "wp-dimensional-floorplans": [
        "building_scope",
        "level",
        "wall_chain",
        "wall_thickness",
        "room",
        "opening",
        "stair",
        "slab_opening",
        "area",
    ],
    "wp-sections-elevations-roof": ["building_scope", "level", "roof", "dormer", "opening"],
    "wp-site-parcel-terrain": ["parcel_boundary", "terrain"],
    "wp-area-volume-schedules": ["area", "volume"],
    "wp-drainage-services": ["drainage", "basement"],
}

CLASSIFICATION_KEYWORDS: tuple[tuple[str, str, float], ...] = (
    ("floor_plan", r"\bgrundriss\b|\bgrundrisse\b|\bfloor\s*plan\b|\beg\b|\bog\b|\bug\b|\bdg\b", 0.86),
    ("section", r"\bschnitt\b|\bsection\b|\blaengsschnitt\b|\blangsschnitt\b|\bquerschnitt\b", 0.84),
    ("elevation", r"\bansicht\b|\bansichten\b|\belevation\b|\bnordansicht\b|\bsuedansicht\b|\bsudansicht\b|\bwestansicht\b|\bostansicht\b", 0.84),
    ("site_plan", r"\blageplan\b|\bsite\s*plan\b|\bflurkarte\b|\bkataster\b|\bparcel\b|\bgrundstueck|\bgrundstuck|\bflurstueck|\bflurstuck|\btimonline\b", 0.86),
    ("area_calculation", r"\bwohnflaeche|\bwohnflache|\bnutzflaeche|\bnutzflache|\bflaechenberechnung|\bflachenberechnung|\bumbauter\s+raum\b|\barea\b|\bm2\b|\bm²\b", 0.82),
    ("energy_doc", r"\benergieausweis\b|\benergie\b|\benev\b|\bgebaeudeenergiegesetz\b|\bgebaudeenergiegesetz\b|\bu-wert\b|\bebb\b", 0.92),
    ("drainage_doc", r"\bentwaesserung|\bentwasserung|\bdrainage\b|\babwasser\b|\bkanal\b|\bregenwasser\b", 0.82),
    ("photo", r"\bfoto\b|\bphoto\b|\bbild\b|\bimg\b|\bdsc\b|\bexpose\b", 0.9),
    ("legal_admin", r"\bbaulast\b|\baltlast", 0.9),
    ("legal_admin", r"\bbaugenehmigung\b|\bgrundbuch\b|\bvertrag\b|\bbescheid\b|\bantrag\b|\bgb\b|\bnebenkosten\b|\bgrundsteuer\b", 0.78),
    ("construction_description", r"\bbaubeschreibung\b|\bkonstruktion\b|\bmaterial\b|\bsanierung\b|\bbaujahr\b", 0.78),
)

SCALE_RE = re.compile(
    r"(?:m\s*[:=]\s*)?1\s*[:/]\s*(?P<denom>\d{1,5})|(?P<len>\d+(?:[.,]\d+)?)\s*(?P<unit>m|cm|mm)\b",
    re.IGNORECASE,
)


def build_folder_manifest(root_path: str | Path) -> dict[str, Any]:
    root = Path(root_path).expanduser().resolve()
    if not root.exists():
        return _error("source_folder_not_found", f"Source folder does not exist: {root}", 404)
    if not root.is_dir():
        return _error("source_path_not_folder", f"Source path is not a folder: {root}", 400)

    files: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for path in sorted((p for p in root.rglob("*") if p.is_file()), key=lambda p: str(p.relative_to(root))):
        try:
            files.append(_file_manifest_row(root, path))
        except Exception as exc:  # pragma: no cover - defensive around unreadable local files.
            diagnostics.append(
                {
                    "code": "source_file_manifest_failed",
                    "path": str(path),
                    "message": str(exc),
                }
            )

    kind_counts = Counter(str(row["kind"]) for row in files)
    digest = hashlib.sha256()
    for row in files:
        digest.update(str(row["relativePath"]).encode())
        digest.update(str(row["sha256"]).encode())

    return {
        "ok": True,
        "format": "sourceFolderManifest_v1",
        "rootPath": str(root),
        "fileCount": len(files),
        "kindCounts": dict(sorted(kind_counts.items())),
        "manifestDigestSha256": digest.hexdigest(),
        "files": files,
        "diagnostics": diagnostics,
    }


def classify_documents(
    manifest_or_files: dict[str, Any] | list[dict[str, Any]],
    text_extractions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    files = _files_from_manifest(manifest_or_files)
    text_by_source = _text_extraction_index(text_extractions)
    rows = [
        _classify_file(row, supplemental_text=text_by_source.get(str(row.get("absolutePath") or "")))
        for row in files
    ]
    counts = Counter(str(row["classification"]) for row in rows)
    role_counts: Counter[str] = Counter()
    for row in rows:
        for role in row.get("classificationRoles") or []:
            if isinstance(role, dict) and role.get("classification"):
                role_counts[str(role["classification"])] += 1
    return {
        "ok": True,
        "format": "sourceDocumentClassification_v1",
        "documentCount": len(rows),
        "classificationCounts": dict(sorted(counts.items())),
        "classificationRoleCounts": dict(sorted(role_counts.items())),
        "documents": rows,
    }


def extract_pdf_text(pdf_path: str | Path, *, max_pages: int | None = None) -> dict[str, Any]:
    path = Path(pdf_path).expanduser().resolve()
    if not path.exists():
        return _error("source_pdf_not_found", f"PDF does not exist: {path}", 404)
    if path.suffix.lower() != ".pdf":
        return _error("source_pdf_expected", f"Expected a PDF path: {path}", 400)

    pages: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    try:
        from pypdf import PdfReader  # type: ignore[import-not-found]

        reader = PdfReader(str(path))
        for idx, page in enumerate(reader.pages[: max_pages or len(reader.pages)]):
            text = page.extract_text() or ""
            pages.append(
                {
                    "page": idx + 1,
                    "text": text,
                    "charCount": len(text),
                    "method": "pypdf",
                }
            )
    except Exception as exc:
        diagnostics.append(
            {
                "code": "pdf_text_extractor_unavailable",
                "message": str(exc),
                "recommendation": "Install pypdf for native text extraction; scanned drawings should be read visually through source.ai_visual_trace_packet/source.ai_reading_packet.",
            }
        )
        poppler_pages, poppler_diag = _extract_pdf_text_with_pdftotext(path, max_pages=max_pages)
        if poppler_pages:
            pages = poppler_pages
            diagnostics.append(
                {
                    "code": "pdf_text_extractor_fallback_used",
                    "message": "Used Poppler pdftotext because pypdf was unavailable.",
                }
            )
        elif poppler_diag:
            diagnostics.append(poppler_diag)

    return {
        "ok": True,
        "format": "sourcePdfTextExtraction_v1",
        "sourcePath": str(path),
        "pageCount": len(pages),
        "pages": pages,
        "diagnostics": diagnostics,
    }


def _extract_pdf_text_with_pdftotext(
    path: Path,
    *,
    max_pages: int | None,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    cmd = ["pdftotext", "-layout"]
    if max_pages is not None:
        cmd.extend(["-f", "1", "-l", str(max_pages)])
    cmd.extend([str(path), "-"])
    try:
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        return [], {
            "code": "pdftotext_unavailable",
            "message": "Poppler pdftotext is not installed or not on PATH.",
        }
    if proc.returncode != 0:
        return [], {
            "code": "pdftotext_failed",
            "returnCode": proc.returncode,
            "stderr": proc.stderr.strip(),
        }
    chunks = proc.stdout.split("\f")
    pages = []
    for idx, text in enumerate(chunks):
        if max_pages is not None and idx >= max_pages:
            break
        pages.append(
            {
                "page": idx + 1,
                "text": text.rstrip(),
                "charCount": len(text.rstrip()),
                "method": "pdftotext",
            }
        )
    return pages, None


def render_pdf_pages(
    pdf_path: str | Path,
    *,
    output_dir: str | Path,
    dpi: int = 200,
    first_page: int | None = None,
    last_page: int | None = None,
) -> dict[str, Any]:
    path = Path(pdf_path).expanduser().resolve()
    out_dir = Path(output_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        return _error("source_pdf_not_found", f"PDF does not exist: {path}", 404)

    prefix = out_dir / path.stem
    cmd = ["pdftoppm", "-png", "-r", str(dpi)]
    if first_page is not None:
        cmd.extend(["-f", str(first_page)])
    if last_page is not None:
        cmd.extend(["-l", str(last_page)])
    cmd.extend([str(path), str(prefix)])
    try:
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=120)
    except FileNotFoundError:
        return {
            "ok": True,
            "format": "sourcePdfRender_v1",
            "sourcePath": str(path),
            "outputDir": str(out_dir),
            "dpi": dpi,
            "pages": [],
            "diagnostics": [
                {
                    "code": "pdftoppm_unavailable",
                    "message": "Poppler pdftoppm is not installed or not on PATH.",
                    "recommendation": "Install poppler to render PDF pages.",
                }
            ],
        }
    rendered = sorted(out_dir.glob(f"{path.stem}-*.png"))
    diagnostics: list[dict[str, Any]] = []
    if proc.returncode != 0:
        diagnostics.append(
            {
                "code": "pdf_render_failed",
                "returnCode": proc.returncode,
                "stderr": proc.stderr.strip(),
            }
        )
    pages = []
    for idx, page_path in enumerate(rendered, start=1):
        pages.append(
            {
                "page": idx,
                "path": str(page_path),
                "sha256": _sha256_file(page_path),
                "image": _image_metadata(page_path),
            }
        )
    return {
        "ok": True,
        "format": "sourcePdfRender_v1",
        "sourcePath": str(path),
        "outputDir": str(out_dir),
        "dpi": dpi,
        "pages": pages,
        "diagnostics": diagnostics,
    }


def detect_scale_from_text(text: str, *, source_document_id: str | None = None) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for match in SCALE_RE.finditer(text or ""):
        denom = match.group("denom")
        if denom:
            value = int(denom)
            if 1 <= value <= 10000:
                candidates.append(
                    {
                        "kind": "drawing_scale",
                        "scale": f"1:{value}",
                        "denominator": value,
                        "confidence": 0.88,
                        "matchedText": match.group(0),
                    }
                )
        elif match.group("len"):
            candidates.append(
                {
                    "kind": "dimension_text",
                    "value": float(match.group("len").replace(",", ".")),
                    "unit": match.group("unit").lower(),
                    "confidence": 0.55,
                    "matchedText": match.group(0),
                }
            )
    return {
        "ok": True,
        "format": "sourceScaleDetection_v1",
        "sourceDocumentId": source_document_id,
        "candidateCount": len(candidates),
        "candidates": candidates,
    }


def build_ai_reading_packet(
    *,
    manifest: dict[str, Any],
    classifications: dict[str, Any] | None = None,
    rendered_pages: list[dict[str, Any]] | None = None,
    text_extractions: list[dict[str, Any]] | None = None,
    max_text_chars_per_document: int = 4000,
) -> dict[str, Any]:
    """Build the packet an external multimodal LLM/subagent should read.

    This intentionally does not OCR scans. It packages rendered page image paths,
    native text where available, document classification, source ids, and the
    exact fact schema the AI reader must return. The BIM software remains the
    deterministic coordinator: source packaging, provenance requirements,
    validation, conflict handling, and MCP modeling.
    """

    classifications_by_id = {
        str(row.get("sourceDocumentId")): row
        for row in (classifications or {}).get("documents", [])
        if isinstance(row, dict)
    }
    rendered_by_source: dict[str, list[dict[str, Any]]] = {}
    for render in rendered_pages or []:
        source = str(render.get("sourcePath") or "")
        if not source:
            continue
        rendered_by_source.setdefault(source, []).extend(render.get("pages") or [])
    text_by_source: dict[str, str] = {}
    text_by_source_page: dict[tuple[str, int], str] = {}
    for extraction in text_extractions or []:
        source = str(extraction.get("sourcePath") or "")
        page_rows = extraction.get("pages", [])
        text = "\n".join(str(page.get("text") or "") for page in page_rows)
        text_by_source[source] = text[:max_text_chars_per_document]
        for page in page_rows:
            if not isinstance(page, dict):
                continue
            text_by_source_page[(source, int(page.get("page") or 0))] = str(page.get("text") or "")

    documents: list[dict[str, Any]] = []
    for file_row in manifest.get("files", []):
        if not isinstance(file_row, dict):
            continue
        source_id = str(file_row.get("sourceDocumentId") or "")
        source_path = str(file_row.get("absolutePath") or "")
        classification = classifications_by_id.get(source_id, {})
        rendered_pages_for_doc = rendered_by_source.get(source_path, [])
        documents.append(
            {
                "sourceDocumentId": source_id,
                "relativePath": file_row.get("relativePath"),
                "sourcePath": source_path,
                "kind": file_row.get("kind"),
                "classification": classification.get("classification", "unknown"),
                "classificationConfidence": classification.get("confidence", 0.0),
                "classificationRoles": classification.get("classificationRoles") or [],
                "secondaryClassifications": classification.get("secondaryClassifications") or [],
                "pdf": file_row.get("pdf"),
                "image": file_row.get("image"),
                "renderedPages": [
                    {
                        "page": page.get("page"),
                        "path": page.get("path"),
                        "sha256": page.get("sha256"),
                        "image": page.get("image"),
                        "pageClassificationRoles": _classification_roles_from_text(
                            text_by_source_page.get((source_path, int(page.get("page") or 0)), "")
                        ),
                    }
                    for page in rendered_pages_for_doc
                ],
                "nativeTextExcerpt": text_by_source.get(source_path, ""),
            }
        )

    fact_schema = {
        "factId": "stable unique id assigned by reader, e.g. ai-srcfact-0001",
        "kind": (
            "level | wall_line | room | opening | stair | roof | dormer | "
            "terrain | parcel_boundary | area | material | construction_history | note"
        ),
        "value": "structured object with units in mm/m2 where applicable",
        "confidence": "number 0..1",
        "status": "candidate",
        "provenance": {
            "sourceDocumentId": "must match packet document id",
            "page": "1-based page number where known",
            "region": "optional bbox/description",
            "method": "ai_document_read",
            "textExcerpt": "short source quote/label, if visible",
            "renderedPagePath": "path from renderedPages when used",
        },
    }

    return {
        "ok": True,
        "format": "sourceAiReadingPacket_v1",
        "sourceManifestDigestSha256": manifest.get("manifestDigestSha256"),
        "documentCount": len(documents),
        "documents": documents,
        "readerInstructions": [
            "Read rendered page images visually; do not invent hidden facts.",
            "Return only facts with sourceDocumentId and page/region provenance.",
            "Use mm for lengths, m2 for areas, degrees for angles, and include original text when visible.",
            "Mark ambiguous or conflicting facts as candidate with lower confidence.",
            "Preserve topology: rooms, walls, openings, stairs, roofs, site and parcel facts are separate facts linked by ids when possible.",
        ],
        "expectedFactSchema": fact_schema,
    }


def build_ai_visual_trace_packet(
    *,
    manifest: dict[str, Any],
    classifications: dict[str, Any] | None = None,
    rendered_pages: list[dict[str, Any]] | None = None,
    text_extractions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Package source pages for AI visual tracing into reverse-BIM facts.

    This is the AI-based replacement for using deterministic CV as the primary
    source understanding method. It does not mutate the model and does not
    produce BIM commands; it asks an AI reader to return strict source facts
    with provenance so deterministic validation and MCP authoring can follow.
    """

    packet = build_ai_reading_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered_pages,
        text_extractions=text_extractions,
    )
    if packet.get("ok") is False:
        return packet

    packet["format"] = "sourceAiVisualTracePacket_v1"
    packet["task"] = "ai_visual_trace_to_existing_building_source_facts"
    packet["readerInstructions"] = [
        "Read the rendered drawings and document pages visually as an architect/BIM technician would.",
        "Trace visible walls, wall thicknesses, room loops, openings, stairs, roofs, dormers, site/parcel/topography, drainage, and schedules into structured source facts.",
        "Do not place BIM elements and do not emit model commands; return only source facts with provenance.",
        "Prefer explicit dimensions and labels from the drawing over pixel measurement. Use pixel/visual geometry only as secondary evidence and mark confidence accordingly.",
        "For mirrored semi-detached halves, report each modeled half separately and record symmetry/mirroring relationships instead of collapsing them silently.",
        "Cross-check plan facts against sections, elevations, area calculations, site/legal documents, and photos where available.",
        "For materials and assemblies, return source-backed wall/floor/roof layer stacks when present; if unavailable, return an explicit source-unavailable disposition with provenance instead of guessing.",
        "Mark conflicts, uncertain readings, illegible dimensions, and scan/crop limitations explicitly.",
    ]
    packet["expectedFactSchema"]["kind"] = (
        "level | storey | wall_line | wall_chain | wall_thickness | room | opening | "
        "stair | slab_opening | roof | dormer | basement | terrain | parcel_boundary | "
        "drainage | area | volume | material | construction_history | photo_observation | note"
    )
    packet["expectedFactSchema"]["traceGeometry"] = {
        "coordinateFrameId": "optional page/model coordinate frame id when known",
        "pagePolyline": "optional source-page polyline/polygon in page pixels or normalized coordinates",
        "modelDraft": "optional metric draft geometry; must include units and confidence",
    }
    return packet


def build_ai_visual_trace_work_order(
    *,
    ai_visual_trace_packet: dict[str, Any],
    project_goal: str | None = None,
) -> dict[str, Any]:
    """Create reusable AI visual-reading work packages from a source packet."""

    documents = [
        doc
        for doc in ai_visual_trace_packet.get("documents", [])
        if isinstance(doc, dict)
    ]

    def doc_roles(doc: dict[str, Any]) -> set[str]:
        roles = {str(doc.get("classification") or "unknown")}
        for role in doc.get("classificationRoles") or []:
            if isinstance(role, dict) and role.get("classification"):
                roles.add(str(role["classification"]))
        return roles

    def page_roles_for_routing(doc: dict[str, Any], page: dict[str, Any]) -> set[str]:
        primary = str(doc.get("classification") or "unknown")
        roles = {primary}
        page_roles = {
            str(role["classification"])
            for role in page.get("pageClassificationRoles") or []
            if isinstance(role, dict) and role.get("classification")
        }
        if page_roles:
            roles |= page_roles
        else:
            roles |= doc_roles(doc)
        if primary in {"floor_plan", "section", "elevation", "site_plan", "drainage_doc"}:
            roles |= doc_roles(doc) & {"floor_plan", "section", "elevation", "site_plan", "drainage_doc"}
        return roles

    def docs_for(*classes: str) -> list[dict[str, Any]]:
        wanted = set(classes)
        return [
            doc
            for doc in documents
            if doc_roles(doc) & wanted
            and doc.get("renderedPages")
        ]

    def inputs_for(rows: list[dict[str, Any]], *, wanted_classes: tuple[str, ...]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        wanted = set(wanted_classes)
        for doc in rows:
            for page in doc.get("renderedPages") or []:
                if not isinstance(page, dict):
                    continue
                roles = page_roles_for_routing(doc, page)
                matched = sorted(roles & wanted)
                if not matched:
                    continue
                out.append(
                    {
                        "sourceDocumentId": doc.get("sourceDocumentId"),
                        "relativePath": doc.get("relativePath"),
                        "classification": doc.get("classification"),
                        "classificationRoles": doc.get("classificationRoles") or [],
                        "pageClassificationRoles": page.get("pageClassificationRoles") or [],
                        "matchedClassifications": matched,
                        "page": page.get("page"),
                        "renderedPagePath": page.get("path"),
                    }
                )
        return out

    package_specs = [
        {
            "id": "wp-current-condition",
            "title": "Current condition and photos",
            "classes": ("photo", "unknown", "construction_description", "energy_doc"),
            "task": "Read photos, expose/current-condition pages, construction descriptions, and energy/material documents. Return current-condition observations, material/assembly evidence, wall/floor/roof layer stacks when source-backed, and current-vs-historical conflicts.",
            "factKinds": [
                "photo_observation",
                "material",
                "construction_history",
                "opening",
                "roof",
                "conflict",
            ],
        },
        {
            "id": "wp-dimensional-floorplans",
            "title": "Dimensional floor plans",
            "classes": ("floor_plan",),
            "task": "Trace building scope, levels, wall chains, room loops, wall thicknesses, openings, stairs, and slab openings from floor plans. Prefer explicit dimensions over pixel measurement. State explicitly whether the source represents the whole building, one half of a Doppelhaus, one unit, or an ambiguous scope.",
            "factKinds": [
                "building_scope",
                "level",
                "wall_chain",
                "wall_thickness",
                "room",
                "opening",
                "stair",
                "slab_opening",
                "area",
                "conflict",
            ],
        },
        {
            "id": "wp-sections-elevations-roof",
            "title": "Sections, elevations, roof, dormers",
            "classes": ("section", "elevation"),
            "task": "Extract building scope, levels, heights, roof pitch, eaves/ridge, dormers, skylights, chimneys, facade openings, and section/elevation conflicts. Cross-check whether each elevation/section is for the modeled scope or for a mirrored/neighbouring half.",
            "factKinds": [
                "building_scope",
                "level",
                "roof",
                "dormer",
                "opening",
                "material",
                "conflict",
            ],
        },
        {
            "id": "wp-site-parcel-terrain",
            "title": "Site, parcel, terrain",
            "classes": ("site_plan", "legal_admin"),
            "task": "Extract parcel identifiers, property lines, building placement, road relationship, terrain/topology evidence, and legal/site conflicts.",
            "factKinds": [
                "parcel_boundary",
                "terrain",
                "site_context",
                "construction_history",
                "conflict",
            ],
        },
        {
            "id": "wp-area-volume-schedules",
            "title": "Areas, volumes, schedules",
            "classes": ("area_calculation",),
            "task": "Extract authoritative room areas, built areas, volumes, totals, formulas, and per-half versus whole-building scope.",
            "factKinds": ["area", "volume", "room", "level", "conflict"],
        },
        {
            "id": "wp-drainage-services",
            "title": "Drainage and services",
            "classes": ("drainage_doc",),
            "task": "Extract drainage pipe graphs, diameters, slopes, inspection elements, basement service rooms, and currentness uncertainty.",
            "factKinds": ["drainage", "basement", "room", "conflict"],
        },
    ]

    work_packages: list[dict[str, Any]] = []
    for spec in package_specs:
        rows = docs_for(*spec["classes"])
        package_inputs = inputs_for(rows, wanted_classes=spec["classes"])
        work_packages.append(
            {
                "id": spec["id"],
                "title": spec["title"],
                "status": "ready" if package_inputs else "missing_inputs",
                "inputs": package_inputs,
                "readerTask": spec["task"],
                "expectedFactKinds": spec["factKinds"],
                "blockingRequiredFactKinds": AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE.get(
                    str(spec["id"]), []
                ),
                "requiredValueFieldsByKind": _required_value_fields_for_package(
                    str(spec["id"]),
                    spec["factKinds"],
                ),
                "extractionChecklist": _checklist_for_work_package(str(spec["id"])),
                "outputContract": {
                    "factsOnly": True,
                    "requiredProvenance": [
                        "sourceDocumentId",
                        "page",
                        "region",
                        "method",
                    ],
                    "method": "ai_document_read",
                    "modelMutationsAllowed": False,
                },
            }
        )

    return {
        "ok": True,
        "format": "reverseBimAiVisualTraceWorkOrder_v1",
        "projectGoal": project_goal
        or "Produce validated source facts before any BIM authoring.",
        "sourcePacketFormat": ai_visual_trace_packet.get("format"),
        "documentCount": len(documents),
        "workPackages": work_packages,
        "acceptanceBeforeModeling": [
            "Every work package returns JSON facts with sourceDocumentId, page, region, confidence, and method=ai_document_read.",
            "All hard conflicts have disposition: chosen, merged, tolerated, deferred, or ask_user.",
            "Wall, room, opening, stair, roof, and site facts are modelable enough for reverse_bim.plan_authoring.",
            "Every returned fact passes source.validate_ai_visual_trace_completeness.",
            "No BIM authoring starts from document classification alone.",
        ],
        "digestSha256": _json_digest(
            {
                "packetDigest": ai_visual_trace_packet.get("sourceManifestDigestSha256"),
                "workPackages": work_packages,
            }
        ),
    }


def _required_value_fields_for_package(package_id: str, fact_kinds: list[str]) -> dict[str, list[str]]:
    requirements = {
        kind: AI_VISUAL_FACT_VALUE_REQUIREMENTS[kind]
        for kind in fact_kinds
        if kind in AI_VISUAL_FACT_VALUE_REQUIREMENTS
    }
    if package_id == "wp-dimensional-floorplans" and "room" in requirements:
        requirements["room"] = [
            "levelId",
            "name",
            "areaM2",
            "boundaryMm",
            "boundaryEdges",
            "accessRefs",
            "adjacentRoomRefs",
        ]
    return requirements


def validate_ai_visual_trace_completeness(
    facts: list[dict[str, Any]],
    *,
    required_kinds: list[str] | None = None,
    required_value_fields_by_kind: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Validate whether AI-read facts are detailed enough for reverse-BIM."""

    base = validate_ai_source_facts(facts)
    normalized = base.get("facts") if isinstance(base.get("facts"), list) else []
    findings: list[dict[str, Any]] = []
    for diagnostic in base.get("diagnostics") or []:
        if not isinstance(diagnostic, dict):
            continue
        code = str(diagnostic.get("code") or "")
        severity = (
            "error"
            if code.endswith(("missing", "invalid", "duplicate_id"))
            else "warning"
        )
        findings.append({**diagnostic, "severity": diagnostic.get("severity") or severity})
    counts = Counter()

    for idx, fact in enumerate(normalized):
        if not isinstance(fact, dict):
            continue
        kind = str(fact.get("kind") or "")
        counts[kind] += 1
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        required = (
            required_value_fields_by_kind.get(kind)
            if isinstance(required_value_fields_by_kind, dict) and kind in required_value_fields_by_kind
            else AI_VISUAL_FACT_VALUE_REQUIREMENTS.get(kind, [])
        )
        missing = [field for field in required if not _value_path_present(value, field)]
        if missing:
            findings.append(
                {
                    "code": "ai_visual_fact_required_value_missing",
                    "severity": "error",
                    "factId": fact.get("factId"),
                    "kind": kind,
                    "index": idx,
                    "missingValueFields": missing,
                }
            )
        findings.extend(_validate_ai_visual_fact_value_schema(kind, value, fact=fact, index=idx))

    for required_kind in required_kinds or []:
        if counts.get(str(required_kind), 0) == 0:
            findings.append(
                {
                    "code": "ai_visual_required_fact_kind_missing",
                    "severity": "error",
                    "kind": str(required_kind),
                }
            )

    core_kinds = [
        "level",
        "wall_chain",
        "wall_line",
        "room",
        "opening",
        "stair",
        "roof",
        "parcel_boundary",
        "terrain",
    ]
    core_counts = {kind: counts.get(kind, 0) for kind in core_kinds}
    error_count = sum(1 for finding in findings if finding.get("severity") == "error")
    warning_count = len(findings) - error_count
    return {
        "ok": error_count == 0,
        "format": "sourceAiVisualTraceCompletenessValidation_v1",
        "summary": {
            "factCount": len(normalized),
            "errorCount": error_count,
            "warningCount": warning_count,
            "factCountsByKind": dict(sorted(counts.items())),
            "coreFactCounts": core_counts,
        },
        "findings": findings,
        "facts": normalized,
    }


def _validate_ai_visual_fact_value_schema(
    kind: str,
    value: dict[str, Any],
    *,
    fact: dict[str, Any],
    index: int,
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    def error(field: str, message: str) -> None:
        findings.append(
            {
                "code": "ai_visual_fact_value_schema_invalid",
                "severity": "error",
                "factId": fact.get("factId"),
                "kind": kind,
                "index": index,
                "field": field,
                "message": message,
            }
        )

    if kind in {"wall_line", "wall_chain"}:
        if "thicknessMm" in value and not _positive_number(value.get("thicknessMm")):
            error("thicknessMm", "Wall thickness must be a positive number in mm.")
    if kind == "wall_line":
        for field in ("start", "end"):
            if field in value and not _point_like(value.get(field)):
                error(field, "Wall line endpoints must include numeric x/y coordinates.")
    if kind == "wall_chain":
        if "points" in value and not _point_list(value.get("points"), min_count=2):
            error("points", "Wall chains must include at least two numeric points.")
        if "closed" in value and not isinstance(value.get("closed"), bool):
            error("closed", "Wall chain closed must be a boolean.")
    if kind == "room":
        if "areaM2" in value and not _positive_number(value.get("areaM2")):
            error("areaM2", "Room area must be a positive number in m2.")
        if "boundaryMm" in value and not _point_list(value.get("boundaryMm"), min_count=3):
            error("boundaryMm", "Room boundaryMm must include at least three numeric points.")
        for field in ("boundaryEdges", "accessRefs", "adjacentRoomRefs"):
            if field in value and not isinstance(value.get(field), list):
                error(field, f"Room {field} must be a list.")
    if kind in {"opening", "door", "window"}:
        for field in ("widthMm", "heightMm"):
            if field in value and not _positive_number(value.get(field)):
                error(field, f"Opening {field} must be a positive number in mm.")
        if "sillHeightMm" in value and not _number(value.get("sillHeightMm")):
            error("sillHeightMm", "Window sillHeightMm must be numeric when present.")
    if kind == "stair":
        if "stepCount" in value and not _positive_integer(value.get("stepCount")):
            error("stepCount", "Stair stepCount must be a positive integer.")
        if "runs" in value and not isinstance(value.get("runs"), list):
            error("runs", "Stair runs must be a list.")
    if kind == "slab_opening":
        if "boundary" in value and not _point_list(value.get("boundary"), min_count=3):
            error("boundary", "Slab opening boundary must include at least three numeric points.")
    if kind == "roof":
        for field in ("pitchDeg", "eaveHeightMm", "ridgeHeightMm"):
            if field in value and not _number(value.get(field)):
                error(field, f"Roof {field} must be numeric.")
    if kind == "dormer":
        for field in ("widthMm", "heightMm"):
            if field in value and not _positive_number(value.get(field)):
                error(field, f"Dormer {field} must be a positive number in mm.")
    if kind == "parcel_boundary":
        if "areaM2" in value and not _positive_number(value.get("areaM2")):
            error("areaM2", "Parcel area must be a positive number in m2.")
        if "boundary" in value and not _point_list(value.get("boundary"), min_count=3):
            error("boundary", "Parcel boundary must include at least three numeric points.")
    if kind == "area":
        if "areaM2" in value and not _positive_number(value.get("areaM2")):
            error("areaM2", "Area fact areaM2 must be a positive number.")
    if kind == "volume":
        if "volumeM3" in value and not _positive_number(value.get("volumeM3")):
            error("volumeM3", "Volume fact volumeM3 must be a positive number.")
    if kind == "material":
        layers = value.get("layers", value.get("layerStack"))
        if "layers" in value or "layerStack" in value:
            if not isinstance(layers, list):
                error("layers", "Material layer stack must be a list when present.")
            else:
                for layer_index, layer in enumerate(layers):
                    if not isinstance(layer, dict):
                        error(f"layers[{layer_index}]", "Each material layer must be an object.")
                        continue
                    thickness = layer.get("thicknessMm")
                    if thickness is not None and not _positive_number(thickness):
                        error(
                            f"layers[{layer_index}].thicknessMm",
                            "Material layer thickness must be a positive number in mm.",
                        )
    if kind == "terrain":
        points = value.get("points") or value.get("spotHeights")
        if "points" in value or "spotHeights" in value:
            if not _terrain_point_list(points):
                error("points", "Terrain points/spotHeights must include numeric x/y/z coordinates.")
        contours = value.get("contours")
        if contours is not None and not isinstance(contours, list):
            error("contours", "Terrain contours must be a list when present.")
    if kind == "drainage":
        elements = value.get("elements")
        if "elements" in value and not isinstance(elements, list):
            error("elements", "Drainage elements must be a list.")
        elif isinstance(elements, list):
            for element_index, element in enumerate(elements):
                if not isinstance(element, dict):
                    error(f"elements[{element_index}]", "Each drainage element must be an object.")
                    continue
                diameter = element.get("diameterMm")
                if diameter is not None and not _positive_number(diameter):
                    error(
                        f"elements[{element_index}].diameterMm",
                        "Drainage diameterMm must be a positive number when present.",
                    )
    return findings


def _number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    return isinstance(value, int | float)


def _positive_number(value: Any) -> bool:
    return _number(value) and float(value) > 0


def _positive_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _point_like(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    x_value = value.get("xMm", value.get("x"))
    y_value = value.get("yMm", value.get("y"))
    return _number(x_value) and _number(y_value)


def _point_list(value: Any, *, min_count: int) -> bool:
    return (
        isinstance(value, list)
        and len(value) >= min_count
        and all(_point_like(row) for row in value)
    )


def _terrain_point_list(value: Any) -> bool:
    return (
        isinstance(value, list)
        and all(
            isinstance(row, dict)
            and _number(row.get("xMm", row.get("x")))
            and _number(row.get("yMm", row.get("y")))
            and _number(row.get("zMm", row.get("z")))
            for row in value
        )
    )


def _checklist_for_work_package(work_package_id: str) -> list[str]:
    common = [
        "Return facts only; do not emit BIM commands.",
        "Every fact must include sourceDocumentId, page, region, confidence, and method=ai_document_read.",
        "Mark illegible dimensions and conflicts explicitly; do not silently infer uncertain geometry.",
    ]
    by_id = {
        "wp-current-condition": [
            "Identify every exterior face/photo viewpoint when possible.",
            "Record current materials, roof/window/door state, visible renovations, dormers, skylights, downpipes, and terrain clues.",
            "For wall/floor/roof materials, include layerStack/layers with thickness where the source provides it, or disposition.decision=tolerate_unavailable with reason where it does not.",
            "Flag differences between current photos and historical drawings.",
        ],
        "wp-dimensional-floorplans": [
            "Trace each storey separately.",
            "Return exterior, party, structural, and partition wall chains with thickness and role.",
            "Return room loops with source area, boundary edges, backing wall/separation refs, adjacency refs, and door/opening access refs.",
            "Return every visible door/window/opening with host candidate, dimensions, swing/sill where visible.",
            "Return stair runs, step counts, arrows, landings, and required slab openings.",
        ],
        "wp-sections-elevations-roof": [
            "Extract level heights, floor-to-floor heights, eave and ridge heights.",
            "Extract roof pitch and roof boundary/overhang evidence.",
            "Map dormers, skylights, chimneys, and facade openings to target half/context half.",
        ],
        "wp-site-parcel-terrain": [
            "Extract parcel ids, property boundaries, road relationship, building footprint placement, and neighboring context.",
            "Determine whether site facts describe one half, both halves, or a larger legal parcel.",
            "Flag missing terrain elevations if a toposolid cannot be created from source evidence.",
        ],
        "wp-area-volume-schedules": [
            "Extract every room area row, formula, level subtotal, per-half total, and whole-building total.",
            "Link each area row to a room fact or mark it unresolved.",
            "Extract built area and volume calculations with scope per half or both halves.",
        ],
        "wp-drainage-services": [
            "Extract basement service room labels.",
            "Trace drainage graph with pipe diameters, gradients, manholes/shafts/grubes, and direction where visible.",
            "Mark whether each drainage fact is historic design documentation or current-condition evidence.",
        ],
    }
    return common + by_id.get(work_package_id, [])


def _value_path_present(value: dict[str, Any], path: str) -> bool:
    current: Any = value
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    if current is None:
        return False
    if isinstance(current, str) and not current.strip():
        return False
    if isinstance(current, list | tuple | dict) and len(current) == 0:
        return False
    return True


def validate_ai_source_facts(facts: list[dict[str, Any]]) -> dict[str, Any]:
    diagnostics: list[dict[str, Any]] = []
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for idx, fact in enumerate(facts):
        if not isinstance(fact, dict):
            diagnostics.append({"code": "ai_fact_not_object", "index": idx})
            continue
        fact_id = str(fact.get("factId") or f"ai-srcfact-{idx + 1:04d}")
        if fact_id in seen:
            diagnostics.append({"code": "ai_fact_duplicate_id", "factId": fact_id})
        seen.add(fact_id)
        provenance = fact.get("provenance")
        if not isinstance(provenance, dict) or not provenance.get("sourceDocumentId"):
            diagnostics.append({"code": "ai_fact_provenance_missing", "factId": fact_id})
        confidence = fact.get("confidence", 0.0)
        if not isinstance(confidence, int | float) or not 0 <= confidence <= 1:
            diagnostics.append({"code": "ai_fact_confidence_invalid", "factId": fact_id})
            confidence = 0.0
        normalized.append(
            {
                **fact,
                "factId": fact_id,
                "confidence": float(confidence),
                "status": fact.get("status") or "candidate",
                "provenance": {**(provenance if isinstance(provenance, dict) else {}), "method": "ai_document_read"},
            }
        )
    return {
        "ok": not any(row["code"].endswith(("missing", "invalid", "duplicate_id")) for row in diagnostics),
        "format": "sourceAiFactValidation_v1",
        "factCount": len(normalized),
        "facts": normalized,
        "diagnostics": diagnostics,
    }


def extract_source_facts(
    classifications: dict[str, Any],
    *,
    text_extractions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    text_by_path: dict[str, str] = {}
    for extraction in text_extractions or []:
        source = str(extraction.get("sourcePath") or "")
        text_by_path[source] = "\n".join(str(page.get("text") or "") for page in extraction.get("pages", []))

    facts: list[dict[str, Any]] = []
    for doc in classifications.get("documents", []):
        doc_id = str(doc["sourceDocumentId"])
        classification = str(doc.get("classification") or "unknown")
        classification_labels = _classification_labels(doc)
        drawing_classifications = {"floor_plan", "section", "elevation", "site_plan"}
        drawing_types = (
            classification_labels & drawing_classifications
            if classification in drawing_classifications
            else set()
        )
        source_path = str(doc.get("sourcePath") or "")
        text = text_by_path.get(source_path, "")
        facts.append(
            {
                "factId": f"srcfact-{len(facts) + 1:04d}",
                "kind": "source_document_classification",
                "value": {
                    "classification": classification,
                    "classificationRoles": sorted(classification_labels),
                    "secondaryClassifications": doc.get("secondaryClassifications") or [],
                },
                "confidence": float(doc.get("confidence", 0.0)),
                "status": "accepted" if classification != "unknown" else "candidate",
                "provenance": {
                    "sourceDocumentId": doc_id,
                    "method": "filename_heuristic",
                    "sourcePath": source_path,
                },
            }
        )
        for drawing_type in sorted(drawing_types):
            facts.append(
                {
                    "factId": f"srcfact-{len(facts) + 1:04d}",
                    "kind": "drawing_candidate",
                    "value": {"drawingType": drawing_type, "requiresCoordinateFrame": True},
                    "confidence": float(doc.get("confidence", 0.0)),
                    "status": "candidate",
                    "provenance": {
                        "sourceDocumentId": doc_id,
                        "method": "filename_heuristic",
                        "sourcePath": source_path,
                    },
                }
            )
        if text:
            scale = detect_scale_from_text(text, source_document_id=doc_id)
            for candidate in scale["candidates"]:
                facts.append(
                    {
                        "factId": f"srcfact-{len(facts) + 1:04d}",
                        "kind": "scale_candidate",
                        "value": candidate,
                        "confidence": float(candidate.get("confidence", 0.0)),
                        "status": "candidate",
                        "provenance": {
                            "sourceDocumentId": doc_id,
                            "method": "native_text",
                            "sourcePath": source_path,
                        },
                    }
                )
    return {
        "ok": True,
        "format": "sourceFactLedger_v1",
        "factCount": len(facts),
        "facts": facts,
        "diagnostics": [],
    }


def _file_manifest_row(root: Path, path: Path) -> dict[str, Any]:
    stat = path.stat()
    suffix = path.suffix.lower()
    mime, _encoding = mimetypes.guess_type(str(path))
    row: dict[str, Any] = {
        "sourceDocumentId": _source_document_id(root, path),
        "relativePath": str(path.relative_to(root)),
        "absolutePath": str(path),
        "name": path.name,
        "extension": suffix,
        "mimeType": mime or "application/octet-stream",
        "kind": _file_kind(suffix, mime),
        "sizeBytes": stat.st_size,
        "mtimeMs": int(stat.st_mtime * 1000),
        "sha256": _sha256_file(path),
    }
    if row["kind"] == "image":
        row["image"] = _image_metadata(path)
    if row["kind"] == "pdf":
        row["pdf"] = _pdf_metadata(path)
    return row


def _source_document_id(root: Path, path: Path) -> str:
    rel = str(path.relative_to(root)).replace("\\", "/")
    return "srcdoc-" + hashlib.sha1(rel.encode()).hexdigest()[:12]


def _file_kind(suffix: str, mime: str | None) -> str:
    if suffix in PDF_EXTENSIONS or mime == "application/pdf":
        return "pdf"
    if suffix in IMAGE_EXTENSIONS or str(mime or "").startswith("image/"):
        return "image"
    if suffix in CAD_EXTENSIONS:
        return "cad"
    if suffix in TEXT_EXTENSIONS or str(mime or "").startswith("text/"):
        return "text"
    return "other"


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json_digest(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _image_metadata(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as handle:
            header = handle.read(64)
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            width, height = struct.unpack(">II", header[16:24])
            return {"widthPx": width, "heightPx": height, "format": "png"}
        if header.startswith(b"\xff\xd8"):
            dims = _jpeg_size(path)
            if dims:
                return {"widthPx": dims[0], "heightPx": dims[1], "format": "jpeg"}
        try:
            from PIL import Image  # type: ignore[import-not-found]

            with Image.open(str(path)) as image:
                return {"widthPx": image.width, "heightPx": image.height, "format": image.format}
        except Exception:
            return {"diagnostics": [{"code": "image_dimensions_unavailable"}]}
    except Exception as exc:  # pragma: no cover - defensive.
        return {"diagnostics": [{"code": "image_metadata_failed", "message": str(exc)}]}


def _jpeg_size(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()
    idx = 2
    while idx + 9 < len(data):
        if data[idx] != 0xFF:
            idx += 1
            continue
        marker = data[idx + 1]
        idx += 2
        if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
            if idx + 7 >= len(data):
                return None
            height = int.from_bytes(data[idx + 3 : idx + 5], "big")
            width = int.from_bytes(data[idx + 5 : idx + 7], "big")
            return width, height
        if idx + 2 > len(data):
            return None
        length = int.from_bytes(data[idx : idx + 2], "big")
        idx += max(length, 2)
    return None


def _pdf_metadata(path: Path) -> dict[str, Any]:
    try:
        from pypdf import PdfReader  # type: ignore[import-not-found]

        reader = PdfReader(str(path))
        return {"pageCount": len(reader.pages), "method": "pypdf"}
    except Exception:
        try:
            proc = subprocess.run(
                ["pdfinfo", str(path)],
                check=False,
                capture_output=True,
                text=True,
                timeout=15,
            )
            pages_match = re.search(r"^Pages:\s*(\d+)", proc.stdout, re.MULTILINE)
            if pages_match:
                return {"pageCount": int(pages_match.group(1)), "method": "pdfinfo"}
        except Exception:
            pass
    return {"pageCount": None, "diagnostics": [{"code": "pdf_metadata_unavailable"}]}


def _classify_file(row: dict[str, Any], *, supplemental_text: str | None = None) -> dict[str, Any]:
    haystack = _normalize_search_text(" ".join(
        [
            str(row.get("relativePath") or ""),
            str(row.get("name") or ""),
            str(row.get("mimeType") or ""),
            (supplemental_text or "")[:4000],
        ]
    ))
    role_scores: dict[str, float] = {}
    if row.get("kind") == "image":
        role_scores["photo"] = 0.45
        default = ("photo", 0.45)
    else:
        default = ("unknown", 0.0)
    for label, pattern, confidence in CLASSIFICATION_KEYWORDS:
        if re.search(pattern, haystack, re.IGNORECASE):
            role_scores[label] = max(role_scores.get(label, 0.0), confidence)
    if not role_scores:
        role_scores[default[0]] = default[1]

    sorted_roles = sorted(role_scores.items(), key=lambda item: (-item[1], item[0]))
    best_label, best_confidence = sorted_roles[0]
    classification_roles = [
        {"classification": label, "confidence": confidence}
        for label, confidence in sorted_roles
        if label != "unknown" or len(sorted_roles) == 1
    ]
    return {
        "sourceDocumentId": row["sourceDocumentId"],
        "sourcePath": row.get("absolutePath"),
        "relativePath": row.get("relativePath"),
        "kind": row.get("kind"),
        "classification": best_label,
        "confidence": best_confidence,
        "classificationRoles": classification_roles,
        "secondaryClassifications": [
            role["classification"]
            for role in classification_roles
            if role["classification"] != best_label
        ],
        "method": "filename_text_heuristic" if supplemental_text else "filename_heuristic",
    }


def _classification_roles_from_text(value: str) -> list[dict[str, Any]]:
    haystack = _normalize_search_text(value[:4000])
    if not haystack:
        return []
    role_scores: dict[str, float] = {}
    for label, pattern, confidence in CLASSIFICATION_KEYWORDS:
        if re.search(pattern, haystack, re.IGNORECASE):
            role_scores[label] = max(role_scores.get(label, 0.0), confidence)
    return [
        {"classification": label, "confidence": confidence, "method": "native_page_text_routing_hint"}
        for label, confidence in sorted(role_scores.items(), key=lambda item: (-item[1], item[0]))
    ]


def _classification_labels(row: dict[str, Any]) -> set[str]:
    labels = {str(row.get("classification") or "unknown")}
    for role in row.get("classificationRoles") or []:
        if isinstance(role, dict) and role.get("classification"):
            labels.add(str(role["classification"]))
    for label in row.get("secondaryClassifications") or []:
        if label:
            labels.add(str(label))
    return labels


def _text_extraction_index(text_extractions: list[dict[str, Any]] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for extraction in text_extractions or []:
        if not isinstance(extraction, dict):
            continue
        source_path = str(extraction.get("sourcePath") or "")
        if not source_path:
            continue
        pages = extraction.get("pages") if isinstance(extraction.get("pages"), list) else []
        text = "\n".join(
            str(page.get("text") or "")
            for page in pages
            if isinstance(page, dict) and page.get("text")
        )
        if text.strip():
            out[source_path] = text
    return out


def _normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return (
        asciiish.replace("ß", "ss")
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .lower()
    )


def _files_from_manifest(manifest_or_files: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(manifest_or_files, list):
        return manifest_or_files
    files = manifest_or_files.get("files", [])
    return files if isinstance(files, list) else []


def _error(code: str, message: str, status: int) -> dict[str, Any]:
    return {
        "ok": False,
        "status": status,
        "error": {"code": code, "message": message, "retryable": False, "details": {}},
    }
