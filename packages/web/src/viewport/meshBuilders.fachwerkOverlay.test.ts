// Issue #111 — Fachwerk timber-raster overlay renderer tests.
//
// Pins the v0 contract that `makeFachwerkOverlayMeshLocal` emits one timber
// band per Ständer / Riegel / Strebe for a wall + pattern, and that the
// overlay sits proud of the wall plane so it reads as relief.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  fachwerkOverlayRectsForTests,
  fachwerkPostCentresMm,
  makeFachwerkOverlayMesh,
  makeFachwerkOverlayMeshLocal,
} from './meshBuilders.fachwerkOverlay';

type WallElem = Extract<Element, { kind: 'wall' }>;

function host(opts?: Partial<WallElem>): WallElem {
  return {
    kind: 'wall',
    id: 'wall-fwk-host',
    name: 'Fachwerk host wall',
    levelId: 'lvl-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 6000, yMm: 0 },
    thicknessMm: 300,
    heightMm: 3000,
    materialKey: 'brick_red',
    ...opts,
  };
}

describe('issue #111 — fachwerkPostCentresMm rounds bays evenly', () => {
  it('returns one post per bay edge so endpoints anchor a Ständer', () => {
    // 6000 mm wall with nominal 1500 mm spacing → 4 bays → 5 posts.
    const cs = fachwerkPostCentresMm(6000, 1500);
    expect(cs.length).toBe(5);
    expect(cs[0]).toBeCloseTo(0, 6);
    expect(cs[cs.length - 1]).toBeCloseTo(6000, 6);
    // Even spacing.
    for (let i = 1; i < cs.length; i += 1) {
      expect(cs[i] - cs[i - 1]).toBeCloseTo(1500, 6);
    }
  });

  it('rounds to at least one bay even for short walls', () => {
    const cs = fachwerkPostCentresMm(800, 1500);
    expect(cs.length).toBe(2);
    expect(cs[0]).toBeCloseTo(0, 6);
    expect(cs[1]).toBeCloseTo(800, 6);
  });

  it('returns empty for a zero-length wall', () => {
    expect(fachwerkPostCentresMm(0, 1500)).toEqual([]);
  });
});

describe('issue #111 — fachwerkOverlayRectsForTests covers the timber raster', () => {
  it('emits sill + top-plate + N+1 posts for the default pattern', () => {
    const rects = fachwerkOverlayRectsForTests(6000, 3000, {});
    const tags = rects.map((r) => r.tag);
    expect(tags).toContain('sill');
    expect(tags).toContain('top_plate');
    const postCount = tags.filter((t) => t === 'post').length;
    expect(postCount).toBe(5); // 4 bays + 1 = 5 posts on a 6 m wall @ 1500 mm.
    // Sill spans the full wall length.
    const sill = rects.find((r) => r.tag === 'sill');
    expect(sill).toBeTruthy();
    expect(sill!.widthMm).toBeCloseTo(6000, 6);
  });

  it('emits a mid-rail band per requested elevation', () => {
    const rects = fachwerkOverlayRectsForTests(6000, 3000, {
      midRailHeightsMm: [1500],
    });
    expect(rects.filter((r) => r.tag === 'mid_rail').length).toBe(1);
  });

  it('emits one diagonal per bay for left/right modes', () => {
    const left = fachwerkOverlayRectsForTests(6000, 3000, {
      diagonalsPerPanel: 'left',
    });
    expect(left.filter((r) => r.tag === 'diagonal_left').length).toBe(4);
    expect(left.filter((r) => r.tag === 'diagonal_right').length).toBe(0);

    const right = fachwerkOverlayRectsForTests(6000, 3000, {
      diagonalsPerPanel: 'right',
    });
    expect(right.filter((r) => r.tag === 'diagonal_right').length).toBe(4);
  });

  it('emits two diagonals per bay for Andreaskreuz', () => {
    const ak = fachwerkOverlayRectsForTests(6000, 3000, {
      diagonalsPerPanel: 'andreas_kreuz',
    });
    expect(ak.filter((r) => r.tag === 'diagonal_left').length).toBe(4);
    expect(ak.filter((r) => r.tag === 'diagonal_right').length).toBe(4);
  });
});

describe('issue #111 — makeFachwerkOverlayMeshLocal produces THREE meshes', () => {
  it('returns an empty group when fachwerkPattern is undefined', () => {
    const grp = makeFachwerkOverlayMeshLocal(host({ fachwerkPattern: null }), null);
    expect(grp.children.length).toBe(0);
  });

  it('emits one child Mesh per timber band', () => {
    const wall = host({ fachwerkPattern: { diagonalsPerPanel: 'vee' } });
    const grp = makeFachwerkOverlayMeshLocal(wall, null);
    const meshes: THREE.Mesh[] = [];
    grp.traverse((n) => {
      if (n instanceof THREE.Mesh) meshes.push(n);
    });
    // sill + top_plate + 5 posts + 4 vee diagonals = 11 timber bands.
    // (`addEdges` adds a LineSegments child, not a Mesh — Mesh count is
    // strictly the timber slab count.)
    expect(meshes.length).toBe(11);
  });

  it('positions the overlay proud of the wall face in local +z', () => {
    const wall = host({
      thicknessMm: 300, // halfT = 150 mm = 0.15 m
      fachwerkPattern: { proudMm: 10 },
    });
    const grp = makeFachwerkOverlayMeshLocal(wall, null);
    expect(grp.userData.proudMm).toBeCloseTo(10, 6);
    // overlayZM = halfThickM + proudM = 0.15 + 0.01 = 0.16
    expect(grp.userData.overlayZM).toBeCloseTo(0.16, 6);
    // Every child Mesh sits at the same overlay-z (geometry is then 30 mm thick).
    const meshes: THREE.Mesh[] = [];
    grp.traverse((n) => {
      if (n instanceof THREE.Mesh) meshes.push(n);
    });
    for (const m of meshes) {
      expect(m.position.z).toBeCloseTo(0.16, 6);
    }
  });
});

describe('issue #111 — makeFachwerkOverlayMesh wraps with world transform', () => {
  it('positions and yaws the overlay so it follows the host wall', () => {
    const wall = host({
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 6000 }, // wall along +y → yaw rotates onto +z axis
      fachwerkPattern: {},
    });
    const grp = makeFachwerkOverlayMesh(wall, 0, null);
    // Midpoint is (0, 0, 3) in world (m).
    expect(grp.position.x).toBeCloseTo(0, 6);
    expect(grp.position.z).toBeCloseTo(3, 6);
    // Wall along +y rotates 90° (sign per `yawForPlanSegment`), so yaw is nonzero.
    expect(Math.abs(grp.rotation.y)).toBeGreaterThan(1e-3);
  });

  it('returns an empty group when no pattern is set', () => {
    const wall = host({ fachwerkPattern: null });
    const grp = makeFachwerkOverlayMesh(wall, 0, null);
    expect(grp.children.length).toBe(0);
  });
});
