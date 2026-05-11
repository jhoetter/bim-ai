"""Structured evidence-package manifest (Revit parity Phase A operational tracker)."""

from __future__ import annotations

import hashlib
import json
import os
import struct
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import UUID

from bim_ai.bcf_issue_package_export import bcf_issue_package_export_v1
from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    IssueElem,
    PlanViewElem,
    SectionCutElem,
    SheetElem,
    ViewpointElem,
)
from bim_ai.schedule_sheet_export_parity import (
    build_schedule_sheet_export_parity_evidence_v1_for_sheet,
)
from bim_ai.section_on_sheet_integration_evidence_v1 import (
    build_section_on_sheet_integration_evidence_v1,
)
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_EXPORT_PDF_MIME_TYPE,
    SHEET_EXPORT_PNG_MIME_TYPE,
    SHEET_EXPORT_SVG_MIME_TYPE,
    SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    build_sheet_print_raster_print_contract_v3,
    detail_callout_readout_rows_v0,
    plan_room_programme_legend_hints_v0,
    plan_sheet_viewport_placement_evidence_v1,
    room_color_scheme_legend_placement_evidence_v1,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_svg_utf8_sha256,
    sheet_viewport_export_listing_lines,
    sheetExportSegmentCompleteness_v1,
    sheetViewportProductionManifest_v1,
    viewport_evidence_hints_v1,
)
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    build_sheet_titleblock_revision_issue_manifest_v1,
    normalize_titleblock_revision_issue_v1,
    titleblockFieldCompleteness_v1,
)

PLAYWRIGHT_EVIDENCE_SCREENSHOTS_ROOT_HINT = (
    "packages/web/e2e/__screenshots__/evidence-baselines/evidence-baselines.spec.ts/"
)


def export_link_map(model_id: UUID) -> dict[str, str]:
    mid = str(model_id)
    base = f"/api/models/{mid}"
    return {
        "snapshot": f"{base}/snapshot",
        "summary": f"{base}/summary",
        "validate": f"{base}/validate",
        "evidencePackage": f"{base}/evidence-package",
        "commandLog": f"{base}/command-log",
        "gltfManifest": f"{base}/exports/gltf-manifest",
        "gltfModel": f"{base}/exports/model.gltf",
        "glbModel": f"{base}/exports/model.glb",
        "ifcManifest": f"{base}/exports/ifc-manifest",
        "ifcEmptySkeleton": f"{base}/exports/ifc-empty-skeleton.ifc",
        "ifcModel": f"{base}/exports/model.ifc",
        "bcfTopicsJsonExport": f"{base}/exports/bcf-topics-json",
        "bcfTopicsJsonImport": f"{base}/imports/bcf-topics-json",
        "sheetPreviewSvg": f"{base}/exports/sheet-preview.svg",
        "sheetPreviewPdf": f"{base}/exports/sheet-preview.pdf",
        "sheetPrintRasterPng": f"{base}/exports/sheet-print-raster.png",
        "roomDerivationCandidates": f"{base}/room-derivation-candidates",
        "typeMaterialRegistry": f"{base}/registry/type-material",
        "planProjectionWire": f"{base}/projection/plan",
        "sectionProjectionWire": f"{base}/projection/section/{{sectionCutId}}",
    }


def expected_screenshot_captures(plan_view_ids: list[str]) -> list[dict[str, Any]]:
    """Human/CI checklist: correlate Playwright snapshots with layouts (not enforced server-side)."""
    base = [
        {
            "id": "coord_sheet",
            "workspaceLayoutPreset": "coordination",
            "recommendedTestIds": ["sheet-canvas", "schedule-panel"],
            "screenshotBaseline": "coordination-sheet.png",
            "note": "Sheet canvas + schedules rail",
        },
        {
            "id": "coord_schedules",
            "workspaceLayoutPreset": "coordination",
            "recommendedTestIds": ["schedule-panel"],
            "screenshotBaseline": "coordination-schedules.png",
        },
        {
            "id": "schedules_focus",
            "workspaceLayoutPreset": "schedules_focus",
            "recommendedTestIds": ["schedule-panel", "plan-canvas"],
            "screenshotBaseline": "schedules-focus.png",
            "note": "Docked schedule beside plan",
        },
        {
            "id": "split_plan_3d",
            "workspaceLayoutPreset": "split_plan_3d",
            "recommendedTestIds": ["plan-canvas", "orbit-3d-viewport"],
            "note": "WebGL-heavy; PNG optional, visibility required in CI",
        },
        {
            "id": "split_plan_section",
            "workspaceLayoutPreset": "split_plan_section",
            "recommendedTestIds": ["plan-canvas"],
        },
        {
            "id": "sheet_full_deterministic",
            "workspaceLayoutPreset": "coordination",
            "recommendedTestIds": ["sheet-canvas"],
            "note": (
                "Correlate Playwright PNG with `evidencePackage.deterministicSheetEvidence` rows; prefix filenames "
                "with `suggestedEvidenceArtifactBasename` for artifact sorting in CI."
            ),
        },
    ]
    for pv in plan_view_ids:
        base.append(
            {
                "id": f"activate_plan_view_{pv}",
                "workspaceLayoutPreset": "split_plan_3d",
                "planViewElementId": pv,
                "recommendedTestIds": ["plan-canvas"],
                "note": "Activate named plan_view in Project browser before capture",
            }
        )
    return base


def plan_view_wire_index(doc: Document) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in doc.elements.values():
        if isinstance(e, PlanViewElem):
            cmap_min = e.crop_min_mm.model_dump(by_alias=True) if e.crop_min_mm else None
            cmap_max = e.crop_max_mm.model_dump(by_alias=True) if e.crop_max_mm else None
            out.append(
                {
                    "id": e.id,
                    "name": e.name,
                    "levelId": e.level_id,
                    "planPresentation": e.plan_presentation,
                    "viewTemplateId": e.view_template_id,
                    "underlayLevelId": e.underlay_level_id,
                    "discipline": e.discipline,
                    "phaseId": e.phase_id,
                    "cropMinMm": cmap_min,
                    "cropMaxMm": cmap_max,
                    "viewRangeBottomMm": e.view_range_bottom_mm,
                    "viewRangeTopMm": e.view_range_top_mm,
                    "cutPlaneOffsetMm": e.cut_plane_offset_mm,
                    "categoriesHidden": list(e.categories_hidden or []),
                }
            )

    return sorted(out, key=lambda x: x["id"])


def deterministic_sheet_evidence_manifest(
    *,
    model_id: UUID,
    doc: Document,
    evidence_artifact_basename: str,
    semantic_digest_sha256: str,
    semantic_digest_prefix16: str,
) -> list[dict[str, Any]]:
    """Stable rows for CI / Playwright naming (WP-E05/E06 / WP-A03/A04)."""

    mid = str(model_id)
    api_base = f"/api/models/{mid}/exports"

    sheets = [e for e in doc.elements.values() if isinstance(e, SheetElem)]

    rows: list[dict[str, Any]] = []

    bundle_json = f"{evidence_artifact_basename}-evidence-package.json"

    for sh in sorted(sheets, key=lambda s: s.id):
        safe = "".join(ch for ch in sh.id if ch.isalnum() or ch in ("-", "_")) or "sheet"

        qid = quote(sh.id, safe="")

        stem = f"{evidence_artifact_basename}-sheet-{safe}"
        svg_body = sheet_elem_to_svg(doc, sh)
        svg_sha = sheet_svg_utf8_sha256(svg_body)
        placeholder_png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg_body)
        placeholder_png_sha = hashlib.sha256(placeholder_png).hexdigest()

        listing_blob = "\n".join(sheet_viewport_export_listing_lines(doc, sh)).encode("utf-8")
        export_listing_digest = hashlib.sha256(listing_blob).hexdigest()

        sheet_export_artifact_manifest: dict[str, Any] = {
            "format": "sheetExportArtifactManifest_v1",
            "sheetId": sh.id,
            "artifacts": [
                {
                    "artifactName": "sheet-preview.svg",
                    "mimeType": SHEET_EXPORT_SVG_MIME_TYPE,
                    "relativeArtifactPath": "exports/sheet-preview.svg",
                    "digestSha256": svg_sha,
                },
                {
                    "artifactName": "sheet-preview.pdf",
                    "mimeType": SHEET_EXPORT_PDF_MIME_TYPE,
                    "relativeArtifactPath": "exports/sheet-preview.pdf",
                    "digestSha256": None,
                    "note": "PDF bytes not deterministically available server-side; correlate via exportListingDigestSha256.",
                },
                {
                    "artifactName": "sheet-print-raster.png",
                    "mimeType": SHEET_EXPORT_PNG_MIME_TYPE,
                    "relativeArtifactPath": "exports/sheet-print-raster.png",
                    "digestSha256": placeholder_png_sha,
                    "surrogateContract": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
                    "fullRasterExportStatus": FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
                },
            ],
            "exportListingParityToken": SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN,
            "svgListingDigestSha256": export_listing_digest,
            "pdfListingDigestSha256": export_listing_digest,
            "exportListingParityDigestMatch": True,
            "ciBaselineCorrelation": {
                "format": "sheetExportCiBaselineCorrelation_v1",
                "sheetId": sh.id,
                "sheetName": sh.name,
                "svgArtifactName": "sheet-preview.svg",
                "pngArtifactName": "sheet-print-raster.png",
                "svgDigestSha256": svg_sha,
                "pngDigestSha256": placeholder_png_sha,
                "exportListingDigestSha256": export_listing_digest,
                "surrogateContract": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
                "fullRasterExportStatus": FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
            },
        }

        rows.append(
            {
                "sheetId": sh.id,
                "sheetName": sh.name,
                "svgHref": f"{api_base}/sheet-preview.svg?sheetId={qid}",
                "pdfHref": f"{api_base}/sheet-preview.pdf?sheetId={qid}",
                "printRasterPngHref": f"{api_base}/sheet-print-raster.png?sheetId={qid}",
                "sheetPrintRasterIngest_v1": {
                    "format": "sheetPrintRasterIngest_v1",
                    "contract": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
                    "svgContentSha256": svg_sha,
                    "placeholderPngSha256": placeholder_png_sha,
                    "diffCorrelation": {
                        "format": "sheetPrintRasterDiffCorrelation_v1",
                        "playwrightBaselineSlot": "pngFullSheet",
                        "notes": (
                            "Server print-surrogate PNG (128×112) stacks a 128×96 viewport layout stamp with SVG "
                            "UTF-8 salt and a 16px deterministic titleblock metadata band; it does not pixel-match "
                            "Playwright captures or fully render the SVG. Use for CI artifact/hash correlation and "
                            "layout/titleblock evidence; baseline visual diff remains client-side on pngFullSheet / "
                            "pngViewport."
                        ),
                    },
                },
                "sheetPrintRasterPrintContract_v3": build_sheet_print_raster_print_contract_v3(
                    doc, sh, svg_body, placeholder_png
                ),
                "playwrightSuggestedFilenames": {
                    "svgProbe": f"{stem}.svg.probe.txt",
                    "pdfProbe": f"{stem}.pdf.probe.bin",
                    "pngViewport": f"{stem}-viewport.png",
                    "pngFullSheet": f"{stem}-full.png",
                    "rasterPlaceholderProbe": f"{stem}.raster-placeholder.png",
                },
                "viewportEvidenceHints_v0": viewport_evidence_hints_v1(
                    doc, list(sh.viewports_mm or [])
                ),
                "planSheetViewportPlacementEvidence_v1": plan_sheet_viewport_placement_evidence_v1(
                    doc, list(sh.viewports_mm or [])
                ),
                "detailCalloutReadout_v0": detail_callout_readout_rows_v0(doc, sh),
                "planRoomProgrammeLegendHints_v0": plan_room_programme_legend_hints_v0(
                    doc, list(sh.viewports_mm or [])
                ),
                "roomColorSchemeLegendPlacementEvidence_v1": room_color_scheme_legend_placement_evidence_v1(
                    doc, list(sh.viewports_mm or [])
                ),
                "sheetTitleblockRevisionIssueManifest_v1": build_sheet_titleblock_revision_issue_manifest_v1(
                    sh
                ),
                "sectionOnSheetIntegrationEvidence_v1": build_section_on_sheet_integration_evidence_v1(
                    doc, sh
                ),
                "scheduleSheetExportParityEvidence_v1": (
                    build_schedule_sheet_export_parity_evidence_v1_for_sheet(doc, sh)
                ),
                "sheetExportArtifactManifest_v1": sheet_export_artifact_manifest,
                "correlation": {
                    "format": "evidenceSheetCorrelation_v1",
                    "semanticDigestSha256": semantic_digest_sha256,
                    "semanticDigestPrefix16": semantic_digest_prefix16,
                    "modelRevision": doc.revision,
                    "modelId": mid,
                    "suggestedEvidenceBundleEvidencePackageJson": bundle_json,
                },
            }
        )

    return rows


