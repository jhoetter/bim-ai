"""Resolve layered assemblies on walls, floors, and roofs for schedules and exchange manifests."""

from __future__ import annotations

from typing import Any, Literal

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

HostKindCut = Literal["wall", "floor", "roof"]


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


def _section_material_cut_pattern_hint(
    doc: Document,
    *,
    host_kind: HostKindCut,
    host_element_id: str,
    layers: list[dict[str, Any]],
) -> dict[str, Any]:
    layer_tokens: list[str] = []
    layer_labels: list[str] = []

    for lyr in layers:
        fn = str(lyr.get("function") or "layer").strip() or "layer"
        material_key = str(lyr.get("materialKey") or "").strip()
        label = material_display_label(doc, material_key) if material_key else ""
        layer_tokens.append(material_key or fn)
        layer_labels.append(label or fn)

    return {
        "format": "sectionMaterialCutPatternHint_v0",
        "hostKind": host_kind,
        "hostElementId": host_element_id,
        "layerCount": len(layers),
        "patternToken": "+".join(layer_tokens),
        "label": " / ".join(layer_labels),
    }


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
    layers = _typed_wall_layers(doc, wall)
    if layers is None:
        return None
    m = layer_stack_cut_metrics_for_wall(doc, wall)
    return {
        "assemblyLayerCount": m["layerCount"],
        "assemblyLayerTotalThicknessMm": m["layerTotalThicknessMm"],
        "assemblyCutThicknessMm": m["cutThicknessMm"],
        "assemblyLayerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
        "materialCutPatternHint": _section_material_cut_pattern_hint(
            doc, host_kind="wall", host_element_id=wall.id, layers=layers
        ),
    }


def section_assembly_alignment_fields_floor(doc: Document, floor: FloorElem) -> dict[str, Any] | None:
    layers = _typed_floor_layers(doc, floor)
    if layers is None:
        return None
    m = layer_stack_cut_metrics_for_floor(doc, floor)
    return {
        "assemblyLayerCount": m["layerCount"],
        "assemblyLayerTotalThicknessMm": m["layerTotalThicknessMm"],
        "assemblyCutThicknessMm": m["cutThicknessMm"],
        "assemblyLayerStackMatchesCutThickness": m["layerStackMatchesCutThickness"],
        "materialCutPatternHint": _section_material_cut_pattern_hint(
            doc, host_kind="floor", host_element_id=floor.id, layers=layers
        ),
    }


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
