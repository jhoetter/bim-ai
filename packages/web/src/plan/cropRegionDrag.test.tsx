import { describe, expect, it } from 'vitest';

import {
  applyCropHandleDrag,
  cropDragCommands,
  cropHandlePositions,
  pickCropHandle,
  pointInsideCrop,
} from './cropRegionDragHandles';

const MIN: { xMm: number; yMm: number } = { xMm: 0, yMm: 0 };
const MAX: { xMm: number; yMm: number } = { xMm: 7000, yMm: 8000 };

describe('PLN-02 — cropHandlePositions', () => {
  it('places eight anchors at the corners and edge midpoints', () => {
    const a = cropHandlePositions(MIN, MAX);
    expect(a['corner-nw']).toEqual({ xMm: 0, yMm: 8000 });
    expect(a['corner-ne']).toEqual({ xMm: 7000, yMm: 8000 });
    expect(a['corner-sw']).toEqual({ xMm: 0, yMm: 0 });
    expect(a['corner-se']).toEqual({ xMm: 7000, yMm: 0 });
    expect(a['edge-n']).toEqual({ xMm: 3500, yMm: 8000 });
    expect(a['edge-e']).toEqual({ xMm: 7000, yMm: 4000 });
    expect(a['edge-s']).toEqual({ xMm: 3500, yMm: 0 });
    expect(a['edge-w']).toEqual({ xMm: 0, yMm: 4000 });
  });
});

describe('PLN-02 — applyCropHandleDrag', () => {
  const start = { cropMinMm: MIN, cropMaxMm: MAX };

  it('corner drag resizes both adjacent edges', () => {
    const next = applyCropHandleDrag('corner-ne', start, 500, -200);
    expect(next.cropMinMm).toEqual({ xMm: 0, yMm: 0 });
    expect(next.cropMaxMm).toEqual({ xMm: 7500, yMm: 7800 });
  });

  it('edge drag resizes only the dragged edge', () => {
    const next = applyCropHandleDrag('edge-w', start, -300, 0);
    expect(next.cropMinMm).toEqual({ xMm: -300, yMm: 0 });
    expect(next.cropMaxMm).toEqual({ xMm: 7000, yMm: 8000 });
  });

  it('body drag translates both corners', () => {
    const next = applyCropHandleDrag('body', start, 1000, 500);
    expect(next.cropMinMm).toEqual({ xMm: 1000, yMm: 500 });
    expect(next.cropMaxMm).toEqual({ xMm: 8000, yMm: 8500 });
  });

  it('clamps the frame so it never collapses below the minimum span', () => {
    // Drag the east edge way past the west edge — the result should
    // still be axis-aligned and at least 100mm wide.
    const next = applyCropHandleDrag('edge-e', start, -10_000, 0);
    expect(next.cropMaxMm.xMm - next.cropMinMm.xMm).toBeGreaterThanOrEqual(100);
  });

  it('renormalises after dragging a corner past the opposite side', () => {
    // Drag south-west corner north-east, beyond the north-east corner,
    // so min/max get swapped — the helper should re-order them.
    const next = applyCropHandleDrag('corner-sw', start, 9000, 9000);
    expect(next.cropMinMm.xMm).toBeLessThan(next.cropMaxMm.xMm);
    expect(next.cropMinMm.yMm).toBeLessThan(next.cropMaxMm.yMm);
  });
});

describe('PLN-02 — cropDragCommands', () => {
  it('emits two updateElementProperty commands referencing the plan view', () => {
    const cmds = cropDragCommands('pv-1', {
      cropMinMm: { xMm: 100, yMm: 200 },
      cropMaxMm: { xMm: 5000, yMm: 6000 },
    });
    expect(cmds).toHaveLength(2);
    expect(cmds[0]!.type).toBe('updateElementProperty');
    expect(cmds[0]!.elementId).toBe('pv-1');
    expect(cmds[0]!.key).toBe('cropMinMm');
    expect(JSON.parse(cmds[0]!.value as string)).toEqual({ xMm: 100, yMm: 200 });
    expect(cmds[1]!.key).toBe('cropMaxMm');
    expect(JSON.parse(cmds[1]!.value as string)).toEqual({ xMm: 5000, yMm: 6000 });
  });

  it('integrates with applyCropHandleDrag for a full drag-then-commit flow', () => {
    const start = { cropMinMm: MIN, cropMaxMm: MAX };
    const next = applyCropHandleDrag('corner-ne', start, 500, 500);
    const cmds = cropDragCommands('pv-1', next);
    expect(JSON.parse(cmds[1]!.value as string)).toEqual({ xMm: 7500, yMm: 8500 });
  });
});

describe('PLN-02 — pickCropHandle', () => {
  it('returns the closest handle within tolerance', () => {
    expect(pickCropHandle(MIN, MAX, 6900, 7900, 200)).toBe('corner-ne');
    expect(pickCropHandle(MIN, MAX, 3500, 7950, 200)).toBe('edge-n');
  });

  it('returns undefined when no handle is within tolerance', () => {
    expect(pickCropHandle(MIN, MAX, 3500, 4000, 200)).toBeUndefined();
  });
});

describe('PLN-02 — pointInsideCrop', () => {
  it('reports points inside vs outside the frame', () => {
    expect(pointInsideCrop(MIN, MAX, 3500, 4000)).toBe(true);
    expect(pointInsideCrop(MIN, MAX, -10, 4000)).toBe(false);
    expect(pointInsideCrop(MIN, MAX, 3500, 9000)).toBe(false);
  });
});
