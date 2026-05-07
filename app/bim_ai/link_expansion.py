"""FED-01: snapshot expansion for ``link_model`` elements.

When a host model's snapshot is requested with ``?expandLinks=true``, the
server inlines each linked source model's elements with provenance markers and
applies the link's ``positionMm`` / ``rotationDeg`` transform to coordinates so
existing renderers can ghost the geometry without bespoke matrix logic.

This module is pure-data: it takes a host ``Document`` plus a callable that
resolves source model documents from UUIDs, and returns the expanded elements
dict (host elements + transformed source elements with provenance markers).
"""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    LinkModelElem,
    ProjectBasePointElem,
    SurveyPointElem,
)

LINKED_FROM_LINK_ID_KEY = "_linkedFromLinkId"
LINKED_FROM_ELEMENT_ID_KEY = "_linkedFromElementId"
LINKED_FROM_MODEL_ID_KEY = "_linkedFromModelId"
LINKED_VISIBILITY_MODE_KEY = "_linkedVisibilityMode"

# Field names whose value is a {xMm, yMm} (2D) point. Walls' start/end use the
# semantic names ``start``/``end``; outlines and similar use the suffix
# ``Mm``. The recursive walk treats any dict carrying ``xMm``+``yMm`` (and
# optionally ``zMm``) as a transformable point, so this list is just a hint
# for documentation.
_KNOWN_2D_POINT_KEYS: frozenset[str] = frozenset(
    {
        "start",
        "end",
        "lineStartMm",
        "lineEndMm",
        "aMm",
        "bMm",
        "origin",
    }
)

SourceDocProvider = Callable[[str, int | None], Document | None]


def _rotate_xy_mm(x: float, y: float, sin_a: float, cos_a: float) -> tuple[float, float]:
    return (x * cos_a - y * sin_a, x * sin_a + y * cos_a)


def _apply_transform(
    value: Any, sin_a: float, cos_a: float, dx: float, dy: float, dz: float
) -> Any:
    """Recursively walk ``value`` and transform any 2D/3D ``Mm`` point dicts.

    A point dict is recognised by the presence of both ``xMm`` and ``yMm``
    numeric fields; ``zMm`` is optional. Other keys are preserved.
    """

    if isinstance(value, dict):
        x = value.get("xMm")
        y = value.get("yMm")
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            rx, ry = _rotate_xy_mm(float(x), float(y), sin_a, cos_a)
            out = dict(value)
            out["xMm"] = rx + dx
            out["yMm"] = ry + dy
            z = value.get("zMm")
            if isinstance(z, (int, float)):
                out["zMm"] = float(z) + dz
            # Walk remaining nested values.
            for k, v in value.items():
                if k in {"xMm", "yMm", "zMm"}:
                    continue
                out[k] = _apply_transform(v, sin_a, cos_a, dx, dy, dz)
            return out
        return {k: _apply_transform(v, sin_a, cos_a, dx, dy, dz) for k, v in value.items()}
    if isinstance(value, list):
        return [_apply_transform(v, sin_a, cos_a, dx, dy, dz) for v in value]
    return value


def _prefix_id(link_id: str, source_element_id: str) -> str:
    return f"{link_id}::{source_element_id}"


def _rewire_element_id_refs(elem: dict[str, Any], link_id: str) -> dict[str, Any]:
    """Rewire id-cross-references inside a source element so they resolve to
    their linked counterparts in the host snapshot.

    The rewire is conservative: any string field whose key is named
    ``*Id`` / ``*Ids`` (e.g. ``levelId``, ``wallId``, ``elementIds``) is
    rewritten to the prefixed form. This covers all current cross-element
    relationships without enumerating each kind. Top-level ``id`` and the
    provenance markers are excluded from the rewire.
    """

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            out: dict[str, Any] = {}
            for k, v in node.items():
                if k in {
                    "id",
                    LINKED_FROM_LINK_ID_KEY,
                    LINKED_FROM_ELEMENT_ID_KEY,
                    LINKED_FROM_MODEL_ID_KEY,
                }:
                    out[k] = v
                    continue
                if isinstance(v, str) and (k.endswith("Id") or k.endswith("_id")):
                    out[k] = _prefix_id(link_id, v)
                elif isinstance(v, list) and (k.endswith("Ids") or k.endswith("_ids")):
                    out[k] = [_prefix_id(link_id, s) if isinstance(s, str) else walk(s) for s in v]
                else:
                    out[k] = walk(v)
            return out
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(elem)  # type: ignore[no-any-return]


def _find_pbp(doc: Document) -> ProjectBasePointElem | None:
    for elem in doc.elements.values():
        if isinstance(elem, ProjectBasePointElem):
            return elem
    return None


