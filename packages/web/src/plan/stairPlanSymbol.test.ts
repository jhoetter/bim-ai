import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { spiralStairPlanGroup, sketchStairPlanGroup, winderWedgePoints } from './stairPlanSymbol';

type StairElem = Extract<Element, { kind: 'stair' }>;

describe('winderWedgePoints', () => {
  it('returns a closed polyline that begins and ends at the inner-radius start vertex', () => {
    const pts = winderWedgePoints({ xMm: 0, yMm: 0 }, 200, 1000, 0, Math.PI / 4, 4);
    expect(pts[0].xMm).toBeCloseTo(200, 6);
    expect(pts[0].yMm).toBeCloseTo(0, 6);
    const last = pts[pts.length - 1];
    expect(last.xMm).toBeCloseTo(pts[0].xMm, 6);
    expect(last.yMm).toBeCloseTo(pts[0].yMm, 6);
  });

  it('crosses both inner and outer arcs at the swept angle', () => {
    const pts = winderWedgePoints({ xMm: 0, yMm: 0 }, 200, 1000, 0, Math.PI / 2, 4);
    expect(pts.length).toBe(11);

    const radii = pts.map((p) => Math.hypot(p.xMm, p.yMm));
    const innerCount = radii.filter((r) => Math.abs(r - 200) < 1e-6).length;
    const outerCount = radii.filter((r) => Math.abs(r - 1000) < 1e-6).length;
    expect(innerCount).toBeGreaterThan(0);
    expect(outerCount).toBeGreaterThan(0);
  });

  it('rejects outer ≤ inner', () => {
    expect(() => winderWedgePoints({ xMm: 0, yMm: 0 }, 500, 200, 0, 1, 4)).toThrow();
  });
});

describe('spiralStairPlanGroup', () => {
  const spiralStair: StairElem = {
    kind: 'stair',
    id: 'stair-spiral-plan',
    name: 'Spiral',
    baseLevelId: 'lvl-0',
    topLevelId: 'lvl-1',
    runStartMm: { xMm: 0, yMm: 0 },
    runEndMm: { xMm: 0, yMm: 0 },
    widthMm: 1000,
    riserMm: 175,
    treadMm: 275,
    shape: 'spiral',
    centerMm: { xMm: 0, yMm: 0 },
    innerRadiusMm: 200,
    outerRadiusMm: 1200,
    totalRotationDeg: 270,
    runs: [
      {
        id: 'r1',
        startMm: { xMm: 1200, yMm: 0 },
        endMm: { xMm: 0, yMm: -1200 },
        widthMm: 1000,
        riserCount: 12,
      },
    ],
    landings: [],
  };

  it('renders one wedge line per tread plus an up-arrow', () => {
    const g = spiralStairPlanGroup(spiralStair);
    expect(g).not.toBeNull();
    expect(g!.children.length).toBe(13);
  });

  it('returns null for non-spiral shapes', () => {
    const not: StairElem = { ...spiralStair, shape: 'straight' };
    expect(spiralStairPlanGroup(not)).toBeNull();
  });
});

describe('sketchStairPlanGroup', () => {
  const sketchStair: StairElem = {
    kind: 'stair',
    id: 'stair-sketch-plan',
    name: 'Sketch',
    baseLevelId: 'lvl-0',
    topLevelId: 'lvl-1',
    runStartMm: { xMm: 0, yMm: 0 },
    runEndMm: { xMm: 3000, yMm: 0 },
    widthMm: 1000,
    riserMm: 175,
    treadMm: 275,
    shape: 'sketch',
    sketchPathMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1500, yMm: 0 },
      { xMm: 3000, yMm: 1500 },
    ],
    runs: [
      {
        id: 'r1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 3000, yMm: 1500 },
        widthMm: 1000,
        riserCount: 6,
      },
    ],
    landings: [],
  };

  it('renders one tread line per riser+1 along the polyline', () => {
    const g = sketchStairPlanGroup(sketchStair);
    expect(g).not.toBeNull();
    expect(g!.children.length).toBe(7);
  });

  it('returns null when path < 2 points', () => {
    const bad: StairElem = { ...sketchStair, sketchPathMm: [{ xMm: 0, yMm: 0 }] };
    expect(sketchStairPlanGroup(bad)).toBeNull();
  });
});
