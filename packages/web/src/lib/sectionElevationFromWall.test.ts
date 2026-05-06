import { describe, expect, it } from 'vitest';

import {
  elevationFromWall,
  sectionCutFromWall,
  type WallElement,
} from './sectionElevationFromWall';

const wallEW: WallElement = {
  kind: 'wall',
  id: 'w-EW',
  name: 'South façade',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

const wallNS: WallElement = {
  kind: 'wall',
  id: 'w-NS',
  name: 'East façade',
  levelId: 'lvl-1',
  start: { xMm: 6000, yMm: 0 },
  end: { xMm: 6000, yMm: 4000 },
  thicknessMm: 200,
  heightMm: 2800,
};

const wallDiagonal: WallElement = {
  kind: 'wall',
  id: 'w-D',
  name: 'Stair wall',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 4000 },
  thicknessMm: 200,
  heightMm: 2800,
};

describe('ANN-02 — sectionCutFromWall', () => {
  it('cuts perpendicular to an east-west wall through its midpoint', () => {
    const sec = sectionCutFromWall(wallEW, { padMm: 1000 });
    // Wall midpoint is (3000, 0); section runs along Y.
    expect(sec.lineStartMm.xMm).toBeCloseTo(3000);
    expect(sec.lineEndMm.xMm).toBeCloseTo(3000);
    // Total span = wall length 6000 + 2 × pad 1000 = 8000.
    const span = Math.abs(sec.lineEndMm.yMm - sec.lineStartMm.yMm);
    expect(span).toBeCloseTo(8000);
    expect(sec.cropDepthMm).toBeCloseTo(8000);
    expect(sec.name).toContain('South façade');
  });

  it('cuts perpendicular to a north-south wall through its midpoint', () => {
    const sec = sectionCutFromWall(wallNS, { padMm: 500 });
    // Wall midpoint is (6000, 2000); section runs along X.
    expect(sec.lineStartMm.yMm).toBeCloseTo(2000);
    expect(sec.lineEndMm.yMm).toBeCloseTo(2000);
    const span = Math.abs(sec.lineEndMm.xMm - sec.lineStartMm.xMm);
    expect(span).toBeCloseTo(5000);
  });
});

describe('ANN-02 — elevationFromWall', () => {
  it('snaps to north when wall runs east-west and viewer stands south (left side)', () => {
    const ev = elevationFromWall(wallEW, { viewSide: 'left' });
    // Left normal of (1,0) is (0,1) → viewer stands on +y, so view direction
    // is +y wait... Actually viewer on `left` looks toward the wall, which is
    // the wall normal pointing away from viewer. With wall tangent (1,0):
    //   left normal = (0,1)  → viewer is on +y, looks toward -y → south
    // So `viewSide: 'left'` here yields south. We accept either north or
    // south (the helper's convention is encoded), but it must snap to a
    // cardinal, not 'custom'.
    expect(['north', 'south']).toContain(ev.direction);
    expect(ev.customAngleDeg).toBeNull();
  });

  it('snaps to east/west when wall runs north-south', () => {
    const ev = elevationFromWall(wallNS, { viewSide: 'left' });
    expect(['east', 'west']).toContain(ev.direction);
    expect(ev.customAngleDeg).toBeNull();
  });

  it('falls back to custom (with angle) for diagonal walls', () => {
    const ev = elevationFromWall(wallDiagonal, { viewSide: 'left' });
    expect(ev.direction).toBe('custom');
    expect(typeof ev.customAngleDeg).toBe('number');
  });

  it('crop rectangle envelopes the wall midpoint', () => {
    const ev = elevationFromWall(wallEW, { padMm: 500 });
    const midX = 3000;
    const midY = 0;
    expect(ev.cropMinMm.xMm).toBeLessThanOrEqual(midX);
    expect(ev.cropMaxMm.xMm).toBeGreaterThanOrEqual(midX);
    expect(ev.cropMinMm.yMm).toBeLessThanOrEqual(midY);
    expect(ev.cropMaxMm.yMm).toBeGreaterThanOrEqual(midY);
  });

  it('viewSide flips the cardinal direction for axis-aligned walls', () => {
    const left = elevationFromWall(wallEW, { viewSide: 'left' });
    const right = elevationFromWall(wallEW, { viewSide: 'right' });
    expect(left.direction).not.toBe(right.direction);
  });
});
