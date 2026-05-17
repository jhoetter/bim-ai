import type { Element } from '@bim-ai/core';

type BoundaryMm = { xMm: number; yMm: number; widthMm: number; heightMm: number };

/**
 * Returns true if the element's centroid or any key point is inside (or overlaps) the callout boundary.
 * Used to filter elements rendered in a callout view.
 */
export function elementOverlapsBoundary(el: Element, boundary: BoundaryMm): boolean {
  const pts = getElementKeyPoints(el);
  if (pts.length === 0) return true; // include if no spatial info
  return pts.some(
    (p) =>
      p.xMm >= boundary.xMm &&
      p.xMm <= boundary.xMm + boundary.widthMm &&
      p.yMm >= boundary.yMm &&
      p.yMm <= boundary.yMm + boundary.heightMm,
  );
}

function getElementKeyPoints(el: Element): { xMm: number; yMm: number }[] {
  const e = el as any;
  const pts: { xMm: number; yMm: number }[] = [];
  if (e.startMm) pts.push(e.startMm);
  if (e.endMm) pts.push(e.endMm);
  if (e.positionMm) pts.push(e.positionMm);
  if (e.perimeterMm) pts.push(...e.perimeterMm);
  return pts;
}

/**
 * Computes the display scale denominator for a callout boundary in a given canvas width (px).
 * Returns e.g. 20 for 1:20 scale.
 */
export function computeCalloutScale(boundary: BoundaryMm, canvasWidthPx: number): number {
  // boundary is in mm; canvas is in px
  // 1 px ≈ 0.264 mm at 96dpi (but we work in abstract units)
  // Scale = boundaryWidthMm / (canvasWidthPx * 0.264)
  const scale = boundary.widthMm / (canvasWidthPx * 0.264);
  // Round to nearest standard scale
  const standards = [5, 10, 20, 25, 50, 100, 200, 500, 1000];
  return standards.reduce((prev, curr) =>
    Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev,
  );
}
