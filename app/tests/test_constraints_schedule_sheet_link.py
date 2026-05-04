"""Schedule/sheet linkage validation and quick-fix replay (WP-V01)."""

from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, ScheduleElem, SheetElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit, try_commit_bundle


def _sheet_and_schedule(*, bad_sheet_id: str) -> dict[str, object]:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {"viewRef": "schedule:missing-sch", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
        ],
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-1",
        name="Rooms",
        sheetId=bad_sheet_id,
    )
    return {"lvl": lvl, "sh-1": sh, "sch-1": sch}


def test_schedule_orphan_sheet_ref_missing_id() -> None:
    elems = _sheet_and_schedule(bad_sheet_id="no-such-sheet")
    viols = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols if x.rule_id == "schedule_orphan_sheet_ref")
    assert v.element_ids == ["sch-1"]
    assert v.quick_fix_command == {
        "type": "updateElementProperty",
        "elementId": "sch-1",
        "key": "sheetId",
        "value": "",
    }


def test_schedule_orphan_sheet_ref_wrong_kind() -> None:
    wall = WallElem(
        kind="wall",
        id="w-1",
        name="W",
        levelId="lvl",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=1000, yMm=0),
        thicknessMm=200,
        heightMm=2800,
    )
    elems = {**_sheet_and_schedule(bad_sheet_id="w-1"), "w-1": wall}
    viols = evaluate(elems)  # type: ignore[arg-type]
    assert any(x.rule_id == "schedule_orphan_sheet_ref" for x in viols)


def test_schedule_orphan_quick_fix_try_commit_ok() -> None:
    elems = _sheet_and_schedule(bad_sheet_id="ghost")
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, new_doc, _cmd, viols, code = try_commit(
        doc,
        {
            "type": "updateElementProperty",
            "elementId": "sch-1",
            "key": "sheetId",
            "value": "",
        },
    )
    assert ok is True
    assert code == "ok"
    assert new_doc is not None
    assert not any(v.rule_id == "schedule_orphan_sheet_ref" for v in viols)


def test_sheet_viewport_unknown_ref_has_quick_fix_and_replay() -> None:
    elems = _sheet_and_schedule(bad_sheet_id="")
    viols0 = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols0 if x.rule_id == "sheet_viewport_unknown_ref")
    assert v.quick_fix_command is not None
    assert v.quick_fix_command["type"] == "upsertSheetViewports"
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, new_doc, _cmd, viols, code = try_commit(doc, v.quick_fix_command)  # type: ignore[arg-type]
    assert ok is True
    assert code == "ok"
    assert new_doc is not None
    assert not any(x.rule_id == "sheet_viewport_unknown_ref" for x in viols)


def test_schedule_orphan_quick_fix_bundle_not_constraint_error() -> None:
    elems = _sheet_and_schedule(bad_sheet_id="ghost")
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "updateElementProperty",
                "elementId": "sch-1",
                "key": "sheetId",
                "value": "",
            },
        ],
    )
    assert ok is True
    assert code == "ok"


def _linked_schedule_on_sheet_without_schedule_viewport() -> dict[str, object]:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-plan",
                "viewRef": "plan:pv-1",
                "xMm": 25,
                "yMm": 40,
                "widthMm": 220,
                "heightMm": 170,
            },
        ],
    )
    sch = ScheduleElem(
        kind="schedule",
        id="sch-1",
        name="Rooms",
        sheetId="sh-1",
    )
    return {"lvl": lvl, "pv-1": pv, "sh-1": sh, "sch-1": sch}


def test_schedule_sheet_viewport_missing_warns_with_quick_fix() -> None:
    elems = _linked_schedule_on_sheet_without_schedule_viewport()
    viols = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols if x.rule_id == "schedule_sheet_viewport_missing")
    assert v.element_ids == ["sch-1"]
    assert v.quick_fix_command == {
        "type": "upsertSheetViewports",
        "sheetId": "sh-1",
        "viewportsMm": [
            {
                "viewportId": "vp-plan",
                "viewRef": "plan:pv-1",
                "xMm": 25,
                "yMm": 40,
                "widthMm": 220,
                "heightMm": 170,
            },
            {
                "viewportId": "vp-autoplace-schedule-sch-1",
                "label": "Rooms",
                "viewRef": "schedule:sch-1",
                "xMm": 800.0,
                "yMm": 800.0,
                "widthMm": 14000.0,
                "heightMm": 9000.0,
            },
        ],
    }


def test_schedule_sheet_viewport_missing_absent_when_placed() -> None:
    base = _linked_schedule_on_sheet_without_schedule_viewport()
    sh = base["sh-1"]
    assert isinstance(sh, SheetElem)
    sh2 = sh.model_copy(
        update={
            "viewports_mm": list(sh.viewports_mm)
            + [
                {
                    "viewportId": "vp-sch",
                    "viewRef": "schedule:sch-1",
                    "xMm": 260,
                    "yMm": 40,
                    "widthMm": 120,
                    "heightMm": 140,
                },
            ],
        },
    )
    elems = {**base, "sh-1": sh2}
    viols = evaluate(elems)  # type: ignore[arg-type]
    assert not any(x.rule_id == "schedule_sheet_viewport_missing" for x in viols)


def test_schedule_sheet_viewport_missing_quick_fix_try_commit_ok() -> None:
    elems = _linked_schedule_on_sheet_without_schedule_viewport()
    viols0 = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols0 if x.rule_id == "schedule_sheet_viewport_missing")
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, new_doc, _cmd, viols, code = try_commit(doc, v.quick_fix_command)  # type: ignore[arg-type]
    assert ok is True
    assert code == "ok"
    assert new_doc is not None
    assert not any(x.rule_id == "schedule_sheet_viewport_missing" for x in viols)


def test_schedule_sheet_viewport_missing_quick_fix_bundle_ok() -> None:
    elems = _linked_schedule_on_sheet_without_schedule_viewport()
    viols0 = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols0 if x.rule_id == "schedule_sheet_viewport_missing")
    qf = v.quick_fix_command
    assert qf is not None
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(doc, [qf])
    assert ok is True
    assert code == "ok"
