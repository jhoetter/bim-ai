import { describe, expect, it } from 'vitest';

import { projectSceneRayToLevelPlaneMm, resolve3dDraftLevel } from './authoring3d';

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
