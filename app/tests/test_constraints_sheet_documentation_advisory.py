"""Sheet documentation advisories: title block symbol and viewport extent (PRD §11, WP-V01 / WP-E05)."""

from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, SheetElem
from bim_ai.engine import try_commit, try_commit_bundle


def test_sheet_missing_titleblock_warns_when_viewports_and_no_title_block() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "plan:pv-1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 100,
                "heightMm": 80,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols if x.rule_id == "sheet_missing_titleblock")
    assert v.element_ids == ["sh-1"]
    assert v.quick_fix_command == {
        "type": "updateElementProperty",
        "elementId": "sh-1",
        "key": "titleBlock",
        "value": "A1",
    }
    assert v.discipline == "coordination"


def test_sheet_missing_titleblock_absent_with_symbol() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="TB-1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "plan:pv-1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 100,
                "heightMm": 80,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols = evaluate(elems)  # type: ignore[arg-type]
    assert not any(x.rule_id == "sheet_missing_titleblock" for x in viols)


def test_sheet_missing_titleblock_absent_when_sheet_has_no_viewports() -> None:
    sh = SheetElem(kind="sheet", id="sh-1", name="S1", viewportsMm=[])
    elems = {"sh-1": sh}
    viols = evaluate(elems)  # type: ignore[arg-type]
    assert not any(x.rule_id == "sheet_missing_titleblock" for x in viols)


def test_sheet_missing_titleblock_ordering_two_sheets_by_id() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh_z = SheetElem(
        kind="sheet",
        id="sh-z",
        name="Z",
        viewportsMm=[
            {"viewportId": "v", "viewRef": "plan:pv-1", "xMm": 0, "yMm": 0, "widthMm": 10, "heightMm": 10},
        ],
    )
    sh_a = SheetElem(
        kind="sheet",
        id="sh-a",
        name="A",
        viewportsMm=[
            {"viewportId": "v2", "viewRef": "plan:pv-1", "xMm": 1, "yMm": 1, "widthMm": 10, "heightMm": 10},
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-z": sh_z, "sh-a": sh_a}
    viols = evaluate(elems)  # type: ignore[arg-type]
    tb = [v for v in viols if v.rule_id == "sheet_missing_titleblock"]
    assert [v.element_ids[0] for v in tb] == ["sh-a", "sh-z"]


def test_sheet_viewport_zero_extent_warns_with_upsert_quick_fix() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-bad",
                "viewRef": "plan:pv-1",
                "xMm": 5,
                "yMm": 6,
                "widthMm": 0,
                "heightMm": 50,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols if x.rule_id == "sheet_viewport_zero_extent")
    assert v.element_ids == ["sh-1"]
    assert "vp-bad" in v.message
    assert v.quick_fix_command == {
        "type": "upsertSheetViewports",
        "sheetId": "sh-1",
        "viewportsMm": [
            {
                "viewportId": "vp-bad",
                "viewRef": "plan:pv-1",
                "xMm": 5,
                "yMm": 6,
                "widthMm": 10.0,
                "heightMm": 50,
            },
        ],
    }


def test_sheet_viewport_zero_extent_absent_when_valid() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-ok",
                "viewRef": "plan:pv-1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 100,
                "heightMm": 80,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols = evaluate(elems)  # type: ignore[arg-type]
    assert not any(x.rule_id == "sheet_viewport_zero_extent" for x in viols)


def test_sheet_viewport_zero_extent_quick_fix_try_commit_ok() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-x",
                "viewRef": "plan:pv-1",
                "xMm": 1,
                "yMm": 2,
                "widthMm": 20,
                "heightMm": -1,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols0 = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols0 if x.rule_id == "sheet_viewport_zero_extent")
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, _new_doc, _cmd, viols, code = try_commit(doc, v.quick_fix_command)  # type: ignore[arg-type]
    assert ok is True
    assert code == "ok"
    assert not any(x.rule_id == "sheet_viewport_zero_extent" for x in viols)


def test_sheet_viewport_zero_extent_quick_fix_bundle_ok() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-x",
                "viewRef": "plan:pv-1",
                "xMm": 1,
                "yMm": 2,
                "widthMm": 20,
                "heightMm": 0,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols0 = evaluate(elems)  # type: ignore[arg-type]
    qf = next(x for x in viols0 if x.rule_id == "sheet_viewport_zero_extent").quick_fix_command
    assert qf is not None
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(doc, [qf])
    assert ok is True
    assert code == "ok"


def test_sheet_missing_titleblock_quick_fix_try_commit_ok() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl")
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-1",
                "viewRef": "plan:pv-1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 100,
                "heightMm": 80,
            },
        ],
    )
    elems = {"lvl": lvl, "pv-1": pv, "sh-1": sh}
    viols0 = evaluate(elems)  # type: ignore[arg-type]
    v = next(x for x in viols0 if x.rule_id == "sheet_missing_titleblock")
    doc = Document(revision=0, elements=dict(elems))  # type: ignore[arg-type]
    ok, _new_doc, _cmd, viols, code = try_commit(doc, v.quick_fix_command)  # type: ignore[arg-type]
    assert ok is True
    assert code == "ok"
    assert not any(x.rule_id == "sheet_missing_titleblock" for x in viols)

