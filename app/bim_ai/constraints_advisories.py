from __future__ import annotations

import json
from typing import Any, Literal

# Imported lazily from the legacy constraints facade while constraints.py is being split.
# constraints.py defines Violation before importing this module.
from bim_ai.constraints import Violation  # noqa: E402
from bim_ai.document import Document
from bim_ai.elements import (
    AgentAssumptionElem,
    AgentDeviationElem,
    DoorElem,
    Element,
    PlanTagStyleElem,
    PlanViewElem,
    RoomElem,
    ValidationRuleElem,
    ViewTemplateElem,
    WallElem,
    WindowElem,
)
from bim_ai.export_gltf import (
    EXPORT_GEOMETRY_KINDS,
    GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND,
    GLTF_KNOWN_EXTENSION_TOKENS,
    build_visual_export_manifest,
    exchange_parity_manifest_fields_from_document,
)
from bim_ai.export_ifc import (
    IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS,
    ifc_kernel_geometry_skip_counts,
    ifcopenshell_available,
    kernel_export_eligible,
    summarize_kernel_ifc_semantic_roundtrip,
)
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload
from bim_ai.material_assembly_resolve import material_assembly_manifest_evidence


def _append_schedule_opening_qa_violations(
    wall_map: dict[str, WallElem],
    doors: list[DoorElem],
    windows: list[WindowElem],
    viols: list[Violation],
) -> None:
    """Deterministic schedule/documentation advisories for door and window rows (WP-V01 / WP-D01)."""

    def _opening_kind_label(op: DoorElem | WindowElem) -> Literal["door", "window"]:
        return "door" if isinstance(op, DoorElem) else "window"

    def _one(opening: DoorElem | WindowElem) -> None:
        kind = _opening_kind_label(opening)
        label = "Door" if kind == "door" else "Window"

        if not (opening.name or "").strip():
            viols.append(
                Violation(
                    rule_id="schedule_opening_identifier_missing",
                    severity="warning",
                    message=f"{label} has no mark/name for schedule identification.",
                    element_ids=[opening.id],
                )
            )

        fid = getattr(opening, "family_type_id", None)
        if fid is None or (isinstance(fid, str) and not fid.strip()):
            viols.append(
                Violation(
                    rule_id="schedule_opening_family_type_incomplete",
                    severity="warning",
                    message=f"{label} is missing familyTypeId (type schedule columns are incomplete).",
                    element_ids=[opening.id],
                )
            )

        host = wall_map.get(opening.wall_id)
        if host is None:
            return
        wt = host.wall_type_id
        if wt is None or (isinstance(wt, str) and not wt.strip()):
            viols.append(
                Violation(
                    rule_id="schedule_opening_host_wall_type_incomplete",
                    severity="warning",
                    message="Host wall has no wallTypeId (hostWallType schedule columns cannot resolve).",
                    element_ids=sorted({opening.id, host.id}),
                )
            )

    for d in sorted(doors, key=lambda x: x.id):
        _one(d)
    for w in sorted(windows, key=lambda x: x.id):
        _one(w)


def _validation_rules_any_cleanroom_ids(val_rules: list[ValidationRuleElem]) -> bool:
    keys = (
        "enforceCleanroomDoorFamilyTypes",
        "enforceCleanroomWindowFamilyTypes",
        "enforceCleanroomFamilyTypeLinkage",
        "enforceCleanroomCleanroomClass",
        "enforceCleanroomInterlockGrade",
        "enforceCleanroomOpeningFinishMaterial",
        "enforceCleanroomDoorPressureRating",
    )
    for v in val_rules:
        rj = getattr(v, "rule_json", None)
        if not isinstance(rj, dict):
            continue
        if any(bool(rj.get(k)) for k in keys):
            return True
    return False


def _elements_have_room_programme_metadata(elements: dict[str, Element]) -> bool:
    for el in elements.values():
        if not isinstance(el, RoomElem):
            continue
        for attr in ("programme_code", "department", "function_label", "finish_set"):
            raw = getattr(el, attr, None)
            if isinstance(raw, str) and raw.strip():
                return True
    return False


