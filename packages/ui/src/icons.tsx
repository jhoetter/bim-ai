import type { ComponentType, SVGAttributes } from 'react';
import {
  AgentIcon,
  AlignIcon,
  AlertTriangleIcon,
  // Phase 1 — drawing tools
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
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CollaboratorsIcon,
  CommandPaletteIcon,
  CopyIcon,
  // Phase 2 — views & annotations
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
  DownloadIcon,
  EvidenceIcon,
  ExternalLinkIcon,
  // Phase 3 — organization & coordination
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
  RFIIcon,
  RevisionCloudIcon,
  TextAnnotationIcon,
  PanelScheduleViewIcon,
  GraphicalColumnScheduleIcon,
  FocusIcon,
  GridIcon,
  HomeIcon,
  LinkIcon,
  MeasureBetweenIcon,
  MenuIcon,
  MirrorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  MoveIcon,
  OnlineIcon,
  OpeningIcon,
  RedoIcon,
  RefreshIcon,
  RotateIcon,
  SearchIcon,
  SelectIcon,
  SettingsIcon,
  ShaftOpeningIcon,
  SnapIcon,
  SplitIcon,
  SunIcon,
  ThinLineIcon,
  TrimExtendIcon,
  UndoIcon,
  VisibilityOffIcon,
  VisibilityOnIcon,
  WallJoinsIcon,
} from '@bim-ai/icons';

/**
 * BIM AI chrome icon set — the single import surface for icon usage outside
 * the canvas. BIM-specific and generic chrome icons both come from
 * `@bim-ai/icons`.
 *
 * Default visual rules (spec §10):
 *   - Default size 16 px in dense chrome; 18 px in tool palette; 20 px in
 *     TopBar. Pass `size` prop to override.
 *   - Default stroke width 1.5; selected state 2.0.
 *   - Color inherits `currentColor` so theme tokens drive it.
 *
 * Every icon-only button must pair its icon with `aria-label` (spec §22).
 */

export type BimIconComponent = ComponentType<
  SVGAttributes<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }
>;

/** @deprecated use StairIcon from @bim-ai/icons. Kept for test backwards compat. */
export { StairIcon as StairsIcon } from '@bim-ai/icons';

/** Spec §10.1 "concept → icon" registry. Single source of truth for chrome
 * icons. Tools / shell / dialogs read from here so the assignments can be
 * audited as a unit. */
export const Icons: Record<string, BimIconComponent> = {
  // Selection & manipulation
  select: SelectIcon,

  // Modify tools
  align: AlignIcon,
  copy: CopyIcon,
  measure: MeasureBetweenIcon,
  split: SplitIcon,
  trim: TrimExtendIcon,
  'wall-join': WallJoinsIcon,
  'wall-opening': OpeningIcon,
  shaft: ShaftOpeningIcon,
  mirror: MirrorIcon,
  move: MoveIcon,
  rotate: RotateIcon,

  // Drawing tools — all now BIM-native from @bim-ai/icons
  wall: WallIcon,
  door: DoorIcon,
  window: WindowIcon,
  floor: FloorIcon,
  roof: RoofIcon,
  stair: StairIcon,
  railing: RailingIcon,
  room: RoomIcon,
  dimension: DimensionIcon,
  section: SectionIcon,
  tag: TagIcon,
  curtainWall: CurtainWallIcon,
  column: ColumnIcon,
  beam: BeamIcon,
  ceiling: CeilingIcon,

  // Views & documentation — BIM-native
  planView: PlanViewIcon,
  sectionView: SectionViewIcon,
  elevationView: ElevationViewIcon,
  orbitView: OrbitViewIcon,
  sheet: SheetIcon,
  schedule: ScheduleViewIcon,
  callout: CalloutIcon,
  viewpoint: ViewpointIcon,
  sectionBox: SectionBoxIcon,
  gridLine: GridLineIcon,
  level: LevelIcon,
  detailLine: DetailLineIcon,

  // Organization & data — BIM-native
  family: FamilyIcon,
  familyType: FamilyTypeIcon,
  group: GroupIcon,
  assembly: AssemblyIcon,
  linkedModel: LinkedModelIcon,
  material: MaterialIcon,
  wallLayer: WallLayerIcon,
  phase: PhaseIcon,

  // Coordination — BIM-native
  issue: IssueIcon,
  clash: ClashIcon,
  validationRule: ValidationRuleIcon,
  deviation: DeviationIcon,
  comment: RFIIcon,
  check: CheckIcon,

  // Camera / view
  saveViewpoint: CameraIcon,
  layerOn: VisibilityOnIcon,
  layerOff: VisibilityOffIcon,
  viewCubeReset: HomeIcon,

  // History
  undo: UndoIcon,
  redo: RedoIcon,

  // F-006: QAT buttons
  thinLines: ThinLineIcon,

  // Theme
  themeLight: SunIcon,
  themeDark: MoonIcon,

  // Navigation / global chrome
  commandPalette: CommandPaletteIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  hamburger: MenuIcon,
  collaborators: CollaboratorsIcon,
  close: CloseIcon,
  externalLink: ExternalLinkIcon,
  proportional: LinkIcon,

  // Disclosure
  disclosureClosed: ChevronRightIcon,
  disclosureOpen: ChevronDownIcon,

  // Status / signals
  agent: AgentIcon,
  evidence: EvidenceIcon,
  advisorWarning: AlertTriangleIcon,
  online: OnlineIcon,
  snap: SnapIcon,
  grid: GridIcon,
  activity: ClockIcon,
  download: DownloadIcon,
  focus: FocusIcon,
  refresh: RefreshIcon,
  moreHorizontal: MoreHorizontalIcon,
  moreVertical: MoreVerticalIcon,

  // Sheet markup and schedule editing — BIM-native
  annotation: DetailLineIcon,
  pen: DetailLineIcon,
  arrowRight: DetailLineIcon,
  draftingCloud: RevisionCloudIcon,
  text: TextAnnotationIcon,
  tableRows: PanelScheduleViewIcon,
  tableColumns: GraphicalColumnScheduleIcon,
};

