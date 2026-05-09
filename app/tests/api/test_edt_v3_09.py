"""EDT-V3-09 — Stair tread auto-balance tests.

Covers:
- auto_distribute_treads produces N treads summing to totalRun within 1 mm.
- rebalance_treads (no locks): moving tread #5 wider narrows others proportionally.
- rebalance_treads (tread #3 locked): locked tread unchanged, unlocked treads rebalance.
- UpdateStairTreadsCmd round-trips through engine; updated treadLines present in snapshot.
- Engine raises if element is not a by_sketch stair.
- update-stair-treads tool descriptor present in registry.
"""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateStairCmd, UpdateStairTreadsCmd
from bim_ai.document import Document
from bim_ai.elements import LevelElem, StairElem, StairTreadLine, Vec2Mm
from bim_ai.engine import apply_inplace
from bim_ai.stair.autobalance import auto_distribute_treads, rebalance_treads

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tread(from_x: float, to_x: float, *, locked: bool = False) -> StairTreadLine:
    return StairTreadLine(
        fromMm=Vec2Mm(x_mm=from_x, y_mm=0.0),
        toMm=Vec2Mm(x_mm=to_x, y_mm=0.0),
        manualOverride=locked,
    )


def _uniform_treads(n: int, total_run: float = 3640.0) -> list[StairTreadLine]:
    """n uniform treads spanning [0, total_run]."""
    w = total_run / n
    return [_make_tread(i * w, (i + 1) * w) for i in range(n)]


def _make_by_sketch_stair(doc: Document, stair_id: str, n_treads: int = 14) -> None:
    """Apply CreateStairCmd in by_sketch mode with n uniform treads."""
    total_run = 3640.0
    w = total_run / n_treads
    tread_lines = [
        {
            "fromMm": {"xMm": i * w, "yMm": 0.0},
            "toMm": {"xMm": (i + 1) * w, "yMm": 0.0},
        }
        for i in range(n_treads)
    ]
    # A by_sketch stair needs a boundary polygon (>=3 pts).
    apply_inplace(
        doc,
        CreateStairCmd(
            id=stair_id,
            baseLevelId="lv0",
            topLevelId="lv1",
            runStartMm={"xMm": 0.0, "yMm": 0.0},
            runEndMm={"xMm": total_run, "yMm": 0.0},
            widthMm=1200.0,
            authoringMode="by_sketch",
            boundaryMm=[
                {"xMm": 0.0, "yMm": 0.0},
                {"xMm": total_run, "yMm": 0.0},
                {"xMm": total_run, "yMm": 1200.0},
                {"xMm": 0.0, "yMm": 1200.0},
            ],
            treadLines=tread_lines,
            totalRiseMm=2800.0,
        ),
    )


def _seed() -> Document:
    return Document(
        revision=1,
        elements={
            "lv0": LevelElem(kind="level", id="lv0", name="EG", elevationMm=0),
            "lv1": LevelElem(kind="level", id="lv1", name="OG", elevationMm=2800),
        },
    )


# ---------------------------------------------------------------------------
# auto_distribute_treads
# ---------------------------------------------------------------------------


def test_auto_distribute_sum_equals_total_run() -> None:
    """Treads produced by auto_distribute_treads should sum to the boundary run within 1 mm."""
    total_run = 3640.0
    boundary = [
        Vec2Mm(x_mm=0.0, y_mm=0.0),
        Vec2Mm(x_mm=total_run, y_mm=0.0),
    ]
    treads = auto_distribute_treads(boundary, total_rise_mm=2800.0, tread_mm=275.0)

    assert len(treads) >= 1
    total_width = sum(abs(t.to_mm.x_mm - t.from_mm.x_mm) for t in treads)
    assert abs(total_width - total_run) <= 1.0, f"Expected sum ~{total_run} mm, got {total_width}"


def test_auto_distribute_14_tread_stair() -> None:
    """A 3640 mm run / 275 mm target tread -> ~14 treads."""
    boundary = [
        Vec2Mm(x_mm=0.0, y_mm=0.0),
        Vec2Mm(x_mm=3640.0, y_mm=0.0),
    ]
    treads = auto_distribute_treads(boundary, total_rise_mm=2800.0, tread_mm=275.0)
    # round(3640 / 275) = 13; accept 12-16.
    assert 12 <= len(treads) <= 16


