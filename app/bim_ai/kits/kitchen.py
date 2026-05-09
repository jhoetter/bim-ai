"""AST-V3-04: kitchen kit snap-chain solver."""

from __future__ import annotations

from bim_ai.elements import FamilyKitInstanceElem, KitComponent  # noqa: F401

BASE_HEIGHT_MM = 870.0
BASE_DEPTH_MM = 600.0
UPPER_HEIGHT_MM = 720.0
UPPER_DEPTH_MM = 330.0
PANTRY_HEIGHT_MM = 2200.0


def solve_chain(kit: FamilyKitInstanceElem) -> list[dict]:
    """Resolve component widths and positions along the wall.

    Returns a list of resolved component dicts with:
    { componentKind, xStartMm, widthMm, heightMm, depthMm, ... }

    Components with width_mm=None share the remaining run equally.
    """
    total_run = kit.end_mm - kit.start_mm
    if total_run <= 0:
        return []

    components = kit.components

    # Separate explicit-width and auto-fill components
    explicit_run = sum(
        c.width_mm
        for c in components
        if c.width_mm is not None and c.component_kind != "countertop"
    )
    auto_fill = [
        c
        for c in components
        if c.width_mm is None and c.component_kind not in ("countertop", "end_panel")
    ]
    auto_width = (total_run - explicit_run) / len(auto_fill) if auto_fill else 0.0

    # Handle overflow
    if explicit_run > total_run and not auto_fill:
        pass  # report advisory; don't crash

    resolved = []
    x = kit.start_mm
    for comp in components:
        if comp.component_kind == "countertop":
            continue  # generated separately
        w = comp.width_mm if comp.width_mm is not None else auto_width
        h = comp.height_mm or _default_height(comp.component_kind)
        d = comp.depth_mm or _default_depth(comp.component_kind)
        resolved.append(
            {
                "componentKind": comp.component_kind,
                "xStartMm": x,
                "widthMm": w,
                "heightMm": h,
                "depthMm": d,
                "doorStyle": comp.door_style,
                "materialId": comp.material_id,
            }
        )
        x += w

    return resolved


def _default_height(kind: str) -> float:
    return {
        "base": BASE_HEIGHT_MM,
        "upper": UPPER_HEIGHT_MM,
        "oven_housing": BASE_HEIGHT_MM,
        "sink": BASE_HEIGHT_MM,
        "pantry": PANTRY_HEIGHT_MM,
        "dishwasher": BASE_HEIGHT_MM,
        "fridge": 2000.0,
        "end_panel": BASE_HEIGHT_MM,
    }.get(kind, BASE_HEIGHT_MM)


def _default_depth(kind: str) -> float:
    return {
        "upper": UPPER_DEPTH_MM,
        "pantry": BASE_DEPTH_MM,
    }.get(kind, BASE_DEPTH_MM)
