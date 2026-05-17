import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildFamilySweepMesh } from './meshBuilders.familySweep';

type FamilySweepEl = Extract<import('@bim-ai/core').Element, { kind: 'family_sweep' }>;

const triangleProfile: { xMm: number; yMm: number }[] = [
  { xMm: -100, yMm: -100 },
  { xMm: 100, yMm: -100 },
  { xMm: 0, yMm: 100 },
];

const validSweep: FamilySweepEl = {
  kind: 'family_sweep',
  id: 'test-sweep-vp-1',
  profileMm: triangleProfile,
  pathMm: [
    { xMm: 0, yMm: 0, zMm: 0 },
    { xMm: 500, yMm: 0, zMm: 500 },
    { xMm: 1000, yMm: 0, zMm: 0 },
  ],
  materialId: null,
};

describe('family sweep mesh — §15.1.2', () => {
  it('returns a Mesh with bimPickId userData', () => {
    const mesh = buildFamilySweepMesh(validSweep);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.bimPickId).toBe('test-sweep-vp-1');
  });

  it('builds geometry from profile and path', () => {
    const mesh = buildFamilySweepMesh(validSweep);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it('returns an empty Mesh when pathMm has fewer than 2 points', () => {
    const mesh = buildFamilySweepMesh({
      ...validSweep,
      pathMm: [{ xMm: 0, yMm: 0, zMm: 0 }],
    });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });

  it('returns an empty Mesh when profileMm has fewer than 3 points', () => {
    const mesh = buildFamilySweepMesh({
      ...validSweep,
      profileMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
      ],
    });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });
});
