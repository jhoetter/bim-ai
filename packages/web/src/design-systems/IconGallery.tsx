import { useState, useMemo, useCallback } from 'react';
import type { BimIcon } from '@bim-ai/icons';
import {
  WallIcon, DoorIcon, WindowIcon, FloorIcon, RoofIcon, StairIcon, RailingIcon,
  RoomIcon, DimensionIcon, SectionIcon, TagIcon, CurtainWallIcon, ColumnIcon, BeamIcon,
  PlanViewIcon, SectionViewIcon, ElevationViewIcon, OrbitViewIcon, SheetIcon,
  ScheduleViewIcon, CalloutIcon, ViewpointIcon, SectionBoxIcon, GridLineIcon,
  LevelIcon, DetailLineIcon,
  FamilyIcon, FamilyTypeIcon, GroupIcon, AssemblyIcon, LinkedModelIcon, MaterialIcon,
  WallLayerIcon, PhaseIcon, IssueIcon, ClashIcon, ValidationRuleIcon, DeviationIcon,
  DuctRectIcon, DuctRoundIcon, PipeIcon, CableTrayIcon, ConduitIcon,
  MechanicalEquipmentIcon, PlumbingFixtureIcon, LightingFixtureIcon,
  ElectricalPanelIcon, FireSprinklerIcon, DiffuserIcon, MepSpaceIcon,
  FoundationIcon, StripFootingIcon, TrussIcon, BraceIcon, RebarIcon,
  StructuralConnectionIcon,
  CeilingIcon, OpeningIcon, ShaftOpeningIcon, RampIcon, MassIcon, CurtainPanelIcon,
  MullionIcon, SkyLightIcon, PartitionIcon,
  TopoIcon, PropertyLineIcon, ParkingSpaceIcon, PlantingIcon, RoadIcon,
  RetainingWallIcon, NorthArrowIcon,
  RevisionCloudIcon, BreakLineIcon, CentreLineIcon, KeynoteIcon, MatchLineIcon,
  ScaleBarIcon, AreaLabelIcon, SpotElevationIcon, SlopeArrowIcon,
  WorksetIcon, DesignOptionIcon, RevisionIcon, RFIIcon, SubmittalIcon,
  PointCloudIcon, DigitalTwinIcon, SyncIcon, TransmittalIcon, IFCIcon,
  LODIcon, QuantityTakeoffIcon, EnergyModelIcon, ScopeBoxIcon,
  MirrorIcon, ArrayLinearIcon, ArrayRadialIcon, AlignIcon, SplitIcon,
  TrimExtendIcon, VoidIcon, PinIcon, UnpinIcon,
  // Architectural extended
  WallSweepIcon, WallRevealIcon, ComponentIcon, RoofExtrusionIcon, RoofSoffitIcon,
  FasciaIcon, GutterIcon, CurtainSystemIcon, CurtainGridIcon, VerticalOpeningIcon,
  DormerOpeningIcon, FaceOpeningIcon, RoomSeparatorIcon, AreaBoundaryIcon,
  ReferencePlaneIcon, WorkPlaneIcon, ModelLineIcon, ModelTextIcon, StairPathIcon,
  // Structural extended
  BeamSystemIcon, FoundationSlabIcon, SlabEdgeIcon, AreaReinforcementIcon,
  PathReinforcementIcon, FabricSheetIcon, ShearStudIcon, AnchorIcon, BoltIcon,
  WeldIcon, AnalyticalNodeIcon, StructuralLoadIcon, BoundaryConditionIcon,
  // MEP extended
  FlexDuctIcon, DuctFittingIcon, DuctAccessoryIcon, DuctInsulationIcon, DuctLiningIcon,
  FlexPipeIcon, PipeFittingIcon, PipeAccessoryIcon, PipeInsulationIcon,
  CableTrayFittingIcon, ConduitFittingIcon, ElectricalWireIcon, SwitchSystemIcon,
  LightingSwitchIcon, CommunicationDeviceIcon, FireAlarmDeviceIcon, DataDeviceIcon,
  NurseCallIcon, SecurityDeviceIcon, HVACZoneIcon, PanelScheduleIcon,
  DuctSystemIcon, PipingSystemIcon, ValveIcon,
  // Views extended
  ReflectedCeilingPlanIcon, StructuralPlanIcon, AreaPlanIcon, DetailViewIcon,
  DraftingViewIcon, WalkthroughIcon, LegendIcon, SheetListIcon, NoteBlockIcon,
  ViewListIcon, PanelScheduleViewIcon, GraphicalColumnScheduleIcon, ViewReferenceIcon,
  // Annotation extended
  AngularDimensionIcon, RadialDimensionIcon, ArcLengthDimensionIcon, OrdinalDimensionIcon,
  SpotCoordinateIcon, ElevationTagIcon, FilledRegionIcon, MaskingRegionIcon,
  DetailComponentIcon, RepeatingDetailIcon, InsulationAnnotationIcon, TextAnnotationIcon,
  MultiCategoryTagIcon, MaterialTagIcon, RoomTagIcon, SpaceTagIcon, AreaTagIcon,
  StairTagIcon, SymbolIcon, StairPathAnnotationIcon, ReferencePointIcon,
  // Edit basic
  MoveIcon, CopyIcon, RotateIcon, ScaleIcon, OffsetIcon, DeleteIcon,
  JoinGeometryIcon, UnjoinGeometryIcon, SwitchJoinOrderIcon, WallJoinsIcon,
  PaintMaterialIcon, MeasureBetweenIcon, MeasureAlongIcon, UngroupIcon,
  // Collaboration
  ReloadLatestIcon, EditingRequestIcon, CopyMonitorIcon, CoordinationReviewIcon,
  PurgeUnusedIcon, TransferProjectStandardsIcon, ProjectInfoIcon,
  ProjectParametersIcon, SharedParametersIcon, ObjectStylesIcon,
} from '@bim-ai/icons';

