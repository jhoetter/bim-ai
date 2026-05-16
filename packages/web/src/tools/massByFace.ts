import type { Element } from '@bim-ai/core';

export type MassElem = Extract<Element, { kind: 'mass' }>;

/** Get the corners of a mass face at a given index.
 *  For an N-sided footprint:
 *  - face 0: bottom polygon (at base elevation)
 *  - face 1: top polygon (at base + height)
 *  - face 2..N+1: vertical side faces (i-2: edge from footprint[i-2] to footprint[i-1])
 */
export function getMassFaceCorners(
  mass: MassElem,
  faceIndex: number,
  baseElevationMm: number,
): { xMm: number; yMm: number; zMm: number }[] {
  const fp = mass.footprintMm;
  const n = fp.length;
  const topZ = baseElevationMm + mass.heightMm;

  if (faceIndex === 0) {
    // Bottom face
    return fp.map((p) => ({ xMm: p.xMm, yMm: p.yMm, zMm: baseElevationMm }));
  }
  if (faceIndex === 1) {
    // Top face
    return fp.map((p) => ({ xMm: p.xMm, yMm: p.yMm, zMm: topZ }));
  }
  // Side face
  const edgeIdx = faceIndex - 2;
  if (edgeIdx < 0 || edgeIdx >= n) return [];
  const a = fp[edgeIdx];
  const b = fp[(edgeIdx + 1) % n];
  return [
    { xMm: a.xMm, yMm: a.yMm, zMm: baseElevationMm },
    { xMm: b.xMm, yMm: b.yMm, zMm: baseElevationMm },
    { xMm: b.xMm, yMm: b.yMm, zMm: topZ },
    { xMm: a.xMm, yMm: a.yMm, zMm: topZ },
  ];
}

/** Get the total number of faces on a mass element (bottom + top + N sides). */
export function getMassFaceCount(mass: MassElem): number {
  return 2 + mass.footprintMm.length;
}

/** Compute the floor boundary (horizontal cross-section) of a mass at a given elevation. */
export function getMassFloorBoundaryAtElevation(
  mass: MassElem,
  elevationMm: number,
  baseElevationMm: number,
): { xMm: number; yMm: number }[] | null {
  const topElev = baseElevationMm + mass.heightMm;
  if (elevationMm < baseElevationMm - 1 || elevationMm > topElev + 1) return null;
  // For a prismatic mass, horizontal cross-section equals the footprint
  return mass.footprintMm.map((p) => ({ xMm: p.xMm, yMm: p.yMm }));
}

/** Check if a mass face is vertical (a side face). */
export function isMassFaceVertical(faceIndex: number, fp: { xMm: number; yMm: number }[]): boolean {
  return faceIndex >= 2 && faceIndex < 2 + fp.length;
}

/** Check if a mass face is horizontal (top or bottom). */
export function isMassFaceHorizontal(faceIndex: number): boolean {
  return faceIndex === 0 || faceIndex === 1;
}
