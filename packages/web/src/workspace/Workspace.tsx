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
import type { LensMode, ModelDelta, Snapshot, Violation } from '@bim-ai/core';
import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { useUnifiedAdvisorViolations } from '../advisor/unifiedAdvisorViolations';
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
  tabIdFor,
  type TabKind,
  type TabsState,
  type ViewTab,
  type ViewportSnapshot,
} from './tabsModel';
import { persistTabs, pruneTabsAgainstElements, readPersistedTabs } from './tabsPersistence';
import {
  assignTabToPane,
  assignTabToFocusedPane,
  createPaneLayout,
  focusPane,
  normalizePaneLayout,
  persistPaneLayout,
  readPersistedPaneLayout,
  splitPaneWithTab,
  type PaneLayoutState,
  type PaneNode,
  type PaneSplitDirection,
} from './paneLayout';
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
import { JobsPanel } from '../jobs/JobsPanel';
import { CheatsheetModal } from '../cmd/CheatsheetModal';
import { CommandPalette } from '../cmdPalette/CommandPalette';
import '../cmdPalette/defaultCommands';
import {
  FamilyLibraryPanel,
  type ExternalCatalogPlacement,
  type FamilyLibraryArrayFormulaUpdate,
  type FamilyLibraryPlaceKind,
} from '../families/FamilyLibraryPanel';
import { MaterialBrowserDialog } from '../familyEditor/MaterialBrowserDialog';
import { AppearanceAssetBrowserDialog } from '../familyEditor/AppearanceAssetBrowserDialog';
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
import { rememberLocalClientOp, useWorkspaceSnapshot } from './useWorkspaceSnapshot';
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
import type { SheetMarkupShape, SheetReviewMode } from './sheets/sheetReviewUi';

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

type WorkspaceComposition = {
  id: string;
  label: string;
  tabsState: TabsState;
  paneLayout: PaneLayoutState;
};

type WorkspaceCompositionState = {
  activeId: string;
  compositions: WorkspaceComposition[];
};

const COMPOSITIONS_STORAGE_KEY = 'bim-ai:workspace-compositions-v1';

