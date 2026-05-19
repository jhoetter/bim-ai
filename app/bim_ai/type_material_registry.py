"""Authoring seeds + document family types / materials hooks (WP-D04/D05 slice)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import FamilyTypeElem, FloorTypeElem, RoofTypeElem, WallTypeElem
from bim_ai.material_catalog import resolve_material


def _strict_family_type_seed(
    *,
    key: str,
    family_id: str,
    discipline: str,
    display_name: str,
    host_support: str,
    ifc_class: str,
    dimensions: dict[str, float],
) -> dict[str, Any]:
    parameter_schema = [
        {
            "key": dim_key,
            "kind": "mm",
            "min": 1,
            "max": 10000,
            "required": True,
            "instanceOverridable": dim_key in {"widthMm", "leafWidthMm"},
        }
        for dim_key in sorted(dimensions)
    ]
    schedule_fields = sorted([*dimensions.keys(), "materialKey"])
    return {
        "key": key,
        "id": key,
        "kind": "family_type",
        "familyId": family_id,
        "discipline": discipline,
        "displayName": display_name,
        "name": display_name,
        "familySchemaVersion": "family-content-v1",
        "strictFamilySchema": True,
        "parameters": {
            "displayName": display_name,
            "materialKey": "mat-gwb-finish-v1",
            **dimensions,
        },
        "parameterSchema": [
            *parameter_schema,
            {
                "key": "materialKey",
                "kind": "material",
                "required": True,
                "instanceOverridable": True,
            },
        ],
        "requiredDimensions": sorted(dimensions),
        "hostSupport": host_support,
        "materialSlots": {"default": "mat-gwb-finish-v1"},
        "scheduleFields": schedule_fields,
        "ifcMapping": {"class": ifc_class},
        "gltfMapping": {"nodeKind": "family_instance"},
        "renderSupport": {"geometry": True, "source": "builtin_seed"},
        "exportSupport": {"ifc": True, "gltf": True},
        "planSymbol": {"kind": discipline if discipline in {"door", "window"} else "component"},
        "visualGeometry": {"kind": "builtin_seed", "familyId": family_id},
    }


def builtin_type_material_registry() -> dict[str, Any]:
    """Stable seed catalog baked into kernel (authors may mirror as `family_type` / `wall_type` elements)."""

    return {
        "format": "bimAiBuiltinRegistry_v1",
        "notes": (
            "Use `upsertFamilyType`, `assignOpeningFamily`, and wall type elements to reference these keys."
        ),
        "familyTypeSeeds": [
            _strict_family_type_seed(
                key="ft-door-interior-swing-v1",
                family_id="builtin:door:single",
                discipline="door",
                display_name="Interior swing",
                host_support="wall_hosted",
                ifc_class="IfcDoor",
                dimensions={"widthMm": 900, "heightMm": 2100},
            ),
            _strict_family_type_seed(
                key="ft-door-cleanroom-interlock-v1",
                family_id="builtin:door:single",
                discipline="door",
                display_name="Cleanroom interlock",
                host_support="wall_hosted",
                ifc_class="IfcDoor",
                dimensions={"widthMm": 1000, "heightMm": 2100},
            ),
            _strict_family_type_seed(
                key="ft-window-fixed-v1",
                family_id="builtin:window:fixed",
                discipline="window",
                display_name="Fixed lite",
                host_support="wall_hosted",
                ifc_class="IfcWindow",
                dimensions={"widthMm": 1200, "heightMm": 1200},
            ),
            _strict_family_type_seed(
                key="ft-generic-placeholder-v1",
                family_id="builtin:generic:placeholder",
                discipline="generic",
                display_name="Generic host type",
                host_support="freestanding",
                ifc_class="IfcBuildingElementProxy",
                dimensions={"widthMm": 600, "heightMm": 600, "depthMm": 600},
            ),
        ],
        "wallTypeSeeds": [
            {"key": "wt-exterior-masonry-200-v1", "name": "Exterior masonry 200", "layerCount": 1},
            {
                "key": "wt-interior-partition-100-v1",
                "name": "Interior partition 100",
                "layerCount": 1,
            },
            {
                "key": "wt-cleanroom-partition-150-v1",
                "name": "Cleanroom partition (structure + finish)",
                "layerCount": 2,
            },
        ],
        "floorTypeSeeds": [
            {"key": "ft-slab-two-layer-220-v1", "name": "Slab structure + finish", "layerCount": 2},
        ],
        "roofTypeSeeds": [
            {
                "key": "rt-warm-roof-buildup-v1",
                "name": "Warm deck (deck + rigid insulation)",
                "layerCount": 2,
            },
        ],
        "materialSeeds": [
            {"materialKey": "mat-concrete-structure-v1", "displayName": "Concrete structure"},
            {"materialKey": "mat-gwb-finish-v1", "displayName": "Gypsum board finish"},
            {"materialKey": "mat-epoxy-cleanroom-v1", "displayName": "Epoxy cleanroom flooring"},
            {"materialKey": "mat-osb-roof-deck-v1", "displayName": "OSB structural deck"},
            {
                "materialKey": "mat-insulation-roof-board-v1",
                "displayName": "Rigid insulation board",
            },
            {
                "materialKey": "mat-membrane-roof-single-ply-v1",
                "displayName": "Roof membrane (single-ply)",
            },
        ],
    }


def builtin_family_type_seed_integrity_v1() -> dict[str, Any]:
    """Validate kernel built-in family seeds against the strict family-content contract."""

    from bim_ai.model_integrity import family_type_content_integrity_v1

    seeds = builtin_type_material_registry()["familyTypeSeeds"]
    elements = {
        str(seed["id"]): dict(seed)
        for seed in seeds
        if isinstance(seed, dict) and str(seed.get("kind") or "") == "family_type"
    }
    report = family_type_content_integrity_v1({"elements": elements})
    return {
        "format": "builtinFamilyTypeSeedIntegrity_v1",
        "trackedItems": ["BIR-V01", "BIR-V02", "BIR-V05"],
        "ok": report["ok"],
        "seedCount": len(elements),
        "report": report,
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

    floor_types = [
        e.model_dump(mode="json", by_alias=True)
        for e in doc.elements.values()
        if isinstance(e, FloorTypeElem)
    ]

    roof_types = [
        e.model_dump(mode="json", by_alias=True)
        for e in doc.elements.values()
        if isinstance(e, RoofTypeElem)
    ]

    family_types.sort(key=lambda x: str(x.get("id", "")))

    wall_types.sort(key=lambda x: str(x.get("id", "")))

    floor_types.sort(key=lambda x: str(x.get("id", "")))

    roof_types.sort(key=lambda x: str(x.get("id", "")))

    return {
        "familyTypes": family_types,
        "wallTypes": wall_types,
        "floorTypes": floor_types,
        "roofTypes": roof_types,
    }


def merged_registry_payload(doc: Document) -> dict[str, Any]:
    return {
        "format": "typeMaterialRegistry_v1",
        "builtin": builtin_type_material_registry(),
        "document": document_registry_overlay(doc),
    }


def material_display_label(_doc: Document, material_key: str | None) -> str:
    """Human label for schedules / UI from builtin material seeds (WP-D05 slice)."""

    key = (material_key or "").strip()

    if not key:
        return ""

    material_el = _doc.elements.get(key)
    if getattr(material_el, "kind", None) == "material":
        name = str(getattr(material_el, "name", "") or "").strip()
        if name:
            return name

    for seed in builtin_type_material_registry().get("materialSeeds") or []:
        if not isinstance(seed, dict):
            continue

        sk = str(seed.get("materialKey") or seed.get("material_key") or "").strip()

        if sk == key:
            dn = seed.get("displayName") or seed.get("display_name")

            if isinstance(dn, str) and dn.strip():
                return dn.strip()

    builtin = resolve_material(key)
    if builtin:
        return builtin.display_name

    return ""


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


def wall_type_display_label(doc: Document, wall_type_id: str | None) -> str:
    """Human label for schedules / UI from document wall types."""

    wid = (wall_type_id or "").strip()

    if not wid:
        return ""

    wt = doc.elements.get(wid)

    if isinstance(wt, WallTypeElem):
        nm = (wt.name or "").strip()

        if nm:
            return nm

    return wid
