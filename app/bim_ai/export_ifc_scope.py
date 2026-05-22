"""IFC exchange-scope helpers for the kernel exporter/import preview."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import LevelElem

try:
    import ifcopenshell.util.element as ifc_elem_util
except ImportError:
    ifc_elem_util = None  # type: ignore[misc, assignment]

# Semantic geometry kinds emitted as physical IFC bodies in kernel export (for advisor parity).
IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS: frozenset[str] = frozenset(
    {"wall", "floor", "door", "window", "room", "roof", "stair", "slab_opening"}
)

# Kernel slice physical products (IfcOpenShell `is_a` roots — includes subtypes e.g. IfcWallStandardCase).
_KERNEL_SLICE_IFC_PRODUCT_ROOTS: tuple[str, ...] = (
    "IfcWall",
    "IfcSlab",
    "IfcRoof",
    "IfcStair",
    "IfcRailing",
    "IfcSpace",
    "IfcOpeningElement",
    "IfcDoor",
    "IfcWindow",
    "IfcColumn",
    "IfcBeam",
    "IfcCovering",
    "IfcFurnishingElement",
)

# Spatial / aggregation `IfcProduct` instances always present in kernel IFC graph — not merge-target signals.
_KERNEL_IFC_SCOPE_EXCLUDED_PRODUCT_ROOTS: tuple[str, ...] = (
    "IfcSite",
    "IfcBuilding",
    "IfcBuildingStorey",
)

_IFC_SEMANTIC_MAPPING_SUPPORTED_CLASSES: tuple[dict[str, Any], ...] = (
    {
        "ifcProductClass": "IfcWall",
        "kernelKinds": ("wall",),
        "identityPset": "Pset_WallCommon",
        "qtoTemplate": "Qto_WallBaseQuantities",
        "typeSupport": "IfcWallType_or_kernel_wall_type_reference",
        "materialSupport": "IfcMaterialLayerSet_or_IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcSlab",
        "kernelKinds": ("floor",),
        "identityPset": "Pset_SlabCommon",
        "qtoTemplate": "Qto_SlabBaseQuantities",
        "typeSupport": "IfcSlabType_reference",
        "materialSupport": "IfcMaterialLayerSet_or_IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcRoof",
        "kernelKinds": ("roof",),
        "identityPset": "Pset_RoofCommon",
        "qtoTemplate": None,
        "typeSupport": "kernel_roof_type_reference_pset",
        "materialSupport": "IfcMaterialLayerSet_or_IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcDoor",
        "kernelKinds": ("door",),
        "identityPset": "Pset_DoorCommon",
        "qtoTemplate": "Qto_DoorBaseQuantities",
        "typeSupport": "family_type_reference",
        "materialSupport": "IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcWindow",
        "kernelKinds": ("window",),
        "identityPset": "Pset_WindowCommon",
        "qtoTemplate": "Qto_WindowBaseQuantities",
        "typeSupport": "family_type_reference",
        "materialSupport": "IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcStair",
        "kernelKinds": ("stair",),
        "identityPset": "Pset_StairCommon",
        "qtoTemplate": "Qto_StairBaseQuantities",
        "typeSupport": "kernel_occurrence_type_pset",
        "materialSupport": "IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcRailing",
        "kernelKinds": ("railing",),
        "identityPset": "Pset_RailingCommon",
        "qtoTemplate": None,
        "typeSupport": "kernel_occurrence_type_pset",
        "materialSupport": "IfcMaterial",
        "classificationSupport": "not_emitted_for_current_railing_kernel",
    },
    {
        "ifcProductClass": "IfcSpace",
        "kernelKinds": ("room", "space"),
        "identityPset": "Pset_SpaceCommon",
        "qtoTemplate": "Qto_SpaceBaseQuantities",
        "typeSupport": "space_programme_pset_fields",
        "materialSupport": "not_applicable",
        "classificationSupport": "programme_classification_fields",
    },
    {
        "ifcProductClass": "IfcColumn",
        "kernelKinds": ("column",),
        "identityPset": "Pset_ColumnCommon",
        "qtoTemplate": None,
        "typeSupport": "kernel_occurrence_type_pset",
        "materialSupport": "IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcBeam",
        "kernelKinds": ("beam",),
        "identityPset": "Pset_BeamCommon",
        "qtoTemplate": None,
        "typeSupport": "kernel_occurrence_type_pset",
        "materialSupport": "IfcMaterial",
        "classificationSupport": "IfcRelAssociatesClassification",
    },
    {
        "ifcProductClass": "IfcCovering",
        "kernelKinds": ("ceiling",),
        "identityPset": "Pset_CoveringCommon",
        "qtoTemplate": None,
        "typeSupport": "ceiling_type_reference",
        "materialSupport": "not_emitted_for_current_ceiling_kernel",
        "classificationSupport": "not_emitted_for_current_ceiling_kernel",
    },
    {
        "ifcProductClass": "IfcFurnishingElement",
        "kernelKinds": ("placed_asset", "asset", "furniture"),
        "identityPset": "Pset_FurnitureTypeCommon",
        "qtoTemplate": "Qto_FurnitureBaseQuantities",
        "typeSupport": "asset_library_entry_reference",
        "materialSupport": "asset_material_slots",
        "classificationSupport": "asset_ifc_mapping_metadata",
    },
)

_IFC_SEMANTIC_MAPPING_UNSUPPORTED_CLASS_ROOTS: tuple[dict[str, str], ...] = (
    {
        "ifcProductClass": "IfcFlowTerminal",
        "unsupportedReason": "mep_terminal_geometry_and_connector_import_not_in_kernel_slice",
    },
    {
        "ifcProductClass": "IfcFlowSegment",
        "unsupportedReason": "mep_route_geometry_and_system_graph_import_not_in_kernel_slice",
    },
    {
        "ifcProductClass": "IfcDistributionElement",
        "unsupportedReason": "distribution_system_import_requires_mep_graph_reconstruction",
    },
    {
        "ifcProductClass": "IfcCurtainWall",
        "unsupportedReason": "curtain_grid_panel_mullion_schema_import_not_in_kernel_slice",
    },
    {
        "ifcProductClass": "IfcMember",
        "unsupportedReason": "generic_member_structural_schema_import_not_in_kernel_slice",
    },
    {
        "ifcProductClass": "IfcPlate",
        "unsupportedReason": "plate_panel_schema_import_not_in_kernel_slice",
    },
    {
        "ifcProductClass": "IfcBuildingElementProxy",
        "unsupportedReason": "arbitrary_proxy_semantics_require_authoring_intent_mapping",
    },
)


def ifc_product_is_kernel_slice_supported(product: Any) -> bool:
    for root in _KERNEL_IFC_SCOPE_EXCLUDED_PRODUCT_ROOTS:
        try:
            if product.is_a(root):
                return True
        except Exception:
            continue
    for root in _KERNEL_SLICE_IFC_PRODUCT_ROOTS:
        try:
            if product.is_a(root):
                return True
        except Exception:
            continue
    return False


def import_scope_unsupported_ifc_products_v0(model: Any) -> dict[str, Any]:
    """IFC product instances outside the kernel slice roots (import-merge scope evidence)."""

    counts: dict[str, int] = {}
    for p in model.by_type("IfcProduct") or []:
        if ifc_product_is_kernel_slice_supported(p):
            continue
        try:
            cls_name = str(p.is_a())
        except Exception:
            cls_name = "Unknown"
        counts[cls_name] = counts.get(cls_name, 0) + 1
    return {"schemaVersion": 0, "countsByClass": dict(sorted(counts.items()))}


def _ifc_products_by_type(model: Any, type_name: str) -> list[Any]:
    try:
        return list(model.by_type(type_name) or [])
    except Exception:
        return []


def _ifc_product_psets(product: Any) -> dict[str, Any]:
    if ifc_elem_util is not None:
        try:
            ps = ifc_elem_util.get_psets(product)
            if isinstance(ps, dict):
                return ps
        except Exception:
            pass
    for attr in ("_psets", "Psets", "psets"):
        raw = getattr(product, attr, None)
        if isinstance(raw, dict):
            return raw
    return {}


def _ifc_product_defines_qto_template(product: Any, qto_template_name: str) -> bool:
    for rel in getattr(product, "IsDefinedBy", None) or []:
        try:
            if not rel.is_a("IfcRelDefinesByProperties"):
                continue
        except Exception:
            continue
        dfn = getattr(rel, "RelatingPropertyDefinition", None)
        if dfn is None:
            continue
        try:
            if dfn.is_a("IfcElementQuantity") and getattr(dfn, "Name", None) == qto_template_name:
                return True
        except Exception:
            continue
    return False


def _ifc_product_has_association(product: Any, association_class: str) -> bool:
    for rel in getattr(product, "HasAssociations", None) or []:
        try:
            if rel.is_a(association_class):
                return True
        except Exception:
            continue
    return False


def ifc_semantic_mapping_scope_v1(model: Any | None = None) -> dict[str, Any]:
    """Supported/unsupported IFC semantic mapping ledger for BIR-K04.

    The ledger is intentionally scope evidence: supported rows describe IFC4 product
    classes whose identity psets, optional QTO templates, type/material/classification
    channels are deterministic in the current kernel exporter/readback. Unsupported
    rows make external IFC product-schema classes explicit instead of silently
    implying arbitrary import/merge support.
    """

    supported_rows: list[dict[str, Any]] = []
    for spec in _IFC_SEMANTIC_MAPPING_SUPPORTED_CLASSES:
        ifc_class = str(spec["ifcProductClass"])
        identity_pset = str(spec["identityPset"])
        qto_template = spec.get("qtoTemplate")
        products = _ifc_products_by_type(model, ifc_class) if model is not None else []
        products_with_reference = 0
        products_with_qto: int | None = None
        if qto_template:
            products_with_qto = 0
        products_with_material = 0
        products_with_classification = 0
        for product in products:
            psets = _ifc_product_psets(product)
            bucket = psets.get(identity_pset) or {}
            if isinstance(bucket, dict) and bucket.get("Reference"):
                products_with_reference += 1
            if isinstance(qto_template, str) and _ifc_product_defines_qto_template(
                product, qto_template
            ):
                products_with_qto = int(products_with_qto or 0) + 1
            if _ifc_product_has_association(product, "IfcRelAssociatesMaterial"):
                products_with_material += 1
            if _ifc_product_has_association(product, "IfcRelAssociatesClassification"):
                products_with_classification += 1
        row: dict[str, Any] = {
            "ifcSchema": "IFC4",
            "ifcProductClass": ifc_class,
            "kernelKinds": list(spec["kernelKinds"]),
            "supportStatus": "supported_kernel_export_readback",
            "identityPset": identity_pset,
            "qtoTemplate": qto_template,
            "typeSupport": spec["typeSupport"],
            "materialSupport": spec["materialSupport"],
            "classificationSupport": spec["classificationSupport"],
            "productCount": len(products),
            "productsWithReference": products_with_reference,
            "productsWithMaterialAssociation": products_with_material,
            "productsWithClassificationAssociation": products_with_classification,
            "mappingDimensions": {
                "schemaClass": "declared",
                "propertySet": "readback",
                "quantity": "readback" if qto_template else "not_applicable",
                "type": spec["typeSupport"],
                "material": spec["materialSupport"],
                "classification": spec["classificationSupport"],
            },
        }
        if qto_template:
            row["productsWithQto"] = products_with_qto
        supported_rows.append(row)

    unsupported_counts = (
        import_scope_unsupported_ifc_products_v0(model).get("countsByClass", {})
        if model is not None
        else {}
    )
    unsupported_declared = {
        row["ifcProductClass"]: row for row in _IFC_SEMANTIC_MAPPING_UNSUPPORTED_CLASS_ROOTS
    }
    unsupported_rows: list[dict[str, Any]] = []
    for spec in _IFC_SEMANTIC_MAPPING_UNSUPPORTED_CLASS_ROOTS:
        ifc_class = spec["ifcProductClass"]
        unsupported_rows.append(
            {
                "ifcSchema": "IFC4",
                "ifcProductClass": ifc_class,
                "supportStatus": "unsupported_external_ifc_product_schema",
                "unsupportedReason": spec["unsupportedReason"],
                "productCount": int(unsupported_counts.get(ifc_class, 0) or 0),
                "mappingDimensions": {
                    "schemaClass": "declared_unsupported",
                    "propertySet": "unsupported",
                    "quantity": "unsupported",
                    "type": "unsupported",
                    "material": "unsupported",
                    "classification": "unsupported",
                },
            }
        )
    undeclared_external = {
        cls: count for cls, count in unsupported_counts.items() if cls not in unsupported_declared
    }
    for cls, count in sorted(undeclared_external.items()):
        unsupported_rows.append(
            {
                "ifcSchema": "IFC4",
                "ifcProductClass": cls,
                "supportStatus": "unsupported_external_ifc_product_schema",
                "unsupportedReason": "external_ifc_product_class_not_declared_in_kernel_semantic_scope",
                "productCount": int(count),
                "mappingDimensions": {
                    "schemaClass": "encountered_unsupported",
                    "propertySet": "unsupported",
                    "quantity": "unsupported",
                    "type": "unsupported",
                    "material": "unsupported",
                    "classification": "unsupported",
                },
            }
        )

    return {
        "schemaVersion": 1,
        "supportedRows": supported_rows,
        "unsupportedRows": unsupported_rows,
        "summary": {
            "supportedClassCount": len(supported_rows),
            "declaredUnsupportedClassCount": len(_IFC_SEMANTIC_MAPPING_UNSUPPORTED_CLASS_ROOTS),
            "encounteredUnsupportedCountsByClass": dict(sorted(unsupported_counts.items())),
            "undeclaredUnsupportedCountsByClass": dict(sorted(undeclared_external.items())),
            "allEncounteredExternalClassesDeclared": not undeclared_external,
            "scopeClosure": "supported_or_declared_unsupported",
        },
    }


def storeys_sketch_from_ifc_model(model: Any) -> list[dict[str, Any]]:
    storeys = model.by_type("IfcBuildingStorey") or []
    keyed: list[tuple[tuple[float, str, str], dict[str, Any]]] = []
    for st in storeys:
        raw_elev = getattr(st, "Elevation", None)
        elev_sort = float(raw_elev) if isinstance(raw_elev, (int, float)) else 0.0
        name = str(getattr(st, "Name", None) or "")
        gid = str(getattr(st, "GlobalId", None) or "")
        row: dict[str, Any] = {
            "name": name,
            "elevation": raw_elev if isinstance(raw_elev, (int, float)) else None,
        }
        if gid:
            row["globalId"] = gid
        keyed.append(((elev_sort, name, gid), row))
    keyed.sort(key=lambda t: t[0])
    return [t[1] for t in keyed]


def levels_from_document_sketch(doc: Document) -> list[dict[str, Any]]:
    levels = [(eid, e) for eid, e in doc.elements.items() if isinstance(e, LevelElem)]
    levels.sort(key=lambda t: (t[1].elevation_mm, t[0]))
    return [{"id": eid, "name": e.name or "", "elevationMm": e.elevation_mm} for eid, e in levels]


def space_programme_sample_from_ifc_model(model: Any, *, limit: int) -> list[dict[str, Any]]:
    if ifc_elem_util is None:
        return []
    spaces = model.by_type("IfcSpace") or []
    keyed: list[tuple[str, dict[str, Any]]] = []
    for sp in spaces:
        ps = ifc_elem_util.get_psets(sp)
        bucket = ps.get("Pset_SpaceCommon") or {}
        prog_keys = ("ProgrammeCode", "Department", "FunctionLabel", "FinishSet")
        chunk = {k: bucket[k] for k in prog_keys if bucket.get(k)}
        if not chunk:
            continue
        ref = bucket.get("Reference")
        ref_s = ref.strip() if isinstance(ref, str) else ""
        sk = (
            ref_s
            or str(getattr(sp, "Name", None) or "")
            or str(getattr(sp, "GlobalId", None) or "")
        )
        row: dict[str, Any] = {"programmeFields": chunk}
        if ref_s:
            row["reference"] = ref_s
        nm = str(getattr(sp, "Name", None) or "").strip()
        if nm:
            row["spaceName"] = nm
        keyed.append((sk, row))
    keyed.sort(key=lambda t: t[0])
    return [t[1] for t in keyed[:limit]]
