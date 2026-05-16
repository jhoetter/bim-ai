import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { terrainPadPlanThree } from './terrainPadPlanThree';
import type { Element } from '@bim-ai/core';

type ToposolidPadElement = Extract<Element, { kind: 'toposolid_pad' }>;

function makePad(overrides: Partial<ToposolidPadElement> = {}): ToposolidPadElement {
  return {
    kind: 'toposolid_pad',
    id: 'pad-1',
    toposolidId: 'topo-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 5000 },
      { xMm: 0, yMm: 5000 },
    ],
    elevationMm: 1000,
    ...overrides,
  };
}

describe('terrainPadPlanThree — §5.1.4', () => {
  it('returns Group with children for a valid pad', () => {
    const grp = terrainPadPlanThree(makePad());
    expect(grp).toBeInstanceOf(THREE.Group);
    expect(grp.children.length).toBeGreaterThan(0);
    expect(grp.userData.bimPickId).toBe('pad-1');
  });

  it('returns empty Group for pad with <3 boundary points', () => {
    const grp = terrainPadPlanThree(
      makePad({
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
        ],
      }),
    );
    expect(grp).toBeInstanceOf(THREE.Group);
    expect(grp.children).toHaveLength(0);
  });
});
