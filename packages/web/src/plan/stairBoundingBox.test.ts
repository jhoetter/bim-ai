import { describe, expect, it } from 'vitest';
import { stairBoundaryMm } from './stairBoundingBox';
import type { Element } from '@bim-ai/core';

type StairEl = Extract<Element, { kind: 'stair' }>;

function makeStair(
  startMm: { xMm: number; yMm: number },
  endMm: { xMm: number; yMm: number },
  widthMm: number,
): StairEl {
  return {
    kind: 'stair',
    id: 'stair-1',
    name: 'Test Stair',
    baseLevelId: 'l1',
    topLevelId: 'l2',
    runStartMm: startMm,
    runEndMm: endMm,
    widthMm,
    riserMm: 175,
    treadMm: 260,
  } as StairEl;
}

describe('stairBoundaryMm — §2.5.1 + §2.5.3', () => {
  it('returns 4 corners for a horizontal stair run', () => {
    const stair = makeStair({ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }, 1200);
    const corners = stairBoundaryMm(stair);
    expect(corners).toHaveLength(4);
  });

  it('corners are exactly widthMm apart perpendicular to run direction', () => {
    const stair = makeStair({ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }, 1200);
    const corners = stairBoundaryMm(stair);
    // For a horizontal run (along x-axis), perpendicular is y-axis
    // corner[0] and corner[3] should be widthMm apart in y
    const dist03 = Math.abs(corners[0]!.yMm - corners[3]!.yMm);
    expect(dist03).toBeCloseTo(1200, 5);
    const dist12 = Math.abs(corners[1]!.yMm - corners[2]!.yMm);
    expect(dist12).toBeCloseTo(1200, 5);
  });

  it('works for a diagonal stair run', () => {
    const stair = makeStair({ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 3000 }, 1000);
    const corners = stairBoundaryMm(stair);
    expect(corners).toHaveLength(4);
    // Each pair of adjacent corners on the same side should be widthMm apart
    const dx01 = corners[1]!.xMm - corners[0]!.xMm;
    const dy01 = corners[1]!.yMm - corners[0]!.yMm;
    const lenAlong = Math.sqrt(dx01 * dx01 + dy01 * dy01);
    // Along the run direction (corners 0-1 and 3-2), length should equal run length
    const runLen = Math.sqrt(3000 * 3000 + 3000 * 3000);
    expect(lenAlong).toBeCloseTo(runLen, 3);
    // Perpendicular distance (corner 0 to 3) should equal widthMm
    const dx03 = corners[3]!.xMm - corners[0]!.xMm;
    const dy03 = corners[3]!.yMm - corners[0]!.yMm;
    const widthActual = Math.sqrt(dx03 * dx03 + dy03 * dy03);
    expect(widthActual).toBeCloseTo(1000, 3);
  });

  it('returns 4 points', () => {
    const stair = makeStair({ xMm: 100, yMm: 200 }, { xMm: 2000, yMm: 200 }, 900);
    const corners = stairBoundaryMm(stair);
    expect(corners).toHaveLength(4);
    for (const c of corners) {
      expect(typeof c.xMm).toBe('number');
      expect(typeof c.yMm).toBe('number');
    }
  });
});
