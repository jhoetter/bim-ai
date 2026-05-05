"""Structured evidence-package manifest (Revit parity Phase A operational tracker)."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from urllib.parse import quote
from uuid import UUID

from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    IssueElem,
    PlanViewElem,
    SectionCutElem,
    SheetElem,
    ViewpointElem,
)
from bim_ai.sheet_preview_svg import (
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    build_sheet_print_raster_print_contract_v3,
    plan_room_programme_legend_hints_v0,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_svg_utf8_sha256,
    viewport_evidence_hints_v1,
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
                "viewportEvidenceHints_v0": viewport_evidence_hints_v1(doc, list(sh.viewports_mm or [])),
                "planRoomProgrammeLegendHints_v0": plan_room_programme_legend_hints_v0(
                    doc, list(sh.viewports_mm or [])
                ),
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

        rows.append(
            {
                "viewpointId": vp.id,
                "viewpointName": vp.name,
                "viewerClipCapElevMm": vp.viewer_clip_cap_elev_mm,
                "viewerClipFloorElevMm": vp.viewer_clip_floor_elev_mm,
                "hiddenSemanticKinds3d": list(vp.hidden_semantic_kinds_3d or []),
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

        )

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
        if (
            isinstance(b, str)
            and isinstance(d, str)
            and b.endswith(".png")
            and d.endswith(".png")
        ):
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
        "artifactIngestCorrelationNestedField": "artifactIngestCorrelation_v1",
        "artifactIngestCorrelationFullPath": (
            "evidenceClosureReview_v1.pixelDiffExpectation.artifactIngestCorrelation_v1"
        ),
        "artifactIngestManifestDigestSha256LifecycleField": "artifactIngestManifestDigestSha256",
        "evidenceLifecycleSignalField": "evidenceLifecycleSignal_v1",
        "evidenceDiffIngestFixLoopField": "evidenceDiffIngestFixLoop_v1",
        "evidenceAgentFollowThroughField": "evidenceAgentFollowThrough_v1",
        "semanticDigestOmitsDerivativeSummariesNote": (
            "semanticDigestSha256 excludes bcfTopicsIndex_v1, agentReviewActions_v1, "
            "evidenceDiffIngestFixLoop_v1, and evidenceAgentFollowThrough_v1 so deterministic "
            "row digests stay stable."
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


def staged_artifact_url_placeholders_v1(
    *,
    model_id: UUID,
    suggested_evidence_artifact_basename: str,
) -> dict[str, Any]:
    """URL/path templates for CI artifacts — placeholders only; no external storage."""

    links = export_link_map(model_id)
    bundle_json = f"{suggested_evidence_artifact_basename}-evidence-package.json"
    return {
        "format": "stagedArtifactUrlPlaceholders_v1",
        "interpolationKeysNote": "Replace placeholders when publishing artifacts; never secrets.",
        "interpolationKeys": [
            "suggestedEvidenceArtifactBasename",
            "modelId",
            "githubRepository",
            "githubRunId",
            "githubSha",
        ],
        "urlTemplates": {
            "githubActionsRunArtifactsUrl": (
                "https://github.com/{githubRepository}/actions/runs/{githubRunId}#artifacts"
            )
        },
        "relativeApiPaths": {
            "evidencePackage": links["evidencePackage"],
            "bcfTopicsJsonExport": links["bcfTopicsJsonExport"],
            "bcfTopicsJsonImport": links["bcfTopicsJsonImport"],
            "snapshot": links["snapshot"],
        },
        "bundleFilenameHints": {
            "evidencePackageJson": bundle_json,
        },
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


def collaboration_replay_conflict_hints_v1() -> dict[str, Any]:
    """Static pointers for collaboration constraint failures (bundle 409 + replay diagnostics)."""

    return {
        "format": "collaborationReplayConflictHints_v1",
        "constraintRejectedHttpStatus": 409,
        "typicalErrorBodyFields": ["reason", "violations", "replayDiagnostics"],
        "replayDiagnosticsFields": [
            "commandCount",
            "commandTypesInOrder",
            "firstBlockingCommandIndex",
            "blockingViolationRuleIds",
        ],
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
) -> dict[str, Any]:
    """Programmatic rollup: artifact placeholders, BCF coordination, ref resolution, replay hints."""

    return {
        "format": "evidenceAgentFollowThrough_v1",
        "semanticDigestExclusionNote": (
            "evidenceAgentFollowThrough_v1 is derivative and excluded from semanticDigestSha256 "
            "alongside bcfTopicsIndex_v1 and agentReviewActions_v1."
        ),
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "stagedArtifactUrlPlaceholders_v1": staged_artifact_url_placeholders_v1(
            model_id=model_id,
            suggested_evidence_artifact_basename=suggested_evidence_artifact_basename,
        ),
        "bcfIssueCoordinationCheck_v1": bcf_issue_coordination_check_v1(
            doc=doc,
            bcf_topics_index=bcf_topics_index,
        ),
        "evidenceRefResolution_v1": evidence_ref_resolution_v1(
            bcf_topics_index=bcf_topics_index,
            deterministic_sheet_evidence=deterministic_sheet_evidence,
            deterministic_3d_view_evidence=deterministic_3d_view_evidence,
            deterministic_plan_view_evidence=deterministic_plan_view_evidence,
            deterministic_section_cut_evidence=deterministic_section_cut_evidence,
        ),
        "collaborationReplayConflictHints_v1": collaboration_replay_conflict_hints_v1(),
    }


# Derivative summaries from ``agent_evidence_review_loop`` — omit so deterministic-row digests stay stable.
_DIGEST_EXCLUDED_KEYS = frozenset(
    {
        "generatedAt",
        "semanticDigestSha256",
        "bcfTopicsIndex_v1",
        "agentReviewActions_v1",
        "evidenceDiffIngestFixLoop_v1",
        "evidenceAgentFollowThrough_v1",
    }
)


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

                    cx["comparisonToAuthoredRooms"] = sorted(comp, key=lambda x: str(x.get("roomId", "")))

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
