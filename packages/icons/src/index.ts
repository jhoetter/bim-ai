/**
 * @bim-ai/icons — BIM-native SVG icon library.
 *
 * Drop-in compatible with lucide-react's icon API:
 *
 *   import { WallIcon, DoorIcon } from '@bim-ai/icons'
 *   <WallIcon size={18} strokeWidth={1.5} className="text-stone-600" />
 *
 * All icons are 24×24 viewBox, stroke-based, currentColor.
 * Props: size, strokeWidth, absoluteStrokeWidth, plus any SVG attribute.
 */

export type { BimIcon, BimIconProps, BimIconHifiProps } from './icon';

// High-fidelity 48×48 icons
export {
  WallHifi,
  DoorHifi,
  WindowHifi,
  StairHifi,
  ColumnHifi,
  BeamHifi,
  RoofHifi,
  RoomHifi,
  SectionHifi,
  FloorHifi,
} from './hifi';

// Phase 1 — drawing tools
export {
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
} from './tools';

// Phase 2 — views & annotations (original)
export {
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
} from './views';

// Phase 3 — organization & coordination (original)
export {
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
} from './organization';

// MEP — mechanical, electrical & plumbing
export {
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
} from './mep';

// Structural
export {
  FoundationIcon,
  StripFootingIcon,
  TrussIcon,
  BraceIcon,
  RebarIcon,
  StructuralConnectionIcon,
} from './structural';

// Architectural additions
export {
  CeilingIcon,
  OpeningIcon,
  ShaftOpeningIcon,
  RampIcon,
  MassIcon,
  CurtainPanelIcon,
  MullionIcon,
  SkyLightIcon,
  PartitionIcon,
} from './architectural';

// Site & civil
export {
  TopoIcon,
  PropertyLineIcon,
  ParkingSpaceIcon,
  PlantingIcon,
  RoadIcon,
  RetainingWallIcon,
  NorthArrowIcon,
} from './site';

// Annotation & documentation
export {
  RevisionCloudIcon,
  BreakLineIcon,
  CentreLineIcon,
  KeynoteIcon,
  MatchLineIcon,
  ScaleBarIcon,
  AreaLabelIcon,
  SpotElevationIcon,
  SlopeArrowIcon,
} from './annotation';

// Workflow, coordination & data
export {
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
} from './workflow';

// Edit / geometry operations
export {
  MirrorIcon,
  ArrayLinearIcon,
  ArrayRadialIcon,
  AlignIcon,
  SplitIcon,
  TrimExtendIcon,
  VoidIcon,
  PinIcon,
  UnpinIcon,
} from './edit';

// Architectural extended
export {
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
} from './architectural-extended';

// Structural extended
export {
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
} from './structural-extended';

// MEP extended
export {
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
} from './mep-extended';

// Views extended
export {
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
} from './views-extended';

// Annotation extended
export {
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
} from './annotation-extended';

// Edit basic / modify operations
export {
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
} from './edit-basic';

// Collaboration & project management
export {
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
} from './collaboration';
