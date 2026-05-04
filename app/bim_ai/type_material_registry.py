"""Authoring seeds + document family types / materials hooks (WP-D04/D05 slice)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import FamilyTypeElem, WallTypeElem


def builtin_type_material_registry() -> dict[str, Any]:
    """Stable seed catalog baked into kernel (authors may mirror as `family_type` / `wall_type` elements)."""

    return {
        "format": "bimAiBuiltinRegistry_v1",
        "notes": ("Use `upsertFamilyType`, `assignOpeningFamily`, and wall type elements to reference these keys."),
        "familyTypeSeeds": [
            {"key": "ft-door-interior-swing-v1", "discipline": "door", "displayName": "Interior swing"},
            {"key": "ft-door-cleanroom-interlock-v1", "discipline": "door", "displayName": "Cleanroom interlock"},
            {"key": "ft-window-fixed-v1", "discipline": "window", "displayName": "Fixed lite"},
            {"key": "ft-generic-placeholder-v1", "discipline": "generic", "displayName": "Generic host type"},
        ],
        "wallTypeSeeds": [
            {"key": "wt-exterior-masonry-200-v1", "name": "Exterior masonry 200", "layerCount": 1},
            {"key": "wt-interior-partition-100-v1", "name": "Interior partition 100", "layerCount": 1},
        ],
        "materialSeeds": [
            {"materialKey": "mat-concrete-structure-v1", "displayName": "Concrete structure"},
            {"materialKey": "mat-gwb-finish-v1", "displayName": "Gypsum board finish"},
            {"materialKey": "mat-epoxy-cleanroom-v1", "displayName": "Epoxy cleanroom flooring"},
        ],
    }


def document_registry_overlay(doc: Document) -> dict[str, Any]:
    """Family + wall-type instances referenced by the semantic model."""

    family_types = [
        e.model_dump(mode="json", by_alias=True)
        for e in doc.elements.values()
        if isinstance(e, FamilyTypeElem)
    ]

    wall_types = [
        e.model_dump(mode="json", by_alias=True)
        for e in doc.elements.values()
        if isinstance(e, WallTypeElem)
    ]

    family_types.sort(key=lambda x: str(x.get("id", "")))

    wall_types.sort(key=lambda x: str(x.get("id", "")))

    return {"familyTypes": family_types, "wallTypes": wall_types}


def merged_registry_payload(doc: Document) -> dict[str, Any]:
    return {
        "format": "typeMaterialRegistry_v1",
        "builtin": builtin_type_material_registry(),
        "document": document_registry_overlay(doc),
    }


def family_type_display_label(doc: Document, family_type_id: str | None) -> str:
    """Human label for schedules / UI."""

    fid = (family_type_id or "").strip()

    if not fid:

        return ""

    ft = doc.elements.get(fid)

    if isinstance(ft, FamilyTypeElem):
        params = ft.parameters or {}
        dn = params.get("displayName") or params.get("display_name") or params.get("name")

        if isinstance(dn, str) and dn.strip():

            return dn.strip()

    return fid
