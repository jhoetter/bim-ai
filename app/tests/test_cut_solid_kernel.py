"""Cut-solid kernel parity with glTF wall/floor/slab segmentation (WP-B02/B03/E03)."""

from __future__ import annotations

from bim_ai.cut_solid_kernel import collect_wall_floor_slab_cut_boxes
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    SlabOpeningElem,
    WallElem,
    WindowElem,
)
from bim_ai.export_gltf import _collect_geom_boxes


def test_cut_kernel_matches_geom_box_wall_floor_slab_slice() -> None:
    doc = Document(
        revision=7,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
                revealInteriorMm=100,
            ),
            "z1": WindowElem(
                kind="window",
                id="z1",
                name="Z",
                wallId="w1",
                alongT=0.2,
                widthMm=900,
                sillHeightMm=900,
                heightMm=1200,
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                thicknessMm=220,
            ),
            "so": SlabOpeningElem(
                kind="slab_opening",
                id="so",
                name="O",
                hostFloorId="fl",
                boundaryMm=[
                    {"xMm": 900, "yMm": 900},
                    {"xMm": 1900, "yMm": 900},
                    {"xMm": 1900, "yMm": 1700},
                    {"xMm": 900, "yMm": 1700},
                ],
            ),
        },
    )
    kern = collect_wall_floor_slab_cut_boxes(doc)
    from_glb = [
        gb
        for gb in _collect_geom_boxes(doc)
        if gb.kind in {"wall", "floor", "slab_opening"}
    ]
    assert len(kern) == len(from_glb)
    for a, b in zip(
        sorted(kern, key=lambda x: (x.kind, x.elem_id)),
        sorted(from_glb, key=lambda x: (x.kind, x.elem_id)),
        strict=True,
    ):
        assert a.kind == b.kind
        assert a.elem_id == b.elem_id
        assert abs(a.translation[0] - b.translation[0]) < 1e-9
        assert abs(a.translation[1] - b.translation[1]) < 1e-9
        assert abs(a.translation[2] - b.translation[2]) < 1e-9
        assert abs(a.yaw - b.yaw) < 1e-9
        assert abs(a.hx - b.hx) < 1e-9
        assert abs(a.hy - b.hy) < 1e-9
        assert abs(a.hz - b.hz) < 1e-9


def test_wall_without_hostings_emits_single_prism() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    boxes = collect_wall_floor_slab_cut_boxes(doc)
    assert len(boxes) == 1
    assert boxes[0].kind == "wall"
    assert boxes[0].elem_id == "w1"


def test_door_reveal_shortens_wall_prism_half_length_along_wall() -> None:
    """Wider rough opening from revealInteriorMm removes more wall length in cut boxes."""
    common_wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 6000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc_plain = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "w1": common_wall,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
            ),
        },
    )
    doc_rev = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "w1": common_wall,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
                revealInteriorMm=120,
            ),
        },
    )
    walls0 = [b for b in collect_wall_floor_slab_cut_boxes(doc_plain) if b.kind == "wall"]
    walls1 = [b for b in collect_wall_floor_slab_cut_boxes(doc_rev) if b.kind == "wall"]
    assert len(walls0) == len(walls1) == 2
    assert max(b.hx for b in walls1) < max(b.hx for b in walls0) - 1e-9