def _find_survey_point(doc: Document) -> SurveyPointElem | None:
    for elem in doc.elements.values():
        if isinstance(elem, SurveyPointElem):
            return elem
    return None


def _resolve_alignment_offset(
    link: LinkModelElem,
    host_doc: Document,
    src_doc: Document,
) -> tuple[float, float, float, float]:
    """Resolve (dx, dy, dz, rotation_deg) for a link's transform.

    For ``project_origin``: align source PBP to host PBP, then offset by the
    link's `positionMm`; rotation = link.rotation + (host.trueNorth -
    source.trueNorth). For ``shared_coords``: align source survey point to
    host survey point, including ``sharedElevationMm`` reconciliation. Falls
    back to ``origin_to_origin`` semantics if the required anchor is missing.
    """

    base_dx = link.position_mm.x_mm
    base_dy = link.position_mm.y_mm
    base_dz = link.position_mm.z_mm
    rot = float(link.rotation_deg)

    mode = link.origin_alignment_mode
    if mode == "origin_to_origin":
        return base_dx, base_dy, base_dz, rot

    if mode == "project_origin":
        host_pbp = _find_pbp(host_doc)
        src_pbp = _find_pbp(src_doc)
        if host_pbp is None or src_pbp is None:
            return base_dx, base_dy, base_dz, rot
        ax = host_pbp.position_mm.x_mm - src_pbp.position_mm.x_mm
        ay = host_pbp.position_mm.y_mm - src_pbp.position_mm.y_mm
        az = host_pbp.position_mm.z_mm - src_pbp.position_mm.z_mm
        rot_delta = host_pbp.angle_to_true_north_deg - src_pbp.angle_to_true_north_deg
        return base_dx + ax, base_dy + ay, base_dz + az, rot + rot_delta

    if mode == "shared_coords":
        host_sp = _find_survey_point(host_doc)
        src_sp = _find_survey_point(src_doc)
        if host_sp is None or src_sp is None:
            return base_dx, base_dy, base_dz, rot
        ax = host_sp.position_mm.x_mm - src_sp.position_mm.x_mm
        ay = host_sp.position_mm.y_mm - src_sp.position_mm.y_mm
        az = host_sp.position_mm.z_mm - src_sp.position_mm.z_mm
        # Reconcile shared elevation: if both define a sharedElevationMm,
        # add the delta to z so source elevations register at host's datum.
        az += host_sp.shared_elevation_mm - src_sp.shared_elevation_mm
        return base_dx + ax, base_dy + ay, base_dz + az, rot

    return base_dx, base_dy, base_dz, rot


def expand_links(
    host_doc: Document,
    host_elements_wire: dict[str, dict[str, Any]],
    source_provider: SourceDocProvider,
) -> dict[str, dict[str, Any]]:
    """Return a new dict of host elements + inlined transformed source elements.

    ``host_elements_wire`` is the host's already-serialised element dict (the
    same shape the snapshot route returns). The source provider is a callable
    that, given ``(source_model_id_uuid_str, source_revision_or_None)``,
    returns the source ``Document`` (or ``None`` if it's missing).

    Linked elements are keyed by ``"<link_id>::<source_element_id>"`` and
    carry provenance markers ``_linkedFromLinkId`` / ``_linkedFromElementId``
    / ``_linkedFromModelId``.
    """

    expanded: dict[str, dict[str, Any]] = dict(host_elements_wire)

    for elem in host_doc.elements.values():
        if not isinstance(elem, LinkModelElem):
            continue
        if elem.hidden:
            # Hidden links are still listed in the host but we don't pay the
            # source-load cost for them.
            continue
        src_doc = source_provider(elem.source_model_id, elem.source_model_revision)
        if src_doc is None:
            continue

        dx, dy, dz, rot_deg = _resolve_alignment_offset(elem, host_doc, src_doc)
        rad = math.radians(rot_deg)
        sin_a = math.sin(rad)
        cos_a = math.cos(rad)

        for src_id, src_elem in src_doc.elements.items():
            # Don't inline another link's row recursively (avoids transitive
            # blowup in the load-bearing slice — single-hop only).
            if isinstance(src_elem, LinkModelElem):
                continue
            wire = src_elem.model_dump(by_alias=True)
            wire = _rewire_element_id_refs(wire, elem.id)
            wire = _apply_transform(wire, sin_a, cos_a, dx, dy, dz)
            wire["id"] = _prefix_id(elem.id, src_id)
            wire[LINKED_FROM_LINK_ID_KEY] = elem.id
            wire[LINKED_FROM_ELEMENT_ID_KEY] = src_id
            wire[LINKED_FROM_MODEL_ID_KEY] = elem.source_model_id
            wire[LINKED_VISIBILITY_MODE_KEY] = elem.visibility_mode
            expanded[wire["id"]] = wire

    return expanded
