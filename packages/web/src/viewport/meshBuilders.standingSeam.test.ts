/**
 * MAT-01 Part B — vitest for `addStandingSeamPattern`.
 *
 * Verifies that authoring a roof with `materialKey: metal_standing_seam_*`
 * adds raised seam strips to the rendered mesh, and that the seam-decorated
 * mesh has substantially more vertices than the un-decorated one for the
 * same roof footprint.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh, addStandingSeamPattern } from './meshBuilders';

type RoofElem = Extract<Element, { kind: 'roof' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const level: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'L0',
  elevationMm: 0,
};

function makeRectFootprint(spanXMm: number, spanZMm: number): RoofElem['footprintMm'] {
  return [
    { xMm: 0, yMm: 0 },
    { xMm: spanXMm, yMm: 0 },
    { xMm: spanXMm, yMm: spanZMm },
    { xMm: 0, yMm: spanZMm },
  ];
}

function vertexCount(mesh: THREE.Object3D): number {
  let n = 0;
  mesh.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const pos = m.geometry.getAttribute('position');
      if (pos) n += pos.count;
    }
  });
  return n;
}

function seamChildCount(mesh: THREE.Object3D): number {
  let n = 0;
  mesh.traverse((obj) => {
    if ((obj as THREE.Mesh).userData?.seam === true) n += 1;
  });
  return n;
}

describe('addStandingSeamPattern — flat roof', () => {
  const baseRoof: RoofElem = {
    kind: 'roof',
    id: 'roof-flat',
    name: 'Flat metal roof',
    referenceLevelId: level.id,
    footprintMm: makeRectFootprint(8000, 5000),
    roofGeometryMode: 'flat',
    materialKey: 'metal_standing_seam_dark_grey',
  };

  it('adds seam children when materialKey is metal_standing_seam_*', () => {
    const els: Record<string, Element> = { [level.id]: level, [baseRoof.id]: baseRoof };
    const mesh = makeRoofMassMesh(baseRoof, els, null);
    expect(seamChildCount(mesh)).toBeGreaterThan(0);
  });

  it('produces substantially more vertices than the un-decorated roof', () => {
    const els: Record<string, Element> = { [level.id]: level, [baseRoof.id]: baseRoof };
    const decorated = makeRoofMassMesh(baseRoof, els, null);
    const plainRoof: RoofElem = { ...baseRoof, materialKey: null };
    const plain = makeRoofMassMesh(plainRoof, els, null);
    expect(vertexCount(decorated)).toBeGreaterThan(vertexCount(plain) * 1.5);
  });

  it('runs seams parallel to the longer dimension on flat roofs', () => {
    // 8 m × 5 m flat — seams should run along X (the longer side), placed
    // at intervals along Z. Each seam strip must span the full X length.
    const els: Record<string, Element> = { [level.id]: level, [baseRoof.id]: baseRoof };
    const mesh = makeRoofMassMesh(baseRoof, els, null);
    const seams: THREE.Mesh[] = [];
    mesh.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh && m.userData.seam === true) seams.push(m);
    });
    expect(seams.length).toBeGreaterThan(0);
    for (const seam of seams) {
      const box = new THREE.Box3().setFromObject(seam);
      const sx = box.max.x - box.min.x;
      const sz = box.max.z - box.min.z;
      expect(sx).toBeGreaterThan(sz);
      // Long side ≈ 8 m
      expect(sx).toBeGreaterThan(7);
    }
  });

  it('does NOT add seams for non-metal material keys', () => {
    const woodRoof: RoofElem = { ...baseRoof, materialKey: 'cladding_warm_wood' };
    const els: Record<string, Element> = { [level.id]: level, [woodRoof.id]: woodRoof };
    const mesh = makeRoofMassMesh(woodRoof, els, null);
    expect(seamChildCount(mesh)).toBe(0);
  });

  it('does NOT add seams when materialKey is null', () => {
    const plainRoof: RoofElem = { ...baseRoof, materialKey: null };
    const els: Record<string, Element> = { [level.id]: level, [plainRoof.id]: plainRoof };
    const mesh = makeRoofMassMesh(plainRoof, els, null);
    expect(seamChildCount(mesh)).toBe(0);
  });

  it('uses the roof type top-layer material when a roofTypeId is assigned', () => {
    const roofType: Extract<Element, { kind: 'roof_type' }> = {
      kind: 'roof_type',
      id: 'roof-type-standing-seam',
      name: 'Standing seam roof type',
      layers: [
        { function: 'finish', materialKey: 'metal_standing_seam_dark_grey', thicknessMm: 45 },
        { function: 'structure', materialKey: 'timber_stud', thicknessMm: 160 },
      ],
    };
    const typedRoof: RoofElem = {
      ...baseRoof,
      materialKey: null,
      roofTypeId: roofType.id,
    };
    const els: Record<string, Element> = {
      [level.id]: level,
      [typedRoof.id]: typedRoof,
      [roofType.id]: roofType,
    };
    const mesh = makeRoofMassMesh(typedRoof, els, null);
    const mat = mesh.material as THREE.MeshStandardMaterial;

    expect(mat.userData.materialKey).toBe('metal_standing_seam_dark_grey');
    expect(seamChildCount(mesh)).toBeGreaterThan(0);
  });

  it('flat roof with longer Z runs seams along Z', () => {
    const tallRoof: RoofElem = {
      ...baseRoof,
      footprintMm: makeRectFootprint(4000, 9000),
    };
    const els: Record<string, Element> = { [level.id]: level, [tallRoof.id]: tallRoof };
    const mesh = makeRoofMassMesh(tallRoof, els, null);
    const seams: THREE.Mesh[] = [];
    mesh.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh && m.userData.seam === true) seams.push(m);
    });
    expect(seams.length).toBeGreaterThan(0);
    for (const seam of seams) {
      const box = new THREE.Box3().setFromObject(seam);
      const sx = box.max.x - box.min.x;
      const sz = box.max.z - box.min.z;
      expect(sz).toBeGreaterThan(sx);
    }
  });
});

describe('addStandingSeamPattern — gable roof', () => {
  const gableRoof: RoofElem = {
    kind: 'roof',
    id: 'roof-gable',
    name: 'Gable metal roof',
    referenceLevelId: level.id,
    footprintMm: makeRectFootprint(8000, 5000),
    roofGeometryMode: 'gable_pitched_rectangle',
    slopeDeg: 30,
    ridgeAxis: 'x',
    materialKey: 'metal_standing_seam_zinc',
  };

  it('adds seams perpendicular to the ridge', () => {
    const els: Record<string, Element> = { [level.id]: level, [gableRoof.id]: gableRoof };
    const mesh = makeRoofMassMesh(gableRoof, els, null);
    expect(seamChildCount(mesh)).toBeGreaterThan(0);
  });

  it('seam-decorated gable has more vertices than plain gable', () => {
    const els: Record<string, Element> = { [level.id]: level, [gableRoof.id]: gableRoof };
    const decorated = makeRoofMassMesh(gableRoof, els, null);
    const plainRoof: RoofElem = { ...gableRoof, materialKey: null };
    const plain = makeRoofMassMesh(plainRoof, els, null);
    expect(vertexCount(decorated)).toBeGreaterThan(vertexCount(plain) * 1.5);
  });

  it('honours seamSpacingMm parameter on direct calls', () => {
    const flatRoof: RoofElem = {
      kind: 'roof',
      id: 'roof-flat-spacing',
      name: 'Flat',
      referenceLevelId: level.id,
      footprintMm: makeRectFootprint(6000, 3000),
      roofGeometryMode: 'flat',
      materialKey: 'metal_standing_seam_dark_grey',
    };
    const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    addStandingSeamPattern(
      dummyMesh,
      flatRoof,
      { minX: 0, maxX: 6000, minZ: 0, maxZ: 3000 },
      0,
      300, // tighter spacing
    );
    const tightCount = seamChildCount(dummyMesh);

    const dummyMesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    addStandingSeamPattern(
      dummyMesh2,
      flatRoof,
      { minX: 0, maxX: 6000, minZ: 0, maxZ: 3000 },
      0,
      1200,
    );
    const looseCount = seamChildCount(dummyMesh2);

    expect(tightCount).toBeGreaterThan(looseCount);
  });
});
