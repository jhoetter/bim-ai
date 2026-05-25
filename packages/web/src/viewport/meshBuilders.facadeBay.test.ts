// Issue #102 — FacadeBayElem (Erker) renderer tests.
//
// Pin the contract that `makeFacadeBayMesh` produces visible geometry for a
// well-formed bay + wall pair across all three shapes (rectangular,
// chamfered, curved), and that the projection geometry actually sits
// `projectionMm` past the host wall plane (i.e. the renderer treats the
// projection axis as the wall's outward normal).

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  _facadeBayOuterFootprintForTests,
  _resetEmptyFacadeBayWarningsForTests,
  makeFacadeBayMesh,
} from './meshBuilders.facadeBay';

type WallElem = Extract<Element, { kind: 'wall' }>;
type FacadeBayElem = Extract<Element, { kind: 'facade_bay' }>;

// Host wall runs along +X with y=0; outward normal is +Z (since the right-hand
// turn from tangent (+1,0) in XZ is (0,−1) but the renderer uses (uz,−ux)
// which maps wall-tangent (+1,0) to outward normal (0,−1)). For these
// assertions we only care that the bay extends past z=0 in *some* direction
// equal in magnitude to the projection.
const HOST_WALL: WallElem = {
  kind: 'wall',
  id: 'wall-erker-host',
  name: 'Erker host wall',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 300,
  heightMm: 3000,
};

const RECTANGULAR_BAY: FacadeBayElem = {
  kind: 'facade_bay',
  id: 'bay-rect-1',
  name: 'Rectangular bay',
  hostWallId: HOST_WALL.id,
  startAlongWallMm: 1500,
  endAlongWallMm: 4500,
  projectionMm: 1000,
  shape: 'rectangular',
};

const CHAMFERED_BAY: FacadeBayElem = {
  ...RECTANGULAR_BAY,
  id: 'bay-cham-1',
  name: 'Chamfered bay',
  shape: 'chamfered',
  chamferAngleDeg: 45,
};

const CURVED_BAY: FacadeBayElem = {
  ...RECTANGULAR_BAY,
  id: 'bay-curved-1',
  name: 'Curved bay',
  shape: 'curved',
};

function meshChildrenOf(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) out.push(node);
  });
  return out;
}

describe('issue #102 — makeFacadeBayMesh produces visible geometry', () => {
  beforeEach(() => {
    _resetEmptyFacadeBayWarningsForTests();
  });

  it('emits at least one Mesh child for a rectangular bay', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(RECTANGULAR_BAY, elementsById, null);

    expect(meshChildrenOf(group).length).toBeGreaterThan(0);
    expect(group.userData.isAuthoringPlaceholder).toBeUndefined();
    expect(group.visible).toBe(true);
  });

  it('emits at least one Mesh child for a chamfered bay', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(CHAMFERED_BAY, elementsById, null);
    expect(meshChildrenOf(group).length).toBeGreaterThan(0);
  });

  it('emits at least one Mesh child for a curved bay', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(CURVED_BAY, elementsById, null);
    expect(meshChildrenOf(group).length).toBeGreaterThan(0);
  });
});

