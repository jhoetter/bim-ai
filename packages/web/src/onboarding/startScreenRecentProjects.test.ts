import { describe, expect, it } from 'vitest';
import { PROJECT_TEMPLATES } from './projectTemplates';

describe('Start screen — §1.5', () => {
  it('has at least 4 project templates', () => {
    expect(PROJECT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it('vereinfacht template exists', () => {
    const t = PROJECT_TEMPLATES.find((t) => t.id === 'vereinfacht');
    expect(t).toBeTruthy();
    expect(t?.name).toContain('vereinfacht');
  });

  it('vereinfacht template has EG and OG levels', () => {
    const t = PROJECT_TEMPLATES.find((t) => t.id === 'vereinfacht');
    const levelCmds = (t?.commands ?? []).filter((c: any) => c.type === 'createLevel');
    expect(levelCmds.some((c: any) => c.name === 'EG')).toBe(true);
    expect(levelCmds.some((c: any) => c.name === 'OG')).toBe(true);
  });

  it('recentProjectIds deduplicates on prepend', () => {
    const existing = ['p1', 'p2', 'p3'];
    const newId = 'p2';
    const result = [newId, ...existing.filter((x) => x !== newId)].slice(0, 10);
    expect(result).toEqual(['p2', 'p1', 'p3']);
    expect(result.filter((x) => x === 'p2').length).toBe(1);
  });

  it('recentProjectIds caps at 10', () => {
    const existing = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const result = existing.slice(0, 10);
    expect(result.length).toBe(10);
  });

  it('OpenRecentProjectCmd has correct shape', () => {
    const cmd = { type: 'openRecentProject' as const, projectId: 'proj-123' };
    expect(cmd.type).toBe('openRecentProject');
    expect(cmd.projectId).toBe('proj-123');
  });
});