/** Human-readable default labels for `aria-label` on icon-only buttons. */
export const IconLabels: Record<keyof typeof Icons, string> = {
  select: 'Select',
  align: 'Align',
  copy: 'Copy',
  measure: 'Measure',
  split: 'Split element',
  trim: 'Trim / Extend',
  'wall-join': 'Wall Join',
  'wall-opening': 'Wall Opening',
  shaft: 'Shaft',
  mirror: 'Mirror',
  move: 'Move',
  rotate: 'Rotate',
  wall: 'Wall',
  door: 'Door',
  window: 'Window',
  floor: 'Floor',
  roof: 'Roof',
  stair: 'Stair',
  railing: 'Railing',
  room: 'Room',
  dimension: 'Dimension',
  section: 'Section',
  tag: 'Tag',
  curtainWall: 'Curtain wall',
  column: 'Column',
  beam: 'Beam',
  ceiling: 'Ceiling',
  planView: 'Plan view',
  sectionView: 'Section view',
  elevationView: 'Elevation view',
  orbitView: '3D view',
  sheet: 'Sheet',
  schedule: 'Schedule',
  callout: 'Callout',
  viewpoint: 'Viewpoint',
  sectionBox: 'Section box',
  gridLine: 'Grid line',
  level: 'Level',
  detailLine: 'Detail line',
  family: 'Family',
  familyType: 'Family type',
  group: 'Group',
  assembly: 'Assembly',
  linkedModel: 'Linked model',
  material: 'Material',
  wallLayer: 'Wall layer',
  phase: 'Phase',
  issue: 'Issue',
  clash: 'Clash',
  validationRule: 'Validation rule',
  deviation: 'Deviation',
  comment: 'Comment',
  check: 'Resolve',
  saveViewpoint: 'Save viewpoint',
  layerOn: 'Show layer',
  layerOff: 'Hide layer',
  viewCubeReset: 'Reset view',
  undo: 'Undo',
  redo: 'Redo',
  thinLines: 'Thin Lines',
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  commandPalette: 'Command palette',
  search: 'Search',
  settings: 'Settings',
  hamburger: 'Toggle navigation',
  collaborators: 'Collaborators',
  close: 'Close',
  externalLink: 'Open in new context',
  proportional: 'Link proportional',
  disclosureClosed: 'Expand',
  disclosureOpen: 'Collapse',
  agent: 'Agent',
  evidence: 'Evidence',
  advisorWarning: 'Advisor warning',
  online: 'Online',
  snap: 'Snap',
  grid: 'Grid',
  activity: 'Activity',
  download: 'Download',
  focus: 'Focus selection',
  refresh: 'Refresh',
  moreHorizontal: 'More options',
  moreVertical: 'More options',
  annotation: 'Annotation',
  pen: 'Freehand markup',
  arrowRight: 'Arrow markup',
  draftingCloud: 'Revision cloud',
  text: 'Text annotation',
  tableRows: 'Schedule rows',
  tableColumns: 'Schedule columns',
};

export type IconName = keyof typeof Icons;

/** Default icon sizes per spec §10. */
export const ICON_SIZE = {
  chrome: 16,
  toolPalette: 18,
  topbar: 20,
} as const;

// Re-export all BIM icons so consumers can import them from @bim-ai/ui without
// adding a direct dependency on @bim-ai/icons.
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
  CeilingIcon,
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
  RFIIcon,
  RevisionCloudIcon,
  TextAnnotationIcon,
  PanelScheduleViewIcon,
  GraphicalColumnScheduleIcon,
} from '@bim-ai/icons';
