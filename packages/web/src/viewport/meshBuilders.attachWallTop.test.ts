/**
 * WP-C C4 — Attach Top/Base of Walls to Roof or Floor
 *
 * Tests that wallVerticalSpanM correctly adjusts wall height when
 * topConstraintHostId references a roof element, and that clearing
 * the constraint restores normal height behaviour.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { wallVerticalSpanM } from './meshBuilders';

type WallElem = Extract<Element, { kind: 'wall' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Ground Floor',
  elevationMm: 0,
};

// Gable roof over a 10 m x 8 m footprint at level 0.
// Walls at lvl-0 have heightMm=3000 -> eaveY = 0 + 3 = 3 m.
// slopeDeg=45, ridgeAxis='x' -> halfSpanZ = 4 m, tan(45) = 1
// Ridge height = eaveY + halfSpanZ = 3 + 4 = 7 m
const gableRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-1',
  name: 'Gable Roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 8000 },
    { xMm: 0, yMm: 8000 },
  ],
  slopeDeg: 45,
  ridgeAxis: 'x',
  roofGeometryMode: 'gable_pitched_rectangle',
};

// A reference wall at level 0 with heightMm=3000.
// roofHeightSampler uses max wall height at reference level -> wallTopM = 3.0 m -> eaveY = 3.0 m.
const referenceWall: WallElem = {
  kind: 'wall',
  id: 'ref-wall',
  name: 'Reference wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 10000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
  'roof-1': gableRoof,
  'ref-wall': referenceWall,
};

describe('wallVerticalSpanM - topConstraintHostId (WP-C C4)', () => {
  it('wall at south eave (yMm=0) constrained to roof bottom gets eave height', () => {
    // Wall midpoint is at xMm=5000, yMm=0 - exactly on the south eave.
    // roofHeightAtPoint at z=0: halfSpan=4, |0-4|=4, 4-4=0 -> height = 3+0 = 3 m.
    // sampledTopM=3 m; yBase=0; effective height = 3 m.
    const wall: WallElem = {
      kind: 'wall',
      id: 'w-south',
      name: 'South wall',
      levelId: 'lvl-0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 10000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 1000,
      topConstraintHostId: 'roof-1',
      topConstraintHostFace: 'bottom',
    };

    const { yBase, height } = wallVerticalSpanM(wall, 0, elementsById);

    expect(yBase).toBeCloseTo(0, 5);
    expect(height).toBeCloseTo(3.0, 3);
  });

  it('wall at quarter-span (yMm=2000) constrained to roof gets intermediate slope height', () => {
    // Midpoint at xMm=5000, yMm=2000.
    // |2-4|=2, halfSpan-2=2 -> sampledTopM = 3+2 = 5 m.
    // effective height = 5-0 = 5 m.
    const wall: WallElem = {
      kind: 'wall',
      id: 'w-quarter',
      name: 'Quarter-span wall',
      levelId: 'lvl-0',
      start: { xMm: 0, yMm: 2000 },
      end: { xMm: 10000, yMm: 2000 },
      thicknessMm: 200,
      heightMm: 1000,
      topConstraintHostId: 'roof-1',
      topConstraintHostFace: 'bottom',
    };

    const { yBase, height } = wallVerticalSpanM(wall, 0, elementsById);

    expect(yBase).toBeCloseTo(0, 5);
    expect(height).toBeCloseTo(5.0, 3);
  });

  it('clearing topConstraintHostId (detachWallTop) restores normal heightMm behaviour', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'w-detached',
      name: 'Detached wall',
      levelId: 'lvl-0',
      start: { xMm: 0, yMm: 2000 },
      end: { xMm: 10000, yMm: 2000 },
      thicknessMm: 200,
      heightMm: 2500,
      topConstraintHostId: null,
      topConstraintHostFace: null,
    };

    const { yBase, height } = wallVerticalSpanM(wall, 0, elementsById);

    expect(yBase).toBeCloseTo(0, 5);
    expect(height).toBeCloseTo(2.5, 5);
  });

  it('topConstraintHostId referencing a non-existent host falls back to heightMm', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'w-missing-host',
      name: 'Wall with missing host',
      levelId: 'lvl-0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3500,
      topConstraintHostId: 'no-such-element',
      topConstraintHostFace: 'bottom',
    };

    const { height } = wallVerticalSpanM(wall, 0, elementsById);

    expect(height).toBeCloseTo(3.5, 5);
  });
});
