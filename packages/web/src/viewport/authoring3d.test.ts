import { describe, expect, it } from 'vitest';

import {
  authoring3dLineLengthMm,
  buildLinePreviewPayload,
  buildPolygonPreviewPayload,
  classifyWallDraftProjection,
  isDraftPlaneHitOccluded,
  linePreviewToSemanticCommand,
  polygonPreviewToSemanticCommand,
  previewPayloadMatchesCommand,
  projectSceneRayToLevelPlaneMm,
  resolve3dDraftLevel,
  resizeLinePreviewToLength,
  snapDraftPointToGrid,
  snapDraftPointToPlanSnaps,
  validateWorkPlane3d,
} from './authoring3d';

describe('resolve3dDraftLevel', () => {
  const levels = [
    { id: 'upper', elevationMm: 3000 },
    { id: 'ground', elevationMm: 0 },
    { id: 'basement', elevationMm: -2400 },
  ] as const;

  it('uses preferred level when available', () => {
    expect(resolve3dDraftLevel(levels, 'upper')?.id).toBe('upper');
  });

  it('falls back to lowest elevation level when preferred level is missing', () => {
    expect(resolve3dDraftLevel(levels, 'missing')?.id).toBe('basement');
  });

  it('returns null when no levels are available', () => {
    expect(resolve3dDraftLevel([], 'ground')).toBeNull();
  });
});

describe('projectSceneRayToLevelPlaneMm', () => {
  it('projects a downward ray onto the level plane and maps scene z -> semantic y', () => {
    const hit = projectSceneRayToLevelPlaneMm({ x: 1, y: 6, z: -2 }, { x: 0.25, y: -1, z: 0.5 }, 0);
    expect(hit).toEqual({
      xMm: 2500,
      yMm: 1000,
    });
  });

  it('returns null for rays parallel to the level plane', () => {
    expect(projectSceneRayToLevelPlaneMm({ x: 0, y: 3, z: 0 }, { x: 1, y: 0, z: 0 }, 0)).toBeNull();
  });

  it('returns null when intersection is behind the ray origin', () => {
    expect(
      projectSceneRayToLevelPlaneMm({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, -1000),
    ).toBeNull();
  });
});

describe('classifyWallDraftProjection', () => {
  it('keeps exact level-plane placement when both screen axes are readable', () => {
    expect(classifyWallDraftProjection(24, 27, -0.7)).toMatchObject({
      mode: 'plane',
      anisotropyRatio: 27 / 24,
      verticalLook: 0.7,
    });
  });

  it('switches shallow views with unstable anisotropic projection to horizontal elevation-axis drafting', () => {
    const classification = classifyWallDraftProjection(43.7, 225.8, -0.265);

    expect(classification.mode).toBe('elevation-axis');
    expect(classification.anisotropyRatio).toBeGreaterThan(5);
    expect(classification.verticalLook).toBeCloseTo(0.265);
  });

  it('keeps exact level-plane drafting in shallow views when the local plane is numerically stable', () => {
    const classification = classifyWallDraftProjection(21.5, 55.3, -0.26);

    expect(classification.mode).toBe('plane');
    expect(classification.anisotropyRatio).toBeLessThan(3.25);
  });

  it('keeps exact level-plane drafting for moderately skewed post-rotation views', () => {
    const classification = classifyWallDraftProjection(21.9, 74.6, -0.2);

    expect(classification.mode).toBe('plane');
    expect(classification.anisotropyRatio).toBeGreaterThan(3);
    expect(classification.anisotropyRatio).toBeLessThan(4.25);
  });

  it('rejects numerically explosive level-plane projection even in top-ish poses', () => {
    expect(classifyWallDraftProjection(42, 220, -0.8).mode).toBe('elevation-axis');
  });
});

describe('isDraftPlaneHitOccluded', () => {
  it('treats model geometry in front of the active work plane as an occluder', () => {
    expect(isDraftPlaneHitOccluded(12, 8)).toBe(true);
  });

  it('allows hits that are effectively on the active work plane', () => {
    expect(isDraftPlaneHitOccluded(12, 11.98, 0.05)).toBe(false);
  });

  it('ignores invalid distances instead of blocking placement', () => {
    expect(isDraftPlaneHitOccluded(12, undefined)).toBe(false);
    expect(isDraftPlaneHitOccluded(NaN, 8)).toBe(false);
  });
});

describe('WP-NEXT-41 authoring3d shared kernel', () => {
  it('snaps to the active level grid only inside tolerance', () => {
    expect(snapDraftPointToGrid({ xMm: 994, yMm: 502 }, { gridStepMm: 500, snapMm: 24 })).toEqual({
      point: { xMm: 1000, yMm: 500 },
      kind: 'grid',
    });

    expect(snapDraftPointToGrid({ xMm: 1080, yMm: 690 }, { gridStepMm: 500, snapMm: 24 })).toEqual({
      point: { xMm: 1080, yMm: 690 },
      kind: 'level-plane',
    });
  });

  it('snaps 3D draft points to the same wall endpoints and midpoints as plan drafting', () => {
    const anchors = [
      { xMm: 0, yMm: 0, snapKind: 'endpoint' as const },
      { xMm: 4000, yMm: 0, snapKind: 'endpoint' as const },
      { xMm: 2000, yMm: 0, snapKind: 'midpoint' as const },
    ];

    expect(
      snapDraftPointToPlanSnaps({ xMm: 3970, yMm: 42 }, { anchors, gridStepMm: 250, snapMm: 85 }),
    ).toEqual({
      point: { xMm: 4000, yMm: 0 },
      kind: 'endpoint',
    });

    expect(
      snapDraftPointToPlanSnaps({ xMm: 2018, yMm: 35 }, { anchors, gridStepMm: 250, snapMm: 85 }),
    ).toEqual({
      point: { xMm: 2000, yMm: 0 },
      kind: 'midpoint',
    });
  });

  it('keeps free 3D draft placement when only the grid is outside tolerance', () => {
    expect(
      snapDraftPointToPlanSnaps(
        { xMm: 1080, yMm: 690 },
        { anchors: [], gridStepMm: 500, snapMm: 24 },
      ),
    ).toEqual({
      point: { xMm: 1080, yMm: 690 },
      kind: 'level-plane',
    });
  });

  it('uses one line preview payload for 3D wall preview and commit', () => {
    const payload = buildLinePreviewPayload({
      tool: 'wall',
      levelId: 'lvl-ground',
      start: { xMm: 1000, yMm: 2000 },
      end: { xMm: 4500, yMm: 2000 },
      wall: {
        id: 'wall-preview-command',
        locationLine: 'centerline',
        wallTypeId: 'wall-type-01',
        heightMm: 3000,
      },
    });

    const command = linePreviewToSemanticCommand(payload);

    expect(command).toMatchObject({
      type: 'createWall',
      levelId: 'lvl-ground',
      start: payload.start,
      end: payload.end,
    });
    expect(previewPayloadMatchesCommand(payload, command)).toBe(true);
  });

  it('uses one line preview payload for beam, railing, grid, and reference plane commands', () => {
    for (const tool of ['beam', 'railing', 'grid', 'reference-plane'] as const) {
      const payload = buildLinePreviewPayload({
        tool,
        levelId: 'lvl-ground',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 500 },
      });
      const command = linePreviewToSemanticCommand(payload);
      expect(previewPayloadMatchesCommand(payload, command)).toBe(true);
    }
  });

  it('uses one polygon preview payload for 3D floor and roof sketch commits', () => {
    for (const tool of ['floor', 'roof'] as const) {
      const payload = buildPolygonPreviewPayload({
        tool,
        levelId: 'lvl-ground',
        points: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
        ],
      });
      const command = polygonPreviewToSemanticCommand(payload);
      expect(previewPayloadMatchesCommand(payload, command)).toBe(true);
    }
  });

  it('resizes numeric line input without changing the start point or direction', () => {
    const payload = buildLinePreviewPayload({
      tool: 'beam',
      levelId: 'lvl-ground',
      start: { xMm: 100, yMm: 200 },
      end: { xMm: 1100, yMm: 200 },
    });

    const resized = resizeLinePreviewToLength(payload, 3500);

    expect(resized.start).toEqual(payload.start);
    expect(resized.end).toEqual({ xMm: 3600, yMm: 200 });
    expect(authoring3dLineLengthMm(resized)).toBeCloseTo(3500);
  });
});

