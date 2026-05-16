import type { BoundaryPoint, Element } from '@bim-ai/core';

/** Returns the axis-aligned bounding polygon (4-corner rect) of a stair in plan (mm). */
export function stairBoundaryMm(stair: Extract<Element, { kind: 'stair' }>): BoundaryPoint[] {
  const sx = stair.runStartMm.xMm;
  const sy = stair.runStartMm.yMm;
  const ex = stair.runEndMm.xMm;
  const ey = stair.runEndMm.yMm;

  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular unit vector (rotate 90° CCW)
  const px = len > 0 ? -dy / len : 0;
  const py = len > 0 ? dx / len : 1;

  const halfW = stair.widthMm / 2;

  return [
    { xMm: sx + px * halfW, yMm: sy + py * halfW },
    { xMm: ex + px * halfW, yMm: ey + py * halfW },
    { xMm: ex - px * halfW, yMm: ey - py * halfW },
    { xMm: sx - px * halfW, yMm: sy - py * halfW },
  ];
}
