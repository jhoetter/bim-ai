from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from bim_ai.semantic_authoring import (
    UNSUPPORTED_M2_OPERATIONS,
    SemanticAuthoringError,
    UnsupportedSemanticOperationError,
    build_semantic_authoring_bundle,
    unsupported_semantic_operation,
)

_RECT_POINTS = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 8000, "yMm": 0},
    {"xMm": 8000, "yMm": 5000},
    {"xMm": 0, "yMm": 5000},
]


def test_level_payload_generates_valid_create_level() -> None:
    bundle = build_semantic_authoring_bundle(
        "level",
        {
            "id": "level-eg",
            "name": "EG",
            "elevationMm": 0,
            "alsoCreatePlanView": True,
        },
    )

    assert bundle.metadata["kernelCommandTypes"] == ["createLevel"]
    assert bundle.commands[0]["type"] == "createLevel"
    assert bundle.commands[0]["id"] == "level-eg"
    assert bundle.commands[0]["name"] == "EG"


def test_wall_chain_closed_payload_generates_valid_create_wall_chain() -> None:
    bundle = build_semantic_authoring_bundle(
        "wall_chain",
        {
            "levelId": "level-1",
            "points": _RECT_POINTS,
            "closed": True,
            "namePrefix": "Exterior Wall",
            "thicknessMm": 240,
            "heightMm": 3000,
        },
    )

    assert bundle.metadata["kernelCommandTypes"] == ["createWallChain"]
    assert bundle.commands == [
        {
            "type": "createWallChain",
            "levelId": "level-1",
            "namePrefix": "Exterior Wall",
            "locationLine": "wall-centerline",
            "baseConstraintOffsetMm": 0.0,
            "topConstraintOffsetMm": 0.0,
            "segments": [
                {
                    "start": {"xMm": 0.0, "yMm": 0.0},
                    "end": {"xMm": 8000.0, "yMm": 0.0},
                    "thicknessMm": 240.0,
                    "heightMm": 3000.0,
                },
                {
                    "start": {"xMm": 8000.0, "yMm": 0.0},
                    "end": {"xMm": 8000.0, "yMm": 5000.0},
                    "thicknessMm": 240.0,
                    "heightMm": 3000.0,
                },
                {
                    "start": {"xMm": 8000.0, "yMm": 5000.0},
                    "end": {"xMm": 0.0, "yMm": 5000.0},
                    "thicknessMm": 240.0,
                    "heightMm": 3000.0,
                },
                {
                    "start": {"xMm": 0.0, "yMm": 5000.0},
                    "end": {"xMm": 0.0, "yMm": 0.0},
                    "thicknessMm": 240.0,
                    "heightMm": 3000.0,
                },
            ],
        }
    ]


def test_wall_payload_generates_valid_create_wall() -> None:
    bundle = build_semantic_authoring_bundle(
        "wall",
        {
            "id": "wall-1",
            "name": "Partition",
            "levelId": "level-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 5000, "yMm": 0},
            "thicknessMm": 150,
            "heightMm": 2700,
        },
    )

    assert bundle.metadata["kernelCommandTypes"] == ["createWall"]
    assert bundle.commands[0]["type"] == "createWall"
    assert bundle.commands[0]["id"] == "wall-1"
    assert bundle.commands[0]["start"] == {"xMm": 0.0, "yMm": 0.0}
    assert bundle.commands[0]["heightMm"] == 2700.0


def test_dormer_on_roof_payload_generates_valid_create_dormer() -> None:
    bundle = build_semantic_authoring_bundle(
        "dormer_on_roof",
        {
            "id": "dormer-1",
            "hostRoofId": "roof-1",
            "positionOnRoof": {"alongRidgeMm": 1200, "acrossRidgeMm": 900},
            "widthMm": 2400,
            "wallHeightMm": 1200,
            "depthMm": 1800,
            "dormerRoofKind": "shed",
        },
    )

    assert bundle.metadata["kernelCommandTypes"] == ["createDormer"]
    assert bundle.commands[0]["type"] == "createDormer"
    assert bundle.commands[0]["hostRoofId"] == "roof-1"
    assert bundle.commands[0]["dormerRoofKind"] == "shed"


