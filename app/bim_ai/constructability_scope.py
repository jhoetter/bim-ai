from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.elements import Element


def scope_constructability_elements(
    elements: dict[str, Element],
    *,
    phase_filter: str = "all",
    option_locks: Mapping[str, str] | None = None,
    design_option_sets: Iterable[Any] = (),
) -> dict[str, Element]:
    """Return elements active for a constructability report context."""

    locks = dict(option_locks or {})
    primary_options = _primary_options_by_set(design_option_sets)
    return {
        element_id: element
        for element_id, element in elements.items()
        if _passes_phase_filter(element, phase_filter)
        and _passes_design_option_filter(element, locks, primary_options)
    }


def constructability_scope_descriptor(
    *,
    phase_filter: str = "all",
    option_locks: Mapping[str, str] | None = None,
    design_option_sets: Iterable[Any] = (),
) -> dict[str, Any]:
    primary_options = _primary_options_by_set(design_option_sets)
    return {
        "phaseFilter": phase_filter,
        "optionLocks": dict(sorted((option_locks or {}).items())),
        "primaryOptionIds": dict(sorted(primary_options.items())),
    }


def _passes_phase_filter(element: Element, phase_filter: str) -> bool:
    if phase_filter == "all":
        return True
    phase_created = getattr(element, "phase_created", None) or "existing"
    phase_demolished = getattr(element, "phase_demolished", None)
    if phase_filter == "existing":
        return phase_created == "existing" and phase_demolished is None
    if phase_filter == "demolition":
        return phase_demolished == "demolition"
    if phase_filter == "new":
        return phase_created == "new"
    return True


def _passes_design_option_filter(
    element: Element,
    option_locks: Mapping[str, str],
    primary_options: Mapping[str, str],
) -> bool:
    option_set_id = getattr(element, "option_set_id", None)
    option_id = getattr(element, "option_id", None)
    if not option_set_id:
        return True
    selected = option_locks.get(str(option_set_id)) or primary_options.get(str(option_set_id))
    if selected is None:
        return True
    return str(option_id or "") == selected


def _primary_options_by_set(design_option_sets: Iterable[Any]) -> dict[str, str]:
    primary_options: dict[str, str] = {}
    for option_set in design_option_sets:
        set_id = _field(option_set, "id")
        if not set_id:
            continue
        for option in _field(option_set, "options", default=[]) or []:
            if bool(_field(option, "is_primary", "isPrimary", default=False)):
                option_id = _field(option, "id")
                if option_id:
                    primary_options[str(set_id)] = str(option_id)
                break
    return primary_options


def _field(obj: Any, *names: str, default: Any = None) -> Any:
    for name in names:
        if isinstance(obj, Mapping) and name in obj:
            return obj[name]
        if hasattr(obj, name):
            return getattr(obj, name)
    return default
