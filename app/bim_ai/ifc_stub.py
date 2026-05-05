"""IFC STEP skeleton + manifest fields (kernel export lives in `export_ifc.py`)."""


from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.export_gltf import (
    exchange_parity_manifest_fields,
    exchange_parity_manifest_fields_from_document,
)
from bim_ai.export_ifc import (
    IFC_ENCODING_KERNEL_V1,
    build_ifc_import_preview_v0,
    build_ifc_unsupported_merge_map_v0,
    build_site_exchange_evidence_v0_for_manifest,
    ifc_manifest_artifact_hints,
    kernel_expected_ifc_emit_counts,
    kernel_export_eligible,
)
from bim_ai.material_assembly_resolve import (
    material_assembly_manifest_evidence,
    material_catalog_audit_evidence_v0,
)

IFC_ENCODING_EMPTY_SHELL = "bim_ai_ifc_empty_shell_v0"

IFC_SEMANTIC_IMPORT_SCOPE_V0: dict[str, Any] = {
    "schemaVersion": 0,
    "semanticReadBackSupported": [
        "IfcBuildingStorey counts and elevationsPresent",
        "IfcWall, IfcSlab, IfcRoof, IfcStair, IfcSpace product counts",
        "IfcOpeningElement, IfcDoor, IfcWindow counts",
        "Pset_*Common Reference identity coverage (wall, slab, space, door, window, roof, stair, site)",
        "Pset_SpaceCommon programme string fields",
        "IfcElementQuantity Qto_* template names",
        "inspect_kernel_ifc_semantics.qtoLinkedProducts — per-product Qto_* linkage counts",
        "inspect_kernel_ifc_semantics.importScopeUnsupportedIfcProducts_v0 — IfcProduct classes outside kernel slice roots",
        "inspect_kernel_ifc_semantics.siteExchangeEvidence_v0 — kernel SiteElem ↔ IfcSite counts + Pset_SiteCommon.Reference joined ids",
        "inspect_kernel_ifc_semantics.materialLayerSetReadback_v0 — IfcMaterialLayerSet read-back vs document layer stacks for IfcWall / IfcSlab / IfcRoof (when kernel export eligible)",
        "inspect_kernel_ifc_semantics.propertySetCoverageEvidence_v0 — per-product IFC pset/QTO/material gap tokens aligned with IDS/cleanroom read-back",
        "ifc_manifest_v0.siteExchangeEvidence_v0 — document-only kernel site participation when IFC export not eligible",
        "ifc_manifest_v0.ifcMaterialLayerSetReadbackEvidence_v0 — re-export STEP + same read-back slice for exchange manifest (when IfcOpenShell + kernel export eligible)",
        "ifc_manifest_v0.ifcPropertySetCoverageEvidence_v0 — re-export STEP + same coverage row grid for exchange manifest",
        "Kernel geometry skip map from Document",
        "summarize_kernel_ifc_semantic_roundtrip export→re-parse deltas (identityCoverage, qtoCoverage, materialLayerReadback summary, propertySetCoverage summary)",
        "summarize_kernel_ifc_semantic_roundtrip.commandSketch — level echo, storeys read-back, QTO names, programme samples",
        "summarize_kernel_ifc_semantic_roundtrip.commandSketch.authoritativeReplay_v0 — kernel IFC re-parse → deterministic createLevel/createFloor/createWall/createRoof (IfcRoof prism, identity Pset_RoofCommon.Reference, inferred slopeDeg/overhangMm/mass_box from exporter-aligned placement) /createStair (IfcStair, identity Pset_StairCommon.Reference, top storey from elevation + body height when unique) / createRoomOutline (IfcSpace) + wall-hosted insertDoorOnWall/insertWindowOnWall + slab-hosted createSlabOpening (IfcOpeningElement voids on IfcSlab, op:<id> names); authoritativeSubset.roofs + kernelRoofSkippedNoReference; IfcSlabType + Pset_SlabCommon type Reference when floorTypeId set; typedFloorAuthoritativeReplayEvidence_v0; slabRoofHostedVoidReplaySkipped_v0 skip ledger; idsAuthoritativeReplayMap_v0 spaces + roofs + floors IDS linkage, unsupportedIfcProducts_v0 vs replay distinction",
        "engine.try_apply_kernel_ifc_authoritative_replay_v0 — additive apply of authoritativeReplay_v0 commands via try_commit_bundle (preflight merge_id_collision / merge_reference_unresolved)",
        "build_ifc_import_preview_v0 — deterministic IFC import preview: commandCountsByKind, unresolvedReferences (extractionGaps), idCollisionClasses (command kinds with duplicate replay IDs in the STEP file), skipCountsByReason, authoritativeProducts subset map, unsupportedProducts countsByClass, idsPointerCoverage (spaces/roofs/floors QTO+identity rows), safeApplyClassification (authoritativeSliceSafeApply + notApplyReasons); stable across repeated runs",
        "build_ifc_unsupported_merge_map_v0 — unsupported IFC merge map: unsupportedIfcProductsByClass (products outside kernel slice), extractionGapsByReason (reasons kernel failed to extract command from supported product), mergeConstraints (permanent architectural limits); offline-safe mergeConstraints always present",
        "ifc_manifest_v0.ifcImportPreview_v0 — same schema as build_ifc_import_preview_v0 (requires IfcOpenShell + kernel export eligible); offline stub sets available=False + reason",
        "ifc_manifest_v0.ifcUnsupportedMergeMap_v0 — same schema as build_ifc_unsupported_merge_map_v0 (mergeConstraints always present; full map requires IfcOpenShell + kernel export eligible)",
    ],
    "importMergeUnsupported": [
        "IFC ingest → Document merge / replay for arbitrary IFC entity graphs",
        "Full IDS fixture exchange matrix beyond authoring-side rules + semantic inspector",
        "Boolean regeneration from IFC openings vs kernel proxies",
        "engine.try_apply_kernel_ifc_authoritative_replay_v0 — full populated-document arbitrary IFC merge (v0 is kernel authoritative bundle + preflight only)",
    ],
}


