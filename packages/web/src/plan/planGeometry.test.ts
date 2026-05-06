import { describe, expect, it } from 'vitest';

import { computeStairPlanRiserCount } from './planElementMeshBuilders';
import { centroidMm, polygonAreaMm2, segmentDir, ux, uz } from './symbology';

// ─── ux / uz ─────────────────────────────────────────────────────────────────

describe('ux', () => {
  it('converts mm to metres', () => expect(ux(1000)).toBeCloseTo(1));
  it('converts 500mm to 0.5m', () => expect(ux(500)).toBeCloseTo(0.5));
  it('converts 0mm to 0m', () => expect(ux(0)).toBe(0));
  it('converts negative mm', () => expect(ux(-2000)).toBeCloseTo(-2));
});

describe('uz', () => {
  it('converts mm to metres', () => expect(uz(3000)).toBeCloseTo(3));
  it('converts 0mm to 0m', () => expect(uz(0)).toBe(0));
  it('converts negative mm', () => expect(uz(-500)).toBeCloseTo(-0.5));
});

// ─── segmentDir ──────────────────────────────────────────────────────────────

const makeWall = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thicknessMm = 200,
) =>
  ({
    kind: 'wall' as const,
    id: 'w1',
    name: 'W1',
    levelId: 'lvl0',
    start: { xMm: x0, yMm: y0 },
    end: { xMm: x1, yMm: y1 },
    thicknessMm,
    heightMm: 2800,
    baseConstraintOffsetMm: 0,
    topConstraintOffsetMm: 0,
    insulationExtensionMm: 0,
  }) as Parameters<typeof segmentDir>[0];

describe('segmentDir', () => {
  it('length of horizontal wall is correct', () => {
    const { lenM } = segmentDir(makeWall(0, 0, 5000, 0));
    expect(lenM).toBeCloseTo(5);
  });

  it('unit vector of horizontal wall points along +X', () => {
    const { nx, nz } = segmentDir(makeWall(0, 0, 3000, 0));
    expect(nx).toBeCloseTo(1);
    expect(nz).toBeCloseTo(0);
  });

  it('unit vector of vertical wall points along +Z', () => {
    const { nx, nz } = segmentDir(makeWall(0, 0, 0, 4000));
    expect(nx).toBeCloseTo(0);
    expect(nz).toBeCloseTo(1);
  });

  it('unit vector magnitude is 1 for diagonal wall', () => {
    const { nx, nz } = segmentDir(makeWall(0, 0, 3000, 4000));
    expect(Math.hypot(nx, nz)).toBeCloseTo(1);
  });

  it('length of diagonal wall (3-4-5 triangle)', () => {
    const { lenM } = segmentDir(makeWall(0, 0, 3000, 4000));
    expect(lenM).toBeCloseTo(5);
  });

  it('zero-length wall gets minimum length (no div-by-zero)', () => {
    const { lenM } = segmentDir(makeWall(0, 0, 0, 0));
    expect(lenM).toBeGreaterThan(0);
  });

  it('reversed wall gives opposite unit vector direction', () => {
    const fwd = segmentDir(makeWall(0, 0, 1000, 0));
    const bwd = segmentDir(makeWall(1000, 0, 0, 0));
    expect(fwd.nx).toBeCloseTo(-bwd.nx);
  });
});

// ─── centroidMm ──────────────────────────────────────────────────────────────

describe('centroidMm', () => {
  it('centroid of a unit square is (500, 500)', () => {
    const square = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ];
    expect(centroidMm(square)).toEqual({ xMm: 500, yMm: 500 });
  });

  it('centroid of single point is the point itself', () => {
    expect(centroidMm([{ xMm: 300, yMm: 700 }])).toEqual({ xMm: 300, yMm: 700 });
  });

  it('centroid of two points is midpoint', () => {
    const c = centroidMm([
      { xMm: 0, yMm: 0 },
      { xMm: 2000, yMm: 4000 },
    ]);
    expect(c.xMm).toBeCloseTo(1000);
    expect(c.yMm).toBeCloseTo(2000);
  });

  it('handles empty polygon (guard — no division by zero)', () => {
    const c = centroidMm([]);
    expect(c.xMm).toBe(0);
    expect(c.yMm).toBe(0);
  });

  it('centroid of triangle with known result', () => {
    const tri = [
      { xMm: 0, yMm: 0 },
      { xMm: 3000, yMm: 0 },
      { xMm: 0, yMm: 3000 },
    ];
    const c = centroidMm(tri);
    expect(c.xMm).toBeCloseTo(1000);
    expect(c.yMm).toBeCloseTo(1000);
  });
});

