/**
 * G9 — Tests for curtain wall panel rendering with the new curtainWallData field.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeCurtainWallMesh } from './meshBuilders';
import type { Element } from '@bim-ai/core';

type WallElem = Extract<Element, { kind: 'wall' }>;

function countPanes(group: THREE.Group): number {
  let count = 0;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
      count++;
    }
  });
  return count;
}

describe('G9 — 4mx3m curtain wall, 3 vertical, 2 horizontal = 6 glass panels', () => {
  it('renders exactly 6 panels for 3V x 2H grid', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'cw-g9',
      name: 'Curtain Wall',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 80,
      heightMm: 3000,
      isCurtainWall: true,
      curtainWallVCount: 3,
      curtainWallHCount: 2,
    };

    const group = makeCurtainWallMesh(wall, 0, null);
    expect(countPanes(group)).toBe(6);
  });

  it('uses curtainWallData gridV.count when set', () => {
    const wall: WallElem = {
      kind: 'wall',
      id: 'cw-data',
      name: 'CW Data',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 80,
      heightMm: 3000,
      isCurtainWall: true,
      curtainWallVCount: 4,
      curtainWallHCount: 2,
      curtainWallData: {
        gridV: { count: 4 },
        gridH: { count: 2 },
      },
    };

    const group = makeCurtainWallMesh(wall, 0, null);
    expect(countPanes(group)).toBe(4 * 2);
  });
});
