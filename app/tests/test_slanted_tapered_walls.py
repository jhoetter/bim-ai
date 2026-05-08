"""KRN-V3-07 — tests for slanted & tapered wall data model, commands, and helpers."""

from __future__ import annotations

import math

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem
from bim_ai.engine import resolve_wall_face_offset_at_cut, try_commit_bundle


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

LEVEL_ID = "lvl-eg"


def _base_doc() -> Document:
    return Document(
        revision=1,
        elements={
            LEVEL_ID: LevelElem(kind="level", id=LEVEL_ID, name="EG", elevationMm=0),
        },
    )


def _create_wall_cmd(
    wall_id: str = "w1",
    height_mm: float = 3000,
    lean_mm: dict | None = None,
    taper_ratio: float | None = None,
) -> dict:
    cmd: dict = {
        "type": "createWall",
        "id": wall_id,
        "levelId": LEVEL_ID,
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 3000, "yMm": 0},
        "heightMm": height_mm,
    }
    if lean_mm is not None:
        cmd["leanMm"] = lean_mm
    if taper_ratio is not None:
        cmd["taperRatio"] = taper_ratio
    return cmd


# ---------------------------------------------------------------------------
# CreateWallCmd — leanMm / taperRatio
# ---------------------------------------------------------------------------


def test_create_wall_with_lean_mm_populates_field():
    doc = _base_doc()
    ok, new_doc, _, _, code = try_commit_bundle(
        doc,
        [_create_wall_cmd(lean_mm={"xMm": 0, "yMm": 200})],
    )
    assert ok is True
    assert code == "ok"
    wall = new_doc.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.lean_mm is not None
    assert wall.lean_mm.y_mm == pytest.approx(200.0)


def test_create_wall_with_taper_ratio_populates_field():
    doc = _base_doc()
    ok, new_doc, _, _, code = try_commit_bundle(
        doc,
        [_create_wall_cmd(taper_ratio=0.5)],
    )
    assert ok is True
    assert code == "ok"
    wall = new_doc.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.taper_ratio == pytest.approx(0.5)


def test_create_wall_without_lean_taper_is_prismatic():
    doc = _base_doc()
    ok, new_doc, _, _, _ = try_commit_bundle(doc, [_create_wall_cmd()])
    assert ok is True
    wall = new_doc.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.lean_mm is None
    assert wall.taper_ratio is None


# ---------------------------------------------------------------------------
# SetWallLeanTaperCmd
# ---------------------------------------------------------------------------


def test_set_wall_lean_taper_updates_lean():
    doc = _base_doc()
    ok, doc2, _, _, _ = try_commit_bundle(doc, [_create_wall_cmd()])
    assert ok

    ok, doc3, _, _, code = try_commit_bundle(
        doc2,
        [{"type": "setWallLeanTaper", "wallId": "w1", "leanMm": {"xMm": 0, "yMm": 200}}],
    )
    assert ok is True
    assert code == "ok"
    wall = doc3.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.lean_mm is not None
    assert wall.lean_mm.y_mm == pytest.approx(200.0)


def test_set_wall_lean_taper_clears_both_fields():
    doc = _base_doc()
    ok, doc2, _, _, _ = try_commit_bundle(
        doc, [_create_wall_cmd(lean_mm={"xMm": 100, "yMm": 0}, taper_ratio=0.8)]
    )
    assert ok

    ok, doc3, _, _, code = try_commit_bundle(
        doc2,
        [{"type": "setWallLeanTaper", "wallId": "w1", "leanMm": None, "taperRatio": None}],
    )
    assert ok is True
    wall = doc3.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.lean_mm is None
    assert wall.taper_ratio is None


def test_set_wall_lean_taper_preserves_existing_fields():
    doc = _base_doc()
    ok, doc2, _, _, _ = try_commit_bundle(
        doc, [_create_wall_cmd(height_mm=4000)]
    )
    assert ok

    ok, doc3, _, _, _ = try_commit_bundle(
        doc2,
        [{"type": "setWallLeanTaper", "wallId": "w1", "leanMm": {"xMm": 0, "yMm": 100}}],
    )
    assert ok is True
    wall = doc3.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.height_mm == pytest.approx(4000.0)
    assert wall.level_id == LEVEL_ID


