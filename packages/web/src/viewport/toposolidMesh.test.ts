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

  // Issue #14 — MF-render-2: toposolid with heightSamples must render with a
  // visibly non-flat top surface. Before the fix, the top surface only had
  // boundary-corner vertices (4 for a rectangle), so even with 44 interior
  // heightSamples the rendered slab looked flat. After the fix, the mesh
  // tessellates the interior on a clipped grid and propagates interior
  // elevation information out to the corners via inverse-distance weighting.
  describe('issue #14 — heightSamples produce a non-flat surface', () => {
    const HILLSIDE_BOUNDARY = [
      { xMm: 0, yMm: 0 },
      { xMm: 20000, yMm: 0 },
      { xMm: 20000, yMm: 15000 },
      { xMm: 0, yMm: 15000 },
    ];
    // East-west 4900mm drop sampled at 5 stations along the hillside (the
    // testhouse-2 IR ships 44, but 5 is sufficient to verify the renderer
    // honours the samples).
    const HILLSIDE_SAMPLES = [
      { xMm: 2000, yMm: 7500, zMm: 2450 },
      { xMm: 7000, yMm: 7500, zMm: 1225 },
      { xMm: 10000, yMm: 7500, zMm: 0 },
      { xMm: 13000, yMm: 7500, zMm: -1225 },
      { xMm: 18000, yMm: 7500, zMm: -2450 },
    ];

    it('produces a top surface whose vertex Y values span the heightSamples range', () => {
      const group = makeToposolidMesh(
        {
          kind: 'toposolid',
          id: 'topo-hill',
          boundaryMm: HILLSIDE_BOUNDARY,
          heightSamples: HILLSIDE_SAMPLES,
          thicknessMm: 1500,
          baseElevationMm: -3000,
        },
        null,
      );

      const positions = surfacePositionArray(group);
      const yValues: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        yValues.push(positions[i + 1]!);
      }
      // Filter out the underside slab (clamped at undersideMm) so the test
      // asserts on the *top* surface specifically.
      const topYValues = yValues.filter((y) => y > -3); // m
      const yMin = Math.min(...topYValues);
      const yMax = Math.max(...topYValues);
      // The hillside should expose at least ~3m of vertical drop on the top
      // surface — the issue's acceptance criterion ("3-4m left-to-right").
      expect(yMax - yMin).toBeGreaterThan(3);
    });

    it('produces a flat top surface when heightSamples is empty', () => {
      const group = makeToposolidMesh(
        {
          kind: 'toposolid',
          id: 'topo-flat',
          boundaryMm: HILLSIDE_BOUNDARY,
          heightSamples: [],
          thicknessMm: 1500,
          baseElevationMm: 0,
        },
        null,
      );

      const positions = surfacePositionArray(group);
      // Legacy path emits exactly 8 vertices: 4 boundary-top at Y=0 and 4
      // boundary-bottom at Y=-1.5. We assert each pair is at one of those two
      // discrete elevations (no interior tessellation).
      expect(positions.length / 3).toBe(8);
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1]!;
        expect(Math.abs(y) < 0.001 || Math.abs(y + 1.5) < 0.001).toBe(true);
      }
    });

    it('tessellates the interior so the surface has many more vertices than the boundary', () => {
      const group = makeToposolidMesh(
        {
          kind: 'toposolid',
          id: 'topo-tess',
          boundaryMm: HILLSIDE_BOUNDARY,
          heightSamples: HILLSIDE_SAMPLES,
          thicknessMm: 1500,
          baseElevationMm: -3000,
        },
        null,
      );

      const positions = surfacePositionArray(group);
      // 4 boundary-top + 4 boundary-bottom = 8 vertices for the legacy path.
      // The tessellated path must add interior grid vertices on top of those.
      expect(positions.length / 3).toBeGreaterThan(50);
    });
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