def deterministic_3d_view_evidence_manifest(
    *,
    model_id: UUID,
    doc: Document,
    evidence_artifact_basename: str,
    semantic_digest_sha256: str,
    semantic_digest_prefix16: str,
) -> list[dict[str, Any]]:
    """Stable 3D viewpoint capture hints (WP-E02 agent evidence loop)."""

    mid = str(model_id)
    bundle_json = f"{evidence_artifact_basename}-evidence-package.json"

    rows: list[dict[str, Any]] = []
    vps = [
        e for e in doc.elements.values() if isinstance(e, ViewpointElem) and e.mode == "orbit_3d"
    ]
    for vp in sorted(vps, key=lambda x: x.id):
        safe = "".join(ch for ch in vp.id if ch.isalnum() or ch in ("-", "_")) or "vp"
        stem = f"{evidence_artifact_basename}-3d-{safe}"

        row: dict[str, Any] = {
            "viewpointId": vp.id,
            "viewpointName": vp.name,
            "viewerClipCapElevMm": vp.viewer_clip_cap_elev_mm,
            "viewerClipFloorElevMm": vp.viewer_clip_floor_elev_mm,
            "hiddenSemanticKinds3d": list(vp.hidden_semantic_kinds_3d or []),
            "hiddenCategoryCount": len(vp.hidden_semantic_kinds_3d or []),
            "cutawayStyle": vp.cutaway_style,
            "sectionBoxEnabled": vp.section_box_enabled,
            "planOverlayEnabled": vp.plan_overlay_enabled,
            "planOverlaySourcePlanViewId": vp.plan_overlay_source_plan_view_id,
            "planOverlayOffsetMm": vp.plan_overlay_offset_mm,
            "planOverlayOpacity": vp.plan_overlay_opacity,
            "planOverlayLineOpacity": vp.plan_overlay_line_opacity,
            "planOverlayFillOpacity": vp.plan_overlay_fill_opacity,
            "planOverlayAnnotationsVisible": vp.plan_overlay_annotations_visible,
            "planOverlayWitnessLinesVisible": vp.plan_overlay_witness_lines_visible,
            "playwrightSuggestedFilenames": {
                "pngViewport": f"{stem}.png",
            },
            "correlation": {
                "format": "evidence3dViewCorrelation_v1",
                "semanticDigestSha256": semantic_digest_sha256,
                "semanticDigestPrefix16": semantic_digest_prefix16,
                "modelRevision": doc.revision,
                "modelId": mid,
                "suggestedEvidenceBundleEvidencePackageJson": bundle_json,
            },
        }
        if vp.section_box_min_mm is not None:
            row["sectionBoxMinMm"] = {
                "xMm": vp.section_box_min_mm.x_mm,
                "yMm": vp.section_box_min_mm.y_mm,
                "zMm": vp.section_box_min_mm.z_mm,
            }
        if vp.section_box_max_mm is not None:
            row["sectionBoxMaxMm"] = {
                "xMm": vp.section_box_max_mm.x_mm,
                "yMm": vp.section_box_max_mm.y_mm,
                "zMm": vp.section_box_max_mm.z_mm,
            }
        rows.append(row)

    return rows


def deterministic_plan_view_evidence_manifest(
    *,
    model_id: UUID,
    doc: Document,
    evidence_artifact_basename: str,
    semantic_digest_sha256: str,
    semantic_digest_prefix16: str,
) -> list[dict[str, Any]]:
    """Stable plan-view canvas capture hints (WP-C01 / agent evidence loop)."""

    mid = str(model_id)
    bundle_json = f"{evidence_artifact_basename}-evidence-package.json"

    rows: list[dict[str, Any]] = []
    pvs = [e for e in doc.elements.values() if isinstance(e, PlanViewElem)]
    for pv in sorted(pvs, key=lambda x: x.id):
        safe = "".join(ch for ch in pv.id if ch.isalnum() or ch in ("-", "_")) or "plan"
        stem = f"{evidence_artifact_basename}-plan-{safe}"
        rows.append(
            {
                "planViewId": pv.id,
                "name": pv.name,
                "levelId": pv.level_id,
                "planPresentation": pv.plan_presentation,
                "playwrightSuggestedFilenames": {
                    "pngPlanCanvas": f"{stem}.png",
                },
                "correlation": {
                    "format": "evidencePlanViewCorrelation_v1",
                    "semanticDigestSha256": semantic_digest_sha256,
                    "semanticDigestPrefix16": semantic_digest_prefix16,
                    "modelRevision": doc.revision,
                    "modelId": mid,
                    "suggestedEvidenceBundleEvidencePackageJson": bundle_json,
                },
            }
        )

    return rows


def deterministic_section_cut_evidence_manifest(
    *,
    model_id: UUID,
    doc: Document,
    evidence_artifact_basename: str,
    semantic_digest_sha256: str,
    semantic_digest_prefix16: str,
) -> list[dict[str, Any]]:
    """Stable section projection / viewport capture hints."""

    mid = str(model_id)
    bundle_json = f"{evidence_artifact_basename}-evidence-package.json"

    rows: list[dict[str, Any]] = []
    secs = [e for e in doc.elements.values() if isinstance(e, SectionCutElem)]
    for sc in sorted(secs, key=lambda x: x.id):
        safe = "".join(ch for ch in sc.id if ch.isalnum() or ch in ("-", "_")) or "sec"
        stem = f"{evidence_artifact_basename}-section-{safe}"
        qid = quote(sc.id, safe="")
        rows.append(
            {
                "sectionCutId": sc.id,
                "name": sc.name,
                "projectionWireHref": f"/api/models/{mid}/projection/section/{qid}",
                "playwrightSuggestedFilenames": {
                    "pngSectionViewport": f"{stem}.png",
                },
                "correlation": {
                    "format": "evidenceSectionCutCorrelation_v1",
                    "semanticDigestSha256": semantic_digest_sha256,
                    "semanticDigestPrefix16": semantic_digest_prefix16,
                    "modelRevision": doc.revision,
                    "modelId": mid,
                    "suggestedEvidenceBundleEvidencePackageJson": bundle_json,
                },
            }
        )

    return rows


def pixel_diff_expectation_placeholder_v1() -> dict[str, Any]:
    """Stable placeholder for future programmatic screenshot diff ingestion (agents read-only)."""

    return {
        "format": "pixelDiffExpectation_v1",
        "status": "not_run",
        "baselineRole": "committed_png_under_e2e_screenshots",
        "diffArtifactBasenameSuffix": "-diff.png",
        "metricsPlaceholder": {
            "maxChannelDelta": None,
            "mismatchPixelRatioMax": None,
        },
        "thresholdPolicy_v1": {
            "format": "pixelDiffThresholdPolicy_v1",
            "enforcement": "advisory_only",
            "mismatchPixelRatioFailAbove": 0.001,
            "maxChannelDeltaFailAbove": 1,
            "notes": (
                "Thresholds are for client-side diff tooling (Playwright/pixelmatch); "
                "the server does not enforce screenshot equality. Align metricsPlaceholder with "
                "values your CI ingests when pixelDiffExpectation.status becomes populated."
            ),
        },
        "notes": (
            "Pixel diff execution stays client-side (Playwright snapshots / pixelmatch). "
            "When produced, attach diff PNGs using diffArtifactBasenameSuffix beside deterministic basenames "
            "listed in evidenceClosureReview_v1.expectedDeterministicPngBasenames."
        ),
    }


def artifact_ingest_correlation_v1(targets: list[dict[str, Any]]) -> dict[str, Any]:
    """SHA-256 manifest over canonical baseline/diff basename pairs from ingest checklist targets."""

    pairs: list[dict[str, str]] = []
    for raw in targets:
        if not isinstance(raw, dict):
            continue
        b = raw.get("baselinePngBasename")
        d = raw.get("expectedDiffBasename")
        if isinstance(b, str) and isinstance(d, str) and b.endswith(".png") and d.endswith(".png"):
            pairs.append({"baselinePngBasename": b, "expectedDiffBasename": d})
    pairs.sort(key=lambda p: (p["baselinePngBasename"], p["expectedDiffBasename"]))
    payload = json.dumps(pairs, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(payload.encode()).hexdigest()
    return {
        "format": "artifactIngestCorrelation_v1",
        "canonicalPairCount": len(pairs),
        "ingestManifestDigestSha256": digest,
        "playwrightEvidenceScreenshotsRootHint": PLAYWRIGHT_EVIDENCE_SCREENSHOTS_ROOT_HINT,
        "notes": (
            "Derived from pixelDiffExpectation.ingestChecklist_v1.targets only; "
            "client-side ingest correlation for deterministic PNG basenames vs expected diff filenames."
        ),
    }


def pixel_diff_expectation_v1_with_ingest(expected_png_basenames: list[str]) -> dict[str, Any]:
    """Placeholder plus deterministic per-baseline diff basename pairs for scripted ingest."""

    base = dict(pixel_diff_expectation_placeholder_v1())
    suffix = str(base.get("diffArtifactBasenameSuffix") or "-diff.png")
    targets: list[dict[str, str]] = []
    for bn in expected_png_basenames:
        if not (isinstance(bn, str) and bn.endswith(".png")):
            continue
        stem = bn[:-4]
        targets.append({"baselinePngBasename": bn, "expectedDiffBasename": f"{stem}{suffix}"})
    base["ingestChecklist_v1"] = {
        "format": "pixelDiffIngestChecklist_v1",
        "targets": targets,
    }
    base["artifactIngestCorrelation_v1"] = artifact_ingest_correlation_v1(targets)
    return base


PNG_SIGNATURE_V1 = b"\x89PNG\r\n\x1a\n"

# Minimal valid 1×1 RGB8 PNG (stdlib-only ingest probe; not a Playwright baseline file).
MINIMAL_PROBE_PNG_BYTES_V1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db400000000494544ae426082"
)
MINIMAL_PROBE_PNG_CANONICAL_SHA256_V1 = hashlib.sha256(MINIMAL_PROBE_PNG_BYTES_V1).hexdigest()


def parse_png_dimensions_v1(png_bytes: bytes) -> tuple[int, int]:
    """Return ``(width, height)`` from PNG IHDR using stdlib parsing only."""

    if len(png_bytes) < 8 + 8 + 13 + 4:
        raise ValueError("png_too_short_for_ihdr")
    if png_bytes[:8] != PNG_SIGNATURE_V1:
        raise ValueError("png_bad_signature")
    offset = 8
    while offset + 12 <= len(png_bytes):
        chunk_len = struct.unpack_from(">I", png_bytes, offset)[0]
        chunk_type = png_bytes[offset + 4 : offset + 8]
        data_start = offset + 8
        data_end = data_start + chunk_len
        if data_end + 4 > len(png_bytes):
            raise ValueError("png_truncated_chunk")
        if chunk_type == b"IHDR":
            if chunk_len < 8:
                raise ValueError("png_ihdr_too_short")
            width, height = struct.unpack_from(">II", png_bytes, data_start)
            if width < 1 or height < 1:
                raise ValueError("png_non_positive_dimensions")
            return int(width), int(height)
        offset = data_end + 4
    raise ValueError("png_missing_ihdr")


