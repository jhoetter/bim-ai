import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import { ICON_SIZE, Icons } from '@bim-ai/ui';

import { Viewport } from '../Viewport';
import { log } from '../logger';
import { PlanCanvas, type PlanCameraHandle } from '../plan/PlanCanvas';
import {
  applyCommand,
  bootstrap,
  ApiHttpError,
  fetchActivity,
  fetchBuildingPresets,
  fetchComments,
  postComment,
  patchCommentResolved,
  undoModel,
  redoModel,
  coerceDelta,
} from '../lib/api';
import { syncLastLevelElevationPropagationFromApplyResponse } from './levelDatumPropagationSync';
import { planToolsForPerspective } from './planToolsByPerspective';
import { buildPlanGridDatumInspectorLine } from './planViewDatumGridReadout';
import { LevelStack } from '../levels/LevelStack';
import {
  buildCollaborationConflictQueueV1,
  type CollaborationConflictQueueV1,
} from '../lib/collaborationConflictQueue';
import type { Snapshot, Violation } from '@bim-ai/core';
import {
  useBimStore,
  toggleTheme,
  getCurrentTheme,
  type Theme,
  type UxComment,
} from '../state/store';
import type { PerspectiveId } from '@bim-ai/core';
import { modeForHotkey } from '../state/modeController';
import { patternFor } from '../state/uiStates';
import { AppShell } from './AppShell';
import { TopBar, type WorkspaceMode } from './TopBar';
import { LeftRail, LeftRailCollapsed, type LeftRailSection } from './LeftRail';
import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { Inspector, type InspectorSelection } from './Inspector';
import {
  InspectorConstraintsFor,
  InspectorDoorEditor,
  InspectorGraphicsFor,
  InspectorIdentityFor,
  InspectorPlanViewEditor,
  InspectorPropertiesFor,
  InspectorRoomEditor,
  InspectorViewpointEditor,
  InspectorViewTemplateEditor,
  InspectorWindowEditor,
} from './InspectorContent';
import {
  AgentReviewModeShell,
  ScheduleModeShell,
  SectionModeShell,
  SheetModeShell,
} from './ModeShells';
import { ErrorBoundary } from '../ErrorBoundary';
import { CommentsPanel } from './CommentsPanel';
import { StatusBar } from './StatusBar';
import { CheatsheetModal } from '../cmd/CheatsheetModal';
import { RedesignedCommandPalette } from '../cmd/RedesignedCommandPalette';
import { type CommandCandidate } from '../cmd/commandPaletteSources';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { readOnboardingProgress, resetOnboarding } from '../onboarding/tour';
import { ToolPalette } from '../tools/ToolPalette';
import { getToolRegistry, type ToolDisabledContext, type ToolId } from '../tools/toolRegistry';
import { TabBar } from './TabBar';
import { Viewport3DLayersPanel, VIEWER_HIDDEN_KIND_KEYS } from './Viewport3DLayersPanel';
import { AuthoringWorkbenchesPanel } from './AuthoringWorkbenchesPanel';
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
import { AdvisorPanel } from '../advisor/AdvisorPanel';
import {
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from './browserRenderingBudgetReadout';
import { VVDialog } from './VVDialog';

/**
 * RedesignedWorkspace — composition route for the §11–§17 chrome.
 *
 * Mounted at `/redesign`. Reads from `useBimStore` (same data as the
 * legacy `Workspace.tsx`) so engineers can A/B compare the two surfaces
 * without forking state. The canvas slot reuses the existing `Viewport`
 * / `PlanCanvas` components — only the chrome (TopBar / LeftRail /
 * Inspector / StatusBar / ToolPalette) is new.
 *
 * Spec sections wired here: §7 modes (1–7), §8 layout grid, §11 TopBar,
 * §12 Project Browser, §13 Inspector, §16 Tool palette, §17 StatusBar.
 */

function mapComments(rows: Record<string, unknown>[]): UxComment[] {
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    userDisplay: String(row.userDisplay ?? row.user_display ?? ''),
    body: String(row.body ?? ''),
    elementId: (row.elementId ?? row.element_id ?? null) as string | null,
    levelId: (row.levelId ?? row.level_id ?? null) as string | null,
    anchorXMm:
      row.anchorXMm !== undefined
        ? Number(row.anchorXMm)
        : row.anchor_x_mm !== undefined
          ? Number(row.anchor_x_mm)
          : null,
    anchorYMm:
      row.anchorYMm !== undefined
        ? Number(row.anchorYMm)
        : row.anchor_y_mm !== undefined
          ? Number(row.anchor_y_mm)
          : null,
    resolved: Boolean(row.resolved),
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
  }));
}

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

