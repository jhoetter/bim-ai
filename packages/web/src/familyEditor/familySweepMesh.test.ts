import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FamilySweep } from '@bim-ai/core';
import { familySweepMesh } from './meshBuilders.familySweep';

const validSweep: FamilySweep = {
  kind: 'family_sweep',
  id: 'test-sweep-1',
  profilePoints: [
    { x: -100, y: -100 },
    { x: 100, y: -100 },
    { x: 0, y: 100 },
  ],
  pathPoints: [
    { x: 0, y: 0, z: 0 },
    { x: 500, y: 0, z: 500 },
    { x: 1000, y: 0, z: 0 },
  ],
};

describe('familySweepMesh — §15.1.3', () => {
  it('returns empty Mesh when pathPoints has fewer than 2 points', () => {
    const form: FamilySweep = { ...validSweep, pathPoints: [{ x: 0, y: 0, z: 0 }] };
    const mesh = familySweepMesh(form);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });

  it('returns empty Mesh when profilePoints has fewer than 3 points', () => {
    const form: FamilySweep = {
      ...validSweep,
      profilePoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    const mesh = familySweepMesh(form);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });

  it('returns a Mesh with geometry for valid sweep', () => {
    const mesh = familySweepMesh(validSweep);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it('mesh userData contains kind=family_sweep', () => {
    const mesh = familySweepMesh(validSweep);
    expect(mesh.userData.kind).toBe('family_sweep');
  });
});
