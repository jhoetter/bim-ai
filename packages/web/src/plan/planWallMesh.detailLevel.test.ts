import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { planWallMesh } from './planElementMeshBuilders';

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-1',
  name: 'Ext',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
  // Pick the catalog's exterior timber type so layer overlay lines kick in.
  wallTypeId: 'wall.ext-timber',
};

function countLayerLineSegments(node: THREE.Object3D): number {
  let n = 0;
  node.traverse((child) => {
    if (
      (child as THREE.LineSegments).isLineSegments &&
      (child as THREE.LineSegments).userData.layerBoundary
    ) {
      const geom = (child as THREE.LineSegments).geometry as THREE.BufferGeometry;
      const pos = geom.getAttribute('position');
      // Each LineSegments draws pairs of positions → segments = positions / 2.
      n += pos.count / 2;
    }
  });
  return n;
}

describe('VIE-01 — planWallMesh detail-level binding', () => {
  it('coarse: wall renders as a single solid bar (no layer boundary lines)', () => {
    const node = planWallMesh(wall, undefined, 1, undefined, 'coarse');
    expect(countLayerLineSegments(node)).toBe(0);
  });

  it('fine: emits boundaries for every layer in the assembly', () => {
    const node = planWallMesh(wall, undefined, 1, undefined, 'fine');
    const fineCount = countLayerLineSegments(node);
    expect(fineCount).toBeGreaterThan(2);
  });

  it('medium: emits fewer boundaries than fine (core boundaries only)', () => {
    const fine = countLayerLineSegments(planWallMesh(wall, undefined, 1, undefined, 'fine'));
    const med = countLayerLineSegments(planWallMesh(wall, undefined, 1, undefined, 'medium'));
    expect(med).toBeGreaterThan(0);
    expect(med).toBeLessThan(fine);
  });

  it('walls without a wallTypeId render as a single mesh at every detail level', () => {
    const plainWall: Extract<Element, { kind: 'wall' }> = { ...wall, wallTypeId: null };
    expect(countLayerLineSegments(planWallMesh(plainWall, undefined, 1, undefined, 'coarse'))).toBe(
      0,
    );
    expect(countLayerLineSegments(planWallMesh(plainWall, undefined, 1, undefined, 'medium'))).toBe(
      0,
    );
    expect(countLayerLineSegments(planWallMesh(plainWall, undefined, 1, undefined, 'fine'))).toBe(
      0,
    );
  });
});
