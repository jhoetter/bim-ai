import { describe, expect, it } from 'vitest';

import {
  assignTabToPane,
  assignTabToFocusedPane,
  clearPersistedPaneLayout,
  createPaneLayout,
  findPaneForTab,
  leafCount,
  normalizePaneLayout,
  persistPaneLayout,
  readPersistedPaneLayout,
  removePaneLeaf,
  splitPaneWithTab,
  type PaneLayoutState,
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

  it('assigns a tab to a specific pane leaf', () => {
    const base = createPaneLayout('tab-a');
    const split = splitPaneWithTab(base, base.focusedLeafId, 'right', 'tab-b');
    if (split.root.kind !== 'split' || split.root.first.kind !== 'leaf') {
      throw new Error('expected split with first leaf');
    }
    const firstLeafId = split.root.first.id;
    const reassigned = assignTabToPane(split, firstLeafId, 'tab-z');
    expect(findPaneForTab(reassigned.root, 'tab-z')).toBe(firstLeafId);
  });

  it('normalizes closed tabs and collapses stale empty split panes', () => {
    const base = createPaneLayout('tab-a');
    const split = splitPaneWithTab(base, base.focusedLeafId, 'right', 'tab-b');
    const normalized = normalizePaneLayout(split, ['tab-a'], 'tab-a');
    expect(leafCount(normalized.root)).toBe(1);
    expect(findPaneForTab(normalized.root, 'tab-a')).toBeTruthy();
    expect(findPaneForTab(normalized.root, 'tab-b')).toBeNull();
  });

  it('normalizes an all-empty split layout back to a single empty pane', () => {
    const base = createPaneLayout('tab-a');
    const split = splitPaneWithTab(base, base.focusedLeafId, 'right', 'tab-b');
    const normalized = normalizePaneLayout(split, [], null);
    expect(leafCount(normalized.root)).toBe(1);
    expect(normalized.root.kind).toBe('leaf');
    if (normalized.root.kind === 'leaf') {
      expect(normalized.root.tabId).toBeNull();
    }
  });

  it('removes a pane leaf and collapses its parent split', () => {
    const base = createPaneLayout('tab-a');
    const split = splitPaneWithTab(base, base.focusedLeafId, 'right', 'tab-b');
    const removed = removePaneLeaf(split, split.focusedLeafId);
    expect(leafCount(removed.root)).toBe(1);
    expect(findPaneForTab(removed.root, 'tab-a')).toBe(removed.focusedLeafId);
  });

  it('removes nested pane leaves recursively without leaving empty ancestors', () => {
    const nested: PaneLayoutState = {
      focusedLeafId: 'pane-b',
      root: {
        kind: 'split',
        id: 'root',
        axis: 'horizontal',
        first: { kind: 'leaf', id: 'pane-a', tabId: 'tab-a' },
        second: {
          kind: 'split',
          id: 'nested',
          axis: 'vertical',
          first: { kind: 'leaf', id: 'pane-b', tabId: 'tab-b' },
          second: { kind: 'leaf', id: 'pane-c', tabId: 'tab-c' },
        },
      },
    };

    const removedNestedLeaf = removePaneLeaf(nested, 'pane-b');
    expect(leafCount(removedNestedLeaf.root)).toBe(2);
    expect(findPaneForTab(removedNestedLeaf.root, 'tab-a')).toBe('pane-a');
    expect(findPaneForTab(removedNestedLeaf.root, 'tab-c')).toBe('pane-c');
    expect(findPaneForTab(removedNestedLeaf.root, 'tab-b')).toBeNull();

    const removedLastNestedSibling = removePaneLeaf(removedNestedLeaf, 'pane-c');
    expect(leafCount(removedLastNestedSibling.root)).toBe(1);
    expect(findPaneForTab(removedLastNestedSibling.root, 'tab-a')).toBe('pane-a');
  });

  it('normalizes nested stale panes down to the remaining open tab', () => {
    const nested: PaneLayoutState = {
      focusedLeafId: 'pane-b',
      root: {
        kind: 'split',
        id: 'root',
        axis: 'horizontal',
        first: { kind: 'leaf', id: 'pane-a', tabId: 'tab-a' },
        second: {
          kind: 'split',
          id: 'nested',
          axis: 'vertical',
          first: { kind: 'leaf', id: 'pane-b', tabId: 'tab-b' },
          second: { kind: 'leaf', id: 'pane-c', tabId: 'tab-c' },
        },
      },
    };

    const normalized = normalizePaneLayout(nested, ['tab-c'], 'tab-c');
    expect(leafCount(normalized.root)).toBe(1);
    expect(findPaneForTab(normalized.root, 'tab-c')).toBe('pane-c');
    expect(normalized.focusedLeafId).toBe('pane-c');
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
