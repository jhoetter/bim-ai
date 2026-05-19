import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  findHostedOpeningConflict,
  isPointAttachedToWallFace,
  isBackfacingWallHit,
  isDuplicateHostedPlacement,
  shouldBypassLevelDatumPickForDirectAuthoring,
  shouldCommitHostedPlacementOnPointerUp,
  shouldReuseHostedPreviewCommit,
  isLinkedElementId,
  isPhysicalHostedOpeningWall,
  isWallOnActiveAuthoringLevel,
} from './directAuthoringGuards';

describe('isLinkedElementId', () => {
  it('returns true for linked scope ids', () => {
    expect(isLinkedElementId('wall-1::link-a')).toBe(true);
  });

  it('returns false for native model ids', () => {
    expect(isLinkedElementId('wall-1')).toBe(false);
  });
});

describe('isWallOnActiveAuthoringLevel', () => {
  it('allows wall-hosted authoring only on the active level', () => {
    expect(isWallOnActiveAuthoringLevel({ levelId: 'ground' }, 'ground')).toBe(true);
    expect(isWallOnActiveAuthoringLevel({ levelId: 'first' }, 'ground')).toBe(false);
  });

  it('rejects wall hosts when no active level is resolved', () => {
    expect(isWallOnActiveAuthoringLevel({ levelId: 'ground' }, undefined)).toBe(false);
    expect(isWallOnActiveAuthoringLevel({ levelId: 'ground' }, null)).toBe(false);
  });
});

describe('isPhysicalHostedOpeningWall', () => {
  it('rejects nonphysical/helper wall hosts consistently with backend hosted guards', () => {
    expect(isPhysicalHostedOpeningWall({ kind: 'wall', name: 'Exterior wall' })).toBe(true);
    expect(
      isPhysicalHostedOpeningWall({
        kind: 'wall',
        name: 'Room graph helper wall',
        props: {},
      }),
    ).toBe(false);
    expect(
      isPhysicalHostedOpeningWall({
        kind: 'wall',
        name: 'Wall',
        props: { nonPhysical: true },
      }),
    ).toBe(false);
    expect(
      isPhysicalHostedOpeningWall({
        kind: 'floor',
        name: 'Floor',
        props: {},
      }),
    ).toBe(false);
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

describe('shouldBypassLevelDatumPickForDirectAuthoring', () => {
  it('keeps ordinary direct-authoring clicks on the placement tool instead of level datums', () => {
    for (const directTool of ['window', 'door', 'wall', 'railing']) {
      expect(
        shouldBypassLevelDatumPickForDirectAuthoring({
          button: 0,
          directTool,
          altKey: false,
          shiftKey: false,
        }),
      ).toBe(true);
    }
  });

  it('leaves level datum picking available outside ordinary direct-authoring clicks', () => {
    expect(
      shouldBypassLevelDatumPickForDirectAuthoring({
        button: 0,
        directTool: null,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe(false);
    expect(
      shouldBypassLevelDatumPickForDirectAuthoring({
        button: 0,
        directTool: 'window',
        altKey: true,
        shiftKey: false,
      }),
    ).toBe(false);
    expect(
      shouldBypassLevelDatumPickForDirectAuthoring({
        button: 1,
        directTool: 'window',
        altKey: false,
        shiftKey: false,
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

describe('isPointAttachedToWallFace', () => {
  const wall = {
    start: { xMm: 1000, yMm: 1000 },
    end: { xMm: 4000, yMm: 1000 },
    thicknessMm: 200,
  };

  it('accepts hosted family points inside the wall face band', () => {
    expect(
      isPointAttachedToWallFace({
        pointMm: { xMm: 2000, yMm: 1080 },
        wall,
        hostAlongT: 1 / 3,
      }),
    ).toBe(true);
  });

  it('rejects off-face and mismatched hostAlongT placements before commit', () => {
    expect(
      isPointAttachedToWallFace({
        pointMm: { xMm: 2000, yMm: 1800 },
        wall,
      }),
    ).toBe(false);
    expect(
      isPointAttachedToWallFace({
        pointMm: { xMm: 3000, yMm: 1000 },
        wall,
        hostAlongT: 0.1,
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
    expect(conflict?.reason).toBe('overlap');
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

  it('rejects proposed hosted openings that violate endpoint clearance', () => {
    const conflict = findHostedOpeningConflict({
      wallId: 'wall-a',
      wallLengthMm: 4000,
      alongT: 0.08,
      widthMm: 900,
      existing: [],
      clearanceMm: 75,
    });

    expect(conflict?.reason).toBe('endpoint_clearance');
  });

  it('rejects proposed hosted openings when wall capacity is exceeded', () => {
    const conflict = findHostedOpeningConflict({
      wallId: 'wall-a',
      wallLengthMm: 2500,
      alongT: 0.72,
      widthMm: 900,
      clearanceMm: 75,
      existing: [
        {
          kind: 'door',
          id: 'door-a',
          wallId: 'wall-a',
          alongT: 0.25,
          widthMm: 900,
        },
        {
          kind: 'window',
          id: 'window-a',
          wallId: 'wall-a',
          alongT: 0.5,
          widthMm: 500,
        },
      ],
    });

    expect(conflict?.reason).toBe('host_capacity_exceeded');
  });
});