def test_floor_from_wall_segments_derives_closed_boundary() -> None:
    bundle = build_semantic_authoring_bundle(
        "floor_from_wall_segments",
        {
            "id": "floor-eg",
            "name": "Ground floor slab",
            "levelId": "level-1",
            "wallSegments": [
                {"start": _RECT_POINTS[0], "end": _RECT_POINTS[1]},
                {"start": _RECT_POINTS[1], "end": _RECT_POINTS[2]},
                {"start": _RECT_POINTS[2], "end": _RECT_POINTS[3]},
                {"start": _RECT_POINTS[3], "end": _RECT_POINTS[0]},
            ],
            "roomBounded": True,
        },
    )

    command = bundle.commands[0]
    assert command["type"] == "createFloor"
    assert command["id"] == "floor-eg"
    assert command["levelId"] == "level-1"
    assert command["roomBounded"] is True
    assert command["boundaryMm"] == [
        {"xMm": 0.0, "yMm": 0.0},
        {"xMm": 8000.0, "yMm": 0.0},
        {"xMm": 8000.0, "yMm": 5000.0},
        {"xMm": 0.0, "yMm": 5000.0},
    ]


def test_roof_from_boundary_uses_reference_level_and_roof_defaults() -> None:
    bundle = build_semantic_authoring_bundle(
        "roof_from_boundary",
        {
            "id": "roof-main",
            "name": "Main roof",
            "referenceLevelId": "roof-level",
            "boundaryMm": _RECT_POINTS,
            "slopeDeg": 30,
        },
    )

    assert bundle.commands[0] == {
        "type": "createRoof",
        "id": "roof-main",
        "name": "Main roof",
        "referenceLevelId": "roof-level",
        "footprintMm": [
            {"xMm": 0.0, "yMm": 0.0},
            {"xMm": 8000.0, "yMm": 0.0},
            {"xMm": 8000.0, "yMm": 5000.0},
            {"xMm": 0.0, "yMm": 5000.0},
        ],
        "overhangMm": 400.0,
        "slopeDeg": 30.0,
        "roofGeometryMode": "mass_box",
    }


