import { useState, useMemo, useCallback } from 'react';
import type { ComponentType } from 'react';
import type { BimIcon, BimIconHifiProps } from '@bim-ai/icons';
import {
  WallHifi,
  DoorHifi,
  WindowHifi,
  FloorHifi,
  RoofHifi,
  StairHifi,
  RailingHifi,
  RoomHifi,
  DimensionHifi,
  SectionHifi,
  TagHifi,
  CurtainWallHifi,
  ColumnHifi,
  BeamHifi,
  CeilingHifi,
  OpeningHifi,
  ShaftOpeningHifi,
  RampHifi,
  MassHifi,
  CurtainPanelHifi,
  MullionHifi,
  SkyLightHifi,
  PartitionHifi,
  WallSweepHifi,
  WallRevealHifi,
  ComponentHifi,
  RoofExtrusionHifi,
  RoofSoffitHifi,
  FasciaHifi,
  GutterHifi,
  CurtainSystemHifi,
  CurtainGridHifi,
  VerticalOpeningHifi,
  DormerOpeningHifi,
  FaceOpeningHifi,
  RoomSeparatorHifi,
  AreaBoundaryHifi,
  ReferencePlaneHifi,
  WorkPlaneHifi,
  ModelLineHifi,
  ModelTextHifi,
  StairPathHifi,
  FoundationHifi,
  StripFootingHifi,
  TrussHifi,
  BraceHifi,
  RebarHifi,
  StructuralConnectionHifi,
  BeamSystemHifi,
  FoundationSlabHifi,
  SlabEdgeHifi,
  AreaReinforcementHifi,
  PathReinforcementHifi,
  FabricSheetHifi,
  ShearStudHifi,
  AnchorHifi,
  BoltHifi,
  WeldHifi,
  AnalyticalNodeHifi,
  StructuralLoadHifi,
  BoundaryConditionHifi,
  DuctRectHifi,
  DuctRoundHifi,
  PipeHifi,
  CableTrayHifi,
  ConduitHifi,
  MechanicalEquipmentHifi,
  PlumbingFixtureHifi,
  LightingFixtureHifi,
  ElectricalPanelHifi,
  FireSprinklerHifi,
  DiffuserHifi,
  MepSpaceHifi,
  FlexDuctHifi,
  DuctFittingHifi,
  DuctAccessoryHifi,
  DuctInsulationHifi,
  DuctLiningHifi,
  FlexPipeHifi,
  PipeFittingHifi,
  PipeAccessoryHifi,
  PipeInsulationHifi,
  CableTrayFittingHifi,
  ConduitFittingHifi,
  ElectricalWireHifi,
  SwitchSystemHifi,
  LightingSwitchHifi,
  CommunicationDeviceHifi,
  FireAlarmDeviceHifi,
  DataDeviceHifi,
  NurseCallHifi,
  SecurityDeviceHifi,
  HVACZoneHifi,
  PanelScheduleHifi,
  DuctSystemHifi,
  PipingSystemHifi,
  ValveHifi,
  PlanViewHifi,
  SectionViewHifi,
  ElevationViewHifi,
  OrbitViewHifi,
  SheetHifi,
  ScheduleViewHifi,
  CalloutHifi,
  ViewpointHifi,
  SectionBoxHifi,
  GridLineHifi,
  LevelHifi,
  DetailLineHifi,
  ReflectedCeilingPlanHifi,
  StructuralPlanHifi,
  AreaPlanHifi,
  DetailViewHifi,
  DraftingViewHifi,
  WalkthroughHifi,
  LegendHifi,
  SheetListHifi,
  NoteBlockHifi,
  ViewListHifi,
  PanelScheduleViewHifi,
  GraphicalColumnScheduleHifi,
  ViewReferenceHifi,
  RevisionCloudHifi,
  BreakLineHifi,
  CentreLineHifi,
  KeynoteHifi,
  MatchLineHifi,
  ScaleBarHifi,
  AreaLabelHifi,
  SpotElevationHifi,
  SlopeArrowHifi,
  AngularDimensionHifi,
  RadialDimensionHifi,
  ArcLengthDimensionHifi,
  OrdinalDimensionHifi,
  SpotCoordinateHifi,
  ElevationTagHifi,
  FilledRegionHifi,
  MaskingRegionHifi,
  DetailComponentHifi,
  RepeatingDetailHifi,
  InsulationAnnotationHifi,
  TextAnnotationHifi,
  MultiCategoryTagHifi,
  MaterialTagHifi,
  RoomTagHifi,
  SpaceTagHifi,
  AreaTagHifi,
  StairTagHifi,
  SymbolHifi,
  StairPathAnnotationHifi,
  ReferencePointHifi,
  TopoHifi,
  PropertyLineHifi,
  ParkingSpaceHifi,
  PlantingHifi,
  RoadHifi,
  RetainingWallHifi,
  NorthArrowHifi,
  FamilyHifi,
  FamilyTypeHifi,
  GroupHifi,
  AssemblyHifi,
  LinkedModelHifi,
  MaterialHifi,
  WallLayerHifi,
  PhaseHifi,
  IssueHifi,
  ClashHifi,
  ValidationRuleHifi,
  DeviationHifi,
  WorksetHifi,
  DesignOptionHifi,
  RevisionHifi,
  RFIHifi,
  SubmittalHifi,
  PointCloudHifi,
  DigitalTwinHifi,
  SyncHifi,
  TransmittalHifi,
  IFCHifi,
  LODHifi,
  QuantityTakeoffHifi,
  EnergyModelHifi,
  ScopeBoxHifi,
  MoveHifi,
  CopyHifi,
  RotateHifi,
  ScaleHifi,
  OffsetHifi,
  DeleteHifi,
  MirrorHifi,
  ArrayLinearHifi,
  ArrayRadialHifi,
  AlignHifi,
  SplitHifi,
  TrimExtendHifi,
  VoidHifi,
  PinHifi,
  UnpinHifi,
  JoinGeometryHifi,
  UnjoinGeometryHifi,
  SwitchJoinOrderHifi,
  WallJoinsHifi,
  PaintMaterialHifi,
  MeasureBetweenHifi,
  MeasureAlongHifi,
  UngroupHifi,
  ReloadLatestHifi,
  EditingRequestHifi,
  CopyMonitorHifi,
  CoordinationReviewHifi,
  PurgeUnusedHifi,
  TransferProjectStandardsHifi,
  ProjectInfoHifi,
  ProjectParametersHifi,
  SharedParametersHifi,
  ObjectStylesHifi,
  WallIcon,
  DoorIcon,
  WindowIcon,
  FloorIcon,
  RoofIcon,
  StairIcon,
  RailingIcon,
  RoomIcon,
  DimensionIcon,
  SectionIcon,
  TagIcon,
  CurtainWallIcon,
  ColumnIcon,
  BeamIcon,
  CeilingIcon,
  OpeningIcon,
  ShaftOpeningIcon,
  RampIcon,
  MassIcon,
  CurtainPanelIcon,
  MullionIcon,
  SkyLightIcon,
  PartitionIcon,
  WallSweepIcon,
  WallRevealIcon,
  ComponentIcon,
  RoofExtrusionIcon,
  RoofSoffitIcon,
  FasciaIcon,
  GutterIcon,
  CurtainSystemIcon,
  CurtainGridIcon,
  VerticalOpeningIcon,
  DormerOpeningIcon,
  FaceOpeningIcon,
  RoomSeparatorIcon,
  AreaBoundaryIcon,
  ReferencePlaneIcon,
  WorkPlaneIcon,
  ModelLineIcon,
  ModelTextIcon,
  StairPathIcon,
  FoundationIcon,
  StripFootingIcon,
  TrussIcon,
  BraceIcon,
  RebarIcon,
  StructuralConnectionIcon,
  BeamSystemIcon,
  FoundationSlabIcon,
  SlabEdgeIcon,
  AreaReinforcementIcon,
  PathReinforcementIcon,
  FabricSheetIcon,
  ShearStudIcon,
  AnchorIcon,
  BoltIcon,
  WeldIcon,
  AnalyticalNodeIcon,
  StructuralLoadIcon,
  BoundaryConditionIcon,
  DuctRectIcon,
  DuctRoundIcon,
  PipeIcon,
  CableTrayIcon,
  ConduitIcon,
  MechanicalEquipmentIcon,
  PlumbingFixtureIcon,
  LightingFixtureIcon,
  ElectricalPanelIcon,
  FireSprinklerIcon,
  DiffuserIcon,
  MepSpaceIcon,
  FlexDuctIcon,
  DuctFittingIcon,
  DuctAccessoryIcon,
  DuctInsulationIcon,
  DuctLiningIcon,
  FlexPipeIcon,
  PipeFittingIcon,
  PipeAccessoryIcon,
  PipeInsulationIcon,
  CableTrayFittingIcon,
  ConduitFittingIcon,
  ElectricalWireIcon,
  SwitchSystemIcon,
  LightingSwitchIcon,
  CommunicationDeviceIcon,
  FireAlarmDeviceIcon,
  DataDeviceIcon,
  NurseCallIcon,
  SecurityDeviceIcon,
  HVACZoneIcon,
  PanelScheduleIcon,
  DuctSystemIcon,
  PipingSystemIcon,
  ValveIcon,
  PlanViewIcon,
  SectionViewIcon,
  ElevationViewIcon,
  OrbitViewIcon,
  SheetIcon,
  ScheduleViewIcon,
  CalloutIcon,
  ViewpointIcon,
  SectionBoxIcon,
  GridLineIcon,
  LevelIcon,
  DetailLineIcon,
  ReflectedCeilingPlanIcon,
  StructuralPlanIcon,
  AreaPlanIcon,
  DetailViewIcon,
  DraftingViewIcon,
  WalkthroughIcon,
  LegendIcon,
  SheetListIcon,
  NoteBlockIcon,
  ViewListIcon,
  PanelScheduleViewIcon,
  GraphicalColumnScheduleIcon,
  ViewReferenceIcon,
  RevisionCloudIcon,
  BreakLineIcon,
  CentreLineIcon,
  KeynoteIcon,
  MatchLineIcon,
  ScaleBarIcon,
  AreaLabelIcon,
  SpotElevationIcon,
  SlopeArrowIcon,
  AngularDimensionIcon,
  RadialDimensionIcon,
  ArcLengthDimensionIcon,
  OrdinalDimensionIcon,
  SpotCoordinateIcon,
  ElevationTagIcon,
  FilledRegionIcon,
  MaskingRegionIcon,
  DetailComponentIcon,
  RepeatingDetailIcon,
  InsulationAnnotationIcon,
  TextAnnotationIcon,
  MultiCategoryTagIcon,
  MaterialTagIcon,
  RoomTagIcon,
  SpaceTagIcon,
  AreaTagIcon,
  StairTagIcon,
  SymbolIcon,
  StairPathAnnotationIcon,
  ReferencePointIcon,
  TopoIcon,
  PropertyLineIcon,
  ParkingSpaceIcon,
  PlantingIcon,
  RoadIcon,
  RetainingWallIcon,
  NorthArrowIcon,
  FamilyIcon,
  FamilyTypeIcon,
  GroupIcon,
  AssemblyIcon,
  LinkedModelIcon,
  MaterialIcon,
  WallLayerIcon,
  PhaseIcon,
  IssueIcon,
  ClashIcon,
  ValidationRuleIcon,
  DeviationIcon,
  WorksetIcon,
  DesignOptionIcon,
  RevisionIcon,
  RFIIcon,
  SubmittalIcon,
  PointCloudIcon,
  DigitalTwinIcon,
  SyncIcon,
  TransmittalIcon,
  IFCIcon,
  LODIcon,
  QuantityTakeoffIcon,
  EnergyModelIcon,
  ScopeBoxIcon,
  MirrorIcon,
  ArrayLinearIcon,
  ArrayRadialIcon,
  AlignIcon,
  SplitIcon,
  TrimExtendIcon,
  VoidIcon,
  PinIcon,
  UnpinIcon,
  MoveIcon,
  CopyIcon,
  RotateIcon,
  ScaleIcon,
  OffsetIcon,
  DeleteIcon,
  JoinGeometryIcon,
  UnjoinGeometryIcon,
  SwitchJoinOrderIcon,
  WallJoinsIcon,
  PaintMaterialIcon,
  MeasureBetweenIcon,
  MeasureAlongIcon,
  UngroupIcon,
  ReloadLatestIcon,
  EditingRequestIcon,
  CopyMonitorIcon,
  CoordinationReviewIcon,
  PurgeUnusedIcon,
  TransferProjectStandardsIcon,
  ProjectInfoIcon,
  ProjectParametersIcon,
  SharedParametersIcon,
  ObjectStylesIcon,
} from '@bim-ai/icons';

