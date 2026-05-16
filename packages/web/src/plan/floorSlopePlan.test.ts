import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { floorSlopeArrowPlanThree } from './floorSlopePlanThree';
import type { Element } from '@bim-ai/core';

type FloorElem = Extract<Element, { kind: 'floor' }>;

function makeFloor(overrides: Partial<FloorElem> = {}): FloorElem {
  return {
    kind: 'floor',
    id: 'floor-1',
    name: 'F1',
    levelId: 'lvl-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 5000 },
      { xMm: 0, yMm: 5000 },
    ],
    thicknessMm: 200,
    ...overrides,
  };
}

describe('floorSlopeArrowPlanThree — §3.4.1', () => {
  it('returns null when no slope arrow is set', () => {
    expect(floorSlopeArrowPlanThree(makeFloor())).toBeNull();
    expect(
      floorSlopeArrowPlanThree(
        makeFloor({
          slopeArrowTailMm: { xMm: 0, yMm: 0 },
          slopeArrowHeadMm: { xMm: 1000, yMm: 0 },
          // slopePercent absent
        }),
      ),
    ).toBeNull();
    expect(
      floorSlopeArrowPlanThree(
        makeFloor({
          slopePercent: 5,
          // tail/head absent
        }),
      ),
    ).toBeNull();
  });

  it('returns a Group with line + label for a sloped floor', () => {
    const grp = floorSlopeArrowPlanThree(
      makeFloor({
        slopeArrowTailMm: { xMm: 0, yMm: 0 },
        slopeArrowHeadMm: { xMm: 2000, yMm: 0 },
        slopePercent: 5,
      }),
    );
    expect(grp).toBeInstanceOf(THREE.Group);
    expect(grp!.children.length).toBeGreaterThanOrEqual(2);
    const hasLine = grp!.children.some((c) => c instanceof THREE.Line);
    const hasSprite = grp!.children.some((c) => c instanceof THREE.Sprite);
    expect(hasLine).toBe(true);
    expect(hasSprite).toBe(true);
  });

  it('userData.bimPickId is set to floor id', () => {
    const grp = floorSlopeArrowPlanThree(
      makeFloor({
        id: 'floor-abc',
        slopeArrowTailMm: { xMm: 0, yMm: 0 },
        slopeArrowHeadMm: { xMm: 1000, yMm: 0 },
        slopePercent: 2,
      }),
    );
    expect(grp).not.toBeNull();
    expect(grp!.userData.bimPickId).toBe('floor-abc');
  });
});
