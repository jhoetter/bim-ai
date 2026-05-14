from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import Element, ViewElem


def element_passes_phase_filter(elem: Any, phase_filter: str) -> bool:
    """Return True if the element should be visible under the given phase filter."""
    if phase_filter == "all":
        return True
    phase_created = getattr(elem, "phase_created", "existing")
    phase_demolished = getattr(elem, "phase_demolished", None)
    if phase_filter == "existing":
        return phase_created == "existing" and (phase_demolished is None)
    if phase_filter == "demolition":
        return phase_demolished == "demolition"
    if phase_filter == "new":
        return phase_created == "new"
    return True


def phase_render_style(elem: Any, phase_filter: str) -> dict[str, str]:
    """Return CSS token names for the element's phase render style."""
    phase_created = getattr(elem, "phase_created", "existing")
    phase_demolished = getattr(elem, "phase_demolished", None)

    if phase_demolished == "demolition":
        return {
            "stroke": "var(--phase-demolition)",
            "strokeDashArray": "4 4",
            "strokeWidth": "var(--draft-lw-projection)",
        }
    if phase_created == "new":
        return {
            "stroke": "var(--phase-new)",
            "strokeDashArray": "none",
            "strokeWidth": "var(--draft-lw-cut)",
        }
    return {
        "stroke": "var(--phase-existing)",
        "strokeDashArray": "none",
        "strokeWidth": "var(--draft-lw-projection)",
    }


_LENS_TO_DISCIPLINE: dict[str, str] = {
    "show_arch": "arch",
    "show_struct": "struct",
    "show_mep": "mep",
}

_FIRE_SAFETY_KINDS: frozenset[str] = frozenset(
    {
        "room",
        "wall",
        "floor",
        "ceiling",
        "door",
        "stair",
        "wall_opening",
        "slab_opening",
        "roof_opening",
        "pipe",
        "duct",
        "fixture",
    }
)

_FIRE_SAFETY_PROP_KEYS: frozenset[str] = frozenset(
    {
        "fireSafety",
        "fireCompartmentId",
        "smokeCompartmentId",
        "fireResistanceRating",
        "fireRating",
        "smokeControlRating",
        "selfClosingRequired",
        "escapeRouteId",
        "travelDistanceM",
        "exitWidthMm",
        "doorSwingCompliant",
        "firestopStatus",
        "penetrationStatus",
    }
)


def _passes_fire_safety_lens(
    elem_discipline: str | None,
    elem_kind: str | None,
    props: dict[str, Any] | None,
) -> bool:
    if elem_kind in _FIRE_SAFETY_KINDS:
        return True
    if props and any(k in _FIRE_SAFETY_PROP_KEYS for k in props):
        return True
    return (elem_discipline or "arch") in {"arch", "mep"}


def element_passes_lens(
    elem_discipline: str | None,
    lens: str,
    elem_kind: str | None = None,
    props: dict[str, Any] | None = None,
) -> bool:
    """Return True if the element should be foreground under the given lens."""
    if lens == "show_all":
        return True
    if lens == "show_fire_safety":
        return _passes_fire_safety_lens(elem_discipline, elem_kind, props)
    expected = _LENS_TO_DISCIPLINE.get(lens)
    resolved = elem_discipline if elem_discipline is not None else "arch"
    return resolved == expected


def resolve_visible_elements(doc: Document, option_locks: dict[str, str]) -> list[str]:
    visible = []
    for eid, elem in doc.elements.items():
        if isinstance(elem, ViewElem) and elem.sub_kind == "drafting":
            continue
        set_id = getattr(elem, "option_set_id", None)
        opt_id = getattr(elem, "option_id", None)
        if set_id is None:
            visible.append(eid)
            continue
        locked = option_locks.get(set_id)
        if locked is not None:
            if opt_id == locked:
                visible.append(eid)
        else:
            the_set = next((s for s in doc.design_option_sets if s.id == set_id), None)
            if the_set is not None:
                primary = next((o for o in the_set.options if o.is_primary), None)
                if primary is not None and opt_id == primary.id:
                    visible.append(eid)
    return visible


def supports_pin(el: Element) -> bool:
    """True when the element model declares a pinned field."""
    return "pinned" in type(el).model_fields


def is_element_pinned(el: Element | None) -> bool:
    """True iff the element exposes a pinned field set to True."""
    if el is None:
        return False
    return bool(getattr(el, "pinned", False))
