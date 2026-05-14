"""Resolve layered assemblies on walls, floors, and roofs for schedules and exchange manifests."""

from __future__ import annotations

import hashlib
from typing import Any, Literal, cast

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    FloorTypeElem,
    RoofElem,
    RoofTypeElem,
    WallElem,
    WallTypeElem,
)
from bim_ai.type_material_registry import material_display_label

_CUT_THICKNESS_MATCH_EPS_MM = 0.05

_ALLOWED_LAYER_FUNCTIONS = frozenset({"structure", "insulation", "finish"})

MaterialCatalogAuditStatus_v0 = Literal[
    "clean",
    "missing_material",
    "missing_layer_stack",
    "stale_reference",
    "unsupported_function",
    "not_propagated",
]

HostKindCut = Literal["wall", "floor", "roof"]
LayerAssemblySourceWitness_v0 = Literal[
    "type_stack", "instance_fallback", "roof_type_stack", "none"
]


def resolved_layers_for_wall(doc: Document, wall: WallElem) -> list[dict[str, Any]]:
    tid = wall.wall_type_id
    if tid:
        wt = doc.elements.get(tid)
        if isinstance(wt, WallTypeElem) and wt.layers:
            return [
                {
                    "function": lyr.layer_function,
                    "materialKey": (lyr.material_key or "").strip(),
                    "thicknessMm": float(lyr.thickness_mm),
                }
                for lyr in wt.layers
            ]
    return [
        {
            "function": "structure",
            "materialKey": "",
            "thicknessMm": float(wall.thickness_mm),
        }
    ]


def resolved_layers_for_floor(doc: Document, floor: FloorElem) -> list[dict[str, Any]]:
    tid = floor.floor_type_id
    if tid:
        ft = doc.elements.get(tid)
        if isinstance(ft, FloorTypeElem) and ft.layers:
            return [
                {
                    "function": lyr.layer_function,
                    "materialKey": (lyr.material_key or "").strip(),
                    "thicknessMm": float(lyr.thickness_mm),
                }
                for lyr in ft.layers
            ]
    return [
        {
            "function": "structure",
            "materialKey": "",
            "thicknessMm": float(floor.thickness_mm),
        }
    ]


def resolved_layers_for_roof(doc: Document, roof: RoofElem) -> list[dict[str, Any]]:
    tid = roof.roof_type_id
    if tid:
        rt = doc.elements.get(tid)
        if isinstance(rt, RoofTypeElem) and rt.layers:
            return [
                {
                    "function": lyr.layer_function,
                    "materialKey": (lyr.material_key or "").strip(),
                    "thicknessMm": float(lyr.thickness_mm),
                }
                for lyr in rt.layers
            ]
    return []


def layer_stack_cut_metrics(
    *,
    host_kind: HostKindCut,
    layers: list[dict[str, Any]],
    instance_thickness_mm: float | None,
) -> dict[str, Any]:
    """Compare summed type layer thickness to the thickness used by cut solids / section (walls, floors).

    For roofs there is no single instance slab thickness in the cut kernel; pass instance_thickness_mm=None
    and layerStackMatchesCutThickness will be None.
    """

    total = sum(float(lyr["thicknessMm"]) for lyr in layers)
    layer_count = len(layers)
    out: dict[str, Any] = {
        "hostKind": host_kind,
        "layerCount": layer_count,
        "layerTotalThicknessMm": round(total, 3),
    }
    if instance_thickness_mm is None:
        out["cutThicknessMm"] = None
        out["layerStackMatchesCutThickness"] = None
    else:
        cut = float(instance_thickness_mm)
        out["cutThicknessMm"] = round(cut, 3)
        out["layerStackMatchesCutThickness"] = abs(total - cut) <= _CUT_THICKNESS_MATCH_EPS_MM
    return out


def layer_stack_cut_metrics_for_wall(doc: Document, wall: WallElem) -> dict[str, Any]:
    layers = resolved_layers_for_wall(doc, wall)
    return layer_stack_cut_metrics(
        host_kind="wall",
        layers=layers,
        instance_thickness_mm=float(wall.thickness_mm),
    )


