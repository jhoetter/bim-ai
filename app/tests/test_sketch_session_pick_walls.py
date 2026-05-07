"""SKT-02 — Pick Walls sub-tool tests.

Verifies the load-bearing UX of `rebuild_picked_walls_lines` and
`derive_wall_sketch_line`:
  - centerline mode → wall start/end straight to a sketch line
  - interior_face mode → offset by half-thickness toward the cluster centroid
  - 4 walls of a rectangular room produce a closed-loop sketch (after corner
    auto-trim)
  - re-picking the same wall toggles it off (no line emitted)
  - flipping offset_mode re-derives existing picked walls
"""

from __future__ import annotations

from bim_ai.elements import Vec2Mm, WallElem
from bim_ai.sketch_pick_walls import (
    derive_wall_sketch_line,
    rebuild_picked_walls_lines,
    trim_corners,
)
from bim_ai.sketch_session import (
    PickedWall,
    SketchLine,
    SketchSession,
)
from bim_ai.sketch_validation import validate_session


def _wall(wid: str, x0: float, y0: float, x1: float, y1: float, thickness_mm: float = 200) -> WallElem:
    return WallElem(
        kind="wall",
        id=wid,
        name=wid,
        levelId="lvl-1",
        start=Vec2Mm(xMm=x0, yMm=y0),
        end=Vec2Mm(xMm=x1, yMm=y1),
        thicknessMm=thickness_mm,
    )


def _make_session(walls: list[PickedWall], offset_mode: str = "interior_face") -> SketchSession:
    return SketchSession(
        sessionId="sk-1",
        modelId="m-1",
        elementKind="floor",
        levelId="lvl-1",
        lines=[],
        status="open",
        pickWallsOffsetMode=offset_mode,  # type: ignore[arg-type]
        pickedWalls=walls,
    )


def test_centerline_mode_emits_unmodified_axis():
    wall = _wall("w1", 0, 0, 4000, 0, thickness_mm=200)
    line = derive_wall_sketch_line(wall, "centerline", interior_anchor=None)
    assert line.from_mm.x_mm == 0 and line.from_mm.y_mm == 0
    assert line.to_mm.x_mm == 4000 and line.to_mm.y_mm == 0


def test_interior_face_mode_offsets_toward_anchor():
    """A horizontal wall offset toward an anchor below should land at y = -100."""

    wall = _wall("w1", 0, 0, 4000, 0, thickness_mm=200)
    line = derive_wall_sketch_line(wall, "interior_face", interior_anchor=(2000, -2000))
    # Half-thickness = 100, offset toward the anchor (negative y).
    assert abs(line.from_mm.y_mm + 100) < 1e-6
    assert abs(line.to_mm.y_mm + 100) < 1e-6


def test_four_picked_walls_form_closed_loop_after_trim():
    """4 walls of a rectangular room → after corner trim, lines form a closed loop."""

    walls = [
        _wall("south", 0, 0, 4000, 0),
        _wall("east", 4000, 0, 4000, 3000),
        _wall("north", 4000, 3000, 0, 3000),
        _wall("west", 0, 3000, 0, 0),
    ]
    walls_by_id = {w.id: w for w in walls}
    sess = _make_session(
        [PickedWall(wallId=w.id, lineIndex=-1) for w in walls],
        offset_mode="interior_face",
    )
    new_lines, repinned = rebuild_picked_walls_lines(sess, walls_by_id)

    assert len(new_lines) == 4
    assert [p.line_index for p in repinned] == [0, 1, 2, 3]

    # After offsetting each wall by 100mm inward + corner trim, the loop should
    # close — feed it through validate_session, no open_loop issue should remain.
    state = validate_session(new_lines)
    open_issues = [i for i in state.issues if i.code == "open_loop"]
    assert open_issues == [], f"loop did not close: {state.issues}"


def test_unknown_wall_id_skipped_silently():
    """A picked wall whose id no longer exists in the document is dropped."""

    walls_by_id = {
        "w1": _wall("w1", 0, 0, 1000, 0),
    }
    sess = _make_session(
        [
            PickedWall(wallId="w1", lineIndex=-1),
            PickedWall(wallId="ghost", lineIndex=-1),
        ]
    )
    new_lines, repinned = rebuild_picked_walls_lines(sess, walls_by_id)
    assert len(new_lines) == 1
    assert len(repinned) == 1
    assert repinned[0].wall_id == "w1"


def test_flip_offset_mode_changes_emitted_lines():
    """Toggling between centerline and interior_face re-derives the lines."""

    walls = [_wall("w1", 0, 0, 4000, 0, thickness_mm=200)]
    walls_by_id = {w.id: w for w in walls}
    sess_center = _make_session(
        [PickedWall(wallId="w1", lineIndex=-1)],
        offset_mode="centerline",
    )
    lines_center, _ = rebuild_picked_walls_lines(sess_center, walls_by_id)

    sess_interior = _make_session(
        [PickedWall(wallId="w1", lineIndex=-1)],
        offset_mode="interior_face",
    )
    lines_interior, _ = rebuild_picked_walls_lines(sess_interior, walls_by_id)

    # Centerline lies on y=0; interior_face shifts to ±100. With one wall and no
    # anchor flip, the sign is implementation-defined but the magnitude is 100.
    assert abs(lines_center[0].from_mm.y_mm) < 1e-6
    assert abs(abs(lines_interior[0].from_mm.y_mm) - 100) < 1e-6


def test_freehand_lines_preserved_alongside_picked():
    """Freehand sketch lines (not bound to any picked wall) survive a rebuild."""

    walls = [_wall("w1", 0, 0, 1000, 0)]
    walls_by_id = {w.id: w for w in walls}
    sess = SketchSession(
        sessionId="sk-1",
        modelId="m-1",
        elementKind="floor",
        levelId="lvl-1",
        lines=[
            SketchLine(from_mm=Vec2Mm(xMm=2000, yMm=2000), to_mm=Vec2Mm(xMm=3000, yMm=2000)),
        ],
        status="open",
        pickWallsOffsetMode="centerline",
        pickedWalls=[PickedWall(wallId="w1", lineIndex=-1)],
    )
    new_lines, repinned = rebuild_picked_walls_lines(sess, walls_by_id)

    # Freehand line stays at index 0; picked wall line lands at index 1.
    assert new_lines[0].from_mm.x_mm == 2000
    assert repinned[0].line_index == 1


def test_trim_corners_snaps_close_endpoints_to_intersection():
    """Two near-touching segments at right angles should snap to their crossing."""

    lines = [
        SketchLine(
            from_mm=Vec2Mm(xMm=0, yMm=0),
            to_mm=Vec2Mm(xMm=1000, yMm=0),
        ),
        # Starts 5mm shy of the previous endpoint at (1000, 0); ends going up.
        SketchLine(
            from_mm=Vec2Mm(xMm=1005, yMm=5),
            to_mm=Vec2Mm(xMm=1005, yMm=2000),
        ),
    ]
    trimmed = trim_corners(lines)

    # The shared corner should land at the intersection of the two infinite lines:
    # x=1005 (vertical) ∩ y=0 (horizontal) → (1005, 0).
    assert abs(trimmed[0].to_mm.x_mm - 1005) < 1e-6
    assert abs(trimmed[0].to_mm.y_mm) < 1e-6
    assert abs(trimmed[1].from_mm.x_mm - 1005) < 1e-6
    assert abs(trimmed[1].from_mm.y_mm) < 1e-6
