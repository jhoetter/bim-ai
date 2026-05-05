"""Orthographic section/elevation primitives in (u, z) for `sectionProjectionWire_v1` (WP-E04/C02).

`u` measures millimetres along the cut line from ``lineStart``.
`z` is absolute model elevation in millimetres (level ``elevationMm`` + vertical offsets).
Crop is a symmetric perpendicular band of half-width ``cropDepthMm / 2`` about the cut segment.
"""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    CalloutElem,
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    SectionCutElem,
    SheetElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.material_assembly_resolve import (
    layered_assembly_witness_row_for_floor,
    layered_assembly_witness_row_for_roof,
    layered_assembly_witness_row_for_wall,
    resolved_layers_for_wall,
    section_assembly_alignment_fields_floor,
    section_assembly_alignment_fields_wall,
)
from bim_ai.opening_cut_primitives import (
    floor_panels_axis_aligned_rect_with_single_hole_mm,
    hosted_opening_half_span_mm,
    hosted_opening_t_span_normalized,
    hosted_opening_u_projection_scale,
    wall_plan_axis_aligned_xy,
)
from bim_ai.roof_geometry import (
    gable_ridge_rise_mm,
    mass_box_roof_proxy_peak_z_mm,
    outer_rect_extent,
)
from bim_ai.stair_plan_proxy import stair_riser_count_plan_proxy
from bim_ai.type_material_registry import material_display_label

_EPS = 1e-6

_DEFAULT_DOOR_HEIGHT_MM = 2100.0

_FLOOR_SLAB_PANEL_GAP_MM = 40.0


def _hypot(dx: float, dy: float) -> float:
    return float(math.hypot(dx, dy))


