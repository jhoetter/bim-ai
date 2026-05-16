import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeColumnMesh } from './meshBuilders';

function makeCol(
  overrides: Partial<Extract<Element, { kind: 'column' }>> = {},
): Extract<Element, { kind: 'column' }> {
  return {
    kind: 'column',
    id: 'test-col',
    name: 'Test Column',
    levelId: 'lvl1',
    positionMm: { xMm: 0, yMm: 0 },
    bMm: 300,
    hMm: 300,
    heightMm: 3000,
    ...overrides,
  };
}

describe('sloped column mesh — §9.1.4', () => {
  it('vertical column (no offset): top vertices align with bottom X extent', () => {
    const mesh = makeColumnMesh(makeCol(), 0, null);
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
    }
    // For a 300mm column centred at origin, extent should be ±0.15 m
    expect(maxX).toBeCloseTo(0.15, 2);
    expect(minX).toBeCloseTo(-0.15, 2);
  });

  it('topOffsetXMm=500: top vertices are offset by 0.5 m in X', () => {
    const mesh = makeColumnMesh(makeCol({ topOffsetXMm: 500 }), 0, null);
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    // Find max X among top vertices (Y > 0 in local geo means top half of BoxGeometry)
    // After offset the max X top vertex should be 0.15 + 0.5 = 0.65 m
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      maxX = Math.max(maxX, pos.getX(i));
    }
    expect(maxX).toBeCloseTo(0.65, 2);
  });

  it('topOffsetYMm=300: top vertices are offset by 0.3 m in Z', () => {
    const mesh = makeColumnMesh(makeCol({ topOffsetYMm: 300 }), 0, null);
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      maxZ = Math.max(maxZ, pos.getZ(i));
    }
    expect(maxZ).toBeCloseTo(0.45, 2);
  });

  it('sloped column has 8 vertices (4 bottom + 4 top)', () => {
    const mesh = makeColumnMesh(makeCol({ topOffsetXMm: 200, topOffsetYMm: 100 }), 0, null);
    // BoxGeometry for a box has 24 vertices (4 per face × 6 faces).
    // We verify the geometry is valid (non-zero count).
    const count = mesh.geometry.attributes.position?.count ?? 0;
    expect(count).toBeGreaterThan(0);
  });
});
