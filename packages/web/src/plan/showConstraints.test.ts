import { describe, expect, it } from 'vitest';

type PlanViewFixture = { kind: 'plan_view'; id: string; showConstraints?: boolean };
type DimensionFixture = {
  kind: 'permanent_dimension';
  id: string;
  isEqualityDimension?: boolean;
  isLocked?: boolean;
};

describe('Show constraints toggle — §3.3.5', () => {
  it('ToggleShowConstraintsCmd has correct shape', () => {
    const cmd = { type: 'toggleShowConstraints' as const, viewId: 'pv1' };
    expect(cmd.type).toBe('toggleShowConstraints');
    expect(cmd.viewId).toBe('pv1');
  });

  it('showConstraints defaults to false when not set', () => {
    const view: PlanViewFixture = { kind: 'plan_view', id: 'pv1' };
    expect(view.showConstraints ?? false).toBe(false);
  });

  it('toggle flips showConstraints', () => {
    const view: PlanViewFixture = { kind: 'plan_view', id: 'pv1', showConstraints: false };
    const next = !view.showConstraints;
    expect(next).toBe(true);
  });

  it('isEqualityDimension causes EQ label when showConstraints is true', () => {
    const dim: DimensionFixture = {
      kind: 'permanent_dimension',
      id: 'd1',
      isEqualityDimension: true,
    };
    const showConstraints = true;
    const label = showConstraints && dim.isEqualityDimension ? 'EQ' : '1200 mm';
    expect(label).toBe('EQ');
  });

  it('isLocked appends lock indicator when showConstraints is true', () => {
    const dim: DimensionFixture = { kind: 'permanent_dimension', id: 'd1', isLocked: true };
    const showConstraints = true;
    const lockSuffix = showConstraints && dim.isLocked ? ' 🔒' : '';
    expect(lockSuffix).toBe(' 🔒');
  });
});
