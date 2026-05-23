"""Shared dict-schema constants used across registry submodules.

Extracted from registry.py (BRT-25). Defines cross-group dict literals so
geometry/mep/documentation submodules can reference identical objects without
duplicating definitions.
"""

from __future__ import annotations

from typing import Any

_POINT_2_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["xMm", "yMm"],
    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
    "additionalProperties": False,
}

_SHEET_VIEWPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["viewportId", "viewRef", "xMm", "yMm", "widthMm", "heightMm"],
    "properties": {
        "viewportId": {"type": "string"},
        "viewRef": {
            "type": "string",
            "description": "Stable reference such as plan:<id>, section:<id>, elevation:<id>, schedule:<id>.",
        },
        "label": {"type": "string"},
        "xMm": {"type": "number"},
        "yMm": {"type": "number"},
        "widthMm": {"type": "number", "exclusiveMinimum": 0},
        "heightMm": {"type": "number", "exclusiveMinimum": 0},
        "cropMinMm": _POINT_2_SCHEMA,
        "cropMaxMm": _POINT_2_SCHEMA,
    },
    "additionalProperties": True,
}

_CMD_V3_BUNDLE_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SemanticAuthoringBundle",
    "type": "object",
    "required": ["operation", "commands", "metadata"],
    "properties": {
        "operation": {"type": "string"},
        "commands": {"type": "array", "items": {"type": "object"}},
        "todo": {"type": "array", "items": {"type": "object"}},
        "metadata": {"type": "object"},
    },
}
