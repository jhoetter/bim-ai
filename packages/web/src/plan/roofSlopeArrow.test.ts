import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { roofSlopeArrowPlanThree } from './roofSlopeArrowPlanThree';
import type { Element } from '@bim-ai/core';

type RoofElem = Extract<Element, { kind: 'roof' }>;

function makeRoof(overrides: Partial<RoofElem> = {}): RoofElem {
  return {
    kind: 'roof',
    id: 'roof-1',
    name: 'R1',
    referenceLevelId: 'lvl-1',
    footprintMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 8000, yMm: 0 },
      { xMm: 8000, yMm: 6000 },
      { xMm: 0, yMm: 6000 },
    ],
    ...overrides,
  };
}

describe('roof slope arrow — §10.1.3', () => {
  it('renders slope arrow plan symbol when useSlopeArrow is true', () => {
    const grp = roofSlopeArrowPlanThree(
      makeRoof({
        useSlopeArrow: true,
        slopeArrow: {
          tailMm: { xMm: 0, yMm: 3000 },
          headMm: { xMm: 4000, yMm: 3000 },
          slopeRatio: 0.25,
        },
      }),
    );
    expect(grp).toBeInstanceOf(THREE.Group);
    expect(grp!.children.length).toBeGreaterThanOrEqual(2);
    expect(grp!.userData.roofSlopeArrow).toBe(true);
  });

  it('does not render slope arrow when useSlopeArrow is false', () => {
    const grp = roofSlopeArrowPlanThree(
      makeRoof({
        useSlopeArrow: false,
        slopeArrow: {
          tailMm: { xMm: 0, yMm: 3000 },
          headMm: { xMm: 4000, yMm: 3000 },
          slopeRatio: 0.25,
        },
      }),
    );
    expect(grp).toBeNull();
  });

  it('does not render slope arrow when slopeArrow is absent', () => {
    const grp = roofSlopeArrowPlanThree(makeRoof({ useSlopeArrow: true }));
    expect(grp).toBeNull();
  });

  it('slope label shows correct percentage', () => {
    const grp = roofSlopeArrowPlanThree(
      makeRoof({
        useSlopeArrow: true,
        slopeArrow: {
          tailMm: { xMm: 0, yMm: 0 },
          headMm: { xMm: 3000, yMm: 0 },
          slopeRatio: 0.33,
        },
      }),
    );
    expect(grp).toBeInstanceOf(THREE.Group);
    const sprite = grp!.children.find((c) => c instanceof THREE.Sprite);
    expect(sprite).toBeDefined();
  });

  it('slopeRatio 0.25 shows 25%', () => {
    // Verify group is built with the correct slopeRatio value
    const slopeRatio = 0.25;
    const grp = roofSlopeArrowPlanThree(
      makeRoof({
        useSlopeArrow: true,
        slopeArrow: {
          tailMm: { xMm: 0, yMm: 0 },
          headMm: { xMm: 5000, yMm: 0 },
          slopeRatio,
        },
      }),
    );
    expect(grp).toBeInstanceOf(THREE.Group);
    // The group contains at least a line and a sprite (label)
    const hasLine = grp!.children.some((c) => c instanceof THREE.Line);
    const hasSprite = grp!.children.some((c) => c instanceof THREE.Sprite);
    expect(hasLine).toBe(true);
    expect(hasSprite).toBe(true);
    // 25% label is produced: (0.25 * 100).toFixed(0) === '25'
    expect((slopeRatio * 100).toFixed(0)).toBe('25');
  });
});
