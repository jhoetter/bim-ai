import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FamilyBlend } from '@bim-ai/core';
import { familyBlendMesh } from './meshBuilders.familyBlend';

const validBlend: FamilyBlend = {
  kind: 'family_blend',
  id: 'test-blend-1',
  bottomProfilePoints: [
    { x: -500, y: -500 },
    { x: 500, y: -500 },
    { x: 500, y: 500 },
    { x: -500, y: 500 },
  ],
  topProfilePoints: [
    { x: -250, y: -250 },
    { x: 250, y: -250 },
    { x: 250, y: 250 },
    { x: -250, y: 250 },
  ],
  heightMm: 1000,
};

describe('familyBlendMesh — §15.1.4', () => {
  it('returns empty Mesh for heightMm <= 0', () => {
    const form: FamilyBlend = { ...validBlend, heightMm: 0 };
    const mesh = familyBlendMesh(form);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });

  it('returns empty Mesh when bottom profile has fewer than 3 points', () => {
    const form: FamilyBlend = {
      ...validBlend,
      bottomProfilePoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    const mesh = familyBlendMesh(form);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBe(0);
  });

  it('returns a Mesh with geometry for valid blend', () => {
    const mesh = familyBlendMesh(validBlend);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });

  it('top cap vertices are at heightMm above bottom cap', () => {
    const mesh = familyBlendMesh(validBlend);
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    // heightMm = 1000 → 1.0 m
    expect(bb.max.z).toBeCloseTo(1.0, 3);
    expect(bb.min.z).toBeCloseTo(0, 3);
  });
});
