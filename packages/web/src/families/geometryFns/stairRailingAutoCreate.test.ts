import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { buildAutoRailingsForStair, deriveStairRailingPath } from './stairRailingAutoCreate';

type StairElement = Extract<Element, { kind: 'stair' }>;

/** Minimal straight stair running along the Y axis: start (0,0) -> end (0,3000), width 1200. */
const straightStair: StairElement = {
  kind: 'stair',
  id: 'stair-001',
  name: 'Test Stair',
  baseLevelId: 'level-0',
  topLevelId: 'level-1',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 0, yMm: 3000 },
  widthMm: 1200,
  riserMm: 175,
  treadMm: 280,
};

describe('buildAutoRailingsForStair', () => {
  it('returns exactly 2 specs (left and right) for a straight stair', () => {
    const specs = buildAutoRailingsForStair(straightStair);
    expect(specs).toHaveLength(2);
    const sides = specs.map((s) => s.side);
    expect(sides).toContain('left');
    expect(sides).toContain('right');
  });

  it('sets stairId on both specs to the stair id', () => {
    const specs = buildAutoRailingsForStair(straightStair);
    for (const spec of specs) {
      expect(spec.stairId).toBe('stair-001');
    }
  });

  it('uses default railingHeightMm of 900 for both specs', () => {
    const specs = buildAutoRailingsForStair(straightStair);
    for (const spec of specs) {
      expect(spec.railingHeightMm).toBe(900);
    }
  });

  it('left railing path is offset to the left of the run direction', () => {
    // Run direction is along +Y (xMm=0,yMm=3000).
    // dx=0, dy=3000, nx = -dy/len = -3000/3000 = -1, ny = dx/len = 0/3000 = 0
    // sign for left = +1, so left offset = +1 * -1 * 600 = -600 in xMm
    const leftPath = deriveStairRailingPath(straightStair, 'left');
    expect(leftPath).toHaveLength(2);
    expect(leftPath[0]!.xMm).toBeCloseTo(-600, 1);
    expect(leftPath[1]!.xMm).toBeCloseTo(-600, 1);
    expect(leftPath[0]!.yMm).toBeCloseTo(0, 1);
    expect(leftPath[1]!.yMm).toBeCloseTo(3000, 1);
  });

  it('right railing path is offset to the right of the run direction', () => {
    // sign for right = -1, so right offset = -1 * -1 * 600 = +600 in xMm
    const rightPath = deriveStairRailingPath(straightStair, 'right');
    expect(rightPath).toHaveLength(2);
    expect(rightPath[0]!.xMm).toBeCloseTo(600, 1);
    expect(rightPath[1]!.xMm).toBeCloseTo(600, 1);
    expect(rightPath[0]!.yMm).toBeCloseTo(0, 1);
    expect(rightPath[1]!.yMm).toBeCloseTo(3000, 1);
  });

  it('left and right paths are on opposite sides (symmetric about the run centre)', () => {
    const leftPath = deriveStairRailingPath(straightStair, 'left');
    const rightPath = deriveStairRailingPath(straightStair, 'right');
    // The xMm values should be equal in magnitude but opposite in sign
    expect(leftPath[0]!.xMm).toBeCloseTo(-rightPath[0]!.xMm, 5);
    expect(leftPath[1]!.xMm).toBeCloseTo(-rightPath[1]!.xMm, 5);
  });

  it('each spec path has exactly 2 points', () => {
    const specs = buildAutoRailingsForStair(straightStair);
    for (const spec of specs) {
      expect(spec.pathMm).toHaveLength(2);
    }
  });
});
