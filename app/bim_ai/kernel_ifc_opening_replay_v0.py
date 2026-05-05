"""Wall-hosted opening replay for kernel IFC authoritative replay (IfcDoor / IfcWindow → commands)."""

from __future__ import annotations

from typing import Any

import numpy as np


def _ifc_inverse_seq(val: Any) -> list[Any]:
    """IfcOpenShell inverses may be ``[]``, ``()``, one entity, or None — do not use ``or []``."""
    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        return [x for x in val if x is not None]
    return [val]


def _clamp_mm(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))


def _spine_world_matrix_len_m(
    start_x_mm: float,
    start_y_mm: float,
    end_x_mm: float,
    end_y_mm: float,
    elevation_mm: float,
) -> tuple[np.ndarray, float]:
    """Same basis as ``export_ifc.wall_local_to_world_m`` (world XY in metres)."""

    p1_ = np.array([start_x_mm / 1000.0, start_y_mm / 1000.0], dtype=float)
    p2_ = np.array([end_x_mm / 1000.0, end_y_mm / 1000.0], dtype=float)
    dv = p2_ - p1_
    ln = float(np.linalg.norm(dv))
    length_m = ln if ln >= 1e-9 else 1e-6
    vx, vy = (dv / ln).tolist() if ln >= 1e-9 else (1.0, 0.0)
    elevation_m = elevation_mm / 1000.0
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


def _qto_width_height_m(ifc_elem_util: Any, filler: Any, qto_name: str) -> tuple[float | None, float | None]:
    ps = ifc_elem_util.get_psets(filler)
    q = ps.get(qto_name) or {}

    def _as_m(key: str) -> float | None:
        v = q.get(key)
        if isinstance(v, (int, float)):
            return float(v)
        return None

    return _as_m("Width"), _as_m("Height")


def _opening_width_height_mm_fallback(ifc_placement: Any, opening: Any) -> tuple[float | None, float | None]:
    from bim_ai.export_ifc import _first_body_extruded_area_solid, _profile_xy_polyline_mm

    ex = _first_body_extruded_area_solid(opening)
    if ex is None:
        return None, None
    try:
        depth = float(ex.Depth)
    except Exception:
        return None, None
    swept = getattr(ex, "SweptArea", None)
    if swept is None or not swept.is_a("IfcArbitraryClosedProfileDef"):
        return None, None
    outer = getattr(swept, "OuterCurve", None)
    if outer is None:
        return None, None
    poly = _profile_xy_polyline_mm(outer)
    if not poly or len(poly) < 2:
        return None, None
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    span_x = float(max(xs) - min(xs))
    span_y = float(max(ys) - min(ys))
    depth_mm = float(abs(depth) * 1000.0)
    if span_x < 1.0 and span_y < 1.0:
        return None, None
    width_mm = max(span_x, span_y)
    thin = min(span_x, span_y)
    height_mm = thin if thin >= 200.0 else (depth_mm if depth_mm >= 100.0 else None)
    return width_mm, height_mm


