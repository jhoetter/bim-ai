import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };

/**
 * Returns the IDs of floor elements that fall within the shaft's vertical extent
 * (between baseLevelId and topLevelId elevation) and overlap the shaft perimeter.
 */
export function computeShaftCutFloors(
  shaft: Extract<Element, { kind: 'shaft' }>,
  elementsById: Record<string, Element | undefined>,
): string[] {
  const levels = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level',
  );
  const baseLevel = levels.find((l) => l.id === shaft.baseLevelId);
  const topLevel = levels.find((l) => l.id === shaft.topLevelId);

  const baseElev = baseLevel?.elevationMm ?? 0;
  const topElev = topLevel?.elevationMm ?? Infinity;

  const shaftPerim: PointMm[] = shaft.boundaryMm ?? [];
  if (shaftPerim.length < 3) return [];

  return Object.values(elementsById)
    .filter((el): el is Extract<Element, { kind: 'floor' }> => {
      if (!el || el.kind !== 'floor') return false;
      const floorLevel = levels.find((l) => l.id === el.levelId);
      const floorElev = floorLevel?.elevationMm ?? 0;
      // Floor must be within the shaft's vertical extent
      if (floorElev < baseElev || floorElev > topElev) return false;
      // Check if floor boundary overlaps shaft perimeter (simple centroid check)
      const floorPerim: PointMm[] = el.boundaryMm ?? [];
      if (floorPerim.length === 0) return false;
      const cx = floorPerim.reduce((s, p) => s + p.xMm, 0) / floorPerim.length;
      const cy = floorPerim.reduce((s, p) => s + p.yMm, 0) / floorPerim.length;
      return pointInPolygon({ xMm: cx, yMm: cy }, shaftPerim);
    })
    .map((el) => el.id);
}

export function pointInPolygon(pt: PointMm, polygon: PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.xMm,
      yi = polygon[i]!.yMm;
    const xj = polygon[j]!.xMm,
      yj = polygon[j]!.yMm;
    const intersect =
      yi > pt.yMm !== yj > pt.yMm && pt.xMm < ((xj - xi) * (pt.yMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
