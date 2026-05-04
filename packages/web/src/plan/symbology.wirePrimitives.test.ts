import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { rebuildPlanMeshes } from './symbology';
import type { PlanProjectionPrimitivesV1Wire } from './planProjectionWire';

function countLineNodes(root: THREE.Object3D): number {
  let n = 0;
  if (root instanceof THREE.Line) n += 1;
  for (const c of root.children) n += countLineNodes(c);
  return n;
}

describe('PlanCanvas server wire primitives path (WP-C03)', () => {
  it('builds at least one mesh from planProjectionPrimitives_v1 walls', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };

    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'lvl',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();

    rebuildPlanMeshes(
      grp,
      { w1: wall },
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    expect(grp.children.some((c) => 'isMesh' in c && (c as THREE.Mesh).isMesh)).toBe(true);
  });

  it('adds dashed Line instances for wire roomSeparations', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };

    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'lvl',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [
        {
          id: 'rs-mid',
          levelId: 'lvl',
          startMm: { x: 1500, y: 0 },
          endMm: { x: 1500, y: 2500 },
        },
      ],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      { w1: wall },
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    const lines = grp.children.filter((c): c is THREE.Line => c instanceof THREE.Line);
    expect(lines.some((ln) => ln.userData.bimPickId === 'rs-mid')).toBe(true);
    expect(
      lines.some((ln) => {
        const m = ln.material;
        const mm = Array.isArray(m) ? m[0] : m;
        return mm instanceof THREE.LineDashedMaterial;
      }),
    ).toBe(true);
  });

  it('uses level rise for stair tread divisions when levels are in elementsById', () => {
    const l0: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'l0',
      name: 'G',
      elevationMm: 0,
    };
    const l1: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'l1',
      name: 'OG',
      elevationMm: 2800,
    };
    const stair: Extract<Element, { kind: 'stair' }> = {
      kind: 'stair',
      id: 'st1',
      name: 'S',
      baseLevelId: 'l0',
      topLevelId: 'l1',
      runStartMm: { xMm: 1000, yMm: 500 },
      runEndMm: { xMm: 1000, yMm: 3500 },
      widthMm: 1100,
      riserMm: 175,
      treadMm: 275,
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'l0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };

    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'l0',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [
        {
          id: 'st1',
          baseLevelId: 'l0',
          topLevelId: 'l1',
          riserMm: 175,
          treadMm: 275,
          runStartMm: { x: 1000, y: 500 },
          runEndMm: { x: 1000, y: 3500 },
          widthMm: 1100,
          riserCountPlanProxy: 16,
        },
      ],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    const byId: Record<string, Element> = { l0, l1, st1: stair, w1: wall };

    rebuildPlanMeshes(grp, byId, {
      activeLevelId: 'l0',
      wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
    });

    const stairGrp = grp.children.find((c) => c.userData?.bimPickId === 'st1');
    expect(stairGrp).toBeTruthy();
    const lineCount = countLineNodes(stairGrp!);
    // nSteps=16 → outline 1 + 17 cross + 16 diag = 34 (kernel-aligned vs tread-only ~24)
    expect(lineCount).toBeGreaterThan(28);
    expect(lineCount).toBe(34);
  });
});
