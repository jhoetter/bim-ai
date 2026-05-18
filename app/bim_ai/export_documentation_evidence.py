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
    DiameterDimensionElem,
    DimensionElem,
    MaterialTagElem,
    MultiCategoryTagElem,
    PlacedTagElem,
    RadialDimensionElem,
    ScheduleElem,
    SheetElem,
)
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
    SHEET_EXPORT_PDF_MIME_TYPE,
    SHEET_EXPORT_SVG_MIME_TYPE,
    sheet_elem_to_svg,
    sheet_svg_utf8_sha256,
    sheet_viewport_export_listing_lines,
)

DOCUMENTATION_EXPORT_PRODUCTION_EVIDENCE_V1 = "documentationExportProductionEvidence_v1"


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


def _export_href(model_id: UUID | str | None, path: str, *, sheet_id: str | None = None) -> str | None:
    if model_id is None:
        return None
    href = f"/api/models/{model_id}/exports/{path}"
    if sheet_id is not None:
        href += f"?sheetId={quote(sheet_id, safe='')}"
    return href


def _sheet_rows(doc: Document, model_id: UUID | str | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sh in sorted((e for e in doc.elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id):
        svg_text = sheet_elem_to_svg(doc, sh)
        pdf_bytes = sheet_elem_to_pdf_bytes(doc, sh)
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


def _schedule_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sch in sorted((e for e in doc.elements.values() if isinstance(e, ScheduleElem)), key=lambda s: s.id):
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
    for tag in sorted((e for e in doc.elements.values() if isinstance(e, tag_types)), key=lambda t: t.id):
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
    for dim in sorted((e for e in doc.elements.values() if isinstance(e, dim_types)), key=lambda d: d.id):
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

    coverage = {
        "sheetCount": len(sheets),
        "scheduleCount": len(schedules),
        "tagCount": len(tags),
        "dimensionCount": len(dimensions),
        "pdfArtifactCount": sum(
            1 for artifact in all_artifacts if artifact.get("mimeType") == SHEET_EXPORT_PDF_MIME_TYPE
        ),
        "ifcArtifactCount": sum(1 for artifact in all_artifacts if artifact.get("kind") == "ifc"),
        "gltfArtifactCount": sum(1 for artifact in all_artifacts if artifact.get("kind") == "gltf"),
        "glbArtifactCount": sum(1 for artifact in all_artifacts if artifact.get("kind") == "glb"),
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
        "modelExports": model_exports,
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
