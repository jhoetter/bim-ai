"""Geometry helpers used by constraint evaluation."""

from __future__ import annotations

Point2 = tuple[float, float]
Triangle2 = tuple[Point2, Point2, Point2]


def polygon_area_abs_mm2(poly: list[Point2]) -> float:
    """Shoelace area (absolute), mm2."""

    n = len(poly)
    if n < 3:
        return 0.0
    area_twice = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        area_twice += x1 * y2 - x2 * y1
    return abs(area_twice / 2.0)


def polygon_signed_area(poly: list[Point2]) -> float:
    n = len(poly)
    if n < 3:
        return 0.0
    area_twice = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        area_twice += x1 * y2 - x2 * y1
    return area_twice / 2.0


def polygon_bbox(poly: list[Point2]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def ear_clip_triangulate(poly: list[Point2]) -> list[Triangle2]:
    """Ear-clipping triangulation of a simple polygon, including concave shapes."""

    n = len(poly)
    if n < 3:
        return []
    if n == 3:
        return [(poly[0], poly[1], poly[2])]

    pts = list(poly)
    if polygon_signed_area(pts) < 0:
        pts = list(reversed(pts))

    indices = list(range(len(pts)))
    triangles: list[Triangle2] = []

    def point_in_triangle(p: Point2, a: Point2, b: Point2, c: Point2) -> bool:
        d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1])
        d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1])
        d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1])
        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
        return not (has_neg and has_pos)

    safety = 0
    while len(indices) > 3 and safety < 4 * n:
        safety += 1
        ear_found = False
        m = len(indices)
        for k in range(m):
            i_prev = indices[(k - 1) % m]
            i_curr = indices[k]
            i_next = indices[(k + 1) % m]
            a = pts[i_prev]
            b = pts[i_curr]
            c = pts[i_next]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 0:
                continue
            valid = True
            for j in indices:
                if j in (i_prev, i_curr, i_next):
                    continue
                if point_in_triangle(pts[j], a, b, c):
                    valid = False
                    break
            if valid:
                triangles.append((a, b, c))
                indices.pop(k)
                ear_found = True
                break
        if not ear_found:
            return []
    if len(indices) == 3:
        triangles.append((pts[indices[0]], pts[indices[1]], pts[indices[2]]))
    return triangles


def clip_convex_against_convex(subject: list[Point2], clip: list[Point2]) -> list[Point2]:
    """Sutherland-Hodgman clipping for convex subject and clip polygons."""

    if not subject or not clip:
        return []
    if polygon_signed_area(clip) < 0:
        clip = list(reversed(clip))
    output = list(subject)
    n = len(clip)
    for i in range(n):
        if not output:
            break
        ax, ay = clip[i]
        bx, by = clip[(i + 1) % n]
        edge_x = bx - ax
        edge_y = by - ay
        prev_list = output
        output = []
        m = len(prev_list)
        for j in range(m):
            curr = prev_list[j]
            prev = prev_list[j - 1]
            curr_in = edge_x * (curr[1] - ay) - edge_y * (curr[0] - ax) >= 0
            prev_in = edge_x * (prev[1] - ay) - edge_y * (prev[0] - ax) >= 0
            if curr_in or prev_in:
                if curr_in != prev_in:
                    rx = curr[0] - prev[0]
                    ry = curr[1] - prev[1]
                    denom = edge_x * ry - edge_y * rx
                    if abs(denom) < 1e-12:
                        cross_pt = prev
                    else:
                        t = (edge_x * (prev[1] - ay) - edge_y * (prev[0] - ax)) / -denom
                        cross_pt = (prev[0] + t * rx, prev[1] + t * ry)
                    output.append(cross_pt)
                if curr_in:
                    output.append(curr)
    return output


def polygon_overlap_area_mm2(poly_a: list[Point2], poly_b: list[Point2]) -> float:
    """Polygon-polygon intersection area in mm2 for arbitrary simple polygons."""

    if len(poly_a) < 3 or len(poly_b) < 3:
        return 0.0
    ax0, ay0, ax1, ay1 = polygon_bbox(poly_a)
    bx0, by0, bx1, by1 = polygon_bbox(poly_b)
    if ax1 < bx0 or bx1 < ax0 or ay1 < by0 or by1 < ay0:
        return 0.0
    tris_a = ear_clip_triangulate(poly_a)
    tris_b = ear_clip_triangulate(poly_b)
    if not tris_a or not tris_b:
        return 0.0
    total = 0.0
    for ta in tris_a:
        ta_list = [ta[0], ta[1], ta[2]]
        for tb in tris_b:
            tb_list = [tb[0], tb[1], tb[2]]
            clipped = clip_convex_against_convex(ta_list, tb_list)
            if len(clipped) >= 3:
                total += polygon_area_abs_mm2(clipped)
    return total
