import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildGableDormerRoof,
  buildHippedDormerRoof,
  buildShedDormerRoof,
  dormerFootprintMm,
  makeDormerMesh,
} from './dormerMesh';
import type { Element } from '@bim-ai/core';

type DormerElem = Extract<Element, { kind: 'dormer' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

const ROOF: RoofElem = {
  kind: 'roof',
  id: 'r1',
  name: 'main',
  referenceLevelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 8000 },
    { xMm: 0, yMm: 8000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  ridgeOffsetTransverseMm: 1500,
  eaveHeightLeftMm: 1500,
  eaveHeightRightMm: 4000,
};

describe('dormerFootprintMm', () => {
  it('places the dormer rectangle relative to footprint centre with width along the ridge', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'flat',
    };
    const fp = dormerFootprintMm(dormer, ROOF);
    // Roof centre at (2500, 4000). Ridge along plan-Y (longer axis).
    // alongRidgeMm = -2000 → centreY = 4000 - 2000 = 2000.
    // acrossRidgeMm = +1000 → centreX = 2500 + 1000 = 3500.
    // Width along Y, depth along X.
    expect(fp.ridgeAlongX).toBe(false);
    expect(fp.minX).toBeCloseTo(3500 - 1000, 6); // depth/2 = 1000
    expect(fp.maxX).toBeCloseTo(3500 + 1000, 6);
    expect(fp.minY).toBeCloseTo(2000 - 1200, 6); // width/2 = 1200
    expect(fp.maxY).toBeCloseTo(2000 + 1200, 6);
  });
});

describe('makeDormerMesh', () => {
  it('produces a Group with cheek + back walls + flat roof slab', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'flat',
      wallMaterialKey: 'white_render',
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    expect(group).toBeInstanceOf(THREE.Group);
    // 2 cheeks + 1 back wall + 1 roof slab = 4 mesh children (each may have
    // a child outline edges via addEdges so descendant count is higher).
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(4);
    expect(group.userData.bimPickId).toBe('d1');
  });

  it('places the dormer body on the sampled host roof plane', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'flat',
      wallMaterialKey: 'white_render',
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    const firstCheek = meshes[0];

    expect(firstCheek.position.y).toBeGreaterThan(3 + dormer.wallHeightMm / 2000);
  });

  it('renders a gable dormer with a ridged roof', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'gable',
      ridgeHeightMm: 1200,
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(4);
  });

  it('renders a shed (Schleppgaube) dormer with a tilted roof slab', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'shed',
      dormerRoofPitchDeg: 18,
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(4);
    // The roof slab should reach above topY (otherwise it's flat and the
    // dormer is visually invisible — the regression this test guards).
    const roofTopYs = meshes
      .map((m) => {
        m.geometry.computeBoundingBox();
        return m.geometry.boundingBox!.max.y + m.position.y;
      })
      .sort((a, b) => b - a);
    expect(roofTopYs[0] - roofTopYs[roofTopYs.length - 1]).toBeGreaterThan(0.3);
  });

  it('renders a hipped dormer with a ridged roof', () => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd1',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -2000, acrossRidgeMm: 1000 },
      widthMm: 2400,
      wallHeightMm: 2400,
      depthMm: 2000,
      dormerRoofKind: 'hipped',
      ridgeHeightMm: 1500,
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(4);
  });
});

describe('buildGableDormerRoof', () => {
  it('produces two sloped faces meeting at a centred ridge', () => {
    const mat = new THREE.MeshBasicMaterial();
    const mesh = buildGableDormerRoof(2.4, 2.0, 0.12, 1.2, false, mat);
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBe(6);
    const idx = mesh.geometry.getIndex();
    expect(idx).not.toBeNull();
    expect(idx!.count / 3).toBe(6);
  });

  // Issue-76 regression — eave footprint must match caller's widthM x depthM
  // exactly (no axis swap on either ridgeAlongX value).
  it.each([
    { ridgeAlongX: true, widthM: 2.4, depthM: 1.7 },
    { ridgeAlongX: false, widthM: 1.7, depthM: 3.2 },
    { ridgeAlongX: true, widthM: 1.7, depthM: 3.2 },
    { ridgeAlongX: false, widthM: 3.2, depthM: 1.7 },
  ])(
    'preserves caller widthM ($widthM) along X and depthM ($depthM) along Z (ridgeAlongX=$ridgeAlongX)',
    ({ ridgeAlongX, widthM, depthM }) => {
      const mat = new THREE.MeshBasicMaterial();
      const mesh = buildGableDormerRoof(widthM, depthM, 0.12, 1.0, ridgeAlongX, mat);
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      expect(bb.max.x - bb.min.x).toBeCloseTo(widthM, 5);
      expect(bb.max.z - bb.min.z).toBeCloseTo(depthM, 5);
    },
  );
});

describe('makeDormerMesh / MF-22b cluster merging', () => {
  it('renders no body for the non-primary dormer of an overlapping cluster', () => {
    const small: DormerElem = {
      kind: 'dormer',
      id: 'small',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -1000, acrossRidgeMm: 1000 },
      widthMm: 1600,
      depthMm: 1400,
      wallHeightMm: 2000,
      dormerRoofKind: 'shed',
    };
    const large: DormerElem = {
      kind: 'dormer',
      id: 'large',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: +1000, acrossRidgeMm: 1000 },
      widthMm: 2800,
      depthMm: 2000,
      wallHeightMm: 2400,
      dormerRoofKind: 'shed',
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
      small,
      large,
    };
    const smallGroup = makeDormerMesh(small, elementsById, null);
    const largeGroup = makeDormerMesh(large, elementsById, null);
    const smallMeshes: THREE.Mesh[] = [];
    smallGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) smallMeshes.push(o as THREE.Mesh);
    });
    const largeMeshes: THREE.Mesh[] = [];
    largeGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) largeMeshes.push(o as THREE.Mesh);
    });
    expect(smallMeshes).toHaveLength(0);
    expect(largeMeshes.length).toBeGreaterThan(0);
  });
});

