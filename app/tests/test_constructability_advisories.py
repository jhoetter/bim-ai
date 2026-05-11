from __future__ import annotations

import json
from pathlib import Path

from bim_ai.constraints_evaluation import evaluate
from bim_ai.constructability_matrix import default_matrix_as_dict, matrix_for_profile
from bim_ai.elements import (
    AssetLibraryEntryElem,
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    DuctElem,
    FamilyInstanceElem,
    FamilyTypeElem,
    FloorElem,
    LevelElem,
    PipeElem,
    PlacedAssetElem,
    RailingElem,
    RoofElem,
    RoofOpeningElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
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


def test_evaluate_scopes_constructability_by_phase_filter() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-existing": _wall(id="wall-existing", phaseCreated="existing"),
        "asset-shelf": _asset_library(),
        "shelf-new": _shelf(y_mm=0, id="shelf-new").model_copy(
            update={"phase_created": "new"}
        ),
    }

    all_rules = {violation.rule_id for violation in evaluate(elements)}  # type: ignore[arg-type]
    existing_rules = {
        violation.rule_id
        for violation in evaluate(elements, phase_filter="existing")  # type: ignore[arg-type]
    }

    assert "furniture_wall_hard_clash" in all_rules
    assert "furniture_wall_hard_clash" not in existing_rules


def test_evaluate_scopes_constructability_by_primary_design_option() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-option-b": _wall(id="wall-option-b", optionSetId="scheme", optionId="option-b"),
        "asset-shelf": _asset_library(),
        "shelf-option-a": _shelf(y_mm=0, id="shelf-option-a").model_copy(
            update={"option_set_id": "scheme", "option_id": "option-a"}
        ),
    }
    design_option_sets = [
        {
            "id": "scheme",
            "options": [
                {"id": "option-a", "isPrimary": True},
                {"id": "option-b", "isPrimary": False},
            ],
        }
    ]

    unscoped_rules = {violation.rule_id for violation in evaluate(elements)}  # type: ignore[arg-type]
    primary_rules = {
        violation.rule_id
        for violation in evaluate(  # type: ignore[arg-type]
            elements,
            design_option_sets=design_option_sets,
        )
    }

    assert "furniture_wall_hard_clash" in unscoped_rules
    assert "furniture_wall_hard_clash" not in primary_rules


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


def test_pipe_penetration_approval_metadata_suppresses_wall_warning() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "pipe-1": PipeElem(
            kind="pipe",
            id="pipe-1",
            levelId="lvl-1",
            startMm={"xMm": 1000, "yMm": -500},
            endMm={"xMm": 1000, "yMm": 500},
            elevationMm=1000,
            diameterMm=50,
            props={"approvedPenetrationHostIds": ["wall-1"]},
        ),
    }

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


def test_pipe_floor_penetration_without_slab_opening_is_reported_and_suppressed() -> None:
    pipe = PipeElem(
        kind="pipe",
        id="pipe-1",
        levelId="lvl-1",
        startMm={"xMm": 1000, "yMm": 1000},
        endMm={"xMm": 1000, "yMm": 1000},
        elevationMm=100,
        diameterMm=80,
    )
    floor = FloorElem(
        kind="floor",
        id="floor-1",
        levelId="lvl-1",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 2000, "yMm": 0},
            {"xMm": 2000, "yMm": 2000},
            {"xMm": 0, "yMm": 2000},
        ],
        thicknessMm=220,
    )
    elements = {"lvl-1": _level(), "floor-1": floor, "pipe-1": pipe}
    assert "pipe_floor_penetration_without_opening" in _rule_ids(elements)

    elements["opening-1"] = SlabOpeningElem(
        kind="slab_opening",
        id="opening-1",
        hostFloorId="floor-1",
        boundaryMm=[
            {"xMm": 900, "yMm": 900},
            {"xMm": 1100, "yMm": 900},
            {"xMm": 1100, "yMm": 1100},
            {"xMm": 900, "yMm": 1100},
        ],
    )
    assert "pipe_floor_penetration_without_opening" not in _rule_ids(elements)


def test_duct_ceiling_penetration_without_opening_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "ceiling-1": CeilingElem(
            kind="ceiling",
            id="ceiling-1",
            levelId="lvl-1",
            boundaryMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 2500, "yMm": 0},
                {"xMm": 2500, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
            heightOffsetMm=2400,
            thicknessMm=200,
        ),
        "duct-1": DuctElem(
            kind="duct",
            id="duct-1",
            levelId="lvl-1",
            startMm={"xMm": 1200, "yMm": 1000},
            endMm={"xMm": 1200, "yMm": 1000},
            elevationMm=2500,
            widthMm=300,
            heightMm=200,
        ),
    }

    assert "duct_ceiling_penetration_without_opening" in _rule_ids(elements)