def layer_stack_cut_metrics_for_floor(doc: Document, floor: FloorElem) -> dict[str, Any]:
    layers = resolved_layers_for_floor(doc, floor)
    return layer_stack_cut_metrics(
        host_kind="floor",
        layers=layers,
        instance_thickness_mm=float(floor.thickness_mm),
    )


def layer_stack_cut_metrics_for_roof(doc: Document, roof: RoofElem) -> dict[str, Any]:
    layers = resolved_layers_for_roof(doc, roof)
    return layer_stack_cut_metrics(
        host_kind="roof",
        layers=layers,
        instance_thickness_mm=None,
    )


def _typed_wall_layers(doc: Document, wall: WallElem) -> list[dict[str, Any]] | None:
    tid = (wall.wall_type_id or "").strip()
    if not tid:
        return None
    wt = doc.elements.get(tid)
    if not isinstance(wt, WallTypeElem) or not wt.layers:
        return None
    return resolved_layers_for_wall(doc, wall)


def _typed_floor_layers(doc: Document, floor: FloorElem) -> list[dict[str, Any]] | None:
    tid = (floor.floor_type_id or "").strip()
    if not tid:
        return None
    ft = doc.elements.get(tid)
    if not isinstance(ft, FloorTypeElem) or not ft.layers:
        return None
    return resolved_layers_for_floor(doc, floor)


def _typed_roof_layers(doc: Document, roof: RoofElem) -> list[dict[str, Any]] | None:
    tid = (roof.roof_type_id or "").strip()
    if not tid:
        return None
    rt = doc.elements.get(tid)
    if not isinstance(rt, RoofTypeElem) or not rt.layers:
        return None
    return [
        {
            "function": lyr.layer_function,
            "materialKey": (lyr.material_key or "").strip(),
            "thicknessMm": float(lyr.thickness_mm),
        }
        for lyr in rt.layers
    ]


def collect_layered_assembly_cut_alignment_evidence_v0(doc: Document) -> dict[str, Any] | None:
    """Hosts with a resolved type layer stack (not instance-only fallback), for cut/section parity manifests."""

    hosts: list[dict[str, Any]] = []

    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = doc.elements[eid]
        assert isinstance(w, WallElem)
        if _typed_wall_layers(doc, w) is None:
            continue
        m = layer_stack_cut_metrics_for_wall(doc, w)
        hosts.append(
            {
                "hostElementId": w.id,
                "assemblyTypeId": (w.wall_type_id or "").strip(),
                **m,
            }
        )

    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = doc.elements[eid]
        assert isinstance(fl, FloorElem)
        if _typed_floor_layers(doc, fl) is None:
            continue
        m = layer_stack_cut_metrics_for_floor(doc, fl)
        hosts.append(
            {
                "hostElementId": fl.id,
                "assemblyTypeId": (fl.floor_type_id or "").strip(),
                **m,
            }
        )

    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[eid]
        assert isinstance(rf, RoofElem)
        if _typed_roof_layers(doc, rf) is None:
            continue
        m = layer_stack_cut_metrics_for_roof(doc, rf)
        hosts.append(
            {
                "hostElementId": rf.id,
                "assemblyTypeId": (rf.roof_type_id or "").strip(),
                **m,
            }
        )

    if not hosts:
        return None

    hosts.sort(key=lambda row: (str(row["hostKind"]), str(row["hostElementId"])))
    return {"format": "layeredAssemblyCutAlignmentEvidence_v0", "hosts": hosts}


def section_assembly_alignment_fields_wall(doc: Document, wall: WallElem) -> dict[str, Any] | None:
    if _typed_wall_layers(doc, wall) is None:
        return None
    m = layer_stack_cut_metrics_for_wall(doc, wall)
    return {
        "assemblyLayerCount": m["layerCount"],
        "assemblyLayerTotalThicknessMm": m["layerTotalThicknessMm"],
        "assemblyCutThicknessMm": m["cutThicknessMm"],
        "assemblyLayerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
    }


def section_assembly_alignment_fields_floor(
    doc: Document, floor: FloorElem
) -> dict[str, Any] | None:
    if _typed_floor_layers(doc, floor) is None:
        return None
    m = layer_stack_cut_metrics_for_floor(doc, floor)
    return {
        "assemblyLayerCount": m["layerCount"],
        "assemblyLayerTotalThicknessMm": m["layerTotalThicknessMm"],
        "assemblyCutThicknessMm": m["cutThicknessMm"],
        "assemblyLayerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
    }


