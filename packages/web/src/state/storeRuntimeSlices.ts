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
  | 'activeToolPhase'
  | 'hoveredElementKind'
  | 'activePaintMaterialId'
  | 'wallLocationLine'
  | 'applyAreaRules'
  | 'floorBoundaryOffsetMm'
  | 'floorDrawOffsetMm'
  | 'wallDrawOffsetMm'
  | 'wallDrawRadiusMm'
  | 'wallDrawHeightMm'
  | 'beamSystemSpacingMm'
  | 'beamSystemDirectionDeg'
  | 'activeWallTypeId'
  | 'activeFloorTypeId'
  | 'columnAtGridsSelectedIds'
  | 'columnDrawHeightMm'
  | 'columnDrawWidthMm'
  | 'columnDrawDepthMm'
  | 'stairDrawBaseLevelId'
  | 'stairDrawTopLevelId'
  | 'stairDrawWidthMm'
  | 'stairDrawRunWidthMm'
  | 'roomDrawName'
  | 'roomDrawNumber'
  | 'roomDrawUpperLevelId'
  | 'orthoSnapHold'
  | 'buildingPreset'
  | 'planHudMm'
  | 'planPresentationPreset'
  | 'lensMode'
  | 'setViewerMode'
  | 'setPlanTool'
  | 'setActiveToolPhase'
  | 'setHoveredElementKind'
  | 'setActivePaintMaterialId'
  | 'setActiveLevelId'
  | 'setWallLocationLine'
  | 'setApplyAreaRules'
  | 'setFloorBoundaryOffsetMm'
  | 'setFloorDrawOffsetMm'
  | 'setWallDrawOffsetMm'
  | 'setWallDrawRadiusMm'
  | 'setWallDrawHeightMm'
  | 'setBeamSystemSpacingMm'
  | 'setBeamSystemDirectionDeg'
  | 'setActiveWallTypeId'
  | 'setActiveFloorTypeId'
  | 'setColumnAtGridsSelectedIds'
  | 'setColumnDrawHeightMm'
  | 'setColumnDrawWidthMm'
  | 'setColumnDrawDepthMm'
  | 'setStairDrawBaseLevelId'
  | 'setStairDrawTopLevelId'
  | 'setStairDrawWidthMm'
  | 'setStairDrawRunWidthMm'
  | 'setRoomDrawName'
  | 'setRoomDrawNumber'
  | 'setRoomDrawUpperLevelId'
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
  | 'groupEditModeDefinitionId'
  | 'setWorkspaceLayoutPreset'
  | 'setActiveWorkspaceId'
  | 'setPerspectiveId'
  | 'setRoofJoinPreview'
  | 'toggleThinLines'
  | 'setGroupRegistry'
  | 'setGroupEditModeDefinitionId'
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
    activeToolPhase: null,
    hoveredElementKind: null,
    activePaintMaterialId: null,
    wallLocationLine: 'wall-centerline',
    applyAreaRules: true,
    floorBoundaryOffsetMm: 0,
    floorDrawOffsetMm: 0,
    wallDrawOffsetMm: 0,
    wallDrawRadiusMm: null,
    wallDrawHeightMm: 2800,
    beamSystemSpacingMm: 1500,
    beamSystemDirectionDeg: 0,
    activeWallTypeId: null,
    activeFloorTypeId: null,
    columnAtGridsSelectedIds: [],
    columnDrawHeightMm: 3000,
    columnDrawWidthMm: 300,
    columnDrawDepthMm: 300,
    stairDrawBaseLevelId: null,
    stairDrawTopLevelId: null,
    stairDrawWidthMm: 1200,
    stairDrawRunWidthMm: 250,
    roomDrawName: 'Room',
    roomDrawNumber: '',
    roomDrawUpperLevelId: null,
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
    setActiveToolPhase: (activeToolPhase) => set({ activeToolPhase }),
    setHoveredElementKind: (hoveredElementKind) => set({ hoveredElementKind }),
    setActivePaintMaterialId: (activePaintMaterialId) => set({ activePaintMaterialId }),
    setActiveLevelId: (id) => set({ activeLevelId: id }),
    setWallLocationLine: (wallLocationLine) => set({ wallLocationLine }),
    setApplyAreaRules: (v) => set({ applyAreaRules: v }),
    setFloorBoundaryOffsetMm: (floorBoundaryOffsetMm) => set({ floorBoundaryOffsetMm }),
    setFloorDrawOffsetMm: (floorDrawOffsetMm) => set({ floorDrawOffsetMm }),
    setWallDrawOffsetMm: (wallDrawOffsetMm) => set({ wallDrawOffsetMm }),
    setWallDrawRadiusMm: (wallDrawRadiusMm) => set({ wallDrawRadiusMm }),
    setWallDrawHeightMm: (wallDrawHeightMm) => set({ wallDrawHeightMm }),
    setBeamSystemSpacingMm: (beamSystemSpacingMm) => set({ beamSystemSpacingMm }),
    setBeamSystemDirectionDeg: (beamSystemDirectionDeg) => set({ beamSystemDirectionDeg }),
    setActiveWallTypeId: (activeWallTypeId) => set({ activeWallTypeId }),
    setActiveFloorTypeId: (activeFloorTypeId) => set({ activeFloorTypeId }),
    setColumnAtGridsSelectedIds: (columnAtGridsSelectedIds) => set({ columnAtGridsSelectedIds }),
    setColumnDrawHeightMm: (columnDrawHeightMm) => set({ columnDrawHeightMm }),
    setColumnDrawWidthMm: (columnDrawWidthMm) => set({ columnDrawWidthMm }),
    setColumnDrawDepthMm: (columnDrawDepthMm) => set({ columnDrawDepthMm }),
    setStairDrawBaseLevelId: (stairDrawBaseLevelId) => set({ stairDrawBaseLevelId }),
    setStairDrawTopLevelId: (stairDrawTopLevelId) => set({ stairDrawTopLevelId }),
    setStairDrawWidthMm: (stairDrawWidthMm) => set({ stairDrawWidthMm }),
    setStairDrawRunWidthMm: (stairDrawRunWidthMm) => set({ stairDrawRunWidthMm }),
    setRoomDrawName: (roomDrawName) => set({ roomDrawName }),
    setRoomDrawNumber: (roomDrawNumber) => set({ roomDrawNumber }),
    setRoomDrawUpperLevelId: (roomDrawUpperLevelId) => set({ roomDrawUpperLevelId }),
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

    groupEditModeDefinitionId: null,
    setGroupEditModeDefinitionId: (id) => set({ groupEditModeDefinitionId: id }),
  };
}
