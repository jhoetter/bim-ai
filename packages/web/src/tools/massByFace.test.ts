import { describe, expect, it } from 'vitest';
import {
  getMassFaceCorners,
  getMassFaceCount,
  getMassFloorBoundaryAtElevation,
  isMassFaceVertical,
  isMassFaceHorizontal,
  type MassElem,
} from './massByFace';

const BOX_MASS: MassElem = {
  kind: 'mass',
  id: 'm1',
  levelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  heightMm: 10000,
};

describe('getMassFaceCount', () => {
  it('box mass has 6 faces (bottom + top + 4 sides)', () => {
    expect(getMassFaceCount(BOX_MASS)).toBe(6);
  });
});

describe('getMassFaceCorners', () => {
  it('face 0 is the bottom polygon at base elevation', () => {
    const corners = getMassFaceCorners(BOX_MASS, 0, 0);
    expect(corners.length).toBe(4);
    corners.forEach((c) => expect(c.zMm).toBe(0));
  });

  it('face 1 is the top polygon at heightMm', () => {
    const corners = getMassFaceCorners(BOX_MASS, 1, 0);
    expect(corners.length).toBe(4);
    corners.forEach((c) => expect(c.zMm).toBe(10000));
  });

  it('face 2 is the first side face', () => {
    const corners = getMassFaceCorners(BOX_MASS, 2, 0);
    expect(corners.length).toBe(4);
    const zVals = corners.map((c) => c.zMm);
    expect(zVals).toContain(0);
    expect(zVals).toContain(10000);
  });
});

describe('getMassFloorBoundaryAtElevation', () => {
  it('returns footprint when elevation is within mass height range', () => {
    const boundary = getMassFloorBoundaryAtElevation(BOX_MASS, 3500, 0);
    expect(boundary).not.toBeNull();
    expect(boundary!.length).toBe(4);
  });

  it('returns null when elevation is above the mass', () => {
    const boundary = getMassFloorBoundaryAtElevation(BOX_MASS, 15000, 0);
    expect(boundary).toBeNull();
  });

  it('returns null when elevation is below the base', () => {
    const boundary = getMassFloorBoundaryAtElevation(BOX_MASS, -1000, 0);
    expect(boundary).toBeNull();
  });
});

describe('isMassFaceVertical / isMassFaceHorizontal', () => {
  const fp = BOX_MASS.footprintMm;

  it('face 0 is horizontal (bottom)', () => {
    expect(isMassFaceHorizontal(0)).toBe(true);
    expect(isMassFaceVertical(0, fp)).toBe(false);
  });

  it('face 1 is horizontal (top)', () => {
    expect(isMassFaceHorizontal(1)).toBe(true);
    expect(isMassFaceVertical(1, fp)).toBe(false);
  });

  it('faces 2-5 are vertical (sides)', () => {
    for (let i = 2; i <= 5; i++) {
      expect(isMassFaceVertical(i, fp)).toBe(true);
      expect(isMassFaceHorizontal(i)).toBe(false);
    }
  });
});
