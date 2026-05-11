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
      return ALL_TOOLS.filter((x) => ['select', 'grid', 'dimension', 'wall'].includes(x));

    case 'construction':
      return ALL_TOOLS.filter((x) =>
        ['select', 'wall', 'room', 'room_rectangle', 'grid', 'dimension'].includes(x),
      );

    default: {
      const _never: never = p;
      return _never;
    }
  }
}
