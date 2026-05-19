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
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf import colors as ezdxf_colors

from bim_ai.site_georeferencing_integrity import import_diagnostic_report_v1

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

_UNIT_OVERRIDE_TO_INSUNITS: dict[str, int] = {
    "unitless": 0,
    "inches": 1,
    "feet": 2,
    "millimeters": 4,
    "millimetres": 4,
    "centimeters": 5,
    "centimetres": 5,
    "meters": 6,
    "metres": 6,
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

_SUPPORTED_DXF_TYPES: set[str] = {"LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE"}


def _scale_factor_from_insunits(insunits: Any) -> float:
    try:
        code = int(insunits)
    except (TypeError, ValueError):
        return 1.0
    return _INSUNITS_TO_MM.get(code, 1.0)


def _scale_factor_from_unit_override(unit_override: Any) -> float | None:
    if unit_override is None:
        return None
    if isinstance(unit_override, str):
        raw = unit_override.strip().lower()
        if raw in {"", "source", "auto", "insunits"}:
            return None
        if raw in _UNIT_OVERRIDE_TO_INSUNITS:
            return _scale_factor_from_insunits(_UNIT_OVERRIDE_TO_INSUNITS[raw])
        try:
            return _scale_factor_from_insunits(int(raw))
        except ValueError:
            raise ValueError(f"unsupported DXF unit override: {unit_override}") from None
    return _scale_factor_from_insunits(unit_override)


def _effective_scale_factor(doc: Any, unit_override: Any = None) -> float:
    override_scale = _scale_factor_from_unit_override(unit_override)
    if override_scale is not None:
        return override_scale
    return _scale_factor_from_insunits(doc.header.get("$INSUNITS", 0))


def _vec2(x: float, y: float, scale: float) -> dict[str, float]:
    return {"xMm": float(x) * scale, "yMm": float(y) * scale}


_ACI_FALLBACK_HEX: dict[int, str] = {
    1: "#ff0000",
    2: "#ffff00",
    3: "#00ff00",
    4: "#00ffff",
    5: "#0000ff",
    6: "#ff00ff",
    7: "#ffffff",
}


def _aci_to_hex(aci: Any) -> str | None:
    try:
        aci_int = abs(int(aci))
    except (TypeError, ValueError):
        return None
    if aci_int <= 0 or aci_int >= 256:
        return None
    try:
        rgb = ezdxf_colors.aci2rgb(aci_int)
        if hasattr(rgb, "r"):
            r, g, b = rgb.r, rgb.g, rgb.b
        else:
            r, g, b = rgb[0], rgb[1], rgb[2]
        return f"#{int(r):02x}{int(g):02x}{int(b):02x}"
    except (AttributeError, IndexError, KeyError, TypeError, ValueError):
        return _ACI_FALLBACK_HEX.get(aci_int)


def _layer_color_hex(doc: Any, layer_name: str) -> str | None:
    try:
        layer = doc.layers.get(layer_name)
    except (AttributeError, KeyError):
        return None
    return _aci_to_hex(getattr(layer.dxf, "color", None))


def _entity_layer_meta(entity: Any, doc: Any) -> dict[str, str]:
    layer_name = str(getattr(entity.dxf, "layer", "") or "0")
    color = _layer_color_hex(doc, layer_name)
    return {
        "layerName": layer_name,
        **({"layerColor": color} if color else {}),
    }


def _entity_layer_name(entity: Any) -> str:
    try:
        return str(getattr(entity.dxf, "layer", "") or "0")
    except AttributeError:
        return "0"


def _line_to_prim(entity: Any, scale: float, doc: Any) -> dict[str, Any]:
    start = entity.dxf.start
    end = entity.dxf.end
    return {
        "kind": "line",
        "start": _vec2(start.x, start.y, scale),
        "end": _vec2(end.x, end.y, scale),
        **_entity_layer_meta(entity, doc),
    }


def _lwpolyline_to_prim(entity: Any, scale: float, doc: Any) -> dict[str, Any]:
    pts: list[dict[str, float]] = []
    for x, y, *_rest in entity.get_points("xy"):
        pts.append(_vec2(x, y, scale))
    return {
        "kind": "polyline",
        "points": pts,
        "closed": bool(entity.is_closed),
        **_entity_layer_meta(entity, doc),
    }


def _polyline_to_prim(entity: Any, scale: float, doc: Any) -> dict[str, Any] | None:
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
        **_entity_layer_meta(entity, doc),
    }


def _arc_to_prim(entity: Any, scale: float, doc: Any) -> dict[str, Any]:
    centre = entity.dxf.center
    radius = float(entity.dxf.radius) * scale
    return {
        "kind": "arc",
        "center": _vec2(centre.x, centre.y, scale),
        "radiusMm": radius,
        "startDeg": float(entity.dxf.start_angle),
        "endDeg": float(entity.dxf.end_angle),
        **_entity_layer_meta(entity, doc),
    }


