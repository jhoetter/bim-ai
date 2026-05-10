"""IFC exchange-scope helpers for the kernel exporter/import preview."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import LevelElem

try:
    import ifcopenshell.util.element as ifc_elem_util
except ImportError:
    ifc_elem_util = None  # type: ignore[misc, assignment]

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


def ifc_product_is_kernel_slice_supported(product: Any) -> bool:
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


def import_scope_unsupported_ifc_products_v0(model: Any) -> dict[str, Any]:
    """IFC product instances outside the kernel slice roots (import-merge scope evidence)."""

    counts: dict[str, int] = {}
    for p in model.by_type("IfcProduct") or []:
        if ifc_product_is_kernel_slice_supported(p):
            continue
        try:
            cls_name = str(p.is_a())
        except Exception:
            cls_name = "Unknown"
        counts[cls_name] = counts.get(cls_name, 0) + 1
    return {"schemaVersion": 0, "countsByClass": dict(sorted(counts.items()))}


def storeys_sketch_from_ifc_model(model: Any) -> list[dict[str, Any]]:
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


def levels_from_document_sketch(doc: Document) -> list[dict[str, Any]]:
    levels = [(eid, e) for eid, e in doc.elements.items() if isinstance(e, LevelElem)]
    levels.sort(key=lambda t: (t[1].elevation_mm, t[0]))
    return [{"id": eid, "name": e.name or "", "elevationMm": e.elevation_mm} for eid, e in levels]


def space_programme_sample_from_ifc_model(model: Any, *, limit: int) -> list[dict[str, Any]]:
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
        sk = (
            ref_s
            or str(getattr(sp, "Name", None) or "")
            or str(getattr(sp, "GlobalId", None) or "")
        )
        row: dict[str, Any] = {"programmeFields": chunk}
        if ref_s:
            row["reference"] = ref_s
        nm = str(getattr(sp, "Name", None) or "").strip()
        if nm:
            row["spaceName"] = nm
        keyed.append((sk, row))
    keyed.sort(key=lambda t: t[0])
    return [t[1] for t in keyed[:limit]]
