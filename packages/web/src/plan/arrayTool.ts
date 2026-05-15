import type { XY } from '@bim-ai/core';

export type ArrayMode = 'linear' | 'radial';

export interface LinearArrayParams {
  mode: 'linear';
  startMm: XY;
  endMm: XY;
  count: number; // total items including source
  moveToLast: boolean; // true = end is last copy; false = end is 2nd copy
}

export interface RadialArrayParams {
  mode: 'radial';
  centerMm: XY;
  angleDeg: number; // total sweep angle
  count: number; // total items including source
}

export type ArrayParams = LinearArrayParams | RadialArrayParams;

/**
 * Returns `count` offset vectors (index 0 = original = {dxMm:0, dyMm:0}).
 *
 * moveToLast=true  → end point is the position of the LAST copy;
 *                    spacing = total vector / (count - 1)
 * moveToLast=false → end point is the position of the 2nd copy (= 1 step);
 *                    spacing = end - start (the raw step vector)
 */
export function linearArrayOffsets(
  params: LinearArrayParams,
): Array<{ dxMm: number; dyMm: number }> {
  const { startMm, endMm, count, moveToLast } = params;

  const totalDx = endMm.xMm - startMm.xMm;
  const totalDy = endMm.yMm - startMm.yMm;

  let stepDx: number;
  let stepDy: number;

  if (moveToLast) {
    // end is last copy → divide total by (count - 1) steps
    const steps = Math.max(count - 1, 1);
    stepDx = totalDx / steps;
    stepDy = totalDy / steps;
  } else {
    // end is 2nd copy → (end - start) is already one step
    stepDx = totalDx;
    stepDy = totalDy;
  }

  return Array.from({ length: count }, (_, i) => ({
    dxMm: stepDx * i,
    dyMm: stepDy * i,
  }));
}

/**
 * Returns `count` angles in degrees (index 0 = 0).
 * Each subsequent angle = (angleDeg / (count - 1)) * i.
 */
export function radialArrayAngles(params: RadialArrayParams): number[] {
  const { angleDeg, count } = params;
  const steps = Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, i) => (angleDeg / steps) * i);
}

/**
 * Rotates the element's position relative to center by angleDeg and returns
 * the resulting offset (dxMm, dyMm) from the element's current position.
 */
export function radialOffsetForElement(
  centerMm: XY,
  elementCenterMm: XY,
  angleDeg: number,
): { dxMm: number; dyMm: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // Vector from center to element
  const rx = elementCenterMm.xMm - centerMm.xMm;
  const ry = elementCenterMm.yMm - centerMm.yMm;

  // Rotated position (absolute)
  const newX = centerMm.xMm + rx * cosA - ry * sinA;
  const newY = centerMm.yMm + rx * sinA + ry * cosA;

  return {
    dxMm: newX - elementCenterMm.xMm,
    dyMm: newY - elementCenterMm.yMm,
  };
}

/**
 * Parses a user-typed array count string.
 * Valid: integer >= 2. Returns null for any invalid input.
 */
export function parseArrayCount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  if (!Number.isInteger(num)) return null;
  if (num < 2) return null;
  return num;
}
