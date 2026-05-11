from __future__ import annotations

import pytest

from bim_ai.constructability_geometry import (
    AABB,
    PhysicalParticipant,
    aabb_distance_mm,
    aabb_overlaps,
    candidate_pairs_by_aabb,
    collect_physical_participants,
    collect_unsupported_physical_diagnostics,
    participants_overlap_narrow_phase,
    physical_collision_contract_summary_v1,
)
from bim_ai.elements import (
    AssetLibraryEntryElem,
    CeilingElem,
    DuctElem,
    FamilyInstanceElem,
    FamilyKitInstanceElem,
    FamilyTypeElem,
    LevelElem,
    PipeElem,
    PlacedAssetElem,
    RailingElem,
    StairElem,
    WallElem,
)


def _level() -> LevelElem:
    return LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=100.0)


def _participant_by_id(elements):
    return {p.element_id: p for p in collect_physical_participants(elements)}


def _participant(element_id: str, aabb: AABB) -> PhysicalParticipant:
    return PhysicalParticipant(
        element_id=element_id,
        kind="test",
        category="test",
        discipline=None,
        level_id=None,
        aabb=aabb,
    )


def test_wall_aabb_dimensions() -> None:
    elements = {
        "lvl-1": _level(),
        "w-1": WallElem(
            kind="wall",
            id="w-1",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
    }

    wall = _participant_by_id(elements)["w-1"]

    assert wall.aabb == AABB(0.0, -100.0, 100.0, 4000.0, 100.0, 3100.0)
    assert wall.aabb.width_mm == 4000.0
    assert wall.aabb.depth_mm == 200.0
    assert wall.aabb.height_mm == 3000.0
    assert wall.category == "wall"
    assert wall.discipline == "arch"
    assert wall.level_id == "lvl-1"


def test_placed_asset_and_family_instance_infer_sizes_from_parameters() -> None:
    elements = {
        "lvl-1": _level(),
        "asset-shelf": AssetLibraryEntryElem(
            kind="asset_library_entry",
            id="asset-shelf",
            assetKind="block_2d",
            name="Shelf",
            category="casework",
            tags=[],
            thumbnailKind="schematic_plan",
            thumbnailWidthMm=900,
            thumbnailHeightMm=300,
        ),
        "shelf": PlacedAssetElem(
            kind="placed_asset",
            id="shelf",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 1000, "yMm": 1000},
            rotationDeg=90,
            paramValues={"widthMm": 1200, "depthMm": 300, "proxyHeightMm": 80},
        ),
        "ft-cabinet": FamilyTypeElem(
            kind="family_type",
            id="ft-cabinet",
            familyId="casework",
            discipline="generic",
            parameters={"widthMm": 600, "depthMm": 450, "heightMm": 2100},
        ),
        "cabinet": FamilyInstanceElem(
            kind="family_instance",
            id="cabinet",
            familyTypeId="ft-cabinet",
            levelId="lvl-1",
            positionMm={"xMm": 3000, "yMm": 1000},
        ),
    }

    participants = _participant_by_id(elements)

    shelf = participants["shelf"]
    assert shelf.aabb.min_x == pytest.approx(850.0)
    assert shelf.aabb.max_x == pytest.approx(1150.0)
    assert shelf.aabb.min_y == pytest.approx(400.0)
    assert shelf.aabb.max_y == pytest.approx(1600.0)
    assert shelf.aabb.min_z == 100.0
    assert shelf.aabb.max_z == 180.0

    cabinet = participants["cabinet"]
    assert cabinet.aabb == AABB(2700.0, 775.0, 100.0, 3300.0, 1225.0, 2200.0)
    assert not collect_unsupported_physical_diagnostics(elements)


def test_physical_collision_contract_summary_reports_supported_and_unsupported() -> None:
    elements = {
        "lvl-1": _level(),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        "ft-empty": FamilyTypeElem(
            kind="family_type",
            id="ft-empty",
            familyId="generic",
            discipline="generic",
            parameters={},
        ),
        "family-unsupported": FamilyInstanceElem(
            kind="family_instance",
            id="family-unsupported",
            familyTypeId="ft-empty",
            levelId="lvl-1",
            positionMm={"xMm": 1000, "yMm": 1000},
        ),
    }

    summary = physical_collision_contract_summary_v1(elements)

    assert summary["participantCountsByKind"] == {"wall": 1}
    assert summary["unsupportedCountsByKind"] == {"family_instance": 1}
    assert summary["unsupportedDiagnostics"] == [
        {
            "elementId": "family-unsupported",
            "kind": "family_instance",
            "reason": (
                "missing positive width/depth/height in instance paramValues "
                "or family_type parameters"
            ),
        }
    ]


def test_wall_and_shelf_are_overlap_candidate() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", elevationMm=0.0),
        "wall": WallElem(
            kind="wall",
            id="wall",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        "asset-shelf": AssetLibraryEntryElem(
            kind="asset_library_entry",
            id="asset-shelf",
            assetKind="block_2d",
            name="Shelf",
            category="casework",
            tags=[],
            thumbnailKind="schematic_plan",
        ),
        "shelf": PlacedAssetElem(
            kind="placed_asset",
            id="shelf",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 2000, "yMm": 150},
            paramValues={"widthMm": 1000, "depthMm": 300, "proxyHeightMm": 250},
        ),
    }

    participants = _participant_by_id(elements)

    assert aabb_overlaps(participants["wall"].aabb, participants["shelf"].aabb)


