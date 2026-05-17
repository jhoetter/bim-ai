import { describe, expect, it } from 'vitest';
import {
  getCheatsheetData,
  filterCheatsheet,
  flattenCheatsheet,
  shouldOpenCheatsheet,
} from './cheatsheetData';
import i18n from '../i18n';

const t = i18n.t.bind(i18n);

describe('cheatsheet — spec §19', () => {
  it('groups entries into sections', () => {
    const ids = getCheatsheetData(t).map((s) => s.id);
    expect(ids).toEqual([
      'global',
      'modes',
      'tools',
      'modify',
      'annotate',
      'nav3d',
      'walk',
      'nav2d',
      'history',
      'shell',
    ]);
  });

  it('every documented spec action is present', () => {
    const flat = flattenCheatsheet(t);
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
    expect(filterCheatsheet('', t).length).toBe(getCheatsheetData(t).length);
  });

  it('filterCheatsheet narrows to matching action / keys', () => {
    const filtered = filterCheatsheet('orbit', t);
    const flat = filtered.flatMap((s) => s.entries);
    expect(flat.every((e) => /orbit/i.test(`${e.action} ${e.keys}`))).toBe(true);
    expect(flat.length).toBeGreaterThan(0);
  });

  it('filterCheatsheet returns empty when no match', () => {
    expect(filterCheatsheet('zzzzzzz', t).length).toBe(0);
  });
});

describe('cheatsheet data — §Appendix A', () => {
  it('tools section has more than 15 entries', () => {
    const sections = getCheatsheetData(t);
    const toolsSection = sections.find((s) => s.id === 'tools');
    expect(toolsSection).toBeDefined();
    expect(toolsSection!.entries.length).toBeGreaterThan(15);
  });

  it('modify section exists and has move/copy/rotate entries', () => {
    const sections = getCheatsheetData(t);
    const modifySection = sections.find((s) => s.id === 'modify');
    expect(modifySection).toBeDefined();
    const actions = modifySection!.entries.map((e) => e.action);
    expect(actions.some((a) => /move/i.test(a))).toBe(true);
    expect(actions.some((a) => /copy/i.test(a))).toBe(true);
    expect(actions.some((a) => /rotate/i.test(a))).toBe(true);
  });

  it('annotate section exists and has dimension/text/tag entries', () => {
    const sections = getCheatsheetData(t);
    const annotateSection = sections.find((s) => s.id === 'annotate');
    expect(annotateSection).toBeDefined();
    const actions = annotateSection!.entries.map((e) => e.action);
    expect(actions.some((a) => /dimension/i.test(a))).toBe(true);
    expect(actions.some((a) => /text/i.test(a))).toBe(true);
    expect(actions.some((a) => /tag/i.test(a))).toBe(true);
  });

  it('no duplicate action labels in any section', () => {
    const sections = getCheatsheetData(t);
    for (const section of sections) {
      const labels = section.entries.map((e) => e.action);
      const unique = new Set(labels);
      expect(unique.size).toBe(labels.length);
    }
  });

  it('all t() keys resolve without error (mock TFunction that returns key)', () => {
    const mockT = ((key: string) => key) as unknown as typeof t;
    const sections = getCheatsheetData(mockT);
    for (const section of sections) {
      expect(typeof section.label).toBe('string');
      expect(section.label.length).toBeGreaterThan(0);
      for (const entry of section.entries) {
        expect(typeof entry.action).toBe('string');
        expect(entry.action.length).toBeGreaterThan(0);
      }
    }
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