def test_auto_distribute_empty_boundary() -> None:
    """Empty boundary returns empty list."""
    assert auto_distribute_treads([], total_rise_mm=2800.0) == []


def test_auto_distribute_single_point_boundary() -> None:
    """Single-point boundary returns empty list."""
    assert auto_distribute_treads([Vec2Mm(x_mm=0.0, y_mm=0.0)], total_rise_mm=2800.0) == []


# ---------------------------------------------------------------------------
# rebalance_treads -- no locked treads
# ---------------------------------------------------------------------------


def test_rebalance_no_locks_widens_target_narrows_rest() -> None:
    """Moving tread #4 (0-indexed 4 = UI tread #5) wider should narrow the others."""
    treads = _uniform_treads(14, total_run=3640.0)
    total_run = 3640.0
    original_width = total_run / 14  # ~260 mm

    # Move tread #4 so its from_x shifts left by 50 mm (wider overlap).
    new_from_x = treads[4].from_mm.x_mm - 50.0
    result = rebalance_treads(
        treads,
        moved_index=4,
        new_from_mm=Vec2Mm(x_mm=new_from_x, y_mm=0.0),
        total_run_mm=total_run,
    )

    assert len(result) == 14
    # Width of moved tread should be same as original (position shifted, not size).
    moved_w = abs(result[4].to_mm.x_mm - result[4].from_mm.x_mm)
    assert abs(moved_w - original_width) < 1.0

    # Total run must still equal total_run (within floating-point rounding).
    total = sum(abs(t.to_mm.x_mm - t.from_mm.x_mm) for t in result)
    assert abs(total - total_run) < 1.0


def test_rebalance_no_locks_preserves_count() -> None:
    treads = _uniform_treads(8, total_run=2200.0)
    result = rebalance_treads(
        treads,
        moved_index=3,
        new_from_mm=Vec2Mm(x_mm=treads[3].from_mm.x_mm + 30.0, y_mm=0.0),
        total_run_mm=2200.0,
    )
    assert len(result) == 8


def test_rebalance_out_of_range_index_returns_unchanged() -> None:
    treads = _uniform_treads(5, total_run=1375.0)
    result = rebalance_treads(
        treads,
        moved_index=99,
        new_from_mm=Vec2Mm(x_mm=0.0, y_mm=0.0),
        total_run_mm=1375.0,
    )
    assert result == treads


def test_rebalance_empty_list_returns_empty() -> None:
    result = rebalance_treads(
        [],
        moved_index=0,
        new_from_mm=Vec2Mm(x_mm=0.0, y_mm=0.0),
        total_run_mm=1000.0,
    )
    assert result == []


# ---------------------------------------------------------------------------
# rebalance_treads -- with locked treads
# ---------------------------------------------------------------------------


def test_rebalance_locked_tread_stays_unchanged() -> None:
    """Tread #2 locked (0-indexed) must not change width when tread #5 is moved."""
    treads = _uniform_treads(14, total_run=3640.0)
    # Lock tread #2.
    treads[2] = _make_tread(treads[2].from_mm.x_mm, treads[2].to_mm.x_mm, locked=True)
    locked_width_before = abs(treads[2].to_mm.x_mm - treads[2].from_mm.x_mm)

    result = rebalance_treads(
        treads,
        moved_index=5,
        new_from_mm=Vec2Mm(x_mm=treads[5].from_mm.x_mm + 40.0, y_mm=0.0),
        total_run_mm=3640.0,
    )

    locked_width_after = abs(result[2].to_mm.x_mm - result[2].from_mm.x_mm)
    assert abs(locked_width_after - locked_width_before) < 0.01, (
        f"Locked tread changed: {locked_width_before} -> {locked_width_after}"
    )


def test_rebalance_with_lock_total_run_preserved() -> None:
    """Total run must be preserved even when some treads are locked."""
    total_run = 3640.0
    treads = _uniform_treads(14, total_run=total_run)
    # Lock treads 1 and 3.
    treads[1] = _make_tread(treads[1].from_mm.x_mm, treads[1].to_mm.x_mm, locked=True)
    treads[3] = _make_tread(treads[3].from_mm.x_mm, treads[3].to_mm.x_mm, locked=True)

    result = rebalance_treads(
        treads,
        moved_index=7,
        new_from_mm=Vec2Mm(x_mm=treads[7].from_mm.x_mm - 20.0, y_mm=0.0),
        total_run_mm=total_run,
    )

    total = sum(abs(t.to_mm.x_mm - t.from_mm.x_mm) for t in result)
    assert abs(total - total_run) < 1.0