def test_stair_reaching_upper_floor_without_slab_opening_is_reported_and_suppressed() -> None:
    stair = StairElem(
        kind="stair",
        id="stair-1",
        baseLevelId="lvl-1",
        topLevelId="lvl-2",
        runStartMm={"xMm": 1000, "yMm": -500},
        runEndMm={"xMm": 1000, "yMm": 500},
        widthMm=1000,
    )
    upper_floor = FloorElem(
        kind="floor",
        id="floor-2",
        levelId="lvl-2",
        boundaryMm=[
            {"xMm": 0, "yMm": -1500},
            {"xMm": 2500, "yMm": -1500},
            {"xMm": 2500, "yMm": 1500},
            {"xMm": 0, "yMm": 1500},
        ],
        thicknessMm=220,
    )
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "floor-2": upper_floor,
        "stair-1": stair,
    }
    assert "stair_floor_penetration_without_slab_opening" in _rule_ids(elements)

    elements["opening-1"] = SlabOpeningElem(
        kind="slab_opening",
        id="opening-1",
        hostFloorId="floor-2",
        boundaryMm=[
            {"xMm": 400, "yMm": -650},
            {"xMm": 1600, "yMm": -650},
            {"xMm": 1600, "yMm": 650},
            {"xMm": 400, "yMm": 650},
        ],
    )
    assert "stair_floor_penetration_without_slab_opening" not in _rule_ids(elements)


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


def test_upper_load_bearing_wall_without_lower_support_is_reported_and_suppressed() -> None:
    upper_wall = _wall(
        id="wall-upper",
        levelId="lvl-2",
        loadBearing=True,
        start={"xMm": 0, "yMm": 1000},
        end={"xMm": 4000, "yMm": 1000},
    )
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "wall-upper": upper_wall,
    }

    assert "stacked_load_path_discontinuity" not in _rule_ids(elements)

    elements["wall-base-offset"] = _wall(
        id="wall-base-offset",
        loadBearing=True,
        start={"xMm": 0, "yMm": -1000},
        end={"xMm": 4000, "yMm": -1000},
    )
    assert "stacked_load_path_discontinuity" in _rule_ids(elements)

    elements["wall-base-aligned"] = _wall(
        id="wall-base-aligned",
        loadBearing=True,
        start={"xMm": 0, "yMm": 1000},
        end={"xMm": 4000, "yMm": 1000},
    )
    assert "stacked_load_path_discontinuity" not in _rule_ids(elements)


def test_transfer_beam_below_upper_load_bearing_wall_completes_load_path() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-transfer": LevelElem(
            kind="level",
            id="lvl-transfer",
            name="Transfer",
            elevationMm=2600.0,
        ),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "wall-base-offset": _wall(
            id="wall-base-offset",
            loadBearing=True,
            start={"xMm": 0, "yMm": -1000},
            end={"xMm": 4000, "yMm": -1000},
        ),
        "wall-upper": _wall(
            id="wall-upper",
            levelId="lvl-2",
            loadBearing=True,
            start={"xMm": 0, "yMm": 1000},
            end={"xMm": 4000, "yMm": 1000},
        ),
        "beam-transfer": BeamElem(
            kind="beam",
            id="beam-transfer",
            levelId="lvl-transfer",
            startMm={"xMm": 0, "yMm": 1000},
            endMm={"xMm": 4000, "yMm": 1000},
            heightMm=400,
        ),
    }

    assert "stacked_load_path_discontinuity" not in _rule_ids(elements)


def test_removed_load_bearing_wall_without_transfer_metadata_is_reported() -> None:
    wall = _wall(loadBearing=True, phaseDemolished="demo")
    elements = {"lvl-1": _level(), "wall-1": wall}
    assert "load_bearing_wall_removed_without_transfer" in _rule_ids(elements)

    elements["wall-1"] = wall.model_copy(update={"props": {"transferBeamDesigned": True}})
    assert "load_bearing_wall_removed_without_transfer" not in _rule_ids(elements)


def test_long_floor_span_without_structural_metadata_is_reported_and_suppressed() -> None:
    floor = FloorElem(
        kind="floor",
        id="floor-long",
        levelId="lvl-1",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 10000, "yMm": 0},
            {"xMm": 10000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
    )
    elements = {"lvl-1": _level(), "floor-long": floor}
    assert "floor_span_without_support_metadata" in _rule_ids(elements)

    elements["floor-long"] = floor.model_copy(update={"props": {"structuralSystem": "joists"}})
    assert "floor_span_without_support_metadata" not in _rule_ids(elements)


