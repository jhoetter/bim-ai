"""IFC4 export using IfcOpenShell — building storey + IfcWall + IfcSlab (bim-ai kernel subset)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    RoomElem,
)
from bim_ai.export_ifc_geometry import (
    clamp,
    level_elevation_m,
    polygon_area_m2_xy_mm,
    polygon_perimeter_m_xy_mm,
    room_outline_mm,
    room_vertical_span_m,
    xz_bounds_mm,
)
from bim_ai.export_ifc_kernel import (
    _kernel_ifc_space_export_props,  # noqa: F401 - legacy private re-export
    try_build_kernel_ifc,
)
from bim_ai.export_ifc_manifest import (
    document_kernel_export_eligible,
    ifc_kernel_geometry_skip_counts,
    kernel_expected_ifc_emit_counts,  # noqa: F401 - legacy public re-export
)
from bim_ai.export_ifc_manifest import (
    ifc_manifest_artifact_hints as _ifc_manifest_artifact_hints,
)
from bim_ai.export_ifc_readback import (
    _count_ifc_products_with_qto_template,
    _first_body_extruded_area_solid,
    _ifc_try_product_is_a,
    _kernel_wall_plan_geometry_mm,  # noqa: F401 - legacy private re-export
    _product_host_storey_global_id,  # noqa: F401 - legacy private re-export
    _profile_xy_polyline_mm,
    _read_named_qto_values,  # noqa: F401 - legacy private re-export
    _void_rel_and_host_for_opening,
)
from bim_ai.export_ifc_readback import (
    _ifc_inverse_seq_local as _ifc_inverse_seq_local,
)
from bim_ai.export_ifc_readback import (
    _ifc_rel_voids_host_building_element as _ifc_rel_voids_host_building_element,
)
from bim_ai.export_ifc_scope import (
    IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS,  # noqa: F401 - re-exported for existing imports
    import_scope_unsupported_ifc_products_v0,
)
from bim_ai.export_ifc_site_exchange import (
    build_site_exchange_evidence_v0 as _build_site_exchange_evidence_v0,
)
from bim_ai.export_ifc_site_exchange import (
    build_site_exchange_evidence_v0_for_manifest,  # noqa: F401 - legacy public re-export
)
from bim_ai.ifc_material_layer_exchange_v0 import (
    kernel_ifc_material_layer_set_readback_v0,
)
from bim_ai.ifc_property_set_coverage_evidence_v0 import (
    build_ifc_property_set_coverage_expansion_v1,
    build_kernel_ifc_property_set_coverage_evidence_v0,
    unavailable_property_set_coverage_evidence_v0,
)

# Back-compat for IFC replay helpers that import these private names lazily from
# this legacy module while the exporter is being split into focused modules.
_clamp = clamp
_elev_m = level_elevation_m
_polygon_area_m2_xy_mm = polygon_area_m2_xy_mm
_polygon_perimeter_m_xy_mm = polygon_perimeter_m_xy_mm
_room_outline_mm = room_outline_mm
_vertical_span_m = room_vertical_span_m
_xz_bounds_mm = xz_bounds_mm

try:
    import ifcopenshell  # noqa: F401
    import ifcopenshell.util.element as ifc_elem_util
    import ifcopenshell.util.placement as ifc_placement

    IFC_AVAILABLE = True
except ImportError:
    ifc_elem_util = None  # type: ignore[misc, assignment]
    ifc_placement = None  # type: ignore[misc, assignment]
    IFC_AVAILABLE = False

KERNEL_IFC_DOMINANT_KINDS: frozenset[str] = frozenset(
    {"level", "wall", "floor", "door", "window", "room", "roof", "stair", "slab_opening", "site"}
)
IFC_ENCODING_KERNEL_V1 = "bim_ai_ifc_kernel_v1"
KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION = 0
AUTHORITATIVE_REPLAY_KIND_V0 = "authoritative_kernel_slice_v0"


def ifcopenshell_available() -> bool:
    return IFC_AVAILABLE


def kernel_export_eligible(doc: Document) -> bool:
    return IFC_AVAILABLE and document_kernel_export_eligible(doc)


def ifc_manifest_artifact_hints(doc: Document, *, emitting_kernel_body: bool) -> dict[str, Any]:
    return _ifc_manifest_artifact_hints(
        doc,
        emitting_kernel_body=emitting_kernel_body,
        ifc_available=IFC_AVAILABLE,
    )


def serialize_ifc_artifact(doc: Document) -> tuple[str, str, bool]:
    """(spf_text, encoding_id, artifact_has_physical_geometry)."""

    from bim_ai.ifc_stub import IFC_ENCODING_EMPTY_SHELL, minimal_empty_ifc_skeleton

    hull = minimal_empty_ifc_skeleton()
    if not IFC_AVAILABLE:
        return hull, IFC_ENCODING_EMPTY_SHELL, False

    serialized, geo_n = try_build_kernel_ifc(doc)
    if not serialized or geo_n == 0:
        return hull, IFC_ENCODING_EMPTY_SHELL, False
    return serialized, IFC_ENCODING_KERNEL_V1, True


def export_ifc_model_step(doc: Document) -> str:
    """IFC STEP text suitable for *.ifc download."""

    step, _, _ = serialize_ifc_artifact(doc)
    return step


def build_site_exchange_evidence_v0(
    *,
    doc: Document | None,
    model: Any | None = None,
    unavailable_reason: str | None = None,
) -> dict[str, Any]:
    return _build_site_exchange_evidence_v0(
        doc=doc,
        model=model,
        unavailable_reason=unavailable_reason,
        ifc_elem_util=ifc_elem_util,
    )


def inspect_kernel_ifc_semantics(
    *,
    doc: Document | None = None,
    step_text: str | None = None,
) -> dict[str, Any]:
    """Structured read-back matrix for kernel IFC (WP-X03/X05) — JSON-serializable.

    Does not add fields to the IFC↔glTF parity manifest slice in ``constraints``.

    - Without IfcOpenShell, returns ``available=False`` and optional skip counts when ``doc`` is set.
    - With ``doc`` only, parses nothing when the document is not ``kernel_export_eligible``.
    - With ``step_text``, parses that STEP when IfcOpenShell is available (for tests over fixed strings).
    """

    matrix_version = 1
    skip_counts: dict[str, int] = {}
    if doc is not None:
        skip_counts = {k: v for k, v in sorted(ifc_kernel_geometry_skip_counts(doc).items()) if v}

    if not IFC_AVAILABLE:
        row = {
            "matrixVersion": matrix_version,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            **({"ifcKernelGeometrySkippedCounts": skip_counts} if skip_counts else {}),
        }
        if doc is not None:
            row["siteExchangeEvidence_v0"] = build_site_exchange_evidence_v0(
                doc=doc,
                unavailable_reason="ifcopenshell_not_installed",
            )
            row["propertySetCoverageEvidence_v0"] = unavailable_property_set_coverage_evidence_v0(
                "ifcopenshell_not_installed",
            )
        return row

    text: str | None = step_text
    if text is None and doc is not None:
        if not kernel_export_eligible(doc):
            row = {
                "matrixVersion": matrix_version,
                "available": False,
                "reason": "kernel_not_eligible",
                **({"ifcKernelGeometrySkippedCounts": skip_counts} if skip_counts else {}),
            }
            row["siteExchangeEvidence_v0"] = build_site_exchange_evidence_v0(
                doc=doc,
                unavailable_reason="kernel_not_eligible",
            )
            row["propertySetCoverageEvidence_v0"] = unavailable_property_set_coverage_evidence_v0(
                "kernel_not_eligible",
            )
            return row
        text = export_ifc_model_step(doc)

    if text is None:
        row = {
            "matrixVersion": matrix_version,
            "available": False,
            "reason": "no_document_or_step",
            **({"ifcKernelGeometrySkippedCounts": skip_counts} if skip_counts else {}),
        }
        if doc is not None:
            row["siteExchangeEvidence_v0"] = build_site_exchange_evidence_v0(
                doc=doc,
                unavailable_reason="no_document_or_step",
            )
            row["propertySetCoverageEvidence_v0"] = unavailable_property_set_coverage_evidence_v0(
                "no_document_or_step",
            )
        return row

    import ifcopenshell

    model = ifcopenshell.file.from_string(text)

    storeys = model.by_type("IfcBuildingStorey") or []
    n_storey = len(storeys)
    elevations_present = 0
    for st in storeys:
        el = getattr(st, "Elevation", None)
        if el is not None and isinstance(el, (int, float)):
            elevations_present += 1

    walls = model.by_type("IfcWall") or []
    slabs = model.by_type("IfcSlab") or []
    roofs = model.by_type("IfcRoof") or []
    stairs = model.by_type("IfcStair") or []
    openings = model.by_type("IfcOpeningElement") or []
    doors = model.by_type("IfcDoor") or []
    windows = model.by_type("IfcWindow") or []
    spaces = model.by_type("IfcSpace") or []
    site_products = model.by_type("IfcSite") or []
    qtys = model.by_type("IfcElementQuantity") or []

    def _count_pset_ref(ifc_products: list[Any], pset_name: str) -> int:
        c = 0
        for p in ifc_products:
            ps = ifc_elem_util.get_psets(p)
            bucket = ps.get(pset_name) or {}
            if bucket.get("Reference"):
                c += 1
        return c

    def _count_pset_property(ifc_products: list[Any], pset_name: str, property_name: str) -> int:
        c = 0
        for p in ifc_products:
            ps = ifc_elem_util.get_psets(p)
            bucket = ps.get(pset_name) or {}
            v = bucket.get(property_name)
            if isinstance(v, str) and v.strip():
                c += 1
        return c

    def _count_space_programme(pset_name: str, key: str) -> int:
        c = 0
        for sp in spaces:
            ps = ifc_elem_util.get_psets(sp)
            bucket = ps.get(pset_name) or {}
            if bucket.get(key):
                c += 1
        return c

    def _count_roofs_with_gable_body_v0(ifc_roofs: list[Any]) -> int:
        """IFC-02: count roofs whose body extrusion has a 3-vertex triangular profile."""
        c = 0
        for rfp in ifc_roofs:
            ex = _first_body_extruded_area_solid(rfp)
            if ex is None:
                continue
            swept = getattr(ex, "SweptArea", None)
            if swept is None:
                continue
            try:
                if not swept.is_a("IfcArbitraryClosedProfileDef"):
                    continue
            except Exception:
                continue
            outer = getattr(swept, "OuterCurve", None)
            if outer is None:
                continue
            poly = _profile_xy_polyline_mm(outer)
            if not poly:
                continue
            # Triangle: 3 unique points (closed polyline gives 4 entries with the
            # first repeated). Anything other than 3 unique vertices is not a gable.
            unique = []
            for pt in poly:
                if not unique or (
                    abs(pt[0] - unique[-1][0]) > 1e-6 or abs(pt[1] - unique[-1][1]) > 1e-6
                ):
                    unique.append(pt)
            if len(unique) >= 2 and (
                abs(unique[0][0] - unique[-1][0]) < 1e-6
                and abs(unique[0][1] - unique[-1][1]) < 1e-6
            ):
                unique = unique[:-1]
            if len(unique) == 3:
                c += 1
        return c

    qto_names = sorted({str(q.Name) for q in qtys if getattr(q, "Name", None)})

    # IFC-03: count openings by host kind (Roof / Slab / Wall / unknown).
    roof_hosted_opening_count = 0
    slab_hosted_opening_count = 0
    wall_hosted_opening_count = 0
    other_hosted_opening_count = 0
    for op_iter in openings:
        try:
            _rel_iter, host_iter = _void_rel_and_host_for_opening(op_iter, model)
        except Exception:
            host_iter = None
        if host_iter is None:
            other_hosted_opening_count += 1
            continue
        if _ifc_try_product_is_a(host_iter, "IfcRoof"):
            roof_hosted_opening_count += 1
        elif _ifc_try_product_is_a(host_iter, "IfcSlab"):
            slab_hosted_opening_count += 1
        elif _ifc_try_product_is_a(host_iter, "IfcWall"):
            wall_hosted_opening_count += 1
        else:
            other_hosted_opening_count += 1

    out: dict[str, Any] = {
        "matrixVersion": matrix_version,
        "available": True,
        "buildingStorey": {
            "count": n_storey,
            "elevationsPresent": elevations_present,
        },
        "products": {
            "IfcWall": len(walls),
            "IfcSlab": len(slabs),
            "IfcRoof": len(roofs),
            "IfcStair": len(stairs),
            "IfcOpeningElement": len(openings),
            "IfcDoor": len(doors),
            "IfcWindow": len(windows),
            "IfcSpace": len(spaces),
        },
        "openingsByHostKind": {
            "roof": roof_hosted_opening_count,
            "slab": slab_hosted_opening_count,
            "wall": wall_hosted_opening_count,
            "other": other_hosted_opening_count,
        },
        "identityPsets": {
            "wallWithPsetWallCommonReference": _count_pset_ref(list(walls), "Pset_WallCommon"),
            "slabWithPsetSlabCommonReference": _count_pset_ref(list(slabs), "Pset_SlabCommon"),
            "spaceWithPsetSpaceCommonReference": _count_pset_ref(list(spaces), "Pset_SpaceCommon"),
            "doorWithPsetDoorCommonReference": _count_pset_ref(list(doors), "Pset_DoorCommon"),
            "windowWithPsetWindowCommonReference": _count_pset_ref(
                list(windows), "Pset_WindowCommon"
            ),
            "roofWithPsetRoofCommonReference": _count_pset_ref(list(roofs), "Pset_RoofCommon"),
            "roofWithBimAiRoofTypeId": _count_pset_property(
                list(roofs), "Pset_BimAiKernel", "BimAiRoofTypeId"
            ),
            # IFC-02: count roofs whose IFC body uses a triangular gable
            # cross-section profile (vs the default flat extrusion).
            "roofWithGablePitchedBodyV0": _count_roofs_with_gable_body_v0(list(roofs)),
            "stairWithPsetStairCommonReference": _count_pset_ref(list(stairs), "Pset_StairCommon"),
            "siteWithPsetSiteCommonReference": _count_pset_ref(
                list(site_products), "Pset_SiteCommon"
            ),
        },
        "qtoLinkedProducts": {
            "IfcWall": _count_ifc_products_with_qto_template(list(walls), "Qto_WallBaseQuantities"),
            "IfcSlab": _count_ifc_products_with_qto_template(list(slabs), "Qto_SlabBaseQuantities"),
            "IfcSpace": _count_ifc_products_with_qto_template(
                list(spaces), "Qto_SpaceBaseQuantities"
            ),
            "IfcDoor": _count_ifc_products_with_qto_template(list(doors), "Qto_DoorBaseQuantities"),
            "IfcWindow": _count_ifc_products_with_qto_template(
                list(windows), "Qto_WindowBaseQuantities"
            ),
            "IfcStair": _count_ifc_products_with_qto_template(
                list(stairs), "Qto_StairBaseQuantities"
            ),
        },
        "spaceProgrammeFields": {
            "ProgrammeCode": _count_space_programme("Pset_SpaceCommon", "ProgrammeCode"),
            "Department": _count_space_programme("Pset_SpaceCommon", "Department"),
            "FunctionLabel": _count_space_programme("Pset_SpaceCommon", "FunctionLabel"),
            "FinishSet": _count_space_programme("Pset_SpaceCommon", "FinishSet"),
        },
        "qtoTemplates": qto_names,
        "importScopeUnsupportedIfcProducts_v0": import_scope_unsupported_ifc_products_v0(model),
        "siteExchangeEvidence_v0": build_site_exchange_evidence_v0(doc=doc, model=model),
        "materialLayerSetReadback_v0": kernel_ifc_material_layer_set_readback_v0(model, doc),
        "propertySetCoverageEvidence_v0": build_kernel_ifc_property_set_coverage_evidence_v0(
            model, doc
        ),
        "propertySetCoverageExpansion_v1": build_ifc_property_set_coverage_expansion_v1(model),
    }
    if skip_counts:
        out["ifcKernelGeometrySkippedCounts"] = skip_counts
    return out


def kernel_expected_space_programme_counts(doc: Document) -> dict[str, int]:
    """Per-field counts for emit-able rooms (outline ≥3) with non-empty programme strings."""

    fields = (
        ("ProgrammeCode", "programme_code"),
        ("Department", "department"),
        ("FunctionLabel", "function_label"),
        ("FinishSet", "finish_set"),
    )
    out = {k: 0 for k, _ in fields}
    for e in doc.elements.values():
        if not isinstance(e, RoomElem):
            continue
        if len(getattr(e, "outline_mm", ()) or ()) < 3:
            continue
        for key, attr in fields:
            raw = getattr(e, attr, None)
            if isinstance(raw, str) and raw.strip():
                out[key] += 1
    return out


from bim_ai.export_ifc_authoritative_replay import (  # noqa: E402,F401
    AUTHORITATIVE_REPLAY_STAIR_TOP_LEVEL_TOL_MM,
    _ifc_slab_predefined_type_token_v0,
    _ifc_slab_type_identity_reference_v0,
    _replay_infer_roof_overhang_mm_from_placement,
    _replay_infer_roof_slope_deg_from_prism_rise_m,
    _replay_level_ids_matching_elevation_mm,
    _replay_roof_world_z_center_m,
    _slab_gap_reason_counts_v0,
    _sort_authoritative_replay_extraction_gaps_v0,
    _space_pset_programme_cmd_kwargs,
    _space_pset_programme_json_fields,
    build_ifc_import_preview_v0,
    build_ifc_unsupported_merge_map_v0,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    build_kernel_ifc_authoritative_replay_sketch_v0_from_model,
    summarize_kernel_ifc_semantic_roundtrip,
)
