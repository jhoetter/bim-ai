from __future__ import annotations

from bim_ai.constraints_evaluation import evaluate
from bim_ai.elements import (
    AssetLibraryEntryElem,
    BeamElem,
    ColumnElem,
    DoorElem,
    DuctElem,
    FamilyInstanceElem,
    FamilyTypeElem,
    FloorElem,
    LevelElem,
    PipeElem,
    PlacedAssetElem,
    StairElem,
    WallElem,
    WallOpeningElem,
)


def _rule_ids(elements: dict[str, object]) -> set[str]:
    return {violation.rule_id for violation in evaluate(elements)}  # type: ignore[arg-type]


def _level() -> LevelElem:
    return LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0)


def _wall(**overrides: object) -> WallElem:
    payload: dict[str, object] = {
        "kind": "wall",
        "id": "wall-1",
        "name": "Wall",
        "levelId": "lvl-1",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 4000, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 3000,
    }
    payload.update(overrides)
    return WallElem.model_validate(payload)


def _asset_library() -> AssetLibraryEntryElem:
    return AssetLibraryEntryElem(
        kind="asset_library_entry",
        id="asset-shelf",
        assetKind="block_2d",
        name="Shelf",
        category="casework",
        tags=[],
        thumbnailKind="schematic_plan",
        thumbnailWidthMm=600,
        thumbnailHeightMm=300,
    )


def _shelf(*, y_mm: float, id: str = "shelf-1") -> PlacedAssetElem:
    return PlacedAssetElem(
        kind="placed_asset",
        id=id,
        name="Shelf",
        assetId="asset-shelf",
        levelId="lvl-1",
        positionMm={"xMm": 1200, "yMm": y_mm},
        paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
    )


def test_shelf_through_wall_is_reported_in_warning_evaluator() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "asset-shelf": _asset_library(),
        "shelf-1": _shelf(y_mm=0),
    }

    assert "furniture_wall_hard_clash" in _rule_ids(elements)


def test_shelf_near_wall_but_clear_is_not_reported_as_wall_clash() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "asset-shelf": _asset_library(),
        "shelf-1": _shelf(y_mm=500),
    }

    assert "furniture_wall_hard_clash" not in _rule_ids(elements)


def test_family_instance_through_wall_uses_family_type_proxy() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "ft-cabinet": FamilyTypeElem(
            kind="family_type",
            id="ft-cabinet",
            familyId="casework",
            discipline="generic",
            parameters={"widthMm": 700, "depthMm": 500, "heightMm": 2100},
        ),
        "cabinet-1": FamilyInstanceElem(
            kind="family_instance",
            id="cabinet-1",
            familyTypeId="ft-cabinet",
            levelId="lvl-1",
            positionMm={"xMm": 1000, "yMm": 0},
        ),
    }

    assert "furniture_wall_hard_clash" in _rule_ids(elements)


def test_stair_wall_clash_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "wall-1": _wall(),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 1500, "yMm": -600},
            runEndMm={"xMm": 1500, "yMm": 1200},
            widthMm=1000,
        ),
    }

    assert "stair_wall_hard_clash" in _rule_ids(elements)


def test_pipe_penetration_without_wall_opening_is_reported_and_opening_suppresses_it() -> None:
    pipe = PipeElem(
        kind="pipe",
        id="pipe-1",
        levelId="lvl-1",
        startMm={"xMm": 1000, "yMm": -500},
        endMm={"xMm": 1000, "yMm": 500},
        elevationMm=1000,
        diameterMm=50,
    )
    elements = {"lvl-1": _level(), "wall-1": _wall(), "pipe-1": pipe}
    assert "pipe_wall_penetration_without_opening" in _rule_ids(elements)

    elements["opening-1"] = WallOpeningElem(
        kind="wall_opening",
        id="opening-1",
        hostWallId="wall-1",
        alongTStart=0.2,
        alongTEnd=0.3,
        sillHeightMm=900,
        headHeightMm=1100,
    )
    assert "pipe_wall_penetration_without_opening" not in _rule_ids(elements)


