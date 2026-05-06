import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { makeWallMesh } from './meshBuilders';

type WallElem = Extract<Element, { kind: 'wall' }>;

const wallBase: WallElem = {
  kind: 'wall',
  id: 'w1',
  name: 'Test wall',
  levelId: 'lvl-base',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 4000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2700,
};

function findSlabEdge(obj: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  obj.traverse((node) => {
    if (found) return;
    if (node instanceof THREE.Mesh && node.userData.slabEdge === true) {
      found = node;
    }
  });
  return found;
}

describe('makeWallMesh — GAP-R5 slab-edge expression', () => {
  it('does NOT emit a slab-edge strip on a ground-floor wall (elevM=0)', () => {
    const obj = makeWallMesh(wallBase, 0, null);
    expect(findSlabEdge(obj)).toBeNull();
  });

  it('emits exactly one slab-edge strip on an upper-floor wall, spanning ~2980→3030 mm', () => {
    const elevM = 3.0;
    const obj = makeWallMesh(wallBase, elevM, null);
    const edge = findSlabEdge(obj);
    expect(edge).not.toBeNull();
    if (!edge) return;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(edge);
    expect(box.min.y * 1000).toBeCloseTo(2980, 0);
    expect(box.max.y * 1000).toBeCloseTo(3030, 0);
  });

  it('skips the strip when floorEdgeStripDisabled is true even at elevation > 0', () => {
    const wall: WallElem = { ...wallBase, floorEdgeStripDisabled: true };
    const obj = makeWallMesh(wall, 3.0, null);
    expect(findSlabEdge(obj)).toBeNull();
  });

  it('skips the strip on a layered wall (wallTypeId set)', () => {
    const wall: WallElem = { ...wallBase, wallTypeId: 'wall.int-partition' };
    const obj = makeWallMesh(wall, 3.0, null);
    expect(findSlabEdge(obj)).toBeNull();
  });
});
