import { describe, expect, it } from 'vitest';
import { draftingPaintFor } from './planCanvasState';

describe('draftingPaintFor — §14.2', () => {
  it('shows major + minor grid at fine scales', () => {
    const paint = draftingPaintFor(50);
    expect(paint.grid).toEqual({ showMajor: true, showMinor: true });
  });
  it('hides grid past 1:200', () => {
    expect(draftingPaintFor(500).grid).toEqual({
      showMajor: false,
      showMinor: false,
    });
  });
  it('emits visible hatches per scale', () => {
    expect(draftingPaintFor(50).visibleHatches.length).toBeGreaterThan(0);
    expect(draftingPaintFor(500).visibleHatches.length).toBe(0);
  });
  it('exposes a lineWidthPx accessor that scales with the camera', () => {
    const paint = draftingPaintFor(100);
    const w = paint.lineWidthPx('wall.cut');
    expect(w).toBeCloseTo(1, 6);
  });
  it('returns paper token reference for the drawing surface', () => {
    expect(draftingPaintFor(50).paperToken).toBe('--draft-paper');
  });
});