def _normalize_layer_summaries(layers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "function": str(lyr["function"]),
            "materialKey": str(lyr.get("materialKey") or "").strip(),
            "thicknessMm": round(float(lyr["thicknessMm"]), 3),
        }
        for lyr in layers
    ]


def _exposed_faces_for_layers(host_kind: str, summaries: list[dict[str, Any]]) -> dict[str, Any]:
    visible = [s for s in summaries if str(s.get("function") or "") != "air"]
    keys = [str(s.get("materialKey") or "").strip() for s in visible]
    if host_kind == "wall":
        return {
            "exterior": keys[0] if keys else "",
            "interior": keys[-1] if keys else "",
            "cut": keys,
        }
    if host_kind == "floor":
        return {
            "top": keys[0] if keys else "",
            "bottom": keys[-1] if keys else "",
            "cut": keys,
        }
    if host_kind == "roof":
        return {
            "top": keys[0] if keys else "",
            "bottom": keys[-1] if keys else "",
            "cut": keys,
        }
    return {"cut": keys}


def assembly_material_keys_digest(material_keys: list[str]) -> str:
    joined = "|".join(material_keys)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _audit_status_for_typed_summaries(
    summaries: list[dict[str, Any]],
    *,
    cut_matches: bool | None,
) -> MaterialCatalogAuditStatus_v0:
    for s in summaries:
        fn = str(s.get("function") or "").strip()
        if fn not in _ALLOWED_LAYER_FUNCTIONS:
            return "unsupported_function"
    for s in summaries:
        if not str(s.get("materialKey") or "").strip():
            return "missing_material"
    if cut_matches is False:
        return "not_propagated"
    return "clean"


def _audit_row_core(
    *, witness: dict[str, Any], status: MaterialCatalogAuditStatus_v0
) -> dict[str, Any]:
    summaries = cast(list[dict[str, Any]], witness["layerSummaries"])
    keys = [str(s.get("materialKey") or "").strip() for s in summaries]
    total = round(sum(float(s["thicknessMm"]) for s in summaries), 3)
    host_kind = str(witness["hostKind"])
    return {
        "hostElementId": str(witness["hostElementId"]),
        "hostKind": host_kind,
        "assemblyTypeId": str(witness.get("assemblyTypeId") or "").strip(),
        "materialKeys": keys,
        "layerCount": len(summaries),
        "totalThicknessMm": total,
        "layerSource": witness["layerSource"],
        "catalogStatus": status,
        "propagationStatus": status,
        "assemblyMaterialKeysDigest": assembly_material_keys_digest(keys),
    }


def material_catalog_audit_row_for_wall(doc: Document, wall: WallElem) -> dict[str, Any]:
    witness = layered_assembly_witness_row_for_wall(doc, wall)
    tid = (wall.wall_type_id or "").strip()
    if tid:
        te = doc.elements.get(tid)
        if not isinstance(te, WallTypeElem):
            status: MaterialCatalogAuditStatus_v0 = "stale_reference"
        elif not te.layers:
            status = "missing_layer_stack"
        else:
            summaries = cast(list[dict[str, Any]], witness["layerSummaries"])
            cut_m = witness.get("layerStackMatchesCutThickness")
            cut_ok: bool | None = cut_m if isinstance(cut_m, (bool, type(None))) else None
            status = _audit_status_for_typed_summaries(summaries, cut_matches=cut_ok)
    else:
        status = "missing_layer_stack"

    return _audit_row_core(witness=witness, status=status)


def material_catalog_audit_row_for_floor(doc: Document, floor: FloorElem) -> dict[str, Any]:
    witness = layered_assembly_witness_row_for_floor(doc, floor)
    tid = (floor.floor_type_id or "").strip()
    if tid:
        te = doc.elements.get(tid)
        if not isinstance(te, FloorTypeElem):
            status: MaterialCatalogAuditStatus_v0 = "stale_reference"
        elif not te.layers:
            status = "missing_layer_stack"
        else:
            summaries = cast(list[dict[str, Any]], witness["layerSummaries"])
            cut_m = witness.get("layerStackMatchesCutThickness")
            cut_ok: bool | None = cut_m if isinstance(cut_m, (bool, type(None))) else None
            status = _audit_status_for_typed_summaries(summaries, cut_matches=cut_ok)
    else:
        status = "missing_layer_stack"

    return _audit_row_core(witness=witness, status=status)


