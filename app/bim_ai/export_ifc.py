"""IFC4 export using IfcOpenShell — building storey + IfcWall + IfcSlab (bim-ai kernel subset)."""

from __future__ import annotations

import math
from collections import Counter
from typing import Any

import numpy as np

from bim_ai.commands import (
    CreateFloorCmd,
    CreateLevelCmd,
    CreateRoofCmd,
    CreateRoomOutlineCmd,
    CreateSlabOpeningCmd,
    CreateStairCmd,
    CreateWallCmd,
)
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    SiteElem,
    SlabOpeningElem,
    StairElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)
from bim_ai.kernel_ifc_opening_replay_v0 import build_wall_hosted_opening_replay_commands_v0

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

# Semantic geometry kinds emitted as physical IFC bodies in kernel export (for advisor parity).
IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS: frozenset[str] = frozenset(
    {"wall", "floor", "door", "window", "room", "roof", "stair", "slab_opening"}
)

# Kernel slice physical products (IfcOpenShell `is_a` roots — includes subtypes e.g. IfcWallStandardCase).
_KERNEL_SLICE_IFC_PRODUCT_ROOTS: tuple[str, ...] = (
    "IfcWall",
    "IfcSlab",
    "IfcRoof",
    "IfcStair",
    "IfcSpace",
    "IfcOpeningElement",
    "IfcDoor",
    "IfcWindow",
)

# Spatial / aggregation `IfcProduct` instances always present in kernel IFC graph — not merge-target signals.
_KERNEL_IFC_SCOPE_EXCLUDED_PRODUCT_ROOTS: tuple[str, ...] = (
    "IfcSite",
    "IfcBuilding",
    "IfcBuildingStorey",
)


def _ifc_product_is_kernel_slice_supported(product: Any) -> bool:
    for root in _KERNEL_IFC_SCOPE_EXCLUDED_PRODUCT_ROOTS:
        try:
            if product.is_a(root):
                return True
        except Exception:
            continue
    for root in _KERNEL_SLICE_IFC_PRODUCT_ROOTS:
        try:
            if product.is_a(root):
                return True
        except Exception:
            continue
    return False


def _import_scope_unsupported_ifc_products_v0(model: Any) -> dict[str, Any]:
    """IFC product instances outside the kernel slice roots (import-merge scope evidence)."""

    counts: dict[str, int] = {}
    for p in model.by_type("IfcProduct") or []:
        if _ifc_product_is_kernel_slice_supported(p):
            continue
        try:
            cls_name = str(p.is_a())
        except Exception:
            cls_name = "Unknown"
        counts[cls_name] = counts.get(cls_name, 0) + 1
    return {"schemaVersion": 0, "countsByClass": dict(sorted(counts.items()))}


def _storeys_sketch_from_ifc_model(model: Any) -> list[dict[str, Any]]:
    storeys = model.by_type("IfcBuildingStorey") or []
    keyed: list[tuple[tuple[float, str, str], dict[str, Any]]] = []
    for st in storeys:
        raw_elev = getattr(st, "Elevation", None)
        elev_sort = float(raw_elev) if isinstance(raw_elev, (int, float)) else 0.0
        name = str(getattr(st, "Name", None) or "")
        gid = str(getattr(st, "GlobalId", None) or "")
        row: dict[str, Any] = {
            "name": name,
            "elevation": raw_elev if isinstance(raw_elev, (int, float)) else None,
        }
        if gid:
            row["globalId"] = gid
        keyed.append(((elev_sort, name, gid), row))
    keyed.sort(key=lambda t: t[0])
    return [t[1] for t in keyed]


def _levels_from_document_sketch(doc: Document) -> list[dict[str, Any]]:
    levels = [(eid, e) for eid, e in doc.elements.items() if isinstance(e, LevelElem)]
    levels.sort(key=lambda t: (t[1].elevation_mm, t[0]))
    return [{"id": eid, "name": e.name or "", "elevationMm": e.elevation_mm} for eid, e in levels]


def _space_programme_sample_from_ifc_model(model: Any, *, limit: int) -> list[dict[str, Any]]:
    if ifc_elem_util is None:
        return []
    spaces = model.by_type("IfcSpace") or []
    keyed: list[tuple[str, dict[str, Any]]] = []
    for sp in spaces:
        ps = ifc_elem_util.get_psets(sp)
        bucket = ps.get("Pset_SpaceCommon") or {}
        prog_keys = ("ProgrammeCode", "Department", "FunctionLabel", "FinishSet")
        chunk = {k: bucket[k] for k in prog_keys if bucket.get(k)}
        if not chunk:
            continue
        ref = bucket.get("Reference")
        ref_s = ref.strip() if isinstance(ref, str) else ""
        sk = ref_s or str(getattr(sp, "Name", None) or "") or str(getattr(sp, "GlobalId", None) or "")
        row: dict[str, Any] = {"programmeFields": chunk}
        if ref_s:
            row["reference"] = ref_s
        nm = str(getattr(sp, "Name", None) or "").strip()
        if nm:
            row["spaceName"] = nm
        keyed.append((sk, row))
    keyed.sort(key=lambda t: t[0])
    return [t[1] for t in keyed[:limit]]


def ifcopenshell_available() -> bool:
    return IFC_AVAILABLE


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


