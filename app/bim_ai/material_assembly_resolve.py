"""Resolve layered assemblies on walls, floors, and roofs for schedules and exchange manifests."""

from __future__ import annotations

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

_CUT_THICKNESS_MATCH_EPS_MM = 0.05

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


def section_assembly_alignment_fields_floor(doc: Document, floor: FloorElem) -> dict[str, Any] | None:
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
        "skipReason": skip_reason,
    }


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
        layers = resolved_layers_for_wall(doc, w)
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
        layers = resolved_layers_for_floor(doc, fl)
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
        layers = resolved_layers_for_roof(doc, rf)
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