def server_png_byte_ingest_report_v1(
    png_bytes: bytes,
    *,
    expected_canonical_sha256_baseline: str | None,
) -> dict[str, Any]:
    """Deterministic metadata + optional SHA-256 equality check over raw PNG bytes."""

    canonical = hashlib.sha256(png_bytes).hexdigest()
    width, height = parse_png_dimensions_v1(png_bytes)
    byte_len = len(png_bytes)

    if expected_canonical_sha256_baseline is None:
        comparison: dict[str, Any] = {
            "format": "pngByteDigestComparison_v1",
            "comparisonKind": "canonical_png_bytes_to_expected_sha256",
            "result": "skipped_no_baseline",
            "skippedReason": (
                "expected_canonical_sha256_baseline was omitted; ingested dimensions "
                "and canonical png_file_sha256 only."
            ),
            "expectedBaselineSha256": None,
        }
        return {
            "format": "serverPngByteIngest_v1",
            "canonicalDigestKind": "png_file_sha256",
            "canonicalDigestSha256": canonical,
            "derivativeDigestSha256": None,
            "derivativeDigestNote": (
                "This ingest path does not distinguish derivative raster bytes from "
                "canonical file bytes; only png_file_sha256 is emitted."
            ),
            "width": width,
            "height": height,
            "byteLength": byte_len,
            "comparison": comparison,
            "probeNote": (
                "Ingest record derived from caller-supplied PNG bytes (probe or artifact); "
                "does not imply Playwright committed baseline bytes were read server-side."
            ),
        }

    exp_norm = str(expected_canonical_sha256_baseline).strip().lower()
    if len(exp_norm) != 64 or any(c not in "0123456789abcdef" for c in exp_norm):
        comparison = {
            "format": "pngByteDigestComparison_v1",
            "comparisonKind": "canonical_png_bytes_to_expected_sha256",
            "result": "skipped_no_baseline",
            "skippedReason": "expected_canonical_sha256_baseline is not a 64-char hex sha256",
            "expectedBaselineSha256": expected_canonical_sha256_baseline,
        }
        return {
            "format": "serverPngByteIngest_v1",
            "canonicalDigestKind": "png_file_sha256",
            "canonicalDigestSha256": canonical,
            "derivativeDigestSha256": None,
            "derivativeDigestNote": (
                "This ingest path does not distinguish derivative raster bytes from "
                "canonical file bytes; only png_file_sha256 is emitted."
            ),
            "width": width,
            "height": height,
            "byteLength": byte_len,
            "comparison": comparison,
            "probeNote": (
                "Ingest record derived from caller-supplied PNG bytes (probe or artifact); "
                "does not imply Playwright committed baseline bytes were read server-side."
            ),
        }

    matched = canonical == exp_norm
    comparison = {
        "format": "pngByteDigestComparison_v1",
        "comparisonKind": "canonical_png_bytes_to_expected_sha256",
        "result": "match" if matched else "mismatch",
        "skippedReason": None,
        "expectedBaselineSha256": exp_norm,
    }
    return {
        "format": "serverPngByteIngest_v1",
        "canonicalDigestKind": "png_file_sha256",
        "canonicalDigestSha256": canonical,
        "derivativeDigestSha256": None,
        "derivativeDigestNote": (
            "This ingest path does not distinguish derivative raster bytes from "
            "canonical file bytes; only png_file_sha256 is emitted."
        ),
        "width": width,
        "height": height,
        "byteLength": byte_len,
        "comparison": comparison,
        "probeNote": (
            "Ingest record derived from caller-supplied PNG bytes (probe or artifact); "
            "does not imply Playwright committed baseline bytes were read server-side."
        ),
    }


def merge_server_png_byte_ingest_into_evidence_closure_review_v1(
    evidence_closure_review: dict[str, Any],
    *,
    png_bytes: bytes,
    expected_canonical_sha256_baseline: str | None,
) -> dict[str, Any]:
    """Attach ``serverPngByteIngest_v1`` and advance ``pixelDiffExpectation.status``."""

    out = dict(evidence_closure_review)
    pix_raw = out.get("pixelDiffExpectation")
    if not isinstance(pix_raw, dict):
        return out
    pix = dict(pix_raw)

    ingest_raw = pix.get("ingestChecklist_v1")
    linked_bn: str | None = None
    if isinstance(ingest_raw, dict):
        tgts = ingest_raw.get("targets")
        if isinstance(tgts, list) and tgts:
            t0 = tgts[0]
            if isinstance(t0, dict):
                bn = t0.get("baselinePngBasename")
                if isinstance(bn, str) and bn:
                    linked_bn = bn

    try:
        ingest_report = server_png_byte_ingest_report_v1(
            png_bytes,
            expected_canonical_sha256_baseline=expected_canonical_sha256_baseline,
        )
    except ValueError as exc:
        ingest_report = {
            "format": "serverPngByteIngest_v1",
            "canonicalDigestKind": "png_file_sha256",
            "canonicalDigestSha256": None,
            "derivativeDigestSha256": None,
            "derivativeDigestNote": (
                "This ingest path does not distinguish derivative raster bytes from "
                "canonical file bytes; only png_file_sha256 is emitted."
            ),
            "width": None,
            "height": None,
            "byteLength": len(png_bytes),
            "comparison": {
                "format": "pngByteDigestComparison_v1",
                "comparisonKind": "canonical_png_bytes_to_expected_sha256",
                "result": "skipped_no_baseline",
                "skippedReason": f"png_parse_failed:{exc}",
                "expectedBaselineSha256": expected_canonical_sha256_baseline,
            },
            "probeNote": "PNG bytes failed IHDR parse; no canonical digest recorded.",
        }

    if linked_bn is not None:
        ingest_report = dict(ingest_report)
        ingest_report["linkedBaselinePngBasename"] = linked_bn

    pix["serverPngByteIngest_v1"] = ingest_report
    comp = ingest_report.get("comparison") if isinstance(ingest_report, dict) else None
    result = comp.get("result") if isinstance(comp, dict) else None

    if result == "match":
        pix["status"] = "compared"
    elif result == "mismatch":
        pix["status"] = "mismatch"
    elif result == "skipped_no_baseline":
        pix["status"] = "ingested"
    else:
        pix["status"] = "ingested"

    out["pixelDiffExpectation"] = pix
    return out


def committed_evidence_png_fixture_dir_v1() -> Path:
    """Directory for committed PNG baselines under the ``app`` tree (repo / CI layouts).

    May be absent in minimal installs that omit ``tests/``; callers should treat a missing
    directory as “no committed baselines”.
    """

    return Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "evidence"


def safe_committed_evidence_png_basename_v1(basename: str) -> str:
    if not isinstance(basename, str) or not basename:
        raise ValueError("committed_evidence_png_bad_basename")
    if basename != os.path.basename(basename):
        raise ValueError("committed_evidence_png_bad_basename")
    for sep in ("/", "\\", ".."):
        if sep in basename:
            raise ValueError("committed_evidence_png_bad_basename")
    if not basename.endswith(".png"):
        raise ValueError("committed_evidence_png_bad_basename")
    return basename


def read_committed_evidence_png_fixture_bytes_v1(basename: str) -> bytes:
    safe = safe_committed_evidence_png_basename_v1(basename)
    path = committed_evidence_png_fixture_dir_v1() / safe
    return path.read_bytes()


_COMMITTED_FIXTURE_PROBE_NOTE_V1 = (
    "Ingest record derived from committed repository fixture bytes under "
    "app/tests/fixtures/evidence keyed by ingestChecklist_v1 baselinePngBasename."
)


def merge_committed_png_baseline_bytes_into_evidence_closure_review_v1(
    evidence_closure_review: dict[str, Any],
    *,
    baseline_png_bytes_by_basename: dict[str, bytes],
) -> dict[str, Any]:
    """Attach ``committedPngBaselineIngests_v1`` with per-baseline ``serverPngByteIngest_v1`` rows."""

    out = dict(evidence_closure_review)
    pix_raw = out.get("pixelDiffExpectation")
    if not isinstance(pix_raw, dict):
        return out
    pix = dict(pix_raw)

    ingest_raw = pix.get("ingestChecklist_v1")
    if not isinstance(ingest_raw, dict):
        out["pixelDiffExpectation"] = pix
        return out
    tgts = ingest_raw.get("targets")
    if not isinstance(tgts, list):
        out["pixelDiffExpectation"] = pix
        return out

    entries: list[dict[str, Any]] = []
    for t in tgts:
        if not isinstance(t, dict):
            continue
        bn_raw = t.get("baselinePngBasename")
        if not isinstance(bn_raw, str) or bn_raw not in baseline_png_bytes_by_basename:
            continue
        try:
            safe_committed_evidence_png_basename_v1(bn_raw)
        except ValueError:
            continue
        raw_png = baseline_png_bytes_by_basename[bn_raw]
        expected_sha = hashlib.sha256(raw_png).hexdigest()
        try:
            rep = server_png_byte_ingest_report_v1(
                raw_png,
                expected_canonical_sha256_baseline=expected_sha,
            )
        except ValueError as exc:
            rep = {
                "format": "serverPngByteIngest_v1",
                "canonicalDigestKind": "png_file_sha256",
                "canonicalDigestSha256": None,
                "derivativeDigestSha256": None,
                "derivativeDigestNote": (
                    "This ingest path does not distinguish derivative raster bytes from "
                    "canonical file bytes; only png_file_sha256 is emitted."
                ),
                "width": None,
                "height": None,
                "byteLength": len(raw_png),
                "comparison": {
                    "format": "pngByteDigestComparison_v1",
                    "comparisonKind": "canonical_png_bytes_to_expected_sha256",
                    "result": "skipped_no_baseline",
                    "skippedReason": f"png_parse_failed:{exc}",
                    "expectedBaselineSha256": expected_sha,
                },
                "probeNote": "PNG bytes failed IHDR parse; no canonical digest recorded.",
                "ingestSourceKind": "committed_repository_fixture",
            }
        else:
            rep = dict(rep)
            rep["probeNote"] = _COMMITTED_FIXTURE_PROBE_NOTE_V1
            rep["ingestSourceKind"] = "committed_repository_fixture"

        entries.append({"baselinePngBasename": bn_raw, "serverPngByteIngest_v1": rep})

    entries.sort(key=lambda e: str(e.get("baselinePngBasename", "")))
    if entries:
        pix["committedPngBaselineIngests_v1"] = {
            "format": "committedPngBaselineIngests_v1",
            "entries": entries,
        }
    else:
        pix.pop("committedPngBaselineIngests_v1", None)

    out["pixelDiffExpectation"] = pix
    return out


def merge_committed_png_fixture_baselines_into_evidence_closure_review_v1(
    evidence_closure_review: dict[str, Any],
) -> dict[str, Any]:
    """Load matching basenames from :func:`committed_evidence_png_fixture_dir_v1` when present."""

    root = committed_evidence_png_fixture_dir_v1()
    if not root.is_dir():
        return evidence_closure_review

    pix_raw = evidence_closure_review.get("pixelDiffExpectation")
    if not isinstance(pix_raw, dict):
        return evidence_closure_review
    ingest_raw = pix_raw.get("ingestChecklist_v1")
    if not isinstance(ingest_raw, dict):
        return evidence_closure_review
    tgts = ingest_raw.get("targets")
    if not isinstance(tgts, list):
        return evidence_closure_review

    by_bn: dict[str, bytes] = {}
    for t in tgts:
        if not isinstance(t, dict):
            continue
        bn = t.get("baselinePngBasename")
        if not isinstance(bn, str):
            continue
        try:
            safe_committed_evidence_png_basename_v1(bn)
        except ValueError:
            continue
        path = root / bn
        if path.is_file():
            by_bn[bn] = path.read_bytes()

    if not by_bn:
        return evidence_closure_review

    return merge_committed_png_baseline_bytes_into_evidence_closure_review_v1(
        evidence_closure_review,
        baseline_png_bytes_by_basename=by_bn,
    )


