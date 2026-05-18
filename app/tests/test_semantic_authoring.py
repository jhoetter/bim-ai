from __future__ import annotations

import pytest
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
    stair = build_semantic_authoring_bundle(
        "stair_between_levels",
        {
            "baseLevelId": "level-1",
            "topLevelId": "level-2",
            "runStartMm": {"xMm": 1000, "yMm": 1000},
            "runEndMm": {"xMm": 1000, "yMm": 4200},
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
    assert stair.commands[0]["type"] == "createStair"
    assert stair.commands[0]["shape"] == "straight"
    assert plan.commands[0]["type"] == "upsertPlanView"
    assert [command["type"] for command in sheet.commands] == [
        "upsertSheet",
        "upsertSheetViewports",
    ]
    assert sheet.commands[1]["viewportsMm"][0]["viewRef"] == "plan:plan-eg"


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


def test_unsupported_operations_raise_with_todo_metadata() -> None:
    assert "floor_from_wall_ids" in UNSUPPORTED_M2_OPERATIONS

    with pytest.raises(UnsupportedSemanticOperationError, match="floor_from_wall_ids"):
        unsupported_semantic_operation("floor_from_wall_ids")

    with pytest.raises(UnsupportedSemanticOperationError, match="not_real"):
        build_semantic_authoring_bundle("not_real", {})