def kernel_export_eligible(doc: Document) -> bool:
    return IFC_AVAILABLE and document_kernel_export_eligible(doc)


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
        1
        for e in doc.elements.values()
        if isinstance(e, DoorElem) and e.wall_id in wall_ids
    )
    win_emit = sum(
        1
        for e in doc.elements.values()
        if isinstance(e, WindowElem) and e.wall_id in wall_ids
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
    site_emit = sum(1 for e in doc.elements.values() if isinstance(e, SiteElem))
    if site_emit:
        kinds["site"] = site_emit
    return dict(sorted(kinds.items()))


def ifc_manifest_artifact_hints(doc: Document, *, emitting_kernel_body: bool) -> dict[str, Any]:
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

    if not IFC_AVAILABLE or not emitting_kernel_body:
        hinted["ifcEmittedKernelKinds"] = []
        return hinted

    hinted["exportedIfcKindsInArtifact"] = kernel_expected_ifc_emit_counts(doc)
    return hinted


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


def _kernel_ifc_space_export_props(rm: RoomElem) -> dict[str, str]:
    """Optional Pset_SpaceCommon fields for IDS / room programme read-back (kernel slice)."""

    out: dict[str, str] = {}
    if rm.programme_code:
        out["ProgrammeCode"] = rm.programme_code
    if rm.department:
        out["Department"] = rm.department
    if rm.function_label:
        out["FunctionLabel"] = rm.function_label
    if rm.finish_set:
        out["FinishSet"] = rm.finish_set
    return out


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
    """Count IFC products that define an ``IfcElementQuantity`` with ``Name == qto_template_name``."""

    return sum(1 for p in products if _ifc_product_defines_qto_template(p, qto_template_name))


def _kernel_site_element_ids_sorted(doc: Document | None) -> list[str]:
    if doc is None:
        return []
    return sorted(eid for eid, e in doc.elements.items() if isinstance(e, SiteElem))


def build_site_exchange_evidence_v0_for_manifest(doc: Document) -> dict[str, Any]:
    """Offline-safe document-only site participation (manifest); independent of STEP."""

    kernel_ids = _kernel_site_element_ids_sorted(doc)
    kn = len(kernel_ids)
    eligible = document_kernel_export_eligible(doc)
    out: dict[str, Any] = {
        "schemaVersion": 0,
        "kernelSiteCount": kn,
        "kernelIfcExportEligible": eligible,
        "joinedKernelSiteIdsExpected": ",".join(kernel_ids) if kn else "",
    }
    if not eligible:
        out["note"] = (
            "kernelExpectedIfcKinds stays empty until wall/slab-floor eligibility is satisfied; "
            "kernel SiteElem counts remain declared here."
        )
    return out


def build_site_exchange_evidence_v0(
    *,
    doc: Document | None,
    model: Any | None = None,
    unavailable_reason: str | None = None,
) -> dict[str, Any]:
    """Kernel site ↔ IFC ``IfcSite`` identity slice for inspectors (WP-X03)."""

    kernel_ids = _kernel_site_element_ids_sorted(doc)
    kn = len(kernel_ids)
    joined_expect = ",".join(kernel_ids)
    base: dict[str, Any] = {
        "schemaVersion": 0,
        "kernelSiteCount": kn,
        "joinedKernelSiteIdsExpected": joined_expect if kn else "",
    }

    if unavailable_reason is not None:
        base["reason"] = unavailable_reason
        base["ifcSiteCount"] = None
        base["identityReferenceJoined"] = None
        base["sitesWithPsetSiteCommonReference"] = None
        base["kernelIdsMatchJoinedReference"] = False
        return base

    if model is None:
        base["ifcSiteCount"] = None
        base["identityReferenceJoined"] = None
        base["sitesWithPsetSiteCommonReference"] = None
        base["kernelIdsMatchJoinedReference"] = None
        return base

    sites_raw = model.by_type("IfcSite") or []
    sites_sorted = sorted(sites_raw, key=lambda s: str(getattr(s, "GlobalId", None) or ""))
    base["ifcSiteCount"] = len(sites_sorted)

    refs_nonempty = 0
    joined_from_ifc = ""
    if ifc_elem_util is not None:
        for si in sites_sorted:
            ps = ifc_elem_util.get_psets(si)
            bucket = ps.get("Pset_SiteCommon") or {}
            ref = bucket.get("Reference")
            if isinstance(ref, str) and ref.strip():
                refs_nonempty += 1
                if not joined_from_ifc:
                    joined_from_ifc = ref.strip()

    base["sitesWithPsetSiteCommonReference"] = refs_nonempty
    base["identityReferenceJoined"] = joined_from_ifc or None

    if kn == 0:
        base["kernelIdsMatchJoinedReference"] = refs_nonempty == 0
    else:
        parsed = sorted(part.strip() for part in joined_from_ifc.split(",") if part.strip())
        base["kernelIdsMatchJoinedReference"] = bool(parsed == kernel_ids and refs_nonempty >= 1)

    return base


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

    def _count_space_programme(pset_name: str, key: str) -> int:
        c = 0
        for sp in spaces:
            ps = ifc_elem_util.get_psets(sp)
            bucket = ps.get(pset_name) or {}
            if bucket.get(key):
                c += 1
        return c

    qto_names = sorted({str(q.Name) for q in qtys if getattr(q, "Name", None)})

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
        "identityPsets": {
            "wallWithPsetWallCommonReference": _count_pset_ref(list(walls), "Pset_WallCommon"),
            "slabWithPsetSlabCommonReference": _count_pset_ref(list(slabs), "Pset_SlabCommon"),
            "spaceWithPsetSpaceCommonReference": _count_pset_ref(list(spaces), "Pset_SpaceCommon"),
            "doorWithPsetDoorCommonReference": _count_pset_ref(list(doors), "Pset_DoorCommon"),
            "windowWithPsetWindowCommonReference": _count_pset_ref(list(windows), "Pset_WindowCommon"),
            "roofWithPsetRoofCommonReference": _count_pset_ref(list(roofs), "Pset_RoofCommon"),
            "stairWithPsetStairCommonReference": _count_pset_ref(list(stairs), "Pset_StairCommon"),
            "siteWithPsetSiteCommonReference": _count_pset_ref(list(site_products), "Pset_SiteCommon"),
        },
        "qtoLinkedProducts": {
            "IfcWall": _count_ifc_products_with_qto_template(list(walls), "Qto_WallBaseQuantities"),
            "IfcSlab": _count_ifc_products_with_qto_template(list(slabs), "Qto_SlabBaseQuantities"),
            "IfcSpace": _count_ifc_products_with_qto_template(list(spaces), "Qto_SpaceBaseQuantities"),
            "IfcDoor": _count_ifc_products_with_qto_template(list(doors), "Qto_DoorBaseQuantities"),
            "IfcWindow": _count_ifc_products_with_qto_template(list(windows), "Qto_WindowBaseQuantities"),
        },
        "spaceProgrammeFields": {
            "ProgrammeCode": _count_space_programme("Pset_SpaceCommon", "ProgrammeCode"),
            "Department": _count_space_programme("Pset_SpaceCommon", "Department"),
            "FunctionLabel": _count_space_programme("Pset_SpaceCommon", "FunctionLabel"),
            "FinishSet": _count_space_programme("Pset_SpaceCommon", "FinishSet"),
        },
        "qtoTemplates": qto_names,
        "importScopeUnsupportedIfcProducts_v0": _import_scope_unsupported_ifc_products_v0(model),
        "siteExchangeEvidence_v0": build_site_exchange_evidence_v0(doc=doc, model=model),
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


def _references_from_products(products: list[Any], pset_name: str, *, limit: int) -> list[str]:
    if ifc_elem_util is None:
        return []

    refs: set[str] = set()
    for p in products:
        ps = ifc_elem_util.get_psets(p)
        bucket = ps.get(pset_name) or {}
        ref = bucket.get("Reference")
        if isinstance(ref, str) and ref.strip():
            refs.add(ref.strip())
        if len(refs) >= limit:
            break
    return sorted(refs)


def _ifc_global_id_slug(raw: Any) -> str:
    s = str(raw or "").strip()
    if not s:
        return "ifc_empty_gid"
    return "".join(ch if ch.isalnum() else "_" for ch in s)


def _product_host_storey_global_id(product: Any) -> str | None:
    """Host ``IfcBuildingStorey`` from spatial containment or aggregate (kernel export)."""

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
    """IfcOpenShell inverses may be ``[]``, ``()``, one entity, or None — do not use ``or []``."""

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
    # IfcOpenShell geometry helpers usually persist ``Depth`` in millimetres (slab thickness, wall height).
    # Roof prism ``depth`` is emitted as a metre fraction (~0.25–2.8); treat small magnitudes as metres.
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
    """Recover kernel slab-opening id — export names slab voids ``op:<kernelElemId>``."""

    gid = str(getattr(opening, "GlobalId", None) or "")
    nm = str(getattr(opening, "Name", None) or "").strip()
    if nm.startswith("op:"):
        rest = nm[3:].strip()
        if rest:
            return rest
    return _ifc_global_id_slug(gid)


def _void_rel_and_host_for_opening(opening: Any, model: Any) -> tuple[Any | None, Any | None]:
    """Locate ``IfcRelVoidsElement`` + host for ``opening`` (inverse first, linear scan fallback)."""

    og = str(getattr(opening, "GlobalId", None) or "")

    def _opening_matches(ro: Any) -> bool:
        if ro is None:
            return False
        try:
            if ro is opening:
                return True
        except Exception:
            pass
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


def _space_pset_programme_cmd_kwargs(bucket: dict[str, Any]) -> dict[str, Any]:
    """IFC ``Pset_SpaceCommon`` programme strings → optional ``CreateRoomOutlineCmd`` kwargs."""

    out: dict[str, Any] = {}
    pc = bucket.get("ProgrammeCode")
    if isinstance(pc, str) and pc.strip():
        out["programme_code"] = pc.strip()
    dep = bucket.get("Department")
    if isinstance(dep, str) and dep.strip():
        out["department"] = dep.strip()
    fl = bucket.get("FunctionLabel")
    if isinstance(fl, str) and fl.strip():
        out["function_label"] = fl.strip()
    fs = bucket.get("FinishSet")
    if isinstance(fs, str) and fs.strip():
        out["finish_set"] = fs.strip()
    return out


def _space_pset_programme_json_fields(bucket: dict[str, Any]) -> dict[str, str]:
    """CamelCase programme field dict for ``idsAuthoritativeReplayMap_v0`` (non-empty only)."""

    fields: dict[str, str] = {}
    pc = bucket.get("ProgrammeCode")
    if isinstance(pc, str) and pc.strip():
        fields["programmeCode"] = pc.strip()
    dep = bucket.get("Department")
    if isinstance(dep, str) and dep.strip():
        fields["department"] = dep.strip()
    fl = bucket.get("FunctionLabel")
    if isinstance(fl, str) and fl.strip():
        fields["functionLabel"] = fl.strip()
    fs = bucket.get("FinishSet")
    if isinstance(fs, str) and fs.strip():
        fields["finishSet"] = fs.strip()
    return fields


AUTHORITATIVE_REPLAY_STAIR_TOP_LEVEL_TOL_MM = 1.0


def _replay_roof_world_z_center_m(product: Any, *, storey_elev_mm: float) -> float | None:
    """World-space roof product Z centre (m), disambiguating mm vs m in read-back mats."""

    if ifc_placement is None:
        return None
    try:
        op = getattr(product, "ObjectPlacement", None)
        if op is None:
            return None
        mat = ifc_placement.get_local_placement(op)
        z_raw = float(mat[2, 3])
    except Exception:
        return None
    se = float(storey_elev_mm)
    err_if_z_is_mm = abs(z_raw - se)
    err_if_z_is_m = abs(z_raw * 1000.0 - se)
    if err_if_z_is_mm <= err_if_z_is_m:
        return z_raw / 1000.0
    return z_raw


def _replay_infer_roof_slope_deg_from_prism_rise_m(*, rise_m: float) -> float:
    """Inverse of kernel roof prism depth: ``rise_m = clamp(slope_deg/70, 0.25, 2.8)`` (meters)."""

    r = float(rise_m)
    if r <= 0.25 + 1e-9:
        return 17.5
    if r >= 2.8 - 1e-9:
        return 196.0
    return r * 70.0


def _replay_infer_roof_overhang_mm_from_placement(
    *,
    roof_z_center_m: float,
    storey_elev_m: float,
    rise_m: float,
) -> float:
    """Inverse of ``roof_z_center = elev + overhang_m * 0.12 + rise_m/2`` with exporter clamps."""

    ov_m = (float(roof_z_center_m) - float(storey_elev_m) - float(rise_m) / 2.0) / 0.12
    return float(_clamp(ov_m * 1000.0, 0.0, 5000.0))


def _replay_level_ids_matching_elevation_mm(
    *,
    target_elevation_mm: float,
    storey_gid_to_level_id: dict[str, str],
    storey_gid_to_elev_mm: dict[str, float],
    tol_mm: float,
) -> list[str]:
    """Return sorted unique replay level ids whose storey elevation matches target within tol."""

    matched: set[str] = set()
    for gid, lvl_id in storey_gid_to_level_id.items():
        raw = storey_gid_to_elev_mm.get(gid)
        if raw is None:
            continue
        if abs(float(raw) - float(target_elevation_mm)) <= tol_mm:
            matched.add(lvl_id)
    return sorted(matched)


def _sort_authoritative_replay_extraction_gaps_v0(gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Stable ordering for replay skip / gap rows (reason, then GlobalId-bearing keys)."""

    def key_row(row: dict[str, Any]) -> tuple[str, str]:
        reason = str(row.get("reason") or "")
        gids: list[str] = []
        for k, v in row.items():
            if k.endswith("GlobalId") and v is not None:
                gids.append(f"{k}={v}")
        gids.sort()
        return (reason, "|".join(gids))

    return sorted(gaps, key=key_row)


def build_kernel_ifc_authoritative_replay_sketch_v0_from_model(model: Any) -> dict[str, Any]:
    """Deterministic kernel IFC replay: levels, slabs, walls, roofs, stairs, inserts, slab voids, rooms."""

    has_opening_products = bool(
        (model.by_type("IfcDoor") or []) or (model.by_type("IfcWindow") or [])
    )
    has_floor_products = bool(model.by_type("IfcSlab") or [])
    has_slab_void_topology = _ifc_model_has_slab_void_opening_topology_v0(model)
    has_stair_products = bool(model.by_type("IfcStair") or [])
    has_roof_products = bool(model.by_type("IfcRoof") or [])

    authoritative_subset_unreachable = {
        "levels": False,
        "walls": False,
        "spaces": False,
        "openings": False,
        "floors": False,
        "slabVoids": False,
        "roofs": False,
        "stairs": False,
    }

    subset = {
        "levels": True,
        "walls": True,
        "spaces": True,
        "openings": has_opening_products,
        "floors": has_floor_products,
        "slabVoids": has_slab_void_topology,
        "roofs": has_roof_products,
        "stairs": has_stair_products,
    }
    unsupported = _import_scope_unsupported_ifc_products_v0(model)

    if ifc_elem_util is None:
        return {
            "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
            "available": False,
            "reason": "ifcopenshell_util_unavailable",
            "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
            "authoritativeSubset": dict(authoritative_subset_unreachable),
            "unsupportedIfcProducts": unsupported,
        }

    storeys = list(model.by_type("IfcBuildingStorey") or [])
    storey_rows: list[tuple[tuple[float, str, str], Any]] = []
    for st in storeys:
        raw_elev = getattr(st, "Elevation", None)
        elev_sort = float(raw_elev) if isinstance(raw_elev, (int, float)) else 0.0
        gid_s = str(getattr(st, "GlobalId", None) or "")
        name_s = str(getattr(st, "Name", None) or "")
        storey_rows.append(((elev_sort, name_s, gid_s), st))
    storey_rows.sort(key=lambda t: t[0])

    storey_gid_to_level_id: dict[str, str] = {}
    storey_gid_to_elev_mm: dict[str, float] = {}
    level_cmds: list[dict[str, Any]] = []
    for _k, st in storey_rows:
        gid = str(getattr(st, "GlobalId", None) or "")
        lvl_id = _ifc_global_id_slug(gid)
        raw_elev = getattr(st, "Elevation", None)
        el = float(raw_elev) if isinstance(raw_elev, (int, float)) else 0.0
        if gid:
            storey_gid_to_level_id[gid] = lvl_id
            storey_gid_to_elev_mm[gid] = el
        nm = str(getattr(st, "Name", None) or "") or lvl_id
        level_cmds.append(
            CreateLevelCmd(
                id=lvl_id,
                name=nm,
                elevation_mm=el,
            ).model_dump(mode="json", by_alias=True)
        )

    extraction_gaps: list[dict[str, Any]] = []

    floor_cmds: list[dict[str, Any]] = []
    slab_global_id_to_kernel_ref: dict[str, str] = {}
    slabs_skipped_no_reference = 0

    for slab in sorted(model.by_type("IfcSlab") or [], key=lambda s: str(getattr(s, "GlobalId", None) or "")):
        ps_sl = ifc_elem_util.get_psets(slab)
        bucket_sl = ps_sl.get("Pset_SlabCommon") or {}
        ref_sl = bucket_sl.get("Reference")
        ref_s = ref_sl.strip() if isinstance(ref_sl, str) else ""
        if not ref_s:
            slabs_skipped_no_reference += 1
            continue

        st_gid_sl = _product_host_storey_global_id(slab)
        if not st_gid_sl or st_gid_sl not in storey_gid_to_level_id:
            extraction_gaps.append(
                {
                    "slabGlobalId": str(getattr(slab, "GlobalId", None) or ""),
                    "reason": "missing_or_unknown_host_storey",
                }
            )
            continue

        geo_sl = _kernel_horizontal_extrusion_footprint_mm_and_thickness(slab)
        if geo_sl is None:
            extraction_gaps.append(
                {
                    "slabGlobalId": str(getattr(slab, "GlobalId", None) or ""),
                    "kernelReference": ref_s,
                    "reason": "slab_body_extrusion_unreadable",
                }
            )
            continue
        outline_sl, thick_mm = geo_sl
        thick_mm = float(_clamp(thick_mm, 50.0, 1800.0))
        sname = str(getattr(slab, "Name", None) or "") or ref_s
        floor_cmds.append(
            CreateFloorCmd(
                id=ref_s,
                name=sname,
                level_id=storey_gid_to_level_id[st_gid_sl],
                boundary_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_sl],
                thickness_mm=thick_mm,
            ).model_dump(mode="json", by_alias=True)
        )
        sgid = str(getattr(slab, "GlobalId", None) or "")
        if sgid:
            slab_global_id_to_kernel_ref[sgid] = ref_s

    floor_cmds.sort(key=lambda c: str(c.get("id") or ""))

    wall_cmds: list[dict[str, Any]] = []
    wall_global_id_to_kernel_ref: dict[str, str] = {}
    walls_skipped_no_reference = 0

    for wal in sorted(model.by_type("IfcWall") or [], key=lambda w: str(getattr(w, "GlobalId", None) or "")):
        ps = ifc_elem_util.get_psets(wal)
        bucket = ps.get("Pset_WallCommon") or {}
        ref = bucket.get("Reference")
        ref_s = ref.strip() if isinstance(ref, str) else ""
        if not ref_s:
            walls_skipped_no_reference += 1
            continue

        st_gid = _product_host_storey_global_id(wal)
        if not st_gid or st_gid not in storey_gid_to_level_id:
            extraction_gaps.append(
                {"wallGlobalId": str(getattr(wal, "GlobalId", None) or ""), "reason": "missing_or_unknown_host_storey"}
            )
            continue

        geo = _kernel_wall_plan_geometry_mm(wal)
        if geo is None:
            extraction_gaps.append(
                {"wallGlobalId": str(getattr(wal, "GlobalId", None) or ""), "kernelReference": ref_s, "reason": "wall_body_extrusion_unreadable"}
            )
            continue

        wname = str(getattr(wal, "Name", None) or "") or ref_s
        wall_cmds.append(
            CreateWallCmd(
                id=ref_s,
                name=wname,
                level_id=storey_gid_to_level_id[st_gid],
                start={"xMm": geo["start_x_mm"], "yMm": geo["start_y_mm"]},
                end={"xMm": geo["end_x_mm"], "yMm": geo["end_y_mm"]},
                thickness_mm=geo["thickness_mm"],
                height_mm=geo["height_mm"],
            ).model_dump(mode="json", by_alias=True)
        )
        wgid = str(getattr(wal, "GlobalId", None) or "")
        if wgid:
            wall_global_id_to_kernel_ref[wgid] = ref_s

    wall_cmds.sort(key=lambda c: str(c.get("id") or ""))

    roof_cmds: list[dict[str, Any]] = []
    ids_roof_rows: list[dict[str, Any]] = []
    roofs_skipped_no_reference = 0

    for rfl in sorted(model.by_type("IfcRoof") or [], key=lambda r: str(getattr(r, "GlobalId", None) or "")):
        rf_gid = str(getattr(rfl, "GlobalId", None) or "")
        ps_rf = ifc_elem_util.get_psets(rfl)
        bucket_rf = ps_rf.get("Pset_RoofCommon") or {}
        ref_rf = bucket_rf.get("Reference")
        ref_s = ref_rf.strip() if isinstance(ref_rf, str) else ""
        if not ref_s:
            roofs_skipped_no_reference += 1
            extraction_gaps.append({"roofGlobalId": rf_gid, "reason": "roof_missing_pset_reference"})
            continue

        st_gid_rf = _product_host_storey_global_id(rfl)
        if not st_gid_rf or st_gid_rf not in storey_gid_to_level_id:
            extraction_gaps.append(
                {
                    "roofGlobalId": rf_gid,
                    "kernelReference": ref_s,
                    "reason": "roof_missing_or_unknown_host_storey",
                }
            )
            continue

        geo_rf = _kernel_horizontal_extrusion_footprint_mm_and_thickness(rfl)
        if geo_rf is None:
            extraction_gaps.append(
                {
                    "roofGlobalId": rf_gid,
                    "kernelReference": ref_s,
                    "reason": "roof_body_extrusion_unreadable",
                }
            )
            continue
        outline_rf, depth_mm = geo_rf
        rise_m = float(depth_mm) / 1000.0
        elev_mm = float(storey_gid_to_elev_mm.get(st_gid_rf, 0.0))
        roof_z_m = _replay_roof_world_z_center_m(rfl, storey_elev_mm=elev_mm)
        if roof_z_m is None:
            extraction_gaps.append(
                {
                    "roofGlobalId": rf_gid,
                    "kernelReference": ref_s,
                    "reason": "roof_placement_unreadable",
                }
            )
            continue

        elev_m = elev_mm / 1000.0
        overhang_mm = _replay_infer_roof_overhang_mm_from_placement(
            roof_z_center_m=roof_z_m,
            storey_elev_m=elev_m,
            rise_m=rise_m,
        )
        slope_deg = _replay_infer_roof_slope_deg_from_prism_rise_m(rise_m=rise_m)

        rname = str(getattr(rfl, "Name", None) or "") or ref_s
        roof_cmds.append(
            CreateRoofCmd(
                id=ref_s,
                name=rname,
                reference_level_id=storey_gid_to_level_id[st_gid_rf],
                footprint_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_rf],
                overhang_mm=overhang_mm,
                slope_deg=slope_deg,
                roof_geometry_mode="mass_box",
            ).model_dump(mode="json", by_alias=True)
        )
        ids_roof_rows.append({"ifcGlobalId": rf_gid, "identityReference": ref_s})

    roof_cmds.sort(key=lambda c: str(c.get("id") or ""))
    ids_roof_rows.sort(key=lambda r: (r["identityReference"], r["ifcGlobalId"]))

    stair_cmds: list[dict[str, Any]] = []
    stairs_skipped_no_reference = 0

    for sta in sorted(model.by_type("IfcStair") or [], key=lambda s: str(getattr(s, "GlobalId", None) or "")):
        sta_gid = str(getattr(sta, "GlobalId", None) or "")
        ps_sta = ifc_elem_util.get_psets(sta)
        bucket_sta = ps_sta.get("Pset_StairCommon") or {}
        ref_sta = bucket_sta.get("Reference")
        ref_s = ref_sta.strip() if isinstance(ref_sta, str) else ""
        if not ref_s:
            stairs_skipped_no_reference += 1
            extraction_gaps.append({"stairGlobalId": sta_gid, "reason": "stair_missing_pset_reference"})
            continue

        st_gid_hs = _product_host_storey_global_id(sta)
        if not st_gid_hs or st_gid_hs not in storey_gid_to_level_id:
            extraction_gaps.append(
                {
                    "stairGlobalId": sta_gid,
                    "kernelReference": ref_s,
                    "reason": "stair_missing_or_unknown_host_storey",
                }
            )
            continue

        geo_st = _kernel_wall_plan_geometry_mm(sta)
        if geo_st is None:
            extraction_gaps.append(
                {
                    "stairGlobalId": sta_gid,
                    "kernelReference": ref_s,
                    "reason": "stair_body_extrusion_unreadable",
                }
            )
            continue

        base_lvl_id = storey_gid_to_level_id[st_gid_hs]
        base_elev_mm = float(storey_gid_to_elev_mm.get(st_gid_hs, 0.0))
        target_top_mm = base_elev_mm + float(geo_st["height_mm"])
        candidates = _replay_level_ids_matching_elevation_mm(
            target_elevation_mm=target_top_mm,
            storey_gid_to_level_id=storey_gid_to_level_id,
            storey_gid_to_elev_mm=storey_gid_to_elev_mm,
            tol_mm=AUTHORITATIVE_REPLAY_STAIR_TOP_LEVEL_TOL_MM,
        )
        if len(candidates) != 1:
            extraction_gaps.append(
                {
                    "stairGlobalId": sta_gid,
                    "kernelReference": ref_s,
                    "reason": "stair_top_level_unresolved",
                }
            )
            continue

        stname = str(getattr(sta, "Name", None) or "") or ref_s
        stair_cmds.append(
            CreateStairCmd(
                id=ref_s,
                name=stname,
                base_level_id=base_lvl_id,
                top_level_id=candidates[0],
                run_start_mm=Vec2Mm(x_mm=geo_st["start_x_mm"], y_mm=geo_st["start_y_mm"]),
                run_end_mm=Vec2Mm(x_mm=geo_st["end_x_mm"], y_mm=geo_st["end_y_mm"]),
                width_mm=geo_st["thickness_mm"],
            ).model_dump(mode="json", by_alias=True, exclude={"riser_mm", "tread_mm"})
        )

    stair_cmds.sort(key=lambda c: str(c.get("id") or ""))

    door_cmds, win_cmds, kernel_door_skip, kernel_window_skip = build_wall_hosted_opening_replay_commands_v0(
        model,
        wall_global_id_to_kernel_ref=wall_global_id_to_kernel_ref,
        storey_gid_to_elev_mm=storey_gid_to_elev_mm,
        extraction_gaps=extraction_gaps,
    )

    slab_opening_cmds: list[dict[str, Any]] = []
    skip_detail_rows: list[dict[str, Any]] = []
    wall_host_opening_skipped_v0 = 0

    for op in sorted(
        model.by_type("IfcOpeningElement") or [], key=lambda o: str(getattr(o, "GlobalId", None) or "")
    ):
        op_gid = str(getattr(op, "GlobalId", None) or "")
        _rel, host = _void_rel_and_host_for_opening(op, model)
        if host is None:
            skip_detail_rows.append(
                {
                    "openingGlobalId": op_gid,
                    "hostGlobalId": None,
                    "hostClass": None,
                    "reason": "missing_void_relationship_v0",
                }
            )
            continue
        host_gid = str(getattr(host, "GlobalId", None) or "")
        host_cls = "Unknown"
        try:
            host_cls = str(host.is_a())
        except Exception:
            pass

        if _ifc_try_product_is_a(host, "IfcWall"):
            wall_host_opening_skipped_v0 += 1
            continue
        if _ifc_try_product_is_a(host, "IfcRoof"):
            skip_detail_rows.append(
                {
                    "openingGlobalId": op_gid,
                    "hostGlobalId": host_gid,
                    "hostClass": host_cls,
                    "reason": "roof_host_not_supported_v0",
                }
            )
            continue
        if not _ifc_try_product_is_a(host, "IfcSlab"):
            skip_detail_rows.append(
                {
                    "openingGlobalId": op_gid,
                    "hostGlobalId": host_gid,
                    "hostClass": host_cls,
                    "reason": "unsupported_host_kind_v0",
                }
            )
            continue

        floor_ref = slab_global_id_to_kernel_ref.get(host_gid)
        if not floor_ref:
            skip_detail_rows.append(
                {
                    "openingGlobalId": op_gid,
                    "hostGlobalId": host_gid,
                    "hostClass": "IfcSlab",
                    "reason": "slab_host_missing_kernel_reference_v0",
                }
            )
            continue

        geo_op = _kernel_horizontal_extrusion_footprint_mm_and_thickness(op)
        if geo_op is None:
            skip_detail_rows.append(
                {
                    "openingGlobalId": op_gid,
                    "hostGlobalId": host_gid,
                    "hostClass": "IfcSlab",
                    "reason": "opening_body_extrusion_unreadable_v0",
                }
            )
            continue
        outline_op, _dep_op = geo_op
        if len(outline_op) < 3:
            skip_detail_rows.append(
                {
                    "openingGlobalId": op_gid,
                    "hostGlobalId": host_gid,
                    "hostClass": "IfcSlab",
                    "reason": "opening_outline_degenerate_v0",
                }
            )
            continue

        elem_id = _kernel_slab_opening_replay_element_id(op)
        oname = str(getattr(op, "Name", None) or "").strip() or elem_id
        slab_opening_cmds.append(
            CreateSlabOpeningCmd(
                id=elem_id,
                name=oname,
                host_floor_id=floor_ref,
                boundary_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_op],
            ).model_dump(mode="json", by_alias=True)
        )

    slab_opening_cmds.sort(key=lambda c: str(c.get("id") or ""))

    skip_ctr: Counter[str] = Counter()
    skip_ctr["IfcWall:wall_host_opening_handled_by_door_window_path_v0"] = wall_host_opening_skipped_v0
    for row in skip_detail_rows:
        hk = row.get("hostClass") if row.get("hostClass") is not None else "None"
        skip_ctr[f"{hk}:{row.get('reason')}"] += 1

    slab_roof_hosted_void_skip_v0 = {
        "schemaVersion": 0,
        "countsByHostKindAndReason": dict(sorted(skip_ctr.items())),
        "detailRows": sorted(
            skip_detail_rows,
            key=lambda r: (str(r.get("openingGlobalId") or ""), str(r.get("reason") or "")),
        ),
    }

    room_cmds: list[dict[str, Any]] = []
    ids_space_rows: list[dict[str, Any]] = []
    spaces_skipped_no_reference = 0

    for spa in sorted(model.by_type("IfcSpace") or [], key=lambda s: str(getattr(s, "GlobalId", None) or "")):
        sp_gid = str(getattr(spa, "GlobalId", None) or "")
        ps_sp = ifc_elem_util.get_psets(spa)
        bucket_sp = ps_sp.get("Pset_SpaceCommon") or {}
        ref_sp = bucket_sp.get("Reference")
        ref_s = ref_sp.strip() if isinstance(ref_sp, str) else ""
        if not ref_s:
            spaces_skipped_no_reference += 1
            continue

        st_gid_sp = _product_host_storey_global_id(spa)
        if not st_gid_sp or st_gid_sp not in storey_gid_to_level_id:
            extraction_gaps.append(
                {"spaceGlobalId": sp_gid, "reason": "missing_or_unknown_host_storey"}
            )
            continue

        outline_sp = _kernel_space_footprint_outline_mm(spa)
        if outline_sp is None:
            extraction_gaps.append(
                {
                    "spaceGlobalId": sp_gid,
                    "kernelReference": ref_s,
                    "reason": "space_body_extrusion_unreadable",
                }
            )
            continue

        rname = str(getattr(spa, "Name", None) or "") or ref_s
        prog_kw = _space_pset_programme_cmd_kwargs(bucket_sp)
        room_cmds.append(
            CreateRoomOutlineCmd(
                id=ref_s,
                name=rname,
                level_id=storey_gid_to_level_id[st_gid_sp],
                outline_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_sp],
                **prog_kw,
            ).model_dump(mode="json", by_alias=True)
        )
        ids_space_rows.append(
            {
                "ifcGlobalId": sp_gid,
                "identityReference": ref_s,
                "programmeFields": _space_pset_programme_json_fields(bucket_sp),
                "qtoSpaceBaseQuantitiesLinked": _ifc_product_defines_qto_template(
                    spa, "Qto_SpaceBaseQuantities"
                ),
            }
        )

    room_cmds.sort(key=lambda c: str(c.get("id") or ""))
    ids_space_rows.sort(key=lambda r: (r["identityReference"], r["ifcGlobalId"]))

    extraction_gaps = _sort_authoritative_replay_extraction_gaps_v0(extraction_gaps)

    merged_cmds = (
        level_cmds
        + floor_cmds
        + wall_cmds
        + roof_cmds
        + stair_cmds
        + door_cmds
        + win_cmds
        + slab_opening_cmds
        + room_cmds
    )

    return {
        "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
        "available": True,
        "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
        "replayProvenance": "kernel_ifc_step_reparse_v0",
        "authoritativeSubset": subset,
        "unsupportedIfcProducts": unsupported,
        "comparisonNote": (
            "authoritativeReplay_v0 lists kernel-sourced replay commands; unsupportedIfcProducts_v0 "
            "counts IfcProduct classes outside the kernel exchange slice (not replay targets)."
        ),
        "kernelWallSkippedNoReference": walls_skipped_no_reference,
        "kernelSlabSkippedNoReference": slabs_skipped_no_reference,
        "kernelSpaceSkippedNoReference": spaces_skipped_no_reference,
        "kernelDoorSkippedNoReference": kernel_door_skip,
        "kernelWindowSkippedNoReference": kernel_window_skip,
        "kernelStairSkippedNoReference": stairs_skipped_no_reference,
        "kernelRoofSkippedNoReference": roofs_skipped_no_reference,
        "slabRoofHostedVoidReplaySkipped_v0": slab_roof_hosted_void_skip_v0,
        "idsAuthoritativeReplayMap_v0": {
            "schemaVersion": 0,
            "note": (
                "Per-product linkage for cleanroom IDS read-back vs authoritative replay rows: IfcSpace rows carry "
                "programme + Qto_SpaceBaseQuantities; IfcRoof rows carry identity Reference only (no roof QTO slice). "
                "Space identity Reference aligns with exchange_ifc_ids_identity_pset_gap; "
                "qtoSpaceBaseQuantitiesLinked aligns with exchange_ifc_ids_qto_gap."
            ),
            "spaces": ids_space_rows,
            "roofs": ids_roof_rows,
        },
        "commands": merged_cmds,
        "extractionGaps": extraction_gaps,
    }




def build_kernel_ifc_authoritative_replay_sketch_v0(step_text: str) -> dict[str, Any]:
    """Parse STEP and build authoritative replay sketch (tests / direct IFC strings)."""

    if not IFC_AVAILABLE:
        return {
            "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
            "authoritativeSubset": {
                "levels": False,
                "walls": False,
                "spaces": False,
                "openings": False,
                "floors": False,
                "slabVoids": False,
                "roofs": False,
                "stairs": False,
            },
            "unsupportedIfcProducts": {"schemaVersion": 0, "countsByClass": {}},
        }
    import ifcopenshell

    model = ifcopenshell.file.from_string(step_text)
    return build_kernel_ifc_authoritative_replay_sketch_v0_from_model(model)


def summarize_kernel_ifc_semantic_roundtrip(doc: Document) -> dict[str, Any]:
    """Export → re-parse summary: expected kernel counts vs IFC inspection (+ programme / identity checks)."""

    matrix_version = 1
    kinds_expected = kernel_expected_ifc_emit_counts(doc)

    if not IFC_AVAILABLE:
        inspection = inspect_kernel_ifc_semantics(doc=doc)
        return {
            "matrixVersion": matrix_version,
            "inspection": inspection,
            "kernelExpectedIfcKinds": dict(sorted(kinds_expected.items())),
            "roundtripChecks": None,
            "commandSketch": None,
        }

    if not kernel_export_eligible(doc):
        inspection = inspect_kernel_ifc_semantics(doc=doc)
        return {
            "matrixVersion": matrix_version,
            "inspection": inspection,
            "kernelExpectedIfcKinds": {},
            "roundtripChecks": None,
            "commandSketch": None,
        }

    step = export_ifc_model_step(doc)
    inspection = inspect_kernel_ifc_semantics(doc=doc, step_text=step)

    if not inspection.get("available"):
        return {
            "matrixVersion": matrix_version,
            "inspection": inspection,
            "kernelExpectedIfcKinds": dict(sorted(kinds_expected.items())),
            "roundtripChecks": None,
            "commandSketch": None,
        }

    import ifcopenshell

    model = ifcopenshell.file.from_string(step)
    walls_m = model.by_type("IfcWall") or []
    spaces_m = model.by_type("IfcSpace") or []
    sites_m = model.by_type("IfcSite") or []

    prog_exp = kernel_expected_space_programme_counts(doc)
    prog_insp = inspection.get("spaceProgrammeFields") or {}
    programme_fields: dict[str, dict[str, Any]] = {}
    for k, exp_n in prog_exp.items():
        insp_n = int(prog_insp.get(k, 0))
        programme_fields[k] = {"expected": exp_n, "inspected": insp_n, "match": exp_n == insp_n}

    products = inspection.get("products") or {}
    bs = inspection.get("buildingStorey") or {}

    def _tri(expected: int, inspected: int) -> dict[str, Any]:
        return {"expected": expected, "inspected": inspected, "match": expected == inspected}

    exp_open = (
        kinds_expected.get("door", 0)
        + kinds_expected.get("window", 0)
        + kinds_expected.get("slab_opening", 0)
    )

    product_counts = {
        "level": _tri(kinds_expected.get("level", 0), int(bs.get("count", 0))),
        "wall": _tri(kinds_expected.get("wall", 0), int(products.get("IfcWall", 0))),
        "floor": _tri(kinds_expected.get("floor", 0), int(products.get("IfcSlab", 0))),
        "roof": _tri(kinds_expected.get("roof", 0), int(products.get("IfcRoof", 0))),
        "stair": _tri(kinds_expected.get("stair", 0), int(products.get("IfcStair", 0))),
        "door": _tri(kinds_expected.get("door", 0), int(products.get("IfcDoor", 0))),
        "window": _tri(kinds_expected.get("window", 0), int(products.get("IfcWindow", 0))),
        "room": _tri(kinds_expected.get("room", 0), int(products.get("IfcSpace", 0))),
        "openingElements": _tri(exp_open, int(products.get("IfcOpeningElement", 0))),
    }

    id_ps = inspection.get("identityPsets") or {}
    identity_coverage = {
        "wall": _tri(
            kinds_expected.get("wall", 0),
            int(id_ps.get("wallWithPsetWallCommonReference", 0)),
        ),
        "slab": _tri(
            kinds_expected.get("floor", 0),
            int(id_ps.get("slabWithPsetSlabCommonReference", 0)),
        ),
        "space": _tri(
            kinds_expected.get("room", 0),
            int(id_ps.get("spaceWithPsetSpaceCommonReference", 0)),
        ),
        "door": _tri(
            kinds_expected.get("door", 0),
            int(id_ps.get("doorWithPsetDoorCommonReference", 0)),
        ),
        "window": _tri(
            kinds_expected.get("window", 0),
            int(id_ps.get("windowWithPsetWindowCommonReference", 0)),
        ),
        "roof": _tri(
            kinds_expected.get("roof", 0),
            int(id_ps.get("roofWithPsetRoofCommonReference", 0)),
        ),
        "stair": _tri(
            kinds_expected.get("stair", 0),
            int(id_ps.get("stairWithPsetStairCommonReference", 0)),
        ),
        "site": _tri(
            kinds_expected.get("site", 0),
            kinds_expected.get("site", 0)
            if (inspection.get("siteExchangeEvidence_v0") or {}).get("kernelIdsMatchJoinedReference") is True
            else 0,
        ),
    }

    qto_ln = inspection.get("qtoLinkedProducts") or {}
    qto_coverage = {
        "wall": _tri(kinds_expected.get("wall", 0), int(qto_ln.get("IfcWall", 0))),
        "floor": _tri(kinds_expected.get("floor", 0), int(qto_ln.get("IfcSlab", 0))),
        "room": _tri(kinds_expected.get("room", 0), int(qto_ln.get("IfcSpace", 0))),
        "door": _tri(kinds_expected.get("door", 0), int(qto_ln.get("IfcDoor", 0))),
        "window": _tri(kinds_expected.get("window", 0), int(qto_ln.get("IfcWindow", 0))),
    }
    all_qto_match = all(v["match"] for v in qto_coverage.values())

    all_pc_match = all(v["match"] for v in product_counts.values())
    all_prog_match = all(v["match"] for v in programme_fields.values()) if programme_fields else True
    all_id_match = all(v["match"] for v in identity_coverage.values())

    sketch_limit = 48
    qto_names_sk = list(inspection.get("qtoTemplates") or [])
    command_sketch = {
        "note": (
            "Traceability-only read-back (storeys, level echo, wall/space Reference, programme samples, QTO names) — "
            "not import-merge replay commands."
        ),
        "levelsFromDocument": _levels_from_document_sketch(doc),
        "storeysFromIfc": _storeys_sketch_from_ifc_model(model),
        "qtoTemplatesFromIfc": qto_names_sk,
        "spaceProgrammeSampleFromIfc": _space_programme_sample_from_ifc_model(model, limit=8),
        "referenceIdsFromIfc": {
            "IfcWall": _references_from_products(list(walls_m), "Pset_WallCommon", limit=sketch_limit),
            "IfcSpace": _references_from_products(list(spaces_m), "Pset_SpaceCommon", limit=sketch_limit),
            "IfcSite": _references_from_products(list(sites_m), "Pset_SiteCommon", limit=sketch_limit),
        },
        "authoritativeReplay_v0": build_kernel_ifc_authoritative_replay_sketch_v0_from_model(model),
    }

    return {
        "matrixVersion": matrix_version,
        "inspection": inspection,
        "kernelExpectedIfcKinds": dict(sorted(kinds_expected.items())),
        "roundtripChecks": {
            "productCounts": product_counts,
            "programmeFields": programme_fields,
            "identityCoverage": identity_coverage,
            "qtoCoverage": qto_coverage,
            "allProductCountsMatch": all_pc_match,
            "allProgrammeFieldsMatch": all_prog_match,
            "allIdentityReferencesMatch": all_id_match,
            "allQtoLinksMatch": all_qto_match,
            "allChecksPass": all_pc_match and all_prog_match and all_id_match and all_qto_match,
        },
        "commandSketch": command_sketch,
    }


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _polygon_area_m2_xy_mm(poly_mm: list[tuple[float, float]]) -> float:
    n = len(poly_mm)
    if n < 3:
        return 0.0
    a = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a / 2.0) / 1e6


def _polygon_perimeter_m_xy_mm(poly_mm: list[tuple[float, float]]) -> float:
    n = len(poly_mm)
    if n < 2:
        return 0.0
    p = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        p += math.hypot(x2 - x1, y2 - y1)
    return p / 1000.0


def _try_attach_qto(f: Any, product: Any, qto_name: str, properties: dict[str, float]) -> None:
    """Narrow QTO slice (WP-X03) — ignored when IfcOpenShell build lacks qto use-cases."""

    try:
        from ifcopenshell.api.pset.add_qto import add_qto  # type: ignore import-not-found
        from ifcopenshell.api.pset.edit_qto import edit_qto  # type: ignore import-not-found

        qto = add_qto(f, product=product, name=qto_name)
        edit_qto(f, qto=qto, properties=dict(properties))
    except Exception:
        return


def _elev_m(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return el.elevation_mm / 1000.0 if isinstance(el, LevelElem) else 0.0


def wall_local_to_world_m(wall: WallElem, elevation_m: float) -> tuple[np.ndarray, float]:
    """4×4 homogeneous transform + wall length — matches `create_2pt_wall` placement."""

    p1_ = np.array([wall.start.x_mm / 1000.0, wall.start.y_mm / 1000.0], dtype=float)
    p2_ = np.array([wall.end.x_mm / 1000.0, wall.end.y_mm / 1000.0], dtype=float)

    dv = p2_ - p1_
    ln = float(np.linalg.norm(dv))
    length_m = ln if ln >= 1e-9 else 1e-6
    vx, vy = (dv / ln).tolist() if ln >= 1e-9 else (1.0, 0.0)

    mat = np.array(
        [
            [vx, -vy, 0.0, p1_[0]],
            [vy, vx, 0.0, p1_[1]],
            [0.0, 0.0, 1.0, elevation_m],
            [0.0, 0.0, 0.0, 1.0],
        ],
        dtype=float,
    )
    return mat, length_m


def _xz_bounds_mm(poly_mm: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly_mm]
    zs = [p[1] for p in poly_mm]
    mn_x, mx_x = min(xs), max(xs)
    mn_z, mx_z = min(zs), max(zs)
    span_x = max(mx_x - mn_x, 1.0)
    span_z = max(mx_z - mn_z, 1.0)
    cx = (mn_x + mx_x) / 2.0
    cz = (mn_z + mx_z) / 2.0
    return cx, cz, span_x, span_z


def _room_outline_mm(rm: RoomElem) -> list[tuple[float, float]]:
    return [(p.x_mm, p.y_mm) for p in rm.outline_mm]


def _vertical_span_m(doc: Document, rm: RoomElem, floor_elev_m: float) -> tuple[float, float]:
    """(base_z, ceiling_z) world elevation for crude space prism."""

    if rm.upper_limit_level_id:
        ceil_el = doc.elements.get(rm.upper_limit_level_id)
        ceiling_z = ceil_el.elevation_mm / 1000.0 if isinstance(ceil_el, LevelElem) else floor_elev_m + 2.8
    else:
        ceiling_z = floor_elev_m + 2.8
    offset = rm.volume_ceiling_offset_mm / 1000.0 if rm.volume_ceiling_offset_mm is not None else 0.0
    ceiling_z -= offset
    if ceiling_z < floor_elev_m + 1.0:
        ceiling_z = floor_elev_m + 2.2
    return floor_elev_m, ceiling_z


def try_build_kernel_ifc(doc: Document) -> tuple[str | None, int]:
    """Build IFC geometry or return `(None, 0)` to fall back to empty hull."""

    import ifcopenshell.api.aggregate
    import ifcopenshell.api.context
    import ifcopenshell.api.feature as ifc_feature
    import ifcopenshell.api.project
    import ifcopenshell.api.root
    import ifcopenshell.api.spatial
    import ifcopenshell.api.unit
    from ifcopenshell.api.geometry.add_slab_representation import add_slab_representation
    from ifcopenshell.api.geometry.add_wall_representation import add_wall_representation
    from ifcopenshell.api.geometry.assign_representation import assign_representation
    from ifcopenshell.api.geometry.create_2pt_wall import create_2pt_wall
    from ifcopenshell.api.geometry.edit_object_placement import edit_object_placement

    f = ifcopenshell.api.project.create_file(version="IFC4")

    proj = ifcopenshell.api.root.create_entity(f, ifc_class="IfcProject", name="bim-ai-export")
    site = ifcopenshell.api.root.create_entity(f, ifc_class="IfcSite", name="Site")
    building = ifcopenshell.api.root.create_entity(f, ifc_class="IfcBuilding", name="Building")

    ifcopenshell.api.unit.assign_unit(f)

    model3d = ifcopenshell.api.context.add_context(f, context_type="Model")
    body_ctx = ifcopenshell.api.context.add_context(
        f, context_identifier="Body", target_view="MODEL_VIEW", parent=model3d
    )

    ifcopenshell.api.aggregate.assign_object(f, products=[site], relating_object=proj)
    ifcopenshell.api.aggregate.assign_object(f, products=[building], relating_object=site)

    storey_by_level: dict[str, Any] = {}
    sorted_levels = sorted(
        ((eid, e) for eid, e in doc.elements.items() if isinstance(e, LevelElem)),
        key=lambda t: (t[1].elevation_mm, t[0]),
    )

    default_storey_tag = None

    if not sorted_levels:
        storey = ifcopenshell.api.root.create_entity(f, ifc_class="IfcBuildingStorey", name="Base")
        if hasattr(storey, "Elevation"):
            storey.Elevation = 0.0

        ifcopenshell.api.aggregate.assign_object(f, products=[storey], relating_object=building)

        storey_by_level[""] = storey
        default_storey_tag = storey
    else:
        for lid, lvl in sorted_levels:
            storey = ifcopenshell.api.root.create_entity(
                f, ifc_class="IfcBuildingStorey", name=lvl.name or lid
            )

            if hasattr(storey, "Elevation"):
                storey.Elevation = float(lvl.elevation_mm)

            storey_by_level[lid] = storey
            ifcopenshell.api.aggregate.assign_object(f, products=[storey], relating_object=building)

            if default_storey_tag is None:
                default_storey_tag = storey

    assert default_storey_tag is not None

    def storey_for(level_id: str) -> Any:
        return storey_by_level.get(level_id) or default_storey_tag

    geo_products = 0
    wall_products: dict[str, Any] = {}
    slab_products: dict[str, Any] = {}

    def attach_kernel_identity_pset(product: Any, pset_name: str, reference: str, **props: Any) -> None:
        try:
            from ifcopenshell.api.pset.add_pset import add_pset  # type: ignore import-not-found
            from ifcopenshell.api.pset.edit_pset import edit_pset  # type: ignore import-not-found

        except ImportError:
            return
        merged: dict[str, Any] = {"Reference": reference, **props}

        pset = add_pset(f, product=product, name=pset_name)

        edit_pset(f, pset=pset, properties=merged)

    kernel_site_ids_sorted = sorted(eid for eid, e in doc.elements.items() if isinstance(e, SiteElem))
    if kernel_site_ids_sorted:
        first_site_el = doc.elements[kernel_site_ids_sorted[0]]
        assert isinstance(first_site_el, SiteElem)
        site.Name = first_site_el.name or kernel_site_ids_sorted[0]
        attach_kernel_identity_pset(site, "Pset_SiteCommon", ",".join(kernel_site_ids_sorted))

    for wid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        w = doc.elements[wid]

        assert isinstance(w, WallElem)
        st_inst = storey_for(w.level_id)

        sx = w.start.x_mm / 1000.0
        sy = w.start.y_mm / 1000.0

        ex = w.end.x_mm / 1000.0

        ey = w.end.y_mm / 1000.0

        ez = _elev_m(doc, w.level_id)
        height_m = _clamp(w.height_mm / 1000.0, 0.25, 40.0)
        thick_m = _clamp(w.thickness_mm / 1000.0, 0.05, 2.0)

        wal = ifcopenshell.api.root.create_entity(f, ifc_class="IfcWall", name=w.name or wid)

        rep = create_2pt_wall(f, wal, body_ctx, (sx, sy), (ex, ey), ez, height_m, thick_m)
        assign_representation(f, wal, rep)

        ifcopenshell.api.spatial.assign_container(f, products=[wal], relating_structure=st_inst)
        wall_products[wid] = wal
        geo_products += 1
        attach_kernel_identity_pset(wal, "Pset_WallCommon", wid)
        _wmat_unused, length_m = wall_local_to_world_m(w, ez)
        _try_attach_qto(
            f,
            wal,
            "Qto_WallBaseQuantities",
            {"Length": float(length_m), "Height": float(height_m), "Width": float(thick_m)},
        )

    for fid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        fl = doc.elements[fid]
        assert isinstance(fl, FloorElem)
        pts = [(p.x_mm, p.y_mm) for p in fl.boundary_mm]
        if len(pts) < 3:

            continue
        st_inst = storey_for(fl.level_id)

        cx_mm, cz_mm, _, _ = _xz_bounds_mm(pts)
        cx_m = cx_mm / 1000.0

        cy_m = cz_mm / 1000.0

        elev_z = _elev_m(doc, fl.level_id)
        thick_m = _clamp(fl.thickness_mm / 1000.0, 0.05, 1.8)

        profile: list[tuple[float, float]] = []

        for px, py in pts:
            profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        profile.append(profile[0])

        slab_z_center = elev_z + thick_m / 2.0

        slab = ifcopenshell.api.root.create_entity(f, ifc_class="IfcSlab", name=fl.name or fid)
        rep = add_slab_representation(f, body_ctx, depth=thick_m, polyline=profile)
        mat = np.eye(4, dtype=float)
        mat[0, 3] = cx_m
        mat[1, 3] = cy_m
        mat[2, 3] = slab_z_center

        edit_object_placement(f, product=slab, matrix=mat)
        assign_representation(f, slab, rep)
        ifcopenshell.api.spatial.assign_container(f, products=[slab], relating_structure=st_inst)
        slab_products[fid] = slab
        geo_products += 1
        attach_kernel_identity_pset(slab, "Pset_SlabCommon", fid)

        slab_area_m2 = _polygon_area_m2_xy_mm(pts)
        slab_perm_m = _polygon_perimeter_m_xy_mm(
            [*pts, pts[0]] if pts else pts,
        )
        _try_attach_qto(
            f,
            slab,
            "Qto_SlabBaseQuantities",
            {
                "GrossArea": float(slab_area_m2),
                "NetArea": float(slab_area_m2),
                "Perimeter": float(slab_perm_m),
                "Width": float(thick_m),
            },
        )

    panel_thickness = 0.06

    def opening_t_extent(
        wall_ent: WallElem, opening_width_m: float, along_t: float
    ) -> tuple[float, float] | None:
        ll = np.hypot(
            (wall_ent.end.x_mm - wall_ent.start.x_mm) / 1000.0,
            (wall_ent.end.y_mm - wall_ent.start.y_mm) / 1000.0,
        )
        if ll < 10.0 / 1000.0:
            return None
        hw = opening_width_m / (2.0 * ll)

        half_t = float(_clamp(hw, 1e-4, 0.49))

        usable_t0 = half_t

        usable_t1 = 1.0 - half_t
        if usable_t1 <= usable_t0:

            return None

        ct = float(_clamp(along_t, usable_t0, usable_t1))

        return ct - half_t, ct + half_t

    def hosted_opening_bundle(
        host_wall_id: str,
        host_wall_ent: WallElem,
        *,
        filling_class: str,
        elem_name: str,
        kernel_elem_id: str,
        opening_width_mm: float,
        along_t: float,
        open_height_m: float,
        sill_offset_m: float,
        material_finish_key: str | None = None,
    ) -> None:
        nonlocal geo_products

        iw = wall_products.get(host_wall_id)

        assert iw is not None
        thick_m_host = _clamp(host_wall_ent.thickness_mm / 1000.0, 0.05, 2.0)
        elev_w = _elev_m(doc, host_wall_ent.level_id)
        wmat, len_m_host = wall_local_to_world_m(host_wall_ent, elev_w)

        width_open = _clamp(opening_width_mm / 1000.0, 0.2, len_m_host * 0.95)

        ih = open_height_m
        open_depth = float(max(thick_m_host * 1.55, panel_thickness * 2 + 1e-3, 0.35))

        tsp = opening_t_extent(host_wall_ent, width_open, along_t)
        if tsp is None:

            return
        t_left, _tr = tsp

        ox = float(t_left * len_m_host)
        oy_layer = float((thick_m_host - open_depth) / 2.0)
        oz = float(sill_offset_m)

        opening = ifcopenshell.api.root.create_entity(f, ifc_class="IfcOpeningElement", name=f"op:{elem_name}")
        rep_o = add_wall_representation(f, body_ctx, length=width_open, height=ih, thickness=open_depth)

        assign_representation(f, opening, rep_o)

        tpl = np.eye(4, dtype=float)
        tpl[0, 3] = ox

        tpl[1, 3] = oy_layer

        tpl[2, 3] = oz

        world_open = wmat @ tpl

        edit_object_placement(f, product=opening, matrix=world_open)
        ifc_feature.add_feature(f, feature=opening, element=iw)

        filler = ifcopenshell.api.root.create_entity(f, ifc_class=filling_class, name=elem_name)
        rep_f = add_wall_representation(
            f,
            body_ctx,
            length=width_open,

            height=ih,

            thickness=max(panel_thickness, thick_m_host * 0.35),

        )

        assign_representation(f, filler, rep_f)

        fill_y = float((thick_m_host - panel_thickness) / 2.0)
        tpl_f = np.eye(4, dtype=float)
        tpl_f[0, 3] = ox

        tpl_f[1, 3] = fill_y

        tpl_f[2, 3] = oz

        world_fill = wmat @ tpl_f

        edit_object_placement(f, product=filler, matrix=world_fill)
        ifc_feature.add_filling(f, opening=opening, element=filler)

        pset_name = "Pset_DoorCommon" if filling_class == "IfcDoor" else "Pset_WindowCommon"

        attach_kernel_identity_pset(
            filler,
            pset_name,
            kernel_elem_id,
            **({"MaterialFinish": material_finish_key} if material_finish_key else {}),
        )

        if filling_class == "IfcDoor":
            _try_attach_qto(
                f,
                filler,
                "Qto_DoorBaseQuantities",
                {"Width": float(width_open), "Height": float(ih)},
            )
        else:
            _try_attach_qto(
                f,
                filler,
                "Qto_WindowBaseQuantities",
                {"Width": float(width_open), "Height": float(ih)},
            )

        geo_products += 2

    for elem_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, DoorElem)):
        d = doc.elements[elem_id]
        assert isinstance(d, DoorElem)
        if d.wall_id not in wall_products:
            continue
        wh = doc.elements[d.wall_id]
        assert isinstance(wh, WallElem)
        w_h_m = _clamp(wh.height_mm / 1000.0, 0.25, 40.0)
        dh = float(_clamp(w_h_m * 0.86, 0.6, min(3.8, max(0.5, w_h_m - 0.05))))

        hosted_opening_bundle(
            d.wall_id,
            wh,
            filling_class="IfcDoor",

            elem_name=d.name or elem_id,

            kernel_elem_id=elem_id,

            opening_width_mm=d.width_mm,

            along_t=d.along_t,

            open_height_m=dh,

            sill_offset_m=0.0,
            material_finish_key=d.material_key,

        )

    for elem_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WindowElem)):
        zwin = doc.elements[elem_id]
        assert isinstance(zwin, WindowElem)
        if zwin.wall_id not in wall_products:
            continue
        wh_wall = doc.elements[zwin.wall_id]
        assert isinstance(wh_wall, WallElem)
        w_top = _elev_m(doc, wh_wall.level_id) + _clamp(wh_wall.height_mm / 1000.0, 0.25, 40.0)
        sill_z = float(_clamp(zwin.sill_height_mm / 1000.0, 0.06, max(0.2, w_top - 1.6)))
        wh_m = float(
            _clamp(
                zwin.height_mm / 1000.0,
                0.15,
                max(0.2, _clamp(wh_wall.height_mm / 1000.0, 0.25, 40.0) - sill_z - 0.08),
            )
        )

        hosted_opening_bundle(
            zwin.wall_id,
            wh_wall,
            filling_class="IfcWindow",
            elem_name=zwin.name or elem_id,

            kernel_elem_id=elem_id,

            opening_width_mm=zwin.width_mm,

            along_t=zwin.along_t,
            open_height_m=wh_m,
            sill_offset_m=sill_z,
            material_finish_key=zwin.material_key,

        )

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoomElem)):
        rm = doc.elements[rid]

        assert isinstance(rm, RoomElem)
        pts_outline = _room_outline_mm(rm)
        if len(pts_outline) < 3:
            continue

        lev_elev_m = float(_elev_m(doc, rm.level_id))
        base_z_m, ceil_z_m = _vertical_span_m(doc, rm, lev_elev_m)
        prism_h_m = float(_clamp(ceil_z_m - base_z_m, 2.2, 12.0))

        slab_z_mid = lev_elev_m + prism_h_m / 2.0

        cx_mm, cz_mm, _, _ = _xz_bounds_mm(pts_outline)

        cx_m = cx_mm / 1000.0

        cy_m = cz_mm / 1000.0

        profile_floor: list[tuple[float, float]] = []

        for px, py in pts_outline:
            profile_floor.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        profile_floor.append(profile_floor[0])

        sp = ifcopenshell.api.root.create_entity(f, ifc_class="IfcSpace", name=rm.name or rid)
        rep_sp = add_slab_representation(f, body_ctx, depth=prism_h_m, polyline=profile_floor)

        spa_mat = np.eye(4, dtype=float)

        spa_mat[0, 3] = cx_m
        spa_mat[1, 3] = cy_m
        spa_mat[2, 3] = slab_z_mid

        edit_object_placement(f, product=sp, matrix=spa_mat)
        assign_representation(f, sp, rep_sp)

        storey_sp = storey_for(rm.level_id)

        ifcopenshell.api.aggregate.assign_object(f, products=[sp], relating_object=storey_sp)
        geo_products += 1
        attach_kernel_identity_pset(sp, "Pset_SpaceCommon", rid, **_kernel_ifc_space_export_props(rm))
        gross_area = _polygon_area_m2_xy_mm(pts_outline)
        _try_attach_qto(
            f,
            sp,
            "Qto_SpaceBaseQuantities",
            {"GrossFloorArea": float(gross_area), "NetFloorArea": float(gross_area)},
        )

    for oid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, SlabOpeningElem)):
        sop = doc.elements[oid]
        assert isinstance(sop, SlabOpeningElem)
        host_slab_ent = slab_products.get(sop.host_floor_id)
        host_fl = doc.elements.get(sop.host_floor_id)
        if host_slab_ent is None or not isinstance(host_fl, FloorElem):
            continue
        op_pts_mm = [(p.x_mm, p.y_mm) for p in sop.boundary_mm]
        if len(op_pts_mm) < 3:
            continue
        cx_mm, cz_mm, _, _ = _xz_bounds_mm(op_pts_mm)
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0
        elev_z = float(_elev_m(doc, host_fl.level_id))
        thick_host = float(_clamp(host_fl.thickness_mm / 1000.0, 0.05, 1.8))
        slab_z_center = elev_z + thick_host / 2.0
        open_depth = float(max(thick_host * 2.25, 0.14))

        op_profile: list[tuple[float, float]] = []
        for px, py in op_pts_mm:
            op_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        op_profile.append(op_profile[0])

        op_el = ifcopenshell.api.root.create_entity(f, ifc_class="IfcOpeningElement", name=f"op:{oid}")

        rep_op = add_slab_representation(f, body_ctx, depth=open_depth, polyline=op_profile)

        assign_representation(f, op_el, rep_op)

        omat = np.eye(4, dtype=float)
        omat[0, 3] = cx_m
        omat[1, 3] = cy_m

        omat[2, 3] = slab_z_center

        edit_object_placement(f, product=op_el, matrix=omat)
        ifc_feature.add_feature(f, feature=op_el, element=host_slab_ent)
        geo_products += 1

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        rp_mm = [(p.x_mm, p.y_mm) for p in rf.footprint_mm]
        if len(rp_mm) < 3:
            continue
        cx_mm, cz_mm, _, _ = _xz_bounds_mm(rp_mm)
        ov = _clamp(float(rf.overhang_mm or 0) / 1000.0, 0.0, 5.0)
        elev = float(_elev_m(doc, rf.reference_level_id))
        rise = float(_clamp(float(rf.slope_deg or 25) / 70.0, 0.25, 2.8))
        roof_z_center = elev + ov * 0.12 + rise / 2.0
        cx_m = cx_mm / 1000.0
        cy_m = cz_mm / 1000.0

        r_profile: list[tuple[float, float]] = []
        for px, py in rp_mm:
            r_profile.append((px / 1000.0 - cx_m, py / 1000.0 - cy_m))

        r_profile.append(r_profile[0])

        roof_ent = ifcopenshell.api.root.create_entity(f, ifc_class="IfcRoof", name=rf.name or rid)
        rep_rf = add_slab_representation(f, body_ctx, depth=rise, polyline=r_profile)

        rmat = np.eye(4, dtype=float)
        rmat[0, 3] = cx_m
        rmat[1, 3] = cy_m
        rmat[2, 3] = roof_z_center

        edit_object_placement(f, product=roof_ent, matrix=rmat)
        assign_representation(f, roof_ent, rep_rf)
        st_roof = storey_for(rf.reference_level_id)
        ifcopenshell.api.spatial.assign_container(f, products=[roof_ent], relating_structure=st_roof)
        geo_products += 1
        attach_kernel_identity_pset(roof_ent, "Pset_RoofCommon", rid)

    for sid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, StairElem)):
        st = doc.elements[sid]
        assert isinstance(st, StairElem)
        sx = st.run_start.x_mm / 1000.0
        sy = st.run_start.y_mm / 1000.0
        ex = st.run_end.x_mm / 1000.0
        ey = st.run_end.y_mm / 1000.0
        bl = doc.elements.get(st.base_level_id)
        tl = doc.elements.get(st.top_level_id)
        rise_mm = (
            abs(tl.elevation_mm - bl.elevation_mm)
            if isinstance(bl, LevelElem) and isinstance(tl, LevelElem)
            else float(st.riser_mm) * 16.0
        )
        rise_m = float(_clamp(rise_mm / 1000.0, 0.5, 12.0))
        elev_base = float(_elev_m(doc, st.base_level_id))
        width_m = float(_clamp(st.width_mm / 1000.0, 0.3, 4.0))

        stair_ent = ifcopenshell.api.root.create_entity(f, ifc_class="IfcStair", name=st.name or sid)
        rep_st = create_2pt_wall(f, stair_ent, body_ctx, (sx, sy), (ex, ey), elev_base, rise_m, width_m)
        assign_representation(f, stair_ent, rep_st)
        st_inst_st = storey_for(st.base_level_id)
        ifcopenshell.api.spatial.assign_container(f, products=[stair_ent], relating_structure=st_inst_st)
        geo_products += 1
        attach_kernel_identity_pset(stair_ent, "Pset_StairCommon", sid)

    if geo_products == 0:

        return None, 0

    return f.wrapped_data.to_string(), geo_products