def test_openings_room_stair_view_and_sheet_command_shapes() -> None:
    door = build_semantic_authoring_bundle(
        "door_on_wall", {"id": "door-1", "wallId": "wall-1", "alongT": 0.25}
    )
    window = build_semantic_authoring_bundle(
        "window_on_wall", {"wallId": "wall-1", "alongT": 0.75, "sillHeightMm": 850}
    )
    room = build_semantic_authoring_bundle(
        "room_outline",
        {"id": "room-1", "name": "Living", "levelId": "level-1", "boundaryMm": _RECT_POINTS},
    )
    room_sep = build_semantic_authoring_bundle(
        "room_separation",
        {
            "id": "sep-1",
            "levelId": "level-1",
            "start": {"xMm": 4000, "yMm": 0},
            "end": {"xMm": 4000, "yMm": 5000},
        },
    )
    room_sep_mm_aliases = build_semantic_authoring_bundle(
        "room_separation",
        {
            "id": "sep-2",
            "levelId": "level-1",
            "startMm": {"xMm": 1000, "yMm": 0},
            "endMm": {"xMm": 1000, "yMm": 5000},
        },
    )
    floor_supports = build_semantic_authoring_bundle(
        "floor_supports",
        {"floorId": "floor-2", "supportedByIds": ["wall-1", "wall-2"]},
    )
    stair = build_semantic_authoring_bundle(
        "stair_between_levels",
        {
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "runStartMm": {"xMm": 1000, "yMm": 1000},
            "runEndMm": {"xMm": 1000, "yMm": 4200},
        },
    )
    stair_runs = build_semantic_authoring_bundle(
        "stair_by_runs",
        {
            "id": "stair-runs",
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "shape": "u_shape",
            "runs": [
                {
                    "id": "run-1",
                    "startMm": {"xMm": 0, "yMm": 0},
                    "endMm": {"xMm": 2200, "yMm": 0},
                    "widthMm": 1000,
                    "riserCount": 8,
                },
                {
                    "id": "run-2",
                    "startMm": {"xMm": 2200, "yMm": 1500},
                    "endMm": {"xMm": 0, "yMm": 1500},
                    "widthMm": 1000,
                    "riserCount": 8,
                },
            ],
        },
    )
    stair_sketch = build_semantic_authoring_bundle(
        "stair_by_sketch",
        {
            "id": "stair-sketch",
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "runStartMm": {"xMm": 0, "yMm": 0},
            "runEndMm": {"xMm": 0, "yMm": 0},
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 3000, "yMm": 0},
                {"xMm": 3000, "yMm": 1200},
                {"xMm": 0, "yMm": 1200},
            ],
            "treadLines": [
                {"fromMm": {"xMm": 0, "yMm": 0}, "toMm": {"xMm": 3000, "yMm": 0}},
                {"fromMm": {"xMm": 0, "yMm": 250}, "toMm": {"xMm": 3000, "yMm": 250}},
            ],
            "totalRiseMm": 2800,
        },
    )
    stair_existing = build_semantic_authoring_bundle(
        "stair_existing_condition",
        {
            "stairId": "stair-sketch",
            "findingCodes": ["stair_riser_tread_comfort_failure"],
            "reason": "Existing stair dimensions are source documented.",
            "sourceFactIds": ["src-stair-1"],
        },
    )
    plan = build_semantic_authoring_bundle(
        "plan_view", {"id": "plan-eg", "name": "EG Plan", "levelId": "level-1"}
    )
    sheet = build_semantic_authoring_bundle(
        "sheet_with_viewports",
        {
            "id": "sheet-a101",
            "name": "A101 Plans",
            "paperWidthMm": 841,
            "paperHeightMm": 594,
            "viewportsMm": [
                {
                    "viewportId": "vp-1",
                    "viewRef": "plan:plan-eg",
                    "xMm": 20,
                    "yMm": 20,
                    "widthMm": 260,
                    "heightMm": 180,
                }
            ],
        },
    )

    assert door.commands[0]["type"] == "insertDoorOnWall"
    assert door.commands[0]["widthMm"] == 900.0
    assert window.commands[0]["type"] == "insertWindowOnWall"
    assert window.commands[0]["sillHeightMm"] == 850.0
    assert room.commands[0]["type"] == "createRoomOutline"
    assert room_sep.commands[0]["type"] == "createRoomSeparation"
    assert room_sep_mm_aliases.commands[0]["start"]["xMm"] == 1000.0
    assert floor_supports.commands[0]["type"] == "updateElementProperty"
    assert floor_supports.commands[0]["key"] == "supportedByIds"
    assert floor_supports.commands[0]["value"] == ["wall-1", "wall-2"]
    assert stair.commands[0]["type"] == "createStair"
    assert stair.commands[0]["shape"] == "straight"
    assert stair_runs.commands[0]["shape"] == "u_shape"
    assert len(stair_runs.commands[0]["runs"]) == 2
    assert stair_sketch.commands[0]["authoringMode"] == "by_sketch"
    assert stair_sketch.commands[0]["shape"] == "straight"
    assert stair_sketch.commands[0]["totalRiseMm"] == 2800.0
    assert stair_existing.commands[0]["type"] == "updateElementProperty"
    assert stair_existing.commands[0]["key"] == "existingConditionTolerance"
    assert stair_existing.commands[0]["value"]["sourceFactIds"] == ["src-stair-1"]
    assert plan.commands[0]["type"] == "upsertPlanView"
    assert [command["type"] for command in sheet.commands] == [
        "upsertSheet",
        "upsertSheetViewports",
    ]
    assert sheet.commands[1]["viewportsMm"][0]["viewRef"] == "plan:plan-eg"


def test_vertical_circulation_opening_and_railing_command_shapes() -> None:
    slab = build_semantic_authoring_bundle(
        "slab_opening",
        {
            "id": "stair-void-l1",
            "name": "Stair void L1",
            "hostFloorId": "floor-l1",
            "boundaryMm": _RECT_POINTS,
        },
    )
    shaft = build_semantic_authoring_bundle(
        "shaft_opening",
        {
            "hostFloorId": "floor-l2",
            "boundaryMm": [*_RECT_POINTS, _RECT_POINTS[0]],
            "isShaft": False,
        },
    )
    railing = build_semantic_authoring_bundle(
        "railing",
        {
            "id": "rail-stair-1",
            "hostedStairId": "stair-1",
            "pathMm": [
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 1000, "yMm": 4200},
            ],
            "balusterPattern": {"rule": "regular", "spacingMm": 120},
        },
    )

    assert slab.metadata["kernelCommandTypes"] == ["createSlabOpening"]
    assert slab.commands[0] == {
        "type": "createSlabOpening",
        "id": "stair-void-l1",
        "name": "Stair void L1",
        "hostFloorId": "floor-l1",
        "boundaryMm": [
            {"xMm": 0.0, "yMm": 0.0},
            {"xMm": 8000.0, "yMm": 0.0},
            {"xMm": 8000.0, "yMm": 5000.0},
            {"xMm": 0.0, "yMm": 5000.0},
        ],
        "isShaft": False,
    }
    assert shaft.operation == "shaft_opening"
    assert shaft.commands[0]["isShaft"] is True
    assert shaft.commands[0]["name"] == "Shaft opening"
    assert railing.metadata["kernelCommandTypes"] == ["createRailing"]
    assert railing.commands[0]["hostedStairId"] == "stair-1"
    assert railing.commands[0]["balusterPattern"] == {"rule": "regular", "spacingMm": 120.0}


