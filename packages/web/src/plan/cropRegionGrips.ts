/**
 * §1.6.10 — pure helpers for the per-view crop-region drag-handle protocol
 * (4-edge variant: left / right / top / bottom midpoints).
 *
 * Supports two rect shapes:
 *   - Legacy xMm/yMm/widthMm/heightMm (existing tests + PlanCanvas wiring)
 *   - Min/max minXMm/minYMm/maxXMm/maxYMm (wave-24 §1.6.10 new test)
 */

/** Legacy x/y/width/height rect (kept for backward compat). */
export type CropRegionMm = { xMm: number; yMm: number; widthMm: number; heightMm: number };

/** Min/max rect used by the wave-24 wiring (matches cropRegionDragHandles.ts style). */
export type CropRegionMinMax = {
  minXMm: number;
  minYMm: number;
  maxXMm: number;
  maxYMm: number;
};

export type CropEdge = 'left' | 'right' | 'top' | 'bottom';

export interface CropRegionGrip {
  /** Grip identifier — same as `edge` for named lookup. */
  id: string;
  edge: CropEdge;
  /** Position of the grip handle in plan space (mm). */
  gripMm: { xMm: number; yMm: number };
  /** Alias for gripMm — use whichever fits your call site. */
  positionMm: { xMm: number; yMm: number };
}

function makeGrip(edge: CropEdge, xMm: number, yMm: number): CropRegionGrip {
  const pos = { xMm, yMm };
  return { id: edge, edge, gripMm: pos, positionMm: pos };
}

/** Returns 4 midpoint grips for the given crop region. */
export function getCropRegionGrips(crop: CropRegionMm | CropRegionMinMax): CropRegionGrip[] {
  let xMin: number, yMin: number, xMax: number, yMax: number;
  if ('xMm' in crop) {
    xMin = crop.xMm;
    yMin = crop.yMm;
    xMax = crop.xMm + crop.widthMm;
    yMax = crop.yMm + crop.heightMm;
  } else {
    xMin = crop.minXMm;
    yMin = crop.minYMm;
    xMax = crop.maxXMm;
    yMax = crop.maxYMm;
  }
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  return [
    makeGrip('left', xMin, cy),
    makeGrip('right', xMax, cy),
    makeGrip('bottom', cx, yMin),
    makeGrip('top', cx, yMax),
  ];
}

/**
 * Applies a drag delta to an edge of the crop region.
 * Returns the updated crop region in the same shape as the input (never mutates the original).
 */
export function applyCropGripDrag(
  crop: CropRegionMm,
  edge: CropEdge | string,
  deltaMm: { xMm: number; yMm: number },
  minSizeMm?: number,
): CropRegionMm;
export function applyCropGripDrag(
  crop: CropRegionMinMax,
  edge: CropEdge | string,
  deltaMm: { xMm: number; yMm: number },
  minSizeMm?: number,
): CropRegionMinMax;
export function applyCropGripDrag(
  crop: CropRegionMm | CropRegionMinMax,
  edge: CropEdge | string,
  deltaMm: { xMm: number; yMm: number },
  minSizeMm = 500,
): CropRegionMm | CropRegionMinMax {
  if ('xMm' in crop) {
    // Legacy xMm/yMm/widthMm/heightMm shape
    const c = { ...crop };
    switch (edge as CropEdge) {
      case 'left': {
        const newX = Math.min(c.xMm + deltaMm.xMm, c.xMm + c.widthMm - minSizeMm);
        c.widthMm += c.xMm - newX;
        c.xMm = newX;
        break;
      }
      case 'right': {
        c.widthMm = Math.max(minSizeMm, c.widthMm + deltaMm.xMm);
        break;
      }
      case 'bottom': {
        const newY = Math.min(c.yMm + deltaMm.yMm, c.yMm + c.heightMm - minSizeMm);
        c.heightMm += c.yMm - newY;
        c.yMm = newY;
        break;
      }
      case 'top': {
        c.heightMm = Math.max(minSizeMm, c.heightMm + deltaMm.yMm);
        break;
      }
    }
    return c;
  } else {
    // Min/max minXMm/minYMm/maxXMm/maxYMm shape
    const c = { ...crop };
    switch (edge as CropEdge) {
      case 'left': {
        const newMin = Math.min(c.minXMm + deltaMm.xMm, c.maxXMm - minSizeMm);
        c.minXMm = newMin;
        break;
      }
      case 'right': {
        const newMax = Math.max(c.maxXMm + deltaMm.xMm, c.minXMm + minSizeMm);
        c.maxXMm = newMax;
        break;
      }
      case 'bottom': {
        const newMin = Math.min(c.minYMm + deltaMm.yMm, c.maxYMm - minSizeMm);
        c.minYMm = newMin;
        break;
      }
      case 'top': {
        const newMax = Math.max(c.maxYMm + deltaMm.yMm, c.minYMm + minSizeMm);
        c.maxYMm = newMax;
        break;
      }
    }
    return c;
  }
}
