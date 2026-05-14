import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSweepGeometry, makeSweepMesh } from './sweepMesh';
import type { Element } from '@bim-ai/core';

function bbox(geom: THREE.BufferGeometry) {
  geom.computeBoundingBox();
  const b = geom.boundingBox!;
  return {
    min: { x: b.min.x, y: b.min.y, z: b.min.z },
    max: { x: b.max.x, y: b.max.y, z: b.max.z },
  };
}

describe('buildSweepGeometry', () => {
  it('extrudes a rectangle profile along a straight horizontal path', () => {
    const path = [
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 1000, yMm: 0, zMm: 0 },
    ];
    const profile = [
      { uMm: -50, vMm: -25 },
      { uMm: 50, vMm: -25 },
      { uMm: 50, vMm: 25 },
      { uMm: -50, vMm: 25 },
    ];
    const geom = buildSweepGeometry(path, profile);
    const positions = geom.getAttribute('position');
    // 2 rings × 4 verts = 8.
    expect(positions.count).toBe(8);
    const b = bbox(geom);
    expect(b.max.x - b.min.x).toBeGreaterThanOrEqual(999);
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(1001);
  });

  it('extrudes a closed gable picture-frame outline', () => {
    // Closed gable polygon on the south facade (Z=0 in world).
    // Plan -> world: (x, y_plan=0 -> -z_world=0, z_plan=height -> y_world=height)
    const path = [
      { xMm: 0, yMm: 0, zMm: 3000 },
      { xMm: 5000, yMm: 0, zMm: 3000 },
      { xMm: 5000, yMm: 0, zMm: 4500 },
      { xMm: 3200, yMm: 0, zMm: 6800 },
      { xMm: 0, yMm: 0, zMm: 4200 },
      { xMm: 0, yMm: 0, zMm: 3000 }, // close
    ];
    const profile = [
      { uMm: -100, vMm: -50 },
      { uMm: 100, vMm: -50 },
      { uMm: 100, vMm: 50 },
      { uMm: -100, vMm: 50 },
    ];
    const geom = buildSweepGeometry(path, profile);
    const positions = geom.getAttribute('position');
    // Closed planar gable polygon takes the ExtrudeGeometry-based ring
    // fast path (avoids parallel-transport ribbon-twist artifacts at
    // sharp corners); ring vertex count varies with shape complexity but
    // must be > 0.
    expect(positions.count).toBeGreaterThan(0);
    const b = bbox(geom);
    // Roof ridge at z=6800 → world Y ~6800; bottom at ~3000.
    // The ring straddles a small inward/outward offset so bounds
    // expand slightly past the path extents.
    expect(b.max.y).toBeGreaterThanOrEqual(6700);
    expect(b.min.y).toBeLessThanOrEqual(3010);
  });

  it('throws on too-short path or profile', () => {
    expect(() =>
      buildSweepGeometry(
        [{ xMm: 0, yMm: 0 }],
        [
          { uMm: 0, vMm: 0 },
          { uMm: 1, vMm: 0 },
          { uMm: 0, vMm: 1 },
        ],
      ),
    ).toThrow();
    expect(() =>
      buildSweepGeometry(
        [
          { xMm: 0, yMm: 0 },
          { xMm: 1, yMm: 0 },
        ],
        [
          { uMm: 0, vMm: 0 },
          { uMm: 1, vMm: 0 },
        ],
      ),
    ).toThrow();
  });
});

describe('makeSweepMesh', () => {
  const sweepBase: Extract<Element, { kind: 'sweep' }> = {
    kind: 'sweep',
    id: 'sw-1',
    levelId: 'lvl-1',
    pathMm: [
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 1000, yMm: 0, zMm: 0 },
    ],
    profileMm: [
      { uMm: -50, vMm: -25 },
      { uMm: 50, vMm: -25 },
      { uMm: 50, vMm: 25 },
      { uMm: -50, vMm: 25 },
    ],
    profilePlane: 'work_plane',
    materialKey: 'render_white',
  };

  it('produces a mesh scaled mm→m and positioned at level elevation', () => {
    const sweep: Extract<Element, { kind: 'sweep' }> = { ...sweepBase };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
    };
    const mesh = makeSweepMesh(sweep, elementsById, null);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect((mesh as THREE.Mesh).scale.x).toBeCloseTo(0.001, 6);
    expect(mesh.position.y).toBeCloseTo(3, 6);
    expect(mesh.userData.bimPickId).toBe('sw-1');
  });

  it('uses transparent depth-safe material for glass sweeps', () => {
    const sweep: Extract<Element, { kind: 'sweep' }> = {
      ...sweepBase,
      materialKey: 'glass_clear',
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
    };
    const mesh = makeSweepMesh(sweep, elementsById, null) as THREE.Mesh;
    const mat = mesh.material as THREE.MeshPhysicalMaterial;

    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.transmission).toBeGreaterThanOrEqual(0.85);
  });
});