def test_structure_and_construction_lite_command_shapes() -> None:
    column = build_semantic_authoring_bundle(
        "structure_column",
        {
            "id": "col-s1",
            "levelId": "level-1",
            "positionMm": {"xMm": 1200, "yMm": 2400},
            "bMm": 350,
            "hMm": 450,
            "materialKey": "concrete_cast_in_place",
        },
    )
    beam = build_semantic_authoring_bundle(
        "structure_beam",
        {
            "id": "beam-s1",
            "levelId": "level-1",
            "startMm": {"xMm": 0, "yMm": 5000},
            "endMm": {"xMm": 6000, "yMm": 5000},
            "widthMm": 220,
            "heightMm": 500,
        },
    )
    column_update = build_semantic_authoring_bundle(
        "structure_column_update", {"id": "col-s1", "bMm": 400}
    )
    constraint = build_semantic_authoring_bundle(
        "structure_constraint",
        {
            "id": "constraint-grid-a",
            "rule": "parallel",
            "refsA": [{"elementId": "beam-s1", "anchor": "start"}],
            "refsB": [{"elementId": "beam-s2", "anchor": "start"}],
        },
    )
    package = build_semantic_authoring_bundle(
        "construction_package",
        {"id": "pkg-structure", "name": "Structure shell", "code": "S-001"},
    )
    logistics = build_semantic_authoring_bundle(
        "construction_logistics",
        {
            "id": "log-crane",
            "name": "Tower crane swing",
            "logisticsKind": "crane_zone",
            "boundaryMm": _RECT_POINTS,
            "constructionPackageId": "pkg-structure",
        },
    )
    checklist = build_semantic_authoring_bundle(
        "construction_qa_checklist",
        {
            "id": "qa-structure",
            "name": "Structure pour QA",
            "targetElementIds": ["col-s1", "beam-s1"],
            "constructionPackageId": "pkg-structure",
            "checklist": [{"id": "rebar", "label": "Rebar inspected"}],
        },
    )

    assert column.metadata["kernelCommandTypes"] == ["createColumn"]
    assert column.commands[0]["positionMm"] == {"xMm": 1200.0, "yMm": 2400.0}
    assert beam.metadata["kernelCommandTypes"] == ["createBeam"]
    assert beam.commands[0]["heightMm"] == 500.0
    assert column_update.metadata["kernelCommandTypes"] == ["updateColumn"]
    assert column_update.commands[0] == {"type": "updateColumn", "id": "col-s1", "bMm": 400.0}
    assert constraint.metadata["kernelCommandTypes"] == ["createConstraint"]
    assert constraint.commands[0]["refsA"][0]["elementId"] == "beam-s1"
    assert package.metadata["kernelCommandTypes"] == ["createConstructionPackage"]
    assert package.commands[0]["code"] == "S-001"
    assert logistics.metadata["kernelCommandTypes"] == ["createConstructionLogistics"]
    assert logistics.commands[0]["boundaryMm"][0] == {"xMm": 0.0, "yMm": 0.0}
    assert checklist.metadata["kernelCommandTypes"] == ["upsertConstructionQaChecklist"]
    assert checklist.commands[0]["targetElementIds"] == ["col-s1", "beam-s1"]


