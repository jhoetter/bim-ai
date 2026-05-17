import { describe, expect, it } from 'vitest';

import { applyCropGripDrag, getCropRegionGrips } from './cropRegionGrips';
import type { CropRegionMm } from './cropRegionGrips';

const CROP: CropRegionMm = { xMm: 1000, yMm: 2000, widthMm: 6000, heightMm: 4000 };

describe('getCropRegionGrips — §1.6.10', () => {
  it('returns 4 grips for a valid crop region', () => {
    const grips = getCropRegionGrips(CROP);
    expect(grips).toHaveLength(4);
    const edges = grips.map((g) => g.edge);
    expect(edges).toContain('left');
    expect(edges).toContain('right');
    expect(edges).toContain('top');
    expect(edges).toContain('bottom');
  });

  it('left grip is at left edge midpoint', () => {
    const grips = getCropRegionGrips(CROP);
    const left = grips.find((g) => g.edge === 'left')!;
    expect(left.gripMm.xMm).toBe(CROP.xMm);
    expect(left.gripMm.yMm).toBe(CROP.yMm + CROP.heightMm / 2);
  });

  it('right grip is at right edge midpoint', () => {
    const grips = getCropRegionGrips(CROP);
    const right = grips.find((g) => g.edge === 'right')!;
    expect(right.gripMm.xMm).toBe(CROP.xMm + CROP.widthMm);
    expect(right.gripMm.yMm).toBe(CROP.yMm + CROP.heightMm / 2);
  });

  it('top grip is at top edge midpoint', () => {
    const grips = getCropRegionGrips(CROP);
    const top = grips.find((g) => g.edge === 'top')!;
    expect(top.gripMm.xMm).toBe(CROP.xMm + CROP.widthMm / 2);
    expect(top.gripMm.yMm).toBe(CROP.yMm + CROP.heightMm);
  });

  it('bottom grip is at bottom edge midpoint', () => {
    const grips = getCropRegionGrips(CROP);
    const bottom = grips.find((g) => g.edge === 'bottom')!;
    expect(bottom.gripMm.xMm).toBe(CROP.xMm + CROP.widthMm / 2);
    expect(bottom.gripMm.yMm).toBe(CROP.yMm);
  });
});

describe('applyCropGripDrag — §1.6.10', () => {
  it('dragging right edge increases width', () => {
    const result = applyCropGripDrag(CROP, 'right', { xMm: 500, yMm: 0 });
    expect(result.widthMm).toBe(CROP.widthMm + 500);
    expect(result.xMm).toBe(CROP.xMm);
    expect(result.yMm).toBe(CROP.yMm);
    expect(result.heightMm).toBe(CROP.heightMm);
  });

  it('dragging left edge past minimum is clamped', () => {
    // Drag left edge far to the right — width should be clamped to minSizeMm
    const result = applyCropGripDrag(CROP, 'left', { xMm: 10_000, yMm: 0 });
    expect(result.widthMm).toBeGreaterThanOrEqual(500);
  });

  it('dragging top edge increases height', () => {
    const result = applyCropGripDrag(CROP, 'top', { xMm: 0, yMm: 1000 });
    expect(result.heightMm).toBe(CROP.heightMm + 1000);
    expect(result.xMm).toBe(CROP.xMm);
    expect(result.yMm).toBe(CROP.yMm);
    expect(result.widthMm).toBe(CROP.widthMm);
  });

  it('does not mutate original crop region', () => {
    const original = { xMm: 0, yMm: 0, widthMm: 5000, heightMm: 3000 };
    const copy = { ...original };
    applyCropGripDrag(original, 'right', { xMm: 1000, yMm: 0 });
    expect(original).toEqual(copy);
  });
});
