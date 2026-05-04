"""Structured evidence-package manifest (Revit parity Phase A operational tracker)."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from urllib.parse import quote
from uuid import UUID

from bim_ai.document import Document
from bim_ai.elements import PlanViewElem, SheetElem, ViewpointElem


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
