"""IFC STEP skeleton with empty DATA until ifcopenshell-backed encoding lands."""

from __future__ import annotations


def minimal_empty_ifc_skeleton() -> str:
    """Valid minimal SPFF hull (no misplaced entity references).."""

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


def ifc_exchange_manifest_payload(*, revision: int, counts_by_kind: dict[str, int]) -> dict:
    """JSON side-car so agents know what IFC should eventually carry."""

    planned = sorted(counts_by_kind.keys())
    return {
        "format": "ifc_manifest_v0",
        "revision": revision,
        "countsByKind": counts_by_kind,
        "plannedIfcEntitiesHints": planned,
        "note": (
            "Empty IFC skeleton file is downloadable at /exports/ifc-empty.skeleton.ifc "
            "(no geometry entities yet). Prefer JSON snapshot until Phase exchange hardens."
        ),
    }
