"""Axis-aligned plan heuristics for room separation segments (WP-B06 / WP-V01)."""


def axis_aligned_room_separation_splits_rectangle(
    sep_x0: float,
    sep_y0: float,
    sep_x1: float,
    sep_y1: float,
    bx_lo: float,
    bx_hi: float,
    by_lo: float,
    by_hi: float,
    *,
    orth_tol_mm: float = 25.0,
    interior_margin_mm: float = 40.0,
    min_through_mm: float = 120.0,
) -> bool:
    """
    Whether an axis-aligned segment pierces the *interior* of an axis-aligned rectangle,
    implying the separator should logically split occupancy (bounded slice; diagonal seps skipped).
    """
    dx = sep_x1 - sep_x0
    dy = sep_y1 - sep_y0
    if bx_hi <= bx_lo or by_hi <= by_lo:
        return False

    ix_lo = bx_lo + interior_margin_mm
    ix_hi = bx_hi - interior_margin_mm
    iy_lo = by_lo + interior_margin_mm
    iy_hi = by_hi - interior_margin_mm
    if ix_hi <= ix_lo or iy_hi <= iy_lo:
        ix_lo, ix_hi = bx_lo, bx_hi
        iy_lo, iy_hi = by_lo, by_hi

    if abs(dx) < orth_tol_mm:
        xv = float((sep_x0 + sep_x1) / 2.0)
        if not (ix_lo <= xv <= ix_hi):
            return False
        y_lo = min(sep_y0, sep_y1)
        y_hi = max(sep_y0, sep_y1)
        overlap = max(0.0, min(y_hi, by_hi) - max(y_lo, by_lo))
        return overlap >= min_through_mm

    if abs(dy) < orth_tol_mm:
        yv = float((sep_y0 + sep_y1) / 2.0)
        if not (iy_lo <= yv <= iy_hi):
            return False
        x_lo = min(sep_x0, sep_x1)
        x_hi = max(sep_x0, sep_x1)
        overlap = max(0.0, min(x_hi, bx_hi) - max(x_lo, bx_lo))
        return overlap >= min_through_mm

    return False
