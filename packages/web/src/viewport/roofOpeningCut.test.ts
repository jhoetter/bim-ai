import { afterEach, describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh, registerDormerCutFn } from './meshBuilders';

type LevelElem = Extract<Element, { kind: 'level' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;
type RoofOpeningElem = Extract<Element, { kind: 'roof_opening' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Level 0',
  elevationMm: 0,
};

const wall3m: WallElem = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 3000,
};

const flatRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-flat',
  name: 'Flat roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
  roofGeometryMode: 'flat',
  slopeDeg: 0,
  overhangMm: 0,
};

const roofOpening: RoofOpeningElem = {
  kind: 'roof_opening',
  id: 'roof-cut',
  name: 'Roof terrace cutout',
  hostRoofId: 'roof-flat',
  boundaryMm: [
    { xMm: 1000, yMm: 1000 },
    { xMm: 3000, yMm: 1000 },
    { xMm: 3000, yMm: 3000 },
    { xMm: 1000, yMm: 3000 },
  ],
};

const asymmetricRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-asym',
  name: 'Asymmetric gable roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 8000 },
    { xMm: 0, yMm: 8000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  slopeDeg: 30,
  overhangMm: 0,
  ridgeOffsetTransverseMm: 500,
  eaveHeightLeftMm: 1500,
  eaveHeightRightMm: 2300,
};

const asymmetricRoofOpening: RoofOpeningElem = {
  kind: 'roof_opening',
  id: 'roof-asym-cut',
  name: 'Right slope roof cutout',
  hostRoofId: 'roof-asym',
  boundaryMm: [
    { xMm: 3250, yMm: 4200 },
    { xMm: 5000, yMm: 4200 },
    { xMm: 5000, yMm: 7400 },
    { xMm: 3250, yMm: 7400 },
  ],
};

describe('roof opening viewport cut wiring', () => {
  afterEach(() => {
    registerDormerCutFn(null);
  });

  it('invokes the registered roof cut helper when a roof has only roof_opening children', () => {
    let sawRoofOpening = false;
    registerDormerCutFn((geom, roof, elementsById) => {
      sawRoofOpening =
        roof.id === 'roof-flat' &&
        Object.values(elementsById).some(
          (el) => el.kind === 'roof_opening' && el.hostRoofId === 'roof-flat',
        );
      return geom;
    });
    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'wall-1': wall3m,
      'roof-flat': flatRoof,
      'roof-cut': roofOpening,
    };

    makeRoofMassMesh(flatRoof, elementsById, null);

    expect(sawRoofOpening).toBe(true);
  });

  it('renders the target-house east-slope cutout without relying on CSG', () => {
    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'wall-1': wall3m,
      'roof-asym': asymmetricRoof,
      'roof-asym-cut': asymmetricRoofOpening,
    };

    const mesh = makeRoofMassMesh(asymmetricRoof, elementsById, null);
    const pos = mesh.geometry.getAttribute('position');
    let hasCutEdge = false;
    let hasInteriorHoleVertex = false;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (Math.abs(x - 3.25) < 0.01 && (Math.abs(z - 4.2) < 0.01 || Math.abs(z - 7.4) < 0.01)) {
        hasCutEdge = true;
      }
      if (x > 3.26 && z > 4.21 && z < 7.39) {
        hasInteriorHoleVertex = true;
      }
    }

    expect(hasCutEdge).toBe(true);
    expect(hasInteriorHoleVertex).toBe(false);
  });
});
