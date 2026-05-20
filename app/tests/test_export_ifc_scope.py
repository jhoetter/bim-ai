from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.export_ifc_scope import (
    ifc_product_is_kernel_slice_supported,
    ifc_semantic_mapping_scope_v1,
    import_scope_unsupported_ifc_products_v0,
    levels_from_document_sketch,
    storeys_sketch_from_ifc_model,
)


class _Product:
    def __init__(self, cls: str, **attrs) -> None:
        self._cls = cls
        for key, value in attrs.items():
            setattr(self, key, value)

    def is_a(self, root: str | None = None) -> str | bool:
        if root is None:
            return self._cls
        return self._cls == root


class _Storey:
    def __init__(self, name: str, elevation: float | None, global_id: str) -> None:
        self.Name = name
        self.Elevation = elevation
        self.GlobalId = global_id


class _Model:
    def __init__(self, products: list[_Product], storeys: list[_Storey] | None = None) -> None:
        self._products = products
        self._storeys = storeys or []

    def by_type(self, type_name: str) -> list[_Product] | list[_Storey]:
        if type_name == "IfcProduct":
            return self._products
        if type_name == "IfcBuildingStorey":
            return self._storeys
        return [p for p in self._products if p.is_a(type_name)]


def test_ifc_product_scope_classifies_kernel_and_unsupported_products() -> None:
    assert ifc_product_is_kernel_slice_supported(_Product("IfcWall")) is True
    assert ifc_product_is_kernel_slice_supported(_Product("IfcColumn")) is True
    assert ifc_product_is_kernel_slice_supported(_Product("IfcFurnishingElement")) is True
    assert ifc_product_is_kernel_slice_supported(_Product("IfcBuildingStorey")) is True
    assert ifc_product_is_kernel_slice_supported(_Product("IfcFlowTerminal")) is False

    scope = import_scope_unsupported_ifc_products_v0(
        _Model([_Product("IfcWall"), _Product("IfcFlowTerminal"), _Product("IfcFlowTerminal")])
    )

    assert scope == {
        "schemaVersion": 0,
        "countsByClass": {"IfcFlowTerminal": 2},
    }


def test_ifc_semantic_mapping_scope_declares_supported_and_external_schema_classes() -> None:
    qto = _Product("IfcElementQuantity", Name="Qto_FurnitureBaseQuantities")
    furnishing = _Product(
        "IfcFurnishingElement",
        _psets={"Pset_FurnitureTypeCommon": {"Reference": "chair-1"}},
        IsDefinedBy=[_Product("IfcRelDefinesByProperties", RelatingPropertyDefinition=qto)],
        HasAssociations=[_Product("IfcRelAssociatesMaterial")],
    )
    model = _Model(
        [
            _Product("IfcColumn", _psets={"Pset_ColumnCommon": {"Reference": "col-1"}}),
            furnishing,
            _Product("IfcFlowTerminal"),
        ]
    )

    scope = ifc_semantic_mapping_scope_v1(model)

    supported = {row["ifcProductClass"]: row for row in scope["supportedRows"]}
    assert supported["IfcColumn"]["supportStatus"] == "supported_kernel_export_readback"
    assert supported["IfcColumn"]["productsWithReference"] == 1
    assert supported["IfcFurnishingElement"]["productsWithQto"] == 1
    assert supported["IfcFurnishingElement"]["mappingDimensions"]["quantity"] == "readback"

    unsupported = {row["ifcProductClass"]: row for row in scope["unsupportedRows"]}
    assert unsupported["IfcFlowTerminal"]["supportStatus"] == "unsupported_external_ifc_product_schema"
    assert unsupported["IfcFlowTerminal"]["productCount"] == 1
    assert scope["summary"]["allEncounteredExternalClassesDeclared"] is True


def test_storey_and_document_level_sketches_are_sorted() -> None:
    model = _Model(
        [],
        [
            _Storey("OG", 3000.0, "gid-og"),
            _Storey("EG", 0.0, "gid-eg"),
        ],
    )

    assert storeys_sketch_from_ifc_model(model) == [
        {"name": "EG", "elevation": 0.0, "globalId": "gid-eg"},
        {"name": "OG", "elevation": 3000.0, "globalId": "gid-og"},
    ]

    doc = Document(
        elements={
            "lvl-og": LevelElem(id="lvl-og", name="OG", elevationMm=3000),
            "lvl-eg": LevelElem(id="lvl-eg", name="EG", elevationMm=0),
        }
    )

    assert levels_from_document_sketch(doc) == [
        {"id": "lvl-eg", "name": "EG", "elevationMm": 0.0},
        {"id": "lvl-og", "name": "OG", "elevationMm": 3000.0},
    ]
