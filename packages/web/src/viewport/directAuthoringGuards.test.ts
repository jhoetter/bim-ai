import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  isBackfacingWallHit,
  isDuplicateHostedPlacement,
  shouldCommitHostedPlacementOnPointerUp,
  isLinkedElementId,
} from './directAuthoringGuards';

describe('isLinkedElementId', () => {
  it('returns true for linked scope ids', () => {
    expect(isLinkedElementId('wall-1::link-a')).toBe(true);
  });

  it('returns false for native model ids', () => {
    expect(isLinkedElementId('wall-1')).toBe(false);
  });
});

describe('isBackfacingWallHit', () => {
  it('accepts front-facing hits', () => {
    const backface = isBackfacingWallHit(
      new THREE.Vector3(0, 0, 1),
      new THREE.Matrix4().identity(),
      new THREE.Vector3(0, 0, -1),
    );
    expect(backface).toBe(false);
  });

  it('rejects backfacing hits', () => {
    const backface = isBackfacingWallHit(
      new THREE.Vector3(0, 0, 1),
      new THREE.Matrix4().identity(),
      new THREE.Vector3(0, 0, 1),
    );
    expect(backface).toBe(true);
  });

  it('transforms normals into world space before dot testing', () => {
    const rotated = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    const backface = isBackfacingWallHit(
      new THREE.Vector3(0, 0, 1),
      rotated,
      new THREE.Vector3(1, 0, 0),
    );
    expect(backface).toBe(true);
  });
});

describe('isDuplicateHostedPlacement', () => {
  it('returns false without prior placement', () => {
    expect(isDuplicateHostedPlacement(null, { key: 'door:w1:500', atMs: 1000 })).toBe(false);
  });

  it('returns true for identical keys inside guard window', () => {
    expect(
      isDuplicateHostedPlacement(
        { key: 'door:w1:500', atMs: 1000 },
        { key: 'door:w1:500', atMs: 1200 },
        420,
      ),
    ).toBe(true);
  });

  it('returns false for distinct key or expired window', () => {
    expect(
      isDuplicateHostedPlacement(
        { key: 'door:w1:500', atMs: 1000 },
        { key: 'door:w1:501', atMs: 1200 },
        420,
      ),
    ).toBe(false);
    expect(
      isDuplicateHostedPlacement(
        { key: 'door:w1:500', atMs: 1000 },
        { key: 'door:w1:500', atMs: 1500 },
        420,
      ),
    ).toBe(false);
  });
});

describe('shouldCommitHostedPlacementOnPointerUp', () => {
  it('commits hosted insert tools on pointer release even after pointer movement', () => {
    for (const draftTool of ['door', 'window', 'wall-opening']) {
      expect(
        shouldCommitHostedPlacementOnPointerUp({
          wasDragging: 'tool-draft',
          draftTool,
        }),
      ).toBe(true);
    }
  });

  it('does not change line/polygon drafting release semantics', () => {
    for (const draftTool of ['wall', 'floor', 'roof', 'ceiling', 'select', null]) {
      expect(
        shouldCommitHostedPlacementOnPointerUp({
          wasDragging: 'tool-draft',
          draftTool,
        }),
      ).toBe(false);
    }
    expect(
      shouldCommitHostedPlacementOnPointerUp({
        wasDragging: 'orbit',
        draftTool: 'window',
      }),
    ).toBe(false);
  });
});