def test_m4b_structure_construction_fixture_maps_honest_ui_cmdk_coverage() -> None:
    fixture_path = (
        Path(__file__).parent / "fixtures" / "m4b_structure_construction_lite_authoring.json"
    )
    fixture = json.loads(fixture_path.read_text())

    assert fixture["fixture"] == "m4b_structure_construction_lite_authoring_v1"
    assert "Activator/lens coverage only" in fixture["uiCmdKCoverage"]["structure"]["cmdK"]
    assert "MCP/CLI first-class" in fixture["uiCmdKCoverage"]["construction"]["cmdK"]
    assert {row["tool"] for row in fixture["semanticSurfaces"]} == {
        "structure.column",
        "structure.beam",
        "structure.column_update",
        "structure.constraint",
        "construction.package",
        "construction.logistics",
        "construction.qa_checklist",
    }


def test_mep_lite_semantic_surfaces_generate_typed_commands() -> None:
    pipe = build_semantic_authoring_bundle(
        "mep_pipe_route",
        {
            "id": "pipe-cw-1",
            "levelId": "level-1",
            "startMm": {"xMm": 0, "yMm": 100},
            "endMm": {"xMm": 3000, "yMm": 100},
            "elevationMm": 2600,
            "diameterMm": 40,
            "systemType": "domestic_water",
            "systemName": "CW-1",
            "flowDirection": "supply",
            "serviceLevel": "Level 1 ceiling",
        },
    )
    duct = build_semantic_authoring_bundle(
        "mep_duct_route",
        {
            "id": "duct-sa-1",
            "levelId": "level-1",
            "startMm": {"xMm": 0, "yMm": 800},
            "endMm": {"xMm": 3000, "yMm": 800},
            "elevationMm": 2800,
            "widthMm": 500,
            "heightMm": 250,
            "systemType": "hvac_supply",
            "serviceLevel": "ceiling plenum",
        },
    )
    tray = build_semantic_authoring_bundle(
        "mep_cable_tray",
        {
            "id": "tray-e-1",
            "levelId": "level-1",
            "startMm": {"xMm": 0, "yMm": 1200},
            "endMm": {"xMm": 3000, "yMm": 1200},
            "elevationMm": 2700,
            "systemType": "electrical",
            "serviceLevel": "overhead",
        },
    )
    equipment = build_semantic_authoring_bundle(
        "mep_equipment",
        {
            "id": "ahu-1",
            "levelId": "level-1",
            "positionMm": {"xMm": 500, "yMm": 500},
            "elevationMm": 0,
            "equipmentType": "AHU",
            "systemType": "hvac_supply",
            "serviceLevel": "mechanical room",
            "electricalLoadW": 900,
        },
    )
    fixture = build_semantic_authoring_bundle(
        "mep_fixture",
        {
            "id": "sink-1",
            "levelId": "level-1",
            "positionMm": {"xMm": 1200, "yMm": 900},
            "roomId": "room-1",
            "fixtureType": "sink",
            "systemType": "domestic_water",
        },
    )
    terminal = build_semantic_authoring_bundle(
        "mep_terminal",
        {
            "id": "diffuser-1",
            "levelId": "level-1",
            "positionMm": {"xMm": 1800, "yMm": 900},
            "terminalKind": "diffuser",
            "systemType": "hvac_supply",
            "flowDirection": "supply",
            "serviceLevel": "ceiling",
        },
    )
    opening_request = build_semantic_authoring_bundle(
        "mep_opening_request",
        {
            "id": "or-duct-1",
            "hostElementId": "wall-1",
            "levelId": "level-1",
            "requesterElementIds": ["duct-sa-1"],
            "openingKind": "wall",
            "positionMm": {"xMm": 1500, "yMm": 800},
            "widthMm": 600,
            "heightMm": 320,
            "clearanceMm": 50,
            "systemType": "hvac_supply",
        },
    )

    assert pipe.commands[0]["type"] == "createPipe"
    assert pipe.commands[0]["elevationMm"] == 2600.0
    assert pipe.commands[0]["systemType"] == "domestic_water"
    assert pipe.commands[0]["serviceLevel"] == "Level 1 ceiling"
    assert duct.commands[0]["type"] == "createDuct"
    assert duct.commands[0]["widthMm"] == 500.0
    assert tray.commands[0]["type"] == "createCableTray"
    assert tray.commands[0]["systemType"] == "electrical"
    assert equipment.commands[0]["type"] == "createMepEquipment"
    assert equipment.commands[0]["equipmentType"] == "AHU"
    assert fixture.commands[0]["type"] == "createFixture"
    assert fixture.commands[0]["roomId"] == "room-1"
    assert terminal.commands[0]["type"] == "createMepTerminal"
    assert terminal.commands[0]["terminalKind"] == "diffuser"
    assert opening_request.commands[0]["type"] == "createMepOpeningRequest"
    assert opening_request.commands[0]["requesterElementIds"] == ["duct-sa-1"]


