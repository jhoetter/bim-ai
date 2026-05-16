import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ceilingGridPlanThree } from './ceilingGridPlanThree';
import type { Element } from '@bim-ai/core';

type CeilingElem = Extract<Element, { kind: 'ceiling' }>;

function makeCeiling(overrides: Partial<CeilingElem> = {}): CeilingElem {
  return {
    kind: 'ceiling',
    id: 'ceil-1',
    name: 'Test Ceiling',
    levelId: 'lvl-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 6000, yMm: 0 },
      { xMm: 6000, yMm: 6000 },
      { xMm: 0, yMm: 6000 },
    ],
    heightOffsetMm: 2700,
    thicknessMm: 50,
    ...overrides,
  };
}

describe('ceilingGridPlanThree — §8.2', () => {
  it('returns empty Group when gridPatternMm is undefined', () => {
    const group = ceilingGridPlanThree(makeCeiling({ gridPatternMm: undefined }));
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children).toHaveLength(0);
  });

  it('returns empty Group when gridPatternMm is 0', () => {
    const group = ceilingGridPlanThree(makeCeiling({ gridPatternMm: 0 }));
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children).toHaveLength(0);
  });

  it('returns Group with LineSegments when gridPatternMm=600 and square boundary', () => {
    const group = ceilingGridPlanThree(makeCeiling({ gridPatternMm: 600 }));
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThan(0);
    const lineSegs = group.children.find((c) => c instanceof THREE.LineSegments);
    expect(lineSegs).toBeTruthy();
  });

  it('all LineSegments have midpoints inside the boundary', () => {
    const ceiling = makeCeiling({ gridPatternMm: 600 });
    const group = ceilingGridPlanThree(ceiling);
    const lineSegs = group.children.find((c) => c instanceof THREE.LineSegments) as
      | THREE.LineSegments
      | undefined;
    expect(lineSegs).toBeTruthy();

    const pos = lineSegs!.geometry.getAttribute('position');
    const count = pos.count;

    for (let i = 0; i < count; i += 2) {
      const ax = pos.getX(i) * 1000;
      const az = pos.getZ(i) * 1000;
      const bx = pos.getX(i + 1) * 1000;
      const bz = pos.getZ(i + 1) * 1000;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      // midpoint must be inside the 6000x6000 square
      expect(mx).toBeGreaterThanOrEqual(0);
      expect(mx).toBeLessThanOrEqual(6000);
      expect(mz).toBeGreaterThanOrEqual(0);
      expect(mz).toBeLessThanOrEqual(6000);
    }
  });

  it('grid lines are at multiples of gridPatternMm within AABB', () => {
    const step = 600;
    const ceiling = makeCeiling({ gridPatternMm: step });
    const group = ceilingGridPlanThree(ceiling);
    const lineSegs = group.children.find((c) => c instanceof THREE.LineSegments) as
      | THREE.LineSegments
      | undefined;
    expect(lineSegs).toBeTruthy();

    const pos = lineSegs!.geometry.getAttribute('position');
    const count = pos.count;

    for (let i = 0; i < count; i += 2) {
      const ax = pos.getX(i) * 1000;
      const az = pos.getZ(i) * 1000;
      const bx = pos.getX(i + 1) * 1000;
      const bz = pos.getZ(i + 1) * 1000;

      const isVertical = Math.abs(ax - bx) < 1;
      const isHorizontal = Math.abs(az - bz) < 1;
      expect(isVertical || isHorizontal).toBe(true);

      if (isVertical) {
        // x coordinate should be a multiple of step
        expect(Math.round(ax) % step).toBeCloseTo(0, 0);
      } else {
        // z coordinate should be a multiple of step
        expect(Math.round(az) % step).toBeCloseTo(0, 0);
      }
    }
  });
});
