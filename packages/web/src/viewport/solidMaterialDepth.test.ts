import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  makeCeilingMesh,
  makeFloorSlabMesh,
  makeRoofMassMesh,
  makeSiteMesh,
  makeToposolidMesh,
} from './meshBuilders';

type LevelElem = Extract<Element, { kind: 'level' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Ground Floor',
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

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
  'wall-1': wall3m,
};

function expectOpaqueDepthMaterial(mat: THREE.Material): void {
  expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
  const standard = mat as THREE.MeshStandardMaterial;
  expect(standard.transparent).toBe(false);
  expect(standard.opacity).toBe(1);
  expect(standard.depthWrite).toBe(true);
}

describe('solid viewport materials', () => {
  it('keeps floors, roofs, sites, and ceilings in the opaque depth pass', () => {
    const floor = makeFloorSlabMesh(
      {
        kind: 'floor',
        id: 'floor-1',
        name: 'Floor',
        levelId: 'lvl-0',
        thicknessMm: 200,
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      },
      elementsById,
      null,
    );
    const roof = makeRoofMassMesh(
      {
        kind: 'roof',
        id: 'roof-1',
        name: 'Roof',
        referenceLevelId: 'lvl-0',
        footprintMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
        slopeDeg: 30,
        roofGeometryMode: 'gable_pitched_rectangle',
      },
      elementsById,
      null,
    );
    const site = makeSiteMesh(
      {
        kind: 'site',
        id: 'site-1',
        name: 'Site',
        referenceLevelId: 'lvl-0',
        boundaryMm: [
          { xMm: -1000, yMm: -1000 },
          { xMm: 5000, yMm: -1000 },
          { xMm: 5000, yMm: 4000 },
          { xMm: -1000, yMm: 4000 },
        ],
      },
      elementsById,
      null,
    );
    const toposolid = makeToposolidMesh(
      {
        kind: 'toposolid',
        id: 'topo-1',
        name: 'Toposolid',
        boundaryMm: [
          { xMm: -1000, yMm: -1000 },
          { xMm: 5000, yMm: -1000 },
          { xMm: 5000, yMm: 4000 },
          { xMm: -1000, yMm: 4000 },
        ],
        heightSamples: [
          { xMm: -1000, yMm: -1000, zMm: -400 },
          { xMm: 5000, yMm: -1000, zMm: 0 },
          { xMm: 5000, yMm: 4000, zMm: 500 },
          { xMm: -1000, yMm: 4000, zMm: 100 },
        ],
        thicknessMm: 1500,
        baseElevationMm: -1800,
        defaultMaterialKey: 'render_beige',
      },
      null,
    );
    const ceiling = makeCeilingMesh(
      {
        kind: 'ceiling',
        id: 'ceiling-1',
        name: 'Ceiling',
        levelId: 'lvl-0',
        thicknessMm: 50,
        heightOffsetMm: 2400,
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      },
      elementsById,
      null,
    );

    for (const mesh of [floor, roof, site, toposolid, ceiling]) {
      expectOpaqueDepthMaterial(mesh.material as THREE.Material);
    }
  });
});
