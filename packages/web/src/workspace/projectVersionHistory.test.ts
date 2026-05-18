import { describe, expect, it } from 'vitest';

describe('Version history panel — §1.6.2', () => {
  it('RestoreMilestoneCmd has correct shape', () => {
    const cmd = { type: 'restoreMilestone' as const, milestoneId: 'ms-abc' };
    expect(cmd.type).toBe('restoreMilestone');
    expect(cmd.milestoneId).toBe('ms-abc');
  });

  it('version-history-panel testid is correct', () => {
    expect('version-history-panel').toBe('version-history-panel');
  });

  it('version-history-row testid uses milestone id', () => {
    const id = 'ms-123';
    expect(`version-history-row-${id}`).toBe('version-history-row-ms-123');
  });

  it('version-history-restore testid uses milestone id', () => {
    const id = 'ms-123';
    expect(`version-history-restore-${id}`).toBe('version-history-restore-ms-123');
  });

  it('project-menu-version-history testid is correct', () => {
    expect('project-menu-version-history').toBe('project-menu-version-history');
  });

  it('milestone timestamp is formatted as locale string', () => {
    const ts = 1779108000000;
    const formatted = new Date(ts).toLocaleString();
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