def material_catalog_audit_row_for_roof(doc: Document, roof: RoofElem) -> dict[str, Any]:
    witness = layered_assembly_witness_row_for_roof(doc, roof)
    rid = (roof.roof_type_id or "").strip()
    if rid:
        te = doc.elements.get(rid)
        if not isinstance(te, RoofTypeElem):
            status: MaterialCatalogAuditStatus_v0 = "stale_reference"
        elif not te.layers:
            status = "missing_layer_stack"
        else:
            summaries = cast(list[dict[str, Any]], witness["layerSummaries"])
            cut_m = witness.get("layerStackMatchesCutThickness")
            cut_ok: bool | None = cut_m if isinstance(cut_m, (bool, type(None))) else None
            status = _audit_status_for_typed_summaries(summaries, cut_matches=cut_ok)
    else:
        status = "missing_layer_stack"

    return _audit_row_core(witness=witness, status=status)


def material_catalog_audit_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = cast(WallElem, doc.elements[eid])
        rows.append(material_catalog_audit_row_for_wall(doc, w))
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = cast(FloorElem, doc.elements[eid])
        rows.append(material_catalog_audit_row_for_floor(doc, fl))
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = cast(RoofElem, doc.elements[eid])
        rows.append(material_catalog_audit_row_for_roof(doc, rf))
    rows.sort(key=lambda r: (str(r["hostKind"]), str(r["hostElementId"])))
    return rows


def material_catalog_audit_evidence_v0(doc: Document) -> dict[str, Any] | None:
    rows = material_catalog_audit_rows(doc)
    if not rows:
        return None
    return {"format": "materialCatalogAuditEvidence_v0", "rows": rows}


def layered_assembly_witness_row_for_wall(doc: Document, wall: WallElem) -> dict[str, Any]:
    typed = _typed_wall_layers(doc, wall) is not None
    layers_raw = resolved_layers_for_wall(doc, wall)
    summaries = _normalize_layer_summaries(layers_raw)
    total_mm = round(sum(float(s["thicknessMm"]) for s in summaries), 3)
    m = layer_stack_cut_metrics_for_wall(doc, wall)
    layer_src: LayerAssemblySourceWitness_v0 = "type_stack" if typed else "instance_fallback"
    asm_type = (wall.wall_type_id or "").strip()
    return {
        "hostElementId": wall.id,
        "hostKind": "wall",
        "assemblyTypeId": asm_type,
        "layerSummaries": summaries,
        "layerCount": len(summaries),
        "layerTotalThicknessMm": total_mm,
        "cutProxyThicknessMm": round(float(wall.thickness_mm), 3),
        "layerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
        "layerSource": layer_src,
        "exposedFaces": _exposed_faces_for_layers("wall", summaries),
        "skipReason": None,
    }


def layered_assembly_witness_row_for_floor(doc: Document, floor: FloorElem) -> dict[str, Any]:
    typed = _typed_floor_layers(doc, floor) is not None
    layers_raw = resolved_layers_for_floor(doc, floor)
    summaries = _normalize_layer_summaries(layers_raw)
    total_mm = round(sum(float(s["thicknessMm"]) for s in summaries), 3)
    m = layer_stack_cut_metrics_for_floor(doc, floor)
    layer_src: LayerAssemblySourceWitness_v0 = "type_stack" if typed else "instance_fallback"
    asm_type = (floor.floor_type_id or "").strip()
    return {
        "hostElementId": floor.id,
        "hostKind": "floor",
        "assemblyTypeId": asm_type,
        "layerSummaries": summaries,
        "layerCount": len(summaries),
        "layerTotalThicknessMm": total_mm,
        "cutProxyThicknessMm": round(float(floor.thickness_mm), 3),
        "layerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
        "layerSource": layer_src,
        "exposedFaces": _exposed_faces_for_layers("floor", summaries),
        "skipReason": None,
    }


