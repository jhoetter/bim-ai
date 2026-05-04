"""Resolve layered assemblies on walls/floors for schedules and exchange manifests."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import FloorElem, FloorTypeElem, WallElem, WallTypeElem


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
    if not hosts:
        return None
    return {"format": "materialAssemblyEvidence_v0", "hosts": hosts}
