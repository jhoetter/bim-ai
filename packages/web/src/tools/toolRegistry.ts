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

import type { TFunction } from 'i18next';

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
  | 'elevation'
  | 'reference-plane'
  | 'property-line'
  | 'tag'
  | 'align'
  | 'split'
  | 'trim'
  | 'mirror'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft'
  | 'column'
  | 'beam'
  | 'ceiling';

/** Modify-group tool IDs — used by ToolPalette to insert a separator. */
export const MODIFY_TOOL_IDS = new Set<ToolId>(['align', 'split', 'trim', 'mirror', 'wall-join']);

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

export function getToolRegistry(t: TFunction): Record<ToolId, ToolDefinition> {
  return {
    select: {
      id: 'select',
      label: t('tools.select.label'),
      icon: 'select',
      hotkey: 'V',
      modes: ['plan', '3d', 'plan-3d', 'section', 'sheet', 'schedule', 'agent'],
      tooltip: t('tools.select.tooltip'),
    },
    wall: {
      id: 'wall',
      label: t('tools.wall.label'),
      icon: 'wall',
      hotkey: 'W',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.wall.tooltip'),
    },
    door: {
      id: 'door',
      label: t('tools.door.label'),
      icon: 'door',
      hotkey: 'D',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.door.tooltip'),
    },
    window: {
      id: 'window',
      label: t('tools.window.label'),
      icon: 'window',
      hotkey: 'Shift+W',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.window.tooltip'),
    },
    floor: {
      id: 'floor',
      label: t('tools.floor.label'),
      icon: 'floor',
      hotkey: 'F',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.floor.tooltip'),
    },
    roof: {
      id: 'roof',
      label: t('tools.roof.label'),
      icon: 'roof',
      hotkey: 'R',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.roof.tooltip'),
    },
    stair: {
      id: 'stair',
      label: t('tools.stair.label'),
      icon: 'stair',
      hotkey: 'S',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.stair.tooltip'),
    },
    railing: {
      id: 'railing',
      label: t('tools.railing.label'),
      icon: 'railing',
      hotkey: 'Shift+R',
      modes: ['plan', 'plan-3d', '3d'],
      tooltip: t('tools.railing.tooltip'),
    },
    room: {
      id: 'room',
      label: t('tools.room.label'),
      icon: 'room',
      hotkey: 'M',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.room.tooltip'),
    },
    dimension: {
      id: 'dimension',
      label: t('tools.dimension.label'),
      icon: 'dimension',
      hotkey: 'Shift+D',
      modes: ['plan', 'plan-3d', 'section'],
      tooltip: t('tools.dimension.tooltip'),
    },
    section: {
      id: 'section',
      label: t('tools.section.label'),
      icon: 'section',
      hotkey: 'Shift+S',
      modes: ['plan', 'plan-3d', 'section'],
      tooltip: t('tools.section.tooltip'),
    },
    elevation: {
      id: 'elevation',
      label: t('tools.elevation.label'),
      icon: 'section',
      hotkey: 'EL',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.elevation.tooltip'),
    },
    'reference-plane': {
      id: 'reference-plane',
      label: t('tools.referencePlane.label'),
      icon: 'gridLine',
      hotkey: 'RP',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.referencePlane.tooltip'),
    },
    'property-line': {
      id: 'property-line',
      label: t('tools.propertyLine.label'),
      icon: 'detailLine',
      hotkey: 'PL',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.propertyLine.tooltip'),
    },
    tag: {
      id: 'tag',
      label: t('tools.tag.label'),
      icon: 'tag',
      hotkey: 'T',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.tag.tooltip'),
    },
    align: {
      id: 'align',
      label: t('tools.align.label'),
      icon: 'align',
      hotkey: 'AL',
      modes: ['plan'],
      tooltip: t('tools.align.tooltip'),
    },
    split: {
      id: 'split',
      label: t('tools.split.label'),
      icon: 'split',
      hotkey: 'SD',
      modes: ['plan'],
      tooltip: t('tools.split.tooltip'),
    },
    trim: {
      id: 'trim',
      label: t('tools.trim.label'),
      icon: 'trim',
      hotkey: 'TR',
      modes: ['plan'],
      tooltip: t('tools.trim.tooltip'),
    },
    'wall-join': {
      id: 'wall-join',
      label: t('tools.wallJoin.label'),
      icon: 'wall-join',
      hotkey: 'WJ',
      modes: ['plan'],
      tooltip: t('tools.wallJoin.tooltip'),
    },
    'wall-opening': {
      id: 'wall-opening',
      label: t('tools.wallOpening.label'),
      icon: 'wall-opening',
      hotkey: 'WO',
      modes: ['plan'],
      tooltip: t('tools.wallOpening.tooltip'),
    },
    shaft: {
      id: 'shaft',
      label: t('tools.shaft.label'),
      icon: 'shaft',
      hotkey: 'SH',
      modes: ['plan'],
      tooltip: t('tools.shaft.tooltip'),
    },
    column: {
      id: 'column',
      label: t('tools.column.label'),
      icon: 'column',
      hotkey: 'CO',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.column.tooltip'),
    },
    beam: {
      id: 'beam',
      label: t('tools.beam.label'),
      icon: 'beam',
      hotkey: 'BM',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.beam.tooltip'),
    },
    ceiling: {
      id: 'ceiling',
      label: t('tools.ceiling.label'),
      icon: 'ceiling',
      hotkey: 'CL',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.ceiling.tooltip'),
    },
    mirror: {
      id: 'mirror',
      label: t('tools.mirror.label'),
      icon: 'mirror',
      hotkey: 'MM',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.mirror.tooltip'),
    },
  };
}

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
  'elevation',
  'reference-plane',
  'property-line',
  'tag',
  'align',
  'split',
  'trim',
  'mirror',
  'wall-join',
  'wall-opening',
  'shaft',
  'column',
  'beam',
  'ceiling',
];

export function paletteForMode(mode: WorkspaceMode, t: TFunction): ToolDefinition[] {
  const registry = getToolRegistry(t);
  return PALETTE_ORDER.map((id) => registry[id]).filter((tool) => tool.modes.includes(mode));
}

export interface ToolDisabledContext {
  hasAnyWall: boolean;
  hasAnyFloor: boolean;
  hasAnySelection: boolean;
}

export function isToolDisabled(
  toolId: ToolId,
  ctx: ToolDisabledContext,
  t: TFunction,
): { disabled: boolean; reason?: string } {
  switch (toolId) {
    case 'floor':
      if (!ctx.hasAnyWall) return { disabled: true, reason: t('tools.disabled.drawWallFirst') };
      return { disabled: false };
    case 'roof':
      if (!ctx.hasAnyWall) return { disabled: true, reason: t('tools.disabled.drawWallFirst') };
      return { disabled: false };
    case 'railing':
      if (!ctx.hasAnyFloor && !ctx.hasAnyWall) {
        return { disabled: true, reason: t('tools.disabled.addStairFirst') };
      }
      return { disabled: false };
    case 'dimension':
      if (!ctx.hasAnyWall)
        return { disabled: true, reason: t('tools.disabled.nothingToDimension') };
      return { disabled: false };
    default:
      return { disabled: false };
  }
}
