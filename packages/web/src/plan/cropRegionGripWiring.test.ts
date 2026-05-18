import { describe, expect, it } from 'vitest';
import { getCropRegionGrips, applyCropGripDrag } from './cropRegionGrips';

const baseCrop = { minXMm: 0, minYMm: 0, maxXMm: 10000, maxYMm: 8000 };

describe('cropRegionGrips — §1.6.10', () => {
  it('getCropRegionGrips returns 4 or 8 grips', () => {
    const grips = getCropRegionGrips(baseCrop);
    expect(grips.length).toBeGreaterThanOrEqual(4);
  });

  it('each grip has positionMm and id', () => {
    const grips = getCropRegionGrips(baseCrop);
    for (const g of grips) {
      expect(typeof g.id).toBe('string');
      expect(typeof g.positionMm.xMm).toBe('number');
      expect(typeof g.positionMm.yMm).toBe('number');
    }
  });

  it('applyCropGripDrag updates the crop region', () => {
    const grips = getCropRegionGrips(baseCrop);
    const firstGrip = grips[0];
    const result = applyCropGripDrag(baseCrop, firstGrip.id, { xMm: 100, yMm: 0 });
    // At least one bound should change
    const changed =
      result.minXMm !== baseCrop.minXMm ||
      result.maxXMm !== baseCrop.maxXMm ||
      result.minYMm !== baseCrop.minYMm ||
      result.maxYMm !== baseCrop.maxYMm;
    expect(changed).toBe(true);
  });

  it('applyCropGripDrag preserves min < max invariant', () => {
    const grips = getCropRegionGrips(baseCrop);
    for (const g of grips) {
      const result = applyCropGripDrag(baseCrop, g.id, { xMm: 100, yMm: 100 });
      expect(result.minXMm).toBeLessThan(result.maxXMm);
      expect(result.minYMm).toBeLessThan(result.maxYMm);
    }
  });

  it('UpdateCropRegionCmd has correct shape', () => {
    const cmd = {
      type: 'updateCropRegion' as const,
      planViewId: 'pv1',
      cropRegionMm: { minXMm: 100, minYMm: 100, maxXMm: 5000, maxYMm: 4000 },
    };
    expect(cmd.type).toBe('updateCropRegion');
    expect(cmd.cropRegionMm.minXMm).toBe(100);
  });
});