type ColorScheme = 'mono' | 'accent' | 'color';

/* eslint-disable bim-ai/no-hex-in-chrome -- gallery demo: these ARE the token value definitions */
const COLOR_VARS: Record<ColorScheme, React.CSSProperties> = {
  mono: {},
  accent: {
    '--hi-concrete': '#d97706',
    '--hi-concrete-op': '0.14',
    '--hi-glass': '#d97706',
    '--hi-glass-op': '0.22',
    '--hi-steel': '#d97706',
    '--hi-steel-op': '0.18',
    '--hi-finish': '#d97706',
    '--hi-finish-op': '0.09',
    '--hi-leaf': '#b45309',
    '--hi-roof': '#d97706',
    '--hi-roof-op': '0.13',
    '--hi-room': '#d97706',
    '--hi-room-op': '0.07',
  } as React.CSSProperties,
  color: {
    '--hi-concrete': '#c8c4be',
    '--hi-concrete-op': '0.45',
    '--hi-glass': '#7dd3fc',
    '--hi-glass-op': '0.5',
    '--hi-steel': '#94a3b8',
    '--hi-steel-op': '0.4',
    '--hi-finish': '#f0ead8',
    '--hi-finish-op': '0.85',
    '--hi-leaf': '#a16207',
    '--hi-roof': '#f87171',
    '--hi-roof-op': '0.38',
    '--hi-room': '#fef3c7',
    '--hi-room-op': '0.5',
  } as React.CSSProperties,
};
/* eslint-enable bim-ai/no-hex-in-chrome */

