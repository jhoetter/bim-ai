from __future__ import annotations

from bim_ai import export_ifc
from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    FloorElem,
    LevelElem,
    PlacedAssetElem,
    RailingElem,
    RoofElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.export_ifc_readback import (
    _count_ifc_products_with_qto_template,
    _first_body_extruded_area_solid,
    _ifc_global_id_slug,
    _ifc_inverse_seq_local,
    _ifc_model_has_slab_void_opening_topology_v0,
    _ifc_product_defines_qto_template,
    _ifc_rel_voids_host_building_element,
    _ifc_try_product_is_a,
    _kernel_slab_opening_replay_element_id,
    _profile_xy_polyline_mm,
    _read_named_qto_values,
    _void_rel_and_host_for_opening,
    build_deterministic_ifc_importer_readback_parity_v1,
    build_kernel_ifc_geometry_readback_summary_v0,
    kernel_ifc_source_topology_summary_v0,
)


class _Ifc:
    def __init__(self, type_name: str, **attrs):
        self._type_name = type_name
        for key, value in attrs.items():
            setattr(self, key, value)

    def is_a(self, type_name: str) -> bool:
        return self._type_name == type_name


class _Model:
    def __init__(self, rels=None, by_type=None):
        self._rels = rels or []
        self._by_type = by_type or {}

    def by_type(self, type_name: str):
        if type_name in self._by_type:
            return self._by_type[type_name]
        return self._rels if type_name == "IfcRelVoidsElement" else []


def _body_product(type_name: str, ref: str, pset_name: str, qto_name: str | None = None) -> _Ifc:
    solid = _Ifc("IfcExtrudedAreaSolid")
    rels = []
    if qto_name:
        qto = _Ifc("IfcElementQuantity", Name=qto_name, Quantities=[])
        rels.append(_Ifc("IfcRelDefinesByProperties", RelatingPropertyDefinition=qto))
    return _Ifc(
        type_name,
        _psets={pset_name: {"Reference": ref}},
        IsDefinedBy=rels,
        Representation=_Ifc(
            "IfcProductDefinitionShape",
            Representations=[
                _Ifc("IfcShapeRepresentation", RepresentationIdentifier="Body", Items=[solid])
            ],
        ),
    )


def test_ifc_global_id_slug_sanitizes_empty_and_special_chars():
    assert _ifc_global_id_slug(None) == "ifc_empty_gid"
    assert _ifc_global_id_slug("a/b c") == "a_b_c"


def test_profile_xy_polyline_supports_indexed_polycurve_and_polyline():
    indexed = _Ifc(
        "IfcIndexedPolyCurve", Points=_Ifc("IfcCartesianPointList2D", CoordList=[(1, 2), (3, 4)])
    )
    assert _profile_xy_polyline_mm(indexed) == [(1.0, 2.0), (3.0, 4.0)]

    polyline = _Ifc("IfcPolyline", Points=[_Ifc("IfcCartesianPoint", Coordinates=[5, 6, 7])])
    assert _profile_xy_polyline_mm(polyline) == [(5.0, 6.0)]


def test_first_body_extruded_area_solid_ignores_non_body_representations():
    solid = _Ifc("IfcExtrudedAreaSolid")
    product = _Ifc(
        "IfcWall",
        Representation=_Ifc(
            "IfcProductDefinitionShape",
            Representations=[
                _Ifc("IfcShapeRepresentation", RepresentationIdentifier="Axis", Items=[solid]),
                _Ifc("IfcShapeRepresentation", RepresentationIdentifier="Body", Items=[solid]),
            ],
        ),
    )
    assert _first_body_extruded_area_solid(product) is solid