def test_narrow_phase_rejects_diagonal_wall_aabb_false_positive() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", elevationMm=0.0),
        "wall": WallElem(
            kind="wall",
            id="wall",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        "asset-shelf": AssetLibraryEntryElem(
            kind="asset_library_entry",
            id="asset-shelf",
            assetKind="block_2d",
            name="Shelf",
            category="casework",
            tags=[],
            thumbnailKind="schematic_plan",
        ),
        "shelf": PlacedAssetElem(
            kind="placed_asset",
            id="shelf",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 3900, "yMm": 100},
            paramValues={"widthMm": 200, "depthMm": 200, "proxyHeightMm": 900},
        ),
    }

    participants = _participant_by_id(elements)

    assert aabb_overlaps(participants["wall"].aabb, participants["shelf"].aabb)
    assert not participants_overlap_narrow_phase(participants["wall"], participants["shelf"])


def test_non_overlap_distance() -> None:
    left = AABB(0, 0, 0, 100, 100, 100)
    right = AABB(400, 0, 0, 500, 100, 100)

    assert not aabb_overlaps(left, right)
    assert aabb_distance_mm(left, right) == 300.0


def test_candidate_pairs_by_aabb_is_deterministic_and_respects_tolerance() -> None:
    participants = [
        _participant("far", AABB(400, 0, 0, 500, 100, 100)),
        _participant("near", AABB(105, 0, 0, 205, 100, 100)),
        _participant("base", AABB(0, 0, 0, 100, 100, 100)),
        _participant("overlap", AABB(50, 0, 0, 150, 100, 100)),
    ]

    strict_pairs = candidate_pairs_by_aabb(participants)
    tolerant_pairs = candidate_pairs_by_aabb(participants, tolerance_mm=5)

    assert [(a.element_id, b.element_id) for a, b in strict_pairs] == [
        ("base", "overlap"),
        ("overlap", "near"),
    ]
    assert [(a.element_id, b.element_id) for a, b in tolerant_pairs] == [
        ("base", "overlap"),
        ("base", "near"),
        ("overlap", "near"),
    ]


def test_pipe_and_duct_aabbs() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", elevationMm=1000.0),
        "pipe": PipeElem(
            kind="pipe",
            id="pipe",
            levelId="lvl-1",
            startMm={"xMm": 0, "yMm": 0},
            endMm={"xMm": 1000, "yMm": 0},
            elevationMm=500,
            diameterMm=100,
        ),
        "duct": DuctElem(
            kind="duct",
            id="duct",
            levelId="lvl-1",
            startMm={"xMm": 0, "yMm": 1000},
            endMm={"xMm": 0, "yMm": 2000},
            elevationMm=800,
            widthMm=400,
            heightMm=250,
            shape="rectangular",
        ),
    }

    participants = _participant_by_id(elements)

    assert participants["pipe"].aabb == AABB(0.0, -50.0, 1450.0, 1000.0, 50.0, 1550.0)
    assert participants["pipe"].discipline == "mep"
    assert participants["duct"].aabb == AABB(-200.0, 1000.0, 1675.0, 200.0, 2000.0, 1925.0)
    assert participants["duct"].discipline == "mep"


def test_ceiling_railing_and_family_kit_aabbs() -> None:
    elements = {
        "lvl-1": _level(),
        "wall": WallElem(
            kind="wall",
            id="wall",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        "ceiling": CeilingElem(
            kind="ceiling",
            id="ceiling",
            levelId="lvl-1",
            boundaryMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 0, "yMm": 1000},
            ],
            heightOffsetMm=2500,
            thicknessMm=25,
        ),
        "stair": StairElem(
            kind="stair",
            id="stair",
            baseLevelId="lvl-1",
            topLevelId="lvl-1",
            runStartMm={"xMm": 0, "yMm": 1000},
            runEndMm={"xMm": 1000, "yMm": 1000},
            widthMm=900,
            totalRiseMm=2800,
        ),
        "rail": RailingElem(
            kind="railing",
            id="rail",
            hostedStairId="stair",
            pathMm=[
                {"xMm": 0, "yMm": 1000},
                {"xMm": 1000, "yMm": 1000},
            ],
        ),
        "kit": FamilyKitInstanceElem(
            kind="family_kit_instance",
            id="kit",
            kitId="kitchen_modular",
            hostWallId="wall",
            startMm=500,
            endMm=1500,
            countertopDepthMm=600,
        ),
    }

    participants = _participant_by_id(elements)

    assert participants["ceiling"].aabb == AABB(0.0, 0.0, 2600.0, 1000.0, 1000.0, 2625.0)
    assert participants["rail"].aabb == AABB(0.0, 960.0, 100.0, 1000.0, 1040.0, 1140.0)
    assert participants["kit"].aabb == AABB(500.0, 100.0, 100.0, 1500.0, 700.0, 2500.0)
