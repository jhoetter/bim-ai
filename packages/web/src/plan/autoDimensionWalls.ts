/**
 * §4.1 — autoDimensionWalls utility.
 *
 * Generates permanent_dimension elements from a set of wall elements.
 * Groups walls by axis (horizontal vs vertical), collects all endpoints,
 * sorts them, and emits one dimension chain per axis group.
 */
import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };
type PermanentDim = Extract<Element, { kind: 'permanent_dimension' }>;

/**
 * Auto-dimensions a set of walls with aligned dimension chains.
 * For walls aligned along a given axis (horizontal or vertical), generates
 * a permanent_dimension element spanning the endpoints.
 *
 * Returns an array of new permanent_dimension elements to add.
 */
export function autoDimensionWalls(
  walls: Extract<Element, { kind: 'wall' }>[],
  offsetMm = 1000,
): PermanentDim[] {
  const dims: PermanentDim[] = [];

  // Group walls by rough angle (horizontal vs vertical).
  // Walls with |dx| > |dy| are horizontal; the rest are vertical.
  const horizontal = walls.filter((w) => {
    const dx = w.end.xMm - w.start.xMm;
    const dy = w.end.yMm - w.start.yMm;
    return Math.abs(dx) > Math.abs(dy);
  });
  const vertical = walls.filter((w) => !horizontal.includes(w));

  // Horizontal walls → dimension from leftmost to rightmost endpoint.
  if (horizontal.length >= 1) {
    const pts: PointMm[] = [];
    for (const w of horizontal) {
      pts.push({ xMm: w.start.xMm, yMm: w.start.yMm });
      pts.push({ xMm: w.end.xMm, yMm: w.end.yMm });
    }
    const sorted = [...pts].sort((a, b) => a.xMm - b.xMm);
    if (sorted.length >= 2) {
      const avgY = sorted.reduce((s, p) => s + p.yMm, 0) / sorted.length;
      dims.push({
        kind: 'permanent_dimension',
        id: crypto.randomUUID(),
        levelId: horizontal[0]!.levelId,
        witnessPointsMm: sorted.map((p) => ({ xMm: p.xMm, yMm: avgY })),
        offsetMm: { xMm: 0, yMm: -offsetMm },
        eqEnabled: false,
      } as PermanentDim);
    }
  }

  // Vertical walls → dimension from bottom to top.
  if (vertical.length >= 1) {
    const pts: PointMm[] = [];
    for (const w of vertical) {
      pts.push({ xMm: w.start.xMm, yMm: w.start.yMm });
      pts.push({ xMm: w.end.xMm, yMm: w.end.yMm });
    }
    const sorted = [...pts].sort((a, b) => a.yMm - b.yMm);
    if (sorted.length >= 2) {
      const avgX = sorted.reduce((s, p) => s + p.xMm, 0) / sorted.length;
      dims.push({
        kind: 'permanent_dimension',
        id: crypto.randomUUID(),
        levelId: vertical[0]!.levelId,
        witnessPointsMm: sorted.map((p) => ({ xMm: avgX, yMm: p.yMm })),
        offsetMm: { xMm: -offsetMm, yMm: 0 },
        eqEnabled: false,
      } as PermanentDim);
    }
  }

  return dims;
}

/**
 * Auto-dimensions selected elements: walls, columns, openings.
 * Returns new permanent_dimension elements to add to the model.
 */
export function autoDimensionElements(elements: Element[], offsetMm = 1000): PermanentDim[] {
  const walls = elements.filter((e): e is Extract<Element, { kind: 'wall' }> => e.kind === 'wall');
  return autoDimensionWalls(walls, offsetMm);
}
