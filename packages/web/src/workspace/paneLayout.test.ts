import { describe, expect, it } from 'vitest';

import {
  assignTabToFocusedPane,
  clearPersistedPaneLayout,
  createPaneLayout,
  findPaneForTab,
  leafCount,
  normalizePaneLayout,
  persistPaneLayout,
  readPersistedPaneLayout,
  splitPaneWithTab,
} from './paneLayout';

describe('paneLayout', () => {
  it('creates a root leaf with the active tab id', () => {
    const layout = createPaneLayout('tab-a');
    expect(layout.root.kind).toBe('leaf');
    if (layout.root.kind === 'leaf') {
      expect(layout.root.tabId).toBe('tab-a');
    }
  });

  it('splits recursively and focuses the incoming pane', () => {
    const base = createPaneLayout('tab-a');
    const rightSplit = splitPaneWithTab(base, base.focusedLeafId, 'right', 'tab-b');
    expect(leafCount(rightSplit.root)).toBe(2);
    const focusedAfterFirst = rightSplit.focusedLeafId;
    const nested = splitPaneWithTab(rightSplit, focusedAfterFirst, 'bottom', 'tab-c');
    expect(leafCount(nested.root)).toBe(3);
    expect(findPaneForTab(nested.root, 'tab-c')).toBe(nested.focusedLeafId);
  });

  it('assigns active tab to the focused pane', () => {
    const base = createPaneLayout('tab-a');
    const split = splitPaneWithTab(base, base.focusedLeafId, 'left', 'tab-b');
    const reassigned = assignTabToFocusedPane(split, 'tab-c');
    expect(findPaneForTab(reassigned.root, 'tab-c')).toBe(reassigned.focusedLeafId);
  });

  it('normalizes closed tabs and collapses empty splits', () => {
    const base = createPaneLayout('tab-a');
    const split = splitPaneWithTab(base, base.focusedLeafId, 'right', 'tab-b');
    const normalized = normalizePaneLayout(split, ['tab-a'], 'tab-a');
    expect(leafCount(normalized.root)).toBe(1);
    expect(findPaneForTab(normalized.root, 'tab-a')).toBe(normalized.focusedLeafId);
  });

  it('persists and restores pane layout state', () => {
    clearPersistedPaneLayout();
    const layout = createPaneLayout('tab-a');
    persistPaneLayout(layout);
    expect(readPersistedPaneLayout()).toEqual(layout);
    clearPersistedPaneLayout();
    expect(readPersistedPaneLayout()).toBeNull();
  });
});