describe('issue #102 — bay geometry projects past the host wall plane', () => {
  it('rectangular bay extends projectionMm past the wall plane (in metres)', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(RECTANGULAR_BAY, elementsById, null);

    const bbox = new THREE.Box3().setFromObject(group);
    expect(Number.isFinite(bbox.min.x)).toBe(true);

    // The host wall lies on the line y=0 in plan (z in world). The bay must
    // extend at least 90% of `projectionMm/1000` outward, regardless of
    // whether outward is +z or −z (the sign depends on the wall's tangent).
    const projM = RECTANGULAR_BAY.projectionMm / 1000; // 1.0 m
    const outwardMagnitude = Math.max(Math.abs(bbox.min.z), Math.abs(bbox.max.z));
    expect(outwardMagnitude).toBeGreaterThanOrEqual(projM * 0.9);
  });

  it('chamfered bay extends projectionMm past the host wall plane', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(CHAMFERED_BAY, elementsById, null);

    const bbox = new THREE.Box3().setFromObject(group);
    const projM = CHAMFERED_BAY.projectionMm / 1000;
    const outwardMagnitude = Math.max(Math.abs(bbox.min.z), Math.abs(bbox.max.z));
    expect(outwardMagnitude).toBeGreaterThanOrEqual(projM * 0.9);
  });

  it('curved bay extends ~projectionMm past the host wall plane', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(CURVED_BAY, elementsById, null);

    const bbox = new THREE.Box3().setFromObject(group);
    const projM = CURVED_BAY.projectionMm / 1000;
    const outwardMagnitude = Math.max(Math.abs(bbox.min.z), Math.abs(bbox.max.z));
    // Curved bay tip = full projection at the apex; we allow a small slack
    // for the polygon approximation.
    expect(outwardMagnitude).toBeGreaterThanOrEqual(projM * 0.85);
  });

  it('rectangular bay y-extents cover the full host-wall height', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    const group = makeFacadeBayMesh(RECTANGULAR_BAY, elementsById, null);

    const bbox = new THREE.Box3().setFromObject(group);
    const heightM = HOST_WALL.heightMm / 1000; // 3 m
    expect(bbox.max.y - bbox.min.y).toBeGreaterThanOrEqual(heightM * 0.9);
  });
});

describe('issue #102 — footprint vertex contracts per shape', () => {
  it('rectangular footprint emits 2 outer vertices (4-vertex closed prism with back corners)', () => {
    const pts = _facadeBayOuterFootprintForTests('rectangular', 3, 1, null);
    // Two outer vertices; caller chains in the two back-corners → 4 total.
    expect(pts.length).toBe(2);
  });

  it('chamfered footprint emits exactly 2 outer (cut) vertices when defaults applied', () => {
    const pts = _facadeBayOuterFootprintForTests('chamfered', 3, 1, 45);
    // The chamfered prism has 5 footprint verts (4 + 1 cut on each side),
    // but the helper returns ONLY the outer chain between the two back
    // corners. For a symmetric chamfer that is the two outer vertices.
    expect(pts.length).toBe(2);
    // Both outer vertices must sit at v = proj (the bay's outermost depth).
    for (const p of pts) {
      expect(p.v).toBeCloseTo(1, 5);
    }
  });

  it('curved footprint emits 7 outer arc vertices for the default 8-segment sampling', () => {
    const pts = _facadeBayOuterFootprintForTests('curved', 3, 1, null);
    // The loop in bayOuterFootprint runs i=1..CURVE_SEGMENTS−1 → 7 points
    // for CURVE_SEGMENTS=8. Together with the 2 back-corners chained in by
    // the caller this gives a 9-vertex polygon (8 outer edges + 1 chord).
    expect(pts.length).toBe(7);
    // The apex (i ≈ CURVE_SEGMENTS/2) must sit at ~projection.
    const apex = pts[3];
    expect(apex.v).toBeGreaterThanOrEqual(1 * 0.95);
  });

  it('curved footprint sampling is at least 8 vertices when back-corners are chained in', () => {
    // The issue says "8–12 segments" for the curved approximation. With the
    // 2 chained-in back corners the closed polygon must have ≥ 8 vertices.
    const outerPts = _facadeBayOuterFootprintForTests('curved', 3, 1, null);
    const closedVertexCount = outerPts.length + 2;
    expect(closedVertexCount).toBeGreaterThanOrEqual(8);
    expect(closedVertexCount).toBeLessThanOrEqual(12);
  });
});

describe('issue #102 — placeholder behaviour for missing host wall', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetEmptyFacadeBayWarningsForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns and produces an invisible placeholder group when the host wall is missing', () => {
    const orphan: FacadeBayElem = { ...RECTANGULAR_BAY, id: 'bay-orphan' };
    const group = makeFacadeBayMesh(orphan, {}, null);

    expect(warnSpy).toHaveBeenCalled();
    expect(group.userData.isAuthoringPlaceholder).toBe(true);
    expect(group.visible).toBe(false);
  });

  it('does not warn for a well-formed bay+wall pair', () => {
    const elementsById: Record<string, Element> = { [HOST_WALL.id]: HOST_WALL };
    makeFacadeBayMesh(RECTANGULAR_BAY, elementsById, null);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
