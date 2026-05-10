import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { buildWindowGeometry } from '../families/geometryFns/windowGeometry';
import { makeBalconyMesh, makeCurtainWallMesh } from './meshBuilders';

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

function findTransparentStandardMaterial(group: THREE.Group): THREE.MeshStandardMaterial | null {
  let found: THREE.MeshStandardMaterial | null = null;
  group.traverse((node) => {
    if (found || !(node instanceof THREE.Mesh)) return;
    const mat = node.material;
    if (mat instanceof THREE.MeshStandardMaterial && mat.transparent) found = mat;
  });
  return found;
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

describe('transparent glass depth handling', () => {
  it('uses depthWrite=false for hosted window glazing', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      id: 'wall1',
      isCurtainWall: false,
      thicknessMm: 200,
    };
    const win: Extract<Element, { kind: 'window' }> = {
      kind: 'window',
      id: 'win1',
      name: 'Window',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 1000,
      heightMm: 1200,
      sillHeightMm: 900,
    };
    const group = buildWindowGeometry({ win, wall, elevM: 0, paint: null, familyDef: undefined });

    const glazing = findTransparentStandardMaterial(group);

    expect(glazing).not.toBeNull();
    expect(glazing!.depthWrite).toBe(false);
  });

  it('uses depthWrite=false for balcony glass balustrades', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      id: 'wall1',
      isCurtainWall: false,
      thicknessMm: 200,
    };
    const balcony: Extract<Element, { kind: 'balcony' }> = {
      kind: 'balcony',
      id: 'balcony1',
      name: 'Balcony',
      wallId: wall.id,
      elevationMm: 3000,
      projectionMm: 900,
      slabThicknessMm: 150,
      balustradeHeightMm: 1050,
    };
    const group = makeBalconyMesh(balcony, { [wall.id]: wall }, null);

    const glass = findTransparentStandardMaterial(group);

    expect(glass).not.toBeNull();
    expect(glass!.depthWrite).toBe(false);
  });
});