def test_duct_penetration_without_wall_opening_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "duct-1": DuctElem(
            kind="duct",
            id="duct-1",
            levelId="lvl-1",
            startMm={"xMm": 1600, "yMm": -500},
            endMm={"xMm": 1600, "yMm": 500},
            elevationMm=2200,
            widthMm=300,
            heightMm=200,
        ),
    }

    assert "duct_wall_penetration_without_opening" in _rule_ids(elements)


def test_primary_envelope_wall_without_structural_intent_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(props={"isExternal": True}),
    }

    assert "wall_load_bearing_unknown_primary_envelope" in _rule_ids(elements)


def test_large_opening_in_load_bearing_wall_requires_structural_resolution() -> None:
    door = DoorElem(
        kind="door",
        id="door-1",
        wallId="wall-1",
        alongT=0.5,
        widthMm=2200,
    )
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(loadBearing=True),
        "door-1": door,
    }
    assert "large_opening_in_load_bearing_wall_unresolved" in _rule_ids(elements)

    elements["door-1"] = door.model_copy(update={"props": {"lintelDesigned": True}})
    assert "large_opening_in_load_bearing_wall_unresolved" not in _rule_ids(elements)


def test_beam_without_two_modeled_supports_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "beam-1": BeamElem(
            kind="beam",
            id="beam-1",
            levelId="lvl-1",
            startMm={"xMm": 0, "yMm": 1000},
            endMm={"xMm": 4000, "yMm": 1000},
        ),
    }

    assert "beam_without_support" in _rule_ids(elements)


def test_supported_beam_is_not_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "beam-1": BeamElem(
            kind="beam",
            id="beam-1",
            levelId="lvl-1",
            startMm={"xMm": 0, "yMm": 1000},
            endMm={"xMm": 4000, "yMm": 1000},
        ),
        "col-1": ColumnElem(
            kind="column",
            id="col-1",
            levelId="lvl-1",
            positionMm={"xMm": 0, "yMm": 1000},
        ),
        "col-2": ColumnElem(
            kind="column",
            id="col-2",
            levelId="lvl-1",
            positionMm={"xMm": 4000, "yMm": 1000},
        ),
    }

    assert "beam_without_support" not in _rule_ids(elements)


def test_upper_column_without_lower_support_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "col-1": ColumnElem(
            kind="column",
            id="col-1",
            levelId="lvl-2",
            positionMm={"xMm": 0, "yMm": 1000},
        ),
    }

    assert "column_without_foundation_or_support" not in _rule_ids(elements)

    elements["col-0"] = ColumnElem(
        kind="column",
        id="col-0",
        levelId="lvl-1",
        positionMm={"xMm": 3000, "yMm": 1000},
    )
    assert "column_without_foundation_or_support" in _rule_ids(elements)


def test_floor_under_upper_column_suppresses_column_support_warning() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "col-0": ColumnElem(
            kind="column",
            id="col-0",
            levelId="lvl-1",
            positionMm={"xMm": 3000, "yMm": 1000},
        ),
        "floor-1": FloorElem(
            kind="floor",
            id="floor-1",
            levelId="lvl-2",
            boundaryMm=[
                {"xMm": -1000, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 2000},
                {"xMm": -1000, "yMm": 2000},
            ],
            thicknessMm=220,
        ),
        "col-1": ColumnElem(
            kind="column",
            id="col-1",
            levelId="lvl-2",
            positionMm={"xMm": 0, "yMm": 1000},
        ),
    }

    assert "column_without_foundation_or_support" not in _rule_ids(elements)


def test_door_operation_clearance_conflict_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "door-1": DoorElem(kind="door", id="door-1", wallId="wall-1", alongT=0.5, widthMm=900),
        "asset-shelf": _asset_library(),
        "shelf-1": PlacedAssetElem(
            kind="placed_asset",
            id="shelf-1",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 2000, "yMm": 700},
            paramValues={"widthMm": 300, "depthMm": 300, "proxyHeightMm": 900},
        ),
    }

    assert "door_operation_clearance_conflict" in _rule_ids(elements)