def test_floor_boundary_wall_support_requirement_is_reported() -> None:
    floor = FloorElem(
        kind="floor",
        id="floor-supported",
        levelId="lvl-1",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 4000, "yMm": 0},
            {"xMm": 4000, "yMm": 3000},
            {"xMm": 0, "yMm": 3000},
        ],
        props={"requiresBoundaryWallSupport": True},
    )
    elements = {
        "lvl-1": _level(),
        "floor-supported": floor,
        "wall-1": _wall(
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
        ),
    }

    assert "floor_boundary_without_wall_support" in _rule_ids(elements)

    elements.update(
        {
            "wall-2": _wall(
                id="wall-2",
                start={"xMm": 4000, "yMm": 0},
                end={"xMm": 4000, "yMm": 3000},
            ),
            "wall-3": _wall(
                id="wall-3",
                start={"xMm": 4000, "yMm": 3000},
                end={"xMm": 0, "yMm": 3000},
            ),
            "wall-4": _wall(
                id="wall-4",
                start={"xMm": 0, "yMm": 3000},
                end={"xMm": 0, "yMm": 0},
            ),
        }
    )
    assert "floor_boundary_without_wall_support" not in _rule_ids(elements)


def test_primary_wall_outside_roof_coverage_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "roof-1": RoofElem(
            kind="roof",
            id="roof-1",
            referenceLevelId="lvl-1",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 3000, "yMm": 0},
                {"xMm": 3000, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
            overhangMm=0,
        ),
        "wall-1": _wall(
            props={"primaryEnvelope": True},
            start={"xMm": 3500, "yMm": 0},
            end={"xMm": 4500, "yMm": 0},
        ),
    }

    assert "roof_wall_coverage_gap" in _rule_ids(elements)

    elements["roof-1"] = RoofElem(
        kind="roof",
        id="roof-1",
        referenceLevelId="lvl-1",
        footprintMm=[
            {"xMm": 0, "yMm": -500},
            {"xMm": 5000, "yMm": -500},
            {"xMm": 5000, "yMm": 500},
            {"xMm": 0, "yMm": 500},
        ],
        overhangMm=0,
    )
    assert "roof_wall_coverage_gap" not in _rule_ids(elements)


def test_low_slope_roof_requires_drainage_metadata() -> None:
    roof = RoofElem(
        kind="roof",
        id="roof-1",
        referenceLevelId="lvl-1",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 4000, "yMm": 0},
            {"xMm": 4000, "yMm": 3000},
            {"xMm": 0, "yMm": 3000},
        ],
        overhangMm=0,
        slopeDeg=1.0,
    )
    elements = {"lvl-1": _level(), "roof-1": roof}
    assert "roof_low_slope_without_drainage_metadata" in _rule_ids(elements)

    elements["roof-1"] = roof.model_copy(update={"props": {"roofDrainageDesigned": True}})
    assert "roof_low_slope_without_drainage_metadata" not in _rule_ids(elements)


def test_roof_opening_outside_host_footprint_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "roof-1": RoofElem(
            kind="roof",
            id="roof-1",
            referenceLevelId="lvl-1",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
            overhangMm=0,
        ),
        "roof-opening-1": RoofOpeningElem(
            kind="roof_opening",
            id="roof-opening-1",
            hostRoofId="roof-1",
            boundaryMm=[
                {"xMm": 3500, "yMm": 1000},
                {"xMm": 4500, "yMm": 1000},
                {"xMm": 4500, "yMm": 2000},
                {"xMm": 3500, "yMm": 2000},
            ],
        ),
    }

    assert "roof_opening_outside_host_footprint" in _rule_ids(elements)


def test_large_roof_opening_without_review_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "roof-1": RoofElem(
            kind="roof",
            id="roof-1",
            referenceLevelId="lvl-1",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
            overhangMm=0,
        ),
        "roof-opening-1": RoofOpeningElem(
            kind="roof_opening",
            id="roof-opening-1",
            hostRoofId="roof-1",
            boundaryMm=[
                {"xMm": 500, "yMm": 500},
                {"xMm": 3500, "yMm": 500},
                {"xMm": 3500, "yMm": 2000},
                {"xMm": 500, "yMm": 2000},
            ],
        ),
    }

    assert "roof_opening_large_void_without_review" in _rule_ids(elements)

    roof = elements["roof-1"]
    assert isinstance(roof, RoofElem)
    elements["roof-1"] = roof.model_copy(
        update={"props": {"approvedRoofOpeningIds": ["roof-opening-1"]}}
    )
    assert "roof_opening_large_void_without_review" not in _rule_ids(elements)


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


