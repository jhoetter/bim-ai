"""Authoritative slice: deterministic axis-aligned rectangles from orthogonal walls ± separators."""

from __future__ import annotations

import hashlib
import json
import math
from collections import OrderedDict, defaultdict
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
from typing import Any, Literal

from bim_ai.document import Document
from bim_ai.elements import LevelElem, ProjectSettingsElem, RoomElem, RoomSeparationElem, WallElem
from bim_ai.plan_aa_room_separation import axis_aligned_room_separation_splits_rectangle

BOUNDARY_SEGMENT_VERSION_V1 = "boundary_segment_v1"
_ROOM_BOUNDARY_REQUEST_CACHE: ContextVar[
    dict[tuple[int, tuple[str, ...]], dict[str, Any]] | None
] = ContextVar("room_boundary_request_cache", default=None)

# PERF-C05: cross-request room-boundary cache. Keyed on a content
# fingerprint derived from the Document itself — revision, element
# count, sorted ids — so multiple requests for the same model revision
# (validate, evidence, snapshot warmups) share one derivation.
# Stored bundles are deep-copied on store + read so cached entries
# remain immutable while callers (room-derivation-preview, schedule,
# plan-projection) may freely splice rows into them.
_ROOM_BOUNDARY_DOC_CACHE_MAX = 32
_ROOM_BOUNDARY_DOC_CACHE: OrderedDict[
    tuple[int, int, tuple[str, ...]], dict[str, Any]
] = OrderedDict()

# PERF-C06: per-level slice cache. Keyed on
# `(level_id, level_element_fingerprint, global_settings_digest)` so
# editing a wall on level B leaves level A's cached slice (candidates,
# diagnostics, warnings, unbounded room ids for that level) untouched.
# When the doc-level cache misses we still run the whole-document
# uncached pass (the inner enumeration is per-level already, so the
# blast radius of a single-level mutation is small), but we recover
# level-A's slice from this layer and splice the recomputed level-B
# slice in — preserving the object identity of unchanged levels'
# entries across mutations.
_ROOM_BOUNDARY_LEVEL_CACHE_MAX = 128
_LevelCacheKey = tuple[str, str, str]
_ROOM_BOUNDARY_LEVEL_CACHE: OrderedDict[_LevelCacheKey, dict[str, Any]] = OrderedDict()


def _room_boundary_doc_cache_key(doc: Document) -> tuple[int, int, tuple[str, ...]]:
    return (doc.revision, len(doc.elements), tuple(doc.elements.keys()))


def reset_room_boundary_doc_cache() -> None:
    """Test-only hook. Production code should never need to clear the cache —
    new revisions land as new keys; old keys age out via the LRU bound."""

    _ROOM_BOUNDARY_DOC_CACHE.clear()
    _ROOM_BOUNDARY_LEVEL_CACHE.clear()


def reset_room_boundary_level_cache() -> None:
    """Test-only hook for the PERF-C06 per-level cache layer.

    `reset_room_boundary_doc_cache` already clears both layers; this is
    a focused entry point for tests that want to assert the cross-level
    invalidation behavior independent of the document-level LRU.
    """

    _ROOM_BOUNDARY_LEVEL_CACHE.clear()


# Wire shape (kept verbatim — no fields added or removed):
_LEVEL_PARTITIONED_KEYS = (
    "axisAlignedRectangleCandidates",
    "diagnostics",
    "warnings",
)


def _global_settings_digest(doc: Document) -> str:
    """Fingerprint of inputs that affect every level's derivation result.

    Covers project settings (area/volume basis) and the level table
    itself (elevations drive room volume height; level names appear in
    candidate output). Changes here invalidate every per-level slice.
    """

    proj_settings = next(
        (e for e in doc.elements.values() if isinstance(e, ProjectSettingsElem)),
        None,
    )
    settings_part: dict[str, Any]
    if proj_settings is None:
        settings_part = {"basis": "wall_finish", "volume": "finish_faces"}
    else:
        settings_part = {
            "basis": proj_settings.room_area_computation_basis,
            "volume": proj_settings.volume_computed_at,
        }

    levels: list[dict[str, Any]] = []
    for ent in doc.elements.values():
        if isinstance(ent, LevelElem):
            levels.append(
                {
                    "id": ent.id,
                    "name": ent.name or ent.id,
                    "elevationMm": float(ent.elevation_mm),
                }
            )
    levels.sort(key=lambda d: d["id"])

    body = json.dumps(
        {"levels": levels, "settings": settings_part},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _level_input_fingerprints(doc: Document) -> dict[str, str]:
    """Per-level fingerprint of the elements that drive that level's slice.

    Includes walls + room separations (boundary inputs) and rooms
    (authored-room overlap check + unbounded-room detection). Two
    fingerprints match iff the inputs that determine the slice are
    bitwise identical, so an unchanged key implies an unchanged slice.
    """

    by_level: defaultdict[str, list[tuple[str, str, Any]]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, WallElem):
            by_level[ent.level_id].append(
                (
                    "wall",
                    ent.id,
                    {
                        "sx": float(ent.start.x_mm),
                        "sy": float(ent.start.y_mm),
                        "ex": float(ent.end.x_mm),
                        "ey": float(ent.end.y_mm),
                        "t": float(ent.thickness_mm),
                    },
                )
            )
        elif isinstance(ent, RoomSeparationElem):
            by_level[ent.level_id].append(
                (
                    "sep",
                    ent.id,
                    {
                        "sx": float(ent.start.x_mm),
                        "sy": float(ent.start.y_mm),
                        "ex": float(ent.end.x_mm),
                        "ey": float(ent.end.y_mm),
                    },
                )
            )
        elif isinstance(ent, RoomElem):
            outline = [
                {"x": float(p.x_mm), "y": float(p.y_mm)} for p in ent.outline_mm
            ]
            by_level[ent.level_id].append(("room", ent.id, {"outline": outline}))

    fingerprints: dict[str, str] = {}
    for lid, items in by_level.items():
        items.sort(key=lambda t: (t[0], t[1]))
        body = json.dumps(items, sort_keys=True, separators=(",", ":"))
        fingerprints[lid] = hashlib.sha256(body.encode()).hexdigest()[:16]
    return fingerprints


def _partition_bundle_by_level(
    bundle: dict[str, Any], doc: Document
) -> dict[str, dict[str, Any]]:
    """Split a fully-computed bundle into per-level slices.

    The wire shape is unchanged; we only group existing rows so we can
    later swap unchanged levels' slices in by reference.
    """

    room_level_by_id: dict[str, str] = {
        e.id: e.level_id for e in doc.elements.values() if isinstance(e, RoomElem)
    }

    slices: defaultdict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "axisAlignedRectangleCandidates": [],
            "diagnostics": [],
            "warnings": [],
            "unboundedRoomIds": [],
        }
    )

    for key in _LEVEL_PARTITIONED_KEYS:
        for row in bundle.get(key) or []:
            if not isinstance(row, dict):
                continue
            lid = str(row.get("levelId") or "")
            slices[lid][key].append(row)

    for rid in bundle.get("unboundedRoomIds") or []:
        lid = room_level_by_id.get(str(rid), "")
        slices[lid]["unboundedRoomIds"].append(str(rid))

    return dict(slices)


def _empty_level_slice() -> dict[str, Any]:
    return {
        "axisAlignedRectangleCandidates": [],
        "diagnostics": [],
        "warnings": [],
        "unboundedRoomIds": [],
    }


