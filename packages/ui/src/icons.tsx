import type { ComponentType, SVGAttributes } from 'react';
import {
  AlertTriangle,
  AlignCenterHorizontal,
  Camera,
  Copy,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Command,
  ExternalLink,
  Eye,
  EyeOff,
  FileBadge2,
  FlipHorizontal2,
  GitMerge,
  Grid3x3,
  Home,
  Link2,
  Magnet,
  Menu,
  Minus,
  Moon,
  MousePointer2,
  Move,
  Layers,
  Redo2,
  RotateCw,
  Ruler,
  Scissors,
  Search,
  SquareDashed,
  Settings2,
  Sparkles,
  Sun,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import {
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
  DuctRectIcon,
  PipeIcon,
  CableTrayIcon,
  MechanicalEquipmentIcon,
  PlumbingFixtureIcon,
  DiffuserIcon,
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
} from '@bim-ai/icons';

/**
 * BIM AI chrome icon set — the single import surface for icon usage outside
 * the canvas. BIM-specific icons come from `@bim-ai/icons`; generic chrome
 * icons (chevrons, close, search, etc.) come from `lucide-react`.
 *
 * Default visual rules (spec §10):
 *   - Default size 16 px in dense chrome; 18 px in tool palette; 20 px in
 *     TopBar. Pass `size` prop to override.
 *   - Default stroke width 1.5; selected state 2.0.
 *   - Color inherits `currentColor` so theme tokens drive it.
 *
 * Every icon-only button must pair its icon with `aria-label` (spec §22).
 */

export type LucideLikeIcon = ComponentType<
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
export const Icons: Record<string, LucideLikeIcon> = {
  // Selection & manipulation
  select: MousePointer2,

  // Modify tools
  align: AlignCenterHorizontal,
  copy: Copy,
  measure: Ruler,
  split: Scissors,
  trim: GitMerge,
  'wall-join': GitMerge,
  'wall-opening': SquareDashed,
  shaft: Layers,
  mirror: FlipHorizontal2,
  move: Move,
  rotate: RotateCw,

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
  duct: DuctRectIcon,
  pipe: PipeIcon,
  cableTray: CableTrayIcon,
  mepEquipment: MechanicalEquipmentIcon,
  fixture: PlumbingFixtureIcon,
  mepTerminal: DiffuserIcon,

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
  check: ValidationRuleIcon,

  // Camera / view — lucide (generic)
  saveViewpoint: Camera,
  layerOn: Eye,
  layerOff: EyeOff,
  viewCubeReset: Home,

  // History — lucide (generic)
  undo: Undo2,
  redo: Redo2,

  // F-006: QAT buttons — lucide (generic)
  thinLines: Minus,

  // Theme — lucide (generic)
  themeLight: Sun,
  themeDark: Moon,

  // Navigation / global chrome — lucide (generic)
  commandPalette: Command,
  search: Search,
  settings: Settings2,
  hamburger: Menu,
  collaborators: Users,
  close: X,
  externalLink: ExternalLink,
  proportional: Link2,

  // Disclosure — lucide (generic)
  disclosureClosed: ChevronRight,
  disclosureOpen: ChevronDown,

  // Status / signals — lucide (generic) + BIM-native
  agent: Sparkles,
  evidence: FileBadge2,
  advisorWarning: AlertTriangle,
  online: CircleDot,
  snap: Magnet,
  grid: Grid3x3,

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
  duct: 'Duct',
  pipe: 'Pipe',
  cableTray: 'Cable tray',
  mepEquipment: 'MEP equipment',
  fixture: 'Fixture',
  mepTerminal: 'MEP terminal',
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
  DuctRectIcon,
  PipeIcon,
  CableTrayIcon,
  MechanicalEquipmentIcon,
  PlumbingFixtureIcon,
  DiffuserIcon,
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
