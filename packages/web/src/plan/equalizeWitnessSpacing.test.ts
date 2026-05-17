import { describe, expect, it } from 'vitest';

import { equalizeWitnessSpacing } from './equalizeWitnessSpacing';

describe('EQ dimension enforcement — §4.2.3', () => {
  it('equalizes 3 points to equal spacing', () => {
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 }, // currently unequal
      { xMm: 3000, yMm: 0 },
    ];
    const result = equalizeWitnessSpacing(pts);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(result[1]).toEqual({ xMm: 1500, yMm: 0 });
    expect(result[2]).toEqual({ xMm: 3000, yMm: 0 });
  });

  it('equalizes 4 points to equal spacing', () => {
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 500, yMm: 0 },
      { xMm: 2000, yMm: 0 },
      { xMm: 6000, yMm: 0 },
    ];
    const result = equalizeWitnessSpacing(pts);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(result[1]!.xMm).toBeCloseTo(2000);
    expect(result[2]!.xMm).toBeCloseTo(4000);
    expect(result[3]).toEqual({ xMm: 6000, yMm: 0 });
  });

  it('returns unchanged when only 2 points (nothing to equalize)', () => {
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
    ];
    const result = equalizeWitnessSpacing(pts);
    expect(result).toEqual(pts);
  });

  it('works horizontally (yMm stays constant)', () => {
    const pts = [
      { xMm: 100, yMm: 500 },
      { xMm: 200, yMm: 500 },
      { xMm: 700, yMm: 500 },
    ];
    const result = equalizeWitnessSpacing(pts);
    expect(result[0]).toEqual({ xMm: 100, yMm: 500 });
    expect(result[1]!.xMm).toBeCloseTo(400);
    expect(result[1]!.yMm).toBeCloseTo(500);
    expect(result[2]).toEqual({ xMm: 700, yMm: 500 });
  });

  it('works diagonally', () => {
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 100, yMm: 200 },
      { xMm: 3000, yMm: 3000 },
    ];
    const result = equalizeWitnessSpacing(pts);
    expect(result[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(result[1]!.xMm).toBeCloseTo(1500);
    expect(result[1]!.yMm).toBeCloseTo(1500);
    expect(result[2]).toEqual({ xMm: 3000, yMm: 3000 });
  });
});
