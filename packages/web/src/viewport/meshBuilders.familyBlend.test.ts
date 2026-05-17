import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildFamilyBlendMesh } from './meshBuilders.familyBlend';

type FamilyBlendEl = Extract<import('@bim-ai/core').Element, { kind: 'family_blend' }>;

const squareBottom: { xMm: number; yMm: number }[] = [
  { xMm: -500, yMm: -500 },
  { xMm: 500, yMm: -500 },
  { xMm: 500, yMm: 500 },
  { xMm: -500, yMm: 500 },
];

const squareTop: { xMm: number; yMm: number }[] = [
  { xMm: -250, yMm: -250 },
  { xMm: 250, yMm: -250 },
  { xMm: 250, yMm: 250 },
  { xMm: -250, yMm: 250 },
];

const validBlend: FamilyBlendEl = {
  kind: 'family_blend',
  id: 'test-blend-vp-1',
  bottomProfileMm: squareBottom,
  topProfileMm: squareTop,
  heightMm: 1000,
  baseElevationMm: 0,
  materialId: null,
};

describe('family blend mesh — §15.1.2', () => {
  it('returns a Mesh with bimPickId userData', () => {
    const mesh = buildFamilyBlendMesh(validBlend);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.bimPickId).toBe('test-blend-vp-1');
  });

  it('builds geometry from bottom and top profiles', () => {
    const mesh = buildFamilyBlendMesh(validBlend);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it('handles triangular profiles (3 vertices)', () => {
    const triangleBlend: FamilyBlendEl = {
      ...validBlend,
      id: 'test-blend-tri',
      bottomProfileMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 500, yMm: 0 },
        { xMm: 250, yMm: 500 },
      ],
      topProfileMm: [
        { xMm: 50, yMm: 50 },
        { xMm: 250, yMm: 50 },
        { xMm: 150, yMm: 250 },
      ],
    };
    const mesh = buildFamilyBlendMesh(triangleBlend);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it('returns an empty Mesh for heightMm <= 0', () => {
    const mesh = buildFamilyBlendMesh({ ...validBlend, heightMm: 0 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });

  it('returns an empty Mesh when bottom profile has fewer than 3 points', () => {
    const mesh = buildFamilyBlendMesh({
      ...validBlend,
      bottomProfileMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
      ],
    });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });
});
