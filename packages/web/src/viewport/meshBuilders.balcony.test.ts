// Issue #64 — MF-render-7 — BalconyElem authored but not visible in any
// cardinal capture. These tests pin the contract that `makeBalconyMesh`
// always produces visible geometry for a well-formed balcony, AND that it
// surfaces a deduped diagnostic warning instead of silently returning an
// empty group when the host wall lookup fails.

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  _resetEmptyBalconyWarningsForTests,
  makeBalconyMesh,
} from './meshBuilders.balcony';

type WallElem = Extract<Element, { kind: 'wall' }>;
type BalconyElem = Extract<Element, { kind: 'balcony' }>;

const BASE_WALL: WallElem = {
  kind: 'wall',
  id: 'wall-front',
  name: 'Front wall',
  levelId: 'lvl-01',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 250,
  heightMm: 3000,
};

const BASE_BALCONY: BalconyElem = {
  kind: 'balcony',
  id: 'balcony-front-01',
  name: 'Front balcony',
  wallId: BASE_WALL.id,
  elevationMm: 3000,
  projectionMm: 1500,
  slabThicknessMm: 200,
  balustradeHeightMm: 1050,
};

function meshChildrenOf(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) out.push(node);
  });
  return out;
}

describe('issue #64 — makeBalconyMesh produces visible geometry', () => {
  beforeEach(() => {
    _resetEmptyBalconyWarningsForTests();
  });

  it('emits at least one Mesh child for a well-formed balcony+wall pair', () => {
    const elementsById: Record<string, Element> = { [BASE_WALL.id]: BASE_WALL };
    const group = makeBalconyMesh(BASE_BALCONY, elementsById, null);

    const meshes = meshChildrenOf(group);
    expect(meshes.length).toBeGreaterThan(0);
  });

  it('produces a slab mesh whose bounding box has non-trivial volume', () => {
    const elementsById: Record<string, Element> = { [BASE_WALL.id]: BASE_WALL };
    const group = makeBalconyMesh(BASE_BALCONY, elementsById, null);

    const bbox = new THREE.Box3().setFromObject(group);
    expect(Number.isFinite(bbox.min.x)).toBe(true);
    expect(Number.isFinite(bbox.max.x)).toBe(true);

    const sizeX = bbox.max.x - bbox.min.x;
    const sizeY = bbox.max.y - bbox.min.y;
    const sizeZ = bbox.max.z - bbox.min.z;
    // 4m wall × 200mm slab × 1500mm projection — every axis must be > 10cm.
    expect(sizeX).toBeGreaterThan(0.1);
    expect(sizeY).toBeGreaterThan(0.1);
    expect(sizeZ).toBeGreaterThan(0.1);
  });

  it('positions the slab top at the balcony elevation', () => {
    const elementsById: Record<string, Element> = { [BASE_WALL.id]: BASE_WALL };
    const group = makeBalconyMesh(BASE_BALCONY, elementsById, null);

    const bbox = new THREE.Box3().setFromObject(group);
    // Slab top sits at elevationMm/1000; balustrade extends above by balH.
    // Lowest point should be at most (elevation - slab thickness) ≈ 2.8 m.
    expect(bbox.min.y).toBeLessThanOrEqual(3.0);
    expect(bbox.max.y).toBeGreaterThanOrEqual(3.0);
  });
});

describe('issue #64 — diagnostic warn when host wall is missing', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetEmptyBalconyWarningsForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once when the wallId does not resolve to any element', () => {
    const orphan: BalconyElem = { ...BASE_BALCONY, id: 'balcony-orphan' };
    // Empty elementsById — wallId resolves to undefined.
    const group = makeBalconyMesh(orphan, {}, null);

    expect(warnSpy).toHaveBeenCalled();
    const firstCall = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(firstCall).toContain('balcony-orphan');
    expect(firstCall).toContain('issue #64');

    // Placeholder geometry is still added so the element is selectable —
    // group should not be silently empty.
    const meshes = meshChildrenOf(group);
    expect(meshes.length).toBeGreaterThan(0);
  });

  it('warns once when the referenced element exists but is not a wall', () => {
    const notAWall = {
      kind: 'floor',
      id: 'wall-front',
      name: 'oops a floor',
      levelId: 'lvl-01',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1000 },
        { xMm: 0, yMm: 1000 },
      ],
      thicknessMm: 200,
    } as unknown as Element;
    const group = makeBalconyMesh(BASE_BALCONY, { 'wall-front': notAWall }, null);

    expect(warnSpy).toHaveBeenCalled();
    expect(meshChildrenOf(group).length).toBeGreaterThan(0);
  });

  it('dedupes repeated warnings for the same balcony id', () => {
    const orphan: BalconyElem = { ...BASE_BALCONY, id: 'balcony-dup' };
    makeBalconyMesh(orphan, {}, null);
    makeBalconyMesh(orphan, {}, null);
    makeBalconyMesh(orphan, {}, null);

    // One warn per balcony id, not one per call.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not warn for a well-formed balcony', () => {
    const elementsById: Record<string, Element> = { [BASE_WALL.id]: BASE_WALL };
    makeBalconyMesh(BASE_BALCONY, elementsById, null);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
