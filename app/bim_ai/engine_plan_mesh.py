from __future__ import annotations

import math
from typing import Any, NamedTuple

from bim_ai.elements import ColumnElem, DoorElem, StairElem, WindowElem


class LineSegment(NamedTuple):
    """A single 2-D line segment in plan-view space (mm)."""

    x0: float
    y0: float
    x1: float
    y1: float
    is_arc: bool = False
    phase_render_style: str | None = None


def _phase_render_style_for(el: Any) -> str | None:
    if getattr(el, "phase_demolished", None):
        return "bold_dashed_grey"
    return None


def _door_coarse_outline(door: DoorElem, depth_mm: float = 200.0) -> list[LineSegment]:
    half = door.width_mm / 2.0
    style = _phase_render_style_for(door)
    return [
        LineSegment(-half, 0.0, -half, depth_mm, False, style),
        LineSegment(half, 0.0, half, depth_mm, False, style),
    ]


def _door_medium_outline(door: DoorElem, depth_mm: float = 200.0) -> list[LineSegment]:
    half = door.width_mm / 2.0
    style = _phase_render_style_for(door)
    return [
        LineSegment(-half, 0.0, -half, depth_mm, False, style),
        LineSegment(half, 0.0, half, depth_mm, False, style),
        LineSegment(-half, 0.0, half, 0.0, False, style),
        LineSegment(-half, depth_mm, half, depth_mm, False, style),
    ]


def _door_fine_detail(door: DoorElem, depth_mm: float = 200.0) -> list[LineSegment]:
    segs = _door_medium_outline(door, depth_mm)
    style = _phase_render_style_for(door)
    segs.append(LineSegment(-door.width_mm / 2.0, 0.0, door.width_mm / 2.0, 0.0, True, style))
    return segs


def planDoorMesh(door: DoorElem, detail_level: str) -> list[LineSegment]:
    """Route door plan geometry by detail level (coarse/medium/fine)."""

    if detail_level == "coarse":
        return _door_coarse_outline(door)
    elif detail_level == "medium":
        return _door_medium_outline(door)
    else:
        return _door_fine_detail(door)


def _window_coarse(window: WindowElem) -> list[LineSegment]:
    style = _phase_render_style_for(window)
    return [LineSegment(-window.width_mm / 2.0, 0.0, window.width_mm / 2.0, 0.0, False, style)]


def _window_medium(window: WindowElem, depth_mm: float = 200.0) -> list[LineSegment]:
    half = window.width_mm / 2.0
    style = _phase_render_style_for(window)
    return [
        LineSegment(-half, 0.0, half, 0.0, False, style),
        LineSegment(-half, depth_mm, half, depth_mm, False, style),
    ]


def _window_fine(window: WindowElem, depth_mm: float = 200.0) -> list[LineSegment]:
    segs = _window_medium(window, depth_mm)
    half = window.width_mm / 2.0
    style = _phase_render_style_for(window)
    segs.append(LineSegment(-half, depth_mm / 2.0, half, depth_mm / 2.0, False, style))
    return segs


def planWindowMesh(window: WindowElem, detail_level: str) -> list[LineSegment]:
    """Route window plan geometry by detail level (coarse/medium/fine)."""

    if detail_level == "coarse":
        return _window_coarse(window)
    elif detail_level == "medium":
        return _window_medium(window)
    else:
        return _window_fine(window)


def _stair_bounding_rect(stair: StairElem) -> list[LineSegment]:
    sx = float(stair.run_start.x_mm)
    sy = float(stair.run_start.y_mm)
    ex = float(stair.run_end.x_mm)
    ey = float(stair.run_end.y_mm)
    run_len = math.hypot(ex - sx, ey - sy) or 1.0
    tx = (ex - sx) / run_len
    ty = (ey - sy) / run_len
    nx = -ty
    ny = tx
    half_w = stair.width_mm / 2.0
    px = nx * half_w
    py = ny * half_w
    style = _phase_render_style_for(stair)
    return [
        LineSegment(sx + px, sy + py, ex + px, ey + py, False, style),
        LineSegment(ex + px, ey + py, ex - px, ey - py, False, style),
        LineSegment(ex - px, ey - py, sx - px, sy - py, False, style),
        LineSegment(sx - px, sy - py, sx + px, sy + py, False, style),
    ]


