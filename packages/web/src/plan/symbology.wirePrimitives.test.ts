import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { rebuildPlanMeshes } from './symbology';
import type { PlanProjectionPrimitivesV1Wire } from './planProjectionWire';

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
});
