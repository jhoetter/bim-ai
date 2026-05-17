/**
 * §1.6.10 — pure helpers for the per-view crop-region drag-handle protocol
 * (4-edge variant: left / right / top / bottom midpoints).
 *
 * Complements the 8-handle cropRegionDragHandles.ts that uses cropMinMm/
 * cropMaxMm. This module uses the compact cropRegionMm rect shape
 * (xMm, yMm, widthMm, heightMm) that the §1.6.10 wave-18 spec introduces.
 */

export type CropRegionMm = { xMm: number; yMm: number; widthMm: number; heightMm: number };
export type CropEdge = 'left' | 'right' | 'top' | 'bottom';

export interface CropRegionGrip {
  edge: CropEdge;
  /** Position of the grip handle in plan space (mm). */
  gripMm: { xMm: number; yMm: number };
}

export function getCropRegionGrips(crop: CropRegionMm): CropRegionGrip[] {
  return [
    { edge: 'left', gripMm: { xMm: crop.xMm, yMm: crop.yMm + crop.heightMm / 2 } },
    {
      edge: 'right',
      gripMm: { xMm: crop.xMm + crop.widthMm, yMm: crop.yMm + crop.heightMm / 2 },
    },
    { edge: 'bottom', gripMm: { xMm: crop.xMm + crop.widthMm / 2, yMm: crop.yMm } },
    {
      edge: 'top',
      gripMm: { xMm: crop.xMm + crop.widthMm / 2, yMm: crop.yMm + crop.heightMm },
    },
  ];
}

/**
 * Applies a drag delta to an edge of the crop region.
 * Returns the updated crop region (never mutates the original).
 */
export function applyCropGripDrag(
  crop: CropRegionMm,
  edge: CropEdge,
  deltaMm: { xMm: number; yMm: number },
  minSizeMm = 500,
): CropRegionMm {
  const c = { ...crop };
  switch (edge) {
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
}
