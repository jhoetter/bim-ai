import type { XY } from '@bim-ai/core';

const ROTATE_SNAP_INCREMENT_DEG = 45;

function normalizeSignedAngleDeg(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  let normalized = ((angleDeg % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function snapRotateAngleDeg(angleDeg: number): number {
  const snapped = Math.round(angleDeg / ROTATE_SNAP_INCREMENT_DEG) * ROTATE_SNAP_INCREMENT_DEG;
  return normalizeSignedAngleDeg(snapped);
}

export function rotateAngleFromPoints(center: XY, point: XY): number {
  const rawDeg = (Math.atan2(point.yMm - center.yMm, point.xMm - center.xMm) * 180) / Math.PI;
  return snapRotateAngleDeg(rawDeg);
}
