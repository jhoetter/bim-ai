import { describe, expect, it } from 'vitest';

import {
  doorPlanFeatureCount,
  showCurtainGridForDetail,
  showCurtainMullionsForDetail,
  stairPlanFeatureCount,
  wallPlanLinesForDetailLevel,
  windowPlanFeatureCount,
  type WallElement,
} from './planDetailLevelLines';

const wall: WallElement = {
  kind: 'wall',
  id: 'w-1',
  name: 'W',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

describe('VIE-01 — wall plan lines per detail level', () => {
  it('coarse renders 1 line per wall', () => {
    expect(wallPlanLinesForDetailLevel(wall, 'coarse').length).toBe(1);
  });

  it('medium renders 2 lines per wall (core boundaries)', () => {
    expect(wallPlanLinesForDetailLevel(wall, 'medium').length).toBe(2);
  });

  it('fine renders 4 lines per wall (outer + core boundaries)', () => {
    expect(wallPlanLinesForDetailLevel(wall, 'fine').length).toBe(4);
  });

  it('fine outer lines sit at ±half-thickness from the wall axis', () => {
    const lines = wallPlanLinesForDetailLevel(wall, 'fine');
    // Wall runs along x; outer offsets are along y. With thickness 200, each
    // outer line is ±100 mm from y=0.
    const ys = lines.map((line) => line[0]?.yMm ?? 0).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-100);
    expect(ys[3]).toBeCloseTo(100);
  });
});

describe('VIE-01 — door / window / stair feature gating', () => {
  it('coarse door drops the frame', () => {
    expect(doorPlanFeatureCount('coarse').hasFrame).toBe(false);
    expect(doorPlanFeatureCount('coarse').hasSwingArc).toBe(true);
    expect(doorPlanFeatureCount('medium').hasFrame).toBe(true);
  });

  it('coarse window has only the opening line', () => {
    expect(windowPlanFeatureCount('coarse')).toEqual({
      hasOpening: true,
      hasGlassLine: false,
      hasMullions: false,
    });
    expect(windowPlanFeatureCount('fine').hasMullions).toBe(true);
  });

  it('coarse stair shows only the path arrow', () => {
    const c = stairPlanFeatureCount('coarse');
    expect(c.hasPathArrow).toBe(true);
    expect(c.hasTreadOutline).toBe(false);
    expect(c.hasFullTreadDetail).toBe(false);
    const f = stairPlanFeatureCount('fine');
    expect(f.hasFullTreadDetail).toBe(true);
  });
});

describe('VIE-01 — curtain wall gating', () => {
  it('grid renders at medium and fine but not coarse', () => {
    expect(showCurtainGridForDetail('coarse')).toBe(false);
    expect(showCurtainGridForDetail('medium')).toBe(true);
    expect(showCurtainGridForDetail('fine')).toBe(true);
  });

  it('mullions only render at fine', () => {
    expect(showCurtainMullionsForDetail('coarse')).toBe(false);
    expect(showCurtainMullionsForDetail('medium')).toBe(false);
    expect(showCurtainMullionsForDetail('fine')).toBe(true);
  });
});
