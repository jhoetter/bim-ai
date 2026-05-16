import type { StateCreator } from 'zustand';

import type { Element, ModelDelta, Snapshot, Violation } from '@bim-ai/core';

import type { StoreState } from './storeTypes';

type StoreSet = Parameters<StateCreator<StoreState>>[0];
type StoreGet = Parameters<StateCreator<StoreState>>[1];

type ModelRuntimeHelpers = {
  coerceElement: (id: string, raw: Record<string, unknown>) => Element | null;
  coerceViolation: (value: unknown) => Violation;
  defaultLevelId: (elements: Record<string, Element>) => string | undefined;
};

export type ModelRuntimeSlice = Pick<
  StoreState,
  | 'revision'
  | 'elementsById'
  | 'violations'
  | 'selectedIds'
  | 'planProjectionPrimitives'
  | 'planRoomSchemeWireReadout'
  | 'scheduleBudgetHydration'
  | 'lastLevelElevationPropagationEvidence'
  | 'linkSourceRevisions'
  | 'hydrateFromSnapshot'
  | 'applyDelta'
  | 'select'
  | 'toggleSelectedId'
  | 'clearSelectedIds'
  | 'mergeElements'
  | 'importFamilyDefinitions'
>;

export function createModelRuntimeSlice(
  set: StoreSet,
  get: StoreGet,
  helpers: ModelRuntimeHelpers,
): ModelRuntimeSlice {
  const { coerceElement, coerceViolation, defaultLevelId } = helpers;

  return {
    revision: 0,
    elementsById: {},
    violations: [],
    selectedIds: [],
    planProjectionPrimitives: null,
    planRoomSchemeWireReadout: null,
    scheduleBudgetHydration: null,
    lastLevelElevationPropagationEvidence: null,
    linkSourceRevisions: {},

    hydrateFromSnapshot: (snap: Snapshot) => {
      const elements: Record<string, Element> = {};

      for (const [id, raw] of Object.entries(snap.elements ?? {})) {
        const typed = coerceElement(id, raw as Record<string, unknown>);
        if (typed) elements[id] = typed;
      }

      const curLevel = get().activeLevelId;
      const prevPv = get().activePlanViewId;
      const prevVp = get().activeViewpointId;

      set({
        modelId: snap.modelId,
        revision: snap.revision,
        elementsById: elements,
        violations: (snap.violations ?? []).map(coerceViolation),
        activeLevelId:
          curLevel && elements[curLevel]?.kind === 'level' ? curLevel : defaultLevelId(elements),
        planProjectionPrimitives: null,
        planRoomSchemeWireReadout: null,
        scheduleBudgetHydration: null,
        lastLevelElevationPropagationEvidence: null,
        linkSourceRevisions:
          snap.linkSourceRevisions && typeof snap.linkSourceRevisions === 'object'
            ? { ...snap.linkSourceRevisions }
            : {},
        activePlanViewId: prevPv && elements[prevPv]?.kind === 'plan_view' ? prevPv : undefined,
        activeViewpointId: prevVp && elements[prevVp]?.kind === 'viewpoint' ? prevVp : undefined,
      });
    },

    applyDelta: (d: ModelDelta) => {
      const merged = { ...get().elementsById };

      const dels = Array.isArray((d as { removedIds?: unknown }).removedIds)
        ? (d.removedIds as string[])
        : Array.isArray((d as { removed_ids?: unknown }).removed_ids)
          ? (d as unknown as { removed_ids: string[] }).removed_ids
          : [];

      for (const rid of dels) {
        delete merged[rid];
      }

      for (const [eid, raw] of Object.entries(d.elements ?? {})) {
        const typed = coerceElement(eid, raw as Record<string, unknown>);
        if (typed) merged[eid] = typed;
      }

      const st = get();
      const pv = st.activePlanViewId;
      const vp = st.activeViewpointId;

      set({
        revision: d.revision,
        elementsById: merged,
        violations: (d.violations ?? []).map(coerceViolation),
        planProjectionPrimitives: null,
        planRoomSchemeWireReadout: null,
        scheduleBudgetHydration: null,
        lastLevelElevationPropagationEvidence: null,
        activePlanViewId: pv && merged[pv]?.kind === 'plan_view' ? pv : undefined,
        activeViewpointId: vp && merged[vp]?.kind === 'viewpoint' ? vp : undefined,
      });
    },

    select: (id) => {
      if (id !== undefined) {
        const gid = get().groupEditModeDefinitionId;
        if (gid) {
          const def = get().groupRegistry?.definitions[gid];
          if (def && !def.elementIds.includes(id)) return;
        }
      }
      set({ selectedId: id, selectedIds: [] });
    },

    toggleSelectedId: (id) => {
      const gid = get().groupEditModeDefinitionId;
      if (gid) {
        const def = get().groupRegistry?.definitions[gid];
        if (def && !def.elementIds.includes(id)) return;
      }
      set((state) => {
        if (state.selectedId === id) {
          const [nextPrimary, ...rest] = state.selectedIds;
          return { selectedId: nextPrimary, selectedIds: rest };
        }
        if (state.selectedIds.includes(id)) {
          return { selectedIds: state.selectedIds.filter((x) => x !== id) };
        }
        if (!state.selectedId) {
          return { selectedId: id, selectedIds: [] };
        }
        return { selectedIds: [...state.selectedIds, id] };
      });
    },

    clearSelectedIds: () => set({ selectedIds: [] }),

    mergeElements: (elements) =>
      set((state) => {
        const next = { ...state.elementsById };
        for (const el of elements) {
          if (el && typeof (el as { id?: unknown }).id === 'string') {
            next[(el as { id: string }).id] = el as Element;
          }
        }
        return { elementsById: next };
      }),

    importFamilyDefinitions: (defs) =>
      set((state) => {
        const next = { ...(state.userFamilies ?? {}) };
        for (const def of defs) next[def.id] = def;
        return { userFamilies: next };
      }),
  };
}
