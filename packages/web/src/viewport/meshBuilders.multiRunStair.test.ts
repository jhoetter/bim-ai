import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeStairVolumeMesh } from './meshBuilders';

type StairElem = Extract<Element, { kind: 'stair' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const lvlBase: LevelElem = { kind: 'level', id: 'lvl-0', name: 'L0', elevationMm: 0 };
const lvlTop: LevelElem = { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 2800 };

const elementsById: Record<string, Element> = {
  'lvl-0': lvlBase,
  'lvl-1': lvlTop,
};

// L-shaped multi-run stair: two perpendicular runs of 8 risers each, joined
// at a square landing in the corner.
const lShapeStair: StairElem = {
  kind: 'stair',
  id: 'stair-l-1',
  name: 'L Stair',
  baseLevelId: 'lvl-0',
  topLevelId: 'lvl-1',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 0, yMm: 0 },
  widthMm: 1000,
  riserMm: 175,
  treadMm: 275,
  shape: 'l_shape',
  runs: [
    {
      id: 'run-1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 2200, yMm: 0 },
      widthMm: 1000,
      riserCount: 8,
    },
    {
      id: 'run-2',
      startMm: { xMm: 2700, yMm: 500 },
      endMm: { xMm: 2700, yMm: 2700 },
      widthMm: 1000,
      riserCount: 8,
    },
  ],
  landings: [
    {
      id: 'landing-1',
      boundaryMm: [
        { xMm: 2200, yMm: 0 },
        { xMm: 3200, yMm: 0 },
        { xMm: 3200, yMm: 1000 },
        { xMm: 2200, yMm: 1000 },
      ],
    },
  ],
};

describe('makeStairVolumeMesh — multi-run (KRN-07)', () => {
  it('renders one tread per riser across all runs plus one landing mesh', () => {
    const group = makeStairVolumeMesh(lShapeStair, elementsById, null);
    // 8 + 8 treads + 1 landing = 17 child meshes
    expect(group.children.length).toBe(17);
  });

  it('places the landing at the elevation reached after run-1 (8 risers)', () => {
    const group = makeStairVolumeMesh(lShapeStair, elementsById, null);
    // Each riser = 2.8 m / 16 = 0.175 m; landing sits at 8 * 0.175 = 1.4 m
    const landingMesh = group.children[group.children.length - 1] as THREE.Mesh;
    landingMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(landingMesh);
    expect(box.min.y).toBeCloseTo(1.4, 2);
  });

  it('top of the highest tread reaches the upper level elevation', () => {
    const group = makeStairVolumeMesh(lShapeStair, elementsById, null);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    // Total rise 2.8 m → top tread at exactly 2.8 m (top of the tread surface).
    expect(box.max.y).toBeCloseTo(2.8, 2);
  });

  it('legacy single-run stair (no runs[]) still renders via the original code path', () => {
    const legacyStair: StairElem = {
      kind: 'stair',
      id: 'stair-legacy',
      name: 'Legacy',
      baseLevelId: 'lvl-0',
      topLevelId: 'lvl-1',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 4000, yMm: 0 },
      widthMm: 1000,
      riserMm: 175,
      treadMm: 275,
    };
    const group = makeStairVolumeMesh(legacyStair, elementsById, null);
    // Legacy path adds N treads + 2 stringers; N = round(2800 / 175) = 16
    expect(group.children.length).toBe(16 + 2);
  });
});
