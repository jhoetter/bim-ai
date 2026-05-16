import type { Element } from '@bim-ai/core';

/** Compute the axis-aligned bounding-box shaft boundary from a stair's footprint. */
export function shaftBoundaryFromStair(
  stair: Extract<Element, { kind: 'stair' }>,
): { xMm: number; yMm: number }[] | null {
  let points: { xMm: number; yMm: number }[] = [];

  if (stair.boundaryMm && stair.boundaryMm.length >= 3) {
    points = stair.boundaryMm;
  } else if (stair.runStartMm && stair.runEndMm && stair.widthMm) {
    const sx = stair.runStartMm.xMm;
    const sy = stair.runStartMm.yMm;
    const ex = stair.runEndMm.xMm;
    const ey = stair.runEndMm.yMm;
    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return null;
    const px = -dy / len;
    const py = dx / len;
    const halfW = stair.widthMm / 2;
    points = [
      { xMm: sx + px * halfW, yMm: sy + py * halfW },
      { xMm: ex + px * halfW, yMm: ey + py * halfW },
      { xMm: ex - px * halfW, yMm: ey - py * halfW },
      { xMm: sx - px * halfW, yMm: sy - py * halfW },
    ];
  } else {
    return null;
  }

  const xs = points.map((p) => p.xMm);
  const ys = points.map((p) => p.yMm);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return [
    { xMm: minX, yMm: minY },
    { xMm: maxX, yMm: minY },
    { xMm: maxX, yMm: maxY },
    { xMm: minX, yMm: maxY },
  ];
}
