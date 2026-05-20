import type { Element } from '@bim-ai/core';

interface PointMm {
  xMm: number;
  yMm: number;
}

/**
 * Generates two wall elements flanking the shaft opening on its longest axis.
 * The walls run the full depth of the shaft perimeter bounding box.
 * Returns an empty array if the shaft has fewer than 3 perimeter points.
 */
export function buildShaftSideWalls(
  shaft: Extract<Element, { kind: 'shaft' }>,
  levelId: string,
  wallThicknessMm = 200,
): Array<Extract<Element, { kind: 'wall' }>> {
  const pts: PointMm[] = shaft.boundaryMm ?? [];
  if (pts.length < 3) return [];

  // Compute bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.xMm);
    maxX = Math.max(maxX, p.xMm);
    minY = Math.min(minY, p.yMm);
    maxY = Math.max(maxY, p.yMm);
  }

  const width = maxX - minX;
  const depth = maxY - minY;

  // Generate walls along the longer dimension
  const isWide = width >= depth;

  if (isWide) {
    // Two walls along the Y sides (top and bottom)
    return [
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        name: 'Shaft Side Wall',
        levelId,
        startMm: { xMm: minX, yMm: minY - wallThicknessMm / 2 },
        endMm: { xMm: maxX, yMm: minY - wallThicknessMm / 2 },
        thicknessMm: wallThicknessMm,
        heightMm: 3000,
      } as unknown as Extract<Element, { kind: 'wall' }>,
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        name: 'Shaft Side Wall',
        levelId,
        startMm: { xMm: minX, yMm: maxY + wallThicknessMm / 2 },
        endMm: { xMm: maxX, yMm: maxY + wallThicknessMm / 2 },
        thicknessMm: wallThicknessMm,
        heightMm: 3000,
      } as unknown as Extract<Element, { kind: 'wall' }>,
    ];
  } else {
    // Two walls along the X sides (left and right)
    return [
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        name: 'Shaft Side Wall',
        levelId,
        startMm: { xMm: minX - wallThicknessMm / 2, yMm: minY },
        endMm: { xMm: minX - wallThicknessMm / 2, yMm: maxY },
        thicknessMm: wallThicknessMm,
        heightMm: 3000,
      } as unknown as Extract<Element, { kind: 'wall' }>,
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        name: 'Shaft Side Wall',
        levelId,
        startMm: { xMm: maxX + wallThicknessMm / 2, yMm: minY },
        endMm: { xMm: maxX + wallThicknessMm / 2, yMm: maxY },
        thicknessMm: wallThicknessMm,
        heightMm: 3000,
      } as unknown as Extract<Element, { kind: 'wall' }>,
    ];
  }
}