type IconEntry = { name: string; export: string; Icon: BimIcon };
type Section = { label: string; icons: IconEntry[] };

const SECTIONS: Section[] = [
  {
    label: 'Drawing tools',
    icons: [
      { name: 'Wall', export: 'WallIcon', Icon: WallIcon },
      { name: 'Door', export: 'DoorIcon', Icon: DoorIcon },
      { name: 'Window', export: 'WindowIcon', Icon: WindowIcon },
      { name: 'Floor', export: 'FloorIcon', Icon: FloorIcon },
      { name: 'Roof', export: 'RoofIcon', Icon: RoofIcon },
      { name: 'Stair', export: 'StairIcon', Icon: StairIcon },
      { name: 'Railing', export: 'RailingIcon', Icon: RailingIcon },
      { name: 'Room', export: 'RoomIcon', Icon: RoomIcon },
      { name: 'Dimension', export: 'DimensionIcon', Icon: DimensionIcon },
      { name: 'Section', export: 'SectionIcon', Icon: SectionIcon },
      { name: 'Tag', export: 'TagIcon', Icon: TagIcon },
      { name: 'Curtain wall', export: 'CurtainWallIcon', Icon: CurtainWallIcon },
      { name: 'Column', export: 'ColumnIcon', Icon: ColumnIcon },
      { name: 'Beam', export: 'BeamIcon', Icon: BeamIcon },
    ],
  },
  {
    label: 'Architectural',
    icons: [
      { name: 'Ceiling', export: 'CeilingIcon', Icon: CeilingIcon },
      { name: 'Opening', export: 'OpeningIcon', Icon: OpeningIcon },
      { name: 'Shaft opening', export: 'ShaftOpeningIcon', Icon: ShaftOpeningIcon },
      { name: 'Ramp', export: 'RampIcon', Icon: RampIcon },
      { name: 'Mass', export: 'MassIcon', Icon: MassIcon },
      { name: 'Curtain panel', export: 'CurtainPanelIcon', Icon: CurtainPanelIcon },
      { name: 'Mullion', export: 'MullionIcon', Icon: MullionIcon },
      { name: 'Skylight', export: 'SkyLightIcon', Icon: SkyLightIcon },
      { name: 'Partition', export: 'PartitionIcon', Icon: PartitionIcon },
      { name: 'Wall sweep', export: 'WallSweepIcon', Icon: WallSweepIcon },
      { name: 'Wall reveal', export: 'WallRevealIcon', Icon: WallRevealIcon },
      { name: 'Component', export: 'ComponentIcon', Icon: ComponentIcon },
      { name: 'Roof extrusion', export: 'RoofExtrusionIcon', Icon: RoofExtrusionIcon },
      { name: 'Roof soffit', export: 'RoofSoffitIcon', Icon: RoofSoffitIcon },
      { name: 'Fascia', export: 'FasciaIcon', Icon: FasciaIcon },
      { name: 'Gutter', export: 'GutterIcon', Icon: GutterIcon },
      { name: 'Curtain system', export: 'CurtainSystemIcon', Icon: CurtainSystemIcon },
      { name: 'Curtain grid', export: 'CurtainGridIcon', Icon: CurtainGridIcon },
      { name: 'Vertical opening', export: 'VerticalOpeningIcon', Icon: VerticalOpeningIcon },
      { name: 'Dormer opening', export: 'DormerOpeningIcon', Icon: DormerOpeningIcon },
      { name: 'Face opening', export: 'FaceOpeningIcon', Icon: FaceOpeningIcon },
      { name: 'Room separator', export: 'RoomSeparatorIcon', Icon: RoomSeparatorIcon },
      { name: 'Area boundary', export: 'AreaBoundaryIcon', Icon: AreaBoundaryIcon },
      { name: 'Reference plane', export: 'ReferencePlaneIcon', Icon: ReferencePlaneIcon },
      { name: 'Work plane', export: 'WorkPlaneIcon', Icon: WorkPlaneIcon },
      { name: 'Model line', export: 'ModelLineIcon', Icon: ModelLineIcon },
      { name: 'Model text', export: 'ModelTextIcon', Icon: ModelTextIcon },
      { name: 'Stair path', export: 'StairPathIcon', Icon: StairPathIcon },
    ],
  },
  {
    label: 'Structural',
    icons: [
      { name: 'Foundation', export: 'FoundationIcon', Icon: FoundationIcon },
      { name: 'Strip footing', export: 'StripFootingIcon', Icon: StripFootingIcon },
      { name: 'Truss', export: 'TrussIcon', Icon: TrussIcon },
      { name: 'Brace', export: 'BraceIcon', Icon: BraceIcon },
      { name: 'Rebar', export: 'RebarIcon', Icon: RebarIcon },
      { name: 'Struct. connection', export: 'StructuralConnectionIcon', Icon: StructuralConnectionIcon },
      { name: 'Beam system', export: 'BeamSystemIcon', Icon: BeamSystemIcon },
      { name: 'Foundation slab', export: 'FoundationSlabIcon', Icon: FoundationSlabIcon },
      { name: 'Slab edge', export: 'SlabEdgeIcon', Icon: SlabEdgeIcon },
      { name: 'Area reinforcement', export: 'AreaReinforcementIcon', Icon: AreaReinforcementIcon },
      { name: 'Path reinforcement', export: 'PathReinforcementIcon', Icon: PathReinforcementIcon },
      { name: 'Fabric sheet', export: 'FabricSheetIcon', Icon: FabricSheetIcon },
      { name: 'Shear stud', export: 'ShearStudIcon', Icon: ShearStudIcon },
      { name: 'Anchor', export: 'AnchorIcon', Icon: AnchorIcon },
      { name: 'Bolt', export: 'BoltIcon', Icon: BoltIcon },
      { name: 'Weld', export: 'WeldIcon', Icon: WeldIcon },
      { name: 'Analytical node', export: 'AnalyticalNodeIcon', Icon: AnalyticalNodeIcon },
      { name: 'Structural load', export: 'StructuralLoadIcon', Icon: StructuralLoadIcon },
      { name: 'Boundary condition', export: 'BoundaryConditionIcon', Icon: BoundaryConditionIcon },
    ],
  },
  {
    label: 'MEP',
    icons: [
      { name: 'Duct (rect)', export: 'DuctRectIcon', Icon: DuctRectIcon },
      { name: 'Duct (round)', export: 'DuctRoundIcon', Icon: DuctRoundIcon },
      { name: 'Pipe', export: 'PipeIcon', Icon: PipeIcon },
      { name: 'Cable tray', export: 'CableTrayIcon', Icon: CableTrayIcon },
      { name: 'Conduit', export: 'ConduitIcon', Icon: ConduitIcon },
      { name: 'Mech. equipment', export: 'MechanicalEquipmentIcon', Icon: MechanicalEquipmentIcon },
      { name: 'Plumbing fixture', export: 'PlumbingFixtureIcon', Icon: PlumbingFixtureIcon },
      { name: 'Lighting fixture', export: 'LightingFixtureIcon', Icon: LightingFixtureIcon },
      { name: 'Electrical panel', export: 'ElectricalPanelIcon', Icon: ElectricalPanelIcon },
      { name: 'Fire sprinkler', export: 'FireSprinklerIcon', Icon: FireSprinklerIcon },
      { name: 'Diffuser', export: 'DiffuserIcon', Icon: DiffuserIcon },
      { name: 'MEP space', export: 'MepSpaceIcon', Icon: MepSpaceIcon },
      { name: 'Flex duct', export: 'FlexDuctIcon', Icon: FlexDuctIcon },
      { name: 'Duct fitting', export: 'DuctFittingIcon', Icon: DuctFittingIcon },
      { name: 'Duct accessory', export: 'DuctAccessoryIcon', Icon: DuctAccessoryIcon },
      { name: 'Duct insulation', export: 'DuctInsulationIcon', Icon: DuctInsulationIcon },
      { name: 'Duct lining', export: 'DuctLiningIcon', Icon: DuctLiningIcon },
      { name: 'Flex pipe', export: 'FlexPipeIcon', Icon: FlexPipeIcon },
      { name: 'Pipe fitting', export: 'PipeFittingIcon', Icon: PipeFittingIcon },
      { name: 'Pipe accessory', export: 'PipeAccessoryIcon', Icon: PipeAccessoryIcon },
      { name: 'Pipe insulation', export: 'PipeInsulationIcon', Icon: PipeInsulationIcon },
      { name: 'Cable tray fitting', export: 'CableTrayFittingIcon', Icon: CableTrayFittingIcon },
      { name: 'Conduit fitting', export: 'ConduitFittingIcon', Icon: ConduitFittingIcon },
      { name: 'Electrical wire', export: 'ElectricalWireIcon', Icon: ElectricalWireIcon },
      { name: 'Switch system', export: 'SwitchSystemIcon', Icon: SwitchSystemIcon },
      { name: 'Lighting switch', export: 'LightingSwitchIcon', Icon: LightingSwitchIcon },
      { name: 'Comms device', export: 'CommunicationDeviceIcon', Icon: CommunicationDeviceIcon },
      { name: 'Fire alarm', export: 'FireAlarmDeviceIcon', Icon: FireAlarmDeviceIcon },
      { name: 'Data device', export: 'DataDeviceIcon', Icon: DataDeviceIcon },
      { name: 'Nurse call', export: 'NurseCallIcon', Icon: NurseCallIcon },
      { name: 'Security device', export: 'SecurityDeviceIcon', Icon: SecurityDeviceIcon },
      { name: 'HVAC zone', export: 'HVACZoneIcon', Icon: HVACZoneIcon },
      { name: 'Panel schedule', export: 'PanelScheduleIcon', Icon: PanelScheduleIcon },
      { name: 'Duct system', export: 'DuctSystemIcon', Icon: DuctSystemIcon },
      { name: 'Piping system', export: 'PipingSystemIcon', Icon: PipingSystemIcon },
      { name: 'Valve', export: 'ValveIcon', Icon: ValveIcon },
    ],
  },
  {
    label: 'Views',
    icons: [
      { name: 'Plan view', export: 'PlanViewIcon', Icon: PlanViewIcon },
      { name: 'Section view', export: 'SectionViewIcon', Icon: SectionViewIcon },
      { name: 'Elevation view', export: 'ElevationViewIcon', Icon: ElevationViewIcon },
      { name: '3D / orbit', export: 'OrbitViewIcon', Icon: OrbitViewIcon },
      { name: 'Sheet', export: 'SheetIcon', Icon: SheetIcon },
      { name: 'Schedule', export: 'ScheduleViewIcon', Icon: ScheduleViewIcon },
      { name: 'Callout', export: 'CalloutIcon', Icon: CalloutIcon },
      { name: 'Viewpoint', export: 'ViewpointIcon', Icon: ViewpointIcon },
      { name: 'Section box', export: 'SectionBoxIcon', Icon: SectionBoxIcon },
      { name: 'Grid line', export: 'GridLineIcon', Icon: GridLineIcon },
      { name: 'Level', export: 'LevelIcon', Icon: LevelIcon },
      { name: 'Detail line', export: 'DetailLineIcon', Icon: DetailLineIcon },
      { name: 'RCP', export: 'ReflectedCeilingPlanIcon', Icon: ReflectedCeilingPlanIcon },
      { name: 'Structural plan', export: 'StructuralPlanIcon', Icon: StructuralPlanIcon },
      { name: 'Area plan', export: 'AreaPlanIcon', Icon: AreaPlanIcon },
      { name: 'Detail view', export: 'DetailViewIcon', Icon: DetailViewIcon },
      { name: 'Drafting view', export: 'DraftingViewIcon', Icon: DraftingViewIcon },
      { name: 'Walkthrough', export: 'WalkthroughIcon', Icon: WalkthroughIcon },
      { name: 'Legend', export: 'LegendIcon', Icon: LegendIcon },
      { name: 'Sheet list', export: 'SheetListIcon', Icon: SheetListIcon },
      { name: 'Note block', export: 'NoteBlockIcon', Icon: NoteBlockIcon },
      { name: 'View list', export: 'ViewListIcon', Icon: ViewListIcon },
      { name: 'Panel schedule view', export: 'PanelScheduleViewIcon', Icon: PanelScheduleViewIcon },
      { name: 'Col. schedule', export: 'GraphicalColumnScheduleIcon', Icon: GraphicalColumnScheduleIcon },
      { name: 'View reference', export: 'ViewReferenceIcon', Icon: ViewReferenceIcon },
    ],
  },
  {
    label: 'Annotation & documentation',
    icons: [
      { name: 'Revision cloud', export: 'RevisionCloudIcon', Icon: RevisionCloudIcon },
      { name: 'Break line', export: 'BreakLineIcon', Icon: BreakLineIcon },
      { name: 'Centre line', export: 'CentreLineIcon', Icon: CentreLineIcon },
      { name: 'Keynote', export: 'KeynoteIcon', Icon: KeynoteIcon },
      { name: 'Match line', export: 'MatchLineIcon', Icon: MatchLineIcon },
      { name: 'Scale bar', export: 'ScaleBarIcon', Icon: ScaleBarIcon },
      { name: 'Area label', export: 'AreaLabelIcon', Icon: AreaLabelIcon },
      { name: 'Spot elevation', export: 'SpotElevationIcon', Icon: SpotElevationIcon },
      { name: 'Slope arrow', export: 'SlopeArrowIcon', Icon: SlopeArrowIcon },
      { name: 'Angular dim.', export: 'AngularDimensionIcon', Icon: AngularDimensionIcon },
      { name: 'Radial dim.', export: 'RadialDimensionIcon', Icon: RadialDimensionIcon },
      { name: 'Arc length dim.', export: 'ArcLengthDimensionIcon', Icon: ArcLengthDimensionIcon },
      { name: 'Ordinal dim.', export: 'OrdinalDimensionIcon', Icon: OrdinalDimensionIcon },
      { name: 'Spot coordinate', export: 'SpotCoordinateIcon', Icon: SpotCoordinateIcon },
      { name: 'Elevation tag', export: 'ElevationTagIcon', Icon: ElevationTagIcon },
      { name: 'Filled region', export: 'FilledRegionIcon', Icon: FilledRegionIcon },
      { name: 'Masking region', export: 'MaskingRegionIcon', Icon: MaskingRegionIcon },
      { name: 'Detail component', export: 'DetailComponentIcon', Icon: DetailComponentIcon },
      { name: 'Repeating detail', export: 'RepeatingDetailIcon', Icon: RepeatingDetailIcon },
      { name: 'Insulation', export: 'InsulationAnnotationIcon', Icon: InsulationAnnotationIcon },
      { name: 'Text', export: 'TextAnnotationIcon', Icon: TextAnnotationIcon },
      { name: 'Multi-cat. tag', export: 'MultiCategoryTagIcon', Icon: MultiCategoryTagIcon },
      { name: 'Material tag', export: 'MaterialTagIcon', Icon: MaterialTagIcon },
      { name: 'Room tag', export: 'RoomTagIcon', Icon: RoomTagIcon },
      { name: 'Space tag', export: 'SpaceTagIcon', Icon: SpaceTagIcon },
      { name: 'Area tag', export: 'AreaTagIcon', Icon: AreaTagIcon },
      { name: 'Stair tag', export: 'StairTagIcon', Icon: StairTagIcon },
      { name: 'Symbol', export: 'SymbolIcon', Icon: SymbolIcon },
      { name: 'Stair path annot.', export: 'StairPathAnnotationIcon', Icon: StairPathAnnotationIcon },
      { name: 'Reference point', export: 'ReferencePointIcon', Icon: ReferencePointIcon },
    ],
  },
  {
    label: 'Site & civil',
    icons: [
      { name: 'Topography', export: 'TopoIcon', Icon: TopoIcon },
      { name: 'Property line', export: 'PropertyLineIcon', Icon: PropertyLineIcon },
      { name: 'Parking space', export: 'ParkingSpaceIcon', Icon: ParkingSpaceIcon },
      { name: 'Planting / tree', export: 'PlantingIcon', Icon: PlantingIcon },
      { name: 'Road', export: 'RoadIcon', Icon: RoadIcon },
      { name: 'Retaining wall', export: 'RetainingWallIcon', Icon: RetainingWallIcon },
      { name: 'North arrow', export: 'NorthArrowIcon', Icon: NorthArrowIcon },
    ],
  },
  {
    label: 'Organization & coordination',
    icons: [
      { name: 'Family', export: 'FamilyIcon', Icon: FamilyIcon },
      { name: 'Family type', export: 'FamilyTypeIcon', Icon: FamilyTypeIcon },
      { name: 'Group', export: 'GroupIcon', Icon: GroupIcon },
      { name: 'Assembly', export: 'AssemblyIcon', Icon: AssemblyIcon },
      { name: 'Linked model', export: 'LinkedModelIcon', Icon: LinkedModelIcon },
      { name: 'Material', export: 'MaterialIcon', Icon: MaterialIcon },
      { name: 'Wall layer', export: 'WallLayerIcon', Icon: WallLayerIcon },
      { name: 'Phase', export: 'PhaseIcon', Icon: PhaseIcon },
      { name: 'Issue', export: 'IssueIcon', Icon: IssueIcon },
      { name: 'Clash', export: 'ClashIcon', Icon: ClashIcon },
      { name: 'Validation rule', export: 'ValidationRuleIcon', Icon: ValidationRuleIcon },
      { name: 'Deviation', export: 'DeviationIcon', Icon: DeviationIcon },
    ],
  },
  {
    label: 'Workflow & data',
    icons: [
      { name: 'Workset', export: 'WorksetIcon', Icon: WorksetIcon },
      { name: 'Design option', export: 'DesignOptionIcon', Icon: DesignOptionIcon },
      { name: 'Revision', export: 'RevisionIcon', Icon: RevisionIcon },
      { name: 'RFI', export: 'RFIIcon', Icon: RFIIcon },
      { name: 'Submittal', export: 'SubmittalIcon', Icon: SubmittalIcon },
      { name: 'Point cloud', export: 'PointCloudIcon', Icon: PointCloudIcon },
      { name: 'Digital twin', export: 'DigitalTwinIcon', Icon: DigitalTwinIcon },
      { name: 'Sync', export: 'SyncIcon', Icon: SyncIcon },
      { name: 'Transmittal', export: 'TransmittalIcon', Icon: TransmittalIcon },
      { name: 'IFC', export: 'IFCIcon', Icon: IFCIcon },
      { name: 'LOD', export: 'LODIcon', Icon: LODIcon },
      { name: 'Qty takeoff', export: 'QuantityTakeoffIcon', Icon: QuantityTakeoffIcon },
      { name: 'Energy model', export: 'EnergyModelIcon', Icon: EnergyModelIcon },
      { name: 'Scope box', export: 'ScopeBoxIcon', Icon: ScopeBoxIcon },
    ],
  },
  {
    label: 'Edit operations',
    icons: [
      { name: 'Move', export: 'MoveIcon', Icon: MoveIcon },
      { name: 'Copy', export: 'CopyIcon', Icon: CopyIcon },
      { name: 'Rotate', export: 'RotateIcon', Icon: RotateIcon },
      { name: 'Scale', export: 'ScaleIcon', Icon: ScaleIcon },
      { name: 'Offset', export: 'OffsetIcon', Icon: OffsetIcon },
      { name: 'Delete', export: 'DeleteIcon', Icon: DeleteIcon },
      { name: 'Mirror', export: 'MirrorIcon', Icon: MirrorIcon },
      { name: 'Array (linear)', export: 'ArrayLinearIcon', Icon: ArrayLinearIcon },
      { name: 'Array (radial)', export: 'ArrayRadialIcon', Icon: ArrayRadialIcon },
      { name: 'Align', export: 'AlignIcon', Icon: AlignIcon },
      { name: 'Split', export: 'SplitIcon', Icon: SplitIcon },
      { name: 'Trim / extend', export: 'TrimExtendIcon', Icon: TrimExtendIcon },
      { name: 'Void', export: 'VoidIcon', Icon: VoidIcon },
      { name: 'Pin', export: 'PinIcon', Icon: PinIcon },
      { name: 'Unpin', export: 'UnpinIcon', Icon: UnpinIcon },
      { name: 'Join geometry', export: 'JoinGeometryIcon', Icon: JoinGeometryIcon },
      { name: 'Unjoin geometry', export: 'UnjoinGeometryIcon', Icon: UnjoinGeometryIcon },
      { name: 'Switch join', export: 'SwitchJoinOrderIcon', Icon: SwitchJoinOrderIcon },
      { name: 'Wall joins', export: 'WallJoinsIcon', Icon: WallJoinsIcon },
      { name: 'Paint material', export: 'PaintMaterialIcon', Icon: PaintMaterialIcon },
      { name: 'Measure between', export: 'MeasureBetweenIcon', Icon: MeasureBetweenIcon },
      { name: 'Measure along', export: 'MeasureAlongIcon', Icon: MeasureAlongIcon },
      { name: 'Ungroup', export: 'UngroupIcon', Icon: UngroupIcon },
    ],
  },
  {
    label: 'Collaboration',
    icons: [
      { name: 'Reload latest', export: 'ReloadLatestIcon', Icon: ReloadLatestIcon },
      { name: 'Editing request', export: 'EditingRequestIcon', Icon: EditingRequestIcon },
      { name: 'Copy/monitor', export: 'CopyMonitorIcon', Icon: CopyMonitorIcon },
      { name: 'Coord. review', export: 'CoordinationReviewIcon', Icon: CoordinationReviewIcon },
      { name: 'Purge unused', export: 'PurgeUnusedIcon', Icon: PurgeUnusedIcon },
      { name: 'Transfer standards', export: 'TransferProjectStandardsIcon', Icon: TransferProjectStandardsIcon },
      { name: 'Project info', export: 'ProjectInfoIcon', Icon: ProjectInfoIcon },
      { name: 'Project params', export: 'ProjectParametersIcon', Icon: ProjectParametersIcon },
      { name: 'Shared params', export: 'SharedParametersIcon', Icon: SharedParametersIcon },
      { name: 'Object styles', export: 'ObjectStylesIcon', Icon: ObjectStylesIcon },
    ],
  },
];

