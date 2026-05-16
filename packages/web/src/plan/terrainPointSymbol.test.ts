import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { terrainControlPointsPlanThree } from './terrainPointSymbol';
import type { Element } from '@bim-ai/core';

type ToposolidElem = Extract<Element, { kind: 'toposolid' }>;

function makeTopo(heightSamples?: ToposolidElem['heightSamples']): ToposolidElem {
  return {
    kind: 'toposolid',
    id: 'topo-test',
    boundaryMm: [],
    thicknessMm: 300,
    heightSamples,
  };
}

describe('terrainControlPointsPlanThree — §5.1.1', () => {
  it('returns empty Group when no heightSamples', () => {
    const group = terrainControlPointsPlanThree(makeTopo());
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children).toHaveLength(0);
  });

  it('returns empty Group when heightSamples is empty array', () => {
    const group = terrainControlPointsPlanThree(makeTopo([]));
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children).toHaveLength(0);
  });

  it('returns one circle mesh + one sprite per height sample', () => {
    const topo = makeTopo([
      { xMm: 0, yMm: 0, zMm: 100 },
      { xMm: 1000, yMm: 2000, zMm: 200 },
    ]);
    const group = terrainControlPointsPlanThree(topo);
    // each sample produces a circle mesh + a label sprite = 2 children per sample
    expect(group.children).toHaveLength(4);
  });

  it('userData.heightSampleIndex matches array index', () => {
    const topo = makeTopo([
      { xMm: 0, yMm: 0, zMm: 50 },
      { xMm: 500, yMm: 500, zMm: 150 },
      { xMm: 1000, yMm: 1000, zMm: 250 },
    ]);
    const group = terrainControlPointsPlanThree(topo);
    const meshes = group.children.filter((c) => c instanceof THREE.Mesh);
    expect(meshes).toHaveLength(3);
    meshes.forEach((mesh, i) => {
      expect((mesh.userData as { heightSampleIndex: number }).heightSampleIndex).toBe(i);
    });
  });
});