def minimal_empty_ifc_skeleton() -> str:
    """Valid minimal SPFF hull (no misplaced entity references)."""

    return (
        "ISO-10303-21;\n"
        "HEADER;\n"
        "FILE_DESCRIPTION(('bim-ai placeholder'),'2;1');\n"
        "FILE_NAME('bim-ai.ifc','',('bim-ai'),('bim-ai'),'bim-ai exporter','bim-ai','');\n"
        "FILE_SCHEMA(('IFC4'));\n"
        "ENDSEC;\n"
        "DATA;\n"
        "ENDSEC;\n"
        "END-ISO-10303-21;\n"
    )


def build_ifc_material_layer_set_readback_evidence_v0(doc: Document) -> dict[str, Any] | None:
    """Re-parse exported STEP for material layer read-back (lazy import avoids export cycle at load)."""

    from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step  # noqa: PLC0415
    from bim_ai.ifc_material_layer_exchange_v0 import (  # noqa: PLC0415
        kernel_ifc_material_layer_set_readback_v0,
    )

    if not IFC_AVAILABLE or not kernel_export_eligible(doc):
        return None

    try:
        import ifcopenshell  # noqa: PLC0415
    except ImportError:
        return None

    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    rb = kernel_ifc_material_layer_set_readback_v0(model, doc)
    return {
        "format": "ifcMaterialLayerSetReadbackEvidence_v0",
        **rb,
        "inspectPointer": (
            "inspect_kernel_ifc_semantics.materialLayerSetReadback_v0 — same schema as this manifest slice."
        ),
    }


def build_ifc_property_set_coverage_evidence_v0(doc: Document) -> dict[str, Any] | None:
    """Re-parse exported STEP for per-product pset/QTO coverage slice (lazy import)."""

    from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step  # noqa: PLC0415
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (  # noqa: PLC0415
        build_kernel_ifc_property_set_coverage_evidence_v0,
    )

    if not IFC_AVAILABLE or not kernel_export_eligible(doc):
        return None

    try:
        import ifcopenshell  # noqa: PLC0415
    except ImportError:
        return None

    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    ev = build_kernel_ifc_property_set_coverage_evidence_v0(model, doc)
    return {
        "format": "ifcPropertySetCoverageEvidence_v0",
        **ev,
        "inspectPointer": (
            "inspect_kernel_ifc_semantics.propertySetCoverageEvidence_v0 — same schema as this manifest slice."
        ),
    }


def build_ifc_import_preview_v0_for_manifest(doc: Document) -> dict[str, Any]:
    """IFC import preview slice for manifest (offline stub when IfcOpenShell absent or not eligible)."""

    from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step  # noqa: PLC0415

    if not IFC_AVAILABLE:
        return {
            "schemaVersion": 0,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "commandCountsByKind": {},
            "commandCountTotal": 0,
            "unresolvedReferences": [],
            "unresolvedReferenceCount": 0,
            "idCollisionClasses": {},
            "skipCountsByReason": {},
            "authoritativeProducts": {},
            "unsupportedProducts": {"schemaVersion": 0, "countsByClass": {}},
            "idsPointerCoverage": {"schemaVersion": 0, "available": False},
            "safeApplyClassification": {
                "authoritativeSliceSafeApply": False,
                "notApplyReasons": ["ifcopenshell_not_installed"],
                "note": "IfcOpenShell is not installed; install '.[ifc]' to enable preview.",
            },
        }

    if not kernel_export_eligible(doc):
        return {
            "schemaVersion": 0,
            "available": False,
            "reason": "kernel_not_eligible",
            "commandCountsByKind": {},
            "commandCountTotal": 0,
            "unresolvedReferences": [],
            "unresolvedReferenceCount": 0,
            "idCollisionClasses": {},
            "skipCountsByReason": {},
            "authoritativeProducts": {},
            "unsupportedProducts": {"schemaVersion": 0, "countsByClass": {}},
            "idsPointerCoverage": {"schemaVersion": 0, "available": False},
            "safeApplyClassification": {
                "authoritativeSliceSafeApply": False,
                "notApplyReasons": ["kernel_not_eligible"],
                "note": "Document has no kernel IFC geometry (no walls or slab floors).",
            },
        }

    step = export_ifc_model_step(doc)
    return build_ifc_import_preview_v0(step)