const KNOWN_PLAN_TOOLS = new Set<ToolId>(['select', 'wall', 'door', 'window', 'room', 'dimension']);

type LegacyPlanTool =
  | 'select'
  | 'wall'
  | 'floor'
  | 'door'
  | 'window'
  | 'room'
  | 'room_rectangle'
  | 'grid'
  | 'dimension'
  | 'align'
  | 'split'
  | 'trim'
  | 'wall-join';

function toolIdToLegacy(tool: ToolId): LegacyPlanTool | null {
  if (KNOWN_PLAN_TOOLS.has(tool)) return tool as LegacyPlanTool;
  return null;
}

function legacyToToolId(legacy: LegacyPlanTool): ToolId {
  if (legacy === 'room_rectangle') return 'room';
  if (legacy === 'grid') return 'select';
  return legacy as ToolId;
}

export function RedesignedWorkspace(): JSX.Element {
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
  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const toggleViewerCategoryHidden = useBimStore((s) => s.toggleViewerCategoryHidden);
  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const setViewerClipElevMm = useBimStore((s) => s.setViewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const setViewerClipFloorElevMm = useBimStore((s) => s.setViewerClipFloorElevMm);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);
  const presencePeers = useBimStore((s) => s.presencePeers);
  const userDisplayName = useBimStore((s) => s.userDisplayName);
  const modelId = useBimStore((s) => s.modelId);
  const comments = useBimStore((s) => s.comments);
  const revision = useBimStore((s) => s.revision);
  const setComments = useBimStore((s) => s.setComments);
  const perspectiveId = useBimStore((s) => s.perspectiveId);
  const setPerspectiveId = useBimStore((s) => s.setPerspectiveId);
  const planPresentationPreset = useBimStore((s) => s.planPresentationPreset);
  const setPlanPresentationPreset = useBimStore((s) => s.setPlanPresentationPreset);
  const violations = useBimStore((s) => s.violations);
  const activityEvents = useBimStore((s) => s.activityEvents);
  const setActivity = useBimStore((s) => s.setActivity);
  const vvDialogOpen = useBimStore((s) => s.vvDialogOpen);
  const openVVDialog = useBimStore((s) => s.openVVDialog);
  const closeVVDialog = useBimStore((s) => s.closeVVDialog);
  const setOrthoSnapHold = useBimStore((s) => s.setOrthoSnapHold);
  const applyDelta = useBimStore((s) => s.applyDelta);
  const setPresencePeers = useBimStore((s) => s.setPresencePeers);
  const mergeComment = useBimStore((s) => s.mergeComment);
  const buildingPreset = useBimStore((s) => s.buildingPreset);
  const setBuildingPreset = useBimStore((s) => s.setBuildingPreset);

  const [mode, setMode] = useState<WorkspaceMode>(() =>
    viewerMode === 'orbit_3d' ? '3d' : 'plan',
  );
  const [theme, setTheme] = useState<Theme>(() => (getCurrentTheme() as Theme) ?? 'light');
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [tourOpen, setTourOpen] = useState<boolean>(() => !readOnboardingProgress().completed);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [collaborationConflictQueue, setCollaborationConflictQueue] =
    useState<CollaborationConflictQueueV1 | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [codePresetIds, setCodePresetIds] = useState<string[]>([
    'residential',
    'commercial',
    'office',
  ]);
  const [undoDepth, setUndoDepth] = useState(0);
  const [wsOn, setWsOn] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
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
  }, []);

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
    [hydrateFromSnapshot],
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

  const persistViewpointHiddenKinds = useCallback(async () => {
    const st = useBimStore.getState();
    const vid = st.activeViewpointId;
    if (!vid || st.viewerMode !== 'orbit_3d') return;
    const hidden = VIEWER_HIDDEN_KIND_KEYS.filter((k) => st.viewerCategoryHidden[k]);
    await onSemanticCommand({
      type: 'updateElementProperty',
      elementId: vid,
      key: 'hiddenSemanticKinds3d',
      value: JSON.stringify(hidden),
    });
  }, [onSemanticCommand]);

  const persistViewpointClipPlanes = useCallback(async () => {
    const st = useBimStore.getState();
    const vid = st.activeViewpointId;
    if (!vid || st.viewerMode !== 'orbit_3d') return;
    await onSemanticCommand({
      type: 'updateElementProperty',
      elementId: vid,
      key: 'viewerClipCapElevMm',
      value: st.viewerClipElevMm == null ? '' : String(st.viewerClipElevMm),
    });
    await onSemanticCommand({
      type: 'updateElementProperty',
      elementId: vid,
      key: 'viewerClipFloorElevMm',
      value: st.viewerClipFloorElevMm == null ? '' : String(st.viewerClipFloorElevMm),
    });
  }, [onSemanticCommand]);

  const insertSeedHouse = useCallback(async (): Promise<void> => {
    setSeedLoading(true);
    setSeedError(null);
    try {
      const bx = await bootstrap();
      const pj = bx.projects as Record<string, unknown>[] | undefined;
      const m0 = pj?.[0]?.models as Array<{ id?: unknown }> | undefined;
      const mid = m0?.[0]?.id;
      if (typeof mid !== 'string') throw new Error('No models — run make seed');
      const snapRes = await fetch(`/api/models/${encodeURIComponent(mid)}/snapshot`);
      if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
      const snap = (await snapRes.json()) as Snapshot;
      hydrateFromSnapshot(snap);
      // Fetch supporting data
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
        .catch((err) => log.error('insertSeedHouse', 'fetchActivity failed', err));
      fetchComments(mid)
        .then((c) => {
          setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
        })
        .catch((err) => log.error('insertSeedHouse', 'fetchComments failed', err));
      // Open WebSocket for real-time collaboration
      const disableWs =
        typeof import.meta.env.VITE_E2E_DISABLE_WS === 'string' &&
        ['1', 'true', 'yes'].includes(import.meta.env.VITE_E2E_DISABLE_WS.trim().toLowerCase());
      if (!disableWs) {
        const p = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${p}://${window.location.host}/ws/${encodeURIComponent(mid)}`);
        wsRef.current = ws;
        ws.onopen = () => setWsOn(true);
        ws.onclose = () => setWsOn(false);
        ws.onmessage = (evt) => {
          const payload = JSON.parse(String(evt.data)) as Record<string, unknown>;
          const t = payload.type;
          if (t === 'snapshot') {
            const s = payload as unknown as Snapshot;
            if (s.modelId) hydrateFromSnapshot(s);
          } else if (t === 'delta') {
            const dd = coerceDelta(payload);
            if (dd) applyDelta(dd);
          } else if (t === 'presence_state') {
            const pl = payload.payload as Record<string, unknown> | undefined;
            const px = ((pl?.peers as Record<string, unknown>) ?? {}) as Parameters<
              typeof setPresencePeers
            >[0];
            setPresencePeers(px);
          } else if (t === 'comment_event') {
            const w = payload.payload as Record<string, unknown> | undefined;
            if (!w) return;
            mergeComment(mapComments([w])[0]!);
          }
        };
      }
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to load seed');
    } finally {
      setSeedLoading(false);
    }
  }, [hydrateFromSnapshot, setActivity, applyDelta, setPresencePeers, mergeComment, setComments]);

  useEffect(() => {
    void fetchBuildingPresets()
      .then((ids) => {
        if (ids.length) setCodePresetIds(ids);
      })
      .catch((err) => log.error('bootstrap', 'fetchBuildingPresets failed', err));
  }, []);

  useEffect(() => {
    const isEmpty = Object.keys(elementsById).length === 0;
    if (!isEmpty) return;
    void insertSeedHouse();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
    // Run-once bootstrap: re-running is the user's job via the empty-state CTA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Presence heartbeat — sends viewer/selection state to collaborators every ~2.3s
  useEffect(() => {
    const id = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const st = useBimStore.getState();
      ws.send(
        JSON.stringify({
          type: 'presence_update',
          peerId: st.peerId,
          userId: st.userId,
          name: st.userDisplayName,
          selectionId: st.selectedId,
          viewer: st.viewerMode,
        }),
      );
    }, 2300);
    return () => window.clearInterval(id);
  }, []);

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
  }, [handleModeChange, handleUndoRedo, setPlanTool, setOrthoSnapHold, openVVDialog]);

  /* ── Project Browser sections ─────────────────────────────────────── */
  const browserSections = useMemo<LeftRailSection[]>(() => {
    const levels = (Object.values(elementsById) as Element[])
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const planViews = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view',
    );
    const viewpoints = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'viewpoint' }> => e.kind === 'viewpoint',
    );
    const sections = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut',
    );
    const sheets = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet',
    );
    const schedules = (Object.values(elementsById) as Element[]).filter(
      (e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule',
    );
    return [
      {
        id: 'project',
        label: 'Project',
        rows: [
          {
            id: 'levels',
            label: 'Levels',
            children: levels.map((l) => ({ id: l.id, label: l.name, hint: `${l.elevationMm}mm` })),
          },
        ],
      },
      {
        id: 'views',
        label: 'Views',
        rows: [
          {
            id: 'plans',
            label: 'Floor Plans',
            children: planViews.map((p) => ({ id: p.id, label: p.name })),
          },
          {
            id: 'viewpoints',
            label: '3D Views',
            children: viewpoints.map((v) => ({ id: v.id, label: v.name })),
          },
          {
            id: 'sections',
            label: 'Sections',
            children: sections.map((s) => ({ id: s.id, label: s.name })),
          },
        ],
      },
      {
        id: 'sheets',
        label: 'Sheets',
        rows: sheets.map((s) => ({ id: s.id, label: s.name })),
      },
      {
        id: 'schedules',
        label: 'Schedules',
        rows: schedules.map((s) => ({ id: s.id, label: s.name })),
      },
      {
        id: 'types',
        label: 'Types',
        rows: [
          {
            id: 'wall-types',
            label: 'Wall Types',
            children: [
              ...(Object.values(elementsById) as Element[])
                .filter((e): e is Extract<Element, { kind: 'wall_type' }> => e.kind === 'wall_type')
                .map((t) => ({ id: t.id, label: t.name, hint: `${t.layers.length} layers` })),
              { id: 'new-wall-type', label: '+ New Wall Type' },
            ],
          },
          {
            id: 'floor-types',
            label: 'Floor Types',
            children: [
              ...(Object.values(elementsById) as Element[])
                .filter(
                  (e): e is Extract<Element, { kind: 'floor_type' }> => e.kind === 'floor_type',
                )
                .map((t) => ({ id: t.id, label: t.name, hint: `${t.layers.length} layers` })),
              { id: 'new-floor-type', label: '+ New Floor Type' },
            ],
          },
          {
            id: 'roof-types',
            label: 'Roof Types',
            children: [
              ...(Object.values(elementsById) as Element[])
                .filter((e): e is Extract<Element, { kind: 'roof_type' }> => e.kind === 'roof_type')
                .map((t) => ({ id: t.id, label: t.name, hint: `${t.layers.length} layers` })),
              { id: 'new-roof-type', label: '+ New Roof Type' },
            ],
          },
        ],
      },
      {
        id: 'families',
        label: 'Families',
        rows: (['door', 'window', 'stair', 'railing'] as const)
          .map((disc) => {
            const discLabel = (
              { door: 'Doors', window: 'Windows', stair: 'Stairs', railing: 'Railings' } as const
            )[disc];
            const customOfDisc = (Object.values(elementsById) as Element[]).filter(
              (e): e is Extract<Element, { kind: 'family_type' }> =>
                e.kind === 'family_type' && e.discipline === disc,
            );
            const builtInRows = BUILT_IN_FAMILIES.filter((f) => f.discipline === disc).map(
              (fam) => ({
                id: fam.id,
                label: fam.name,
                children: fam.defaultTypes.map((t) => ({ id: t.id, label: t.name })),
              }),
            );
            const customRows = customOfDisc.map((ct) => ({
              id: ct.id,
              label: String(ct.parameters.name ?? ct.id),
              hint: 'custom',
            }));
            return {
              id: `fam-group-${disc}`,
              label: discLabel,
              children: [...builtInRows, ...customRows],
            };
          })
          .filter((g) => g.children.length > 0),
      },
    ];
  }, [elementsById]);

  /* ── Plan view grid datum readout ────────────────────────────────── */
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const planGridDatumLine = useMemo(() => {
    if (!selectedId) return '';
    const el = elementsById[selectedId];
    if (!el || el.kind !== 'plan_view') return '';
    return buildPlanGridDatumInspectorLine(elementsById, planProjectionPrimitives, el.id);
  }, [selectedId, elementsById, planProjectionPrimitives]);

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

  /* ── Active family type — highlights matching row in family browser ── */
  const activeFamilyTypeId = useMemo(() => {
    if (!selectedId) return undefined;
    const el = elementsById[selectedId];
    if (!el) return undefined;
    if (el.kind === 'door' || el.kind === 'window') return el.familyTypeId ?? undefined;
    return undefined;
  }, [selectedId, elementsById]);

  /* ── Inspector selection ──────────────────────────────────────────── */
  const inspectorSelection = useMemo<InspectorSelection | null>(() => {
    if (!selectedId) return null;
    const el = elementsById[selectedId];
    if (!el) return null;
    return {
      label: `${humanKindLabel(el.kind)} · ${(el as { name?: string }).name ?? el.id}`,
      id: el.id,
    };
  }, [elementsById, selectedId]);

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

  const handleThemeToggle = useCallback(() => {
    const next = toggleTheme() === 'dark' ? 'dark' : 'light';
    setTheme(next as Theme);
  }, []);

  /* ── Command palette candidates (§18) ─────────────────────────────── */
  const paletteCandidates = useMemo<CommandCandidate[]>(() => {
    const items: CommandCandidate[] = [];
    // Tool sources
    for (const tool of Object.values(toolRegistry)) {
      items.push({
        id: `tool.${tool.id}`,
        kind: 'tool',
        label: tool.label,
        keywords: tool.tooltip ?? '',
        hint: tool.hotkey,
      });
    }
    // View sources (plan views + viewpoints + section cuts)
    for (const el of Object.values(elementsById) as Element[]) {
      if (el.kind === 'plan_view') {
        items.push({ id: el.id, kind: 'view', label: `Plan: ${el.name}`, keywords: 'plan view' });
      } else if (el.kind === 'viewpoint') {
        items.push({
          id: el.id,
          kind: 'view',
          label: `3D: ${el.name}`,
          keywords: 'viewpoint orbit',
        });
      } else if (el.kind === 'section_cut') {
        items.push({
          id: el.id,
          kind: 'view',
          label: `Section: ${el.name}`,
          keywords: 'section cut',
        });
      }
    }
    // Element sources (walls / doors / windows / rooms — top-N keep light)
    let elemCount = 0;
    for (const el of Object.values(elementsById) as Element[]) {
      if (el.kind !== 'wall' && el.kind !== 'door' && el.kind !== 'window' && el.kind !== 'room')
        continue;
      if (elemCount > 60) break;
      items.push({
        id: el.id,
        kind: 'element',
        label: `${el.kind}: ${(el as { name?: string }).name ?? el.id}`,
        keywords: el.kind,
      });
      elemCount++;
    }
    // Settings
    items.push(
      { id: 'settings.theme.light', kind: 'setting', label: 'Theme: light', keywords: 'light' },
      { id: 'settings.theme.dark', kind: 'setting', label: 'Theme: dark', keywords: 'dark' },
      {
        id: 'settings.language.toggle',
        kind: 'setting',
        label: t('cmd.language'),
        keywords: 'language lang sprache',
      },
    );
    // Agent
    items.push({ id: 'agent.review', kind: 'agent', label: 'Run Agent Review' });
    return items;
  }, [elementsById, t]);

  const handlePalettePick = useCallback(
    (cand: CommandCandidate) => {
      setRecentCommandIds((prev) => [cand.id, ...prev.filter((id) => id !== cand.id)].slice(0, 5));
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

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor(seedLoading ? 'canvas-loading' : 'canvas-empty');
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;

  /* ── Compose AppShell slots ───────────────────────────────────────── */
  return (
    <>
      <CheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <RedesignedCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        candidates={paletteCandidates}
        recentIds={recentCommandIds}
        onPick={handlePalettePick}
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
      />
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
          <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border p-2">
              <LevelStack
                levels={(Object.values(elementsById) as Element[])
                  .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
                  .sort((a, b) => a.elevationMm - b.elevationMm)}
                activeId={activeLevelId ?? ''}
                setActive={setActiveLevelId}
                onElevationCommitted={(levelId, elevationMm) =>
                  void onSemanticCommand({ type: 'moveLevelElevation', levelId, elevationMm })
                }
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LeftRail
                sections={browserSections}
                activeRowId={activeFamilyTypeId ?? activeLevelId}
                onRowActivate={(id) => {
                  // "New type" action rows in the Types browser section.
                  if (id === 'new-wall-type') {
                    void onSemanticCommand({
                      type: 'upsertWallType',
                      id: crypto.randomUUID(),
                      name: 'New Wall Type',
                      basisLine: 'center',
                      layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
                    });
                    return;
                  }
                  if (id === 'new-floor-type') {
                    void onSemanticCommand({
                      type: 'upsertFloorType',
                      id: crypto.randomUUID(),
                      name: 'New Floor Type',
                      layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
                    });
                    return;
                  }
                  if (id === 'new-roof-type') {
                    void onSemanticCommand({
                      type: 'upsertRoofType',
                      id: crypto.randomUUID(),
                      name: 'New Roof Type',
                      layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
                    });
                    return;
                  }
                  // Family type rows — assign to the currently selected compatible element.
                  const pickedType = BUILT_IN_FAMILIES.flatMap((f) => f.defaultTypes).find(
                    (t) => t.id === id,
                  );
                  if (pickedType) {
                    if (selectedId) {
                      const selEl = elementsById[selectedId];
                      if (selEl && selEl.kind === pickedType.discipline) {
                        void onSemanticCommand({
                          type: 'updateElementProperty',
                          elementId: selectedId,
                          key: 'familyTypeId',
                          value: id,
                        });
                      }
                    }
                    return;
                  }

                  const el = elementsById[id];
                  if (!el) {
                    // Levels nest under "project" → "levels"; check the nested children.
                    const isLevel = browserSections
                      .find((s) => s.id === 'project')
                      ?.rows.find((r) => r.id === 'levels')
                      ?.children?.some((c) => c.id === id);
                    if (isLevel) setActiveLevelId(id);
                    return;
                  }
                  if (el.kind === 'level') {
                    setActiveLevelId(id);
                    openTabFromElement(el);
                    handleModeChange('plan');
                    return;
                  }
                  if (el.kind === 'plan_view') {
                    openTabFromElement(el);
                    handleModeChange('plan');
                    select(id);
                    return;
                  }
                  if (el.kind === 'viewpoint') {
                    openTabFromElement(el);
                    handleModeChange('3d');
                    select(id);
                    return;
                  }
                  if (el.kind === 'section_cut') {
                    openTabFromElement(el);
                    handleModeChange('section');
                    select(id);
                    return;
                  }
                  if (el.kind === 'sheet') {
                    openTabFromElement(el);
                    handleModeChange('sheet');
                    select(id);
                    return;
                  }
                  if (el.kind === 'schedule') {
                    openTabFromElement(el);
                    handleModeChange('schedule');
                    select(id);
                    return;
                  }
                  select(id);
                }}
              />
            </div>
          </div>
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
        rightRail={(() => {
          const el = selectedId ? elementsById[selectedId] : undefined;
          const show3dLayers = mode === '3d' || mode === 'plan-3d';
          return (
            <div className="h-full overflow-y-auto">
              <div>
                <Inspector
                  selection={inspectorSelection}
                  tabs={{
                    properties: el ? (
                      el.kind === 'plan_view' ? (
                        <>
                          {planGridDatumLine ? (
                            <p className="mb-2 break-all font-mono text-[10px] leading-snug text-muted">
                              {planGridDatumLine}
                            </p>
                          ) : null}
                          <InspectorPlanViewEditor
                            el={el}
                            elementsById={elementsById}
                            revision={revision}
                            onPersistProperty={(key, value) => {
                              if (key === '__applyTemplate__') {
                                const p = JSON.parse(value) as {
                                  planViewId: string;
                                  templateId: string;
                                };
                                void onSemanticCommand({ type: 'applyPlanViewTemplate', ...p });
                              } else {
                                void onSemanticCommand({
                                  type: 'updateElementProperty',
                                  elementId: el.id,
                                  key,
                                  value,
                                });
                              }
                            }}
                          />
                        </>
                      ) : el.kind === 'room' ? (
                        <InspectorRoomEditor
                          el={el}
                          revision={revision}
                          onPersistProperty={(key, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key,
                              value,
                            })
                          }
                        />
                      ) : el.kind === 'viewpoint' ? (
                        <InspectorViewpointEditor
                          el={el}
                          revision={revision}
                          onPersistProperty={(key, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key,
                              value,
                            })
                          }
                        />
                      ) : el.kind === 'view_template' ? (
                        <InspectorViewTemplateEditor
                          el={el}
                          revision={revision}
                          onPersistProperty={(key, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key,
                              value,
                            })
                          }
                        />
                      ) : el.kind === 'door' ? (
                        <InspectorDoorEditor
                          el={el}
                          revision={revision}
                          elementsById={elementsById}
                          onPersistProperty={(key, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key,
                              value,
                            })
                          }
                          onCreateType={(_baseFamilyId, _name, params) =>
                            void onSemanticCommand({
                              type: 'upsertFamilyType',
                              discipline: 'door',
                              parameters: params,
                            })
                          }
                        />
                      ) : el.kind === 'window' ? (
                        <InspectorWindowEditor
                          el={el}
                          revision={revision}
                          elementsById={elementsById}
                          onPersistProperty={(key, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key,
                              value,
                            })
                          }
                          onCreateType={(_baseFamilyId, _name, params) =>
                            void onSemanticCommand({
                              type: 'upsertFamilyType',
                              discipline: 'window',
                              parameters: params,
                            })
                          }
                        />
                      ) : (
                        InspectorPropertiesFor(el, t, {
                          elementsById,
                          onPropertyChange: (property, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key: property,
                              value,
                            }),
                        })
                      )
                    ) : (
                      <InspectorEmptyTab message="No element selected." />
                    ),
                    constraints: el ? (
                      InspectorConstraintsFor(el, t)
                    ) : (
                      <InspectorEmptyTab message="No element selected." />
                    ),
                    identity: el ? (
                      InspectorIdentityFor(el, t)
                    ) : (
                      <InspectorEmptyTab message="No element selected." />
                    ),
                    graphics:
                      el && (el.kind === 'plan_view' || el.kind === 'view_template') ? (
                        <InspectorGraphicsFor
                          el={el}
                          elementsById={elementsById}
                          revision={revision}
                          onPersistProperty={(key, value) =>
                            void onSemanticCommand({
                              type: 'updateElementProperty',
                              elementId: el.id,
                              key,
                              value,
                            })
                          }
                        />
                      ) : undefined,
                  }}
                  emptyStateActions={[
                    {
                      hotkey: 'W',
                      label: 'Draw a wall',
                      onTrigger: () => {
                        if (mode !== 'plan' && mode !== 'plan-3d') handleModeChange('plan');
                        setPlanTool('wall');
                      },
                    },
                    {
                      hotkey: 'D',
                      label: 'Insert a door',
                      onTrigger: () => {
                        if (mode !== 'plan' && mode !== 'plan-3d') handleModeChange('plan');
                        setPlanTool('door');
                      },
                    },
                    {
                      hotkey: 'M',
                      label: 'Drop a room marker',
                      onTrigger: () => {
                        if (mode !== 'plan' && mode !== 'plan-3d') handleModeChange('plan');
                        setPlanTool('room');
                      },
                    },
                  ]}
                  onClearSelection={() => select(undefined)}
                />
              </div>
              {show3dLayers ? (
                <div className="border-t border-border">
                  <Viewport3DLayersPanel
                    viewerCategoryHidden={viewerCategoryHidden}
                    onToggleCategory={toggleViewerCategoryHidden}
                    viewerClipElevMm={viewerClipElevMm}
                    onSetClipElevMm={setViewerClipElevMm}
                    viewerClipFloorElevMm={viewerClipFloorElevMm}
                    onSetClipFloorElevMm={setViewerClipFloorElevMm}
                    activeViewpointId={activeViewpointId ?? undefined}
                  />
                </div>
              ) : null}
              <div className="border-t border-border">
                <AuthoringWorkbenchesPanel
                  selected={el}
                  elementsById={elementsById}
                  activeLevelId={activeLevelId ?? ''}
                  onUpsertSemantic={(cmd) => void onSemanticCommand(cmd)}
                />
              </div>
              <div className="border-t border-border p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {t('advisor.heading')}
                </div>
                <AdvisorPanel
                  violations={violations}
                  selectionId={selectedId ?? undefined}
                  preset={buildingPreset}
                  onPreset={setBuildingPreset}
                  codePresets={codePresetIds}
                  onApplyQuickFix={(cmd) => void onSemanticCommand(cmd)}
                  perspective={perspectiveId}
                />
              </div>
              {activityEvents.length > 0 ? (
                <div className="border-t border-border p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {t('activity.heading')}
                  </div>
                  <ul className="space-y-1 text-[11px] text-muted">
                    {activityEvents.map((a) => (
                      <li key={a.id}>
                        r{a.revisionAfter} · {a.commandTypes[0] ?? '?'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })()}
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
          />
        }
      />
    </>
  );
}

const canvasContainerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

function FloatingPalette({
  mode,
  activeTool,
  onToolSelect,
  disabledContext,
}: {
  mode: WorkspaceMode;
  activeTool: ToolId;
  onToolSelect: (id: ToolId) => void;
  disabledContext: ToolDisabledContext;
}): JSX.Element | null {
  if (mode === 'sheet' || mode === 'schedule' || mode === 'agent') return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
    >
      <ToolPalette
        mode={mode}
        activeTool={activeTool}
        onToolSelect={onToolSelect}
        disabledContext={disabledContext}
      />
    </div>
  );
}

