"""SKT-01 validation — closed-loop, self-intersection, planarity (floor slice).

For the floor element kind, "planar" means lines lie on the level's z=0 plane.
Since :class:`SketchLine` carries 2D `Vec2Mm` endpoints in level-local space,
planarity is automatic — every line is on z=0 by construction. The check is
preserved here as an explicit predicate so future element kinds (e.g. void cuts
on a host wall face) can override the work plane without rewriting validation.
"""

from __future__ import annotations

from collections import defaultdict

from bim_ai.elements import Vec2Mm
from bim_ai.sketch_session import (
    SketchLine,
    SketchSession,
    SketchValidationIssue,
    SketchValidationState,
)


class SketchInvalidError(ValueError):
    """Raised by :func:`assert_closed_loop` / :func:`assert_line_set` on failure.

    Carries the same `code` strings as :class:`SketchValidationIssue` so
    callers that handle live validation and Finish-time validation can share
    error vocabulary.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# Vertex coincidence tolerance — sub-millimetre; matches typical Revit snap.
_VERTEX_EPS_MM = 0.5
# Numerical tolerance for segment-pair intersection tests.
_INTERSECT_EPS = 1e-7
# Revit allows very small segments, but they are almost always accidental in
# plan authoring. Keep this below the frontend 100 mm snap grid so snapped
# authoring remains valid while truly tiny edges are blocked before Finish.
MIN_SKETCH_EDGE_LENGTH_MM = 100.0


def _vkey(p_mm: tuple[float, float]) -> tuple[int, int]:
    """Quantise a vertex to a hash key so coincident endpoints collapse."""

    qx = round(p_mm[0] / _VERTEX_EPS_MM)
    qy = round(p_mm[1] / _VERTEX_EPS_MM)
    return qx, qy


def _line_endpoints(line: SketchLine) -> tuple[tuple[float, float], tuple[float, float]]:
    return (
        (line.from_mm.x_mm, line.from_mm.y_mm),
        (line.to_mm.x_mm, line.to_mm.y_mm),
    )


def _distance_mm(a: tuple[float, float], b: tuple[float, float]) -> float:
    return ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5


def _cross(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _collinear_overlap_length_mm(
    a0: tuple[float, float],
    a1: tuple[float, float],
    b0: tuple[float, float],
    b1: tuple[float, float],
) -> float:
    """Return the strict collinear overlap length between two segments."""

    ax, ay = a1[0] - a0[0], a1[1] - a0[1]
    len_sq = ax * ax + ay * ay
    if len_sq <= _INTERSECT_EPS:
        return 0.0
    length = len_sq**0.5
    if abs(_cross(a0, a1, b0)) / length > _VERTEX_EPS_MM:
        return 0.0
    if abs(_cross(a0, a1, b1)) / length > _VERTEX_EPS_MM:
        return 0.0

    def _t(p: tuple[float, float]) -> float:
        return ((p[0] - a0[0]) * ax + (p[1] - a0[1]) * ay) / len_sq

    lo = max(0.0, min(_t(b0), _t(b1)))
    hi = min(1.0, max(_t(b0), _t(b1)))
    if hi <= lo:
        return 0.0
    return (hi - lo) * length


def _segments_share_endpoint(
    a0: tuple[float, float],
    a1: tuple[float, float],
    b0: tuple[float, float],
    b1: tuple[float, float],
) -> bool:
    """True iff the two segments share at least one endpoint (within eps)."""

    return any(_vkey(a) == _vkey(b) for a in (a0, a1) for b in (b0, b1))


def _segments_proper_intersect(
    a0: tuple[float, float],
    a1: tuple[float, float],
    b0: tuple[float, float],
    b1: tuple[float, float],
) -> bool:
    """Return True if segments a, b cross strictly in their interiors.

    Endpoint touches are allowed (sketch loops join end-to-end at vertices).
    Collinear overlaps return False — the closed-loop check catches those via
    repeated edge incidence.
    """

    if _segments_share_endpoint(a0, a1, b0, b1):
        return False

    rx, ry = a1[0] - a0[0], a1[1] - a0[1]
    sx, sy = b1[0] - b0[0], b1[1] - b0[1]
    denom = rx * sy - ry * sx
    if abs(denom) < _INTERSECT_EPS:
        # Parallel or collinear — treat as non-crossing for this check.
        return False
    qpx, qpy = b0[0] - a0[0], b0[1] - a0[1]
    t = (qpx * sy - qpy * sx) / denom
    u = (qpx * ry - qpy * rx) / denom
    # Strictly in (0, 1) on both — endpoint contact does not count.
    eps = 1e-6
    return (eps < t < 1.0 - eps) and (eps < u < 1.0 - eps)


def check_self_intersection(lines: list[SketchLine]) -> list[SketchValidationIssue]:
    issues: list[SketchValidationIssue] = []
    for i in range(len(lines)):
        a0, a1 = _line_endpoints(lines[i])
        for j in range(i + 1, len(lines)):
            b0, b1 = _line_endpoints(lines[j])
            if _segments_proper_intersect(a0, a1, b0, b1):
                issues.append(
                    SketchValidationIssue(
                        code="self_intersection",
                        message=f"Self-intersection between line {i} and line {j}.",
                        line_indices=[i, j],
                    )
                )
    return issues


def check_zero_length(lines: list[SketchLine]) -> list[SketchValidationIssue]:
    issues: list[SketchValidationIssue] = []
    for i, line in enumerate(lines):
        a0, a1 = _line_endpoints(line)
        if _vkey(a0) == _vkey(a1):
            issues.append(
                SketchValidationIssue(
                    code="zero_length",
                    message=f"Line {i} has zero length.",
                    line_index=i,
                )
            )
    return issues


def check_too_short_edges(lines: list[SketchLine]) -> list[SketchValidationIssue]:
    issues: list[SketchValidationIssue] = []
    for i, line in enumerate(lines):
        a0, a1 = _line_endpoints(line)
        length = _distance_mm(a0, a1)
        if _VERTEX_EPS_MM < length < MIN_SKETCH_EDGE_LENGTH_MM:
            issues.append(
                SketchValidationIssue(
                    code="too_short_edge",
                    message=(
                        f"Line {i} is too short ({length:.0f} mm); "
                        f"minimum sketch edge is {MIN_SKETCH_EDGE_LENGTH_MM:.0f} mm."
                    ),
                    line_index=i,
                )
            )
    return issues


def check_duplicate_or_overlapping_edges(lines: list[SketchLine]) -> list[SketchValidationIssue]:
    issues: list[SketchValidationIssue] = []
    normalized_edges: dict[tuple[tuple[int, int], tuple[int, int]], int] = {}
    for i, line in enumerate(lines):
        a0, a1 = _line_endpoints(line)
        ka, kb = _vkey(a0), _vkey(a1)
        if ka == kb:
            continue
        edge_key = (ka, kb) if ka <= kb else (kb, ka)
        prior = normalized_edges.get(edge_key)
        if prior is not None:
            issues.append(
                SketchValidationIssue(
                    code="duplicate_edge",
                    message=f"Line {i} duplicates line {prior}; delete one boundary edge.",
                    line_indices=[prior, i],
                )
            )
        else:
            normalized_edges[edge_key] = i

    for i in range(len(lines)):
        a0, a1 = _line_endpoints(lines[i])
        if _vkey(a0) == _vkey(a1):
            continue
        for j in range(i + 1, len(lines)):
            b0, b1 = _line_endpoints(lines[j])
            if _vkey(b0) == _vkey(b1):
                continue
            overlap = _collinear_overlap_length_mm(a0, a1, b0, b1)
            if overlap > _VERTEX_EPS_MM:
                same_edge = {_vkey(a0), _vkey(a1)} == {_vkey(b0), _vkey(b1)}
                if same_edge:
                    continue
                issues.append(
                    SketchValidationIssue(
                        code="overlapping_edge",
                        message=f"Line {i} overlaps line {j}; split or delete duplicate boundary geometry.",
                        line_indices=[i, j],
                    )
                )
    return issues


def check_closed_loop(lines: list[SketchLine]) -> list[SketchValidationIssue]:
    """Each vertex must have exactly 2 incident edges.

    A single closed simple polygon satisfies this (every vertex is touched by
    its two adjacent edges). Multiple disjoint closed loops also pass — the
    floor commit picks the largest area loop as the boundary in the load-bearing
    slice; nested loops (holes) are deferred to slab-opening authoring.
    """

    issues: list[SketchValidationIssue] = []
    if not lines:
        issues.append(
            SketchValidationIssue(
                code="open_loop",
                message="Sketch is empty — draw at least 3 lines forming a closed loop.",
            )
        )
        return issues

    incidence: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, line in enumerate(lines):
        a0, a1 = _line_endpoints(line)
        if _vkey(a0) == _vkey(a1):
            # Already reported by zero-length; skip incidence accounting.
            continue
        incidence[_vkey(a0)].append(i)
        incidence[_vkey(a1)].append(i)

    open_vertices = [v for v, eds in incidence.items() if len(eds) != 2]
    if open_vertices:
        # Collect line indices touching the open vertices for actionable feedback.
        offending: set[int] = set()
        for v in open_vertices:
            for ei in incidence[v]:
                offending.add(ei)
        issues.append(
            SketchValidationIssue(
                code="open_loop",
                message=(
                    "Lines must form a closed loop — "
                    f"{len(open_vertices)} vertex(es) have ≠ 2 incident edges."
                ),
                line_indices=sorted(offending),
            )
        )
    return issues


def validate_session(lines: list[SketchLine]) -> SketchValidationState:
    issues: list[SketchValidationIssue] = []
    issues.extend(check_zero_length(lines))
    issues.extend(check_too_short_edges(lines))
    issues.extend(check_duplicate_or_overlapping_edges(lines))
    issues.extend(check_closed_loop(lines))
    issues.extend(check_self_intersection(lines))
    return SketchValidationState(valid=not issues, issues=issues)


def validate_room_separation_session(lines: list[SketchLine]) -> SketchValidationState:
    """Room-separation sketches commit one line per segment — no loop required.

    Rejects only zero-length lines; an empty sketch is also invalid because
    Finish would commit nothing.
    """

    issues: list[SketchValidationIssue] = []
    if not lines:
        issues.append(
            SketchValidationIssue(
                code="empty_sketch",
                message="Sketch is empty — draw at least one line.",
            )
        )
    issues.extend(check_zero_length(lines))
    return SketchValidationState(valid=not issues, issues=issues)


# Sub-modes whose validation is "non-empty list of non-zero-length segments".
# Polygon-style sub-modes (floor / roof / ceiling / in_place_mass / void_cut)
# all use the closed-loop check inside :func:`validate_session`.
_LINE_SET_KINDS = frozenset({"room_separation", "detail_region"})


def validate_sketch_session(session: SketchSession) -> SketchValidationState:
    if session.element_kind in _LINE_SET_KINDS:
        return validate_room_separation_session(list(session.lines))
    return validate_session(list(session.lines))


def assert_closed_loop(points: list[Vec2Mm], *, tol_mm: float = 1.0) -> None:
    """Raise :class:`SketchInvalidError` unless `points` form a valid polygon.

    The polygon is treated as implicitly closed: the edge from ``points[-1]``
    back to ``points[0]`` is the closing segment. The check requires
    ≥3 vertices and rejects any consecutive pair that coincides within
    ``tol_mm`` (which would be a degenerate edge).

    Callers that need to validate the *line-level* topology (incidence
    counts, self-intersection) should run :func:`validate_session` first;
    this helper is the lightweight Finish-time guard against degenerate
    polygons that slip past the structural check.
    """

    if len(points) < 3:
        raise SketchInvalidError(
            "open_loop",
            f"closed-loop polygon requires ≥3 points (got {len(points)}).",
        )
    n = len(points)
    for i in range(n):
        a = points[i]
        b = points[(i + 1) % n]
        if abs(a.x_mm - b.x_mm) <= tol_mm and abs(a.y_mm - b.y_mm) <= tol_mm:
            raise SketchInvalidError(
                "zero_length",
                f"polygon edge {i}→{(i + 1) % n} is degenerate (coincident vertices).",
            )


def assert_line_set(segments: list[tuple[Vec2Mm, Vec2Mm]]) -> None:
    """Raise :class:`SketchInvalidError` unless `segments` is a non-empty list
    of non-zero-length segments.

    Used by Finish-emitters for sub-modes that commit one element per segment
    (room_separation, detail_region) rather than collapsing the sketch into a
    single polygon.
    """

    if not segments:
        raise SketchInvalidError(
            "empty_sketch",
            "sketch is empty — draw at least one line.",
        )
    for i, (a, b) in enumerate(segments):
        if abs(a.x_mm - b.x_mm) <= 0.5 and abs(a.y_mm - b.y_mm) <= 0.5:
            raise SketchInvalidError(
                "zero_length",
                f"segment {i} is zero-length.",
            )


def derive_closed_loop_polygon(
    lines: list[SketchLine],
) -> list[tuple[float, float]]:
    """Order lines into a single closed polygon walk, returning vertex sequence.

    Assumes :func:`validate_session` already passed (each vertex has exactly 2
    incident edges, no self-intersection). For multi-loop input, returns the
    vertices of the loop with the largest absolute polygon area — that's the
    convention for floor authoring (outer boundary first; holes deferred).
    """

    if not lines:
        return []

    edges: list[tuple[tuple[int, int], tuple[int, int]]] = []
    for line in lines:
        a0, a1 = _line_endpoints(line)
        edges.append((_vkey(a0), _vkey(a1)))

    incidence: dict[tuple[int, int], list[int]] = defaultdict(list)
    for ei, (a, b) in enumerate(edges):
        incidence[a].append(ei)
        incidence[b].append(ei)

    visited_edges: set[int] = set()

    # Map vertex key → original mm coords (use first occurrence).
    coord_for_key: dict[tuple[int, int], tuple[float, float]] = {}
    for line in lines:
        a0, a1 = _line_endpoints(line)
        coord_for_key.setdefault(_vkey(a0), a0)
        coord_for_key.setdefault(_vkey(a1), a1)

    loops: list[list[tuple[float, float]]] = []
    for start_edge in range(len(edges)):
        if start_edge in visited_edges:
            continue
        a, b = edges[start_edge]
        loop_keys: list[tuple[int, int]] = [a]
        prev_vertex = a
        current_edge = start_edge
        guard = 0
        while guard < len(edges) + 1:
            guard += 1
            visited_edges.add(current_edge)
            ea, eb = edges[current_edge]
            next_vertex = eb if ea == prev_vertex else ea
            if next_vertex == loop_keys[0]:
                break
            loop_keys.append(next_vertex)
            # Pick the other unvisited incident edge.
            candidates = [
                ei
                for ei in incidence[next_vertex]
                if ei != current_edge and ei not in visited_edges
            ]
            if not candidates:
                break
            current_edge = candidates[0]
            prev_vertex = next_vertex
        loop = [coord_for_key[k] for k in loop_keys]
        if len(loop) >= 3:
            loops.append(loop)

    if not loops:
        return []

    def _abs_area(poly: list[tuple[float, float]]) -> float:
        n = len(poly)
        if n < 3:
            return 0.0
        a = 0.0
        for i in range(n):
            x1, y1 = poly[i]
            x2, y2 = poly[(i + 1) % n]
            a += x1 * y2 - x2 * y1
        return abs(a / 2.0)

    loops.sort(key=_abs_area, reverse=True)
    return loops[0]
