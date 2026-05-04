from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import CalloutElem, LevelElem, SectionCutElem, SheetElem
from bim_ai.plan_projection_wire import section_cut_projection_wire

_TRI = (
    {"xMm": 0.0, "yMm": 0.0},
    {"xMm": 300.0, "yMm": 0.0},
    {"xMm": 150.0, "yMm": 200.0},
)


def test_section_projection_primitives_sheet_callouts_sorted_ids() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "sec-cut": SectionCutElem(
                kind="section_cut",
                id="sec-cut",
                name="A-A",
                lineStartMm={"xMm": 0.0, "yMm": -2000.0},
                lineEndMm={"xMm": 0.0, "yMm": 2000.0},
                cropDepthMm=8000.0,
            ),
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="Sections",
                viewportsMm=[
                    {
                        "viewportId": "vp-sec",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 100,
                        "heightMm": 100,
                        "viewRef": "sec:sec-cut",
                    },
                ],
            ),
            "z-co": CalloutElem(
                kind="callout",
                id="z-co",
                name="Zeta",
                parentSheetId="s1",
                outlineMm=list(_TRI),
            ),
            "a-co": CalloutElem(
                kind="callout",
                id="a-co",
                name="Alpha",
                parentSheetId="s1",
                outlineMm=list(_TRI),
            ),
        },
    )

    wire = section_cut_projection_wire(doc, "sec-cut")
    prim = wire["primitives"]
    rows = prim.get("sheetCallouts") or []
    assert [r["id"] for r in rows] == ["a-co", "z-co"]
    assert [r["name"] for r in rows] == ["Alpha", "Zeta"]


def test_section_projection_primitives_sheet_callouts_empty_for_other_sheet() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "sec-cut": SectionCutElem(
                kind="section_cut",
                id="sec-cut",
                name="A-A",
                lineStartMm={"xMm": 0.0, "yMm": -2000.0},
                lineEndMm={"xMm": 0.0, "yMm": 2000.0},
                cropDepthMm=8000.0,
            ),
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="Sections",
                viewportsMm=[
                    {
                        "viewportId": "vp-sec",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 100,
                        "heightMm": 100,
                        "viewRef": "section:sec-cut",
                    },
                ],
            ),
            "s2": SheetElem(
                kind="sheet",
                id="s2",
                name="Other",
                viewportsMm=[],
            ),
            "orphan-co": CalloutElem(
                kind="callout",
                id="orphan-co",
                name="Orphan",
                parentSheetId="s2",
                outlineMm=list(_TRI),
            ),
        },
    )

    wire = section_cut_projection_wire(doc, "sec-cut")
    assert wire["primitives"]["sheetCallouts"] == []
