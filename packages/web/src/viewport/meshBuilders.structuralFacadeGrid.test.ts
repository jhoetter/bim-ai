// Issue #113 — Huf-Haus Pfosten-Riegel structural facade grid tests.
//
// Pin the contract that `makeStructuralFacadeGridMesh` produces visible
// timber-lattice geometry for a well-formed grid + wall pair, with the
// grid sitting proud of the wall face and the diagonal strut pattern
// emitting the expected number of members per bay.

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  _enumerateMembers,
  _enumeratePostXs,
  _normaliseBeamHeights,
  _resetStructuralFacadeGridWarningsForTests,
  makeStructuralFacadeGridMesh,
} from './meshBuilders.structuralFacadeGrid';

type WallElem = Extract<Element, { kind: 'wall' }>;
type GridElem = Extract<Element, { kind: 'structural_facade_grid' }>;

const HOST_WALL: WallElem = {
  kind: 'wall',
  id: 'wall-huf-host',
  name: 'Huf-Haus south wall',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 300,
  heightMm: 3000,
};

const BASE_GRID: GridElem = {
  kind: 'structural_facade_grid',
  id: 'grid-huf-south',
  name: 'Huf-Haus south grid',
  hostWallId: HOST_WALL.id,
  postSpacingMm: 1500,
  beamHeights: [1500],
  diagonalStrutPattern: 'single',
};

function meshChildrenOf(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) out.push(node);
  });
  return out;
}

describe('issue #113 — _enumeratePostXs', () => {
  it('emits 5 posts across a 6000mm wall at 1500mm spacing (4 bays)', () => {
    const xs = _enumeratePostXs(6000, 1500);
    expect(xs.length).toBe(5);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(6000);
  });

  it('clamps spacing to at least 100mm so a misauthored grid never explodes', () => {
    const xs = _enumeratePostXs(1000, 1);
    // 1mm spacing would be clamped to 100mm → 10 bays / 11 posts.
    expect(xs.length).toBe(11);
  });

  it('returns a single anchor post when the wall length is zero', () => {
    expect(_enumeratePostXs(0, 1500)).toEqual([0]);
  });
});

describe('issue #113 — _normaliseBeamHeights', () => {
  it('always includes the wall foot (0) and head (wallHeight)', () => {
    const ys = _normaliseBeamHeights([1500], 3000);
    expect(ys).toContain(0);
    expect(ys).toContain(3000);
  });

  it('sorts beam heights and removes out-of-range entries', () => {
    const ys = _normaliseBeamHeights([2500, 1000, 5000, -100], 3000);
    // 5000 (over head) and -100 (under foot) are dropped.
    expect(ys).toEqual([0, 1000, 2500, 3000]);
  });

  it('de-duplicates near-identical heights', () => {
    const ys = _normaliseBeamHeights([1500, 1500.4, 1500.6], 3000);
    // Quantised to 1mm so 1500/1500.4/1500.6 all collapse to either 1500 or 1501.
    expect(ys.length).toBeLessThanOrEqual(4);
  });
});

describe('issue #113 — _enumerateMembers counts', () => {
  it('emits 5 posts + 3 beams for a 6000×3000 wall with one mid-height beam', () => {
    const specs = _enumerateMembers(BASE_GRID, HOST_WALL);
    const posts = specs.filter((s) => s.partId.includes('::post::'));
    const beams = specs.filter((s) => s.partId.includes('::beam::'));
    expect(posts.length).toBe(5);
    // 3 = foot + 1500 + head.
    expect(beams.length).toBe(3);
  });

  it('emits one diagonal per bay for "single" pattern', () => {
    const specs = _enumerateMembers(BASE_GRID, HOST_WALL);
    const struts = specs.filter((s) => s.partId.includes('::strut::'));
    // 4 posts-bays × 2 beam-bays = 8 sub-bays.
    expect(struts.length).toBe(8);
  });

  it('emits two diagonals per bay for "cross" pattern', () => {
    const cross: GridElem = { ...BASE_GRID, diagonalStrutPattern: 'cross' };
    const specs = _enumerateMembers(cross, HOST_WALL);
    const struts = specs.filter((s) => s.partId.includes('::strut::'));
    expect(struts.length).toBe(16);
  });

  it('emits zero diagonals for "none" pattern', () => {
    const none: GridElem = { ...BASE_GRID, diagonalStrutPattern: 'none' };
    const specs = _enumerateMembers(none, HOST_WALL);
    const struts = specs.filter((s) => s.partId.includes('::strut::'));
    expect(struts.length).toBe(0);
  });

  it('returns an empty list when the host wall has zero length or height', () => {
    const degenerate: WallElem = { ...HOST_WALL, end: { xMm: 0, yMm: 0 } };
    expect(_enumerateMembers(BASE_GRID, degenerate)).toEqual([]);
    const noHeight: WallElem = { ...HOST_WALL, heightMm: 0 };
    expect(_enumerateMembers(BASE_GRID, noHeight)).toEqual([]);
  });
});

describe('issue #113 — makeStructuralFacadeGridMesh produces visible geometry', () => {
  beforeEach(() => {
    _resetStructuralFacadeGridWarningsForTests();
  });

  it('emits a mesh group with one infill quad + post/beam/strut members', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeStructuralFacadeGridMesh(BASE_GRID, elementsById, null);

    expect(group.userData.isAuthoringPlaceholder).toBeUndefined();
    expect(group.visible).toBe(true);

    const meshes = meshChildrenOf(group);
    // 1 infill + 5 posts + 3 beams + 8 diagonals = 17 meshes (plus edge helpers
    // that are LineSegments, not Mesh, so they're not counted here).
    expect(meshes.length).toBeGreaterThanOrEqual(17);
  });

  it('places at least one timber member proud of the wall plane', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeStructuralFacadeGridMesh(BASE_GRID, elementsById, null);

    // The wall runs along +X with start at (0,0); outward normal in this
    // renderer is (uz, −ux) = (0, −1) so the grid should sit at negative z
    // (or positive z if the convention flips). Either way the bounding box
    // must have a meaningful extent away from z = 0.
    const bbox = new THREE.Box3().setFromObject(group);
    const outward = Math.max(Math.abs(bbox.min.z), Math.abs(bbox.max.z));
    expect(outward).toBeGreaterThan(0.005); // ≥5mm proud — default is 30mm.
  });
});

describe('issue #113 — placeholder behaviour for missing host wall', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetStructuralFacadeGridWarningsForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns and emits an invisible placeholder when the host wall is missing', () => {
    const orphan: GridElem = { ...BASE_GRID, id: 'grid-orphan' };
    const group = makeStructuralFacadeGridMesh(orphan, {}, null);
    expect(warnSpy).toHaveBeenCalled();
    expect(group.userData.isAuthoringPlaceholder).toBe(true);
    expect(group.visible).toBe(false);
  });

  it('does not warn for a well-formed grid+wall pair', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    makeStructuralFacadeGridMesh(BASE_GRID, elementsById, null);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
