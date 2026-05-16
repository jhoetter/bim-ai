import type { Element } from '@bim-ai/core';

export interface StairRailingSpec {
  stairId: string;
  side: 'left' | 'right';
  pathMm: Array<{ xMm: number; yMm: number }>;
  railingHeightMm: number;
}

/** Derive railing path from a stair element for a given side. */
export function deriveStairRailingPath(
  stair: Extract<Element, { kind: 'stair' }>,
  side: 'left' | 'right',
): Array<{ xMm: number; yMm: number }> {
  // Use the stair run geometry to compute the edge path on the given side.
  // For a simple straight stair (runStartMm / runEndMm):
  //   - left edge: offset the run line by widthMm/2 perpendicular to the left
  //   - right edge: offset to the right
  // Returns the path as a 2-point polyline (start, end) for simple stairs.
  // For multi-run stairs, compute the outer edge of each run.
  const w = (stair.widthMm ?? 900) / 2;
  const dx = stair.runEndMm.xMm - stair.runStartMm.xMm;
  const dy = stair.runEndMm.yMm - stair.runStartMm.yMm;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len; // normal perpendicular to run
  const ny = dx / len;
  const sign = side === 'left' ? 1 : -1;
  return [
    { xMm: stair.runStartMm.xMm + sign * nx * w, yMm: stair.runStartMm.yMm + sign * ny * w },
    { xMm: stair.runEndMm.xMm + sign * nx * w, yMm: stair.runEndMm.yMm + sign * ny * w },
  ];
}

/** Build railing element specs that should be auto-created for a stair. */
export function buildAutoRailingsForStair(
  stair: Extract<Element, { kind: 'stair' }>,
): StairRailingSpec[] {
  return [
    {
      stairId: stair.id,
      side: 'left',
      pathMm: deriveStairRailingPath(stair, 'left'),
      railingHeightMm: 900,
    },
    {
      stairId: stair.id,
      side: 'right',
      pathMm: deriveStairRailingPath(stair, 'right'),
      railingHeightMm: 900,
    },
  ];
}
