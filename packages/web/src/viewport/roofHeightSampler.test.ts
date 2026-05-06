import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { roofHeightAtPoint } from './roofHeightSampler';

type RoofElem = Extract<Element, { kind: 'roof' }>;

const level0: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Level 0',
  elevationMm: 0,
};

const wall3m: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
  'wall-1': wall3m,
};

// footprint: 0–8000 mm (x) × 0–6000 mm (z, stored as yMm in XY)
const gableRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-1',
  name: 'Gable Roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8000, yMm: 0 },
    { xMm: 8000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  slopeDeg: 45,
  ridgeAxis: 'x',
  roofGeometryMode: 'gable_pitched_rectangle',
};

describe('roofHeightAtPoint — gable ridgeAlongX', () => {
  // eaveY = 0 + 3 = 3.0 m, halfSpan = 3 m, tan(45°) = 1
  it('returns ridge height at plan center', () => {
    // z center = 3000 mm → |z - midZ| = 0 → height = 3 + 3 = 6
    expect(roofHeightAtPoint(gableRoof, elementsById, 4000, 3000)).toBeCloseTo(6.0, 6);
  });

  it('returns eave height at z = 0 (south eave)', () => {
    // |0 - 3| = 3, halfSpan - 3 = 0 → max(0, 0) = 0 → height = 3
    expect(roofHeightAtPoint(gableRoof, elementsById, 4000, 0)).toBeCloseTo(3.0, 6);
  });

  it('returns intermediate height at z = 1500 mm', () => {
    // |1.5 - 3| = 1.5, halfSpan - 1.5 = 1.5 → height = 3 + 1.5 = 4.5
    expect(roofHeightAtPoint(gableRoof, elementsById, 4000, 1500)).toBeCloseTo(4.5, 6);
  });
});

describe('roofHeightAtPoint — mass_box', () => {
  const boxRoof: RoofElem = {
    kind: 'roof',
    id: 'roof-2',
    name: 'Box Roof',
    referenceLevelId: 'lvl-0',
    footprintMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    slopeDeg: 30,
    roofGeometryMode: 'mass_box',
  };

  it('returns eaveY for any point', () => {
    expect(roofHeightAtPoint(boxRoof, elementsById, 2500, 2000)).toBeCloseTo(3.0, 6);
    expect(roofHeightAtPoint(boxRoof, elementsById, 0, 0)).toBeCloseTo(3.0, 6);
  });
});
