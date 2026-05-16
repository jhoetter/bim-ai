import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';
import { makeColumnMesh } from './meshBuilders';

type ColumnElem = Extract<Element, { kind: 'column' }>;

function makeCol(overrides: Partial<ColumnElem> = {}): ColumnElem {
  return {
    kind: 'column',
    id: 'col-1',
    name: 'C1',
    levelId: 'lvl-0',
    positionMm: { xMm: 0, yMm: 0 },
    bMm: 300,
    hMm: 300,
    heightMm: 3000,
    ...overrides,
  } as ColumnElem;
}

/** Collect all vertex positions from a mesh's position buffer. */
function vertices(mesh: THREE.Mesh): THREE.Vector3[] {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  }
  return out;
}

describe('makeColumnMesh — sloped columns (F3)', () => {
  it('vertical column: top and bottom vertices are aligned in X', () => {
    const mesh = makeColumnMesh(makeCol(), 0, null);
    const verts = vertices(mesh);
    const topXs = verts.filter((v) => v.y > 0).map((v) => v.x);
    const botXs = verts.filter((v) => v.y < 0).map((v) => v.x);
    // All top X values should equal all bottom X values (same set of ±bM/2)
    const topSet = new Set(topXs.map((x) => Math.round(x * 1000)));
    const botSet = new Set(botXs.map((x) => Math.round(x * 1000)));
    for (const v of topSet) expect(botSet.has(v)).toBe(true);
  });

  it('topOffsetXMm: 500 shifts top vertices by 0.5m in X', () => {
    const straight = makeColumnMesh(makeCol(), 0, null);
    const sloped = makeColumnMesh(makeCol({ topOffsetXMm: 500 }), 0, null);

    const straightTopX = vertices(straight)
      .filter((v) => v.y > 0)
      .map((v) => v.x);
    const slopedTopX = vertices(sloped)
      .filter((v) => v.y > 0)
      .map((v) => v.x);

    // Every sloped top vertex should be shifted ~+0.5m relative to straight
    for (let i = 0; i < straightTopX.length; i++) {
      expect(slopedTopX[i]! - straightTopX[i]!).toBeCloseTo(0.5, 5);
    }
  });

  it('topOffsetXMm: 500 does NOT shift bottom vertices', () => {
    const straight = makeColumnMesh(makeCol(), 0, null);
    const sloped = makeColumnMesh(makeCol({ topOffsetXMm: 500 }), 0, null);

    const straightBotX = vertices(straight)
      .filter((v) => v.y < 0)
      .map((v) => v.x);
    const slopedBotX = vertices(sloped)
      .filter((v) => v.y < 0)
      .map((v) => v.x);

    for (let i = 0; i < straightBotX.length; i++) {
      expect(slopedBotX[i]!).toBeCloseTo(straightBotX[i]!, 5);
    }
  });

  it('zero offsets produces same vertex positions as before (no regression)', () => {
    const noOffset = makeColumnMesh(makeCol(), 0, null);
    const explicitZero = makeColumnMesh(makeCol({ topOffsetXMm: 0, topOffsetYMm: 0 }), 0, null);

    const v1 = vertices(noOffset);
    const v2 = vertices(explicitZero);
    expect(v1.length).toBe(v2.length);
    for (let i = 0; i < v1.length; i++) {
      expect(v2[i]!.x).toBeCloseTo(v1[i]!.x, 5);
      expect(v2[i]!.y).toBeCloseTo(v1[i]!.y, 5);
      expect(v2[i]!.z).toBeCloseTo(v1[i]!.z, 5);
    }
  });

  it('returns a THREE.Mesh', () => {
    const mesh = makeColumnMesh(makeCol({ topOffsetXMm: 200, topOffsetYMm: 100 }), 0, null);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });
});
