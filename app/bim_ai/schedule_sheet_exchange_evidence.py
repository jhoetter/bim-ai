"""Deterministic schedule/sheet exchange evidence checks.

This module compares derived schedules, sheet/view references, sheet evidence
rows, and render bundle evidence back to the live model. It is intentionally
read-only and independent from the schedule derivation/parity modules so agents
can run it against stale evidence packets without mutating or regenerating them.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bim_ai.cost_quantity import MODEL_TAKEOFF_KINDS
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    ElevationViewElem,
    PlanViewElem,
    RoomElem,
    SavedViewElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    ViewpointElem,
    WindowElem,
)
from bim_ai.exp.render_export import build_export_bundle
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.schedule_pagination_placement_evidence import (
    flatten_leaf_rows_from_schedule_table_payload,
)
from bim_ai.sheet_preview_svg import (
    sheet_elem_to_svg,
    sheet_svg_utf8_sha256,
    viewport_evidence_hints_v1,
)

FORMAT_V1 = "scheduleSheetExchangeEvidence_v1"

SUPPORTED_SCHEDULE_CATEGORIES: frozenset[str] = frozenset(
    {
        "room",
        "door",
        "window",
        "material_assembly",
        "quantity_takeoff",
        "sheet",
        "view",
        "view_list",
        "viewlist",
        "plan_view",
        "planview",
        "section_cut",
        "sectioncut",
    }
)

REQUIRED_EXCHANGE_SCHEDULE_CATEGORIES: tuple[str, ...] = (
    "room",
    "door",
    "window",
    "material_assembly",
    "quantity_takeoff",
    "sheet",
    "view",
)

REQUIRED_RENDER_BUNDLE_FORMATS: tuple[str, ...] = (
    "metadata-only",
    "gltf-pbr",
    "ifc-bundle",
)


def _sha256_json(value: Any) -> str:
    body = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _finding(
    findings: list[dict[str, Any]],
    *,
    code: str,
    target: dict[str, Any],
    severity: str = "warning",
    detail: str = "",
) -> None:
    row = {"code": code, "severity": severity, "target": target}
    if detail:
        row["detail"] = detail
    findings.append(row)


def _explicit_schedule_category(sch: ScheduleElem) -> str | None:
    filt = dict(sch.filters or {})
    raw = filt.get("category") or filt.get("Category") or sch.category
    if raw is None:
        return None
    cat = str(raw).strip().lower()
    return cat or None


def _schedule_category(sch: ScheduleElem) -> str:
    explicit = _explicit_schedule_category(sch)
    if explicit:
        return explicit
    lowered = str(sch.name or "").strip().lower()
    if "quantity takeoff" in lowered or "takeoff" in lowered or "quantity" in lowered:
        return "quantity_takeoff"
    if "material" in lowered and ("assembl" in lowered or "quantit" in lowered):
        return "material_assembly"
    if "window" in lowered:
        return "window"
    if "door" in lowered:
        return "door"
    if "sheet" in lowered:
        return "sheet"
    if "view list" in lowered or lowered in {"views", "view schedule"}:
        return "view"
    if "room" in lowered or "finish" in lowered:
        return "room"
    return "room"


def _source_ids_for_category(doc: Document, category: str) -> list[str]:
    cat = category.lower()
    if cat == "room":
        ids = [e.id for e in doc.elements.values() if isinstance(e, RoomElem)]
    elif cat == "door":
        ids = [e.id for e in doc.elements.values() if isinstance(e, DoorElem)]
    elif cat == "window":
        ids = [e.id for e in doc.elements.values() if isinstance(e, WindowElem)]
    elif cat == "material_assembly":
        ids = [
            e.id
            for e in doc.elements.values()
            if getattr(e, "kind", None) in {"wall", "floor", "roof"}
        ]
    elif cat == "quantity_takeoff":
        ids = [e.id for e in doc.elements.values() if isinstance(e, MODEL_TAKEOFF_KINDS)]
    elif cat == "sheet":
        ids = [e.id for e in doc.elements.values() if isinstance(e, SheetElem)]
    elif cat in {"plan_view", "planview"}:
        ids = [e.id for e in doc.elements.values() if isinstance(e, PlanViewElem)]
    elif cat in {"section_cut", "sectioncut"}:
        ids = [e.id for e in doc.elements.values() if isinstance(e, SectionCutElem)]
    elif cat in {"view", "view_list", "viewlist"}:
        ids = [
            e.id
            for e in doc.elements.values()
            if isinstance(
                e,
                (
                    PlanViewElem,
                    SectionCutElem,
                    ElevationViewElem,
                    ViewpointElem,
                    SavedViewElem,
                ),
            )
        ]
    else:
        ids = []
    return sorted(str(x) for x in ids)


def _row_source_id(row: dict[str, Any], category: str) -> str:
    if category == "material_assembly":
        return str(row.get("hostElementId") or "").strip()
    return str(row.get("elementId") or row.get("rowId") or "").strip()


def _schedule_rows_by_id(evidence: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not isinstance(evidence, dict):
        return {}
    rows = evidence.get("schedules")
    if not isinstance(rows, list):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if isinstance(row, dict):
            sid = str(row.get("scheduleId") or "").strip()
            if sid:
                out[sid] = row
    return out


def _sheet_rows_by_id(rows: list[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in rows or []:
        if isinstance(row, dict):
            sid = str(row.get("sheetId") or "").strip()
            if sid:
                out[sid] = row
    return out


def _render_rows_by_format(evidence: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not isinstance(evidence, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in evidence.get("renderExports") or []:
        if isinstance(row, dict):
            fmt = str(row.get("format") or "").strip()
            if fmt:
                out[fmt] = row
    return out


def _documentation_parity_rows_by_scope(
    evidence: dict[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    if not isinstance(evidence, dict):
        return {}
    parity = evidence.get("documentationExportParity_v1")
    if not isinstance(parity, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in parity.get("rows") or []:
        if isinstance(row, dict):
            scope_id = str(row.get("scopeId") or "").strip()
            if scope_id:
                out[scope_id] = row
    return out


def _extract_deterministic_sheet_rows(
    *,
    evidence_packet: dict[str, Any] | None,
    deterministic_sheet_evidence: list[dict[str, Any]] | None,
    documentation_export_evidence: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if deterministic_sheet_evidence is not None:
        return deterministic_sheet_evidence
    if isinstance(evidence_packet, dict):
        for key in ("deterministicSheetEvidence", "deterministic_sheet_evidence"):
            rows = evidence_packet.get(key)
            if isinstance(rows, list):
                return [r for r in rows if isinstance(r, dict)]
    if isinstance(documentation_export_evidence, dict):
        rows = documentation_export_evidence.get("sheets")
        if isinstance(rows, list):
            return [r for r in rows if isinstance(r, dict)]
    return []


def _extract_documentation_export_evidence(
    *,
    evidence_packet: dict[str, Any] | None,
    documentation_export_evidence: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if isinstance(documentation_export_evidence, dict):
        return documentation_export_evidence
    if isinstance(evidence_packet, dict):
        if evidence_packet.get("format") == "documentationExportProductionEvidence_v1":
            return evidence_packet
        nested = evidence_packet.get("documentationExportProductionEvidence_v1")
        if isinstance(nested, dict):
            return nested
    return None


def _packet_revision(
    evidence_packet: dict[str, Any] | None,
    documentation_export_evidence: dict[str, Any] | None,
) -> int | None:
    for src in (evidence_packet, documentation_export_evidence):
        if not isinstance(src, dict):
            continue
        raw = src.get("revision") or src.get("modelRevision")
        try:
            return int(raw)
        except (TypeError, ValueError):
            continue
    return None


def _check_schedules(
    doc: Document,
    *,
    documentation_export_evidence: dict[str, Any] | None,
    findings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    docs_by_schedule = _schedule_rows_by_id(documentation_export_evidence)
    schedules = sorted(
        (e for e in doc.elements.values() if isinstance(e, ScheduleElem)),
        key=lambda s: s.id,
    )
    categories_present: dict[str, int] = {}
    checks: list[dict[str, Any]] = []

    for sch in schedules:
        category = _schedule_category(sch)
        categories_present[category] = categories_present.get(category, 0) + 1
        if category not in SUPPORTED_SCHEDULE_CATEGORIES:
            check = {
                "scheduleId": sch.id,
                "category": category,
                "status": "unsupported_schedule_category",
                "expectedModelRowCount": 0,
                "observedScheduleRowCount": 0,
                "missingModelRowIds": [],
                "unsupportedScheduleRowIds": [],
            }
            checks.append(check)
            _finding(
                findings,
                code="schedule_exchange_unsupported_category",
                target={"scheduleId": sch.id, "category": category},
                detail="Schedule category is not covered by schedule/sheet exchange evidence.",
            )
            continue

        expected_ids = _source_ids_for_category(doc, category)
        expected_set = set(expected_ids)
        try:
            payload = derive_schedule_table(doc, sch.id)
            leaf_rows = flatten_leaf_rows_from_schedule_table_payload(payload)
            payload_digest = _sha256_json(payload)
            derived = True
            derive_error = None
        except Exception as exc:  # noqa: BLE001 - evidence must expose derivation failures.
            payload = {}
            leaf_rows = []
            payload_digest = None
            derived = False
            derive_error = f"{type(exc).__name__}: {exc}"

        observed_ids = [_row_source_id(r, category) for r in leaf_rows]
        observed_nonempty = sorted({rid for rid in observed_ids if rid})
        missing_ids = sorted(expected_set.difference(observed_nonempty))
        unsupported_ids = sorted({rid for rid in observed_ids if rid and rid not in expected_set})
        missing_key_count = sum(1 for rid in observed_ids if not rid)

        doc_row = docs_by_schedule.get(sch.id)
        evidence_digest = str(doc_row.get("payloadDigestSha256") or "") if doc_row else ""
        evidence_status = "not_provided"
        if payload_digest and evidence_digest:
            evidence_status = "matched" if evidence_digest == payload_digest else "stale_digest"
            if evidence_status == "stale_digest":
                _finding(
                    findings,
                    code="schedule_payload_digest_stale",
                    target={"scheduleId": sch.id, "category": category},
                    detail="Documentation evidence schedule digest differs from current derivation.",
                )
        elif doc_row:
            evidence_status = "missing_digest"

        if not derived:
            status = "derive_failed"
            _finding(
                findings,
                code="schedule_derivation_failed",
                target={"scheduleId": sch.id, "category": category},
                severity="error",
                detail=derive_error or "",
            )
        elif missing_ids or unsupported_ids or missing_key_count:
            status = "row_mismatch"
            if missing_ids:
                _finding(
                    findings,
                    code="schedule_missing_model_rows",
                    target={"scheduleId": sch.id, "category": category, "elementIds": missing_ids},
                    detail="Model elements are absent from the derived schedule rows.",
                )
            if unsupported_ids or missing_key_count:
                _finding(
                    findings,
                    code="schedule_unsupported_rows",
                    target={
                        "scheduleId": sch.id,
                        "category": category,
                        "rowIds": unsupported_ids,
                        "missingRowKeyCount": missing_key_count,
                    },
                    detail="Schedule rows cannot be linked back to supported model element ids.",
                )
        else:
            status = "matched"

        checks.append(
            {
                "scheduleId": sch.id,
                "category": category,
                "status": status,
                "expectedModelRowCount": len(expected_ids),
                "observedScheduleRowCount": len(leaf_rows),
                "missingModelRowIds": missing_ids,
                "unsupportedScheduleRowIds": unsupported_ids,
                "missingRowKeyCount": missing_key_count,
                "payloadDigestSha256": payload_digest,
                "documentationEvidenceDigestSha256": evidence_digest or None,
                "documentationEvidenceStatus": evidence_status,
                "filterScoped": bool(
                    ((payload.get("scheduleEngine") or {}) if isinstance(payload, dict) else {}).get(
                        "filterEquals"
                    )
                    or ((payload.get("scheduleEngine") or {}) if isinstance(payload, dict) else {}).get(
                        "filterRules"
                    )
                ),
            }
        )

    for category in REQUIRED_EXCHANGE_SCHEDULE_CATEGORIES:
        expected_ids = _source_ids_for_category(doc, category)
        if not expected_ids or categories_present.get(category):
            continue
        checks.append(
            {
                "scheduleId": None,
                "category": category,
                "status": "missing_schedule",
                "expectedModelRowCount": len(expected_ids),
                "observedScheduleRowCount": 0,
                "missingModelRowIds": expected_ids,
                "unsupportedScheduleRowIds": [],
                "missingRowKeyCount": 0,
                "payloadDigestSha256": None,
                "documentationEvidenceDigestSha256": None,
                "documentationEvidenceStatus": "not_provided",
                "filterScoped": False,
            }
        )
        _finding(
            findings,
            code="exchange_schedule_missing",
            target={"category": category, "elementIds": expected_ids},
            detail="No schedule exists for a required exchange evidence category.",
        )

    checks.sort(key=lambda r: (str(r.get("category") or ""), str(r.get("scheduleId") or "")))
    return checks


def _parse_view_ref(raw: Any) -> tuple[str, str]:
    if not isinstance(raw, str) or ":" not in raw:
        return "unknown", ""
    kind, ref = raw.split(":", 1)
    return kind.strip().lower(), ref.strip()


def _resolves_view_ref(doc: Document, kind: str, ref_id: str) -> bool:
    element = doc.elements.get(ref_id)
    if kind in {"plan", "plan_view", "planview"}:
        return isinstance(element, PlanViewElem)
    if kind in {"section", "section_cut", "sectioncut"}:
        return isinstance(element, SectionCutElem)
    if kind in {"elevation", "elevation_view"}:
        return isinstance(element, ElevationViewElem)
    if kind == "viewpoint":
        return isinstance(element, ViewpointElem)
    if kind in {"saved_view", "savedview"}:
        return isinstance(element, SavedViewElem)
    if kind == "schedule":
        return isinstance(element, ScheduleElem)
    return False


def _viewport_scale_status(doc: Document, vp: dict[str, Any], kind: str, ref_id: str) -> str:
    if kind not in {"plan", "plan_view", "planview", "section", "section_cut", "sectioncut"}:
        return "not_applicable"
    if vp.get("scale") not in (None, "") or vp.get("scaleDenominator") not in (None, ""):
        return "explicit"
    element = doc.elements.get(ref_id)
    scale = getattr(element, "scale", None)
    if scale not in (None, ""):
        return "view"
    return "missing"


def _check_sheets(
    doc: Document,
    *,
    deterministic_sheet_rows: list[dict[str, Any]],
    semantic_digest_sha256: str | None,
    findings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows_by_sheet = _sheet_rows_by_id(deterministic_sheet_rows)
    checks: list[dict[str, Any]] = []
    for sh in sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id
    ):
        evidence = rows_by_sheet.get(sh.id)
        evidence_status = "matched"
        current_svg_digest = sheet_svg_utf8_sha256(sheet_elem_to_svg(doc, sh))
        evidence_svg_digest = None
        evidence_revision = None
        evidence_semantic_digest = None
        if not evidence:
            evidence_status = "missing_evidence_row"
            _finding(
                findings,
                code="sheet_evidence_row_missing",
                target={"sheetId": sh.id},
                detail="No deterministic sheet evidence row exists for this sheet.",
            )
        else:
            ingest = evidence.get("sheetPrintRasterIngest_v1")
            if isinstance(ingest, dict):
                evidence_svg_digest = ingest.get("svgContentSha256")
            correlation = evidence.get("correlation")
            if isinstance(correlation, dict):
                evidence_revision = correlation.get("modelRevision")
                evidence_semantic_digest = correlation.get("semanticDigestSha256")
            if evidence_revision is not None and int(evidence_revision) != int(doc.revision):
                evidence_status = "stale_revision"
                _finding(
                    findings,
                    code="sheet_evidence_revision_stale",
                    target={"sheetId": sh.id, "evidenceRevision": evidence_revision},
                    detail="Sheet evidence row was produced from a different model revision.",
                )
            if evidence_svg_digest and str(evidence_svg_digest) != current_svg_digest:
                evidence_status = "stale_digest"
                _finding(
                    findings,
                    code="sheet_svg_digest_stale",
                    target={"sheetId": sh.id},
                    detail="Sheet SVG digest differs from current sheet export.",
                )
            if (
                semantic_digest_sha256
                and evidence_semantic_digest
                and str(evidence_semantic_digest) != semantic_digest_sha256
            ):
                evidence_status = "stale_semantic_digest"
                _finding(
                    findings,
                    code="sheet_evidence_semantic_digest_stale",
                    target={"sheetId": sh.id},
                    detail="Sheet evidence semantic digest differs from the supplied evidence packet.",
                )

        expected_hints = viewport_evidence_hints_v1(doc, list(sh.viewports_mm or []))
        expected_hint_ids = {str(h.get("viewportId") or "") for h in expected_hints}
        evidence_hint_ids: set[str] = set()
        if evidence:
            evidence_hint_ids = {
                str(h.get("viewportId") or "")
                for h in (evidence.get("viewportEvidenceHints_v0") or [])
                if isinstance(h, dict)
            }

        viewport_checks: list[dict[str, Any]] = []
        for index, vp_any in enumerate(sh.viewports_mm or []):
            if not isinstance(vp_any, dict):
                continue
            viewport_id = str(vp_any.get("viewportId") or vp_any.get("viewport_id") or "")
            if not viewport_id:
                viewport_id = f"__implicit_{index}"
            kind, ref_id = _parse_view_ref(vp_any.get("viewRef") or vp_any.get("view_ref"))
            resolves = _resolves_view_ref(doc, kind, ref_id)
            scale_status = _viewport_scale_status(doc, vp_any, kind, ref_id)
            hint_status = (
                "matched"
                if viewport_id in evidence_hint_ids or not evidence
                else "missing_viewport_evidence"
            )
            if not resolves:
                _finding(
                    findings,
                    code="sheet_viewport_stale_view_ref",
                    target={"sheetId": sh.id, "viewportId": viewport_id, "viewRef": ref_id},
                    detail="Sheet viewport viewRef does not resolve to a live model element.",
                )
            if scale_status == "missing":
                _finding(
                    findings,
                    code="sheet_viewport_scale_missing",
                    target={"sheetId": sh.id, "viewportId": viewport_id, "viewRef": ref_id},
                    detail="Plan/section viewport has no explicit or view-derived scale.",
                )
            if hint_status == "missing_viewport_evidence":
                _finding(
                    findings,
                    code="sheet_viewport_evidence_missing",
                    target={"sheetId": sh.id, "viewportId": viewport_id},
                    detail="Deterministic sheet row lacks a viewport evidence hint for this viewport.",
                )
            viewport_checks.append(
                {
                    "viewportId": viewport_id,
                    "viewRefKind": kind,
                    "viewRefId": ref_id,
                    "resolvesViewRef": resolves,
                    "scaleStatus": scale_status,
                    "viewportEvidenceStatus": hint_status,
                }
            )

        missing_hint_ids = sorted(expected_hint_ids.difference(evidence_hint_ids)) if evidence else []
        checks.append(
            {
                "sheetId": sh.id,
                "sheetName": sh.name,
                "status": evidence_status,
                "viewportCount": len(viewport_checks),
                "currentSvgDigestSha256": current_svg_digest,
                "evidenceSvgDigestSha256": evidence_svg_digest,
                "evidenceModelRevision": evidence_revision,
                "evidenceSemanticDigestSha256": evidence_semantic_digest,
                "missingViewportEvidenceIds": missing_hint_ids,
                "viewports": viewport_checks,
            }
        )

    return checks


def _stable_render_bundle_summary(doc: Document, fmt: str) -> dict[str, Any]:
    elements_list = [elem.model_dump(by_alias=True) for elem in doc.elements.values()]
    bundle = build_export_bundle({"elements": elements_list}, fmt)  # type: ignore[arg-type]
    data = bundle.to_dict()
    data.pop("exportTimestamp", None)
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    return {
        "format": fmt,
        "primaryAsset": data.get("primaryAsset"),
        "cameraCount": len(metadata.get("cameras") or []),
        "materialCount": len(metadata.get("materials") or []),
        "missingMaterialAssetCount": len(metadata.get("missingMaterialAssets") or []),
        "stableBundleDigestSha256": _sha256_json(data),
    }


def _check_render_bundles(
    doc: Document,
    *,
    documentation_export_evidence: dict[str, Any] | None,
    findings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    evidence_by_format = _render_rows_by_format(documentation_export_evidence)
    checks: list[dict[str, Any]] = []
    for fmt in REQUIRED_RENDER_BUNDLE_FORMATS:
        summary = _stable_render_bundle_summary(doc, fmt)
        evidence = evidence_by_format.get(fmt)
        status = "matched"
        if not evidence:
            status = "missing_evidence_row"
            _finding(
                findings,
                code="render_bundle_evidence_missing",
                target={"format": fmt},
                detail="Documentation evidence lacks this render bundle row.",
            )
        else:
            if evidence.get("primaryAsset") != summary["primaryAsset"]:
                status = "stale_link"
            if int(evidence.get("cameraCount") or 0) != int(summary["cameraCount"]):
                status = "stale_link"
            if int(evidence.get("materialCount") or 0) != int(summary["materialCount"]):
                status = "stale_link"
            if status == "stale_link":
                _finding(
                    findings,
                    code="render_bundle_link_stale",
                    target={"format": fmt},
                    detail="Render bundle evidence no longer matches current camera/material summary.",
                )
        if summary["missingMaterialAssetCount"]:
            _finding(
                findings,
                code="render_bundle_missing_material_assets",
                target={
                    "format": fmt,
                    "missingMaterialAssetCount": summary["missingMaterialAssetCount"],
                },
                detail="Render bundle metadata reports material texture asset references that do not resolve.",
            )
        checks.append(
            {
                **summary,
                "status": status,
                "evidenceBundleDigestSha256": evidence.get("bundleDigestSha256") if evidence else None,
            }
        )
    return checks


def _expected_documentation_export_parity_scopes(doc: Document) -> list[str]:
    scopes: list[str] = []
    for sh in sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id
    ):
        scopes.extend([f"sheet:{sh.id}:pdf", f"sheet:{sh.id}:png", f"sheet:{sh.id}:svg"])
    scopes.extend(f"render:{fmt}" for fmt in REQUIRED_RENDER_BUNDLE_FORMATS)
    return sorted(scopes)


def _check_documentation_export_parity(
    doc: Document,
    *,
    documentation_export_evidence: dict[str, Any] | None,
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    expected_scopes = _expected_documentation_export_parity_scopes(doc)
    rows_by_scope = _documentation_parity_rows_by_scope(documentation_export_evidence)
    missing_scopes = [scope for scope in expected_scopes if scope not in rows_by_scope]
    failing_scopes = sorted(
        scope for scope, row in rows_by_scope.items() if row.get("status") == "fail"
    )
    warning_scopes = sorted(
        scope
        for scope, row in rows_by_scope.items()
        if row.get("status") == "warn" and scope in expected_scopes
    )

    if missing_scopes:
        _finding(
            findings,
            code="documentation_export_parity_row_missing",
            target={"scopeIds": missing_scopes},
            detail="Documentation export evidence lacks expected sheet/render parity rows.",
        )
    if failing_scopes:
        _finding(
            findings,
            code="documentation_export_parity_failed",
            target={"scopeIds": failing_scopes},
            severity="error",
            detail="Documentation export parity rows report failing digest or geometry evidence.",
        )

    status = "matched"
    if failing_scopes:
        status = "failed"
    elif missing_scopes:
        status = "missing_rows"
    elif warning_scopes:
        status = "matched_with_explicit_warnings"

    return {
        "format": "documentationExportParityCoverage_v1",
        "status": status,
        "ok": not missing_scopes and not failing_scopes,
        "expectedScopeCount": len(expected_scopes),
        "observedScopeCount": len([scope for scope in expected_scopes if scope in rows_by_scope]),
        "missingScopeIds": missing_scopes,
        "failingScopeIds": failing_scopes,
        "warningScopeIds": warning_scopes,
    }


def _manifest_coverage_summary(
    *,
    schedule_checks: list[dict[str, Any]],
    sheet_checks: list[dict[str, Any]],
    render_bundle_checks: list[dict[str, Any]],
    documentation_export_parity_check: dict[str, Any],
) -> dict[str, Any]:
    unsupported_schedules = [
        row
        for row in schedule_checks
        if row.get("status") == "unsupported_schedule_category"
    ]
    missing_schedules = [row for row in schedule_checks if row.get("status") == "missing_schedule"]
    schedule_row_mismatches = [row for row in schedule_checks if row.get("status") == "row_mismatch"]
    stale_schedule_digests = [
        row
        for row in schedule_checks
        if row.get("documentationEvidenceStatus") in {"stale_digest", "missing_digest"}
    ]
    sheet_gaps = [
        row
        for row in sheet_checks
        if row.get("status") != "matched" or row.get("missingViewportEvidenceIds")
    ]
    viewport_gaps = [
        vp
        for row in sheet_checks
        for vp in row.get("viewports", [])
        if isinstance(vp, dict)
        and (
            not vp.get("resolvesViewRef")
            or vp.get("scaleStatus") == "missing"
            or vp.get("viewportEvidenceStatus") == "missing_viewport_evidence"
        )
    ]
    render_gaps = [row for row in render_bundle_checks if row.get("status") != "matched"]
    documentation_export_parity_gaps = (
        [] if documentation_export_parity_check.get("ok") else [documentation_export_parity_check]
    )
    return {
        "format": "scheduleSheetManifestCoverage_v1",
        "ok": not (
            unsupported_schedules
            or missing_schedules
            or schedule_row_mismatches
            or stale_schedule_digests
            or sheet_gaps
            or viewport_gaps
            or render_gaps
            or documentation_export_parity_gaps
        ),
        "requiredScheduleCategories": list(REQUIRED_EXCHANGE_SCHEDULE_CATEGORIES),
        "supportedScheduleCategories": sorted(SUPPORTED_SCHEDULE_CATEGORIES),
        "unsupportedScheduleCategoryCount": len(unsupported_schedules),
        "missingRequiredScheduleCount": len(missing_schedules),
        "scheduleRowMismatchCount": len(schedule_row_mismatches),
        "staleScheduleDigestCount": len(stale_schedule_digests),
        "sheetEvidenceGapCount": len(sheet_gaps),
        "viewportCoverageGapCount": len(viewport_gaps),
        "renderBundleCoverageGapCount": len(render_gaps),
        "documentationExportParityGapCount": len(documentation_export_parity_gaps),
        "documentationExportParityWarningCount": len(
            documentation_export_parity_check.get("warningScopeIds") or []
        ),
        "unsupportedScheduleCategories": sorted(
            {
                str(row.get("category") or "")
                for row in unsupported_schedules
                if row.get("category")
            }
        ),
        "missingRequiredScheduleCategories": sorted(
            {str(row.get("category") or "") for row in missing_schedules if row.get("category")}
        ),
    }


def build_schedule_sheet_exchange_evidence_v1(
    doc: Document,
    *,
    evidence_packet: dict[str, Any] | None = None,
    deterministic_sheet_evidence: list[dict[str, Any]] | None = None,
    documentation_export_evidence: dict[str, Any] | None = None,
    semantic_digest_sha256: str | None = None,
) -> dict[str, Any]:
    """Build deterministic exchange checks for schedules, sheets, and render bundles."""

    doc_export_evidence = _extract_documentation_export_evidence(
        evidence_packet=evidence_packet,
        documentation_export_evidence=documentation_export_evidence,
    )
    sheet_rows = _extract_deterministic_sheet_rows(
        evidence_packet=evidence_packet,
        deterministic_sheet_evidence=deterministic_sheet_evidence,
        documentation_export_evidence=doc_export_evidence,
    )
    if semantic_digest_sha256 is None and isinstance(evidence_packet, dict):
        raw_digest = evidence_packet.get("semanticDigestSha256")
        if isinstance(raw_digest, str) and raw_digest:
            semantic_digest_sha256 = raw_digest

    findings: list[dict[str, Any]] = []
    packet_rev = _packet_revision(evidence_packet, doc_export_evidence)
    if packet_rev is not None and packet_rev != doc.revision:
        _finding(
            findings,
            code="evidence_packet_revision_stale",
            target={"currentRevision": doc.revision, "evidenceRevision": packet_rev},
            detail="Supplied evidence packet was produced from a different model revision.",
        )

    schedule_checks = _check_schedules(
        doc,
        documentation_export_evidence=doc_export_evidence,
        findings=findings,
    )
    sheet_checks = _check_sheets(
        doc,
        deterministic_sheet_rows=sheet_rows,
        semantic_digest_sha256=semantic_digest_sha256,
        findings=findings,
    )
    render_bundle_checks = _check_render_bundles(
        doc,
        documentation_export_evidence=doc_export_evidence,
        findings=findings,
    )
    documentation_export_parity_check = _check_documentation_export_parity(
        doc,
        documentation_export_evidence=doc_export_evidence,
        findings=findings,
    )
    manifest_coverage = _manifest_coverage_summary(
        schedule_checks=schedule_checks,
        sheet_checks=sheet_checks,
        render_bundle_checks=render_bundle_checks,
        documentation_export_parity_check=documentation_export_parity_check,
    )

    findings.sort(
        key=lambda r: (
            str(r.get("severity") or ""),
            str(r.get("code") or ""),
            _sha256_json(r.get("target") or {}),
        )
    )
    body: dict[str, Any] = {
        "format": FORMAT_V1,
        "revision": doc.revision,
        "status": "findings" if findings else "clean",
        "pass": not findings,
        "summary": {
            "scheduleCheckCount": len(schedule_checks),
            "sheetCheckCount": len(sheet_checks),
            "renderBundleCheckCount": len(render_bundle_checks),
            "findingCount": len(findings),
            "manifestCoverageOk": manifest_coverage["ok"],
        },
        "manifestCoverage": manifest_coverage,
        "scheduleChecks": schedule_checks,
        "sheetViewChecks": sheet_checks,
        "renderBundleChecks": render_bundle_checks,
        "documentationExportParityCheck": documentation_export_parity_check,
        "findings": findings,
    }
    body["exchangeEvidenceDigestSha256"] = _sha256_json(
        {
            "revision": body["revision"],
            "scheduleChecks": schedule_checks,
            "sheetViewChecks": sheet_checks,
            "renderBundleChecks": render_bundle_checks,
            "documentationExportParityCheck": documentation_export_parity_check,
            "manifestCoverage": manifest_coverage,
            "findings": findings,
        }
    )
    return body
