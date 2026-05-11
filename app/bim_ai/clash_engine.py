"""FED-02: cross-link clash detection.

Resolves selection-set rules across host and linked models, computes axis-
aligned bounding boxes (AABBs) for matching elements, and reports pair-wise
clashes within a tolerance.

The engine is pure-data: it takes a host ``Document``, the dict of
``selection_set`` and ``clash_test`` elements (read from the same host doc),
and a ``SourceDocProvider`` callable that resolves linked source documents
from UUID — the same provider shape used by ``link_expansion.expand_links``.
This keeps clash testing decoupled from the request/DB layer so it is unit-
testable in isolation.

Element coverage is delegated to the constructability physical-participant
registry so authoring clash tests and constructability advisor checks share
the same server-side proxy contract. Grid lines keep a tiny local AABB because
they are coordination references, not physical constructability participants.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from bim_ai.constructability_geometry import physical_participant_for_element
from bim_ai.document import Document
from bim_ai.elements import (
    ClashResultSpec,
    ClashTestElem,
    LinkModelElem,
    SelectionSetElem,
    SelectionSetRuleSpec,
)
from bim_ai.link_expansion import SourceDocProvider

# --- AABB primitive ---------------------------------------------------------


@dataclass(frozen=True)
class Aabb:
    """Axis-aligned bounding box in model-space millimetres."""

    min_x: float
    min_y: float
    min_z: float
    max_x: float
    max_y: float
    max_z: float

    def transformed(self, sin_a: float, cos_a: float, dx: float, dy: float, dz: float) -> Aabb:
        """Apply Z-rotation about origin then a translation; return a new AABB
        that wraps the rotated original (so the result is still axis-aligned).

        Used to drag linked-source AABBs into host-space using the
        ``link_model``'s ``positionMm`` + ``rotationDeg``.
        """

        corners_xy = (
            (self.min_x, self.min_y),
            (self.min_x, self.max_y),
            (self.max_x, self.min_y),
            (self.max_x, self.max_y),
        )
        rotated = [(x * cos_a - y * sin_a, x * sin_a + y * cos_a) for x, y in corners_xy]
        xs = [r[0] for r in rotated]
        ys = [r[1] for r in rotated]
        return Aabb(
            min_x=min(xs) + dx,
            min_y=min(ys) + dy,
            min_z=self.min_z + dz,
            max_x=max(xs) + dx,
            max_y=max(ys) + dy,
            max_z=self.max_z + dz,
        )


def _interval_separation_mm(a_min: float, a_max: float, b_min: float, b_max: float) -> float:
    """Signed separation along one axis: 0 if overlapping, positive if apart."""

    if a_max < b_min:
        return b_min - a_max
    if b_max < a_min:
        return a_min - b_max
    return 0.0


def aabb_clash_distance_mm(a: Aabb, b: Aabb) -> float:
    """Closest distance between two AABBs (Euclidean, 3D). Zero if overlapping
    or touching. Used as the proximity score for ``ClashResult.distanceMm``.
    """

    sx = _interval_separation_mm(a.min_x, a.max_x, b.min_x, b.max_x)
    sy = _interval_separation_mm(a.min_y, a.max_y, b.min_y, b.max_y)
    sz = _interval_separation_mm(a.min_z, a.max_z, b.min_z, b.max_z)
    return math.sqrt(sx * sx + sy * sy + sz * sz)


# --- AABB extraction per element kind --------------------------------------


def _level_elevation_mm(host_elements: dict[str, Any], level_id: str) -> float:
    lvl = host_elements.get(level_id)
    if lvl is None:
        return 0.0
    return float(getattr(lvl, "elevation_mm", 0.0))


def _aabb_for_wall(elem: Any, host_elements: dict[str, Any]) -> Aabb | None:
    s = elem.start
    e = elem.end
    sx, sy = float(s.x_mm), float(s.y_mm)
    ex, ey = float(e.x_mm), float(e.y_mm)
    dx = ex - sx
    dy = ey - sy
    length = math.hypot(dx, dy)
    if length < 1e-6:
        return None
    half_t = float(elem.thickness_mm) * 0.5
    nx = -dy / length
    ny = dx / length
    corners = (
        (sx + nx * half_t, sy + ny * half_t),
        (sx - nx * half_t, sy - ny * half_t),
        (ex + nx * half_t, ey + ny * half_t),
        (ex - nx * half_t, ey - ny * half_t),
    )
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    base_z = _level_elevation_mm(host_elements, elem.level_id)
    return Aabb(
        min_x=min(xs),
        min_y=min(ys),
        min_z=base_z,
        max_x=max(xs),
        max_y=max(ys),
        max_z=base_z + float(elem.height_mm),
    )


def _aabb_for_floor(elem: Any, host_elements: dict[str, Any]) -> Aabb | None:
    outline = getattr(elem, "outline_mm", None)
    if not outline:
        return None
    xs = [float(p.x_mm) for p in outline]
    ys = [float(p.y_mm) for p in outline]
    if not xs or not ys:
        return None
    base_z = _level_elevation_mm(host_elements, elem.level_id)
    thick = float(getattr(elem, "thickness_mm", 200.0))
    return Aabb(
        min_x=min(xs),
        min_y=min(ys),
        min_z=base_z - thick,
        max_x=max(xs),
        max_y=max(ys),
        max_z=base_z,
    )


def _aabb_for_grid_line(elem: Any, host_elements: dict[str, Any]) -> Aabb | None:
    s = getattr(elem, "line_start_mm", None)
    e = getattr(elem, "line_end_mm", None)
    if s is None or e is None:
        return None
    xs = [float(s.x_mm), float(e.x_mm)]
    ys = [float(s.y_mm), float(e.y_mm)]
    return Aabb(
        min_x=min(xs) - 1.0,
        min_y=min(ys) - 1.0,
        min_z=-1.0,
        max_x=max(xs) + 1.0,
        max_y=max(ys) + 1.0,
        max_z=1.0,
    )


def aabb_for_element(elem: Any, host_elements: dict[str, Any]) -> Aabb | None:
    """Return an AABB for any clash-testable element kind, or ``None``."""

    kind = getattr(elem, "kind", None)
    if kind == "grid_line":
        return _aabb_for_grid_line(elem, host_elements)
    participant = physical_participant_for_element(elem, host_elements)
    if participant is None:
        return None
    proxy = participant.aabb
    return Aabb(
        min_x=proxy.min_x,
        min_y=proxy.min_y,
        min_z=proxy.min_z,
        max_x=proxy.max_x,
        max_y=proxy.max_y,
        max_z=proxy.max_z,
    )


# --- Selection-set resolution ----------------------------------------------


def _rule_matches(elem: Any, rule: SelectionSetRuleSpec) -> bool:
    if rule.field == "category":
        kind_str = str(getattr(elem, "kind", ""))
        return kind_str == rule.value if rule.operator == "equals" else rule.value in kind_str
    if rule.field == "level":
        lvl = getattr(elem, "level_id", None)
        if lvl is None:
            return False
        return str(lvl) == rule.value if rule.operator == "equals" else rule.value in str(lvl)
    if rule.field == "typeName":
        nm = getattr(elem, "name", None)
        if nm is None:
            return False
        return str(nm) == rule.value if rule.operator == "equals" else rule.value in str(nm)
    return False


def _scope_for_rule(rule: SelectionSetRuleSpec) -> tuple[str, str | None]:
    """Decode ``link_scope`` into ``(mode, specific_link_id)``.

    ``mode`` is one of ``'host' | 'all_links' | 'specific'``;
    ``specific_link_id`` is the target link's id when mode is ``'specific'``.
    Default (when ``link_scope`` is ``None``) is ``('host', None)``.
    """

    scope = rule.link_scope
    if scope is None or scope == "host":
        return ("host", None)
    if scope == "all_links":
        return ("all_links", None)
    if isinstance(scope, dict):
        sid = scope.get("specificLinkId") or scope.get("specific_link_id")
        if isinstance(sid, str) and sid:
            return ("specific", sid)
    return ("host", None)


@dataclass(frozen=True)
class ResolvedElement:
    """A single element produced by selection-set resolution.

    ``element_id`` is the host-snapshot id (prefixed with ``<linkId>::`` for
    linked elements, matching ``link_expansion``'s convention). ``link_chain``
    is empty for host elements and ``[link_id]`` for linked ones.
    """

    element_id: str
    aabb: Aabb
    link_chain: tuple[str, ...]


def _resolve_set(
    host_doc: Document,
    set_ids: list[str],
    source_provider: SourceDocProvider,
) -> list[ResolvedElement]:
    """Resolve every selection_set referenced by ``set_ids`` into a flat list
    of ``ResolvedElement`` entries (deduplicated by element_id).

    Selection sets union their rules conservatively: an element is included
    if it matches **all** rules in at least one selection set (mirrors the
    existing TS ``filterRules.every(...)`` semantics in ``SelectionSetPanel``).
    Each rule's ``link_scope`` is honoured independently — a single selection
    set may mix host + linked rules; an element is included if it satisfies
    every rule under that rule's own scope.
    """

    seen: dict[str, ResolvedElement] = {}
    host_elements = host_doc.elements

    # Index linked sources up front (only sources we'll actually traverse).
    link_elems: list[LinkModelElem] = [
        e for e in host_elements.values() if isinstance(e, LinkModelElem) and not e.hidden
    ]

    def _walk_link(link: LinkModelElem) -> tuple[Document, float, float, float, float, float] | None:
        src = source_provider(link.source_model_id, link.source_model_revision)
        if src is None:
            return None
        rad = math.radians(link.rotation_deg)
        return (
            src,
            math.sin(rad),
            math.cos(rad),
            link.position_mm.x_mm,
            link.position_mm.y_mm,
            link.position_mm.z_mm,
        )

    for sset_id in set_ids:
        sset = host_elements.get(sset_id)
        if not isinstance(sset, SelectionSetElem):
            continue
        rules = sset.filter_rules
        if not rules:
            continue

        # Per-rule scope: an element is included only if every rule matches it
        # in that rule's scope. Compute the intersection of per-rule candidate
        # sets (host + each link). Element ids carry the linked-prefix when
        # the element is sourced through a link.

        rule_results: list[set[str]] = []
        # Aux lookup to materialise AABB + link_chain at the end.
        aabb_lookup: dict[str, tuple[Aabb, tuple[str, ...]]] = {}

        for rule in rules:
            mode, specific_link_id = _scope_for_rule(rule)
            scope_ids: set[str] = set()

            if mode == "host":
                for eid, el in host_elements.items():
                    if _rule_matches(el, rule):
                        ab = aabb_for_element(el, host_elements)
                        if ab is None:
                            continue
                        scope_ids.add(eid)
                        aabb_lookup[eid] = (ab, ())

            if mode in {"all_links", "specific"}:
                for link in link_elems:
                    if mode == "specific" and link.id != specific_link_id:
                        continue
                    walk = _walk_link(link)
                    if walk is None:
                        continue
                    src_doc, sin_a, cos_a, dx, dy, dz = walk
                    src_elements = src_doc.elements
                    for src_id, src_el in src_elements.items():
                        if isinstance(src_el, LinkModelElem):
                            continue  # single-hop only
                        if not _rule_matches(src_el, rule):
                            continue
                        local_ab = aabb_for_element(src_el, src_elements)
                        if local_ab is None:
                            continue
                        host_id = f"{link.id}::{src_id}"
                        host_ab = local_ab.transformed(sin_a, cos_a, dx, dy, dz)
                        scope_ids.add(host_id)
                        aabb_lookup[host_id] = (host_ab, (link.id,))

            rule_results.append(scope_ids)

        if not rule_results:
            continue

        intersected = rule_results[0].copy()
        for rs in rule_results[1:]:
            intersected &= rs

        for eid in intersected:
            if eid in seen:
                continue
            ab, chain = aabb_lookup[eid]
            seen[eid] = ResolvedElement(element_id=eid, aabb=ab, link_chain=chain)

    return list(seen.values())


# --- Top-level entry point --------------------------------------------------


def run_clash_test(
    host_doc: Document,
    clash_test: ClashTestElem,
    source_provider: SourceDocProvider,
) -> list[ClashResultSpec]:
    """Compute pairwise clashes between Set A and Set B at the given tolerance.

    Returns a deterministic list of ``ClashResultSpec`` entries (sorted by
    ``(elementIdA, elementIdB)``). The caller is responsible for writing the
    list back onto the ``clash_test`` element via the engine's apply path.
    """

    set_a = _resolve_set(host_doc, clash_test.set_a_ids, source_provider)
    set_b = _resolve_set(host_doc, clash_test.set_b_ids, source_provider)
    tol = float(clash_test.tolerance_mm)

    results: list[ClashResultSpec] = []
    for a in set_a:
        for b in set_b:
            if a.element_id == b.element_id:
                continue
            d = aabb_clash_distance_mm(a.aabb, b.aabb)
            if d <= tol:
                results.append(
                    ClashResultSpec(
                        element_id_a=a.element_id,
                        element_id_b=b.element_id,
                        distance_mm=d,
                        link_chain_a=list(a.link_chain),
                        link_chain_b=list(b.link_chain),
                    )
                )

    results.sort(key=lambda r: (r.element_id_a, r.element_id_b))
    return results
