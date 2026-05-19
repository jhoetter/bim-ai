from __future__ import annotations

from typing import Any

import numpy as np

from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    FloorElem,
    FloorTypeElem,
    LevelElem,
    MaterialElem,
    PlacedAssetElem,
    RailingElem,
    RoofElem,
    RoofOpeningElem,
    RoofTypeElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WallTypeElem,
    WindowElem,
)
from bim_ai.export_ifc_geometry import room_outline_mm

try:
    import ifcopenshell.util.element as ifc_elem_util
    import ifcopenshell.util.placement as ifc_placement
except ImportError:
    ifc_elem_util = None  # type: ignore[misc, assignment]
    ifc_placement = None  # type: ignore[misc, assignment]


def _references_from_products(products: list[Any], pset_name: str, *, limit: int) -> list[str]:
    refs: set[str] = set()
    for p in products:
        ps = _ifc_product_psets(p)
        bucket = ps.get(pset_name) or {}
        ref = bucket.get("Reference")
        if isinstance(ref, str) and ref.strip():
            refs.add(ref.strip())
        if len(refs) >= limit:
            break
    return sorted(refs)


def _ifc_product_psets(product: Any) -> dict[str, Any]:
    """Read product Psets from IfcOpenShell or from fake test products."""

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


def _ifc_product_reference(product: Any, pset_name: str) -> str | None:
    bucket = _ifc_product_psets(product).get(pset_name) or {}
    ref = bucket.get("Reference")
    if isinstance(ref, str) and ref.strip():
        return ref.strip()
    return None


def _ifc_products_by_type(model: Any, type_name: str) -> list[Any]:
    try:
        products = model.by_type(type_name) or []
    except Exception:
        return []
    return list(products)


_KIND_READBACK_SPECS: tuple[dict[str, str | None], ...] = (
    {
        "kind": "wall",
        "ifcType": "IfcWall",
        "pset": "Pset_WallCommon",
        "qto": "Qto_WallBaseQuantities",
    },
    {
        "kind": "floor",
        "ifcType": "IfcSlab",
        "pset": "Pset_SlabCommon",
        "qto": "Qto_SlabBaseQuantities",
    },
    {
        "kind": "roof",
        "ifcType": "IfcRoof",
        "pset": "Pset_RoofCommon",
        "qto": "Qto_SlabBaseQuantities",
    },
    {
        "kind": "door",
        "ifcType": "IfcDoor",
        "pset": "Pset_DoorCommon",
        "qto": "Qto_DoorBaseQuantities",
    },
    {
        "kind": "window",
        "ifcType": "IfcWindow",
        "pset": "Pset_WindowCommon",
        "qto": "Qto_WindowBaseQuantities",
    },
    {
        "kind": "stair",
        "ifcType": "IfcStair",
        "pset": "Pset_StairCommon",
        "qto": "Qto_StairBaseQuantities",
    },
    {
        "kind": "railing",
        "ifcType": "IfcRailing",
        "pset": "Pset_RailingCommon",
        "qto": None,
    },
    {
        "kind": "room",
        "ifcType": "IfcSpace",
        "pset": "Pset_SpaceCommon",
        "qto": "Qto_SpaceBaseQuantities",
    },
    {
        "kind": "column",
        "ifcType": "IfcColumn",
        "pset": "Pset_ColumnCommon",
        "qto": None,
    },
    {
        "kind": "beam",
        "ifcType": "IfcBeam",
        "pset": "Pset_BeamCommon",
        "qto": None,
    },
    {
        "kind": "ceiling",
        "ifcType": "IfcCovering",
        "pset": "Pset_CoveringCommon",
        "qto": None,
    },
    {
        "kind": "placed_asset",
        "ifcType": "IfcFurnishingElement",
        "pset": "Pset_FurnitureTypeCommon",
        "qto": "Qto_FurnitureBaseQuantities",
    },
)


