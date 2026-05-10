import type { StateCreator } from 'zustand';

import type { PlanPresentationPreset } from '../plan/symbology';
import type { CategoryOverrides, StoreState, ViewFilter } from './storeTypes';

type StoreSet = Parameters<StateCreator<StoreState>>[0];
type StoreGet = Parameters<StateCreator<StoreState>>[1];

export type ViewportRuntimeSlice = Pick<
  StoreState,
  | 'viewerMode'
  | 'viewerClipElevMm'
  | 'viewerClipFloorElevMm'
  | 'viewerCategoryHidden'
  | 'viewerPhaseFilter'
  | 'orbitCameraNonce'
  | 'orbitCameraPoseMm'
  | 'activePlanViewId'
  | 'activeViewpointId'
  | 'activeElevationViewId'
  | 'activatePlanView'
  | 'setActiveViewpointId'
  | 'activateElevationView'
  | 'setViewerClipElevMm'
  | 'setViewerClipFloorElevMm'
  | 'toggleViewerCategoryHidden'
  | 'applyOrbitViewpointPreset'
  | 'setOrbitCameraFromViewpointMm'
  | 'viewerRenderStyle'
  | 'setViewerRenderStyle'
  | 'viewerBackground'
  | 'viewerEdges'
  | 'viewerShadowsEnabled'
  | 'viewerAmbientOcclusionEnabled'
  | 'viewerDepthCueEnabled'
  | 'viewerSilhouetteEdgeWidth'
  | 'viewerPhotographicExposureEv'
  | 'viewerProjection'
  | 'viewerSectionBoxActive'
  | 'viewerWalkModeActive'
  | 'viewerCameraAction'
  | 'setViewerBackground'
  | 'setViewerEdges'
  | 'setViewerProjection'
  | 'setViewerSectionBoxActive'
  | 'setViewerWalkModeActive'
  | 'requestViewerCameraAction'
  | 'revealHiddenMode'
  | 'setRevealHiddenMode'
  | 'showNeighborhoodMasses'
  | 'toggleNeighborhoodMasses'
  | 'vvDialogOpen'
  | 'openVVDialog'
  | 'closeVVDialog'
  | 'setCategoryOverride'
  | 'addViewFilter'
  | 'updateViewFilter'
  | 'removeViewFilter'
  | 'temporaryVisibility'
  | 'setTemporaryVisibility'
  | 'clearTemporaryVisibility'
  | 'setViewerPhaseFilter'
  | 'clearViewerPhaseFilter'
>;

function writeLocalStorageString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

