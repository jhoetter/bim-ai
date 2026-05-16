import type { Element } from '@bim-ai/core';
import { getMassFloorBoundaryAtElevation } from './massByFace';

export type MassElem = Extract<Element, { kind: 'mass' }>;
export type LevelElem = Extract<Element, { kind: 'level' }>;

export interface FloorCommand {
  levelId: string;
  boundary: { xMm: number; yMm: number }[];
  elevationMm: number;
}

/**
 * For each project level that intersects the mass volume, compute a floor boundary.
 * Returns a list of floor commands to be dispatched.
 */
export function computeFloorsByLevel(
  mass: MassElem,
  levels: LevelElem[],
  baseElevationMm: number,
): FloorCommand[] {
  const topMm = baseElevationMm + mass.heightMm;
  const result: FloorCommand[] = [];

  for (const lvl of levels) {
    const elev = lvl.elevationMm;
    if (elev < baseElevationMm - 1 || elev > topMm + 1) continue;
    const boundary = getMassFloorBoundaryAtElevation(mass, elev, baseElevationMm);
    if (!boundary || boundary.length < 3) continue;
    result.push({ levelId: lvl.id, boundary, elevationMm: elev });
  }

  return result;
}
