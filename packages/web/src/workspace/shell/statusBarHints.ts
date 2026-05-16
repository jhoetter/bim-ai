export function getStatusHint(planTool: string | null, toolPhase: string | null): string {
  if (!planTool || planTool === 'select') {
    return 'Click to select · Drag to pan · Scroll to zoom';
  }
  switch (planTool) {
    case 'wall':
      return toolPhase === 'drawing'
        ? 'Click next point · Double-click or Enter to finish · Esc to cancel'
        : 'Click to start wall';
    case 'floor':
      return toolPhase === 'drawing'
        ? 'Click to add point · Enter to finish · Esc to cancel'
        : 'Click points to define floor boundary';
    case 'column':
      return 'Click to place column';
    case 'stair':
      return toolPhase === 'drawing'
        ? 'Click to set stair end point'
        : 'Click to place stair run start';
    case 'room':
      return 'Click inside a bounded area to place room';
    case 'door':
      return 'Click on a wall to place door';
    case 'window':
      return 'Click on a wall to place window';
    case 'measure':
      return toolPhase === 'picking'
        ? 'Click second point · Esc to cancel'
        : 'Click first point to measure';
    case 'measure-angle':
      if (toolPhase === 'picked-vertex') return 'Click first ray point';
      if (toolPhase === 'picked-first-ray') return 'Click second ray point';
      return 'Click vertex point';
    case 'paint':
      return 'Click a face to apply material';
    case 'permanent-dimension':
      return toolPhase === 'picking'
        ? 'Click next point · Enter to finish'
        : 'Click first witness point';
    case 'split-wall':
      return 'Hover a wall and click to split';
    default:
      return 'Press Esc to cancel · Press Enter to finish';
  }
}
