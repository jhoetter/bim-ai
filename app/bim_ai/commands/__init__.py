"""Command barrel — re-exports every Pydantic command class from the per-domain
submodules and defines the discriminated ``Command`` union.

BRT-22 split the original ~3,000 LOC ``commands.py`` into per-domain modules
under this package to keep each file under ~800 LOC. External callers still
import every command class (and the ``Command`` union) from
``bim_ai.commands``.

The wire format is byte-identical to the pre-split shape: the ``Command``
union below preserves the original member ordering and the same ``type``
discriminator + field aliases as before.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import Field

# --- per-domain submodules --------------------------------------------------
from bim_ai.commands.documentation import (
    AddOptionCmd,
    AddViewBreakCmd,
    AssignElementToOptionCmd,
    ConstructionMetadata,
    CreateAgentAssumptionCmd,
    CreateAgentDeviationCmd,
    CreateBcfTopicCmd,
    CreateCalloutCmd,
    CreateConstructionLogisticsCmd,
    CreateConstructionPackageCmd,
    CreateElevationViewCmd,
    CreateIssueFromViolationCmd,
    CreateOptionSetCmd,
    CreatePhaseCmd,
    CreateSectionCutCmd,
    CreateSunSettingsCmd,
    DeletePhaseCmd,
    HideElementInViewCmd,
    RemoveOptionCmd,
    RemoveViewBreakCmd,
    RenamePhaseCmd,
    ReorderPhaseCmd,
    SaveViewpointCmd,
    SetElementConstructionCmd,
    SetElementDisciplineCmd,
    SetElementOverrideCmd,
    SetElementPhaseCmd,
    SetPrimaryOptionCmd,
    SetViewLensCmd,
    SetViewOptionLockCmd,
    SetViewPhaseCmd,
    SetViewPhaseFilterCmd,
    UnhideElementInViewCmd,
    UpdateIssueStatusCmd,
    UpdateSunSettingsCmd,
    UpsertConstructionQaChecklistCmd,
    UpsertProjectSettingsCmd,
    UpsertRoomColorSchemeCmd,
    UpsertValidationRuleCmd,
)
from bim_ai.commands.geometry import (
    AssignWallDatumConstraintsCmd,
    AttachWallTopCmd,
    AttachWallTopToRoofCmd,
    CreateBalconyCmd,
    CreateDormerCmd,
    CreateEdgeProfileRunCmd,
    CreateFacadeBayCmd,
    CreateFloorCmd,
    CreateGridLineCmd,
    CreateLevelCmd,
    CreateRailingCmd,
    CreateRoofCmd,
    CreateRoofJoinCmd,
    CreateRoofOpeningCmd,
    CreateSlabOpeningCmd,
    CreateSoffitCmd,
    CreateStairCmd,
    CreateStructuralFacadeGridCmd,
    CreateSweepCmd,
    CreateWallChainCmd,
    CreateWallCmd,
    CreateWallOpeningCmd,
    CreateWallTypeCmd,
    CreateWintergartenCmd,
    DetachWallTopCmd,
    ExtendFloorInsulationCmd,
    MoveBeamEndpointsCmd,
    MoveGridLineEndpointsCmd,
    MoveLevelElevationCmd,
    MoveWallDeltaCmd,
    MoveWallEndpointsCmd,
    SetCurtainPanelOverrideCmd,
    SetEdgeProfileRunModeCmd,
    SetRailingBalusterPatternCmd,
    SetRailingHandrailSupportsCmd,
    SetStairSubKindCmd,
    SetWallLeanTaperCmd,
    SetWallRecessZonesCmd,
    SetWallStackCmd,
    UpdateStairTreadsCmd,
    UpdateWallCmd,
    UpdateWallOpeningCmd,
    UpsertFloorTypeCmd,
    UpsertRoofTypeCmd,
    UpsertWallTypeCmd,
    WallChainSegment,
    WallStackComponentCmd,
)
from bim_ai.commands.hosting import (
    AssignOpeningFamilyCmd,
    FamilyCatalogSourceCmd,
    IndexAssetCmd,
    InsertDoorOnWallCmd,
    InsertWindowOnWallCmd,
    PlaceAssetCmd,
    PlaceFamilyInstanceCmd,
    UpdateDoorCmd,
    UpdateMaterialPbrCmd,
    UpdateOpeningCleanroomCmd,
    UpdateWindowCmd,
    UpsertFamilyTypeCmd,
)
from bim_ai.commands.mep import (
    CreateCableTrayCmd,
    CreateDuctCmd,
    CreateDuctLegendCmd,
    CreateFixtureCmd,
    CreateMepEquipmentCmd,
    CreateMepOpeningRequestCmd,
    CreateMepTerminalCmd,
    CreatePipeCmd,
    CreatePipeLegendCmd,
    MepSystemCmdType,
)
from bim_ai.commands.other import (
    AlignElementToReferenceCmd,
    AreaRuleSetCmd,
    CreateAreaCmd,
    CreateBeamCmd,
    CreateCeilingCmd,
    CreateColumnCmd,
    CreateConstraintCmd,
    CreateJoinGeometryCmd,
    CreateMaskingRegionCmd,
    CreateMassCmd,
    CreatePlanRegionCmd,
    CreateReferencePlaneCmd,
    CreateRevisionCloudCmd,
    CreateRoomOutlineCmd,
    CreateRoomPolyCmd,
    CreateRoomRectangleCmd,
    CreateRoomSeparationCmd,
    CreateText3dCmd,
    CreateVoidCutCmd,
    DeleteAreaCmd,
    DeleteElementCmd,
    DeleteElementsCmd,
    DeleteMaskingRegionCmd,
    DeletePlanRegionCmd,
    DeleteReferencePlaneCmd,
    MaterializeMassToWallsCmd,
    MirrorAxis,
    MirrorElementsCmd,
    MoveAssetDeltaCmd,
    MoveColumnDeltaCmd,
    MoveElementCmd,
    MoveElementsDeltaCmd,
    PinElementCmd,
    PlaceRoomAtPointCmd,
    RestoreElementCmd,
    RotateElementsCmd,
    SetToolPrefCmd,
    SetWallJoinDisallowCmd,
    SetWallJoinVariantCmd,
    SplitWallAtCmd,
    TrimElementToReferenceCmd,
    TrimExtendToCornerCmd,
    UnpinElementCmd,
    UpdateAreaCmd,
    UpdateColumnCmd,
    UpdateElementPropertyCmd,
    UpdateMaskingRegionCmd,
    UpdatePlanRegionCmd,
    UpdateReferencePlaneCmd,
    WallJoinVariant,
)
from bim_ai.commands.schedule import (
    ApplyPlanViewTemplateCmd,
    ApplyViewTemplateCmd,
    AreaSchemeCmd,
    CreateDraftingViewCmd,
    CreateSheetCmd,
    CreateViewCalloutCmd,
    CreateViewTemplateCmd,
    CreateWindowLegendViewCmd,
    DeleteViewTemplateCmd,
    MoveViewOnSheetCmd,
    PlaceViewOnSheetCmd,
    PlanViewSubtypeCmd,
    RemoveViewFromSheetCmd,
    SetSheetTitleblockCmd,
    UnbindViewTemplateCmd,
    UpdatePlanViewCropCmd,
    UpdatePlanViewRangeCmd,
    UpdateSheetMetadataCmd,
    UpdateViewTemplateCmd,
    UpsertPlanTagStyleCmd,
    UpsertPlanViewCmd,
    UpsertPlanViewTemplateCmd,
    UpsertRoomVolumeCmd,
    UpsertScheduleCmd,
    UpsertScheduleFiltersCmd,
    UpsertSheetCmd,
    UpsertSheetViewportsCmd,
    UpsertTagDefinitionCmd,
    UpsertViewTemplateCmd,
)
from bim_ai.commands.site import (
    BumpMonitoredRevisionsCmd,
    CreateExternalLinkCmd,
    CreateLinkDxfCmd,
    CreateLinkModelCmd,
    CreateProjectBasePointCmd,
    CreatePropertyLineCmd,
    CreateSurveyPointCmd,
    DeleteExternalLinkCmd,
    DeleteLinkModelCmd,
    DeletePropertyLineCmd,
    MoveProjectBasePointCmd,
    MoveSurveyPointCmd,
    PropertyLineClassificationCmd,
    ReconcileMonitoredElementCmd,
    RotateProjectBasePointCmd,
    RunClashTestCmd,
    SelectionSetRuleCmd,
    UpdateExternalLinkCmd,
    UpdateLinkDxfCmd,
    UpdateLinkModelCmd,
    UpdatePropertyLineCmd,
    UpsertClashTestCmd,
    UpsertSelectionSetCmd,
    UpsertSiteCmd,
)

# --- legacy sibling command modules (untouched by BRT-22) -------------------
from bim_ai.commands_annotations import (
    ClearAutoGeneratedAnnotationsCmd,
    CreateAngularDimensionCmd,
    CreateAnnotationSymbolCmd,
    CreateArcLengthDimensionCmd,
    CreateColorFillLegendCmd,
    CreateDetailComponentCmd,
    CreateDetailGroupCmd,
    CreateDetailLineCmd,
    CreateDetailRegionCmd,
    CreateDiameterDimensionCmd,
    CreateDimensionCmd,
    CreateInsulationAnnotationCmd,
    CreateKeynoteCmd,
    CreateMaterialTagCmd,
    CreateMultiCategoryTagCmd,
    CreateRadialDimensionCmd,
    CreateRepeatingDetailCmd,
    CreateSpanDirectionCmd,
    CreateSpotCoordinateCmd,
    CreateSpotElevationCmd,
    CreateSpotSlopeCmd,
    CreateTextNoteCmd,
    CreateTreadNumberCmd,
    PlaceTagCmd,
)
from bim_ai.commands_late import (
    _ALLOWED_IMAGE_PREFIXES,  # noqa: F401  (legacy private re-export)
    _MAX_SRC_BYTES,  # noqa: F401
    CommitConceptSeedCmd,
    ConsumeConceptSeedCmd,
    CreateConceptSeedCmd,
    CreateDecalCmd,
    CreatePropertyDefinitionCmd,
    CreateScheduleViewCmd,
    DeleteImageUnderlayCmd,
    DrawDetailRegionCmd,
    ImportImageUnderlayCmd,
    MoveImageUnderlayCmd,
    PlaceKitCmd,
    RotateImageUnderlayCmd,
    ScaleImageUnderlayCmd,
    SetElementPropCmd,
    UpdateDetailRegionCmd,
    UpdateKitComponentCmd,
    UpsertSourceViewEvidenceCmd,
)
from bim_ai.commands_output import (
    CreateBrandTemplateCmd,
    CreateFrameCmd,
    CreatePresentationCanvasCmd,
    CreateSavedViewCmd,
    DeleteBrandTemplateCmd,
    DeleteFrameCmd,
    DeleteSavedViewCmd,
    ReorderFrameCmd,
    ReorderViewCmd,
    UpdateBrandTemplateCmd,
    UpdateFrameCmd,
    UpdatePresentationCanvasCmd,
    UpdateSavedViewCmd,
)
from bim_ai.commands_site import (
    CreateGradedRegionCmd,
    CreateToposolidCmd,
    CreateToposolidExcavationCmd,
    CreateToposolidSubdivisionCmd,
    DeleteGradedRegionCmd,
    DeleteToposolidCmd,
    DeleteToposolidExcavationCmd,
    DeleteToposolidSubdivisionCmd,
    ToposolidExcavationCutMode,
    UpdateGradedRegionCmd,
    UpdateToposolidCmd,
    UpdateToposolidExcavationCmd,
    UpdateToposolidSubdivisionCmd,
)

# ``__all__`` is intentionally exhaustive — see BRT-22. The barrel exists so
# legacy importers (``from bim_ai.commands import X``) keep working after we
# moved the per-class definitions into per-domain submodules.
__all__ = [
    # discriminated union
    "Command",
    # documentation
    "AddOptionCmd",
    "AddViewBreakCmd",
    "AssignElementToOptionCmd",
    "ConstructionMetadata",
    "CreateAgentAssumptionCmd",
    "CreateAgentDeviationCmd",
    "CreateBcfTopicCmd",
    "CreateCalloutCmd",
    "CreateConstructionLogisticsCmd",
    "CreateConstructionPackageCmd",
    "CreateElevationViewCmd",
    "CreateIssueFromViolationCmd",
    "CreateOptionSetCmd",
    "CreatePhaseCmd",
    "CreateSectionCutCmd",
    "CreateSunSettingsCmd",
    "DeletePhaseCmd",
    "HideElementInViewCmd",
    "RemoveOptionCmd",
    "RemoveViewBreakCmd",
    "RenamePhaseCmd",
    "ReorderPhaseCmd",
    "SaveViewpointCmd",
    "SetElementConstructionCmd",
    "SetElementDisciplineCmd",
    "SetElementOverrideCmd",
    "SetElementPhaseCmd",
    "SetPrimaryOptionCmd",
    "SetViewLensCmd",
    "SetViewOptionLockCmd",
    "SetViewPhaseCmd",
    "SetViewPhaseFilterCmd",
    "UnhideElementInViewCmd",
    "UpdateIssueStatusCmd",
    "UpdateSunSettingsCmd",
    "UpsertConstructionQaChecklistCmd",
    "UpsertProjectSettingsCmd",
    "UpsertRoomColorSchemeCmd",
    "UpsertValidationRuleCmd",
    # geometry
    "AssignWallDatumConstraintsCmd",
    "AttachWallTopCmd",
    "AttachWallTopToRoofCmd",
    "CreateBalconyCmd",
    "CreateDormerCmd",
    "CreateEdgeProfileRunCmd",
    "CreateFacadeBayCmd",
    "CreateFloorCmd",
    "CreateGridLineCmd",
    "CreateLevelCmd",
    "CreateRailingCmd",
    "CreateRoofCmd",
    "CreateRoofJoinCmd",
    "CreateRoofOpeningCmd",
    "CreateSlabOpeningCmd",
    "CreateSoffitCmd",
    "CreateStairCmd",
    "CreateStructuralFacadeGridCmd",
    "CreateSweepCmd",
    "CreateWallChainCmd",
    "CreateWallCmd",
    "CreateWallOpeningCmd",
    "CreateWallTypeCmd",
    "CreateWintergartenCmd",
    "DetachWallTopCmd",
    "ExtendFloorInsulationCmd",
    "MoveBeamEndpointsCmd",
    "MoveGridLineEndpointsCmd",
    "MoveLevelElevationCmd",
    "MoveWallDeltaCmd",
    "MoveWallEndpointsCmd",
    "SetCurtainPanelOverrideCmd",
    "SetEdgeProfileRunModeCmd",
    "SetRailingBalusterPatternCmd",
    "SetRailingHandrailSupportsCmd",
    "SetStairSubKindCmd",
    "SetWallLeanTaperCmd",
    "SetWallRecessZonesCmd",
    "SetWallStackCmd",
    "UpdateStairTreadsCmd",
    "UpdateWallCmd",
    "UpdateWallOpeningCmd",
    "UpsertFloorTypeCmd",
    "UpsertRoofTypeCmd",
    "UpsertWallTypeCmd",
    "WallChainSegment",
    "WallStackComponentCmd",
    # hosting
    "AssignOpeningFamilyCmd",
    "FamilyCatalogSourceCmd",
    "IndexAssetCmd",
    "InsertDoorOnWallCmd",
    "InsertWindowOnWallCmd",
    "PlaceAssetCmd",
    "PlaceFamilyInstanceCmd",
    "UpdateDoorCmd",
    "UpdateMaterialPbrCmd",
    "UpdateOpeningCleanroomCmd",
    "UpdateWindowCmd",
    "UpsertFamilyTypeCmd",
    # mep
    "CreateCableTrayCmd",
    "CreateDuctCmd",
    "CreateDuctLegendCmd",
    "CreateFixtureCmd",
    "CreateMepEquipmentCmd",
    "CreateMepOpeningRequestCmd",
    "CreateMepTerminalCmd",
    "CreatePipeCmd",
    "CreatePipeLegendCmd",
    "MepSystemCmdType",
    # other
    "AlignElementToReferenceCmd",
    "AreaRuleSetCmd",
    "CreateAreaCmd",
    "CreateBeamCmd",
    "CreateCeilingCmd",
    "CreateColumnCmd",
    "CreateConstraintCmd",
    "CreateJoinGeometryCmd",
    "CreateMaskingRegionCmd",
    "CreateMassCmd",
    "CreatePlanRegionCmd",
    "CreateReferencePlaneCmd",
    "CreateRevisionCloudCmd",
    "CreateRoomOutlineCmd",
    "CreateRoomPolyCmd",
    "CreateRoomRectangleCmd",
    "CreateRoomSeparationCmd",
    "CreateText3dCmd",
    "CreateVoidCutCmd",
    "DeleteAreaCmd",
    "DeleteElementCmd",
    "DeleteElementsCmd",
    "DeleteMaskingRegionCmd",
    "DeletePlanRegionCmd",
    "DeleteReferencePlaneCmd",
    "MaterializeMassToWallsCmd",
    "MirrorAxis",
    "MirrorElementsCmd",
    "MoveAssetDeltaCmd",
    "MoveColumnDeltaCmd",
    "MoveElementCmd",
    "MoveElementsDeltaCmd",
    "PinElementCmd",
    "PlaceRoomAtPointCmd",
    "RestoreElementCmd",
    "RotateElementsCmd",
    "SetToolPrefCmd",
    "SetWallJoinDisallowCmd",
    "SetWallJoinVariantCmd",
    "SplitWallAtCmd",
    "TrimElementToReferenceCmd",
    "TrimExtendToCornerCmd",
    "UnpinElementCmd",
    "UpdateAreaCmd",
    "UpdateColumnCmd",
    "UpdateElementPropertyCmd",
    "UpdateMaskingRegionCmd",
    "UpdatePlanRegionCmd",
    "UpdateReferencePlaneCmd",
    "WallJoinVariant",
    # schedule
    "ApplyPlanViewTemplateCmd",
    "ApplyViewTemplateCmd",
    "AreaSchemeCmd",
    "CreateDraftingViewCmd",
    "CreateSheetCmd",
    "CreateViewCalloutCmd",
    "CreateViewTemplateCmd",
    "CreateWindowLegendViewCmd",
    "DeleteViewTemplateCmd",
    "MoveViewOnSheetCmd",
    "PlaceViewOnSheetCmd",
    "PlanViewSubtypeCmd",
    "RemoveViewFromSheetCmd",
    "SetSheetTitleblockCmd",
    "UnbindViewTemplateCmd",
    "UpdatePlanViewCropCmd",
    "UpdatePlanViewRangeCmd",
    "UpdateSheetMetadataCmd",
    "UpdateViewTemplateCmd",
    "UpsertPlanTagStyleCmd",
    "UpsertPlanViewCmd",
    "UpsertPlanViewTemplateCmd",
    "UpsertRoomVolumeCmd",
    "UpsertScheduleCmd",
    "UpsertScheduleFiltersCmd",
    "UpsertSheetCmd",
    "UpsertSheetViewportsCmd",
    "UpsertTagDefinitionCmd",
    "UpsertViewTemplateCmd",
    # site
    "BumpMonitoredRevisionsCmd",
    "CreateExternalLinkCmd",
    "CreateLinkDxfCmd",
    "CreateLinkModelCmd",
    "CreateProjectBasePointCmd",
    "CreatePropertyLineCmd",
    "CreateSurveyPointCmd",
    "DeleteExternalLinkCmd",
    "DeleteLinkModelCmd",
    "DeletePropertyLineCmd",
    "MoveProjectBasePointCmd",
    "MoveSurveyPointCmd",
    "PropertyLineClassificationCmd",
    "ReconcileMonitoredElementCmd",
    "RotateProjectBasePointCmd",
    "RunClashTestCmd",
    "SelectionSetRuleCmd",
    "UpdateExternalLinkCmd",
    "UpdateLinkDxfCmd",
    "UpdateLinkModelCmd",
    "UpdatePropertyLineCmd",
    "UpsertClashTestCmd",
    "UpsertSelectionSetCmd",
    "UpsertSiteCmd",
    # legacy commands_annotations
    "ClearAutoGeneratedAnnotationsCmd",
    "CreateAngularDimensionCmd",
    "CreateAnnotationSymbolCmd",
    "CreateArcLengthDimensionCmd",
    "CreateColorFillLegendCmd",
    "CreateDetailComponentCmd",
    "CreateDetailGroupCmd",
    "CreateDetailLineCmd",
    "CreateDetailRegionCmd",
    "CreateDiameterDimensionCmd",
    "CreateDimensionCmd",
    "CreateInsulationAnnotationCmd",
    "CreateKeynoteCmd",
    "CreateMaterialTagCmd",
    "CreateMultiCategoryTagCmd",
    "CreateRadialDimensionCmd",
    "CreateRepeatingDetailCmd",
    "CreateSpanDirectionCmd",
    "CreateSpotCoordinateCmd",
    "CreateSpotElevationCmd",
    "CreateSpotSlopeCmd",
    "CreateTextNoteCmd",
    "CreateTreadNumberCmd",
    "PlaceTagCmd",
    # legacy commands_late
    "CommitConceptSeedCmd",
    "ConsumeConceptSeedCmd",
    "CreateConceptSeedCmd",
    "CreateDecalCmd",
    "CreatePropertyDefinitionCmd",
    "CreateScheduleViewCmd",
    "DeleteImageUnderlayCmd",
    "DrawDetailRegionCmd",
    "ImportImageUnderlayCmd",
    "MoveImageUnderlayCmd",
    "PlaceKitCmd",
    "RotateImageUnderlayCmd",
    "ScaleImageUnderlayCmd",
    "SetElementPropCmd",
    "UpdateDetailRegionCmd",
    "UpdateKitComponentCmd",
    "UpsertSourceViewEvidenceCmd",
    # legacy commands_output
    "CreateBrandTemplateCmd",
    "CreateFrameCmd",
    "CreatePresentationCanvasCmd",
    "CreateSavedViewCmd",
    "DeleteBrandTemplateCmd",
    "DeleteFrameCmd",
    "DeleteSavedViewCmd",
    "ReorderFrameCmd",
    "ReorderViewCmd",
    "UpdateBrandTemplateCmd",
    "UpdateFrameCmd",
    "UpdatePresentationCanvasCmd",
    "UpdateSavedViewCmd",
    # legacy commands_site
    "CreateGradedRegionCmd",
    "CreateToposolidCmd",
    "CreateToposolidExcavationCmd",
    "CreateToposolidSubdivisionCmd",
    "DeleteGradedRegionCmd",
    "DeleteToposolidCmd",
    "DeleteToposolidExcavationCmd",
    "DeleteToposolidSubdivisionCmd",
    "ToposolidExcavationCutMode",
    "UpdateGradedRegionCmd",
    "UpdateToposolidCmd",
    "UpdateToposolidExcavationCmd",
    "UpdateToposolidSubdivisionCmd",
]


Command = Annotated[
    CreateLevelCmd
    | CreateWallCmd
    | MoveWallDeltaCmd
    | MoveWallEndpointsCmd
    | MoveBeamEndpointsCmd
    | InsertDoorOnWallCmd
    | InsertWindowOnWallCmd
    | CreateWallChainCmd
    | CreateGridLineCmd
    | MoveGridLineEndpointsCmd
    | CreateDimensionCmd
    | CreateAngularDimensionCmd
    | DeleteElementCmd
    | DeleteElementsCmd
    | RestoreElementCmd
    | CreateRoomOutlineCmd
    | CreateRoomRectangleCmd
    | CreateRoomPolyCmd
    | PlaceRoomAtPointCmd
    | MoveLevelElevationCmd
    | CreateIssueFromViolationCmd
    | UpdateIssueStatusCmd
    | UpdateElementPropertyCmd
    | SaveViewpointCmd
    | UpsertProjectSettingsCmd
    | UpsertRoomColorSchemeCmd
    | CreateWallTypeCmd
    | UpsertWallTypeCmd
    | UpsertFloorTypeCmd
    | UpsertRoofTypeCmd
    | AssignWallDatumConstraintsCmd
    | CreateFloorCmd
    | CreateRoofCmd
    | ExtendFloorInsulationCmd
    | AttachWallTopToRoofCmd
    | AttachWallTopCmd
    | DetachWallTopCmd
    | CreateStairCmd
    | SetStairSubKindCmd
    | UpdateStairTreadsCmd
    | CreateSlabOpeningCmd
    | CreateRoofOpeningCmd
    | CreateWallOpeningCmd
    | UpdateWallOpeningCmd
    | CreateRailingCmd
    | CreateBalconyCmd
    | CreateFacadeBayCmd
    | CreateStructuralFacadeGridCmd
    | CreateWintergartenCmd
    | UpsertFamilyTypeCmd
    | AssignOpeningFamilyCmd
    | UpdateOpeningCleanroomCmd
    | CreateRoomSeparationCmd
    | CreatePlanRegionCmd
    | UpdatePlanRegionCmd
    | DeletePlanRegionCmd
    | UpsertTagDefinitionCmd
    | CreateJoinGeometryCmd
    | CreateSectionCutCmd
    | UpsertSourceViewEvidenceCmd
    | UpsertViewTemplateCmd
    | UpsertPlanViewTemplateCmd
    | ApplyPlanViewTemplateCmd
    | UpdatePlanViewCropCmd
    | UpdatePlanViewRangeCmd
    | UpsertSheetCmd
    | UpsertSheetViewportsCmd
    | UpsertScheduleCmd
    | UpsertScheduleFiltersCmd
    | UpsertRoomVolumeCmd
    | UpsertPlanTagStyleCmd
    | UpsertPlanViewCmd
    | CreateCalloutCmd
    | CreateBcfTopicCmd
    | CreateAgentAssumptionCmd
    | CreateAgentDeviationCmd
    | UpsertValidationRuleCmd
    | UpsertSiteCmd
    | CreateText3dCmd
    | MirrorElementsCmd
    | PinElementCmd
    | UnpinElementCmd
    | SetCurtainPanelOverrideCmd
    | CreateProjectBasePointCmd
    | MoveProjectBasePointCmd
    | RotateProjectBasePointCmd
    | CreateSurveyPointCmd
    | MoveSurveyPointCmd
    | CreateElevationViewCmd
    | CreateLinkModelCmd
    | UpdateLinkModelCmd
    | DeleteLinkModelCmd
    | CreateLinkDxfCmd
    | UpdateLinkDxfCmd
    | CreateExternalLinkCmd
    | UpdateExternalLinkCmd
    | DeleteExternalLinkCmd
    | UpsertSelectionSetCmd
    | UpsertClashTestCmd
    | RunClashTestCmd
    | BumpMonitoredRevisionsCmd
    | ReconcileMonitoredElementCmd
    | PlaceTagCmd
    | ClearAutoGeneratedAnnotationsCmd
    | CreateDetailLineCmd
    | CreateDetailRegionCmd
    | CreateSpotElevationCmd
    | CreateSpotCoordinateCmd
    | CreateSpotSlopeCmd
    | CreateInsulationAnnotationCmd
    | CreateRadialDimensionCmd
    | CreateDiameterDimensionCmd
    | CreateArcLengthDimensionCmd
    | CreateMaterialTagCmd
    | CreateMultiCategoryTagCmd
    | CreateTreadNumberCmd
    | CreateKeynoteCmd
    | CreateSpanDirectionCmd
    | CreateDetailComponentCmd
    | CreateRepeatingDetailCmd
    | CreateDetailGroupCmd
    | CreateColorFillLegendCmd
    | CreateTextNoteCmd
    | CreateReferencePlaneCmd
    | UpdateReferencePlaneCmd
    | DeleteReferencePlaneCmd
    | CreatePropertyLineCmd
    | UpdatePropertyLineCmd
    | DeletePropertyLineCmd
    | CreateSweepCmd
    | CreateDormerCmd
    | CreateRoofJoinCmd
    | CreateEdgeProfileRunCmd
    | SetEdgeProfileRunModeCmd
    | CreateSoffitCmd
    | SetWallRecessZonesCmd
    | CreateAnnotationSymbolCmd
    | CreateAreaCmd
    | UpdateAreaCmd
    | DeleteAreaCmd
    | CreateMaskingRegionCmd
    | UpdateMaskingRegionCmd
    | DeleteMaskingRegionCmd
    | CreateRevisionCloudCmd
    | SplitWallAtCmd
    | AlignElementToReferenceCmd
    | TrimElementToReferenceCmd
    | TrimExtendToCornerCmd
    | SetWallJoinVariantCmd
    | SetWallJoinDisallowCmd
    | CreateColumnCmd
    | CreateBeamCmd
    | CreateCeilingCmd
    | CreateMassCmd
    | MaterializeMassToWallsCmd
    | CreateVoidCutCmd
    | CreateConstraintCmd
    | CreatePhaseCmd
    | RenamePhaseCmd
    | ReorderPhaseCmd
    | DeletePhaseCmd
    | SetElementPhaseCmd
    | SetElementDisciplineCmd
    | SetViewPhaseCmd
    | SetViewPhaseFilterCmd
    | SetViewLensCmd
    | SetElementConstructionCmd
    | CreateConstructionPackageCmd
    | CreateConstructionLogisticsCmd
    | UpsertConstructionQaChecklistCmd
    | CreateSunSettingsCmd
    | UpdateSunSettingsCmd
    | MoveElementCmd
    | SetWallStackCmd
    | SetWallLeanTaperCmd
    | SetRailingBalusterPatternCmd
    | SetRailingHandrailSupportsCmd
    | CreateOptionSetCmd
    | AddOptionCmd
    | RemoveOptionCmd
    | SetPrimaryOptionCmd
    | AssignElementToOptionCmd
    | SetViewOptionLockCmd
    | CreateSheetCmd
    | PlaceViewOnSheetCmd
    | MoveViewOnSheetCmd
    | RemoveViewFromSheetCmd
    | SetSheetTitleblockCmd
    | UpdateSheetMetadataCmd
    | CreateWindowLegendViewCmd
    | CreateDraftingViewCmd
    | CreateViewCalloutCmd
    | SetElementOverrideCmd
    | AddViewBreakCmd
    | RemoveViewBreakCmd
    | HideElementInViewCmd
    | UnhideElementInViewCmd
    | CreateViewTemplateCmd
    | UpdateViewTemplateCmd
    | ApplyViewTemplateCmd
    | UnbindViewTemplateCmd
    | DeleteViewTemplateCmd
    | CreateToposolidCmd
    | UpdateToposolidCmd
    | DeleteToposolidCmd
    | CreateToposolidSubdivisionCmd
    | UpdateToposolidSubdivisionCmd
    | DeleteToposolidSubdivisionCmd
    | CreateGradedRegionCmd
    | UpdateGradedRegionCmd
    | DeleteGradedRegionCmd
    | CreateToposolidExcavationCmd
    | UpdateToposolidExcavationCmd
    | DeleteToposolidExcavationCmd
    | IndexAssetCmd
    | PlaceAssetCmd
    | PlaceFamilyInstanceCmd
    | MoveAssetDeltaCmd
    | MoveColumnDeltaCmd
    | MoveElementsDeltaCmd
    | RotateElementsCmd
    | SetToolPrefCmd
    | UpdateWallCmd
    | UpdateDoorCmd
    | UpdateWindowCmd
    | UpdateColumnCmd
    | UpdateMaterialPbrCmd
    | CreateDecalCmd
    | CreatePropertyDefinitionCmd
    | SetElementPropCmd
    | CreateScheduleViewCmd
    | DrawDetailRegionCmd
    | UpdateDetailRegionCmd
    | PlaceKitCmd
    | UpdateKitComponentCmd
    | ImportImageUnderlayCmd
    | MoveImageUnderlayCmd
    | ScaleImageUnderlayCmd
    | RotateImageUnderlayCmd
    | DeleteImageUnderlayCmd
    | CreateConceptSeedCmd
    | CommitConceptSeedCmd
    | ConsumeConceptSeedCmd
    | CreatePresentationCanvasCmd
    | UpdatePresentationCanvasCmd
    | CreateFrameCmd
    | UpdateFrameCmd
    | DeleteFrameCmd
    | ReorderFrameCmd
    | CreateSavedViewCmd
    | UpdateSavedViewCmd
    | DeleteSavedViewCmd
    | CreateBrandTemplateCmd
    | UpdateBrandTemplateCmd
    | DeleteBrandTemplateCmd
    | ReorderViewCmd
    | CreatePipeCmd
    | CreateDuctCmd
    | CreateCableTrayCmd
    | CreateMepEquipmentCmd
    | CreateFixtureCmd
    | CreateMepTerminalCmd
    | CreateMepOpeningRequestCmd
    | CreatePipeLegendCmd
    | CreateDuctLegendCmd,
    Field(discriminator="type"),
]