def kernel_ifc_source_topology_summary_v0(doc: Document) -> dict[str, Any]:
    """Document-side expected IFC kernel topology for read-back comparison."""

    wall_ids = sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem))
    level_ids = {eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)}
    floor_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, FloorElem) and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )
    roof_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, RoofElem) and len(getattr(e, "footprint_mm", ()) or ()) >= 3
    )
    door_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, DoorElem) and e.wall_id in wall_ids
    )
    window_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, WindowElem) and e.wall_id in wall_ids
    )
    stair_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, StairElem) and e.base_level_id in level_ids and e.top_level_id in level_ids
    )
    railing_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, RailingElem) and len(getattr(e, "path_mm", ()) or ()) >= 2
    )
    room_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, RoomElem) and len(room_outline_mm(e)) >= 3
    )
    column_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, ColumnElem) and e.level_id in level_ids
    )
    beam_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, BeamElem)
        and e.level_id in level_ids
        and (
            (float(e.end_mm.x_mm) - float(e.start_mm.x_mm)) ** 2
            + (float(e.end_mm.y_mm) - float(e.start_mm.y_mm)) ** 2
        )
        > 1e-6
    )
    ceiling_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, CeilingElem)
        and e.level_id in level_ids
        and len(e.boundary_mm) >= 3
    )
    placed_asset_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, PlacedAssetElem) and e.level_id in level_ids
    )
    floor_id_set = set(floor_ids)
    roof_id_set = set(roof_ids)
    slab_opening_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, SlabOpeningElem)
        and e.host_floor_id in floor_id_set
        and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )
    roof_opening_ids = sorted(
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, RoofOpeningElem)
        and e.host_roof_id in roof_id_set
        and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )

    kind_ids = {
        "wall": wall_ids,
        "floor": floor_ids,
        "roof": roof_ids,
        "door": door_ids,
        "window": window_ids,
        "stair": stair_ids,
        "railing": railing_ids,
        "room": room_ids,
        "column": column_ids,
        "beam": beam_ids,
        "ceiling": ceiling_ids,
        "placed_asset": placed_asset_ids,
    }

    def _type_ids(attr: str, ids: list[str]) -> list[str]:
        out: set[str] = set()
        for eid in ids:
            raw = getattr(doc.elements.get(eid), attr, None)
            if isinstance(raw, str) and raw.strip():
                out.add(raw.strip())
        return sorted(out)

    material_keys: set[str] = set()
    classification_ids: list[str] = []
    for eid, elem in sorted(doc.elements.items()):
        mat = getattr(elem, "material_key", None)
        if isinstance(mat, str) and mat.strip():
            material_keys.add(mat.strip())
        for key in (getattr(elem, "material_slots", None) or {}).values():
            if isinstance(key, str) and key.strip():
                material_keys.add(key.strip())
        code = getattr(elem, "ifc_classification_code", None)
        if isinstance(code, str) and code.strip():
            classification_ids.append(eid)

    for elem in doc.elements.values():
        if isinstance(elem, (WallTypeElem, FloorTypeElem, RoofTypeElem)):
            for layer in elem.layers:
                if layer.material_key:
                    material_keys.add(layer.material_key)

    return {
        "schemaVersion": 0,
        "kindElementIds": kind_ids,
        "countsByKind": {k: len(v) for k, v in kind_ids.items()},
        "openingElementIds": {
            "wallHosted": sorted([*door_ids, *window_ids]),
            "slabHosted": slab_opening_ids,
            "roofHosted": roof_opening_ids,
        },
        "openingCountsByHostKind": {
            "wall": len(door_ids) + len(window_ids),
            "slab": len(slab_opening_ids),
            "roof": len(roof_opening_ids),
        },
        "semanticExpectations": {
            "typeIdsByKind": {
                "wall": _type_ids("wall_type_id", wall_ids),
                "floor": _type_ids("floor_type_id", floor_ids),
                "roof": _type_ids("roof_type_id", roof_ids),
                "door": _type_ids("family_type_id", door_ids),
                "window": _type_ids("family_type_id", window_ids),
            },
            "materialKeys": sorted(material_keys),
            "materialCatalogCount": sum(
                1 for e in doc.elements.values() if isinstance(e, MaterialElem)
            ),
            "classificationElementIds": sorted(classification_ids),
            "qtoExpectedKinds": sorted(
                k for k, ids in kind_ids.items() if ids and k != "railing"
            ),
        },
    }


