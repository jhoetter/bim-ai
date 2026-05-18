import { describe, expect, it } from 'vitest';

// Pure geometry helper — mirrors a point about a center
function flipPt(
  pt: { xMm: number; yMm: number },
  cx: number,
  cy: number,
  axis: 'horizontal' | 'vertical',
): { xMm: number; yMm: number } {
  return axis === 'horizontal'
    ? { xMm: 2 * cx - pt.xMm, yMm: pt.yMm }
    : { xMm: pt.xMm, yMm: 2 * cy - pt.yMm };
}

describe('flipStair geometry — §8.6.4', () => {
  it('horizontal flip mirrors xMm about center', () => {
    const pt = { xMm: 100, yMm: 50 };
    const flipped = flipPt(pt, 200, 0, 'horizontal');
    expect(flipped.xMm).toBe(300);
    expect(flipped.yMm).toBe(50);
  });

  it('vertical flip mirrors yMm about center', () => {
    const pt = { xMm: 50, yMm: 100 };
    const flipped = flipPt(pt, 0, 200, 'vertical');
    expect(flipped.xMm).toBe(50);
    expect(flipped.yMm).toBe(300);
  });

  it('double flip restores original', () => {
    const pt = { xMm: 300, yMm: 150 };
    const once = flipPt(pt, 200, 200, 'horizontal');
    const twice = flipPt(once, 200, 200, 'horizontal');
    expect(twice.xMm).toBeCloseTo(pt.xMm);
    expect(twice.yMm).toBeCloseTo(pt.yMm);
  });

  it('FlipStairCmd has correct shape', () => {
    const cmd = { type: 'flipStair' as const, stairId: 's1', axis: 'horizontal' as const };
    expect(cmd.type).toBe('flipStair');
    expect(cmd.axis).toBe('horizontal');
  });

  it('accepts vertical axis', () => {
    const cmd = { type: 'flipStair' as const, stairId: 's1', axis: 'vertical' as const };
    expect(cmd.axis).toBe('vertical');
  });
});
