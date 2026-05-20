import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FamilyExtrusion } from '@bim-ai/core';
import { buildWindowFrameMesh, buildGlazingMesh } from './meshBuilders.windowFrame';

const baseFrame: FamilyExtrusion & { widthMm: number; heightMm: number } = {
  kind: 'family_extrusion',
  id: 'frame-test-1',
  profilePoints: [],
  depthMm: 100,
  frameInnerWidthMm: 50,
  widthMm: 900,
  heightMm: 1200,
};

const baseGlazing: FamilyExtrusion & { widthMm: number; heightMm: number } = {
  kind: 'family_extrusion',
  id: 'glazing-test-1',
  profilePoints: [],
  depthMm: 6,
  isGlazing: true,
  frameInnerWidthMm: 50,
  widthMm: 800,
  heightMm: 1100,
};

describe('buildWindowFrameMesh — §15.1.4', () => {
  it('returns a Mesh instance', () => {
    const mesh = buildWindowFrameMesh(baseFrame);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('sets bimPickId on userData', () => {
    const mesh = buildWindowFrameMesh(baseFrame);
    expect(mesh.userData.bimPickId).toBe('frame-test-1');
  });

  it('frame with zero inner width still renders', () => {
    const zeroFrame = { ...baseFrame, frameInnerWidthMm: 0 };
    const mesh = buildWindowFrameMesh(zeroFrame);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });
});

describe('buildGlazingMesh — §15.1.5', () => {
  it('returns a Mesh instance', () => {
    const mesh = buildGlazingMesh(baseGlazing);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('material is transparent', () => {
    const mesh = buildGlazingMesh(baseGlazing);
    const mat = mesh.material as THREE.MeshPhysicalMaterial;
    expect(mat.transparent).toBe(true);
  });

  it('sets bimPickId on userData', () => {
    const mesh = buildGlazingMesh(baseGlazing);
    expect(mesh.userData.bimPickId).toBe('glazing-test-1');
  });
});
