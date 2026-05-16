import type { Element } from '@bim-ai/core';

export type GridLineElem = Extract<Element, { kind: 'grid_line' }>;

/** Compute the intersection point of two non-parallel grid lines. Returns null if parallel. */
export function gridLineIntersection(
  a: GridLineElem,
  b: GridLineElem,
): { xMm: number; yMm: number } | null {
  const ax1 = a.start.xMm,
    ay1 = a.start.yMm;
  const ax2 = a.end.xMm,
    ay2 = a.end.yMm;
  const bx1 = b.start.xMm,
    by1 = b.start.yMm;
  const bx2 = b.end.xMm,
    by2 = b.end.yMm;

  const dax = ax2 - ax1,
    day = ay2 - ay1;
  const dbx = bx2 - bx1,
    dby = by2 - by1;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-6) return null;

  const t = ((bx1 - ax1) * dby - (by1 - ay1) * dbx) / denom;
  return { xMm: ax1 + t * dax, yMm: ay1 + t * day };
}

/**
 * Given a list of selected grid lines, return unique intersection points for all
 * pairwise non-parallel pairs. Duplicates (within 1mm) are filtered out.
 */
export function columnPositionsAtGridIntersections(
  grids: GridLineElem[],
): { xMm: number; yMm: number }[] {
  const points: { xMm: number; yMm: number }[] = [];
  for (let i = 0; i < grids.length; i++) {
    for (let j = i + 1; j < grids.length; j++) {
      const pt = gridLineIntersection(grids[i]!, grids[j]!);
      if (!pt) continue;
      const isDuplicate = points.some((p) => Math.hypot(p.xMm - pt.xMm, p.yMm - pt.yMm) < 1.0);
      if (!isDuplicate) points.push(pt);
    }
  }
  return points;
}
