import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;

/**
 * Compute a ceiling boundary from walls on the same level that enclose clickMm.
 *
 * Uses the bounding box of walls whose AABB contains the click point. Returns
 * null when no walls exist on the level or the click falls outside their extent.
 */
export function detectCeilingBoundary(
  clickMm: { xMm: number; yMm: number },
  walls: WallElem[],
  levelId: string,
): { xMm: number; yMm: number }[] | null {
  const levelWalls = walls.filter((w) => w.levelId === levelId);
  if (levelWalls.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const w of levelWalls) {
    if (w.start.xMm < minX) minX = w.start.xMm;
    if (w.start.xMm > maxX) maxX = w.start.xMm;
    if (w.end.xMm < minX) minX = w.end.xMm;
    if (w.end.xMm > maxX) maxX = w.end.xMm;
    if (w.start.yMm < minY) minY = w.start.yMm;
    if (w.start.yMm > maxY) maxY = w.start.yMm;
    if (w.end.yMm < minY) minY = w.end.yMm;
    if (w.end.yMm > maxY) maxY = w.end.yMm;
  }

  if (clickMm.xMm <= minX || clickMm.xMm >= maxX || clickMm.yMm <= minY || clickMm.yMm >= maxY) {
    return null;
  }

  return [
    { xMm: minX, yMm: minY },
    { xMm: maxX, yMm: minY },
    { xMm: maxX, yMm: maxY },
    { xMm: minX, yMm: maxY },
  ];
}
