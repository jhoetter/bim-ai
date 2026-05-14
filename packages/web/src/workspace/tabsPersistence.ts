/**
 * View-tabs persistence — spec §11.3 follow-up (T-06).
 *
 * Serializes the open `TabsState` to `localStorage` so reloads keep
 * the user's open views. The hydration step drops tabs whose
 * `targetId` no longer resolves to an element in the store (the
 * underlying view was deleted between sessions).
 */

import type { TabKind, TabsState, ViewTab } from './tabsModel';

const STORAGE_KEY = 'bim-ai:tabs-v1';

/** Stable serialization shape — `tabs` array + `activeId`. Versioned so
 * a future schema bump can be detected and discarded. */
interface PersistedTabsV1 {
  v: 1;
  tabs: ViewTab[];
  activeId: string | null;
}

const TAB_KINDS: ReadonlySet<TabKind> = new Set(['plan', '3d', 'section', 'sheet', 'schedule']);

export function persistTabs(state: TabsState): void {
  if (typeof localStorage === 'undefined') return;
  const payload: PersistedTabsV1 = { v: 1, tabs: state.tabs, activeId: state.activeId };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage may be disabled (quota / private mode) — silent */
  }
}

export function readPersistedTabs(): TabsState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTabsV1> | null;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.tabs)) return null;
    const tabs = parsed.tabs.filter((t): t is ViewTab => isViewTab(t));
    const activeIdRaw = typeof parsed.activeId === 'string' ? parsed.activeId : null;
    const activeId = normalizeActiveId(activeIdRaw, tabs);
    return { tabs, activeId };
  } catch {
    return null;
  }
}

/** Drop tabs whose `targetId` no longer resolves to an element. Used
 * after the seed bootstrap completes — orphaned tabs (e.g. a sheet
 * deleted while the user was offline) get pruned silently. */
export function pruneTabsAgainstElements(
  state: TabsState,
  elementsById: Record<string, unknown>,
): TabsState {
  const survivors = state.tabs.filter(
    (t) => !t.targetId || Object.prototype.hasOwnProperty.call(elementsById, t.targetId),
  );
  if (survivors.length === state.tabs.length) return state;
  const activeStillThere = survivors.some((t) => t.id === state.activeId);
  return {
    tabs: survivors,
    activeId: activeStillThere ? state.activeId : (survivors[0]?.id ?? null),
  };
}

export function clearPersistedTabs(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function isViewTab(t: unknown): boolean {
  if (!t || typeof t !== 'object') return false;
  const r = t as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.kind === 'string' &&
    TAB_KINDS.has(r.kind as TabKind) &&
    typeof r.label === 'string'
  );
}

function normalizeActiveId(activeId: string | null, tabs: ViewTab[]): string | null {
  if (!activeId) return null;
  if (tabs.some((tab) => tab.id === activeId)) return activeId;
  return tabs[0]?.id ?? null;
}