def test_roof_opening_generates_valid_create_roof_opening() -> None:
    bundle = build_semantic_authoring_bundle(
        "roof_opening",
        {
            "id": "roof-opening-1",
            "name": "Skylight",
            "hostRoofId": "roof-1",
            "boundaryMm": [
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 2000, "yMm": 1000},
                {"xMm": 2000, "yMm": 2000},
                {"xMm": 1000, "yMm": 2000},
                {"xMm": 1000, "yMm": 1000},
            ],
        },
    )

    assert bundle.metadata["kernelCommandTypes"] == ["createRoofOpening"]
    assert bundle.commands[0] == {
        "type": "createRoofOpening",
        "id": "roof-opening-1",
        "name": "Skylight",
        "hostRoofId": "roof-1",
        "boundaryMm": [
            {"xMm": 1000.0, "yMm": 1000.0},
            {"xMm": 2000.0, "yMm": 1000.0},
            {"xMm": 2000.0, "yMm": 2000.0},
            {"xMm": 1000.0, "yMm": 2000.0},
        ],
    }


def test_save_3d_view_generates_viewpoint_or_saved_view_command() -> None:
    camera = {
        "position": {"xMm": 1, "yMm": 2, "zMm": 3},
        "target": {"xMm": 4, "yMm": 5, "zMm": 6},
        "up": {"xMm": 0, "yMm": 0, "zMm": 1},
    }

    viewpoint = build_semantic_authoring_bundle(
        "save_3d_view",
        {"id": "vp-1", "name": "3D coordination", "camera": camera, "cutawayStyle": "box"},
    )
    saved_view = build_semantic_authoring_bundle(
        "save_3d_view",
        {
            "id": "saved-1",
            "name": "Presentation view",
            "baseViewId": "vp-1",
            "cameraState": camera,
        },
    )

    assert viewpoint.commands[0]["type"] == "saveViewpoint"
    assert viewpoint.commands[0]["mode"] == "orbit_3d"
    assert viewpoint.commands[0]["camera"] == camera
    assert saved_view.commands[0]["type"] == "create_saved_view"
    assert saved_view.commands[0]["baseViewId"] == "vp-1"


