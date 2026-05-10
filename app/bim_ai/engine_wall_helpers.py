from __future__ import annotations

from bim_ai.elements import WallElem


def resolve_stack_wall_type_at_cut(wall: WallElem, cut_plane_offset_mm: float) -> str | None:
    """Return the wallTypeId of the component containing the cut-plane height."""
    if wall.stack is None or not wall.stack.components:
        return wall.wall_type_id
    accumulated = 0.0
    for i, component in enumerate(wall.stack.components):
        is_last = i == len(wall.stack.components) - 1
        top = wall.height_mm if is_last else accumulated + component.height_mm
        if accumulated <= cut_plane_offset_mm < top:
            return component.wall_type_id
        accumulated += component.height_mm
    return wall.stack.components[-1].wall_type_id


def schedule_stacked_components(wall: WallElem) -> list[dict]:
    """Enumerate stack components as schedule rows."""
    if wall.stack is None or not wall.stack.components:
        return [
            {
                "wallId": wall.id,
                "wallTypeId": wall.wall_type_id,
                "heightMm": wall.height_mm,
                "componentIndex": 0,
            }
        ]
    rows = []
    accumulated = 0.0
    for i, comp in enumerate(wall.stack.components):
        is_last = i == len(wall.stack.components) - 1
        effective_height = (wall.height_mm - accumulated) if is_last else comp.height_mm
        rows.append(
            {
                "wallId": wall.id,
                "wallTypeId": comp.wall_type_id,
                "heightMm": effective_height,
                "componentIndex": i,
            }
        )
        accumulated += comp.height_mm
    return rows


def resolve_wall_face_offset_at_cut(
    wall: WallElem,
    cut_plane_offset_mm: float,
) -> tuple[float, float]:
    """Return the (x_offset_mm, y_offset_mm) of the wall face at the given cut height."""
    if wall.lean_mm is None or wall.height_mm == 0:
        return (0.0, 0.0)
    fraction = cut_plane_offset_mm / wall.height_mm
    return (
        wall.lean_mm.x_mm * fraction,
        wall.lean_mm.y_mm * fraction,
    )