def _level_elevation_mm(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    if isinstance(el, LevelElem):
        return float(el.elevation_mm)
    return 0.0


def _section_doc_material_label_for_wall(doc: Document, wall: WallElem) -> str:
    layers = resolved_layers_for_wall(doc, wall)
    material_key = ""
    for lyr in layers:
        if str(lyr.get("function") or "") == "structure":
            material_key = str(lyr.get("materialKey") or "").strip()
            break
    if not material_key and layers:
        material_key = str(layers[0].get("materialKey") or "").strip()
    label = material_display_label(doc, material_key or None)
    if label:
        return label
    if material_key:
        return material_key
    return "structure"


def _build_section_doc_material_hints(
    doc: Document,
    walls: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    for row in walls:
        eid = str(row.get("elementId") or "")
        wall_el = doc.elements.get(eid)
        if not isinstance(wall_el, WallElem):
            continue
        u0 = float(row["uStartMm"])
        u1 = float(row["uEndMm"])
        z0 = float(row["zBottomMm"])
        z1 = float(row["zTopMm"])
        hatch = row.get("cutHatchKind")
        cut_pattern = hatch if hatch in ("edgeOn", "alongCut") else "alongCut"
        hints.append(
            {
                "tokenId": str(row["id"]),
                "wallElementId": eid,
                "materialLabel": _section_doc_material_label_for_wall(doc, wall_el),
                "cutPatternHint": cut_pattern,
                "uAnchorMm": round(0.5 * (u0 + u1), 3),
                "zAnchorMm": round(0.5 * (z0 + z1), 3),
            }
        )
    hints.sort(key=lambda h: str(h["tokenId"]))
    return hints


def _wall_vertical_span_mm(doc: Document, w: WallElem) -> tuple[float, float]:
    z0 = _level_elevation_mm(doc, w.level_id) + float(w.base_constraint_offset_mm)
    z1 = z0 + float(w.height_mm)
    tl = getattr(w, "top_constraint_level_id", None)
    if tl and isinstance(doc.elements.get(str(tl)), LevelElem):
        z1 = _level_elevation_mm(doc, str(tl)) + float(w.top_constraint_offset_mm)
    if z1 < z0:
        z0, z1 = z1, z0
    return z0, z1


def _cut_frame(
    sec: SectionCutElem,
) -> tuple[float, float, float, float, float, float, float, float, float] | None:
    """Return p0x,p0y,p1x,p1y, tx,ty,nx,ny,segment_len_mm or None if degenerate."""
    p0x = float(sec.line_start_mm.x_mm)
    p0y = float(sec.line_start_mm.y_mm)
    p1x = float(sec.line_end_mm.x_mm)
    p1y = float(sec.line_end_mm.y_mm)
    dx, dy = p1x - p0x, p1y - p0y
    seg_len = _hypot(dx, dy)
    if seg_len < _EPS:
        return None
    tx, ty = dx / seg_len, dy / seg_len
    nx, ny = -ty, tx  # left normal
    return p0x, p0y, p1x, p1y, tx, ty, nx, ny, seg_len


def _perp_mm(
    x: float,
    y: float,
    *,
    p0x: float,
    p0y: float,
    nx: float,
    ny: float,
) -> float:
    return (x - p0x) * nx + (y - p0y) * ny


def _u_mm(
    x: float,
    y: float,
    *,
    p0x: float,
    p0y: float,
    tx: float,
    ty: float,
) -> float:
    return (x - p0x) * tx + (y - p0y) * ty


def _clip_segment_lambda_in_perp_strip(fa: float, fb: float, half: float) -> tuple[float, float] | None:
    """Parameter λ in [0,1] along segment A+λ(B-A) where |f|<=half, f(λ)=fa+λ(fb-fa)."""
    d = fb - fa
    if abs(d) < _EPS:
        if abs(fa) <= half + _EPS:
            return 0.0, 1.0
        return None

    lam_hi_b = (half - fa) / d
    lam_lo_b = (-half - fa) / d
    lam_lo = max(0.0, min(lam_hi_b, lam_lo_b))
    lam_hi = min(1.0, max(lam_hi_b, lam_lo_b))
    if lam_hi < lam_lo - _EPS:
        return None
    return lam_lo, lam_hi


def _clip_wall_segment_xy(
    ax: float,
    ay: float,
    bx: float,
    by: float,
    *,
    p0x: float,
    p0y: float,
    nx: float,
    ny: float,
    half: float,
) -> tuple[float, float, float, float] | None:
    fa = _perp_mm(ax, ay, p0x=p0x, p0y=p0y, nx=nx, ny=ny)
    fb = _perp_mm(bx, by, p0x=p0x, p0y=p0y, nx=nx, ny=ny)
    span = _clip_segment_lambda_in_perp_strip(fa, fb, half)
    if span is None:
        return None
    lo, hi = span
    c0x = ax + lo * (bx - ax)
    c0y = ay + lo * (by - ay)
    c1x = ax + hi * (bx - ax)
    c1y = ay + hi * (by - ay)
    return c0x, c0y, c1x, c1y


def _hosted_xy_mm_on_wall(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx, sy = float(wall.start.x_mm), float(wall.start.y_mm)
    dx = float(wall.end.x_mm) - sx
    dy = float(wall.end.y_mm) - sy
    length_mm = max(_EPS, _hypot(dx, dy))
    ux, uy = dx / length_mm, dy / length_mm
    return sx + ux * float(opening.along_t) * length_mm, sy + uy * float(opening.along_t) * length_mm


def _polygon_u_span_in_strip(
    poly: list[tuple[float, float]],
    *,
    p0x: float,
    p0y: float,
    tx: float,
    ty: float,
    nx: float,
    ny: float,
    half: float,
) -> tuple[float, float] | None:
    """Horizontal extent along cut tangent for geometry lying in the crop strip."""
    us: list[float] = []

    def add_point(px: float, py: float) -> None:
        if abs(_perp_mm(px, py, p0x=p0x, p0y=p0y, nx=nx, ny=ny)) <= half + _EPS:
            us.append(_u_mm(px, py, p0x=p0x, p0y=p0y, tx=tx, ty=ty))

    n = len(poly)
    if n < 2:
        return None

    for px, py in poly:
        add_point(px, py)

    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        clip = _clip_wall_segment_xy(ax, ay, bx, by, p0x=p0x, p0y=p0y, nx=nx, ny=ny, half=half)
        if clip is None:
            continue
        c0x, c0y, c1x, c1y = clip
        us.append(_u_mm(c0x, c0y, p0x=p0x, p0y=p0y, tx=tx, ty=ty))
        us.append(_u_mm(c1x, c1y, p0x=p0x, p0y=p0y, tx=tx, ty=ty))

    if not us:
        return None
    return min(us), max(us)

def _append_floor_u_span_primitive(
    floors: list[dict[str, Any]],
    *,
    floor_el: FloorElem,
    doc: Document,
    poly: list[tuple[float, float]],
    p0x: float,
    p0y: float,
    tx: float,
    ty: float,
    nx: float,
    ny: float,
    half: float,
    pane_index: int | None,
) -> None:
    span = _polygon_u_span_in_strip(poly, p0x=p0x, p0y=p0y, tx=tx, ty=ty, nx=nx, ny=ny, half=half)
    if span is None:
        return
    u_lo, u_hi = span
    z0 = _level_elevation_mm(doc, floor_el.level_id)
    z_t = z0 + float(floor_el.thickness_mm)
    pane_suffix = "0" if pane_index is None else f"pane-{pane_index + 1}"
    row: dict[str, Any] = {
        "id": f"floor:{floor_el.id}:{pane_suffix}",
        "elementId": floor_el.id,
        "levelId": floor_el.level_id,
        "uStartMm": round(u_lo, 3),
        "uEndMm": round(u_hi, 3),
        "zBottomMm": round(z0, 3),
        "zTopMm": round(z_t, 3),
    }
    asm_floor = section_assembly_alignment_fields_floor(doc, floor_el)
    if asm_floor:
        row.update(asm_floor)
    row["layerAssemblyWitness_v0"] = layered_assembly_witness_row_for_floor(doc, floor_el)
    floors.append(row)



def _roof_proxy_top_z_mm(doc: Document, r: RoofElem) -> float:
    base = _level_elevation_mm(doc, r.reference_level_id)
    return mass_box_roof_proxy_peak_z_mm(base, r.slope_deg)


def _collect_level_markers(doc: Document) -> list[dict[str, Any]]:
    """Sorted level datums for section annotation (WP-E04); optional on ``sectionProjectionPrimitives_v1``."""
    rows: list[tuple[float, dict[str, Any]]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, LevelElem):
            continue
        z = float(e.elevation_mm)
        rows.append(
            (
                z,
                {
                    "id": e.id,
                    "name": str(e.name or e.id),
                    "elevationMm": round(z, 3),
                },
            )
        )
    rows.sort(key=lambda t: (t[0], t[1]["id"]))
    return [r[1] for r in rows]


def _collect_sheet_callouts_for_section(doc: Document, section_cut_id: str) -> list[dict[str, str]]:
    """Callouts on sheets that reference this section in any viewport (sorted by element id)."""

    sheet_ids: set[str] = set()
    for e in doc.elements.values():
        if not isinstance(e, SheetElem):
            continue
        for vp in e.viewports_mm or []:
            if not isinstance(vp, dict):
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            if not isinstance(vr, str) or ":" not in vr:
                continue
            kind_raw, ref_raw = vr.split(":", 1)
            if kind_raw.strip().lower() not in {"section", "sec"}:
                continue
            if ref_raw.strip() == section_cut_id:
                sheet_ids.add(e.id)
                break

    out: list[dict[str, str]] = []
    for eid in sorted(doc.elements.keys()):
        ce = doc.elements[eid]
        if not isinstance(ce, CalloutElem):
            continue
        if ce.parent_sheet_id not in sheet_ids:
            continue
        out.append({"id": ce.id, "name": str(ce.name or ce.id)})
    return out


def _section_geometry_extent_mm(
    walls: list[dict[str, Any]],
    floors: list[dict[str, Any]],
    rooms: list[dict[str, Any]],
    stairs: list[dict[str, Any]],
    roofs: list[dict[str, Any]],
    doors: list[dict[str, Any]],
    windows: list[dict[str, Any]],
) -> dict[str, float] | None:
    """Tight axis-aligned (u, z) bounds over section solid contributors (WP-E04 / prompt-5 Δu witness)."""

    u_min = math.inf
    u_max = -math.inf
    z_min = math.inf
    z_max = -math.inf
    touched = False

    def acc(ulo: float, uhi: float, zlo: float, zhi: float) -> None:
        nonlocal u_min, u_max, z_min, z_max, touched
        if uhi < ulo:
            ulo, uhi = uhi, ulo
        if zhi < zlo:
            zlo, zhi = zhi, zlo
        if (uhi - ulo) < _EPS and (zhi - zlo) < _EPS:
            return
        u_min = min(u_min, ulo)
        u_max = max(u_max, uhi)
        z_min = min(z_min, zlo)
        z_max = max(z_max, zhi)
        touched = True

    for w in walls:
        acc(
            float(w["uStartMm"]),
            float(w["uEndMm"]),
            float(w["zBottomMm"]),
            float(w["zTopMm"]),
        )
    for w in floors:
        acc(
            float(w["uStartMm"]),
            float(w["uEndMm"]),
            float(w["zBottomMm"]),
            float(w["zTopMm"]),
        )
    for w in rooms:
        acc(
            float(w["uStartMm"]),
            float(w["uEndMm"]),
            float(w["zBottomMm"]),
            float(w["zTopMm"]),
        )
    for w in stairs:
        half_u = max(0.0, float(w.get("widthMm") or 0.0) * 0.5)
        s = float(w["uStartMm"])
        e = float(w["uEndMm"])
        ulo, uhi = (s, e) if s <= e else (e, s)
        acc(ulo - half_u, uhi + half_u, float(w["zBottomMm"]), float(w["zTopMm"]))
    for w in roofs:
        ulo = float(w["uStartMm"])
        uhi = float(w["uEndMm"])
        mode = str(w.get("roofGeometryMode") or "")
        if mode == "gable_pitched_rectangle":
            z_lo = float(w.get("eavePlateZMm") or w.get("zMidMm") or 0.0)
            z_hi = float(w.get("ridgeZMm") or w.get("zMidMm") or z_lo)
            acc(ulo, uhi, z_lo, z_hi)
        else:
            z_mid = float(w.get("zMidMm") or 0.0)
            acc(ulo, uhi, z_mid, z_mid)
    for w in doors:
        uc = float(w["uCenterMm"])
        half = abs(float(w.get("openingHalfWidthAlongUMm") or 0.0))
        acc(uc - half, uc + half, float(w["zBottomMm"]), float(w["zTopMm"]))
    for w in windows:
        uc = float(w["uCenterMm"])
        half = abs(float(w.get("openingHalfWidthAlongUMm") or 0.0))
        acc(uc - half, uc + half, float(w["zBottomMm"]), float(w["zTopMm"]))

    if not touched or not math.isfinite(u_min) or (u_max - u_min) < _EPS:
        return None
    return {
        "uMinMm": round(u_min, 3),
        "uMaxMm": round(u_max, 3),
        "zMinMm": round(z_min, 3),
        "zMaxMm": round(z_max, 3),
    }


def build_section_projection_primitives(
    doc: Document,
    sec: SectionCutElem,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    warnings: list[dict[str, Any]] = []

    frame = _cut_frame(sec)
    if frame is None:
        warnings.append(
            {
                "code": "degenerateCutLine",
                "message": "section cut lineStart and lineEnd coincide; no primitives emitted.",
            }
        )
        return (
            {
                "format": "sectionProjectionPrimitives_v1",
                "coordinateFrame": {
                    "kind": "sectionUv_v1",
                    "uAxis": "alongCutLineMmFromLineStart",
                    "vAxis": "elevationZm",
                    "cutLineStartMm": sec.line_start_mm.model_dump(by_alias=True),
                    "cutLineEndMm": sec.line_end_mm.model_dump(by_alias=True),
                    "cutTangentUnit": [0.0, 0.0],
                    "planNormalUnit": [0.0, 0.0],
                },
                "walls": [],
                "floors": [],
                "rooms": [],
                "doors": [],
                "windows": [],
                "stairs": [],
                "roofs": [],
                "levelMarkers": _collect_level_markers(doc),
                "sheetCallouts": _collect_sheet_callouts_for_section(doc, sec.id),
                "sectionDocMaterialHints": [],
            },
            warnings,
        )

    p0x, p0y, _p1x, _p1y, tx, ty, nx, ny, seg_len = frame
    half = max(0.0, float(sec.crop_depth_mm) * 0.5)

    if sec.segmented_path_mm:
        warnings.append(
            {
                "code": "segmentedPathNotEmitted",
                "message": (
                    "section_cut.segmentedPathMm is authored but this slice only uses lineStart/lineEnd."
                ),
            }
        )

    warnings.append(
        {
            "code": "symmetricCropBand",
            "message": (
                "cropDepthMm is interpreted as a full-width symmetric perpendicular band "
                "centered on the cut segment (half-width = cropDepthMm/2)."
            ),
        }
    )

    prim_frame = {
        "kind": "sectionUv_v1",
        "uAxis": "alongCutLineMmFromLineStart",
        "vAxis": "elevationZm",
        "cutLineStartMm": sec.line_start_mm.model_dump(by_alias=True),
        "cutLineEndMm": sec.line_end_mm.model_dump(by_alias=True),
        "cutTangentUnit": [round(tx, 6), round(ty, 6)],
        "planNormalUnit": [round(nx, 6), round(ny, 6)],
        "cropHalfWidthMm": round(half, 3),
    }

    walls: list[dict[str, Any]] = []
    wall_clip_by_id: dict[str, tuple[float, float]] = {}

    segment_idx = 0
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, WallElem):
            continue

        ax, ay = float(e.start.x_mm), float(e.start.y_mm)
        bx, by = float(e.end.x_mm), float(e.end.y_mm)
        clip = _clip_wall_segment_xy(ax, ay, bx, by, p0x=p0x, p0y=p0y, nx=nx, ny=ny, half=half)
        if clip is None:
            continue

        c0x, c0y, c1x, c1y = clip
        u0 = _u_mm(c0x, c0y, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
        u1 = _u_mm(c1x, c1y, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
        u_lo, u_hi = (u0, u1) if u0 <= u1 else (u1, u0)

        dxw = bx - ax
        dyw = by - ay
        w_len = max(_EPS, _hypot(dxw, dyw))
        wdx, wdy = dxw / w_len, dyw / w_len
        wnx, wny = -wdy, wdx
        u_half_thickness = 0.5 * float(e.thickness_mm) * abs(wnx * tx + wny * ty)
        du = u_hi - u_lo
        # Wall perpendicular to cut tangent projects to ~constant u — expand by in-plan thickness in u.
        cut_hatch_kind = (
            "edgeOn"
            if du < max(_EPS, u_half_thickness * 0.05 + 0.001)
            else "alongCut"
        )
        if cut_hatch_kind == "edgeOn":
            u_c = 0.5 * (u_lo + u_hi)
            half_du = max(u_half_thickness, 1.0)
            u_lo = u_c - half_du
            u_hi = u_c + half_du

        if u_hi - u_lo < _EPS:
            continue

        z0, z1 = _wall_vertical_span_mm(doc, e)
        stable_id = f"wall:{e.id}:{segment_idx}"
        segment_idx += 1

        wall_row: dict[str, Any] = {
            "id": stable_id,
            "elementId": e.id,
            "levelId": e.level_id,
            "uStartMm": round(u_lo, 3),
            "uEndMm": round(u_hi, 3),
            "zBottomMm": round(z0, 3),
            "zTopMm": round(z1, 3),
            "thicknessMm": round(float(e.thickness_mm), 3),
            "cutHatchKind": cut_hatch_kind,
        }
        asm_wall = section_assembly_alignment_fields_wall(doc, e)
        if asm_wall:
            wall_row.update(asm_wall)
        wall_row["layerAssemblyWitness_v0"] = layered_assembly_witness_row_for_wall(doc, e)
        walls.append(wall_row)
        wall_clip_by_id[e.id] = (u_lo, u_hi)

    doors: list[dict[str, Any]] = []
    windows: list[dict[str, Any]] = []
    oid = 0
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            span_u = wall_clip_by_id.get(w.id)
            if span_u is None:
                continue
            px_mm, py_mm = _hosted_xy_mm_on_wall(e, w)
            if abs(_perp_mm(px_mm, py_mm, p0x=p0x, p0y=p0y, nx=nx, ny=ny)) > half + _EPS:
                continue

            u_scale = max(_EPS, hosted_opening_u_projection_scale(w, tx, ty))
            half_du = hosted_opening_half_span_mm(e) * u_scale

            u_c = _u_mm(px_mm, py_mm, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
            u_lo_w, u_hi_w = span_u
            if u_c + half_du < u_lo_w - _EPS or u_c - half_du > u_hi_w + _EPS:
                continue

            z0 = _level_elevation_mm(doc, w.level_id) + float(w.base_constraint_offset_mm)
            z1 = z0 + _DEFAULT_DOOR_HEIGHT_MM
            door_row: dict[str, Any] = {
                "id": f"door:{e.id}:{oid}",
                "elementId": e.id,
                "wallId": w.id,
                "levelId": w.level_id,
                "uCenterMm": round(u_c, 3),
                "openingHalfWidthAlongUMm": round(half_du, 3),
                "zBottomMm": round(z0, 3),
                "zTopMm": round(z1, 3),
            }
            if e.reveal_interior_mm is not None and float(e.reveal_interior_mm) > 0.0:
                door_row["revealInteriorMm"] = round(float(e.reveal_interior_mm), 3)
            if not wall_plan_axis_aligned_xy(w):
                ts = hosted_opening_t_span_normalized(e, w)
                if ts:
                    door_row["openingTSpanNormalized"] = [round(float(ts[0]), 6), round(float(ts[1]), 6)]
                door_row["uProjectionScale"] = round(float(u_scale), 6)
            doors.append(door_row)
            oid += 1

        elif isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            span_u = wall_clip_by_id.get(w.id)
            if span_u is None:
                continue
            px_mm, py_mm = _hosted_xy_mm_on_wall(e, w)
            if abs(_perp_mm(px_mm, py_mm, p0x=p0x, p0y=p0y, nx=nx, ny=ny)) > half + _EPS:
                continue

            u_scale = max(_EPS, hosted_opening_u_projection_scale(w, tx, ty))
            half_du = hosted_opening_half_span_mm(e) * u_scale

            u_c = _u_mm(px_mm, py_mm, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
            u_lo_w, u_hi_w = span_u
            if u_c + half_du < u_lo_w - _EPS or u_c - half_du > u_hi_w + _EPS:
                continue

            z0 = _level_elevation_mm(doc, w.level_id) + float(w.base_constraint_offset_mm) + float(
                e.sill_height_mm
            )
            z1 = z0 + float(e.height_mm)
            win_row: dict[str, Any] = {
                "id": f"window:{e.id}:{oid}",
                "elementId": e.id,
                "wallId": w.id,
                "levelId": w.level_id,
                "uCenterMm": round(u_c, 3),
                "openingHalfWidthAlongUMm": round(half_du, 3),
                "zBottomMm": round(z0, 3),
                "zTopMm": round(z1, 3),
            }
            if e.reveal_interior_mm is not None and float(e.reveal_interior_mm) > 0.0:
                win_row["revealInteriorMm"] = round(float(e.reveal_interior_mm), 3)
            if not wall_plan_axis_aligned_xy(w):
                ts = hosted_opening_t_span_normalized(e, w)
                if ts:
                    win_row["openingTSpanNormalized"] = [round(float(ts[0]), 6), round(float(ts[1]), 6)]
                win_row["uProjectionScale"] = round(float(u_scale), 6)
            windows.append(win_row)
            oid += 1

    openings_by_floor: dict[str, list[SlabOpeningElem]] = {}
    for ev in doc.elements.values():
        if isinstance(ev, SlabOpeningElem):
            openings_by_floor.setdefault(ev.host_floor_id, []).append(ev)

    floors: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, FloorElem):
            continue
        floor_el = e
        floor_pts = [(float(p.x_mm), float(p.y_mm)) for p in floor_el.boundary_mm]

        openings_on_floor = openings_by_floor.get(e.id, [])
        panel_rects_mm: list[tuple[float, float, float, float]] | None = None
        if len(openings_on_floor) == 1:
            op_only = openings_on_floor[0]
            op_pts = [(float(p.x_mm), float(p.y_mm)) for p in op_only.boundary_mm]
            if len(floor_pts) >= 3 and len(op_pts) >= 3:
                panel_rects_mm = floor_panels_axis_aligned_rect_with_single_hole_mm(
                    floor_pts,
                    op_pts,
                    min_gap_mm=_FLOOR_SLAB_PANEL_GAP_MM,
                )

        if panel_rects_mm:
            for pi, (px0, px1, py0, py1) in enumerate(panel_rects_mm):
                panel_poly = [
                    (px0, py0),
                    (px1, py0),
                    (px1, py1),
                    (px0, py1),
                ]
                _append_floor_u_span_primitive(
                    floors,
                    floor_el=floor_el,
                    doc=doc,
                    poly=panel_poly,
                    p0x=p0x,
                    p0y=p0y,
                    tx=tx,
                    ty=ty,
                    nx=nx,
                    ny=ny,
                    half=half,
                    pane_index=pi,
                )
        else:
            _append_floor_u_span_primitive(
                floors,
                floor_el=floor_el,
                doc=doc,
                poly=floor_pts,
                p0x=p0x,
                p0y=p0y,
                tx=tx,
                ty=ty,
                nx=nx,
                ny=ny,
                half=half,
                pane_index=None,
            )

    rooms: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, RoomElem):
            continue
        poly = [(float(p.x_mm), float(p.y_mm)) for p in e.outline_mm]
        span = _polygon_u_span_in_strip(poly, p0x=p0x, p0y=p0y, tx=tx, ty=ty, nx=nx, ny=ny, half=half)
        if span is None:
            continue
        u_lo, u_hi = span
        z0 = _level_elevation_mm(doc, e.level_id)
        z1 = z0 + 2800.0
        if e.upper_limit_level_id and isinstance(doc.elements.get(e.upper_limit_level_id), LevelElem):
            z1 = _level_elevation_mm(doc, e.upper_limit_level_id)
        if z1 < z0:
            z0, z1 = z1, z0
        rooms.append(
            {
                "id": f"room:{e.id}:0",
                "elementId": e.id,
                "levelId": e.level_id,
                "uStartMm": round(u_lo, 3),
                "uEndMm": round(u_hi, 3),
                "zBottomMm": round(z0, 3),
                "zTopMm": round(z1, 3),
            }
        )

    stairs: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, StairElem):
            continue
        rx0, ry0 = float(e.run_start.x_mm), float(e.run_start.y_mm)
        rx1, ry1 = float(e.run_end.x_mm), float(e.run_end.y_mm)
        clip = _clip_wall_segment_xy(rx0, ry0, rx1, ry1, p0x=p0x, p0y=p0y, nx=nx, ny=ny, half=half)
        if clip is None:
            continue
        c0x, c0y, c1x, c1y = clip
        u0 = _u_mm(c0x, c0y, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
        u1 = _u_mm(c1x, c1y, p0x=p0x, p0y=p0y, tx=tx, ty=ty)
        u_lo, u_hi = (u0, u1) if u0 <= u1 else (u1, u0)
        zb = _level_elevation_mm(doc, e.base_level_id)
        zt = _level_elevation_mm(doc, e.top_level_id)
        if zt < zb:
            zb, zt = zt, zb
        run_len_mm = _hypot(rx1 - rx0, ry1 - ry0)
        rc_proxy = stair_riser_count_plan_proxy(doc, e, run_length_mm=run_len_mm)
        stair_row: dict[str, Any] = {
            "id": f"stair:{e.id}:0",
            "elementId": e.id,
            "uStartMm": round(u_lo, 3),
            "uEndMm": round(u_hi, 3),
            "zBottomMm": round(zb, 3),
            "zTopMm": round(zt, 3),
            "widthMm": round(float(e.width_mm), 3),
            "riserMm": round(float(e.riser_mm), 3),
            "treadMm": round(float(e.tread_mm), 3),
            "riserCountPlanProxy": rc_proxy,
            "proxyKind": "runRampExtents",
        }
        bl = doc.elements.get(e.base_level_id)
        tl_ev = doc.elements.get(e.top_level_id)
        if isinstance(bl, LevelElem) and isinstance(tl_ev, LevelElem):
            z_lo = float(min(bl.elevation_mm, tl_ev.elevation_mm))
            z_hi = float(max(bl.elevation_mm, tl_ev.elevation_mm))
            rise_story = z_hi - z_lo
            if rise_story > 1e-3:
                stair_row["storyRiseMm"] = round(rise_story, 3)
                stair_row["midRunElevationMm"] = round(z_lo + rise_story * 0.5, 3)
        stairs.append(stair_row)

    roofs: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, RoofElem):
            continue
        poly = [(float(p.x_mm), float(p.y_mm)) for p in e.footprint_mm]
        span = _polygon_u_span_in_strip(poly, p0x=p0x, p0y=p0y, tx=tx, ty=ty, nx=nx, ny=ny, half=half)
        if span is None:
            continue
        u_lo, u_hi = span
        mode = e.roof_geometry_mode
        if mode == "gable_pitched_rectangle":
            x0, x1, z0, z1 = outer_rect_extent(poly)
            span_x = float(x1 - x0)
            span_z = float(z1 - z0)
            slope = float(e.slope_deg or 25.0)
            rise_mm, ridge_axis = gable_ridge_rise_mm(span_x, span_z, slope)
            zb = _level_elevation_mm(doc, e.reference_level_id)
            ridge_z = zb + rise_mm
            roofs.append(
                {
                    "id": f"roof:{e.id}:0",
                    "elementId": e.id,
                    "referenceLevelId": e.reference_level_id,
                    "roofGeometryMode": mode,
                    "uStartMm": round(u_lo, 3),
                    "uEndMm": round(u_hi, 3),
                    "ridgeZMm": round(ridge_z, 3),
                    "eavePlateZMm": round(zb, 3),
                    "zMidMm": round(ridge_z, 3),
                    "proxyKind": "gablePitchedRectangleChord",
                    "ridgeAxisPlan": ridge_axis,
                    "slopeDeg": round(slope, 3),
                    "overhangMm": round(float(e.overhang_mm), 3),
                    "planSpanXmMm": round(span_x, 3),
                    "planSpanZmMm": round(span_z, 3),
                    "ridgeRiseMm": round(rise_mm, 3),
                    "layerAssemblyWitness_v0": layered_assembly_witness_row_for_roof(doc, e),
                }
            )
        else:
            z_mid = _roof_proxy_top_z_mm(doc, e)
            roofs.append(
                {
                    "id": f"roof:{e.id}:0",
                    "elementId": e.id,
                    "referenceLevelId": e.reference_level_id,
                    "roofGeometryMode": "mass_box",
                    "uStartMm": round(u_lo, 3),
                    "uEndMm": round(u_hi, 3),
                    "zMidMm": round(z_mid, 3),
                    "slopeDeg": round(float(e.slope_deg or 25.0), 3),
                    "overhangMm": round(float(e.overhang_mm), 3),
                    "proxyKind": "footprintChord",
                    "layerAssemblyWitness_v0": layered_assembly_witness_row_for_roof(doc, e),
                }
            )

    primitives: dict[str, Any] = {
        "format": "sectionProjectionPrimitives_v1",
        "coordinateFrame": prim_frame,
        "cutSegmentLengthMm": round(seg_len, 3),
        "levelMarkers": _collect_level_markers(doc),
        "sheetCallouts": _collect_sheet_callouts_for_section(doc, sec.id),
        "walls": walls,
        "floors": floors,
        "rooms": rooms,
        "doors": doors,
        "windows": windows,
        "stairs": stairs,
        "roofs": roofs,
    }

    extent = _section_geometry_extent_mm(walls, floors, rooms, stairs, roofs, doors, windows)
    if extent is not None:
        primitives["sectionGeometryExtentMm"] = extent

    primitives["sectionDocMaterialHints"] = _build_section_doc_material_hints(doc, walls)

    return primitives, warnings