def test_qto_template_helpers_read_and_count_named_quantities():
    qto = _Ifc(
        "IfcElementQuantity",
        Name="Qto_WallBaseQuantities",
        Quantities=[
            _Ifc("IfcQuantityLength", Name="Length", LengthValue=4.5),
            _Ifc("IfcQuantityArea", Name="GrossSideArea", AreaValue="12.25"),
            _Ifc("IfcQuantityCount", Name="BadCount", CountValue="n/a"),
        ],
    )
    rel = _Ifc("IfcRelDefinesByProperties", RelatingPropertyDefinition=qto)
    product = _Ifc("IfcWall", IsDefinedBy=[rel])
    other = _Ifc("IfcWall", IsDefinedBy=[])

    assert _ifc_product_defines_qto_template(product, "Qto_WallBaseQuantities") is True
    assert _ifc_product_defines_qto_template(product, "Qto_SlabBaseQuantities") is False
    assert _count_ifc_products_with_qto_template([product, other], "Qto_WallBaseQuantities") == 1
    assert _read_named_qto_values(product, "Qto_WallBaseQuantities") == {
        "Length": 4.5,
        "GrossSideArea": 12.25,
    }
    assert _read_named_qto_values(product, "Qto_SlabBaseQuantities") == {}
    assert export_ifc._read_named_qto_values is _read_named_qto_values


def test_void_rel_host_lookup_prefers_inverse_and_falls_back_to_model_scan():
    host = _Ifc("IfcSlab")
    opening = _Ifc("IfcOpeningElement", GlobalId="op-1")
    inverse_rel = _Ifc(
        "IfcRelVoidsElement",
        RelatedOpeningElement=opening,
        RelatingBuildingElement=host,
    )
    assert _void_rel_and_host_for_opening(
        _Ifc("IfcOpeningElement", GlobalId="op-1", VoidsElements=[inverse_rel]),
        _Model([]),
    ) == (inverse_rel, host)

    scan_rel = _Ifc(
        "IfcRelVoidsElement",
        RelatedOpeningElement=_Ifc("IfcOpeningElement", GlobalId="op-2"),
        RelatedBuildingElement=host,
    )
    assert _void_rel_and_host_for_opening(
        _Ifc("IfcOpeningElement", GlobalId="op-2"), _Model([scan_rel])
    ) == (
        scan_rel,
        host,
    )


def test_ifc_opening_helpers_handle_variants_and_legacy_exports():
    host = _Ifc("IfcSlab")
    rel = _Ifc("IfcRelVoidsElement", RelatedBuildingElement=host)
    assert _ifc_rel_voids_host_building_element(rel) is host
    assert _ifc_inverse_seq_local((None, host)) == [host]
    assert _ifc_try_product_is_a(host, "IfcSlab") is True
    assert (
        _kernel_slab_opening_replay_element_id(_Ifc("IfcOpeningElement", Name="op:slab-cut"))
        == "slab-cut"
    )

    model_rel = _Ifc(
        "IfcRelVoidsElement",
        RelatedOpeningElement=_Ifc("IfcOpeningElement"),
        RelatingBuildingElement=host,
    )
    assert _ifc_model_has_slab_void_opening_topology_v0(_Model([model_rel])) is True
    assert export_ifc._profile_xy_polyline_mm is _profile_xy_polyline_mm


