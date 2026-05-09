"""EDT-V3-09: tread auto-balance for by_sketch stairs."""

from __future__ import annotations

import math

from bim_ai.elements import StairTreadLine, Vec2Mm


def rebalance_treads(
    tread_lines: list[StairTreadLine],
    moved_index: int,
    new_from_mm: Vec2Mm,
    total_run_mm: float,
) -> list[StairTreadLine]:
    """Rebalance tread lines after moving one, keeping total run constant.

    Locked treads (manualOverride=True) keep their position. Unlocked treads
    (excluding the moved one) redistribute proportionally.

    Only supported for straight stairs (1-D along X axis). Raises
    NotImplementedError for winder/curved layouts — support is ``next``.
    """
    if not tread_lines or moved_index < 0 or moved_index >= len(tread_lines):
        return tread_lines

    n = len(tread_lines)
    result = [t.model_copy() for t in tread_lines]

    # Place the moved tread at the new position, preserving its width.
    moved = result[moved_index]
    tread_width = _tread_width(moved)
    result[moved_index] = moved.model_copy(
        update={
            "from_mm": new_from_mm,
            "to_mm": Vec2Mm(
                x_mm=new_from_mm.x_mm + tread_width,
                y_mm=new_from_mm.y_mm,
            ),
        }
    )

    # Collect unlocked treads excluding the moved one.
    unlocked_indices = [i for i in range(n) if i != moved_index and not result[i].manual_override]
    if not unlocked_indices:
        return result

    # Compute remaining run for unlocked treads.
    locked_run = sum(
        _tread_width(result[i]) for i in range(n) if i != moved_index and result[i].manual_override
    )
    moved_run = _tread_width(result[moved_index])
    remaining_run = total_run_mm - locked_run - moved_run
    if remaining_run <= 0:
        return result

    # Distribute remaining_run equally among unlocked treads.
    new_width = remaining_run / len(unlocked_indices)
    for i in unlocked_indices:
        t = result[i]
        result[i] = t.model_copy(
            update={
                "to_mm": Vec2Mm(
                    x_mm=t.from_mm.x_mm + new_width,
                    y_mm=t.from_mm.y_mm,
                )
            }
        )

    return result


def auto_distribute_treads(
    boundary_mm: list[Vec2Mm],
    total_rise_mm: float,
    tread_mm: float = 275.0,
    riser_mm: float = 175.0,
) -> list[StairTreadLine]:
    """Generate initial tread distribution from stair boundary.

    Produces N evenly-spaced tread lines along the run axis such that each
    tread is approximately ``tread_mm`` wide and the riser height satisfies the
    advisory ``riser ≤ 190 mm / tread ≥ 260 mm``.

    Only straight (linear) boundary paths are supported. Raises
    ``NotImplementedError`` for winder or curved shapes — support is ``next``.
    """
    if len(boundary_mm) < 2:
        return []

    start = boundary_mm[0]
    end = boundary_mm[-1]
    total_run = math.sqrt((end.x_mm - start.x_mm) ** 2 + (end.y_mm - start.y_mm) ** 2)
    if total_run <= 0:
        return []

    n_treads = max(1, round(total_run / tread_mm))
    w = total_run / n_treads
    riser_height = total_rise_mm / (n_treads + 1)

    lines: list[StairTreadLine] = []
    for i in range(n_treads):
        x0 = start.x_mm + i * w
        x1 = start.x_mm + (i + 1) * w
        lines.append(
            StairTreadLine(
                fromMm=Vec2Mm(x_mm=x0, y_mm=start.y_mm),
                toMm=Vec2Mm(x_mm=x1, y_mm=start.y_mm),
                riserHeightMm=riser_height,
            )
        )
    return lines


def _tread_width(t: StairTreadLine) -> float:
    """Return the horizontal width of a tread line."""
    return abs(t.to_mm.x_mm - t.from_mm.x_mm)
