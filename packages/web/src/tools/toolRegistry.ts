/**
 * Tool registry — spec §16.
 *
 * Single source of truth for the §16 floating tool palette.
 *
 *   - `TOOL_REGISTRY` lists every primary drawing tool with its spec'd
 *     hotkey, BIM AI icon name (resolved via `Icons[icon]`), and per-mode
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
  | 'query'
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'floor-sketch'
  | 'roof'
  | 'roof-sketch'
  | 'room-separation-sketch'
  | 'stair'
  | 'railing'
  | 'room'
  | 'area'
  | 'dimension'
  | 'section'
  | 'elevation'
  | 'grid'
  | 'reference-plane'
  | 'property-line'
  | 'area-boundary'
  | 'masking-region'
  | 'plan-region'
  | 'tag'
  | 'align'
  | 'split'
  | 'trim'
  | 'trim-extend'
  | 'offset'
  | 'mirror'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft'
  | 'duct'
  | 'pipe'
  | 'cable-tray'
  | 'mep-equipment'
  | 'fixture'
  | 'mep-terminal'
  | 'mep-opening-request'
  | 'column'
  | 'beam'
  | 'brace'
  | 'ceiling'
  | 'toposolid_subdivision'
  | 'measure'
  | 'component'
  | 'copy'
  | 'rotate'
  | 'move'
  | 'scale'
  | 'array'
  | 'place-group'
  | 'text'
  | 'leader-text'
  | 'angular-dimension'
  | 'radial-dimension'
  | 'diameter-dimension'
  | 'arc-length-dimension'
  | 'spot-elevation'
  | 'spot-coordinate'
  | 'slope-annotation'
  | 'material-tag'
  | 'north-arrow'
  | 'ramp';

/** Modify-group tool IDs — used by ToolPalette to insert a separator. */
export const MODIFY_TOOL_IDS = new Set<ToolId>([
  'align',
  'split',
  'trim',
  'trim-extend',
  'offset',
  'mirror',
  'copy',
  'move',
  'rotate',
  'scale',
  'array',
  'place-group',
  'wall-join',
]);

