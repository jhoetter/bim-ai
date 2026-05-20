import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeFloorSlabMesh } from './meshBuilders';
import type { Element } from '@bim-ai/core';

type FloorElem = Extract<Element, { kind: 'floor' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;

const LEVEL: LevelElem = {
  kind: 'level',
  id: 'lvl-1',
  name: 'L1',
  elevationMm: 0,
};

const ELEMENTS_BY_ID: Record<string, Element> = { 'lvl-1': LEVEL };

// Simple 1m x 1m floor (plan: X in [0,1000], Y in [0,1000])
function makeFloor(overrides: Partial<FloorElem> = {}): FloorElem {
  return {
    kind: 'floor',
    id: 'floor-1',
    name: 'F1',
    levelId: 'lvl-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ],
    thicknessMm: 200,
    ...overrides,
  };
}

function topFaceYAt(mesh: THREE.Mesh, worldX: number, worldZ: number): number | null {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  let found: number | null = null;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    // Top-face vertices are originally at y ≈ th (may be offset by slope)
    // Match by XZ proximity; skip clear bottom-face vertices (y ≈ 0 with no slope offset)
    if (Math.abs(vx - worldX) < 0.01 && Math.abs(vz - worldZ) < 0.01) {
      if (found === null || vy > found) found = vy;
    }
  }
  return found;
}

describe('sloped floor mesh — §3.4.1', () => {
  it('flat floor (no slope) has uniform top face elevation', () => {
    const mesh = makeFloorSlabMesh(makeFloor(), ELEMENTS_BY_ID, null);
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const th = 0.2;
    const topYs: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - th) < 1e-4) topYs.push(pos.getY(i));
    }
    expect(topYs.length).toBeGreaterThan(0);
    const allSame = topYs.every((y) => Math.abs(y - topYs[0]!) < 1e-5);
    expect(allSame).toBe(true);
  });

  it('sloped floor: tail vertex is at base elevation, head vertex is raised', () => {
    const mesh = makeFloorSlabMesh(
      makeFloor({
        slopeArrowTailMm: { xMm: 0, yMm: 0 },
        slopeArrowHeadMm: { xMm: 1000, yMm: 0 },
        slopePercent: 10,
      }),
      ELEMENTS_BY_ID,
      null,
    );
    const tailY = topFaceYAt(mesh, 0, 0);
    const headY = topFaceYAt(mesh, 1, 0);
    expect(tailY).not.toBeNull();
    expect(headY).not.toBeNull();
    // Head should be higher than tail
    expect(headY!).toBeGreaterThan(tailY!);
  });

  it('slope of 10% raises head end by 10mm per 100mm horizontal', () => {
    // Arrow from x=0 to x=100mm. With 10% slope, rise = 10mm = 0.01m.
    const mesh = makeFloorSlabMesh(
      makeFloor({
        slopeArrowTailMm: { xMm: 0, yMm: 0 },
        slopeArrowHeadMm: { xMm: 1000, yMm: 0 },
        slopePercent: 10,
      }),
      ELEMENTS_BY_ID,
      null,
    );
    const tailY = topFaceYAt(mesh, 0, 0);
    const headY = topFaceYAt(mesh, 1, 0);
    expect(tailY).not.toBeNull();
    expect(headY).not.toBeNull();
    // 1000mm horizontal, 10% slope → rise = 100mm = 0.1m
    expect(headY! - tailY!).toBeCloseTo(0.1, 4);
  });

  it('bottom face vertices are unchanged by slope', () => {
    const mesh = makeFloorSlabMesh(
      makeFloor({
        slopeArrowTailMm: { xMm: 0, yMm: 0 },
        slopeArrowHeadMm: { xMm: 1000, yMm: 0 },
        slopePercent: 10,
      }),
      ELEMENTS_BY_ID,
      null,
    );
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    // Bottom-face vertices remain at y ≈ 0
    const bottomYs: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i)) < 1e-4) bottomYs.push(pos.getY(i));
    }
    expect(bottomYs.length).toBeGreaterThan(0);
    const allFlat = bottomYs.every((y) => Math.abs(y) < 1e-4);
    expect(allFlat).toBe(true);
  });
});
