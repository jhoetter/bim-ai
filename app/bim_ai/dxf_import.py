"""FED-04 — DXF underlay parser.

Parses a 2D DXF site plan with ``ezdxf`` and emits a list of dicts that
match :class:`bim_ai.elements.DxfLineworkPrim` (lines, polylines, arcs).
The parser auto-scales coordinates to millimetres using the DXF
``$INSUNITS`` header so the resulting linework lives in the host model's
canonical units.

Out of scope: hatches, text, dimensions, blocks, 3D entities (``3DFACE``,
``3DSOLID``, ``MESH``, …). They are skipped silently. A follow-up WP can
broaden coverage if customers ask for hatching or annotation.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import ezdxf

# DXF $INSUNITS code → millimetre conversion factor.
# Reference: https://ezdxf.readthedocs.io/en/stable/concepts/units.html
# 0 = unitless; treat as mm so existing mm-authored files pass through.
_INSUNITS_TO_MM: dict[int, float] = {
    0: 1.0,
    1: 25.4,  # inches
    2: 304.8,  # feet
    3: 1609344.0,  # miles
    4: 1.0,  # millimetres
    5: 10.0,  # centimetres
    6: 1000.0,  # metres
    7: 1_000_000.0,  # kilometres
    8: 25.4e-6,  # microinches
    9: 25.4e-3,  # mils
    10: 914.4,  # yards
    11: 1.0e-7,  # angstroms
    12: 1.0e-6,  # nanometres
    13: 1.0e-3,  # micrometres
    14: 100.0,  # decimetres
    15: 10000.0,  # decametres
    16: 100_000.0,  # hectometres
    17: 1.0e9,  # gigametres
    20: 0.3048,  # US survey feet
}

_SKIPPED_DXF_TYPES: set[str] = {
    "3DFACE",
    "3DSOLID",
    "BODY",
    "MESH",
    "REGION",
    "SOLID",
    "TEXT",
    "MTEXT",
    "HATCH",
    "DIMENSION",
    "INSERT",
    "ATTDEF",
    "ATTRIB",
    "IMAGE",
    "WIPEOUT",
}


def _scale_factor_from_insunits(insunits: Any) -> float:
    try:
        code = int(insunits)
    except (TypeError, ValueError):
        return 1.0
    return _INSUNITS_TO_MM.get(code, 1.0)


def _vec2(x: float, y: float, scale: float) -> dict[str, float]:
    return {"xMm": float(x) * scale, "yMm": float(y) * scale}


def _line_to_prim(entity: Any, scale: float) -> dict[str, Any]:
    start = entity.dxf.start
    end = entity.dxf.end
    return {
        "kind": "line",
        "start": _vec2(start.x, start.y, scale),
        "end": _vec2(end.x, end.y, scale),
    }


def _lwpolyline_to_prim(entity: Any, scale: float) -> dict[str, Any]:
    pts: list[dict[str, float]] = []
    for x, y, *_rest in entity.get_points("xy"):
        pts.append(_vec2(x, y, scale))
    return {
        "kind": "polyline",
        "points": pts,
        "closed": bool(entity.is_closed),
    }


def _polyline_to_prim(entity: Any, scale: float) -> dict[str, Any] | None:
    is_3d = bool(getattr(entity, "is_3d_polyline", False))
    if is_3d:
        return None
    pts: list[dict[str, float]] = []
    for vertex in entity.vertices:
        loc = vertex.dxf.location
        pts.append(_vec2(loc.x, loc.y, scale))
    if not pts:
        return None
    return {
        "kind": "polyline",
        "points": pts,
        "closed": bool(getattr(entity, "is_closed", False)),
    }


def _arc_to_prim(entity: Any, scale: float) -> dict[str, Any]:
    centre = entity.dxf.center
    radius = float(entity.dxf.radius) * scale
    return {
        "kind": "arc",
        "center": _vec2(centre.x, centre.y, scale),
        "radiusMm": radius,
        "startDeg": float(entity.dxf.start_angle),
        "endDeg": float(entity.dxf.end_angle),
    }


def _circle_to_prim(entity: Any, scale: float) -> dict[str, Any]:
    centre = entity.dxf.center
    radius = float(entity.dxf.radius) * scale
    return {
        "kind": "arc",
        "center": _vec2(centre.x, centre.y, scale),
        "radiusMm": radius,
        "startDeg": 0.0,
        "endDeg": 360.0,
    }


def parse_dxf_to_linework(path: Path) -> list[dict[str, Any]]:
    """Parse the modelspace of a DXF file into a list of ``DxfLineworkPrim`` dicts.

    Coordinates are returned in **millimetres**, after applying the file's
    ``$INSUNITS`` header (default: assume the DXF is already mm). 3D-only
    entities, hatches, dimensions, text, and blocks are skipped silently.
    """
    doc = ezdxf.readfile(str(path))
    insunits = doc.header.get("$INSUNITS", 0)
    scale = _scale_factor_from_insunits(insunits)

    linework: list[dict[str, Any]] = []
    for entity in doc.modelspace():
        dxftype = entity.dxftype()
        try:
            if dxftype == "LINE":
                linework.append(_line_to_prim(entity, scale))
            elif dxftype == "LWPOLYLINE":
                linework.append(_lwpolyline_to_prim(entity, scale))
            elif dxftype == "POLYLINE":
                prim = _polyline_to_prim(entity, scale)
                if prim is not None:
                    linework.append(prim)
            elif dxftype == "ARC":
                arc = _arc_to_prim(entity, scale)
                if math.isfinite(arc["radiusMm"]) and arc["radiusMm"] > 0:
                    linework.append(arc)
            elif dxftype == "CIRCLE":
                circle = _circle_to_prim(entity, scale)
                if math.isfinite(circle["radiusMm"]) and circle["radiusMm"] > 0:
                    linework.append(circle)
        except (AttributeError, ValueError):
            continue

    return linework


def build_link_dxf_payload(
    file_path: Path,
    level_id: str,
    origin_mm: dict[str, float] | None = None,
    rotation_deg: float = 0.0,
    scale_factor: float = 1.0,
) -> dict[str, Any]:
    """Build the ``createLinkDxf`` engine-command payload from a DXF file."""
    linework = parse_dxf_to_linework(file_path)
    if origin_mm is None:
        origin_mm = {"xMm": 0.0, "yMm": 0.0}
    return {
        "type": "createLinkDxf",
        "name": "DXF Underlay",
        "levelId": level_id,
        "originMm": origin_mm,
        "rotationDeg": float(rotation_deg),
        "scaleFactor": float(scale_factor),
        "linework": linework,
    }
