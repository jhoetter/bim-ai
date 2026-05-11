import type { PerspectiveId } from '@bim-ai/core';

import type { PlanTool } from '../state/store';

const ALL_TOOLS: readonly PlanTool[] = [
  'select',
  'wall',
  'door',
  'window',
  'room',
  'room_rectangle',
  'grid',
  'dimension',
  'floor-sketch',
  'roof-sketch',
  'room-separation-sketch',
  'toposolid_subdivision',
];

/** Narrow plan toolbar by discipline perspective. */
export function planToolsForPerspective(perspective: PerspectiveId): readonly PlanTool[] {
  switch (perspective) {
    case 'architecture':
    case 'agent':
    case 'coordination':
      return ALL_TOOLS;
    case 'structure':
      return ALL_TOOLS.filter((tool) => tool !== 'door' && tool !== 'window');
    case 'mep':
      return ALL_TOOLS.filter((tool) => ['select', 'grid', 'dimension', 'wall'].includes(tool));
    case 'construction':
      return ALL_TOOLS.filter((tool) =>
        ['select', 'wall', 'room', 'room_rectangle', 'grid', 'dimension'].includes(tool),
      );
    default: {
      const _never: never = perspective;
      return _never;
    }
  }
}
