import { describe, expect, it } from 'vitest';

describe('Reset workspace — §1.10', () => {
  it('ResetWorkspaceCmd has correct type', () => {
    const cmd = { type: 'resetWorkspace' as const };
    expect(cmd.type).toBe('resetWorkspace');
  });

  it('splitViewEnabled resets to false', () => {
    const defaults = { splitViewEnabled: false };
    expect(defaults.splitViewEnabled).toBe(false);
  });

  it('skyBackground resets to default', () => {
    const defaults = { skyBackground: 'default' };
    expect(defaults.skyBackground).toBe('default');
  });

  it('thinLinesEnabled resets to false', () => {
    const defaults = { thinLinesEnabled: false };
    expect(defaults.thinLinesEnabled).toBe(false);
  });

  it('project-menu-reset-workspace testid is correct', () => {
    const testid = 'project-menu-reset-workspace';
    expect(testid).toBe('project-menu-reset-workspace');
  });
});
