"""Portable plan display resolution + element counts (WP-C01/C02/C03 server slice)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DimensionElem,
    DoorElem,
    FloorElem,
    GridLineElem,
    PlanViewElem,
    RoofElem,
    RoomElem,
    SectionCutElem,
    StairElem,
    ViewTemplateElem,
    WallElem,
    WindowElem,
)
from bim_ai.opening_cut_primitives import hosted_opening_t_span_normalized


def _canon_hidden_category(label: str) -> str | None:
    raw = label.strip().lower()
    table = {
        "walls": "wall",
        "wall": "wall",
        "floors": "floor",
        "slabs": "floor",
        "slab": "floor",
        "floor": "floor",
        "roofs": "roof",
        "roof": "roof",
        "rooms": "room",
        "room": "room",
        "doors": "door",
        "door": "door",
        "windows": "window",
        "window": "window",
        "stairs": "stair",
        "stair": "stair",
        "grids": "grid_line",
        "grid": "grid_line",
        "gridlines": "grid_line",
        "grid_line": "grid_line",
        "grid-lines": "grid_line",
        "dimensions": "dimension",
        "dimension": "dimension",
    }
    return table.get(raw)


def _hosted_xy_mm_on_wall(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx, sy = wall.start.x_mm, wall.start.y_mm
    dx = wall.end.x_mm - sx
    dy = wall.end.y_mm - sy
    length_mm = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    ux, uy = dx / length_mm, dy / length_mm
    return sx + ux * opening.along_t * length_mm, sy + uy * opening.along_t * length_mm


def _build_plan_primitive_lists(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    pinned_pv_el: PlanViewElem | None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """2D primitives for deterministic server-side plan previews (bounding extent; clipping deferred)."""

    warnings: list[dict[str, Any]] = []

    if pinned_pv_el is not None:
        if pinned_pv_el.crop_min_mm is not None or pinned_pv_el.crop_max_mm is not None:
            warnings.append(
                {
                    "code": "cropBoxNotApplied",
                    "message": "Plan viewport cropMm is authored but primitives are emitted in full extents in this slice.",
                }
            )
        if pinned_pv_el.view_range_bottom_mm is not None or pinned_pv_el.view_range_top_mm is not None:
            warnings.append(
                {
                    "code": "viewRangeNotApplied",
                    "message": "View range overrides are authored but vertical cut extents are not applied to primitives.",
                }
            )

    walls: list[dict[str, Any]] = []
    floors: list[dict[str, Any]] = []
    rooms: list[dict[str, Any]] = []
    doors: list[dict[str, Any]] = []
    windows: list[dict[str, Any]] = []
    stairs: list[dict[str, Any]] = []
    roofs: list[dict[str, Any]] = []
    grid_lines: list[dict[str, Any]] = []
    dimensions: list[dict[str, Any]] = []

    def lvl_ok(lv: str | None) -> bool:
        if not level:
            return True
        return lv == level if lv else False

    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]

        if isinstance(e, WallElem):
            if "wall" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            walls.append(
                {
                    "id": e.id,
                    "levelId": e.level_id,
                    "startMm": {"x": round(e.start.x_mm, 3), "y": round(e.start.y_mm, 3)},
                    "endMm": {"x": round(e.end.x_mm, 3), "y": round(e.end.y_mm, 3)},
                    "thicknessMm": round(e.thickness_mm, 3),
                    "heightMm": round(e.height_mm, 3),
                }
            )
        elif isinstance(e, FloorElem):
            if "floor" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            outlines = [[round(p.x_mm, 3), round(p.y_mm, 3)] for p in e.boundary_mm]
            floors.append({"id": e.id, "levelId": e.level_id, "outlineMm": outlines})
        elif isinstance(e, RoomElem):
            if "room" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            outlines = [[round(p.x_mm, 3), round(p.y_mm, 3)] for p in e.outline_mm]
            rooms.append({"id": e.id, "levelId": e.level_id, "outlineMm": outlines})
        elif isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            if (
                "door" in hidden_semantic
                or "wall" in hidden_semantic
                or not lvl_ok(w.level_id)
            ):
                continue
            tspan = hosted_opening_t_span_normalized(e, w)
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            doors.append(
                {
                    "id": e.id,
                    "wallId": e.wall_id,
                    "levelId": w.level_id,
                    "alongT": round(float(e.along_t), 6),
                    "widthMm": round(e.width_mm, 3),
                    "anchorMm": {"x": round(cx_mm, 3), "y": round(cy_mm, 3)},
                    "openingTSpanNormalized": [round(float(tspan[0]), 6), round(float(tspan[1]), 6)]
                    if tspan
                    else None,
                }
            )
        elif isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            if (
                "window" in hidden_semantic
                or "wall" in hidden_semantic
                or not lvl_ok(w.level_id)
            ):
                continue
            tspan = hosted_opening_t_span_normalized(e, w)
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            windows.append(
                {
                    "id": e.id,
                    "wallId": e.wall_id,
                    "levelId": w.level_id,
                    "alongT": round(float(e.along_t), 6),
                    "widthMm": round(e.width_mm, 3),
                    "sillHeightMm": round(e.sill_height_mm, 3),
                    "heightMm": round(e.height_mm, 3),
                    "anchorMm": {"x": round(cx_mm, 3), "y": round(cy_mm, 3)},
                    "openingTSpanNormalized": [round(float(tspan[0]), 6), round(float(tspan[1]), 6)]
                    if tspan
                    else None,
                }
            )
        elif isinstance(e, StairElem):
            if "stair" in hidden_semantic or not lvl_ok(e.base_level_id):
                continue
            stairs.append(
                {
                    "id": e.id,
                    "baseLevelId": e.base_level_id,
                    "runStartMm": {
                        "x": round(e.run_start.x_mm, 3),
                        "y": round(e.run_start.y_mm, 3),
                    },
                    "runEndMm": {
                        "x": round(e.run_end.x_mm, 3),
                        "y": round(e.run_end.y_mm, 3),
                    },
                    "widthMm": round(e.width_mm, 3),
                }
            )
        elif isinstance(e, RoofElem):
            ref = getattr(e, "reference_level_id", "") or ""
            if "roof" in hidden_semantic or not lvl_ok(ref):
                continue
            fp = [[round(p.x_mm, 3), round(p.y_mm, 3)] for p in e.footprint_mm]
            roofs.append({"id": e.id, "referenceLevelId": ref, "footprintMm": fp})
        elif isinstance(e, GridLineElem):
            elv = getattr(e, "level_id", None)
            if "grid_line" in hidden_semantic or (
                level and elv is not None and elv != level
            ):
                continue
            grid_lines.append(
                {
                    "id": e.id,
                    "levelId": elv,
                    "startMm": {"x": round(e.start.x_mm, 3), "y": round(e.start.y_mm, 3)},
                    "endMm": {"x": round(e.end.x_mm, 3), "y": round(e.end.y_mm, 3)},
                }
            )
        elif isinstance(e, DimensionElem):
            if "dimension" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            dimensions.append(
                {
                    "id": e.id,
                    "levelId": e.level_id,
                    "aMm": {"x": round(e.a_mm.x_mm, 3), "y": round(e.a_mm.y_mm, 3)},
                    "bMm": {"x": round(e.b_mm.x_mm, 3), "y": round(e.b_mm.y_mm, 3)},
                }
            )

    primitives = {
        "format": "planProjectionPrimitives_v1",
        "walls": walls,
        "floors": floors,
        "rooms": rooms,
        "doors": doors,
        "windows": windows,
        "stairs": stairs,
        "roofs": roofs,
        "gridLines": grid_lines,
        "dimensions": dimensions,
    }
    return primitives, warnings


def resolve_plan_projection_wire(
    doc: Document,
    *,
    plan_view_id: str | None,
    fallback_level_id: str | None,
    global_plan_presentation: str = "default",
) -> dict[str, Any]:
    """Mirror `packages/web/src/plan/planProjection.ts` semantics for deterministic tests."""

    hidden_semantic: set[str] = set()
    active_level: str | None = fallback_level_id
    presentation = global_plan_presentation
    pinned_pv: str | None = None
    pinned_pv_elem: PlanViewElem | None = None

    if plan_view_id:
        pv_el = doc.elements.get(plan_view_id)
        if isinstance(pv_el, PlanViewElem):
            pinned_pv = plan_view_id
            pinned_pv_elem = pv_el
            active_level = pv_el.level_id
            for lab in pv_el.categories_hidden or ():
                k = _canon_hidden_category(str(lab))
                if k:
                    hidden_semantic.add(k)

            tmpl_id = pv_el.view_template_id
            if tmpl_id:
                tmpl = doc.elements.get(tmpl_id)
                if isinstance(tmpl, ViewTemplateElem):
                    for lab in tmpl.hidden_categories or ():
                        k = _canon_hidden_category(str(lab))
                        if k:
                            hidden_semantic.add(k)

            pres_raw = getattr(pv_el, "plan_presentation", None) or "default"
            if pres_raw in {"opening_focus", "room_scheme"}:
                presentation = str(pres_raw)
            else:
                presentation = "default"

    def kind_visible(kind: str) -> bool:
        return kind not in hidden_semantic

    level = active_level

    counts: dict[str, int] = {}
    eligible = 0

    def bump(k: str) -> None:
        nonlocal eligible
        if not kind_visible(k):
            return
        eligible += 1
        counts[k] = counts.get(k, 0) + 1

    for e in doc.elements.values():
        ek = getattr(e, "kind", None)
        if ek == "wall" and isinstance(e, WallElem):
            if not level or e.level_id == level:
                bump("wall")
        elif ek == "floor" and isinstance(e, FloorElem):
            if not level or e.level_id == level:
                bump("floor")
        elif ek == "roof" and isinstance(e, RoofElem):
            ref = getattr(e, "reference_level_id", "") or ""
            if not level or ref == level:
                bump("roof")
        elif ek == "room" and isinstance(e, RoomElem):
            if not level or e.level_id == level:
                bump("room")
        elif ek == "door" and isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if isinstance(w, WallElem) and (not level or w.level_id == level):
                bump("door")
        elif ek == "window" and isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if isinstance(w, WallElem) and (not level or w.level_id == level):
                bump("window")
        elif ek == "stair" and isinstance(e, StairElem):
            if not level or e.base_level_id == level:
                bump("stair")
        elif ek == "grid_line" and isinstance(e, GridLineElem):
            elv = getattr(e, "level_id", None)
            if elv is None or not level or elv == level:
                bump("grid_line")
        elif ek == "dimension" and isinstance(e, DimensionElem):
            if not level or e.level_id == level:
                bump("dimension")

    prim, prim_warn = _build_plan_primitive_lists(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        pinned_pv_el=pinned_pv_elem,
    )
    all_warnings = list(prim_warn)

    return {
        "format": "planProjectionWire_v1",
        "planViewElementId": pinned_pv,
        "activeLevelId": active_level,
        "planPresentation": presentation,
        "hiddenSemanticKinds": sorted(hidden_semantic),
        "visibleElementEligibleCount": eligible,
        "countsByVisibleKind": dict(sorted(counts.items())),
        "warnings": all_warnings,
        "primitives": prim,
    }


def plan_projection_wire_from_request(
    doc: Document,
    *,
    plan_view_id: str | None = None,
    fallback_level_id: str | None = None,
    global_plan_presentation: str = "default",
) -> dict[str, Any]:
    """HTTP-friendly entry for query wiring (WP-C01/C02)."""

    return resolve_plan_projection_wire(
        doc,
        plan_view_id=plan_view_id,
        fallback_level_id=fallback_level_id,
        global_plan_presentation=global_plan_presentation,
    )


def section_cut_projection_wire(doc: Document, section_cut_id: str) -> dict[str, Any]:
    """Thin server slice for `section_cut` — geometry projection deferred (WP-E04)."""

    sec = doc.elements.get(section_cut_id)

    if not isinstance(sec, SectionCutElem):

        return {
            "format": "sectionProjectionWire_v1",
            "errors": [{"code": "not_found", "message": "section_cut id missing or wrong kind"}],
        }

    return {
        "format": "sectionProjectionWire_v1",
        "sectionCutId": sec.id,
        "name": sec.name,

        "lineStartMm": sec.line_start_mm.model_dump(by_alias=True),

        "lineEndMm": sec.line_end_mm.model_dump(by_alias=True),

        "cropDepthMm": float(sec.crop_depth_mm),
        "note": (
            "2D orthographic projection and cut-plane intersection are not emitted in this slice; "
            "this wire is stable metadata for hydration and CI."
        ),
        "elementCountRough": sum(1 for e in doc.elements.values() if isinstance(e, WallElem)),
    }

