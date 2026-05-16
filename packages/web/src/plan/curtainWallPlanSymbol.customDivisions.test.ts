import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { curtainWallPlanThree } from './curtainWallPlanSymbol';
import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;

const BASE: WallElem = {
  kind: 'wall',
  id: 'cw-1',
  name: 'CW',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 80,
  heightMm: 3000,
  isCurtainWall: true,
};

function lineCount(group: THREE.Group): number {
  return group.children.filter((c) => c instanceof THREE.Line).length;
}

describe('curtainWallPlanThree — customVDivisions (WP-C C2)', () => {
  it('customVDivisions=[] falls back to uniform vGridCount ticks', () => {
    const wall: WallElem = {
      ...BASE,
      curtainWallVCount: 4,
      curtainWallData: {
        gridH: { count: 2 },
        gridV: { count: 4 },
        customVDivisions: [],
      },
    };
    const group = curtainWallPlanThree(wall);
    // 4 divisions → 3 internal ticks + 1 center line = 4 lines
    expect(lineCount(group)).toBe(4);
  });

  it('customVDivisions=[0.3] adds a tick at 30% along the wall', () => {
    const wall: WallElem = {
      ...BASE,
      curtainWallData: {
        gridH: { count: 2 },
        gridV: { count: 4 },
        customVDivisions: [0.3],
      },
    };
    const group = curtainWallPlanThree(wall);
    // 1 custom division tick + 1 center line = 2 lines (uniform ignored)
    expect(lineCount(group)).toBe(2);
  });

  it('customVDivisions=[0.25, 0.5, 0.75] renders 3 ticks (replaces uniform)', () => {
    const wall: WallElem = {
      ...BASE,
      curtainWallVCount: 2,
      curtainWallData: {
        gridH: { count: 2 },
        gridV: { count: 2 },
        customVDivisions: [0.25, 0.5, 0.75],
      },
    };
    const group = curtainWallPlanThree(wall);
    // 3 custom ticks + 1 center line = 4
    expect(lineCount(group)).toBe(4);
  });

  it('boundary values t=0 and t=1 are excluded from custom divisions', () => {
    const wall: WallElem = {
      ...BASE,
      curtainWallData: {
        gridH: { count: 1 },
        gridV: { count: 1 },
        customVDivisions: [0, 0.5, 1],
      },
    };
    const group = curtainWallPlanThree(wall);
    // Only t=0.5 is interior; 0 and 1 are boundary-excluded
    expect(lineCount(group)).toBe(2); // center line + 1 tick
  });

  it('no curtainWallData → uses curtainWallVCount for uniform ticks', () => {
    const wall: WallElem = { ...BASE, curtainWallVCount: 3 };
    const group = curtainWallPlanThree(wall);
    // 3 divisions → 2 internal ticks + 1 center line = 3
    expect(lineCount(group)).toBe(3);
  });
});
