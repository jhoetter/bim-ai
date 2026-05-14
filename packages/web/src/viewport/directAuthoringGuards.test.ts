import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  findHostedOpeningConflict,
  isBackfacingWallHit,
  isDuplicateHostedPlacement,
  shouldCommitHostedPlacementOnPointerUp,
  shouldReuseHostedPreviewCommit,
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

describe('shouldReuseHostedPreviewCommit', () => {
  it('reuses a visible host preview when release is near the preview center', () => {
    expect(
      shouldReuseHostedPreviewCommit({
        clickScreen: { x: 112, y: 105 },
        previewCenter: { x: 100, y: 100 },
      }),
    ).toBe(true);
  });

  it('reuses a visible host preview when release is inside the preview outline', () => {
    expect(
      shouldReuseHostedPreviewCommit({
        clickScreen: { x: 175, y: 145 },
        previewCenter: { x: 100, y: 100 },
        previewOutline: [
          { x: 140, y: 120 },
          { x: 220, y: 120 },
          { x: 220, y: 180 },
          { x: 140, y: 180 },
        ],
      }),
    ).toBe(true);
  });

  it('does not reuse stale previews far away from the visible host glyph', () => {
    expect(
      shouldReuseHostedPreviewCommit({
        clickScreen: { x: 360, y: 320 },
        previewCenter: { x: 100, y: 100 },
        previewOutline: [
          { x: 140, y: 120 },
          { x: 220, y: 120 },
          { x: 220, y: 180 },
          { x: 140, y: 180 },
        ],
      }),
    ).toBe(false);
  });
});

describe('findHostedOpeningConflict', () => {
  it('detects a proposed hosted opening overlapping an existing window on the same wall', () => {
    const conflict = findHostedOpeningConflict({
      wallId: 'wall-a',
      wallLengthMm: 6000,
      alongT: 0.52,
      widthMm: 1200,
      existing: [
        {
          kind: 'window',
          id: 'window-a',
          wallId: 'wall-a',
          alongT: 0.5,
          widthMm: 1200,
        },
      ],
    });

    expect(conflict?.elementId).toBe('window-a');
  });

  it('allows the same proposed span when existing openings are on another wall', () => {
    expect(
      findHostedOpeningConflict({
        wallId: 'wall-a',
        wallLengthMm: 6000,
        alongT: 0.52,
        widthMm: 1200,
        existing: [
          {
            kind: 'door',
            id: 'door-b',
            wallId: 'wall-b',
            alongT: 0.5,
            widthMm: 900,
          },
        ],
      }),
    ).toBeNull();
  });

  it('detects conflicts against generic wall openings using their span', () => {
    const conflict = findHostedOpeningConflict({
      wallId: 'wall-a',
      wallLengthMm: 10000,
      alongT: 0.42,
      widthMm: 1000,
      existing: [
        {
          kind: 'wall_opening',
          id: 'opening-a',
          hostWallId: 'wall-a',
          alongTStart: 0.38,
          alongTEnd: 0.48,
        },
      ],
    });

    expect(conflict?.elementId).toBe('opening-a');
  });
});
