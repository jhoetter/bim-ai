import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { shaftBoundaryFromStair } from './stairShaft';

type StairEl = Extract<Element, { kind: 'stair' }>;

function makeStair(override: Partial<StairEl> = {}): StairEl {
  return {
    kind: 'stair',
    id: 'stair-1',
    name: 'Test Stair',
    baseLevelId: 'l1',
    topLevelId: 'l2',
    runStartMm: { xMm: 0, yMm: 0 },
    runEndMm: { xMm: 3000, yMm: 0 },
    widthMm: 1200,
    riserMm: 175,
    treadMm: 260,
    ...override,
  } as StairEl;
}

describe('stairShaft — §2.5.3', () => {
  it('shaftBoundaryFromStair returns a 4-point rectangle', () => {
    const stair = makeStair();
    const result = shaftBoundaryFromStair(stair);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
  });

  it('returns null when stair has no boundary data', () => {
    const stair = {
      kind: 'stair',
      id: 'stair-empty',
      name: 'Empty Stair',
      baseLevelId: 'l1',
      topLevelId: 'l2',
    } as StairEl;
    const result = shaftBoundaryFromStair(stair);
    expect(result).toBeNull();
  });

  it('rectangle encloses all stair boundary points', () => {
    const boundaryMm = [
      { xMm: 100, yMm: 200 },
      { xMm: 2500, yMm: 300 },
      { xMm: 2400, yMm: 1500 },
      { xMm: 50, yMm: 1400 },
    ];
    const stair = makeStair({ boundaryMm });
    const result = shaftBoundaryFromStair(stair);
    expect(result).not.toBeNull();
    const rect = result!;
    const minX = Math.min(...rect.map((p) => p.xMm));
    const maxX = Math.max(...rect.map((p) => p.xMm));
    const minY = Math.min(...rect.map((p) => p.yMm));
    const maxY = Math.max(...rect.map((p) => p.yMm));
    for (const pt of boundaryMm) {
      expect(pt.xMm).toBeGreaterThanOrEqual(minX);
      expect(pt.xMm).toBeLessThanOrEqual(maxX);
      expect(pt.yMm).toBeGreaterThanOrEqual(minY);
      expect(pt.yMm).toBeLessThanOrEqual(maxY);
    }
  });

  it('uses boundaryMm when present over runStartMm/runEndMm', () => {
    const boundaryMm = [
      { xMm: 500, yMm: 500 },
      { xMm: 1000, yMm: 500 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 500, yMm: 1000 },
    ];
    const stair = makeStair({ boundaryMm });
    const result = shaftBoundaryFromStair(stair);
    expect(result).not.toBeNull();
    expect(result![0]).toMatchObject({ xMm: 500, yMm: 500 });
    expect(result![2]).toMatchObject({ xMm: 1000, yMm: 1000 });
  });

  it('falls back to runStartMm/runEndMm/widthMm for by_component stair', () => {
    const stair = makeStair({
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 4000, yMm: 0 },
      widthMm: 1000,
    });
    const result = shaftBoundaryFromStair(stair);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    const xs = result!.map((p) => p.xMm);
    const ys = result!.map((p) => p.yMm);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(4000);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1000);
  });
});
