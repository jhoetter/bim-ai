import type { Element } from '@bim-ai/core';

interface PointMm {
  xMm: number;
  yMm: number;
}

/**
 * Finds all wall element IDs whose endpoints are within `toleranceMm` of `cornerMm`.
 * Returns an array of wall IDs (empty if none found).
 *
 * §3.5.5 — used by the wall-join tool to discover which walls share a corner.
 */
export function findWallsAtCorner(
  cornerMm: PointMm,
  elementsById: Record<string, Element>,
  toleranceMm = 100,
): string[] {
  const result: string[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'wall') continue;
    const wall = el as Extract<Element, { kind: 'wall' }>;
    const startDist = Math.hypot(wall.start.xMm - cornerMm.xMm, wall.start.yMm - cornerMm.yMm);
    const endDist = Math.hypot(wall.end.xMm - cornerMm.xMm, wall.end.yMm - cornerMm.yMm);
    if (startDist <= toleranceMm || endDist <= toleranceMm) {
      result.push(wall.id);
    }
  }
  return result;
}
