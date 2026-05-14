import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPersistedTabs,
  persistTabs,
  pruneTabsAgainstElements,
  readPersistedTabs,
} from './tabsPersistence';
import type { TabsState } from './tabsModel';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('tabsPersistence — T-06', () => {
  it('roundtrips a TabsState through localStorage', () => {
    const state: TabsState = {
      tabs: [
        { id: 'plan:l0', kind: 'plan', targetId: 'l0', label: 'Plan · L0' },
        { id: '3d:vp1', kind: '3d', targetId: 'vp1', label: '3D · iso' },
      ],
      activeId: '3d:vp1',
    };
    persistTabs(state);
    const restored = readPersistedTabs();
    expect(restored).toEqual(state);
  });

  it('returns null when nothing is persisted', () => {
    expect(readPersistedTabs()).toBeNull();
  });

  it('returns null on a corrupt payload', () => {
    localStorage.setItem('bim-ai:tabs-v1', '{not json');
    expect(readPersistedTabs()).toBeNull();
  });

  it('returns null when the schema version does not match', () => {
    localStorage.setItem('bim-ai:tabs-v1', JSON.stringify({ v: 999, tabs: [] }));
    expect(readPersistedTabs()).toBeNull();
  });

  it('clearPersistedTabs removes the entry', () => {
    persistTabs({
      tabs: [{ id: 'plan:l0', kind: 'plan', label: 'Plan · L0' }],
      activeId: 'plan:l0',
    });
    expect(readPersistedTabs()).not.toBeNull();
    clearPersistedTabs();
    expect(readPersistedTabs()).toBeNull();
  });

  it('pruneTabsAgainstElements drops tabs whose targetId is gone', () => {
    const state: TabsState = {
      tabs: [
        { id: 'plan:l0', kind: 'plan', targetId: 'l0', label: 'L0' },
        { id: 'plan:l-removed', kind: 'plan', targetId: 'l-removed', label: 'L-removed' },
      ],
      activeId: 'plan:l-removed',
    };
    const pruned = pruneTabsAgainstElements(state, { l0: {} });
    expect(pruned.tabs.map((t) => t.id)).toEqual(['plan:l0']);
    // active was pruned → falls back to the first surviving tab
    expect(pruned.activeId).toBe('plan:l0');
  });

  it('drops unsupported tab kinds from persisted state and falls back activeId', () => {
    localStorage.setItem(
      'bim-ai:tabs-v1',
      JSON.stringify({
        v: 1,
        tabs: [
          { id: 'legacy:l0', kind: 'legacy', targetId: 'l0', label: 'Legacy · L0' },
          { id: 'sheet:a1', kind: 'sheet', targetId: 'a1', label: 'Sheet · A1' },
        ],
        activeId: 'legacy:l0',
      }),
    );
    const restored = readPersistedTabs();
    expect(restored).toEqual({
      tabs: [{ id: 'sheet:a1', kind: 'sheet', targetId: 'a1', label: 'Sheet · A1' }],
      activeId: 'sheet:a1',
    });
  });

  it('pruneTabsAgainstElements is a no-op when nothing changes', () => {
    const state: TabsState = {
      tabs: [{ id: 'plan:l0', kind: 'plan', targetId: 'l0', label: 'L0' }],
      activeId: 'plan:l0',
    };
    const pruned = pruneTabsAgainstElements(state, { l0: {} });
    expect(pruned).toBe(state);
  });
});
