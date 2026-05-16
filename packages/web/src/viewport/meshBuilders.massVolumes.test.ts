import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeMassBoxMesh, type MassBoxElem } from './meshBuilders.massBox';
import { makeMassExtrusionMesh, type MassExtrusionElem } from './meshBuilders.massExtrusion';
import { makeMassRevolutionMesh, type MassRevolutionElem } from './meshBuilders.massRevolution';

describe('makeMassBoxMesh', () => {
  const BOX: MassBoxElem = {
    kind: 'mass_box',
    id: 'mb-1',
    widthMm: 5000,
    depthMm: 8000,
    heightMm: 6000,
    insertionXMm: 0,
    insertionYMm: 0,
    baseElevationMm: 0,
    materialKey: null,
  };

  it('creates a Mesh', () => {
    const mesh = makeMassBoxMesh(BOX);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.bimPickId).toBe('mb-1');
  });

  it('positions the box at insertion point', () => {
    const mesh = makeMassBoxMesh(BOX);
    // center is at widthMm/2 = 2.5m from insertion
    expect(mesh.position.x).toBeCloseTo(2.5, 5);
    expect(mesh.position.y).toBeCloseTo(3.0, 5); // height/2
  });

  it('uses semi-transparent material', () => {
    const mesh = makeMassBoxMesh(BOX);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
  });
});

describe('makeMassExtrusionMesh', () => {
  const EXTR: MassExtrusionElem = {
    kind: 'mass_extrusion',
    id: 'me-1',
    profilePoints: [
      { xMm: 0, yMm: 0 },
      { xMm: 6000, yMm: 0 },
      { xMm: 6000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    heightMm: 9000,
    baseElevationMm: 0,
    materialKey: null,
  };

  it('creates a Mesh', () => {
    const mesh = makeMassExtrusionMesh(EXTR);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.bimPickId).toBe('me-1');
  });

  it('falls back to default shape with fewer than 3 profile points', () => {
    const extr: MassExtrusionElem = { ...EXTR, id: 'me-empty', profilePoints: [] };
    const mesh = makeMassExtrusionMesh(extr);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('places the mesh at baseElevationMm', () => {
    const extr: MassExtrusionElem = { ...EXTR, id: 'me-elev', baseElevationMm: 3500 };
    const mesh = makeMassExtrusionMesh(extr);
    expect(mesh.position.y).toBeCloseTo(3.5, 5);
  });
});

describe('makeMassRevolutionMesh', () => {
  const REV: MassRevolutionElem = {
    kind: 'mass_revolution',
    id: 'mr-1',
    profilePoints: [
      { xMm: 0, yMm: 0 },
      { xMm: 3000, yMm: 0 },
      { xMm: 3000, yMm: 5000 },
    ],
    axisPt1: { xMm: 0, yMm: 0 },
    axisPt2: { xMm: 0, yMm: 5000 },
    startAngleDeg: 0,
    endAngleDeg: 360,
    baseElevationMm: 0,
    materialKey: null,
  };

  it('creates a Mesh', () => {
    const mesh = makeMassRevolutionMesh(REV);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.bimPickId).toBe('mr-1');
  });

  it('handles partial revolution', () => {
    const partial: MassRevolutionElem = {
      ...REV,
      id: 'mr-partial',
      startAngleDeg: 0,
      endAngleDeg: 180,
    };
    const mesh = makeMassRevolutionMesh(partial);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });
});