def test_semantic_authoring_route_accepts_first_pack_surface_ids() -> None:
    from bim_ai.routes_api import api_router

    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    wall = client.post(
        "/api/semantic-authoring/author.wall",
        json={
            "levelId": "level-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 1000, "yMm": 0},
        },
    )
    level = client.post(
        "/api/semantic-authoring/author.level",
        json={"id": "level-1", "name": "EG", "elevationMm": 0},
    )
    roof_opening = client.post(
        "/api/semantic-authoring/opening.roof_opening",
        json={
            "hostRoofId": "roof-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
            ],
        },
    )
    dormer = client.post(
        "/api/semantic-authoring/author.dormer_on_roof",
        json={
            "hostRoofId": "roof-1",
            "positionOnRoof": {"alongRidgeMm": 1200, "acrossRidgeMm": 900},
            "widthMm": 2400,
            "wallHeightMm": 1200,
            "depthMm": 1800,
        },
    )
    room_sep = client.post(
        "/api/semantic-authoring/author.room_separation",
        json={
            "levelId": "level-1",
            "start": {"xMm": 4000, "yMm": 0},
            "end": {"xMm": 4000, "yMm": 5000},
        },
    )
    floor_supports = client.post(
        "/api/semantic-authoring/author.floor_supports",
        json={"floorId": "floor-2", "supportedByIds": ["wall-1", "wall-2"]},
    )
    stair = client.post(
        "/api/semantic-authoring/author.stair_between_levels",
        json={
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "runStartMm": {"xMm": 1000, "yMm": 1000},
            "runEndMm": {"xMm": 1000, "yMm": 4200},
        },
    )
    stair_runs = client.post(
        "/api/semantic-authoring/author.stair_by_runs",
        json={
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "runs": [
                {
                    "id": "run-1",
                    "startMm": {"xMm": 0, "yMm": 0},
                    "endMm": {"xMm": 2200, "yMm": 0},
                    "riserCount": 8,
                }
            ],
        },
    )
    stair_sketch = client.post(
        "/api/semantic-authoring/author.stair_by_sketch",
        json={
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "runStartMm": {"xMm": 0, "yMm": 0},
            "runEndMm": {"xMm": 0, "yMm": 0},
            "boundaryMm": _RECT_POINTS,
            "treadLines": [
                {"fromMm": {"xMm": 0, "yMm": 0}, "toMm": {"xMm": 8000, "yMm": 0}}
            ],
            "totalRiseMm": 2800,
        },
    )
    stair_existing = client.post(
        "/api/semantic-authoring/author.stair_existing_condition",
        json={
            "stairId": "stair-sketch",
            "findingCodes": ["stair_riser_tread_comfort_failure"],
            "reason": "Existing stair dimensions are source documented.",
            "sourceFactIds": ["src-stair-1"],
        },
    )
    shaft = client.post(
        "/api/semantic-authoring/opening.shaft_opening",
        json={"hostFloorId": "floor-1", "boundaryMm": _RECT_POINTS},
    )
    railing = client.post(
        "/api/semantic-authoring/author.railing",
        json={
            "hostedStairId": "stair-1",
            "pathMm": [{"xMm": 0, "yMm": 0}, {"xMm": 0, "yMm": 4000}],
        },
    )
    mep_pipe = client.post(
        "/api/semantic-authoring/mep.pipe_route",
        json={
            "levelId": "level-1",
            "startMm": {"xMm": 0, "yMm": 100},
            "endMm": {"xMm": 1000, "yMm": 100},
            "elevationMm": 2600,
            "systemType": "domestic_water",
            "serviceLevel": "ceiling",
        },
    )
    mep_opening = client.post(
        "/api/semantic-authoring/mep.opening_request",
        json={
            "hostElementId": "wall-1",
            "levelId": "level-1",
            "requesterElementIds": ["duct-1"],
            "openingKind": "wall",
            "widthMm": 600,
            "heightMm": 320,
            "systemType": "hvac_supply",
        },
    )
    column = client.post(
        "/api/semantic-authoring/structure.column",
        json={"levelId": "level-1", "positionMm": {"xMm": 0, "yMm": 0}},
    )
    package = client.post(
        "/api/semantic-authoring/construction.package",
        json={"name": "Structure shell"},
    )

    assert wall.status_code == 200
    assert wall.json()["commands"][0]["type"] == "createWall"
    assert level.status_code == 200
    assert level.json()["commands"][0]["type"] == "createLevel"
    assert roof_opening.status_code == 200
    assert roof_opening.json()["commands"][0]["type"] == "createRoofOpening"
    assert dormer.status_code == 200
    assert dormer.json()["commands"][0]["type"] == "createDormer"
    assert room_sep.status_code == 200
    assert room_sep.json()["commands"][0]["type"] == "createRoomSeparation"
    assert floor_supports.status_code == 200
    assert floor_supports.json()["commands"][0]["type"] == "updateElementProperty"
    assert stair.status_code == 200
    assert stair.json()["commands"][0]["type"] == "createStair"
    assert stair_runs.status_code == 200
    assert stair_runs.json()["commands"][0]["type"] == "createStair"
    assert stair_sketch.status_code == 200
    assert stair_sketch.json()["commands"][0]["authoringMode"] == "by_sketch"
    assert stair_existing.status_code == 200
    assert stair_existing.json()["commands"][0]["key"] == "existingConditionTolerance"
    assert shaft.status_code == 200
    assert shaft.json()["commands"][0]["isShaft"] is True
    assert railing.status_code == 200
    assert railing.json()["commands"][0]["type"] == "createRailing"
    assert mep_pipe.status_code == 200
    assert mep_pipe.json()["commands"][0]["type"] == "createPipe"
    assert mep_pipe.json()["commands"][0]["serviceLevel"] == "ceiling"
    assert mep_opening.status_code == 200
    assert mep_opening.json()["commands"][0]["type"] == "createMepOpeningRequest"
    assert column.status_code == 200
    assert column.json()["commands"][0]["type"] == "createColumn"
    assert package.status_code == 200
    assert package.json()["commands"][0]["type"] == "createConstructionPackage"


