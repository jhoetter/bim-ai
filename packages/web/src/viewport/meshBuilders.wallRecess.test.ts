import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeRecessedWallMesh, recessOffsetForOpening } from './meshBuilders';
import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;

describe('makeRecessedWallMesh', () => {
  it('builds an extruded mesh whose footprint includes the recess step-back', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'w1',
      name: 'south',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 4000,
      materialKey: 'cladding_warm_wood',
      recessZones: [{ alongTStart: 0.1, alongTEnd: 0.9, setbackMm: 1500 }],
    };
    const group = makeRecessedWallMesh(wall, 3, null);
    expect(group).toBeInstanceOf(THREE.Group);
    // Expect 3 boxes: 2 end caps (alongT 0..0.1 and 0.9..1.0) + 1 back wall.
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(3);
    // Compute combined bounds of all boxes.
    const bounds = new THREE.Box3();
    for (const m of meshes) {
      bounds.expandByObject(m);
    }
    // Wall runs west→east in plan (+X, planY=0). Per the viewport convention
    // (plan-Y → world-Z directly via makeFloorSlabMesh's shape + rotate-X
    // chain), the interior normal in plan = +Y maps to world +Z. The recess
    // back wall therefore sits at world-Z ≈ +1.4..+1.6 m.
    expect(bounds.min.z).toBeLessThan(0); // end caps reach planY=-100 → worldZ≈-0.1
    expect(bounds.max.z).toBeGreaterThan(1.4); // recess back at planY=+1600
    expect(bounds.max.y - bounds.min.y).toBeGreaterThanOrEqual(3.99);
  });

  it('produces a (0,0) offset for openings outside any recess zone', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'w1',
      name: 'south',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 4000,
      recessZones: [{ alongTStart: 0.1, alongTEnd: 0.9, setbackMm: 1500 }],
    };
    const off = recessOffsetForOpening(wall, 0.05);
    expect(off.dx).toBe(0);
    expect(off.dz).toBe(0);
  });

  it('repositions an opening that falls inside a recess zone', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'w1',
      name: 'south',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 4000,
      recessZones: [{ alongTStart: 0.1, alongTEnd: 0.9, setbackMm: 1500 }],
    };
    const off = recessOffsetForOpening(wall, 0.5);
    // Wall direction +X (plan), interior normal in plan = +Y, mapped to
    // world +Z by the viewport convention.
    expect(off.dx).toBeCloseTo(0, 6);
    expect(off.dz).toBeCloseTo(1.5, 4);
  });
});