def screenshot_hint_gaps_v1(
    *,
    deterministic_sheet_evidence: list[dict[str, Any]],
    deterministic_3d_view_evidence: list[dict[str, Any]],
    deterministic_plan_view_evidence: list[dict[str, Any]],
    deterministic_section_cut_evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    """Deterministic missing Playwright filename slots per deterministic evidence row (agents / CI)."""

    gaps: list[dict[str, Any]] = []

    def slot_ok(pw: dict[str, Any], key: str) -> bool:
        v = pw.get(key)
        return isinstance(v, str) and v.endswith(".png")

    def walk(kind: str, id_key: str, rows: list[dict[str, Any]], required: list[str]) -> None:
        for row in rows:
            if not isinstance(row, dict):
                continue
            rid = str(row.get(id_key, "") or "")
            if not rid:
                continue
            pw_raw = row.get("playwrightSuggestedFilenames")
            pw: dict[str, Any] = pw_raw if isinstance(pw_raw, dict) else {}
            missing = [k for k in required if not slot_ok(pw, k)]
            if missing:
                gaps.append(
                    {
                        "deterministicRowKind": kind,
                        "rowId": rid,
                        "missingPlaywrightFilenameSlots": missing,
                    }
                )

    walk("sheet", "sheetId", deterministic_sheet_evidence, ["pngViewport", "pngFullSheet"])
    walk("viewpoint", "viewpointId", deterministic_3d_view_evidence, ["pngViewport"])
    walk("plan_view", "planViewId", deterministic_plan_view_evidence, ["pngPlanCanvas"])
    walk("section_cut", "sectionCutId", deterministic_section_cut_evidence, ["pngSectionViewport"])

    gaps.sort(key=lambda x: (str(x["deterministicRowKind"]), str(x["rowId"])))
    return {
        "format": "screenshotHintGaps_v1",
        "gaps": gaps,
        "hasGaps": len(gaps) > 0,
        "gapRowCount": len(gaps),
    }


def evidence_lifecycle_signal_v1(
    *,
    package_semantic_digest_sha256: str,
    suggested_evidence_artifact_basename: str,
    evidence_closure_review: dict[str, Any],
) -> dict[str, Any]:
    """Single programmatic bundle: digest, staging basename, consistency, gaps, diff-ingest cardinality."""

    pix = evidence_closure_review.get("pixelDiffExpectation")
    ingest = pix.get("ingestChecklist_v1") if isinstance(pix, dict) else None
    t_count = (
        len(ingest["targets"])
        if isinstance(ingest, dict) and isinstance(ingest.get("targets"), list)
        else 0
    )
    gaps_obj = evidence_closure_review.get("screenshotHintGaps_v1")
    gap_list = gaps_obj.get("gaps") if isinstance(gaps_obj, dict) else None
    gap_n = len(gap_list) if isinstance(gap_list, list) else 0
    cons = evidence_closure_review.get("correlationDigestConsistency")
    if isinstance(cons, dict) and isinstance(cons.get("isFullyConsistent"), bool):
        consistent: bool | None = bool(cons["isFullyConsistent"])
    else:
        consistent = None
    basenames = evidence_closure_review.get("expectedDeterministicPngBasenames")
    bn_n = len(basenames) if isinstance(basenames, list) else 0

    ingest_digest: str | None = None
    if isinstance(pix, dict):
        ac = pix.get("artifactIngestCorrelation_v1")
        if isinstance(ac, dict):
            d = ac.get("ingestManifestDigestSha256")
            if isinstance(d, str) and len(d) == 64:
                ingest_digest = d

    out: dict[str, Any] = {
        "format": "evidenceLifecycleSignal_v1",
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "suggestedEvidenceArtifactBasename": suggested_evidence_artifact_basename,
        "expectedDeterministicPngCount": bn_n,
        "correlationFullyConsistent": consistent,
        "screenshotHintGapRowCount": gap_n,
        "pixelDiffIngestTargetCount": t_count,
    }
    if ingest_digest is not None:
        out["artifactIngestManifestDigestSha256"] = ingest_digest
    return out


def evidence_diff_ingest_fix_loop_v1(evidence_closure_review: dict[str, Any]) -> dict[str, Any]:
    """Derivative rollup: when agents/CI should run the evidence diff / screenshot fix loop."""

    blockers: list[str] = []

    cons = evidence_closure_review.get("correlationDigestConsistency")
    if not isinstance(cons, dict) or cons.get("isFullyConsistent") is not True:
        blockers.append("correlation_digest_stale_or_missing")

    gaps_raw = evidence_closure_review.get("screenshotHintGaps_v1")
    gap_has = False
    if isinstance(gaps_raw, dict):
        if gaps_raw.get("hasGaps") is True:
            gap_has = True
        n = gaps_raw.get("gapRowCount")
        if isinstance(n, int) and n > 0:
            gap_has = True
    if gap_has:
        blockers.append("screenshot_filename_slots_incomplete")

    pix = evidence_closure_review.get("pixelDiffExpectation")
    ingest_targets: list[Any] = []
    if isinstance(pix, dict):
        ing = pix.get("ingestChecklist_v1")
        if isinstance(ing, dict) and isinstance(ing.get("targets"), list):
            ingest_targets = ing["targets"]
            ac_corr = pix.get("artifactIngestCorrelation_v1")
            if isinstance(ac_corr, dict):
                actual_digest = ac_corr.get("ingestManifestDigestSha256")
                if isinstance(actual_digest, str) and len(actual_digest) == 64:
                    expected_digest = artifact_ingest_correlation_v1(ingest_targets)[
                        "ingestManifestDigestSha256"
                    ]
                    if expected_digest != actual_digest:
                        blockers.append("artifact_ingest_correlation_digest_mismatch")

    correlation_ok = isinstance(cons, dict) and cons.get("isFullyConsistent") is True
    if correlation_ok and not gap_has:
        if isinstance(pix, dict):
            status_ok = pix.get("status") == "not_run"
            if status_ok and len(ingest_targets) > 0:
                blockers.append("pixel_diff_ingest_pending")

    codes = sorted(set(blockers))
    return {
        "format": "evidence_diff_ingest_fix_loop_v1",
        "needsFixLoop": len(codes) > 0,
        "blockerCodes": codes,
        "notes": (
            "Derivative of evidenceClosureReview_v1; excluded from semanticDigestSha256. "
            "artifact_ingest_correlation_digest_mismatch when "
            "pixelDiffExpectation.artifactIngestCorrelation_v1.ingestManifestDigestSha256 "
            "differs from artifact_ingest_correlation_v1(ingestChecklist_v1.targets). "
            "pixel_diff_ingest_pending applies only when correlation is consistent and required "
            "Playwright PNG slots are present (screenshot gaps cleared first)."
        ),
    }


def evidence_review_performance_gate_v1(fix_loop: dict[str, Any]) -> dict[str, Any]:
    """Advisory mock gate derived from fix-loop blockers (no wall-clock probes; digest-excluded)."""

    raw_codes = fix_loop.get("blockerCodes")
    codes: list[str]
    if isinstance(raw_codes, list):
        codes = sorted(str(x) for x in raw_codes if isinstance(x, str))
    else:
        codes = []
    needs_fix = bool(fix_loop.get("needsFixLoop"))
    return {
        "format": "evidenceReviewPerformanceGate_v1",
        "probeKind": "deterministic_contract_v1",
        "enforcement": "advisory_mock",
        "gateClosed": not needs_fix,
        "blockerCodesEcho": codes,
        "advisoryBudgetHintsMs_v1": {
            "format": "advisoryBudgetHintsMs_v1",
            "evidencePackageJsonParse": 50,
            "agentReviewEvidenceSectionRender": 200,
        },
        "notes": (
            "Derived from evidenceDiffIngestFixLoop_v1 only; no timing telemetry; offline/CI-safe contract."
        ),
    }


def evidence_baseline_lifecycle_readout_v1(
    *,
    evidence_closure_review: dict[str, Any],
    evidence_diff_ingest_fix_loop: dict[str, Any],
    evidence_review_performance_gate: dict[str, Any],
) -> dict[str, Any]:
    """Derivative lifecycle table: baseline ids, fixture/digest status, next actions, CI gate hints."""

    raw_codes = evidence_diff_ingest_fix_loop.get("blockerCodes")
    rc_list = raw_codes if isinstance(raw_codes, list) else []
    fix_codes: list[str] = sorted(str(x) for x in rc_list if isinstance(x, str))
    gate_closed = bool(evidence_review_performance_gate.get("gateClosed"))

    echo_raw = evidence_review_performance_gate.get("blockerCodesEcho")
    echo_list = echo_raw if isinstance(echo_raw, list) else []
    echo_codes: list[str] = sorted(str(x) for x in echo_list if isinstance(x, str))
    rollup_ci = (
        f"performance_gate_gateClosed={str(gate_closed).lower()};"
        f"blocker_codes_echo={' '.join(echo_codes) if echo_codes else 'none'}"
    )

    pix = evidence_closure_review.get("pixelDiffExpectation")
    ingest_targets: list[Any] = []
    if isinstance(pix, dict):
        ing = pix.get("ingestChecklist_v1")
        if isinstance(ing, dict) and isinstance(ing.get("targets"), list):
            ingest_targets = list(ing["targets"])

    norm_rows: list[dict[str, str]] = []
    for raw in ingest_targets:
        if not isinstance(raw, dict):
            continue
        b = raw.get("baselinePngBasename")
        d = raw.get("expectedDiffBasename")
        if isinstance(b, str) and isinstance(d, str) and b.endswith(".png") and d.endswith(".png"):
            norm_rows.append({"baselinePngBasename": b, "expectedDiffBasename": d})
    norm_rows.sort(key=lambda r: (r["baselinePngBasename"], r["expectedDiffBasename"]))
    ingest_count = len(norm_rows)
    expected_ids = sorted({r["baselinePngBasename"] for r in norm_rows})

    committed_bn: set[str] = set()
    if isinstance(pix, dict):
        cpi = pix.get("committedPngBaselineIngests_v1")
        if isinstance(cpi, dict):
            ent = cpi.get("entries")
            if isinstance(ent, list):
                for e in ent:
                    if isinstance(e, dict):
                        bn = e.get("baselinePngBasename")
                        if isinstance(bn, str):
                            committed_bn.add(bn)

    actual_digest: str | None = None
    if isinstance(pix, dict):
        ac_corr = pix.get("artifactIngestCorrelation_v1")
        if isinstance(ac_corr, dict):
            ad = ac_corr.get("ingestManifestDigestSha256")
            if isinstance(ad, str) and len(ad) == 64:
                actual_digest = ad

    digestrollup: str
    if ingest_count == 0:
        digestrollup = "not_applicable"
    elif actual_digest is None:
        digestrollup = "unknown"
    else:
        expected_dig = str(
            artifact_ingest_correlation_v1(ingest_targets)["ingestManifestDigestSha256"]
        )
        digestrollup = "aligned" if expected_dig == actual_digest else "mismatch"

    missing_committed_any = bool(expected_ids) and any(
        bn not in committed_bn for bn in expected_ids
    )

    def rollup_next_action() -> str:
        if ingest_count == 0:
            return "noop_no_baseline_targets"
        if "artifact_ingest_correlation_digest_mismatch" in fix_codes:
            return "investigate_diff"
        if "correlation_digest_stale_or_missing" in fix_codes:
            return "investigate_diff"
        if "screenshot_filename_slots_incomplete" in fix_codes:
            return "missing_artifact"
        if missing_committed_any:
            return "missing_artifact"
        if "pixel_diff_ingest_pending" in fix_codes:
            return "run_pixel_diff_ingest"
        return "accept_baseline"

    rollup_action = rollup_next_action()

    def row_next_action(baseline_bn: str) -> str:
        if ingest_count == 0:
            return "noop_no_baseline_targets"
        if "artifact_ingest_correlation_digest_mismatch" in fix_codes:
            return "investigate_diff"
        if "correlation_digest_stale_or_missing" in fix_codes:
            return "investigate_diff"
        if "screenshot_filename_slots_incomplete" in fix_codes:
            return "missing_artifact"
        if baseline_bn not in committed_bn:
            return "missing_artifact"
        if "pixel_diff_ingest_pending" in fix_codes:
            return "run_pixel_diff_ingest"
        return "accept_baseline"

    _staged_upload_note = (
        "Staged upload is not performed by this API. "
        "This readout is a review-only lifecycle summary; "
        "no baselines are committed or mutated automatically."
    )

    row_objs: list[dict[str, Any]] = []
    digest_cell = digestrollup if ingest_count else "not_applicable"
    for r in norm_rows:
        bn = r["baselinePngBasename"]
        com_status = "present" if bn in committed_bn else "missing"
        row_objs.append(
            {
                "baselinePngBasename": bn,
                "expectedDiffBasename": r["expectedDiffBasename"],
                "committedFixtureStatus": com_status,
                "digestCorrelationStatus": digest_cell,
                "suggestedNextAction": row_next_action(bn),
                "ciGateHint": rollup_ci,
                "stagedUploadEligibilityNote": _staged_upload_note,
            }
        )

    return {
        "format": "evidenceBaselineLifecycleReadout_v1",
        "semanticDigestExclusionNote": (
            "evidenceBaselineLifecycleReadout_v1 is derivative; excluded from semanticDigestSha256."
        ),
        "expectedBaselineIds": expected_ids,
        "ingestTargetCount": ingest_count,
        "rollupDigestCorrelationStatus": digestrollup,
        "rollupSuggestedNextAction": rollup_action,
        "rollupCiGateHint": rollup_ci,
        "fixLoopBlockerCodes": fix_codes,
        "gateClosed": gate_closed,
        "rows": row_objs,
        "stagedUploadEligibilityNote": _staged_upload_note,
        "notes": (
            "Deterministic join of evidenceClosureReview_v1 pixel ingest checklist, "
            "committedPngBaselineIngests_v1, evidenceDiffIngestFixLoop_v1 blockerCodes, "
            "and evidenceReviewPerformanceGate_v1."
        ),
    }


def evidence_closure_review_v1(
    *,
    package_semantic_digest_sha256: str,
    deterministic_sheet_evidence: list[dict[str, Any]],
    deterministic_3d_view_evidence: list[dict[str, Any]],
    deterministic_plan_view_evidence: list[dict[str, Any]],
    deterministic_section_cut_evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    """Flatten deterministic PNG inventory + correlation digest hygiene for Agent Review / CI."""

    stale_rows: list[dict[str, Any]] = []
    missing_digest_rows: list[dict[str, Any]] = []
    png_basenames: list[str] = []

    def note_pngs(playwright_suggested: dict[str, Any]) -> None:
        for key in ("pngViewport", "pngFullSheet", "pngPlanCanvas", "pngSectionViewport"):
            val = playwright_suggested.get(key)
            if isinstance(val, str) and val.endswith(".png"):
                png_basenames.append(val)

    def scan_rows(kind: str, id_key: str, rows: list[dict[str, Any]]) -> None:
        for row in rows:
            if not isinstance(row, dict):
                continue
            row_id = str(row.get(id_key, "") or "")
            corr_raw = row.get("correlation")
            corr = corr_raw if isinstance(corr_raw, dict) else {}
            row_sha = corr.get("semanticDigestSha256")
            if row_sha is None:
                if row_id:
                    missing_digest_rows.append({"kind": kind, "id": row_id})
            elif isinstance(row_sha, str) and row_sha != package_semantic_digest_sha256:
                stale_rows.append(
                    {
                        "kind": kind,
                        "id": row_id,
                        "correlationSemanticDigestSha256": row_sha,
                        "packageSemanticDigestSha256": package_semantic_digest_sha256,
                    }
                )
            pw_raw = row.get("playwrightSuggestedFilenames")
            if isinstance(pw_raw, dict):
                note_pngs(pw_raw)

    scan_rows("sheet", "sheetId", deterministic_sheet_evidence)
    scan_rows("viewpoint", "viewpointId", deterministic_3d_view_evidence)
    scan_rows("plan_view", "planViewId", deterministic_plan_view_evidence)
    scan_rows("section_cut", "sectionCutId", deterministic_section_cut_evidence)

    basenames_sorted = sorted(set(png_basenames))
    shot_gaps = screenshot_hint_gaps_v1(
        deterministic_sheet_evidence=deterministic_sheet_evidence,
        deterministic_3d_view_evidence=deterministic_3d_view_evidence,
        deterministic_plan_view_evidence=deterministic_plan_view_evidence,
        deterministic_section_cut_evidence=deterministic_section_cut_evidence,
    )

    return {
        "format": "evidenceClosureReview_v1",
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "expectedDeterministicPngBasenames": basenames_sorted,
        "primaryScreenshotArtifactCount": len(basenames_sorted),
        "screenshotHintGaps_v1": shot_gaps,
        "correlationDigestConsistency": {
            "format": "correlationDigestConsistency_v1",
            "staleRowsRelativeToPackageDigest": stale_rows,
            "rowsMissingCorrelationDigest": missing_digest_rows,
            "isFullyConsistent": len(stale_rows) == 0 and len(missing_digest_rows) == 0,
        },
        "pixelDiffExpectation": pixel_diff_expectation_v1_with_ingest(basenames_sorted),
    }


def agent_evidence_closure_hints() -> dict[str, Any]:
    """Static guidance for agents; safe to attach on every evidence-package response."""

    return {
        "format": "agentEvidenceClosureHints_v1",
        "evidenceClosureReviewField": "evidenceClosureReview_v1",
        "pixelDiffExpectationNestedField": "pixelDiffExpectation",
        "deterministicPngBasenamesField": "expectedDeterministicPngBasenames",
        "screenshotHintGapsField": "screenshotHintGaps_v1",
        "pixelDiffIngestChecklistField": "ingestChecklist_v1",
        "committedPngBaselineIngestsField": "committedPngBaselineIngests_v1",
        "committedEvidencePngFixturesRelDir": "app/tests/fixtures/evidence",
        "artifactIngestCorrelationNestedField": "artifactIngestCorrelation_v1",
        "artifactIngestCorrelationFullPath": (
            "evidenceClosureReview_v1.pixelDiffExpectation.artifactIngestCorrelation_v1"
        ),
        "artifactIngestManifestDigestSha256LifecycleField": "artifactIngestManifestDigestSha256",
        "evidenceLifecycleSignalField": "evidenceLifecycleSignal_v1",
        "evidenceDiffIngestFixLoopField": "evidenceDiffIngestFixLoop_v1",
        "evidenceReviewPerformanceGateField": "evidenceReviewPerformanceGate_v1",
        "evidenceAgentFollowThroughField": "evidenceAgentFollowThrough_v1",
        "bcfRoundtripEvidenceSummaryField": "bcfRoundtripEvidenceSummary_v1",
        "bcfIssuePackageExportField": "bcfIssuePackageExport_v1",
        "artifactUploadManifestField": "artifactUploadManifest_v1",
        "agentGeneratedBundleQaChecklistField": "agentGeneratedBundleQaChecklist_v1",
        "agentBriefAcceptanceReadoutField": "agentBriefAcceptanceReadout_v1",
        "evidenceBaselineLifecycleReadoutField": "evidenceBaselineLifecycleReadout_v1",
        "v1CloseoutReadinessManifestField": "v1CloseoutReadinessManifest_v1",
        "prdAdvisorMatrixField": "prdAdvisorMatrix_v1",
        "agentReviewReadoutConsistencyClosureField": "agentReviewReadoutConsistencyClosure_v1",
        "semanticDigestOmitsDerivativeSummariesNote": (
            "semanticDigestSha256 excludes bcfTopicsIndex_v1, agentReviewActions_v1, "
            "evidenceDiffIngestFixLoop_v1, evidenceReviewPerformanceGate_v1, "
            "evidenceAgentFollowThrough_v1 (including nested bcfIssuePackageExport_v1), "
            "artifactUploadManifest_v1, "
            "agentGeneratedBundleQaChecklist_v1, agentBriefAcceptanceReadout_v1, evidenceBaselineLifecycleReadout_v1, "
            "agentReviewReadoutConsistencyClosure_v1, "
            "v1CloseoutReadinessManifest_v1, and prdAdvisorMatrix_v1 "
            "so deterministic row digests stay stable."
        ),
        "playwrightEvidenceSpecRelPath": "packages/web/e2e/evidence-baselines.spec.ts",
        "suggestedRegenerationCommands": [
            (
                "cd app && ruff check bim_ai tests && "
                "pytest tests/test_evidence_package_digest.py tests/test_evidence_manifest_closure.py "
                "tests/test_evidence_agent_follow_through.py tests/test_plan_projection_and_evidence_slices.py "
                "tests/test_sheet_print_raster_placeholder.py"
            ),
            "cd packages/web && CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts",
        ],
        "ciArtifactRelativePaths": [
            "packages/web/playwright-report/index.html",
            "packages/web/test-results/ci-evidence-correlation-hint.txt",
            "packages/web/e2e/__screenshots__/evidence-baselines/evidence-baselines.spec.ts/<platform>/",
        ],
        "ciEnvPlaceholderHints": [
            "GITHUB_RUN_ID correlates with artifact name evidence-web-${GITHUB_RUN_ID}-playwright",
            "GITHUB_SHA identifies the commit that produced the bundle",
        ],
    }


def evidence_ref_resolution_v1(
    *,
    bcf_topics_index: dict[str, Any],
    deterministic_sheet_evidence: list[dict[str, Any]],
    deterministic_3d_view_evidence: list[dict[str, Any]],
    deterministic_plan_view_evidence: list[dict[str, Any]],
    deterministic_section_cut_evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    """List BCF/issue evidenceRefs that do not resolve to a deterministic evidence row."""

    sheet_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_sheet_evidence:
        if isinstance(row, dict):
            sid = str(row.get("sheetId") or "")
            if sid:
                sheet_by_id[sid] = row

    vp_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_3d_view_evidence:
        if isinstance(row, dict):
            vid = str(row.get("viewpointId") or "")
            if vid:
                vp_by_id[vid] = row

    plan_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_plan_view_evidence:
        if isinstance(row, dict):
            pid = str(row.get("planViewId") or "")
            if pid:
                plan_by_id[pid] = row

    sec_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_section_cut_evidence:
        if isinstance(row, dict):
            cid = str(row.get("sectionCutId") or "")
            if cid:
                sec_by_id[cid] = row

    unresolved: list[dict[str, Any]] = []
    topics = bcf_topics_index.get("topics") if isinstance(bcf_topics_index, dict) else None
    topic_list = topics if isinstance(topics, list) else []

    for t in topic_list:
        if not isinstance(t, dict):
            continue
        tid = str(t.get("topicId") or "")
        tk = str(t.get("topicKind") or "")
        refs_raw = t.get("evidenceRefs")
        refs = refs_raw if isinstance(refs_raw, list) else []
        for ref in refs:
            if not isinstance(ref, dict):
                continue
            kind = ref.get("kind")
            ok = False
            if kind == "sheet":
                sid = ref.get("sheetId")
                ok = isinstance(sid, str) and sid in sheet_by_id
            elif kind == "viewpoint":
                vid = ref.get("viewpointId")
                ok = isinstance(vid, str) and vid in vp_by_id
            elif kind == "plan_view":
                pid = ref.get("planViewId")
                ok = isinstance(pid, str) and pid in plan_by_id
            elif kind == "section_cut":
                cid = ref.get("sectionCutId")
                ok = isinstance(cid, str) and cid in sec_by_id
            elif kind == "deterministic_png":
                png = ref.get("pngBasename")
                ok = isinstance(png, str) and bool(png.strip())
            if ok:
                continue
            unresolved.append(
                {
                    "topicKind": tk,
                    "topicId": tid,
                    "evidenceRef": {
                        "kind": kind,
                        "sheetId": ref.get("sheetId"),
                        "viewpointId": ref.get("viewpointId"),
                        "planViewId": ref.get("planViewId"),
                        "sectionCutId": ref.get("sectionCutId"),
                        "pngBasename": ref.get("pngBasename"),
                    },
                }
            )

        if tk == "bcf":
            vpref = t.get("viewpointRef")
            if isinstance(vpref, str) and vpref.strip() and vpref not in vp_by_id:
                unresolved.append(
                    {
                        "topicKind": tk,
                        "topicId": tid,
                        "evidenceRef": {
                            "kind": "bcf_viewpoint_ref",
                            "sheetId": None,
                            "viewpointId": vpref,
                            "planViewId": None,
                            "sectionCutId": None,
                            "pngBasename": None,
                        },
                    }
                )
            pvid = t.get("planViewId")
            if isinstance(pvid, str) and pvid.strip() and pvid not in plan_by_id:
                unresolved.append(
                    {
                        "topicKind": tk,
                        "topicId": tid,
                        "evidenceRef": {
                            "kind": "bcf_plan_view",
                            "sheetId": None,
                            "viewpointId": None,
                            "planViewId": pvid,
                            "sectionCutId": None,
                            "pngBasename": None,
                        },
                    }
                )
            scid = t.get("sectionCutId")
            if isinstance(scid, str) and scid.strip() and scid not in sec_by_id:
                unresolved.append(
                    {
                        "topicKind": tk,
                        "topicId": tid,
                        "evidenceRef": {
                            "kind": "bcf_section_cut",
                            "sheetId": None,
                            "viewpointId": None,
                            "planViewId": None,
                            "sectionCutId": scid,
                            "pngBasename": None,
                        },
                    }
                )
        elif tk == "issue":
            ivp = t.get("viewpointId")
            if isinstance(ivp, str) and ivp.strip() and ivp not in vp_by_id:
                unresolved.append(
                    {
                        "topicKind": tk,
                        "topicId": tid,
                        "evidenceRef": {
                            "kind": "issue_viewpoint",
                            "sheetId": None,
                            "viewpointId": ivp,
                            "planViewId": None,
                            "sectionCutId": None,
                            "pngBasename": None,
                        },
                    }
                )

    unresolved.sort(
        key=lambda x: (
            str(x.get("topicKind") or ""),
            str(x.get("topicId") or ""),
            str(x.get("evidenceRef", {}).get("kind") or ""),
            str(x.get("evidenceRef", {}).get("sheetId") or ""),
            str(x.get("evidenceRef", {}).get("viewpointId") or ""),
            str(x.get("evidenceRef", {}).get("planViewId") or ""),
            str(x.get("evidenceRef", {}).get("sectionCutId") or ""),
            str(x.get("evidenceRef", {}).get("pngBasename") or ""),
        )
    )
    return {
        "format": "evidenceRefResolution_v1",
        "unresolvedEvidenceRefs": unresolved,
        "unresolvedCount": len(unresolved),
        "hasUnresolvedEvidenceRefs": len(unresolved) > 0,
    }


def staged_artifact_links_v1(
    *,
    model_id: UUID,
    suggested_evidence_artifact_basename: str,
    package_semantic_digest_sha256: str,
) -> dict[str, Any]:
    """Deterministic staged-link references for agents; no network or secret materialization."""

    links = export_link_map(model_id)
    mid = str(model_id)
    bundle_json = f"{suggested_evidence_artifact_basename}-evidence-package.json"
    export_keys = (
        "evidencePackage",
        "snapshot",
        "validate",
        "bcfTopicsJsonExport",
        "bcfTopicsJsonImport",
    )
    export_relative_paths = {k: links[k] for k in export_keys}

    opt_in = os.environ.get("BIM_AI_STAGED_ARTIFACT_LINKS") == "1"
    gh_repo = (os.environ.get("GITHUB_REPOSITORY") or "").strip()
    gh_run = (os.environ.get("GITHUB_RUN_ID") or "").strip()
    gh_sha = (os.environ.get("GITHUB_SHA") or "").strip()

    github_actions = opt_in and bool(gh_repo) and bool(gh_run)
    resolution_mode = "github_actions" if github_actions else "local_relative"
    side_effects_enabled = opt_in

    github_actions_resolution: dict[str, Any] | None
    run_artifacts_web_url: str | None
    if github_actions:
        run_artifacts_web_url = f"https://github.com/{gh_repo}/actions/runs/{gh_run}#artifacts"
        github_actions_resolution = {
            "repository": gh_repo,
            "runId": gh_run,
            "runArtifactsWebUrl": run_artifacts_web_url,
        }
        if gh_sha:
            github_actions_resolution["commitSha"] = gh_sha
    else:
        github_actions_resolution = None
        run_artifacts_web_url = None

    staged_link_rows: list[dict[str, Any]] = [
        {
            "id": "bcf_topics_json_export_anchor",
            "kind": "api_relative_anchor",
            "bcfTopicsJsonExportHref": links["bcfTopicsJsonExport"],
        },
        {
            "id": "bcf_topics_json_import_anchor",
            "kind": "api_relative_anchor",
            "bcfTopicsJsonImportHref": links["bcfTopicsJsonImport"],
        },
        {
            "id": "evidence_package_json_anchor",
            "kind": "api_relative_anchor",
            "evidencePackageJsonBasename": bundle_json,
            "evidencePackageHref": links["evidencePackage"],
            "notes": (
                "Reference only: save JSON as evidencePackageJsonBasename; fetch via evidencePackageHref "
                "without mutating repositories."
            ),
        },
        {
            "id": "model_snapshot_anchor",
            "kind": "api_relative_anchor",
            "snapshotHref": links["snapshot"],
        },
        {
            "id": "model_validate_anchor",
            "kind": "api_relative_anchor",
            "validateHref": links["validate"],
        },
    ]

    playwright_row: dict[str, Any] = {
        "id": "playwright_evidence_ci_bundle",
        "kind": "ci_playwright_evidence_bundle",
        "artifactNamePattern": "evidence-web-{githubRunId}-playwright",
        "notes": (
            "Expected GitHub Actions artifact name template when RUN_ID is known; pattern is unresolved "
            "when githubRunId is empty."
        ),
    }
    if github_actions and run_artifacts_web_url:
        playwright_row["resolvedArtifactName"] = f"evidence-web-{gh_run}-playwright"
        playwright_row["githubActionsRunArtifactsWebUrl"] = run_artifacts_web_url
        if gh_sha:
            playwright_row["commitSha"] = gh_sha
    staged_link_rows.append(playwright_row)

    staged_link_rows.sort(key=lambda r: str(r.get("id", "")))

    return {
        "format": "stagedArtifactLinks_v1",
        "followThroughNote": (
            "Links and patterns are references for agent follow-through; API paths may be unresolved offline "
            "and GitHub Actions URLs appear only when non-secret CI environment fields are present."
        ),
        "resolutionMode": resolution_mode,
        "sideEffectsEnabled": side_effects_enabled,
        "modelId": mid,
        "suggestedEvidenceArtifactBasename": suggested_evidence_artifact_basename,
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "bundleFilenameHints": {"evidencePackageJson": bundle_json},
        "exportRelativePaths": export_relative_paths,
        "githubActionsResolution": github_actions_resolution,
        "stagedLinkRows": staged_link_rows,
    }


def artifact_upload_manifest_v1(
    *,
    model_id: UUID,
    suggested_evidence_artifact_basename: str,
    package_semantic_digest_sha256: str,
    evidence_closure_review: dict[str, Any],
) -> dict[str, Any]:
    """Deterministic upload-manifest contract for evidence bundles; no uploads or secrets."""

    sal = staged_artifact_links_v1(
        model_id=model_id,
        suggested_evidence_artifact_basename=suggested_evidence_artifact_basename,
        package_semantic_digest_sha256=package_semantic_digest_sha256,
    )
    erp = sal["exportRelativePaths"]
    if not isinstance(erp, dict):
        erp = {}

    ingest_manifest_digest: str | None = None
    pix = evidence_closure_review.get("pixelDiffExpectation")
    if isinstance(pix, dict):
        ac = pix.get("artifactIngestCorrelation_v1")
        if isinstance(ac, dict):
            raw_d = ac.get("ingestManifestDigestSha256")
            if isinstance(raw_d, str) and len(raw_d.strip()) == 64:
                ingest_manifest_digest = raw_d.strip()

    side_effects_enabled = bool(sal.get("sideEffectsEnabled"))
    resolution_mode = str(sal.get("resolutionMode") or "")
    gh_res = sal.get("githubActionsResolution")
    gh_ok = isinstance(gh_res, dict) and bool(gh_res)

    if side_effects_enabled:
        side_effects_reason = (
            "BIM_AI_STAGED_ARTIFACT_LINKS=1 enables non-secret GitHub Actions correlation hints only; "
            "the API still performs no artifact uploads."
        )
    else:
        side_effects_reason = (
            "Staged CI correlation hints are disabled by default "
            "(set BIM_AI_STAGED_ARTIFACT_LINKS=1 together with GITHUB_REPOSITORY and GITHUB_RUN_ID)."
        )

    ci_hint: dict[str, Any]
    if gh_ok:
        repo = str(gh_res.get("repository") or "")
        run_id = str(gh_res.get("runId") or "")
        ci_hint = {
            "format": "ciProviderHint_v1",
            "provider": "github_actions",
            "repository": repo,
            "runId": run_id,
            "runArtifactsWebUrl": str(gh_res.get("runArtifactsWebUrl") or ""),
        }
        cs = gh_res.get("commitSha")
        if isinstance(cs, str) and cs.strip():
            ci_hint["commitSha"] = cs.strip()
    else:
        if resolution_mode == "github_actions":
            omitted = (
                "GitHub Actions resolution inactive despite github_actions mode label; "
                "check GITHUB_REPOSITORY and GITHUB_RUN_ID."
            )
        elif not side_effects_enabled:
            omitted = (
                "Non-secret GitHub Actions correlation omitted: BIM_AI_STAGED_ARTIFACT_LINKS is not 1 "
                "or GITHUB_REPOSITORY/GITHUB_RUN_ID are unset."
            )
        else:
            omitted = "GITHUB_REPOSITORY or GITHUB_RUN_ID missing."
        ci_hint = {
            "format": "ciProviderHint_v1",
            "provider": "github_actions",
            "omittedReason": omitted,
        }

    bundle_hints = sal.get("bundleFilenameHints")
    bundle_json = (
        str(bundle_hints["evidencePackageJson"])
        if isinstance(bundle_hints, dict)
        and isinstance(bundle_hints.get("evidencePackageJson"), str)
        else f"{suggested_evidence_artifact_basename}-evidence-package.json"
    )

    playwright_row: dict[str, Any] | None = None
    rows_raw = sal.get("stagedLinkRows")
    if isinstance(rows_raw, list):
        for r in rows_raw:
            if isinstance(r, dict) and r.get("id") == "playwright_evidence_ci_bundle":
                playwright_row = r
                break

    pw_expected = None
    pw_pattern = None
    if isinstance(playwright_row, dict):
        ra = playwright_row.get("resolvedArtifactName")
        pat = playwright_row.get("artifactNamePattern")
        if isinstance(ra, str) and ra.strip():
            pw_expected = ra.strip()
        if isinstance(pat, str) and pat.strip():
            pw_pattern = pat.strip()

    def _build_artifact(
        artifact_id: str,
        kind: str,
        expected_artifact_name: str | None,
        local_export_relative_path: str | None,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        sig_row = _artifact_local_signature_row_v1(artifact_id, kind, expected_artifact_name)
        entry: dict[str, Any] = {
            "id": artifact_id,
            "kind": kind,
            "expectedArtifactName": expected_artifact_name,
            "localExportRelativePath": local_export_relative_path,
            "uploadEligible": False,
            "localSignatureRow_v1": sig_row,
        }
        if expected_artifact_name is None:
            entry["missingArtifactReason_v1"] = _missing_artifact_reason_v1(
                "artifact_name_not_resolved",
                "expectedArtifactName is None: artifact name cannot be resolved in this context "
                "(no real upload is performed by this API).",
            )
        else:
            entry["missingArtifactReason_v1"] = _missing_artifact_reason_v1(
                "not_upload_eligible",
                "uploadEligible is False: this API is a manifest-only contract and performs no "
                "real artifact uploads or side effects.",
            )
        if extra:
            entry.update(extra)
        return entry

    expected_artifacts: list[dict[str, Any]] = [
        _build_artifact(
            "bcf_topics_json_export",
            "local_api_relative_json_export",
            None,
            str(erp.get("bcfTopicsJsonExport") or ""),
        ),
        _build_artifact(
            "bcf_topics_json_import",
            "local_api_relative_json_import",
            None,
            str(erp.get("bcfTopicsJsonImport") or ""),
        ),
        _build_artifact(
            "evidence_package_json",
            "bundle_evidence_package_json",
            bundle_json,
            str(erp.get("evidencePackage") or ""),
        ),
        _build_artifact(
            "playwright_ci_evidence_bundle",
            "ci_playwright_named_bundle",
            pw_expected,
            None,
            extra={"artifactNamePattern": pw_pattern} if pw_pattern else None,
        ),
        _build_artifact(
            "snapshot_json",
            "local_api_relative_snapshot",
            None,
            str(erp.get("snapshot") or ""),
        ),
        _build_artifact(
            "validate_json",
            "local_api_relative_validate",
            None,
            str(erp.get("validate") or ""),
        ),
    ]
    expected_artifacts.sort(key=lambda x: str(x.get("id") or ""))

    # Deterministic signature rows manifest digest — covers all per-artifact signature rows.
    sig_rows_payload = json.dumps(
        sorted(
            [
                a["localSignatureRow_v1"]
                for a in expected_artifacts
                if isinstance(a.get("localSignatureRow_v1"), dict)
            ],
            key=lambda r: str(r.get("artifactId", "")),
        ),
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    signature_rows_manifest_digest = hashlib.sha256(sig_rows_payload.encode("utf-8")).hexdigest()

    content_digests: dict[str, Any] = {
        "format": "artifactUploadContentDigests_v1",
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "signatureRowsManifestDigestSha256": signature_rows_manifest_digest,
    }
    if ingest_manifest_digest:
        content_digests["artifactIngestManifestDigestSha256"] = ingest_manifest_digest

    return {
        "format": "artifactUploadManifest_v1",
        "semanticDigestExclusionNote": (
            "artifactUploadManifest_v1 is derivative metadata and excluded from semanticDigestSha256."
        ),
        "contractNote": (
            "Manifest-only contract: this API never uploads artifacts; entries describe expected bundle "
            "companions and correlation digests."
        ),
        "uploadEligible": False,
        "sideEffectsEnabled": side_effects_enabled,
        "sideEffectsReason": side_effects_reason,
        "resolutionMode": resolution_mode,
        "ciProviderHint_v1": ci_hint,
        "contentDigests": content_digests,
        "exportRelativePaths": dict(erp),
        "expectedArtifacts": expected_artifacts,
        "stagedArtifactLinksFormat": "stagedArtifactLinks_v1",
        "digestExclusionRules_v1": digest_exclusion_rules_v1(),
    }


def bcf_issue_coordination_check_v1(
    *,
    doc: Document,
    bcf_topics_index: dict[str, Any],
) -> dict[str, Any]:
    """BCF JSON export vs topics index vs document counts (issues are index-only for this export)."""

    doc_bcf = sum(1 for e in doc.elements.values() if isinstance(e, BcfElem))
    doc_issue = sum(1 for e in doc.elements.values() if isinstance(e, IssueElem))
    topics = bcf_topics_index.get("topics") if isinstance(bcf_topics_index, dict) else None
    topic_list = topics if isinstance(topics, list) else []
    idx_bcf = sum(1 for t in topic_list if isinstance(t, dict) and t.get("topicKind") == "bcf")
    idx_issue = sum(1 for t in topic_list if isinstance(t, dict) and t.get("topicKind") == "issue")

    return {
        "format": "bcfIssueCoordinationCheck_v1",
        "documentBcfTopicCount": doc_bcf,
        "documentIssueTopicCount": doc_issue,
        "indexedBcfTopicCount": idx_bcf,
        "indexedIssueTopicCount": idx_issue,
        "bcfTopicsJsonExportTopicCount": doc_bcf,
        "bcfIndexedTopicCountMatchesDocument": idx_bcf == doc_bcf,
        "issueIndexedTopicCountMatchesDocument": idx_issue == doc_issue,
        "bcfExportIncludesOnlyBcfElems": True,
        "issueTopicsNotInBcfTopicsJsonExport": True,
        "bcfTopicsJsonImportSupportsTopicKinds": ["bcf"],
    }


def bcf_roundtrip_evidence_summary_v1(
    *,
    doc: Document,
    bcf_topics_index: dict[str, Any],
    violations: list[dict[str, Any]] | None,
    evidence_ref_resolution: dict[str, Any],
) -> dict[str, Any]:
    """Deterministic BCF/issue round-trip readout for agent review (digest-excluded parent)."""

    doc_bcf = sum(1 for e in doc.elements.values() if isinstance(e, BcfElem))
    topics = bcf_topics_index.get("topics") if isinstance(bcf_topics_index, dict) else None
    topic_list = topics if isinstance(topics, list) else []

    viewpoint_and_shot = 0
    model_element_ref_ct = 0
    topics_linked: list[dict[str, Any]] = []

    viol_rows: list[tuple[str, frozenset[str]]] = []
    for v in violations or []:
        if not isinstance(v, dict):
            continue
        rid = str(v.get("ruleId") or "").strip()
        if not rid:
            continue
        raw_eids = v.get("elementIds")
        eid_set = frozenset(
            str(x) for x in (raw_eids if isinstance(raw_eids, list) else []) if x is not None
        )
        viol_rows.append((rid, eid_set))

    for t in topic_list:
        if not isinstance(t, dict):
            continue
        tk = str(t.get("topicKind") or "")
        tid = str(t.get("topicId") or "")
        raw_eids = t.get("elementIds")
        el_list = [
            str(x) for x in (raw_eids if isinstance(raw_eids, list) else []) if x is not None
        ]
        model_element_ref_ct += len(el_list)
        topic_eids = frozenset(el_list)

        if tk == "bcf":
            vpref = t.get("viewpointRef")
            if isinstance(vpref, str) and vpref.strip():
                viewpoint_and_shot += 1
        elif tk == "issue":
            ivp = t.get("viewpointId")
            if isinstance(ivp, str) and ivp.strip():
                viewpoint_and_shot += 1

        refs_raw = t.get("evidenceRefs")
        refs = refs_raw if isinstance(refs_raw, list) else []
        for ref in refs:
            if not isinstance(ref, dict):
                continue
            rk = ref.get("kind")
            if rk in ("viewpoint", "deterministic_png"):
                viewpoint_and_shot += 1

        linked: set[str] = set()
        for rid, veids in viol_rows:
            if topic_eids & veids:
                linked.add(rid)
        if linked:
            topics_linked.append(
                {
                    "topicKind": tk,
                    "topicId": tid,
                    "violationRuleIds": sorted(linked),
                }
            )

    topics_linked.sort(key=lambda x: (str(x.get("topicKind") or ""), str(x.get("topicId") or "")))

    ur_raw = evidence_ref_resolution.get("unresolvedCount")
    unresolved_ct = int(ur_raw) if isinstance(ur_raw, int) else 0

    return {
        "format": "bcfRoundtripEvidenceSummary_v1",
        "bcfTopicCount": doc_bcf,
        "viewpointAndScreenshotRefCount": viewpoint_and_shot,
        "modelElementReferenceCount": model_element_ref_ct,
        "unresolvedReferenceCount": unresolved_ct,
        "topicsWithLinkedViolationRuleIds": topics_linked,
    }


def collaboration_replay_conflict_hints_v1() -> dict[str, Any]:
    """Static pointers for collaboration constraint failures (bundle 409 + replay diagnostics)."""

    return {
        "format": "collaborationReplayConflictHints_v1",
        "constraintRejectedHttpStatus": 409,
        "typicalErrorBodyFields": [
            "reason",
            "violations",
            "replayDiagnostics",
            "mergePreflight_v1",
        ],
        "replayDiagnosticsFields": [
            "commandCount",
            "commandTypesInOrder",
            "replayPerformanceBudget_v1",
            "firstBlockingCommandIndex",
            "blockingViolationRuleIds",
        ],
        "mergePreflight_v1Fields": [
            "format",
            "reasonCode",
            "firstConflictingStepIndex",
            "conflictingDeclaredIds",
            "conflictingExistingElementIds",
            "missingReferenceHints",
            "safeRetryClassification",
            "suggestedManualAction",
            "suggestedAgentAction",
            "evidenceDigestSha256",
        ],
        "mergePreflight_v1Note": (
            "Deterministic commandBundleMergePreflight_v1 on bundle 409 and bundle dry-run: ordered "
            "first conflicting step, sorted ids, sorted missingReferenceHints (stepIndex, referenceKey, "
            "referenceId), safeRetryClassification, stable manual/agent guidance strings, "
            "evidenceDigestSha256 over canonical JSON excluding the digest field."
        ),
        "replayPerformanceBudgetNote": (
            "Nested object replayPerformanceBudget_v1: deterministic commandCount, sorted commandTypeHistogram, "
            "largeBundleWarn / warningCodes / agentBundleAdvisory for large bundles, declaredDiagnosticsBudgetMs* "
            "ceilings mirrored from diagnostics perf guards, optional firstBlockingCommandIndex when constraints fail."
        ),
        "firstBlockingCommandIndexNote": (
            "Emitted when replay outcome indicates constraint_error; omitted for successful dry outcomes."
        ),
        "blockingViolationRuleIdsNote": (
            "Sorted unique ruleId values from blocking/error violations at the first blocking prefix; "
            "omitted when firstBlockingCommandIndex cannot be resolved."
        ),
    }


def evidence_agent_follow_through_v1(
    *,
    model_id: UUID,
    doc: Document,
    package_semantic_digest_sha256: str,
    suggested_evidence_artifact_basename: str,
    bcf_topics_index: dict[str, Any],
    deterministic_sheet_evidence: list[dict[str, Any]],
    deterministic_3d_view_evidence: list[dict[str, Any]],
    deterministic_plan_view_evidence: list[dict[str, Any]],
    deterministic_section_cut_evidence: list[dict[str, Any]],
    violations: list[dict[str, Any]] | None = None,
    evidence_closure_review: dict[str, Any] | None = None,
    evidence_diff_ingest_fix_loop: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Programmatic rollup: staged artifact link contract, BCF coordination, ref resolution, replay hints."""

    ref_resolution = evidence_ref_resolution_v1(
        bcf_topics_index=bcf_topics_index,
        deterministic_sheet_evidence=deterministic_sheet_evidence,
        deterministic_3d_view_evidence=deterministic_3d_view_evidence,
        deterministic_plan_view_evidence=deterministic_plan_view_evidence,
        deterministic_section_cut_evidence=deterministic_section_cut_evidence,
    )

    sal = staged_artifact_links_v1(
        model_id=model_id,
        suggested_evidence_artifact_basename=suggested_evidence_artifact_basename,
        package_semantic_digest_sha256=package_semantic_digest_sha256,
    )

    return {
        "format": "evidenceAgentFollowThrough_v1",
        "semanticDigestExclusionNote": (
            "evidenceAgentFollowThrough_v1 is derivative and excluded from semanticDigestSha256 "
            "alongside bcfTopicsIndex_v1 and agentReviewActions_v1."
        ),
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "stagedArtifactLinks_v1": sal,
        "bcfIssueCoordinationCheck_v1": bcf_issue_coordination_check_v1(
            doc=doc,
            bcf_topics_index=bcf_topics_index,
        ),
        "evidenceRefResolution_v1": ref_resolution,
        "bcfRoundtripEvidenceSummary_v1": bcf_roundtrip_evidence_summary_v1(
            doc=doc,
            bcf_topics_index=bcf_topics_index,
            violations=violations,
            evidence_ref_resolution=ref_resolution,
        ),
        "bcfIssuePackageExport_v1": bcf_issue_package_export_v1(
            bcf_topics_index=bcf_topics_index,
            violations=violations,
            evidence_ref_resolution=ref_resolution,
            staged_artifact_links_v1_payload=sal,
            evidence_closure_review=evidence_closure_review,
            evidence_diff_ingest_fix_loop=evidence_diff_ingest_fix_loop,
            deterministic_sheet_evidence=deterministic_sheet_evidence,
            deterministic_3d_view_evidence=deterministic_3d_view_evidence,
            deterministic_plan_view_evidence=deterministic_plan_view_evidence,
            deterministic_section_cut_evidence=deterministic_section_cut_evidence,
        ),
        "collaborationReplayConflictHints_v1": collaboration_replay_conflict_hints_v1(),
    }


def sheetProductionEvidenceBaseline_v1(doc: Document) -> dict[str, Any]:
    """Per-sheet production baseline: viewport count, segment completeness %, titleblock coverage %, manifest digest."""
    sheets = sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)),
        key=lambda s: s.id,
    )
    rows: list[dict[str, Any]] = []
    for sh in sheets:
        vp_count = sum(1 for vp in (sh.viewports_mm or []) if isinstance(vp, dict))

        seg_comp = sheetExportSegmentCompleteness_v1(doc, sh.id)
        seg_pct = float(seg_comp.get("completenessPercent", 100.0))

        tb_comp = titleblockFieldCompleteness_v1(sh)
        tb_pct = float(tb_comp.get("coveragePercent", 0.0))

        norm = normalize_titleblock_revision_issue_v1(sh.titleblock_parameters)
        rev_iss_count = sum(1 for v in norm.values() if v)

        manifest = sheetViewportProductionManifest_v1(doc, sh.id)
        manifest_digest = str(manifest.get("manifestDigestSha256") or "")

        rows.append(
            {
                "sheetId": sh.id,
                "sheetName": sh.name or sh.id,
                "viewportCount": vp_count,
                "segmentCompletenessPercent": seg_pct,
                "titleblockCoveragePercent": tb_pct,
                "revisionIssueFieldCount": rev_iss_count,
                "manifestDigestSha256": manifest_digest,
            }
        )

    return {
        "format": "sheetProductionEvidenceBaseline_v1",
        "sheetCount": len(rows),
        "sheets": rows,
    }


# Derivative summaries from ``agent_evidence_review_loop`` — omit so deterministic-row digests stay stable.
# Public alias so CI gates and tests can enumerate and document the exclusion set.
DIGEST_EXCLUDED_KEYS: frozenset[str] = frozenset(
    {
        "generatedAt",
        "semanticDigestSha256",
        "bcfTopicsIndex_v1",
        "agentReviewActions_v1",
        "evidenceDiffIngestFixLoop_v1",
        "evidenceReviewPerformanceGate_v1",
        "evidenceAgentFollowThrough_v1",
        "artifactUploadManifest_v1",
        "agentGeneratedBundleQaChecklist_v1",
        "evidenceBaselineLifecycleReadout_v1",
        "v1AcceptanceProofMatrix_v1",
        "v1CloseoutReadinessManifest_v1",
        "agentBriefAcceptanceReadout_v1",
        "prdAdvisorMatrix_v1",
    }
)
# Internal alias kept for backward-compatible internal references.
_DIGEST_EXCLUDED_KEYS = DIGEST_EXCLUDED_KEYS


def digest_exclusion_rules_v1() -> dict[str, Any]:
    """Structured digest exclusion rules for CI gate documentation and enforcement."""
    return {
        "format": "digestExclusionRules_v1",
        "excludedTopLevelKeys": sorted(DIGEST_EXCLUDED_KEYS),
        "rationale": (
            "These top-level keys are derivative summaries or derivative metadata produced "
            "after the semantic package digest is computed. Excluding them keeps the "
            "semanticDigestSha256 stable across repeated runs when only derivative output changes. "
            "CI verification gates must not include these keys in digest comparisons."
        ),
        "enforcementNote": (
            "evidence_package_semantic_digest_sha256() enforces these exclusions automatically. "
            "Do not introduce nondeterministic timestamps, random IDs, machine-local absolute paths, "
            "or environment-specific values into keys that are NOT excluded."
        ),
    }


def _artifact_local_signature_row_v1(
    artifact_id: str,
    kind: str,
    expected_artifact_name: str | None,
) -> dict[str, Any]:
    """Deterministic local signature row for an expected artifact (no secrets or network calls)."""
    descriptor = json.dumps(
        {
            "artifactId": artifact_id,
            "kind": kind,
            "expectedArtifactName": expected_artifact_name or "",
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(descriptor.encode("utf-8")).hexdigest()
    return {
        "format": "localArtifactSignatureRow_v1",
        "signatureKind": "sha256_content_descriptor",
        "artifactId": artifact_id,
        "contentDescriptorDigestSha256": digest,
        "contentDescriptorDigestPrefix16": digest[:16],
        "note": (
            "Deterministic SHA-256 of artifact ID/kind/expectedArtifactName descriptor; "
            "no secret key material. Stable given unchanged artifact metadata."
        ),
    }


def _missing_artifact_reason_v1(reason_code: str, detail: str) -> dict[str, Any]:
    """Structured reason for a missing or non-upload-eligible artifact."""
    return {
        "format": "missingArtifactReason_v1",
        "reasonCode": reason_code,
        "detail": detail,
    }


def evidence_package_semantic_digest_sha256(payload: dict[str, Any]) -> str:
    """SHA-256 of a canonical JSON view of `payload`, excluding unstable keys."""

    shallow = {k: v for k, v in payload.items() if k not in _DIGEST_EXCLUDED_KEYS}

    pv = shallow.get("planViews")
    if isinstance(pv, list):
        shallow = dict(shallow)
        shallow["planViews"] = sorted(pv, key=lambda x: str(x.get("id", "")))

    sch = shallow.get("scheduleIds")
    if isinstance(sch, list):
        shallow = dict(shallow)
        shallow["scheduleIds"] = sorted(sch, key=lambda x: str(x.get("id", "")))

    val = shallow.get("validate")
    if isinstance(val, dict):
        viols = val.get("violations")
        if isinstance(viols, list):
            shallow = dict(shallow)
            val2 = dict(val)
            val2["violations"] = sorted(
                viols,
                key=lambda x: (
                    str(x.get("ruleId", "")),
                    json.dumps(x.get("elementIds", []), sort_keys=True),
                    str(x.get("severity", "")),
                    str(x.get("message", "")),
                ),
            )
            shallow["validate"] = val2

    rdc = shallow.get("roomDerivationCandidates")
    if isinstance(rdc, dict):
        cands = rdc.get("candidates")
        if isinstance(cands, list):
            shallow = dict(shallow)
            rdc2 = dict(rdc)

            normed: list[dict[str, Any]] = []

            for c_raw in sorted(cands, key=lambda x: str(x.get("candidateId", ""))):
                if not isinstance(c_raw, dict):
                    continue

                cx = dict(c_raw)

                comp = cx.get("comparisonToAuthoredRooms")

                if isinstance(comp, list):
                    cx["comparisonToAuthoredRooms"] = sorted(
                        comp, key=lambda x: str(x.get("roomId", ""))
                    )

                wrn = cx.get("warnings")

                if isinstance(wrn, list):
                    cx["warnings"] = sorted(
                        wrn,
                        key=lambda x: (
                            str(x.get("code", "")),
                            str(x.get("message", "")),
                            str(x.get("severity", "")),
                        ),
                    )

                sh = cx.get("separationHintGridLineIds")

                if isinstance(sh, list):
                    cx["separationHintGridLineIds"] = sorted(str(x) for x in sh)

                normed.append(cx)

            rdc2["candidates"] = normed
            shallow["roomDerivationCandidates"] = rdc2

    tmr = shallow.get("typeMaterialRegistry")
    if isinstance(tmr, dict):
        docp = tmr.get("document")
        if isinstance(docp, dict):
            shallow = dict(shallow)
            tmr2 = dict(tmr)
            doc2 = dict(docp)
            fts = doc2.get("familyTypes")
            if isinstance(fts, list):
                doc2["familyTypes"] = sorted(fts, key=lambda x: str(x.get("id", "")))
            wts = doc2.get("wallTypes")
            if isinstance(wts, list):
                doc2["wallTypes"] = sorted(wts, key=lambda x: str(x.get("id", "")))
            fts = doc2.get("floorTypes")
            if isinstance(fts, list):
                doc2["floorTypes"] = sorted(fts, key=lambda x: str(x.get("id", "")))
            rtts = doc2.get("roofTypes")
            if isinstance(rtts, list):
                doc2["roofTypes"] = sorted(rtts, key=lambda x: str(x.get("id", "")))
            tmr2["document"] = doc2
            shallow["typeMaterialRegistry"] = tmr2

    pps = shallow.get("planProjectionWireSample")
    if isinstance(pps, dict):
        shallow = dict(shallow)
        pps2 = dict(pps)
        prim = pps2.get("primitives")
        if isinstance(prim, dict):
            prim2 = dict(prim)
            for list_key, arr in list(prim2.items()):
                if list_key == "format":
                    continue
                if isinstance(arr, list):
                    prim2[list_key] = sorted(arr, key=lambda x: str(x.get("id", "")))
            pps2["primitives"] = prim2
        warn_pv = pps2.get("warnings")
        if isinstance(warn_pv, list):
            pps2["warnings"] = sorted(
                warn_pv,
                key=lambda x: (str(x.get("code", "")), str(x.get("message", ""))),
            )
        shallow["planProjectionWireSample"] = pps2

    body = json.dumps(shallow, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


# Static registry of all known top-level keys that contribute to the semantic digest.
# These are the keys present in the payload at the time evidence_package_semantic_digest_sha256()
# is called, plus post-digest keys that are not in DIGEST_EXCLUDED_KEYS.
DIGEST_INCLUDED_KEYS: frozenset[str] = frozenset(
    {
        # Pre-digest keys (present when semanticDigestSha256 is computed)
        "format",
        "modelId",
        "revision",
        "elementCount",
        "countsByKind",
        "summary",
        "validate",
        "exportLinks",
        "planViews",
        "expectedScreenshotCaptures",
        "recommendedCapture",
        "scheduleIds",
        "roomDerivationPreview",
        "roomDerivationCandidates",
        "typeMaterialRegistry",
        "hint",
        "sheetRasterNote",
        "planProjectionWireSample",
        # Post-digest non-excluded keys
        "semanticDigestPrefix16",
        "suggestedEvidenceArtifactBasename",
        "suggestedEvidenceBundleFilenames",
        "recommendedPngEvidenceBackend",
        "svgRasterBackendAvailable",
        "deterministicSheetEvidence",
        "deterministic3dViewEvidence",
        "deterministicPlanViewEvidence",
        "deterministicSectionCutEvidence",
        "evidenceClosureReview_v1",
        "evidenceLifecycleSignal_v1",
        "agentEvidenceClosureHints",
        "agentBriefCommandProtocol_v1",
        "roomColorSchemeOverrideEvidence_v1",
        "roomColourSchemeLegendEvidence_v1",
        "sheetProductionBaseline_v1",
    }
)


def evidence_package_digest_invariants_v1(payload: dict[str, Any]) -> dict[str, Any]:
    """Enumerate which top-level keys contribute to vs are excluded from the semantic digest.

    Computes the invariants structure over the final assembled payload.  Unknown keys are those
    present in the payload that are neither in the included nor excluded registries — the advisory
    rule ``evidence_package_unknown_top_level_key`` fires for each.
    """
    # The invariants key itself is meta; exclude it from classification.
    _META_KEY = "evidencePackageDigestInvariants_v1"

    actual_keys = frozenset(payload.keys()) - {_META_KEY}
    unknown = sorted(actual_keys - DIGEST_INCLUDED_KEYS - DIGEST_EXCLUDED_KEYS)

    excluded_rules = digest_exclusion_rules_v1()
    excluded_key_rationale: list[dict[str, Any]] = []
    for key in sorted(DIGEST_EXCLUDED_KEYS):
        excluded_key_rationale.append(
            {
                "key": key,
                "rationale": excluded_rules["rationale"],
                "enforcementNote": excluded_rules["enforcementNote"],
            }
        )

    advisory_findings: list[dict[str, Any]] = [
        {
            "ruleId": "evidence_package_unknown_top_level_key",
            "severity": "warning",
            "keyName": k,
            "message": (
                f"Top-level key {k!r} is not registered in DIGEST_INCLUDED_KEYS or "
                "DIGEST_EXCLUDED_KEYS. Explicitly categorise it to keep digest invariants stable."
            ),
        }
        for k in unknown
    ]

    body: dict[str, Any] = {
        "format": "evidencePackageDigestInvariants_v1",
        "digestIncludedTopLevelKeys": sorted(DIGEST_INCLUDED_KEYS),
        "digestExcludedTopLevelKeys": excluded_key_rationale,
        "unknownTopLevelKeys": unknown,
        "advisoryFindings": advisory_findings,
    }
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**body, "evidencePackageDigestInvariantsDigestSha256": digest}
