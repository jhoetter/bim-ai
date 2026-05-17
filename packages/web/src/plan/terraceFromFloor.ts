import type { FloorElem, RailingElem } from '@bim-ai/core';

/**
 * Builds a railing element that traces the perimeter of a floor boundary.
 * Returns null if the floor has no boundary.
 */
export function buildTerraceRailing(floor: FloorElem, railingHeightMm: number): RailingElem | null {
  const pts = floor.boundaryMm;
  if (!pts || pts.length < 3) return null;

  // Close the path by repeating the first point
  const path = [...pts, pts[0]];

  return {
    id: crypto.randomUUID(),
    kind: 'railing',
    name: `Terrace Railing`,
    pathMm: path,
    railingHeightMm,
  } as RailingElem;
}