def test_command_bundle_payload_is_cmd_v3_dry_run_ready() -> None:
    bundle = build_semantic_authoring_bundle("door_on_wall", {"wallId": "wall-1", "alongT": 0.5})

    payload = bundle.command_bundle_payload(parent_revision=7)
    commit_payload = bundle.command_bundle_payload(parent_revision=7, mode="commit")

    assert payload["mode"] == "dry_run"
    assert commit_payload["mode"] == "commit"
    assert payload["bundle"]["schemaVersion"] == "cmd-v3.0"
    assert payload["bundle"]["parentRevision"] == 7
    assert payload["bundle"]["commands"][0]["type"] == "insertDoorOnWall"
    assert payload["bundle"]["assumptions"][0]["key"] == "semantic_authoring.door_on_wall"


def test_validation_errors_are_explicit_for_bad_payloads() -> None:
    with pytest.raises(ValidationError, match="alongT"):
        build_semantic_authoring_bundle("door_on_wall", {"wallId": "wall-1", "alongT": 1.5})

    with pytest.raises(ValidationError, match="start and end must differ"):
        build_semantic_authoring_bundle(
            "wall",
            {
                "levelId": "level-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 0, "yMm": 0},
            },
        )

    with pytest.raises(ValidationError, match="save_3d_view requires camera"):
        build_semantic_authoring_bundle("save_3d_view", {"name": "Current view"})

    with pytest.raises(ValidationError, match="closed loop"):
        build_semantic_authoring_bundle(
            "floor_from_wall_segments",
            {
                "levelId": "level-1",
                "wallSegments": [
                    {"start": _RECT_POINTS[0], "end": _RECT_POINTS[1]},
                    {"start": _RECT_POINTS[1], "end": _RECT_POINTS[2]},
                    {"start": _RECT_POINTS[2], "end": _RECT_POINTS[3]},
                ],
            },
        )

    with pytest.raises(SemanticAuthoringError, match="requires id"):
        build_semantic_authoring_bundle(
            "sheet_with_viewports",
            {
                "name": "Untitled sheet",
                "viewportsMm": [
                    {
                        "viewportId": "vp-1",
                        "viewRef": "plan:plan-eg",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 100,
                        "heightMm": 100,
                    }
                ],
            },
        )

    with pytest.raises(ValidationError, match="distinct baseLevelId"):
        build_semantic_authoring_bundle(
            "stair_between_levels",
            {
                "baseLevelId": "level-1",
                "topLevelId": "level-1",
                "runStartMm": {"xMm": 0, "yMm": 0},
                "runEndMm": {"xMm": 0, "yMm": 1000},
            },
        )

    with pytest.raises(ValidationError, match="at least three unique points"):
        build_semantic_authoring_bundle(
            "slab_opening",
            {
                "hostFloorId": "floor-1",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 0, "yMm": 0},
                ],
            },
        )

    with pytest.raises(ValidationError, match="zero-length segment"):
        build_semantic_authoring_bundle(
            "railing",
            {
                "pathMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 0, "yMm": 0},
                ],
            },
        )

    with pytest.raises(ValidationError, match="startMm and endMm must differ"):
        build_semantic_authoring_bundle(
            "structure_beam",
            {
                "levelId": "level-1",
                "startMm": {"xMm": 0, "yMm": 0},
                "endMm": {"xMm": 0, "yMm": 0},
            },
        )

    with pytest.raises(ValidationError, match="requires bMm or hMm"):
        build_semantic_authoring_bundle("structure_column_update", {"id": "col-s1"})

    with pytest.raises(ValidationError, match="requires boundaryMm or pathMm"):
        build_semantic_authoring_bundle(
            "construction_logistics",
            {"name": "Laydown", "logisticsKind": "laydown_area"},
        )


def test_unsupported_operations_raise_with_todo_metadata() -> None:
    assert "floor_from_wall_ids" in UNSUPPORTED_M2_OPERATIONS

    with pytest.raises(UnsupportedSemanticOperationError, match="floor_from_wall_ids"):
        unsupported_semantic_operation("floor_from_wall_ids")

    with pytest.raises(UnsupportedSemanticOperationError, match="not_real"):
        build_semantic_authoring_bundle("not_real", {})
