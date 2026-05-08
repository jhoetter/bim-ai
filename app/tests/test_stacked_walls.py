"""KRN-V3-02 — tests for stacked-wall data model, commands, and helpers."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem, WallStack, WallStackComponent
from bim_ai.engine import (
    resolve_stack_wall_type_at_cut,
    schedule_stacked_components,
    try_commit_bundle,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

LEVEL_ID = "lvl-eg"
BRICK_TYPE = "wt-brick"
CLAD_TYPE = "wt-cladding"


def _base_doc() -> Document:
    return Document(
        revision=1,
        elements={
            LEVEL_ID: LevelElem(kind="level", id=LEVEL_ID, name="EG", elevationMm=0),
        },
    )


def _create_wall_cmd(
    wall_id: str = "w1",
    height_mm: float = 6000,
    stack_components: list | None = None,
) -> dict:
    cmd: dict = {
        "type": "createWall",
        "id": wall_id,
        "levelId": LEVEL_ID,
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 5000, "yMm": 0},
        "heightMm": height_mm,
    }
    if stack_components is not None:
        cmd["stackComponents"] = stack_components
    return cmd


# ---------------------------------------------------------------------------
# CreateWallCmd with stackComponents
# ---------------------------------------------------------------------------


def test_create_wall_with_stack_atomically():
    doc = _base_doc()
    ok, new_doc, _, _, code = try_commit_bundle(
        doc,
        [
            _create_wall_cmd(
                stack_components=[
                    {"wallTypeId": BRICK_TYPE, "heightMm": 3000},
                    {"wallTypeId": CLAD_TYPE, "heightMm": 3000},
                ]
            )
        ],
    )
    assert ok is True
    assert code == "ok"
    wall = new_doc.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.stack is not None
    assert len(wall.stack.components) == 2
    assert wall.stack.components[0].wall_type_id == BRICK_TYPE
    assert wall.stack.components[1].wall_type_id == CLAD_TYPE


# ---------------------------------------------------------------------------
# SetWallStackCmd — replace stack
# ---------------------------------------------------------------------------


def test_set_wall_stack_replaces_stack():
    doc = _base_doc()
    ok, doc2, _, _, _ = try_commit_bundle(doc, [_create_wall_cmd()])
    assert ok

    ok, doc3, _, _, code = try_commit_bundle(
        doc2,
        [
            {
                "type": "setWallStack",
                "wallId": "w1",
                "components": [
                    {"wallTypeId": BRICK_TYPE, "heightMm": 3000},
                    {"wallTypeId": CLAD_TYPE, "heightMm": 3000},
                ],
            }
        ],
    )
    assert ok is True
    assert code == "ok"
    wall = doc3.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.stack is not None
    assert wall.stack.components[0].wall_type_id == BRICK_TYPE


def test_set_wall_stack_clears_stack():
    doc = _base_doc()
    ok, doc2, _, _, _ = try_commit_bundle(
        doc,
        [
            _create_wall_cmd(
                stack_components=[{"wallTypeId": BRICK_TYPE, "heightMm": 3000}]
            )
        ],
    )
    assert ok

    ok, doc3, _, _, code = try_commit_bundle(
        doc2,
        [{"type": "setWallStack", "wallId": "w1", "components": []}],
    )
    assert ok is True
    assert code == "ok"
    wall = doc3.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.stack is None


# ---------------------------------------------------------------------------
# Validation: prefix sum ≥ wall height must be rejected
# ---------------------------------------------------------------------------


def test_validation_rejects_prefix_sum_exceeds_height():
    # prefix (all-but-last) = 7000, wall height = 6000 → reject
    doc = _base_doc()
    ok, _, _, _, code = try_commit_bundle(
        doc,
        [
            _create_wall_cmd(
                height_mm=6000,
                stack_components=[
                    {"wallTypeId": BRICK_TYPE, "heightMm": 7000},
                    {"wallTypeId": CLAD_TYPE, "heightMm": 1000},
                ],
            )
        ],
    )
    assert ok is False


def test_validation_rejects_prefix_sum_equal_to_height():
    doc = _base_doc()
    ok, _, _, _, _ = try_commit_bundle(
        doc,
        [
            _create_wall_cmd(
                height_mm=6000,
                stack_components=[
                    {"wallTypeId": BRICK_TYPE, "heightMm": 6000},
                    {"wallTypeId": CLAD_TYPE, "heightMm": 1000},
                ],
            )
        ],
    )
    assert ok is False


# ---------------------------------------------------------------------------
# resolve_stack_wall_type_at_cut
# ---------------------------------------------------------------------------


def _stacked_wall(height_mm: float = 6000) -> WallElem:
    return WallElem(
        kind="wall",
        id="w1",
        levelId=LEVEL_ID,
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
        heightMm=height_mm,
        stack=WallStack(
            components=[
                WallStackComponent(wallTypeId=BRICK_TYPE, heightMm=3000),
                WallStackComponent(wallTypeId=CLAD_TYPE, heightMm=3000),
            ]
        ),
    )


def test_cut_at_1000mm_returns_brick():
    wall = _stacked_wall()
    result = resolve_stack_wall_type_at_cut(wall, 1000)
    assert result == BRICK_TYPE


def test_cut_at_4000mm_returns_cladding():
    wall = _stacked_wall()
    result = resolve_stack_wall_type_at_cut(wall, 4000)
    assert result == CLAD_TYPE


def test_cut_on_non_stacked_wall_returns_wall_type_id():
    wall = WallElem(
        kind="wall",
        id="w2",
        levelId=LEVEL_ID,
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
        heightMm=3000,
        wallTypeId=BRICK_TYPE,
    )
    result = resolve_stack_wall_type_at_cut(wall, 1500)
    assert result == BRICK_TYPE


def test_cut_at_seam_boundary_returns_upper_component():
    wall = _stacked_wall()
    # cut exactly at 3000 should be in the second (cladding) component
    result = resolve_stack_wall_type_at_cut(wall, 3000)
    assert result == CLAD_TYPE


# ---------------------------------------------------------------------------
# schedule_stacked_components
# ---------------------------------------------------------------------------


def test_schedule_returns_two_rows_for_two_component_stack():
    wall = _stacked_wall()
    rows = schedule_stacked_components(wall)
    assert len(rows) == 2
    assert rows[0]["wallTypeId"] == BRICK_TYPE
    assert rows[0]["componentIndex"] == 0
    assert rows[1]["wallTypeId"] == CLAD_TYPE
    assert rows[1]["componentIndex"] == 1


def test_schedule_non_stacked_returns_one_row():
    wall = WallElem(
        kind="wall",
        id="w2",
        levelId=LEVEL_ID,
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
        heightMm=3000,
        wallTypeId=BRICK_TYPE,
    )
    rows = schedule_stacked_components(wall)
    assert len(rows) == 1
    assert rows[0]["wallTypeId"] == BRICK_TYPE
    assert rows[0]["heightMm"] == 3000
    assert rows[0]["componentIndex"] == 0


def test_last_component_remainder_height():
    """A 6000 mm wall with one 3000 mm component: remainder row has 3000 mm."""
    wall = WallElem(
        kind="wall",
        id="w3",
        levelId=LEVEL_ID,
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
        heightMm=6000,
        stack=WallStack(
            components=[
                WallStackComponent(wallTypeId=BRICK_TYPE, heightMm=3000),
                WallStackComponent(wallTypeId=CLAD_TYPE, heightMm=1),
            ]
        ),
    )
    rows = schedule_stacked_components(wall)
    assert len(rows) == 2
    assert rows[1]["heightMm"] == pytest.approx(3000.0)