def _ids_authoritative_replay_map_pointer_suffix(summary: dict[str, Any]) -> str:
    cs = summary.get("commandSketch")
    if not isinstance(cs, dict):
        return ""
    auth = cs.get("authoritativeReplay_v0")
    if not isinstance(auth, dict) or auth.get("available") is not True:
        return ""
    ids_map = auth.get("idsAuthoritativeReplayMap_v0")
    if not isinstance(ids_map, dict):
        return ""
    spaces = ids_map.get("spaces")
    roofs = ids_map.get("roofs")
    floors = ids_map.get("floors")
    n_space = len(spaces) if isinstance(spaces, list) else 0
    n_roof = len(roofs) if isinstance(roofs, list) else 0
    n_floor = len(floors) if isinstance(floors, list) else 0
    return (
        " IDS linkage evidence: "
        f"{n_space} IfcSpace row(s), {n_roof} IfcRoof row(s), {n_floor} IfcSlab typed-floor row(s) under "
        "summarize_kernel_ifc_semantic_roundtrip."
        "commandSketch.authoritativeReplay_v0.idsAuthoritativeReplayMap_v0."
    )


def _agent_brief_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    """Deterministic agent-brief closure hints (discipline=agent); advisory severities."""

    assumption_ids = {eid for eid, el in elements.items() if isinstance(el, AgentAssumptionElem)}
    out: list[Violation] = []
    for _eid, el in sorted(elements.items(), key=lambda x: x[0]):
        if isinstance(el, AgentAssumptionElem) and el.closure_status == "open":
            out.append(
                Violation(
                    rule_id="agent_brief_assumption_unresolved",
                    severity="warning",
                    message="Agent assumption has closureStatus=open; resolve, accept, or defer.",
                    element_ids=[el.id],
                )
            )
        elif isinstance(el, AgentDeviationElem):
            if not el.acknowledged:
                out.append(
                    Violation(
                        rule_id="agent_brief_deviation_unacknowledged",
                        severity="warning",
                        message="Agent deviation is not acknowledged.",
                        element_ids=[el.id],
                    )
                )
            rid = el.related_assumption_id
            if rid is not None and rid.strip() and rid not in assumption_ids:
                out.append(
                    Violation(
                        rule_id="agent_brief_assumption_reference_broken",
                        severity="warning",
                        message=f"Deviation references missing assumption id {rid!r}.",
                        element_ids=[el.id],
                    )
                )
    return out


