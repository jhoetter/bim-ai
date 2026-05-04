"""Regression: replayable sheet viewport authoring command."""

from bim_ai.commands import UpsertSheetViewportsCmd
from bim_ai.document import Document
from bim_ai.elements import SheetElem
from bim_ai.engine import apply_inplace


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