function CanvasMount({
  mode,
  viewerMode,
  activeLevelId,
  elementsById,
  onSemanticCommand,
  cameraHandleRef,
  initialCamera,
  preferredSheetId,
  modelId,
  wsOn,
  onPersistViewpointField,
}: {
  mode: WorkspaceMode;
  viewerMode: 'plan_canvas' | 'orbit_3d';
  activeLevelId: string;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void;
  cameraHandleRef?: RefObject<PlanCameraHandle | null>;
  initialCamera?: { centerMm?: { xMm: number; yMm: number }; halfMm?: number };
  preferredSheetId?: string;
  modelId?: string;
  wsOn?: boolean;
  onPersistViewpointField?: (p: {
    elementId: string;
    key: string;
    value: string;
  }) => void | Promise<void>;
}): JSX.Element {
  if (mode === 'plan-3d') {
    return (
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', width: '100%' }}
      >
        <div style={{ position: 'relative', borderRight: '1px solid var(--color-border)' }}>
          <PlanCanvas
            wsConnected={wsOn ?? false}
            activeLevelResolvedId={activeLevelId ?? ''}
            onSemanticCommand={onSemanticCommand}
            cameraHandleRef={cameraHandleRef}
            initialCamera={initialCamera}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <Viewport wsConnected={wsOn ?? false} onPersistViewpointField={onPersistViewpointField} />
        </div>
      </div>
    );
  }
  if (mode === '3d')
    return (
      <ErrorBoundary label="Viewport3D">
        <Viewport wsConnected={wsOn ?? false} onPersistViewpointField={onPersistViewpointField} />
      </ErrorBoundary>
    );
  if (mode === 'plan')
    return (
      <PlanCanvas
        wsConnected={wsOn ?? false}
        activeLevelResolvedId={activeLevelId}
        onSemanticCommand={onSemanticCommand}
        cameraHandleRef={cameraHandleRef}
        initialCamera={initialCamera}
      />
    );
  if (mode === 'section')
    return <SectionModeShell activeLevelLabel={activeLevelId} modelId={modelId} />;
  if (mode === 'sheet')
    return <SheetModeShell elementsById={elementsById} preferredSheetId={preferredSheetId} />;
  if (mode === 'schedule')
    return (
      <ErrorBoundary label="SchedulePanel">
        <ScheduleModeShell elementsById={elementsById} />
      </ErrorBoundary>
    );
  if (mode === 'agent')
    return (
      <ErrorBoundary label="AgentReviewPane">
        <AgentReviewModeShell onApplyQuickFix={onSemanticCommand} />
      </ErrorBoundary>
    );
  return viewerMode === 'orbit_3d' ? (
    <Viewport wsConnected={wsOn ?? false} onPersistViewpointField={onPersistViewpointField} />
  ) : (
    <PlanCanvas
      wsConnected={wsOn ?? false}
      activeLevelResolvedId={activeLevelId}
      onSemanticCommand={onSemanticCommand}
    />
  );
}

