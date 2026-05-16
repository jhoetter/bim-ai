import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSteelConnectionMesh } from './meshBuilders';
import type { Element } from '@bim-ai/core';

type SteelConn = Extract<Element, { kind: 'steel_connection' }>;

function makeConn(overrides: Partial<SteelConn> = {}): SteelConn {
  return {
    kind: 'steel_connection',
    id: 'conn-1',
    connectionType: 'end_plate',
    hostElementId: 'beam-1',
    positionT: 1.0,
    plateSizeMm: { width: 150, height: 200, thickness: 10 },
    boltRows: 2,
    boltCols: 2,
    boltDiameterMm: 20,
    ...overrides,
  };
}

describe('buildSteelConnectionMesh', () => {
  it('returns a THREE.Group for end_plate', () => {
    const grp = buildSteelConnectionMesh(makeConn({ connectionType: 'end_plate' }));
    expect(grp).toBeInstanceOf(THREE.Group);
  });

  it('end_plate group has plate mesh and bolt meshes (>= 2 children)', () => {
    const grp = buildSteelConnectionMesh(makeConn({ connectionType: 'end_plate' }));
    expect(grp.children.length).toBeGreaterThanOrEqual(2);
  });

  it('bolted_flange group has 2 plate children', () => {
    const grp = buildSteelConnectionMesh(makeConn({ connectionType: 'bolted_flange' }));
    const plates = grp.children.filter((c) => c instanceof THREE.Mesh);
    expect(plates.length).toBeGreaterThanOrEqual(2);
  });

  it('zero bolt rows/cols produces no crash and group is returned', () => {
    expect(() => buildSteelConnectionMesh(makeConn({ boltRows: 0, boltCols: 0 }))).not.toThrow();
    const grp = buildSteelConnectionMesh(makeConn({ boltRows: 0, boltCols: 0 }));
    expect(grp).toBeInstanceOf(THREE.Group);
    const bolts = grp.children.filter((c) => {
      if (!(c instanceof THREE.Mesh)) return false;
      const geo = (c as THREE.Mesh).geometry;
      return geo instanceof THREE.CylinderGeometry;
    });
    expect(bolts.length).toBe(0);
  });
});