def _exchange_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    out: list[Violation] = []
    try:
        doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
    except Exception:
        return []

    parity_keys = (
        "elementCount",
        "countsByKind",
        "exportedGeometryKinds",
        "unsupportedDocumentKindsDetailed",
    )

    try:
        ifc_row = build_ifc_exchange_manifest_payload(doc)
        gltf_ext = build_visual_export_manifest(doc)["extensions"]["BIM_AI_exportManifest_v0"]
    except Exception:
        # Exchange advisories must not mask primary constraint errors, for example
        # zero-length walls that exporter libraries cannot serialize.
        return out

    ifc_slice = {k: ifc_row[k] for k in parity_keys if k in ifc_row}

    gltf_slice = {k: gltf_ext[k] for k in parity_keys if k in gltf_ext}

    if json.dumps(ifc_slice, sort_keys=True) != json.dumps(gltf_slice, sort_keys=True):
        out.append(
            Violation(
                rule_id="exchange_manifest_ifc_gltf_slice_mismatch",
                severity="warning",
                message="IFC exchange manifest parity slice differs from glTF export manifest (investigate exporter drift).",
                element_ids=[],
            )
        )

    parity = exchange_parity_manifest_fields_from_document(doc)

    cbk = parity.get("countsByKind") or {}

    missing: list[str] = []

    for k in sorted(EXPORT_GEOMETRY_KINDS):
        if cbk.get(k, 0) > 0 and k not in IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS:
            missing.append(f"{k}:{cbk[k]}")

    if missing:
        out.append(
            Violation(
                rule_id="exchange_ifc_unhandled_geometry_present",
                severity="info",
                message=(
                    "IFC kernel exporter does not emit physical products for some present geometry kinds: "
                    + ", ".join(missing)
                    + "."
                ),
                element_ids=[],
            )
        )

    skip_map = ifc_kernel_geometry_skip_counts(doc)
    if kernel_export_eligible(doc) and any(skip_map.values()):
        parts = [f"{k}:{v}" for k, v in sorted(skip_map.items()) if v]
        out.append(
            Violation(
                rule_id="exchange_ifc_kernel_geometry_skip_summary",
                severity="info",
                message=(
                    "IFC kernel export skips some instances (see ifcKernelGeometrySkippedCounts on "
                    "ifc-manifest / evidence slice): " + ", ".join(parts) + "."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    val_rules = [vr for vr in elements.values() if isinstance(vr, ValidationRuleElem)]
    gate_roundtrip = (
        ifcopenshell_available()
        and kernel_export_eligible(doc)
        and (
            any(skip_map.values())
            or _elements_have_room_programme_metadata(elements)
            or _validation_rules_any_cleanroom_ids(val_rules)
        )
    )
    if gate_roundtrip:
        summary = summarize_kernel_ifc_semantic_roundtrip(doc)
        ids_ptr = _ids_authoritative_replay_map_pointer_suffix(summary)
        rtc = summary.get("roundtripChecks")
        if isinstance(rtc, dict):
            if not rtc.get("allProductCountsMatch", True):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_roundtrip_count_mismatch",
                        severity="warning",
                        message=(
                            "Exported IFC product counts differ from kernel-expected emits "
                            "(summarize_kernel_ifc_semantic_roundtrip.roundtripChecks.productCounts)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            if not rtc.get("allProgrammeFieldsMatch", True):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_roundtrip_programme_mismatch",
                        severity="info",
                        message=(
                            "IFC read-back programme field counts differ from emit-able room programme metadata "
                            "(summarize_kernel_ifc_semantic_roundtrip.roundtripChecks.programmeFields)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            if _validation_rules_any_cleanroom_ids(val_rules) and not rtc.get(
                "allIdentityReferencesMatch", True
            ):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_ids_identity_pset_gap",
                        severity="info",
                        message=(
                            "Cleanroom IDS validation is active but IFC read-back shows incomplete "
                            "Pset_*Common Reference coverage on some emitted products." + ids_ptr
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            if _validation_rules_any_cleanroom_ids(val_rules) and not rtc.get(
                "allQtoLinksMatch", True
            ):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_ids_qto_gap",
                        severity="info",
                        message=(
                            "Cleanroom IDS validation is active but IFC read-back shows incomplete "
                            "Qto_* base-quantity linkage on some emitted products "
                            "(summarize_kernel_ifc_semantic_roundtrip.roundtripChecks.qtoCoverage)."
                            + ids_ptr
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            mlr = rtc.get("materialLayerReadback")
            if (
                isinstance(mlr, dict)
                and not mlr.get("allMatched", True)
                and material_assembly_manifest_evidence(doc) is not None
            ):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_material_layer_readback_mismatch",
                        severity="info",
                        message=(
                            "IFC layer stack read-back does not align with documented material assemblies "
                            "for some kernel emits (inspect_kernel_ifc_semantics.materialLayerSetReadback_v0; "
                            "ifc_manifest_v0.ifcMaterialLayerSetReadbackEvidence_v0)." + ids_ptr
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

    if ifcopenshell_available() and kernel_export_eligible(doc):
        # ifc_row is already computed above; reuse cached values instead of re-exporting.
        preview = ifc_row.get("ifcImportPreview_v0") or {}
        merge_map = ifc_row.get("ifcUnsupportedMergeMap_v0") or {}

        if preview.get("available"):
            unresolved_count = int(preview.get("unresolvedReferenceCount") or 0)
            if unresolved_count > 0:
                out.append(
                    Violation(
                        rule_id="exchange_ifc_import_preview_extraction_gaps",
                        severity="info",
                        message=(
                            f"IFC import preview detected {unresolved_count} extraction gap(s) "
                            "(unresolved product references or unreadable geometry; see "
                            "ifc_manifest_v0.ifcImportPreview_v0.unresolvedReferences)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

            unsupported_classes = dict(merge_map.get("unsupportedIfcProductsByClass") or {})
            unsupported_total = sum(unsupported_classes.values())
            if unsupported_total > 0:
                class_summary = ", ".join(
                    f"{cls}:{n}" for cls, n in sorted(unsupported_classes.items())
                )
                out.append(
                    Violation(
                        rule_id="exchange_ifc_import_preview_unsupported_products",
                        severity="info",
                        message=(
                            f"IFC import preview found {unsupported_total} product(s) outside the kernel "
                            "replay slice (not replay targets): "
                            + class_summary
                            + " (ifc_manifest_v0.ifcUnsupportedMergeMap_v0.unsupportedIfcProductsByClass)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

            ids_cov = preview.get("idsPointerCoverage") or {}
            if ids_cov.get("available"):
                spaces_cov = ids_cov.get("spaces") or {}
                floors_cov = ids_cov.get("floors") or {}
                space_rows = int(spaces_cov.get("rows") or 0)
                space_qto = int(spaces_cov.get("withQtoSpaceBaseQuantitiesLinked") or 0)
                floor_rows = int(floors_cov.get("rows") or 0)
                floor_qto = int(floors_cov.get("withQtoSlabBaseQuantitiesLinked") or 0)
                ids_gap = (space_rows > 0 and space_qto < space_rows) or (
                    floor_rows > 0 and floor_qto < floor_rows
                )
                if ids_gap and _validation_rules_any_cleanroom_ids(val_rules):
                    out.append(
                        Violation(
                            rule_id="exchange_ifc_import_preview_ids_pointer_gap",
                            severity="info",
                            message=(
                                "Cleanroom IDS validation is active but IFC import preview shows incomplete "
                                "Qto_* linkage for some authoritative replay rows "
                                "(ifc_manifest_v0.ifcImportPreview_v0.idsPointerCoverage)."
                            ),
                            element_ids=[],
                            discipline="exchange",
                        )
                    )

            id_collision_classes = dict(preview.get("idCollisionClasses") or {})
            if id_collision_classes:
                collision_summary = ", ".join(
                    f"{kind}:{count}" for kind, count in sorted(id_collision_classes.items())
                )
                out.append(
                    Violation(
                        rule_id="exchange_ifc_import_preview_id_collision",
                        severity="warning",
                        message=(
                            "IFC import preview detected duplicate replay IDs within the STEP file "
                            f"({collision_summary}). Resolve duplicate Pset_*Common.Reference values "
                            "before applying the authoritative replay "
                            "(ifc_manifest_v0.ifcImportPreview_v0.idCollisionClasses)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

    # Cross-manifest closure alignment advisory rules — surface manifest drift.
    closure = ifc_row.get("ifcExchangeManifestClosure_v0") or {}

    auth_token = str(closure.get("authoritativeProductsAlignmentToken") or "")
    if auth_token and auth_token not in ("aligned", "unavailable_offline", ""):
        out.append(
            Violation(
                rule_id="exchange_ifc_manifest_authoritative_alignment_drift",
                severity="warning",
                message=(
                    f"IFC exchange manifest closure: authoritative product alignment drifted "
                    f"({auth_token}). The IDS replay map coverage does not match the import "
                    "preview's authoritativeProducts slice "
                    "(ifcExchangeManifestClosure_v0.authoritativeProductsAlignmentToken)."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    unsupported_token = str(closure.get("unsupportedClassAlignmentToken") or "")
    if unsupported_token and unsupported_token not in ("aligned", "unavailable_offline", ""):
        out.append(
            Violation(
                rule_id="exchange_ifc_manifest_unsupported_alignment_drift",
                severity="warning",
                message=(
                    f"IFC exchange manifest closure: unsupported class alignment drifted "
                    f"({unsupported_token}). The unsupported product class sets in the import "
                    "preview and merge map disagree "
                    "(ifcExchangeManifestClosure_v0.unsupportedClassAlignmentToken)."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    ids_token = str(closure.get("idsPointerCoverageAlignmentToken") or "")
    if ids_token and ids_token not in ("aligned", "unavailable_offline", ""):
        out.append(
            Violation(
                rule_id="exchange_ifc_manifest_ids_pointer_alignment_drift",
                severity="info",
                message=(
                    f"IFC exchange manifest closure: IDS pointer coverage drifted "
                    f"({ids_token}). Some authoritative product rows lack complete QTO/identity "
                    "IDS linkage across the manifest surfaces "
                    "(ifcExchangeManifestClosure_v0.idsPointerCoverageAlignmentToken)."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    # IDS adviser: per-product-kind QTO and Pset gap rules derived from coverage evidence rows.
    ps_cov = ifc_row.get("ifcPropertySetCoverageEvidence_v0") or {}
    if isinstance(ps_cov, dict) and ps_cov.get("available"):
        cov_rows = list(ps_cov.get("rows") or [])

        _qto_missing_token = "missing_qto_link"
        _pset_critical_tokens = {
            "missing_Pset_Reference",
            "site_reference_join_mismatch",
            "reference_not_in_document",
        }

        stair_qto_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "stair"
            and str(r.get("idsGapReasonToken") or "") == _qto_missing_token
        )
        if stair_qto_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_qto_stair_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {stair_qto_gaps} stair product(s) missing "
                        "Qto_StairBaseQuantities linkage "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=stair, missing_qto_link)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

        room_qto_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "room"
            and str(r.get("idsGapReasonToken") or "") == _qto_missing_token
        )
        if room_qto_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_qto_room_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {room_qto_gaps} room/space product(s) missing "
                        "Qto_SpaceBaseQuantities linkage "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=room, missing_qto_link)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

        floor_pset_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "floor"
            and str(r.get("idsGapReasonToken") or "") in _pset_critical_tokens
        )
        if floor_pset_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_pset_floor_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {floor_pset_gaps} floor/slab product(s) with incomplete "
                        "Pset_SlabCommon identity fields "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=floor)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

        roof_pset_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "roof"
            and str(r.get("idsGapReasonToken") or "") in _pset_critical_tokens
        )
        if roof_pset_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_pset_roof_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {roof_pset_gaps} roof product(s) with incomplete "
                        "Pset_RoofCommon identity fields "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=roof)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

    return out


def _gltf_manifest_closure_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    """Advisory violations derived from gltfExportManifestClosure_v1 presence matrix."""
    out: list[Violation] = []
    try:
        doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
    except Exception:
        return []
    try:
        gltf_ext = build_visual_export_manifest(doc)["extensions"]["BIM_AI_exportManifest_v0"]
    except Exception:
        return []

    closure = gltf_ext.get("gltfExportManifestClosure_v1")
    if not isinstance(closure, dict):
        return out

    counts_by_kind: dict[str, int] = gltf_ext.get("countsByKind") or {}

    for entry in closure.get("extensionPresenceMatrix") or []:
        token = entry.get("token", "")
        if entry.get("status") == "skipped_ineligible":
            eligible_kind = GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND.get(token)
            if eligible_kind and counts_by_kind.get(eligible_kind, 0) > 0:
                skip_code = entry.get("skipReasonCode") or "unknown"
                out.append(
                    Violation(
                        rule_id="gltf_export_manifest_expected_extension_missing",
                        severity="info",
                        message=(
                            f"glTF export manifest: extension {token!r} not emitted "
                            f"but eligible element kind {eligible_kind!r} is present "
                            f"(skipReasonCode={skip_code!r})."
                        ),
                        element_ids=[],
                    )
                )

    emitted_tokens: list[str] = closure.get("extensionTokens") or []
    emitted_set = set(emitted_tokens)
    canonical_order = [t for t in GLTF_KNOWN_EXTENSION_TOKENS if t in emitted_set]
    if emitted_tokens != canonical_order:
        out.append(
            Violation(
                rule_id="gltf_export_manifest_extension_order_drift",
                severity="warning",
                message=(
                    "glTF export manifest: extension token order in closure differs from canonical. "
                    f"Emitted order: {emitted_tokens!r}. "
                    f"Canonical order: {canonical_order!r}."
                ),
                element_ids=[],
            )
        )

    return out


def _plan_view_tag_style_advisor_violations(elements: dict[str, Element]) -> list[Violation]:
    """Advisor rules for plan tag style matrix gaps (WP-C01/C02/V01).

    Emits violations when:
    - A plan view or template holds a tag-style ref that is missing or has the wrong tagTarget.
    - A plan view has opening tags / room labels active but both plan and template lack an explicit
      style (pure builtin fallback — advisory, not blocking).
    - A plan view explicitly overrides the tag style set by its template (informational).
    """
    out: list[Violation] = []

    plan_views = [e for e in elements.values() if isinstance(e, PlanViewElem)]
    view_templates = {e.id: e for e in elements.values() if isinstance(e, ViewTemplateElem)}

    def _resolve_tmpl(pv: PlanViewElem) -> ViewTemplateElem | None:
        if pv.view_template_id:
            return view_templates.get(pv.view_template_id)
        return None

    def _tag_style_elem(ref: str | None) -> PlanTagStyleElem | None:
        if not ref:
            return None
        el = elements.get(ref)
        return el if isinstance(el, PlanTagStyleElem) else None

    def _ref_missing_or_wrong(ref: str | None, expected_target: str) -> str | None:
        if not ref:
            return None
        el = elements.get(ref)
        if el is None:
            return "missing"
        if not isinstance(el, PlanTagStyleElem):
            return "wrong_kind"
        if el.tag_target != expected_target:
            return "wrong_target"
        return None

    # View template refs
    for tmpl in view_templates.values():
        for lane, ref in (
            ("opening", tmpl.default_plan_opening_tag_style_id),
            ("room", tmpl.default_plan_room_tag_style_id),
        ):
            reason = _ref_missing_or_wrong(ref, lane)
            if reason == "wrong_target":
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_target_mismatch",
                        severity="warning",
                        message=(
                            f"View template '{tmpl.name}' default{lane.capitalize()}TagStyleId "
                            f"'{ref}' targets the wrong tag lane; effective style falls back to builtin."
                        ),
                        element_ids=[tmpl.id],
                    )
                )
            elif reason in ("missing", "wrong_kind"):
                out.append(
                    Violation(
                        rule_id="plan_template_tag_style_ref_invalid",
                        severity="warning",
                        message=(
                            f"View template '{tmpl.name}' default{lane.capitalize()}TagStyleId "
                            f"'{ref}' does not resolve to a plan_tag_style element ({reason}); "
                            "effective style falls back to builtin."
                        ),
                        element_ids=[tmpl.id],
                    )
                )

    # Plan view refs and matrix advisory
    for pv in sorted(plan_views, key=lambda x: x.id):
        tmpl = _resolve_tmpl(pv)

        for lane, pv_ref, tmpl_default_ref in (
            (
                "opening",
                pv.plan_opening_tag_style_id,
                tmpl.default_plan_opening_tag_style_id if tmpl else None,
            ),
            (
                "room",
                pv.plan_room_tag_style_id,
                tmpl.default_plan_room_tag_style_id if tmpl else None,
            ),
        ):
            # Plan-view explicit ref that is invalid
            reason = _ref_missing_or_wrong(pv_ref, lane)
            if reason == "wrong_target":
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_target_mismatch",
                        severity="warning",
                        message=(
                            f"Plan view '{pv.name}' plan{lane.capitalize()}TagStyleId "
                            f"'{pv_ref}' targets the wrong tag lane; effective style falls back to builtin."
                        ),
                        element_ids=[pv.id],
                    )
                )
            elif reason in ("missing", "wrong_kind"):
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_ref_invalid",
                        severity="warning",
                        message=(
                            f"Plan view '{pv.name}' plan{lane.capitalize()}TagStyleId "
                            f"'{pv_ref}' does not resolve to a plan_tag_style element ({reason}); "
                            "effective style falls back to builtin."
                        ),
                        element_ids=[pv.id],
                    )
                )

            # Advisory: plan view overrides template default tag style with a different valid style
            if (
                pv_ref
                and tmpl_default_ref
                and pv_ref != tmpl_default_ref
                and reason is None
                and _ref_missing_or_wrong(tmpl_default_ref, lane) is None
            ):
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_override",
                        severity="info",
                        message=(
                            f"Plan view '{pv.name}' overrides its template's default "
                            f"{lane} tag style (template: '{tmpl_default_ref}', "
                            f"plan override: '{pv_ref}')."
                        ),
                        element_ids=[pv.id],
                    )
                )

        # Advisory: tags active but purely falling back to builtin (no style configured anywhere)
        opening_tags_on = (
            pv.plan_show_opening_tags
            if pv.plan_show_opening_tags is not None
            else (tmpl.plan_show_opening_tags if tmpl else False)
        )
        room_labels_on = (
            pv.plan_show_room_labels
            if pv.plan_show_room_labels is not None
            else (tmpl.plan_show_room_labels if tmpl else False)
        )

        for lane, tags_on, pv_ref_attr, tmpl_ref_attr in (
            (
                "opening",
                opening_tags_on,
                pv.plan_opening_tag_style_id,
                tmpl.default_plan_opening_tag_style_id if tmpl else None,
            ),
            (
                "room",
                room_labels_on,
                pv.plan_room_tag_style_id,
                tmpl.default_plan_room_tag_style_id if tmpl else None,
            ),
        ):
            if not tags_on:
                continue
            has_valid_pv_ref = (
                bool(pv_ref_attr) and _ref_missing_or_wrong(pv_ref_attr, lane) is None
            )
            has_valid_tmpl_ref = (
                bool(tmpl_ref_attr) and _ref_missing_or_wrong(tmpl_ref_attr, lane) is None
            )
            if not has_valid_pv_ref and not has_valid_tmpl_ref:
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_fallback",
                        severity="info",
                        message=(
                            f"Plan view '{pv.name}' has {lane} tags visible but no custom tag style "
                            "is configured on the plan view or its template; the builtin fallback "
                            "style is active. Assign a plan_tag_style for consistent labelling."
                        ),
                        element_ids=[pv.id],
                    )
                )

    out.sort(key=lambda v: (v.rule_id, tuple(sorted(v.element_ids)), v.severity))
    return out
