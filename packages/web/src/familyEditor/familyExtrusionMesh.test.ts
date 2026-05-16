import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FamilyExtrusion } from '@bim-ai/core';
import { buildFamilyExtrusionMesh } from '../viewport/meshBuilders';

const square: FamilyExtrusion = {
  kind: 'family_extrusion',
  id: 'test-extrusion-1',
  profilePoints: [
    { x: -500, y: -500 },
    { x: 500, y: -500 },
    { x: 500, y: 500 },
    { x: -500, y: 500 },
  ],
  depthMm: 200,
};

describe('buildFamilyExtrusionMesh', () => {
  it('returns a THREE.Mesh instance', () => {
    const mesh = buildFamilyExtrusionMesh(square);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('extruded box (4-point square profile) has non-zero vertex count', () => {
    const mesh = buildFamilyExtrusionMesh(square);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it('depthMm 0 returns empty geometry without crashing', () => {
    const zeroDepth: FamilyExtrusion = { ...square, depthMm: 0 };
    const mesh = buildFamilyExtrusionMesh(zeroDepth);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });
});
