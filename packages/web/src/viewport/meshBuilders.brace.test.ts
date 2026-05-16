import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeBraceMesh, type BraceElem } from './meshBuilders.brace';

const BRACE: BraceElem = {
  kind: 'brace',
  id: 'br-1',
  startXMm: 0,
  startYMm: 0,
  startElevationMm: 0,
  endXMm: 3000,
  endYMm: 0,
  endElevationMm: 3000,
  materialKey: null,
  structuralRole: 'structural',
};

describe('makeBraceMesh', () => {
  it('creates a Mesh for a diagonal brace', () => {
    const mesh = makeBraceMesh(BRACE, null);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.bimPickId).toBe('br-1');
  });

  it('positions the mesh at the midpoint of the brace', () => {
    const mesh = makeBraceMesh(BRACE, null);
    expect(mesh.position.x).toBeCloseTo(1.5, 5);
    expect(mesh.position.y).toBeCloseTo(1.5, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('handles a purely horizontal brace', () => {
    const horiz: BraceElem = { ...BRACE, id: 'br-h', endElevationMm: 0 };
    const mesh = makeBraceMesh(horiz, null);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('handles a purely vertical brace', () => {
    const vert: BraceElem = {
      ...BRACE,
      id: 'br-v',
      endXMm: 0,
      endYMm: 0,
      endElevationMm: 4000,
    };
    const mesh = makeBraceMesh(vert, null);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.position.y).toBeCloseTo(2, 5);
  });
});