def build_kernel_ifc_geometry_readback_summary_v0(model: Any, doc: Document | None) -> dict[str, Any]:
    """Compare supported IFC product read-back against source kernel topology."""

    if doc is None:
        return {
            "schemaVersion": 0,
            "available": False,
            "reason": "no_document",
        }

    source = kernel_ifc_source_topology_summary_v0(doc)
    expected_by_kind: dict[str, list[str]] = source["kindElementIds"]
    rows: dict[str, Any] = {}
    all_matched = True
    readback_counts_by_kind: dict[str, int] = {}

    for spec in _KIND_READBACK_SPECS:
        kind = str(spec["kind"])
        ifc_type = str(spec["ifcType"])
        pset = str(spec["pset"])
        qto_name = spec["qto"]
        products = _ifc_products_by_type(model, ifc_type)
        readback_counts_by_kind[kind] = len(products)
        expected_ids = expected_by_kind.get(kind, [])
        expected_set = set(expected_ids)
        refs = sorted(
            ref
            for ref in (_ifc_product_reference(p, pset) for p in products)
            if isinstance(ref, str) and ref
        )
        ref_set = set(refs)
        matched = sorted(expected_set & ref_set)
        missing = sorted(expected_set - ref_set)
        unexpected = sorted(ref_set - expected_set)
        body_count = sum(1 for p in products if _first_body_extruded_area_solid(p) is not None)
        qto_count = (
            _count_ifc_products_with_qto_template(products, str(qto_name)) if qto_name else None
        )
        kind_matched = (
            len(products) == len(expected_ids)
            and not missing
            and not unexpected
            and body_count >= len(expected_ids)
        )
        if qto_count is not None:
            kind_matched = kind_matched and qto_count >= len(expected_ids)
        if not kind_matched:
            all_matched = False
        row: dict[str, Any] = {
            "ifcType": ifc_type,
            "pset": pset,
            "expected": len(expected_ids),
            "readbackProducts": len(products),
            "productsWithBody": body_count,
            "productsWithReference": len(refs),
            "matchedReferenceIds": matched,
            "missingReferenceIds": missing,
            "unexpectedReferenceIds": unexpected,
        }
        if qto_name:
            row["qtoTemplate"] = qto_name
            row["productsWithQto"] = qto_count
        rows[kind] = row

    openings = _ifc_products_by_type(model, "IfcOpeningElement")
    opening_counts = {"wall": 0, "slab": 0, "roof": 0, "other": 0}
    for op in openings:
        try:
            _rel, host = _void_rel_and_host_for_opening(op, model)
        except Exception:
            host = None
        if host is not None and _ifc_try_product_is_a(host, "IfcWall"):
            opening_counts["wall"] += 1
        elif host is not None and _ifc_try_product_is_a(host, "IfcSlab"):
            opening_counts["slab"] += 1
        elif host is not None and _ifc_try_product_is_a(host, "IfcRoof"):
            opening_counts["roof"] += 1
        else:
            opening_counts["other"] += 1

    expected_openings = source["openingCountsByHostKind"]
    opening_delta = {
        key: opening_counts.get(key, 0) - int(expected_openings.get(key, 0))
        for key in ("wall", "slab", "roof")
    }
    if any(v != 0 for v in opening_delta.values()) or opening_counts["other"]:
        all_matched = False

    slab_types = _ifc_products_by_type(model, "IfcSlabType")
    roof_type_psets = 0
    for roof in _ifc_products_by_type(model, "IfcRoof"):
        bucket = _ifc_product_psets(roof).get("Pset_BimAiKernel") or {}
        if bucket.get("BimAiRoofTypeId"):
            roof_type_psets += 1
    quantity_templates = sorted(
        {
            str(q.Name)
            for q in _ifc_products_by_type(model, "IfcElementQuantity")
            if getattr(q, "Name", None)
        }
    )
    semantic_readback = {
        "types": {
            "IfcSlabType": len(slab_types),
            "IfcSlabTypeReferenceIds": _references_from_products(
                slab_types, "Pset_SlabCommon", limit=250
            ),
            "roofWithBimAiRoofTypeId": roof_type_psets,
        },
        "materials": {
            "IfcMaterial": len(_ifc_products_by_type(model, "IfcMaterial")),
            "IfcRelAssociatesMaterial": len(_ifc_products_by_type(model, "IfcRelAssociatesMaterial")),
        },
        "classifications": {
            "IfcClassification": len(_ifc_products_by_type(model, "IfcClassification")),
            "IfcClassificationReference": len(
                _ifc_products_by_type(model, "IfcClassificationReference")
            ),
            "IfcRelAssociatesClassification": len(
                _ifc_products_by_type(model, "IfcRelAssociatesClassification")
            ),
        },
        "quantities": {
            "IfcElementQuantity": len(_ifc_products_by_type(model, "IfcElementQuantity")),
            "templates": quantity_templates,
        },
    }
    drift_findings = _ifc_readback_drift_findings_v0(
        rows=rows,
        opening_delta=opening_delta,
        opening_counts=opening_counts,
    )

    return {
        "schemaVersion": 0,
        "available": True,
        "allMatched": all_matched,
        "source": source,
        "readbackCountsByKind": readback_counts_by_kind,
        "coverageByKind": rows,
        "openingTopology": {
            "expectedByHostKind": expected_openings,
            "readbackByHostKind": opening_counts,
            "deltaByHostKind": opening_delta,
        },
        "semanticReadback": semantic_readback,
        "driftTolerancePolicy": {
            "schemaVersion": 0,
            "identityTolerance": "exact_reference_id_match",
            "countTolerance": 0,
            "bodyTolerance": "every_expected_product_has_body",
            "qtoTolerance": "every_expected_product_has_quantity_template_when_applicable",
            "openingTopologyTolerance": "exact_by_host_kind",
        },
        "driftFindings": drift_findings,
    }


