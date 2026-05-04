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
    ifc_manifest_artifact_hints,
    kernel_expected_ifc_emit_counts,
    kernel_export_eligible,
)
from bim_ai.material_assembly_resolve import material_assembly_manifest_evidence

IFC_ENCODING_EMPTY_SHELL = "bim_ai_ifc_empty_shell_v0"

IFC_SEMANTIC_IMPORT_SCOPE_V0: dict[str, Any] = {
    "schemaVersion": 0,
    "semanticReadBackSupported": [
        "IfcBuildingStorey counts and elevationsPresent",
        "IfcWall, IfcSlab, IfcRoof, IfcStair, IfcSpace product counts",
        "IfcOpeningElement, IfcDoor, IfcWindow counts",
        "Pset_*Common Reference identity coverage (wall, slab, space, door, window, roof, stair)",
        "Pset_SpaceCommon programme string fields",
        "IfcElementQuantity Qto_* template names",
        "inspect_kernel_ifc_semantics.qtoLinkedProducts — per-product Qto_* linkage counts",
        "inspect_kernel_ifc_semantics.importScopeUnsupportedIfcProducts_v0 — IfcProduct classes outside kernel slice roots",
        "Kernel geometry skip map from Document",
        "summarize_kernel_ifc_semantic_roundtrip export→re-parse deltas (identityCoverage, qtoCoverage)",
        "summarize_kernel_ifc_semantic_roundtrip.commandSketch — level echo, storeys read-back, QTO names, programme samples",
        "summarize_kernel_ifc_semantic_roundtrip.commandSketch.authoritativeReplay_v0 — kernel IFC re-parse → deterministic createLevel/createFloor/createWall/createRoomOutline (IfcSpace) + wall-hosted insertDoorOnWall/insertWindowOnWall + slab-hosted createSlabOpening payloads, idsAuthoritativeReplayMap_v0 IDS linkage, unsupportedIfcProducts_v0 vs replay distinction, explicit kernelSlab*/kernelSlabOpening* skip counts",
        "engine.try_apply_kernel_ifc_authoritative_replay_v0 — additive apply of authoritativeReplay_v0 commands via try_commit_bundle (preflight merge_id_collision / merge_reference_unresolved, including createFloor/createSlabOpening host checks)",
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
