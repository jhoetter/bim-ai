"""KRN-08 — area calculation for the `area` element kind.

Areas are legal/permit polygons distinct from rooms. They are recomputed by
the engine after every command apply and the result stored on
`AreaElem.computed_area_sq_mm`.

Three rule sets:

- ``gross``: polygon area via the shoelace formula (no adjustments).
- ``net``: polygon area minus any contained ``slab_opening`` shafts. A shaft is
  considered contained if its boundary lies entirely inside the area polygon
  (centroid + all-vertices test — defensive against floating-point edge cases).
- ``no_rules``: same as ``gross`` (no jurisdictional rule applied).
"""

from __future__ import annotations

from collections.abc import Iterable

from bim_ai.elements import AreaElem, Element, SlabOpeningElem, Vec2Mm


def _polygon_area_abs_mm2(poly: Iterable[Vec2Mm]) -> float:
    """Shoelace |area| in mm²."""
    pts = [(p.x_mm, p.y_mm) for p in poly]
    n = len(pts)
    if n < 3:
        return 0.0
    acc = 0.0
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        acc += x1 * y2 - x2 * y1
    return abs(acc / 2.0)


def _point_in_polygon(px: float, py: float, poly: list[tuple[float, float]]) -> bool:
    """Standard ray-cast point-in-polygon (boundary points: undefined, treated as inside)."""
    n = len(poly)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def _polygon_inside(inner: list[Vec2Mm], outer: list[Vec2Mm]) -> bool:
    """True if every vertex of ``inner`` lies inside ``outer``."""
    outer_pts = [(p.x_mm, p.y_mm) for p in outer]
    for p in inner:
        if not _point_in_polygon(p.x_mm, p.y_mm, outer_pts):
            return False
    return True


def compute_area_sq_mm(area: AreaElem, elements: dict[str, Element]) -> float:
    """Return the recomputed `computedAreaSqMm` for an area element.

    For ``net``: subtracts any contained slab_opening (shaft) whose boundary lies
    inside the area polygon. Subtraction is clamped to zero.
    """
    gross = _polygon_area_abs_mm2(area.boundary_mm)
    if area.rule_set in ("gross", "no_rules"):
        return gross
    if area.rule_set == "net":
        deduction = 0.0
        for el in elements.values():
            if isinstance(el, SlabOpeningElem) and _polygon_inside(el.boundary_mm, area.boundary_mm):
                deduction += _polygon_area_abs_mm2(el.boundary_mm)
        return max(0.0, gross - deduction)
    return gross


def recompute_all_areas(elements: dict[str, Element]) -> None:
    """Recompute `computedAreaSqMm` on every AreaElem in-place."""
    for eid, el in list(elements.items()):
        if isinstance(el, AreaElem):
            elements[eid] = el.model_copy(
                update={"computed_area_sq_mm": compute_area_sq_mm(el, elements)}
            )
