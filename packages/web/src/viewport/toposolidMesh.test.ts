import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeSiteMesh, makeToposolidMesh } from './meshBuilders';

function surfacePositionArray(group: THREE.Group): Float32Array {
  const mesh = group.children[0] as THREE.Mesh<THREE.BufferGeometry>;
  return mesh.geometry.attributes.position.array as Float32Array;
}

describe('makeToposolidMesh', () => {
  it('matches the flat site pad positive plan-y to world-z convention', () => {
    const group = makeToposolidMesh(
      {
        kind: 'toposolid',
        id: 'topo-1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
          { xMm: 1000, yMm: 2000 },
          { xMm: 0, yMm: 2000 },
        ],
        heightSamples: [],
        thicknessMm: 1000,
        baseElevationMm: 0,
      },
      null,
    );
    const site = makeSiteMesh(
      {
        kind: 'site',
        id: 'site-1',
        name: 'Site',
        referenceLevelId: 'L1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
          { xMm: 1000, yMm: 2000 },
          { xMm: 0, yMm: 2000 },
        ],
      },
      {
        L1: { kind: 'level', id: 'L1', name: 'L1', elevationMm: 0 },
      } as Record<string, Element>,
      null,
    );

    const topoPositions = surfacePositionArray(group);
    const sitePositions = site.geometry.attributes.position.array as Float32Array;
    const topoZValues = Array.from(
      { length: topoPositions.length / 3 },
      (_, i) => topoPositions[i * 3 + 2],
    );
    const siteZValues = Array.from(
      { length: sitePositions.length / 3 },
      (_, i) => sitePositions[i * 3 + 2],
    );

    expect(Math.max(...topoZValues)).toBeCloseTo(2);
    expect(Math.max(...siteZValues)).toBeCloseTo(2);
  });

  it('uses the same positive plan-y to world-z convention as buildings and site', () => {
    const group = makeToposolidMesh(
      {
        kind: 'toposolid',
        id: 'topo-1',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
          { xMm: 1000, yMm: 2000 },
          { xMm: 0, yMm: 2000 },
        ],
        heightSamples: [],
        thicknessMm: 1000,
        baseElevationMm: 0,
      },
      null,
    );

    const positions = surfacePositionArray(group);
    const zValues = Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 2]);

    expect(Math.max(...zValues)).toBeCloseTo(2);
    expect(Math.min(...zValues)).toBeCloseTo(0);
  });

  it('cuts a top surface hole from a toposolid_excavation cutter footprint', () => {
    const topo: Extract<Element, { kind: 'toposolid' }> = {
      kind: 'toposolid',
      id: 'topo-1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 6000, yMm: 0 },
        { xMm: 6000, yMm: 6000 },
        { xMm: 0, yMm: 6000 },
      ],
      heightSamples: [],
      thicknessMm: 1000,
      baseElevationMm: 0,
    };
    const elementsById: Record<string, Element> = {
      'topo-1': topo,
      'floor-1': {
        kind: 'floor',
        id: 'floor-1',
        levelId: 'L1',
        thicknessMm: 200,
        boundaryMm: [
          { xMm: 2000, yMm: 2000 },
          { xMm: 4000, yMm: 2000 },
          { xMm: 4000, yMm: 4000 },
          { xMm: 2000, yMm: 4000 },
        ],
      } as Extract<Element, { kind: 'floor' }>,
      'excav-1': {
        kind: 'toposolid_excavation',
        id: 'excav-1',
        hostToposolidId: 'topo-1',
        cutterElementId: 'floor-1',
        cutMode: 'to_bottom_of_cutter',
        offsetMm: 0,
        customDepthMm: 2000,
      },
    };

    const group = makeToposolidMesh(topo, null, elementsById);
    const positions = surfacePositionArray(group);

    // Outer 4 top vertices + hole 4 top vertices + matching underside vertices.
    expect(positions.length / 3).toBe(16);
  });
});