def _circle_to_prim(entity: Any, scale: float, doc: Any) -> dict[str, Any]:
    centre = entity.dxf.center
    radius = float(entity.dxf.radius) * scale
    return {
        "kind": "arc",
        "center": _vec2(centre.x, centre.y, scale),
        "radiusMm": radius,
        "startDeg": 0.0,
        "endDeg": 360.0,
        **_entity_layer_meta(entity, doc),
    }


def collect_dxf_layers(linework: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return stable per-layer metadata derived from parsed linework."""
    layers: dict[str, dict[str, Any]] = {}
    for prim in linework:
        name = str(prim.get("layerName") or "0")
        row = layers.setdefault(
            name,
            {"name": name, "primitiveCount": 0},
        )
        row["primitiveCount"] += 1
        color = prim.get("layerColor")
        if isinstance(color, str) and color and "color" not in row:
            row["color"] = color
    return sorted(layers.values(), key=lambda row: row["name"].casefold())


def dxf_source_metadata(path: Path) -> dict[str, Any]:
    """Return stable source-file metadata stored on reloadable linked DXFs."""
    stat = path.stat()
    return {
        "path": str(path),
        "fileName": path.name,
        "sizeBytes": stat.st_size,
        "mtimeMs": int(stat.st_mtime * 1000),
        "loadedAt": datetime.now(UTC).isoformat(),
    }


def parse_dxf_to_linework_with_scale(
    path: Path,
    unit_override: Any = None,
) -> tuple[list[dict[str, Any]], float]:
    """Parse the modelspace of a DXF file into a list of ``DxfLineworkPrim`` dicts.

    Coordinates are returned in **millimetres**, after applying the file's
    ``$INSUNITS`` header (default: assume the DXF is already mm) or the
    caller's import-time unit override. 3D-only entities, hatches,
    dimensions, text, and blocks are skipped silently.
    """
    linework, scale, _diagnostics = parse_dxf_to_linework_with_diagnostics(
        path,
        unit_override=unit_override,
    )
    return linework, scale


def parse_dxf_to_linework_with_diagnostics(
    path: Path,
    unit_override: Any = None,
) -> tuple[list[dict[str, Any]], float, dict[str, Any]]:
    """Parse DXF linework and return deterministic import/readback diagnostics."""

    doc = ezdxf.readfile(str(path))
    scale = _effective_scale_factor(doc, unit_override)

    linework: list[dict[str, Any]] = []
    parsed_counts: dict[str, int] = {}
    skipped_counts: dict[str, int] = {}
    skipped_rows: list[dict[str, Any]] = []

    def record_parsed(kind: str) -> None:
        parsed_counts[kind] = parsed_counts.get(kind, 0) + 1

    def record_skipped(entity: Any, dxftype: str, reason: str) -> None:
        layer_name = _entity_layer_name(entity)
        skipped_counts[dxftype] = skipped_counts.get(dxftype, 0) + 1
        skipped_rows.append(
            {
                "sourceEntityType": dxftype,
                "layerName": layer_name,
                "reasonCode": reason,
            }
        )

    for entity in doc.modelspace():
        dxftype = entity.dxftype()
        try:
            if dxftype == "LINE":
                linework.append(_line_to_prim(entity, scale, doc))
                record_parsed("line")
            elif dxftype == "LWPOLYLINE":
                linework.append(_lwpolyline_to_prim(entity, scale, doc))
                record_parsed("polyline")
            elif dxftype == "POLYLINE":
                prim = _polyline_to_prim(entity, scale, doc)
                if prim is not None:
                    linework.append(prim)
                    record_parsed("polyline")
                else:
                    record_skipped(entity, dxftype, "unsupported_3d_polyline")
            elif dxftype == "ARC":
                arc = _arc_to_prim(entity, scale, doc)
                if math.isfinite(arc["radiusMm"]) and arc["radiusMm"] > 0:
                    linework.append(arc)
                    record_parsed("arc")
                else:
                    record_skipped(entity, dxftype, "invalid_arc_radius")
            elif dxftype == "CIRCLE":
                circle = _circle_to_prim(entity, scale, doc)
                if math.isfinite(circle["radiusMm"]) and circle["radiusMm"] > 0:
                    linework.append(circle)
                    record_parsed("arc")
                else:
                    record_skipped(entity, dxftype, "invalid_circle_radius")
            elif dxftype in _SKIPPED_DXF_TYPES:
                record_skipped(entity, dxftype, "unsupported_entity_type")
            elif dxftype not in _SUPPORTED_DXF_TYPES:
                record_skipped(entity, dxftype, "unsupported_entity_type")
        except (AttributeError, ValueError):
            record_skipped(entity, dxftype, "parse_error")

    diagnostics = build_dxf_import_readback_contract_v1(
        path=path,
        unit_override=unit_override,
        unit_scale_to_mm=scale,
        linework=linework,
        parsed_counts=parsed_counts,
        skipped_rows=skipped_rows,
        skipped_counts=skipped_counts,
    )
    return linework, scale, diagnostics


def build_dxf_import_readback_contract_v1(
    *,
    path: Path,
    unit_override: Any = None,
    unit_scale_to_mm: float,
    linework: list[dict[str, Any]],
    parsed_counts: dict[str, int],
    skipped_rows: list[dict[str, Any]],
    skipped_counts: dict[str, int],
) -> dict[str, Any]:
    """Machine-readable DXF import/readback contract for exchange gates."""

    import_rows: list[dict[str, Any]] = []
    for source_type in sorted(skipped_counts):
        affected_layers = sorted(
            {
                str(row.get("layerName") or "0")
                for row in skipped_rows
                if row.get("sourceEntityType") == source_type
            }
        )
        import_rows.append(
            {
                "code": "dxf.unsupported_entity_skipped",
                "category": "unsupported_product",
                "severity": "warning",
                "message": f"DXF {source_type} entities are not mapped to BIM linework.",
                "sourceCategory": source_type,
                "mappedCategory": "dxf_linework",
                "mappingSupported": False,
                "fallbackCategory": "skipped",
                "expected": "supported 2D LINE/LWPOLYLINE/POLYLINE/ARC/CIRCLE",
                "actual": source_type,
                "elementIds": [f"layer:{layer}" for layer in affected_layers],
            }
        )
    if unit_scale_to_mm != 1.0 or unit_override not in (None, "", "source", "auto", "insunits"):
        import_rows.append(
            {
                "code": "dxf.unit_normalization",
                "category": "unit_normalization",
                "severity": "info",
                "message": "DXF coordinates were normalized to millimetres.",
                "expected": "host model millimetres",
                "actual": f"unitScaleToMm={unit_scale_to_mm}",
            }
        )

    import_contract = import_diagnostic_report_v1(
        import_rows,
        operation_id=f"dxf-import:{path.name}",
        source_name=path.name,
    )
    return {
        "format": "dxfImportReadbackContract_v1",
        "sourceFormat": "dxf",
        "sourceName": path.name,
        "unitOverride": unit_override,
        "unitScaleToMm": unit_scale_to_mm,
        "parsedPrimitiveCount": len(linework),
        "parsedPrimitiveCountsByKind": dict(sorted(parsed_counts.items())),
        "unsupportedSkippedCount": len(skipped_rows),
        "unsupportedSkippedCountsByEntityType": dict(sorted(skipped_counts.items())),
        "unsupportedSkippedEntities": sorted(
            skipped_rows,
            key=lambda row: (
                str(row.get("sourceEntityType") or ""),
                str(row.get("layerName") or ""),
                str(row.get("reasonCode") or ""),
            ),
        ),
        "importDiagnosticContract_v1": import_contract,
        "ok": import_contract["ok"],
    }


def parse_dxf_to_linework(path: Path, unit_override: Any = None) -> list[dict[str, Any]]:
    return parse_dxf_to_linework_with_scale(path, unit_override=unit_override)[0]


def build_link_dxf_payload(
    file_path: Path,
    level_id: str,
    origin_mm: dict[str, float] | None = None,
    origin_alignment_mode: str = "origin_to_origin",
    unit_override: Any = None,
    rotation_deg: float = 0.0,
    scale_factor: float = 1.0,
    color_mode: str = "black_white",
    custom_color: str | None = None,
    overlay_opacity: float = 0.5,
    hidden_layer_names: list[str] | None = None,
) -> dict[str, Any]:
    """Build the ``createLinkDxf`` engine-command payload from a DXF file."""
    linework, unit_scale_to_mm = parse_dxf_to_linework_with_scale(
        file_path,
        unit_override=unit_override,
    )
    if origin_mm is None:
        origin_mm = {"xMm": 0.0, "yMm": 0.0}
    return {
        "type": "createLinkDxf",
        "name": "DXF Underlay",
        "levelId": level_id,
        "originMm": origin_mm,
        "originAlignmentMode": origin_alignment_mode,
        "unitOverride": unit_override,
        "unitScaleToMm": unit_scale_to_mm,
        "rotationDeg": float(rotation_deg),
        "scaleFactor": float(scale_factor),
        "linework": linework,
        "dxfLayers": collect_dxf_layers(linework),
        "hiddenLayerNames": hidden_layer_names or [],
        "sourcePath": str(file_path),
        "cadReferenceType": "linked",
        "sourceMetadata": dxf_source_metadata(file_path),
        "reloadStatus": "ok",
        "lastReloadMessage": f"Loaded from {file_path}",
        "loaded": True,
        "colorMode": color_mode,
        "customColor": custom_color,
        "overlayOpacity": overlay_opacity,
    }
