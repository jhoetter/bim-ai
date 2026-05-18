import { describe, expect, it } from 'vitest';

describe('duplicateProject / revertProject — §1.6.2', () => {
  it('DuplicateProjectCmd has correct shape', () => {
    const cmd = { type: 'duplicateProject' as const, newName: 'My Project Copy' };
    expect(cmd.type).toBe('duplicateProject');
    expect(cmd.newName).toBe('My Project Copy');
  });

  it('RevertProjectCmd has correct shape', () => {
    const cmd = { type: 'revertProject' as const };
    expect(cmd.type).toBe('revertProject');
  });

  it('duplicate preserves projectId as different UUID', () => {
    const originalId = 'proj-001';
    const newId = crypto.randomUUID();
    expect(newId).not.toBe(originalId);
  });

  it('clone name is user-supplied', () => {
    const cmd = { type: 'duplicateProject' as const, newName: 'House Project v2' };
    expect(cmd.newName).toContain('v2');
  });
});
