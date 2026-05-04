"""Regulatory presets (advisory thresholds; expand per locale)."""

from __future__ import annotations

BUILDING_PRESETS: dict[str, dict[str, float | str]] = {
    "residential": {
        "doorMinMm": 800,
        "corridorMinMm": 1100,
    },
    "commercial": {
        "doorMinMm": 915,
        "corridorMinMm": 1200,
    },
    "office": {
        "doorMinMm": 910,
        "corridorMinMm": 1500,
    },
}