function nextCompositionId(): string {
  try {
    return `composition-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `composition-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

function fallbackComposition(
  tabsState: TabsState,
  paneLayout: PaneLayoutState,
): WorkspaceCompositionState {
  const id = nextCompositionId();
  return {
    activeId: id,
    compositions: [{ id, label: 'Composition 1', tabsState, paneLayout }],
  };
}

function readPersistedCompositions(
  tabsState: TabsState,
  paneLayout: PaneLayoutState,
): WorkspaceCompositionState {
  if (typeof localStorage === 'undefined') return fallbackComposition(tabsState, paneLayout);
  try {
    const raw = localStorage.getItem(COMPOSITIONS_STORAGE_KEY);
    if (!raw) return fallbackComposition(tabsState, paneLayout);
    const parsed = JSON.parse(raw) as Partial<WorkspaceCompositionState> | null;
    if (!parsed || !Array.isArray(parsed.compositions) || !parsed.compositions.length) {
      return fallbackComposition(tabsState, paneLayout);
    }
    const compositions = parsed.compositions.filter(
      (composition): composition is WorkspaceComposition =>
        Boolean(
          composition &&
          typeof composition.id === 'string' &&
          typeof composition.label === 'string' &&
          composition.tabsState &&
          Array.isArray(composition.tabsState.tabs) &&
          composition.paneLayout,
        ),
    );
    if (!compositions.length) return fallbackComposition(tabsState, paneLayout);
    const activeId =
      typeof parsed.activeId === 'string' &&
      compositions.some((composition) => composition.id === parsed.activeId)
        ? parsed.activeId
        : compositions[0]!.id;
    return { activeId, compositions };
  } catch {
    return fallbackComposition(tabsState, paneLayout);
  }
}

function persistCompositions(state: WorkspaceCompositionState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COMPOSITIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function formatStatusMm(mm: number): string {
  return `${(mm / 1000).toFixed(1)} m`;
}

const EMPTY_JOBS_COUNTS = {
  queued: 0,
  running: 0,
  errored: 0,
} as const;

type MaterialEditableType = Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>;

function resolveMaterialEditableType(
  selected: Element | undefined,
  elementsById: Record<string, Element>,
): MaterialEditableType | null {
  if (!selected) return null;
  if (
    selected.kind === 'wall_type' ||
    selected.kind === 'floor_type' ||
    selected.kind === 'roof_type'
  ) {
    return selected;
  }
  if (selected.kind === 'wall') {
    const typeId = selected.wallTypeId;
    if (!typeId) return null;
    const type = elementsById[typeId];
    return type?.kind === 'wall_type' ? type : null;
  }
  if (selected.kind === 'floor') {
    const typeId = selected.floorTypeId;
    if (!typeId) return null;
    const type = elementsById[typeId];
    return type?.kind === 'floor_type' ? type : null;
  }
  if (selected.kind === 'roof') {
    const typeId = selected.roofTypeId;
    if (!typeId) return null;
    const type = elementsById[typeId];
    return type?.kind === 'roof_type' ? type : null;
  }
  return null;
}

function summarizeJobsCounts(rows: unknown[]): typeof EMPTY_JOBS_COUNTS {
  const counts = { ...EMPTY_JOBS_COUNTS };
  for (const row of rows) {
    const status =
      row && typeof row === 'object' && 'status' in row
        ? String((row as { status?: unknown }).status ?? '')
        : '';
    if (status === 'queued') counts.queued += 1;
    else if (status === 'running') counts.running += 1;
    else if (status === 'errored') counts.errored += 1;
  }
  return counts;
}

function collectPaneTabAssignments(root: PaneNode): Record<string, string[]> {
  const assignments: Record<string, string[]> = {};
  const walk = (node: PaneNode): void => {
    if (node.kind === 'leaf') {
      if (node.tabId) {
        const slots = assignments[node.tabId] ?? [];
        slots.push(node.id);
        assignments[node.tabId] = slots;
      }
      return;
    }
    walk(node.first);
    walk(node.second);
  };
  walk(root);
  return assignments;
}

function tabIdForLeaf(root: PaneNode, leafId: string): string | null {
  if (root.kind === 'leaf') return root.id === leafId ? root.tabId : null;
  return tabIdForLeaf(root.first, leafId) ?? tabIdForLeaf(root.second, leafId);
}

function slugToken(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function firstMmVector(value: unknown): { xMm: number; yMm: number; zMm: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const xMm = Number(row.xMm);
  const yMm = Number(row.yMm);
  const zMm = Number(row.zMm);
  if (!Number.isFinite(xMm) || !Number.isFinite(yMm) || !Number.isFinite(zMm)) return undefined;
  return { xMm, yMm, zMm };
}

function CompositionBar({
  compositions,
  activeId,
  onActivate,
  onCreate,
}: {
  compositions: WorkspaceComposition[];
  activeId: string;
  onActivate: (id: string) => void;
  onCreate: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="composition-bar"
      aria-label="Compositions"
      className="flex h-7 min-w-0 items-center gap-1 border-b border-border/70 px-1"
    >
      <div className="shrink-0 px-1 text-[10px] font-semibold uppercase text-muted">
        Compositions
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {compositions.map((composition) => {
          const active = composition.id === activeId;
          return (
            <button
              key={composition.id}
              type="button"
              data-testid={`composition-tab-${composition.id}`}
              aria-pressed={active}
              onClick={() => onActivate(composition.id)}
              className={[
                'h-5 max-w-40 shrink-0 truncate rounded border px-2 text-[11px] font-medium',
                active
                  ? 'border-accent/70 bg-accent/10 text-foreground'
                  : 'border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground',
              ].join(' ')}
              title={composition.label}
            >
              {composition.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        data-testid="composition-add-button"
        aria-label="Create composition"
        title="Create composition"
        onClick={onCreate}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-xs text-muted hover:bg-surface-2 hover:text-foreground"
      >
        +
      </button>
    </div>
  );
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
  const temporaryVisibility = useBimStore((s) => s.temporaryVisibility);
  const clearTemporaryVisibility = useBimStore((s) => s.clearTemporaryVisibility);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const planHudMm = useBimStore((s) => s.planHudMm);
  const userDisplayName = useBimStore((s) => s.userDisplayName);
  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);
  const violations = useBimStore((s) => s.violations);
  const buildingPreset = useBimStore((s) => s.buildingPreset);
  const setBuildingPreset = useBimStore((s) => s.setBuildingPreset);
  const perspectiveId = useBimStore((s) => s.perspectiveId);
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
  const { violations: unifiedAdvisorViolations } = useUnifiedAdvisorViolations(
    violations,
    modelId,
    revision,
  );
  const advisorCounts = useMemo(
    () =>
      unifiedAdvisorViolations.reduce(
        (acc, violation) => {
          acc[violation.severity] += 1;
          return acc;
        },
        { error: 0, warning: 0, info: 0 },
      ),
    [unifiedAdvisorViolations],
  );
  const firstAdvisorQuickFix = useMemo(
    () =>
      unifiedAdvisorViolations.find(
        (violation) => violation.quickFixCommand && typeof violation.quickFixCommand === 'object',
      )?.quickFixCommand as Record<string, unknown> | undefined,
    [unifiedAdvisorViolations],
  );

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
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobsCounts, setJobsCounts] = useState(EMPTY_JOBS_COUNTS);
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

  useEffect(() => {
    if (!modelId || modelId === 'empty') {
      setJobsCounts(EMPTY_JOBS_COUNTS);
      return;
    }
    let cancelled = false;

    const refreshJobs = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/jobs?modelId=${encodeURIComponent(modelId)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (cancelled) return;
        setJobsCounts(summarizeJobsCounts(Array.isArray(payload) ? payload : []));
      } catch {
        // best-effort readout; keep the last successful summary
      }
    };

    void refreshJobs();
    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [modelId]);

  const [mode, setMode] = useState<WorkspaceMode>(() =>
    viewerMode === 'orbit_3d' ? '3d' : 'plan',
  );
  const [theme, setTheme] = useState<Theme>(() => (getCurrentTheme() as Theme) ?? 'light');
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailOverride, setRightRailOverride] = useState<RailOverride>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [familyLibraryOpen, setFamilyLibraryOpen] = useState(false);
  const [materialBrowserOpen, setMaterialBrowserOpen] = useState(false);
  const [appearanceAssetBrowserOpen, setAppearanceAssetBrowserOpen] = useState(false);
  const [sheetReviewMode, setSheetReviewMode] = useState<SheetReviewMode>('cm');
  const [sheetMarkupShape, setSheetMarkupShape] = useState<SheetMarkupShape>('freehand');
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
  const previousSelectedIdRef = useRef<string | undefined>(selectedId);
  const budgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChordRef = useRef<string | null>(null);
  const pendingChordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [compositionState, setCompositionState] = useState<WorkspaceCompositionState>(() =>
    readPersistedCompositions(
      readPersistedTabs() ?? EMPTY_TABS,
      readPersistedPaneLayout() ?? createPaneLayout(null),
    ),
  );
  const [tabsState, setTabsState] = useState<TabsState>(() => {
    const activeComposition =
      compositionState.compositions.find(
        (composition) => composition.id === compositionState.activeId,
      ) ?? compositionState.compositions[0];
    return activeComposition?.tabsState ?? EMPTY_TABS;
  });
  const [draggingViewElementId, setDraggingViewElementId] = useState<string | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [secondarySidebarOpen, setSecondarySidebarOpen] = useState(true);
  const [paneLayout, setPaneLayout] = useState<PaneLayoutState>(() => {
    const activeComposition =
      compositionState.compositions.find(
        (composition) => composition.id === compositionState.activeId,
      ) ?? compositionState.compositions[0];
    return activeComposition?.paneLayout ?? createPaneLayout(null);
  });

  /** Persist tabs on every change (T-06). */
  useEffect(() => {
    persistTabs(tabsState);
  }, [tabsState]);
  useEffect(() => {
    setPaneLayout((layout) =>
      normalizePaneLayout(
        layout,
        tabsState.tabs.map((tab) => tab.id),
        tabsState.activeId,
      ),
    );
  }, [tabsState.activeId, tabsState.tabs]);
  useEffect(() => {
    persistPaneLayout(paneLayout);
  }, [paneLayout]);
  useEffect(() => {
    setCompositionState((state) => ({
      ...state,
      compositions: state.compositions.map((composition) =>
        composition.id === state.activeId ? { ...composition, tabsState, paneLayout } : composition,
      ),
    }));
  }, [paneLayout, tabsState]);
  useEffect(() => {
    persistCompositions(compositionState);
  }, [compositionState]);

  /* ── Tab helpers (§11.3) ──────────────────────────────────────────── */
  const activeTab: ViewTab | null = useMemo(
    () =>
      tabsState.activeId ? (tabsState.tabs.find((t) => t.id === tabsState.activeId) ?? null) : null,
    [tabsState],
  );
  const effectiveMode = (activeTab?.kind as WorkspaceMode | undefined) ?? mode;

  const activePlanTarget = useMemo(
    () =>
      activeTab?.kind === 'plan'
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
            if (outgoing.kind === '3d') {
              const pose = useBimStore.getState().orbitCameraPoseMm;
              if (pose) {
                snapshotted = snapshotViewport(snapshotted, s.activeId, {
                  ...(outgoing.viewportState ?? {}),
                  orbitCameraPoseMm: { eyeMm: pose.position, targetMm: pose.target },
                });
              }
            }
            // Snapshot the 2D plan camera for plan tabs (T-07 follow-up).
            if (outgoing.kind === 'plan') {
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
        if (t.kind === 'plan' && t.targetId) {
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
        if (t.kind === 'plan') {
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

  const activateDroppedView = useCallback(
    (tab: ViewTab | Omit<ViewTab, 'id'>) => {
      setMode(tab.kind as WorkspaceMode);
      if (tab.kind === 'plan') {
        setViewerMode('plan_canvas');
        if (tab.targetId) {
          const target = useBimStore.getState().elementsById[tab.targetId];
          if (target?.kind === 'plan_view') {
            activatePlanView(target.id);
          } else if (target?.kind === 'level') {
            activatePlanView(undefined);
            setActiveLevelId(target.id);
          }
        }
      } else if (tab.kind === '3d') {
        setViewerMode('orbit_3d');
        if (tab.targetId) {
          const target = useBimStore.getState().elementsById[tab.targetId];
          if (target?.kind === 'viewpoint' && target.mode === 'orbit_3d' && target.camera) {
            setOrbitCameraFromViewpointMm({
              position: target.camera.position,
              target: target.camera.target,
              up: target.camera.up,
            });
            useBimStore.getState().setActiveViewpointId(target.id);
          }
        }
      }
    },
    [activatePlanView, setActiveLevelId, setOrbitCameraFromViewpointMm, setViewerMode],
  );

  const placeViewElementInPane = useCallback(
    (
      elementId: string | null | undefined,
      leafId: string,
      direction?: PaneSplitDirection,
    ): void => {
      if (!elementId) return;
      const element = elementsById[elementId];
      if (!element) return;
      const partial = tabFromElement(element);
      if (!partial) return;
      const tabId = tabIdFor(partial.kind, partial.targetId);
      setTabsState((state) => openTab(state, partial));
      setPaneLayout((layout) => {
        const focused = focusPane(layout, leafId);
        return direction
          ? splitPaneWithTab(focused, leafId, direction, tabId)
          : focusPane(assignTabToPane(focused, leafId, tabId), leafId);
      });
      activateDroppedView({ ...partial, id: tabId });
      setDraggingViewElementId(null);
    },
    [activateDroppedView, elementsById],
  );

  const handleCompositionActivate = useCallback(
    (id: string) => {
      const next = compositionState.compositions.find((composition) => composition.id === id);
      if (!next || id === compositionState.activeId) return;
      setCompositionState((state) => ({
        activeId: id,
        compositions: state.compositions.map((composition) =>
          composition.id === state.activeId
            ? { ...composition, tabsState, paneLayout }
            : composition,
        ),
      }));
      setTabsState(next.tabsState);
      setPaneLayout(next.paneLayout);
      setSecondarySidebarOpen(true);
    },
    [compositionState.activeId, compositionState.compositions, paneLayout, tabsState],
  );

  const handleCompositionCreate = useCallback(() => {
    const id = nextCompositionId();
    const pane = createPaneLayout(null);
    const label = `Composition ${compositionState.compositions.length + 1}`;
    setCompositionState((state) => ({
      activeId: id,
      compositions: [
        ...state.compositions.map((composition) =>
          composition.id === state.activeId
            ? { ...composition, tabsState, paneLayout }
            : composition,
        ),
        { id, label, tabsState: EMPTY_TABS, paneLayout: pane },
      ],
    }));
    setTabsState(EMPTY_TABS);
    setPaneLayout(pane);
    setSecondarySidebarOpen(true);
    setMode('plan');
    setViewerMode('plan_canvas');
  }, [compositionState.compositions.length, paneLayout, setViewerMode, tabsState]);

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
      const clientOpId = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      rememberLocalClientOp(clientOpId);
      try {
        const r = await applyCommand(mid, cmd, { userId: uid, clientOpId });
        if (r.revision !== undefined) {
          if (r.delta) {
            useBimStore.getState().applyDelta(r.delta as ModelDelta);
          } else {
            hydrateFromSnapshot({
              modelId: mid,
              revision: r.revision,
              elements: r.elements ?? {},
              violations: (r.violations ?? []) as Violation[],
            });
          }
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
    if (effectiveMode === '3d') {
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
      if (
        event.key === 'Escape' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        // UX: Escape always returns authoring to the default Select cursor.
        setPlanTool('select');
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
      if (def && !def.modes.includes(effectiveMode) && def.modes.includes('plan')) {
        handleModeChange('plan');
      }
      setPlanTool(tool);
    },
    [effectiveMode, handleModeChange, setPlanTool, toolRegistry],
  );

  const selectedElement = useMemo(
    () => (selectedId ? (elementsById[selectedId] as Element | undefined) : undefined),
    [elementsById, selectedId],
  );
  const materialEditableType = useMemo(
    () => resolveMaterialEditableType(selectedElement, elementsById),
    [selectedElement, elementsById],
  );
  const selectedMaterialKey = materialEditableType?.layers[0]?.materialKey ?? null;

  const assignMaterialToSelection = useCallback(
    (materialKey: string) => {
      if (!materialEditableType) return;
      const [first, ...rest] = materialEditableType.layers;
      if (!first) return;
      const nextLayers = [{ ...first, materialKey }, ...rest.map((layer) => ({ ...layer }))];
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: materialEditableType.id,
        key: 'layers',
        value: nextLayers,
      });
    },
    [materialEditableType, onSemanticCommand],
  );

  const openMilestoneDialog = useCallback(() => setMilestoneDialogOpen(true), []);
  const replayOnboardingTour = useCallback(() => {
    resetOnboarding();
    setTourOpen(true);
  }, []);

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
      saved_view: '3D',
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
      const liveElements = useBimStore.getState().elementsById as Record<string, Element>;
      const el = liveElements[id] ?? (elementsById as Record<string, Element>)[id];
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
      if (el.kind === 'saved_view') {
        const cameraState =
          el.cameraState && typeof el.cameraState === 'object'
            ? (el.cameraState as Record<string, unknown>)
            : null;
        const position = firstMmVector(cameraState?.positionMm);
        const target = firstMmVector(cameraState?.targetMm);
        const up = firstMmVector(cameraState?.upMm) ?? { xMm: 0, yMm: 1, zMm: 0 };
        if (position && target) {
          useBimStore.getState().setOrbitCameraFromViewpointMm({
            position,
            target,
            up,
          });
        }
        const visibility =
          el.visibilityOverrides && typeof el.visibilityOverrides === 'object'
            ? (el.visibilityOverrides as Record<string, unknown>)
            : null;
        if (visibility) {
          const capElevMm = Number(visibility.viewerClipCapElevMm);
          const floorElevMm = Number(visibility.viewerClipFloorElevMm);
          const hideSemanticKinds = Array.isArray(visibility.hiddenSemanticKinds3d)
            ? visibility.hiddenSemanticKinds3d.filter(
                (value): value is string => typeof value === 'string',
              )
            : undefined;
          useBimStore.getState().applyOrbitViewpointPreset({
            capElevMm: Number.isFinite(capElevMm) ? capElevMm : undefined,
            floorElevMm: Number.isFinite(floorElevMm) ? floorElevMm : undefined,
            hideSemanticKinds,
          });
        }
        useBimStore.getState().setActiveViewpointId(undefined);
        useBimStore.getState().select(el.id);
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
        return;
      }
      if (el.kind === 'project_settings') {
        useBimStore.getState().select(el.id);
        setRightRailOverride('open');
      }
    },
    [activatePlanView, elementsById, openTabFromElement, setActiveLevelId, setViewerMode],
  );

  const openProjectSettings = useCallback(() => {
    const settings = elementsById.project_settings;
    if (settings?.kind === 'project_settings') {
      openElementById(settings.id);
      return;
    }
    setProjectMenuOpen(true);
  }, [elementsById, openElementById]);

  const createFloorPlanView = useCallback(async () => {
    const activePlan = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const activePlanLevelId = activePlan?.kind === 'plan_view' ? activePlan.levelId : undefined;
    const levels = (Object.values(elementsById) as Element[])
      .filter((element): element is Extract<Element, { kind: 'level' }> => element.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const selectedLevel =
      (activePlanLevelId && levels.find((level) => level.id === activePlanLevelId)) || levels[0];
    if (!selectedLevel) {
      setSeedError('No level is available to host a new floor plan.');
      return;
    }
    const existingNames = new Set(
      (Object.values(elementsById) as Element[])
        .filter(
          (element): element is Extract<Element, { kind: 'plan_view' }> =>
            element.kind === 'plan_view',
        )
        .map((element) => element.name),
    );
    let seq = 1;
    let name = `${selectedLevel.name} plan`;
    while (existingNames.has(name)) {
      seq += 1;
      name = `${selectedLevel.name} plan ${seq}`;
    }
    const id = `pv-${slugToken(selectedLevel.name)}-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'upsertPlanView',
      id,
      name,
      levelId: selectedLevel.id,
      planViewSubtype: 'floor_plan',
      discipline: 'architecture',
    });
    openElementById(id);
  }, [activePlanViewId, elementsById, onSemanticCommand, openElementById, setSeedError]);

  const create3dSavedView = useCallback(async () => {
    const activeViewpoint =
      activeViewpointId && elementsById[activeViewpointId]?.kind === 'viewpoint'
        ? elementsById[activeViewpointId]
        : null;
    const pose =
      orbitCameraPoseMm ??
      (activeViewpoint?.mode === 'orbit_3d' && activeViewpoint.camera
        ? {
            position: activeViewpoint.camera.position,
            target: activeViewpoint.camera.target,
            up: activeViewpoint.camera.up,
          }
        : null);
    if (!pose) {
      setSeedError('Open a 3D view first so a camera can be saved.');
      return;
    }
    const index =
      (Object.values(elementsById) as Element[]).filter((element) => element.kind === 'saved_view')
        .length + 1;
    const id = `sv-3d-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'create_saved_view',
      id,
      baseViewId: activeViewpointId ?? 'orbit_3d',
      name: `Saved 3D View ${index}`,
      cameraState: {
        positionMm: pose.position,
        targetMm: pose.target,
        upMm: pose.up,
        fovDeg: 60,
      },
      visibilityOverrides: {
        viewerClipCapElevMm: viewerClipElevMm,
        viewerClipFloorElevMm,
        hiddenSemanticKinds3d: Object.entries(viewerCategoryHidden)
          .filter(([, hidden]) => hidden)
          .map(([kind]) => kind),
      },
      detailLevel: viewerProjection,
    });
    openElementById(id);
  }, [
    activeViewpointId,
    elementsById,
    onSemanticCommand,
    openElementById,
    orbitCameraPoseMm,
    setSeedError,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerProjection,
  ]);

  const createSectionView = useCallback(() => {
    setMode('plan');
    setViewerMode('plan_canvas');
    setPlanTool('section');
  }, [setPlanTool, setViewerMode]);

  const createSheetView = useCallback(async () => {
    const existingNumbers = new Set(
      (Object.values(elementsById) as Element[])
        .filter(
          (element): element is Extract<Element, { kind: 'sheet' }> => element.kind === 'sheet',
        )
        .map((element) => String((element as { number?: string }).number ?? '').trim())
        .filter(Boolean),
    );
    let seq = 101;
    let sheetNumber = `A-${seq}`;
    while (existingNumbers.has(sheetNumber)) {
      seq += 1;
      sheetNumber = `A-${seq}`;
    }
    const sheetId = `sheet-${slugToken(sheetNumber)}-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'CreateSheet',
      sheetId,
      name: `Documentation ${sheetNumber}`,
      number: sheetNumber,
      size: 'A1',
      orientation: 'landscape',
    });
    openElementById(sheetId);
  }, [elementsById, onSemanticCommand, openElementById]);

  const createScheduleView = useCallback(async () => {
    const index =
      (Object.values(elementsById) as Element[]).filter((element) => element.kind === 'schedule')
        .length + 1;
    const id = `sch-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'upsertSchedule',
      id,
      name: `Room schedule ${index}`,
      category: 'room',
      filters: { category: 'room' },
      grouping: {},
    });
    openElementById(id);
  }, [elementsById, onSemanticCommand, openElementById]);

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
    if (paletteActiveSectionId) {
      useBimStore.getState().select(paletteActiveSectionId);
    }
    navigateTo({ kind: 'plan', source: 'cmdk' });
  }, [navigateTo, paletteActiveSectionId]);
  const openActiveSection3dContext = useCallback(() => {
    if (!paletteActiveSectionId) return;
    const section = elementsById[paletteActiveSectionId];
    if (section?.kind !== 'section_cut') return;
    const dx = section.lineEndMm.xMm - section.lineStartMm.xMm;
    const dy = section.lineEndMm.yMm - section.lineStartMm.yMm;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) {
      navigateTo({ kind: '3d', source: 'section-context' });
      return;
    }
    const centerX = (section.lineStartMm.xMm + section.lineEndMm.xMm) * 0.5;
    const centerY = (section.lineStartMm.yMm + section.lineEndMm.yMm) * 0.5;
    const nx = -dy / len;
    const ny = dx / len;
    const depth = Math.max(2500, Math.min(9000, (section.cropDepthMm ?? 6000) * 0.65));
    const targetZ = 1600;
    useBimStore.getState().select(paletteActiveSectionId);
    setOrbitCameraFromViewpointMm({
      position: {
        xMm: centerX - nx * depth,
        yMm: centerY - ny * depth,
        zMm: targetZ + 500,
      },
      target: {
        xMm: centerX,
        yMm: centerY,
        zMm: targetZ,
      },
      up: { xMm: 0, yMm: 0, zMm: 1 },
    });
    navigateTo({ kind: '3d', source: 'section-context' });
  }, [elementsById, navigateTo, paletteActiveSectionId, setOrbitCameraFromViewpointMm]);
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
  const splitActiveTab = useCallback(
    (direction: PaneSplitDirection) => {
      const activeId = tabsState.activeId;
      if (!activeId) return;
      setPaneLayout((layout) =>
        splitPaneWithTab(layout, layout.focusedLeafId, direction, activeId),
      );
    },
    [tabsState.activeId],
  );

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
      if (kind === 'wall_type') {
        useBimStore.getState().setActiveWallTypeId(typeId);
        setActiveComponentAssetId(null);
        setActiveComponentFamilyTypeId(null);
      }
      if (kind === 'floor_type') {
        useBimStore.getState().setActiveFloorTypeId(typeId);
        setActiveComponentAssetId(null);
        setActiveComponentFamilyTypeId(null);
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

  useEffect(() => {
    const previousSelectedId = previousSelectedIdRef.current;
    if (!selectedId) {
      previousSelectedIdRef.current = selectedId;
      return;
    }
    if (selectedId !== previousSelectedId) {
      setRightRailOverride('open');
    }
    previousSelectedIdRef.current = selectedId;
  }, [selectedId]);

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor(seedLoading ? 'canvas-loading' : 'canvas-empty');
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;

  /* ── CHR-V3-10: canvas hint (select/tool idle) ────────────────────── */
  const showCanvasHint = !selectedId && planTool === 'select';
  const tabsById = useMemo(
    () => Object.fromEntries(tabsState.tabs.map((tab) => [tab.id, tab])),
    [tabsState.tabs],
  );
  const tabPaneAssignments = useMemo(
    () => collectPaneTabAssignments(paneLayout.root),
    [paneLayout],
  );
  const focusedPaneTabId = useMemo(
    () => tabIdForLeaf(paneLayout.root, paneLayout.focusedLeafId),
    [paneLayout],
  );
  const focusedPaneLeafId = paneLayout.focusedLeafId;

  const renderPaneNode = useCallback(
    (node: PaneNode): JSX.Element => {
      if (node.kind === 'split') {
        return (
          <div
            key={node.id}
            className="grid h-full w-full min-h-0 min-w-0"
            style={
              node.axis === 'horizontal'
                ? { gridTemplateColumns: '1fr 1fr' }
                : { gridTemplateRows: '1fr 1fr' }
            }
          >
            <div
              className={[
                'min-h-0 min-w-0 overflow-hidden',
                node.axis === 'horizontal'
                  ? 'border-r border-border/60'
                  : 'border-b border-border/60',
              ].join(' ')}
            >
              {renderPaneNode(node.first)}
            </div>
            <div className="min-h-0 min-w-0 overflow-hidden">{renderPaneNode(node.second)}</div>
          </div>
        );
      }
      const paneTab = node.tabId ? (tabsById[node.tabId] ?? null) : null;
      const paneMode = (paneTab?.kind as WorkspaceMode | undefined) ?? effectiveMode;
      const paneIsPlan = paneTab?.kind === 'plan';
      const panePlanTarget = paneIsPlan
        ? resolvePlanTabTarget(elementsById, paneTab?.targetId, activeLevelId)
        : { activeLevelId: activeLevelId ?? '' };
      const paneViewerMode = paneTab?.kind === '3d' ? 'orbit_3d' : 'plan_canvas';
      const focused = focusedPaneLeafId === node.id;
      const paneLabel = paneTab?.label ?? 'Empty pane';
      const paneCanAcceptDrop = Boolean(draggingViewElementId);
      const PaneIcon =
        paneTab?.kind === '3d'
          ? Icons.orbitView
          : paneTab?.kind === 'section'
            ? Icons.section
            : paneTab?.kind === 'sheet'
              ? Icons.sheet
              : paneTab?.kind === 'schedule'
                ? Icons.schedule
                : Icons.planView;
      return (
        <div
          key={node.id}
          data-testid={`canvas-pane-${node.id}`}
          data-focused={focused ? 'true' : 'false'}
          className={[
            'relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden',
            focused ? 'ring-1 ring-accent/70 ring-inset' : '',
          ].join(' ')}
          onPointerDown={() => {
            setPaneLayout((layout) => focusPane(layout, node.id));
            if (paneTab?.id && paneTab.id !== tabsState.activeId) {
              handleTabActivate(paneTab.id);
            }
          }}
        >
          <div
            data-testid={`canvas-pane-tabstrip-${node.id}`}
            className={[
              'flex h-8 shrink-0 items-center justify-between border-b border-border/70 bg-surface px-2 text-xs',
              paneCanAcceptDrop ? 'border-accent/80 bg-accent/10' : '',
            ].join(' ')}
            onDragOver={(event) => {
              if (!paneCanAcceptDrop) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(event) => {
              if (!paneCanAcceptDrop) return;
              event.preventDefault();
              const elementId =
                draggingViewElementId || event.dataTransfer.getData('application/x-bim-element-id');
              placeViewElementInPane(elementId, node.id);
            }}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                data-testid={`canvas-pane-view-settings-${node.id}`}
                aria-label={`Toggle view settings for ${paneLabel}`}
                title={`Toggle view settings for ${paneLabel}`}
                className={[
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground',
                  secondarySidebarOpen && focused ? 'bg-accent/10 text-accent' : '',
                ].join(' ')}
                onClick={(event) => {
                  event.stopPropagation();
                  setPaneLayout((layout) => focusPane(layout, node.id));
                  if (paneTab?.id && paneTab.id !== tabsState.activeId) {
                    handleTabActivate(paneTab.id);
                  }
                  setSecondarySidebarOpen((open) => (focused ? !open : true));
                }}
              >
                <PaneIcon size={12} aria-hidden="true" />
              </button>
              <div className="min-w-0 truncate font-medium text-foreground" title={paneLabel}>
                {paneLabel}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {paneCanAcceptDrop ? (
                <span className="rounded border border-accent/60 px-1 py-0.5 text-[10px] text-accent">
                  Drop view
                </span>
              ) : null}
              {paneTab?.id ? (
                <button
                  type="button"
                  data-testid={`canvas-pane-close-tab-${node.id}`}
                  className="inline-flex h-5 w-5 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
                  aria-label={`Close ${paneLabel}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTabClose(paneTab.id);
                  }}
                >
                  <Icons.close size={12} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 min-w-0 flex-1">
            {paneTab ? (
              <CanvasMount
                mode={paneMode}
                activeTabId={paneTab.id}
                viewerMode={paneViewerMode}
                activeLevelId={panePlanTarget.activeLevelId}
                elementsById={elementsById}
                onSemanticCommand={(cmd) => void onSemanticCommand(cmd)}
                cameraHandleRef={planCameraHandleRef}
                initialCamera={paneTab.viewportState?.planCamera}
                preferredSheetId={
                  paneTab.kind === 'sheet' ? (paneTab.targetId ?? undefined) : undefined
                }
                preferredScheduleId={
                  paneTab.kind === 'schedule' ? (paneTab.targetId ?? undefined) : undefined
                }
                modelId={modelId ?? undefined}
                wsOn={wsOn}
                onPersistViewpointField={persistViewpointField}
                lensMode={lensMode}
                onNavigateToElement={openElementById}
                snapSettings={snapSettings}
                sheetReviewMode={sheetReviewMode}
                sheetMarkupShape={sheetMarkupShape}
                onOpenSectionSourcePlan={openActiveSectionSourcePlan}
                onOpenSection3dContext={openActiveSection3dContext}
              />
            ) : (
              <div
                data-testid={`canvas-pane-empty-${node.id}`}
                className="flex h-full w-full items-center justify-center bg-background/80"
              >
                <div className="rounded border border-border/70 bg-surface px-3 py-2 text-center text-xs text-muted">
                  <div>No view open in this pane</div>
                  <div className="mt-1 text-[11px]">
                    Drag a view from the primary sidebar to start this composition.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    },
    [
      activeLevelId,
      activeTab,
      draggingViewElementId,
      effectiveMode,
      elementsById,
      focusedPaneLeafId,
      handleTabActivate,
      handleTabClose,
      lensMode,
      modelId,
      onSemanticCommand,
      openActiveSection3dContext,
      openActiveSectionSourcePlan,
      openElementById,
      placeViewElementInPane,
      persistViewpointField,
      secondarySidebarOpen,
      sheetMarkupShape,
      sheetReviewMode,
      snapSettings,
      tabsById,
      tabsState.activeId,
      wsOn,
    ],
  );

  const runSelectedWall3dInsert = useCallback(
    (kind: 'door' | 'window' | 'opening') => {
      if (!selectedId) return;
      const selected = elementsById[selectedId];
      if (!selected || selected.kind !== 'wall') return;
      if (effectiveMode !== '3d') return;
      if (kind === 'door') {
        void onSemanticCommand({
          type: 'insertDoorOnWall',
          wallId: selected.id,
          alongT: 0.5,
          widthMm: 900,
        });
        return;
      }
      if (kind === 'window') {
        void onSemanticCommand({
          type: 'insertWindowOnWall',
          wallId: selected.id,
          alongT: 0.5,
          widthMm: 1200,
          sillHeightMm: 900,
          heightMm: 1500,
        });
        return;
      }
      void onSemanticCommand({
        type: 'createWallOpening',
        hostWallId: selected.id,
        alongTStart: 0.45,
        alongTEnd: 0.55,
        sillHeightMm: 200,
        headHeightMm: 2400,
      });
    },
    [effectiveMode, elementsById, onSemanticCommand, selectedId],
  );

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
          activeLensMode: lensMode,
          activePlanViewId,
          activeScheduleId: paletteActiveScheduleId,
          activeSheetId: paletteActiveSheetId,
          activeSectionId: paletteActiveSectionId,
          activeViewpointId,
          canSaveCurrentViewpoint: Boolean(orbitCameraPoseMm),
          navigateMode: (kind) => navigateTo({ kind, source: 'cmdk' }),
          startPlanTool: (toolId) => handleToolSelect(toolId as ToolId),
          setTheme: handleThemeSet,
          setLensMode,
          toggleTheme: handleThemeToggle,
          setLanguage: handleLanguageSet,
          views: paletteViews,
          planTemplates: palettePlanTemplates,
          sheetPlaceableViews: paletteSheetPlaceableViews,
          openElement: (id) => navigateTo({ kind: effectiveMode, targetId: id, source: 'cmdk' }),
          dispatchCommand: (cmd) => void onSemanticCommand(cmd),
          openProjectMenu: () => setProjectMenuOpen((v) => !v),
          openProjectSettings,
          saveSnapshot: handleSaveSnapshot,
          openRestoreSnapshot: () => setProjectMenuOpen(true),
          openManageLinks: () => setManageLinksOpen(true),
          sharePresentation: () => setSharePresentationOpen(true),
          hasPresentationPages: sheetPages.length > 0,
          openFamilyLibrary: () => setFamilyLibraryOpen(true),
          openMaterialBrowser: () => setMaterialBrowserOpen(true),
          openAppearanceAssetBrowser: () => setAppearanceAssetBrowserOpen(true),
          openKeyboardShortcuts: () => setCheatsheetOpen(true),
          replayOnboardingTour,
          openAdvisor: () => setAdvisorOpen(true),
          openJobs: () => setJobsOpen(true),
          openMilestone: openMilestoneDialog,
          hasAdvisorQuickFix: Boolean(firstAdvisorQuickFix),
          applyFirstAdvisorFix: firstAdvisorQuickFix
            ? () => void onSemanticCommand(firstAdvisorQuickFix)
            : undefined,
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
          setSheetReviewMode,
          setSheetMarkupShape,
          sheetReviewMode,
          placeActiveSectionOnSheet,
          openActiveSectionSourcePlan,
          openActiveSection3dContext,
          adjustActiveSectionCropDepth,
          saveCurrentViewpoint,
          createFloorPlan: () => void createFloorPlanView(),
          create3dView: () => void create3dSavedView(),
          createSectionView,
          createSheet: () => void createSheetView(),
          createSchedule: () => void createScheduleView(),
          resetActiveSavedViewpoint,
          updateActiveSavedViewpoint,
          closeInactiveViews: () => setTabsState((s) => closeInactiveTabs(s)),
          togglePrimarySidebar: () => setLeftRailCollapsed((v) => !v),
          toggleElementSidebar: toggleRightRail,
          splitActiveTabLeft: () => splitActiveTab('left'),
          splitActiveTabRight: () => splitActiveTab('right'),
          splitActiveTabTop: () => splitActiveTab('top'),
          splitActiveTabBottom: () => splitActiveTab('bottom'),
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
      {materialBrowserOpen ? (
        <MaterialBrowserDialog
          currentKey={selectedMaterialKey}
          onAssign={(materialKey) => {
            assignMaterialToSelection(materialKey);
            setMaterialBrowserOpen(false);
          }}
          onClose={() => setMaterialBrowserOpen(false)}
        />
      ) : null}
      {appearanceAssetBrowserOpen ? (
        <AppearanceAssetBrowserDialog
          currentKey={selectedMaterialKey}
          onReplace={(materialKey) => {
            assignMaterialToSelection(materialKey);
            setAppearanceAssetBrowserOpen(false);
          }}
          onClose={() => setAppearanceAssetBrowserOpen(false)}
        />
      ) : null}
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <VVDialog open={vvDialogOpen} onClose={closeVVDialog} />
      {advisorOpen ? (
        <div
          data-testid="advisor-dialog-backdrop"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdvisorOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="advisor-dialog-title"
            data-testid="advisor-dialog"
            className="flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-3xl flex-col rounded border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 id="advisor-dialog-title" className="text-sm font-semibold text-foreground">
                  Advisor
                </h2>
                <p className="text-[11px] text-muted">
                  {advisorCounts.error} errors · {advisorCounts.warning} warnings ·{' '}
                  {advisorCounts.info} info
                </p>
              </div>
              <button
                type="button"
                data-testid="advisor-dialog-close"
                onClick={() => setAdvisorOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Close advisor"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-auto p-4">
              <AdvisorPanel
                violations={unifiedAdvisorViolations}
                preset={buildingPreset}
                onPreset={setBuildingPreset}
                codePresets={codePresetIds}
                onApplyQuickFix={(cmd) => void onSemanticCommand(cmd)}
                perspective={perspectiveId}
                showAllPerspectives
                onNavigateToElement={(elementId) => {
                  openElementById(elementId);
                  setAdvisorOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {jobsOpen ? (
        <div
          data-testid="jobs-dialog-backdrop"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setJobsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="jobs-dialog-title"
            data-testid="jobs-dialog"
            className="relative flex h-[min(760px,calc(100vh-32px))] w-full max-w-sm flex-col overflow-hidden rounded border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 id="jobs-dialog-title" className="text-sm font-semibold text-foreground">
                Jobs
              </h2>
              <button
                type="button"
                data-testid="jobs-dialog-close"
                onClick={() => setJobsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Close jobs"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <JobsPanel />
            </div>
          </div>
        </div>
      ) : null}
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
        onOpenMilestone={openMilestoneDialog}
        onOpenMaterialBrowser={() => setMaterialBrowserOpen(true)}
        onOpenAppearanceAssetBrowser={() => setAppearanceAssetBrowserOpen(true)}
        onNewClear={handleNewClear}
        onReplayTour={replayOnboardingTour}
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
            <div className="flex min-w-0 flex-1 flex-col">
              <CompositionBar
                compositions={compositionState.compositions}
                activeId={compositionState.activeId}
                onActivate={handleCompositionActivate}
                onCreate={handleCompositionCreate}
              />
              <TabBar
                tabs={tabsState.tabs}
                activeId={tabsState.activeId}
                focusedPaneTabId={focusedPaneTabId}
                tabPaneAssignments={tabPaneAssignments}
                onActivate={(id) => {
                  handleTabActivate(id);
                  setPaneLayout((layout) => assignTabToFocusedPane(layout, id));
                  const t = tabsState.tabs.find((x) => x.id === id);
                  if (t) {
                    if (t.kind === 'plan') setViewerMode('plan_canvas');
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
                  const id = fallback.targetId ? `${kind}:${fallback.targetId}` : kind;
                  setPaneLayout((layout) => assignTabToFocusedPane(layout, id));
                  setMode(kind as WorkspaceMode);
                  if (kind === 'plan') setViewerMode('plan_canvas');
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
            lensMode={lensMode}
            onToolSelect={handleToolSelect}
            onModeChange={handleModeChange}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onOpenFamilyLibrary={() => setFamilyLibraryOpen(true)}
            onOpenSettings={() => setCheatsheetOpen(true)}
            onSaveCurrentViewpoint={saveCurrentViewpoint}
            onResetActiveSavedViewpoint={resetActiveSavedViewpoint}
            onUpdateActiveSavedViewpoint={updateActiveSavedViewpoint}
            onInsertDoorOnSelectedWall3d={() => runSelectedWall3dInsert('door')}
            onInsertWindowOnSelectedWall3d={() => runSelectedWall3dInsert('window')}
            onInsertOpeningOnSelectedWall3d={() => runSelectedWall3dInsert('opening')}
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
            sheetReviewMode={sheetReviewMode}
            onSheetReviewModeChange={setSheetReviewMode}
            sheetMarkupShape={sheetMarkupShape}
            onSheetMarkupShapeChange={setSheetMarkupShape}
          />
        }
        primarySidebar={
          <WorkspaceLeftRail
            projectName={activeSeedLabel ?? 'BIM AI'}
            projectNameRef={projectNameRef}
            onProjectNameClick={() => setProjectMenuOpen((v) => !v)}
            openTabFromElement={openTabFromElement}
            onSetModeOnly={handleSetModeOnly}
            onSemanticCommand={onSemanticCommand}
            onCreateFloorPlan={() => void createFloorPlanView()}
            onCreate3dView={() => void create3dSavedView()}
            onCreateSectionView={createSectionView}
            onCreateSheet={() => void createSheetView()}
            onCreateSchedule={() => void createScheduleView()}
            onOpenProjectSettings={openProjectSettings}
            onOpenSavedView={openElementById}
            onViewDragStart={setDraggingViewElementId}
            onViewDragEnd={() => setDraggingViewElementId(null)}
            lensMode={lensMode}
            onLensChange={setLensMode}
            activeViewTargetId={activeTab?.targetId}
            userDisplayName={userDisplayName}
            userId={userId}
            modelId={modelId}
            revision={revision}
          />
        }
        secondarySidebar={
          secondarySidebarOpen ? (
            <WorkspaceRightRail
              mode={effectiveMode}
              onSemanticCommand={onSemanticCommand}
              onModeChange={handleModeChange}
              onNavigateToElement={openElementById}
              activeViewTargetId={activeTab?.targetId}
              surface="view-context"
              onOpenMaterialBrowser={() => setMaterialBrowserOpen(true)}
              onOpenAppearanceAssetBrowser={() => setAppearanceAssetBrowserOpen(true)}
            />
          ) : null
        }
        canvas={
          <div
            style={{
              ...canvasContainerStyle,
              // VIS-V3-08: paper background for 2D views; 3D viewport keeps dark background.
              background: ['plan', 'section'].includes(activeTab?.kind ?? '')
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
            {renderPaneNode(paneLayout.root)}
            {draggingViewElementId ? (
              <div className="pointer-events-none absolute inset-0 z-20">
                {(
                  [
                    ['left', { left: '5%', top: '28%', width: '16%', height: '44%' }],
                    ['right', { right: '5%', top: '28%', width: '16%', height: '44%' }],
                    ['top', { left: '30%', top: '5%', width: '40%', height: '18%' }],
                    ['bottom', { left: '30%', bottom: '5%', width: '40%', height: '18%' }],
                  ] as const
                ).map(([direction, style]) => (
                  <button
                    key={direction}
                    type="button"
                    data-testid={`canvas-split-dropzone-${direction}`}
                    className="pointer-events-auto absolute rounded border border-accent/80 bg-accent/20 text-[11px] font-medium text-foreground backdrop-blur-sm"
                    style={style}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const elementId =
                        draggingViewElementId ||
                        event.dataTransfer.getData('application/x-bim-element-id');
                      placeViewElementInPane(elementId, paneLayout.focusedLeafId, direction);
                    }}
                  >
                    Drop {direction}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        }
        elementSidebar={
          hasSelection ? (
            <WorkspaceRightRail
              mode={effectiveMode}
              onSemanticCommand={onSemanticCommand}
              onModeChange={handleModeChange}
              onNavigateToElement={openElementById}
              surface="element"
              onOpenMaterialBrowser={() => setMaterialBrowserOpen(true)}
              onOpenAppearanceAssetBrowser={() => setAppearanceAssetBrowserOpen(true)}
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
            snapModes={snapModes}
            onSnapToggle={handleSnapToggle}
            advisorCounts={advisorCounts}
            onAdvisorClick={() => setAdvisorOpen(true)}
            jobsCounts={jobsCounts}
            onJobsClick={() => setJobsOpen(true)}
            selectionCount={selectedId ? 1 : 0}
            temporaryVisibility={temporaryVisibility}
            onClearTemporaryVisibility={clearTemporaryVisibility}
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
