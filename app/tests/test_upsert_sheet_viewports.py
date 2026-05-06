"""Regression: replayable sheet viewport authoring command."""

import pytest

from bim_ai.commands import UpsertSheetViewportsCmd
from bim_ai.document import Document
from bim_ai.elements import SheetElem
from bim_ai.engine import apply_inplace, try_commit_bundle


def test_upsert_sheet_viewports_replaces_array() -> None:
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="GA",
                viewports_mm=[{"viewportId": "a", "xMm": 1, "yMm": 2, "widthMm": 3, "heightMm": 4}],
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="s1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "label": "Plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 100,
                    "yMm": 200,
                    "widthMm": 5000,
                    "heightMm": 4000,
                }
            ],
        ),
    )
    sh = doc.elements["s1"]
    assert isinstance(sh, SheetElem)
    assert len(sh.viewports_mm) == 1
    assert sh.viewports_mm[0]["viewportId"] == "vp-plan"
    assert sh.viewports_mm[0]["viewRef"] == "plan:pv-1"


def test_upsert_sheet_viewports_persists_model_crop_metadata() -> None:
    doc = Document(
        revision=1, elements={"s1": SheetElem(kind="sheet", id="s1", name="GA", viewports_mm=[])}
    )
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="s1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "viewRef": "plan:p1",
                    "xMm": 100,
                    "yMm": 200,
                    "widthMm": 300,
                    "heightMm": 280,
                    "cropMinMm": {"xMm": -1200.01, "yMm": 10},
                    "cropMaxMm": {"xMm": 8008.25, "yMm": 902},
                },
            ],
        ),
    )
    sh = doc.elements["s1"]
    assert isinstance(sh, SheetElem)
    vp = sh.viewports_mm[0]
    assert vp["cropMinMm"]["xMm"] == pytest.approx(-1200.01)
    assert vp["cropMaxMm"]["yMm"] == pytest.approx(902)


def test_upsert_sheet_viewports_sequential_replace() -> None:
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="GA",
                viewports_mm=[
                    {"viewportId": "legacy", "xMm": 0, "yMm": 0, "widthMm": 1, "heightMm": 1}
                ],
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="s1",
            viewportsMm=[
                {
                    "viewportId": "first",
                    "viewRef": "plan:a",
                    "xMm": 1,
                    "yMm": 1,
                    "widthMm": 10,
                    "heightMm": 10,
                }
            ],
        ),
    )
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="s1",
            viewportsMm=[
                {
                    "viewportId": "second-a",
                    "viewRef": "section:b",
                    "xMm": 2,
                    "yMm": 2,
                    "widthMm": 20,
                    "heightMm": 20,
                },
                {
                    "viewportId": "second-b",
                    "viewRef": "schedule:c",
                    "xMm": 3,
                    "yMm": 3,
                    "widthMm": 30,
                    "heightMm": 30,
                },
            ],
        ),
    )
    sh = doc.elements["s1"]
    assert isinstance(sh, SheetElem)
    assert len(sh.viewports_mm) == 2
    assert sh.viewports_mm[0]["viewportId"] == "second-a"
    assert sh.viewports_mm[1]["viewportId"] == "second-b"
    assert "legacy" not in {vp.get("viewportId") for vp in sh.viewports_mm}
    assert "first" not in {vp.get("viewportId") for vp in sh.viewports_mm}


def test_try_commit_bundle_upsert_sheet_preserves_viewports_mm() -> None:
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="GA",
                viewports_mm=[
                    {
                        "viewportId": "keep-me",
                        "viewRef": "plan:pv-1",
                        "xMm": 10,
                        "yMm": 20,
                        "widthMm": 100,
                        "heightMm": 90,
                    }
                ],
            ),
        },
    )
    raw_cmds = [
        {
            "type": "upsertSheet",
            "id": "s1",
            "name": "GA renamed",
            "titleBlock": "A1",
            "titleblockParameters": {"sheetNumber": "ZZ", "revision": "9"},
        },
    ]
    ok, cand, *_ = try_commit_bundle(doc, raw_cmds)
    assert ok and cand is not None
    sh = cand.elements["s1"]
    assert isinstance(sh, SheetElem)
    assert sh.name == "GA renamed"
    assert sh.title_block == "A1"
    assert sh.titleblock_parameters.get("sheetNumber") == "ZZ"
    assert sh.titleblock_parameters.get("revision") == "9"
    assert len(sh.viewports_mm) == 1
    assert sh.viewports_mm[0].get("viewportId") == "keep-me"


def test_try_commit_bundle_viewports_then_sheet_replaces_titleblock_parameters() -> None:
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="GA",
                title_block=None,
                viewports_mm=[],
                titleblock_parameters={"sheetNumber": "old", "customKey": "x"},
            ),
        },
    )
    raw_cmds = [
        {
            "type": "upsertSheetViewports",
            "sheetId": "s1",
            "viewportsMm": [
                {
                    "viewportId": "vp-a",
                    "viewRef": "plan:p1",
                    "xMm": 1,
                    "yMm": 2,
                    "widthMm": 50,
                    "heightMm": 40,
                }
            ],
        },
        {
            "type": "upsertSheet",
            "id": "s1",
            "name": "GA",
            "titleblockParameters": {"sheetNumber": "new", "revision": "r1"},
        },
    ]
    ok, cand, *_ = try_commit_bundle(doc, raw_cmds)
    assert ok and cand is not None
    sh = cand.elements["s1"]
    assert isinstance(sh, SheetElem)
    assert len(sh.viewports_mm) == 1
    assert sh.viewports_mm[0].get("viewportId") == "vp-a"
    assert sh.titleblock_parameters == {"sheetNumber": "new", "revision": "r1"}


def test_try_commit_bundle_sheet_titleblock_then_viewports_preserves_titleblock() -> None:
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="GA",
                viewports_mm=[],
                titleblock_parameters={},
            ),
        },
    )
    raw_cmds = [
        {
            "type": "upsertSheet",
            "id": "s1",
            "name": "GA",
            "titleblockParameters": {"sheetNumber": "pre", "revision": "alpha"},
        },
        {
            "type": "upsertSheetViewports",
            "sheetId": "s1",
            "viewportsMm": [
                {
                    "viewportId": "vp-b",
                    "viewRef": "section:cut-1",
                    "xMm": 5,
                    "yMm": 6,
                    "widthMm": 80,
                    "heightMm": 70,
                }
            ],
        },
    ]
    ok, cand, *_ = try_commit_bundle(doc, raw_cmds)
    assert ok and cand is not None
    sh = cand.elements["s1"]
    assert isinstance(sh, SheetElem)
    assert sh.titleblock_parameters == {"sheetNumber": "pre", "revision": "alpha"}
    assert len(sh.viewports_mm) == 1
    assert sh.viewports_mm[0].get("viewportId") == "vp-b"
