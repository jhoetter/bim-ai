/**
 * View-tabs reducer — spec §11.3.
 *
 * Each tab is a pure descriptor of an open view: a `kind` (plan / 3d /
 * plan-3d / section / sheet / schedule / agent) optionally tied to a
 * specific element id (a level for plan, a viewpoint for 3d, a section
 * cut for section, a sheet for sheet, a schedule for schedule).
 *
 * The reducer is framework-free so it can be unit-tested without React.
 */

import type { Element } from '@bim-ai/core';

export type TabKind =
  | 'plan'
  | '3d'
  | 'plan-3d'
  | 'section'
  | 'sheet'
  | 'schedule'
  | 'agent'
  | 'concept';

/** Per-tab viewport state — restored when the tab is reactivated.
 * (T-07.) Plan tabs cache the 2D camera; 3D tabs cache the orbit pose.
 * Section / sheet / schedule tabs do not cache anything yet. */
export interface ViewportSnapshot {
  orbitCameraPoseMm?: {
    eyeMm?: { xMm: number; yMm: number; zMm: number };
    targetMm?: { xMm: number; yMm: number; zMm: number };
  };
  planCamera?: {
    centerMm?: { xMm: number; yMm: number };
    halfMm?: number;
  };
}

export interface ViewTab {
  /** Stable id. For target-bound tabs we use `${kind}:${targetId}` so
   * re-opening the same view activates the existing tab. For modes that
   * don't bind to a single element (e.g. agent review) we use a plain
   * kind id. */
  id: string;
  kind: TabKind;
  /** Element id this tab targets, when applicable. */
  targetId?: string;
  /** Display label — typically the element name with a kind prefix. */
  label: string;
  /** Cached camera/orbit state restored when the tab reactivates. */
  viewportState?: ViewportSnapshot;
}

export interface TabsState {
  tabs: ViewTab[];
  activeId: string | null;
}

export const EMPTY_TABS: TabsState = { tabs: [], activeId: null };

function tabIdFor(kind: TabKind, targetId: string | undefined): string {
  return targetId ? `${kind}:${targetId}` : kind;
}

/** Open a tab — if one already exists for the same kind+target, just
 * activate it. Otherwise append a new tab. */
export function openTab(state: TabsState, partial: Omit<ViewTab, 'id'>): TabsState {
  const id = tabIdFor(partial.kind, partial.targetId);
  const existing = state.tabs.find((t) => t.id === id);
  if (existing) return { ...state, activeId: id };
  const tab: ViewTab = { id, kind: partial.kind, targetId: partial.targetId, label: partial.label };
  return { tabs: [...state.tabs, tab], activeId: id };
}

/** Close a tab. If it was the active one, activate the previous tab in
 * the list (or null if none remain). */
export function closeTab(state: TabsState, id: string): TabsState {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return state;
  const next = state.tabs.filter((t) => t.id !== id);
  let nextActive = state.activeId;
  if (state.activeId === id) {
    if (next.length === 0) {
      nextActive = null;
    } else {
      // Activate the previous tab; if we closed the first, activate
      // the new first.
      const newIdx = Math.max(0, idx - 1);
      nextActive = next[newIdx]?.id ?? null;
    }
  }
  return { tabs: next, activeId: nextActive };
}

/** Keep only the active tab; close all others. */
export function closeInactiveTabs(state: TabsState): TabsState {
  if (!state.activeId) return state;
  const active = state.tabs.find((t) => t.id === state.activeId);
  if (!active) return state;
  return { tabs: [active], activeId: state.activeId };
}

/** Activate a tab by id. No-op if the id is unknown. */
export function activateTab(state: TabsState, id: string): TabsState {
  if (!state.tabs.some((t) => t.id === id)) return state;
  return { ...state, activeId: id };
}

/** Snapshot a tab's viewport state for later restore. (T-07.) Returns
 * the unchanged state if the id is unknown. */
export function snapshotViewport(
  state: TabsState,
  id: string,
  viewportState: ViewportSnapshot,
): TabsState {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return state;
  const next = [...state.tabs];
  const existing = next[idx];
  if (!existing) return state;
  next[idx] = { ...existing, viewportState };
  return { ...state, tabs: next };
}

/** Reorder a tab from one index to another. Out-of-range indices clamp.
 * `activeId` is preserved (the active tab keeps focus, just at a new
 * position in the list). */
export function reorderTab(state: TabsState, fromIdx: number, toIdx: number): TabsState {
  if (state.tabs.length === 0) return state;
  const len = state.tabs.length;
  const f = Math.max(0, Math.min(len - 1, fromIdx));
  const t = Math.max(0, Math.min(len - 1, toIdx));
  if (f === t) return state;
  const next = [...state.tabs];
  const [moved] = next.splice(f, 1);
  if (!moved) return state;
  next.splice(t, 0, moved);
  return { ...state, tabs: next };
}

/** Cycle the active tab forward or backward. Wraps around. */
export function cycleActive(state: TabsState, direction: 'forward' | 'backward'): TabsState {
  if (state.tabs.length === 0) return state;
  const idx = state.activeId ? state.tabs.findIndex((t) => t.id === state.activeId) : -1;
  const len = state.tabs.length;
  const delta = direction === 'forward' ? 1 : -1;
  const nextIdx = ((((idx >= 0 ? idx : 0) + delta) % len) + len) % len;
  return { ...state, activeId: state.tabs[nextIdx]?.id ?? null };
}

/** Activate the first tab of `kind`, or open one with the given fallback
 * target if none exists. */
export function activateOrOpenKind(
  state: TabsState,
  kind: TabKind,
  fallback: Omit<ViewTab, 'id' | 'kind'>,
): TabsState {
  const existing = state.tabs.find((t) => t.kind === kind);
  if (existing) return { ...state, activeId: existing.id };
  return openTab(state, { kind, ...fallback });
}

/** Build a tab descriptor from an Element row. Returns `null` for kinds
 * that aren't directly viewable (walls, doors etc. — those are inspected
 * via the right rail, not opened as tabs). */
export function tabFromElement(el: Element): Omit<ViewTab, 'id'> | null {
  if (el.kind === 'level') {
    return { kind: 'plan', targetId: el.id, label: `Level plan · ${el.name}` };
  }
  if (el.kind === 'plan_view') {
    return { kind: 'plan', targetId: el.id, label: `Plan view · ${el.name}` };
  }
  if (el.kind === 'viewpoint') {
    return { kind: '3d', targetId: el.id, label: `3D · ${el.name}` };
  }
  if (el.kind === 'section_cut') {
    return { kind: 'section', targetId: el.id, label: `Section · ${el.name}` };
  }
  if (el.kind === 'sheet') {
    return { kind: 'sheet', targetId: el.id, label: `Sheet · ${el.name}` };
  }
  if (el.kind === 'schedule') {
    return { kind: 'schedule', targetId: el.id, label: `Schedule · ${el.name}` };
  }
  return null;
}

export const TAB_KIND_LABEL: Record<TabKind, string> = {
  plan: 'Plan',
  '3d': '3D',
  'plan-3d': 'Plan + 3D',
  section: 'Section',
  sheet: 'Sheet',
  schedule: 'Schedule',
  agent: 'Agent',
  concept: 'Concept',
};
