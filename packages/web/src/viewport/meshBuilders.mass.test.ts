import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildMassMesh, type LevelElem, type MassElem } from './meshBuilders.mass';

const LEVEL: LevelElem = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Ground',
  elevationMm: 0,
};

describe('buildMassMesh', () => {
  it('builds an extruded translucent volume from an axis-aligned 4-vertex footprint', () => {
    const mass: MassElem = {
      kind: 'mass',
      id: 'm1',
      name: 'Box',
      levelId: 'lvl-1',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 8000 },
        { xMm: 0, yMm: 8000 },
      ],
      heightMm: 6000,
      rotationDeg: 0,
      materialKey: null,
      phaseId: 'massing',
      pinned: false,
    };

    const { mesh, outline } = buildMassMesh(mass, LEVEL);

    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(outline).toBeInstanceOf(THREE.LineSegments);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeCloseTo(0.35, 6);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mesh.userData.bimPickId).toBe('m1');

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    expect(bb.min.x).toBeCloseTo(0, 6);
    expect(bb.max.x).toBeCloseTo(5, 6);
    expect(bb.min.y).toBeCloseTo(0, 6);
    expect(bb.max.y).toBeCloseTo(6, 6);
    expect(bb.min.z).toBeCloseTo(0, 6);
    expect(bb.max.z).toBeCloseTo(8, 6);
  });

  it('builds extra geometry for an L-shaped (5+ vertex) footprint', () => {
    const mass: MassElem = {
      kind: 'mass',
      id: 'm2',
      name: 'L',
      levelId: 'lvl-1',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 6000, yMm: 0 },
        { xMm: 6000, yMm: 3000 },
        { xMm: 3000, yMm: 3000 },
        { xMm: 3000, yMm: 6000 },
        { xMm: 0, yMm: 6000 },
      ],
      heightMm: 3000,
      rotationDeg: 0,
      materialKey: null,
      phaseId: 'massing',
      pinned: false,
    };

    const rect: MassElem = {
      ...mass,
      id: 'm-rect',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 8000 },
        { xMm: 0, yMm: 8000 },
      ],
    };

    const { mesh: lMesh } = buildMassMesh(mass, LEVEL);
    const { mesh: rMesh } = buildMassMesh(rect, LEVEL);

    const lCount = lMesh.geometry.getAttribute('position').count;
    const rCount = rMesh.geometry.getAttribute('position').count;
    expect(lCount).toBeGreaterThan(8);
    expect(lCount).toBeGreaterThan(rCount);
  });

  it('positions the mesh at the host level elevation', () => {
    const mass: MassElem = {
      kind: 'mass',
      id: 'm3',
      name: 'Upper',
      levelId: 'lvl-2',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1000 },
        { xMm: 0, yMm: 1000 },
      ],
      heightMm: 3000,
      rotationDeg: 0,
      materialKey: null,
      phaseId: 'massing',
      pinned: false,
    };
    const lvl: LevelElem = { kind: 'level', id: 'lvl-2', name: 'L2', elevationMm: 3500 };
    const { mesh } = buildMassMesh(mass, lvl);
    expect(mesh.position.y).toBeCloseTo(3.5, 6);
  });

  it('applies rotationDeg around the polygon centroid', () => {
    const mass: MassElem = {
      kind: 'mass',
      id: 'm4',
      name: 'Rotated',
      levelId: 'lvl-1',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2000, yMm: 0 },
        { xMm: 2000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ],
      heightMm: 3000,
      rotationDeg: 45,
      materialKey: null,
      phaseId: 'massing',
      pinned: false,
    };
    const { mesh } = buildMassMesh(mass, LEVEL);
    expect(mesh.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(45), 6);
  });

  it('attaches the outline as a child of the mesh', () => {
    const mass: MassElem = {
      kind: 'mass',
      id: 'm5',
      name: 'Box',
      levelId: 'lvl-1',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1000 },
        { xMm: 0, yMm: 1000 },
      ],
      heightMm: 2500,
      rotationDeg: 0,
      materialKey: null,
      phaseId: 'massing',
      pinned: false,
    };
    const { mesh, outline } = buildMassMesh(mass, LEVEL);
    expect(mesh.children).toContain(outline);
  });
});