# ---------------------------------------------------------------------------
# Validation: leanMm magnitude exceeds limit
# ---------------------------------------------------------------------------


def test_validation_rejects_lean_exceeding_height_tan60():
    # wall height = 3000 mm; max lean = 3000 * tan(60°) ≈ 5196 mm
    # Using 6000 mm (diagonal) → exceeds limit
    doc = _base_doc()
    ok, _, _, _, _ = try_commit_bundle(
        doc,
        [_create_wall_cmd(height_mm=3000, lean_mm={"xMm": 6000, "yMm": 0})],
    )
    assert ok is False


def test_validation_accepts_lean_at_boundary():
    # Exactly at tan(60°) minus a tiny margin should be accepted
    height_mm = 3000.0
    max_lean = height_mm * math.tan(math.radians(60))
    safe_lean = max_lean * 0.999
    doc = _base_doc()
    ok, _, _, _, _ = try_commit_bundle(
        doc,
        [_create_wall_cmd(height_mm=3000, lean_mm={"xMm": safe_lean, "yMm": 0})],
    )
    assert ok is True


# ---------------------------------------------------------------------------
# Validation: taperRatio bounds
# ---------------------------------------------------------------------------


def test_validation_rejects_taper_ratio_below_lower_bound():
    doc = _base_doc()
    ok, _, _, _, _ = try_commit_bundle(doc, [_create_wall_cmd(taper_ratio=0.05)])
    assert ok is False


def test_validation_rejects_taper_ratio_above_upper_bound():
    doc = _base_doc()
    ok, _, _, _, _ = try_commit_bundle(doc, [_create_wall_cmd(taper_ratio=15)])
    assert ok is False


def test_validation_accepts_taper_ratio_1():
    doc = _base_doc()
    ok, new_doc, _, _, _ = try_commit_bundle(doc, [_create_wall_cmd(taper_ratio=1.0)])
    assert ok is True
    wall = new_doc.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.taper_ratio == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# resolve_wall_face_offset_at_cut
# ---------------------------------------------------------------------------


def _leaning_wall(lean_x: float = 0, lean_y: float = 200, height_mm: float = 3000) -> WallElem:
    return WallElem(
        kind="wall",
        id="w1",
        levelId=LEVEL_ID,
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=3000, yMm=0),
        heightMm=height_mm,
        leanMm=Vec2Mm(xMm=lean_x, yMm=lean_y),
    )


def test_resolve_offset_at_half_height_returns_half_lean():
    wall = _leaning_wall(lean_y=200, height_mm=3000)
    x_off, y_off = resolve_wall_face_offset_at_cut(wall, 1500)
    assert x_off == pytest.approx(0.0)
    assert y_off == pytest.approx(100.0)


def test_resolve_offset_on_non_leaning_wall_returns_zero():
    wall = WallElem(
        kind="wall",
        id="w2",
        levelId=LEVEL_ID,
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=3000, yMm=0),
        heightMm=3000,
    )
    x_off, y_off = resolve_wall_face_offset_at_cut(wall, 1500)
    assert x_off == pytest.approx(0.0)
    assert y_off == pytest.approx(0.0)


def test_resolve_offset_at_full_height_returns_full_lean():
    wall = _leaning_wall(lean_x=150, lean_y=200, height_mm=3000)
    x_off, y_off = resolve_wall_face_offset_at_cut(wall, 3000)
    assert x_off == pytest.approx(150.0)
    assert y_off == pytest.approx(200.0)


def test_resolve_offset_at_base_returns_zero():
    wall = _leaning_wall(lean_y=200, height_mm=3000)
    x_off, y_off = resolve_wall_face_offset_at_cut(wall, 0)
    assert x_off == pytest.approx(0.0)
    assert y_off == pytest.approx(0.0)


def test_resolve_offset_plan_cut_at_1200_of_3000():
    """Acceptance criterion: 3 m wall with 200 mm lean south; cut at 1.2 m → 80 mm offset."""
    wall = _leaning_wall(lean_y=200, height_mm=3000)
    _, y_off = resolve_wall_face_offset_at_cut(wall, 1200)
    assert y_off == pytest.approx(200 * (1200 / 3000))
