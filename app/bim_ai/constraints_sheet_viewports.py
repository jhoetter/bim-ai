from __future__ import annotations

from typing import Any

# Sheet mm rectangle for schedule_sheet_viewport_missing upsertSheetViewports quick-fix.
SCHEDULE_VIEWPORT_AUTOPLACE_X_MM = 800.0
SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM = 800.0
SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM = 14_000.0
SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM = 9000.0

# Degenerate viewport quick-fix clamps for deterministic replay.
SHEET_VIEWPORT_MIN_SIDE_MM = 10.0
SHEET_DEFAULT_TITLEBLOCK_SYMBOL = "A1"


def viewport_dimension_mm(vp: dict[str, Any], camel_key: str, snake_key: str) -> float | None:
    raw = vp.get(camel_key)
    if raw is None:
        raw = vp.get(snake_key)
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    return None


def repair_sheet_viewport_extents_inplace_rows(
    rows: list[Any],
) -> tuple[list[Any], bool]:
    """Clone viewport rows; clamp invalid or non-positive width/heightMm dict entries."""

    repaired: list[Any] = []
    changed = False
    for vp in rows:
        if not isinstance(vp, dict):
            repaired.append(vp)
            continue
        out = dict(vp)
        w = viewport_dimension_mm(out, "widthMm", "width_mm")
        h = viewport_dimension_mm(out, "heightMm", "height_mm")
        if w is None or w <= 0:
            out["widthMm"] = SHEET_VIEWPORT_MIN_SIDE_MM
            changed = True
        if h is None or h <= 0:
            out["heightMm"] = SHEET_VIEWPORT_MIN_SIDE_MM
            changed = True
        repaired.append(out)
    return repaired, changed


def sheet_viewport_zero_extent_labels(rows: list[Any]) -> list[str]:
    labels: list[str] = []
    for idx, vp in enumerate(rows):
        if not isinstance(vp, dict):
            continue
        w = viewport_dimension_mm(vp, "widthMm", "width_mm")
        h = viewport_dimension_mm(vp, "heightMm", "height_mm")
        bad = ((w is None) or (w <= 0)) or ((h is None) or (h <= 0))
        if not bad:
            continue
        vid = vp.get("viewportId") or vp.get("viewport_id")
        if isinstance(vid, str) and vid.strip():
            labels.append(vid.strip())
        else:
            labels.append(f"idx={idx}")
    labels.sort()
    return labels
