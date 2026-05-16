import type { XY } from '@bim-ai/core';

/** Angle in degrees between two vectors from origin. Always 0–180. */
export function angleBetweenVectors(a: XY, b: XY): number {
  const dot = a.xMm * b.xMm + a.yMm * b.yMm;
  const magA = Math.hypot(a.xMm, a.yMm);
  const magB = Math.hypot(b.xMm, b.yMm);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Fit a circle through three points; returns { centerMm, radiusMm } or null if collinear. */
export function fitCircleThrough3(
  p1: XY,
  p2: XY,
  p3: XY,
): { centerMm: XY; radiusMm: number } | null {
  const ax = p1.xMm,
    ay = p1.yMm;
  const bx = p2.xMm,
    by = p2.yMm;
  const cx = p3.xMm,
    cy = p3.yMm;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;

  const centerMm: XY = { xMm: ux, yMm: uy };
  const radiusMm = Math.hypot(ax - ux, ay - uy);
  return { centerMm, radiusMm };
}

/** Arc length along the fitted circle from p1 to p2 passing through p3. */
export function arcLengthThrough3(p1: XY, p2: XY, p3: XY): number | null {
  const circle = fitCircleThrough3(p1, p2, p3);
  if (!circle) return null;

  const { centerMm, radiusMm } = circle;
  const cx = centerMm.xMm,
    cy = centerMm.yMm;

  const a1 = Math.atan2(p1.yMm - cy, p1.xMm - cx);
  const a2 = Math.atan2(p2.yMm - cy, p2.xMm - cx);
  const a3 = Math.atan2(p3.yMm - cy, p3.xMm - cx);

  // Determine the arc sweep direction using p3 as a pass-through check
  let sweep = a2 - a1;
  // Normalise sweep to (-2π, 2π)
  while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
  while (sweep < -Math.PI * 2) sweep += Math.PI * 2;

  // Check if a3 lies on the arc from a1 to a2 going the direction of sweep
  let a3Rel = a3 - a1;
  while (a3Rel < 0) a3Rel += Math.PI * 2;
  while (a3Rel > Math.PI * 2) a3Rel -= Math.PI * 2;

  let sweepPos = sweep;
  if (sweepPos < 0) sweepPos += Math.PI * 2;

  if (a3Rel > sweepPos) {
    // p3 is outside the short arc — use the long arc instead
    if (sweep > 0) sweep -= Math.PI * 2;
    else sweep += Math.PI * 2;
  }

  return Math.abs(sweep) * radiusMm;
}
