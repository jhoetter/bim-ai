import type { XY } from '@bim-ai/core';

export function moveDeltaMm(
  anchor: XY,
  target: XY,
  orthogonal: boolean,
): { dxMm: number; dyMm: number } {
  const dx = target.xMm - anchor.xMm;
  const dy = target.yMm - anchor.yMm;
  if (!orthogonal) return { dxMm: dx, dyMm: dy };
  return Math.abs(dx) >= Math.abs(dy) ? { dxMm: dx, dyMm: 0 } : { dxMm: 0, dyMm: dy };
}