def _assemble_bundle_from_level_slices(
    level_slices: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Inverse of `_partition_bundle_by_level`.

    Reassembles the wire-format bundle by concatenating per-level
    slices. Sort orders match `_compute_room_boundary_derivation_uncached`
    so the returned shape is bit-identical to the uncached path.
    """

    # `_compute_room_boundary_derivation_uncached` emits rows grouped by
    # `levelId` (candidates and warnings flow from `dedup` sorted by `_sig`,
    # which keys on levelId first; diagnostics are explicitly sorted by
    # levelId). Concatenating per-level slices in sorted-levelId order
    # therefore reproduces the original wire ordering exactly, even when
    # individual slices were captured at different points in time.
    candidates: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    unbounded: list[str] = []
    for lid in sorted(level_slices.keys()):
        sl = level_slices[lid]
        candidates.extend(sl.get("axisAlignedRectangleCandidates") or [])
        diagnostics.extend(sl.get("diagnostics") or [])
        warnings.extend(sl.get("warnings") or [])
        unbounded.extend(sl.get("unboundedRoomIds") or [])

    auth_count = sum(
        1 for ec in candidates if ec.get("derivationAuthority") == "authoritative"
    )
    return {
        "heuristicVersion": HEURISTIC_VERSION,
        "axisAlignedRectangleCandidates": candidates,
        "candidateCount": len(candidates),
        "authoritativeCandidateCount": auth_count,
        "unboundedRoomIds": sorted(unbounded),
        "diagnostics": diagnostics,
        "warnings": warnings,
    }

# Shared with preview (orthogonal snap / closure tests)
_SNAP_MM = 50.0


def snap_mm(mm: float) -> float:
    return round(mm / _SNAP_MM) * _SNAP_MM


def aa_rect_intersection_area_m2(
    ax0: float, ay0: float, ax1: float, ay1: float, bx0: float, by0: float, bx1: float, by1: float
) -> float:
    ix0 = max(min(ax0, ax1), min(bx0, bx1))
    iy0 = max(min(ay0, ay1), min(by0, by1))
    ix1 = min(max(ax0, ax1), max(bx0, bx1))
    iy1 = min(max(ay0, ay1), max(by0, by1))
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) / 1000.0 * (iy1 - iy0) / 1000.0


def outline_aa_bbox_mm(rm: RoomElem) -> dict[str, dict[str, float]] | None:
    pts = [(p.x_mm, p.y_mm) for p in rm.outline_mm]
    if len(pts) < 3:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return {
        "min": {"x": float(min(xs)), "y": float(min(ys))},
        "max": {"x": float(max(xs)), "y": float(max(ys))},
    }


# Segment: kind 'h'|'v', canonical coordinate, extent min, extent max, element_id, boundary_kind
BoundaryKind = Literal["wall", "room_separation"]
AxisSeg = tuple[str, float, float, float, str, BoundaryKind]


def axis_aligned_wall_segment(w: WallElem) -> AxisSeg | None:
    x0, y0 = w.start.x_mm, w.start.y_mm
    x1, y1 = w.end.x_mm, w.end.y_mm
    if math.hypot(x1 - x0, y1 - y0) < 80.0:
        return None
    if abs(x0 - x1) < 25.0:
        return (
            "v",
            snap_mm((x0 + x1) / 2.0),
            snap_mm(min(y0, y1)),
            snap_mm(max(y0, y1)),
            w.id,
            "wall",
        )
    if abs(y0 - y1) < 25.0:
        return (
            "h",
            snap_mm((y0 + y1) / 2.0),
            snap_mm(min(x0, x1)),
            snap_mm(max(x0, x1)),
            w.id,
            "wall",
        )
    return None


def axis_aligned_room_separation_segment(r: RoomSeparationElem) -> AxisSeg | None:
    x0, y0 = r.start.x_mm, r.start.y_mm
    x1, y1 = r.end.x_mm, r.end.y_mm
    if math.hypot(x1 - x0, y1 - y0) < 80.0:
        return None
    if abs(x0 - x1) < 25.0:
        return (
            "v",
            snap_mm((x0 + x1) / 2.0),
            snap_mm(min(y0, y1)),
            snap_mm(max(y0, y1)),
            r.id,
            "room_separation",
        )
    if abs(y0 - y1) < 25.0:
        return (
            "h",
            snap_mm((y0 + y1) / 2.0),
            snap_mm(min(x0, x1)),
            snap_mm(max(x0, x1)),
            r.id,
            "room_separation",
        )
    return None


def room_separation_axis_segment_meta(r: RoomSeparationElem) -> tuple[bool, str | None]:
    """Axis-aligned pool eligibility and exclusion reason (matches axis_aligned_room_separation_segment)."""
    if axis_aligned_room_separation_segment(r) is not None:
        return True, None
    x0, y0 = r.start.x_mm, r.start.y_mm
    x1, y1 = r.end.x_mm, r.end.y_mm
    if math.hypot(x1 - x0, y1 - y0) < 80.0:
        return False, "too_short"
    return False, "non_axis_aligned"


def room_separation_derived_bundle_sets(bundle: dict[str, Any]) -> tuple[set[str], set[str]]:
    """Authoritative perimeter separation ids and ids that pierce a derived rectangle interior."""
    auth_perim: set[str] = set()
    for c in bundle.get("axisAlignedRectangleCandidates") or []:
        if not isinstance(c, dict):
            continue
        if c.get("derivationAuthority") != "authoritative":
            continue
        for sid in c.get("boundarySeparationIds") or []:
            auth_perim.add(str(sid))

    interior: set[str] = set()
    for w in bundle.get("warnings") or []:
        if not isinstance(w, dict):
            continue
        if w.get("code") != "derivedRectangleInteriorRoomSeparation":
            continue
        for sid in w.get("separationIds") or []:
            interior.add(str(sid))
    for d in bundle.get("diagnostics") or []:
        if not isinstance(d, dict):
            continue
        if d.get("code") != "ambiguous_interior_separation":
            continue
        for sid in d.get("separationIds") or []:
            interior.add(str(sid))
    return auth_perim, interior


def room_separation_plan_wire_row_fields_by_id(
    doc: Document, bundle: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    """Per room_separation element id: derivation flags for plan wire primitives."""
    auth_perim, interior = room_separation_derived_bundle_sets(bundle)
    out: dict[str, dict[str, Any]] = {}
    for e in doc.elements.values():
        if not isinstance(e, RoomSeparationElem):
            continue
        eligible, reason = room_separation_axis_segment_meta(e)
        out[e.id] = {
            "axisAlignedBoundarySegmentEligible": eligible,
            "axisBoundarySegmentExcludedReason": reason,
            "onAuthoritativeDerivedFootprintBoundary": e.id in auth_perim,
            "piercesDerivedRectangleInterior": e.id in interior,
        }
    return out


def room_separation_axis_summary_v0_payload(
    doc: Document, bundle: dict[str, Any]
) -> dict[str, Any]:
    """Compact counts for room schedule closure (roomProgrammeClosure_v0)."""
    auth_perim, interior = room_separation_derived_bundle_sets(bundle)
    seps = [e for e in doc.elements.values() if isinstance(e, RoomSeparationElem)]
    sep_ids = {e.id for e in seps}
    elig = sum(1 for e in seps if axis_aligned_room_separation_segment(e) is not None)
    total = len(seps)
    return {
        "format": "roomSeparationAxisSummary_v0",
        "totalCount": total,
        "axisAlignedEligibleCount": elig,
        "nonAxisAlignedOrShortCount": max(0, total - elig),
        "onAuthoritativePerimeterCount": len(auth_perim & sep_ids),
        "interiorPierceCount": len(interior & sep_ids),
    }


def _corner_candidates(
    hsegs: list[AxisSeg],
    vsegs: list[AxisSeg],
) -> Iterator[tuple[tuple[AxisSeg, AxisSeg], tuple[AxisSeg, AxisSeg]]]:
    """PERF-CQ-01: pre-index horizontal/vertical segments by canonical
    coordinate and yield only ``(h_pair, v_pair)`` quads that close a
    rectangle.

    The legacy enumeration in :func:`_compute_room_boundary_derivation_uncached`
    walked ``combinations(hsegs, 2) × combinations(vsegs, 2)`` and let
    :func:`quad_closes_rectangle` reject the vast majority. On the
    ``room_stress`` fixture that fired ~3M closure tests; this index
    narrows the iteration to quads that actually pass closure.

    Algorithm:

      1. Bucket h-segs by canonical Y, v-segs by canonical X.
      2. For each (y_lo < y_hi) × (x_lo < x_hi) candidate rectangle,
         collect ``H_lo``, ``H_hi``, ``V_lo``, ``V_hi`` — the segs at
         each edge whose extent spans the rectangle within
         ``tol = _SNAP_MM * 1.4``.
      3. Emit every ``(h_pair, v_pair)`` such that h-pair ∈
         ``combinations(H_lo ∪ H_hi, 2)`` and v-pair ∈
         ``combinations(V_lo ∪ V_hi, 2)``, **filtered** to combos that
         close the rectangle.

    Closure constraint (matches the existing
    :func:`quad_closes_rectangle` semantics): the 8 endpoints reduce to
    exactly 4 corner points iff EITHER the h-pair contains one seg from
    each of ``H_lo`` and ``H_hi`` (so the h-pair spans both y-lines)
    OR the v-pair contains one seg from each of ``V_lo`` and ``V_hi``
    (so the v-pair spans both x-lines). When neither holds, the 4 segs
    cover at most 3 of the 4 corners and the quad fails closure — so
    we skip these combinations rather than discovering the failure
    inside the closure test.

    Candidate-rectangle xs/ys are sourced from the v-x and h-y buckets
    respectively. h-seg endpoint xs are guaranteed to align with v-x
    bucket keys whenever a closing quad exists — the closure check in
    :func:`quad_closes_rectangle` requires each h-seg endpoint to
    coincide with ``x_lo`` / ``x_hi`` within ``tol``, and every coord
    upstream of the helper is already snapped via
    :func:`axis_aligned_wall_segment` /
    :func:`axis_aligned_room_separation_segment`.
    """

    if len(hsegs) < 2 or len(vsegs) < 2:
        return

    tol = _SNAP_MM * 1.4

    h_by_y: defaultdict[float, list[AxisSeg]] = defaultdict(list)
    for h in hsegs:
        h_by_y[h[1]].append(h)
    v_by_x: defaultdict[float, list[AxisSeg]] = defaultdict(list)
    for v in vsegs:
        v_by_x[v[1]].append(v)

    ys = sorted(h_by_y.keys())
    xs = sorted(v_by_x.keys())
    if len(ys) < 2 or len(xs) < 2:
        return

    for i in range(len(ys)):
        y_lo = ys[i]
        h_lo_bucket = h_by_y[y_lo]
        for j in range(i + 1, len(ys)):
            y_hi = ys[j]
            h_hi_bucket = h_by_y[y_hi]

            for ki in range(len(xs)):
                x_lo = xs[ki]
                v_lo_bucket_full = v_by_x[x_lo]
                v_lo_matches = [
                    v
                    for v in v_lo_bucket_full
                    if abs(v[2] - y_lo) <= tol and abs(v[3] - y_hi) <= tol
                ]

                for kj in range(ki + 1, len(xs)):
                    x_hi = xs[kj]

                    h_lo_matches = [
                        h
                        for h in h_lo_bucket
                        if abs(h[2] - x_lo) <= tol and abs(h[3] - x_hi) <= tol
                    ]
                    h_hi_matches = [
                        h
                        for h in h_hi_bucket
                        if abs(h[2] - x_lo) <= tol and abs(h[3] - x_hi) <= tol
                    ]
                    v_hi_bucket_full = v_by_x[x_hi]
                    v_hi_matches = [
                        v
                        for v in v_hi_bucket_full
                        if abs(v[2] - y_lo) <= tol and abs(v[3] - y_hi) <= tol
                    ]

                    h_lo_n = len(h_lo_matches)
                    h_hi_n = len(h_hi_matches)
                    v_lo_n = len(v_lo_matches)
                    v_hi_n = len(v_hi_matches)
                    h_total = h_lo_n + h_hi_n
                    v_total = v_lo_n + v_hi_n
                    if h_total < 2 or v_total < 2:
                        continue

                    case_a = h_lo_n >= 1 and h_hi_n >= 1
                    case_b = v_lo_n >= 1 and v_hi_n >= 1
                    if not (case_a or case_b):
                        continue

                    # Decompose the emission by "h-pair spans both
                    # y-lines" (cross) vs "h-pair is in only one y
                    # bucket" (same-y), and the v-pair mirror. Closure
                    # requires that AT LEAST ONE of the pairs is
                    # "cross". This decomposition skips the degenerate
                    # (same-y, same-x) quad that would otherwise be
                    # emitted and rejected by `quad_closes_rectangle`
                    # for collapsing to 3 unique corner points.

                    # 1) h-pair cross × v-pair anything.
                    if case_a:
                        for h_lo in h_lo_matches:
                            for h_hi in h_hi_matches:
                                h_pair = (h_lo, h_hi)
                                # v-pair cross (one V_lo + one V_hi)
                                if case_b:
                                    for v_lo in v_lo_matches:
                                        for v_hi in v_hi_matches:
                                            yield h_pair, (v_lo, v_hi)
                                # v-pair both V_lo
                                if v_lo_n >= 2:
                                    for vi_a in range(v_lo_n):
                                        for vi_b in range(vi_a + 1, v_lo_n):
                                            yield h_pair, (
                                                v_lo_matches[vi_a],
                                                v_lo_matches[vi_b],
                                            )
                                # v-pair both V_hi
                                if v_hi_n >= 2:
                                    for vi_a in range(v_hi_n):
                                        for vi_b in range(vi_a + 1, v_hi_n):
                                            yield h_pair, (
                                                v_hi_matches[vi_a],
                                                v_hi_matches[vi_b],
                                            )

                    # 2) h-pair same-y × v-pair cross. (h-pair cross
                    # was handled in branch 1 above; emit only the
                    # cases where h-pair is single-line and the v-pair
                    # supplies both x-lines.)
                    if case_b:
                        # h-pair both H_lo
                        if h_lo_n >= 2:
                            for hi_a in range(h_lo_n):
                                for hi_b in range(hi_a + 1, h_lo_n):
                                    h_pair = (h_lo_matches[hi_a], h_lo_matches[hi_b])
                                    for v_lo in v_lo_matches:
                                        for v_hi in v_hi_matches:
                                            yield h_pair, (v_lo, v_hi)
                        # h-pair both H_hi
                        if h_hi_n >= 2:
                            for hi_a in range(h_hi_n):
                                for hi_b in range(hi_a + 1, h_hi_n):
                                    h_pair = (h_hi_matches[hi_a], h_hi_matches[hi_b])
                                    for v_lo in v_lo_matches:
                                        for v_hi in v_hi_matches:
                                            yield h_pair, (v_lo, v_hi)


def quad_closes_rectangle(
    segs: tuple[AxisSeg, AxisSeg, AxisSeg, AxisSeg],
) -> dict[str, Any] | None:
    plain = tuple(
        # legacy quad format: (kind, c0, mn, mx, id)
        (s[0], s[1], s[2], s[3], s[4])
        for s in segs
    )
    if len(plain) != 4:
        return None
    kinds = {s[0] for s in plain}
    if kinds != {"h", "v"}:
        return None

    pts: list[tuple[float, float]] = []
    for s in plain:
        kind = s[0]
        if kind == "h":
            _, y, xa, xb, _wid = s
            pts.append((xa, y))
            pts.append((xb, y))
        else:
            _, x, ya, yb, _wid = s
            pts.append((x, ya))
            pts.append((x, yb))

    # PERF-C07: `pts` come from AxisSeg tuples produced by
    # `axis_aligned_wall_segment` / `axis_aligned_room_separation_segment`,
    # which already snap every coordinate to the grid before storing them.
    # Re-snapping here was a measured share of the room_stress hot path —
    # the audit profile recorded ~48.6M `snap_mm` calls under profiling, of
    # which 8 per `quad_closes_rectangle` call lived in this loop.
    uniq: set[tuple[float, float]] = set(pts)
    if len(uniq) != 4:
        return None

    xs = {p[0] for p in uniq}
    ys = {p[1] for p in uniq}
    if len(xs) != 2 or len(ys) != 2:
        return None
    x_lo, x_hi = min(xs), max(xs)
    y_lo, y_hi = min(ys), max(ys)
    tol = _SNAP_MM * 1.4
    for s in plain:
        if s[0] == "h":
            _k, y, xa, xb, _wid = s
            if min(abs(y - y_lo), abs(y - y_hi)) > tol:
                return None
            if abs(min(xa, xb) - x_lo) > tol or abs(max(xa, xb) - x_hi) > tol:
                return None
        else:
            _k, x, ya, yb, _wid = s
            if min(abs(x - x_lo), abs(x - x_hi)) > tol:
                return None
            if abs(min(ya, yb) - y_lo) > tol or abs(max(ya, yb) - y_hi) > tol:
                return None

    area_m2 = max(0.0, (x_hi - x_lo) / 1000.0) * max(0.0, (y_hi - y_lo) / 1000.0)
    wall_ids = sorted({s[4] for s in segs if s[5] == "wall"})
    sep_ids = sorted({s[4] for s in segs if s[5] == "room_separation"})
    perimeter_ids_sorted = tuple(sorted(s[4] for s in segs))
    return {
        "kind": "axis_aligned_rectangle",
        "levelPlane": "bim_xy_mm",
        "bboxMm": {"min": {"x": x_lo, "y": y_lo}, "max": {"x": x_hi, "y": y_hi}},
        "wallIds": wall_ids,
        "boundarySeparationIds": sep_ids,
        "perimeterSegmentIdsSorted": perimeter_ids_sorted,
        "boundarySegmentEncoding": BOUNDARY_SEGMENT_VERSION_V1,
        "approxAreaM2": round(area_m2, 4),
        "note": (
            "Axis-aligned orthogonal loop from wall and/or axis-aligned room separation segments; "
            "authoritative derivation when interior is unambiguous and does not intersect authored outlines."
        ),
    }


def separation_ids_splitting_candidate_bbox(
    doc: Document,
    *,
    level_id: str,
    bbox: dict[str, Any],
) -> list[str]:
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    bx_lo = float(mn.get("x") or 0)
    by_lo = float(mn.get("y") or 0)
    bx_hi = float(mx.get("x") or 0)
    by_hi = float(mx.get("y") or 0)
    if bx_hi <= bx_lo or by_hi <= by_lo:
        return []
    found: list[str] = []
    for ent in doc.elements.values():
        if not isinstance(ent, RoomSeparationElem):
            continue
        if ent.level_id != level_id:
            continue
        if axis_aligned_room_separation_splits_rectangle(
            ent.start.x_mm,
            ent.start.y_mm,
            ent.end.x_mm,
            ent.end.y_mm,
            bx_lo,
            bx_hi,
            by_lo,
            by_hi,
        ):
            found.append(ent.id)
    return sorted(found)


def authored_room_overlaps_candidate_bbox(rooms: list[RoomElem], cand_bbox: dict[str, Any]) -> bool:
    mn = cand_bbox.get("min") or {}
    mx = cand_bbox.get("max") or {}
    cx0 = float(mn.get("x") or 0)
    cy0 = float(mn.get("y") or 0)
    cx1 = float(mx.get("x") or 0)
    cy1 = float(mx.get("y") or 0)
    if cx1 <= cx0 or cy1 <= cy0:
        return False
    for rm in rooms:
        bb = outline_aa_bbox_mm(rm)
        if bb is None:
            continue
        mn_r = bb["min"]
        mx_r = bb["max"]
        rx0 = float(mn_r["x"])
        ry0 = float(mn_r["y"])
        rx1 = float(mx_r["x"])
        ry1 = float(mx_r["y"])
        if rx1 <= rx0 or ry1 <= ry0:
            continue
        if aa_rect_intersection_area_m2(cx0, cy0, cx1, cy1, rx0, ry0, rx1, ry1) > 1e-12:
            return True
    return False


def _segment_signature(seg: AxisSeg) -> tuple:
    return (seg[0], round(seg[1], 8), round(seg[2], 8), round(seg[3], 8), seg[4], seg[5])


def collect_axis_aligned_boundary_segments(doc: Document) -> dict[str, list[AxisSeg]]:
    segments_by_level: defaultdict[str, list[AxisSeg]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, WallElem):
            s = axis_aligned_wall_segment(ent)
            if s:
                segments_by_level[ent.level_id].append(s)
        elif isinstance(ent, RoomSeparationElem):
            s = axis_aligned_room_separation_segment(ent)
            if s:
                segments_by_level[ent.level_id].append(s)
    for lid in segments_by_level:
        segments_by_level[lid].sort(key=_segment_signature)
    return dict(segments_by_level)


def _wall_or_sep_long_enough_for_boundary(ent: WallElem | RoomSeparationElem) -> bool:
    if isinstance(ent, WallElem):
        x0, y0 = ent.start.x_mm, ent.start.y_mm
        x1, y1 = ent.end.x_mm, ent.end.y_mm
    else:
        x0, y0 = ent.start.x_mm, ent.start.y_mm
        x1, y1 = ent.end.x_mm, ent.end.y_mm
    return math.hypot(x1 - x0, y1 - y0) >= 80.0


def collect_non_axis_boundary_element_ids_by_level(doc: Document) -> dict[str, list[str]]:
    """Walls / room separations long enough to matter but not axis-aligned (diagonal / near-diagonal)."""
    by_level: defaultdict[str, list[str]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, WallElem):
            if not _wall_or_sep_long_enough_for_boundary(ent):
                continue
            if axis_aligned_wall_segment(ent) is not None:
                continue
            by_level[ent.level_id].append(ent.id)
        elif isinstance(ent, RoomSeparationElem):
            if not _wall_or_sep_long_enough_for_boundary(ent):
                continue
            if axis_aligned_room_separation_segment(ent) is not None:
                continue
            by_level[ent.level_id].append(ent.id)
    for lid in by_level:
        by_level[lid] = sorted(set(by_level[lid]))
    return dict(by_level)


NON_AXIS_SKIPPED_IDS_SAMPLE_CAP = 48

# Overlap ratio vs min candidate area (matches room_derivation_preview sibling warning).
_DERIVED_CANDIDATE_OVERLAP_AMBIGUITY_RATIO = 0.12

HEURISTIC_VERSION = "room_deriv_preview_v4"
# Bounding combinations(seglist,4); huge parallel wall pools are non-closing-only-h edges.
ROOM_AX_RECT_SEGMENT_ENUM_CAP = 72

ROOM_CLOSURE_BLOCKING_DIAGNOSTIC_CODES: frozenset[str] = frozenset(
    {
        "axis_boundary_segment_enum_cap",
        "axis_segments_missing_orientation_mix",
        "non_axis_boundary_segments_skipped",
    }
)


def vacant_derived_metrics_for_authority(
    bundle: dict[str, Any],
    *,
    allowed_level_ids: frozenset[str] | None,
    authority: Literal["authoritative", "preview_heuristic"],
) -> tuple[float, int]:
    """Sum approximate area (m²) and count for derived rectangles with the given authority (optional level scope)."""

    total_area = 0.0
    n = 0
    for c in bundle.get("axisAlignedRectangleCandidates") or []:
        if not isinstance(c, dict):
            continue
        if c.get("derivationAuthority") != authority:
            continue
        lid = str(c.get("levelId") or "")
        if allowed_level_ids is not None and lid not in allowed_level_ids:
            continue
        try:
            total_area += float(c.get("approxAreaM2") or 0.0)
        except (TypeError, ValueError):
            continue
        n += 1
    return round(total_area, 4), n


def _bbox_nums_mm(bbox: dict[str, Any]) -> tuple[float, float, float, float, float]:
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    x_lo = float(mn.get("x") or 0)
    y_lo = float(mn.get("y") or 0)
    x_hi = float(mx.get("x") or 0)
    y_hi = float(mx.get("y") or 0)
    area = max(0.0, (x_hi - x_lo) / 1000.0) * max(0.0, (y_hi - y_lo) / 1000.0)
    return x_lo, y_lo, x_hi, y_hi, area


def _pairwise_preview_overlap_flags(cands: list[dict[str, Any]]) -> set[int]:
    """Indices into cands (same level) to downgrade for overlapping derived footprint ambiguity."""
    if len(cands) < 2:
        return set()
    bad: set[int] = set()
    for i in range(len(cands)):
        bbox_i = cands[i].get("bboxMm") if isinstance(cands[i].get("bboxMm"), dict) else {}
        ix0, iy0, ix1, iy1, ia = _bbox_nums_mm(bbox_i)
        if ia <= 1e-12:
            continue
        for j in range(i + 1, len(cands)):
            bbox_j = cands[j].get("bboxMm") if isinstance(cands[j].get("bboxMm"), dict) else {}
            jx0, jy0, jx1, jy1, ja = _bbox_nums_mm(bbox_j)
            if ja <= 1e-12:
                continue
            inter = aa_rect_intersection_area_m2(ix0, iy0, ix1, iy1, jx0, jy0, jx1, jy1)
            smaller = min(ia, ja)
            if smaller <= 0:
                continue
            if inter / smaller >= _DERIVED_CANDIDATE_OVERLAP_AMBIGUITY_RATIO:
                bad.add(i)
                bad.add(j)
    return bad


def _room_area_inset_mm_for_level(doc: Document, level_id: str) -> float:
    """Return the bbox inset (mm) to apply on all four sides when computing room area bounds.

    The inset is derived from the project-level ``roomAreaComputationBasis`` setting:
    - ``wall_finish`` (default): 0 mm — boundary at the outer wall finish face (existing behavior).
    - ``wall_centerline``: half the average wall thickness on this level.
    - ``wall_core_layer``: half the average wall thickness (approximated — no actual layer data).
    - ``wall_core_center``: half the average wall thickness (same approximation as centerline).
    """
    proj_settings = next(
        (e for e in doc.elements.values() if isinstance(e, ProjectSettingsElem)),
        None,
    )
    basis = proj_settings.room_area_computation_basis if proj_settings else "wall_finish"
    if basis == "wall_finish":
        return 0.0
    walls = [e for e in doc.elements.values() if isinstance(e, WallElem) and e.level_id == level_id]
    if not walls:
        return 0.0
    avg_thickness = sum(w.thickness_mm for w in walls) / len(walls)
    # wall_centerline, wall_core_layer, wall_core_center all map to half-thickness
    # without actual layer geometry data.
    return avg_thickness / 2.0


def _avg_wall_half_thickness_mm_for_level(doc: Document, level_id: str) -> float:
    walls = [e for e in doc.elements.values() if isinstance(e, WallElem) and e.level_id == level_id]
    if not walls:
        return 0.0
    return (sum(w.thickness_mm for w in walls) / len(walls)) / 2.0


def _room_volume_height_mm_for_level(doc: Document, level_id: str) -> float:
    level = doc.elements.get(level_id)
    base_z = float(level.elevation_mm) if isinstance(level, LevelElem) else 0.0
    higher = sorted(
        float(e.elevation_mm)
        for e in doc.elements.values()
        if isinstance(e, LevelElem) and float(e.elevation_mm) > base_z
    )
    return max(1000.0, (higher[0] - base_z) if higher else 2800.0)


def _bbox_area_m2_with_inset(bbox: dict[str, Any], inset_mm: float) -> float:
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    x_lo = float(mn.get("x") or 0) + inset_mm
    y_lo = float(mn.get("y") or 0) + inset_mm
    x_hi = float(mx.get("x") or 0) - inset_mm
    y_hi = float(mx.get("y") or 0) - inset_mm
    return max(0.0, (x_hi - x_lo) / 1000.0) * max(0.0, (y_hi - y_lo) / 1000.0)


@contextmanager
def room_boundary_derivation_request_cache() -> Iterator[None]:
    token = _ROOM_BOUNDARY_REQUEST_CACHE.set({})
    try:
        yield
    finally:
        _ROOM_BOUNDARY_REQUEST_CACHE.reset(token)


def _level_cache_keys_for_doc(doc: Document) -> dict[str, _LevelCacheKey]:
    """Map each level id present in the document to its cache key tuple."""
    settings_digest = _global_settings_digest(doc)
    per_level_fp = _level_input_fingerprints(doc)
    # Include every level that owns elements *or* is declared as a LevelElem,
    # plus the implicit "" bucket for orphan rows. The implicit bucket is
    # always empty for a valid document but the cache lookup needs to be total
    # so reassembly is deterministic.
    level_ids: set[str] = set(per_level_fp.keys())
    for ent in doc.elements.values():
        if isinstance(ent, LevelElem):
            level_ids.add(ent.id)
    out: dict[str, _LevelCacheKey] = {}
    for lid in level_ids:
        out[lid] = (lid, per_level_fp.get(lid, "empty"), settings_digest)
    return out


def _store_level_slice(key: _LevelCacheKey, slice_obj: dict[str, Any]) -> dict[str, Any]:
    """Insert (or refresh LRU position for) a per-level slice.

    Preserves the identity of an already-cached slice for the same key:
    if a caller computed a fresh slice but the cache already holds one
    for this exact key, the cached object wins. This is what gives the
    PERF-C06 acceptance test (level-A identity preserved across a
    level-B mutation) its hook.
    """
    existing = _ROOM_BOUNDARY_LEVEL_CACHE.get(key)
    if existing is not None:
        _ROOM_BOUNDARY_LEVEL_CACHE.move_to_end(key)
        return existing
    _ROOM_BOUNDARY_LEVEL_CACHE[key] = slice_obj
    _ROOM_BOUNDARY_LEVEL_CACHE.move_to_end(key)
    while len(_ROOM_BOUNDARY_LEVEL_CACHE) > _ROOM_BOUNDARY_LEVEL_CACHE_MAX:
        _ROOM_BOUNDARY_LEVEL_CACHE.popitem(last=False)
    return slice_obj


def compute_room_boundary_derivation(doc: Document) -> dict[str, Any]:
    in_req_cache = _ROOM_BOUNDARY_REQUEST_CACHE.get()
    # In-request fingerprint: stable across pydantic Document wraps of the
    # same elements set within one request. The bundle is returned by
    # reference; in-request callers must treat it as read-only.
    in_req_key: tuple[int, tuple[str, ...]] = (len(doc.elements), tuple(doc.elements.keys()))
    if in_req_cache is not None:
        cached = in_req_cache.get(in_req_key)
        if cached is not None:
            return cached

    # PERF-C05: cross-request cache, keyed on document fingerprint
    # (revision + element ids). Hit returns a deepcopy so the per-request
    # callers can mutate freely without poisoning the shared entry.
    doc_key = _room_boundary_doc_cache_key(doc)
    cross_cached = _ROOM_BOUNDARY_DOC_CACHE.get(doc_key)
    if cross_cached is not None:
        _ROOM_BOUNDARY_DOC_CACHE.move_to_end(doc_key)
        bundle = deepcopy(cross_cached)
        if in_req_cache is not None:
            in_req_cache[in_req_key] = bundle
        return bundle

    # PERF-C06: per-level cache layer. The doc cache missed (different
    # revision or element set), but unchanged levels may still have
    # cached slices we can reuse. If *every* level hits, assemble the
    # bundle from cached slices and skip the whole-document recompute.
    level_keys = _level_cache_keys_for_doc(doc)
    cached_slices: dict[str, dict[str, Any]] = {}
    all_hit = True
    for lid, key in level_keys.items():
        sl = _ROOM_BOUNDARY_LEVEL_CACHE.get(key)
        if sl is None:
            all_hit = False
            break
        cached_slices[lid] = sl

    if all_hit and level_keys:
        for key in level_keys.values():
            _ROOM_BOUNDARY_LEVEL_CACHE.move_to_end(key)
        bundle = _assemble_bundle_from_level_slices(cached_slices)
        _ROOM_BOUNDARY_DOC_CACHE[doc_key] = deepcopy(bundle)
        _ROOM_BOUNDARY_DOC_CACHE.move_to_end(doc_key)
        while len(_ROOM_BOUNDARY_DOC_CACHE) > _ROOM_BOUNDARY_DOC_CACHE_MAX:
            _ROOM_BOUNDARY_DOC_CACHE.popitem(last=False)
        if in_req_cache is not None:
            in_req_cache[in_req_key] = bundle
        return bundle

    bundle = _compute_room_boundary_derivation_uncached(doc)

    # Partition the freshly computed bundle into per-level slices and
    # store them. For levels whose key already exists in the level
    # cache (i.e. the slice was preserved across a sibling-level
    # mutation), `_store_level_slice` keeps the existing object — this
    # is what makes "level A identity preserved across level B
    # mutation" observable from callers / tests.
    fresh_slices = _partition_bundle_by_level(bundle, doc)
    for lid, key in level_keys.items():
        sl = fresh_slices.get(lid) or _empty_level_slice()
        _store_level_slice(key, sl)
    # Deepcopy the canonical entry on store so caller mutations in the current
    # request cannot poison subsequent requests' reads. Misses are bounded by
    # the LRU (32 entries) so the deepcopy cost amortizes across many hits.
    _ROOM_BOUNDARY_DOC_CACHE[doc_key] = deepcopy(bundle)
    _ROOM_BOUNDARY_DOC_CACHE.move_to_end(doc_key)
    while len(_ROOM_BOUNDARY_DOC_CACHE) > _ROOM_BOUNDARY_DOC_CACHE_MAX:
        _ROOM_BOUNDARY_DOC_CACHE.popitem(last=False)
    if in_req_cache is not None:
        # Within the originating request, hand out the live bundle so
        # subsequent in-request callers see the same identity (matches the
        # PERF-C04 contract verified by test_room_boundary_derivation_request_cache_reuses_document_result).
        in_req_cache[in_req_key] = bundle
    return bundle


def _compute_room_boundary_derivation_uncached(doc: Document) -> dict[str, Any]:
    """Single deterministic bundle: candidates, classification, diagnostics, preview warnings."""
    lvl_names = {e.id: e.name or e.id for e in doc.elements.values() if isinstance(e, LevelElem)}
    segments_by_level = collect_axis_aligned_boundary_segments(doc)
    non_axis_by_level = collect_non_axis_boundary_element_ids_by_level(doc)

    # Resolve the project-level area computation basis once for this derivation run.
    _proj_settings = next(
        (e for e in doc.elements.values() if isinstance(e, ProjectSettingsElem)),
        None,
    )
    _area_basis = _proj_settings.room_area_computation_basis if _proj_settings else "wall_finish"
    _volume_basis = _proj_settings.volume_computed_at if _proj_settings else "finish_faces"

    # Cache inset per level to avoid re-scanning elements for every quad combination.
    _inset_cache: dict[str, float] = {}
    _volume_height_cache: dict[str, float] = {}
    _volume_inset_cache: dict[str, float] = {}

    candidates: list[dict[str, Any]] = []
    for lid, seglist in segments_by_level.items():
        axes = {s[0] for s in seglist}
        if "h" not in axes or "v" not in axes:
            continue
        if len(seglist) < 4:
            continue
        if len(seglist) > ROOM_AX_RECT_SEGMENT_ENUM_CAP:
            continue
        if lid not in _inset_cache:
            _inset_cache[lid] = _room_area_inset_mm_for_level(doc, lid)
        inset_mm = _inset_cache[lid]
        hsegs = [s for s in seglist if s[0] == "h"]
        vsegs = [s for s in seglist if s[0] == "v"]
        # PERF-CQ-01: pre-index horizontal/vertical segments by canonical
        # coordinate via :func:`_corner_candidates` so we only consult
        # quads whose segs span a shared rectangle. The legacy
        # enumeration walked the full Cartesian product
        # (`combinations(hsegs, 2) × combinations(vsegs, 2)`) and let
        # :func:`quad_closes_rectangle` reject ~99% of pairs.
        for h_pair, v_pair in _corner_candidates(hsegs, vsegs):
            qs = quad_closes_rectangle((h_pair[0], h_pair[1], v_pair[0], v_pair[1]))
            if not qs:
                continue
            original_bbox = dict(qs.get("bboxMm") or {})
            qs["levelId"] = lid
            qs["levelName"] = lvl_names.get(lid, lid)
            if lid not in _volume_height_cache:
                _volume_height_cache[lid] = _room_volume_height_mm_for_level(doc, lid)
            if lid not in _volume_inset_cache:
                _volume_inset_cache[lid] = (
                    _avg_wall_half_thickness_mm_for_level(doc, lid)
                    if _volume_basis == "core_faces"
                    else 0.0
                )
            volume_area_m2 = _bbox_area_m2_with_inset(original_bbox, _volume_inset_cache[lid])
            qs["volumeComputedAt"] = _volume_basis
            qs["volumeAreaInsetMm"] = round(_volume_inset_cache[lid], 4)
            qs["approxVolumeM3"] = round(
                volume_area_m2 * (_volume_height_cache[lid] / 1000.0),
                4,
            )
            if inset_mm > 0.0:
                bbox = qs.get("bboxMm") or {}
                mn = bbox.get("min") or {}
                mx = bbox.get("max") or {}
                x_lo = float(mn.get("x") or 0) + inset_mm
                y_lo = float(mn.get("y") or 0) + inset_mm
                x_hi = float(mx.get("x") or 0) - inset_mm
                y_hi = float(mx.get("y") or 0) - inset_mm
                qs["bboxMm"] = {
                    "min": {"x": x_lo, "y": y_lo},
                    "max": {"x": x_hi, "y": y_hi},
                }
                area_m2 = max(0.0, (x_hi - x_lo) / 1000.0) * max(0.0, (y_hi - y_lo) / 1000.0)
                qs["approxAreaM2"] = round(area_m2, 4)
                qs["roomAreaComputationBasis"] = _area_basis
                qs["roomAreaInsetMm"] = round(inset_mm, 4)
            candidates.append(qs)

    def _sig(cand: dict[str, Any]) -> tuple:
        b = cand.get("bboxMm") or {}
        mn = b.get("min") or {}
        mx = b.get("max") or {}
        return (
            str(cand.get("levelId")),
            tuple(cand.get("wallIds") or ()),
            tuple(cand.get("boundarySeparationIds") or ()),
            tuple(cand.get("perimeterSegmentIdsSorted") or ()),
            mn.get("x"),
            mn.get("y"),
            mx.get("x"),
            mx.get("y"),
        )

    dedup: dict[tuple, dict[str, Any]] = {}
    for c in sorted(candidates, key=_sig):
        dedup[_sig(c)] = c

    authored_by_level: defaultdict[str, list[RoomElem]] = defaultdict(list)
    for ent in doc.elements.values():
        if isinstance(ent, RoomElem):
            authored_by_level[ent.level_id].append(ent)

    diagnostics: list[dict[str, Any]] = []
    for lid, segs in sorted(segments_by_level.items(), key=lambda x: x[0]):
        if not segs:
            continue
        wall_ids_lvl = sorted({s[4] for s in segs if s[5] == "wall"})
        sep_ids_lvl = sorted({s[4] for s in segs if s[5] == "room_separation"})
        all_seg_ids = sorted(set(wall_ids_lvl) | set(sep_ids_lvl))
        axes_lvl = {s[0] for s in segs}

        if len(segs) > ROOM_AX_RECT_SEGMENT_ENUM_CAP:
            diagnostics.append(
                {
                    "code": "axis_boundary_segment_enum_cap",
                    "severity": "info",
                    "levelId": lid,
                    "diagnosticId": _stable_diag_id_enum_cap(
                        lid, all_seg_ids, ROOM_AX_RECT_SEGMENT_ENUM_CAP
                    ),
                    "segmentCount": len(segs),
                    "cap": ROOM_AX_RECT_SEGMENT_ENUM_CAP,
                    "elementIds": all_seg_ids,
                    "elementIdsSample": all_seg_ids[:NON_AXIS_SKIPPED_IDS_SAMPLE_CAP],
                    "message": (
                        "Orthogonal boundary segment count exceeds the axis-aligned rectangle enumeration cap; "
                        "derived footprints are skipped for this level until the model is simplified or split."
                    ),
                }
            )

        if len(segs) >= 4 and ("h" not in axes_lvl or "v" not in axes_lvl):
            diagnostics.append(
                {
                    "code": "axis_segments_missing_orientation_mix",
                    "severity": "info",
                    "levelId": lid,
                    "diagnosticId": _stable_diag_id_orientation_mix(lid, wall_ids_lvl, sep_ids_lvl),
                    "segmentCounts": {
                        "wall": len(wall_ids_lvl),
                        "room_separation": len(sep_ids_lvl),
                    },
                    "elementIds": all_seg_ids,
                    "message": (
                        "Orthogonal segments exist but both horizontal and vertical orientations are not present; "
                        "cannot close an axis-aligned rectangle from this boundary set."
                    ),
                }
            )

        if len(segs) < 4:
            diagnostics.append(
                {
                    "code": "axis_segments_insufficient_for_closure",
                    "severity": "info",
                    "levelId": lid,
                    "diagnosticId": _stable_diag_id_axis_insufficient(
                        lid, wall_ids_lvl, sep_ids_lvl
                    ),
                    "segmentCounts": {
                        "wall": len(wall_ids_lvl),
                        "room_separation": len(sep_ids_lvl),
                    },
                    "elementIds": sorted(set(wall_ids_lvl) | set(sep_ids_lvl)),
                    "message": (
                        "Orthogonal wall and/or room separation segments exist on this level but fewer than four; "
                        "cannot close an axis-aligned rectangle."
                    ),
                }
            )

    for lid, skipped_all in sorted(non_axis_by_level.items(), key=lambda x: x[0]):
        if not skipped_all:
            continue
        sample = skipped_all[:NON_AXIS_SKIPPED_IDS_SAMPLE_CAP]
        diagnostics.append(
            {
                "code": "non_axis_boundary_segments_skipped",
                "severity": "info",
                "levelId": lid,
                "diagnosticId": _stable_diag_id_non_axis_skipped(lid, skipped_all),
                "skippedCount": len(skipped_all),
                "elementIds": skipped_all,
                "skippedElementIdsSample": sample,
                "message": (
                    "One or more walls or room separations are long enough to bound space but are not axis-aligned; "
                    "they are excluded from axis-aligned rectangle derivation."
                ),
            }
        )

    warnings: list[dict[str, Any]] = []
    enriched: list[dict[str, Any]] = []
    auth_count = 0
    ambiguous_diag_ids: set[str] = set()

    for cand in sorted(dedup.values(), key=_sig):
        lid = str(cand.get("levelId") or "")
        bbox = cand.get("bboxMm") if isinstance(cand.get("bboxMm"), dict) else {}
        sep_ids = separation_ids_splitting_candidate_bbox(doc, level_id=lid, bbox=bbox)
        authored = authored_by_level.get(lid, [])
        pierce = bool(sep_ids)
        overlap_auth = authored_room_overlaps_candidate_bbox(authored, bbox)

        authority_reasons: list[str] = []
        if pierce:
            authority_reasons.append("ambiguous_interior_separation")
            amb_id = _stable_diag_id_ambiguous(lid, bbox, sep_ids)
            if amb_id not in ambiguous_diag_ids:
                ambiguous_diag_ids.add(amb_id)
                diagnostics.append(
                    {
                        "code": "ambiguous_interior_separation",
                        "severity": "warning",
                        "levelId": lid,
                        "diagnosticId": amb_id,
                        "separationIds": sep_ids,
                        "wallIds": list(cand.get("wallIds") or []),
                        "boundarySeparationIds": list(cand.get("boundarySeparationIds") or []),
                        "message": (
                            "An axis-aligned room separation pierces this derived rectangle interior; "
                            "footprint is ambiguous for a single authoritative cell."
                        ),
                    }
                )
        if overlap_auth:
            authority_reasons.append("overlaps_authored_room_bbox")

        if pierce or overlap_auth:
            derivation_authority: Literal["authoritative", "preview_heuristic"] = (
                "preview_heuristic"
            )
        else:
            derivation_authority = "authoritative"
            auth_count += 1

        ec = dict(cand)
        ec["derivationAuthority"] = derivation_authority
        ec["authorityReasonCodes"] = sorted(set(authority_reasons))
        enriched.append(ec)

        if sep_ids:
            warnings.append(
                {
                    "code": "derivedRectangleInteriorRoomSeparation",
                    "severity": "warning",
                    "levelId": lid,
                    "wallIds": sorted(cand.get("wallIds") or []),
                    "separationIds": sep_ids,
                    "message": (
                        "An axis-aligned room separation pierces this derived rectangle bbox interior; "
                        "expect multiple rooms or adjust separators before trusting a single createRoomOutline."
                    ),
                }
            )

        if not overlap_auth:
            warnings.append(
                {
                    "code": "derivedRectangleWithoutAuthoredRoom",
                    "severity": "info",
                    "levelId": lid,
                    "wallIds": sorted(cand.get("wallIds") or []),
                    "message": (
                        "Heuristic axis-aligned rectangle from walls does not overlap any authored RoomElem "
                        "bounding box on this level; consider createRoomOutline or verify closure."
                    ),
                }
            )

    by_level_idxs: defaultdict[str, list[int]] = defaultdict(list)
    for idx, ec in enumerate(enriched):
        by_level_idxs[str(ec.get("levelId") or "")].append(idx)
    overlap_downgrade: set[int] = set()
    for _lid, idxs in sorted(by_level_idxs.items(), key=lambda x: x[0]):
        if len(idxs) < 2:
            continue
        level_cands = [enriched[i] for i in idxs]
        bad_local = _pairwise_preview_overlap_flags(level_cands)
        for j in bad_local:
            overlap_downgrade.add(idxs[j])

    for gi in overlap_downgrade:
        ec = enriched[gi]
        reasons = sorted(
            set(ec.get("authorityReasonCodes") or []) | {"overlapping_derived_candidate_footprint"}
        )
        ec["authorityReasonCodes"] = reasons
        ec["derivationAuthority"] = "preview_heuristic"

    auth_count = sum(1 for ec in enriched if ec.get("derivationAuthority") == "authoritative")

    return {
        "heuristicVersion": HEURISTIC_VERSION,
        "axisAlignedRectangleCandidates": sorted(enriched, key=_sig),
        "candidateCount": len(dedup),
        "authoritativeCandidateCount": auth_count,
        "unboundedRoomIds": detect_unbounded_rooms_v1(doc),
        "diagnostics": sorted(
            diagnostics,
            key=lambda d: (str(d.get("levelId")), str(d.get("code")), str(d.get("diagnosticId"))),
        ),
        "warnings": warnings,
    }


def _stable_diag_id_axis_insufficient(
    level_id: str, wall_ids: list[str], sep_ids: list[str]
) -> str:
    body = json.dumps(
        {"levelId": level_id, "wallIds": wall_ids, "sepIds": sep_ids},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _stable_diag_id_ambiguous(level_id: str, bbox: dict[str, Any], sep_ids: list[str]) -> str:
    body = json.dumps(
        {"levelId": level_id, "bboxMm": bbox, "sepIds": sep_ids},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _stable_diag_id_enum_cap(level_id: str, element_ids_sorted: list[str], cap: int) -> str:
    body = json.dumps(
        {"cap": cap, "elementIds": element_ids_sorted, "levelId": level_id},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _stable_diag_id_orientation_mix(level_id: str, wall_ids: list[str], sep_ids: list[str]) -> str:
    body = json.dumps(
        {"levelId": level_id, "sepIds": sep_ids, "wallIds": wall_ids},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _stable_diag_id_non_axis_skipped(level_id: str, skipped_ids_sorted: list[str]) -> str:
    body = json.dumps(
        {"levelId": level_id, "skippedIds": skipped_ids_sorted},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def authoritative_vacant_area_m2_filtered(
    doc: Document,
    *,
    allowed_level_ids: frozenset[str] | None = None,
) -> tuple[float, int]:
    """Sum area and count of authoritative vacant rectangles, optionally restricted to levels."""
    bundle = compute_room_boundary_derivation(doc)
    return vacant_derived_metrics_for_authority(
        bundle, allowed_level_ids=allowed_level_ids, authority="authoritative"
    )


def authoritative_vacant_footprints_m2_summary(doc: Document) -> tuple[float, int]:
    """Sum of authoritative vacant rectangles (deterministic subset). Used by schedules."""
    return authoritative_vacant_area_m2_filtered(doc, allowed_level_ids=None)


def stable_footprint_id(cand_dict: dict[str, Any]) -> str:
    """Stable id for authoritative evidence rows (candidate dict from bundle)."""
    canon = {
        "levelId": str(cand_dict.get("levelId") or ""),
        "wallIds": sorted(cand_dict.get("wallIds") or []),
        "boundarySeparationIds": sorted(cand_dict.get("boundarySeparationIds") or []),
        "bbox": cand_dict.get("bboxMm"),
        "kind": str(cand_dict.get("kind") or ""),
        "boundarySegmentEncoding": str(cand_dict.get("boundarySegmentEncoding") or ""),
    }
    body = json.dumps(canon, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()[:24]


_UNBOUNDED_PROXIMITY_MM = 1500.0


def detect_unbounded_rooms_v1(doc: Document) -> list[str]:
    """Return room element IDs whose boundary is open (not fully enclosed by walls/room separations).

    A room is considered unbounded when fewer than 4 distinct axis-aligned boundary segments
    (walls or room separations) exist within _UNBOUNDED_PROXIMITY_MM of its bounding box on
    the same level.  A fully enclosed axis-aligned rectangle needs at minimum 2 horizontal
    and 2 vertical boundary segments.
    """
    segs_by_level = collect_axis_aligned_boundary_segments(doc)
    result: list[str] = []
    for ent in doc.elements.values():
        if not isinstance(ent, RoomElem):
            continue
        bb = outline_aa_bbox_mm(ent)
        if bb is None:
            result.append(ent.id)
            continue
        rx0 = bb["min"]["x"] - _UNBOUNDED_PROXIMITY_MM
        ry0 = bb["min"]["y"] - _UNBOUNDED_PROXIMITY_MM
        rx1 = bb["max"]["x"] + _UNBOUNDED_PROXIMITY_MM
        ry1 = bb["max"]["y"] + _UNBOUNDED_PROXIMITY_MM
        segs = segs_by_level.get(ent.level_id, [])
        near_count = 0
        for seg in segs:
            kind, c, mn, mx = seg[0], seg[1], seg[2], seg[3]
            if kind == "h":
                if ry0 <= c <= ry1 and mn <= rx1 and mx >= rx0:
                    near_count += 1
            else:
                if rx0 <= c <= rx1 and mn <= ry1 and mx >= ry0:
                    near_count += 1
        if near_count < 4:
            result.append(ent.id)
    return sorted(result)


def footprint_outline_mm_rectangle(bbox: dict[str, Any]) -> list[dict[str, float]]:
    mn = bbox.get("min") or {}
    mx = bbox.get("max") or {}
    x0 = float(mn.get("x") or 0)
    y0 = float(mn.get("y") or 0)
    x1 = float(mx.get("x") or 0)
    y1 = float(mx.get("y") or 0)
    return [
        {"xMm": x0, "yMm": y0},
        {"xMm": x1, "yMm": y0},
        {"xMm": x1, "yMm": y1},
        {"xMm": x0, "yMm": y1},
    ]