// ─── polygonAreaMm2 ───────────────────────────────────────────────────────────

describe('polygonAreaMm2', () => {
  it('area of 1m×1m square is 1 000 000 mm²', () => {
    const square = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ];
    expect(polygonAreaMm2(square)).toBeCloseTo(1_000_000);
  });

  it('area of 2m×3m rectangle is 6 000 000 mm²', () => {
    const rect = [
      { xMm: 0, yMm: 0 },
      { xMm: 2000, yMm: 0 },
      { xMm: 2000, yMm: 3000 },
      { xMm: 0, yMm: 3000 },
    ];
    expect(polygonAreaMm2(rect)).toBeCloseTo(6_000_000);
  });

  it('area of right triangle (base 3m, height 4m) is 6 000 000 mm²', () => {
    const tri = [
      { xMm: 0, yMm: 0 },
      { xMm: 3000, yMm: 0 },
      { xMm: 0, yMm: 4000 },
    ];
    expect(polygonAreaMm2(tri)).toBeCloseTo(6_000_000);
  });

  it('CCW and CW winding both give the same positive area', () => {
    const ccw = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ];
    const cw = [...ccw].reverse();
    expect(polygonAreaMm2(ccw)).toBeCloseTo(polygonAreaMm2(cw));
  });

  it('returns 0 for degenerate polygon (< 3 points)', () => {
    expect(polygonAreaMm2([])).toBe(0);
    expect(polygonAreaMm2([{ xMm: 0, yMm: 0 }])).toBe(0);
    expect(polygonAreaMm2([{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }])).toBe(0);
  });

  it('returns 0 for collinear points', () => {
    const line = [
      { xMm: 0, yMm: 0 },
      { xMm: 500, yMm: 0 },
      { xMm: 1000, yMm: 0 },
    ];
    expect(polygonAreaMm2(line)).toBeCloseTo(0);
  });
});

// ─── computeStairPlanRiserCount ───────────────────────────────────────────────

const makeStair = (overrides: Partial<{
  runStartMm: { xMm: number; yMm: number };
  runEndMm: { xMm: number; yMm: number };
  treadMm: number;
  riserMm: number;
  baseLevelId: string;
  topLevelId: string;
}> = {}) =>
  ({
    kind: 'stair' as const,
    id: 'stair-1',
    baseLevelId: 'lvl0',
    topLevelId: 'lvl1',
    runStartMm: { xMm: 0, yMm: 0 },
    runEndMm: { xMm: 3000, yMm: 0 },
    treadMm: 280,
    riserMm: 175,
    ...overrides,
  }) as Parameters<typeof computeStairPlanRiserCount>[0];

describe('computeStairPlanRiserCount', () => {
  it('uses tread length when elementsById not provided', () => {
    // 3000mm / 280mm tread ≈ 10.7 → rounds to 11
    const n = computeStairPlanRiserCount(makeStair());
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(36);
    expect(n).toBe(11);
  });

  it('uses elevation rise when level elements provided', () => {
    const stair = makeStair({ riserMm: 175 });
    const elementsById = {
      lvl0: { kind: 'level', id: 'lvl0', name: 'G', elevationMm: 0, offsetFromParentMm: 0 },
      lvl1: { kind: 'level', id: 'lvl1', name: 'F1', elevationMm: 2800, offsetFromParentMm: 0 },
    } as unknown as Record<string, import('@bim-ai/core').Element>;
    // 2800mm / 175mm riser = 16
    const n = computeStairPlanRiserCount(stair, elementsById);
    expect(n).toBe(16);
  });

  it('falls back to tread when base level not found', () => {
    const stair = makeStair();
    const elementsById = {
      lvl1: { kind: 'level', id: 'lvl1', name: 'F1', elevationMm: 2800, offsetFromParentMm: 0 },
    } as unknown as Record<string, import('@bim-ai/core').Element>;
    const n = computeStairPlanRiserCount(stair, elementsById);
    expect(n).toBe(11);
  });

  it('clamps result minimum to 2', () => {
    // Very short stair — 1 tread → clamp to 2
    const stair = makeStair({
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 100, yMm: 0 },
      treadMm: 1000,
    });
    expect(computeStairPlanRiserCount(stair)).toBe(2);
  });

  it('clamps result maximum to 36', () => {
    // Very long stair — many treads → clamp to 36
    const stair = makeStair({
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 20000, yMm: 0 },
      treadMm: 100,
    });
    expect(computeStairPlanRiserCount(stair)).toBe(36);
  });

  it('handles zero tread gracefully (no div-by-zero)', () => {
    const stair = makeStair({ treadMm: 0 });
    const n = computeStairPlanRiserCount(stair);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(36);
  });
});
