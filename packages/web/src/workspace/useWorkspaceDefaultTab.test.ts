/**
 * Issue #132 — MF-render-12: regression guard for the capture-views
 * default-tab behaviour.
 *
 * Before this fix, MCP-authored models (which contain levels + plan_views
 * but no `viewpoint` elements) caused `useWorkspaceDefaultTab` to open a
 * plan tab as the workspace default. The view-capture-run.mjs runner then
 * tried to drive the 3D camera via `setViewerMode('orbit_3d')` on the
 * store, but CanvasMount keys off the active tab's `kind` (not the
 * store's `viewerMode`) — so every cardinal capture was a screenshot of
 * the 2D plan canvas (7-of-8 byte-identical, none usable for grading).
 *
 * The fix: the capture runner sets `?captureMode=1` in the URL. When
 * that flag is present, the default-tab hook forces a `kind: '3d'` tab
 * regardless of which view elements live in the model.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { useWorkspaceDefaultTab } from './useWorkspaceDefaultTab';
import { EMPTY_TABS, type TabsState } from './tabsModel';
import { useBimStore } from '../state/store';

const MODEL_ID = 'capture-test-model';

// MCP-authored shape: level + plan_view, no viewpoint.
const ELEMENTS_NO_VIEWPOINT: Record<string, Element> = {
  'level-0': {
    kind: 'level',
    id: 'level-0',
    name: 'KG',
    elevationMm: 0,
    // additional fields omitted; the hook only reads kind + id + elevationMm + name.
  } as unknown as Element,
  'plan-view-0': {
    kind: 'plan_view',
    id: 'plan-view-0',
    name: 'KG — Plan',
    levelId: 'level-0',
  } as unknown as Element,
};

// Seeded shape: includes an orbit_3d viewpoint.
const ELEMENTS_WITH_VIEWPOINT: Record<string, Element> = {
  ...ELEMENTS_NO_VIEWPOINT,
  'vp-front': {
    kind: 'viewpoint',
    id: 'vp-front',
    name: 'Main Front Left',
    mode: 'orbit_3d',
    camera: {
      position: { xMm: 10000, yMm: -10000, zMm: 5000 },
      target: { xMm: 0, yMm: 0, zMm: 0 },
      up: { xMm: 0, yMm: 0, zMm: 1 },
    },
  } as unknown as Element,
};

function withUrl(search: string): () => void {
  const original = window.location.href;
  window.history.pushState({}, '', `/${search}`);
  return () => window.history.pushState({}, '', original);
}

interface HarnessResult {
  tabsState: TabsState;
  mode: string | null;
  viewerMode: string | null;
  activePlanViewId?: string;
  activeLevelId?: string;
}

function runHook(elementsById: Record<string, Element>): HarnessResult {
  const tabsRef: { current: TabsState } = { current: EMPTY_TABS };
  let modeRef: string | null = null;
  let viewerModeRef: string | null = null;
  let activePlanViewIdRef: string | undefined;
  let activeLevelIdRef: string | undefined;

  const setTabsState = (value: TabsState | ((prev: TabsState) => TabsState)): void => {
    tabsRef.current =
      typeof value === 'function'
        ? (value as (prev: TabsState) => TabsState)(tabsRef.current)
        : value;
  };
  const setMode = (value: string | null | ((prev: string | null) => string | null)): void => {
    modeRef =
      typeof value === 'function' ? (value as (p: string | null) => string | null)(modeRef) : value;
  };
  const setViewerMode = (m: string): void => {
    viewerModeRef = m;
  };
  const activatePlanView = (id: string | undefined): void => {
    activePlanViewIdRef = id;
  };
  const setActiveLevelId = (id: string): void => {
    activeLevelIdRef = id;
  };
  const setOrbitCameraFromViewpointMm = (): void => {
    /* no-op for this test */
  };

  renderHook(() =>
    useWorkspaceDefaultTab({
      modelId: MODEL_ID,
      elementsById,
      activeLevelId: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTabsState: setTabsState as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMode: setMode as any,
      setViewerMode,
      activatePlanView,
      setActiveLevelId,
      setOrbitCameraFromViewpointMm,
    }),
  );

  return {
    tabsState: tabsRef.current,
    mode: modeRef,
    viewerMode: viewerModeRef,
    activePlanViewId: activePlanViewIdRef,
    activeLevelId: activeLevelIdRef,
  };
}

describe('useWorkspaceDefaultTab — Issue #132 capture-mode override', () => {
  let restoreUrl: () => void;

  beforeEach(() => {
    // Reset the bim store so its `setActiveViewpointId` mutation in the
    // hook doesn't leak across tests.
    useBimStore.setState({ activeViewpointId: undefined });
  });

  afterEach(() => {
    restoreUrl?.();
  });

  it('without captureMode: MCP model (no viewpoint) opens a PLAN tab', () => {
    restoreUrl = withUrl(`?modelId=${MODEL_ID}`);
    const result = runHook(ELEMENTS_NO_VIEWPOINT);
    expect(result.tabsState.tabs).toHaveLength(1);
    expect(result.tabsState.tabs[0]?.kind).toBe('plan');
    expect(result.mode).toBe('plan');
    expect(result.viewerMode).toBe('plan_canvas');
  });

  it('with ?captureMode=1: MCP model (no viewpoint) opens a 3D tab', () => {
    restoreUrl = withUrl(`?modelId=${MODEL_ID}&captureMode=1`);
    const result = runHook(ELEMENTS_NO_VIEWPOINT);
    expect(result.tabsState.tabs).toHaveLength(1);
    expect(result.tabsState.tabs[0]?.kind).toBe('3d');
    expect(result.mode).toBe('3d');
    expect(result.viewerMode).toBe('orbit_3d');
    // No viewpoint element → tab is unbound, label is the synthesized one.
    expect(result.tabsState.tabs[0]?.targetId).toBeUndefined();
  });

  it('with ?captureMode=1 + viewpoint present: targets the viewpoint', () => {
    restoreUrl = withUrl(`?modelId=${MODEL_ID}&captureMode=1`);
    const result = runHook(ELEMENTS_WITH_VIEWPOINT);
    expect(result.tabsState.tabs).toHaveLength(1);
    expect(result.tabsState.tabs[0]?.kind).toBe('3d');
    expect(result.tabsState.tabs[0]?.targetId).toBe('vp-front');
    expect(result.mode).toBe('3d');
    expect(result.viewerMode).toBe('orbit_3d');
  });

  it('without captureMode: seeded model with viewpoint still opens 3D (unchanged path)', () => {
    restoreUrl = withUrl(`?modelId=${MODEL_ID}`);
    const result = runHook(ELEMENTS_WITH_VIEWPOINT);
    expect(result.tabsState.tabs).toHaveLength(1);
    expect(result.tabsState.tabs[0]?.kind).toBe('3d');
    expect(result.tabsState.tabs[0]?.targetId).toBe('vp-front');
    expect(result.viewerMode).toBe('orbit_3d');
  });
});
