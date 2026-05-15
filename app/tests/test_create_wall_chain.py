from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem, WallTypeElem, WallTypeLayer
from bim_ai.engine import try_commit


def test_create_wall_chain_preserves_wall_type_location_line_and_constraints() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="Ground", elevation_mm=0),
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="First", elevation_mm=3000),
            "wt-ext": WallTypeElem(
                kind="wall_type",
                id="wt-ext",
                name="External 350",
                layers=[
                    WallTypeLayer(thickness_mm=200, layer_function="structure"),
                    WallTypeLayer(thickness_mm=150, layer_function="finish"),
                ],
            ),
        },
    )

    ok, new_doc, _cmd, _violations, code = try_commit(
        doc,
        {
            "type": "createWallChain",
            "levelId": "lvl-0",
            "namePrefix": "Floor boundary wall",
            "wallTypeId": "wt-ext",
            "locationLine": "finish-face-exterior",
            "baseConstraintLevelId": "lvl-0",
            "topConstraintLevelId": "lvl-1",
            "topConstraintOffsetMm": 250,
            "segments": [
                {
                    "id": "w-a",
                    "start": {"xMm": 0, "yMm": 0},
                    "end": {"xMm": 4000, "yMm": 0},
                    "thicknessMm": 200,
                    "heightMm": 2800,
                },
                {
                    "id": "w-b",
                    "start": {"xMm": 4000, "yMm": 0},
                    "end": {"xMm": 4000, "yMm": 3000},
                    "thicknessMm": 200,
                    "heightMm": 2800,
                },
            ],
        },
    )

    assert ok, code
    assert new_doc is not None
    for wall_id in ("w-a", "w-b"):
        wall = new_doc.elements[wall_id]
        assert isinstance(wall, WallElem)
        assert wall.wall_type_id == "wt-ext"
        assert wall.location_line == "finish-face-exterior"
        assert wall.thickness_mm == 350
        assert wall.height_mm == 3250
        assert wall.base_constraint_level_id == "lvl-0"
        assert wall.top_constraint_level_id == "lvl-1"
