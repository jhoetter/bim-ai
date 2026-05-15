export type PaneSplitAxis = 'horizontal' | 'vertical';
export type PaneSplitDirection = 'left' | 'right' | 'top' | 'bottom';

export type PaneNode =
  | {
      kind: 'leaf';
      id: string;
      tabId: string | null;
    }
  | {
      kind: 'split';
      id: string;
      axis: PaneSplitAxis;
      first: PaneNode;
      second: PaneNode;
    };

export interface PaneLayoutState {
  root: PaneNode;
  focusedLeafId: string;
}

const STORAGE_KEY = 'bim-ai:pane-layout-v1';

type PersistedPaneLayoutV1 = {
  v: 1;
  layout: PaneLayoutState;
};

function nextPaneId(): string {
  try {
    return `pane-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

export function createPaneLayout(activeTabId: string | null): PaneLayoutState {
  const leafId = nextPaneId();
  return {
    root: { kind: 'leaf', id: leafId, tabId: activeTabId },
    focusedLeafId: leafId,
  };
}

export function splitPaneWithTab(
  state: PaneLayoutState,
  leafId: string,
  direction: PaneSplitDirection,
  incomingTabId: string | null,
): PaneLayoutState {
  const target = findLeaf(state.root, leafId);
  if (!target) return state;
  if (target.tabId === incomingTabId) return state;
  const existingTabId = target.tabId;
  const existingLeaf: PaneNode = { kind: 'leaf', id: nextPaneId(), tabId: existingTabId };
  const incomingLeaf: PaneNode = { kind: 'leaf', id: nextPaneId(), tabId: incomingTabId };
  const axis: PaneSplitAxis =
    direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
  const incomingFirst = direction === 'left' || direction === 'top';
  const replacement: PaneNode = {
    kind: 'split',
    id: nextPaneId(),
    axis,
    first: incomingFirst ? incomingLeaf : existingLeaf,
    second: incomingFirst ? existingLeaf : incomingLeaf,
  };
  const root = replaceLeaf(state.root, leafId, replacement);
  return {
    root,
    focusedLeafId: incomingLeaf.id,
  };
}

export function focusPane(state: PaneLayoutState, leafId: string): PaneLayoutState {
  return findLeaf(state.root, leafId) ? { ...state, focusedLeafId: leafId } : state;
}

export function assignTabToFocusedPane(
  state: PaneLayoutState,
  tabId: string | null,
): PaneLayoutState {
  return assignTabToPane(state, state.focusedLeafId, tabId);
}

export function assignTabToPane(
  state: PaneLayoutState,
  leafId: string,
  tabId: string | null,
): PaneLayoutState {
  if (!findLeaf(state.root, leafId)) return state;
  return {
    ...state,
    root: mapLeaves(state.root, (leaf) => (leaf.id === leafId ? { ...leaf, tabId } : leaf)),
  };
}

export function removePaneLeaf(state: PaneLayoutState, leafId: string): PaneLayoutState {
  if (!findLeaf(state.root, leafId)) return state;
  const root = removeLeaf(state.root, leafId) ?? { kind: 'leaf', id: leafId, tabId: null };
  const focusedLeafId = findLeaf(root, state.focusedLeafId)?.id ?? firstLeafId(root) ?? leafId;
  return {
    root,
    focusedLeafId,
  };
}

export function findPaneForTab(root: PaneNode, tabId: string): string | null {
  if (root.kind === 'leaf') {
    return root.tabId === tabId ? root.id : null;
  }
  return findPaneForTab(root.first, tabId) ?? findPaneForTab(root.second, tabId);
}

export function normalizePaneLayout(
  state: PaneLayoutState,
  openTabIds: readonly string[],
  activeTabId: string | null,
): PaneLayoutState {
  const open = new Set(openTabIds);
  let root = mapLeaves(state.root, (leaf) =>
    leaf.tabId && open.has(leaf.tabId) ? leaf : { ...leaf, tabId: null },
  );

  if (!hasTab(root) && activeTabId && open.has(activeTabId)) {
    root = assignFirstLeafTab(root, activeTabId);
  }

  root = collapseEmptyBranches(root);
  const focusedExists = findLeaf(root, state.focusedLeafId);
  const fallbackFocused = focusedExists?.id ?? firstLeafId(root) ?? state.focusedLeafId;
  return { root, focusedLeafId: fallbackFocused };
}

export function leafCount(root: PaneNode): number {
  if (root.kind === 'leaf') return 1;
  return leafCount(root.first) + leafCount(root.second);
}

export function readPersistedPaneLayout(): PaneLayoutState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPaneLayoutV1> | null;
    if (!parsed || parsed.v !== 1 || !parsed.layout) return null;
    return parsed.layout;
  } catch {
    return null;
  }
}

export function persistPaneLayout(state: PaneLayoutState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: PersistedPaneLayoutV1 = { v: 1, layout: state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

export function clearPersistedPaneLayout(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function findLeaf(root: PaneNode, id: string): { id: string; tabId: string | null } | null {
  if (root.kind === 'leaf') return root.id === id ? root : null;
  return findLeaf(root.first, id) ?? findLeaf(root.second, id);
}

function mapLeaves(
  root: PaneNode,
  map: (leaf: Extract<PaneNode, { kind: 'leaf' }>) => PaneNode,
): PaneNode {
  if (root.kind === 'leaf') return map(root);
  return {
    ...root,
    first: mapLeaves(root.first, map),
    second: mapLeaves(root.second, map),
  };
}

function replaceLeaf(root: PaneNode, leafId: string, replacement: PaneNode): PaneNode {
  if (root.kind === 'leaf') {
    return root.id === leafId ? replacement : root;
  }
  return {
    ...root,
    first: replaceLeaf(root.first, leafId, replacement),
    second: replaceLeaf(root.second, leafId, replacement),
  };
}

function removeLeaf(root: PaneNode, leafId: string): PaneNode | null {
  if (root.kind === 'leaf') {
    return root.id === leafId ? null : root;
  }
  const first = removeLeaf(root.first, leafId);
  const second = removeLeaf(root.second, leafId);
  if (!first) return second;
  if (!second) return first;
  return { ...root, first, second };
}

function collapseEmptyBranches(root: PaneNode): PaneNode {
  if (root.kind === 'leaf') return root;
  const first = collapseEmptyBranches(root.first);
  const second = collapseEmptyBranches(root.second);
  if (first.kind === 'leaf' && !first.tabId) return second;
  if (second.kind === 'leaf' && !second.tabId) return first;
  return { ...root, first, second };
}

function hasTab(root: PaneNode): boolean {
  if (root.kind === 'leaf') return Boolean(root.tabId);
  return hasTab(root.first) || hasTab(root.second);
}

function assignFirstLeafTab(root: PaneNode, tabId: string): PaneNode {
  if (root.kind === 'leaf') return { ...root, tabId };
  return {
    ...root,
    first: assignFirstLeafTab(root.first, tabId),
  };
}

function firstLeafId(root: PaneNode): string | null {
  if (root.kind === 'leaf') return root.id;
  return firstLeafId(root.first) ?? firstLeafId(root.second);
}
