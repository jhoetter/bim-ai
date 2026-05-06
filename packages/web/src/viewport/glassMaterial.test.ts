import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeCurtainWallMesh } from './meshBuilders';

type WallElem = Extract<Element, { kind: 'wall' }>;

const baseCurtainWall: WallElem = {
  kind: 'wall',
  id: 'cw1',
  name: 'Curtain wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 80,
  heightMm: 3000,
  isCurtainWall: true,
  curtainWallVCount: 4,
  curtainWallHCount: 2,
};

function findGlassMaterial(group: THREE.Group): THREE.MeshPhysicalMaterial | null {
  let glass: THREE.MeshPhysicalMaterial | null = null;
  group.traverse((node) => {
    if (glass) return;
    if (!(node instanceof THREE.Mesh)) return;
    const mat = node.material;
    if (!(mat instanceof THREE.MeshPhysicalMaterial)) return;
    if (mat.transparent === true) glass = mat;
  });
  return glass;
}

describe('GAP-R7 — curtain wall glass material', () => {
  it('uses MeshPhysicalMaterial with transparent + depthWrite=false + transmission >= 0.9', () => {
    const group = makeCurtainWallMesh(baseCurtainWall, 0, null);
    const glass = findGlassMaterial(group);
    expect(glass).not.toBeNull();
    if (!glass) return;
    expect(glass.transparent).toBe(true);
    expect(glass.depthWrite).toBe(false);
    expect(glass.transmission).toBeGreaterThanOrEqual(0.9);
    expect(glass.roughness).toBeLessThanOrEqual(0.1);
    expect(glass.side).toBe(THREE.DoubleSide);
  });

  it('does NOT z-occlude the interior — depthWrite stays false even after a render-pass-friendly opacity', () => {
    const group = makeCurtainWallMesh(baseCurtainWall, 0, null);
    const glass = findGlassMaterial(group)!;
    expect(glass.opacity).toBeLessThan(1);
    expect(glass.depthWrite).toBe(false);
  });
});
