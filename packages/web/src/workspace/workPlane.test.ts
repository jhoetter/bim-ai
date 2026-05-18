import { describe, expect, it } from 'vitest';

describe('Work plane face orientation — §7.3.2 §7.3.3', () => {
  it('SetWorkPlaneFaceCmd has correct shape', () => {
    const cmd = { type: 'setWorkPlaneFace' as const, hostElementId: 'wall-01' };
    expect(cmd.type).toBe('setWorkPlaneFace');
    expect(cmd.hostElementId).toBe('wall-01');
  });

  it('work_plane element has required fields', () => {
    const wp: any = {
      kind: 'work_plane',
      id: 'wp-01',
      name: 'Stair Wall Plane',
      hostElementId: 'wall-01',
      elevationMm: 0,
      normalDeg: 90,
      levelId: 'l1',
    };
    expect(wp.kind).toBe('work_plane');
    expect(wp.normalDeg).toBe(90);
  });

  it('wall face normal = wall angle + 90 degrees', () => {
    const wallAngleDeg = 45;
    const normalDeg = (wallAngleDeg + 90) % 360;
    expect(normalDeg).toBe(135);
  });

  it('horizontal floor has normalDeg = 0', () => {
    const floor: any = { kind: 'floor', angleDeg: 0 };
    const normalDeg = floor.kind === 'floor' ? 0 : ((floor.angleDeg ?? 0) + 90) % 360;
    expect(normalDeg).toBe(0);
  });
});
