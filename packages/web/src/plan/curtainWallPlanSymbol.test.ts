import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { curtainWallPlanThree } from './curtainWallPlanSymbol';
import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;

const BASE_CURTAIN: WallElem = {
  kind: 'wall',
  id: 'cw-1',
  name: 'Curtain Wall',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 80,
  heightMm: 3000,
  isCurtainWall: true,
  curtainWallVCount: 3,
  curtainWallHCount: 2,
};

describe('curtainWallPlanThree', () => {
  it('creates a THREE.Group with the wall id', () => {
    const group = curtainWallPlanThree(BASE_CURTAIN);
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.userData.bimPickId).toBe('cw-1');
  });

  it('includes a center line', () => {
    const group = curtainWallPlanThree(BASE_CURTAIN);
    const lines = group.children.filter((c) => c instanceof THREE.Line);
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it('adds tick marks for vertical grid divisions', () => {
    const group = curtainWallPlanThree(BASE_CURTAIN);
    // 3 divisions -> 2 internal tick marks + 1 center line = 3 total lines
    const lines = group.children.filter((c) => c instanceof THREE.Line);
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('shows no tick marks when vCount is 0 or 1', () => {
    const wall: WallElem = { ...BASE_CURTAIN, id: 'cw-no-ticks', curtainWallVCount: 1 };
    const group = curtainWallPlanThree(wall);
    // Only center line
    const lines = group.children.filter((c) => c instanceof THREE.Line);
    expect(lines.length).toBe(1);
  });
});
