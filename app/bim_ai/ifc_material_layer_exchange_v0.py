"""IFC material layer set export + read-back evidence (WP-X03 / materials parity)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import FloorElem, FloorTypeElem, RoofElem, RoofTypeElem, WallElem, WallTypeElem
from bim_ai.material_assembly_resolve import (
    resolved_layers_for_floor,
    resolved_layers_for_roof,
    resolved_layers_for_wall,
)
from bim_ai.material_catalog import ifc_standard_material_category, resolve_material
from bim_ai.type_material_registry import material_display_label


def _try_attach_material_pset(f: Any, ifc_material: Any, material_key: str) -> None:
    """IFC-04: stamp Pset_MaterialCommon (Reference / BaseColor / Roughness / Metalness)
    onto an IfcMaterial so MAT-01 catalog metadata round-trips with the IFC."""

    try:
        from ifcopenshell.api.pset.add_pset import add_pset  # noqa: PLC0415
        from ifcopenshell.api.pset.edit_pset import edit_pset  # noqa: PLC0415
    except ImportError:
        return
    spec = resolve_material(material_key)
    if spec is None:
        try:
            ps = add_pset(f, product=ifc_material, name="Pset_MaterialCommon")
            edit_pset(f, pset=ps, properties={"Reference": str(material_key)})
        except Exception:
            return
        return
    props: dict[str, Any] = {
        "Reference": str(material_key),
        "BaseColor": str(spec.base_color),
        "Roughness": float(spec.roughness),
        "Metalness": float(spec.metalness),
        "DisplayName": str(spec.display_name),
        "Category": str(spec.category),
    }
    try:
        ps = add_pset(f, product=ifc_material, name="Pset_MaterialCommon")
        edit_pset(f, pset=ps, properties=props)
    except Exception:
        return


def try_attach_kernel_ifc_single_material(
    f: Any,
    *,
    product: Any,
    material_key: str | None,
    material_by_key_cache: dict[str, Any],
) -> None:
    """IFC-04: associate a single IfcMaterial with a product (door / window /
    plain wall) via IfcRelAssociatesMaterial. Best-effort; returns silently
    when ifcopenshell is unavailable or `material_key` is empty."""

    if not material_key:
        return
    key = str(material_key).strip()
    if not key:
        return
    try:
        import ifcopenshell.api.material  # noqa: PLC0415
    except ImportError:
        return
    try:
        mat_ent = material_by_key_cache.get(key)
        if mat_ent is None:
            ifc_cat = ifc_standard_material_category(key)
            spec = resolve_material(key)
            # IFC-04: prefer the IFC4-standard category ("Wood", "Concrete",
            # "Glass" …); fall back to the raw MAT-01 token only when the
            # mapping is unknown so legacy clients still see *something*.
            cat = (
                str(ifc_cat)[:64]
                if ifc_cat is not None
                else str(spec.category)[:64]
                if spec is not None
                else None
            )
            kwargs: dict[str, Any] = {"name": str(key)[:126]}
            if cat is not None:
                kwargs["category"] = cat
            mat_ent = ifcopenshell.api.material.add_material(f, **kwargs)
            _try_attach_material_pset(f, mat_ent, key)
            material_by_key_cache[key] = mat_ent
        ifcopenshell.api.material.assign_material(
            f, products=[product], type="IfcMaterial", material=mat_ent
        )
    except Exception:
        return

try:
    import ifcopenshell.util.element as _ifc_elem_util
except ImportError:
    _ifc_elem_util = None  # type: ignore[misc, assignment]

_KERNEL_IFC_MATERIAL_LAYER_READBACK_EPS_MM = 0.05


def _kernel_ifc_material_name_for_layer_export(lyr: dict[str, Any]) -> str:
    mk = str(lyr.get("materialKey") or "").strip()
    if mk:
        return mk
    fn = str(lyr.get("function") or "layer").strip() or "layer"
    return f"bim_ai:no_key:{fn}"


def try_attach_kernel_ifc_material_layer_set(
    f: Any,
    doc: Document,
    product: Any,
    *,
    layers: list[dict[str, Any]],
    layer_set_display_name: str,
    material_by_key_cache: dict[str, Any],
) -> None:
    """Attach IfcMaterialLayerSet to a kernel product (occurrence). Best-effort."""

    if not layers:
        return
    try:
        import ifcopenshell.api.material  # noqa: PLC0415
    except ImportError:
        return
    try:
        ls_name = (layer_set_display_name or "").strip() or "bim_ai_material_layer_set"
        material_set = ifcopenshell.api.material.add_material_set(
            f, name=str(ls_name)[:126], set_type="IfcMaterialLayerSet"
        )
        idx = 0
        for lyr in layers:
            thickness_m = float(lyr.get("thicknessMm", 0) or 0) / 1000.0
            if thickness_m <= 1e-9:
                continue
            mtok = _kernel_ifc_material_name_for_layer_export(lyr)
            idx += 1
            cache_key = mtok if mtok else f"__bim_ai_idx_{idx}"
            # IFC-04: when the layer's `materialKey` resolves to a MAT-01
            # spec we map its category to the IFC4-standard string for
            # IfcMaterial.Category; fall back to the layer function only
            # when the material is unknown so legacy categories still ship.
            mat_key_raw = str(lyr.get("materialKey") or "").strip()
            ifc_cat = ifc_standard_material_category(mat_key_raw) if mat_key_raw else None
            cat = ifc_cat or (str(lyr.get("function") or "layer").strip() or "layer")
            mat_ent = material_by_key_cache.get(cache_key)
            if mat_ent is None:
                mat_ent = ifcopenshell.api.material.add_material(
                    f,
                    name=str(mtok)[:126],
                    category=str(cat)[:64],
                )
                # IFC-04: attach Pset_MaterialCommon with MAT-01 metadata
                # so each layered material round-trips with its catalog
                # attributes, not just its name.
                _try_attach_material_pset(f, mat_ent, mtok)
                material_by_key_cache[cache_key] = mat_ent
            layer_ent = ifcopenshell.api.material.add_layer(
                f, layer_set=material_set, material=mat_ent
            )
            ifcopenshell.api.material.edit_layer(
                f, layer=layer_ent, attributes={"LayerThickness": float(thickness_m)}
            )

        layer_list = list(getattr(material_set, "MaterialLayers", None) or [])
        if not layer_list:
            return

        ifcopenshell.api.material.assign_material(
            f, products=[product], type="IfcMaterialLayerSet", material=material_set
        )
    except Exception:
        return


def kernel_ifc_material_layer_set_readback_v0(model: Any, doc: Document | None) -> dict[str, Any]:
    """Parses IFC for material layer stacks on walls / slabs / roofs + doc expectation."""

    schema_version = 0
    hosts: list[dict[str, Any]] = []

    _row_specs: list[tuple[tuple[str, ...], str, str]] = [
        (("IfcWall",), "Pset_WallCommon", "wall"),
        (("IfcSlab",), "Pset_SlabCommon", "floor"),
        (("IfcRoof",), "Pset_RoofCommon", "roof"),
    ]

    if _ifc_elem_util is None:
        return {
            "schemaVersion": schema_version,
            "available": False,
            "reason": "ifc_elem_util_missing",
            "hosts": [],
            "summary": {},
        }

    def _product_sort_key(p: Any) -> str:
        return str(getattr(p, "GlobalId", None) or "")

    def _ref_from_pset(p: Any, pset_name: str) -> str | None:
        ps = _ifc_elem_util.get_psets(p)
        bucket = ps.get(pset_name) or {}
        ref = bucket.get("Reference")
        return ref.strip() if isinstance(ref, str) and ref.strip() else None

    def _type_label_for_host(host_kind: str, host_id: str) -> tuple[str, str | None]:
        if doc is None:
            return "", None
        el = doc.elements.get(host_id)
        if host_kind == "wall" and isinstance(el, WallElem):
            tid = (el.wall_type_id or "").strip()
            if not tid:
                return "", None
            wt = doc.elements.get(tid)
            if isinstance(wt, WallTypeElem):
                return tid, wt.name or tid
            return tid, None
        if host_kind == "floor" and isinstance(el, FloorElem):
            tid = (el.floor_type_id or "").strip()
            if not tid:
                return "", None
            ft = doc.elements.get(tid)
            if isinstance(ft, FloorTypeElem):
                return tid, ft.name or tid
            return tid, None
        if host_kind == "roof" and isinstance(el, RoofElem):
            tid = (el.roof_type_id or "").strip()
            if not tid:
                return "", None
            rt = doc.elements.get(tid)
            if isinstance(rt, RoofTypeElem):
                return tid, rt.name or tid
            return tid, None
        return "", None

    def _doc_layers_for(host_kind: str, host_id: str) -> list[dict[str, Any]] | None:
        if doc is None:
            return None
        el = doc.elements.get(host_id)
        if host_kind == "wall" and isinstance(el, WallElem):
            return resolved_layers_for_wall(doc, el)
        if host_kind == "floor" and isinstance(el, FloorElem):
            return resolved_layers_for_floor(doc, el)
        if host_kind == "roof" and isinstance(el, RoofElem):
            lay = resolved_layers_for_roof(doc, el)
            return lay if lay else None
        return None

    for prod_types, pset_name, host_kind_literal in _row_specs:
        prods: list[Any] = []
        for t in prod_types:
            prods.extend(model.by_type(t) or [])
        for p in sorted(prods, key=_product_sort_key):
            hid = _ref_from_pset(p, pset_name)
            if not hid:
                continue
            tid, tnm = _type_label_for_host(host_kind_literal, hid)
            doc_layers = _doc_layers_for(host_kind_literal, hid)
            expect_tokens = (
                [_kernel_ifc_material_name_for_layer_export(lyr) for lyr in (doc_layers or [])]
                if doc_layers is not None
                else []
            )

            mlayers_safe: list[Any] = []
            try:
                mlayers_safe = list(_ifc_elem_util.get_material_layers(p) or [])
            except Exception:
                mlayers_safe = []

            ifc_tokens: list[str] = []
            for pl in mlayers_safe:
                mat = getattr(pl, "material", None)
                nm = str(getattr(mat, "Name", None) or "").strip()
                ifc_tokens.append(nm)

            thick_ifc_mm = round(
                sum(float(getattr(pl, "thickness", 0.0) or 0.0) for pl in mlayers_safe) * 1000.0, 3
            )
            n_ifc = len(mlayers_safe)
            n_doc = len(doc_layers) if doc_layers is not None else 0

            thick_doc_mm = round(
                sum(float(lyr.get("thicknessMm", 0) or 0) for lyr in (doc_layers or [])), 3
            )

            status = "partial_mismatch"
            if doc is None or doc_layers is None:
                status = "no_document_expectation"
            elif n_ifc <= 0 and n_doc > 0:
                status = "missing_in_ifc"
            elif n_ifc > 0 and doc_layers:
                tk_match = len(expect_tokens) == len(ifc_tokens) and all(
                    a == b for a, b in zip(expect_tokens, ifc_tokens, strict=True)
                )
                dn = n_doc == n_ifc
                dt = (
                    abs(thick_doc_mm - thick_ifc_mm)
                    <= _KERNEL_IFC_MATERIAL_LAYER_READBACK_EPS_MM + 1e-6
                )
                status = "matched" if dn and dt and tk_match else "partial_mismatch"
            elif n_ifc > 0:
                status = "partial_mismatch"
            hosts.append(
                {
                    "hostElementId": hid,
                    "hostKind": host_kind_literal,
                    "hostIfcClass": prod_types[0],
                    "typeElementId": tid or None,
                    "typeName": tnm,
                    "docLayerCount": n_doc if doc_layers is not None else None,
                    "docTotalThicknessMm": thick_doc_mm if doc_layers is not None else None,
                    "ifcLayerCount": n_ifc,
                    "ifcTotalThicknessMm": thick_ifc_mm,
                    "materialKeysOrLabelsExpected": expect_tokens
                    if doc_layers is not None
                    else None,
                    "materialTokensReadFromIfc": ifc_tokens if ifc_tokens else None,
                    "readbackState": status,
                    "materialCatalogLabelsExpected": (
                        [
                            material_display_label(
                                doc, str(lyr.get("materialKey") or "").strip() or None
                            )
                            for lyr in (doc_layers or [])
                        ]
                        if doc is not None and doc_layers is not None
                        else None
                    ),
                }
            )

    hosts.sort(
        key=lambda r: (
            str(r.get("hostKind") or ""),
            str(r.get("hostElementId") or ""),
            str(r.get("hostIfcClass") or ""),
        )
    )

    tracked = [
        h
        for h in hosts
        if h.get("docLayerCount") is not None and int(h.get("docLayerCount") or 0) > 0
    ]
    n_matched = sum(1 for h in tracked if h.get("readbackState") == "matched")
    summary = {
        "hostsCompared": len(tracked),
        "hostsMatched": int(n_matched),
        "hostsMissingIfcLayers": sum(
            1 for h in tracked if h.get("readbackState") == "missing_in_ifc"
        ),
        "hostsPartialMismatch": sum(
            1 for h in tracked if h.get("readbackState") == "partial_mismatch"
        ),
        "hostsNoDocExpectation": sum(
            1 for h in hosts if h.get("readbackState") == "no_document_expectation"
        ),
    }
    summary["allMatchedComparedHosts"] = bool(not tracked or n_matched == len(tracked))

    return {"schemaVersion": schema_version, "available": True, "hosts": hosts, "summary": summary}
