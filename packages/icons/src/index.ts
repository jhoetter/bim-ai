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

export type { BimIcon, BimIconProps } from './icon';

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