const ALL_ICONS = SECTIONS.flatMap((s) => s.icons);

const SIZES = [16, 18, 20, 24, 32] as const;
type Size = (typeof SIZES)[number];

const STROKE_WIDTHS = [1, 1.5, 2] as const;
type StrokeWidth = (typeof STROKE_WIDTHS)[number];

function IconCard({
  entry,
  size,
  strokeWidth,
}: {
  entry: IconEntry;
  size: Size;
  strokeWidth: StrokeWidth;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    const text = `import { ${entry.export} } from '@bim-ai/icons'`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }, [entry.export]);

  return (
    <button
      onClick={handleClick}
      title={`Click to copy import for ${entry.export}`}
      className="group relative flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center transition-all hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied && (
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-accent text-xs font-medium text-accent-foreground">
          Copied!
        </span>
      )}
      <entry.Icon
        size={size}
        strokeWidth={strokeWidth}
        className="text-foreground transition-colors group-hover:text-accent"
      />
      <span className="max-w-full truncate text-[11px] text-muted-foreground">{entry.name}</span>
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
        {entry.export}
      </span>
    </button>
  );
}

export function IconGallery() {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<Size>(24);
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>(1.5);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return ALL_ICONS.filter(
      (e) => e.name.toLowerCase().includes(q) || e.export.toLowerCase().includes(q),
    );
  }, [query]);

  const totalCount = ALL_ICONS.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold">@bim-ai/icons</h1>
              <p className="text-[11px] text-muted-foreground">{totalCount} BIM-native icons</p>
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
                <span className="text-[11px] text-muted-foreground">size</span>
                <div className="flex rounded-md border border-border">
                  {SIZES.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={[
                        'px-2 py-0.5 text-[11px] font-mono transition-colors',
                        s === size ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === SIZES.length - 1 ? 'rounded-r-sm' : '',
                      ].filter(Boolean).join(' ')}
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
                      key={sw}
                      onClick={() => setStrokeWidth(sw)}
                      className={[
                        'px-2 py-0.5 text-[11px] font-mono transition-colors',
                        sw === strokeWidth ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === STROKE_WIDTHS.length - 1 ? 'rounded-r-sm' : '',
                      ].filter(Boolean).join(' ')}
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

      <div className="mx-auto max-w-5xl px-6 py-8">
        {filtered !== null ? (
          <div>
            <p className="mb-4 text-[11px] text-muted-foreground">
              {filtered.length === 0
                ? 'No icons match.'
                : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {filtered.map((entry) => (
                <IconCard key={entry.export} entry={entry} size={size} strokeWidth={strokeWidth} />
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
                  <span className="text-[11px] text-muted-foreground/60">{section.icons.length}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                  {section.icons.map((entry) => (
                    <IconCard key={entry.export} entry={entry} size={size} strokeWidth={strokeWidth} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-lg border border-border bg-surface p-5">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Usage</p>
          <pre className="overflow-x-auto rounded bg-surface-strong p-3 font-mono text-[12px] text-foreground">
            {`import { WallIcon, DuctRectIcon, FoundationIcon } from '@bim-ai/icons'\n\n<WallIcon size={18} strokeWidth={1.5} className="text-stone-600" />`}
          </pre>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Click any icon to copy its import statement. All icons accept{' '}
            <code className="rounded bg-surface-strong px-1 font-mono">size</code>,{' '}
            <code className="rounded bg-surface-strong px-1 font-mono">strokeWidth</code>, and any SVG attribute.
          </p>
        </div>
      </div>
    </div>
  );
}
