import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FamilyRevolve } from '@bim-ai/core';
import { buildFamilyRevolveMesh } from '../viewport/meshBuilders';

const profile: FamilyRevolve = {
  kind: 'family_revolve',
  id: 'test-revolve-1',
  profilePoints: [
    { x: 100, y: 0 },
    { x: 100, y: 500 },
    { x: 200, y: 500 },
    { x: 200, y: 0 },
  ],
  axisMm: { x: 0, z: 0 },
  angleDeg: 360,
};

describe('buildFamilyRevolveMesh', () => {
  it('returns a THREE.Mesh instance', () => {
    const mesh = buildFamilyRevolveMesh(profile);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('full 360° revolve produces a mesh with Y bounds within profile range', () => {
    const mesh = buildFamilyRevolveMesh(profile);
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    // profile Y spans 0..500 mm → 0..0.5 m
    expect(bb.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bb.max.y).toBeLessThanOrEqual(0.501);
  });
});
