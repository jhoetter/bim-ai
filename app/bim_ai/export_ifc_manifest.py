from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoofOpeningElem,
    RoomElem,
    SiteElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)

KERNEL_IFC_DOMINANT_KINDS: frozenset[str] = frozenset(
    {"level", "wall", "floor", "door", "window", "room", "roof", "stair", "slab_opening", "site"}
)


def document_kernel_export_eligible(doc: Document) -> bool:
    """True when the document has kernel IFC geometry inputs (walls or slab-capable floors).

    Does not require IfcOpenShell — used for manifest expected-kind hints offline.
    """

    wal = sum(1 for e in doc.elements.values() if isinstance(e, WallElem))
    fl = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, FloorElem) and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )
    return wal + fl > 0


def ifc_kernel_geometry_skip_counts(doc: Document) -> dict[str, int]:
    """Counts semantic instances the kernel IFC exporter will not physicalize (parity transparency)."""

    skips: dict[str, int] = {}
    wall_ids = {eid for eid, e in doc.elements.items() if isinstance(e, WallElem)}
    floors_with_slab = {
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, FloorElem) and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    }
    level_ids = {eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)}

    for e in doc.elements.values():
        if isinstance(e, DoorElem):
            if e.wall_id not in wall_ids:
                skips["door_missing_host_wall"] = skips.get("door_missing_host_wall", 0) + 1
        elif isinstance(e, WindowElem):
            if e.wall_id not in wall_ids:
                skips["window_missing_host_wall"] = skips.get("window_missing_host_wall", 0) + 1
        elif isinstance(e, SlabOpeningElem):
            boundary = getattr(e, "boundary_mm", ()) or ()
            bad_host = e.host_floor_id not in floors_with_slab
            bad_outline = len(boundary) < 3
            if bad_host or bad_outline:
                skips["slab_opening_void_skipped"] = skips.get("slab_opening_void_skipped", 0) + 1
        elif isinstance(e, RoofElem):
            fp = getattr(e, "footprint_mm", ()) or ()
            if len(fp) < 3:
                skips["roof_product_skipped"] = skips.get("roof_product_skipped", 0) + 1
        elif isinstance(e, StairElem):
            missing_lv = e.base_level_id not in level_ids or e.top_level_id not in level_ids
            if missing_lv:
                skips["stair_product_skipped"] = skips.get("stair_product_skipped", 0) + 1
        elif isinstance(e, RoomElem):
            outl = getattr(e, "outline_mm", ()) or ()
            if len(outl) < 3:
                skips["room_space_skipped"] = skips.get("room_space_skipped", 0) + 1

    return skips


def kernel_expected_ifc_emit_counts(doc: Document) -> dict[str, int]:
    """Hypothetical kernel IFC instance counts from the document only (no STEP parse).

    Matches ``exportedIfcKindsInArtifact`` when geometry would be emitted (walls or slab floors present).
    """

    if not document_kernel_export_eligible(doc):
        return {}

    storey_n = sum(1 for e in doc.elements.values() if isinstance(e, LevelElem))
    wal_n = sum(1 for e in doc.elements.values() if isinstance(e, WallElem))
    slab_n = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, FloorElem) and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )
    if storey_n == 0 and wal_n + slab_n > 0:
        storey_n = 1

    wall_ids = {eid for eid, e in doc.elements.items() if isinstance(e, WallElem)}
    door_emit = sum(
        1 for e in doc.elements.values() if isinstance(e, DoorElem) and e.wall_id in wall_ids
    )
    win_emit = sum(
        1 for e in doc.elements.values() if isinstance(e, WindowElem) and e.wall_id in wall_ids
    )
    room_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, RoomElem) and len(getattr(e, "outline_mm", ()) or ()) >= 3
    )
    roof_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, RoofElem) and len(getattr(e, "footprint_mm", ()) or ()) >= 3
    )
    level_ids_eff = {eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)}
    stair_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, StairElem)
        and e.base_level_id in level_ids_eff
        and e.top_level_id in level_ids_eff
    )
    floors_with_slab = {
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, FloorElem) and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    }
    slab_open_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, SlabOpeningElem)
        and e.host_floor_id in floors_with_slab
        and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )
    roofs_with_body = {
        eid
        for eid, e in doc.elements.items()
        if isinstance(e, RoofElem) and len(getattr(e, "footprint_mm", ()) or ()) >= 3
    }
    roof_open_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, RoofOpeningElem)
        and e.host_roof_id in roofs_with_body
        and len(getattr(e, "boundary_mm", ()) or ()) >= 3
    )

    kinds: dict[str, int] = {}
    if storey_n:
        kinds["level"] = storey_n
    if wal_n:
        kinds["wall"] = wal_n
    if slab_n:
        kinds["floor"] = slab_n
    if door_emit:
        kinds["door"] = door_emit
    if win_emit:
        kinds["window"] = win_emit
    if room_emit:
        kinds["room"] = room_emit
    if roof_emit:
        kinds["roof"] = roof_emit
    if stair_emit:
        kinds["stair"] = stair_emit
    if slab_open_emit:
        kinds["slab_opening"] = slab_open_emit
    if roof_open_emit:
        kinds["roof_opening"] = roof_open_emit
    site_emit = sum(1 for e in doc.elements.values() if isinstance(e, SiteElem))
    if site_emit:
        kinds["site"] = site_emit
    return dict(sorted(kinds.items()))


def ifc_manifest_artifact_hints(
    doc: Document,
    *,
    emitting_kernel_body: bool,
    ifc_available: bool,
) -> dict[str, Any]:
    hinted: dict[str, Any] = {
        "exportedIfcKindsInArtifact": {},
        "ifcEmittedKernelKinds": sorted(KERNEL_IFC_DOMINANT_KINDS),
        "kernelNote": (
            "Kernel IFC encodes Proj→IfcSite→IfcBuilding→storeys; kernel **SiteElem** maps to identity "
            "**`Pset_SiteCommon.Reference`** on **`IfcSite`** (comma-joined sorted ids when multiple); walls+floors, "
            "roofs (IfcRoof prism), stairs (IfcStair run prism), hosted door/window openings, slab voids via "
            "IfcOpeningElement on host IfcSlab, and rooms as IfcSpace footprints; IfcOpenShell emits minimal IFC4 "
            "**property sets** (e.g. Pset_*Common `Reference` from kernel ids on physical products); **narrow `Qto_*` "
            "quantities** attach to walls/fillings/slab/space when IfcOpenShell qto helpers succeed. IFC import and "
            "full boolean regeneration remain deferred."
        ),
    }

    skip_summary = ifc_kernel_geometry_skip_counts(doc)
    nonzero_skip = {k: v for k, v in sorted(skip_summary.items()) if v}
    if nonzero_skip:
        hinted["ifcKernelGeometrySkippedCounts"] = nonzero_skip

    if not ifc_available or not emitting_kernel_body:
        hinted["ifcEmittedKernelKinds"] = []
        return hinted

    hinted["exportedIfcKindsInArtifact"] = kernel_expected_ifc_emit_counts(doc)
    return hinted
