import * as THREE from 'three';
import { describe, it, expect } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRampMesh } from './meshBuilders';

type RampElem = Extract<Element, { kind: 'ramp' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const lvlBase: LevelElem = { kind: 'level', id: 'lvl-0', name: 'L0', elevationMm: 0 };
const lvlTop: LevelElem = { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 600 };
const elementsById: Record<string, Element> = { 'lvl-0': lvlBase, 'lvl-1': lvlTop };

function makeRamp(overrides: Partial<RampElem> = {}): RampElem {
  return {
    kind: 'ramp',
    id: 'ramp-1',
    name: 'Test Ramp',
    levelId: 'lvl-0',
    topLevelId: 'lvl-1',
    widthMm: 2000,
    runMm: 7200,
    runAngleDeg: 0,
    insertionXMm: 0,
    insertionYMm: 0,
    hasRailingLeft: false,
    hasRailingRight: false,
    slopePercent: 8.33,
    ...overrides,
  };
}

describe('makeRampMesh', () => {
  it('returns a THREE.Group with children', () => {
    const group = makeRampMesh(makeRamp(), elementsById, null);
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('sets bimPickId on the group', () => {
    const group = makeRampMesh(makeRamp({ id: 'ramp-xyz' }), elementsById, null);
    expect(group.userData.bimPickId).toBe('ramp-xyz');
  });

  it('vertices span from base elevation to top elevation', () => {
    const group = makeRampMesh(makeRamp(), elementsById, null);
    const yValues: number[] = [];
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const pos = obj.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) yValues.push(pos.getY(i));
      }
    });
    expect(Math.min(...yValues)).toBeCloseTo(0, 2);
    expect(Math.max(...yValues)).toBeCloseTo(0.6, 2);
  });

  it('adds railing line children when both flags are set', () => {
    const group = makeRampMesh(
      makeRamp({ hasRailingLeft: true, hasRailingRight: true }),
      elementsById,
      null,
    );
    expect(group.children.filter((c) => c instanceof THREE.Line).length).toBeGreaterThanOrEqual(2);
  });

  it('adds no railing lines when both flags are false', () => {
    const group = makeRampMesh(
      makeRamp({ hasRailingLeft: false, hasRailingRight: false }),
      elementsById,
      null,
    );
    expect(group.children.filter((c) => c instanceof THREE.Line).length).toBe(0);
  });

  it('handles missing level gracefully', () => {
    expect(() => makeRampMesh(makeRamp(), {}, null)).not.toThrow();
  });
});
