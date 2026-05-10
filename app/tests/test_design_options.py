"""Tests for KRN-V3-04 Design Options."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    AddOptionCmd,
    AssignElementToOptionCmd,
    CreateOptionSetCmd,
    RemoveOptionCmd,
    SetPrimaryOptionCmd,
    SetViewOptionLockCmd,
)
from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, Vec2Mm, WallElem
from bim_ai.engine import apply_inplace, resolve_visible_elements


def _base_doc() -> Document:
    return Document(elements={})


def _doc_with_wall(wall_id: str = "w1") -> Document:
    doc = _base_doc()
    doc.elements["lvl1"] = LevelElem(kind="level", id="lvl1", name="L1", elevation_mm=0)
    doc.elements[wall_id] = WallElem(
        kind="wall",
        id=wall_id,
        name="Wall",
        level_id="lvl1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
    )
    return doc


def _doc_with_plan_view(view_id: str = "pv1") -> Document:
    doc = _base_doc()
    doc.elements["lvl1"] = LevelElem(kind="level", id="lvl1", name="L1", elevation_mm=0)
    doc.elements[view_id] = PlanViewElem(kind="plan_view", id=view_id, name="Plan", level_id="lvl1")
    return doc


# ---------------------------------------------------------------------------
# CreateOptionSetCmd
# ---------------------------------------------------------------------------


def test_create_option_set():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen variant"))
    assert len(doc.design_option_sets) == 1
    assert doc.design_option_sets[0].id == "set1"
    assert doc.design_option_sets[0].name == "Kitchen variant"


def test_create_option_set_duplicate_id_raises():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen variant"))
    with pytest.raises(ValueError, match="duplicate"):
        apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Other"))


# ---------------------------------------------------------------------------
# AddOptionCmd
# ---------------------------------------------------------------------------


def test_add_option():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(
        doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A — galley", isPrimary=True)
    )
    the_set = doc.design_option_sets[0]
    assert len(the_set.options) == 1
    assert the_set.options[0].id == "opt_a"
    assert the_set.options[0].is_primary is True


def test_add_option_is_primary_clears_siblings():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A", isPrimary=True))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_b", name="B", isPrimary=True))
    the_set = doc.design_option_sets[0]
    assert the_set.options[0].is_primary is False
    assert the_set.options[1].is_primary is True


def test_add_option_duplicate_option_id_raises():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    with pytest.raises(ValueError, match="duplicate"):
        apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A2"))


def test_add_option_unknown_set_raises():
    doc = _base_doc()
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(doc, AddOptionCmd(optionSetId="no_such_set", optionId="opt_a", name="A"))


# ---------------------------------------------------------------------------
# RemoveOptionCmd
# ---------------------------------------------------------------------------


def test_remove_option_last_raises():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    with pytest.raises(ValueError, match="only option"):
        apply_inplace(doc, RemoveOptionCmd(optionSetId="set1", optionId="opt_a"))


def test_remove_option_moves_elements_to_main():
    doc = _doc_with_wall()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_b", name="B"))
    apply_inplace(
        doc,
        AssignElementToOptionCmd(elementId="w1", optionSetId="set1", optionId="opt_a"),
    )
    apply_inplace(doc, RemoveOptionCmd(optionSetId="set1", optionId="opt_a"))
    wall = doc.elements["w1"]
    assert getattr(wall, "option_set_id", None) is None
    assert getattr(wall, "option_id", None) is None


# ---------------------------------------------------------------------------
# SetPrimaryOptionCmd
# ---------------------------------------------------------------------------


def test_set_primary_option_transfers_primary():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A", isPrimary=True))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_b", name="B"))
    apply_inplace(doc, SetPrimaryOptionCmd(optionSetId="set1", optionId="opt_b"))
    the_set = doc.design_option_sets[0]
    a = next(o for o in the_set.options if o.id == "opt_a")
    b = next(o for o in the_set.options if o.id == "opt_b")
    assert a.is_primary is False
    assert b.is_primary is True


def test_set_primary_option_unknown_set_raises():
    doc = _base_doc()
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(doc, SetPrimaryOptionCmd(optionSetId="no_set", optionId="opt_a"))


def test_set_primary_option_unknown_option_raises():
    doc = _base_doc()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="K"))
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(doc, SetPrimaryOptionCmd(optionSetId="set1", optionId="no_opt"))


# ---------------------------------------------------------------------------
# AssignElementToOptionCmd
# ---------------------------------------------------------------------------


def test_assign_element_to_option():
    doc = _doc_with_wall()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    apply_inplace(
        doc,
        AssignElementToOptionCmd(elementId="w1", optionSetId="set1", optionId="opt_a"),
    )
    wall = doc.elements["w1"]
    assert wall.option_set_id == "set1"
    assert wall.option_id == "opt_a"


def test_assign_element_to_option_clear():
    doc = _doc_with_wall()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    apply_inplace(
        doc, AssignElementToOptionCmd(elementId="w1", optionSetId="set1", optionId="opt_a")
    )
    apply_inplace(doc, AssignElementToOptionCmd(elementId="w1", optionSetId=None, optionId=None))
    wall = doc.elements["w1"]
    assert wall.option_set_id is None
    assert wall.option_id is None


def test_assign_element_mismatched_null_raises():
    doc = _doc_with_wall()
    with pytest.raises(ValueError, match="both be null or both non-null"):
        apply_inplace(
            doc, AssignElementToOptionCmd(elementId="w1", optionSetId="set1", optionId=None)
        )


def test_assign_element_unknown_element_raises():
    doc = _base_doc()
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(
            doc,
            AssignElementToOptionCmd(elementId="no_elem", optionSetId="set1", optionId="opt_a"),
        )


# ---------------------------------------------------------------------------
# SetViewOptionLockCmd
# ---------------------------------------------------------------------------


def test_set_view_option_lock():
    doc = _doc_with_plan_view()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    apply_inplace(
        doc,
        SetViewOptionLockCmd(viewId="pv1", optionSetId="set1", optionId="opt_a"),
    )
    view = doc.elements["pv1"]
    assert view.option_locks == {"set1": "opt_a"}


def test_set_view_option_lock_clear():
    doc = _doc_with_plan_view()
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A"))
    apply_inplace(doc, SetViewOptionLockCmd(viewId="pv1", optionSetId="set1", optionId="opt_a"))
    apply_inplace(doc, SetViewOptionLockCmd(viewId="pv1", optionSetId="set1", optionId=None))
    view = doc.elements["pv1"]
    assert view.option_locks == {}


def test_set_view_option_lock_invalid_view_raises():
    doc = _base_doc()
    doc.elements["lvl1"] = LevelElem(kind="level", id="lvl1", name="L1", elevation_mm=0)
    with pytest.raises(ValueError, match="plan_view or viewpoint"):
        apply_inplace(
            doc, SetViewOptionLockCmd(viewId="lvl1", optionSetId="set1", optionId="opt_a")
        )


# ---------------------------------------------------------------------------
# resolve_visible_elements
# ---------------------------------------------------------------------------


def _setup_two_option_doc() -> Document:
    """Create a doc with set1/opt_a (primary)/opt_b and two walls."""
    doc = _base_doc()
    doc.elements["lvl1"] = LevelElem(kind="level", id="lvl1", name="L1", elevation_mm=0)
    doc.elements["main_wall"] = WallElem(
        kind="wall",
        id="main_wall",
        name="Main",
        level_id="lvl1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=1000, yMm=0),
    )
    doc.elements["wall_a"] = WallElem(
        kind="wall",
        id="wall_a",
        name="Option A wall",
        level_id="lvl1",
        start=Vec2Mm(xMm=0, yMm=1000),
        end=Vec2Mm(xMm=1000, yMm=1000),
    )
    doc.elements["wall_b"] = WallElem(
        kind="wall",
        id="wall_b",
        name="Option B wall",
        level_id="lvl1",
        start=Vec2Mm(xMm=0, yMm=2000),
        end=Vec2Mm(xMm=1000, yMm=2000),
    )
    apply_inplace(doc, CreateOptionSetCmd(id="set1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_a", name="A", isPrimary=True))
    apply_inplace(doc, AddOptionCmd(optionSetId="set1", optionId="opt_b", name="B"))
    apply_inplace(
        doc, AssignElementToOptionCmd(elementId="wall_a", optionSetId="set1", optionId="opt_a")
    )
    apply_inplace(
        doc, AssignElementToOptionCmd(elementId="wall_b", optionSetId="set1", optionId="opt_b")
    )
    return doc


def test_resolve_visible_elements_includes_main_always():
    doc = _setup_two_option_doc()
    visible = resolve_visible_elements(doc, {})
    assert "main_wall" in visible
    assert "lvl1" in visible


def test_resolve_visible_elements_no_lock_shows_primary():
    doc = _setup_two_option_doc()
    visible = resolve_visible_elements(doc, {})
    assert "wall_a" in visible
    assert "wall_b" not in visible


def test_resolve_visible_elements_with_lock_shows_locked_option():
    doc = _setup_two_option_doc()
    visible = resolve_visible_elements(doc, {"set1": "opt_b"})
    assert "wall_b" in visible
    assert "wall_a" not in visible
    assert "main_wall" in visible


def test_round_trip_create_add_assign_resolve():
    doc = _base_doc()
    doc.elements["lvl1"] = LevelElem(kind="level", id="lvl1", name="L1", elevation_mm=0)
    for i in range(3):
        doc.elements[f"w{i}"] = WallElem(
            kind="wall",
            id=f"w{i}",
            name=f"Wall {i}",
            level_id="lvl1",
            start=Vec2Mm(xMm=0, yMm=float(i * 1000)),
            end=Vec2Mm(xMm=1000, yMm=float(i * 1000)),
        )

    apply_inplace(doc, CreateOptionSetCmd(id="s1", name="Kitchen"))
    apply_inplace(doc, AddOptionCmd(optionSetId="s1", optionId="oa", name="A", isPrimary=True))
    apply_inplace(doc, AddOptionCmd(optionSetId="s1", optionId="ob", name="B"))
    apply_inplace(doc, AssignElementToOptionCmd(elementId="w1", optionSetId="s1", optionId="oa"))
    apply_inplace(doc, AssignElementToOptionCmd(elementId="w2", optionSetId="s1", optionId="ob"))

    visible_b = resolve_visible_elements(doc, {"s1": "ob"})
    assert "w0" in visible_b  # main element always visible
    assert "w2" in visible_b  # opt_b locked
    assert "w1" not in visible_b  # opt_a not visible when opt_b locked