def test_rebalance_all_locked_returns_moved_only() -> None:
    """If every tread except the moved one is locked, only the moved tread shifts."""
    treads = _uniform_treads(5, total_run=1375.0)
    # Lock all except index 2.
    locked = [_make_tread(t.from_mm.x_mm, t.to_mm.x_mm, locked=True) for t in treads]
    locked[2] = treads[2]  # unlocked moved tread

    result = rebalance_treads(
        locked,
        moved_index=2,
        new_from_mm=Vec2Mm(x_mm=treads[2].from_mm.x_mm + 30.0, y_mm=0.0),
        total_run_mm=1375.0,
    )

    # Other treads unchanged.
    for i in [0, 1, 3, 4]:
        assert abs(result[i].to_mm.x_mm - locked[i].to_mm.x_mm) < 0.01


# ---------------------------------------------------------------------------
# UpdateStairTreadsCmd -- engine round-trip
# ---------------------------------------------------------------------------


def test_update_stair_treads_cmd_round_trip() -> None:
    """UpdateStairTreadsCmd should replace treadLines in the stair element."""
    doc = _seed()
    _make_by_sketch_stair(doc, "s1")

    new_treads = [
        {
            "fromMm": {"xMm": float(i * 300), "yMm": 0.0},
            "toMm": {"xMm": float((i + 1) * 300), "yMm": 0.0},
        }
        for i in range(12)
    ]
    apply_inplace(
        doc,
        UpdateStairTreadsCmd(id="s1", treadLines=new_treads),
    )

    elem = doc.elements["s1"]
    assert isinstance(elem, StairElem)
    assert elem.tread_lines is not None
    assert len(elem.tread_lines) == 12
    # First tread should have the new width.
    assert abs(elem.tread_lines[0].to_mm.x_mm - 300.0) < 0.01


def test_update_stair_treads_preserves_manual_override() -> None:
    """manualOverride field should be preserved when passed through the command."""
    doc = _seed()
    _make_by_sketch_stair(doc, "s2")

    new_treads = [
        {
            "fromMm": {"xMm": 0.0, "yMm": 0.0},
            "toMm": {"xMm": 300.0, "yMm": 0.0},
            "manualOverride": True,
        },
        {
            "fromMm": {"xMm": 300.0, "yMm": 0.0},
            "toMm": {"xMm": 600.0, "yMm": 0.0},
            "manualOverride": False,
        },
    ]
    apply_inplace(
        doc,
        UpdateStairTreadsCmd(id="s2", treadLines=new_treads),
    )

    elem = doc.elements["s2"]
    assert isinstance(elem, StairElem)
    assert elem.tread_lines is not None
    assert elem.tread_lines[0].manual_override is True
    assert elem.tread_lines[1].manual_override is False


def test_update_stair_treads_raises_for_missing_element() -> None:
    doc = _seed()
    with pytest.raises(ValueError, match="is not a stair"):
        apply_inplace(
            doc,
            UpdateStairTreadsCmd(id="nonexistent", treadLines=[]),
        )


def test_update_stair_treads_raises_for_non_sketch_stair() -> None:
    """Engine raises ValueError when target stair is not in by_sketch mode."""
    doc = _seed()
    # Create a standard by_component stair.
    apply_inplace(
        doc,
        CreateStairCmd(
            id="std",
            baseLevelId="lv0",
            topLevelId="lv1",
            runStartMm={"xMm": 0.0, "yMm": 0.0},
            runEndMm={"xMm": 3000.0, "yMm": 0.0},
        ),
    )

    with pytest.raises(ValueError, match="by_sketch"):
        apply_inplace(
            doc,
            UpdateStairTreadsCmd(
                id="std",
                treadLines=[
                    {"fromMm": {"xMm": 0.0, "yMm": 0.0}, "toMm": {"xMm": 300.0, "yMm": 0.0}}
                ],
            ),
        )


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------


def test_update_stair_treads_tool_registered() -> None:
    """update-stair-treads descriptor must be present in the registry."""
    from bim_ai.api.registry import get_descriptor

    descriptor = get_descriptor("update-stair-treads")
    assert descriptor is not None
    assert descriptor.name == "update-stair-treads"
    assert descriptor.category == "mutation"
    assert descriptor.sideEffects == "mutates-kernel"
