"""Level datum chains (parent level + vertical offset): topo order and propagation utilities."""

from __future__ import annotations

from bim_ai.elements import Element, LevelElem


def expected_level_elevation_from_parent(parent: LevelElem, offset_mm: float) -> float:
    return float(parent.elevation_mm) + float(offset_mm)


def level_datum_topo_order_impl(
    els: dict[str, Element],
) -> tuple[list[str], list[str] | None]:
    """Kahn topo order among LevelElem datum edges (parent→child).
    Returns (topo_prefix, remaining_sorted_or_none). When the graph cycles, remaining is non-empty.
    """
    level_ids = sorted(lid for lid, el in els.items() if isinstance(el, LevelElem))
    if not level_ids:
        return [], None

    children_by_parent: dict[str, list[str]] = {}
    in_degree: dict[str, int] = {lid: 0 for lid in level_ids}

    for lid in level_ids:
        lv = els[lid]
        assert isinstance(lv, LevelElem)
        pid = lv.parent_level_id
        if not pid or pid not in els or not isinstance(els[pid], LevelElem):
            continue
        children_by_parent.setdefault(pid, []).append(lid)
        in_degree[lid] = 1

    for pid in children_by_parent:
        children_by_parent[pid].sort()

    queue = sorted(lid for lid in level_ids if in_degree[lid] == 0)
    topo: list[str] = []

    while queue:
        u = queue.pop(0)
        topo.append(u)
        for child in children_by_parent.get(u, ()):
            in_degree[child] -= 1
            assert in_degree[child] >= 0
            if in_degree[child] == 0:
                inserted = False
                for idx, q in enumerate(queue):
                    if child < q:
                        queue.insert(idx, child)
                        inserted = True
                        break
                if not inserted:
                    queue.append(child)

    if len(topo) != len(level_ids):
        remaining = sorted(lid for lid in level_ids if in_degree[lid] > 0)
        return topo, remaining
    return topo, None


def level_datum_topo_order_if_acyclic(els: dict[str, Element]) -> list[str] | None:
    """Parents-before-children order, or None when datum parent pointers form a cycle among levels."""
    topo, remaining = level_datum_topo_order_impl(els)
    if remaining is not None:
        return None
    return topo


def level_datum_cycle_participant_level_ids(els: dict[str, Element]) -> list[str]:
    """Sorted level ids with positive in-degree after failed Kahn (datum cycle component)."""
    _topo, remaining = level_datum_topo_order_impl(els)
    if remaining is None:
        return []
    return remaining


def propagate_dependent_level_elevations(els: dict[str, Element]) -> None:
    """Overwrite child LevelElem elevations from parent datum + offset. No-op if datum graph cycles."""
    order = level_datum_topo_order_if_acyclic(els)
    if order is None:
        return
    for lid in order:
        lv = els.get(lid)
        if not isinstance(lv, LevelElem):
            continue
        pid = lv.parent_level_id
        if pid is None:
            continue
        parent_el = els.get(pid)
        if not isinstance(parent_el, LevelElem):
            continue
        exp = expected_level_elevation_from_parent(parent_el, lv.offset_from_parent_mm)
        if abs(lv.elevation_mm - exp) > 1e-6:
            els[lid] = lv.model_copy(update={"elevation_mm": exp})