export type WorkspaceMode = 'plan' | '3d' | 'section' | 'sheet' | 'schedule';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: IconName;
  /** Hotkey label (the actual key handler is wired by WP-UI-D03). */
  hotkey: string;
  /** Chip label shown on the toolbar button and in the tooltip (e.g. 'W', 'WI'). */
  shortcut?: string;
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
      shortcut: 'V',
      modes: ['plan', '3d', 'section', 'sheet', 'schedule'],
      tooltip: t('tools.select.tooltip'),
    },
    query: {
      id: 'query',
      label: 'Query',
      icon: 'search',
      hotkey: 'Q',
      shortcut: 'Q',
      modes: ['plan'],
      tooltip: 'Inspect imported CAD layer under the pointer',
    },
    wall: {
      id: 'wall',
      label: t('tools.wall.label'),
      icon: 'wall',
      hotkey: 'W',
      shortcut: 'W',
      modes: ['plan', '3d'],
      tooltip: t('tools.wall.tooltip'),
    },
    door: {
      id: 'door',
      label: t('tools.door.label'),
      icon: 'door',
      hotkey: 'D',
      shortcut: 'D',
      modes: ['plan', '3d'],
      tooltip: t('tools.door.tooltip'),
    },
    window: {
      id: 'window',
      label: t('tools.window.label'),
      icon: 'window',
      hotkey: 'Shift+W',
      shortcut: 'WI',
      modes: ['plan', '3d'],
      tooltip: t('tools.window.tooltip'),
    },
    floor: {
      id: 'floor',
      label: t('tools.floor.label'),
      icon: 'floor',
      hotkey: 'F',
      shortcut: 'F',
      modes: ['plan', '3d'],
      tooltip: t('tools.floor.tooltip'),
    },
    'floor-sketch': {
      id: 'floor-sketch',
      label: 'Floor (Sketch)',
      icon: 'floor',
      hotkey: 'Shift+F',
      modes: ['plan'],
      tooltip: 'Author a floor by drawing its boundary loop (Revit-style sketch mode).',
    },
    'roof-sketch': {
      id: 'roof-sketch',
      label: 'Roof (Sketch)',
      icon: 'roof',
      hotkey: 'Shift+O',
      modes: ['plan'],
      tooltip: 'Author a roof by drawing its footprint loop (Revit-style sketch mode).',
    },
    'room-separation-sketch': {
      id: 'room-separation-sketch',
      label: 'Room Separation (Sketch)',
      icon: 'gridLine',
      hotkey: 'RS',
      modes: ['plan'],
      tooltip: 'Draw room separation lines via the sketch session.',
    },
    roof: {
      id: 'roof',
      label: t('tools.roof.label'),
      icon: 'roof',
      hotkey: 'R',
      shortcut: 'R',
      modes: ['plan', '3d'],
      tooltip: t('tools.roof.tooltip'),
    },
    stair: {
      id: 'stair',
      label: t('tools.stair.label'),
      icon: 'stair',
      hotkey: 'S',
      shortcut: 'S',
      modes: ['plan', '3d'],
      tooltip: t('tools.stair.tooltip'),
    },
    railing: {
      id: 'railing',
      label: t('tools.railing.label'),
      icon: 'railing',
      hotkey: 'Shift+R',
      modes: ['plan', '3d'],
      tooltip: t('tools.railing.tooltip'),
    },
    room: {
      id: 'room',
      label: t('tools.room.label'),
      icon: 'room',
      hotkey: 'M',
      shortcut: 'M',
      modes: ['plan', '3d'],
      tooltip: t('tools.room.tooltip'),
    },
    area: {
      id: 'area',
      label: t('tools.area.label'),
      icon: 'room',
      hotkey: 'AA',
      shortcut: 'AA',
      modes: ['plan', '3d'],
      tooltip: t('tools.area.tooltip'),
    },
    dimension: {
      id: 'dimension',
      label: t('tools.dimension.label'),
      icon: 'dimension',
      hotkey: 'Shift+D',
      shortcut: 'DI',
      modes: ['plan', 'section'],
      tooltip: t('tools.dimension.tooltip'),
    },
    measure: {
      id: 'measure',
      label: 'Measure',
      icon: 'measure',
      hotkey: 'ME',
      modes: ['plan'],
      tooltip: 'Measure distance between two points',
    },
    component: {
      id: 'component',
      label: 'Component',
      icon: 'tag',
      hotkey: 'CC',
      shortcut: 'CC',
      modes: ['plan', '3d'],
      tooltip: 'Place a furniture or component family instance',
    },
    section: {
      id: 'section',
      label: t('tools.section.label'),
      icon: 'section',
      hotkey: 'Shift+S',
      modes: ['plan', 'section'],
      tooltip: t('tools.section.tooltip'),
    },
    elevation: {
      id: 'elevation',
      label: t('tools.elevation.label'),
      icon: 'section',
      hotkey: 'EL',
      modes: ['plan'],
      tooltip: t('tools.elevation.tooltip'),
    },
    grid: {
      id: 'grid',
      label: 'Grid Line',
      icon: 'gridLine',
      hotkey: 'GR',
      shortcut: 'GR',
      modes: ['plan', '3d'],
      tooltip: 'Place a grid line (two-click start → end)',
    },
    'reference-plane': {
      id: 'reference-plane',
      label: t('tools.referencePlane.label'),
      icon: 'gridLine',
      hotkey: 'RP',
      modes: ['plan', '3d'],
      tooltip: t('tools.referencePlane.tooltip'),
    },
    'property-line': {
      id: 'property-line',
      label: t('tools.propertyLine.label'),
      icon: 'detailLine',
      hotkey: 'PL',
      modes: ['plan'],
      tooltip: t('tools.propertyLine.tooltip'),
    },
    'area-boundary': {
      id: 'area-boundary',
      label: t('tools.areaBoundary.label'),
      icon: 'detailLine',
      hotkey: 'AB',
      modes: ['plan'],
      tooltip: t('tools.areaBoundary.tooltip'),
    },
    'masking-region': {
      id: 'masking-region',
      label: t('tools.maskingRegion.label'),
      icon: 'detailLine',
      hotkey: 'MR',
      modes: ['plan'],
      tooltip: t('tools.maskingRegion.tooltip'),
    },
    'plan-region': {
      id: 'plan-region',
      label: 'Plan Region',
      icon: 'detailLine',
      hotkey: 'PR',
      modes: ['plan'],
      tooltip: 'Draw a cut-plane override region',
    },
    tag: {
      id: 'tag',
      label: t('tools.tag.label'),
      icon: 'tag',
      hotkey: 'T',
      shortcut: 'T',
      modes: ['plan'],
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
    'trim-extend': {
      id: 'trim-extend',
      label: 'Trim/Extend',
      icon: 'trim',
      hotkey: 'TR',
      modes: ['plan'],
      tooltip: 'Trim or extend two walls so their centerlines meet at a corner (two-click)',
    },
    offset: {
      id: 'offset',
      label: 'Offset',
      icon: 'move',
      hotkey: 'OF',
      shortcut: 'OF',
      modes: ['plan'],
      tooltip: 'Move a selected wall parallel to a clicked offset distance',
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
      modes: ['plan', '3d'],
      tooltip: t('tools.wallOpening.tooltip'),
    },
    shaft: {
      id: 'shaft',
      label: t('tools.shaft.label'),
      icon: 'shaft',
      hotkey: 'SH',
      modes: ['plan', '3d'],
      tooltip: t('tools.shaft.tooltip'),
    },
    duct: {
      id: 'duct',
      label: 'Duct',
      icon: 'duct',
      hotkey: 'DU',
      shortcut: 'DU',
      modes: ['plan', '3d'],
      tooltip: 'Route rectangular or round HVAC ductwork with system metadata.',
    },
    pipe: {
      id: 'pipe',
      label: 'Pipe',
      icon: 'pipe',
      hotkey: 'PI',
      shortcut: 'PI',
      modes: ['plan', '3d'],
      tooltip: 'Route plumbing, heating, cooling, or fire-protection pipework.',
    },
    'cable-tray': {
      id: 'cable-tray',
      label: 'Cable Tray',
      icon: 'cableTray',
      hotkey: 'CT',
      shortcut: 'CT',
      modes: ['plan', '3d'],
      tooltip: 'Route electrical containment with service and clearance metadata.',
    },
    'mep-equipment': {
      id: 'mep-equipment',
      label: 'Equipment',
      icon: 'mepEquipment',
      hotkey: 'EQ',
      shortcut: 'EQ',
      modes: ['plan', '3d'],
      tooltip: 'Place mechanical, electrical, or plumbing equipment.',
    },
    fixture: {
      id: 'fixture',
      label: 'Fixture',
      icon: 'fixture',
      hotkey: 'FX',
      shortcut: 'FX',
      modes: ['plan', '3d'],
      tooltip: 'Place plumbing or electrical fixtures with room load metadata.',
    },
    'mep-terminal': {
      id: 'mep-terminal',
      label: 'Terminal',
      icon: 'mepTerminal',
      hotkey: 'AT',
      shortcut: 'AT',
      modes: ['plan', '3d'],
      tooltip: 'Place air terminals, sprinklers, and MEP devices.',
    },
    'mep-opening-request': {
      id: 'mep-opening-request',
      label: 'Opening Request',
      icon: 'wall-opening',
      hotkey: 'OR',
      shortcut: 'OR',
      modes: ['plan', '3d'],
      tooltip: 'Request coordinated wall, slab, roof, or shaft openings for MEP services.',
    },
    column: {
      id: 'column',
      label: t('tools.column.label'),
      icon: 'column',
      hotkey: 'CO',
      shortcut: 'C',
      modes: ['plan', '3d'],
      tooltip: t('tools.column.tooltip'),
    },
    beam: {
      id: 'beam',
      label: t('tools.beam.label'),
      icon: 'beam',
      hotkey: 'BM',
      modes: ['plan', '3d'],
      tooltip: t('tools.beam.tooltip'),
    },

    brace: {
      id: 'brace',
      label: 'Brace',
      icon: 'beam',
      hotkey: 'BR',
      shortcut: 'BR',
      modes: ['plan', '3d'],
      tooltip: 'Place a diagonal structural brace between two anchor points',
    },
    ceiling: {
      id: 'ceiling',
      label: t('tools.ceiling.label'),
      icon: 'ceiling',
      hotkey: 'CL',
      modes: ['plan', '3d'],
      tooltip: t('tools.ceiling.tooltip'),
    },
    mirror: {
      id: 'mirror',
      label: t('tools.mirror.label'),
      icon: 'mirror',
      hotkey: 'MM',
      modes: ['plan'],
      tooltip: t('tools.mirror.tooltip'),
    },
    copy: {
      id: 'copy',
      label: 'Copy',
      icon: 'copy',
      hotkey: 'CP',
      shortcut: 'CP',
      modes: ['plan'],
      tooltip: 'Copy selected element to a new location (two-point)',
    },
    move: {
      id: 'move',
      label: 'Move',
      icon: 'move',
      hotkey: 'MV',
      shortcut: 'MV',
      modes: ['plan'],
      tooltip:
        'Move selected element(s) by specifying a reference point and destination point (two-click)',
    },
    rotate: {
      id: 'rotate',
      label: 'Rotate',
      icon: 'rotate',
      hotkey: 'RO',
      shortcut: 'RO',
      modes: ['plan'],
      tooltip: 'Rotate selected element(s) around a center point (two-click)',
    },
    scale: {
      id: 'scale',
      label: 'Scale',
      icon: 'scale',
      hotkey: 'RE',
      shortcut: 'RE',
      modes: ['plan'],
      tooltip:
        'Scale selected element(s) about an origin point — numeric factor or two-click reference',
    },
    array: {
      id: 'array',
      label: 'Array',
      icon: 'copy',
      hotkey: 'AR',
      shortcut: 'AR',
      modes: ['plan'],
      tooltip: 'Create linear or radial array copies of selected element(s)',
    },
    'place-group': {
      id: 'place-group',
      label: 'Place Group',
      icon: 'tag',
      hotkey: 'PG',
      shortcut: 'PG',
      modes: ['plan'],
      tooltip: 'Place an instance of a defined model group',
    },
    toposolid_subdivision: {
      id: 'toposolid_subdivision',
      label: 'Subdivide Toposolid',
      icon: 'detailLine',
      hotkey: 'TS',
      shortcut: 'TS',
      modes: ['plan'],
      tooltip: 'Paint a finish-category subdivision region on a toposolid (T → S).',
    },
    text: {
      id: 'text',
      label: 'Text',
      icon: 'text',
      hotkey: 'TX',
      shortcut: 'TX',
      modes: ['plan', 'section'],
      tooltip:
        'Place a free-standing text annotation. Click to place, type text, Enter to confirm.',
    },
    'leader-text': {
      id: 'leader-text',
      label: 'Leader Text',
      icon: 'annotation',
      hotkey: 'LT',
      shortcut: 'LT',
      modes: ['plan', 'section'],
      tooltip:
        'Place leader text (callout). Click anchor, optional elbow point, then text placement.',
    },
    'angular-dimension': {
      id: 'angular-dimension',
      label: 'Angular Dimension',
      icon: 'dimension',
      hotkey: 'AD',
      shortcut: 'AD',
      modes: ['plan', 'section'],
      tooltip: 'Measure angle between two lines. Click line 1, click line 2, place label arc.',
    },
    'radial-dimension': {
      id: 'radial-dimension',
      label: 'Radial Dimension',
      icon: 'dimension',
      hotkey: 'RD',
      shortcut: 'RD',
      modes: ['plan', 'section'],
      tooltip: 'Measure radius of an arc or circle edge. Displays "R 2450".',
    },
    'diameter-dimension': {
      id: 'diameter-dimension',
      label: 'Diameter Dimension',
      icon: 'dimension',
      hotkey: 'DD',
      shortcut: 'DD',
      modes: ['plan', 'section'],
      tooltip: 'Measure diameter of an arc or circle edge. Displays "⌀ 4900".',
    },
    'arc-length-dimension': {
      id: 'arc-length-dimension',
      label: 'Arc Length',
      icon: 'dimension',
      hotkey: 'ALD',
      shortcut: 'ALD',
      modes: ['plan', 'section'],
      tooltip: 'Measure arc length along a curved edge.',
    },
    'spot-elevation': {
      id: 'spot-elevation',
      label: 'Spot Elevation',
      icon: 'measure',
      hotkey: 'SE',
      shortcut: 'SE',
      modes: ['plan', 'section'],
      tooltip: 'Place a spot elevation marker showing the Z-height of a floor or slab point.',
    },
    'spot-coordinate': {
      id: 'spot-coordinate',
      label: 'Spot Coordinate',
      icon: 'measure',
      hotkey: 'SP',
      shortcut: 'SP',
      modes: ['plan'],
      tooltip: 'Place a spot coordinate annotation showing X/Y world coordinates.',
    },
    'slope-annotation': {
      id: 'slope-annotation',
      label: 'Slope Annotation',
      icon: 'measure',
      hotkey: 'SL',
      shortcut: 'SL',
      modes: ['plan'],
      tooltip: 'Annotate a slope between two points. Shows rise/run ratio and percentage.',
    },
    'material-tag': {
      id: 'material-tag',
      label: 'Material Tag',
      icon: 'material',
      hotkey: 'MT',
      shortcut: 'MT',
      modes: ['plan', 'section'],
      tooltip: 'Tag a wall face to display its material layer name.',
    },
    'north-arrow': {
      id: 'north-arrow',
      label: 'North Arrow',
      icon: 'detailLine',
      hotkey: 'NA',
      shortcut: 'NA',
      modes: ['plan', 'sheet'],
      tooltip: 'Place a north arrow annotation symbol on a plan view or sheet.',
    },
    ramp: {
      id: 'ramp',
      label: 'Ramp',
      icon: 'floor' as IconName,
      hotkey: 'RA',
      shortcut: 'RA',
      modes: ['plan'] as WorkspaceMode[],
      tooltip: 'Place a sloped ramp (RA)',
      'mass-box': {
        id: 'mass-box',
        label: 'Box Mass',
        icon: 'floor',
        hotkey: 'MBX',
        shortcut: 'MBX',
        modes: ['plan', '3d'],
        tooltip: 'Place a conceptual box mass volume',
      },
      'mass-extrusion': {
        id: 'mass-extrusion',
        label: 'Extruded Mass',
        icon: 'floor',
        hotkey: 'MEX',
        shortcut: 'MEX',
        modes: ['plan', '3d'],
        tooltip: 'Create an extruded mass from a polygon footprint',
      },
      'mass-revolution': {
        id: 'mass-revolution',
        label: 'Revolved Mass',
        icon: 'floor',
        hotkey: 'MRV',
        shortcut: 'MRV',
        modes: ['plan', '3d'],
        tooltip: 'Create a revolved mass surface around an axis',
      },
    },
  };
}

