import type { Element } from '@bim-ai/core';
import { isPhysicalHostedOpeningWall } from '../../viewport/directAuthoringGuards';

export type NearestWallHit = {
  wall: Extract<Element, { kind: 'wall' }>;
  alongT: number;
  distMm: number;
};

/**
 * Find the closest opening-host-eligible wall to a point.
 *
 * PERF-G04: callers pass a precomputed wall slice (typically
 * `modelIndices.wallsByLevel[displayLevelId] ?? modelIndices.walls`) so this
 * helper does not need to scan `elementsById` on every pointermove / click.
 */
export function nearestWallAt(
  walls: Iterable<Extract<Element, { kind: 'wall' }>>,
  xMm: number,
  yMm: number,
): NearestWallHit | undefined {
  const px = xMm / 1000;
  const pz = yMm / 1000;
  let best: NearestWallHit | undefined;
  for (const el of walls) {
    if (!isPhysicalHostedOpeningWall(el)) continue;
    const ax = el.start.xMm / 1000;
    const az = el.start.yMm / 1000;
    const bx = el.end.xMm / 1000;
    const bz = el.end.yMm / 1000;
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz;
    const rawT = Math.max(
      0,
      Math.min(1, ((px - ax) * abx + (pz - az) * abz) / Math.max(len2, 1e-9)),
    );
    const fx = ax + abx * rawT;
    const fz = az + abz * rawT;
    const distMm = Math.hypot((px - fx) * 1000, (pz - fz) * 1000);
    if (!best || distMm < best.distMm) best = { wall: el, alongT: rawT, distMm };
  }
  return best;
}
