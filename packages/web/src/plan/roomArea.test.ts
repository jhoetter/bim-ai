import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { roomAreaM2, roomNetAreaM2 } from './roomArea';

const rect10x5 = [
  { xMm: 0, yMm: 0 },
  { xMm: 10_000, yMm: 0 },
  { xMm: 10_000, yMm: 5_000 },
  { xMm: 0, yMm: 5_000 },
];

const triangle = [
  { xMm: 0, yMm: 0 },
  { xMm: 6_000, yMm: 0 },
  { xMm: 3_000, yMm: 4_000 },
];

function makeColumn(
  xMm: number,
  yMm: number,
  bMm = 300,
  hMm = 300,
): Extract<Element, { kind: 'column' }> {
  return {
    kind: 'column',
    id: `col-${xMm}-${yMm}`,
    name: 'Column',
    levelId: 'lvl-1',
    positionMm: { xMm, yMm },
    bMm,
    hMm,
    heightMm: 3000,
  };
}

describe('roomAreaM2 — §13.1.4', () => {
  it('returns 0 for fewer than 3 points', () => {
    expect(roomAreaM2([])).toBe(0);
    expect(roomAreaM2([{ xMm: 0, yMm: 0 }])).toBe(0);
    expect(
      roomAreaM2([
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ]),
    ).toBe(0);
  });

  it('computes correct area for a 10m × 5m rectangle', () => {
    expect(roomAreaM2(rect10x5)).toBeCloseTo(50, 6);
  });

  it('computes correct area for a non-rectangular polygon', () => {
    // triangle with base 6m and height 4m → area = 0.5 * 6 * 4 = 12 m²
    expect(roomAreaM2(triangle)).toBeCloseTo(12, 6);
  });

  it('handles clockwise and counterclockwise winding (absolute value)', () => {
    const ccw = rect10x5;
    const cw = [...rect10x5].reverse();
    expect(roomAreaM2(ccw)).toBeCloseTo(roomAreaM2(cw), 6);
  });
});

describe('roomNetAreaM2 — §13.1.4', () => {
  it('returns same as gross when no columns inside', () => {
    expect(roomNetAreaM2(rect10x5, [])).toBeCloseTo(50, 6);
  });

  it('subtracts column footprint area for columns inside room', () => {
    const col = makeColumn(5_000, 2_500, 500, 400);
    const net = roomNetAreaM2(rect10x5, [col]);
    // footprint = 500 * 400 = 200_000 mm² = 0.2 m²
    expect(net).toBeCloseTo(49.8, 6);
  });

  it('does not subtract columns outside room', () => {
    const outside = makeColumn(20_000, 20_000);
    expect(roomNetAreaM2(rect10x5, [outside])).toBeCloseTo(50, 6);
  });
});