def test_door_operation_clearance_conflict_is_reported_for_blocking_wall() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "door-1": DoorElem(kind="door", id="door-1", wallId="wall-1", alongT=0.5, widthMm=900),
        "wall-blocking": _wall(
            id="wall-blocking",
            start={"xMm": 1600, "yMm": 700},
            end={"xMm": 2400, "yMm": 700},
        ),
    }

    assert "door_operation_clearance_conflict" in _rule_ids(elements)


def test_room_without_connected_door_access_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "room-1": RoomElem(
            kind="room",
            id="room-1",
            levelId="lvl-1",
            outlineMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 3000, "yMm": 0},
                {"xMm": 3000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
        ),
        "door-1": DoorElem(
            kind="door",
            id="door-1",
            wallId="wall-1",
            alongT=0.5,
        ),
    }

    assert "room_without_door_access" not in _rule_ids(elements)

    elements["door-1"] = DoorElem(
        kind="door",
        id="door-1",
        wallId="wall-1",
        alongT=0.95,
    )
    assert "room_without_door_access" in _rule_ids(elements)


def test_window_operation_clearance_conflict_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "window-1": WindowElem(
            kind="window",
            id="window-1",
            wallId="wall-1",
            alongT=0.5,
            widthMm=1000,
            sillHeightMm=600,
            heightMm=1200,
        ),
        "asset-shelf": _asset_library(),
        "shelf-1": PlacedAssetElem(
            kind="placed_asset",
            id="shelf-1",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 2000, "yMm": 350},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 1200},
        ),
    }

    assert "window_operation_clearance_conflict" in _rule_ids(elements)

    elements["shelf-1"] = PlacedAssetElem(
        kind="placed_asset",
        id="shelf-1",
        name="Shelf",
        assetId="asset-shelf",
        levelId="lvl-1",
        positionMm={"xMm": 2000, "yMm": 1200},
        paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 1200},
    )
    assert "window_operation_clearance_conflict" not in _rule_ids(elements)


def test_family_instance_without_proxy_dimensions_reports_coverage_gap() -> None:
    elements = {
        "lvl-1": _level(),
        "ft-unknown": FamilyTypeElem(
            kind="family_type",
            id="ft-unknown",
            familyId="generic",
            discipline="generic",
            parameters={},
        ),
        "instance-1": FamilyInstanceElem(
            kind="family_instance",
            id="instance-1",
            familyTypeId="ft-unknown",
            levelId="lvl-1",
            positionMm={"xMm": 0, "yMm": 0},
        ),
    }

    assert "constructability_proxy_unsupported" in _rule_ids(elements)


def test_duplicate_placed_assets_are_reported_as_duplicate_geometry() -> None:
    elements = {
        "lvl-1": _level(),
        "asset-shelf": _asset_library(),
        "shelf-1": _shelf(y_mm=1000, id="shelf-1"),
        "shelf-2": _shelf(y_mm=1000, id="shelf-2"),
    }
    rule_ids = _rule_ids(elements)

    assert "physical_duplicate_geometry" in rule_ids
    assert "physical_hard_clash" not in rule_ids


def test_overlapping_but_not_duplicate_placed_assets_are_hard_clash() -> None:
    elements = {
        "lvl-1": _level(),
        "asset-shelf": _asset_library(),
        "shelf-1": _shelf(y_mm=1000, id="shelf-1"),
        "shelf-2": PlacedAssetElem(
            kind="placed_asset",
            id="shelf-2",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 1300, "yMm": 1000},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
        ),
    }
    rule_ids = _rule_ids(elements)

    assert "physical_duplicate_geometry" not in rule_ids
    assert "physical_hard_clash" in rule_ids


def test_matrix_backed_structural_wall_hard_clash_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": _wall(),
        "beam-1": BeamElem(
            kind="beam",
            id="beam-1",
            levelId="lvl-1",
            startMm={"xMm": 1000, "yMm": -500},
            endMm={"xMm": 1000, "yMm": 500},
            widthMm=200,
            heightMm=300,
        ),
    }

    assert "physical_hard_clash" in _rule_ids(elements)


