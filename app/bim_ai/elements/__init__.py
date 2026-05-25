"""Element-model barrel.

BRT-23 turned the legacy 2,900-LOC ``bim_ai.elements`` module into a package
of per-family submodules (``walls``, ``openings``, ``floors_roofs``, ``rooms``,
``stairs``, ``structural``, ``site``, ``views``, ``assets``, ``presentation``,
``metadata``, plus the private ``_shared`` helpers). The four pre-existing
``bim_ai.elements_*`` sibling modules (annotations, constructability, links,
mep) are kept where they were and re-exported through this barrel so that the
historical ``from bim_ai.elements import …`` surface is byte-stable.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from bim_ai.element_primitives import (
    DEFAULT_DISCIPLINE_BY_KIND,
    CameraMm,
    DisciplineTag,
    EnergyHeatingStatus,
    EnergyUsageProfile,
    EvidenceRef,
    EvidenceRefKind,
    LensMode,
    PhaseFilter,
    PlanDetailLevelPlan,
    RenovationScenarioStatus,
    StructuralAnalysisStatus,
    StructuralMaterial,
    StructuralRole,
    ThermalBridgeMarkerType,
    ThermalClassificationSource,
    ThermalEnvelopeClassification,
    Vec2Mm,
    Vec3Mm,
    ViewTemplateControlledField,
    WallArcCurve,
    WallBasisLine,
    WallBezierCurve,
    WallCurve,
    WallLayerFunction,
    WallLocationLine,
    WallStructuralRole,
)
from bim_ai.elements_annotations import (
    AngularDimensionElem,
    AnnotationSymbolElem,
    AnnotationSymbolType,
    ArcLengthDimensionElem,
    ColorFillLegendElem,
    DetailComponentElem,
    DetailComponentShape,
    DetailGroupElem,
    DetailLineElem,
    DetailLineStyle,
    DetailRegionElem,
    DetailRegionFillPattern,
    DiameterDimensionElem,
    DimensionElem,
    InsulationAnnotationElem,
    KeynoteElem,
    KeynoteTarget,
    MaterialTagElem,
    MultiCategoryTagElem,
    PlacedTagElem,
    RadialDimensionElem,
    RepeatingDetailElem,
    SpanDirectionElem,
    SpotCoordinateElem,
    SpotElevationElem,
    SpotSlopeElem,
    SpotSlopeFormat,
    TextNoteAnchor,
    TextNoteElem,
    TreadNumberElem,
)
from bim_ai.elements_constructability import (
    AgentAssumptionElem,
    AgentDeviationElem,
    BcfElem,
    ConstructabilityIssueElem,
    ConstructabilitySuppressionElem,
    ConstructionChecklistItem,
    ConstructionLogisticsElem,
    ConstructionPackageElem,
    ConstructionQaChecklistElem,
    SiteContextType,
    SkbPhaseId,
    ValidationRuleElem,
)
from bim_ai.elements_links import (
    DxfLayerMeta,
    DxfLineworkArc,
    DxfLineworkLine,
    DxfLineworkPolyline,
    DxfLineworkPrim,
    ElevationViewElem,
    ExternalLinkElem,
    FamilyCatalogSource,
    FamilyInstanceElem,
    FamilyTypeElem,
    JoinGeometryElem,
    LinkDxfElem,
    LinkModelElem,
    PlanRegionElem,
    PlanTagBadgeStyle,
    PlanTagTarget,
    RoomSeparationElem,
    SectionCutElem,
    SourceViewEvidenceElem,
    TagDefinitionElem,
)
from bim_ai.elements_mep import (
    CableTrayElem,
    DuctElem,
    DuctLegendElem,
    DuctLegendEntrySpec,
    DuctShape,
    DuctSystemType,
    FixtureElem,
    FlowDirection,
    MepConnectorSpec,
    MepEquipmentElem,
    MepOpeningRequestElem,
    MepSystemType,
    MepTerminalElem,
    PipeElem,
    PipeLegendElem,
    PipeLegendEntrySpec,
    PipeSystemType,
)

from ._shared import (
    CircularityProperties,
    MaterialFaceKind,
    MaterialFaceOverride,
    MaterialFaceOverrideSource,
    MaterialImpactProperties,
    MonitorSourceSpec,
    RoomColorSchemeRow,
    ViewTemplateFieldControl,
    default_view_template_control_matrix,
    normalize_view_template_control_matrix,
)
from .assets import (
    AssetLibraryEntryElem,
    AssetParamEntry,
    AssetSymbolKind,
    DecalElem,
    FamilyKitInstanceElem,
    HatchPatternDefElem,
    HatchPatternKind,
    ImageAssetElem,
    ImageAssetMapUsage,
    ImageUnderlayElem,
    KitComponent,
    MaterialElem,
    PlacedAssetElem,
)
from .floors_roofs import (
    BalconyElem,
    DormerElem,
    DormerPositionOnRoof,
    DormerRoofKind,
    EdgeProfileRunElem,
    FacadeBayElem,
    FacadeBayShape,
    FloorElem,
    FloorTypeElem,
    RoofElem,
    RoofJoinElem,
    RoofOpeningElem,
    RoofTypeElem,
    SlabOpeningElem,
    SoffitElem,
)
from .metadata import (
    BuildingServicesHandoffElem,
    ClashResultSpec,
    ClashTestElem,
    PhaseElem,
    PropertyDefinitionElem,
    RenovationMeasurePackage,
    RenovationScenarioElem,
    SelectionSetElem,
    SelectionSetRuleSpec,
    ThermalBridgeMarkerElem,
)
from .openings import (
    DoorElem,
    DoorOperationType,
    DoorSlidingTrackSide,
    WindowElem,
    WindowOutlineKind,
)
from .presentation import (
    DEFAULT_TITLEBLOCK_TYPE,
    BrandTemplateElem,
    ConceptSeedElem,
    FrameElem,
    PresentationCanvasElem,
    PresentationLinkElem,
    RevisionCloudElem,
    SavedViewElem,
    TitleblockTypeElem,
    TokenSlot,
)
from .rooms import (
    AreaElem,
    AreaRuleSet,
    AreaScheme,
    LevelElem,
    ProjectSettingsElem,
    RoomColorSchemeElem,
    RoomElem,
)
from .site import (
    INTERNAL_ORIGIN_ID,
    SUN_SETTINGS_ID,
    GradedRegionElem,
    HeightmapGrid,
    HeightSample,
    InternalOriginElem,
    NeighborhoodImportSessionElem,
    NeighborhoodMassElem,
    ProjectBasePointElem,
    PropertyLineClassification,
    PropertyLineElem,
    SiteContextObjectRow,
    SiteElem,
    SunSettingsAnimationRange,
    SunSettingsElem,
    SunSettingsTimeOfDay,
    SurveyPointElem,
    ToposolidElem,
    ToposolidExcavationCutMode,
    ToposolidExcavationElem,
    ToposolidFinishCategory,
    ToposolidSubdivisionElem,
)
from .stairs import (
    BalusterPattern,
    HandrailSupport,
    RailingElem,
    StairElem,
    StairLanding,
    StairRun,
    StairShape,
    StairTreadLine,
)
from .structural import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    ConstraintAnchor,
    ConstraintElem,
    ConstraintRefRow,
    ConstraintRule,
    GridLineElem,
    MassElem,
    ReferencePlaneElem,
    SweepElem,
    SweepPathPoint,
    SweepProfilePlane,
    SweepProfilePoint,
    Text3dElem,
    Text3dFontFamily,
    VoidCutElem,
)
from .views import (
    XY,
    CalloutElem,
    ClipRect,
    ElementOverrideSpec,
    IssueElem,
    MaskingRegionElem,
    PlanCategoryGraphicCategoryKey,
    PlanCategoryGraphicRow,
    PlanLinePatternTokenPlan,
    PlanTagStyleElem,
    PlanViewElem,
    PlanViewSubtypePlan,
    ScheduleElem,
    SheetElem,
    SheetMetadata,
    SheetXY,
    ViewBreakSpec,
    ViewElem,
    ViewPlacement,
    ViewpointCutawayStyle,
    ViewpointElem,
    ViewTemplateElem,
    WindowLegendViewElem,
)
from .walls import (
    CurtainPanelOverride,
    CurtainPanelOverrideKind,
    WallEdgeFixed,
    WallEdgeSpan,
    WallEdgeSpec,
    WallElem,
    WallOpeningElem,
    WallRecessZone,
    WallStack,
    WallStackComponent,
    WallTypeElem,
    WallTypeLayer,
    curtain_grid_cell_id,
    parse_curtain_grid_cell_id,
)

# Explicit re-export surface (satisfies F401 + documents the public barrel).
__all__ = [
    "AngularDimensionElem",
    "AnnotationSymbolElem",
    "AnnotationSymbolType",
    "ArcLengthDimensionElem",
    "ColorFillLegendElem",
    "DetailComponentElem",
    "DetailComponentShape",
    "DetailGroupElem",
    "DetailLineElem",
    "DetailLineStyle",
    "DetailRegionElem",
    "DetailRegionFillPattern",
    "DiameterDimensionElem",
    "DimensionElem",
    "InsulationAnnotationElem",
    "KeynoteElem",
    "KeynoteTarget",
    "MaterialTagElem",
    "MultiCategoryTagElem",
    "PlacedTagElem",
    "RadialDimensionElem",
    "RepeatingDetailElem",
    "SpanDirectionElem",
    "SpotCoordinateElem",
    "SpotElevationElem",
    "SpotSlopeElem",
    "SpotSlopeFormat",
    "TextNoteAnchor",
    "TextNoteElem",
    "TreadNumberElem",
    "AgentAssumptionElem",
    "AgentDeviationElem",
    "BcfElem",
    "ConstructabilityIssueElem",
    "ConstructabilitySuppressionElem",
    "ConstructionChecklistItem",
    "ConstructionLogisticsElem",
    "ConstructionPackageElem",
    "ConstructionQaChecklistElem",
    "SiteContextType",
    "SkbPhaseId",
    "ValidationRuleElem",
    "DxfLayerMeta",
    "DxfLineworkArc",
    "DxfLineworkLine",
    "DxfLineworkPolyline",
    "DxfLineworkPrim",
    "ElevationViewElem",
    "ExternalLinkElem",
    "FamilyCatalogSource",
    "FamilyInstanceElem",
    "FamilyTypeElem",
    "JoinGeometryElem",
    "LinkDxfElem",
    "LinkModelElem",
    "PlanRegionElem",
    "PlanTagBadgeStyle",
    "PlanTagTarget",
    "RoomSeparationElem",
    "SectionCutElem",
    "SourceViewEvidenceElem",
    "TagDefinitionElem",
    "CableTrayElem",
    "DuctElem",
    "DuctLegendElem",
    "DuctLegendEntrySpec",
    "DuctShape",
    "DuctSystemType",
    "FixtureElem",
    "FlowDirection",
    "MepConnectorSpec",
    "MepEquipmentElem",
    "MepOpeningRequestElem",
    "MepSystemType",
    "MepTerminalElem",
    "PipeElem",
    "PipeLegendElem",
    "PipeLegendEntrySpec",
    "PipeSystemType",
    "DEFAULT_DISCIPLINE_BY_KIND",
    "CameraMm",
    "DisciplineTag",
    "EnergyHeatingStatus",
    "EnergyUsageProfile",
    "EvidenceRef",
    "EvidenceRefKind",
    "LensMode",
    "PhaseFilter",
    "PlanDetailLevelPlan",
    "RenovationScenarioStatus",
    "StructuralAnalysisStatus",
    "StructuralMaterial",
    "StructuralRole",
    "ThermalBridgeMarkerType",
    "ThermalClassificationSource",
    "ThermalEnvelopeClassification",
    "Vec2Mm",
    "Vec3Mm",
    "ViewTemplateControlledField",
    "WallArcCurve",
    "WallBasisLine",
    "WallBezierCurve",
    "WallCurve",
    "WallLayerFunction",
    "WallLocationLine",
    "WallStructuralRole",
    "CircularityProperties",
    "MaterialFaceKind",
    "MaterialFaceOverride",
    "MaterialFaceOverrideSource",
    "MaterialImpactProperties",
    "MonitorSourceSpec",
    "RoomColorSchemeRow",
    "ViewTemplateFieldControl",
    "default_view_template_control_matrix",
    "normalize_view_template_control_matrix",
    "CurtainPanelOverride",
    "CurtainPanelOverrideKind",
    "WallEdgeFixed",
    "WallEdgeSpan",
    "WallEdgeSpec",
    "WallElem",
    "WallOpeningElem",
    "WallRecessZone",
    "WallStack",
    "WallStackComponent",
    "WallTypeElem",
    "WallTypeLayer",
    "curtain_grid_cell_id",
    "parse_curtain_grid_cell_id",
    "DoorElem",
    "DoorOperationType",
    "DoorSlidingTrackSide",
    "WindowElem",
    "WindowOutlineKind",
    "BalconyElem",
    "DormerElem",
    "DormerPositionOnRoof",
    "DormerRoofKind",
    "EdgeProfileRunElem",
    "FacadeBayElem",
    "FacadeBayShape",
    "FloorElem",
    "FloorTypeElem",
    "RoofElem",
    "RoofJoinElem",
    "RoofOpeningElem",
    "RoofTypeElem",
    "SlabOpeningElem",
    "SoffitElem",
    "AreaElem",
    "AreaRuleSet",
    "AreaScheme",
    "LevelElem",
    "ProjectSettingsElem",
    "RoomColorSchemeElem",
    "RoomElem",
    "BalusterPattern",
    "HandrailSupport",
    "RailingElem",
    "StairElem",
    "StairLanding",
    "StairRun",
    "StairShape",
    "StairTreadLine",
    "BeamElem",
    "CeilingElem",
    "ColumnElem",
    "ConstraintAnchor",
    "ConstraintElem",
    "ConstraintRefRow",
    "ConstraintRule",
    "GridLineElem",
    "MassElem",
    "ReferencePlaneElem",
    "SweepElem",
    "SweepPathPoint",
    "SweepProfilePlane",
    "SweepProfilePoint",
    "Text3dElem",
    "Text3dFontFamily",
    "VoidCutElem",
    "GradedRegionElem",
    "HeightSample",
    "HeightmapGrid",
    "INTERNAL_ORIGIN_ID",
    "InternalOriginElem",
    "NeighborhoodImportSessionElem",
    "NeighborhoodMassElem",
    "ProjectBasePointElem",
    "PropertyLineClassification",
    "PropertyLineElem",
    "SUN_SETTINGS_ID",
    "SiteContextObjectRow",
    "SiteElem",
    "SunSettingsAnimationRange",
    "SunSettingsElem",
    "SunSettingsTimeOfDay",
    "SurveyPointElem",
    "ToposolidElem",
    "ToposolidExcavationCutMode",
    "ToposolidExcavationElem",
    "ToposolidFinishCategory",
    "ToposolidSubdivisionElem",
    "CalloutElem",
    "ClipRect",
    "ElementOverrideSpec",
    "IssueElem",
    "MaskingRegionElem",
    "PlanCategoryGraphicCategoryKey",
    "PlanCategoryGraphicRow",
    "PlanLinePatternTokenPlan",
    "PlanTagStyleElem",
    "PlanViewElem",
    "PlanViewSubtypePlan",
    "ScheduleElem",
    "SheetElem",
    "SheetMetadata",
    "SheetXY",
    "ViewBreakSpec",
    "ViewElem",
    "ViewPlacement",
    "ViewTemplateElem",
    "ViewpointCutawayStyle",
    "ViewpointElem",
    "WindowLegendViewElem",
    "XY",
    "AssetLibraryEntryElem",
    "AssetParamEntry",
    "AssetSymbolKind",
    "DecalElem",
    "FamilyKitInstanceElem",
    "HatchPatternDefElem",
    "HatchPatternKind",
    "ImageAssetElem",
    "ImageAssetMapUsage",
    "ImageUnderlayElem",
    "KitComponent",
    "MaterialElem",
    "PlacedAssetElem",
    "BrandTemplateElem",
    "ConceptSeedElem",
    "DEFAULT_TITLEBLOCK_TYPE",
    "FrameElem",
    "PresentationCanvasElem",
    "PresentationLinkElem",
    "RevisionCloudElem",
    "SavedViewElem",
    "TitleblockTypeElem",
    "TokenSlot",
    "BuildingServicesHandoffElem",
    "ClashResultSpec",
    "ClashTestElem",
    "PhaseElem",
    "PropertyDefinitionElem",
    "RenovationMeasurePackage",
    "RenovationScenarioElem",
    "SelectionSetElem",
    "SelectionSetRuleSpec",
    "ThermalBridgeMarkerElem",
    "Element",
    "ElementKind",
]


ElementKind = Literal[
    "project_settings",
    "room_color_scheme",
    "wall_type",
    "floor_type",
    "roof_type",
    "level",
    "wall",
    "door",
    "window",
    "wall_opening",
    "room",
    "grid_line",
    "dimension",
    "viewpoint",
    "issue",
    "floor",
    "roof",
    "stair",
    "slab_opening",
    "roof_opening",
    "railing",
    "family_type",
    "family_instance",
    "room_separation",
    "plan_region",
    "tag_definition",
    "plan_tag_style",
    "join_geometry",
    "section_cut",
    "plan_view",
    "view_template",
    "sheet",
    "schedule",
    "callout",
    "bcf",
    "agent_assumption",
    "agent_deviation",
    "validation_rule",
    "site",
    "text_3d",
    "project_base_point",
    "survey_point",
    "internal_origin",
    "sun_settings",
    "link_model",
    "link_dxf",
    "selection_set",
    "clash_test",
    "placed_tag",
    "detail_line",
    "detail_region",
    "text_note",
    "reference_plane",
    "property_line",
    "balcony",
    "facade_bay",
    "sweep",
    "dormer",
    "area",
    "masking_region",
    "spot_elevation",
    "material_tag",
    "multi_category_tag",
    "tread_number",
    "keynote",
    "span_direction",
    "detail_component",
    "repeating_detail",
    "detail_group",
    "color_fill_legend",
    "mass",
    "constraint",
    "roof_join",
    "edge_profile_run",
    "soffit",
    "duct",
    "pipe",
    "cable_tray",
    "mep_equipment",
    "fixture",
    "mep_terminal",
    "mep_opening_request",
    "pipe_legend",
    "duct_legend",
    "view",
    "toposolid",
    "property_definition",
    "brand_template",
]


Element = Annotated[
    ProjectSettingsElem
    | RoomColorSchemeElem
    | WallTypeElem
    | FloorTypeElem
    | RoofTypeElem
    | LevelElem
    | WallElem
    | DoorElem
    | WindowElem
    | WallOpeningElem
    | RoomElem
    | GridLineElem
    | DimensionElem
    | AngularDimensionElem
    | ViewpointElem
    | IssueElem
    | FloorElem
    | RoofElem
    | StairElem
    | SlabOpeningElem
    | RoofOpeningElem
    | RailingElem
    | BalconyElem
    | FacadeBayElem
    | FamilyTypeElem
    | RoomSeparationElem
    | PlanRegionElem
    | TagDefinitionElem
    | PlanTagStyleElem
    | JoinGeometryElem
    | SectionCutElem
    | ElevationViewElem
    | SourceViewEvidenceElem
    | PlanViewElem
    | ViewTemplateElem
    | SheetElem
    | ScheduleElem
    | CalloutElem
    | BcfElem
    | ConstructabilitySuppressionElem
    | ConstructabilityIssueElem
    | ConstructionPackageElem
    | ConstructionLogisticsElem
    | ConstructionQaChecklistElem
    | AgentAssumptionElem
    | AgentDeviationElem
    | ValidationRuleElem
    | SiteElem
    | Text3dElem
    | ProjectBasePointElem
    | SurveyPointElem
    | InternalOriginElem
    | SunSettingsElem
    | LinkModelElem
    | LinkDxfElem
    | ExternalLinkElem
    | SelectionSetElem
    | ClashTestElem
    | PlacedTagElem
    | DetailLineElem
    | DetailRegionElem
    | TextNoteElem
    | AnnotationSymbolElem
    | ReferencePlaneElem
    | PropertyLineElem
    | SweepElem
    | DormerElem
    | AreaElem
    | MaskingRegionElem
    | RevisionCloudElem
    | SpotElevationElem
    | MaterialTagElem
    | MultiCategoryTagElem
    | TreadNumberElem
    | KeynoteElem
    | SpanDirectionElem
    | DetailComponentElem
    | RepeatingDetailElem
    | DetailGroupElem
    | ColorFillLegendElem
    | FamilyInstanceElem
    | ColumnElem
    | BeamElem
    | CeilingElem
    | MassElem
    | PresentationLinkElem
    | VoidCutElem
    | ConstraintElem
    | PhaseElem
    | RoofJoinElem
    | EdgeProfileRunElem
    | SoffitElem
    | TitleblockTypeElem
    | WindowLegendViewElem
    | ViewElem
    | ToposolidElem
    | ToposolidSubdivisionElem
    | GradedRegionElem
    | ToposolidExcavationElem
    | AssetLibraryEntryElem
    | PlacedAssetElem
    | FamilyKitInstanceElem
    | HatchPatternDefElem
    | MaterialElem
    | ImageAssetElem
    | DecalElem
    | ThermalBridgeMarkerElem
    | RenovationScenarioElem
    | BuildingServicesHandoffElem
    | PropertyDefinitionElem
    | ImageUnderlayElem
    | ConceptSeedElem
    | NeighborhoodMassElem
    | NeighborhoodImportSessionElem
    | FrameElem
    | SavedViewElem
    | PresentationCanvasElem
    | BrandTemplateElem
    | PipeElem
    | DuctElem
    | CableTrayElem
    | MepEquipmentElem
    | FixtureElem
    | MepTerminalElem
    | MepOpeningRequestElem
    | PipeLegendElem
    | DuctLegendElem
    | RadialDimensionElem
    | DiameterDimensionElem
    | ArcLengthDimensionElem,
    Field(discriminator="kind"),
]
