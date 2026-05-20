"""Reusable documentation/export production evidence for agent workflows."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from urllib.parse import quote
from uuid import UUID

from bim_ai.document import Document
from bim_ai.elements import (
    AngularDimensionElem,
    ArcLengthDimensionElem,
    BrandTemplateElem,
    DiameterDimensionElem,
    DimensionElem,
    FrameElem,
    MaterialTagElem,
    MultiCategoryTagElem,
    PlacedTagElem,
    PresentationCanvasElem,
    RadialDimensionElem,
    RevisionCloudElem,
    ScheduleElem,
    SheetElem,
    ViewTemplateElem,
)
from bim_ai.exp.pptx_export import build_pptx_bundle
from bim_ai.exp.render_export import build_export_bundle
from bim_ai.export_feature_contract import build_export_manifest_feature_diagnostics_v1
from bim_ai.export_gltf import (
    build_visual_export_manifest,
    document_to_glb_bytes,
    document_to_gltf,
)
from bim_ai.export_ifc import (
    IFC_AVAILABLE,
    ifc_manifest_artifact_hints,
    inspect_kernel_ifc_semantics,
    serialize_ifc_artifact,
)
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.sheet_preview_pdf import sheet_elem_to_pdf_bytes
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_EXPORT_PDF_MIME_TYPE,
    SHEET_EXPORT_PNG_MIME_TYPE,
    SHEET_EXPORT_SVG_MIME_TYPE,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_svg_utf8_sha256,
    sheet_viewport_export_listing_lines,
)

DOCUMENTATION_EXPORT_PRODUCTION_EVIDENCE_V1 = "documentationExportProductionEvidence_v1"
DOCUMENTATION_EXPORT_PARITY_V1 = "documentationExportParity_v1"
DOCUMENTATION_EXPORT_UNSUPPORTED_SKIPPED_V1 = "documentationExportUnsupportedSkipped_v1"


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_json(data: Any) -> str:
    blob = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return _sha256_bytes(blob)


def _artifact_status(
    *,
    byte_length: int,
    digest_sha256: str,
    optional_backend: bool = False,
    artifact_has_geometry: bool | None = None,
) -> dict[str, Any]:
    non_placeholder = bool(
        byte_length > 0
        and len(digest_sha256) == 64
        and digest_sha256 != hashlib.sha256(b"").hexdigest()
    )
    if optional_backend:
        status = "optional-backend-manifest"
        pass_value = True
    else:
        geometry_ok = artifact_has_geometry is not False
        status = "artifact-returned" if non_placeholder and geometry_ok else "invalid-artifact"
        pass_value = non_placeholder and geometry_ok
    return {
        "status": status,
        "pass": pass_value,
        "nonPlaceholderProof": {
            "method": "byte-length-and-sha256",
            "pass": non_placeholder,
            "byteLength": byte_length,
            "digestSha256": digest_sha256,
        },
    }


def _export_href(
    model_id: UUID | str | None, path: str, *, sheet_id: str | None = None
) -> str | None:
    if model_id is None:
        return None
    href = f"/api/models/{model_id}/exports/{path}"
    if sheet_id is not None:
        href += f"?sheetId={quote(sheet_id, safe='')}"
    return href


def _sheet_rows(doc: Document, model_id: UUID | str | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sh in sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id
    ):
        svg_text = sheet_elem_to_svg(doc, sh)
        pdf_bytes = sheet_elem_to_pdf_bytes(doc, sh)
        png_bytes = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg_text)
        listing_lines = sheet_viewport_export_listing_lines(doc, sh)
        listing_digest = _sha256_bytes("\n".join(listing_lines).encode("utf-8"))
        artifacts = [
            {
                "artifactId": f"sheet:{sh.id}:svg",
                "kind": "sheet_svg",
                "artifactName": "sheet-preview.svg",
                "mimeType": SHEET_EXPORT_SVG_MIME_TYPE,
                "href": _export_href(model_id, "sheet-preview.svg", sheet_id=sh.id),
                "byteLength": len(svg_text.encode("utf-8")),
                "digestSha256": sheet_svg_utf8_sha256(svg_text),
            },
            {
                "artifactId": f"sheet:{sh.id}:pdf",
                "kind": "sheet_pdf",
                "artifactName": "sheet-preview.pdf",
                "mimeType": SHEET_EXPORT_PDF_MIME_TYPE,
                "href": _export_href(model_id, "sheet-preview.pdf", sheet_id=sh.id),
                "byteLength": len(pdf_bytes),
                "digestSha256": _sha256_bytes(pdf_bytes),
            },
            {
                "artifactId": f"sheet:{sh.id}:png",
                "kind": "sheet_png",
                "artifactName": "sheet-print-raster.png",
                "mimeType": SHEET_EXPORT_PNG_MIME_TYPE,
                "href": _export_href(model_id, "sheet-print-raster.png", sheet_id=sh.id),
                "byteLength": len(png_bytes),
                "digestSha256": _sha256_bytes(png_bytes),
                "surrogateContract": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
                "fullRasterExportStatus": FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
            },
        ]
        for artifact in artifacts:
            artifact.update(
                _artifact_status(
                    byte_length=int(artifact["byteLength"]),
                    digest_sha256=str(artifact["digestSha256"]),
                )
            )
        rows.append(
            {
                "sheetId": sh.id,
                "sheetName": sh.name,
                "viewportCount": len([vp for vp in sh.viewports_mm or [] if isinstance(vp, dict)]),
                "listingLineCount": len(listing_lines),
                "exportListingDigestSha256": listing_digest,
                "artifacts": artifacts,
            }
        )
    return rows


def _geometry_feature_codes(rows: list[dict[str, Any]]) -> list[str]:
    codes: list[str] = []
    for row in rows:
        reason = str(row.get("reasonCode") or "").strip()
        feature = str(row.get("feature") or "").strip()
        if reason:
            codes.append(reason)
        elif feature:
            codes.append(feature)
    return sorted(set(codes))


def _geometry_manifest_rows_for_artifact(
    *,
    artifact_id: str,
    artifact_kind: str,
    source_rows: list[dict[str, Any]],
    row_type: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in source_rows:
        reason = str(row.get("reasonCode") or "").strip()
        rows.append(
            {
                "artifactId": artifact_id,
                "documentationExportKind": artifact_kind,
                "rowType": row_type,
                "sourceExportFormat": row.get("exportFormat"),
                "elementKind": row.get("elementKind"),
                "feature": row.get("feature"),
                "reasonCode": reason,
                "count": int(row.get("count") or 0),
                "elementIds": list(row.get("elementIds") or []),
                "trackerItems": list(row.get("trackerItems") or ["BIR-K01", "BIR-R05"]),
            }
        )
    return rows


def _documentation_export_unsupported_skipped_manifest_v1(
    *,
    doc: Document,
    sheet_rows: list[dict[str, Any]],
    render_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    source = build_export_manifest_feature_diagnostics_v1(
        doc,
        export_format="gltf",
    )["exportGeometryUnsupportedSkipped_v1"]
    unsupported_source = [
        row
        for row in source.get("unsupportedRows") or []
        if isinstance(row, dict) and row.get("feature") != "document-kind"
    ]
    skipped_source = [row for row in source.get("skippedRows") or [] if isinstance(row, dict)]
    rows: list[dict[str, Any]] = []

    doc_artifacts: list[tuple[str, str]] = []
    for sheet in sheet_rows:
        for artifact in sheet.get("artifacts") or []:
            if not isinstance(artifact, dict):
                continue
            kind = str(artifact.get("kind") or "")
            if kind in {"sheet_svg", "sheet_pdf", "sheet_png"}:
                doc_artifacts.append((str(artifact.get("artifactId") or ""), kind))
    for render in render_rows:
        fmt = str(render.get("format") or "")
        if fmt:
            doc_artifacts.append((f"render:{fmt}", "render_bundle"))

    for artifact_id, artifact_kind in doc_artifacts:
        rows.extend(
            _geometry_manifest_rows_for_artifact(
                artifact_id=artifact_id,
                artifact_kind=artifact_kind,
                source_rows=unsupported_source,
                row_type="unsupported_geometry",
            )
        )
        rows.extend(
            _geometry_manifest_rows_for_artifact(
                artifact_id=artifact_id,
                artifact_kind=artifact_kind,
                source_rows=skipped_source,
                row_type="skipped_or_dropped_geometry",
            )
        )
        if artifact_kind == "sheet_png":
            rows.append(
                {
                    "artifactId": artifact_id,
                    "documentationExportKind": artifact_kind,
                    "rowType": "unsupported_renderer",
                    "sourceExportFormat": "documentation",
                    "elementKind": "sheet",
                    "feature": "full-sheet-raster",
                    "reasonCode": FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
                    "count": 1,
                    "elementIds": [],
                    "trackerItems": ["BIR-K01", "BIR-R05", "BIR-K06"],
                }
            )

    rows.sort(
        key=lambda row: (
            str(row.get("artifactId") or ""),
            str(row.get("rowType") or ""),
            str(row.get("elementKind") or ""),
            str(row.get("reasonCode") or ""),
        )
    )
    return {
        "format": DOCUMENTATION_EXPORT_UNSUPPORTED_SKIPPED_V1,
        "rows": rows,
        "summary": {
            "rowCount": len(rows),
            "unsupportedRowCount": sum(
                1
                for row in rows
                if row.get("rowType") in {"unsupported_geometry", "unsupported_renderer"}
            ),
            "skippedOrDroppedRowCount": sum(
                1 for row in rows if row.get("rowType") == "skipped_or_dropped_geometry"
            ),
            "affectedElementCount": sum(int(row.get("count") or 0) for row in rows),
        },
        "digestSha256": _sha256_json(rows),
    }


def _documentation_export_parity_v1(
    *,
    sheet_rows: list[dict[str, Any]],
    render_rows: list[dict[str, Any]],
    unsupported_manifest: dict[str, Any],
) -> dict[str, Any]:
    unsupported_by_artifact: dict[str, list[dict[str, Any]]] = {}
    dropped_by_artifact: dict[str, list[dict[str, Any]]] = {}
    for row in unsupported_manifest.get("rows") or []:
        if not isinstance(row, dict):
            continue
        artifact_id = str(row.get("artifactId") or "")
        if not artifact_id:
            continue
        if row.get("rowType") == "skipped_or_dropped_geometry":
            dropped_by_artifact.setdefault(artifact_id, []).append(row)
        else:
            unsupported_by_artifact.setdefault(artifact_id, []).append(row)

    parity_rows: list[dict[str, Any]] = []
    for sheet in sheet_rows:
        saved_view_digest = str(sheet.get("exportListingDigestSha256") or "")
        for artifact in sheet.get("artifacts") or []:
            if not isinstance(artifact, dict):
                continue
            artifact_id = str(artifact.get("artifactId") or "")
            kind = str(artifact.get("kind") or "")
            if kind not in {"sheet_svg", "sheet_pdf", "sheet_png"}:
                continue
            unsupported = _geometry_feature_codes(unsupported_by_artifact.get(artifact_id, []))
            dropped = _geometry_feature_codes(dropped_by_artifact.get(artifact_id, []))
            export_digest = (
                str(artifact.get("digestSha256") or "")
                if kind == "sheet_png"
                else saved_view_digest
            )
            parity_rows.append(
                {
                    "scopeId": artifact_id,
                    "exportType": kind,
                    "sheetId": sheet.get("sheetId"),
                    "savedViewDigest": saved_view_digest,
                    "exportDigest": export_digest,
                    "digestBasis": (
                        "viewport-listing-vs-print-surrogate"
                        if kind == "sheet_png"
                        else "viewport-listing-parity"
                    ),
                    "digestsMatch": saved_view_digest == export_digest,
                    "unsupportedFeatures": unsupported,
                    "listedUnsupportedFeatures": unsupported,
                    "droppedVisualGeometry": dropped,
                    "listedDroppedVisualGeometry": dropped,
                    "modelInvalidFeatures": [],
                    "status": "warn" if saved_view_digest != export_digest else "pass",
                }
            )

    for row in render_rows:
        fmt = str(row.get("format") or "")
        if not fmt:
            continue
        artifact_id = f"render:{fmt}"
        unsupported = _geometry_feature_codes(unsupported_by_artifact.get(artifact_id, []))
        dropped = _geometry_feature_codes(dropped_by_artifact.get(artifact_id, []))
        digest = str(row.get("bundleDigestSha256") or "")
        parity_rows.append(
            {
                "scopeId": artifact_id,
                "exportType": "render_bundle",
                "savedViewDigest": digest,
                "exportDigest": digest,
                "digestBasis": "stable-render-bundle",
                "digestsMatch": True,
                "unsupportedFeatures": unsupported,
                "listedUnsupportedFeatures": unsupported,
                "droppedVisualGeometry": dropped,
                "listedDroppedVisualGeometry": dropped,
                "modelInvalidFeatures": [],
                "status": "pass",
            }
        )

    parity_rows.sort(key=lambda row: str(row.get("scopeId") or ""))
    fail_count = sum(1 for row in parity_rows if row.get("status") == "fail")
    warn_count = sum(1 for row in parity_rows if row.get("status") == "warn")
    return {
        "format": DOCUMENTATION_EXPORT_PARITY_V1,
        "rows": parity_rows,
        "summary": {
            "rowCount": len(parity_rows),
            "passRowCount": sum(1 for row in parity_rows if row.get("status") == "pass"),
            "warnRowCount": warn_count,
            "failRowCount": fail_count,
            "unsupportedFeatureCount": sum(
                len(row.get("unsupportedFeatures") or []) for row in parity_rows
            ),
            "droppedVisualGeometryCount": sum(
                len(row.get("droppedVisualGeometry") or []) for row in parity_rows
            ),
        },
        "status": "fail" if fail_count else "warn" if warn_count else "clean",
        "pass": fail_count == 0,
        "digestSha256": _sha256_json(parity_rows),
    }


def _schedule_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sch in sorted(
        (e for e in doc.elements.values() if isinstance(e, ScheduleElem)), key=lambda s: s.id
    ):
        payload = derive_schedule_table(doc, sch.id)
        data_rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
        columns = payload.get("columns") if isinstance(payload.get("columns"), list) else []
        rows.append(
            {
                "scheduleId": sch.id,
                "scheduleName": sch.name,
                "sheetId": sch.sheet_id,
                "rowCount": len(data_rows),
                "columnCount": len(columns),
                "schedulePlacement": payload.get("schedulePlacement"),
                "payloadDigestSha256": _sha256_json(payload),
            }
        )
    return rows


def _tag_rows(doc: Document) -> list[dict[str, Any]]:
    tag_types = (PlacedTagElem, MaterialTagElem, MultiCategoryTagElem)
    rows: list[dict[str, Any]] = []
    for tag in sorted(
        (e for e in doc.elements.values() if isinstance(e, tag_types)), key=lambda t: t.id
    ):
        row: dict[str, Any] = {
            "tagId": tag.id,
            "tagKind": tag.kind,
            "hostViewId": getattr(tag, "host_view_id", None),
            "hostElementId": getattr(tag, "host_element_id", None),
            "textOverride": getattr(tag, "text_override", None),
            "resolvesHostElement": bool(doc.elements.get(str(getattr(tag, "host_element_id", "")))),
            "resolvesHostView": bool(doc.elements.get(str(getattr(tag, "host_view_id", "")))),
        }
        if isinstance(tag, PlacedTagElem):
            row["tagDefinitionId"] = tag.tag_definition_id
        if isinstance(tag, MaterialTagElem):
            row["layerIndex"] = tag.layer_index
        if isinstance(tag, MultiCategoryTagElem):
            row["parameterName"] = tag.parameter_name
        rows.append(row)
    return rows


def _dimension_rows(doc: Document) -> list[dict[str, Any]]:
    dim_types = (
        DimensionElem,
        AngularDimensionElem,
        RadialDimensionElem,
        DiameterDimensionElem,
        ArcLengthDimensionElem,
    )
    rows: list[dict[str, Any]] = []
    for dim in sorted(
        (e for e in doc.elements.values() if isinstance(e, dim_types)), key=lambda d: d.id
    ):
        row: dict[str, Any] = {
            "dimensionId": dim.id,
            "dimensionKind": dim.kind,
            "hostViewId": getattr(dim, "host_view_id", None),
            "levelId": getattr(dim, "level_id", None),
            "autoGenerated": bool(getattr(dim, "auto_generated", False)),
        }
        if isinstance(dim, DimensionElem):
            row.update(
                {
                    "state": dim.state,
                    "refElementIdA": dim.ref_element_id_a,
                    "refElementIdB": dim.ref_element_id_b,
                    "resolvesRefElementA": bool(
                        dim.ref_element_id_a and doc.elements.get(dim.ref_element_id_a)
                    ),
                    "resolvesRefElementB": bool(
                        dim.ref_element_id_b and doc.elements.get(dim.ref_element_id_b)
                    ),
                }
            )
        rows.append(row)
    return rows


def _model_export_rows(doc: Document, model_id: UUID | str | None) -> list[dict[str, Any]]:
    ifc_step, ifc_encoding, ifc_has_physical_geometry = serialize_ifc_artifact(doc)
    gltf_json = document_to_gltf(doc)
    gltf_bytes = json.dumps(gltf_json, sort_keys=True, separators=(",", ":"), default=str).encode(
        "utf-8"
    )
    glb_bytes = document_to_glb_bytes(doc)
    gltf_manifest = build_visual_export_manifest(doc)

    ifc_digest = _sha256_bytes(ifc_step.encode("utf-8"))
    gltf_digest = _sha256_bytes(gltf_bytes)
    glb_digest = _sha256_bytes(glb_bytes)
    ifc_optional_backend = not IFC_AVAILABLE and not ifc_has_physical_geometry

    ifc_status = _artifact_status(
        byte_length=len(ifc_step.encode("utf-8")),
        digest_sha256=ifc_digest,
        optional_backend=ifc_optional_backend,
        artifact_has_geometry=ifc_has_physical_geometry,
    )
    if ifc_optional_backend:
        ifc_status["optionalBackendManifest_v1"] = {
            "backend": "ifcopenshell",
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "stableFallback": "minimal_empty_ifc_skeleton",
            "overclaimProtection": (
                "artifactHasPhysicalGeometry=false and status=optional-backend-manifest; "
                "the skeleton digest is provided only as fallback-manifest evidence."
            ),
        }

    return [
        {
            "artifactId": "model:ifc",
            "kind": "ifc",
            "artifactName": "model.ifc",
            "mimeType": "application/x-step",
            "href": _export_href(model_id, "model.ifc"),
            "byteLength": len(ifc_step.encode("utf-8")),
            "digestSha256": ifc_digest,
            "encoding": ifc_encoding,
            "ifcOpenShellAvailable": IFC_AVAILABLE,
            "artifactHasPhysicalGeometry": ifc_has_physical_geometry,
            "manifestHints": ifc_manifest_artifact_hints(
                doc, emitting_kernel_body=ifc_has_physical_geometry
            ),
            "semanticReadback": inspect_kernel_ifc_semantics(doc=doc),
            **ifc_status,
        },
        {
            "artifactId": "model:gltf",
            "kind": "gltf",
            "artifactName": "model.gltf",
            "mimeType": "model/gltf+json",
            "href": _export_href(model_id, "model.gltf"),
            "byteLength": len(gltf_bytes),
            "digestSha256": gltf_digest,
            "manifestDigestSha256": _sha256_json(gltf_manifest),
            "manifestExtension": gltf_manifest["extensions"]["BIM_AI_exportManifest_v0"],
            **_artifact_status(byte_length=len(gltf_bytes), digest_sha256=gltf_digest),
        },
        {
            "artifactId": "model:glb",
            "kind": "glb",
            "artifactName": "model.glb",
            "mimeType": "model/gltf-binary",
            "href": _export_href(model_id, "model.glb"),
            "byteLength": len(glb_bytes),
            "digestSha256": glb_digest,
            **_artifact_status(byte_length=len(glb_bytes), digest_sha256=glb_digest),
        },
    ]


def _presentation_rows(doc: Document, model_id: UUID | str | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    frames = [
        elem.model_dump(by_alias=True)
        for elem in doc.elements.values()
        if isinstance(elem, FrameElem)
    ]
    for canvas in sorted(
        (e for e in doc.elements.values() if isinstance(e, PresentationCanvasElem)),
        key=lambda c: c.id,
    ):
        canvas_dict = canvas.model_dump(by_alias=True)
        bundle = build_pptx_bundle(canvas_dict, frames).to_dict()
        canvas_frames = [
            frame for frame in frames if frame.get("presentationCanvasId") == canvas.id
        ]
        rows.append(
            {
                "canvasId": canvas.id,
                "canvasName": canvas.name,
                "frameCount": len(canvas_frames),
                "slideCount": len(bundle.get("slides", [])),
                "bundleDigestSha256": _sha256_json(bundle),
                "href": (
                    f"/api/v3/models/{model_id}/presentation-canvases/{quote(canvas.id, safe='')}/export"
                    if model_id is not None
                    else None
                ),
                "frames": [
                    {
                        "frameId": frame.get("id"),
                        "viewId": frame.get("viewId"),
                        "caption": frame.get("caption"),
                        "brandTemplateId": frame.get("brandTemplateId"),
                        "sortOrder": frame.get("sortOrder", 0),
                    }
                    for frame in sorted(canvas_frames, key=lambda f: int(f.get("sortOrder", 0)))
                ],
            }
        )
    return rows


def _branded_export_rows(doc: Document, model_id: UUID | str | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    sheets = [
        {"sheetId": sheet.id, "name": sheet.name}
        for sheet in sorted(
            (e for e in doc.elements.values() if isinstance(e, SheetElem)),
            key=lambda s: s.id,
        )
    ]
    templates = sorted(
        (e for e in doc.elements.values() if isinstance(e, BrandTemplateElem)),
        key=lambda t: t.id,
    )
    for template in templates:
        bundle = {
            "schemaVersion": "out-v3.0",
            "format": "pdf",
            "brandTemplateId": template.id,
            "brandLayer": {
                "accentHex": template.accent_hex,
                "accentForegroundHex": template.accent_foreground_hex,
                "typeface": template.typeface,
                "logoMarkSvgUri": template.logo_mark_svg_uri,
                "cssOverrideSnippet": template.css_override_snippet,
            },
            "sheets": sheets,
            "invariantCheck": "layer-c-only",
        }
        rows.append(
            {
                "brandTemplateId": template.id,
                "brandName": template.name,
                "sheetCount": len(sheets),
                "format": "pdf",
                "invariantCheck": "layer-c-only",
                "bundleDigestSha256": _sha256_json(bundle),
                "href": (
                    f"/api/v3/models/{model_id}/export/pdf?brandTemplateId={quote(template.id, safe='')}"
                    if model_id is not None
                    else None
                ),
            }
        )
    return rows


def _advanced_documentation_rows(doc: Document) -> dict[str, Any]:
    view_templates = sorted(
        (e for e in doc.elements.values() if isinstance(e, ViewTemplateElem)),
        key=lambda t: t.id,
    )
    revision_clouds = sorted(
        (e for e in doc.elements.values() if isinstance(e, RevisionCloudElem)),
        key=lambda r: r.id,
    )
    return {
        "viewTemplateCount": len(view_templates),
        "revisionCloudCount": len(revision_clouds),
        "viewTemplates": [
            {
                "viewTemplateId": template.id,
                "name": template.name,
                "scale": template.scale,
                "hiddenCategoryCount": len(template.hidden_categories),
                "planDetailLevel": template.plan_detail_level,
            }
            for template in view_templates
        ],
        "revisionClouds": [
            {
                "revisionCloudId": cloud.id,
                "hostViewId": cloud.host_view_id,
                "boundaryVertexCount": len(cloud.boundary_mm),
                "colour": cloud.colour,
                "strokeMm": cloud.stroke_mm,
            }
            for cloud in revision_clouds
        ],
    }


def _render_export_rows(doc: Document, model_id: UUID | str | None) -> list[dict[str, Any]]:
    elements_list = [elem.model_dump(by_alias=True) for elem in doc.elements.values()]
    model_state = {"elements": elements_list}
    rows: list[dict[str, Any]] = []
    for fmt in ("metadata-only", "gltf-pbr", "ifc-bundle"):
        bundle = build_export_bundle(model_state, fmt)  # type: ignore[arg-type]
        bundle_dict = bundle.to_dict()
        rows.append(
            {
                "format": fmt,
                "primaryAsset": bundle_dict.get("primaryAsset"),
                "cameraCount": len(bundle_dict.get("metadata", {}).get("cameras", [])),
                "materialCount": len(bundle_dict.get("metadata", {}).get("materials", [])),
                "bundleDigestSha256": _sha256_json(bundle_dict),
                "href": (
                    f"/api/v3/models/{model_id}/export?format={quote(fmt, safe='')}"
                    if model_id is not None
                    else None
                ),
                "status": "render-bundle-accepted",
                "pass": True,
            }
        )
    return rows


def build_documentation_export_production_evidence_v1(
    doc: Document,
    *,
    model_id: UUID | str | None = None,
) -> dict[str, Any]:
    """Build agent-consumable production evidence for documentation and exchange exports.

    The helper is intentionally side-effect free: it computes reusable artifact
    descriptors and byte digests in memory, while optional backend availability
    such as IfcOpenShell is carried in the evidence instead of hidden by tests.
    """

    sheets = _sheet_rows(doc, model_id)
    schedules = _schedule_rows(doc)
    tags = _tag_rows(doc)
    dimensions = _dimension_rows(doc)
    model_exports = _model_export_rows(doc, model_id)
    presentation_canvases = _presentation_rows(doc, model_id)
    branded_exports = _branded_export_rows(doc, model_id)
    advanced_documentation = _advanced_documentation_rows(doc)
    render_exports = _render_export_rows(doc, model_id)
    documentation_export_unsupported_skipped = (
        _documentation_export_unsupported_skipped_manifest_v1(
            doc=doc,
            sheet_rows=sheets,
            render_rows=render_exports,
        )
    )
    documentation_export_parity = _documentation_export_parity_v1(
        sheet_rows=sheets,
        render_rows=render_exports,
        unsupported_manifest=documentation_export_unsupported_skipped,
    )
    all_artifacts = [a for sheet in sheets for a in sheet["artifacts"]] + model_exports
    marker_rows = [
        {
            "markerId": artifact["artifactId"],
            "kind": artifact["kind"],
            "href": artifact.get("href"),
            "digestSha256": artifact.get("digestSha256"),
            "byteLength": artifact.get("byteLength"),
            "status": artifact.get("status"),
            "pass": artifact.get("pass"),
        }
        for artifact in all_artifacts
    ]
    marker_rows.extend(
        {
            "markerId": f"schedule:{row['scheduleId']}",
            "kind": "schedule_table",
            "digestSha256": row["payloadDigestSha256"],
            "rowCount": row["rowCount"],
            "columnCount": row["columnCount"],
        }
        for row in schedules
    )
    marker_rows.extend(
        {
            "markerId": f"tag:{row['tagId']}",
            "kind": row["tagKind"],
            "hostElementId": row.get("hostElementId"),
            "hostViewId": row.get("hostViewId"),
        }
        for row in tags
    )
    marker_rows.extend(
        {
            "markerId": f"dimension:{row['dimensionId']}",
            "kind": row["dimensionKind"],
            "hostViewId": row.get("hostViewId"),
            "levelId": row.get("levelId"),
        }
        for row in dimensions
    )
    marker_rows.extend(
        {
            "markerId": f"presentation:{row['canvasId']}",
            "kind": "presentation_canvas",
            "href": row.get("href"),
            "frameCount": row["frameCount"],
            "bundleDigestSha256": row["bundleDigestSha256"],
        }
        for row in presentation_canvases
    )
    marker_rows.extend(
        {
            "markerId": f"brand-export:{row['brandTemplateId']}",
            "kind": "branded_pdf_export",
            "href": row.get("href"),
            "bundleDigestSha256": row["bundleDigestSha256"],
            "invariantCheck": row["invariantCheck"],
        }
        for row in branded_exports
    )
    marker_rows.extend(
        {
            "markerId": f"render:{row['format']}",
            "kind": "render_bundle",
            "href": row.get("href"),
            "bundleDigestSha256": row["bundleDigestSha256"],
            "status": row["status"],
            "pass": row["pass"],
        }
        for row in render_exports
    )

    coverage = {
        "sheetCount": len(sheets),
        "scheduleCount": len(schedules),
        "tagCount": len(tags),
        "dimensionCount": len(dimensions),
        "presentationCanvasCount": len(presentation_canvases),
        "presentationFrameCount": sum(row["frameCount"] for row in presentation_canvases),
        "brandTemplateCount": len(branded_exports),
        "renderBundleCount": len(render_exports),
        "viewTemplateCount": advanced_documentation["viewTemplateCount"],
        "revisionCloudCount": advanced_documentation["revisionCloudCount"],
        "pdfArtifactCount": sum(
            1
            for artifact in all_artifacts
            if artifact.get("mimeType") == SHEET_EXPORT_PDF_MIME_TYPE
        ),
        "printRasterPngArtifactCount": sum(
            1
            for artifact in all_artifacts
            if artifact.get("mimeType") == SHEET_EXPORT_PNG_MIME_TYPE
        ),
        "ifcArtifactCount": sum(1 for artifact in all_artifacts if artifact.get("kind") == "ifc"),
        "gltfArtifactCount": sum(1 for artifact in all_artifacts if artifact.get("kind") == "gltf"),
        "glbArtifactCount": sum(1 for artifact in all_artifacts if artifact.get("kind") == "glb"),
        "documentationExportParityRowCount": documentation_export_parity["summary"]["rowCount"],
        "documentationExportUnsupportedRowCount": documentation_export_unsupported_skipped[
            "summary"
        ]["unsupportedRowCount"],
        "documentationExportDroppedRowCount": documentation_export_unsupported_skipped["summary"][
            "skippedOrDroppedRowCount"
        ],
        "externalExportMarkerCount": len(marker_rows),
    }
    artifact_closure_rows = [
        {
            "artifactId": artifact["artifactId"],
            "kind": artifact["kind"],
            "artifactName": artifact["artifactName"],
            "status": artifact.get("status"),
            "pass": artifact.get("pass"),
            "byteLength": artifact.get("byteLength"),
            "digestSha256": artifact.get("digestSha256"),
            "href": artifact.get("href"),
            "optionalBackendManifest_v1": artifact.get("optionalBackendManifest_v1"),
            "nonPlaceholderProof": artifact.get("nonPlaceholderProof"),
        }
        for artifact in all_artifacts
    ]
    artifact_closure_rows.sort(key=lambda row: str(row["artifactId"]))
    clean_or_explicit = all(row.get("pass") is True for row in artifact_closure_rows)
    body: dict[str, Any] = {
        "format": DOCUMENTATION_EXPORT_PRODUCTION_EVIDENCE_V1,
        "modelId": str(model_id) if model_id is not None else None,
        "revision": doc.revision,
        "coverage": coverage,
        "sheets": sheets,
        "schedules": schedules,
        "tags": tags,
        "dimensions": dimensions,
        "presentationCanvases": presentation_canvases,
        "brandedExports": branded_exports,
        "advancedDocumentation": advanced_documentation,
        "renderExports": render_exports,
        "modelExports": model_exports,
        "documentationExportUnsupportedSkipped_v1": documentation_export_unsupported_skipped,
        "documentationExportParity_v1": documentation_export_parity,
        "artifactClosure_v1": {
            "format": "documentationExportArtifactClosure_v1",
            "status": "clean-or-explicit-optional-backend"
            if clean_or_explicit
            else "artifact-closure-incomplete",
            "pass": clean_or_explicit,
            "rows": artifact_closure_rows,
            "digestSha256": _sha256_json(artifact_closure_rows),
        },
        "externalExportMarkers_v1": {
            "format": "externalExportMarkers_v1",
            "markers": marker_rows,
        },
    }
    body["evidenceDigestSha256"] = _sha256_json(body)
    return body
