"""VIE-V3-02 — Drafting view + callout + cut-profile + view-break tests.

Covers: CreateDraftingViewCmd, CreateViewCalloutCmd, SetElementOverrideCmd,
        AddViewBreakCmd, RemoveViewBreakCmd, and the drafting-view exclusion
        from resolve_visible_elements.
"""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import ViewElem
from bim_ai.engine import resolve_visible_elements, try_commit_bundle


def _seed() -> Document:
    return Document(revision=1, elements={})


def _drafting_view(view_id: str = "v-draft", name: str = "Eave Detail", scale: int = 50) -> dict:
    return {
        "type": "CreateDraftingView",
        "viewId": view_id,
        "name": name,
        "scale": scale,
    }


def _callout_view(
    callout_id: str = "v-callout",
    parent_id: str = "v-parent",
    name: str = "Head jamb detail",
    scale: int = 5,
) -> dict:
    return {
        "type": "CreateCallout",
        "calloutViewId": callout_id,
        "parentViewId": parent_id,
        "clipRect": {
            "minXY": {"x": 0.0, "y": 0.0},
            "maxXY": {"x": 2000.0, "y": 1500.0},
        },
        "name": name,
        "scale": scale,
    }


def _override(view_id: str, category: str, alternate: str) -> dict:
    return {
        "type": "SetElementOverride",
        "viewId": view_id,
        "categoryOrId": category,
        "alternateRender": alternate,
    }


def _add_break(view_id: str, axis_mm: float, width_mm: float) -> dict:
    return {
        "type": "AddViewBreak",
        "viewId": view_id,
        "axisMM": axis_mm,
        "widthMM": width_mm,
    }


def _remove_break(view_id: str, axis_mm: float) -> dict:
    return {"type": "RemoveViewBreak", "viewId": view_id, "axisMM": axis_mm}


# ---------------------------------------------------------------------------
# CreateDraftingViewCmd
# ---------------------------------------------------------------------------


def test_create_drafting_view_subkind() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_drafting_view()])
    assert ok
    v = nd.elements["v-draft"]
    assert isinstance(v, ViewElem)
    assert v.sub_kind == "drafting"


def test_create_drafting_view_name_and_scale() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_drafting_view(name="Sill Detail", scale=20)])
    assert ok
    v = nd.elements["v-draft"]
    assert v.name == "Sill Detail"
    assert v.scale == 20.0


# ---------------------------------------------------------------------------
# CreateViewCalloutCmd
# ---------------------------------------------------------------------------


def test_create_callout_subkind() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(view_id="v-parent", name="Parent Plan"),
        _callout_view(callout_id="v-co", parent_id="v-parent"),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-co"]
    assert isinstance(v, ViewElem)
    assert v.sub_kind == "callout"


def test_create_callout_parent_view_id() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(view_id="v-parent", name="Parent Plan"),
        _callout_view(callout_id="v-co", parent_id="v-parent"),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-co"]
    assert v.parent_view_id == "v-parent"


def test_create_callout_clip_rect_stored() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(view_id="v-parent", name="Parent Plan"),
        _callout_view(callout_id="v-co", parent_id="v-parent"),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-co"]
    assert v.clip_rect_in_parent is not None
    assert v.clip_rect_in_parent.min_xy.x == 0.0
    assert v.clip_rect_in_parent.max_xy.x == 2000.0


def test_create_callout_unknown_parent_fails() -> None:
    doc = _seed()
    ok, *_ = try_commit_bundle(doc, [_callout_view(parent_id="no-such")])
    assert not ok


# ---------------------------------------------------------------------------
# SetElementOverrideCmd
# ---------------------------------------------------------------------------


def test_set_element_override_stores() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(),
        _override("v-draft", "floor", "singleLine"),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-draft"]
    assert isinstance(v, ViewElem)
    overrides = {o.category_or_id: o.alternate_render for o in v.element_overrides}
    assert overrides["floor"] == "singleLine"


def test_set_element_override_replaces_same_category() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(),
        _override("v-draft", "wall", "outline"),
        _override("v-draft", "wall", "singleLine"),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-draft"]
    wall_overrides = [o for o in v.element_overrides if o.category_or_id == "wall"]
    assert len(wall_overrides) == 1
    assert wall_overrides[0].alternate_render == "singleLine"


def test_set_element_override_on_non_view_fails() -> None:
    doc = _seed()
    cmds = [{"type": "SetElementOverride", "viewId": "bogus", "categoryOrId": "wall", "alternateRender": "outline"}]
    ok, *_ = try_commit_bundle(doc, cmds)
    assert not ok


# ---------------------------------------------------------------------------
# AddViewBreakCmd
# ---------------------------------------------------------------------------


def test_add_view_break_appends() -> None:
    doc = _seed()
    cmds = [_drafting_view(), _add_break("v-draft", 5000.0, 3000.0)]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-draft"]
    assert len(v.breaks) == 1
    assert v.breaks[0].axis_mm == 5000.0
    assert v.breaks[0].width_mm == 3000.0


def test_add_view_break_sorted_ascending() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(),
        _add_break("v-draft", 8000.0, 1000.0),
        _add_break("v-draft", 3000.0, 500.0),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-draft"]
    assert len(v.breaks) == 2
    assert v.breaks[0].axis_mm == 3000.0
    assert v.breaks[1].axis_mm == 8000.0


# ---------------------------------------------------------------------------
# RemoveViewBreakCmd
# ---------------------------------------------------------------------------


def test_remove_view_break_removes_matching() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(),
        _add_break("v-draft", 5000.0, 3000.0),
        _remove_break("v-draft", 5000.0),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-draft"]
    assert len(v.breaks) == 0


def test_remove_view_break_unknown_axis_is_noop() -> None:
    doc = _seed()
    cmds = [
        _drafting_view(),
        _add_break("v-draft", 5000.0, 3000.0),
        _remove_break("v-draft", 9999.0),
    ]
    ok, nd, *_ = try_commit_bundle(doc, cmds)
    assert ok
    v = nd.elements["v-draft"]
    assert len(v.breaks) == 1


# ---------------------------------------------------------------------------
# resolve_visible_elements — drafting views excluded
# ---------------------------------------------------------------------------


def test_drafting_view_not_in_resolve_visible_elements() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_drafting_view(view_id="v-draft")])
    assert ok
    visible = resolve_visible_elements(nd, {})
    assert "v-draft" not in visible