def test_kernel_source_topology_summary_counts_supported_export_ids():
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="L1", elevationMm=3000),
            "w1": WallElem(
                kind="wall",
                id="w1",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                materialKey="paint-white",
                ifcClassificationCode="OmniClass:23-11",
            ),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            ),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            ),
            "d1": DoorElem(kind="door", id="d1", wallId="w1", alongT=0.5, widthMm=900),
            "win1": WindowElem(
                kind="window",
                id="win1",
                wallId="w1",
                alongT=0.2,
                widthMm=1200,
                sillHeightMm=900,
                heightMm=1100,
            ),
            "st1": StairElem(
                kind="stair",
                id="st1",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
            ),
            "rl1": RailingElem(
                kind="railing",
                id="rl1",
                hostedStairId="st1",
                pathMm=[{"xMm": 0, "yMm": 0}, {"xMm": 3000, "yMm": 0}],
            ),
            "rm1": RoomElem(
                kind="room",
                id="rm1",
                levelId="l0",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "col1": ColumnElem(
                kind="column",
                id="col1",
                levelId="l0",
                positionMm={"xMm": 1000, "yMm": 1000},
            ),
            "bm1": BeamElem(
                kind="beam",
                id="bm1",
                levelId="l0",
                startMm={"xMm": 0, "yMm": 0},
                endMm={"xMm": 4000, "yMm": 0},
            ),
            "ceil1": CeilingElem(
                kind="ceiling",
                id="ceil1",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "asset1": PlacedAssetElem(
                kind="placed_asset",
                id="asset1",
                name="Chair",
                assetId="chair-type",
                levelId="l0",
                positionMm={"xMm": 1500, "yMm": 1500},
            ),
            "so1": SlabOpeningElem(
                kind="slab_opening",
                id="so1",
                hostFloorId="fl1",
                boundaryMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 2000, "yMm": 1000},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 1000, "yMm": 2000},
                ],
            ),
        },
    )

    source = kernel_ifc_source_topology_summary_v0(doc)

    assert source["countsByKind"] == {
        "wall": 1,
        "floor": 1,
        "roof": 1,
        "door": 1,
        "window": 1,
        "stair": 1,
        "railing": 1,
        "room": 1,
        "column": 1,
        "beam": 1,
        "ceiling": 1,
        "placed_asset": 1,
    }
    assert source["openingCountsByHostKind"] == {"wall": 2, "slab": 1, "roof": 0}
    assert source["semanticExpectations"]["classificationElementIds"] == ["w1"]
    assert source["semanticExpectations"]["materialKeys"] == ["paint-white"]


def test_geometry_readback_summary_compares_identity_body_qto_and_topology():
    wall = _body_product("IfcWall", "w1", "Pset_WallCommon", "Qto_WallBaseQuantities")
    floor = _body_product("IfcSlab", "fl1", "Pset_SlabCommon", "Qto_SlabBaseQuantities")
    door = _body_product("IfcDoor", "d1", "Pset_DoorCommon", "Qto_DoorBaseQuantities")
    opening = _Ifc("IfcOpeningElement", GlobalId="op-wall", Name="op:d1")
    rel = _Ifc(
        "IfcRelVoidsElement",
        RelatedOpeningElement=opening,
        RelatingBuildingElement=wall,
    )
    model = _Model(
        rels=[rel],
        by_type={
            "IfcWall": [wall],
            "IfcSlab": [floor],
            "IfcDoor": [door],
            "IfcOpeningElement": [opening],
            "IfcElementQuantity": [
                _Ifc("IfcElementQuantity", Name="Qto_WallBaseQuantities"),
                _Ifc("IfcElementQuantity", Name="Qto_SlabBaseQuantities"),
                _Ifc("IfcElementQuantity", Name="Qto_DoorBaseQuantities"),
            ],
            "IfcMaterial": [_Ifc("IfcMaterial", Name="paint-white")],
            "IfcRelAssociatesMaterial": [_Ifc("IfcRelAssociatesMaterial")],
            "IfcClassificationReference": [_Ifc("IfcClassificationReference")],
        },
    )
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            ),
            "d1": DoorElem(kind="door", id="d1", wallId="w1", alongT=0.5, widthMm=900),
        },
    )

    summary = build_kernel_ifc_geometry_readback_summary_v0(model, doc)

    assert summary["available"] is True
    assert summary["allMatched"] is True
    assert summary["coverageByKind"]["wall"]["matchedReferenceIds"] == ["w1"]
    assert summary["coverageByKind"]["floor"]["productsWithQto"] == 1
    assert summary["coverageByKind"]["door"]["productsWithBody"] == 1
    assert summary["openingTopology"]["readbackByHostKind"]["wall"] == 1
    assert summary["semanticReadback"]["materials"]["IfcMaterial"] == 1
    assert summary["semanticReadback"]["classifications"]["IfcClassificationReference"] == 1
    assert summary["driftTolerancePolicy"]["countTolerance"] == 0
    assert summary["driftFindings"] == []
    parity = summary["ifcImporterReadbackParity_v1"]
    assert parity["format"] == "ifcImporterReadbackParity_v1"
    assert parity["readbackStatus"] == "aligned"
    assert parity["driftTolerancePolicy"]["productCountTolerance"] == 0
    assert parity["sourceGraph"]["countsByKind"]["wall"] == 1
    assert parity["importerGraph"]["countsByKind"]["wall"] == 1
    assert parity["unsupportedSkips"]["countsByReason"] == {}
    assert parity["findings"] == []


