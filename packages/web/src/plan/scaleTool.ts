import type { XY } from '@bim-ai/core';

export interface ScaleElementCommand {
  type: 'scaleElement';
  elementId: string;
  originXMm: number;
  originYMm: number;
  factor: number;
}

/**
 * Parses a user-typed scale factor string.
 * Valid: finite positive number not equal to 0. Returns null for invalid input.
 */
export function parseScaleFactor(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return num;
}

/**
 * Computes a scale factor from two-click reference distance.
 * refDistanceMm is the distance between clicks in the "from" position,
 * newDistanceMm is the "to" distance. Returns null if either is <= 0.
 */
export function scaleFactorFromDistances(
  refDistanceMm: number,
  newDistanceMm: number,
): number | null {
  if (refDistanceMm <= 0 || newDistanceMm <= 0) return null;
  return newDistanceMm / refDistanceMm;
}

/**
 * Scales an XY point relative to an origin by a given factor.
 */
export function scalePoint(point: XY, origin: XY, factor: number): XY {
  return {
    xMm: origin.xMm + (point.xMm - origin.xMm) * factor,
    yMm: origin.yMm + (point.yMm - origin.yMm) * factor,
  };
}

/**
 * Scales wall endpoints relative to an origin.
 * Returns new start/end coordinates.
 */
export function scaleWallEndpoints(
  start: XY,
  end: XY,
  origin: XY,
  factor: number,
): { start: XY; end: XY } {
  return {
    start: scalePoint(start, origin, factor),
    end: scalePoint(end, origin, factor),
  };
}

/**
 * Scales a family instance insertion point relative to an origin.
 * Returns the new insertion point and the scaled size (width * factor, height * factor).
 */
export function scaleFamilyInstance(
  insertionPoint: XY,
  widthMm: number,
  heightMm: number,
  origin: XY,
  factor: number,
): { insertionPoint: XY; widthMm: number; heightMm: number } {
  return {
    insertionPoint: scalePoint(insertionPoint, origin, factor),
    widthMm: widthMm * factor,
    heightMm: heightMm * factor,
  };
}

/**
 * Builds a ScaleElementCommand for the given element and factor.
 */
export function buildScaleCommand(
  elementId: string,
  origin: XY,
  factor: number,
): ScaleElementCommand {
  return {
    type: 'scaleElement',
    elementId,
    originXMm: origin.xMm,
    originYMm: origin.yMm,
    factor,
  };
}

/**
 * Distance between two points in mm.
 */
export function distanceMm(a: XY, b: XY): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  return Math.sqrt(dx * dx + dy * dy);
}
