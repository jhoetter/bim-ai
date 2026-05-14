import { describe, expect, it } from 'vitest';

import {
  classifyWallDraftProjection,
  isDraftPlaneHitOccluded,
  projectSceneRayToLevelPlaneMm,
  resolve3dDraftLevel,
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
