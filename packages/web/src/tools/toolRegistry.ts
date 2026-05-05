/**
 * Tool registry — spec §16.
 *
 * Single source of truth for the §16 floating tool palette.
 *
 *   - `TOOL_REGISTRY` lists every primary drawing tool with its spec'd
 *     hotkey, lucide icon name (resolved via `Icons[icon]`), and per-mode
 *     visibility.
 *   - `paletteForMode(mode)` returns the ordered tool buttons for a
 *     given workspace mode (Plan, 3D, Plan+3D, Section, etc.).
 *   - `isToolDisabled(tool, document)` lets the palette dim tools that
 *     can't activate (e.g. Floor before any walls exist).
 *
 * Per-tool grammar specs (location-line cycle, chain mode, sketch-vs-
 * pick, etc.) live in `tools/<tool>.ts` and are referenced from this
 * registry by the `kind` discriminator.
 */

import type { IconName } from '@bim-ai/ui';

export type ToolId =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'railing'
  | 'room'
  | 'dimension'
  | 'section'
  | 'tag';

export type WorkspaceMode = 'plan' | '3d' | 'plan-3d' | 'section' | 'sheet' | 'schedule' | 'agent';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: IconName;
  /** Hotkey label (the actual key handler is wired by WP-UI-D03). */
  hotkey: string;
  /** Workspace modes where this tool button shows. */
  modes: WorkspaceMode[];
  /** Optional helper text shown in the tooltip. */
  tooltip?: string;
}

export const TOOL_REGISTRY: Record<ToolId, ToolDefinition> = {
  select: {
    id: 'select',
    label: 'Select',
    icon: 'select',
    hotkey: 'V',
    modes: ['plan', '3d', 'plan-3d', 'section', 'sheet', 'schedule', 'agent'],
    tooltip: 'Pick or marquee-select elements',
  },
  wall: {
    id: 'wall',
    label: 'Wall',
    icon: 'wall',
    hotkey: 'W',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Draw a wall (chain mode; Tab cycles location-line)',
  },
  door: {
    id: 'door',
    label: 'Door',
    icon: 'door',
    hotkey: 'D',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Insert door on wall (Spacebar flips swing)',
  },
  window: {
    id: 'window',
    label: 'Window',
    icon: 'window',
    hotkey: 'Shift+W',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Insert window on wall',
  },
  floor: {
    id: 'floor',
    label: 'Floor',
    icon: 'floor',
    hotkey: 'F',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Pick walls or sketch a floor outline',
  },
  roof: {
    id: 'roof',
    label: 'Roof',
    icon: 'roof',
    hotkey: 'R',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Pick walls or sketch a roof outline',
  },
  stair: {
    id: 'stair',
    label: 'Stair',
    icon: 'stair',
    hotkey: 'S',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Two-click run; auto-computes risers',
  },
  railing: {
    id: 'railing',
    label: 'Railing',
    icon: 'railing',
    hotkey: 'Shift+R',
    modes: ['plan', 'plan-3d', '3d'],
    tooltip: 'Pick host (stair / slab edge) or sketch path',
  },
  room: {
    id: 'room',
    label: 'Room',
    icon: 'room',
    hotkey: 'M',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Drop room marker in centroid of bounded area',
  },
  dimension: {
    id: 'dimension',
    label: 'Dimension',
    icon: 'dimension',
    hotkey: 'Shift+D',
    modes: ['plan', 'plan-3d', 'section'],
    tooltip: 'Linear / Aligned / Angular / Radial / Diameter',
  },
  section: {
    id: 'section',
    label: 'Section',
    icon: 'section',
    hotkey: 'Shift+S',
    modes: ['plan', 'plan-3d', 'section'],
    tooltip: 'Two-click section line + depth direction',
  },
  tag: {
    id: 'tag',
    label: 'Tag',
    icon: 'tag',
    hotkey: 'T',
    modes: ['plan', 'plan-3d'],
    tooltip: 'Tag dropdown (Door / Window / Wall / Room / By category)',
  },
};

/** Ordered palette layout per spec §16.1: select | tools | tag-subdropdown. */
const PALETTE_ORDER: ToolId[] = [
  'select',
  'wall',
  'door',
  'window',
  'floor',
  'roof',
  'stair',
  'railing',
  'room',
  'dimension',
  'section',
  'tag',
];

export function paletteForMode(mode: WorkspaceMode): ToolDefinition[] {
  return PALETTE_ORDER.map((id) => TOOL_REGISTRY[id]).filter((t) => t.modes.includes(mode));
}

export interface ToolDisabledContext {
  hasAnyWall: boolean;
  hasAnyFloor: boolean;
  hasAnySelection: boolean;
}

/** Tool-level enablement — `floor` requires a wall, `railing` requires a
 * stair or floor, etc. Used by §16.2 to dim disabled buttons. */
export function isToolDisabled(
  toolId: ToolId,
  ctx: ToolDisabledContext,
): { disabled: boolean; reason?: string } {
  switch (toolId) {
    case 'floor':
      if (!ctx.hasAnyWall) return { disabled: true, reason: 'Draw a wall first' };
      return { disabled: false };
    case 'roof':
      if (!ctx.hasAnyWall) return { disabled: true, reason: 'Draw a wall first' };
      return { disabled: false };
    case 'railing':
      if (!ctx.hasAnyFloor && !ctx.hasAnyWall) {
        return { disabled: true, reason: 'Add a stair or slab first' };
      }
      return { disabled: false };
    case 'dimension':
      if (!ctx.hasAnyWall) return { disabled: true, reason: 'Nothing to dimension' };
      return { disabled: false };
    default:
      return { disabled: false };
  }
}
