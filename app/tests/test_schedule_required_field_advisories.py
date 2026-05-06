"""Schedule opening QA advisories: identifier, orphan host, type id, host wall type (Prompt 5 / WP-V01)."""

from __future__ import annotations

from bim_ai.constraints import Violation, evaluate
from bim_ai.elements import DoorElem, LevelElem, WallElem, WallTypeElem, WindowElem


def _ids_sorted_by_rule_then_elements(
    viols: list[Violation],
) -> list[tuple[str, str, tuple[str, ...]]]:
    return sorted(
        (v.rule_id, v.severity, tuple(v.element_ids))
        for v in viols
        if v.rule_id.startswith("schedule_opening_")
    )


def test_schedule_opening_orphan_host_dual_with_door_not_on_wall() -> None:
    lvl = LevelElem(kind="level", id="lv", name="L1", elevationMm=0)
    door = DoorElem(
        kind="door", id="d-orphan", name="D1", wallId="missing-wall", alongT=0.5, widthMm=900
    )
    elems = {"lv": lvl, "d-orphan": door}
    viols = evaluate(elems)  # type: ignore[arg-type]
    by_rule = {
        v.rule_id: v
        for v in viols
        if v.rule_id in {"door_not_on_wall", "schedule_opening_orphan_host"}
    }
    assert "door_not_on_wall" in by_rule
    assert "schedule_opening_orphan_host" in by_rule
    assert by_rule["door_not_on_wall"].severity == "error"
    assert by_rule["schedule_opening_orphan_host"].severity == "info"
    assert by_rule["door_not_on_wall"].quick_fix_command is None
    assert by_rule["schedule_opening_orphan_host"].quick_fix_command is None


def test_schedule_opening_rules_stable_ordering_multi_openings() -> None:
    lvl = LevelElem(kind="level", id="lv", name="L1", elevationMm=0)
    wt = WallTypeElem(kind="wall_type", id="wt-1", name="Basic")
    wa = WallElem(
        kind="wall",
        id="w-host",
        name="W",
        levelId="lv",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 5000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
        wallTypeId="wt-1",
    )
    d_z = DoorElem(kind="door", id="d-z", name="", wallId="w-host", alongT=0.5, widthMm=900)
    d_a = DoorElem(kind="door", id="d-a", name="", wallId="w-host", alongT=0.3, widthMm=800)
    elems = {"lv": lvl, "wt-1": wt, "w-host": wa, "d-z": d_z, "d-a": d_a}
    viols = evaluate(elems)  # type: ignore[arg-type]
    sched = [v for v in viols if v.rule_id.startswith("schedule_opening_")]
    ident = [v for v in sched if v.rule_id == "schedule_opening_identifier_missing"]
    assert [v.element_ids[0] for v in ident] == ["d-a", "d-z"]


def test_schedule_opening_identifier_and_family_type_and_host_wall_type() -> None:
    lvl = LevelElem(kind="level", id="lv", name="L1", elevationMm=0)
    wa_no_type = WallElem(
        kind="wall",
        id="w-nt",
        name="W",
        levelId="lv",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 4000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    win = WindowElem(
        kind="window",
        id="w1",
        name="  ",
        wallId="w-nt",
        alongT=0.5,
        widthMm=1200,
        heightMm=1500,
    )
    elems = {"lv": lvl, "w-nt": wa_no_type, "w1": win}
    viols = evaluate(elems)  # type: ignore[arg-type]
    keys = _ids_sorted_by_rule_then_elements(viols)
    assert ("schedule_opening_family_type_incomplete", "warning", ("w1",)) in keys
    assert ("schedule_opening_host_wall_type_incomplete", "warning", ("w-nt", "w1")) in keys
    assert ("schedule_opening_identifier_missing", "warning", ("w1",)) in keys
    for v in viols:
        if v.rule_id.startswith("schedule_opening_"):
            assert v.quick_fix_command is None


def test_schedule_opening_no_host_wall_type_violation_when_wall_typed() -> None:
    lvl = LevelElem(kind="level", id="lv", name="L1", elevationMm=0)
    wt = WallTypeElem(kind="wall_type", id="wt-x", name="Ext")
    wa = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lv",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 4000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
        wallTypeId="wt-x",
    )
    door = DoorElem(
        kind="door",
        id="d1",
        name="01",
        wallId="w1",
        alongT=0.5,
        widthMm=900,
        familyTypeId="ft-door",
    )
    elems = {"lv": lvl, "wt-x": wt, "w1": wa, "d1": door}
    viols = evaluate(elems)  # type: ignore[arg-type]
    assert not any(v.rule_id == "schedule_opening_host_wall_type_incomplete" for v in viols)
    assert not any(v.rule_id == "schedule_opening_identifier_missing" for v in viols)
    assert not any(v.rule_id == "schedule_opening_family_type_incomplete" for v in viols)