export function createViewportRuntimeSlice(set: StoreSet, get: StoreGet): ViewportRuntimeSlice {
  return {
    viewerMode: 'orbit_3d',
    viewerClipElevMm: null,
    viewerClipFloorElevMm: null,
    viewerCategoryHidden: { site_origin: true },
    viewerPhaseFilter: null,
    orbitCameraNonce: 0,
    orbitCameraPoseMm: null,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    activeElevationViewId: undefined,

    activatePlanView: (planViewElementId) => {
      if (!planViewElementId) {
        set({ activePlanViewId: undefined, temporaryVisibility: null });
        return;
      }
      const el = get().elementsById[planViewElementId];
      if (!el || el.kind !== 'plan_view') return;
      const preset = el.planPresentation ?? 'default';
      const normalized: PlanPresentationPreset =
        preset === 'opening_focus' || preset === 'room_scheme' ? preset : 'default';
      writeLocalStorageString('bim.planPresentation', normalized);
      const prior = get().temporaryVisibility;
      const nextTemp = prior && prior.viewId === planViewElementId ? prior : null;
      set({
        activePlanViewId: planViewElementId,
        activeViewpointId: undefined,
        activeLevelId: el.levelId,
        planPresentationPreset: normalized,
        viewerMode: 'plan_canvas',
        temporaryVisibility: nextTemp,
      });
    },

    setActiveViewpointId: (viewpointElementId) => {
      const prior = get().temporaryVisibility;
      const nextTemp = prior && prior.viewId === viewpointElementId ? prior : null;
      set({ activeViewpointId: viewpointElementId, temporaryVisibility: nextTemp });
    },

    activateElevationView: (elevationViewElementId) => {
      if (!elevationViewElementId) {
        set({ activeElevationViewId: undefined, temporaryVisibility: null });
        return;
      }
      const el = get().elementsById[elevationViewElementId];
      if (!el || el.kind !== 'elevation_view') return;
      const prior = get().temporaryVisibility;
      const nextTemp = prior && prior.viewId === elevationViewElementId ? prior : null;
      set({
        activeElevationViewId: elevationViewElementId,
        activePlanViewId: undefined,
        activeViewpointId: undefined,
        viewerMode: 'plan_canvas',
        temporaryVisibility: nextTemp,
      });
    },

    setViewerClipElevMm: (viewerClipElevMm) => set({ viewerClipElevMm }),
    setViewerClipFloorElevMm: (viewerClipFloorElevMm) => set({ viewerClipFloorElevMm }),

    toggleViewerCategoryHidden: (semanticKind) =>
      set((state) => {
        const prior = state.viewerCategoryHidden[semanticKind];
        const next = { ...state.viewerCategoryHidden, [semanticKind]: !prior };
        return { viewerCategoryHidden: next };
      }),

    applyOrbitViewpointPreset: (opts) =>
      set((state) => {
        const layerKeys = ['wall', 'floor', 'roof', 'stair', 'door', 'window', 'room'] as const;
        let viewerClipElevMm = state.viewerClipElevMm;
        if ('capElevMm' in opts) {
          const v = opts.capElevMm;
          viewerClipElevMm =
            v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v) ? v : null;
        }
        let viewerClipFloorElevMm = state.viewerClipFloorElevMm;
        if ('floorElevMm' in opts) {
          const v = opts.floorElevMm;
          viewerClipFloorElevMm =
            v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v) ? v : null;
        }
        let viewerCategoryHidden = state.viewerCategoryHidden;
        if (opts.hideSemanticKinds !== undefined) {
          const hidden = new Set(opts.hideSemanticKinds);
          viewerCategoryHidden = { ...state.viewerCategoryHidden };
          for (const layerKey of layerKeys) {
            viewerCategoryHidden[layerKey] = hidden.has(layerKey);
          }
        }
        return {
          viewerClipElevMm,
          viewerClipFloorElevMm,
          viewerCategoryHidden,
        };
      }),

    setOrbitCameraFromViewpointMm: ({ position, target, up }) =>
      set((state) => ({
        orbitCameraPoseMm: { position, target, up },
        orbitCameraNonce: state.orbitCameraNonce + 1,
      })),

    viewerRenderStyle: 'shaded',
    setViewerRenderStyle: (style) => set({ viewerRenderStyle: style }),
    viewerBackground: 'light_grey',
    viewerEdges: 'normal',
    viewerProjection: 'perspective',
    viewerSectionBoxActive: false,
    viewerWalkModeActive: false,
    viewerCameraAction: null,
    setViewerBackground: (bg) => set({ viewerBackground: bg }),
    setViewerEdges: (edges) => set({ viewerEdges: edges }),
    setViewerProjection: (projection) => set({ viewerProjection: projection }),
    setViewerSectionBoxActive: (active) => set({ viewerSectionBoxActive: active }),
    setViewerWalkModeActive: (active) => set({ viewerWalkModeActive: active }),
    requestViewerCameraAction: (kind) =>
      set((state) => ({
        viewerCameraAction: {
          kind,
          nonce: (state.viewerCameraAction?.nonce ?? 0) + 1,
        },
      })),
    revealHiddenMode: false,
    setRevealHiddenMode: (v) => set({ revealHiddenMode: v }),
    showNeighborhoodMasses: true,
    toggleNeighborhoodMasses: () =>
      set((state) => ({ showNeighborhoodMasses: !state.showNeighborhoodMasses })),
    vvDialogOpen: false,
    openVVDialog: () => set({ vvDialogOpen: true }),
    closeVVDialog: () => set({ vvDialogOpen: false }),

    setCategoryOverride: (planViewId, categoryKey, override) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevOverrides = (pv.categoryOverrides as CategoryOverrides) ?? {};
      const newOverrides = { ...prevOverrides, [categoryKey]: override };
      set({
        elementsById: {
          ...elementsById,
          [planViewId]: { ...pv, categoryOverrides: newOverrides },
        },
      });
    },
    addViewFilter: (planViewId, filter) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevFilters = (pv.viewFilters as ViewFilter[] | undefined) ?? [];
      const updated = [...prevFilters, filter];
      set({ elementsById: { ...elementsById, [planViewId]: { ...pv, viewFilters: updated } } });
    },
    updateViewFilter: (planViewId, filterId, patch) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevFilters = (pv.viewFilters as ViewFilter[] | undefined) ?? [];
      const updated = prevFilters.map((f) => (f.id === filterId ? { ...f, ...patch } : f));
      set({ elementsById: { ...elementsById, [planViewId]: { ...pv, viewFilters: updated } } });
    },
    removeViewFilter: (planViewId, filterId) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevFilters = (pv.viewFilters as ViewFilter[] | undefined) ?? [];
      const updated = prevFilters.filter((f) => f.id !== filterId);
      set({ elementsById: { ...elementsById, [planViewId]: { ...pv, viewFilters: updated } } });
    },

    temporaryVisibility: null,
    setTemporaryVisibility: (next) => set({ temporaryVisibility: next }),
    clearTemporaryVisibility: () => set({ temporaryVisibility: null }),
    setViewerPhaseFilter: (next) => set({ viewerPhaseFilter: next }),
    clearViewerPhaseFilter: () => set({ viewerPhaseFilter: null }),
  };
}
