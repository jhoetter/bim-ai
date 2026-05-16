import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeStairVolumeMesh } from './meshBuilders';

type StairElem = Extract<Element, { kind: 'stair' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

// Three levels at 0m, 3m, 6m forming a 3-storey stairwell.
const lvl0: LevelElem = { kind: 'level', id: 'lvl-0', name: 'L0', elevationMm: 0 };
const lvl1: LevelElem = { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 };
const lvl2: LevelElem = { kind: 'level', id: 'lvl-2', name: 'L2', elevationMm: 6000 };

const threeStoreyElements: Record<string, Element> = {
  'lvl-0': lvl0,
  'lvl-1': lvl1,
  'lvl-2': lvl2,
};

// Same stair without the intermediate level — single-storey equivalent spanning 6m.
const twoStoreyElements: Record<string, Element> = {
  'lvl-0': lvl0,
  'lvl-2': lvl2,
};

const multiStoreyStair: StairElem = {
  kind: 'stair',
  id: 'stair-multi',
  name: 'Multi-Storey Stair',
  baseLevelId: 'lvl-0',
  topLevelId: 'lvl-2',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 5000, yMm: 0 },
  widthMm: 1200,
  riserMm: 175,
  treadMm: 250,
  multiStorey: true,
  runs: [
    {
      id: 'run-1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 5000, yMm: 0 },
      widthMm: 1200,
      riserCount: 17,
    },
  ],
  landings: [],
};

describe('WP-C C2 — multi-storey stair mesh', () => {
  it('3-storey stair (2 floor segments) has more mesh children than 1-segment equivalent', () => {
    const threeStoreyGroup = makeStairVolumeMesh(multiStoreyStair, threeStoreyElements, null);
    const singleStoreyGroup = makeStairVolumeMesh(
      { ...multiStoreyStair, multiStorey: false },
      twoStoreyElements,
      null,
    );
    // 3-storey stacks geometry for 2 floor segments (lvl-0→lvl-1, lvl-1→lvl-2),
    // while the single-storey renders only 1 segment.
    expect(threeStoreyGroup.children.length).toBeGreaterThan(singleStoreyGroup.children.length);
  });

  it('bounding box max Y reaches approximately the top level elevation (6.0 m)', () => {
    const group = makeStairVolumeMesh(multiStoreyStair, threeStoreyElements, null);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    // Top of the highest tread should be at or very near 6.0 m.
    expect(box.max.y).toBeCloseTo(6.0, 1);
  });
});
