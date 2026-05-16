import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FamilyVoid } from '@bim-ai/core';
import { buildFamilyVoidMesh } from '../viewport/meshBuilders';

const square: FamilyVoid = {
  kind: 'family_void',
  id: 'test-void-1',
  profilePoints: [
    { x: -500, y: -500 },
    { x: 500, y: -500 },
    { x: 500, y: 500 },
    { x: -500, y: 500 },
  ],
  depthMm: 200,
};

describe('buildFamilyVoidMesh — §15.1.x', () => {
  it('returns a THREE.Mesh instance', () => {
    const mesh = buildFamilyVoidMesh(square);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('uses wireframe material', () => {
    const mesh = buildFamilyVoidMesh(square);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.wireframe).toBe(true);
  });

  it('depthMm 0 returns mesh without crashing', () => {
    const zeroDepth: FamilyVoid = { ...square, depthMm: 0 };
    const mesh = buildFamilyVoidMesh(zeroDepth);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });
});
