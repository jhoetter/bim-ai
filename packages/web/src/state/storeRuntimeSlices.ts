import type { StateCreator } from 'zustand';

import type { LensMode, PerspectiveId, WorkspaceLayoutPreset } from '@bim-ai/core';

import type { PlanPresentationPreset } from '../plan/symbology';
import type { DisciplineWorkspaceId, StoreState } from './storeTypes';
import { emptyGroupRegistry } from '../groups/groupTypes';

type StoreSet = Parameters<StateCreator<StoreState>>[0];

export type CollaborationRuntimeSlice = Pick<
  StoreState,
  | 'userId'
  | 'userDisplayName'
  | 'peerId'
  | 'presencePeers'
  | 'comments'
  | 'activityEvents'
  | 'setPresencePeers'
  | 'setComments'
  | 'mergeComment'
  | 'setActivity'
  | 'setIdentity'
>;

export type PlanAuthoringRuntimeSlice = Pick<
  StoreState,
  | 'planTool'
  | 'wallLocationLine'
  | 'applyAreaRules'
  | 'floorBoundaryOffsetMm'
  | 'wallDrawOffsetMm'
  | 'wallDrawRadiusMm'
  | 'wallDrawHeightMm'
  | 'activeWallTypeId'
  | 'activeFloorTypeId'
  | 'orthoSnapHold'
  | 'buildingPreset'
  | 'planHudMm'
  | 'planPresentationPreset'
  | 'lensMode'
  | 'setViewerMode'
  | 'setPlanTool'
  | 'setActiveLevelId'
  | 'setWallLocationLine'
  | 'setApplyAreaRules'
  | 'setFloorBoundaryOffsetMm'
  | 'setWallDrawOffsetMm'
  | 'setWallDrawRadiusMm'
  | 'setWallDrawHeightMm'
  | 'setActiveWallTypeId'
  | 'setActiveFloorTypeId'
  | 'setOrthoSnapHold'
  | 'setBuildingPreset'
  | 'setPlanHud'
  | 'setPlanPresentationPreset'
  | 'setLensMode'
  | 'setPlanProjectionPrimitives'
  | 'setPlanRoomSchemeWireReadout'
  | 'setScheduleBudgetHydration'
>;

export type WorkspaceUiRuntimeSlice = Pick<
  StoreState,
  | 'workspaceLayoutPreset'
  | 'activeWorkspaceId'
  | 'perspectiveId'
  | 'roofJoinPreview'
  | 'thinLinesEnabled'
  | 'groupRegistry'
  | 'setWorkspaceLayoutPreset'
  | 'setActiveWorkspaceId'
  | 'setPerspectiveId'
  | 'setRoofJoinPreview'
  | 'toggleThinLines'
  | 'setGroupRegistry'
>;

