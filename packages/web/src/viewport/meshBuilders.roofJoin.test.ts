/**
 * MF-rendering-X (#65) — RoofJoinElem must produce a CSG-merged solid for
 * Zwerchgiebel / cross-gable joins, not a seam line drawn on top of two
 * disjoint roof boxes. The CSG implementation lives behind a registration
 * slot (so jsdom unit tests can keep three-bvh-csg out of the import graph);
 * these tests stub that slot directly to exercise both the success path and
 * the fall-back contract.
 */

import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeRoofJoinPreviewMesh, registerRoofJoinUnionFn } from './meshBuilders';

type LevelElem = Extract<Element, { kind: 'level' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;
type RoofJoinElem = Extract<Element, { kind: 'roof_join' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'Level 0',
  elevationMm: 0,
};

const mainRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-main',
  name: 'Main gable',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8000, yMm: 0 },
    { xMm: 8000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  slopeDeg: 30,
  overhangMm: 0,
  ridgeAxis: 'x',
  eaveHeightLeftMm: 3000,
  eaveHeightRightMm: 3000,
};

const crossRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-cross',
  // Zwerchgiebel / dormer-as-gable: protrudes off the main roof's south
  // edge, overlapping the main footprint by 1 m so a true CSG union produces
  // a single continuous solid.
  name: 'Zwerchgiebel',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 3000, yMm: 5000 },
    { xMm: 5000, yMm: 5000 },
    { xMm: 5000, yMm: 8000 },
    { xMm: 3000, yMm: 8000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  slopeDeg: 30,
  overhangMm: 0,
  ridgeAxis: 'z',
  eaveHeightLeftMm: 3000,
  eaveHeightRightMm: 3000,
};

const disjointRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-disjoint',
  name: 'Detached secondary roof',
  referenceLevelId: 'lvl-0',
  // Far away from `mainRoof` — footprints share no overlap region.
  footprintMm: [
    { xMm: 20000, yMm: 20000 },
    { xMm: 24000, yMm: 20000 },
    { xMm: 24000, yMm: 24000 },
    { xMm: 20000, yMm: 24000 },
  ],
  roofGeometryMode: 'asymmetric_gable',
  slopeDeg: 30,
  overhangMm: 0,
  ridgeAxis: 'x',
  eaveHeightLeftMm: 3000,
  eaveHeightRightMm: 3000,
};

const overlappingJoin: RoofJoinElem = {
  kind: 'roof_join',
  id: 'join-zwerch',
  name: 'Zwerchgiebel join',
  primaryRoofId: 'roof-main',
  secondaryRoofId: 'roof-cross',
  seamMode: 'merge_at_ridge',
};

const disjointJoin: RoofJoinElem = {
  kind: 'roof_join',
  id: 'join-disjoint',
  name: 'Disjoint join',
  primaryRoofId: 'roof-main',
  secondaryRoofId: 'roof-disjoint',
  seamMode: 'merge_at_ridge',
};

const missingSecondaryJoin: RoofJoinElem = {
  kind: 'roof_join',
  id: 'join-missing',
  name: 'Dangling join',
  primaryRoofId: 'roof-main',
  secondaryRoofId: 'roof-does-not-exist',
  seamMode: 'merge_at_ridge',
};

afterEach(() => {
  registerRoofJoinUnionFn(null);
  vi.restoreAllMocks();
});

describe('makeRoofJoinPreviewMesh — CSG union (#65)', () => {
  it('returns a merged solid whose bbox spans both roofs when the union helper succeeds', () => {
    // Stub the CSG helper with a deterministic geometry whose bbox covers
    // BOTH input roof footprints (the union of `mainRoof` and `crossRoof`).
    // This is what a real three-bvh-csg ADDITION would produce; we don't
    // need to run the actual library in jsdom to assert the contract.
    registerRoofJoinUnionFn((primary, secondary) => {
      expect(primary.id).toBe('roof-main');
      expect(secondary.id).toBe('roof-cross');
      // Build a box that spans the combined footprint (0..5 m on X, 0..8 m
      // on Z, 0..4 m on Y). Wider in Z than either input alone (mainRoof
      // ends at 6 m, crossRoof ends at 8 m).
      const geom = new THREE.BoxGeometry(5, 4, 8);
      geom.translate(2.5, 2, 4);
      return geom;
    });

    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'roof-main': mainRoof,
      'roof-cross': crossRoof,
      'join-zwerch': overlappingJoin,
    };

    const group = makeRoofJoinPreviewMesh(overlappingJoin, elementsById, false);
    group.updateMatrixWorld(true);

    // The merged group must contain a Mesh (not a Line).
    const meshes = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true);
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    const merged = meshes[0]!;
    expect(merged.userData.bimPickId).toBe('join-zwerch');

    // Bounding box covers the combined footprint — must be strictly larger
    // than either roof alone in the Z direction.
    const box = new THREE.Box3().setFromObject(merged);
    expect(box.max.z - box.min.z).toBeGreaterThan(6 + 0.5);
  });

  it('falls back to the seam-line preview when the union helper returns null (e.g. CSG failure)', () => {
    // Simulate a CSG failure: the helper logs its own warning and returns
    // null. makeRoofJoinPreviewMesh must degrade silently to the seam line.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerRoofJoinUnionFn(() => {
      // Mirror the production warning so observers see the same signal whether
      // the failure happens here or inside the real CSG helper.
      console.warn('[roofJoin] CSG union failed, falling back to seam-line');
      return null;
    });

    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'roof-main': mainRoof,
      'roof-cross': crossRoof,
      'join-zwerch': overlappingJoin,
    };

    const group = makeRoofJoinPreviewMesh(overlappingJoin, elementsById, false);
    const meshes = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true);
    expect(meshes.length).toBe(0);
    const lines = group.children.filter((c): c is THREE.Line => (c as THREE.Line).isLine === true);
    expect(lines.length).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    const warnedAboutFallback = warnSpy.mock.calls.some((call) =>
      String(call[0] ?? '').includes('[roofJoin]'),
    );
    expect(warnedAboutFallback).toBe(true);
  });

  it('skips the union helper entirely for non-overlapping footprints (empty group)', () => {
    // Two roofs with no plan overlap — the seam interval collapses, so the
    // historical behaviour returns an empty group rather than a seam line.
    // The CSG helper must NOT be invoked: there is no geometric union to
    // compute and three-bvh-csg on disjoint solids is a waste.
    const unionSpy = vi.fn();
    registerRoofJoinUnionFn(unionSpy);

    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'roof-main': mainRoof,
      'roof-disjoint': disjointRoof,
      'join-disjoint': disjointJoin,
    };

    const group = makeRoofJoinPreviewMesh(disjointJoin, elementsById, false);
    expect(unionSpy).not.toHaveBeenCalled();
    expect(group.children.length).toBe(0);
    expect(group.userData.bimPickId).toBe('join-disjoint');
  });

  it('returns an empty group when one of the referenced roofs is missing — never throws', () => {
    // Issue #65 guardrail: if either roof reference dangles (e.g. mid-edit
    // or after a delete that races the render pass) we must not throw.
    const unionSpy = vi.fn();
    registerRoofJoinUnionFn(unionSpy);

    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'roof-main': mainRoof,
      'join-missing': missingSecondaryJoin,
    };

    expect(() => {
      const group = makeRoofJoinPreviewMesh(missingSecondaryJoin, elementsById, false);
      expect(group.children.length).toBe(0);
      expect(group.userData.bimPickId).toBe('join-missing');
    }).not.toThrow();
    expect(unionSpy).not.toHaveBeenCalled();
  });
});
