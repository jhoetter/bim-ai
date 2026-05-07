from __future__ import annotations

import math

from bim_ai.commands import MirrorAxis, MirrorElementsCmd
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.engine import (
    _mirror_polygon,
    _reflect_point_xy_mm,
    apply_inplace,
    mirror_advisories_for_command,
)


def _approx(a: float, b: float, tol: float = 1e-6) -> bool:
    return math.isclose(a, b, abs_tol=tol)


def _vec_approx(p: Vec2Mm, x: float, y: float) -> bool:
    return _approx(p.x_mm, x) and _approx(p.y_mm, y)


def test_reflect_point_across_vertical_axis():
    rx, ry = _reflect_point_xy_mm(0.0, 100.0, 500.0, 0.0, 500.0, 1000.0)
    assert _approx(rx, 1000.0)
    assert _approx(ry, 100.0)


def test_reflect_point_across_horizontal_axis():
    rx, ry = _reflect_point_xy_mm(100.0, 200.0, 0.0, 0.0, 1000.0, 0.0)
    assert _approx(rx, 100.0)
    assert _approx(ry, -200.0)


def test_reflect_point_across_45deg_axis_through_origin():
    # y = x line; reflecting (3,1) -> (1,3)
    rx, ry = _reflect_point_xy_mm(3.0, 1.0, 0.0, 0.0, 10.0, 10.0)
    assert _approx(rx, 1.0)
    assert _approx(ry, 3.0)


def test_reflect_point_degenerate_axis_falls_back_to_point_reflection():
    # Both axis endpoints identical → point reflection through (5,5)
    rx, ry = _reflect_point_xy_mm(7.0, 9.0, 5.0, 5.0, 5.0, 5.0)
    assert _approx(rx, 3.0)
    assert _approx(ry, 1.0)


def test_polygon_winding_reverses_after_mirror():
    pts = [Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=1000, yMm=0), Vec2Mm(xMm=500, yMm=500)]
    out = _mirror_polygon(pts, Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=1000, yMm=0))
    # Reflected across X axis, vertex order reversed
    assert _vec_approx(out[0], 500, -500)
    assert _vec_approx(out[1], 1000, 0)
    assert _vec_approx(out[2], 0, 0)


def _doc_with_wall_and_door() -> Document:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="Wall",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=1000, yMm=0),
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(kind="door", id="d1", name="Door", wallId="w1", alongT=0.25, widthMm=900)
    return Document(revision=1, elements={"lvl-1": lvl, "w1": wall, "d1": door})


def test_mirror_wall_in_place_swaps_endpoints():
    doc = _doc_with_wall_and_door()
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["w1"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=500, yMm=0), endMm=Vec2Mm(xMm=500, yMm=1000)),
        alsoCopy=False,
    )
    apply_inplace(doc, cmd)
    w = doc.elements["w1"]
    assert isinstance(w, WallElem)
    # Wall (0,0)->(1000,0) mirrored across x=500 line: endpoints become
    # (1000,0) and (0,0) respectively (with swap so winding stays sane).
    assert _vec_approx(w.start, 1000, 0)
    assert _vec_approx(w.end, 0, 0)


def test_mirror_in_place_keeps_alongt_but_door_physically_mirrors_via_wall():
    """Mirror reverses the wall's start→end vector, so a door at
    alongT=0.25 (originally at x=250) ends up at x=750 — the mirror
    of its original physical position — without changing alongT."""
    doc = _doc_with_wall_and_door()
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["w1"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=500, yMm=0), endMm=Vec2Mm(xMm=500, yMm=1000)),
        alsoCopy=False,
    )
    apply_inplace(doc, cmd)
    d = doc.elements["d1"]
    w = doc.elements["w1"]
    assert isinstance(d, DoorElem)
    assert isinstance(w, WallElem)
    assert _approx(d.along_t, 0.25)
    # Physical door position derived from start + alongT * (end - start).
    physical_x = w.start.x_mm + d.along_t * (w.end.x_mm - w.start.x_mm)
    physical_y = w.start.y_mm + d.along_t * (w.end.y_mm - w.start.y_mm)
    assert _approx(physical_x, 750)
    assert _approx(physical_y, 0)


def test_mirror_with_also_copy_keeps_originals_and_adds_mirrored_pair():
    doc = _doc_with_wall_and_door()
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["w1"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=500, yMm=0), endMm=Vec2Mm(xMm=500, yMm=1000)),
        alsoCopy=True,
    )
    apply_inplace(doc, cmd)
    # Originals unchanged
    w_orig = doc.elements["w1"]
    d_orig = doc.elements["d1"]
    assert isinstance(w_orig, WallElem)
    assert isinstance(d_orig, DoorElem)
    assert _vec_approx(w_orig.start, 0, 0)
    assert _approx(d_orig.along_t, 0.25)

    # Mirrored copy of wall + door exist
    walls = [el for el in doc.elements.values() if isinstance(el, WallElem)]
    doors = [el for el in doc.elements.values() if isinstance(el, DoorElem)]
    assert len(walls) == 2
    assert len(doors) == 2
    new_wall = next(w for w in walls if w.id != "w1")
    new_door = next(d for d in doors if d.id != "d1")
    assert _vec_approx(new_wall.start, 1000, 0)
    assert _vec_approx(new_wall.end, 0, 0)
    assert new_door.wall_id == new_wall.id
    # alongT preserved on the copy; the new wall's reversed direction
    # places the door at the mirror of the original physical x=250.
    assert _approx(new_door.along_t, 0.25)
    physical_x = new_wall.start.x_mm + new_door.along_t * (new_wall.end.x_mm - new_wall.start.x_mm)
    assert _approx(physical_x, 750)