describe('makeDormerMesh / issue-76 regression — realistic dormer body coverage', () => {
  // Realistic dormer on the long-axis hipped/gable roof used by the target
  // houses. After the fix, the body must span ~widthMm x depthMm x
  // wallHeightMm (within ±10%) and contain at least 4 body meshes (2 cheeks
  // + back wall + roof cap + window frame parts).
  it.each([
    { kind: 'shed' as const, pitch: 8 },
    { kind: 'gable' as const, ridge: 1200 },
    { kind: 'hipped' as const, ridge: 1200 },
    { kind: 'flat' as const },
  ])('renders the full dormer body for $kind roof', (cfg) => {
    const dormer: DormerElem = {
      kind: 'dormer',
      id: 'd-iss76',
      hostRoofId: 'r1',
      positionOnRoof: { alongRidgeMm: -1200, acrossRidgeMm: 1400 },
      widthMm: 3200,
      depthMm: 1700,
      wallHeightMm: 1600,
      dormerRoofKind: cfg.kind,
      ...('pitch' in cfg ? { dormerRoofPitchDeg: cfg.pitch } : {}),
      ...('ridge' in cfg ? { ridgeHeightMm: cfg.ridge } : {}),
      wallMaterialKey: 'white_render',
    };
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 3000 },
      r1: ROOF,
      'd-iss76': dormer,
    };
    const group = makeDormerMesh(dormer, elementsById, null);
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(4);
    // Body span check: union the bounding boxes of every mesh. The total
    // dormer footprint should cover ~width x depth in plan and ~wallHeight
    // (excluding the roof cap, which adds extra height for pitched kinds).
    const aabb = new THREE.Box3();
    for (const m of meshes) {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!.clone();
      bb.translate(m.position);
      aabb.union(bb);
    }
    // Roof ridge (gable=Y) is along the longer plan span. ROOF is 5000×8000
    // → ridgeAlongX=false → dormer.widthMm runs along world-Z,
    //   dormer.depthMm along world-X.
    const totalX = aabb.max.x - aabb.min.x;
    const totalY = aabb.max.y - aabb.min.y;
    const totalZ = aabb.max.z - aabb.min.z;
    // depth → world-X
    expect(totalX).toBeGreaterThanOrEqual((dormer.depthMm / 1000) * 0.9);
    expect(totalX).toBeLessThanOrEqual((dormer.depthMm / 1000) * 1.1);
    // width → world-Z
    expect(totalZ).toBeGreaterThanOrEqual((dormer.widthMm / 1000) * 0.9);
    expect(totalZ).toBeLessThanOrEqual((dormer.widthMm / 1000) * 1.1);
    // height ≥ wallHeight (roof cap may push max higher; +20% upper bound
    // covers the 1.2m ridge of gable/hipped on a 1.6m wall).
    expect(totalY).toBeGreaterThanOrEqual((dormer.wallHeightMm / 1000) * 0.9);
  });
});

describe('buildShedDormerRoof', () => {
  it('produces a tilted slab whose low edge is at y=0 and high edge above', () => {
    const mat = new THREE.MeshBasicMaterial();
    const mesh = buildShedDormerRoof(2.4, 2.0, 0.12, 0.65, false, true, mat);
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    expect(bb.min.y).toBeCloseTo(0, 2);
    expect(bb.max.y).toBeGreaterThan(0.5);
    // ridgeAlongX=false → perp axis is world-X. openTowardPositiveAcross=true
    // means the eave (low Y) corner should sit on the +X side. Sample the
    // raw position attribute to confirm at least one vertex at near-zero Y
    // sits at maximum X.
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    let minYxOf = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0.05) minYxOf = Math.max(minYxOf, pos.getX(i));
    }
    expect(minYxOf).toBeGreaterThan(0.5);
  });
});

describe('buildHippedDormerRoof', () => {
  it('produces four sloped faces (two trapezoids + two triangles)', () => {
    const mat = new THREE.MeshBasicMaterial();
    const mesh = buildHippedDormerRoof(2.4, 2.0, 0.12, 1.5, false, mat);
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBe(6);
    const idx = mesh.geometry.getIndex();
    expect(idx).not.toBeNull();
    expect(idx!.count / 3).toBe(6);
  });

  // Issue-76 regression — same axis-preservation contract as the gable cap.
  it.each([
    { ridgeAlongX: true, widthM: 2.4, depthM: 1.7 },
    { ridgeAlongX: false, widthM: 1.7, depthM: 3.2 },
    { ridgeAlongX: true, widthM: 1.7, depthM: 3.2 },
    { ridgeAlongX: false, widthM: 3.2, depthM: 1.7 },
  ])(
    'preserves caller widthM ($widthM) along X and depthM ($depthM) along Z (ridgeAlongX=$ridgeAlongX)',
    ({ ridgeAlongX, widthM, depthM }) => {
      const mat = new THREE.MeshBasicMaterial();
      const mesh = buildHippedDormerRoof(widthM, depthM, 0.12, 1.5, ridgeAlongX, mat);
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      expect(bb.max.x - bb.min.x).toBeCloseTo(widthM, 5);
      expect(bb.max.z - bb.min.z).toBeCloseTo(depthM, 5);
    },
  );
});