def layered_assembly_witness_row_for_roof(doc: Document, roof: RoofElem) -> dict[str, Any]:
    rt_id = (roof.roof_type_id or "").strip()
    layers_raw = resolved_layers_for_roof(doc, roof)
    summaries = _normalize_layer_summaries(layers_raw)
    total_mm = round(sum(float(s["thicknessMm"]) for s in summaries), 3)
    m = layer_stack_cut_metrics_for_roof(doc, roof)
    skip_reason: str | None
    layer_src: LayerAssemblySourceWitness_v0
    if not rt_id:
        layer_src = "none"
        skip_reason = "roof_missing_roof_type_id"
    elif not summaries:
        layer_src = "none"
        skip_reason = "roof_type_without_layers"
    else:
        layer_src = "roof_type_stack"
        skip_reason = None
    asm_type = rt_id if rt_id else ""
    return {
        "hostElementId": roof.id,
        "hostKind": "roof",
        "assemblyTypeId": asm_type,
        "layerSummaries": summaries,
        "layerCount": len(summaries),
        "layerTotalThicknessMm": total_mm,
        "cutProxyThicknessMm": None,
        "layerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
        "layerSource": layer_src,
        "exposedFaces": _exposed_faces_for_layers("roof", summaries),
        "skipReason": skip_reason,
    }


def roof_surface_material_readout_v0(doc: Document, roof: RoofElem) -> dict[str, Any]:
    """Typed roof layer stack + primary material label for manifests / section / plan readouts."""

    w = layered_assembly_witness_row_for_roof(doc, roof)
    skip = w.get("skipReason")
    out: dict[str, Any] = {"layerStackSkipReason": skip}
    if skip is not None:
        return out
    summaries = w.get("layerSummaries") or []
    primary_key = ""
    for s in summaries:
        mk = str(s.get("materialKey") or "").strip()
        if mk:
            primary_key = mk
            break
    out["layerStackCount"] = int(w["layerCount"])
    out["layerStackTotalThicknessMm"] = float(w["layerTotalThicknessMm"])
    if primary_key:
        out["primaryMaterialKey"] = primary_key
    out["primaryMaterialLabel"] = material_display_label(doc, primary_key or None)
    return out


def collect_layered_assembly_witness_v0(doc: Document) -> dict[str, Any] | None:
    witnesses: list[dict[str, Any]] = []
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = cast(WallElem, doc.elements[eid])
        witnesses.append(layered_assembly_witness_row_for_wall(doc, w))
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = cast(FloorElem, doc.elements[eid])
        witnesses.append(layered_assembly_witness_row_for_floor(doc, fl))
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = cast(RoofElem, doc.elements[eid])
        witnesses.append(layered_assembly_witness_row_for_roof(doc, rf))
    if not witnesses:
        return None
    witnesses.sort(
        key=lambda r: (str(r["hostKind"]), str(r["hostElementId"]), str(r["assemblyTypeId"]))
    )
    return {"format": "layeredAssemblyWitness_v0", "witnesses": witnesses}


def material_assembly_manifest_evidence(doc: Document) -> dict[str, Any] | None:
    hosts: list[dict[str, Any]] = []
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = doc.elements[eid]
        assert isinstance(w, WallElem)
        layers = _normalize_layer_summaries(resolved_layers_for_wall(doc, w))
        hosts.append(
            {
                "hostElementId": w.id,
                "hostKind": "wall",
                "assemblyTypeId": (w.wall_type_id or "").strip(),
                "layers": layers,
            }
        )
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = doc.elements[eid]
        assert isinstance(fl, FloorElem)
        layers = _normalize_layer_summaries(resolved_layers_for_floor(doc, fl))
        hosts.append(
            {
                "hostElementId": fl.id,
                "hostKind": "floor",
                "assemblyTypeId": (fl.floor_type_id or "").strip(),
                "layers": layers,
            }
        )
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[eid]
        assert isinstance(rf, RoofElem)
        layers = _normalize_layer_summaries(resolved_layers_for_roof(doc, rf))
        if not layers:
            continue
        hosts.append(
            {
                "hostElementId": rf.id,
                "hostKind": "roof",
                "assemblyTypeId": (rf.roof_type_id or "").strip(),
                "layers": layers,
            }
        )
    if not hosts:
        return None
    return {"format": "materialAssemblyEvidence_v0", "hosts": hosts}
