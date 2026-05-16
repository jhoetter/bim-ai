import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { terrainContourPlanThree } from './terrainContourPlanThree';

type ToposolidElem = Extract<Element, { kind: 'toposolid' }>;

const baseTopo: ToposolidElem = {
  kind: 'toposolid',
  id: 'topo-1',
  thicknessMm: 300,
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  heightSamples: [
    { xMm: 0, yMm: 0, zMm: 0 },
    { xMm: 10000, yMm: 0, zMm: 3000 },
    { xMm: 10000, yMm: 10000, zMm: 3000 },
    { xMm: 0, yMm: 10000, zMm: 0 },
  ],
};

describe('terrainContourPlanThree — §5.1.3', () => {
  it('returns empty Group when contourIntervalMm=0', () => {
    const topo = { ...baseTopo, contourIntervalMm: 0 };
    const group = terrainContourPlanThree(topo);
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children).toHaveLength(0);
  });

  it('returns empty Group when contourIntervalMm is undefined', () => {
    const topo = { ...baseTopo, contourIntervalMm: undefined };
    const group = terrainContourPlanThree(topo);
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children).toHaveLength(0);
  });

  it('returns Group with Line children for a sloped toposolid', () => {
    const topo = { ...baseTopo, contourIntervalMm: 1000 };
    const group = terrainContourPlanThree(topo);
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThan(0);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Line);
    }
  });

  it('sets bimPickId on group', () => {
    const topo = { ...baseTopo, contourIntervalMm: 1000 };
    const group = terrainContourPlanThree(topo);
    expect(group.userData.bimPickId).toBe('topo-1');
  });

  it('line vertices use correct Y coordinate (PLAN_Y + 0.004)', () => {
    const topo = { ...baseTopo, contourIntervalMm: 1000 };
    const group = terrainContourPlanThree(topo);
    const line = group.children[0] as THREE.Line;
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Y component of every vertex should be PLAN_Y + 0.004 = 0.024
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeCloseTo(0.024, 5);
    }
  });
});
