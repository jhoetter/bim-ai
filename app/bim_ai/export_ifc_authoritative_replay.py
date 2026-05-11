from __future__ import annotations

from collections import Counter
from typing import Any

from bim_ai.commands import (
    CreateFloorCmd,
    CreateLevelCmd,
    CreateRoofCmd,
    CreateRoofOpeningCmd,
    CreateRoomOutlineCmd,
    CreateSlabOpeningCmd,
    CreateStairCmd,
    CreateWallCmd,
)
from bim_ai.document import Document
from bim_ai.elements import Vec2Mm
from bim_ai.export_ifc_geometry import clamp
from bim_ai.export_ifc_readback import (
    _ifc_global_id_slug,
    _ifc_model_has_slab_void_opening_topology_v0,
    _ifc_product_defines_qto_template,
    _ifc_try_product_is_a,
    _kernel_horizontal_extrusion_footprint_mm_and_thickness,
    _kernel_slab_opening_replay_element_id,
    _kernel_space_footprint_outline_mm,
    _kernel_wall_plan_geometry_mm,
    _product_host_storey_global_id,
    _read_named_qto_values,
    _references_from_products,
    _void_rel_and_host_for_opening,
)
from bim_ai.export_ifc_scope import (
    import_scope_unsupported_ifc_products_v0,
    levels_from_document_sketch,
    space_programme_sample_from_ifc_model,
    storeys_sketch_from_ifc_model,
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

# Imported lazily from the legacy facade while export_ifc.py is being split.
# export_ifc.py defines these before importing this module, so the cycle is
# bounded to already-initialized names.
from bim_ai.export_ifc import (  # noqa: E402
    AUTHORITATIVE_REPLAY_KIND_V0,
    KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
    export_ifc_model_step,
    inspect_kernel_ifc_semantics,
    kernel_expected_ifc_emit_counts,
    kernel_expected_space_programme_counts,
    kernel_export_eligible,
)


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


def _pset_str(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _pset_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed else None


def _pset_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "t", "yes", "y", "1"}:
            return True
        if normalized in {"false", "f", "no", "n", "0"}:
            return False
    return None


def _wall_structural_role_from_pset(bucket: dict[str, Any], load_bearing: bool | None) -> str:
    role = _pset_str(bucket.get("BimAiStructuralRole"))
    if role in {"unknown", "load_bearing", "non_load_bearing"}:
        return role
    if load_bearing is True:
        return "load_bearing"
    if load_bearing is False:
        return "non_load_bearing"
    return "unknown"


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
    return float(clamp(ov_m * 1000.0, 0.0, 5000.0))


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


_AUTHORITATIVE_REPLAY_SLAB_PREDEFINED_ALLOWED_V0: frozenset[str] = frozenset(
    {"", "FLOOR", "BASESLAB", "NOTDEFINED", "USERDEFINED"}
)


def _ifc_slab_predefined_type_token_v0(slab: Any) -> str:
    """Upper token for IfcSlab ``PredefinedType`` (empty when unset / readable)."""

    try:
        import ifcopenshell.util.element as ieu

        raw = ieu.get_predefined_type(slab)
    except Exception:
        raw = getattr(slab, "PredefinedType", None)
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    if "." in s:
        s = s.split(".")[-1]
    return s.upper().replace(" ", "")


def _ifc_slab_type_identity_reference_v0(slab: Any) -> str | None:
    """``Pset_SlabCommon.Reference`` on related IfcSlabType, when present."""

    if ifc_elem_util is None:
        return None
    try:
        import ifcopenshell.util.element as ieu

        st = ieu.get_type(slab)
    except Exception:
        st = None
    if st is None:
        return None
    try:
        ps = ifc_elem_util.get_psets(st)
        bucket = ps.get("Pset_SlabCommon") or {}
        ref = bucket.get("Reference")
        s = ref.strip() if isinstance(ref, str) else ""
        return s or None
    except Exception:
        return None


def _slab_gap_reason_counts_v0(gaps: list[dict[str, Any]]) -> dict[str, int]:
    ctr: Counter[str] = Counter()
    for row in gaps:
        if row.get("slabGlobalId"):
            ctr[str(row.get("reason") or "unknown")] += 1
    return dict(sorted(ctr.items()))


def _sort_authoritative_replay_extraction_gaps_v0(
    gaps: list[dict[str, Any]],
) -> list[dict[str, Any]]:
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
    unsupported = import_scope_unsupported_ifc_products_v0(model)

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
    ids_floor_rows: list[dict[str, Any]] = []
    slab_global_id_to_kernel_ref: dict[str, str] = {}
    slabs_skipped_no_reference = 0

    all_slabs_seq = list(model.by_type("IfcSlab") or [])
    slab_ifc_product_count_v0 = len(all_slabs_seq)

    for slab in sorted(all_slabs_seq, key=lambda s: str(getattr(s, "GlobalId", None) or "")):
        ps_sl = ifc_elem_util.get_psets(slab)
        bucket_sl = ps_sl.get("Pset_SlabCommon") or {}
        ref_sl = bucket_sl.get("Reference")
        ref_s = ref_sl.strip() if isinstance(ref_sl, str) else ""
        if not ref_s:
            slabs_skipped_no_reference += 1
            continue

        ptok = _ifc_slab_predefined_type_token_v0(slab)
        if ptok not in _AUTHORITATIVE_REPLAY_SLAB_PREDEFINED_ALLOWED_V0:
            extraction_gaps.append(
                {
                    "slabGlobalId": str(getattr(slab, "GlobalId", None) or ""),
                    "kernelReference": ref_s,
                    "reason": "unsupported_slab_predefined_type",
                    "slabPredefinedType": ptok,
                }
            )
            continue

        type_ref_raw = _ifc_slab_type_identity_reference_v0(slab)
        floor_type_for_cmd: str | None = (
            type_ref_raw if (type_ref_raw is not None and type_ref_raw.strip() != ref_s) else None
        )

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
        thick_mm = float(clamp(thick_mm, 50.0, 1800.0))
        sname = str(getattr(slab, "Name", None) or "") or ref_s
        floor_cmds.append(
            CreateFloorCmd(
                id=ref_s,
                name=sname,
                level_id=storey_gid_to_level_id[st_gid_sl],
                boundary_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_sl],
                thickness_mm=thick_mm,
                floor_type_id=floor_type_for_cmd,
            ).model_dump(mode="json", by_alias=True, exclude_none=True)
        )
        sgid = str(getattr(slab, "GlobalId", None) or "")
        if sgid:
            slab_global_id_to_kernel_ref[sgid] = ref_s
        ids_floor_rows.append(
            {
                "ifcGlobalId": sgid,
                "identityReference": ref_s,
                "floorTypeIdentityReference": type_ref_raw,
                "qtoSlabBaseQuantitiesLinked": _ifc_product_defines_qto_template(
                    slab, "Qto_SlabBaseQuantities"
                ),
            }
        )

    floor_cmds.sort(key=lambda c: str(c.get("id") or ""))
    ids_floor_rows.sort(key=lambda r: (r["identityReference"], r["ifcGlobalId"]))

    wall_cmds: list[dict[str, Any]] = []
    wall_global_id_to_kernel_ref: dict[str, str] = {}
    walls_skipped_no_reference = 0

    for wal in sorted(
        model.by_type("IfcWall") or [], key=lambda w: str(getattr(w, "GlobalId", None) or "")
    ):
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
                {
                    "wallGlobalId": str(getattr(wal, "GlobalId", None) or ""),
                    "reason": "missing_or_unknown_host_storey",
                }
            )
            continue

        geo = _kernel_wall_plan_geometry_mm(wal)
        if geo is None:
            extraction_gaps.append(
                {
                    "wallGlobalId": str(getattr(wal, "GlobalId", None) or ""),
                    "kernelReference": ref_s,
                    "reason": "wall_body_extrusion_unreadable",
                }
            )
            continue

        wname = str(getattr(wal, "Name", None) or "") or ref_s
        load_bearing = _pset_bool(bucket.get("LoadBearing"))
        structural_role = _wall_structural_role_from_pset(bucket, load_bearing)
        wall_cmds.append(
            CreateWallCmd(
                id=ref_s,
                name=wname,
                level_id=storey_gid_to_level_id[st_gid],
                start={"xMm": geo["start_x_mm"], "yMm": geo["start_y_mm"]},
                end={"xMm": geo["end_x_mm"], "yMm": geo["end_y_mm"]},
                thickness_mm=geo["thickness_mm"],
                height_mm=geo["height_mm"],
                load_bearing=load_bearing,
                structural_role=structural_role,
                analytical_participation=_pset_bool(
                    bucket.get("BimAiAnalyticalParticipation")
                )
                is True,
                structural_material_key=_pset_str(bucket.get("BimAiStructuralMaterialKey")),
                structural_intent_confidence=_pset_float(
                    bucket.get("BimAiStructuralIntentConfidence")
                ),
            ).model_dump(mode="json", by_alias=True)
        )
        wgid = str(getattr(wal, "GlobalId", None) or "")
        if wgid:
            wall_global_id_to_kernel_ref[wgid] = ref_s

    wall_cmds.sort(key=lambda c: str(c.get("id") or ""))

    roof_cmds: list[dict[str, Any]] = []
    ids_roof_rows: list[dict[str, Any]] = []
    roofs_skipped_no_reference = 0
    # IFC-03: maps IfcRoof GlobalId → kernel ref so the roof-hosted
    # opening replay loop below can resolve the kernel host id without
    # walking pset dictionaries a second time.
    roof_global_id_to_kernel_ref: dict[str, str] = {}

    for rfl in sorted(
        model.by_type("IfcRoof") or [], key=lambda r: str(getattr(r, "GlobalId", None) or "")
    ):
        rf_gid = str(getattr(rfl, "GlobalId", None) or "")
        ps_rf = ifc_elem_util.get_psets(rfl)
        bucket_rf = ps_rf.get("Pset_RoofCommon") or {}
        ref_rf = bucket_rf.get("Reference")
        ref_s = ref_rf.strip() if isinstance(ref_rf, str) else ""
        if not ref_s:
            roofs_skipped_no_reference += 1
            extraction_gaps.append(
                {"roofGlobalId": rf_gid, "reason": "roof_missing_pset_reference"}
            )
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

        # IFC-01 / IFC-02: BimAiKernel pset carries the kernel roof_type_id and,
        # for gable / asymmetric_gable bodies, the original plan footprint and
        # geometry mode. When present, we use these to round-trip without having
        # to invert the gable extrusion's placement and triangular profile.
        bucket_bim_ai = ps_rf.get("Pset_BimAiKernel") or {}
        roof_type_id_raw = bucket_bim_ai.get("BimAiRoofTypeId")
        roof_type_id_replay: str | None = (
            roof_type_id_raw.strip()
            if isinstance(roof_type_id_raw, str) and roof_type_id_raw.strip()
            else None
        )
        bim_ai_geometry_mode = bucket_bim_ai.get("BimAiRoofGeometryMode")
        bim_ai_footprint_raw = bucket_bim_ai.get("BimAiRoofPlanFootprintMm")

        outline_rf: list[tuple[float, float]] | None = None
        rise_m: float | None = None
        if isinstance(bim_ai_footprint_raw, str) and bim_ai_footprint_raw.strip():
            try:
                pts: list[tuple[float, float]] = []
                for chunk in bim_ai_footprint_raw.split(";"):
                    a, b = chunk.split(",")
                    pts.append((float(a), float(b)))
                if len(pts) >= 3:
                    outline_rf = pts
            except Exception:
                outline_rf = None

        if outline_rf is None:
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
            rise_m=rise_m if rise_m is not None else 0.5,
        )
        slope_deg = _replay_infer_roof_slope_deg_from_prism_rise_m(
            rise_m=rise_m if rise_m is not None else 0.5
        )

        replay_mode: str = "mass_box"
        if isinstance(bim_ai_geometry_mode, str) and bim_ai_geometry_mode in (
            "mass_box",
            "gable_pitched_rectangle",
            "asymmetric_gable",
            "flat",
        ):
            replay_mode = bim_ai_geometry_mode

        ridge_offset_mm: float | None = None
        eave_left_mm: float | None = None
        eave_right_mm: float | None = None
        for raw_key, target in (
            ("BimAiRoofRidgeOffsetTransverseMm", "ridge_offset"),
            ("BimAiRoofEaveHeightLeftMm", "eave_left"),
            ("BimAiRoofEaveHeightRightMm", "eave_right"),
        ):
            v = bucket_bim_ai.get(raw_key)
            if isinstance(v, (int, float)):
                if target == "ridge_offset":
                    ridge_offset_mm = float(v)
                elif target == "eave_left":
                    eave_left_mm = float(v)
                else:
                    eave_right_mm = float(v)

        rname = str(getattr(rfl, "Name", None) or "") or ref_s
        roof_cmds.append(
            CreateRoofCmd(
                id=ref_s,
                name=rname,
                reference_level_id=storey_gid_to_level_id[st_gid_rf],
                footprint_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_rf],
                overhang_mm=overhang_mm,
                slope_deg=slope_deg,
                roof_geometry_mode=replay_mode,  # type: ignore[arg-type]
                ridge_offset_transverse_mm=ridge_offset_mm,
                eave_height_left_mm=eave_left_mm,
                eave_height_right_mm=eave_right_mm,
                roof_type_id=roof_type_id_replay,
            ).model_dump(mode="json", by_alias=True)
        )
        ids_roof_rows.append({"ifcGlobalId": rf_gid, "identityReference": ref_s})
        if rf_gid:
            roof_global_id_to_kernel_ref[rf_gid] = ref_s

    roof_cmds.sort(key=lambda c: str(c.get("id") or ""))
    ids_roof_rows.sort(key=lambda r: (r["identityReference"], r["ifcGlobalId"]))

    stair_cmds: list[dict[str, Any]] = []
    ids_stair_rows: list[dict[str, Any]] = []
    stairs_skipped_no_reference = 0

    for sta in sorted(
        model.by_type("IfcStair") or [], key=lambda s: str(getattr(s, "GlobalId", None) or "")
    ):
        sta_gid = str(getattr(sta, "GlobalId", None) or "")
        ps_sta = ifc_elem_util.get_psets(sta)
        bucket_sta = ps_sta.get("Pset_StairCommon") or {}
        ref_sta = bucket_sta.get("Reference")
        ref_s = ref_sta.strip() if isinstance(ref_sta, str) else ""
        if not ref_s:
            stairs_skipped_no_reference += 1
            extraction_gaps.append(
                {"stairGlobalId": sta_gid, "reason": "stair_missing_pset_reference"}
            )
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
        stair_qto = _read_named_qto_values(sta, "Qto_StairBaseQuantities")
        stair_cmd = CreateStairCmd(
            id=ref_s,
            name=stname,
            base_level_id=base_lvl_id,
            top_level_id=candidates[0],
            run_start_mm=Vec2Mm(x_mm=geo_st["start_x_mm"], y_mm=geo_st["start_y_mm"]),
            run_end_mm=Vec2Mm(x_mm=geo_st["end_x_mm"], y_mm=geo_st["end_y_mm"]),
            width_mm=geo_st["thickness_mm"],
        ).model_dump(mode="json", by_alias=True, exclude={"riser_mm", "tread_mm"})
        stair_cmd["totalHeightMm"] = float(geo_st["height_mm"])
        riser_count_qto = stair_qto.get("NumberOfRisers")
        tread_count_qto = stair_qto.get("NumberOfTreads")
        if riser_count_qto is not None:
            stair_cmd["riserCount"] = int(round(riser_count_qto))
        if tread_count_qto is not None:
            stair_cmd["treadCount"] = int(round(tread_count_qto))
        stair_cmds.append(stair_cmd)
        ids_stair_rows.append(
            {
                "ifcGlobalId": sta_gid,
                "identityReference": ref_s,
                "totalHeightMm": float(geo_st["height_mm"]),
                "qtoStairBaseQuantitiesLinked": _ifc_product_defines_qto_template(
                    sta, "Qto_StairBaseQuantities"
                ),
                "riserCount": int(round(riser_count_qto)) if riser_count_qto is not None else None,
                "treadCount": int(round(tread_count_qto)) if tread_count_qto is not None else None,
            }
        )

    stair_cmds.sort(key=lambda c: str(c.get("id") or ""))
    ids_stair_rows.sort(key=lambda r: (r["identityReference"], r["ifcGlobalId"]))

    door_cmds, win_cmds, kernel_door_skip, kernel_window_skip = (
        build_wall_hosted_opening_replay_commands_v0(
            model,
            wall_global_id_to_kernel_ref=wall_global_id_to_kernel_ref,
            storey_gid_to_elev_mm=storey_gid_to_elev_mm,
            extraction_gaps=extraction_gaps,
        )
    )

    slab_opening_cmds: list[dict[str, Any]] = []
    roof_opening_cmds: list[dict[str, Any]] = []
    skip_detail_rows: list[dict[str, Any]] = []
    wall_host_opening_skipped_v0 = 0

    for op in sorted(
        model.by_type("IfcOpeningElement") or [],
        key=lambda o: str(getattr(o, "GlobalId", None) or ""),
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
        except AttributeError:
            pass

        if _ifc_try_product_is_a(host, "IfcWall"):
            wall_host_opening_skipped_v0 += 1
            continue
        if _ifc_try_product_is_a(host, "IfcRoof"):
            # IFC-03: replay roof-hosted voids as createRoofOpening
            # commands instead of dropping them. Mirrors the slab path.
            roof_ref = roof_global_id_to_kernel_ref.get(host_gid)
            if not roof_ref:
                skip_detail_rows.append(
                    {
                        "openingGlobalId": op_gid,
                        "hostGlobalId": host_gid,
                        "hostClass": "IfcRoof",
                        "reason": "roof_host_missing_kernel_reference_v0",
                    }
                )
                continue
            geo_op_rf = _kernel_horizontal_extrusion_footprint_mm_and_thickness(op)
            if geo_op_rf is None:
                skip_detail_rows.append(
                    {
                        "openingGlobalId": op_gid,
                        "hostGlobalId": host_gid,
                        "hostClass": "IfcRoof",
                        "reason": "roof_opening_body_extrusion_unreadable_v0",
                    }
                )
                continue
            outline_op_rf, _dep_op_rf = geo_op_rf
            if len(outline_op_rf) < 3:
                skip_detail_rows.append(
                    {
                        "openingGlobalId": op_gid,
                        "hostGlobalId": host_gid,
                        "hostClass": "IfcRoof",
                        "reason": "roof_opening_outline_degenerate_v0",
                    }
                )
                continue
            elem_id_rf = _kernel_slab_opening_replay_element_id(op)
            oname_rf = str(getattr(op, "Name", None) or "").strip() or elem_id_rf
            roof_opening_cmds.append(
                CreateRoofOpeningCmd(
                    id=elem_id_rf,
                    name=oname_rf,
                    host_roof_id=roof_ref,
                    boundary_mm=[Vec2Mm(x_mm=px, y_mm=py) for px, py in outline_op_rf],
                ).model_dump(mode="json", by_alias=True)
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
    roof_opening_cmds.sort(key=lambda c: str(c.get("id") or ""))

    skip_ctr: Counter[str] = Counter()
    skip_ctr["IfcWall:wall_host_opening_handled_by_door_window_path_v0"] = (
        wall_host_opening_skipped_v0
    )
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

    for spa in sorted(
        model.by_type("IfcSpace") or [], key=lambda s: str(getattr(s, "GlobalId", None) or "")
    ):
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

    slab_gap_ctr = _slab_gap_reason_counts_v0(extraction_gaps)
    typed_floor_skip_ctr: dict[str, int] = {
        "slab_missing_pset_reference_v0": int(slabs_skipped_no_reference),
    }
    for reason, n in slab_gap_ctr.items():
        typed_floor_skip_ctr[f"slab_gap:{reason}"] = int(n)

    typed_floor_authoritative_replay_evidence_v0: dict[str, Any] = {
        "schemaVersion": 0,
        "slabIfcProductCount": slab_ifc_product_count_v0,
        "createFloorReplayCommandCount": len(floor_cmds),
        "idsFloorRowsCount": len(ids_floor_rows),
        "skipCountersByReason": dict(sorted(typed_floor_skip_ctr.items())),
    }

    merged_cmds = (
        level_cmds
        + floor_cmds
        + wall_cmds
        + roof_cmds
        + stair_cmds
        + door_cmds
        + win_cmds
        + slab_opening_cmds
        + roof_opening_cmds
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
        "typedFloorAuthoritativeReplayEvidence_v0": typed_floor_authoritative_replay_evidence_v0,
        "idsAuthoritativeReplayMap_v0": {
            "schemaVersion": 0,
            "note": (
                "Per-product linkage for cleanroom IDS read-back vs authoritative replay rows: IfcSpace rows carry "
                "programme + Qto_SpaceBaseQuantities; IfcRoof rows carry identity Reference only (no roof QTO slice); "
                "IfcSlab / typed floor rows carry instance Reference + optional IfcSlabType Reference + "
                "Qto_SlabBaseQuantities linkage flag; IfcStair rows carry identity Reference + "
                "Qto_StairBaseQuantities linkage flag + riserCount/treadCount/totalHeightMm. "
                "Space identity Reference aligns with "
                "exchange_ifc_ids_identity_pset_gap; qtoSpaceBaseQuantitiesLinked aligns with "
                "exchange_ifc_ids_qto_gap."
            ),
            "spaces": ids_space_rows,
            "roofs": ids_roof_rows,
            "floors": ids_floor_rows,
            "stairs": ids_stair_rows,
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
        + kinds_expected.get("roof_opening", 0)
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
        # IFC-03: roof-hosted void round-trip — kernel-side roof_opening
        # count vs IfcOpeningElement instances hosted on IfcRoof.
        "roofHostedOpenings": _tri(
            kinds_expected.get("roof_opening", 0),
            int((inspection.get("openingsByHostKind") or {}).get("roof", 0)),
        ),
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
            if (inspection.get("siteExchangeEvidence_v0") or {}).get(
                "kernelIdsMatchJoinedReference"
            )
            is True
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
    all_prog_match = (
        all(v["match"] for v in programme_fields.values()) if programme_fields else True
    )
    all_id_match = all(v["match"] for v in identity_coverage.values())

    ml_ins = inspection.get("materialLayerSetReadback_v0")
    material_layer_readback: dict[str, Any]
    if isinstance(ml_ins, dict) and ml_ins.get("available"):
        ml_sum = ml_ins.get("summary") if isinstance(ml_ins.get("summary"), dict) else {}
        material_layer_readback = {
            "hostsCompared": int(ml_sum.get("hostsCompared") or 0),
            "hostsMatched": int(ml_sum.get("hostsMatched") or 0),
            "hostsMissingIfcLayers": int(ml_sum.get("hostsMissingIfcLayers") or 0),
            "hostsPartialMismatch": int(ml_sum.get("hostsPartialMismatch") or 0),
            "allMatched": bool(ml_sum.get("allMatchedComparedHosts")),
        }
    else:
        material_layer_readback = {"allMatched": True}

    pc_ins = inspection.get("propertySetCoverageEvidence_v0")
    property_set_coverage: dict[str, Any] | None = None
    if isinstance(pc_ins, dict) and pc_ins.get("available"):
        pcs = pc_ins.get("summary") if isinstance(pc_ins.get("summary"), dict) else {}
        property_set_coverage = {
            "inspectPointer": "inspect_kernel_ifc_semantics.propertySetCoverageEvidence_v0",
            "rowsTotal": int(pcs.get("rowsTotal") or 0),
            "rowsWithGap": int(pcs.get("rowsWithGap") or 0),
            "idsGapReasonCounts": dict(pcs.get("idsGapReasonCounts") or {}),
            "allRowsGapFree": int(pcs.get("rowsWithGap") or 0) == 0,
            "slabVoidOpeningsWithoutIdentityPset": int(
                pcs.get("slabVoidOpeningsWithoutIdentityPset") or 0
            ),
        }

    sketch_limit = 48
    qto_names_sk = list(inspection.get("qtoTemplates") or [])
    command_sketch = {
        "note": (
            "Traceability-only read-back (storeys, level echo, wall/space Reference, programme samples, QTO names) — "
            "not import-merge replay commands."
        ),
        "levelsFromDocument": levels_from_document_sketch(doc),
        "storeysFromIfc": storeys_sketch_from_ifc_model(model),
        "qtoTemplatesFromIfc": qto_names_sk,
        "spaceProgrammeSampleFromIfc": space_programme_sample_from_ifc_model(model, limit=8),
        "referenceIdsFromIfc": {
            "IfcWall": _references_from_products(
                list(walls_m), "Pset_WallCommon", limit=sketch_limit
            ),
            "IfcSpace": _references_from_products(
                list(spaces_m), "Pset_SpaceCommon", limit=sketch_limit
            ),
            "IfcSite": _references_from_products(
                list(sites_m), "Pset_SiteCommon", limit=sketch_limit
            ),
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
            "materialLayerReadback": material_layer_readback,
            "propertySetCoverage": property_set_coverage,
            "allProductCountsMatch": all_pc_match,
            "allProgrammeFieldsMatch": all_prog_match,
            "allIdentityReferencesMatch": all_id_match,
            "allQtoLinksMatch": all_qto_match,
            "allChecksPass": all_pc_match and all_prog_match and all_id_match and all_qto_match,
        },
        "commandSketch": command_sketch,
    }


def build_ifc_import_preview_v0(step_text: str) -> dict[str, Any]:
    """Deterministic IFC import preview: command counts, unresolved refs, authoritative vs
    unsupported products, IDS pointer coverage, and safe-apply classification.

    Runs entirely from STEP text; no document context is required.  Stable across repeated
    runs against the same input (deterministic sketch + sorted outputs).
    """

    _unavailable_base: dict[str, Any] = {
        "schemaVersion": 0,
        "commandCountsByKind": {},
        "commandCountTotal": 0,
        "unresolvedReferences": [],
        "unresolvedReferenceCount": 0,
        "idCollisionClasses": {},
        "skipCountsByReason": {},
        "authoritativeProducts": {},
        "unsupportedProducts": {"schemaVersion": 0, "countsByClass": {}},
        "idsPointerCoverage": {"schemaVersion": 0, "available": False},
    }

    if not IFC_AVAILABLE:
        return {
            **_unavailable_base,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "safeApplyClassification": {
                "authoritativeSliceSafeApply": False,
                "notApplyReasons": ["ifcopenshell_not_installed"],
                "note": "IfcOpenShell is not installed; install '.[ifc]' to enable preview.",
            },
        }

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step_text)

    if not sketch.get("available"):
        return {
            **_unavailable_base,
            "available": False,
            "reason": str(sketch.get("reason") or "sketch_unavailable"),
            "unsupportedProducts": sketch.get("unsupportedIfcProducts")
            or {"schemaVersion": 0, "countsByClass": {}},
            "safeApplyClassification": {
                "authoritativeSliceSafeApply": False,
                "notApplyReasons": [str(sketch.get("reason") or "sketch_unavailable")],
                "note": "Authoritative replay sketch is unavailable.",
            },
        }

    commands: list[dict[str, Any]] = list(sketch.get("commands") or [])
    cmd_counts: dict[str, int] = {}
    for cmd in commands:
        t = str(cmd.get("type") or "")
        if t:
            cmd_counts[t] = cmd_counts.get(t, 0) + 1

    extraction_gaps: list[dict[str, Any]] = [
        g for g in (sketch.get("extractionGaps") or []) if isinstance(g, dict)
    ]

    raw_skips = {
        "kernelWallSkippedNoReference": sketch.get("kernelWallSkippedNoReference", 0),
        "kernelSlabSkippedNoReference": sketch.get("kernelSlabSkippedNoReference", 0),
        "kernelSpaceSkippedNoReference": sketch.get("kernelSpaceSkippedNoReference", 0),
        "kernelDoorSkippedNoReference": sketch.get("kernelDoorSkippedNoReference", 0),
        "kernelWindowSkippedNoReference": sketch.get("kernelWindowSkippedNoReference", 0),
        "kernelStairSkippedNoReference": sketch.get("kernelStairSkippedNoReference", 0),
        "kernelRoofSkippedNoReference": sketch.get("kernelRoofSkippedNoReference", 0),
    }
    skip_counts = {k: int(v) for k, v in sorted(raw_skips.items()) if int(v) > 0}

    auth_subset: dict[str, Any] = sketch.get("authoritativeSubset") or {}
    authoritative_products = {k: bool(v) for k, v in sorted(auth_subset.items())}

    unsupported: dict[str, Any] = sketch.get("unsupportedIfcProducts") or {
        "schemaVersion": 0,
        "countsByClass": {},
    }

    # ID collision classes: command kinds whose replay IDs collide within the sketch itself
    # (duplicate Pset_*Common.Reference values extracted from the same STEP file).
    _id_seen: dict[str, dict[str, int]] = {}
    for cmd in commands:
        t = str(cmd.get("type") or "")
        cmd_id = str(cmd.get("id") or "")
        if t and cmd_id:
            if t not in _id_seen:
                _id_seen[t] = {}
            _id_seen[t][cmd_id] = _id_seen[t].get(cmd_id, 0) + 1
    id_collision_classes: dict[str, int] = {
        kind: sum(1 for c in id_counts.values() if c > 1)
        for kind, id_counts in sorted(_id_seen.items())
        if any(c > 1 for c in id_counts.values())
    }

    ids_map: dict[str, Any] = sketch.get("idsAuthoritativeReplayMap_v0") or {}
    spaces_rows: list[dict[str, Any]] = list(ids_map.get("spaces") or [])
    roofs_rows: list[dict[str, Any]] = list(ids_map.get("roofs") or [])
    floors_rows: list[dict[str, Any]] = list(ids_map.get("floors") or [])

    ids_pointer_coverage: dict[str, Any] = {
        "schemaVersion": 0,
        "available": True,
        "spaces": {
            "rows": len(spaces_rows),
            "withQtoSpaceBaseQuantitiesLinked": sum(
                1 for r in spaces_rows if r.get("qtoSpaceBaseQuantitiesLinked")
            ),
        },
        "roofs": {
            "rows": len(roofs_rows),
            "withIdentityReference": sum(1 for r in roofs_rows if r.get("identityReference")),
        },
        "floors": {
            "rows": len(floors_rows),
            "withQtoSlabBaseQuantitiesLinked": sum(
                1 for r in floors_rows if r.get("qtoSlabBaseQuantitiesLinked")
            ),
        },
    }

    not_apply_reasons: list[str] = []
    unsupported_counts: dict[str, int] = unsupported.get("countsByClass") or {}
    if any(v > 0 for v in unsupported_counts.values()):
        not_apply_reasons.append("unsupported_ifc_products_present")
    if extraction_gaps:
        not_apply_reasons.append("extraction_gaps_present")
    if skip_counts:
        not_apply_reasons.append("products_skipped_missing_reference")
    if id_collision_classes:
        not_apply_reasons.append("replay_id_collisions_detected")

    authoritative_safe = bool(cmd_counts) and not bool(id_collision_classes)

    if id_collision_classes:
        collision_kinds = ", ".join(f"{k}:{v}" for k, v in sorted(id_collision_classes.items()))
        apply_note = (
            f"authoritativeSliceSafeApply=False: duplicate command IDs detected within the replay sketch "
            f"({collision_kinds}). Resolve duplicate Pset_*Common.Reference values in the source STEP "
            f"file before applying."
        )
    elif authoritative_safe:
        apply_note = (
            "authoritativeSliceSafeApply=True: command list may be applied to an additive-compatible "
            "document via try_apply_kernel_ifc_authoritative_replay_v0 (preflight validates ID "
            "collisions and unresolved references at apply time). notApplyReasons describe boundary "
            "conditions for the full IFC graph, not the authoritative command subset."
        )
    else:
        apply_note = "No authoritative replay commands were extractable from this STEP input."

    return {
        "schemaVersion": 0,
        "available": True,
        "commandCountsByKind": dict(sorted(cmd_counts.items())),
        "commandCountTotal": sum(cmd_counts.values()),
        "unresolvedReferences": extraction_gaps,
        "unresolvedReferenceCount": len(extraction_gaps),
        "idCollisionClasses": id_collision_classes,
        "skipCountsByReason": skip_counts,
        "authoritativeProducts": authoritative_products,
        "unsupportedProducts": unsupported,
        "idsPointerCoverage": ids_pointer_coverage,
        "safeApplyClassification": {
            "authoritativeSliceSafeApply": authoritative_safe,
            "notApplyReasons": not_apply_reasons,
            "note": apply_note,
        },
    }


def build_ifc_unsupported_merge_map_v0(step_text: str) -> dict[str, Any]:
    """Deterministic unsupported IFC merge map: products outside the kernel slice, extraction
    gap reasons, and architectural merge constraints.  Stable across repeated runs.
    """

    from bim_ai.ifc_stub import IFC_SEMANTIC_IMPORT_SCOPE_V0  # noqa: PLC0415

    merge_constraints: list[str] = list(
        IFC_SEMANTIC_IMPORT_SCOPE_V0.get("importMergeUnsupported") or []
    )

    if not IFC_AVAILABLE:
        return {
            "schemaVersion": 0,
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "unsupportedIfcProductsByClass": {},
            "extractionGapsByReason": {},
            "extractionGapTotal": 0,
            "mergeConstraints": merge_constraints,
        }

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step_text)

    unsupported_products: dict[str, Any] = sketch.get("unsupportedIfcProducts") or {
        "schemaVersion": 0,
        "countsByClass": {},
    }
    extraction_gaps: list[dict[str, Any]] = [
        g for g in (sketch.get("extractionGaps") or []) if isinstance(g, dict)
    ]

    gap_by_reason: dict[str, int] = {}
    for g in extraction_gaps:
        reason = str(g.get("reason") or "unknown")
        gap_by_reason[reason] = gap_by_reason.get(reason, 0) + 1

    return {
        "schemaVersion": 0,
        "available": bool(sketch.get("available")),
        "unsupportedIfcProductsByClass": dict(
            sorted((unsupported_products.get("countsByClass") or {}).items())
        ),
        "extractionGapsByReason": dict(sorted(gap_by_reason.items())),
        "extractionGapTotal": len(extraction_gaps),
        "mergeConstraints": merge_constraints,
        "note": (
            "unsupportedIfcProductsByClass: IFC product classes outside the kernel replay slice; "
            "extractionGapsByReason: reasons the kernel failed to extract a command from a supported product; "
            "mergeConstraints: permanent architectural decisions preventing arbitrary IFC merge."
        ),
    }
