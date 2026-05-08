"""SHT-V3-01: Sheet + titleblock + cartouche + window-legend tests."""
from __future__ import annotations

import pytest

from bim_ai.commands import (
    CreateSheetCmd,
    CreateWindowLegendViewCmd,
    MoveViewOnSheetCmd,
    PlaceViewOnSheetCmd,
    RemoveViewFromSheetCmd,
    SetSheetTitleblockCmd,
    UpdateSheetMetadataCmd,
)
from bim_ai.document import Document
from bim_ai.elements import (
    DEFAULT_TITLEBLOCK_TYPE,
    SheetElem,
    TitleblockTypeElem,
    WindowElem,
    WindowLegendViewElem,
    Vec2Mm,
)
from bim_ai.engine import apply_inplace
from bim_ai.sheets import resolve_window_legend


def _empty_doc() -> Document:
    return Document(elements={})


def _apply(doc: Document, cmd_dict: dict) -> Document:
    from pydantic import TypeAdapter
    from bim_ai.commands import Command

    ta: TypeAdapter[Command] = TypeAdapter(Command)
    cmd = ta.validate_python(cmd_dict)
    apply_inplace(doc, cmd)
    return doc


# ---------------------------------------------------------------------------
# CreateSheetCmd
# ---------------------------------------------------------------------------


def test_create_sheet_creates_element():
    doc = _empty_doc()
    _apply(doc, {"type": "CreateSheet", "sheetId": "sh-1", "name": "Floor Plan", "number": "A-101"})
    sh = doc.elements.get("sh-1")
    assert isinstance(sh, SheetElem)
    assert sh.name == "Floor Plan"
    assert sh.number == "A-101"
    assert sh.size == "A1"
    assert sh.orientation == "landscape"


def test_create_sheet_auto_inserts_default_titleblock():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "CreateSheet",
            "sheetId": "sh-2",
            "name": "Elevations",
            "number": "A-201",
            "titleblockTypeId": "default-a1-titleblock",
        },
    )
    tb = doc.elements.get("default-a1-titleblock")
    assert isinstance(tb, TitleblockTypeElem)
    assert tb.id == "default-a1-titleblock"


def test_create_sheet_auto_inserts_titleblock_when_unknown_id():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "CreateSheet",
            "sheetId": "sh-3",
            "name": "Sections",
            "number": "A-301",
            "titleblockTypeId": "nonexistent-tb",
        },
    )
    # default titleblock is auto-inserted when the referenced titleblock id is absent
    tb = doc.elements.get("default-a1-titleblock")
    assert isinstance(tb, TitleblockTypeElem)


# ---------------------------------------------------------------------------
# PlaceViewOnSheetCmd
# ---------------------------------------------------------------------------


def test_place_view_adds_placement():
    doc = _empty_doc()
    _apply(doc, {"type": "CreateSheet", "sheetId": "sh-4", "name": "Sheet", "number": "A-101"})
    _apply(
        doc,
        {
            "type": "PlaceViewOnSheet",
            "sheetId": "sh-4",
            "viewId": "pv-gf",
            "minXY": {"x": 10.0, "y": 10.0},
            "size": {"x": 200.0, "y": 150.0},
        },
    )
    sh = doc.elements["sh-4"]
    assert isinstance(sh, SheetElem)
    assert len(sh.view_placements) == 1
    vp = sh.view_placements[0]
    assert vp.view_id == "pv-gf"
    assert vp.min_xy.x == 10.0
    assert vp.size.x == 200.0


def test_place_view_twice_replaces_not_duplicates():
    doc = _empty_doc()
    _apply(doc, {"type": "CreateSheet", "sheetId": "sh-5", "name": "Sheet", "number": "A-101"})
    _apply(
        doc,
        {
            "type": "PlaceViewOnSheet",
            "sheetId": "sh-5",
            "viewId": "pv-gf",
            "minXY": {"x": 10.0, "y": 10.0},
            "size": {"x": 200.0, "y": 150.0},
        },
    )
    _apply(
        doc,
        {
            "type": "PlaceViewOnSheet",
            "sheetId": "sh-5",
            "viewId": "pv-gf",
            "minXY": {"x": 50.0, "y": 20.0},
            "size": {"x": 200.0, "y": 150.0},
        },
    )
    sh = doc.elements["sh-5"]
    assert isinstance(sh, SheetElem)
    assert len(sh.view_placements) == 1
    assert sh.view_placements[0].min_xy.x == 50.0


# ---------------------------------------------------------------------------
# MoveViewOnSheetCmd
# ---------------------------------------------------------------------------


def test_move_view_updates_min_xy():
    doc = _empty_doc()
    _apply(doc, {"type": "CreateSheet", "sheetId": "sh-6", "name": "Sheet", "number": "A-101"})
    _apply(
        doc,
        {
            "type": "PlaceViewOnSheet",
            "sheetId": "sh-6",
            "viewId": "pv-gf",
            "minXY": {"x": 10.0, "y": 10.0},
            "size": {"x": 200.0, "y": 150.0},
        },
    )
    _apply(
        doc,
        {
            "type": "MoveViewOnSheet",
            "sheetId": "sh-6",
            "viewId": "pv-gf",
            "minXY": {"x": 99.0, "y": 55.0},
        },
    )
    sh = doc.elements["sh-6"]
    assert isinstance(sh, SheetElem)
    vp = sh.view_placements[0]
    assert vp.min_xy.x == 99.0
    assert vp.min_xy.y == 55.0