const MODE_LOOKUP_T = ((key: string) => key) as unknown as TFunction;

export function getToolModes(toolId: ToolId): WorkspaceMode[] {
  return getToolRegistry(MODE_LOOKUP_T)[toolId]?.modes ?? [];
}

export function toolSupportsMode(toolId: ToolId, mode: WorkspaceMode): boolean {
  return getToolModes(toolId).includes(mode);
}

const PALETTE_ORDER: ToolId[] = [
  'select',
  'query',
  'wall',
  'door',
  'window',
  'floor',
  'floor-sketch',
  'roof',
  'roof-sketch',
  'stair',
  'railing',
  'room',
  'area',
  'room-separation-sketch',
  'dimension',
  'measure',
  'component',
  'section',
  'elevation',
  'grid',
  'reference-plane',
  'property-line',
  'area-boundary',
  'masking-region',
  'tag',
  'align',
  'split',
  'trim',
  'trim-extend',
  'offset',
  'mirror',
  'copy',
  'move',
  'rotate',
  'scale',
  'array',
  'place-group',
  'wall-join',
  'wall-opening',
  'shaft',
  'duct',
  'pipe',
  'cable-tray',
  'mep-equipment',
  'fixture',
  'mep-terminal',
  'mep-opening-request',
  'column',
  'beam',
  'mass-box',
  'mass-extrusion',
  'mass-revolution',
  'brace',
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
      return { disabled: false };
    case 'floor-sketch':
      // Sketch mode authors a floor from a boundary loop; it does not depend on walls.
      return { disabled: false };
    case 'roof-sketch':
    case 'room-separation-sketch':
      // Sketch mode draws into a free space; no element preconditions.
      return { disabled: false };
    case 'roof':
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
