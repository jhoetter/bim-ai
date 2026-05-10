from __future__ import annotations

from collections.abc import Callable
from typing import Any

from bim_ai.commands import MirrorElementsCmd
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    Element,
    FloorElem,
    RoofElem,
    RoomElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)


def _reflect_point_xy_mm(
    px: float, py: float, ax: float, ay: float, bx: float, by: float
) -> tuple[float, float]:
    """Reflect (px,py) across the infinite line through (ax,ay)-(bx,by)."""
    dx = bx - ax
    dy = by - ay
    denom = dx * dx + dy * dy
    if denom == 0.0:
        # Degenerate axis: reflect through the point a (point reflection).
        return (2 * ax - px, 2 * ay - py)
    vx = px - ax
    vy = py - ay
    t = (vx * dx + vy * dy) / denom
    proj_x = ax + t * dx
    proj_y = ay + t * dy
    return (2 * proj_x - px, 2 * proj_y - py)


def _reflect_vec2_mm(p: Vec2Mm, axis_start: Vec2Mm, axis_end: Vec2Mm) -> Vec2Mm:
    rx, ry = _reflect_point_xy_mm(
        p.x_mm, p.y_mm, axis_start.x_mm, axis_start.y_mm, axis_end.x_mm, axis_end.y_mm
    )
    return Vec2Mm(xMm=rx, yMm=ry)


def _mirror_wall(w: WallElem, axis: Any) -> WallElem:
    """Mirror a wall, preserving hosted-opening alongT semantics."""
    new_start = _reflect_vec2_mm(w.start, axis.start_mm, axis.end_mm)
    new_end = _reflect_vec2_mm(w.end, axis.start_mm, axis.end_mm)
    return w.model_copy(update={"start": new_start, "end": new_end})


def _mirror_polygon(pts: list[Vec2Mm], axis_start: Vec2Mm, axis_end: Vec2Mm) -> list[Vec2Mm]:
    """Reflect each vertex and reverse winding after the orientation flip."""
    reflected = [_reflect_vec2_mm(p, axis_start, axis_end) for p in pts]
    reflected.reverse()
    return reflected


def apply_mirror_elements(
    els: dict[str, Element],
    cmd: MirrorElementsCmd,
    new_id: Callable[[], str],
) -> None:
    target_ids: set[str] = set(cmd.element_ids)
    if not target_ids:
        return

    if cmd.also_copy:
        new_elements: dict[str, Element] = {}
        wall_copy_id_for: dict[str, str] = {}
        for tid in target_ids:
            el = els.get(tid)
            if el is None:
                continue
            mirrored = _mirror_one(el, cmd)
            if mirrored is None:
                continue
            new_eid = new_id()
            new_elements[new_eid] = mirrored.model_copy(update={"id": new_eid})
            if isinstance(el, WallElem):
                wall_copy_id_for[tid] = new_eid

        for orig_wall_id, host_new_id in wall_copy_id_for.items():
            for el in list(els.values()):
                if isinstance(el, (DoorElem, WindowElem)) and el.wall_id == orig_wall_id:
                    copy_id = new_id()
                    new_elements[copy_id] = el.model_copy(
                        update={"id": copy_id, "wall_id": host_new_id}
                    )

        els.update(new_elements)
        return

    for tid in target_ids:
        el = els.get(tid)
        if el is None:
            continue
        mirrored = _mirror_one(el, cmd)
        if mirrored is not None:
            els[tid] = mirrored


def _mirror_one(el: Element, cmd: MirrorElementsCmd) -> Element | None:
    axis = cmd.axis
    if isinstance(el, WallElem):
        return _mirror_wall(el, axis)
    if isinstance(el, (DoorElem, WindowElem)):
        return None
    if isinstance(el, FloorElem):
        return el.model_copy(
            update={"boundary_mm": _mirror_polygon(el.boundary_mm, axis.start_mm, axis.end_mm)}
        )
    if isinstance(el, RoomElem):
        return el.model_copy(
            update={"outline_mm": _mirror_polygon(el.outline_mm, axis.start_mm, axis.end_mm)}
        )
    if isinstance(el, RoofElem):
        return el.model_copy(
            update={"footprint_mm": _mirror_polygon(el.footprint_mm, axis.start_mm, axis.end_mm)}
        )
    return None


def mirror_advisories_for_command(doc: Document, cmd: MirrorElementsCmd) -> list[dict[str, Any]]:
    """Compute non-blocking advisories for a mirror command."""
    asymmetric: set[str] = set(cmd.asymmetric_family_type_ids)
    if not asymmetric:
        return []
    out: list[dict[str, Any]] = []
    for tid in cmd.element_ids:
        el = doc.elements.get(tid)
        if isinstance(el, (DoorElem, WindowElem)) and el.family_type_id in asymmetric:
            out.append({"code": "mirror_asymmetric", "elementId": tid})
    return out