def test_matrix_backed_stair_ceiling_hard_clash_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "ceiling-1": CeilingElem(
            kind="ceiling",
            id="ceiling-1",
            levelId="lvl-1",
            boundaryMm=[
                {"xMm": 0, "yMm": -800},
                {"xMm": 1200, "yMm": -800},
                {"xMm": 1200, "yMm": 800},
                {"xMm": 0, "yMm": 800},
            ],
            heightOffsetMm=2400,
            thicknessMm=200,
        ),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 500, "yMm": -500},
            runEndMm={"xMm": 500, "yMm": 500},
            widthMm=1000,
        ),
    }

    assert "physical_hard_clash" in _rule_ids(elements)


def test_low_ceiling_over_stair_reports_headroom_conflict() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "ceiling-1": CeilingElem(
            kind="ceiling",
            id="ceiling-1",
            levelId="lvl-1",
            boundaryMm=[
                {"xMm": 0, "yMm": -800},
                {"xMm": 1200, "yMm": -800},
                {"xMm": 1200, "yMm": 800},
                {"xMm": 0, "yMm": 800},
            ],
            heightOffsetMm=1800,
            thicknessMm=100,
        ),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 500, "yMm": -500},
            runEndMm={"xMm": 500, "yMm": 500},
            widthMm=1000,
        ),
    }

    assert "stair_headroom_clearance_conflict" in _rule_ids(elements)


def test_adequate_stair_ceiling_headroom_is_not_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "ceiling-1": CeilingElem(
            kind="ceiling",
            id="ceiling-1",
            levelId="lvl-1",
            boundaryMm=[
                {"xMm": 0, "yMm": -800},
                {"xMm": 1200, "yMm": -800},
                {"xMm": 1200, "yMm": 800},
                {"xMm": 0, "yMm": 800},
            ],
            heightOffsetMm=2300,
            thicknessMm=100,
        ),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 500, "yMm": -500},
            runEndMm={"xMm": 500, "yMm": 500},
            widthMm=1000,
        ),
    }

    assert "stair_headroom_clearance_conflict" not in _rule_ids(elements)


def test_tall_stair_without_hosted_guardrail_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 0, "yMm": 0},
            runEndMm={"xMm": 3000, "yMm": 0},
            widthMm=1000,
        ),
    }

    assert "stair_guardrail_missing" in _rule_ids(elements)

    elements["rail-1"] = RailingElem(
        kind="railing",
        id="rail-1",
        hostedStairId="stair-1",
        pathMm=[{"xMm": 0, "yMm": -500}, {"xMm": 3000, "yMm": -500}],
        guardHeightMm=1000,
    )
    assert "stair_guardrail_missing" not in _rule_ids(elements)


def test_low_stair_guardrail_height_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 0, "yMm": 0},
            runEndMm={"xMm": 3000, "yMm": 0},
            widthMm=1000,
        ),
        "rail-low": RailingElem(
            kind="railing",
            id="rail-low",
            hostedStairId="stair-1",
            pathMm=[{"xMm": 0, "yMm": -500}, {"xMm": 3000, "yMm": -500}],
            guardHeightMm=800,
        ),
    }

    assert "stair_guardrail_height_insufficient" in _rule_ids(elements)


def test_l_shape_stair_without_landing_is_reported() -> None:
    elements = {
        "lvl-1": _level(),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 0, "yMm": 0},
            runEndMm={"xMm": 3000, "yMm": 0},
            widthMm=1000,
            shape="l_shape",
            runs=[
                {
                    "id": "run-1",
                    "startMm": {"xMm": 0, "yMm": 0},
                    "endMm": {"xMm": 1500, "yMm": 0},
                },
                {
                    "id": "run-2",
                    "startMm": {"xMm": 1500, "yMm": 0},
                    "endMm": {"xMm": 1500, "yMm": 1500},
                },
            ],
        ),
    }

    assert "stair_landing_missing" in _rule_ids(elements)


def test_default_constructability_matrix_json_matches_app_default() -> None:
    root = Path(__file__).resolve().parents[2]
    matrix_path = root / "spec" / "schemas" / "constructability-matrix-default.json"

    assert json.loads(matrix_path.read_text()) == default_matrix_as_dict()


def test_constructability_matrix_profile_overrides_severity_and_tolerance() -> None:
    default_duplicate = [
        cell
        for cell in matrix_for_profile("authoring_default")
        if cell.rule_id == "physical_duplicate_geometry" and cell.check_type == "duplicate"
    ][0]
    readiness_duplicate = [
        cell
        for cell in matrix_for_profile("construction_readiness")
        if cell.rule_id == "physical_duplicate_geometry" and cell.check_type == "duplicate"
    ][0]

    assert default_duplicate.severity == "warning"
    assert default_duplicate.tolerance_mm == 1.0
    assert readiness_duplicate.severity == "error"
    assert readiness_duplicate.tolerance_mm == 2.0