def test_mirror_room_polygon_reverses_winding():
    lvl = LevelElem(kind="level", id="lvl-1", name="L", elevationMm=0)
    room = RoomElem(
        kind="room",
        id="r1",
        name="R",
        levelId="lvl-1",
        outlineMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=1000, yMm=0),
            Vec2Mm(xMm=1000, yMm=500),
            Vec2Mm(xMm=0, yMm=500),
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "r1": room})
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["r1"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=0, yMm=0), endMm=Vec2Mm(xMm=1000, yMm=0)),
        alsoCopy=False,
    )
    apply_inplace(doc, cmd)
    r = doc.elements["r1"]
    assert isinstance(r, RoomElem)
    # Reflected across X axis + reversed winding
    assert _vec_approx(r.outline_mm[0], 0, -500)
    assert _vec_approx(r.outline_mm[1], 1000, -500)
    assert _vec_approx(r.outline_mm[2], 1000, 0)
    assert _vec_approx(r.outline_mm[3], 0, 0)


def test_mirror_floor_polygon_reverses_winding():
    lvl = LevelElem(kind="level", id="lvl-1", name="L", elevationMm=0)
    floor = FloorElem(
        kind="floor",
        id="f1",
        name="F",
        levelId="lvl-1",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=1000, yMm=0),
            Vec2Mm(xMm=500, yMm=500),
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "f1": floor})
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["f1"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=0, yMm=0), endMm=Vec2Mm(xMm=1000, yMm=0)),
        alsoCopy=False,
    )
    apply_inplace(doc, cmd)
    f = doc.elements["f1"]
    assert isinstance(f, FloorElem)
    assert _vec_approx(f.boundary_mm[0], 500, -500)
    assert _vec_approx(f.boundary_mm[1], 1000, 0)
    assert _vec_approx(f.boundary_mm[2], 0, 0)


def test_mirror_roof_polygon_reverses_winding():
    lvl = LevelElem(kind="level", id="lvl-1", name="L", elevationMm=0)
    roof = RoofElem(
        kind="roof",
        id="rf1",
        name="Roof",
        referenceLevelId="lvl-1",
        footprintMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=1000, yMm=0),
            Vec2Mm(xMm=1000, yMm=500),
            Vec2Mm(xMm=0, yMm=500),
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "rf1": roof})
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["rf1"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=500, yMm=0), endMm=Vec2Mm(xMm=500, yMm=1000)),
        alsoCopy=False,
    )
    apply_inplace(doc, cmd)
    rf = doc.elements["rf1"]
    assert isinstance(rf, RoofElem)
    # X coords reflected across x=500, winding reversed
    assert _vec_approx(rf.footprint_mm[0], 1000, 500)
    assert _vec_approx(rf.footprint_mm[1], 0, 500)
    assert _vec_approx(rf.footprint_mm[2], 0, 0)
    assert _vec_approx(rf.footprint_mm[3], 1000, 0)


def test_mirror_advisories_for_asymmetric_family_type():
    lvl = LevelElem(kind="level", id="lvl-1", name="L", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=1000, yMm=0),
    )
    handle_door = DoorElem(
        kind="door",
        id="d_handle",
        name="D",
        wallId="w1",
        alongT=0.5,
        familyTypeId="ft_door_with_handle",
    )
    plain_door = DoorElem(
        kind="door",
        id="d_plain",
        name="D",
        wallId="w1",
        alongT=0.7,
        familyTypeId="ft_door_plain",
    )
    doc = Document(
        revision=1,
        elements={"lvl-1": lvl, "w1": wall, "d_handle": handle_door, "d_plain": plain_door},
    )
    cmd = MirrorElementsCmd(
        type="mirrorElements",
        elementIds=["d_handle", "d_plain"],
        axis=MirrorAxis(startMm=Vec2Mm(xMm=500, yMm=0), endMm=Vec2Mm(xMm=500, yMm=1000)),
        asymmetricFamilyTypeIds=["ft_door_with_handle"],
    )
    advisories = mirror_advisories_for_command(doc, cmd)
    assert advisories == [{"code": "mirror_asymmetric", "elementId": "d_handle"}]


def test_mirror_command_round_trips_through_command_adapter():
    # Wire payload (camelCase) parses cleanly through the discriminated union.
    from bim_ai.engine import command_adapter

    raw = {
        "type": "mirrorElements",
        "elementIds": ["w1"],
        "axis": {
            "startMm": {"xMm": 0.0, "yMm": 0.0},
            "endMm": {"xMm": 0.0, "yMm": 1000.0},
        },
        "alsoCopy": True,
    }
    parsed = command_adapter.validate_python(raw)
    assert isinstance(parsed, MirrorElementsCmd)
    assert parsed.element_ids == ["w1"]
    assert parsed.also_copy is True