type PairedEntry = {
  name: string;
  regularExport: string;
  Regular: BimIcon;
  hifiExport: string;
  Hifi: ComponentType<BimIconHifiProps>;
};

type Section = { label: string; icons: PairedEntry[] };

function p(
  name: string,
  regularExport: string,
  Regular: BimIcon,
  hifiExport: string,
  Hifi: ComponentType<BimIconHifiProps>,
): PairedEntry {
  return { name, regularExport, Regular, hifiExport, Hifi };
}

const SECTIONS: Section[] = [
  {
    label: 'Drawing tools',
    icons: [
      p('Wall', 'WallIcon', WallIcon, 'WallHifi', WallHifi),
      p('Door', 'DoorIcon', DoorIcon, 'DoorHifi', DoorHifi),
      p('Window', 'WindowIcon', WindowIcon, 'WindowHifi', WindowHifi),
      p('Floor', 'FloorIcon', FloorIcon, 'FloorHifi', FloorHifi),
      p('Roof', 'RoofIcon', RoofIcon, 'RoofHifi', RoofHifi),
      p('Stair', 'StairIcon', StairIcon, 'StairHifi', StairHifi),
      p('Railing', 'RailingIcon', RailingIcon, 'RailingHifi', RailingHifi),
      p('Room', 'RoomIcon', RoomIcon, 'RoomHifi', RoomHifi),
      p('Dimension', 'DimensionIcon', DimensionIcon, 'DimensionHifi', DimensionHifi),
      p('Section', 'SectionIcon', SectionIcon, 'SectionHifi', SectionHifi),
      p('Tag', 'TagIcon', TagIcon, 'TagHifi', TagHifi),
      p('Curtain wall', 'CurtainWallIcon', CurtainWallIcon, 'CurtainWallHifi', CurtainWallHifi),
      p('Column', 'ColumnIcon', ColumnIcon, 'ColumnHifi', ColumnHifi),
      p('Beam', 'BeamIcon', BeamIcon, 'BeamHifi', BeamHifi),
    ],
  },
  {
    label: 'Architectural',
    icons: [
      p('Ceiling', 'CeilingIcon', CeilingIcon, 'CeilingHifi', CeilingHifi),
      p('Opening', 'OpeningIcon', OpeningIcon, 'OpeningHifi', OpeningHifi),
      p(
        'Shaft opening',
        'ShaftOpeningIcon',
        ShaftOpeningIcon,
        'ShaftOpeningHifi',
        ShaftOpeningHifi,
      ),
      p('Ramp', 'RampIcon', RampIcon, 'RampHifi', RampHifi),
      p('Mass', 'MassIcon', MassIcon, 'MassHifi', MassHifi),
      p(
        'Curtain panel',
        'CurtainPanelIcon',
        CurtainPanelIcon,
        'CurtainPanelHifi',
        CurtainPanelHifi,
      ),
      p('Mullion', 'MullionIcon', MullionIcon, 'MullionHifi', MullionHifi),
      p('Skylight', 'SkyLightIcon', SkyLightIcon, 'SkyLightHifi', SkyLightHifi),
      p('Partition', 'PartitionIcon', PartitionIcon, 'PartitionHifi', PartitionHifi),
      p('Wall sweep', 'WallSweepIcon', WallSweepIcon, 'WallSweepHifi', WallSweepHifi),
      p('Wall reveal', 'WallRevealIcon', WallRevealIcon, 'WallRevealHifi', WallRevealHifi),
      p('Component', 'ComponentIcon', ComponentIcon, 'ComponentHifi', ComponentHifi),
      p(
        'Roof extrusion',
        'RoofExtrusionIcon',
        RoofExtrusionIcon,
        'RoofExtrusionHifi',
        RoofExtrusionHifi,
      ),
      p('Roof soffit', 'RoofSoffitIcon', RoofSoffitIcon, 'RoofSoffitHifi', RoofSoffitHifi),
      p('Fascia', 'FasciaIcon', FasciaIcon, 'FasciaHifi', FasciaHifi),
      p('Gutter', 'GutterIcon', GutterIcon, 'GutterHifi', GutterHifi),
      p(
        'Curtain system',
        'CurtainSystemIcon',
        CurtainSystemIcon,
        'CurtainSystemHifi',
        CurtainSystemHifi,
      ),
      p('Curtain grid', 'CurtainGridIcon', CurtainGridIcon, 'CurtainGridHifi', CurtainGridHifi),
      p(
        'Vertical opening',
        'VerticalOpeningIcon',
        VerticalOpeningIcon,
        'VerticalOpeningHifi',
        VerticalOpeningHifi,
      ),
      p(
        'Dormer opening',
        'DormerOpeningIcon',
        DormerOpeningIcon,
        'DormerOpeningHifi',
        DormerOpeningHifi,
      ),
      p('Face opening', 'FaceOpeningIcon', FaceOpeningIcon, 'FaceOpeningHifi', FaceOpeningHifi),
      p(
        'Room separator',
        'RoomSeparatorIcon',
        RoomSeparatorIcon,
        'RoomSeparatorHifi',
        RoomSeparatorHifi,
      ),
      p(
        'Area boundary',
        'AreaBoundaryIcon',
        AreaBoundaryIcon,
        'AreaBoundaryHifi',
        AreaBoundaryHifi,
      ),
      p(
        'Reference plane',
        'ReferencePlaneIcon',
        ReferencePlaneIcon,
        'ReferencePlaneHifi',
        ReferencePlaneHifi,
      ),
      p('Work plane', 'WorkPlaneIcon', WorkPlaneIcon, 'WorkPlaneHifi', WorkPlaneHifi),
      p('Model line', 'ModelLineIcon', ModelLineIcon, 'ModelLineHifi', ModelLineHifi),
      p('Model text', 'ModelTextIcon', ModelTextIcon, 'ModelTextHifi', ModelTextHifi),
      p('Stair path', 'StairPathIcon', StairPathIcon, 'StairPathHifi', StairPathHifi),
    ],
  },
  {
    label: 'Structural',
    icons: [
      p('Foundation', 'FoundationIcon', FoundationIcon, 'FoundationHifi', FoundationHifi),
      p(
        'Strip footing',
        'StripFootingIcon',
        StripFootingIcon,
        'StripFootingHifi',
        StripFootingHifi,
      ),
      p('Truss', 'TrussIcon', TrussIcon, 'TrussHifi', TrussHifi),
      p('Brace', 'BraceIcon', BraceIcon, 'BraceHifi', BraceHifi),
      p('Rebar', 'RebarIcon', RebarIcon, 'RebarHifi', RebarHifi),
      p(
        'Struct. connection',
        'StructuralConnectionIcon',
        StructuralConnectionIcon,
        'StructuralConnectionHifi',
        StructuralConnectionHifi,
      ),
      p('Beam system', 'BeamSystemIcon', BeamSystemIcon, 'BeamSystemHifi', BeamSystemHifi),
      p(
        'Foundation slab',
        'FoundationSlabIcon',
        FoundationSlabIcon,
        'FoundationSlabHifi',
        FoundationSlabHifi,
      ),
      p('Slab edge', 'SlabEdgeIcon', SlabEdgeIcon, 'SlabEdgeHifi', SlabEdgeHifi),
      p(
        'Area reinforcement',
        'AreaReinforcementIcon',
        AreaReinforcementIcon,
        'AreaReinforcementHifi',
        AreaReinforcementHifi,
      ),
      p(
        'Path reinforcement',
        'PathReinforcementIcon',
        PathReinforcementIcon,
        'PathReinforcementHifi',
        PathReinforcementHifi,
      ),
      p('Fabric sheet', 'FabricSheetIcon', FabricSheetIcon, 'FabricSheetHifi', FabricSheetHifi),
      p('Shear stud', 'ShearStudIcon', ShearStudIcon, 'ShearStudHifi', ShearStudHifi),
      p('Anchor', 'AnchorIcon', AnchorIcon, 'AnchorHifi', AnchorHifi),
      p('Bolt', 'BoltIcon', BoltIcon, 'BoltHifi', BoltHifi),
      p('Weld', 'WeldIcon', WeldIcon, 'WeldHifi', WeldHifi),
      p(
        'Analytical node',
        'AnalyticalNodeIcon',
        AnalyticalNodeIcon,
        'AnalyticalNodeHifi',
        AnalyticalNodeHifi,
      ),
      p(
        'Structural load',
        'StructuralLoadIcon',
        StructuralLoadIcon,
        'StructuralLoadHifi',
        StructuralLoadHifi,
      ),
      p(
        'Boundary condition',
        'BoundaryConditionIcon',
        BoundaryConditionIcon,
        'BoundaryConditionHifi',
        BoundaryConditionHifi,
      ),
    ],
  },
  {
    label: 'MEP',
    icons: [
      p('Duct (rect)', 'DuctRectIcon', DuctRectIcon, 'DuctRectHifi', DuctRectHifi),
      p('Duct (round)', 'DuctRoundIcon', DuctRoundIcon, 'DuctRoundHifi', DuctRoundHifi),
      p('Pipe', 'PipeIcon', PipeIcon, 'PipeHifi', PipeHifi),
      p('Cable tray', 'CableTrayIcon', CableTrayIcon, 'CableTrayHifi', CableTrayHifi),
      p('Conduit', 'ConduitIcon', ConduitIcon, 'ConduitHifi', ConduitHifi),
      p(
        'Mech. equipment',
        'MechanicalEquipmentIcon',
        MechanicalEquipmentIcon,
        'MechanicalEquipmentHifi',
        MechanicalEquipmentHifi,
      ),
      p(
        'Plumbing fixture',
        'PlumbingFixtureIcon',
        PlumbingFixtureIcon,
        'PlumbingFixtureHifi',
        PlumbingFixtureHifi,
      ),
      p(
        'Lighting fixture',
        'LightingFixtureIcon',
        LightingFixtureIcon,
        'LightingFixtureHifi',
        LightingFixtureHifi,
      ),
      p(
        'Electrical panel',
        'ElectricalPanelIcon',
        ElectricalPanelIcon,
        'ElectricalPanelHifi',
        ElectricalPanelHifi,
      ),
      p(
        'Fire sprinkler',
        'FireSprinklerIcon',
        FireSprinklerIcon,
        'FireSprinklerHifi',
        FireSprinklerHifi,
      ),
      p('Diffuser', 'DiffuserIcon', DiffuserIcon, 'DiffuserHifi', DiffuserHifi),
      p('MEP space', 'MepSpaceIcon', MepSpaceIcon, 'MepSpaceHifi', MepSpaceHifi),
      p('Flex duct', 'FlexDuctIcon', FlexDuctIcon, 'FlexDuctHifi', FlexDuctHifi),
      p('Duct fitting', 'DuctFittingIcon', DuctFittingIcon, 'DuctFittingHifi', DuctFittingHifi),
      p(
        'Duct accessory',
        'DuctAccessoryIcon',
        DuctAccessoryIcon,
        'DuctAccessoryHifi',
        DuctAccessoryHifi,
      ),
      p(
        'Duct insulation',
        'DuctInsulationIcon',
        DuctInsulationIcon,
        'DuctInsulationHifi',
        DuctInsulationHifi,
      ),
      p('Duct lining', 'DuctLiningIcon', DuctLiningIcon, 'DuctLiningHifi', DuctLiningHifi),
      p('Flex pipe', 'FlexPipeIcon', FlexPipeIcon, 'FlexPipeHifi', FlexPipeHifi),
      p('Pipe fitting', 'PipeFittingIcon', PipeFittingIcon, 'PipeFittingHifi', PipeFittingHifi),
      p(
        'Pipe accessory',
        'PipeAccessoryIcon',
        PipeAccessoryIcon,
        'PipeAccessoryHifi',
        PipeAccessoryHifi,
      ),
      p(
        'Pipe insulation',
        'PipeInsulationIcon',
        PipeInsulationIcon,
        'PipeInsulationHifi',
        PipeInsulationHifi,
      ),
      p(
        'Cable tray fitting',
        'CableTrayFittingIcon',
        CableTrayFittingIcon,
        'CableTrayFittingHifi',
        CableTrayFittingHifi,
      ),
      p(
        'Conduit fitting',
        'ConduitFittingIcon',
        ConduitFittingIcon,
        'ConduitFittingHifi',
        ConduitFittingHifi,
      ),
      p(
        'Electrical wire',
        'ElectricalWireIcon',
        ElectricalWireIcon,
        'ElectricalWireHifi',
        ElectricalWireHifi,
      ),
      p(
        'Switch system',
        'SwitchSystemIcon',
        SwitchSystemIcon,
        'SwitchSystemHifi',
        SwitchSystemHifi,
      ),
      p(
        'Lighting switch',
        'LightingSwitchIcon',
        LightingSwitchIcon,
        'LightingSwitchHifi',
        LightingSwitchHifi,
      ),
      p(
        'Comms device',
        'CommunicationDeviceIcon',
        CommunicationDeviceIcon,
        'CommunicationDeviceHifi',
        CommunicationDeviceHifi,
      ),
      p(
        'Fire alarm',
        'FireAlarmDeviceIcon',
        FireAlarmDeviceIcon,
        'FireAlarmDeviceHifi',
        FireAlarmDeviceHifi,
      ),
      p('Data device', 'DataDeviceIcon', DataDeviceIcon, 'DataDeviceHifi', DataDeviceHifi),
      p('Nurse call', 'NurseCallIcon', NurseCallIcon, 'NurseCallHifi', NurseCallHifi),
      p(
        'Security device',
        'SecurityDeviceIcon',
        SecurityDeviceIcon,
        'SecurityDeviceHifi',
        SecurityDeviceHifi,
      ),
      p('HVAC zone', 'HVACZoneIcon', HVACZoneIcon, 'HVACZoneHifi', HVACZoneHifi),
      p(
        'Panel schedule',
        'PanelScheduleIcon',
        PanelScheduleIcon,
        'PanelScheduleHifi',
        PanelScheduleHifi,
      ),
      p('Duct system', 'DuctSystemIcon', DuctSystemIcon, 'DuctSystemHifi', DuctSystemHifi),
      p(
        'Piping system',
        'PipingSystemIcon',
        PipingSystemIcon,
        'PipingSystemHifi',
        PipingSystemHifi,
      ),
      p('Valve', 'ValveIcon', ValveIcon, 'ValveHifi', ValveHifi),
    ],
  },
  {
    label: 'Views',
    icons: [
      p('Plan view', 'PlanViewIcon', PlanViewIcon, 'PlanViewHifi', PlanViewHifi),
      p('Section view', 'SectionViewIcon', SectionViewIcon, 'SectionViewHifi', SectionViewHifi),
      p(
        'Elevation view',
        'ElevationViewIcon',
        ElevationViewIcon,
        'ElevationViewHifi',
        ElevationViewHifi,
      ),
      p('3D / orbit', 'OrbitViewIcon', OrbitViewIcon, 'OrbitViewHifi', OrbitViewHifi),
      p('Sheet', 'SheetIcon', SheetIcon, 'SheetHifi', SheetHifi),
      p('Schedule', 'ScheduleViewIcon', ScheduleViewIcon, 'ScheduleViewHifi', ScheduleViewHifi),
      p('Callout', 'CalloutIcon', CalloutIcon, 'CalloutHifi', CalloutHifi),
      p('Viewpoint', 'ViewpointIcon', ViewpointIcon, 'ViewpointHifi', ViewpointHifi),
      p('Section box', 'SectionBoxIcon', SectionBoxIcon, 'SectionBoxHifi', SectionBoxHifi),
      p('Grid line', 'GridLineIcon', GridLineIcon, 'GridLineHifi', GridLineHifi),
      p('Level', 'LevelIcon', LevelIcon, 'LevelHifi', LevelHifi),
      p('Detail line', 'DetailLineIcon', DetailLineIcon, 'DetailLineHifi', DetailLineHifi),
      p(
        'RCP',
        'ReflectedCeilingPlanIcon',
        ReflectedCeilingPlanIcon,
        'ReflectedCeilingPlanHifi',
        ReflectedCeilingPlanHifi,
      ),
      p(
        'Structural plan',
        'StructuralPlanIcon',
        StructuralPlanIcon,
        'StructuralPlanHifi',
        StructuralPlanHifi,
      ),
      p('Area plan', 'AreaPlanIcon', AreaPlanIcon, 'AreaPlanHifi', AreaPlanHifi),
      p('Detail view', 'DetailViewIcon', DetailViewIcon, 'DetailViewHifi', DetailViewHifi),
      p(
        'Drafting view',
        'DraftingViewIcon',
        DraftingViewIcon,
        'DraftingViewHifi',
        DraftingViewHifi,
      ),
      p('Walkthrough', 'WalkthroughIcon', WalkthroughIcon, 'WalkthroughHifi', WalkthroughHifi),
      p('Legend', 'LegendIcon', LegendIcon, 'LegendHifi', LegendHifi),
      p('Sheet list', 'SheetListIcon', SheetListIcon, 'SheetListHifi', SheetListHifi),
      p('Note block', 'NoteBlockIcon', NoteBlockIcon, 'NoteBlockHifi', NoteBlockHifi),
      p('View list', 'ViewListIcon', ViewListIcon, 'ViewListHifi', ViewListHifi),
      p(
        'Panel sch. view',
        'PanelScheduleViewIcon',
        PanelScheduleViewIcon,
        'PanelScheduleViewHifi',
        PanelScheduleViewHifi,
      ),
      p(
        'Col. schedule',
        'GraphicalColumnScheduleIcon',
        GraphicalColumnScheduleIcon,
        'GraphicalColumnScheduleHifi',
        GraphicalColumnScheduleHifi,
      ),
      p(
        'View reference',
        'ViewReferenceIcon',
        ViewReferenceIcon,
        'ViewReferenceHifi',
        ViewReferenceHifi,
      ),
    ],
  },
  {
    label: 'Annotation & documentation',
    icons: [
      p(
        'Revision cloud',
        'RevisionCloudIcon',
        RevisionCloudIcon,
        'RevisionCloudHifi',
        RevisionCloudHifi,
      ),
      p('Break line', 'BreakLineIcon', BreakLineIcon, 'BreakLineHifi', BreakLineHifi),
      p('Centre line', 'CentreLineIcon', CentreLineIcon, 'CentreLineHifi', CentreLineHifi),
      p('Keynote', 'KeynoteIcon', KeynoteIcon, 'KeynoteHifi', KeynoteHifi),
      p('Match line', 'MatchLineIcon', MatchLineIcon, 'MatchLineHifi', MatchLineHifi),
      p('Scale bar', 'ScaleBarIcon', ScaleBarIcon, 'ScaleBarHifi', ScaleBarHifi),
      p('Area label', 'AreaLabelIcon', AreaLabelIcon, 'AreaLabelHifi', AreaLabelHifi),
      p(
        'Spot elevation',
        'SpotElevationIcon',
        SpotElevationIcon,
        'SpotElevationHifi',
        SpotElevationHifi,
      ),
      p('Slope arrow', 'SlopeArrowIcon', SlopeArrowIcon, 'SlopeArrowHifi', SlopeArrowHifi),
      p(
        'Angular dim.',
        'AngularDimensionIcon',
        AngularDimensionIcon,
        'AngularDimensionHifi',
        AngularDimensionHifi,
      ),
      p(
        'Radial dim.',
        'RadialDimensionIcon',
        RadialDimensionIcon,
        'RadialDimensionHifi',
        RadialDimensionHifi,
      ),
      p(
        'Arc length dim.',
        'ArcLengthDimensionIcon',
        ArcLengthDimensionIcon,
        'ArcLengthDimensionHifi',
        ArcLengthDimensionHifi,
      ),
      p(
        'Ordinal dim.',
        'OrdinalDimensionIcon',
        OrdinalDimensionIcon,
        'OrdinalDimensionHifi',
        OrdinalDimensionHifi,
      ),
      p(
        'Spot coordinate',
        'SpotCoordinateIcon',
        SpotCoordinateIcon,
        'SpotCoordinateHifi',
        SpotCoordinateHifi,
      ),
      p(
        'Elevation tag',
        'ElevationTagIcon',
        ElevationTagIcon,
        'ElevationTagHifi',
        ElevationTagHifi,
      ),
      p(
        'Filled region',
        'FilledRegionIcon',
        FilledRegionIcon,
        'FilledRegionHifi',
        FilledRegionHifi,
      ),
      p(
        'Masking region',
        'MaskingRegionIcon',
        MaskingRegionIcon,
        'MaskingRegionHifi',
        MaskingRegionHifi,
      ),
      p(
        'Detail component',
        'DetailComponentIcon',
        DetailComponentIcon,
        'DetailComponentHifi',
        DetailComponentHifi,
      ),
      p(
        'Repeating detail',
        'RepeatingDetailIcon',
        RepeatingDetailIcon,
        'RepeatingDetailHifi',
        RepeatingDetailHifi,
      ),
      p(
        'Insulation',
        'InsulationAnnotationIcon',
        InsulationAnnotationIcon,
        'InsulationAnnotationHifi',
        InsulationAnnotationHifi,
      ),
      p('Text', 'TextAnnotationIcon', TextAnnotationIcon, 'TextAnnotationHifi', TextAnnotationHifi),
      p(
        'Multi-cat. tag',
        'MultiCategoryTagIcon',
        MultiCategoryTagIcon,
        'MultiCategoryTagHifi',
        MultiCategoryTagHifi,
      ),
      p('Material tag', 'MaterialTagIcon', MaterialTagIcon, 'MaterialTagHifi', MaterialTagHifi),
      p('Room tag', 'RoomTagIcon', RoomTagIcon, 'RoomTagHifi', RoomTagHifi),
      p('Space tag', 'SpaceTagIcon', SpaceTagIcon, 'SpaceTagHifi', SpaceTagHifi),
      p('Area tag', 'AreaTagIcon', AreaTagIcon, 'AreaTagHifi', AreaTagHifi),
      p('Stair tag', 'StairTagIcon', StairTagIcon, 'StairTagHifi', StairTagHifi),
      p('Symbol', 'SymbolIcon', SymbolIcon, 'SymbolHifi', SymbolHifi),
      p(
        'Stair path annot.',
        'StairPathAnnotationIcon',
        StairPathAnnotationIcon,
        'StairPathAnnotationHifi',
        StairPathAnnotationHifi,
      ),
      p(
        'Reference point',
        'ReferencePointIcon',
        ReferencePointIcon,
        'ReferencePointHifi',
        ReferencePointHifi,
      ),
    ],
  },
  {
    label: 'Site & civil',
    icons: [
      p('Topography', 'TopoIcon', TopoIcon, 'TopoHifi', TopoHifi),
      p(
        'Property line',
        'PropertyLineIcon',
        PropertyLineIcon,
        'PropertyLineHifi',
        PropertyLineHifi,
      ),
      p(
        'Parking space',
        'ParkingSpaceIcon',
        ParkingSpaceIcon,
        'ParkingSpaceHifi',
        ParkingSpaceHifi,
      ),
      p('Planting / tree', 'PlantingIcon', PlantingIcon, 'PlantingHifi', PlantingHifi),
      p('Road', 'RoadIcon', RoadIcon, 'RoadHifi', RoadHifi),
      p(
        'Retaining wall',
        'RetainingWallIcon',
        RetainingWallIcon,
        'RetainingWallHifi',
        RetainingWallHifi,
      ),
      p('North arrow', 'NorthArrowIcon', NorthArrowIcon, 'NorthArrowHifi', NorthArrowHifi),
    ],
  },
  {
    label: 'Organization & coordination',
    icons: [
      p('Family', 'FamilyIcon', FamilyIcon, 'FamilyHifi', FamilyHifi),
      p('Family type', 'FamilyTypeIcon', FamilyTypeIcon, 'FamilyTypeHifi', FamilyTypeHifi),
      p('Group', 'GroupIcon', GroupIcon, 'GroupHifi', GroupHifi),
      p('Assembly', 'AssemblyIcon', AssemblyIcon, 'AssemblyHifi', AssemblyHifi),
      p('Linked model', 'LinkedModelIcon', LinkedModelIcon, 'LinkedModelHifi', LinkedModelHifi),
      p('Material', 'MaterialIcon', MaterialIcon, 'MaterialHifi', MaterialHifi),
      p('Wall layer', 'WallLayerIcon', WallLayerIcon, 'WallLayerHifi', WallLayerHifi),
      p('Phase', 'PhaseIcon', PhaseIcon, 'PhaseHifi', PhaseHifi),
      p('Issue', 'IssueIcon', IssueIcon, 'IssueHifi', IssueHifi),
      p('Clash', 'ClashIcon', ClashIcon, 'ClashHifi', ClashHifi),
      p(
        'Validation rule',
        'ValidationRuleIcon',
        ValidationRuleIcon,
        'ValidationRuleHifi',
        ValidationRuleHifi,
      ),
      p('Deviation', 'DeviationIcon', DeviationIcon, 'DeviationHifi', DeviationHifi),
    ],
  },
  {
    label: 'Workflow & data',
    icons: [
      p('Workset', 'WorksetIcon', WorksetIcon, 'WorksetHifi', WorksetHifi),
      p(
        'Design option',
        'DesignOptionIcon',
        DesignOptionIcon,
        'DesignOptionHifi',
        DesignOptionHifi,
      ),
      p('Revision', 'RevisionIcon', RevisionIcon, 'RevisionHifi', RevisionHifi),
      p('RFI', 'RFIIcon', RFIIcon, 'RFIHifi', RFIHifi),
      p('Submittal', 'SubmittalIcon', SubmittalIcon, 'SubmittalHifi', SubmittalHifi),
      p('Point cloud', 'PointCloudIcon', PointCloudIcon, 'PointCloudHifi', PointCloudHifi),
      p('Digital twin', 'DigitalTwinIcon', DigitalTwinIcon, 'DigitalTwinHifi', DigitalTwinHifi),
      p('Sync', 'SyncIcon', SyncIcon, 'SyncHifi', SyncHifi),
      p('Transmittal', 'TransmittalIcon', TransmittalIcon, 'TransmittalHifi', TransmittalHifi),
      p('IFC', 'IFCIcon', IFCIcon, 'IFCHifi', IFCHifi),
      p('LOD', 'LODIcon', LODIcon, 'LODHifi', LODHifi),
      p(
        'Qty takeoff',
        'QuantityTakeoffIcon',
        QuantityTakeoffIcon,
        'QuantityTakeoffHifi',
        QuantityTakeoffHifi,
      ),
      p('Energy model', 'EnergyModelIcon', EnergyModelIcon, 'EnergyModelHifi', EnergyModelHifi),
      p('Scope box', 'ScopeBoxIcon', ScopeBoxIcon, 'ScopeBoxHifi', ScopeBoxHifi),
    ],
  },
  {
    label: 'Edit operations',
    icons: [
      p('Move', 'MoveIcon', MoveIcon, 'MoveHifi', MoveHifi),
      p('Copy', 'CopyIcon', CopyIcon, 'CopyHifi', CopyHifi),
      p('Rotate', 'RotateIcon', RotateIcon, 'RotateHifi', RotateHifi),
      p('Scale', 'ScaleIcon', ScaleIcon, 'ScaleHifi', ScaleHifi),
      p('Offset', 'OffsetIcon', OffsetIcon, 'OffsetHifi', OffsetHifi),
      p('Delete', 'DeleteIcon', DeleteIcon, 'DeleteHifi', DeleteHifi),
      p('Mirror', 'MirrorIcon', MirrorIcon, 'MirrorHifi', MirrorHifi),
      p('Array (linear)', 'ArrayLinearIcon', ArrayLinearIcon, 'ArrayLinearHifi', ArrayLinearHifi),
      p('Array (radial)', 'ArrayRadialIcon', ArrayRadialIcon, 'ArrayRadialHifi', ArrayRadialHifi),
      p('Align', 'AlignIcon', AlignIcon, 'AlignHifi', AlignHifi),
      p('Split', 'SplitIcon', SplitIcon, 'SplitHifi', SplitHifi),
      p('Trim / extend', 'TrimExtendIcon', TrimExtendIcon, 'TrimExtendHifi', TrimExtendHifi),
      p('Void', 'VoidIcon', VoidIcon, 'VoidHifi', VoidHifi),
      p('Pin', 'PinIcon', PinIcon, 'PinHifi', PinHifi),
      p('Unpin', 'UnpinIcon', UnpinIcon, 'UnpinHifi', UnpinHifi),
      p(
        'Join geometry',
        'JoinGeometryIcon',
        JoinGeometryIcon,
        'JoinGeometryHifi',
        JoinGeometryHifi,
      ),
      p(
        'Unjoin geometry',
        'UnjoinGeometryIcon',
        UnjoinGeometryIcon,
        'UnjoinGeometryHifi',
        UnjoinGeometryHifi,
      ),
      p(
        'Switch join',
        'SwitchJoinOrderIcon',
        SwitchJoinOrderIcon,
        'SwitchJoinOrderHifi',
        SwitchJoinOrderHifi,
      ),
      p('Wall joins', 'WallJoinsIcon', WallJoinsIcon, 'WallJoinsHifi', WallJoinsHifi),
      p(
        'Paint material',
        'PaintMaterialIcon',
        PaintMaterialIcon,
        'PaintMaterialHifi',
        PaintMaterialHifi,
      ),
      p(
        'Measure between',
        'MeasureBetweenIcon',
        MeasureBetweenIcon,
        'MeasureBetweenHifi',
        MeasureBetweenHifi,
      ),
      p(
        'Measure along',
        'MeasureAlongIcon',
        MeasureAlongIcon,
        'MeasureAlongHifi',
        MeasureAlongHifi,
      ),
      p('Ungroup', 'UngroupIcon', UngroupIcon, 'UngroupHifi', UngroupHifi),
    ],
  },
  {
    label: 'Collaboration',
    icons: [
      p(
        'Reload latest',
        'ReloadLatestIcon',
        ReloadLatestIcon,
        'ReloadLatestHifi',
        ReloadLatestHifi,
      ),
      p(
        'Editing request',
        'EditingRequestIcon',
        EditingRequestIcon,
        'EditingRequestHifi',
        EditingRequestHifi,
      ),
      p('Copy/monitor', 'CopyMonitorIcon', CopyMonitorIcon, 'CopyMonitorHifi', CopyMonitorHifi),
      p(
        'Coord. review',
        'CoordinationReviewIcon',
        CoordinationReviewIcon,
        'CoordinationReviewHifi',
        CoordinationReviewHifi,
      ),
      p('Purge unused', 'PurgeUnusedIcon', PurgeUnusedIcon, 'PurgeUnusedHifi', PurgeUnusedHifi),
      p(
        'Transfer standards',
        'TransferProjectStandardsIcon',
        TransferProjectStandardsIcon,
        'TransferProjectStandardsHifi',
        TransferProjectStandardsHifi,
      ),
      p('Project info', 'ProjectInfoIcon', ProjectInfoIcon, 'ProjectInfoHifi', ProjectInfoHifi),
      p(
        'Project params',
        'ProjectParametersIcon',
        ProjectParametersIcon,
        'ProjectParametersHifi',
        ProjectParametersHifi,
      ),
      p(
        'Shared params',
        'SharedParametersIcon',
        SharedParametersIcon,
        'SharedParametersHifi',
        SharedParametersHifi,
      ),
      p(
        'Object styles',
        'ObjectStylesIcon',
        ObjectStylesIcon,
        'ObjectStylesHifi',
        ObjectStylesHifi,
      ),
    ],
  },
];

