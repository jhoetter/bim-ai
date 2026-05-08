"""FED-03: Cross-link Copy/Monitor — drift detection + reconcile.

Walks every host element carrying a ``monitor_source`` pointer, finds the
source element (intra-host or through a ``link_model``), and compares the
configured monitored fields. Differences are written back to the host
element's ``monitor_source.drifted`` / ``drifted_fields``; the constraint
evaluator emits a ``monitored_source_drift`` advisory for each drifted
element on the next pass.

Element coverage in v0:

* ``grid_line`` — monitors ``start``, ``end``, ``name``
* ``level`` — monitors ``elevation_mm``, ``name``

Adding a new kind is one entry in ``_MONITORED_FIELDS_BY_KIND``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    Element,
    LinkModelElem,
    MonitorSourceSpec,
)
from bim_ai.link_expansion import SourceDocProvider

_FIELD_EQUAL_TOLERANCE_MM = 1e-3


@dataclass(frozen=True)
class _Field:
    """A monitored field — name + accessor."""

    name: str
    getter: Any  # Callable[[Element], Any]


def _get_attr(name: str):
    return lambda el: getattr(el, name, None)


def _get_vec2_xy(name: str):
    def _get(el: Any) -> tuple[float, float] | None:
        v = getattr(el, name, None)
        if v is None:
            return None
        x = getattr(v, "x_mm", None)
        y = getattr(v, "y_mm", None)
        if x is None or y is None:
            return None
        return (float(x), float(y))

    return _get


_MONITORED_FIELDS_BY_KIND: dict[str, list[_Field]] = {
    "grid_line": [
        _Field("name", _get_attr("name")),
        _Field("start", _get_vec2_xy("start")),
        _Field("end", _get_vec2_xy("end")),
    ],
    "level": [
        _Field("name", _get_attr("name")),
        _Field("elevation_mm", _get_attr("elevation_mm")),
    ],
}


def _values_equal(a: Any, b: Any) -> bool:
    """Tolerant comparison: numeric fields use a small epsilon, tuples are
    compared element-wise with the same epsilon, everything else uses ``==``.
    """

    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) <= _FIELD_EQUAL_TOLERANCE_MM
    if isinstance(a, tuple) and isinstance(b, tuple) and len(a) == len(b):
        return all(_values_equal(x, y) for x, y in zip(a, b, strict=True))
    return a == b


def _resolve_source_doc(
    host_doc: Document,
    monitor_source: MonitorSourceSpec,
    source_provider: SourceDocProvider,
) -> Document | None:
    """Return the document that owns the monitor source, or ``None``.

    For intra-host monitors (``link_id`` is None) the host doc itself is the
    source. For cross-link monitors, the named ``link_model`` is resolved and
    its source document fetched via the provider at the link's pinned
    revision (or latest).
    """

    if not monitor_source.link_id:
        return host_doc
    link = host_doc.elements.get(monitor_source.link_id)
    if not isinstance(link, LinkModelElem):
        return None
    return source_provider(link.source_model_id, link.source_model_revision)


def _source_revision_for(
    host_doc: Document,
    monitor_source: MonitorSourceSpec,
    source_provider: SourceDocProvider,
) -> int | None:
    """Return the source's current revision counter (intra-host = host's
    revision; cross-link = the linked source's revision). ``None`` if the
    source can't be resolved.
    """

    src = _resolve_source_doc(host_doc, monitor_source, source_provider)
    if src is None:
        return None
    return int(src.revision)


def _diff_fields(host_el: Element, src_el: Element, kind: str) -> list[str]:
    """Return the names of monitored fields whose values differ on the two
    elements. Empty list means no drift.
    """

    fields = _MONITORED_FIELDS_BY_KIND.get(kind, [])
    out: list[str] = []
    for f in fields:
        host_val = f.getter(host_el)
        src_val = f.getter(src_el)
        if not _values_equal(host_val, src_val):
            out.append(f.name)
    return out


def _find_source_element(
    src_doc: Document, source_element_id: str
) -> Element | None:
    return src_doc.elements.get(source_element_id)


def bump_monitored_revisions(
    host_doc: Document, source_provider: SourceDocProvider
) -> None:
    """Walk every monitored element in ``host_doc`` and write fresh
    ``drifted`` / ``drifted_fields`` to its ``monitor_source``.

    Mutates the document in place. Elements with unresolvable sources keep
    their existing drift flags untouched (the source is still missing — we
    can't make a confident judgement).
    """

    for elem_id, elem in list(host_doc.elements.items()):
        ms = getattr(elem, "monitor_source", None)
        if not isinstance(ms, MonitorSourceSpec):
            continue
        src_doc = _resolve_source_doc(host_doc, ms, source_provider)
        if src_doc is None:
            continue
        src_el = _find_source_element(src_doc, ms.element_id)
        if src_el is None:
            continue
        kind = getattr(elem, "kind", None)
        if not isinstance(kind, str):
            continue
        drifted_fields = _diff_fields(elem, src_el, kind)
        new_ms = ms.model_copy(
            update={
                "drifted": bool(drifted_fields),
                "drifted_fields": drifted_fields,
            }
        )
        host_doc.elements[elem_id] = elem.model_copy(update={"monitor_source": new_ms})


def _accept_source_updates_for_kind(
    host_el: Element, src_el: Element, kind: str
) -> dict[str, Any]:
    """Return the field-name → value patch needed to make ``host_el`` match
    ``src_el`` on every monitored field. Vector fields are kept as the
    source's pydantic instance so model_copy preserves typing.
    """

    fields = _MONITORED_FIELDS_BY_KIND.get(kind, [])
    patch: dict[str, Any] = {}
    for f in fields:
        if f.name in {"start", "end"}:
            patch[f.name] = getattr(src_el, f.name)
        else:
            patch[f.name] = getattr(src_el, f.name, None)
    return patch


def reconcile_monitored_element(
    host_doc: Document,
    element_id: str,
    mode: str,
    source_provider: SourceDocProvider,
) -> None:
    """Apply the user's choice for one drifted element.

    * ``mode='accept_source'`` — overwrite host fields with the source's
      values, bump ``source_revision_at_copy`` to the source's current
      revision, and clear ``drifted``.
    * ``mode='keep_host'`` — leave host fields untouched, bump
      ``source_revision_at_copy``, and clear ``drifted``.

    Raises ``ValueError`` for unknown elements, missing monitor sources, or
    unresolvable links.
    """

    elem = host_doc.elements.get(element_id)
    if elem is None:
        raise ValueError(f"reconcileMonitoredElement.elementId unknown: '{element_id}'")
    ms = getattr(elem, "monitor_source", None)
    if not isinstance(ms, MonitorSourceSpec):
        raise ValueError(
            f"reconcileMonitoredElement target '{element_id}' has no monitor_source"
        )
    src_doc = _resolve_source_doc(host_doc, ms, source_provider)
    if src_doc is None:
        raise ValueError(
            "reconcileMonitoredElement: could not resolve source for "
            f"link_id={ms.link_id} element_id={ms.element_id}"
        )
    src_el = _find_source_element(src_doc, ms.element_id)
    if src_el is None:
        raise ValueError(
            f"reconcileMonitoredElement: source element '{ms.element_id}' not found"
        )

    new_revision = int(src_doc.revision)
    new_ms = ms.model_copy(
        update={
            "source_revision_at_copy": new_revision,
            "drifted": False,
            "drifted_fields": [],
        }
    )

    kind = getattr(elem, "kind", None)
    if mode == "accept_source" and isinstance(kind, str):
        patch = _accept_source_updates_for_kind(elem, src_el, kind)
        patch["monitor_source"] = new_ms
        host_doc.elements[element_id] = elem.model_copy(update=patch)
        return
    if mode == "keep_host":
        host_doc.elements[element_id] = elem.model_copy(update={"monitor_source": new_ms})
        return
    raise ValueError(f"reconcileMonitoredElement.mode unknown: '{mode}'")


# --- Constraint evaluator entry-point -------------------------------------


def monitored_source_drift_violations(
    elements: dict[str, Element],
) -> list[tuple[str, list[str]]]:
    """Return ``(element_id, drifted_fields)`` for every host element whose
    ``monitor_source.drifted`` is true. Caller wraps these into ``Violation``
    rows; this helper stays pure-data so unit tests can exercise it in
    isolation.
    """

    out: list[tuple[str, list[str]]] = []
    for eid, el in elements.items():
        ms = getattr(el, "monitor_source", None)
        if not isinstance(ms, MonitorSourceSpec):
            continue
        if ms.drifted:
            out.append((eid, list(ms.drifted_fields)))
    return out


__all__ = [
    "bump_monitored_revisions",
    "monitored_source_drift_violations",
    "reconcile_monitored_element",
]