def test_geometry_readback_summary_reports_toleranced_drift_findings():
    wall = _body_product("IfcWall", "wrong-wall", "Pset_WallCommon", None)
    model = _Model(by_type={"IfcWall": [wall]})
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )

    summary = build_kernel_ifc_geometry_readback_summary_v0(model, doc)

    assert summary["allMatched"] is False
    codes = {finding["code"] for finding in summary["driftFindings"]}
    assert "ifc_readback_missing_reference" in codes
    assert "ifc_readback_unexpected_reference" in codes
    assert "ifc_readback_qto_gap" in codes
    assert all("BIR-K02" in finding["trackerItems"] for finding in summary["driftFindings"])
    parity = summary["ifcImporterReadbackParity_v1"]
    assert parity["readbackStatus"] == "drift"
    assert any(f["code"] == "ifc_readback_missing_reference" for f in parity["findings"])


def test_deterministic_ifc_importer_parity_records_unsupported_skips_offline() -> None:
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d-bad": DoorElem(kind="door", id="d-bad", wallId="missing", alongT=0.5),
        },
    )

    parity = build_deterministic_ifc_importer_readback_parity_v1(doc)

    assert parity["format"] == "ifcImporterReadbackParity_v1"
    assert parity["readbackStatus"] == "aligned"
    assert parity["importer"]["mode"] == "deterministic_surrogate"
    assert parity["unsupportedSkips"]["countsByReason"] == {"door_missing_host_wall": 1}
    assert parity["sourceGraph"]["countsByKind"]["wall"] == 1
    assert parity["importerGraph"]["countsByKind"]["wall"] == 1


def test_geometry_readback_summary_covers_broader_ifc_schema_classes():
    column = _body_product("IfcColumn", "col1", "Pset_ColumnCommon")
    beam = _body_product("IfcBeam", "bm1", "Pset_BeamCommon")
    ceiling = _body_product("IfcCovering", "ceil1", "Pset_CoveringCommon")
    furnishing = _body_product(
        "IfcFurnishingElement",
        "asset1",
        "Pset_FurnitureTypeCommon",
        "Qto_FurnitureBaseQuantities",
    )
    model = _Model(
        by_type={
            "IfcColumn": [column],
            "IfcBeam": [beam],
            "IfcCovering": [ceiling],
            "IfcFurnishingElement": [furnishing],
            "IfcElementQuantity": [
                _Ifc("IfcElementQuantity", Name="Qto_FurnitureBaseQuantities")
            ],
        }
    )
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "col1": ColumnElem(
                kind="column",
                id="col1",
                levelId="l0",
                positionMm={"xMm": 1000, "yMm": 1000},
            ),
            "bm1": BeamElem(
                kind="beam",
                id="bm1",
                levelId="l0",
                startMm={"xMm": 0, "yMm": 0},
                endMm={"xMm": 4000, "yMm": 0},
            ),
            "ceil1": CeilingElem(
                kind="ceiling",
                id="ceil1",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "asset1": PlacedAssetElem(
                kind="placed_asset",
                id="asset1",
                name="Chair",
                assetId="chair-type",
                levelId="l0",
                positionMm={"xMm": 1500, "yMm": 1500},
            ),
        },
    )

    summary = build_kernel_ifc_geometry_readback_summary_v0(model, doc)

    assert summary["allMatched"] is True
    assert summary["coverageByKind"]["column"]["matchedReferenceIds"] == ["col1"]
    assert summary["coverageByKind"]["beam"]["ifcType"] == "IfcBeam"
    assert summary["coverageByKind"]["ceiling"]["pset"] == "Pset_CoveringCommon"
    assert summary["coverageByKind"]["placed_asset"]["productsWithQto"] == 1
