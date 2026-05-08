import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';

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
} from '../lib/api';
import { syncLastLevelElevationPropagationFromApplyResponse } from './levelDatumPropagationSync';
import { planToolsForPerspective } from './planToolsByPerspective';
import {
  buildCollaborationConflictQueueV1,
  type CollaborationConflictQueueV1,
} from '../lib/collaborationConflictQueue';
import type { LensMode, Snapshot, Violation } from '@bim-ai/core';
import { useBimStore, toggleTheme, getCurrentTheme, type Theme } from '../state/store';
import type { PerspectiveId } from '@bim-ai/core';
import { selectDriftedElements } from '../plan/monitorDriftBadge';
import { modeForHotkey } from '../state/modeController';
import { patternFor } from '../state/uiStates';
import { AppShell } from './AppShell';
import { TopBar, type WorkspaceMode } from './TopBar';
import { LeftRailCollapsed } from './LeftRail';
import { getToolRegistry, type ToolDisabledContext, type ToolId } from '../tools/toolRegistry';
import { TabBar } from './TabBar';
import {
  EMPTY_TABS,
  activateOrOpenKind,
  activateTab,
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
import { ProjectMenu, type ProjectMenuItemRecent } from './ProjectMenu';
import {
  buildSnapshotPayload,
  downloadSnapshot,
  findRecentProject,
  pushRecentProject,
  readRecentProjects,
  readSnapshotFile,
} from './projectSnapshots';
import {
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from './browserRenderingBudgetReadout';
import { VVDialog } from './VVDialog';
import { ManageLinksDialog } from './ManageLinksDialog';
import { CommentsPanel } from './CommentsPanel';
import { ActivityDrawer } from '../collab/ActivityDrawer';
import { useActivityDrawerStore } from '../collab/activityDrawerStore';
import { LibraryOverlay } from './LibraryOverlay';
import { useActivityStore } from '../collab/activityStore';
import { StatusBar } from './StatusBar';
import { CheatsheetModal } from '../cmd/CheatsheetModal';
import { CommandPalette } from '../cmdPalette/CommandPalette';
import '../cmdPalette/defaultCommands';
import { type CommandCandidate } from '../cmd/commandPaletteSources';
import {
  FamilyLibraryPanel,
  type ExternalCatalogPlacement,
  type FamilyLibraryPlaceKind,
} from '../families/FamilyLibraryPanel';
import { applyCommandBundle } from '../lib/api';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { readOnboardingProgress, resetOnboarding } from '../onboarding/tour';
import { canvasContainerStyle, CanvasMount } from './CanvasMount';
import { defaultTabFallbackForKind, EmptyStateOverlay, FloatingPalette } from './WorkspaceHelpers';
import { MilestoneDialog } from '../collab/MilestoneDialog';
import { WorkspaceLeftRail } from './WorkspaceLeftRail';
import { WorkspaceRightRail } from './WorkspaceRightRail';
import { useWorkspaceSnapshot } from './useWorkspaceSnapshot';
import {
  buildBrowserSections,
  buildPaletteCandidates,
  legacyToToolId,
  mapComments,
  toolIdToLegacy,
} from './workspaceUtils';

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

const PERSPECTIVE_OPTIONS: { id: PerspectiveId; label: string }[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'structure', label: 'Structure' },
  { id: 'mep', label: 'MEP' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'construction', label: 'Construction' },
  { id: 'agent', label: 'Agent' },
];

const PLAN_STYLE_OPTIONS = [
  { id: 'default', label: 'Neutral' },
  { id: 'opening_focus', label: 'Opening focus' },
  { id: 'room_scheme', label: 'Room scheme' },
];

export function Workspace(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toolRegistry = useMemo(() => getToolRegistry(t), [t]);
  const elementsById = useBimStore((s) => s.elementsById);
  const hydrateFromSnapshot = useBimStore((s) => s.hydrateFromSnapshot);
  const viewerMode = useBimStore((s) => s.viewerMode);
  const setViewerMode = useBimStore((s) => s.setViewerMode);
  const planTool = useBimStore((s) => s.planTool);
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const planHudMm = useBimStore((s) => s.planHudMm);
  const presencePeers = useBimStore((s) => s.presencePeers);
  const userDisplayName = useBimStore((s) => s.userDisplayName);
  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);
  const comments = useBimStore((s) => s.comments);
  const setComments = useBimStore((s) => s.setComments);
  const perspectiveId = useBimStore((s) => s.perspectiveId);
  const setPerspectiveId = useBimStore((s) => s.setPerspectiveId);
  const planPresentationPreset = useBimStore((s) => s.planPresentationPreset);
  const setPlanPresentationPreset = useBimStore((s) => s.setPlanPresentationPreset);
  const setActivity = useBimStore((s) => s.setActivity);
  const vvDialogOpen = useBimStore((s) => s.vvDialogOpen);
  const openVVDialog = useBimStore((s) => s.openVVDialog);
  const closeVVDialog = useBimStore((s) => s.closeVVDialog);
  const setOrthoSnapHold = useBimStore((s) => s.setOrthoSnapHold);
  const userId = useBimStore((s) => s.userId);

  // AST-V3-01 — library overlay (Alt+2)
  const [libraryOpen, setLibraryOpen] = useState(false);

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [familyLibraryOpen, setFamilyLibraryOpen] = useState(false);
  const [_pendingPlacement, setPendingPlacement] = useState<{
    kind: FamilyLibraryPlaceKind;
    typeId: string;
  } | null>(null);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [tourOpen, setTourOpen] = useState<boolean>(() => !readOnboardingProgress().completed);
  const { insertSeedHouse, seedLoading, seedError, setSeedError, wsOn, codePresetIds } =
    useWorkspaceSnapshot();
  const [_collaborationConflictQueue, setCollaborationConflictQueue] =
    useState<CollaborationConflictQueueV1 | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [manageLinksOpen, setManageLinksOpen] = useState(false);
  const [lensMode, setLensMode] = useState<LensMode>('all');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [recentProjects, setRecentProjects] = useState<ProjectMenuItemRecent[]>(() =>
    readRecentProjects().map((r) => ({ id: r.id, label: r.label })),
  );
  const projectNameRef = useRef<HTMLButtonElement | null>(null);
  const planCameraHandleRef = useRef<PlanCameraHandle | null>(null);
  const budgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        // Keep the store's active level in sync with the active tab's target.
        if ((t.kind === 'plan' || t.kind === 'plan-3d') && t.targetId) {
          setActiveLevelId(t.targetId);
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
    [setActiveLevelId],
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
    const payload = buildSnapshotPayload(snap);
    downloadSnapshot(payload);
    const next = pushRecentProject(payload);
    setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
  }, [setSeedError]);

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
      if (next === 'plan' || next === 'plan-3d') setViewerMode('plan_canvas');
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
        handleModeChange(fromMode);
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
      // V opens VV (Visibility/Graphics) dialog
      if (event.key === 'v' || event.key === 'V') {
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          openVVDialog();
          return;
        }
      }
      // Ortho snap hold on Shift
      if (event.shiftKey) setOrthoSnapHold(true);
      // Tool hotkeys — match the spec'd letters from TOOL_REGISTRY.
      const upper = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      const hotkeyLabel = event.shiftKey ? `Shift+${upper}` : upper;
      const tool = (Object.values(toolRegistry) as { id: ToolId; hotkey: string }[]).find(
        (tool) => tool.hotkey === hotkeyLabel,
      );
      if (tool) {
        const legacy = toolIdToLegacy(tool.id);
        if (legacy) {
          event.preventDefault();
          setPlanTool(legacy);
        }
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
    };
  }, [
    handleModeChange,
    handleUndoRedo,
    setPlanTool,
    setOrthoSnapHold,
    openVVDialog,
    toolRegistry,
    toggleActivityDrawer,
    setLibraryOpen,
  ]);

  const browserSections = useMemo(() => buildBrowserSections(elementsById), [elementsById]);

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
      .map((l) => ({ id: l.id, label: l.name }));
  }, [elementsById]);
  const activeLevel = levels.find((l) => l.id === activeLevelId) ??
    levels[0] ?? { id: '', label: '—' };
  const cursorMm = planHudMm ? { xMm: planHudMm.xMm, yMm: planHudMm.yMm } : null;
  const driftCount = useMemo(() => selectDriftedElements(elementsById).length, [elementsById]);

  const toolDisabledContext = useMemo<ToolDisabledContext>(() => {
    const has = (kind: string): boolean =>
      (Object.values(elementsById) as Element[]).some((e) => e.kind === kind);
    return {
      hasAnyWall: has('wall'),
      hasAnyFloor: has('floor'),
      hasAnySelection: !!selectedId,
    };
  }, [elementsById, selectedId]);

  const handleToolSelect = useCallback(
    (id: ToolId): void => {
      const legacy = toolIdToLegacy(id);
      if (legacy) setPlanTool(legacy);
    },
    [setPlanTool],
  );

  // Reset to 'select' when the current tool isn't valid for the active perspective
  const visibleLegacyTools = useMemo(() => planToolsForPerspective(perspectiveId), [perspectiveId]);
  useEffect(() => {
    if (!visibleLegacyTools.includes(planTool)) setPlanTool('select');
  }, [planTool, setPlanTool, visibleLegacyTools]);

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

  const paletteCandidates = useMemo<CommandCandidate[]>(
    () => buildPaletteCandidates(elementsById, toolRegistry, t),
    [elementsById, toolRegistry, t],
  );

  const handlePalettePick = useCallback(
    (cand: CommandCandidate) => {
      setRecentCommandIds((prev) => [cand.id, ...prev.filter((id) => id !== cand.id)].slice(0, 5));
      if (cand.id === 'tool.browse-families') {
        setFamilyLibraryOpen(true);
        return;
      }
      if (cand.kind === 'tool') {
        const toolId = cand.id.replace(/^tool\./, '') as ToolId;
        const legacy = toolIdToLegacy(toolId);
        if (legacy) setPlanTool(legacy);
        return;
      }
      if (cand.kind === 'element') {
        select(cand.id);
        return;
      }
      if (cand.id === 'settings.theme.light' || cand.id === 'settings.theme.dark') {
        const next = cand.id.endsWith('dark') ? 'dark' : 'light';
        if (getCurrentTheme() !== next) {
          toggleTheme();
          setTheme(next as Theme);
        }
        return;
      }
      if (cand.id === 'settings.language.toggle') {
        const next = i18n.language === 'de' ? 'en' : 'de';
        void i18n.changeLanguage(next);
        localStorage.setItem('bim-ai:lang', next);
        return;
      }
      if (cand.kind === 'view') {
        select(cand.id);
      }
    },
    [i18n, select, setPlanTool],
  );

  const handlePlaceFamilyType = useCallback(
    (kind: FamilyLibraryPlaceKind, typeId: string) => {
      setPendingPlacement({ kind, typeId });
      switch (kind) {
        case 'door':
          setPlanTool('door');
          break;
        case 'window':
          setPlanTool('window');
          break;
        case 'wall_type':
          setPlanTool('wall');
          break;
        case 'floor_type':
          setPlanTool('floor');
          break;
        case 'roof_type':
          // No legacy 'roof' plan tool; the type is staged for the next roof draw.
          break;
        case 'stair':
        case 'railing':
          // No legacy plan tool for these; the type is staged for the workbench draw.
          break;
      }
    },
    [setPlanTool],
  );

  const handlePlaceCatalogFamily = useCallback(
    async (placement: ExternalCatalogPlacement) => {
      if (!modelId) return;
      const safeFamId = placement.family.id.replace(/[^A-Za-z0-9_-]/g, '_');
      const newTypeId = `ft-${safeFamId}-${Date.now().toString(36)}`;
      const kind: FamilyLibraryPlaceKind =
        placement.family.discipline === 'door' || placement.family.discipline === 'window'
          ? (placement.family.discipline as FamilyLibraryPlaceKind)
          : 'wall_type';
      const discipline =
        placement.family.discipline === 'door' || placement.family.discipline === 'window'
          ? placement.family.discipline
          : 'generic';
      const cmd = {
        type: 'upsertFamilyType',
        id: newTypeId,
        discipline,
        parameters: {
          name: placement.defaultType.name,
          familyId: placement.family.id,
          ...placement.defaultType.parameters,
        },
        catalogSource: {
          catalogId: placement.catalogId,
          familyId: placement.family.id,
          version: placement.catalogVersion,
        },
      };
      try {
        await applyCommandBundle(modelId, [cmd], { userId: 'component-tool' });
      } catch (err) {
        log.error('component-tool', 'applyCommandBundle failed', err);
        return;
      }
      setPendingPlacement({ kind, typeId: newTypeId });
    },
    [modelId, setPendingPlacement],
  );

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor(seedLoading ? 'canvas-loading' : 'canvas-empty');
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;

  /* ── Compose AppShell slots ───────────────────────────────────────── */
  return (
    <>
      <CheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        context={{
          selectedElementIds: selectedId ? [selectedId] : [],
          activeViewId: null,
        }}
      />
      <FamilyLibraryPanel
        open={familyLibraryOpen}
        onClose={() => setFamilyLibraryOpen(false)}
        elementsById={elementsById}
        onPlaceType={handlePlaceFamilyType}
        onPlaceCatalogFamily={handlePlaceCatalogFamily}
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
        onInsertSeed={() => void insertSeedHouse()}
        onSaveSnapshot={handleSaveSnapshot}
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
        onLinkDxf={(file) => {
          // FED-04: same shell-level placement as onLinkIfc — the workspace
          // doesn't know the host model id, so we surface the selection and
          // route the actual POST through the model-aware caller (which
          // hands the file to /api/models/<hostId>/import-dxf and then
          // refreshes the active level so the underlay paints).
          console.warn('link-dxf selected', { name: file.name, size: file.size });
          setManageLinksOpen(true);
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
      <AppShell
        leftCollapsed={leftRailCollapsed}
        onLeftCollapsedChange={setLeftRailCollapsed}
        topBar={
          <div className="flex w-full flex-col">
            <div className="flex w-full items-center">
              <TopBar
                mode={mode}
                onModeChange={handleModeChange}
                projectName="BIM AI seed"
                projectNameRef={projectNameRef}
                onProjectNameClick={() => setProjectMenuOpen((v) => !v)}
                onHamburgerClick={() => setLeftRailCollapsed((v) => !v)}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                onCommandPalette={() => setPaletteOpen(true)}
                onSettings={() => setCheatsheetOpen(true)}
                collaboratorsCount={Object.keys(presencePeers).length || undefined}
                onCollaboratorsClick={() => setCommentsOpen((v) => !v)}
                peers={Object.values(presencePeers)}
                avatarInitials={userDisplayName ? userDisplayName.slice(0, 2).toUpperCase() : 'BA'}
                perspectiveOptions={PERSPECTIVE_OPTIONS}
                perspectiveValue={perspectiveId}
                onPerspectiveChange={(v) => setPerspectiveId(v as PerspectiveId)}
                planStyleOptions={PLAN_STYLE_OPTIONS}
                planStyleValue={planPresentationPreset}
                onPlanStyleChange={(v) =>
                  setPlanPresentationPreset(v as 'default' | 'opening_focus' | 'room_scheme')
                }
              />
            </div>
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
        }
        leftRail={
          <WorkspaceLeftRail
            onSemanticCommand={onSemanticCommand}
            openTabFromElement={openTabFromElement}
            onModeChange={handleModeChange}
            onOpenFamilyLibrary={() => setFamilyLibraryOpen(true)}
          />
        }
        leftRailCollapsed={<LeftRailCollapsed sections={browserSections} />}
        canvas={
          <div style={canvasContainerStyle} data-testid="redesign-canvas-root">
            {showEmptyState ? (
              <EmptyStateOverlay
                headline={emptyHint.headline}
                hint={emptyHint.hint}
                ctaLabel={emptyHint.cta?.label ?? null}
                ctaPending={seedLoading}
                ctaError={seedError}
                onCta={() => void insertSeedHouse()}
              />
            ) : null}
            <FloatingPalette
              mode={mode}
              activeTool={legacyToToolId(planTool)}
              onToolSelect={handleToolSelect}
              disabledContext={toolDisabledContext}
            />
            <CanvasMount
              mode={(activeTab?.kind as WorkspaceMode | undefined) ?? mode}
              viewerMode={viewerMode}
              activeLevelId={
                activeTab?.kind === 'plan' || activeTab?.kind === 'plan-3d'
                  ? (activeTab.targetId ?? activeLevelId ?? '')
                  : (activeLevelId ?? '')
              }
              elementsById={elementsById}
              onSemanticCommand={(cmd) => void onSemanticCommand(cmd)}
              cameraHandleRef={planCameraHandleRef}
              initialCamera={activeTab?.viewportState?.planCamera}
              preferredSheetId={
                activeTab?.kind === 'sheet' ? (activeTab.targetId ?? undefined) : undefined
              }
              modelId={modelId ?? undefined}
              wsOn={wsOn}
              onPersistViewpointField={persistViewpointField}
            />
          </div>
        }
        rightRail={
          <WorkspaceRightRail
            mode={mode}
            onSemanticCommand={onSemanticCommand}
            onModeChange={handleModeChange}
            codePresetIds={codePresetIds}
          />
        }
        statusBar={
          <StatusBar
            level={activeLevel}
            levels={levels}
            onLevelChange={setActiveLevelId}
            toolLabel={toolRegistry[legacyToToolId(planTool)]?.label ?? null}
            gridOn={true}
            cursorMm={cursorMm}
            undoDepth={undoDepth}
            onUndo={() => void handleUndoRedo(true)}
            onRedo={() => void handleUndoRedo(false)}
            wsState={wsOn ? 'connected' : 'offline'}
            saveState="saved"
            lensMode={lensMode}
            onLensChange={setLensMode}
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
        entries={Object.values(elementsById)
          .filter((e) => (e as { kind: string }).kind === 'asset_library_entry')
          .map((e) => {
            const a = e as unknown as Record<string, unknown>;
            return {
              kind: 'asset_library_entry' as const,
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
              description: a['description'] as string | undefined,
            };
          })}
        onPlace={(_entry, _paramValues) => {
          // Canvas placement mode (U5 N-clicks) — full integration in canvas layer
        }}
      />
    </>
  );
}
