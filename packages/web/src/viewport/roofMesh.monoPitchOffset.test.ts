import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofMassMesh } from './meshBuilders';
import { _buildMonoPitchOffsetGroup } from './roofGeometry';

type RoofElem = Extract<Element, { kind: 'roof' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

// ISSUE-101 — Versetztes Pultdach (offset double mono-pitch with clerestory
// band) renderer dispatch. The dedicated builder must produce a Group with:
//  - one tilted front-slab mesh whose low edge sits at frontEaveY
//  - one tilted rear-slab mesh whose low edge sits at rearEaveY
//  - one vertical clerestory wall band mesh of height = clerestoryBandHeightMm
//
// Existing `makeRoofMassMesh` keeps returning a single Mesh (the three pieces
// merged into one BufferGeometry) so the rest of the renderer pipeline
// (CSG / dormer cuts / standing-seam decoration) is unchanged.

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Ground',
  elevationMm: 0,
};

const elementsById: Record<string, Element> = {
  'lvl-0': level0,
};

describe('_buildMonoPitchOffsetGroup — Versetztes Pultdach', () => {
  it('produces a Group containing 2 tilted slabs + 1 vertical clerestory band', () => {
    const group = _buildMonoPitchOffsetGroup(
      0, // ox0 (m)
      10, // ox1 (m)
      0, // oz0 (m)
      6, // oz1 (m)
      2.8, // frontEaveY (m)  -> front_eave_height_mm = 2800
      3.6, // rearEaveY (m)   -> rear_eave_height_mm = 3600
      (12 * Math.PI) / 180, // front pitch (rad)
      (20 * Math.PI) / 180, // rear pitch (rad)
      0.9, // clerestory band height (m) -> clerestory_band_height_mm = 900
      0.55, // step fraction along long (=> step at 5.5 m)
      true, // longAlongX
    );
    expect(group).toBeInstanceOf(THREE.Group);
    const meshes = group.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    expect(meshes.length).toBe(3);
    const slots = new Set(meshes.map((m) => m.userData.bimRoofSlot));
    expect(slots.has('front')).toBe(true);
    expect(slots.has('rear')).toBe(true);
    expect(slots.has('clerestory_band')).toBe(true);
  });

  it('places the front slab low edge at frontEaveY and the rear slab low edge at rearEaveY', () => {
    const group = _buildMonoPitchOffsetGroup(
      0,
      10,
      0,
      6,
      2.8,
      3.6,
      (12 * Math.PI) / 180,
      (20 * Math.PI) / 180,
      0.9,
      0.55,
      true,
    );
    const meshes = group.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    const front = meshes.find((m) => m.userData.bimRoofSlot === 'front')!;
    const rear = meshes.find((m) => m.userData.bimRoofSlot === 'rear')!;
    front.updateMatrixWorld(true);
    rear.updateMatrixWorld(true);
    const fbox = new THREE.Box3().setFromObject(front);
    const rbox = new THREE.Box3().setFromObject(rear);
    expect(fbox.min.y).toBeCloseTo(2.8, 6);
    expect(rbox.min.y).toBeCloseTo(3.6, 6);
  });

  it('sets the clerestory band height to clerestoryBandHeightMm', () => {
    const group = _buildMonoPitchOffsetGroup(
      0,
      10,
      0,
      6,
      2.8,
      3.6,
      (12 * Math.PI) / 180,
      (20 * Math.PI) / 180,
      0.9,
      0.55,
      true,
    );
    const meshes = group.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    const band = meshes.find((m) => m.userData.bimRoofSlot === 'clerestory_band')!;
    band.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(band);
    expect(box.max.y - box.min.y).toBeCloseTo(0.9, 6);
    // Band's lower edge sits at front-top-at-step = frontEaveY + frontRun *
    // tan(frontPitch) = 2.8 + 5.5 * tan(12°) ≈ 3.969 m.
    const expectedBandLower = 2.8 + 5.5 * Math.tan((12 * Math.PI) / 180);
    expect(box.min.y).toBeCloseTo(expectedBandLower, 5);
  });

  it('honours the longAlongX=false orientation (long axis = Z)', () => {
    const group = _buildMonoPitchOffsetGroup(
      0,
      6, // narrow X
      0,
      10, // long Z
      2.8,
      3.6,
      (12 * Math.PI) / 180,
      (20 * Math.PI) / 180,
      0.9,
      0.55,
      false,
    );
    const meshes = group.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    const band = meshes.find((m) => m.userData.bimRoofSlot === 'clerestory_band')!;
    band.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(band);
    // Band should span the full X width (6 m) and a thin slice in Z near the
    // step (z ≈ 5.5 m).
    expect(box.max.x - box.min.x).toBeCloseTo(6.0, 5);
    expect(box.min.z).toBeLessThan(5.6);
    expect(box.max.z).toBeGreaterThan(5.4);
  });
});

describe('makeRoofMassMesh — dispatch to mono_pitch_offset', () => {
  it('routes mono_pitch_offset through the offset builder (single Mesh return)', () => {
    const offsetRoof: RoofElem = {
      kind: 'roof',
      id: 'rf-offset-1',
      name: 'Versetztes Pultdach',
      referenceLevelId: 'lvl-0',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 10000, yMm: 0 },
        { xMm: 10000, yMm: 6000 },
        { xMm: 0, yMm: 6000 },
      ],
      slopeDeg: 15,
      roofGeometryMode: 'mono_pitch_offset',
      frontPitchDeg: 12,
      rearPitchDeg: 20,
      frontEaveHeightMm: 2800,
      rearEaveHeightMm: 3600,
      clerestoryBandHeightMm: 900,
      stepPositionAlongLongAxisMm: 5500,
      overhangMm: 0,
    };
    const mesh = makeRoofMassMesh(offsetRoof, elementsById, null);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // Lowest Y across the merged geometry is the front eave (= 2.8 m above
    // the reference level, no walls → wallTop = 0).
    expect(box.min.y).toBeCloseTo(2.8, 2);
    // Highest Y is the rear ridge or the band top, whichever is greater.
    const frontTop = 2.8 + 5.5 * Math.tan((12 * Math.PI) / 180);
    const bandTop = frontTop + 0.9;
    const rearTop = 3.6 + 4.5 * Math.tan((20 * Math.PI) / 180);
    const expectedMax = Math.max(bandTop, rearTop);
    expect(box.max.y).toBeCloseTo(expectedMax, 2);
  });
});
