from __future__ import annotations


def subtract(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    return a[0] - b[0], a[1] - b[1]


def dot(a: tuple[float, float], b: tuple[float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1]


def perp(vec: tuple[float, float]) -> tuple[float, float]:
    x, y = vec
    return (-y, x)


class Poly:
    __slots__ = ("verts",)

    def __init__(self, verts: tuple[tuple[float, float], ...]) -> None:
        self.verts = verts


def wall_corners(
    start_mm: tuple[float, float],
    end_mm: tuple[float, float],
    thickness_mm: float,
) -> Poly:
    sx, sy = start_mm
    ex, ey = end_mm
    dx = ex - sx
    dy = ey - sy
    length_sq = dx * dx + dy * dy
    if length_sq < 1e-6:
        return Poly(((sx, sy),))
    length = length_sq**0.5
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    half_l = length / 2
    half_t = thickness_mm / 2
    cx = (sx + ex) / 2
    cy = (sy + ey) / 2

    def wc(salong: float, sacross: float) -> tuple[float, float]:
        return cx + ux * salong + px * sacross, cy + uy * salong + py * sacross

    pts = (
        wc(+half_l, +half_t),
        wc(+half_l, -half_t),
        wc(-half_l, -half_t),
        wc(-half_l, +half_t),
    )
    return Poly(pts)


def polygon_axes(poly: Poly) -> list[tuple[float, float]]:
    axes: list[tuple[float, float]] = []
    v = poly.verts
    n = len(v)
    if n < 3:
        return axes
    for i in range(n):
        p1 = v[i]
        p2 = v[(i + 1) % n]
        edge = subtract(p2, p1)
        axis = perp(edge)
        axis_len_sq = axis[0] ** 2 + axis[1] ** 2
        if axis_len_sq < 1e-12:
            continue
        ln = axis_len_sq**0.5
        axes.append((axis[0] / ln, axis[1] / ln))
    return axes


def proj_range(poly: Poly, axis: tuple[float, float]) -> tuple[float, float]:
    dots = [dot(p, axis) for p in poly.verts]
    return min(dots), max(dots)


def axis_overlap(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return not (a[1] < b[0] or b[1] < a[0])


def sat_overlap(poly_a: Poly, poly_b: Poly) -> bool:
    if len(poly_a.verts) < 3 or len(poly_b.verts) < 3:
        return False
    axes = polygon_axes(poly_a) + polygon_axes(poly_b)
    for axis in axes:
        ra = proj_range(poly_a, axis)
        rb = proj_range(poly_b, axis)
        if not axis_overlap(ra, rb):
            return False
    return True


def point_in_poly(p: tuple[float, float], poly: Poly) -> bool:
    x, y = p
    inside = False
    v = poly.verts
    n = len(v)
    for i in range(n):
        x1, y1 = v[i]
        x2, y2 = v[(i + 1) % n]
        intersects = ((y1 > y) != (y2 > y)) and (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-18) + x1)
        if intersects:
            inside = not inside
    return inside


def approx_overlap_area_mm2(poly_a: Poly, poly_b: Poly, spacing_mm: float = 180) -> float:
    xs = [p[0] for p in poly_a.verts] + [p[0] for p in poly_b.verts]
    ys = [p[1] for p in poly_a.verts] + [p[1] for p in poly_b.verts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    if max_x - min_x < 1 or max_y - min_y < 1:
        return 0.0

    step = max(80.0, spacing_mm)
    hits = 0
    gx = min_x
    cell = step * step
    while gx <= max_x:
        gy = min_y
        while gy <= max_y:
            if point_in_poly((gx, gy), poly_a) and point_in_poly((gx, gy), poly_b):
                hits += 1
            gy += step
        gx += step
    return hits * cell
