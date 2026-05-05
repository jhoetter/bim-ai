import type { ComponentType, SVGAttributes } from 'react';
import {
  AlertTriangle,
  BrickWall,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Command,
  Component,
  DoorOpen,
  ExternalLink,
  Eye,
  EyeOff,
  FileBadge2,
  FileText,
  GalleryVerticalEnd,
  Grid3x3,
  Home,
  LayoutGrid,
  Link2,
  Magnet,
  Menu,
  Moon,
  MousePointer2,
  RectangleHorizontal,
  Redo2,
  Ruler,
  Scissors,
  Search,
  Settings2,
  Slash,
  Sparkles,
  Square,
  Sun,
  Table,
  Tag,
  Triangle,
  Undo2,
  Users,
  X,
} from 'lucide-react';

/**
 * BIM AI chrome icon set — the single import surface for icon usage outside
 * the canvas. Sourced from `lucide-react` per spec §10. Custom SVGs are
 * only permitted for documented lucide gaps (currently `Stairs`); canvas
 * symbology lives separately under `packages/web/src/plan/symbology/*`.
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

/** Lucide-equivalent custom icon. Used only where lucide-react lacks a glyph
 * (e.g. `Stairs`). Stroke style mimics lucide's default `1.5` width to keep
 * the chrome cohesive. */
export const StairsIcon: LucideLikeIcon = ({
  size = 24,
  strokeWidth = 1.5,
  absoluteStrokeWidth: _absoluteStrokeWidth,
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="M21 4h-5v4h-4v4H8v4H3v4h18z" />
  </svg>
);

/** Spec §10.1 "concept → icon" registry. Single source of truth for chrome
 * icons. Tools / shell / dialogs read from here so the assignments can be
 * audited as a unit. */
export const Icons: Record<string, LucideLikeIcon> = {
  // Selection & manipulation
  select: MousePointer2,

  // Drawing tools
  wall: BrickWall,
  wallAlt: Slash,
  door: DoorOpen,
  window: RectangleHorizontal,
  floor: LayoutGrid,
  roof: Triangle,
  stair: StairsIcon,
  railing: GalleryVerticalEnd,
  room: Square,
  dimension: Ruler,
  section: Scissors,

  // Documents
  sheet: FileText,
  schedule: Table,
  family: Component,

  // Camera / view
  saveViewpoint: Camera,
  layerOn: Eye,
  layerOff: EyeOff,
  viewCubeReset: Home,

  // History
  undo: Undo2,
  redo: Redo2,

  // Theme
  themeLight: Sun,
  themeDark: Moon,

  // Navigation / global chrome
  commandPalette: Command,
  search: Search,
  settings: Settings2,
  hamburger: Menu,
  collaborators: Users,
  close: X,
  externalLink: ExternalLink,
  proportional: Link2,

  // Disclosure
  disclosureClosed: ChevronRight,
  disclosureOpen: ChevronDown,

  // Status / signals
  agent: Sparkles,
  evidence: FileBadge2,
  advisorWarning: AlertTriangle,
  online: CircleDot,
  snap: Magnet,
  grid: Grid3x3,

  // Tags
  tag: Tag,
};

/** Human-readable default labels used for `aria-label` when an icon button
 * does not provide its own. Keep these in sync with Icons keys. */
export const IconLabels: Record<keyof typeof Icons, string> = {
  select: 'Select',
  wall: 'Wall',
  wallAlt: 'Wall',
  door: 'Door',
  window: 'Window',
  floor: 'Floor',
  roof: 'Roof',
  stair: 'Stair',
  railing: 'Railing',
  room: 'Room',
  dimension: 'Dimension',
  section: 'Section',
  sheet: 'Sheet',
  schedule: 'Schedule',
  family: 'Family',
  saveViewpoint: 'Save viewpoint',
  layerOn: 'Show layer',
  layerOff: 'Hide layer',
  viewCubeReset: 'Reset view',
  undo: 'Undo',
  redo: 'Redo',
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
  tag: 'Tag',
};

export type IconName = keyof typeof Icons;

/** Default icon sizes per spec §10. */
export const ICON_SIZE = {
  chrome: 16,
  toolPalette: 18,
  topbar: 20,
} as const;