function EmptyStateOverlay({
  headline,
  hint,
  ctaLabel,
  ctaPending,
  ctaError,
  onCta,
}: {
  headline: string;
  hint: string;
  ctaLabel: string | null;
  ctaPending: boolean;
  ctaError: string | null;
  onCta: () => void;
}): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-lg bg-surface/95 px-6 py-5 text-center shadow-elev-2 backdrop-blur">
        <div className="text-md font-medium text-foreground">{headline}</div>
        <div className="text-sm text-muted">{hint}</div>
        {ctaLabel ? (
          <button
            type="button"
            onClick={onCta}
            disabled={ctaPending}
            data-testid="canvas-empty-cta"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground shadow-elev-1 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ctaPending ? 'Loading…' : ctaLabel}
          </button>
        ) : null}
        {ctaError ? (
          <div className="text-xs text-danger" data-testid="canvas-empty-error">
            {ctaError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InspectorEmptyTab({ message }: { message: string }): JSX.Element {
  return <p className="text-sm text-muted">{message}</p>;
}

function humanKindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Default tab descriptor when a mode pill (or tab `+`) is clicked
 * with no specific element. Picks the active level for plan/plan-3d,
 * the first viewpoint for 3d, the first section for section, etc. */
function defaultTabFallbackForKind(
  kind: WorkspaceMode | TabKind,
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
): { targetId?: string; label: string } | null {
  const all = Object.values(elementsById) as Element[];
  if (kind === 'plan' || kind === 'plan-3d') {
    const levels = all
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const lvl = levels.find((l) => l.id === activeLevelId) ?? levels[0];
    if (!lvl) return { label: kind === 'plan' ? 'Plan' : 'Plan + 3D' };
    return {
      targetId: lvl.id,
      label: kind === 'plan' ? `Plan · ${lvl.name}` : `Plan + 3D · ${lvl.name}`,
    };
  }
  if (kind === '3d') {
    const vp = all.find(
      (e): e is Extract<Element, { kind: 'viewpoint' }> => e.kind === 'viewpoint',
    );
    if (vp) return { targetId: vp.id, label: `3D · ${vp.name}` };
    return { label: '3D · Default' };
  }
  if (kind === 'section') {
    const sec = all.find(
      (e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut',
    );
    if (sec) return { targetId: sec.id, label: `Section · ${sec.name}` };
    return { label: 'Section' };
  }
  if (kind === 'sheet') {
    const sht = all.find((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet');
    if (sht) return { targetId: sht.id, label: `Sheet · ${sht.name}` };
    return { label: 'Sheet' };
  }
  if (kind === 'schedule') {
    const s = all.find((e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule');
    if (s) return { targetId: s.id, label: `Schedule · ${s.name}` };
    return { label: 'Schedule' };
  }
  if (kind === 'agent') {
    return { label: 'Agent review' };
  }
  return null;
}

/** Suppress an unused-import warning in case the keyboard bindings change. */
export type { KeyboardEvent };
