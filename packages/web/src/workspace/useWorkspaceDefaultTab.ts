import { useEffect, useRef } from 'react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import type { ViewerMode } from '../state/storeTypes';
import { openTab, type ViewTab, type TabsState } from './tabsModel';
import { pruneTabsAgainstElements } from './tabsPersistence';
import type { WorkspaceMode } from './shell';

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export interface WorkspaceDefaultTabOptions {
  modelId: string | undefined;
  elementsById: Record<string, Element>;
  activeLevelId: string | undefined;
  setTabsState: Setter<TabsState>;
  setMode: Setter<WorkspaceMode>;
  setViewerMode: (mode: ViewerMode) => void;
  activatePlanView: (id: string | undefined) => void;
  setActiveLevelId: (id: string) => void;
  setOrbitCameraFromViewpointMm: (input: {
    position: { xMm: number; yMm: number; zMm: number };
    target: { xMm: number; yMm: number; zMm: number };
    up: { xMm: number; yMm: number; zMm: number };
  }) => void;
}

/** Issue #132 — read once per render; helper exported for unit tests. */
export function readCaptureModeFromUrl(search?: string): boolean {
  if (typeof search === 'string') {
    return new URLSearchParams(search).get('captureMode') === '1';
  }
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('captureMode') === '1';
}

/**
 * After a model has hydrated, prune any restored tabs whose targets no
 * longer exist (e.g. a sheet deleted between sessions). If the pruned set
 * is empty, open a sensible default view for this model. Keyed by model
 * id, not app lifetime, because local seed workflows often switch
 * between disposable evidence models and the final seed model in one
 * browser session.
 *
 * Issue #132 — MF-render-12: when the URL contains `?captureMode=1` (set
 * by `packages/web/scripts/view-capture-run.mjs`), force a 3D tab as the
 * default and ignore any persisted tabs. Without this, MCP-authored
 * models (which have no `viewpoint` element) fall through to a plan tab,
 * the CanvasMount renders `<PlanCanvas/>` regardless of `viewerMode`, and
 * every ortho capture is a screenshot of the 2D plan UI rather than a
 * 3D render — 7-of-8 byte-identical, none usable for grading.
 */
export function useWorkspaceDefaultTab(options: WorkspaceDefaultTabOptions): void {
  const {
    modelId,
    elementsById,
    activeLevelId,
    setTabsState,
    setMode,
    setViewerMode,
    activatePlanView,
    setActiveLevelId,
    setOrbitCameraFromViewpointMm,
  } = options;

  const defaultOpenedModelIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!modelId || modelId === 'empty') {
      defaultOpenedModelIdRef.current = null;
      return;
    }
    if (defaultOpenedModelIdRef.current === modelId) return;
    const elements = Object.values(elementsById) as Element[];
    if (elements.length === 0) return;
    defaultOpenedModelIdRef.current = modelId;
    const captureMode = readCaptureModeFromUrl();
    const preferredViewpoint =
      elements.find((e): e is Extract<Element, { kind: 'viewpoint' }> => {
        if (e.kind !== 'viewpoint') return false;
        const id = e.id.toLowerCase();
        const name = String(e.name ?? '').toLowerCase();
        return id === 'main_front_left' || name.includes('main front') || name.includes('front');
      }) ??
      elements.find((e): e is Extract<Element, { kind: 'viewpoint' }> => e.kind === 'viewpoint');
    const preferredPlanView = elements.find(
      (e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view',
    );
    const levels = elements
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const targetLevel =
      levels.find((level) => level.id === activeLevelId) ?? levels[0] ?? undefined;
    // Issue #132 — capture-views: force 3D tab regardless of which view
    // elements exist in the model. The capture runner sets cardinal
    // cameras + style via __bimStore after this tab opens; the tab kind
    // must be '3d' so CanvasMount renders <Viewport/>, not <PlanCanvas/>.
    const defaultTab: Omit<ViewTab, 'id'> | null = captureMode
      ? preferredViewpoint
        ? { kind: '3d', targetId: preferredViewpoint.id, label: `3D · ${preferredViewpoint.name}` }
        : { kind: '3d', label: '3D · Capture' }
      : preferredViewpoint
        ? { kind: '3d', targetId: preferredViewpoint.id, label: `3D · ${preferredViewpoint.name}` }
        : preferredPlanView
          ? {
              kind: 'plan',
              targetId: preferredPlanView.id,
              label: `Plan view · ${preferredPlanView.name}`,
            }
          : targetLevel
            ? { kind: 'plan', targetId: targetLevel.id, label: `Plan · ${targetLevel.name}` }
            : null;
    if (!defaultTab) return;
    setTabsState((s) => {
      const pruned = pruneTabsAgainstElements(s, elementsById);
      // In captureMode, ignore any persisted tabs (Playwright always
      // starts with a fresh context so this is normally a no-op, but
      // guards against an unwanted plan tab leaking in).
      if (!captureMode && pruned.tabs.length > 0) return pruned;
      return openTab(captureMode ? { tabs: [], activeId: null } : pruned, defaultTab);
    });
    if (defaultTab.kind === '3d') {
      setMode('3d' as WorkspaceMode);
      setViewerMode('orbit_3d');
      if (preferredViewpoint?.mode === 'orbit_3d' && preferredViewpoint.camera) {
        setOrbitCameraFromViewpointMm({
          position: preferredViewpoint.camera.position,
          target: preferredViewpoint.camera.target,
          up: preferredViewpoint.camera.up,
        });
        useBimStore.getState().setActiveViewpointId(preferredViewpoint.id);
      }
    } else if (defaultTab.kind === 'plan') {
      setMode('plan' as WorkspaceMode);
      setViewerMode('plan_canvas');
      if (preferredPlanView) {
        activatePlanView(preferredPlanView.id);
      } else if (targetLevel) {
        activatePlanView(undefined);
        setActiveLevelId(targetLevel.id);
      }
    }
  }, [
    activatePlanView,
    activeLevelId,
    elementsById,
    modelId,
    setActiveLevelId,
    setMode,
    setOrbitCameraFromViewpointMm,
    setTabsState,
    setViewerMode,
  ]);
}
