/**
 * @bim-ai/icons — BIM-native SVG icon library.
 *
 * Drop-in compatible with the app's standard icon component API:
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

// Architectural hifi
export {
  RailingHifi,
  CurtainWallHifi,
  CeilingHifi,
  OpeningHifi,
  RampHifi,
  PartitionHifi,
  TagHifi,
  DimensionHifi,
  MassHifi,
} from './hifi-architectural';

// MEP hifi
export {
  DuctRectHifi,
  DuctRoundHifi,
  PipeHifi,
  CableTrayHifi,
  MechanicalEquipmentHifi,
  PlumbingFixtureHifi,
  LightingFixtureHifi,
  MepSpaceHifi,
} from './hifi-mep';

// Structural hifi
export {
  FoundationHifi,
  StripFootingHifi,
  TrussHifi,
  BraceHifi,
  RebarHifi,
  StructuralConnectionHifi,
} from './hifi-structural';

// Views hifi
export {
  PlanViewHifi,
  SectionViewHifi,
  ElevationViewHifi,
  SheetHifi,
  ScheduleViewHifi,
  CalloutHifi,
  GridLineHifi,
  LevelHifi,
} from './hifi-views';

// Organization hifi
export {
  FamilyHifi,
  FamilyTypeHifi,
  GroupHifi,
  LinkedModelHifi,
  MaterialHifi,
  PhaseHifi,
  IssueHifi,
  ClashHifi,
} from './hifi-organization';

// Site & annotation hifi
export {
  TopoHifi,
  PropertyLineHifi,
  NorthArrowHifi,
  RevisionCloudHifi,
  ScaleBarHifi,
  AreaLabelHifi,
  KeynoteHifi,
  SpotElevationHifi,
} from './hifi-site-annotation';

// Misc hifi — views & org additions
export {
  OrbitViewHifi,
  ViewpointHifi,
  SectionBoxHifi,
  DetailLineHifi,
  AssemblyHifi,
  WallLayerHifi,
  ValidationRuleHifi,
  DeviationHifi,
} from './hifi-misc-a';

// Misc hifi — MEP & architectural additions
export {
  ConduitHifi,
  ElectricalPanelHifi,
  FireSprinklerHifi,
  DiffuserHifi,
  ShaftOpeningHifi,
  CurtainPanelHifi,
  MullionHifi,
  SkyLightHifi,
} from './hifi-misc-b';

// Misc hifi — site & annotation additions
export {
  ParkingSpaceHifi,
  PlantingHifi,
  RoadHifi,
  RetainingWallHifi,
  BreakLineHifi,
  CentreLineHifi,
  MatchLineHifi,
  SlopeArrowHifi,
} from './hifi-misc-c';

// Workflow hifi
export {
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
} from './hifi-workflow';

// Edit geometry operations hifi
export {
  MirrorHifi,
  ArrayLinearHifi,
  ArrayRadialHifi,
  AlignHifi,
  SplitHifi,
  TrimExtendHifi,
  VoidHifi,
  PinHifi,
  UnpinHifi,
} from './hifi-edit-ops';

// Edit basic / modify operations hifi
export {
  MoveHifi,
  CopyHifi,
  RotateHifi,
  ScaleHifi,
  OffsetHifi,
  DeleteHifi,
  JoinGeometryHifi,
  UnjoinGeometryHifi,
  SwitchJoinOrderHifi,
  WallJoinsHifi,
  PaintMaterialHifi,
  MeasureBetweenHifi,
  MeasureAlongHifi,
  UngroupHifi,
} from './hifi-edit-basic';

// Collaboration hifi
export {
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
} from './hifi-collaboration';

// Architectural extended hifi (first half)
export {
  WallSweepHifi,
  WallRevealHifi,
  ComponentHifi,
  RoofExtrusionHifi,
  RoofSoffitHifi,
  FasciaHifi,
  GutterHifi,
  CurtainSystemHifi,
  CurtainGridHifi,
} from './hifi-arch-ext-a';

// Architectural extended hifi (second half)
export {
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
} from './hifi-arch-ext-b';

// Structural extended hifi
export {
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
} from './hifi-structural-ext';

// MEP extended hifi (first half)
export {
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
} from './hifi-mep-ext-a';

// MEP extended hifi (second half)
export {
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
} from './hifi-mep-ext-b';

// Views extended hifi
export {
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
} from './hifi-views-ext';

// Annotation extended hifi (first half)
export {
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
} from './hifi-annotation-ext-a';

// Annotation extended hifi (second half)
export {
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
} from './hifi-annotation-ext-b';

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

// App chrome, navigation, and utility icons
export {
  SelectIcon,
  SearchIcon,
  SettingsIcon,
  MenuIcon,
  CloseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  CameraIcon,
  CommandPaletteIcon,
  ExternalLinkIcon,
  VisibilityOnIcon,
  VisibilityOffIcon,
  EvidenceIcon,
  GridIcon,
  HomeIcon,
  LinkIcon,
  SnapIcon,
  ThinLineIcon,
  MoonIcon,
  SunIcon,
  UndoIcon,
  RedoIcon,
  AgentIcon,
  CollaboratorsIcon,
  OnlineIcon,
  DownloadIcon,
  FocusIcon,
  RefreshIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  CheckIcon,
  ClockIcon,
} from './chrome';

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
