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

  it('applies separate tread and landing material slots for multi-run stairs', () => {
    const group = makeStairVolumeMesh(
      {
        ...lShapeStair,
        materialSlots: {
          tread: 'timber_cladding',
          landing: 'concrete_smooth',
        },
      },
      elementsById,
      null,
    );
    const firstTread = group.children.find(
      (child) => child.userData.materialSlot === 'tread',
    ) as THREE.Mesh;
    const landing = group.children.find(
      (child) => child.userData.materialSlot === 'landing',
    ) as THREE.Mesh;

    expect((firstTread.material as THREE.Material).userData.materialKey).toBe('timber_cladding');
    expect((landing.material as THREE.Material).userData.materialKey).toBe('concrete_smooth');
  });

  it('applies separate tread and stringer material slots for legacy stairs', () => {
    const legacyStair: StairElem = {
      kind: 'stair',
      id: 'stair-legacy-materials',
      name: 'Legacy materials',
      baseLevelId: 'lvl-0',
      topLevelId: 'lvl-1',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 4000, yMm: 0 },
      widthMm: 1000,
      riserMm: 175,
      treadMm: 275,
      materialSlots: {
        tread: 'timber_cladding',
        stringer: 'aluminium_black',
      },
    };
    const group = makeStairVolumeMesh(legacyStair, elementsById, null);
    const tread = group.children.find((child) => child.userData.materialSlot === 'tread') as
      | THREE.Mesh
      | undefined;
    const stringer = group.children.find(
      (child) => child.userData.materialSlot === 'stringer',
    ) as THREE.Mesh | undefined;

    expect((tread?.material as THREE.Material).userData.materialKey).toBe('timber_cladding');
    expect((stringer?.material as THREE.Material).userData.materialKey).toBe('aluminium_black');
  });
});

describe('makeStairVolumeMesh — spiral (KRN-07 closeout)', () => {
  const spiralStair: StairElem = {
    kind: 'stair',
    id: 'stair-spiral',
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
        id: 'run-1',
        startMm: { xMm: 1200, yMm: 0 },
        endMm: { xMm: 0, yMm: -1200 },
        widthMm: 1000,
        riserCount: 12,
      },
    ],
    landings: [],
  };

  it('renders one annular tread per riser (and no landings)', () => {
    const group = makeStairVolumeMesh(spiralStair, elementsById, null);
    expect(group.children.length).toBe(12);
  });

  it('top of the highest tread reaches the upper level elevation', () => {
    const group = makeStairVolumeMesh(spiralStair, elementsById, null);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.max.y).toBeCloseTo(2.8, 2);
  });
});

describe('makeStairVolumeMesh — sketch (KRN-07 closeout)', () => {
  const sketchStair: StairElem = {
    kind: 'stair',
    id: 'stair-sketch',
    name: 'Sketch',
    baseLevelId: 'lvl-0',
    topLevelId: 'lvl-1',
    runStartMm: { xMm: 0, yMm: 0 },
    runEndMm: { xMm: 4000, yMm: 1500 },
    widthMm: 1000,
    riserMm: 175,
    treadMm: 275,
    shape: 'sketch',
    sketchPathMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 2000, yMm: 0 },
      { xMm: 4000, yMm: 1500 },
    ],
    runs: [
      {
        id: 'run-1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 4000, yMm: 1500 },
        widthMm: 1000,
        riserCount: 10,
      },
    ],
    landings: [],
  };

  it('renders one tread per riser stepped along the polyline', () => {
    const group = makeStairVolumeMesh(sketchStair, elementsById, null);
    expect(group.children.length).toBe(10);
  });

  it('top tread reaches the upper level elevation', () => {
    const group = makeStairVolumeMesh(sketchStair, elementsById, null);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.max.y).toBeCloseTo(2.8, 2);
  });
});