def _stair_medium(stair: StairElem) -> list[LineSegment]:
    segs = _stair_bounding_rect(stair)
    sx = float(stair.run_start.x_mm)
    sy = float(stair.run_start.y_mm)
    ex = float(stair.run_end.x_mm)
    ey = float(stair.run_end.y_mm)
    style = _phase_render_style_for(stair)
    segs.append(LineSegment(sx, sy, (sx + ex) / 2.0, (sy + ey) / 2.0, False, style))
    return segs


def _stair_fine(stair: StairElem) -> list[LineSegment]:
    segs = _stair_bounding_rect(stair)
    sx = float(stair.run_start.x_mm)
    sy = float(stair.run_start.y_mm)
    ex = float(stair.run_end.x_mm)
    ey = float(stair.run_end.y_mm)
    run_len = math.hypot(ex - sx, ey - sy) or 1.0
    tx = (ex - sx) / run_len
    ty = (ey - sy) / run_len
    nx = -ty
    ny = tx
    half_w = stair.width_mm / 2.0
    tread_count = max(2, int(round(run_len / max(stair.tread_mm, 1.0))))
    style = _phase_render_style_for(stair)
    for i in range(1, tread_count):
        t = run_len * i / tread_count
        cx = sx + tx * t
        cy = sy + ty * t
        segs.append(
            LineSegment(
                cx - nx * half_w, cy - ny * half_w, cx + nx * half_w, cy + ny * half_w, False, style
            )
        )
    segs.append(LineSegment(sx, sy, ex, ey, False, style))
    return segs


def planStairMesh(stair: StairElem, detail_level: str) -> list[LineSegment]:
    """Route stair plan geometry by detail level (coarse/medium/fine)."""

    if detail_level == "coarse":
        return _stair_bounding_rect(stair)
    elif detail_level == "medium":
        return _stair_medium(stair)
    else:
        return _stair_fine(stair)


def _family_coarse(instance: ColumnElem) -> list[LineSegment]:
    cx = float(instance.position_mm.x_mm)
    cy = float(instance.position_mm.y_mm)
    half_b = instance.b_mm / 2.0
    half_h = instance.h_mm / 2.0
    style = _phase_render_style_for(instance)
    return [
        LineSegment(cx - half_b, cy - half_h, cx + half_b, cy - half_h, False, style),
        LineSegment(cx + half_b, cy - half_h, cx + half_b, cy + half_h, False, style),
        LineSegment(cx + half_b, cy + half_h, cx - half_b, cy + half_h, False, style),
        LineSegment(cx - half_b, cy + half_h, cx - half_b, cy - half_h, False, style),
    ]


def _family_full(instance: ColumnElem) -> list[LineSegment]:
    segs = _family_coarse(instance)
    cx = float(instance.position_mm.x_mm)
    cy = float(instance.position_mm.y_mm)
    half_b = instance.b_mm / 2.0
    half_h = instance.h_mm / 2.0
    style = _phase_render_style_for(instance)
    segs.append(LineSegment(cx - half_b, cy - half_h, cx + half_b, cy + half_h, False, style))
    segs.append(LineSegment(cx + half_b, cy - half_h, cx - half_b, cy + half_h, False, style))
    return segs


def planFamilyInstanceMesh(instance: ColumnElem, detail_level: str) -> list[LineSegment]:
    """Route family-instance plan geometry by detail level (coarse/medium/fine)."""

    if detail_level == "coarse":
        return _family_coarse(instance)
    else:
        return _family_full(instance)
