import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };
type WallElement = Extract<Element, { kind: 'wall' }>;
type WallWithLegacyEndpoints = WallElement & {
  startMm?: PointMm;
  endMm?: PointMm;
};

/**
 * Detects the floor boundary by finding wall elements on the active level
 * and computing their inner-face convex hull (or bounding box as fallback).
 *
 * Returns null if no enclosing walls are found.
 */
export function detectFloorBoundaryFromWalls(
  clickMm: PointMm,
  elementsById: Record<string, Element | undefined>,
  activeLevelId: string | null,
): PointMm[] | null {
  const walls = Object.values(elementsById).filter(
    (el): el is WallElement =>
      el?.kind === 'wall' && (activeLevelId == null || el.levelId === activeLevelId),
  );

  if (walls.length === 0) return null;

  // Collect all wall endpoints
  const pts: PointMm[] = [];
  for (const wall of walls) {
    const legacyWall = wall as WallWithLegacyEndpoints;
    if (legacyWall.startMm) pts.push(legacyWall.startMm);
    if (legacyWall.endMm) pts.push(legacyWall.endMm);
    // Also support the start/end shape used by the wall element
    if (wall.start) pts.push(wall.start);
    if (wall.end) pts.push(wall.end);
  }

  if (pts.length < 3) return null;

  // Compute convex hull (simple gift-wrapping / Andrew's monotone chain)
  return convexHull(pts);
}

export function convexHull(pts: PointMm[]): PointMm[] {
  // Sort lexicographically by x then y
  const sorted = [...pts].sort((a, b) => a.xMm - b.xMm || a.yMm - b.yMm);
  const cross = (o: PointMm, a: PointMm, b: PointMm) =>
    (a.xMm - o.xMm) * (b.yMm - o.yMm) - (a.yMm - o.yMm) * (b.xMm - o.xMm);

  const lower: PointMm[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: PointMm[] = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  // Remove last point of each half (it's repeated at the start of the other)
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
