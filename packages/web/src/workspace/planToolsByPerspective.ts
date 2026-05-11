import type { PerspectiveId } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import type { ToolId, WorkspaceMode } from '../tools/toolRegistry';

const ALL_TOOLS: readonly PlanTool[] = [
  'select',
  'wall',
  'door',
  'window',
  'room',
  'room_rectangle',
  'area',
  'grid',
  'dimension',
  'tag',
  'floor-sketch',
  'roof-sketch',
  'room-separation-sketch',
  'area-boundary',
  'toposolid_subdivision',
];

/** Narrow plan toolbar by discipline perspective */
export function planToolsForPerspective(p: PerspectiveId): readonly PlanTool[] {
  switch (p) {
    case 'architecture':
    case 'agent':
    case 'coordination':
      return ALL_TOOLS;

    case 'structure':
      return ALL_TOOLS.filter((x) => x !== 'door' && x !== 'window');

    case 'mep':
      return ALL_TOOLS.filter((x) => ['select', 'grid', 'dimension', 'tag', 'wall'].includes(x));

    case 'construction':
      return ALL_TOOLS.filter((x) =>
        ['select', 'wall', 'room', 'room_rectangle', 'grid', 'dimension', 'tag'].includes(x),
      );

    default: {
      const _never: never = p;
      return _never;
    }
  }
}

export function paletteToolAllowlistForPerspective(
  mode: WorkspaceMode,
  perspective: PerspectiveId,
): ReadonlySet<ToolId> | undefined {
  if (mode !== 'plan' && mode !== 'plan-3d') return undefined;
  return new Set(planToolsForPerspective(perspective).map(planToolToPaletteToolId));
}

function planToolToPaletteToolId(tool: PlanTool): ToolId {
  if (tool === 'room_rectangle') return 'room';
  if (tool === 'grid') return 'select';
  return tool as ToolId;
}
