import type { XY } from '@bim-ai/core';

const ROTATE_SNAP_INCREMENT_DEG = 45;

function normalizeSignedAngleDeg(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  let normalized = ((angleDeg % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function rawAngleFromPoints(center: XY, point: XY): number {
  return (Math.atan2(point.yMm - center.yMm, point.xMm - center.xMm) * 180) / Math.PI;
}

export function snapRotateAngleDeg(angleDeg: number): number {
  const snapped = Math.round(angleDeg / ROTATE_SNAP_INCREMENT_DEG) * ROTATE_SNAP_INCREMENT_DEG;
  return normalizeSignedAngleDeg(snapped);
}

export function rotateAngleFromPoints(center: XY, point: XY): number {
  const rawDeg = rawAngleFromPoints(center, point);
  return snapRotateAngleDeg(rawDeg);
}

export function rotateDeltaAngleFromReference(center: XY, reference: XY, point: XY): number {
  return snapRotateAngleDeg(
    rawAngleFromPoints(center, point) - rawAngleFromPoints(center, reference),
  );
}

export function parseTypedRotateAngle(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/deg(?:rees?)?$/i, '')
    .replace(/°$/, '')
    .trim();
  if (normalized === '') return null;
  const angleDeg = Number(normalized);
  return Number.isFinite(angleDeg) ? normalizeSignedAngleDeg(angleDeg) : null;
}
