import { describe, expect, it } from 'vitest';
import { getCropRegionGrips, applyCropGripDrag } from './cropRegionGrips';
import type { CropRegionMm } from './cropRegionGrips';

describe('crop region clipping — §1.6.10', () => {
  const crop: CropRegionMm = { xMm: 0, yMm: 0, widthMm: 10000, heightMm: 8000 };

  it('getCropRegionGrips returns 4 grips', () => {
    const grips = getCropRegionGrips(crop);
    expect(grips).toHaveLength(4);
  });

  it('grip edges are left, right, top, bottom', () => {
    const grips = getCropRegionGrips(crop);
    const edges = grips.map((g) => g.edge).sort();
    expect(edges).toEqual(['bottom', 'left', 'right', 'top']);
  });

  it('applyCropGripDrag right edge increases width', () => {
    const result = applyCropGripDrag(crop, 'right', { xMm: 500, yMm: 0 });
    expect(result.widthMm).toBe(10500);
  });

  it('applyCropGripDrag left edge shifts x and reduces width', () => {
    const result = applyCropGripDrag(crop, 'left', { xMm: 1000, yMm: 0 });
    expect(result.xMm).toBe(1000);
    expect(result.widthMm).toBe(9000);
  });

  it('applyCropGripDrag enforces minimum size', () => {
    const result = applyCropGripDrag(crop, 'right', { xMm: -15000, yMm: 0 }, 500);
    expect(result.widthMm).toBeGreaterThanOrEqual(500);
  });

  it('applyCropGripDrag top edge increases height', () => {
    const result = applyCropGripDrag(crop, 'top', { xMm: 0, yMm: 1000 });
    expect(result.heightMm).toBe(9000);
  });
});