describe('validateWorkPlane3d — WP-NEXT-46 red-preview gate', () => {
  it('wall tool on level plane with active level is valid', () => {
    const result = validateWorkPlane3d('wall', 'level-plane', true);
    expect(result.valid).toBe(true);
    expect(result.previewTint).toBeNull();
  });

  it('wall tool on wall-segment snap is invalid — requires level plane', () => {
    const result = validateWorkPlane3d('wall', 'wall-segment', true);
    expect(result.valid).toBe(false);
    expect(result.previewTint).toBe('red');
    expect(result.reason).toContain('level plane');
  });

  it('wall tool with no active level plane is invalid', () => {
    const result = validateWorkPlane3d('wall', 'level-plane', false);
    expect(result.valid).toBe(false);
    expect(result.previewTint).toBe('red');
    expect(result.reason).toContain('work plane');
  });

  it('door tool on wall-segment snap is valid', () => {
    const result = validateWorkPlane3d('door', 'wall-segment', true);
    expect(result.valid).toBe(true);
    expect(result.previewTint).toBeNull();
  });

  it('door tool on level-plane snap is invalid — requires wall face', () => {
    const result = validateWorkPlane3d('door', 'level-plane', true);
    expect(result.valid).toBe(false);
    expect(result.previewTint).toBe('red');
    expect(result.reason).toContain('wall face');
  });

  it('window tool on wall-endpoint snap is valid', () => {
    const result = validateWorkPlane3d('window', 'wall-endpoint', true);
    expect(result.valid).toBe(true);
  });

  it('component tool on any snap is valid (any host)', () => {
    expect(validateWorkPlane3d('component', 'level-plane', false).valid).toBe(true);
    expect(validateWorkPlane3d('component', 'wall-segment', true).valid).toBe(true);
    expect(validateWorkPlane3d('component', null, false).valid).toBe(true);
  });

  it('unknown tool treated as any-host — always valid', () => {
    expect(validateWorkPlane3d('mass-box', null, false).valid).toBe(true);
  });
});
