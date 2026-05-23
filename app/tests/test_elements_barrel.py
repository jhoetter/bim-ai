"""Verify the ``bim_ai.elements`` barrel still exposes the legacy import surface.

BRT-23 turned ``bim_ai/elements.py`` into a package of per-family submodules.
This test pins down the most important re-exports — both the element classes
that callers import directly and the discriminated-union machinery — so a
regression in the barrel is caught immediately.
"""

from __future__ import annotations

import inspect

from pydantic import BaseModel, TypeAdapter

from bim_ai import elements


def test_barrel_exposes_one_class_per_family() -> None:
    # A sampling — one or more classes from each family submodule.
    family_samples = {
        "walls": ["WallElem", "WallTypeElem", "WallOpeningElem", "CurtainPanelOverride"],
        "openings": ["DoorElem", "WindowElem"],
        "floors_roofs": [
            "FloorElem",
            "RoofElem",
            "SlabOpeningElem",
            "RoofOpeningElem",
            "DormerElem",
            "BalconyElem",
            "SoffitElem",
            "RoofJoinElem",
            "EdgeProfileRunElem",
        ],
        "rooms": ["RoomElem", "RoomColorSchemeElem", "ProjectSettingsElem", "LevelElem", "AreaElem"],
        "stairs": ["StairElem", "RailingElem", "BalusterPattern", "HandrailSupport"],
        "structural": [
            "ColumnElem",
            "BeamElem",
            "CeilingElem",
            "MassElem",
            "ConstraintElem",
            "SweepElem",
            "ReferencePlaneElem",
            "GridLineElem",
            "VoidCutElem",
            "Text3dElem",
        ],
        "site": [
            "SiteElem",
            "ToposolidElem",
            "ToposolidSubdivisionElem",
            "GradedRegionElem",
            "ToposolidExcavationElem",
            "ProjectBasePointElem",
            "SurveyPointElem",
            "InternalOriginElem",
            "SunSettingsElem",
            "NeighborhoodMassElem",
            "PropertyLineElem",
        ],
        "views": [
            "SheetElem",
            "ScheduleElem",
            "CalloutElem",
            "ViewElem",
            "PlanViewElem",
            "ViewTemplateElem",
            "ViewpointElem",
            "MaskingRegionElem",
            "WindowLegendViewElem",
            "IssueElem",
        ],
        "assets": [
            "AssetLibraryEntryElem",
            "PlacedAssetElem",
            "FamilyKitInstanceElem",
            "MaterialElem",
            "DecalElem",
            "HatchPatternDefElem",
            "ImageAssetElem",
            "ImageUnderlayElem",
        ],
        "presentation": [
            "BrandTemplateElem",
            "FrameElem",
            "SavedViewElem",
            "PresentationCanvasElem",
            "ConceptSeedElem",
            "PresentationLinkElem",
            "TitleblockTypeElem",
            "RevisionCloudElem",
        ],
        "metadata": [
            "PhaseElem",
            "PropertyDefinitionElem",
            "SelectionSetElem",
            "ClashTestElem",
            "ThermalBridgeMarkerElem",
            "RenovationScenarioElem",
            "BuildingServicesHandoffElem",
        ],
    }
    missing: list[str] = []
    for family, class_names in family_samples.items():
        for name in class_names:
            cls = getattr(elements, name, None)
            if cls is None:
                missing.append(f"{family}.{name}")
                continue
            if not (inspect.isclass(cls) and issubclass(cls, BaseModel)):
                missing.append(f"{family}.{name} (not a BaseModel subclass)")
    assert not missing, f"missing/non-class barrel exports: {missing}"


def test_barrel_reexports_sibling_modules() -> None:
    # Symbols that come from the four sibling ``bim_ai.elements_*`` modules.
    sibling_samples = [
        # Annotations.
        "DimensionElem",
        "TextNoteElem",
        "SpotElevationElem",
        "KeynoteElem",
        # Constructability.
        "BcfElem",
        "ConstructabilityIssueElem",
        "AgentAssumptionElem",
        "SkbPhaseId",  # critical re-export per BRT-23 brief.
        # Links.
        "LinkModelElem",
        "PlanRegionElem",
        "SectionCutElem",
        "ElevationViewElem",
        "FamilyInstanceElem",
        "RoomSeparationElem",
        # MEP.
        "PipeElem",
        "DuctElem",
        "CableTrayElem",
        "MepEquipmentElem",
        "FixtureElem",
    ]
    for name in sibling_samples:
        assert hasattr(elements, name), f"{name} is missing from bim_ai.elements barrel"


def test_barrel_reexports_primitives_and_helpers() -> None:
    helper_samples = [
        # Element primitives historically re-exported.
        "Vec2Mm",
        "Vec3Mm",
        "CameraMm",
        "DEFAULT_DISCIPLINE_BY_KIND",
        "WallLayerFunction",
        "WallCurve",
        "WallBasisLine",
        # Shared models lifted from the legacy module body.
        "MonitorSourceSpec",
        "CircularityProperties",
        "MaterialFaceOverride",
        "MaterialImpactProperties",
        "RoomColorSchemeRow",
        # Constants and pure functions.
        "INTERNAL_ORIGIN_ID",
        "SUN_SETTINGS_ID",
        "DEFAULT_TITLEBLOCK_TYPE",
        "curtain_grid_cell_id",
        "parse_curtain_grid_cell_id",
        "normalize_view_template_control_matrix",
        "default_view_template_control_matrix",
    ]
    for name in helper_samples:
        assert hasattr(elements, name), f"{name} is missing from bim_ai.elements barrel"


def test_discriminated_union_round_trips_each_family() -> None:
    """Validate one specimen per family through the ``Element`` union to confirm
    the discriminator + class set survived the split."""
    adapter = TypeAdapter(elements.Element)
    specimens: list[dict] = [
        {"kind": "level", "id": "lvl-0", "name": "Ground", "elevationMm": 0},
        {
            "kind": "wall",
            "id": "w-1",
            "levelId": "lvl-0",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 1000, "yMm": 0},
        },
        {"kind": "door", "id": "d-1", "wallId": "w-1", "alongT": 0.5},
        {
            "kind": "floor",
            "id": "f-1",
            "levelId": "lvl-0",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 0, "yMm": 1000},
            ],
        },
        {
            "kind": "room",
            "id": "r-1",
            "levelId": "lvl-0",
            "outlineMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
            ],
        },
        {
            "kind": "stair",
            "id": "s-1",
            "baseLevelId": "lvl-0",
            "topLevelId": "lvl-0",
            "runStartMm": {"xMm": 0, "yMm": 0},
            "runEndMm": {"xMm": 0, "yMm": 4000},
        },
        {
            "kind": "site",
            "id": "site-1",
            "referenceLevelId": "lvl-0",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
            ],
        },
        {"kind": "sheet", "id": "sh-1"},
        {
            "kind": "phase",
            "id": "ph-1",
            "name": "Existing",
        },
    ]
    expected_classes = {
        "level": elements.LevelElem,
        "wall": elements.WallElem,
        "door": elements.DoorElem,
        "floor": elements.FloorElem,
        "room": elements.RoomElem,
        "stair": elements.StairElem,
        "site": elements.SiteElem,
        "sheet": elements.SheetElem,
        "phase": elements.PhaseElem,
    }
    for specimen in specimens:
        validated = adapter.validate_python(specimen)
        expected = expected_classes[specimen["kind"]]
        assert isinstance(validated, expected), (
            f"kind={specimen['kind']} resolved to {type(validated).__name__}, "
            f"not {expected.__name__}"
        )
