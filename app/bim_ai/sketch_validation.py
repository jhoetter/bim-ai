"""SKT-01 validation — closed-loop, self-intersection, planarity (floor slice).

For the floor element kind, "planar" means lines lie on the level's z=0 plane.
Since :class:`SketchLine` carries 2D `Vec2Mm` endpoints in level-local space,
planarity is automatic — every line is on z=0 by construction. The check is
preserved here as an explicit predicate so future element kinds (e.g. void cuts
on a host wall face) can override the work plane without rewriting validation.
"""

from __future__ import annotations

from collections import defaultdict

from bim_ai.sketch_session import (
    SketchLine,
    SketchSession,
    SketchValidationIssue,
    SketchValidationState,
)

# Vertex coincidence tolerance — sub-millimetre; matches typical Revit snap.
_VERTEX_EPS_MM = 0.5
# Numerical tolerance for segment-pair intersection tests.
_INTERSECT_EPS = 1e-7


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


def validate_sketch_session(session: SketchSession) -> SketchValidationState:
    if session.element_kind == "room_separation":
        return validate_room_separation_session(list(session.lines))
    return validate_session(list(session.lines))


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
