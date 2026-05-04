"""Structured evidence-package manifest (Revit parity Phase A operational tracker)."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from urllib.parse import quote
from uuid import UUID

from bim_ai.document import Document
from bim_ai.elements import PlanViewElem, SectionCutElem, SheetElem, ViewpointElem


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

        rows.append(
            {
                "sheetId": sh.id,
                "sheetName": sh.name,
                "svgHref": f"{api_base}/sheet-preview.svg?sheetId={qid}",
                "pdfHref": f"{api_base}/sheet-preview.pdf?sheetId={qid}",
                "playwrightSuggestedFilenames": {
                    "svgProbe": f"{stem}.svg.probe.txt",
                    "pdfProbe": f"{stem}.pdf.probe.bin",
                    "pngViewport": f"{stem}-viewport.png",
                    "pngFullSheet": f"{stem}-full.png",
                },
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
        "notes": (
            "Pixel diff execution stays client-side (Playwright snapshots / pixelmatch). "
            "When produced, attach diff PNGs using diffArtifactBasenameSuffix beside deterministic basenames "
            "listed in evidenceClosureReview_v1.expectedDeterministicPngBasenames."
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

    return {
        "format": "evidenceClosureReview_v1",
        "packageSemanticDigestSha256": package_semantic_digest_sha256,
        "expectedDeterministicPngBasenames": basenames_sorted,
        "primaryScreenshotArtifactCount": len(basenames_sorted),
        "correlationDigestConsistency": {
            "format": "correlationDigestConsistency_v1",
            "staleRowsRelativeToPackageDigest": stale_rows,
            "rowsMissingCorrelationDigest": missing_digest_rows,
            "isFullyConsistent": len(stale_rows) == 0 and len(missing_digest_rows) == 0,
        },
        "pixelDiffExpectation": pixel_diff_expectation_placeholder_v1(),
    }


def agent_evidence_closure_hints() -> dict[str, Any]:
    """Static guidance for agents; safe to attach on every evidence-package response."""

    return {
        "format": "agentEvidenceClosureHints_v1",
        "evidenceClosureReviewField": "evidenceClosureReview_v1",
        "pixelDiffExpectationNestedField": "pixelDiffExpectation",
        "deterministicPngBasenamesField": "expectedDeterministicPngBasenames",
        "playwrightEvidenceSpecRelPath": "packages/web/e2e/evidence-baselines.spec.ts",
        "suggestedRegenerationCommands": [
            (
                "cd app && ruff check bim_ai tests && "
                "pytest tests/test_evidence_package_digest.py tests/test_evidence_manifest_closure.py "
                "tests/test_plan_projection_and_evidence_slices.py"
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


_DIGEST_EXCLUDED_KEYS = frozenset({"generatedAt", "semanticDigestSha256"})


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
