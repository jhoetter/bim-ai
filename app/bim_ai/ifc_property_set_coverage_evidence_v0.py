"""IFC property set coverage + IDS-oriented gap tokens (WP-X03 / WP-X05)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    FloorTypeElem,
    RoofElem,
    RoomElem,
    SiteElem,
    StairElem,
    WindowElem,
)

try:
    import ifcopenshell.util.element as _ifc_elem_util
except ImportError:
    _ifc_elem_util = None  # type: ignore[misc, assignment]

_SCHEMA_VERSION = 0

_SPACE_PROGRAMME_FIELDS = (
    ("ProgrammeCode", "programme_code"),
    ("Department", "department"),
    ("FunctionLabel", "function_label"),
    ("FinishSet", "finish_set"),
)


def unavailable_property_set_coverage_evidence_v0(reason: str) -> dict[str, Any]:
    return {
        "schemaVersion": _SCHEMA_VERSION,
        "available": False,
        "reason": reason,
        "rows": [],
        "summary": {
            "rowsTotal": 0,
            "rowsOk": 0,
            "rowsWithGap": 0,
            "idsGapReasonCounts": {},
            "slabVoidOpeningsWithoutIdentityPset": 0,
        },
    }


def _ifc_gid_slug(ent: Any) -> str:
    raw = getattr(ent, "GlobalId", None)
    s = str(raw or "").strip()
    if not s:
        return "ifc_empty_gid"
    return "".join(ch if ch.isalnum() else "_" for ch in s)


def _product_sort_key(p: Any) -> str:
    return str(getattr(p, "GlobalId", None) or "")


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


def _exported_pset_snapshot(product: Any) -> tuple[list[str], dict[str, list[str]]]:
    if _ifc_elem_util is None:
        return [], {}
    ps = _ifc_elem_util.get_psets(product)
    names = sorted(ps.keys())
    by_pset: dict[str, list[str]] = {}
    for pname in names:
        bucket = ps.get(pname)
        if isinstance(bucket, dict):
            by_pset[pname] = sorted(bucket.keys())
        else:
            by_pset[pname] = []
    return names, by_pset


def _material_token_for_host(ml_hosts: list[dict[str, Any]], host_kind: str, host_id: str) -> str:
    for h in ml_hosts:
        if str(h.get("hostKind") or "") != host_kind:
            continue
        if str(h.get("hostElementId") or "") != host_id:
            continue
        st = str(h.get("readbackState") or "")
        if st == "matched":
            return "aligned"
        if st in ("missing_in_ifc", "partial_mismatch"):
            return "mismatch"
        if st == "no_document_expectation":
            return "no_doc_expectation"
        return "not_applicable"
    return "not_applicable"


def _count_slab_hosted_void_openings(model: Any) -> int:
    n = 0
    for rel in model.by_type("IfcRelVoidsElement") or []:
        host = getattr(rel, "RelatingBuildingElement", None)
        op = getattr(rel, "RelatedOpeningElement", None)
        if host is None or op is None:
            continue
        try:
            if host.is_a("IfcSlab"):
                n += 1
        except Exception:
            continue
    return n


def _kernel_site_ids_sorted(doc: Document | None) -> list[str]:
    if doc is None:
        return []
    return sorted(eid for eid, e in doc.elements.items() if isinstance(e, SiteElem))


def _room_programme_expectations(doc: Document | None, room_id: str) -> dict[str, str]:
    out: dict[str, str] = {}
    if doc is None:
        return out
    el = doc.elements.get(room_id)
    if not isinstance(el, RoomElem):
        return out
    for pset_key, attr in _SPACE_PROGRAMME_FIELDS:
        raw = getattr(el, attr, None)
        if isinstance(raw, str) and raw.strip():
            out[pset_key] = raw.strip()
    return out


def _pick_ids_gap_token(
    *,
    missing_ref: bool,
    site_join_bad: bool,
    ref_unknown_doc: bool,
    prog_missing: bool,
    qto_missing: bool,
    material_mismatch: bool,
) -> str:
    if missing_ref:
        return "missing_Pset_Reference"
    if site_join_bad:
        return "site_reference_join_mismatch"
    if ref_unknown_doc:
        return "reference_not_in_document"
    if prog_missing:
        return "missing_programme_field"
    if qto_missing:
        return "missing_qto_link"
    if material_mismatch:
        return "material_layer_mismatch"
    return "ids_ok"


def build_kernel_ifc_property_set_coverage_evidence_v0(model: Any, doc: Document | None) -> dict[str, Any]:
    """Per-product IFC pset/QTO/material slice aligned with kernel export (IfcOpenShell model + optional Document)."""

    if _ifc_elem_util is None:
        return unavailable_property_set_coverage_evidence_v0("ifc_elem_util_missing")

    ml_hosts: list[dict[str, Any]] = []
    if doc is not None:
        from bim_ai.ifc_material_layer_exchange_v0 import kernel_ifc_material_layer_set_readback_v0

        ml_rb = kernel_ifc_material_layer_set_readback_v0(model, doc)
        if isinstance(ml_rb, dict) and ml_rb.get("available"):
            raw_h = ml_rb.get("hosts")
            ml_hosts = list(raw_h) if isinstance(raw_h, list) else []

    slab_void_n = _count_slab_hosted_void_openings(model)
    kernel_site_ids = _kernel_site_ids_sorted(doc)
    joined_site_expect = ",".join(kernel_site_ids)
    doc_expect = doc is not None

    rows: list[dict[str, Any]] = []

    def emit_row(
        *,
        kernel_kind: str,
        kernel_element_id: str,
        ifc_class: str,
        ent: Any,
        identity_pset: str,
        ref_raw: str | None,
        qto_expected: str | None,
        material_host_kind: str | None,
    ) -> None:
        exp_pset_sorted = sorted({identity_pset})
        crit: dict[str, list[str]] = {identity_pset: ["Reference"]}

        programme_exp: dict[str, str] = {}
        if doc_expect and ifc_class == "IfcSpace" and kernel_element_id:
            programme_exp = _room_programme_expectations(doc, kernel_element_id)
            sc_keys = ["Reference"] + sorted(programme_exp.keys())
            crit["Pset_SpaceCommon"] = list(dict.fromkeys(sc_keys))

        exported_names, exported_props = _exported_pset_snapshot(ent)
        id_bucket = exported_props.get(identity_pset) or []
        has_ref_prop = "Reference" in id_bucket

        ref_s = ref_raw.strip() if isinstance(ref_raw, str) else None
        ref_nonempty = bool(ref_s)

        missing_ref = not ref_nonempty or not has_ref_prop
        if kernel_kind == "site" and doc_expect and not kernel_site_ids:
            missing_ref = False

        site_join_bad = False
        if kernel_kind == "site" and doc_expect:
            if not kernel_site_ids:
                site_join_bad = ref_nonempty
            else:
                parsed = sorted(p.strip() for p in str(ref_raw or "").split(",") if p.strip())
                site_join_bad = not (parsed == kernel_site_ids and ref_nonempty)

        ref_unknown_doc = False
        if doc_expect and ref_s and kernel_kind not in ("site",):
            rs = ref_s
            if kernel_kind == "wall" and rs not in doc.elements:
                ref_unknown_doc = True
            elif kernel_kind == "floor" and not isinstance(doc.elements.get(rs), FloorElem):
                ref_unknown_doc = True
            elif kernel_kind == "roof" and not isinstance(doc.elements.get(rs), RoofElem):
                ref_unknown_doc = True
            elif kernel_kind == "stair" and not isinstance(doc.elements.get(rs), StairElem):
                ref_unknown_doc = True
            elif kernel_kind == "room" and not isinstance(doc.elements.get(rs), RoomElem):
                ref_unknown_doc = True
            elif kernel_kind == "door" and not isinstance(doc.elements.get(rs), DoorElem):
                ref_unknown_doc = True
            elif kernel_kind == "window" and not isinstance(doc.elements.get(rs), WindowElem):
                ref_unknown_doc = True
            elif kernel_kind == "floor_type" and not isinstance(doc.elements.get(rs), FloorTypeElem):
                ref_unknown_doc = True

        prog_missing = False
        if doc_expect and programme_exp and _ifc_elem_util is not None:
            ps = _ifc_elem_util.get_psets(ent)
            sp_bucket = ps.get("Pset_SpaceCommon") or {}
            if not isinstance(sp_bucket, dict):
                sp_bucket = {}
            for k, v_exp in programme_exp.items():
                got = sp_bucket.get(k)
                if not (isinstance(got, str) and got.strip() == v_exp):
                    prog_missing = True

        qto_linked: bool | None = None
        if qto_expected:
            qto_linked = _ifc_product_defines_qto_template(ent, qto_expected)
        qto_missing = bool(qto_expected and ref_nonempty and qto_linked is False)

        mat_tok = "not_applicable"
        if doc_expect and material_host_kind and ref_s:
            mat_tok = _material_token_for_host(ml_hosts, material_host_kind, ref_s)
        elif not doc_expect:
            mat_tok = "no_doc_expectation"

        material_mismatch = bool(doc_expect and mat_tok == "mismatch")

        if not doc_expect:
            ids_token = "no_document_for_expectations"
            readback = "ok"
        else:
            ids_token = _pick_ids_gap_token(
                missing_ref=missing_ref,
                site_join_bad=site_join_bad,
                ref_unknown_doc=ref_unknown_doc,
                prog_missing=prog_missing,
                qto_missing=qto_missing,
                material_mismatch=material_mismatch,
            )
            critical_tokens = {
                "missing_Pset_Reference",
                "site_reference_join_mismatch",
                "reference_not_in_document",
                "missing_programme_field",
            }
            partial_tokens = {"missing_qto_link", "material_layer_mismatch"}
            if ids_token in critical_tokens:
                readback = "missing_critical"
            elif ids_token in partial_tokens:
                readback = "partial"
            elif ids_token == "ids_ok":
                readback = "ok"
            else:
                readback = "ok"

        rows.append(
            {
                "kernelKind": kernel_kind,
                "kernelElementId": kernel_element_id,
                "ifcProductClass": ifc_class,
                "ifcGlobalId": _ifc_gid_slug(ent),
                "expectedPropertySetNames": exp_pset_sorted,
                "criticalPropertiesByPset": crit,
                "exportedPropertySetNames": exported_names,
                "exportedPropertiesByPset": exported_props,
                "qtoTemplateExpected": qto_expected,
                "qtoLinked": qto_linked,
                "materialLayerReadbackToken": mat_tok,
                "readbackStatus": readback,
                "idsGapReasonToken": ids_token,
            }
        )

    for wal in sorted(model.by_type("IfcWall") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(wal)
        bk = ps.get("Pset_WallCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="wall",
            kernel_element_id=ref_s or "",
            ifc_class="IfcWall",
            ent=wal,
            identity_pset="Pset_WallCommon",
            ref_raw=ref_s,
            qto_expected="Qto_WallBaseQuantities",
            material_host_kind="wall",
        )

    for slab in sorted(model.by_type("IfcSlab") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(slab)
        bk = ps.get("Pset_SlabCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="floor",
            kernel_element_id=ref_s or "",
            ifc_class="IfcSlab",
            ent=slab,
            identity_pset="Pset_SlabCommon",
            ref_raw=ref_s,
            qto_expected="Qto_SlabBaseQuantities",
            material_host_kind="floor",
        )

    for st in sorted(model.by_type("IfcSlabType") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(st)
        bk = ps.get("Pset_SlabCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="floor_type",
            kernel_element_id=ref_s or "",
            ifc_class="IfcSlabType",
            ent=st,
            identity_pset="Pset_SlabCommon",
            ref_raw=ref_s,
            qto_expected=None,
            material_host_kind=None,
        )

    for rf in sorted(model.by_type("IfcRoof") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(rf)
        bk = ps.get("Pset_RoofCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="roof",
            kernel_element_id=ref_s or "",
            ifc_class="IfcRoof",
            ent=rf,
            identity_pset="Pset_RoofCommon",
            ref_raw=ref_s,
            qto_expected=None,
            material_host_kind="roof",
        )

    for sta in sorted(model.by_type("IfcStair") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(sta)
        bk = ps.get("Pset_StairCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="stair",
            kernel_element_id=ref_s or "",
            ifc_class="IfcStair",
            ent=sta,
            identity_pset="Pset_StairCommon",
            ref_raw=ref_s,
            qto_expected=None,
            material_host_kind=None,
        )

    for sp in sorted(model.by_type("IfcSpace") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(sp)
        bk = ps.get("Pset_SpaceCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="room",
            kernel_element_id=ref_s or "",
            ifc_class="IfcSpace",
            ent=sp,
            identity_pset="Pset_SpaceCommon",
            ref_raw=ref_s,
            qto_expected="Qto_SpaceBaseQuantities",
            material_host_kind=None,
        )

    for dr in sorted(model.by_type("IfcDoor") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(dr)
        bk = ps.get("Pset_DoorCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="door",
            kernel_element_id=ref_s or "",
            ifc_class="IfcDoor",
            ent=dr,
            identity_pset="Pset_DoorCommon",
            ref_raw=ref_s,
            qto_expected="Qto_DoorBaseQuantities",
            material_host_kind=None,
        )

    for wn in sorted(model.by_type("IfcWindow") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(wn)
        bk = ps.get("Pset_WindowCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="window",
            kernel_element_id=ref_s or "",
            ifc_class="IfcWindow",
            ent=wn,
            identity_pset="Pset_WindowCommon",
            ref_raw=ref_s,
            qto_expected="Qto_WindowBaseQuantities",
            material_host_kind=None,
        )

    for si in sorted(model.by_type("IfcSite") or [], key=_product_sort_key):
        ps = _ifc_elem_util.get_psets(si)
        bk = ps.get("Pset_SiteCommon") or {}
        ref = bk.get("Reference") if isinstance(bk, dict) else None
        ref_s = ref.strip() if isinstance(ref, str) else None
        emit_row(
            kernel_kind="site",
            kernel_element_id=joined_site_expect,
            ifc_class="IfcSite",
            ent=si,
            identity_pset="Pset_SiteCommon",
            ref_raw=ref_s,
            qto_expected=None,
            material_host_kind=None,
        )

    rows.sort(
        key=lambda r: (
            str(r.get("ifcProductClass") or ""),
            str(r.get("kernelKind") or ""),
            str(r.get("kernelElementId") or ""),
            str(r.get("ifcGlobalId") or ""),
        )
    )

    gap_ctr: dict[str, int] = {}
    rows_ok = 0
    for r in rows:
        token = str(r.get("idsGapReasonToken") or "")
        st = str(r.get("readbackStatus") or "")
        if st == "ok" and token in ("ids_ok", "no_document_for_expectations"):
            rows_ok += 1
        gap_ctr[token] = gap_ctr.get(token, 0) + 1

    rows_with_gap = len(rows) - rows_ok

    return {
        "schemaVersion": _SCHEMA_VERSION,
        "available": True,
        "rows": rows,
        "summary": {
            "rowsTotal": len(rows),
            "rowsOk": rows_ok,
            "rowsWithGap": rows_with_gap,
            "idsGapReasonCounts": dict(sorted(gap_ctr.items())),
            "slabVoidOpeningsWithoutIdentityPset": slab_void_n,
        },
    }
