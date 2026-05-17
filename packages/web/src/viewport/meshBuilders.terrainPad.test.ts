import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTerrainPadMesh } from './meshBuilders.terrainPad';
import type { Element } from '@bim-ai/core';

type ToposolidPadEl = Extract<Element, { kind: 'toposolid_pad' }>;

function makePad(overrides: Partial<ToposolidPadEl> = {}): ToposolidPadEl {
  return {
    kind: 'toposolid_pad',
    id: 'pad-test',
    toposolidId: 'topo-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 6000, yMm: 0 },
      { xMm: 6000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    elevationMm: 2000,
    ...overrides,
  };
}

describe('buildTerrainPadMesh — §5.1.4', () => {
  it('returns empty Mesh when fewer than 3 boundary points', () => {
    const mesh = buildTerrainPadMesh(
      makePad({
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
        ],
      }),
    );
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    // empty mesh has no geometry vertices
    expect(mesh.geometry.attributes['position']).toBeUndefined();
  });

  it('returns a Mesh at the correct elevation', () => {
    const elevationMm = 3000;
    const mesh = buildTerrainPadMesh(makePad({ elevationMm }));
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    // The geometry is translated so position values include the elevation offset
    const pos = mesh.geometry.attributes['position'];
    expect(pos).toBeDefined();
    // All Y values should be at elevationMm / 1000
    const eM = elevationMm / 1000;
    let allAtElevation = true;
    for (let i = 0; i < pos!.count; i++) {
      if (Math.abs(pos!.getY(i) - eM) > 0.001) {
        allAtElevation = false;
        break;
      }
    }
    expect(allAtElevation).toBe(true);
  });

  it('mesh has bimPickId userData', () => {
    const mesh = buildTerrainPadMesh(makePad({ id: 'my-pad-id' }));
    expect(mesh.userData.bimPickId).toBe('my-pad-id');
  });
});
