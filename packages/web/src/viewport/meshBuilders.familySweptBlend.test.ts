import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildFamilySweptBlendMesh } from './meshBuilders.familySweptBlend';
import type { FamilySweptBlend } from '@bim-ai/core';

const squareProfile: FamilySweptBlend['startProfileMm'] = [
  { xMm: -500, yMm: -500 },
  { xMm: 500, yMm: -500 },
  { xMm: 500, yMm: 500 },
  { xMm: -500, yMm: 500 },
];
const smallSquare: FamilySweptBlend['endProfileMm'] = [
  { xMm: -200, yMm: -200 },
  { xMm: 200, yMm: -200 },
  { xMm: 200, yMm: 200 },
  { xMm: -200, yMm: 200 },
];
const path: FamilySweptBlend['pathMm'] = [
  { xMm: 0, yMm: 0 },
  { xMm: 0, yMm: 2000 },
  { xMm: 0, yMm: 4000 },
];

describe('buildFamilySweptBlendMesh — §15.1.2', () => {
  it('returns null for path with fewer than 2 points', () => {
    expect(
      buildFamilySweptBlendMesh({
        id: 'f1',
        kind: 'family_swept_blend',
        startProfileMm: squareProfile,
        endProfileMm: smallSquare,
        pathMm: [{ xMm: 0, yMm: 0 }],
      }),
    ).toBeNull();
  });

  it('returns null for start profile with fewer than 3 points', () => {
    expect(
      buildFamilySweptBlendMesh({
        id: 'f1',
        kind: 'family_swept_blend',
        startProfileMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 100, yMm: 0 },
        ],
        endProfileMm: smallSquare,
        pathMm: path,
      }),
    ).toBeNull();
  });

  it('returns a THREE.Mesh for valid input', () => {
    const mesh = buildFamilySweptBlendMesh({
      id: 'f1',
      kind: 'family_swept_blend',
      startProfileMm: squareProfile,
      endProfileMm: smallSquare,
      pathMm: path,
    });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('mesh has geometry with vertices', () => {
    const mesh = buildFamilySweptBlendMesh({
      id: 'f1',
      kind: 'family_swept_blend',
      startProfileMm: squareProfile,
      endProfileMm: smallSquare,
      pathMm: path,
    });
    expect(mesh?.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it('mesh has indices', () => {
    const mesh = buildFamilySweptBlendMesh({
      id: 'f1',
      kind: 'family_swept_blend',
      startProfileMm: squareProfile,
      endProfileMm: smallSquare,
      pathMm: path,
    });
    expect(mesh?.geometry.index?.count).toBeGreaterThan(0);
  });
});
