from __future__ import annotations

from bim_ai import export_ifc
from bim_ai.export_ifc_readback import (
    _first_body_extruded_area_solid,
    _ifc_global_id_slug,
    _ifc_inverse_seq_local,
    _ifc_model_has_slab_void_opening_topology_v0,
    _ifc_rel_voids_host_building_element,
    _ifc_try_product_is_a,
    _kernel_slab_opening_replay_element_id,
    _profile_xy_polyline_mm,
    _void_rel_and_host_for_opening,
)


class _Ifc:
    def __init__(self, type_name: str, **attrs):
        self._type_name = type_name
        for key, value in attrs.items():
            setattr(self, key, value)

    def is_a(self, type_name: str) -> bool:
        return self._type_name == type_name


class _Model:
    def __init__(self, rels):
        self._rels = rels

    def by_type(self, type_name: str):
        return self._rels if type_name == "IfcRelVoidsElement" else []


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
