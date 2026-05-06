/**
 * KRN-13: plan symbol primitives differ per door operationType.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { planDoorSymbolPrimitives } from './planElementMeshBuilders';

type DoorElem = Extract<Element, { kind: 'door' }>;

function door(opOverride?: Partial<DoorElem>): DoorElem {
  return {
    kind: 'door',
    id: 'd1',
    name: 'Door',
    wallId: 'w1',
    alongT: 0.5,
    widthMm: 900,
    ...opOverride,
  };
}

const W = 0.9;

function lineCount(prims: THREE.Object3D[]): number {
  return prims.filter((p) => p instanceof THREE.Line).length;
}

function dashedLineCount(prims: THREE.Object3D[]): number {
  return prims.filter(
    (p) => p instanceof THREE.Line && p.material instanceof THREE.LineDashedMaterial,
  ).length;
}

describe('planDoorSymbolPrimitives — KRN-13 plan symbols', () => {
  it('swing_single emits a single arc', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'swing_single' }), W);
    expect(lineCount(prims)).toBe(1);
    expect(dashedLineCount(prims)).toBe(0);
  });

  it('default (undefined operationType) renders as swing_single', () => {
    const def = planDoorSymbolPrimitives(door(), W);
    const explicit = planDoorSymbolPrimitives(door({ operationType: 'swing_single' }), W);
    expect(lineCount(def)).toBe(lineCount(explicit));
  });

  it('swing_double emits two arcs', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'swing_double' }), W);
    expect(lineCount(prims)).toBe(2);
  });

  it('sliding_single emits track line + one arrowhead', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'sliding_single' }), W);
    expect(lineCount(prims)).toBe(2);
    expect(dashedLineCount(prims)).toBe(0);
  });

  it('sliding_double emits track line + two arrowheads', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'sliding_double' }), W);
    expect(lineCount(prims)).toBe(3);
  });

  it('bi_fold emits one zigzag polyline', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'bi_fold' }), W);
    expect(lineCount(prims)).toBe(1);
    // The zigzag has 5 control points (\\/\\/-pattern).
    const line = prims.find((p) => p instanceof THREE.Line) as THREE.Line;
    const positionAttr = line.geometry.getAttribute('position');
    expect(positionAttr.count).toBe(5);
  });

  it('pocket emits a dashed pocket-extent line plus solid panel line', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'pocket' }), W);
    expect(dashedLineCount(prims)).toBe(1);
    expect(lineCount(prims)).toBeGreaterThanOrEqual(2);
  });

  it('pivot emits pivot dot (mesh) + arc', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'pivot' }), W);
    const meshes = prims.filter((p) => p instanceof THREE.Mesh);
    const lines = prims.filter((p) => p instanceof THREE.Line);
    expect(meshes.length).toBe(1);
    expect(lines.length).toBe(1);
  });

  it('automatic_double emits two outward arrows', () => {
    const prims = planDoorSymbolPrimitives(door({ operationType: 'automatic_double' }), W);
    expect(lineCount(prims)).toBe(2);
  });

  it.each([
    ['swing_single', 1],
    ['swing_double', 2],
    ['sliding_single', 2],
    ['sliding_double', 3],
    ['bi_fold', 1],
    ['pocket', 2],
    ['pivot', 1], // 1 line + 1 mesh
    ['automatic_double', 2],
  ] as const)('%s emits the expected line count (%d)', (op, expected) => {
    const prims = planDoorSymbolPrimitives(door({ operationType: op }), W);
    expect(lineCount(prims)).toBe(expected);
  });

  it('every operationType produces a distinct primitive signature (geometry-aware)', () => {
    function sig(op: DoorElem['operationType']): string {
      const prims = planDoorSymbolPrimitives(door({ operationType: op }), W);
      const lines = prims.filter((p) => p instanceof THREE.Line) as THREE.Line[];
      const meshes = prims.filter((p) => p instanceof THREE.Mesh).length;
      const dashed = lines.filter((l) => l.material instanceof THREE.LineDashedMaterial).length;
      const pointCounts = lines
        .map((l) => l.geometry.getAttribute('position').count)
        .sort()
        .join(',');
      return `lines=${lines.length}|dashed=${dashed}|meshes=${meshes}|pts=${pointCounts}`;
    }
    const allOps = [
      'swing_single',
      'swing_double',
      'sliding_single',
      'sliding_double',
      'bi_fold',
      'pocket',
      'pivot',
      'automatic_double',
    ] as const;
    const seen = new Map<string, string>();
    for (const op of allOps) {
      const s = sig(op);
      const dup = seen.get(s);
      expect(dup, `${op} collapses onto same signature as ${dup}`).toBeUndefined();
      seen.set(s, op);
    }
  });
});