function readSessionString(key: string, fallback: string): string {
  try {
    return sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStrings(entries: Array<[string, string]>): void {
  try {
    for (const [key, value] of entries) sessionStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function readLocalStorageChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw && allowed.includes(raw as T)) return raw as T;
  } catch {
    /* noop */
  }
  return fallback;
}

function readLocalStorageString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorageString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function newUserId(): string {
  try {
    const u = sessionStorage.getItem('bim.userId');
    if (u) return u;

    const nid = crypto.randomUUID();
    sessionStorage.setItem('bim.userId', nid);
    return nid;
  } catch {
    return `user-${Math.random().toString(36).slice(2)}`;
  }
}

export function createCollaborationRuntimeSlice(
  set: StoreSet,
  peerSeed: string,
): CollaborationRuntimeSlice {
  return {
    userId: newUserId(),
    userDisplayName: readSessionString('bim.displayName', 'Collaborator'),
    peerId: peerSeed,
    presencePeers: {},
    comments: [],
    activityEvents: [],

    setPresencePeers: (peers) => set({ presencePeers: peers }),
    setComments: (c) => set({ comments: c }),
    mergeComment: (c) =>
      set((state) => {
        const nx = [...state.comments.filter((x) => x.id !== c.id), c].sort((a, b) =>
          String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
        );
        return { comments: nx };
      }),
    setActivity: (e) => set({ activityEvents: e }),
    setIdentity: (userId, userDisplayName, peerId) => {
      writeSessionStrings([
        ['bim.userId', userId],
        ['bim.displayName', userDisplayName],
        ['bim.peerId', peerId],
      ]);
      set({ userId, userDisplayName, peerId });
    },
  };
}

export function createPlanAuthoringRuntimeSlice(set: StoreSet): PlanAuthoringRuntimeSlice {
  return {
    planTool: 'select',
    wallLocationLine: 'wall-centerline',
    applyAreaRules: true,
    floorBoundaryOffsetMm: 0,
    wallDrawOffsetMm: 0,
    wallDrawRadiusMm: null,
    wallDrawHeightMm: 2800,
    activeWallTypeId: null,
    activeFloorTypeId: null,
    orthoSnapHold: false,
    buildingPreset: readLocalStorageString('bim.buildingPreset', 'residential'),
    planHudMm: undefined,
    planPresentationPreset: readLocalStorageChoice<PlanPresentationPreset>(
      'bim.planPresentation',
      ['default', 'opening_focus', 'room_scheme'],
      'default',
    ),
    lensMode: 'architecture' as LensMode,

    setViewerMode: (m) => set({ viewerMode: m }),
    setPlanTool: (t) => set({ planTool: t }),
    setActiveLevelId: (id) => set({ activeLevelId: id }),
    setWallLocationLine: (wallLocationLine) => set({ wallLocationLine }),
    setApplyAreaRules: (v) => set({ applyAreaRules: v }),
    setFloorBoundaryOffsetMm: (floorBoundaryOffsetMm) => set({ floorBoundaryOffsetMm }),
    setWallDrawOffsetMm: (wallDrawOffsetMm) => set({ wallDrawOffsetMm }),
    setWallDrawRadiusMm: (wallDrawRadiusMm) => set({ wallDrawRadiusMm }),
    setWallDrawHeightMm: (wallDrawHeightMm) => set({ wallDrawHeightMm }),
    setActiveWallTypeId: (activeWallTypeId) => set({ activeWallTypeId }),
    setActiveFloorTypeId: (activeFloorTypeId) => set({ activeFloorTypeId }),
    setOrthoSnapHold: (v) => set({ orthoSnapHold: v }),
    setBuildingPreset: (preset) => {
      writeLocalStorageString('bim.buildingPreset', preset);
      set({ buildingPreset: preset });
    },
    setPlanHud: (mm) => set({ planHudMm: mm }),
    setPlanPresentationPreset: (planPresentationPreset) => {
      writeLocalStorageString('bim.planPresentation', planPresentationPreset);
      set({ planPresentationPreset });
    },
    setLensMode: (lensMode) => set({ lensMode }),
    setPlanProjectionPrimitives: (planProjectionPrimitives) =>
      planProjectionPrimitives === null
        ? set({ planProjectionPrimitives: null, planRoomSchemeWireReadout: null })
        : set({ planProjectionPrimitives }),
    setPlanRoomSchemeWireReadout: (planRoomSchemeWireReadout) => set({ planRoomSchemeWireReadout }),
    setScheduleBudgetHydration: (scheduleBudgetHydration) => set({ scheduleBudgetHydration }),
  };
}

export function createWorkspaceUiRuntimeSlice(set: StoreSet): WorkspaceUiRuntimeSlice {
  return {
    workspaceLayoutPreset: readLocalStorageChoice<WorkspaceLayoutPreset>(
      'bim.workspaceLayout',
      [
        'classic',
        'split_plan_3d',
        'split_plan_section',
        'coordination',
        'schedules_focus',
        'agent_review',
      ],
      'classic',
    ),
    perspectiveId: readLocalStorageChoice<PerspectiveId>(
      'bim.perspective',
      ['architecture', 'structure', 'mep', 'coordination', 'construction', 'agent'],
      'architecture',
    ),
    activeWorkspaceId: readLocalStorageChoice<DisciplineWorkspaceId>(
      'bim.activeWorkspace',
      ['arch', 'struct', 'mep'],
      'arch',
    ),
    roofJoinPreview: null,
    thinLinesEnabled: false,

    setWorkspaceLayoutPreset: (workspaceLayoutPreset) => {
      writeLocalStorageString('bim.workspaceLayout', workspaceLayoutPreset);
      set({ workspaceLayoutPreset });
    },
    setActiveWorkspaceId: (activeWorkspaceId) => {
      writeLocalStorageString('bim.activeWorkspace', activeWorkspaceId);
      set({ activeWorkspaceId });
    },
    setPerspectiveId: (perspectiveId) => {
      writeLocalStorageString('bim.perspective', perspectiveId);
      set({ perspectiveId });
    },
    setRoofJoinPreview: (roofJoinPreview) => set({ roofJoinPreview }),
    toggleThinLines: () => set((s) => ({ thinLinesEnabled: !s.thinLinesEnabled })),

    groupRegistry: emptyGroupRegistry(),
    setGroupRegistry: (groupRegistry) => set({ groupRegistry }),
  };
}
