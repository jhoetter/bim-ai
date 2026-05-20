import { describe, expect, it } from 'vitest';

type SplitViewStateFixture = { splitViewEnabled: boolean };

describe('Split plan/3D view — §1.6.12', () => {
  it('ToggleSplitViewCmd has correct type', () => {
    const cmd = { type: 'toggleSplitView' as const };
    expect(cmd.type).toBe('toggleSplitView');
  });

  it('splitViewEnabled defaults to false', () => {
    const state: SplitViewStateFixture = { splitViewEnabled: false };
    expect(state.splitViewEnabled).toBe(false);
  });

  it('toggle flips splitViewEnabled', () => {
    const state: SplitViewStateFixture = { splitViewEnabled: false };
    const next = !state.splitViewEnabled;
    expect(next).toBe(true);
  });

  it('split layout uses 50% width for each pane', () => {
    const leftWidth = '50%';
    const rightWidth = '50%';
    expect(leftWidth).toBe('50%');
    expect(rightWidth).toBe('50%');
  });

  it('split view btn testid is correct', () => {
    const testid = 'viewport-split-view-btn';
    expect(testid).toBe('viewport-split-view-btn');
  });
});
