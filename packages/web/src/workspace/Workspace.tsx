import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import { WallHifi } from '@bim-ai/icons';
import { Icons } from '@bim-ai/ui';

import { log } from '../logger';
import { type PlanCameraHandle } from '../plan/PlanCanvas';
import {
  applyCommand,
  ApiHttpError,
  fetchActivity,
  fetchComments,
  postComment,
  patchCommentResolved,
  undoModel,
  redoModel,
  uploadDxfFile,
} from '../lib/api';
import {
  setActiveComponentAssetId,
  setActiveComponentFamilyTypeId,
  syncLastLevelElevationPropagationFromApplyResponse,
} from './authoring';
import {
  buildCollaborationConflictQueueV1,
  type CollaborationConflictQueueV1,
} from '../lib/collaborationConflictQueue';
import type { LensMode, Snapshot, Violation } from '@bim-ai/core';
import { useBimStore, applyTheme, toggleTheme, getCurrentTheme, type Theme } from '../state/store';
import { selectDriftedElements } from '../plan/monitorDriftBadge';
import {
  loadSnapSettings,
  saveSnapSettings,
  SNAP_KINDS,
  type SnapSettings,
  type ToggleableSnapKind,
} from '../plan/snapSettings';
import { modeForHotkey } from '../state/modeController';
import { patternFor } from '../state/uiStates';
import {
  AppShell,
  ParticipantStrip,
  RibbonBar,
  StatusBar,
  TabBar,
  type WorkspaceMode,
} from './shell';
import { getToolRegistry, type ToolDefinition, type ToolId } from '../tools/toolRegistry';
import {
  EMPTY_TABS,
  activateOrOpenKind,
  activateTab,
  closeInactiveTabs,
  closeTab,
  cycleActive,
  openTab,
  reorderTab,
  snapshotViewport,
  tabFromElement,
  type TabKind,
  type TabsState,
  type ViewTab,
  type ViewportSnapshot,
} from './tabsModel';
import { persistTabs, pruneTabsAgainstElements, readPersistedTabs } from './tabsPersistence';
import {
  buildSnapshotPayload,
  downloadSnapshot,
  findRecentProject,
  ManageLinksDialog,
  ProjectMenu,
  type ProjectMenuItemRecent,
  pushRollingSnapshotBackup,
  pushRecentProject,
  readRecentProjects,
  readSnapshotFile,
  VVDialog,
} from './project';
import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
} from '../state/backupRetention';
import {
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from './readouts';
import { CommentsPanel } from './comments';
import { ActivityDrawer } from '../collab/ActivityDrawer';
import { SharePresentationModal } from '../collab/SharePresentationModal';
import { useActivityDrawerStore } from '../collab/activityDrawerStore';
import { LibraryOverlay } from './library';
import { useActivityStore } from '../collab/activityStore';
import { CheatsheetModal } from '../cmd/CheatsheetModal';
import { CommandPalette } from '../cmdPalette/CommandPalette';
import '../cmdPalette/defaultCommands';
import {
  FamilyLibraryPanel,
  type ExternalCatalogPlacement,
  type FamilyLibraryArrayFormulaUpdate,
  type FamilyLibraryPlaceKind,
} from '../families/FamilyLibraryPanel';
import {
  findLoadedCatalogFamilyType,
  planCatalogFamilyLoad,
  type FamilyReloadOverwriteOption,
} from '../families/catalogFamilyReload';
import { getFamilyPlacementAdapter } from '../families/familyPlacementAdapters';
import { applyCommandBundle } from '../lib/api';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { readOnboardingProgress, resetOnboarding } from '../onboarding/tour';
import { canvasContainerStyle, CanvasMount } from './viewport';
import {
  defaultTabFallbackForKind,
  EmptyStateOverlay,
  resolvePlanTabTarget,
} from './WorkspaceHelpers';
import { EmptyStateHint } from './shell';
import { MilestoneDialog } from '../collab/MilestoneDialog';
import { WorkspaceLeftRail } from './WorkspaceLeftRail';
import { WorkspaceRightRail } from './WorkspaceRightRail';
import { useWorkspaceSnapshot } from './useWorkspaceSnapshot';
import { mapComments, planToolToToolId, validatePlanTool } from './workspaceUtils';
import { useToolPrefs } from '../tools/toolPrefsStore';
import { usePresenceStore } from '../presenceStore';
import {
  firstSheetId,
  placeViewOnSheetCommand,
  recommendedSheetViewportsCommand,
  recommendedViewsForSheet,
} from './sheets/sheetRecommendedViewports';
import type { WorkspaceId } from './chrome/workspaces';

function libraryDisciplineFromLens(lens: LensMode): 'arch' | 'struct' | 'mep' | 'all' {
  if (lens === 'architecture') return 'arch';
  if (lens === 'structure') return 'struct';
  if (lens === 'mep') return 'mep';
  return 'all';
}

function lensForWorkspace(id: WorkspaceId): LensMode {
  if (id === 'struct') return 'structure';
  if (id === 'mep') return 'mep';
  return 'all';
}

function disciplineScopeNote(
  activeWorkspaceId: WorkspaceId,
  selected: Element | undefined,
): string | null {
  const expected =
    activeWorkspaceId === 'struct'
      ? 'structure'
      : activeWorkspaceId === 'mep'
        ? 'mep'
        : activeWorkspaceId === 'arch'
          ? 'architecture'
          : null;
  const actual =
    selected && 'discipline' in selected && typeof selected.discipline === 'string'
      ? selected.discipline
      : null;
  if (!expected || !actual || expected === actual) return null;
  return 'This element is outside the active discipline scope; the comment will post with a scope note.';
}

/**
 * Workspace — composition root for the §11–§17 chrome.
 *
 * Mounted at `/`. Reads from `useBimStore`. The canvas slot reuses
 * `Viewport` / `PlanCanvas` — the chrome (TopBar / LeftRail /
 * Inspector / StatusBar / ToolPalette) is spec §11–§17.
 *
 * Spec sections wired here: §7 modes (1–7), §8 layout grid, §11 TopBar,
 * §12 Project Browser, §13 Inspector, §16 Tool palette, §17 StatusBar.
 */

type RailOverride = 'open' | 'collapsed' | null;

function formatStatusMm(mm: number): string {
  return `${(mm / 1000).toFixed(1)} m`;
}

export function Workspace(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toolRegistry = useMemo(() => getToolRegistry(t), [t]);
  const elementsById = useBimStore((s) => s.elementsById);
  const hydrateFromSnapshot = useBimStore((s) => s.hydrateFromSnapshot);
  const viewerMode = useBimStore((s) => s.viewerMode);
  const setViewerMode = useBimStore((s) => s.setViewerMode);
  const planTool = useBimStore((s) => s.planTool);
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  // EDT-V3-05: loop mode state for status bar message.
  const loopMode = useToolPrefs((s) => s.loopMode);
  const draftGridVisible = useToolPrefs((s) => s.draftGridVisible);
  const toggleDraftGridVisible = useToolPrefs((s) => s.toggleDraftGridVisible);
  const selectedId = useBimStore((s) => s.selectedId);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const planHudMm = useBimStore((s) => s.planHudMm);
  const userDisplayName = useBimStore((s) => s.userDisplayName);
  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);
  const comments = useBimStore((s) => s.comments);
  const setComments = useBimStore((s) => s.setComments);
  const setPerspectiveId = useBimStore((s) => s.setPerspectiveId);
  const setActivity = useBimStore((s) => s.setActivity);
  const vvDialogOpen = useBimStore((s) => s.vvDialogOpen);
  const openVVDialog = useBimStore((s) => s.openVVDialog);
  const closeVVDialog = useBimStore((s) => s.closeVVDialog);
  const setOrthoSnapHold = useBimStore((s) => s.setOrthoSnapHold);
  const userId = useBimStore((s) => s.userId);

  // COL-V3-04 — presence strip
  const presenceParticipants = usePresenceStore((s) => s.participants);
  const presenceLocalUserId = usePresenceStore((s) => s.localUserId);
  const presenceSetParticipants = usePresenceStore((s) => s.setParticipants);
  const presenceSetLocalUserId = usePresenceStore((s) => s.setLocalUserId);

  useEffect(() => {
    if (import.meta.env.DEV && presenceParticipants.length === 0) {
      const devUserId = userId ?? 'dev-local';
      presenceSetLocalUserId(devUserId);
      presenceSetParticipants([
        {
          userId: devUserId,
          displayName: userDisplayName ?? 'You',
          initials: (userDisplayName ?? 'You').slice(0, 2).toUpperCase(),
          color: 'var(--collab-color-1)',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          role: 'editor',
          sessionStartedAt: Date.now(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AST-V3-01 — library overlay (Alt+2)
  const [libraryOpen, setLibraryOpen] = useState(false);
  const projectSettings =
    elementsById.project_settings?.kind === 'project_settings'
      ? elementsById.project_settings
      : null;
  const saveAsMaximumBackups = coerceCheckpointRetentionLimit(
    projectSettings?.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT,
  );

  // COL-VIS: share presentation modal
  const [sharePresentationOpen, setSharePresentationOpen] = useState(false);

  const sheetPages = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet')
        .map((s) => ({ id: s.id, name: (s as unknown as { name?: string }).name ?? 'Sheet' })),
    [elementsById],
  );

  // CHR-V3-05 activity drawer state
  const activityIsOpen = useActivityDrawerStore((s) => s.isOpen);
  const activityLastSeenAt = useActivityDrawerStore((s) => s.lastSeenAt);
  const toggleActivityDrawer = useActivityDrawerStore((s) => s.toggle);
  const closeActivityDrawer = useActivityDrawerStore((s) => s.close);
  const activityRows = useActivityStore((s) => s.rows);
  const activityUnreadCount = useMemo(
    () => activityRows.filter((r) => r.ts > activityLastSeenAt).length,
    [activityRows, activityLastSeenAt],
  );

  const [mode, setMode] = useState<WorkspaceMode>(() =>
    viewerMode === 'orbit_3d' ? '3d' : 'plan',
  );
  const [theme, setTheme] = useState<Theme>(() => (getCurrentTheme() as Theme) ?? 'light');
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailOverride, setRightRailOverride] = useState<RailOverride>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [familyLibraryOpen, setFamilyLibraryOpen] = useState(false);
  const [_pendingPlacement, setPendingPlacement] = useState<{
    kind: FamilyLibraryPlaceKind;
    typeId: string;
  } | null>(null);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState<boolean>(() => !readOnboardingProgress().completed);
  const {
    insertSeedHouse,
    loadSeedModel,
    seedModels,
    activeSeedLabel,
    seedLoading,
    seedError,
    setSeedError,
    wsOn,
    codePresetIds,
  } = useWorkspaceSnapshot();
  const [_collaborationConflictQueue, setCollaborationConflictQueue] =
    useState<CollaborationConflictQueueV1 | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [manageLinksOpen, setManageLinksOpen] = useState(false);
  const lensMode = useBimStore((s) => s.lensMode);
  const setLensMode = useBimStore((s) => s.setLensMode);
  const activeWorkspaceId = useBimStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useBimStore((s) => s.setActiveWorkspaceId);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);
  const viewerProjection = useBimStore((s) => s.viewerProjection);
  const viewerSectionBoxActive = useBimStore((s) => s.viewerSectionBoxActive);
  const viewerWalkModeActive = useBimStore((s) => s.viewerWalkModeActive);
  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const orbitCameraPoseMm = useBimStore((s) => s.orbitCameraPoseMm);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const applyOrbitViewpointPreset = useBimStore((s) => s.applyOrbitViewpointPreset);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [recentProjects, setRecentProjects] = useState<ProjectMenuItemRecent[]>(() =>
    readRecentProjects().map((r) => ({ id: r.id, label: r.label })),
  );
  const projectNameRef = useRef<HTMLButtonElement | null>(null);
  const planCameraHandleRef = useRef<PlanCameraHandle | null>(null);
  const budgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChordRef = useRef<string | null>(null);
  const pendingChordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tabsState, setTabsState] = useState<TabsState>(() => readPersistedTabs() ?? EMPTY_TABS);

  /** Persist tabs on every change (T-06). */
  useEffect(() => {
    persistTabs(tabsState);
  }, [tabsState]);

  /* ── Tab helpers (§11.3) ──────────────────────────────────────────── */
  const activeTab: ViewTab | null = useMemo(
    () =>
      tabsState.activeId ? (tabsState.tabs.find((t) => t.id === tabsState.activeId) ?? null) : null,
    [tabsState],
  );
  const effectiveMode = (activeTab?.kind as WorkspaceMode | undefined) ?? mode;

  const activePlanTarget = useMemo(
    () =>
      activeTab?.kind === 'plan' || activeTab?.kind === 'plan-3d'
        ? resolvePlanTabTarget(elementsById, activeTab.targetId, activeLevelId)
        : { activeLevelId: activeLevelId ?? '' },
    [activeTab, activeLevelId, elementsById],
  );

  const handleTabActivate = useCallback(
    (id: string) => {
      let pendingPlanCamera: ViewportSnapshot['planCamera'] | undefined;

      setTabsState((s) => {
        if (s.activeId === id) return s;
        // Snapshot the outgoing tab's viewport state so it can be restored
        // when the user comes back. T-07.
        let snapshotted = s;
        if (s.activeId) {
          const outgoing = s.tabs.find((x) => x.id === s.activeId);
          if (outgoing) {
            if (outgoing.kind === '3d' || outgoing.kind === 'plan-3d') {
              const pose = useBimStore.getState().orbitCameraPoseMm;
              if (pose) {
                snapshotted = snapshotViewport(snapshotted, s.activeId, {
                  ...(outgoing.viewportState ?? {}),
                  orbitCameraPoseMm: { eyeMm: pose.position, targetMm: pose.target },
                });
              }
            }
            // Snapshot the 2D plan camera for plan tabs (T-07 follow-up).
            if (outgoing.kind === 'plan' || outgoing.kind === 'plan-3d') {
              const planSnap = planCameraHandleRef.current?.getSnapshot();
              if (planSnap) {
                snapshotted = snapshotViewport(snapshotted, s.activeId, {
                  ...(snapshotted.tabs.find((x) => x.id === s.activeId)?.viewportState ?? {}),
                  planCamera: planSnap,
                });
              }
            }
          }
        }
        const next = activateTab(snapshotted, id);
        const t = next.tabs.find((x) => x.id === id);
        if (!t) return next;
        // Keep the store's active plan state in sync with the active tab's target.
        if ((t.kind === 'plan' || t.kind === 'plan-3d') && t.targetId) {
          const target = useBimStore.getState().elementsById[t.targetId];
          if (target?.kind === 'plan_view') {
            activatePlanView(target.id);
          } else if (target?.kind === 'level') {
            activatePlanView(undefined);
            setActiveLevelId(target.id);
          }
        }
        // Restore the incoming tab's 3D camera, if it has one.
        const restored = t.viewportState?.orbitCameraPoseMm;
        if (restored?.eyeMm && restored.targetMm) {
          useBimStore.getState().setOrbitCameraFromViewpointMm({
            position: restored.eyeMm,
            target: restored.targetMm,
            up: { xMm: 0, yMm: 1, zMm: 0 },
          });
        }
        // Capture the incoming plan camera for post-setState apply (plan-to-plan case).
        if (t.kind === 'plan' || t.kind === 'plan-3d') {
          pendingPlanCamera = t.viewportState?.planCamera;
        }
        return next;
      });

      // Apply plan camera to the already-mounted PlanCanvas (plan-to-plan switch).
      // For 3D→plan switches, initialCamera prop handles restore at mount time.
      if (pendingPlanCamera) {
        planCameraHandleRef.current?.applySnapshot(pendingPlanCamera);
      }
    },
    [activatePlanView, setActiveLevelId],
  );

  const handleTabClose = useCallback((id: string) => {
    setTabsState((s) => closeTab(s, id));
  }, []);

  const openTabFromElement = useCallback((el: Element) => {
    const partial = tabFromElement(el);
    if (!partial) return;
    setTabsState((s) => openTab(s, partial));
  }, []);

  /* ── Project menu handlers (T-03) ─────────────────────────────────── */
  const handleSaveSnapshot = useCallback(() => {
    const st = useBimStore.getState();
    if (!st.modelId) {
      setSeedError('Nothing to save — bootstrap a model first.');
      return;
    }
    const snap: Snapshot = {
      modelId: st.modelId,
      revision: st.revision ?? 0,
      elements: st.elementsById as unknown as Record<string, unknown>,
      violations: [],
    };
    const payload = buildSnapshotPayload(snap, undefined, {
      maximumBackups: saveAsMaximumBackups,
    });
    const { payload: rollingPayload } = pushRollingSnapshotBackup(payload, saveAsMaximumBackups);
    downloadSnapshot(rollingPayload);
    const next = pushRecentProject(rollingPayload);
    setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
  }, [saveAsMaximumBackups, setSeedError]);

  const handleRestoreSnapshot = useCallback(
    async (file: File): Promise<void> => {
      try {
        const payload = await readSnapshotFile(file);
        hydrateFromSnapshot(payload.snapshot);
        const next = pushRecentProject(payload);
        setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
      } catch (err) {
        setSeedError(err instanceof Error ? err.message : 'Failed to read snapshot');
      }
    },
    [hydrateFromSnapshot, setSeedError],
  );

  const handlePickRecent = useCallback(
    (id: string) => {
      const found = findRecentProject(id);
      if (!found) return;
      hydrateFromSnapshot(found.payload.snapshot);
    },
    [hydrateFromSnapshot],
  );

  const handleNewClear = useCallback(() => {
    hydrateFromSnapshot({ modelId: 'empty', revision: 0, elements: {}, violations: [] });
    setTabsState(EMPTY_TABS);
  }, [hydrateFromSnapshot]);

  /* ── Comments + presence handlers (T-16) ─────────────────────────── */
  const handleCommentPost = useCallback(
    async (body: string): Promise<void> => {
      if (!modelId) return;
      await postComment(modelId, {
        userDisplay: userDisplayName || 'Guest',
        body,
        levelId: activeLevelId ?? undefined,
        elementId: selectedId ?? undefined,
      });
      const c = await fetchComments(modelId);
      setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
    },
    [modelId, userDisplayName, activeLevelId, selectedId, setComments],
  );

  const handleCommentResolve = useCallback(
    async (commentId: string, resolved: boolean): Promise<void> => {
      if (!modelId) return;
      await patchCommentResolved(modelId, commentId, resolved);
      const c = await fetchComments(modelId);
      setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
    },
    [modelId, setComments],
  );

  /* ── Semantic command dispatch (from PlanCanvas / Viewport) ────────── */
  const onSemanticCommand = useCallback(
    async (cmd: Record<string, unknown>): Promise<void> => {
      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      if (!mid) return;
      try {
        const r = await applyCommand(mid, cmd, { userId: uid });
        if (r.revision !== undefined) {
          hydrateFromSnapshot({
            modelId: mid,
            revision: r.revision,
            elements: r.elements ?? {},
            violations: (r.violations ?? []) as Violation[],
          });
          syncLastLevelElevationPropagationFromApplyResponse(
            r as Parameters<typeof syncLastLevelElevationPropagationFromApplyResponse>[0],
          );
          setUndoDepth((d) => d + 1);
          setRedoDepth(0);
        }
        setCollaborationConflictQueue(null);
      } catch (err) {
        if (err instanceof ApiHttpError && err.status === 409) {
          log.error('conflict', '409 conflict detail:', err.detail);
          setCollaborationConflictQueue(buildCollaborationConflictQueueV1(err.detail));
        } else {
          setCollaborationConflictQueue(null);
          setSeedError(err instanceof Error ? err.message : 'Apply failed');
        }
      }
    },
    [hydrateFromSnapshot, setSeedError],
  );

  const handleSaveAsMaximumBackupsChange = useCallback(
    (maximumBackups: number) => {
      const settings = useBimStore.getState().elementsById.project_settings;
      if (!settings || settings.kind !== 'project_settings') {
        setSeedError('Save As Options require project settings in the current model.');
        return;
      }
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: settings.id,
        key: 'checkpointRetentionLimit',
        value: String(coerceCheckpointRetentionLimit(maximumBackups)),
      });
    },
    [onSemanticCommand, setSeedError],
  );

  /* ── AST-V3-01 — library place callback ─────────────────────────────── */
  const handleLibraryPlace = useCallback(
    async (
      entry: import('@bim-ai/core').AssetLibraryEntry,
      paramValues: Record<string, unknown>,
    ): Promise<void> => {
      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      const lvlId = useBimStore.getState().activeLevelId;
      if (!mid || !lvlId) return;
      // Place at canvas centre (0, 0) — the user can move it after placement.
      const command = {
        type: 'PlaceAsset',
        assetId: entry.id,
        levelId: lvlId,
        positionMm: { xMm: 0, yMm: 0 },
        paramValues,
      };
      try {
        const r = await applyCommand(mid, command, { userId: uid });
        if (r.revision !== undefined) {
          hydrateFromSnapshot({
            modelId: mid,
            revision: r.revision,
            elements: r.elements ?? {},
            violations: (r.violations ?? []) as Violation[],
          });
          setUndoDepth((d) => d + 1);
          setRedoDepth(0);
        }
      } catch {
        // Placement failure is non-blocking — the overlay stays open
      }
    },
    [hydrateFromSnapshot],
  );

  /* ── Undo / Redo ────────────────────────────────────────────────────── */
  const handleUndoRedo = useCallback(
    async (isUndo: boolean): Promise<void> => {
      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      if (!mid) return;
      try {
        const r = isUndo ? await undoModel(mid, uid) : await redoModel(mid, uid);
        if (r.revision !== undefined) {
          hydrateFromSnapshot({
            modelId: mid,
            revision: r.revision,
            elements: r.elements ?? {},
            violations: (r.violations ?? []) as Violation[],
          });
          syncLastLevelElevationPropagationFromApplyResponse(
            r as Parameters<typeof syncLastLevelElevationPropagationFromApplyResponse>[0],
          );
          setUndoDepth((d) => Math.max(0, d + (isUndo ? -1 : 1)));
          setRedoDepth((d) => Math.max(0, d + (isUndo ? 1 : -1)));
        }
        // Refresh activity after undo/redo
        fetchActivity(mid)
          .then((a) => {
            const evs = ((a.events ?? []) as Record<string, unknown>[]).map((ev) => ({
              id: Number(ev.id),
              userId: String(ev.userId ?? ev.user_id ?? ''),
              revisionAfter: Number(ev.revisionAfter ?? ev.revision_after ?? 0),
              createdAt: String(ev.createdAt ?? ev.created_at ?? ''),
              commandTypes: Array.isArray(ev.commandTypes) ? ev.commandTypes.map(String) : [],
            }));
            setActivity(evs);
          })
          .catch((err) => log.error('loadSnapshot', 'fetchActivity failed', err));
        setCollaborationConflictQueue(null);
      } catch (err) {
        if (err instanceof ApiHttpError && err.status === 409) {
          setCollaborationConflictQueue(buildCollaborationConflictQueueV1(err.detail));
        } else {
          setCollaborationConflictQueue(null);
        }
      }
    },
    [hydrateFromSnapshot, setActivity],
  );

  /* ── Viewpoint field persistence (3D viewport internal controls) ────── */
  const persistViewpointField = useCallback(
    async (payload: { elementId: string; key: string; value: string }): Promise<void> => {
      const st = useBimStore.getState();
      if (!st.activeViewpointId || st.activeViewpointId !== payload.elementId) return;
      await onSemanticCommand({ type: 'updateElementProperty', ...payload });
    },
    [onSemanticCommand],
  );

  // After the seed has hydrated, prune any restored tabs whose targets
  // no longer exist (e.g. a sheet deleted between sessions). If the
  // pruned set is empty, open a default Plan tab on the first level.
  // Runs once when the store transitions from empty → non-empty.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (Object.keys(elementsById).length === 0) return;
    seededRef.current = true;
    setTabsState((s) => {
      const pruned = pruneTabsAgainstElements(s, elementsById);
      if (pruned.tabs.length > 0) return pruned;
      const levels = (Object.values(elementsById) as Element[]).filter(
        (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
      );
      if (levels.length === 0) return pruned;
      const targetLevel =
        levels.find((l) => l.id === activeLevelId) ??
        levels.sort((a, b) => a.elevationMm - b.elevationMm)[0];
      if (!targetLevel) return pruned;
      return openTab(pruned, {
        kind: 'plan',
        targetId: targetLevel.id,
        label: `Plan · ${targetLevel.name}`,
      });
    });
  }, [elementsById, activeLevelId]);

  /* ── Mode wiring (§7 + §20) ────────────────────────────────────────── */
  const handleModeChange = useCallback(
    (next: WorkspaceMode) => {
      setMode(next);
      if (next === 'plan') setViewerMode('plan_canvas');
      else if (next === '3d') setViewerMode('orbit_3d');
      // Activate or open a tab of the matching kind so the canvas
      // mounts the right view.
      setTabsState((s) => {
        const fallback = defaultTabFallbackForKind(next, elementsById, activeLevelId);
        if (!fallback) return s;
        return activateOrOpenKind(s, next as TabKind, fallback);
      });
    },
    [setViewerMode, elementsById, activeLevelId],
  );

  const handleWorkspaceChange = useCallback(
    (id: WorkspaceId) => {
      setActiveWorkspaceId(id);
      setLensMode(lensForWorkspace(id));
      if (id === 'struct') setPerspectiveId('structure');
      else if (id === 'mep') setPerspectiveId('mep');
      else if (id === 'arch') setPerspectiveId('architecture');
    },
    [setActiveWorkspaceId, setLensMode, setPerspectiveId],
  );

  /**
   * Sets the mode + viewerMode WITHOUT touching tab state.
   * Used by WorkspaceLeftRail after `openTabFromElement` has already
   * activated the correct tab — calling `handleModeChange` afterwards
   * would override that activation by finding the first tab of that kind.
   */
  const handleSetModeOnly = useCallback(
    (next: WorkspaceMode) => {
      setMode(next);
      if (next === 'plan') setViewerMode('plan_canvas');
      else if (next === '3d') setViewerMode('orbit_3d');
      // no setTabsState — tab was already activated by openTabFromElement
    },
    [setViewerMode],
  );

  const open3dViewControls = useCallback(() => {
    setRightRailOverride('open');
    window.setTimeout(() => {
      document.getElementById('right-rail-view')?.scrollIntoView({ block: 'start' });
    }, 0);
  }, []);

  const openActiveVisibilityControls = useCallback(() => {
    if (effectiveMode === '3d' || effectiveMode === 'plan-3d') {
      open3dViewControls();
      return;
    }
    if (effectiveMode === 'plan' || effectiveMode === 'section') {
      openVVDialog();
    }
  }, [effectiveMode, open3dViewControls, openVVDialog]);

  /* ── Global hotkeys: 1–7 modes, ?, V/W/D/M/S/etc tools ─────────────── */
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      const fromMode = modeForHotkey(event.key);
      if (fromMode) {
        event.preventDefault();
        handleModeChange(fromMode as WorkspaceMode);
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setCheatsheetOpen((v) => !v);
        return;
      }
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Alt+2 — asset library overlay (AST-V3-01, Rayon shortcut).
      if (event.key === '2' && event.altKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setLibraryOpen((v) => !v);
        return;
      }
      // Cmd+H — activity-stream drawer (CHR-V3-05).
      if ((event.key === 'h' || event.key === 'H') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleActivityDrawer();
        return;
      }
      // Tab cycling — Ctrl/⌘+Tab forward, Ctrl/⌘+Shift+Tab back.
      if (event.key === 'Tab' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTabsState((s) => cycleActive(s, event.shiftKey ? 'backward' : 'forward'));
        return;
      }
      // Close active tab — Ctrl/⌘+W.
      if ((event.key === 'w' || event.key === 'W') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTabsState((s) => (s.activeId ? closeTab(s, s.activeId) : s));
        return;
      }
      // Undo/Redo — Ctrl/⌘+Z / Ctrl/⌘+Shift+Z.
      if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void handleUndoRedo(event.shiftKey ? false : true);
        return;
      }
      // V opens active-view visibility controls: plan VV/VG or 3D View Controls.
      if (event.key === 'v' || event.key === 'V') {
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          openActiveVisibilityControls();
          return;
        }
      }
      // Ortho snap hold on Shift
      if (event.shiftKey) setOrthoSnapHold(true);
      // Tool activation — hotkeys + two-char shortcut chords (400 ms window).
      const upper = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      const hotkeyLabel = event.shiftKey ? `Shift+${upper}` : upper;
      const tools = Object.values(toolRegistry) as ToolDefinition[];

      // Complete a pending chord if one is in flight
      if (pendingChordRef.current !== null && !event.shiftKey) {
        const chord = pendingChordRef.current + upper;
        clearTimeout(pendingChordTimerRef.current ?? undefined);
        pendingChordRef.current = null;
        pendingChordTimerRef.current = null;
        const chordTool = tools.find((t) => t.shortcut === chord);
        if (chordTool) {
          const tool = validatePlanTool(chordTool.id);
          if (tool) {
            event.preventDefault();
            setPlanTool(tool);
          }
        }
        return;
      }

      const hotkeyTool = tools.find((t) => t.hotkey === hotkeyLabel);
      // Whether pressing this key could start a two-char shortcut chord
      const isChordStart =
        !event.shiftKey && tools.some((t) => t.shortcut?.length === 2 && t.shortcut[0] === upper);

      if (hotkeyTool && isChordStart) {
        // Key matches a hotkey AND starts a chord — defer 400 ms to see if chord completes
        event.preventDefault();
        pendingChordRef.current = upper;
        pendingChordTimerRef.current = setTimeout(() => {
          pendingChordRef.current = null;
          pendingChordTimerRef.current = null;
          const tool = validatePlanTool(hotkeyTool.id);
          if (tool) setPlanTool(tool);
        }, 400);
        return;
      }

      if (hotkeyTool) {
        const tool = validatePlanTool(hotkeyTool.id);
        if (tool) {
          event.preventDefault();
          setPlanTool(tool);
        }
        return;
      }

      // No hotkey match — key may still be the start of a chord-only shortcut
      if (isChordStart) {
        event.preventDefault();
        pendingChordRef.current = upper;
        pendingChordTimerRef.current = setTimeout(() => {
          pendingChordRef.current = null;
          pendingChordTimerRef.current = null;
        }, 400);
      }
    };
    const onKeyUp = (event: globalThis.KeyboardEvent): void => {
      if (!event.shiftKey) setOrthoSnapHold(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKeyUp);
      if (pendingChordTimerRef.current !== null) {
        clearTimeout(pendingChordTimerRef.current);
        pendingChordRef.current = null;
        pendingChordTimerRef.current = null;
      }
    };
  }, [
    handleModeChange,
    handleUndoRedo,
    setPlanTool,
    setOrthoSnapHold,
    openActiveVisibilityControls,
    toolRegistry,
    toggleActivityDrawer,
    setLibraryOpen,
  ]);

  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);

  /* ── Debug: browser rendering budget (debounced, threshold warnings) ─ */
  useEffect(() => {
    if (budgetTimerRef.current) clearTimeout(budgetTimerRef.current);
    budgetTimerRef.current = setTimeout(() => {
      const readout = buildBrowserRenderingBudgetReadoutV1({
        elementsById,
        planProjectionPrimitives,
        scheduleHydratedRowCount: null,
        scheduleHydratedTab: null,
      });
      console.debug(
        '[bim] rendering budget:',
        formatBrowserRenderingBudgetLines(readout).join(' | '),
      );
      const bad = readout.rows.filter(
        (r) => r.progressiveState === 'deferred' || r.progressiveState === 'over_budget',
      );
      if (bad.length > 0) {
        console.warn(
          '[bim] rendering budget threshold exceeded:',
          readout.largeModelProofSummary,
          bad.map((r) => `${r.id}=${r.value ?? '?'}/${r.limit}`).join(', '),
        );
      }
    }, 2000);
    return () => {
      if (budgetTimerRef.current) clearTimeout(budgetTimerRef.current);
    };
  }, [elementsById, planProjectionPrimitives]);

  /* ── Debug: selected element dump (dev only) ─────────────────────── */
  useEffect(() => {
    if (!import.meta.env.DEV || !selectedId) return;
    const el = elementsById[selectedId];
    if (el) console.debug('[bim] selected element:', el);
  }, [selectedId, elementsById]);

  /* ── Status bar wiring ────────────────────────────────────────────── */
  const levels = useMemo(() => {
    return (Object.values(elementsById) as Element[])
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm)
      .map((l) => ({ id: l.id, label: l.name, elevationMm: l.elevationMm }));
  }, [elementsById]);
  const activeLevel = levels.find((l) => l.id === activeLevelId) ??
    levels[0] ?? { id: '', label: '—' };
  const cursorMm = planHudMm ? { xMm: planHudMm.xMm, yMm: planHudMm.yMm } : null;
  const driftCount = useMemo(() => selectDriftedElements(elementsById).length, [elementsById]);
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(() => loadSnapSettings());
  const snapModes = useMemo(
    () =>
      SNAP_KINDS.map((id) => ({
        id,
        label: id.replaceAll('_', ' '),
        on: snapSettings[id],
      })),
    [snapSettings],
  );
  const handleSnapSettingsChange = useCallback((next: SnapSettings): void => {
    setSnapSettings(next);
    saveSnapSettings(next);
  }, []);
  const handleSnapToggle = useCallback(
    (id: string): void => {
      if (!SNAP_KINDS.includes(id as ToggleableSnapKind)) return;
      const key = id as ToggleableSnapKind;
      handleSnapSettingsChange({
        ...snapSettings,
        [key]: !snapSettings[key],
      });
    },
    [handleSnapSettingsChange, snapSettings],
  );
  const statusViewLabel = activeTab?.label ?? null;
  const statusViewDetails = useMemo(() => {
    const selected = selectedId ? (elementsById[selectedId] as Element | undefined) : undefined;
    const selectedDetail = selected
      ? `Selected ${selected.kind.replaceAll('_', ' ')}`
      : selectedId
        ? 'Selection'
        : null;
    if (effectiveMode === '3d') {
      return [
        viewerProjection === 'orthographic' ? 'Ortho' : 'Perspective',
        viewerWalkModeActive ? 'Walk' : 'Orbit',
        viewerSectionBoxActive ? 'Section box' : null,
        viewerClipElevMm != null ? `Cap ${formatStatusMm(viewerClipElevMm)}` : null,
        viewerClipFloorElevMm != null ? `Floor ${formatStatusMm(viewerClipFloorElevMm)}` : null,
        activeViewpointId ? `Viewpoint ${activeViewpointId}` : null,
        selectedDetail,
      ].filter((detail): detail is string => Boolean(detail));
    }
    if (effectiveMode === 'sheet') return [selectedDetail ?? 'Paper space'];
    if (effectiveMode === 'schedule') return [selectedDetail ?? 'Rows'];
    if (effectiveMode === 'agent') return [selectedDetail ?? 'Review'];
    if (effectiveMode === 'concept') return [selectedDetail ?? 'Pre-BIM board'];
    return selectedDetail ? [selectedDetail] : [];
  }, [
    activeViewpointId,
    effectiveMode,
    elementsById,
    selectedId,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerProjection,
    viewerSectionBoxActive,
    viewerWalkModeActive,
  ]);

  const handleToolSelect = useCallback(
    (id: ToolId): void => {
      const tool = validatePlanTool(id);
      if (!tool) return;
      const def = toolRegistry[id];
      if (
        def &&
        !def.modes.includes(effectiveMode) &&
        (def.modes.includes('plan') || def.modes.includes('plan-3d'))
      ) {
        handleModeChange('plan');
      }
      setPlanTool(tool);
    },
    [effectiveMode, handleModeChange, setPlanTool, toolRegistry],
  );

  const openMilestoneDialog = useCallback(() => setMilestoneDialogOpen(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        openMilestoneDialog();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openMilestoneDialog]);

  const handleThemeToggle = useCallback(() => {
    const next = toggleTheme() === 'dark' ? 'dark' : 'light';
    setTheme(next as Theme);
  }, []);

  const handleThemeSet = useCallback((next: Theme) => {
    applyTheme(next);
    setTheme(next);
  }, []);

  const handleLanguageSet = useCallback(
    (next: 'en' | 'de') => {
      void i18n.changeLanguage(next);
      localStorage.setItem('bim-ai:lang', next);
    },
    [i18n],
  );

  const paletteViews = useMemo(() => {
    const KIND_PREFIX: Partial<Record<Element['kind'], string>> = {
      plan_view: 'Plan',
      viewpoint: '3D',
      section_cut: 'Section',
      sheet: 'Sheet',
      schedule: 'Schedule',
    };
    return (Object.values(elementsById) as Element[])
      .filter((el) => el.kind in KIND_PREFIX)
      .map((el) => ({
        id: el.id,
        label: `${KIND_PREFIX[el.kind]}: ${(el as { name?: string }).name ?? el.id}`,
        keywords: el.kind.replace('_', ' '),
      }));
  }, [elementsById]);

  const palettePlanTemplates = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter(
          (el): el is Extract<Element, { kind: 'view_template' }> => el.kind === 'view_template',
        )
        .map((template) => ({
          id: template.id,
          label: template.name,
          keywords: `${template.name} plan template view template`,
        })),
    [elementsById],
  );
  const paletteSectionCuts = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter((el): el is Extract<Element, { kind: 'section_cut' }> => el.kind === 'section_cut')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [elementsById],
  );

  const openElementById = useCallback(
    (id: string) => {
      const el = (elementsById as Record<string, Element>)[id];
      if (!el) return;
      openTabFromElement(el);
      if (el.kind === 'level') {
        activatePlanView(undefined);
        setActiveLevelId(el.id);
        setViewerMode('plan_canvas');
        setMode('plan');
        return;
      }
      if (el.kind === 'plan_view') {
        activatePlanView(el.id);
        useBimStore.getState().select(el.id);
        setViewerMode('plan_canvas');
        setMode('plan');
        return;
      }
      if (el.kind === 'viewpoint') {
        const store = useBimStore.getState();
        store.select(el.id);
        store.setActiveViewpointId(el.id);
        if (el.mode === 'orbit_3d' && el.camera) {
          store.setOrbitCameraFromViewpointMm({
            position: el.camera.position,
            target: el.camera.target,
            up: el.camera.up,
          });
          store.applyOrbitViewpointPreset({
            capElevMm: el.viewerClipCapElevMm,
            floorElevMm: el.viewerClipFloorElevMm,
            hideSemanticKinds: el.hiddenSemanticKinds3d,
          });
        }
        setViewerMode('orbit_3d');
        setMode('3d');
        return;
      }
      if (el.kind === 'section_cut') {
        useBimStore.getState().select(el.id);
        setMode('section');
        return;
      }
      if (el.kind === 'sheet') {
        useBimStore.getState().select(el.id);
        setMode('sheet');
        return;
      }
      if (el.kind === 'schedule') {
        useBimStore.getState().select(el.id);
        setMode('schedule');
      }
    },
    [activatePlanView, elementsById, openTabFromElement, setActiveLevelId, setViewerMode],
  );

  const paletteActiveScheduleId =
    activeTab?.kind === 'schedule' && activeTab.targetId ? activeTab.targetId : null;
  const paletteFirstSheetId = useMemo(() => firstSheetId(elementsById), [elementsById]);
  const paletteActiveSheetId =
    activeTab?.kind === 'sheet' && activeTab.targetId
      ? activeTab.targetId
      : effectiveMode === 'sheet'
        ? paletteFirstSheetId
        : null;
  const paletteActiveSectionId =
    activeTab?.kind === 'section' && activeTab.targetId
      ? activeTab.targetId
      : effectiveMode === 'section'
        ? elementsById[selectedId ?? '']?.kind === 'section_cut'
          ? (selectedId ?? null)
          : (paletteSectionCuts[0]?.id ?? null)
        : null;
  const paletteSheetPlaceableViews = useMemo(
    () =>
      paletteActiveSheetId
        ? recommendedViewsForSheet(elementsById, paletteActiveSheetId).map((el) => ({
            id: el.id,
            label: el.name,
            keywords: [el.kind, 'sheet viewport', 'place on sheet'].join(' '),
          }))
        : [],
    [elementsById, paletteActiveSheetId],
  );
  const openSelectedScheduleRow = useCallback(() => {
    if (!selectedId || !elementsById[selectedId]) return;
    openElementById(selectedId);
  }, [elementsById, openElementById, selectedId]);
  const placeActiveScheduleOnSheet = useCallback(() => {
    if (!paletteActiveScheduleId || !paletteFirstSheetId) return;
    const cmd = placeViewOnSheetCommand(elementsById, paletteFirstSheetId, paletteActiveScheduleId);
    if (cmd) void onSemanticCommand(cmd);
  }, [elementsById, onSemanticCommand, paletteActiveScheduleId, paletteFirstSheetId]);
  const duplicateActiveSchedule = useCallback(() => {
    if (!paletteActiveScheduleId) return;
    const schedule = elementsById[paletteActiveScheduleId];
    if (schedule?.kind !== 'schedule') return;
    void onSemanticCommand({
      type: 'upsertSchedule',
      id: `${schedule.id}-copy-${Date.now().toString(36)}`,
      name: `${schedule.name} copy`,
      filters: { ...(schedule.filters ?? {}) },
      grouping: { ...(schedule.grouping ?? {}) },
    });
  }, [elementsById, onSemanticCommand, paletteActiveScheduleId]);

  const navigateTo = useCallback(
    (target: { kind: WorkspaceMode; targetId?: string; source: string }) => {
      if (target.targetId) {
        openElementById(target.targetId);
        return;
      }
      handleModeChange(target.kind);
    },
    [handleModeChange, openElementById],
  );
  const openActiveSheetAnchor = useCallback(
    (anchorId: string) => {
      navigateTo({
        kind: 'sheet',
        ...(paletteActiveSheetId ? { targetId: paletteActiveSheetId } : {}),
        source: 'cmdk',
      });
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: 'start' });
      }, 0);
    },
    [navigateTo, paletteActiveSheetId],
  );
  const placeRecommendedViewsOnActiveSheet = useCallback(() => {
    if (!paletteActiveSheetId) return;
    const cmd = recommendedSheetViewportsCommand(elementsById, paletteActiveSheetId);
    if (cmd) void onSemanticCommand(cmd);
  }, [elementsById, onSemanticCommand, paletteActiveSheetId]);
  const placeViewOnActiveSheet = useCallback(
    (viewId: string) => {
      if (!paletteActiveSheetId) return;
      const cmd = placeViewOnSheetCommand(elementsById, paletteActiveSheetId, viewId);
      if (cmd) void onSemanticCommand(cmd);
    },
    [elementsById, onSemanticCommand, paletteActiveSheetId],
  );
  const placeActiveSectionOnSheet = useCallback(() => {
    if (!paletteActiveSectionId || !paletteFirstSheetId) return;
    const cmd = placeViewOnSheetCommand(elementsById, paletteFirstSheetId, paletteActiveSectionId);
    if (cmd) void onSemanticCommand(cmd);
  }, [elementsById, onSemanticCommand, paletteActiveSectionId, paletteFirstSheetId]);
  const openActiveSectionSourcePlan = useCallback(() => {
    navigateTo({ kind: 'plan', source: 'cmdk' });
  }, [navigateTo]);
  const adjustActiveSectionCropDepth = useCallback(
    (deltaMm: number) => {
      if (!paletteActiveSectionId) return;
      const section = elementsById[paletteActiveSectionId];
      if (section?.kind !== 'section_cut') return;
      const current = typeof section.cropDepthMm === 'number' ? section.cropDepthMm : 9000;
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: paletteActiveSectionId,
        key: 'cropDepthMm',
        value: Math.max(100, current + deltaMm),
      });
    },
    [elementsById, onSemanticCommand, paletteActiveSectionId],
  );
  const saveCurrentViewpoint = useCallback(() => {
    if (!orbitCameraPoseMm) return;
    const hiddenSemanticKinds3d = Object.entries(viewerCategoryHidden)
      .filter(([, hidden]) => hidden)
      .map(([kind]) => kind);
    void onSemanticCommand({
      type: 'create_saved_view',
      id: `sv-3d-${Date.now().toString(36)}`,
      baseViewId: activeViewpointId ?? 'orbit_3d',
      name: `Saved 3D View ${new Date().toLocaleString()}`,
      cameraState: {
        positionMm: orbitCameraPoseMm.position,
        targetMm: orbitCameraPoseMm.target,
        upMm: orbitCameraPoseMm.up,
        fovDeg: 60,
      },
      visibilityOverrides: {
        viewerClipCapElevMm: viewerClipElevMm,
        viewerClipFloorElevMm,
        hiddenSemanticKinds3d,
      },
      detailLevel: viewerProjection,
    });
  }, [
    activeViewpointId,
    onSemanticCommand,
    orbitCameraPoseMm,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerProjection,
  ]);
  const resetActiveSavedViewpoint = useCallback(() => {
    if (!activeViewpointId) return;
    const viewpoint = elementsById[activeViewpointId];
    if (viewpoint?.kind !== 'viewpoint' || viewpoint.mode !== 'orbit_3d' || !viewpoint.camera) {
      return;
    }
    setOrbitCameraFromViewpointMm({
      position: viewpoint.camera.position,
      target: viewpoint.camera.target,
      up: viewpoint.camera.up,
    });
    applyOrbitViewpointPreset({
      capElevMm: viewpoint.viewerClipCapElevMm,
      floorElevMm: viewpoint.viewerClipFloorElevMm,
      hideSemanticKinds: viewpoint.hiddenSemanticKinds3d,
    });
  }, [activeViewpointId, applyOrbitViewpointPreset, elementsById, setOrbitCameraFromViewpointMm]);
  const updateActiveSavedViewpoint = useCallback(() => {
    if (!activeViewpointId) return;
    const viewpoint = elementsById[activeViewpointId];
    if (viewpoint?.kind !== 'viewpoint' || viewpoint.mode !== 'orbit_3d') return;
    if (orbitCameraPoseMm) {
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: activeViewpointId,
        key: 'camera',
        value: orbitCameraPoseMm,
      });
    }
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: activeViewpointId,
      key: 'viewerClipCapElevMm',
      value: viewerClipElevMm,
    });
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: activeViewpointId,
      key: 'viewerClipFloorElevMm',
      value: viewerClipFloorElevMm,
    });
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: activeViewpointId,
      key: 'hiddenSemanticKinds3d',
      value: Object.entries(viewerCategoryHidden)
        .filter(([, hidden]) => hidden)
        .map(([kind]) => kind),
    });
  }, [
    activeViewpointId,
    elementsById,
    onSemanticCommand,
    orbitCameraPoseMm,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
  ]);
  const openScheduleControls = useCallback(() => {
    navigateTo({
      kind: 'schedule',
      ...(paletteActiveScheduleId ? { targetId: paletteActiveScheduleId } : {}),
      source: 'cmdk',
    });
  }, [navigateTo, paletteActiveScheduleId]);

  const handlePlaceFamilyType = useCallback(
    (kind: FamilyLibraryPlaceKind, typeId: string) => {
      setPendingPlacement({ kind, typeId });
      const adapter = getFamilyPlacementAdapter(kind);
      if (adapter.identifierRole === 'assetId') {
        setActiveComponentAssetId(typeId);
        setActiveComponentFamilyTypeId(null);
      } else if (
        adapter.semanticInstanceKind === 'family_type_component' ||
        adapter.hostRequirement === 'wall'
      ) {
        setActiveComponentFamilyTypeId(typeId);
        setActiveComponentAssetId(null);
      }
      if (adapter.planTool) {
        setPlanTool(adapter.planTool);
      } else if (adapter.semanticInstanceKind === 'family_type_component') {
        setPlanTool('component');
      }
    },
    [setPlanTool],
  );

  const loadCatalogFamilyIntoProject = useCallback(
    async (placement: ExternalCatalogPlacement, overwriteOption?: FamilyReloadOverwriteOption) => {
      if (!modelId) return null;
      const loadPlan = planCatalogFamilyLoad(placement, elementsById, { overwriteOption });
      try {
        await applyCommandBundle(modelId, [loadPlan.command], { userId: 'component-tool' });
      } catch (err) {
        log.error('component-tool', 'applyCommandBundle failed', err);
        return null;
      }
      return { kind: loadPlan.kind, typeId: loadPlan.typeId };
    },
    [elementsById, modelId],
  );

  const handleLoadCatalogFamily = useCallback(
    async (placement: ExternalCatalogPlacement, overwriteOption?: FamilyReloadOverwriteOption) => {
      await loadCatalogFamilyIntoProject(placement, overwriteOption);
    },
    [loadCatalogFamilyIntoProject],
  );

  const handlePlaceCatalogFamily = useCallback(
    async (placement: ExternalCatalogPlacement, overwriteOption?: FamilyReloadOverwriteOption) => {
      const loaded = await loadCatalogFamilyIntoProject(placement, overwriteOption);
      if (loaded) handlePlaceFamilyType(loaded.kind, loaded.typeId);
    },
    [handlePlaceFamilyType, loadCatalogFamilyIntoProject],
  );

  const handleUpdateArrayFormula = useCallback(
    async (update: FamilyLibraryArrayFormulaUpdate) => {
      if (!modelId) return;
      if (update.target.kind === 'asset') {
        const asset = elementsById[update.target.assetId];
        if (asset?.kind !== 'asset_library_entry') return;
        const paramSchema = (asset.paramSchema ?? []).map((param) =>
          param.key === update.paramKey
            ? {
                ...param,
                constraints: {
                  ...((param.constraints && typeof param.constraints === 'object'
                    ? param.constraints
                    : {}) as Record<string, unknown>),
                  formula: update.formula,
                },
              }
            : param,
        );
        await onSemanticCommand({
          type: 'updateElementProperty',
          elementId: asset.id,
          key: 'paramSchema',
          value: paramSchema,
        });
        return;
      }

      const placement = update.target.placement;
      const updatedPlacement: ExternalCatalogPlacement = {
        ...placement,
        family: {
          ...placement.family,
          params: (placement.family.params ?? []).map((param) =>
            param.key === update.paramKey ? { ...param, formula: update.formula } : param,
          ),
        },
      };
      const loaded = findLoadedCatalogFamilyType(elementsById, placement);
      const plan = planCatalogFamilyLoad(updatedPlacement, elementsById, {
        overwriteOption: loaded ? 'keep-existing-values' : 'overwrite-parameter-values',
      });
      const catalogArrayFormulaParams = {
        ...((loaded?.parameters.catalogArrayFormulaParams &&
        typeof loaded.parameters.catalogArrayFormulaParams === 'object'
          ? loaded.parameters.catalogArrayFormulaParams
          : {}) as Record<string, unknown>),
        [update.paramKey]: update.formula,
      };
      const command = {
        ...plan.command,
        parameters: {
          ...plan.command.parameters,
          [`${update.paramKey}Formula`]: update.formula,
          catalogArrayFormulaParams,
        },
      };
      try {
        const r = await applyCommandBundle(modelId, [command], { userId: 'component-tool' });
        if (r.revision !== undefined) {
          hydrateFromSnapshot({
            modelId,
            revision: r.revision,
            elements: r.elements ?? {},
            violations: (r.violations ?? []) as Violation[],
          });
          setUndoDepth((d) => d + 1);
          setRedoDepth(0);
        }
      } catch (err) {
        log.error('component-tool', 'array formula update failed', err);
        setSeedError(err instanceof Error ? err.message : 'Array formula update failed');
      }
    },
    [elementsById, hydrateFromSnapshot, modelId, onSemanticCommand, setSeedError],
  );

  /* ── VIS-V3-06: right rail driven by task context ────────────────── */
  const hasSelection = !!selectedId;
  const rightRailCollapsed = !hasSelection || rightRailOverride === 'collapsed';
  const toggleRightRail = useCallback(() => {
    setRightRailOverride((current) => {
      const currentlyCollapsed = !hasSelection || current === 'collapsed';
      return currentlyCollapsed ? 'open' : 'collapsed';
    });
  }, [hasSelection]);

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor(seedLoading ? 'canvas-loading' : 'canvas-empty');
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;

  /* ── CHR-V3-10: canvas hint (select/tool idle) ────────────────────── */
  const showCanvasHint = !selectedId && planTool === 'select';

  /* ── Compose AppShell slots ───────────────────────────────────────── */
  return (
    <>
      <CheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        context={{
          selectedElementIds: selectedId ? [selectedId] : [],
          activeViewId:
            activeTab?.targetId ??
            activePlanViewId ??
            useBimStore.getState().activeViewpointId ??
            useBimStore.getState().activeElevationViewId ??
            null,
          activeMode: effectiveMode,
          activePlanViewId,
          activeScheduleId: paletteActiveScheduleId,
          activeSheetId: paletteActiveSheetId,
          activeSectionId: paletteActiveSectionId,
          activeViewpointId,
          canSaveCurrentViewpoint: Boolean(orbitCameraPoseMm),
          navigateMode: (kind) => navigateTo({ kind, source: 'cmdk' }),
          startPlanTool: (toolId) => handleToolSelect(toolId as ToolId),
          setTheme: handleThemeSet,
          toggleTheme: handleThemeToggle,
          setLanguage: handleLanguageSet,
          views: paletteViews,
          planTemplates: palettePlanTemplates,
          sheetPlaceableViews: paletteSheetPlaceableViews,
          openElement: (id) => navigateTo({ kind: effectiveMode, targetId: id, source: 'cmdk' }),
          dispatchCommand: (cmd) => void onSemanticCommand(cmd),
          openProjectMenu: () => setProjectMenuOpen((v) => !v),
          saveSnapshot: handleSaveSnapshot,
          openRestoreSnapshot: () => setProjectMenuOpen(true),
          sharePresentation: () => setSharePresentationOpen(true),
          hasPresentationPages: sheetPages.length > 0,
          openFamilyLibrary: () => setFamilyLibraryOpen(true),
          openKeyboardShortcuts: () => setCheatsheetOpen(true),
          openPlanVisibilityGraphics: openVVDialog,
          open3dViewControls,
          openActiveVisibilityControls,
          openSelectedScheduleRow,
          placeActiveScheduleOnSheet,
          duplicateActiveSchedule,
          openScheduleControls,
          placeRecommendedViewsOnActiveSheet,
          placeViewOnActiveSheet,
          openSheetTitleblockEditor: () => openActiveSheetAnchor('sheet-titleblock-editor'),
          openSheetViewportEditor: () => openActiveSheetAnchor('sheet-viewport-editor'),
          shareActiveSheet: () => setSharePresentationOpen(true),
          placeActiveSectionOnSheet,
          openActiveSectionSourcePlan,
          adjustActiveSectionCropDepth,
          saveCurrentViewpoint,
          resetActiveSavedViewpoint,
          updateActiveSavedViewpoint,
          closeInactiveViews: () => setTabsState((s) => closeInactiveTabs(s)),
          toggleLeftRail: () => setLeftRailCollapsed((v) => !v),
          toggleRightRail,
        }}
      />
      <FamilyLibraryPanel
        open={familyLibraryOpen}
        onClose={() => setFamilyLibraryOpen(false)}
        elementsById={elementsById}
        onPlaceType={handlePlaceFamilyType}
        onPlaceCatalogFamily={handlePlaceCatalogFamily}
        onLoadCatalogFamily={handleLoadCatalogFamily}
        onUpdateArrayFormula={handleUpdateArrayFormula}
      />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <VVDialog open={vvDialogOpen} onClose={closeVVDialog} />
      {commentsOpen ? (
        <div
          data-testid="comments-overlay"
          style={{ position: 'fixed', top: 56, right: 12, zIndex: 50 }}
        >
          <CommentsPanel
            comments={comments}
            userDisplay={userDisplayName || 'Guest'}
            outsideScopeNote={disciplineScopeNote(
              activeWorkspaceId,
              selectedId ? (elementsById[selectedId] as Element | undefined) : undefined,
            )}
            onPost={handleCommentPost}
            onResolve={handleCommentResolve}
            onClose={() => setCommentsOpen(false)}
          />
        </div>
      ) : null}
      <ProjectMenu
        open={projectMenuOpen}
        onOpenChange={setProjectMenuOpen}
        anchorRef={projectNameRef}
        recent={recentProjects}
        onPickRecent={handlePickRecent}
        seedModels={seedModels}
        activeSeedModelId={modelId ?? null}
        onPickSeedModel={(id) => void loadSeedModel(id)}
        onInsertSeed={() => void insertSeedHouse()}
        onSaveSnapshot={handleSaveSnapshot}
        saveAsMaximumBackups={saveAsMaximumBackups}
        onSaveAsMaximumBackupsChange={handleSaveAsMaximumBackupsChange}
        onRestoreSnapshot={(f) => void handleRestoreSnapshot(f)}
        onNewClear={handleNewClear}
        onReplayTour={() => {
          resetOnboarding();
          setTourOpen(true);
        }}
        onManageLinks={() => setManageLinksOpen(true)}
        onLinkIfc={(file) => {
          // FED-04: the workspace doesn't know its host model id at this
          // layer; surface a console message and open the ManageLinksDialog
          // so the user can finish the import there. Wired upstream by the
          // model-aware shell.
          console.warn('link-ifc selected', { name: file.name, size: file.size });
          setManageLinksOpen(true);
        }}
        onLinkDxf={(file, options) => {
          if (!modelId || !activeLevelId) {
            setManageLinksOpen(true);
            return;
          }
          void (async () => {
            try {
              await uploadDxfFile(modelId, file, activeLevelId, options);
              // Refresh will happen via WebSocket broadcast
              setManageLinksOpen(true);
            } catch (err) {
              console.error('DXF upload failed:', err);
              setManageLinksOpen(true);
            }
          })();
        }}
      />
      <ManageLinksDialog open={manageLinksOpen} onClose={() => setManageLinksOpen(false)} />
      {modelId && (
        <MilestoneDialog
          open={milestoneDialogOpen}
          modelId={modelId}
          snapshotId={String(revision)}
          authorId={userDisplayName || 'local-dev'}
          onClose={() => setMilestoneDialogOpen(false)}
        />
      )}
      {modelId ? (
        <SharePresentationModal
          modelId={modelId}
          open={sharePresentationOpen}
          onClose={() => setSharePresentationOpen(false)}
          pages={sheetPages}
        />
      ) : null}
      <AppShell
        activeMode={effectiveMode}
        leftCollapsed={leftRailCollapsed}
        onLeftCollapsedChange={setLeftRailCollapsed}
        rightCollapsed={rightRailCollapsed}
        header={
          <div
            data-testid="workspace-header"
            className="flex min-h-[44px] w-full min-w-0 items-center gap-2 bg-surface px-2"
          >
            {!leftRailCollapsed ? (
              <button
                type="button"
                data-testid="workspace-header-primary-toggle"
                aria-label="Hide primary sidebar"
                title="Hide primary sidebar"
                onClick={() => setLeftRailCollapsed(true)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <Icons.hamburger size={16} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <TabBar
                tabs={tabsState.tabs}
                activeId={tabsState.activeId}
                onActivate={(id) => {
                  handleTabActivate(id);
                  const t = tabsState.tabs.find((x) => x.id === id);
                  if (t) {
                    if (t.kind === 'plan' || t.kind === 'plan-3d') setViewerMode('plan_canvas');
                    else if (t.kind === '3d') setViewerMode('orbit_3d');
                    setMode(t.kind as WorkspaceMode);
                  }
                }}
                onClose={handleTabClose}
                onCloseInactive={() => setTabsState((s) => closeInactiveTabs(s))}
                onReorder={(from, to) => setTabsState((s) => reorderTab(s, from, to))}
                onAdd={(kind) => {
                  const fallback = defaultTabFallbackForKind(kind, elementsById, activeLevelId);
                  if (!fallback) return;
                  setTabsState((s) => activateOrOpenKind(s, kind, fallback));
                  setMode(kind as WorkspaceMode);
                  if (kind === 'plan' || kind === 'plan-3d') setViewerMode('plan_canvas');
                  else if (kind === '3d') setViewerMode('orbit_3d');
                }}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-testid="workspace-header-share"
                onClick={() => setSharePresentationOpen(true)}
                disabled={sheetPages.length === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-surface px-2 text-xs font-medium text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
                title={
                  sheetPages.length > 0
                    ? 'Share presentation'
                    : 'Create a sheet before sharing a presentation'
                }
              >
                <Icons.externalLink size={14} aria-hidden="true" />
                <span>Share</span>
              </button>
              <button
                type="button"
                data-testid="workspace-header-cmdk"
                onClick={() => setPaletteOpen(true)}
                className="inline-flex h-8 min-w-[150px] items-center gap-2 rounded border border-border bg-background px-2 text-left text-xs text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Open command palette"
              >
                <Icons.commandPalette size={14} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">Search or press</span>
                <kbd className="rounded border border-border bg-surface px-1 py-0.5 text-[10px]">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                data-testid="workspace-header-participants"
                onClick={() => setCommentsOpen((v) => !v)}
                className="inline-flex h-8 items-center justify-center rounded border border-border bg-surface px-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Open collaboration comments"
                title="Open collaboration comments"
              >
                {presenceParticipants.length > 0 ? (
                  <ParticipantStrip
                    participants={presenceParticipants}
                    localUserId={presenceLocalUserId ?? userId ?? ''}
                    maxVisible={3}
                  />
                ) : (
                  <Icons.collaborators size={16} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        }
        ribbon={
          <RibbonBar
            activeToolId={planToolToToolId(planTool)}
            activeMode={effectiveMode}
            selectedElementKind={
              selectedId ? (elementsById[selectedId] as Element | undefined)?.kind : null
            }
            onToolSelect={handleToolSelect}
            onModeChange={handleModeChange}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onOpenFamilyLibrary={() => setFamilyLibraryOpen(true)}
            onOpenSettings={() => setCheatsheetOpen(true)}
            onSaveCurrentViewpoint={saveCurrentViewpoint}
            onResetActiveSavedViewpoint={resetActiveSavedViewpoint}
            onUpdateActiveSavedViewpoint={updateActiveSavedViewpoint}
            onPlaceActiveSectionOnSheet={placeActiveSectionOnSheet}
            onOpenActiveSectionSourcePlan={openActiveSectionSourcePlan}
            onIncreaseActiveSectionCropDepth={() => adjustActiveSectionCropDepth(500)}
            onDecreaseActiveSectionCropDepth={() => adjustActiveSectionCropDepth(-500)}
            onPlaceRecommendedViewsOnActiveSheet={placeRecommendedViewsOnActiveSheet}
            onPlaceFirstViewOnActiveSheet={() => {
              const first = paletteSheetPlaceableViews[0];
              if (first) placeViewOnActiveSheet(first.id);
            }}
            onOpenSheetViewportEditor={() => openActiveSheetAnchor('sheet-viewport-editor')}
            onOpenSheetTitleblockEditor={() => openActiveSheetAnchor('sheet-titleblock-editor')}
            onShareActiveSheet={() => setSharePresentationOpen(true)}
            onOpenSelectedScheduleRow={openSelectedScheduleRow}
            onPlaceActiveScheduleOnSheet={placeActiveScheduleOnSheet}
            onDuplicateActiveSchedule={duplicateActiveSchedule}
            onOpenScheduleControls={openScheduleControls}
          />
        }
        primarySidebar={
          <WorkspaceLeftRail
            projectName={activeSeedLabel ?? 'BIM AI'}
            projectNameRef={projectNameRef}
            onProjectNameClick={() => setProjectMenuOpen((v) => !v)}
            openTabFromElement={openTabFromElement}
            onSetModeOnly={handleSetModeOnly}
            activeViewTargetId={activeTab?.targetId}
            userDisplayName={userDisplayName}
            userId={userId}
            modelId={modelId}
            revision={revision}
          />
        }
        secondarySidebar={
          <WorkspaceRightRail
            mode={effectiveMode}
            onSemanticCommand={onSemanticCommand}
            onModeChange={handleModeChange}
            codePresetIds={codePresetIds}
            onNavigateToElement={openElementById}
            activeViewTargetId={activeTab?.targetId}
            surface="view-context"
          />
        }
        canvas={
          <div
            style={{
              ...canvasContainerStyle,
              // VIS-V3-08: paper background for 2D views; 3D viewport keeps dark background.
              background: ['plan', 'section', 'plan-3d'].includes(activeTab?.kind ?? '')
                ? 'var(--color-canvas-paper)'
                : 'var(--color-background)',
              transition: 'background 120ms var(--ease-paper)',
            }}
            data-view-type={activeTab?.kind ?? 'none'}
            data-testid="redesign-canvas-root"
          >
            {showEmptyState ? (
              <EmptyStateOverlay
                headline={emptyHint.headline}
                hint={emptyHint.hint}
                ctaLabel={emptyHint.cta?.label ?? null}
                ctaPending={seedLoading}
                ctaError={seedError}
                onCta={() => void insertSeedHouse()}
                Icon={WallHifi}
              />
            ) : null}
            {showCanvasHint && !showEmptyState ? <EmptyStateHint /> : null}
            <CanvasMount
              mode={effectiveMode}
              activeTabId={activeTab?.id}
              viewerMode={viewerMode}
              activeLevelId={
                activeTab?.kind === 'plan' || activeTab?.kind === 'plan-3d'
                  ? activePlanTarget.activeLevelId
                  : (activeLevelId ?? '')
              }
              elementsById={elementsById}
              onSemanticCommand={(cmd) => void onSemanticCommand(cmd)}
              cameraHandleRef={planCameraHandleRef}
              initialCamera={activeTab?.viewportState?.planCamera}
              preferredSheetId={
                activeTab?.kind === 'sheet' ? (activeTab.targetId ?? undefined) : undefined
              }
              preferredScheduleId={
                activeTab?.kind === 'schedule' ? (activeTab.targetId ?? undefined) : undefined
              }
              modelId={modelId ?? undefined}
              wsOn={wsOn}
              onPersistViewpointField={persistViewpointField}
              lensMode={lensMode}
              onNavigateToElement={openElementById}
              snapSettings={snapSettings}
            />
          </div>
        }
        elementSidebar={
          hasSelection ? (
            <WorkspaceRightRail
              mode={effectiveMode}
              onSemanticCommand={onSemanticCommand}
              onModeChange={handleModeChange}
              codePresetIds={codePresetIds}
              onNavigateToElement={openElementById}
              surface="element"
            />
          ) : null
        }
        footer={
          <StatusBar
            mode={effectiveMode}
            viewLabel={statusViewLabel}
            viewDetails={statusViewDetails}
            level={activeLevel}
            levels={levels}
            onLevelChange={setActiveLevelId}
            toolLabel={
              loopMode && (planTool === 'wall' || planTool === 'beam')
                ? 'Loop mode on — L to toggle, Esc to exit'
                : (toolRegistry[planToolToToolId(planTool)]?.label ?? null)
            }
            gridOn={draftGridVisible}
            onGridToggle={toggleDraftGridVisible}
            cursorMm={cursorMm}
            undoDepth={undoDepth}
            redoDepth={redoDepth}
            onUndo={() => void handleUndoRedo(true)}
            onRedo={() => void handleUndoRedo(false)}
            wsState={wsOn ? 'connected' : 'offline'}
            saveState="saved"
            lensMode={lensMode}
            onLensChange={setLensMode}
            snapModes={snapModes}
            onSnapToggle={handleSnapToggle}
            activeWorkspaceId={activeWorkspaceId}
            driftCount={driftCount}
            onDriftClick={() => setManageLinksOpen(true)}
            activityUnreadCount={activityUnreadCount}
            onActivityClick={toggleActivityDrawer}
          />
        }
      />
      <ActivityDrawer
        isOpen={activityIsOpen}
        onClose={closeActivityDrawer}
        modelId={modelId ?? null}
        selfId={userId ?? null}
      />
      <LibraryOverlay
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        activeDiscipline={libraryDisciplineFromLens(lensMode)}
        entries={Object.values(elementsById)
          .filter((e) => (e as { kind: string }).kind === 'asset_library_entry')
          .map((e) => {
            const a = e as unknown as Record<string, unknown>;
            return {
              id: String(a['id']),
              assetKind: (a['assetKind'] ?? 'block_2d') as import('@bim-ai/core').AssetKind,
              name: String(a['name']),
              tags: (a['tags'] as string[]) ?? [],
              category: a['category'] as import('@bim-ai/core').AssetCategory,
              disciplineTags: a['disciplineTags'] as
                | import('@bim-ai/core').AssetDisciplineTag[]
                | undefined,
              thumbnailKind: ((a['thumbnailKind'] as string) ?? 'schematic_plan') as
                | 'schematic_plan'
                | 'rendered_3d',
              thumbnailMm:
                a['thumbnailWidthMm'] != null
                  ? {
                      widthMm: a['thumbnailWidthMm'] as number,
                      heightMm: (a['thumbnailHeightMm'] as number) ?? 60,
                    }
                  : undefined,
              planSymbolKind: a['planSymbolKind'] as
                | import('@bim-ai/core').AssetSymbolKind
                | undefined,
              renderProxyKind: a['renderProxyKind'] as
                | import('@bim-ai/core').AssetSymbolKind
                | undefined,
              paramSchema: a['paramSchema'] as
                | import('@bim-ai/core').ParamSchemaEntry[]
                | undefined,
              description: a['description'] as string | undefined,
            };
          })}
        onPlace={(entry, paramValues) => void handleLibraryPlace(entry, paramValues)}
      />
    </>
  );
}