def _ifc_readback_drift_findings_v0(
    *,
    rows: dict[str, Any],
    opening_delta: dict[str, int],
    opening_counts: dict[str, int],
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for kind, row in sorted(rows.items()):
        expected = int(row.get("expected") or 0)
        if row.get("missingReferenceIds"):
            findings.append(
                {
                    "code": "ifc_readback_missing_reference",
                    "severity": "error",
                    "kind": kind,
                    "expected": expected,
                    "actual": int(row.get("productsWithReference") or 0),
                    "elementIds": row.get("missingReferenceIds"),
                    "tolerance": 0,
                    "trackerItems": ["BIR-K02", "BIR-K04"],
                }
            )
        if row.get("unexpectedReferenceIds"):
            findings.append(
                {
                    "code": "ifc_readback_unexpected_reference",
                    "severity": "warning",
                    "kind": kind,
                    "elementIds": row.get("unexpectedReferenceIds"),
                    "tolerance": 0,
                    "trackerItems": ["BIR-K02", "BIR-K04"],
                }
            )
        if int(row.get("productsWithBody") or 0) < expected:
            findings.append(
                {
                    "code": "ifc_readback_body_gap",
                    "severity": "error",
                    "kind": kind,
                    "expected": expected,
                    "actual": int(row.get("productsWithBody") or 0),
                    "tolerance": 0,
                    "trackerItems": ["BIR-K02"],
                }
            )
        if row.get("productsWithQto") is not None and int(row.get("productsWithQto") or 0) < expected:
            findings.append(
                {
                    "code": "ifc_readback_qto_gap",
                    "severity": "warning",
                    "kind": kind,
                    "expected": expected,
                    "actual": int(row.get("productsWithQto") or 0),
                    "tolerance": 0,
                    "trackerItems": ["BIR-K02", "BIR-K04"],
                }
            )
    for host_kind, delta in sorted(opening_delta.items()):
        if delta != 0:
            findings.append(
                {
                    "code": "ifc_opening_topology_count_drift",
                    "severity": "error",
                    "hostKind": host_kind,
                    "delta": delta,
                    "tolerance": 0,
                    "trackerItems": ["BIR-K02"],
                }
            )
    if opening_counts.get("other"):
        findings.append(
            {
                "code": "ifc_opening_topology_unresolved_host",
                "severity": "error",
                "count": opening_counts["other"],
                "tolerance": 0,
                "trackerItems": ["BIR-K02"],
            }
        )
    return findings


def _ifc_product_defines_qto_template(product: Any, qto_template_name: str) -> bool:
    rels = getattr(product, "IsDefinedBy", None) or []
    for rel in rels:
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


def _count_ifc_products_with_qto_template(products: list[Any], qto_template_name: str) -> int:
    """Count IFC products that define an ``IfcElementQuantity`` with the given name."""
    return sum(1 for p in products if _ifc_product_defines_qto_template(p, qto_template_name))


def _read_named_qto_values(product: Any, qto_template_name: str) -> dict[str, float]:
    """Read scalar quantity values from a named IfcElementQuantity attached to a product."""
    rels = getattr(product, "IsDefinedBy", None) or []
    for rel in rels:
        try:
            if not rel.is_a("IfcRelDefinesByProperties"):
                continue
        except Exception:
            continue
        dfn = getattr(rel, "RelatingPropertyDefinition", None)
        if dfn is None:
            continue
        try:
            if not dfn.is_a("IfcElementQuantity"):
                continue
            if getattr(dfn, "Name", None) != qto_template_name:
                continue
        except Exception:
            continue
        result: dict[str, float] = {}
        for qty in getattr(dfn, "Quantities", None) or []:
            name = str(getattr(qty, "Name", None) or "")
            for attr in ("CountValue", "LengthValue", "AreaValue", "VolumeValue", "WeightValue"):
                val = getattr(qty, attr, None)
                if val is not None:
                    try:
                        result[name] = float(val)
                    except (ValueError, TypeError):
                        pass
                    break
        return result
    return {}


def _ifc_global_id_slug(raw: Any) -> str:
    s = str(raw or "").strip()
    if not s:
        return "ifc_empty_gid"
    return "".join(ch if ch.isalnum() else "_" for ch in s)


def _product_host_storey_global_id(product: Any) -> str | None:
    """Host ``IfcBuildingStorey`` from spatial containment or aggregate."""

    for rel in getattr(product, "ContainedInStructure", None) or []:
        st = getattr(rel, "RelatingStructure", None)
        if st is None:
            continue
        try:
            if st.is_a("IfcBuildingStorey"):
                gid = getattr(st, "GlobalId", None)
                return str(gid) if gid else None
        except Exception:
            continue
    for rel in getattr(product, "Decomposes", None) or []:
        try:
            if not rel.is_a("IfcRelAggregates"):
                continue
        except Exception:
            continue
        st = getattr(rel, "RelatingObject", None)
        if st is None:
            continue
        try:
            if st.is_a("IfcBuildingStorey"):
                gid = getattr(st, "GlobalId", None)
                return str(gid) if gid else None
        except Exception:
            continue
    return None


def _profile_xy_polyline_mm(outer_curve: Any) -> list[tuple[float, float]] | None:
    """2D profile vertices (mm) for kernel-style wall section in the extrusion local frame."""

    try:
        if outer_curve.is_a("IfcIndexedPolyCurve"):
            pts = outer_curve.Points
            if pts is None:
                return None
            out: list[tuple[float, float]] = []
            for row in pts.CoordList or []:
                if len(row) >= 2:
                    out.append((float(row[0]), float(row[1])))
            return out or None
        if outer_curve.is_a("IfcPolyline"):
            out2: list[tuple[float, float]] = []
            for p in outer_curve.Points or []:
                c = p.Coordinates
                if len(c) >= 2:
                    out2.append((float(c[0]), float(c[1])))
            return out2 or None
    except Exception:
        return None
    return None


def _first_body_extruded_area_solid(product: Any) -> Any | None:
    pdef = getattr(product, "Representation", None)
    if pdef is None:
        return None
    for rep in pdef.Representations or []:
        try:
            if getattr(rep, "RepresentationIdentifier", None) != "Body":
                continue
        except Exception:
            continue
        for it in rep.Items or []:
            try:
                if it.is_a("IfcExtrudedAreaSolid"):
                    return it
            except Exception:
                continue
    return None


def _kernel_wall_plan_geometry_mm(wall: Any) -> dict[str, float] | None:
    """Recover createWall-style spine + thickness + height from kernel extruded wall body."""

    if ifc_placement is None:
        return None
    ex = _first_body_extruded_area_solid(wall)
    if ex is None:
        return None
    try:
        depth = float(ex.Depth)
    except Exception:
        return None
    if depth <= 1e-6:
        return None

    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 3:
        return None

    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    length_mm = max_x - min_x
    thick_mm = max_y - min_y
    if length_mm < 1e-3 or thick_mm < 1e-3:
        return None

    M = ifc_placement.get_local_placement(wall.ObjectPlacement)
    lx0, ly0 = float(min_x), float(min_y)
    lx1, ly1 = float(max_x), float(min_y)
    v0 = M @ np.array([lx0, ly0, 0.0, 1.0])
    v1 = M @ np.array([lx1, ly1, 0.0, 1.0])

    return {
        "start_x_mm": float(v0[0]),
        "start_y_mm": float(v0[1]),
        "end_x_mm": float(v1[0]),
        "end_y_mm": float(v1[1]),
        "thickness_mm": thick_mm,
        "height_mm": depth,
    }


def _kernel_space_footprint_outline_mm(space: Any) -> list[tuple[float, float]] | None:
    """Recover plan outline (mm) from kernel-style IfcSpace slab extrusion + placement."""

    if ifc_placement is None:
        return None
    ex = _first_body_extruded_area_solid(space)
    if ex is None:
        return None
    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 3:
        return None

    M = ifc_placement.get_local_placement(space.ObjectPlacement)
    out_mm: list[tuple[float, float]] = []
    for lx, ly in poly:
        v = M @ np.array([float(lx), float(ly), 0.0, 1.0])
        out_mm.append((float(v[0]), float(v[1])))

    def _same_pt(a: tuple[float, float], b: tuple[float, float], tol: float = 1e-2) -> bool:
        return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol

    if len(out_mm) >= 2 and _same_pt(out_mm[0], out_mm[-1]):
        out_mm = out_mm[:-1]
    return out_mm if len(out_mm) >= 3 else None


def _ifc_inverse_seq_local(val: Any) -> list[Any]:
    """IfcOpenShell inverses may be ``[]``, ``()``, one entity, or None."""

    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        return [x for x in val if x is not None]
    return [val]


def _ifc_rel_voids_host_building_element(rel: Any) -> Any | None:
    """Host element from ``IfcRelVoidsElement`` (tolerate attribute naming variants)."""

    for attr in ("RelatingBuildingElement", "RelatedBuildingElement"):
        h = getattr(rel, attr, None)
        if h is not None:
            return h
    return None


def _ifc_try_product_is_a(product: Any, root: str) -> bool:
    try:
        return bool(product.is_a(root))
    except Exception:
        return False


def _kernel_horizontal_extrusion_footprint_mm_and_thickness(
    product: Any,
) -> tuple[list[tuple[float, float]], float] | None:
    """Plan outline (mm) + slab-style extrusion depth (mm) for kernel ``IfcExtrudedAreaSolid`` bodies."""

    if ifc_placement is None:
        return None
    ex = _first_body_extruded_area_solid(product)
    if ex is None:
        return None
    try:
        depth_raw = abs(float(ex.Depth))
    except Exception:
        return None
    if depth_raw <= 1e-9:
        return None
    depth_mm = depth_raw * 1000.0 if depth_raw <= 20.0 else depth_raw
    if depth_mm <= 1e-3:
        return None
    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 3:
        return None

    M = ifc_placement.get_local_placement(product.ObjectPlacement)
    out_mm: list[tuple[float, float]] = []
    for lx, ly in poly:
        v = M @ np.array([float(lx), float(ly), 0.0, 1.0])
        out_mm.append((float(v[0]), float(v[1])))

    def _same_poly_close(a: tuple[float, float], b: tuple[float, float], tol: float = 1e-2) -> bool:
        return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol

    if len(out_mm) >= 2 and _same_poly_close(out_mm[0], out_mm[-1]):
        out_mm = out_mm[:-1]
    if len(out_mm) < 3:
        return None
    return out_mm, float(depth_mm)


def _kernel_slab_opening_replay_element_id(opening: Any) -> str:
    """Recover kernel slab-opening id: export names slab voids ``op:<kernelElemId>``."""

    gid = str(getattr(opening, "GlobalId", None) or "")
    nm = str(getattr(opening, "Name", None) or "").strip()
    if nm.startswith("op:"):
        rest = nm[3:].strip()
        if rest:
            return rest
    return _ifc_global_id_slug(gid)


def _void_rel_and_host_for_opening(opening: Any, model: Any) -> tuple[Any | None, Any | None]:
    """Locate ``IfcRelVoidsElement`` + host for ``opening``."""

    og = str(getattr(opening, "GlobalId", None) or "")

    def _opening_matches(ro: Any) -> bool:
        if ro is None:
            return False
        if ro is opening:
            return True
        rg = str(getattr(ro, "GlobalId", None) or "")
        return bool(og and rg and og == rg)

    for rel in _ifc_inverse_seq_local(getattr(opening, "VoidsElements", None)):
        try:
            if not rel.is_a("IfcRelVoidsElement"):
                continue
        except Exception:
            continue
        ro = getattr(rel, "RelatedOpeningElement", None)
        if not _opening_matches(ro):
            continue
        host = _ifc_rel_voids_host_building_element(rel)
        if host is None:
            continue
        return rel, host

    for rel in model.by_type("IfcRelVoidsElement") or []:
        try:
            if not rel.is_a("IfcRelVoidsElement"):
                continue
        except Exception:
            continue
        ro = getattr(rel, "RelatedOpeningElement", None)
        if not _opening_matches(ro):
            continue
        host = _ifc_rel_voids_host_building_element(rel)
        if host is None:
            continue
        return rel, host

    return None, None


def _ifc_model_has_slab_void_opening_topology_v0(model: Any) -> bool:
    for rel in model.by_type("IfcRelVoidsElement") or []:
        try:
            if not rel.is_a("IfcRelVoidsElement"):
                continue
        except Exception:
            continue
        ro = getattr(rel, "RelatedOpeningElement", None)
        if ro is None or not _ifc_try_product_is_a(ro, "IfcOpeningElement"):
            continue
        host = _ifc_rel_voids_host_building_element(rel)
        if host is not None and _ifc_try_product_is_a(host, "IfcSlab"):
            return True
    return False