const ALL_ICONS = SECTIONS.flatMap((s) => s.icons);

const SIZES = [16, 18, 20, 24, 32] as const;
type Size = (typeof SIZES)[number];

const STROKE_WIDTHS = [1, 1.5, 2] as const;
type StrokeWidth = (typeof STROKE_WIDTHS)[number];

const SCHEME_LABELS: { key: ColorScheme; label: string }[] = [
  { key: 'mono', label: 'Mono' },
  { key: 'accent', label: 'Accent' },
  { key: 'color', label: 'Color' },
];

function PairedCard({
  entry,
  size,
  strokeWidth,
  scheme,
}: {
  entry: PairedEntry;
  size: Size;
  strokeWidth: StrokeWidth;
  scheme: ColorScheme;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    const text = `import { ${entry.hifiExport} } from '@bim-ai/icons'`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }, [entry.hifiExport]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Click to copy import for ${entry.hifiExport}`}
      className="group relative flex flex-col items-center gap-0 overflow-hidden rounded-xl border border-border bg-surface text-center transition-all hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied && (
        <span className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-accent text-xs font-medium text-accent-foreground">
          Copied!
        </span>
      )}
      <div className="flex h-16 w-full items-center justify-center" style={COLOR_VARS[scheme]}>
        <entry.Hifi
          size={44}
          className="text-foreground transition-colors group-hover:text-accent"
        />
      </div>
      <div className="flex w-full items-center gap-1.5 border-t border-border/50 bg-background/40 px-2 py-1.5">
        <entry.Regular
          size={size}
          strokeWidth={strokeWidth}
          className="flex-shrink-0 text-muted-foreground/50 transition-colors group-hover:text-accent/60"
        />
        <span className="min-w-0 truncate text-[10px] text-muted-foreground">{entry.name}</span>
      </div>
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
        {entry.hifiExport}
      </span>
    </button>
  );
}

export function IconGallery() {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<Size>(20);
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>(1.5);
  const [scheme, setScheme] = useState<ColorScheme>('color');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return ALL_ICONS.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.regularExport.toLowerCase().includes(q) ||
        e.hifiExport.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold">@bim-ai/icons</h1>
              <p className="text-[11px] text-muted-foreground">
                {ALL_ICONS.length} icons · 24px stroke + 48px hi-fi each
              </p>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className="h-8 w-56 rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">scheme</span>
                <div className="flex rounded-md border border-border">
                  {SCHEME_LABELS.map(({ key, label }, i) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setScheme(key)}
                      className={[
                        'px-2 py-0.5 text-[11px] transition-colors',
                        key === scheme
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === SCHEME_LABELS.length - 1 ? 'rounded-r-sm' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">size</span>
                <div className="flex rounded-md border border-border">
                  {SIZES.map((s, i) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSize(s)}
                      className={[
                        'px-2 py-0.5 text-[11px] font-mono transition-colors',
                        s === size
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === SIZES.length - 1 ? 'rounded-r-sm' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">stroke</span>
                <div className="flex rounded-md border border-border">
                  {STROKE_WIDTHS.map((sw, i) => (
                    <button
                      type="button"
                      key={sw}
                      onClick={() => setStrokeWidth(sw)}
                      className={[
                        'px-2 py-0.5 text-[11px] font-mono transition-colors',
                        sw === strokeWidth
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === STROKE_WIDTHS.length - 1 ? 'rounded-r-sm' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {sw}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {filtered !== null ? (
          <div>
            <p className="mb-4 text-[11px] text-muted-foreground">
              {filtered.length === 0
                ? 'No icons match.'
                : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
              {filtered.map((entry) => (
                <PairedCard
                  key={entry.hifiExport}
                  entry={entry}
                  size={size}
                  strokeWidth={strokeWidth}
                  scheme={scheme}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.label}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {section.label}
                  </h2>
                  <span className="text-[11px] text-muted-foreground/60">
                    {section.icons.length}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                  {section.icons.map((entry) => (
                    <PairedCard
                      key={entry.hifiExport}
                      entry={entry}
                      size={size}
                      strokeWidth={strokeWidth}
                      scheme={scheme}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-lg border border-border bg-surface p-5">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Usage</p>
          <pre className="overflow-x-auto rounded bg-surface-strong p-3 font-mono text-[12px] text-foreground">
            {`import { WallIcon, WallHifi } from '@bim-ai/icons'\n\n// 24px stroke icon\n<WallIcon size={18} strokeWidth={1.5} className="text-stone-600" />\n\n// 48px hi-fi icon (CSS vars control fills)\n<WallHifi size={48} className="text-stone-700" />`}
          </pre>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Click any card to copy its hi-fi import. Top area = 48px hi-fi in the selected color
            scheme; bottom strip = 24px stroke icon at the chosen size and weight.
          </p>
        </div>
      </div>
    </div>
  );
}