def build_ifc_unsupported_merge_map_v0_for_manifest(doc: Document) -> dict[str, Any]:
    """IFC unsupported merge map slice for manifest (mergeConstraints always present offline)."""

    from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step  # noqa: PLC0415

    merge_constraints: list[str] = list(IFC_SEMANTIC_IMPORT_SCOPE_V0.get("importMergeUnsupported") or [])

    if not IFC_AVAILABLE:
        return {
            "schemaVersion": 0,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "unsupportedIfcProductsByClass": {},
            "extractionGapsByReason": {},
            "extractionGapTotal": 0,
            "mergeConstraints": merge_constraints,
        }

    if not kernel_export_eligible(doc):
        return {
            "schemaVersion": 0,
            "available": False,
            "reason": "kernel_not_eligible",
            "unsupportedIfcProductsByClass": {},
            "extractionGapsByReason": {},
            "extractionGapTotal": 0,
            "mergeConstraints": merge_constraints,
        }

    step = export_ifc_model_step(doc)
    return build_ifc_unsupported_merge_map_v0(step)


def build_ifc_exchange_manifest_payload(doc: Document) -> dict[str, Any]:
    parity = exchange_parity_manifest_fields_from_document(doc)
    planned = sorted(parity["countsByKind"].keys())
    emitting = kernel_export_eligible(doc)
    enc = IFC_ENCODING_KERNEL_V1 if emitting else IFC_ENCODING_EMPTY_SHELL
    hints = ifc_manifest_artifact_hints(doc, emitting_kernel_body=emitting)
    out: dict[str, Any] = {
        "format": "ifc_manifest_v0",
        "revision": doc.revision,
        **parity,
        **hints,
        "ifcEncoding": enc,
        "artifactHasGeometryEntities": bool(emitting),
        "plannedIfcEntitiesHints": planned,
        "plannedEntitiesReference": "spec/ifc-export-wp-x03-slice.md",
        "ifcSemanticImportScope_v0": dict(IFC_SEMANTIC_IMPORT_SCOPE_V0),
        "kernelExpectedIfcKinds": dict(sorted(kernel_expected_ifc_emit_counts(doc).items())),
        "hint": "IFC artifact: GET /api/models/{id}/exports/model.ifc",
        "note": (
            "Kernel slice emits IfcWall + IfcSlab + storey graph, roof/stair/slab-hosted openings, and IfcSpace "
            "when geometry is eligible; otherwise empty DATA hull."
        ),
    }
    asm_ev = material_assembly_manifest_evidence(doc)
    if asm_ev:
        out["materialAssemblyEvidence_v0"] = asm_ev
    cat_ev = material_catalog_audit_evidence_v0(doc)
    if cat_ev:
        out["materialCatalogAuditEvidence_v0"] = cat_ev
    ml_ev = build_ifc_material_layer_set_readback_evidence_v0(doc)
    if ml_ev:
        out["ifcMaterialLayerSetReadbackEvidence_v0"] = ml_ev
    ps_ev = build_ifc_property_set_coverage_evidence_v0(doc)
    if ps_ev:
        out["ifcPropertySetCoverageEvidence_v0"] = ps_ev
    out["siteExchangeEvidence_v0"] = build_site_exchange_evidence_v0_for_manifest(doc)
    out["ifcImportPreview_v0"] = build_ifc_import_preview_v0_for_manifest(doc)
    out["ifcUnsupportedMergeMap_v0"] = build_ifc_unsupported_merge_map_v0_for_manifest(doc)
    return out


def ifc_exchange_manifest_payload(
    *,
    revision: int,
    counts_by_kind: dict[str, int],
    element_count: int | None = None,
) -> dict[str, Any]:
    """Fixture entry when callers only aggregate kind counts outside a Document snapshot."""

    ec = sum(counts_by_kind.values()) if element_count is None else element_count
    parity = exchange_parity_manifest_fields(element_count=ec, counts_by_kind=counts_by_kind)
    planned = sorted(parity["countsByKind"].keys())
    zero_doc = Document(revision=max(1, revision), elements={})  # type: ignore[arg-type]
    hints = ifc_manifest_artifact_hints(zero_doc, emitting_kernel_body=False)
    return {
        "format": "ifc_manifest_v0",
        "revision": revision,
        **parity,
        **hints,
        "ifcEncoding": IFC_ENCODING_EMPTY_SHELL,
        "artifactHasGeometryEntities": False,
        "plannedIfcEntitiesHints": planned,
        "plannedEntitiesReference": "spec/ifc-export-wp-x03-slice.md",
        "ifcSemanticImportScope_v0": dict(IFC_SEMANTIC_IMPORT_SCOPE_V0),
        "kernelExpectedIfcKinds": {},
        "hint": "IFC artifact: GET /api/models/{id}/exports/model.ifc",
        "note": ("Empty IFC hull only — parity fields aligned with `/exports/ifc-manifest` + glTF kernels."),
    }
