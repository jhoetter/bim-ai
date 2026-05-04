"""glTF-ish JSON artifact with explicit unsupported BIM categories (until mesh encoding ships)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document

GLTF_UNSUPPORTED_KINDS = (
    "plan_view",
    "view_template",
    "schedule",
    "sheet",
    "bcf",
    "validation_rule",
    "dimension",
)


def build_visual_export_manifest(doc: Document) -> dict[str, Any]:
    kinds = {}
    for e in doc.elements.values():
        k = getattr(e, "kind", "?")
        kinds[k] = kinds.get(k, 0) + 1
    unsupported = [{"kind": kk, "count": vv} for kk, vv in kinds.items() if kk in GLTF_UNSUPPORTED_KINDS]
    return {
        "asset": {"version": "2.0", "generator": "bim-ai/export stub"},
        "extensionsUsed": ["BIM_AI_exportManifest_v0"],
        "extensions": {
            "BIM_AI_exportManifest_v0": {
                "elementCount": len(doc.elements),
                "countsByKind": kinds,
                "meshEncoding": None,
                "unsupportedDocumentKindsDetailed": unsupported,
                "hint": "Full triangular mesh embedding is Phase E; use browser WebGL screenshot for viz evidence.",
            }
        },
        "scenes": [{"nodes": []}],
        "scene": 0,
        "nodes": [],
        "meshes": [],
    }
