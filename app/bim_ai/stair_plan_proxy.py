"""Stair plan/section proxy counts aligned with level rise (WP-B05 slice)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, StairElem


def stair_riser_count_plan_proxy(doc: Document, stair: StairElem, *, run_length_mm: float) -> int:
    """Interior division count along the stair run (2–36) for plan/section hints.

    When base and top levels resolve, uses ``round(rise_mm / riser_mm)`` so tread lines
    match the modeled story height. Otherwise falls back to run length / tread depth.
    """
    bl = doc.elements.get(stair.base_level_id)
    tl = doc.elements.get(stair.top_level_id)
    if isinstance(bl, LevelElem) and isinstance(tl, LevelElem):
        rise_mm = abs(float(tl.elevation_mm) - float(bl.elevation_mm))
        if rise_mm > 1e-3:
            r = float(stair.riser_mm)
            if r > 1e-6:
                n = int(round(rise_mm / r))
                return max(2, min(36, n))

    t = float(stair.tread_mm)
    if t > 1e-6 and run_length_mm > 1e-6:
        n2 = int(round(run_length_mm / t))
        return max(2, min(36, n2))

    return 2
