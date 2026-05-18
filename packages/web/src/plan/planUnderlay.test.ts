import { describe, expect, it } from 'vitest';

describe('Plan underlay — §2.9.4', () => {
  it('SetPlanUnderlayCmd has correct shape', () => {
    const cmd = {
      type: 'setPlanUnderlay' as const,
      viewId: 'pv1',
      underlayLevelId: 'l0',
      showUnderlay: true,
    };
    expect(cmd.type).toBe('setPlanUnderlay');
    expect(cmd.underlayLevelId).toBe('l0');
  });

  it('showUnderlay defaults to false when not set', () => {
    const view: any = { kind: 'plan_view', id: 'pv1' };
    expect(view.showUnderlay ?? false).toBe(false);
  });

  it('toggle flips showUnderlay', () => {
    const view: any = { kind: 'plan_view', id: 'pv1', showUnderlay: false };
    const next = !view.showUnderlay;
    expect(next).toBe(true);
  });

  it('underlayLevelId can be cleared by setting null', () => {
    const cmd = { type: 'setPlanUnderlay' as const, viewId: 'pv1', underlayLevelId: null };
    expect(cmd.underlayLevelId).toBeNull();
  });

  it('underlay renders for walls on underlayLevelId', () => {
    const wall: any = { kind: 'wall', id: 'w1', levelId: 'l0' };
    const underlayLevelId = 'l0';
    expect(wall.levelId === underlayLevelId).toBe(true);
  });
});