# ---------------------------------------------------------------------------
# RemoveViewFromSheetCmd
# ---------------------------------------------------------------------------


def test_remove_view_from_sheet():
    doc = _empty_doc()
    _apply(doc, {"type": "CreateSheet", "sheetId": "sh-7", "name": "Sheet", "number": "A-101"})
    _apply(
        doc,
        {
            "type": "PlaceViewOnSheet",
            "sheetId": "sh-7",
            "viewId": "pv-gf",
            "minXY": {"x": 10.0, "y": 10.0},
            "size": {"x": 200.0, "y": 150.0},
        },
    )
    _apply(doc, {"type": "RemoveViewFromSheet", "sheetId": "sh-7", "viewId": "pv-gf"})
    sh = doc.elements["sh-7"]
    assert isinstance(sh, SheetElem)
    assert len(sh.view_placements) == 0


# ---------------------------------------------------------------------------
# SetSheetTitleblockCmd
# ---------------------------------------------------------------------------


def test_set_sheet_titleblock():
    doc = _empty_doc()
    _apply(doc, {"type": "CreateSheet", "sheetId": "sh-8", "name": "Sheet", "number": "A-101"})
    custom_tb = TitleblockTypeElem(id="custom-tb", name="Custom", svgTemplate="<svg/>")
    doc.elements["custom-tb"] = custom_tb
    _apply(doc, {"type": "SetSheetTitleblock", "sheetId": "sh-8", "titleblockTypeId": "custom-tb"})
    sh = doc.elements["sh-8"]
    assert isinstance(sh, SheetElem)
    assert sh.titleblock_type_id == "custom-tb"


# ---------------------------------------------------------------------------
# UpdateSheetMetadataCmd
# ---------------------------------------------------------------------------


def test_update_sheet_metadata_patches_only_provided_keys():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "CreateSheet",
            "sheetId": "sh-9",
            "name": "Sheet",
            "number": "A-101",
            "metadata": {"projectName": "My Project", "drawnBy": "JH"},
        },
    )
    _apply(
        doc,
        {
            "type": "UpdateSheetMetadata",
            "sheetId": "sh-9",
            "metadata": {"checkedBy": "AR"},
        },
    )
    sh = doc.elements["sh-9"]
    assert isinstance(sh, SheetElem)
    assert sh.metadata.project_name == "My Project"
    assert sh.metadata.drawn_by == "JH"
    assert sh.metadata.checked_by == "AR"


# ---------------------------------------------------------------------------
# CreateWindowLegendViewCmd
# ---------------------------------------------------------------------------


def test_create_window_legend_view():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "CreateWindowLegendView",
            "legendId": "wlv-1",
            "name": "Window Legend",
            "scope": "project",
            "sortBy": "type",
        },
    )
    wlv = doc.elements.get("wlv-1")
    assert isinstance(wlv, WindowLegendViewElem)
    assert wlv.name == "Window Legend"
    assert wlv.scope == "project"
    assert wlv.sort_by == "type"


# ---------------------------------------------------------------------------
# resolve_window_legend
# ---------------------------------------------------------------------------


def _make_window(
    wid: str,
    family_type_id: str,
    width_mm: float,
    height_mm: float,
    sill_mm: float = 900,
) -> WindowElem:
    return WindowElem(
        kind="window",
        id=wid,
        name=wid,
        wallId="wall-1",
        alongT=0.5,
        widthMm=width_mm,
        sillHeightMm=sill_mm,
        heightMm=height_mm,
        familyTypeId=family_type_id,
    )


def _doc_with_windows(*windows: WindowElem) -> Document:
    els: dict = {}
    for w in windows:
        els[w.id] = w
    return Document(elements=els)


def test_resolve_window_legend_groups_by_type():
    w1 = _make_window("w-1", "ft-double", 1200, 1400)
    w2 = _make_window("w-2", "ft-double", 1200, 1400)
    w3 = _make_window("w-3", "ft-single", 600, 1000)
    doc = _doc_with_windows(w1, w2, w3)
    legend = WindowLegendViewElem(id="wlv", name="Legend", kind="window_legend_view")
    entries = resolve_window_legend(doc, legend)
    assert len(entries) == 2
    type_ids = {e["typeId"] for e in entries}
    assert "ft-double" in type_ids
    assert "ft-single" in type_ids
    double_entry = next(e for e in entries if e["typeId"] == "ft-double")
    assert double_entry["count"] == 2


def test_resolve_window_legend_sorted_by_count():
    w1 = _make_window("w-1", "ft-rare", 600, 1000)
    w2 = _make_window("w-2", "ft-common", 1200, 1400)
    w3 = _make_window("w-3", "ft-common", 1200, 1400)
    w4 = _make_window("w-4", "ft-common", 1200, 1400)
    doc = _doc_with_windows(w1, w2, w3, w4)
    legend = WindowLegendViewElem(
        id="wlv", name="Legend", kind="window_legend_view", sortBy="count"
    )
    entries = resolve_window_legend(doc, legend)
    assert entries[0]["typeId"] == "ft-rare"
    assert entries[1]["typeId"] == "ft-common"


def test_resolve_window_legend_empty_document():
    doc = _empty_doc()
    legend = WindowLegendViewElem(id="wlv", name="Legend", kind="window_legend_view")
    entries = resolve_window_legend(doc, legend)
    assert entries == []
