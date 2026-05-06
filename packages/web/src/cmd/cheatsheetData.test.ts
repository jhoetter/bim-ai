import { describe, expect, it } from 'vitest';
import {
  CHEATSHEET,
  filterCheatsheet,
  flattenCheatsheet,
  shouldOpenCheatsheet,
} from './cheatsheetData';

describe('cheatsheet — spec §19', () => {
  it('groups entries into sections', () => {
    const ids = CHEATSHEET.map((s) => s.id);
    expect(ids).toEqual(['global', 'modes', 'tools', 'nav3d', 'walk', 'nav2d', 'history', 'shell']);
  });

  it('every documented spec action is present', () => {
    const flat = flattenCheatsheet();
    const required = [
      'Command palette',
      'Show this cheatsheet',
      'Cancel',
      'Confirm / Apply',
      'Plan',
      '3D',
      'Plan + 3D',
      'Section',
      'Sheet',
      'Schedule',
      'Agent',
      'Select',
      'Wall',
      'Door',
      'Window',
      'Floor',
      'Roof',
      'Stair',
      'Railing',
      'Room marker',
      'Dimension',
      'Section',
      'Tag',
      'Undo',
      'Redo',
      'Toggle left rail',
      'Toggle right rail',
    ];
    for (const action of required) {
      expect(flat.find((e) => e.action === action)).toBeDefined();
    }
  });

  it('filterCheatsheet returns the full set when query is empty', () => {
    expect(filterCheatsheet('').length).toBe(CHEATSHEET.length);
  });

  it('filterCheatsheet narrows to matching action / keys', () => {
    const filtered = filterCheatsheet('orbit');
    const flat = filtered.flatMap((s) => s.entries);
    expect(flat.every((e) => /orbit/i.test(`${e.action} ${e.keys}`))).toBe(true);
    expect(flat.length).toBeGreaterThan(0);
  });

  it('filterCheatsheet returns empty when no match', () => {
    expect(filterCheatsheet('zzzzzzz').length).toBe(0);
  });
});

describe('shouldOpenCheatsheet', () => {
  it('opens on `?` (literal)', () => {
    expect(shouldOpenCheatsheet({ key: '?' })).toBe(true);
  });
  it('opens on Shift + /', () => {
    expect(shouldOpenCheatsheet({ key: '/', shiftKey: true })).toBe(true);
  });
  it('does not open on / alone', () => {
    expect(shouldOpenCheatsheet({ key: '/' })).toBe(false);
  });
  it('does not open on unrelated key', () => {
    expect(shouldOpenCheatsheet({ key: 'a' })).toBe(false);
  });
});