def build_wall_hosted_opening_replay_commands_v0(
    model: Any,
    *,
    wall_global_id_to_kernel_ref: dict[str, str],
    storey_gid_to_elev_mm: dict[str, float],
    extraction_gaps: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int, int]:
    """Extract ``insertDoorOnWall`` / ``insertWindowOnWall`` from kernel IFC void/fill topology."""

    from bim_ai.commands import InsertDoorOnWallCmd, InsertWindowOnWallCmd
    from bim_ai.export_ifc import (
        IFC_AVAILABLE,
        _clamp,
        _kernel_wall_plan_geometry_mm,
        _product_host_storey_global_id,
        ifc_elem_util,
        ifc_placement,
    )

    if not IFC_AVAILABLE or ifc_elem_util is None or ifc_placement is None:
        return [], [], 0, 0

    doors_skipped_ref = 0
    windows_skipped_ref = 0

    def _append_gap(row: dict[str, Any]) -> None:
        extraction_gaps.append(row)

    def _process(kind: str, filler: Any) -> dict[str, Any] | None:
        nonlocal doors_skipped_ref, windows_skipped_ref
        pset_name = "Pset_DoorCommon" if kind == "door" else "Pset_WindowCommon"
        ps = ifc_elem_util.get_psets(filler)
        bucket = ps.get(pset_name) or {}
        ref = bucket.get("Reference")
        ref_s = ref.strip() if isinstance(ref, str) else ""
        fg = str(getattr(filler, "GlobalId", None) or "")

        if not ref_s:
            if kind == "door":
                doors_skipped_ref += 1
            else:
                windows_skipped_ref += 1
            _append_gap({"fillingGlobalId": fg, "kind": kind, "reason": "missing_pset_reference"})
            return None

        opening = None
        for rel in _ifc_inverse_seq(getattr(filler, "FillsVoids", None)):
            try:
                if rel.is_a("IfcRelFillsElement"):
                    opening = rel.RelatingOpeningElement
                    break
            except Exception:
                continue
        if opening is None:
            _append_gap(
                {"fillingGlobalId": fg, "kernelReference": ref_s, "kind": kind, "reason": "missing_fills_void_rel"}
            )
            return None

        wall_host = None
        for rel in _ifc_inverse_seq(getattr(opening, "VoidsElements", None)):
            try:
                if not rel.is_a("IfcRelVoidsElement"):
                    continue
                host = getattr(rel, "RelatingBuildingElement", None) or getattr(rel, "RelatedBuildingElement", None)
                if host is not None and host.is_a("IfcWall"):
                    wall_host = host
                    break
            except Exception:
                continue
        if wall_host is None:
            _append_gap(
                {
                    "openingGlobalId": str(getattr(opening, "GlobalId", None) or ""),
                    "kernelReference": ref_s,
                    "kind": kind,
                    "reason": "missing_void_host_wall",
                }
            )
            return None

        wgid = str(getattr(wall_host, "GlobalId", None) or "")
        wall_ref = wall_global_id_to_kernel_ref.get(wgid)
        if not wall_ref:
            _append_gap(
                {
                    "wallGlobalId": wgid,
                    "kernelReference": ref_s,
                    "kind": kind,
                    "reason": "wall_reference_not_in_kernel_subset",
                }
            )
            return None

        geo = _kernel_wall_plan_geometry_mm(wall_host)
        if geo is None:
            _append_gap(
                {
                    "wallGlobalId": wgid,
                    "kernelReference": ref_s,
                    "kind": kind,
                    "reason": "wall_body_extrusion_unreadable",
                }
            )
            return None

        st_gid = _product_host_storey_global_id(wall_host) or ""
        elev_mm = float(storey_gid_to_elev_mm.get(st_gid, 0.0))
        wmat, len_m = _spine_world_matrix_len_m(
            geo["start_x_mm"],
            geo["start_y_mm"],
            geo["end_x_mm"],
            geo["end_y_mm"],
            elev_mm,
        )
        if len_m < 1e-9:
            _append_gap({"wallGlobalId": wgid, "kernelReference": ref_s, "kind": kind, "reason": "wall_length_degenerate"})
            return None

        try:
            M_open = ifc_placement.get_local_placement(opening.ObjectPlacement)
        except Exception:
            _append_gap(
                {"openingGlobalId": str(getattr(opening, "GlobalId", None) or ""), "kind": kind, "reason": "opening_placement_unreadable"}
            )
            return None

        ox, oy, oz = float(M_open[0, 3]), float(M_open[1, 3]), float(M_open[2, 3])
        # Kernel IFC export registers length as millimetres (`IfcSIUnit(.MILLI.,.METRE.)`);
        # ``wall_local_to_world_m`` / spine matrix use metres — convert placement translation.
        ox, oy, oz = ox / 1000.0, oy / 1000.0, oz / 1000.0
        p_world = np.array([ox, oy, oz, 1.0], dtype=float)
        inv_w = np.linalg.inv(wmat)
        local = inv_w @ p_world
        lx = float(local[0])
        lz = float(local[2])

        qto_name = "Qto_DoorBaseQuantities" if kind == "door" else "Qto_WindowBaseQuantities"
        w_m, h_m = _qto_width_height_m(ifc_elem_util, filler, qto_name)
        w_mm = float(w_m * 1000.0) if w_m is not None else None
        h_mm = float(h_m * 1000.0) if h_m is not None else None

        if w_mm is None or w_mm < 1.0:
            fw, fh = _opening_width_height_mm_fallback(ifc_placement, opening)
            if w_mm is None and fw is not None:
                w_mm = float(fw)
            if kind == "window" and h_mm is None and fh is not None:
                h_mm = float(fh)
        if w_mm is None:
            w_mm = 900.0 if kind == "door" else 1200.0
        width_m = _clamp(w_mm / 1000.0, 0.2, len_m * 0.95)

        ll = len_m
        hw = width_m / (2.0 * ll)
        half_t = float(_clamp(hw, 1e-4, 0.49))
        usable_t0 = half_t
        usable_t1 = 1.0 - half_t
        if usable_t1 <= usable_t0:
            _append_gap({"fillingGlobalId": fg, "kind": kind, "reason": "opening_t_extent_degenerate"})
            return None

        t_left = lx / len_m
        along_raw = t_left + half_t
        along_t = float(_clamp_mm(along_raw, usable_t0, usable_t1))

        wall_h_mm = float(geo["height_mm"])
        wall_h_m = _clamp(wall_h_mm / 1000.0, 0.25, 40.0)

        nm = str(getattr(filler, "Name", None) or "").strip() or ("Door" if kind == "door" else "Window")

        if kind == "door":
            return InsertDoorOnWallCmd(
                id=ref_s,
                name=nm,
                wall_id=wall_ref,
                along_t=along_t,
                width_mm=float(w_mm),
            ).model_dump(mode="json", by_alias=True)

        sill_mm = lz * 1000.0
        sill_mm = float(_clamp(sill_mm, 0.0, max(0.0, wall_h_mm - 100.0)))
        if h_mm is None:
            w_top_m = elev_mm / 1000.0 + wall_h_m
            sill_z_m = _clamp(sill_mm / 1000.0, 0.06, max(0.2, w_top_m - 1.6))
            h_mm = float(
                _clamp(
                    (w_top_m - sill_z_m - 0.08) * 1000.0,
                    150.0,
                    max(200.0, wall_h_mm - sill_mm - 80.0),
                )
            )
        h_mm = float(_clamp(h_mm, 150.0, max(200.0, wall_h_mm - sill_mm - 50.0)))

        return InsertWindowOnWallCmd(
            id=ref_s,
            name=nm,
            wall_id=wall_ref,
            along_t=along_t,
            width_mm=float(w_mm),
            sill_height_mm=sill_mm,
            height_mm=h_mm,
        ).model_dump(mode="json", by_alias=True)

    door_cmds: list[dict[str, Any]] = []
    for dr in sorted(model.by_type("IfcDoor") or [], key=lambda d: str(getattr(d, "GlobalId", None) or "")):
        cmd = _process("door", dr)
        if cmd is not None:
            door_cmds.append(cmd)

    win_cmds: list[dict[str, Any]] = []
    for win in sorted(model.by_type("IfcWindow") or [], key=lambda w: str(getattr(w, "GlobalId", None) or "")):
        cmd = _process("window", win)
        if cmd is not None:
            win_cmds.append(cmd)

    return door_cmds, win_cmds, doors_skipped_ref, windows_skipped_ref
