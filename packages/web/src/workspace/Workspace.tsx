import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';

import { log } from '../logger';
import { type PlanCameraHandle } from '../plan/PlanCanvas';
import { shaftBoundaryFromStair } from '../plan/stairShaft';
import { computeShaftCutFloors } from '../plan/shaftCutFloors';
import { createSimilarPayload } from '../plan/createSimilar';
import { equalizeWitnessSpacing } from '../plan/equalizeWitnessSpacing';
import { stackDimensions } from '../plan/stackDimensions';
import { applyFamilyParameters } from '../plan/familyParameterEval';
import { autoDimensionWalls, tagAllRooms as tagAllRoomsFn } from '../plan/autoDimension';
import { autoDimensionWalls as autoDimensionWallsCmd } from '../plan/autoDimensionWalls';
import { checkHeadHeightClearances, type ClearanceViolation } from '../plan/openingClearance';
import { applyCommand, ApiHttpError } from '../lib/api';
import {
  setActiveComponentAssetId,
  setActiveComponentAssetPreviewEntry,
  setActiveComponentFamilyTypeId,
  syncLastLevelElevationPropagationFromApplyResponse,
} from './authoring';
import {
  buildCollaborationConflictQueueV1,
  type CollaborationConflictQueueV1,
} from '../lib/collaborationConflictQueue';
import type { LensMode, Violation } from '@bim-ai/core';
import { useUnifiedAdvisorViolations } from '../advisor/unifiedAdvisorViolations';
import { useStructuralValidationViolations } from '../advisor/structuralAdvisorViolations';
import {
  useBimStore,
  applyTheme,
  toggleTheme,
  getCurrentTheme,
  type PlanTool,
  type Theme,
} from '../state/store';
import { useRenderCount } from '../state/renderCountProbe';
import { useElementsByIdRef } from '../state/elementsByIdRef';
import { selectDriftedElements } from '../plan/monitorDriftBadge';
import {
  loadSnapSettings,
  saveSnapSettings,
  SNAP_KINDS,
  type SnapSettings,
  type ToggleableSnapKind,
} from '../plan/snapSettings';
import { patternFor } from '../state/uiStates';
import { AppShell, type WorkspaceMode } from './shell';
import { getToolRegistry, type ToolId } from '../tools/toolRegistry';
import {
  EMPTY_TABS,
  activateOrOpenKind,
  activateTab,
  closeInactiveTabs,
  snapshotViewport,
  tabFromElement,
  tabIdFor,
  type TabKind,
  type TabsState,
  type ViewTab,
  type ViewportSnapshot,
} from './tabsModel';
import { persistTabs, readPersistedTabs } from './tabsPersistence';
import {
  assignTabToPane,
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
  persistCompositions,
  readPersistedCompositions,
  tabIdForLeaf,
  tabMatchesView,
  uniqueTabInstanceId,
  updateTabLens,
  upsertTabInstance,
  type WorkspaceCompositionState,
} from './compositions';
import { type ProjectMenuItemRecent, readRecentProjects } from './project';
import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
} from '../state/backupRetention';
import {
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from './readouts';
import { useActivityDrawerStore } from '../collab/activityDrawerStore';
import { useActivityStore } from '../collab/activityStore';
import { CommandPalette } from '../cmdPalette/CommandPalette';
import '../cmdPalette/defaultCommands';
import type {
  ExternalCatalogPlacement,
  FamilyLibraryArrayFormulaUpdate,
  FamilyLibraryPlaceKind,
} from '../families/FamilyLibraryPanel';
import { parseViewerProjectionParam, parseViewerRenderStyleParam } from '../viewport/renderStyles';
import {
  planCatalogFamilyLoad,
  type FamilyReloadOverwriteOption,
} from '../families/catalogFamilyReload';
import { getFamilyPlacementAdapter } from '../families/familyPlacementAdapters';
import { applyCommandBundle } from '../lib/api';
import { readOnboardingProgress, resetOnboarding } from '../onboarding/tour';
import { defaultTabFallbackForKind } from './WorkspaceHelpers';
import {
  assetPreviewElementFromEntry,
  indexAssetCommandFromEntry,
  shouldPlaceCatalogFamilyAsAsset,
} from './catalogPlacementHelpers';
import { applyHideInView, applyIsolateInView, applyResetHiddenInView } from './hideInView';
import { WorkspaceLeftRail } from './WorkspaceLeftRail';
import { rememberLocalClientOp, useWorkspaceSnapshot } from './useWorkspaceSnapshot';
import { useWorkspaceComments } from './useWorkspaceComments';
import { useWorkspaceCompositionActions } from './useWorkspaceCompositionActions';
import { useWorkspaceCompositionLoading } from './useWorkspaceCompositionLoading';
import { useWorkspaceCreateViews } from './useWorkspaceCreateViews';
import { useWorkspacePaletteActions } from './useWorkspacePaletteActions';
import { useWorkspaceProjectActions } from './useWorkspaceProjectActions';
import { useWorkspaceSemanticCommand } from './useWorkspaceSemanticCommand';
import {
  WorkspaceCanvasSlot,
  WorkspaceFooterSlot,
  WorkspaceHeaderSlot,
} from './WorkspaceAppShellSlots';
import { WorkspaceOverlays } from './WorkspaceOverlays';
import { canonicalPlanToolForMode } from './workspaceUtils';
import {
  disciplineScopeNote,
  EMPTY_JOBS_COUNTS,
  firstMmVector,
  libraryDisciplineFromLens,
  summarizeJobsCounts,
} from './workspacePresentation';
import { materializeOptimisticHostedOpening } from './semanticCommands/optimisticHostedOpening';
import { useToolPrefs } from '../tools/toolPrefsStore';
import { usePresenceStore } from '../presenceStore';
import type { SheetMarkupShape, SheetReviewMode } from './sheets/sheetReviewUi';
import {
  generateWallsFromMass,
  generateFloorsFromMass,
  generateRoofFromMass,
  generateCurtainWallsFromMass,
} from '../tools/massGenerateBim';
import { runUndoRedo } from './runUndoRedo';
import { updateArrayFormula } from './updateArrayFormula';
import { useWorkspaceDefaultTab } from './useWorkspaceDefaultTab';
import { useWorkspaceHotkeys } from './useWorkspaceHotkeys';
import { useMaterialBrowserState } from './useMaterialBrowserState';
import { WorkspacePaneNode, type WorkspacePaneNodeContext } from './WorkspacePaneNode';

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

const PANE_SECONDARY_SIDEBAR_WIDTH = 'min(248px, 34%)';

export function Workspace(): JSX.Element {
  // PERF-G07: dev-only render-count probe. No-op in production.
  useRenderCount('Workspace');
  const { t, i18n } = useTranslation();
  const toolRegistry = useMemo(() => getToolRegistry(t), [t]);
  // FE-CQ-01-followup: the broad `elementsById` subscription that lived
  // here is gone. Inline lookups now go through `elementsByIdRef.current`
  // (vanilla store subscription — never triggers a Workspace re-render)
  // or `useBimStore.getState().elementsById` (one-shot read inside event
  // handlers / callbacks). The hooks that genuinely need broad
  // reactivity (`useStructuralValidationViolations`,
  // `useMaterialBrowserState`, `useWorkspaceDefaultTab`,
  // `useWorkspaceCreateViews`, `useWorkspacePaletteActions`) and the
  // downstream consumers (`WorkspaceOverlays`, `WorkspacePaneNode`)
  // now subscribe internally — Workspace.tsx itself no longer holds a
  // `useBimStore((s) => s.elementsById)` subscription. See
  // `spec/methodology/render-ownership.md`.
  const elementsByIdRef = useElementsByIdRef();
  // PERF-G03: the storeModelRuntimeSlice + installModelIndicesInvariant
  // subscriber (store.ts) keeps `modelIndices` in lockstep with every
  // elementsById write — including the filter / category-override
  // writers in storeViewportRuntimeSlice. So downstream useMemos keyed
  // on narrow modelIndices fields stay correct through filter writes
  // and only recompute when the specific slice changes. Narrow
  // consumers below were the explicit G03 finishing items
  // (commandPaletteEntities, palettePlanTemplates, showEmptyState,
  // projectNorthAngleDeg, project_settings derivations).
  const modelSheets = useBimStore((s) => s.modelIndices.sheets);
  const modelLevels = useBimStore((s) => s.modelIndices.levels);
  const modelWalls = useBimStore((s) => s.modelIndices.walls);
  const modelPlanViews = useBimStore((s) => s.modelIndices.planViews);
  const modelSchedules = useBimStore((s) => s.modelIndices.schedules);
  const modelViewpoints = useBimStore((s) => s.modelIndices.viewpoints);
  const modelSavedViews = useBimStore((s) => s.modelIndices.savedViews);
  const modelSectionCuts = useBimStore((s) => s.modelIndices.sectionCuts);
  const modelViewTemplates = useBimStore((s) => s.modelIndices.viewTemplates);
  const modelProjectSettings = useBimStore((s) => s.modelIndices.projectSettings);
  const modelProjectBasePoint = useBimStore((s) => s.modelIndices.projectBasePoint);
  const hydrateFromSnapshot = useBimStore((s) => s.hydrateFromSnapshot);
  const viewerMode = useBimStore((s) => s.viewerMode);
  const setViewerMode = useBimStore((s) => s.setViewerMode);
  const planTool = useBimStore((s) => s.planTool);
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  const activeToolPhase = useBimStore((s) => s.activeToolPhase);
  const hoveredElementKind = useBimStore((s) => s.hoveredElementKind);
  // EDT-V3-05: loop mode state for status bar message.
  const loopMode = useToolPrefs((s) => s.loopMode);
  const draftGridVisible = useToolPrefs((s) => s.draftGridVisible);
  const toggleDraftGridVisible = useToolPrefs((s) => s.toggleDraftGridVisible);
  const selectedId = useBimStore((s) => s.selectedId);
  const selectedIds = useBimStore((s) => s.selectedIds);
  const temporaryVisibility = useBimStore((s) => s.temporaryVisibility);
  const clearTemporaryVisibility = useBimStore((s) => s.clearTemporaryVisibility);
  const groupRegistry = useBimStore((s) => s.groupRegistry);
  const setGroupRegistry = useBimStore((s) => s.setGroupRegistry);
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
  const setActivity = useBimStore((s) => s.setActivity);
  const vvDialogOpen = useBimStore((s) => s.vvDialogOpen);
  const openVVDialog = useBimStore((s) => s.openVVDialog);
  const closeVVDialog = useBimStore((s) => s.closeVVDialog);
  const setOrthoSnapHold = useBimStore((s) => s.setOrthoSnapHold);
  const userId = useBimStore((s) => s.userId);
  const selectionCount = useMemo(
    () =>
      new Set([selectedId, ...selectedIds].filter((id): id is string => typeof id === 'string'))
        .size,
    [selectedId, selectedIds],
  );

  // COL-V3-04 — presence strip
  const presenceParticipants = usePresenceStore((s) => s.participants);
  const presenceLocalUserId = usePresenceStore((s) => s.localUserId);
  const presenceSetParticipants = usePresenceStore((s) => s.setParticipants);
  const presenceSetLocalUserId = usePresenceStore((s) => s.setLocalUserId);
  // FE-CQ-01-followup: hook subscribes internally to `elementsById` — see
  // `structuralAdvisorViolations.ts`. This is the one legitimate broad
  // reactive case in the Workspace render path (advisor counts must
  // update as elements change).
  const structuralViolations = useStructuralValidationViolations();
  const { violations: unifiedAdvisorViolationsBase } = useUnifiedAdvisorViolations(
    violations,
    modelId,
    revision,
  );
  const unifiedAdvisorViolations = useMemo(
    () => [...unifiedAdvisorViolationsBase, ...structuralViolations],
    [unifiedAdvisorViolationsBase, structuralViolations],
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

  const firstDuplicateWallFix = useMemo(
    () =>
      structuralViolations.find(
        (v) => v.ruleId === 'structural_authoring.duplicate_wall' && v.quickFixCommand,
      )?.quickFixCommand as Record<string, unknown> | undefined,
    [structuralViolations],
  );

  const firstOrphanFix = useMemo(
    () =>
      structuralViolations.find(
        (v) =>
          (v.ruleId === 'structural_authoring.orphaned_no_host_ref' ||
            v.ruleId === 'structural_authoring.orphaned_host_missing') &&
          v.quickFixCommand,
      )?.quickFixCommand as Record<string, unknown> | undefined,
    [structuralViolations],
  );

  // FE-CQ-04 + DOC-CQ-03: DEV-only mount-once presence bootstrap. Omitted
  // deps (`userId`, `userDisplayName`, `presenceParticipants.length`,
  // `presenceSetLocalUserId`, `presenceSetParticipants`) are intentionally
  // not tracked — this seeds a single dev-local participant on first mount
  // so the Collab strip is visible during local development. If the real
  // websocket presence stream lights up later it overrides the seed via
  // the normal store path; re-running this effect on identity / display-
  // name changes would clobber the live participant list with a stale
  // single-user seed.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- FE-CQ-04 + DOC-CQ-03: mount-once DEV presence bootstrap; re-running on userId/displayName change would clobber the live websocket participant list with a stale single-user seed.
  }, []);

  // AST-V3-01 — library overlay (Alt+2)
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobsCounts, setJobsCounts] = useState(EMPTY_JOBS_COUNTS);
  // PERF-G03 finishing: replaces the inline `elementsById.project_settings`
  // lookup with a narrow modelIndices read so this useMemo no longer
  // recomputes on every unrelated elementsById delta.
  const projectSettings = modelProjectSettings;
  const saveAsMaximumBackups = coerceCheckpointRetentionLimit(
    projectSettings?.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT,
  );

  // COL-VIS: share presentation modal
  const [sharePresentationOpen, setSharePresentationOpen] = useState(false);

  const sheetPages = useMemo(
    () =>
      modelSheets.map((s) => ({
        id: s.id,
        name: (s as unknown as { name?: string }).name ?? 'Sheet',
      })),
    [modelSheets],
  );

  // PERF-G03 finishing: narrow modelIndices reads keep the useMemo cache
  // alive through unrelated elementsById writes.
  const projectNorthAngleDeg = useMemo(() => {
    if (modelProjectBasePoint) return modelProjectBasePoint.angleToTrueNorthDeg ?? 0;
    if (modelProjectSettings) return modelProjectSettings.projectNorthAngleDeg ?? 0;
    return 0;
  }, [modelProjectBasePoint, modelProjectSettings]);

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
  const [, setTheme] = useState<Theme>(() => (getCurrentTheme() as Theme) ?? 'light');
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailOverride, setRightRailOverride] = useState<RailOverride>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [familyLibraryOpen, setFamilyLibraryOpen] = useState(false);
  const [sheetReviewMode, setSheetReviewMode] = useState<SheetReviewMode>('cm');
  const [sheetMarkupShape, setSheetMarkupShape] = useState<SheetMarkupShape>('freehand');
  const [_pendingPlacement, setPendingPlacement] = useState<{
    kind: FamilyLibraryPlaceKind;
    typeId: string;
  } | null>(null);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [save3dViewAsOpen, setSave3dViewAsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState<boolean>(() => !readOnboardingProgress().completed);
  // Time-travel Wave 4: `?at=<commit_id>` forces historical/read-only
  // mode. Captured once at mount — switching commits is a full reload
  // via the iter-picker (which opens a new tab or swaps an iframe).
  const historicalCommitId = useMemo<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('at');
  }, []);
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
    isHistorical,
  } = useWorkspaceSnapshot(historicalCommitId);
  const [_collaborationConflictQueue, setCollaborationConflictQueue] =
    useState<CollaborationConflictQueueV1 | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [manageLinksOpen, setManageLinksOpen] = useState(false);
  const [projectSetupOpen, setProjectSetupOpen] = useState(false);
  const [projectUnitsOpen, setProjectUnitsOpen] = useState(false);
  const [phaseManagerOpen, setPhaseManagerOpen] = useState(false);
  const [managePhasesOpen, setManagePhasesOpen] = useState(false);
  const [globalParamsOpen, setGlobalParamsOpen] = useState(false);
  const [manageGlobalParamsOpen, setManageGlobalParamsOpen] = useState(false);
  const [dimStyleOpen, setDimStyleOpen] = useState(false);
  const [, setViewRangeOpen] = useState(false);
  const [vgOpen, setVgOpen] = useState(false);
  const [perViewVGOpen, setPerViewVGOpen] = useState(false);
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [setWorkPlaneOpen, setSetWorkPlaneOpen] = useState(false);
  const [terraceFloorId, setTerraceFloorId] = useState<string | null>(null);
  const [dxfImportOpen, setDxfImportOpen] = useState(false);
  const [printPlotOpen, setPrintPlotOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [trueNorthActive, setTrueNorthActive] = useState(false);
  const [clearanceViolations, setClearanceViolations] = useState<ClearanceViolation[]>([]);
  const lensMode = useBimStore((s) => s.lensMode);
  const setLensMode = useBimStore((s) => s.setLensMode);
  const activeWorkspaceId = useBimStore((s) => s.activeWorkspaceId);
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
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [pasteToLevelsOpen, setPasteToLevelsOpen] = useState(false);
  const [selectionFilterOpen, setSelectionFilterOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [pendingCommandCount, setPendingCommandCount] = useState(0);
  const [recentProjects, setRecentProjects] = useState<ProjectMenuItemRecent[]>(() =>
    readRecentProjects().map((r) => ({ id: r.id, label: r.label })),
  );

  // §1.6.1: derive active plan view display name for document.title and breadcrumb.
  // FE-CQ-01-followup: keyed on `activePlanViewId` only — `modelPlanViews`
  // (narrow modelIndices selector above) is the reactive source that
  // already churns when plan views change, and the ref read is a stable
  // snapshot under the same selector.
  const activePlanViewName = useMemo(() => {
    if (!activePlanViewId) return undefined;
    const pv = modelPlanViews.find((p) => p.id === activePlanViewId);
    return pv?.name;
  }, [activePlanViewId, modelPlanViews]);

  // §1.6.1: update browser tab title to "ProjectName — ViewName"
  useEffect(() => {
    const project = activeSeedLabel ?? 'bim-ai';
    const view = activePlanViewName ?? '';
    document.title = view ? `${project} — ${view}` : project;
  }, [activeSeedLabel, activePlanViewName]);

  const projectNameRef = useRef<HTMLButtonElement | null>(null);
  const planCameraHandleRef = useRef<PlanCameraHandle | null>(null);
  const previousSelectedIdRef = useRef<string | undefined>(selectedId);
  const budgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [compositionState, setCompositionState] = useState<WorkspaceCompositionState>(() =>
    readPersistedCompositions(
      readPersistedTabs() ?? EMPTY_TABS,
      readPersistedPaneLayout() ?? createPaneLayout(null),
    ),
  );
  const {
    loadingCompositionId,
    finishCompositionLoadingSoon,
    markCompositionLoading,
    runAfterLoadingPaint,
  } = useWorkspaceCompositionLoading();
  const [tabsState, setTabsState] = useState<TabsState>(() => {
    const activeComposition =
      compositionState.compositions.find(
        (composition) => composition.id === compositionState.activeId,
      ) ?? compositionState.compositions[0];
    return activeComposition?.tabsState ?? EMPTY_TABS;
  });
  const [draggingViewElementId, setDraggingViewElementId] = useState<string | null>(null);
  const [paneSecondarySidebarOpenByKey, setPaneSecondarySidebarOpenByKey] = useState<
    Record<string, boolean>
  >({});
  const [paneElementSidebarOpenByKey, setPaneElementSidebarOpenByKey] = useState<
    Record<string, boolean>
  >({});
  const [paneLayout, setPaneLayout] = useState<PaneLayoutState>(() => {
    const activeComposition =
      compositionState.compositions.find(
        (composition) => composition.id === compositionState.activeId,
      ) ?? compositionState.compositions[0];
    return activeComposition?.paneLayout ?? createPaneLayout(null);
  });
  const [panePlanToolsById, setPanePlanToolsById] = useState<Record<string, PlanTool>>({});
  const previousFocusedPaneLeafIdRef = useRef(paneLayout.focusedLeafId);

  const setPanePlanTool = useCallback(
    (leafId: string, tool: PlanTool): void => {
      setPanePlanToolsById((state) =>
        state[leafId] === tool ? state : { ...state, [leafId]: tool },
      );
      if (leafId === paneLayout.focusedLeafId) {
        setPlanTool(tool);
      }
    },
    [paneLayout.focusedLeafId, setPlanTool],
  );

  const setFocusedPanePlanTool = useCallback(
    (tool: PlanTool): void => {
      setPanePlanTool(paneLayout.focusedLeafId, tool);
    },
    [paneLayout.focusedLeafId, setPanePlanTool],
  );

  /** Persist tabs on every change (T-06). */
  useEffect(() => {
    persistTabs(tabsState);
  }, [tabsState]);
  useEffect(() => {
    if (previousFocusedPaneLeafIdRef.current !== paneLayout.focusedLeafId) {
      previousFocusedPaneLeafIdRef.current = paneLayout.focusedLeafId;
      const paneTool = panePlanToolsById[paneLayout.focusedLeafId];
      if (paneTool && paneTool !== planTool) {
        setPlanTool(paneTool);
      } else if (!paneTool) {
        setPanePlanToolsById((state) => ({ ...state, [paneLayout.focusedLeafId]: planTool }));
      }
      return;
    }
    const paneTool = panePlanToolsById[paneLayout.focusedLeafId];
    if (paneTool !== planTool) {
      setPanePlanToolsById((state) => ({ ...state, [paneLayout.focusedLeafId]: planTool }));
    }
  }, [paneLayout.focusedLeafId, panePlanToolsById, planTool, setPlanTool]);
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
  const focusedPaneTabId = useMemo(
    () => tabIdForLeaf(paneLayout.root, paneLayout.focusedLeafId),
    [paneLayout],
  );
  const focusedPaneTab = useMemo(
    () =>
      focusedPaneTabId ? (tabsState.tabs.find((tab) => tab.id === focusedPaneTabId) ?? null) : null,
    [focusedPaneTabId, tabsState.tabs],
  );
  const focusedPaneLensMode = focusedPaneTab?.lensMode ?? lensMode;

  const handleTabActivate = useCallback(
    (id: string) => {
      if (tabsState.activeId !== id) {
        markCompositionLoading(compositionState.activeId);
      }
      runAfterLoadingPaint(() => {
        let pendingPlanCamera: ViewportSnapshot['planCamera'] | undefined;
        let incomingTab: ViewTab | undefined;

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
          incomingTab = t;
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
        // Keep external store state in sync after the React state updater has
        // returned; updating Zustand inside the updater trips React's
        // setState-during-render warning for subscribed children.
        if (incomingTab?.kind === 'plan' && incomingTab.targetId) {
          // FE-CQ-01-followup: one-shot getState read in a deferred
          // callback — no subscription, no re-render dependency.
          const target = useBimStore.getState().elementsById[incomingTab.targetId];
          if (target?.kind === 'plan_view') {
            activatePlanView(target.id);
          } else if (target?.kind === 'level') {
            activatePlanView(undefined);
            setActiveLevelId(target.id);
          }
        }
        const restored = incomingTab?.viewportState?.orbitCameraPoseMm;
        if (restored?.eyeMm && restored.targetMm) {
          useBimStore.getState().setOrbitCameraFromViewpointMm({
            position: restored.eyeMm,
            target: restored.targetMm,
            up: { xMm: 0, yMm: 1, zMm: 0 },
          });
        }
      }, compositionState.activeId);
    },
    [
      activatePlanView,
      compositionState.activeId,
      markCompositionLoading,
      runAfterLoadingPaint,
      setActiveLevelId,
      tabsState.activeId,
    ],
  );

  const setFocusedPaneLensMode = useCallback(
    (nextLensMode: LensMode) => {
      const tabId = tabIdForLeaf(paneLayout.root, paneLayout.focusedLeafId);
      if (!tabId) {
        setLensMode(nextLensMode);
        return;
      }
      setTabsState((state) => updateTabLens(state, tabId, nextLensMode));
    },
    [paneLayout, setLensMode],
  );

  const openTabFromElement = useCallback(
    (el: Element) => {
      const partial = tabFromElement(el);
      if (!partial) return;
      markCompositionLoading(compositionState.activeId);
      runAfterLoadingPaint(() => {
        const focusedTabId = tabIdForLeaf(paneLayout.root, paneLayout.focusedLeafId);
        const focusedTab = focusedTabId
          ? tabsState.tabs.find((tab) => tab.id === focusedTabId)
          : null;
        const baseId = tabIdFor(partial.kind, partial.targetId);
        const tabId = tabMatchesView(focusedTab, partial)
          ? focusedTab!.id
          : uniqueTabInstanceId(tabsState, baseId);
        const tab: ViewTab = {
          id: tabId,
          kind: partial.kind,
          targetId: partial.targetId,
          label: partial.label,
          lensMode: focusedTab?.lensMode ?? lensMode,
        };
        setTabsState((state) => upsertTabInstance(state, tab));
        setPaneLayout((layout) =>
          focusPane(assignTabToPane(layout, layout.focusedLeafId, tabId), layout.focusedLeafId),
        );
      }, compositionState.activeId);
    },
    [
      compositionState.activeId,
      lensMode,
      markCompositionLoading,
      paneLayout,
      runAfterLoadingPaint,
      tabsState,
    ],
  );

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
      // FE-CQ-01-followup: one-shot getState read in a callback — no
      // subscription, no dep churn.
      const element = useBimStore.getState().elementsById[elementId];
      if (!element) return;
      const partial = tabFromElement(element);
      if (!partial) return;
      const existingLeafTabId = tabIdForLeaf(paneLayout.root, leafId);
      const existingLeafTab = existingLeafTabId
        ? tabsState.tabs.find((tab) => tab.id === existingLeafTabId)
        : null;
      const baseId = tabIdFor(partial.kind, partial.targetId);
      const tabId =
        !direction && tabMatchesView(existingLeafTab, partial)
          ? existingLeafTab!.id
          : uniqueTabInstanceId(tabsState, baseId);
      const tab: ViewTab = {
        id: tabId,
        kind: partial.kind,
        targetId: partial.targetId,
        label: partial.label,
        lensMode: existingLeafTab?.lensMode ?? lensMode,
      };
      setTabsState((state) => upsertTabInstance(state, tab));
      setPaneLayout((layout) => {
        const focused = focusPane(layout, leafId);
        return direction
          ? splitPaneWithTab(focused, leafId, direction, tabId)
          : focusPane(assignTabToPane(focused, leafId, tabId), leafId);
      });
      activateDroppedView(tab);
      setDraggingViewElementId(null);
    },
    [activateDroppedView, lensMode, paneLayout.root, tabsState],
  );

  const {
    handleCompositionActivate,
    handleCompositionClose,
    handleCompositionCreate,
    handleCompositionRename,
    handleCompositionReorder,
  } = useWorkspaceCompositionActions({
    compositionState,
    finishCompositionLoadingSoon,
    markCompositionLoading,
    paneLayout,
    runAfterLoadingPaint,
    setCompositionState,
    setMode,
    setPaneLayout,
    setTabsState,
    setViewerMode,
    tabsState,
  });

  const {
    handleSaveSnapshot,
    handleExportIfc,
    handleExportDxf,
    handleExportDwg,
    handleExportDgn,
    handleRestoreSnapshot,
    handlePickRecent,
    handleNewClear,
    handleDuplicateProject,
    handleRevertProject,
  } = useWorkspaceProjectActions({
    activeSeedLabel,
    saveAsMaximumBackups,
    hydrateFromSnapshot,
    setSeedError,
    setRecentProjects,
    setTabsState,
  });

  const { handleCommentPost, handleCommentResolve } = useWorkspaceComments({
    modelId,
    userDisplayName,
    activeLevelId,
    selectedId,
    setComments,
  });

  const onSemanticCommandLive = useWorkspaceSemanticCommand({
    activeLevelId,
    activePlanViewId,
    ApiHttpError,
    applyCommand,
    applyFamilyParameters,
    applyHideInView,
    applyIsolateInView,
    applyResetHiddenInView,
    autoDimensionWalls,
    autoDimensionWallsCmd,
    buildCollaborationConflictQueueV1,
    checkHeadHeightClearances,
    computeShaftCutFloors,
    createSimilarPayload,
    equalizeWitnessSpacing,
    generateCurtainWallsFromMass,
    generateFloorsFromMass,
    generateRoofFromMass,
    generateWallsFromMass,
    groupRegistry,
    hydrateFromSnapshot,
    log,
    materializeOptimisticHostedOpening,
    modelId,
    rememberLocalClientOp,
    selectedId,
    selectedIds,
    setActiveComponentAssetId,
    setActiveComponentAssetPreviewEntry,
    setActiveComponentFamilyTypeId,
    setActivity,
    setActiveLevelId,
    setCollaborationConflictQueue,
    setGroupRegistry,
    setPendingCommandCount,
    setPlanTool,
    setRedoDepth,
    setSeedError,
    setUndoDepth,
    shaftBoundaryFromStair,
    stackDimensions,
    syncLastLevelElevationPropagationFromApplyResponse,
    tagAllRoomsFn,
    userId,
  });

  // Time-travel Wave 4: in historical mode every command-authoring path
  // funnels back through `onSemanticCommand`, so guarding it here
  // disables the entire write surface without plumbing a flag through
  // every button. `applyCommand` calls in the few specialised flows
  // (library place, catalog family load, …) are guarded individually
  // below.
  const onSemanticCommand = useCallback(
    async (cmd: Record<string, unknown>): Promise<void> => {
      if (isHistorical) {
        log.info(
          'historical',
          'semantic command ignored — workspace is in historical (read-only) mode',
          String((cmd as { type?: unknown })?.type ?? ''),
        );
        return;
      }
      return onSemanticCommandLive(cmd);
    },
    [isHistorical, onSemanticCommandLive],
  );

  const deleteSelectedElements = useCallback((): boolean => {
    const st = useBimStore.getState();
    const idsToDelete = [
      ...new Set(
        [st.selectedId, ...st.selectedIds].filter((id): id is string => typeof id === 'string'),
      ),
    ];
    if (idsToDelete.length === 0) return false;
    void onSemanticCommand(
      idsToDelete.length === 1
        ? { type: 'deleteElement', elementId: idsToDelete[0] }
        : { type: 'deleteElements', elementIds: idsToDelete },
    );
    st.select(undefined);
    st.clearSelectedIds();
    return true;
  }, [onSemanticCommand]);

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
      if (isHistorical) {
        log.info('historical', 'library place ignored in historical (read-only) mode');
        return;
      }
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
      setPendingCommandCount((count) => count + 1);
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
      } finally {
        setPendingCommandCount((count) => Math.max(0, count - 1));
      }
    },
    [hydrateFromSnapshot, isHistorical],
  );

  /* ── Undo / Redo ────────────────────────────────────────────────────── */
  const handleUndoRedo = useCallback(
    (isUndo: boolean) => {
      if (isHistorical) {
        log.info('historical', 'undo/redo ignored in historical (read-only) mode');
        return Promise.resolve();
      }
      return runUndoRedo(
        {
          hydrateFromSnapshot,
          setPendingCommandCount,
          setUndoDepth,
          setRedoDepth,
          setActivity,
          setCollaborationConflictQueue,
        },
        isUndo,
      );
    },
    [hydrateFromSnapshot, setActivity, isHistorical],
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

  useWorkspaceDefaultTab({
    // FE-CQ-01-followup: `elementsById` omitted — hook subscribes
    // internally. See `useWorkspaceDefaultTab.ts`.
    modelId,
    activeLevelId,
    setTabsState,
    setMode,
    setViewerMode,
    activatePlanView,
    setActiveLevelId,
    setOrbitCameraFromViewpointMm,
  });

  /* ── Mode wiring (§7 + §20) ────────────────────────────────────────── */
  const handleModeChange = useCallback(
    (next: WorkspaceMode) => {
      setMode(next);
      if (next === 'plan') setViewerMode('plan_canvas');
      else if (next === '3d') setViewerMode('orbit_3d');
      // Activate or open a tab of the matching kind so the canvas
      // mounts the right view.
      // FE-CQ-01-followup: one-shot getState read inside the setTabsState
      // updater — no subscription, no dep churn.
      setTabsState((s) => {
        const fallback = defaultTabFallbackForKind(
          next,
          useBimStore.getState().elementsById,
          activeLevelId,
        );
        if (!fallback) return s;
        return activateOrOpenKind(s, next as TabKind, fallback);
      });
    },
    [setViewerMode, activeLevelId],
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
  useWorkspaceHotkeys({
    effectiveMode,
    toolRegistry,
    deleteSelectedElements,
    setFocusedPanePlanTool,
    handleModeChange,
    handleUndoRedo,
    openActiveVisibilityControls,
    toggleActivityDrawer,
    setOrthoSnapHold,
    setCheatsheetOpen,
    setPaletteOpen,
    setLibraryOpen,
    setTabsState,
  });

  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);

  /* ── Debug: browser rendering budget (debounced, threshold warnings) ─ */
  // FE-CQ-01-followup: the readout consumes `elementsById` but the effect
  // only fires after a 2s debounce, so it reads the latest snapshot at
  // fire time via `getState()`. Trigger when `planProjectionPrimitives`
  // changes (the actual signal this readout cares about); the snapshot
  // captured at timer-fire time is always fresh.
  useEffect(() => {
    if (budgetTimerRef.current) clearTimeout(budgetTimerRef.current);
    budgetTimerRef.current = setTimeout(() => {
      const readout = buildBrowserRenderingBudgetReadoutV1({
        elementsById: useBimStore.getState().elementsById,
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
  }, [planProjectionPrimitives]);

  /* ── Debug: selected element dump (dev only) ─────────────────────── */
  // FE-CQ-01-followup: keyed only on `selectedId` — the element snapshot
  // is read fresh from the ref-mirror at effect-fire time, no broad
  // subscription dep needed.
  useEffect(() => {
    if (!import.meta.env.DEV || import.meta.env.MODE === 'test' || !selectedId) return;
    const el = elementsByIdRef.current[selectedId];
    if (el) console.debug('[bim] selected element:', el);
  }, [selectedId, elementsByIdRef]);

  /* ── Status bar wiring ────────────────────────────────────────────── */
  const levels = useMemo(
    () => modelLevels.map((l) => ({ id: l.id, label: l.name, elevationMm: l.elevationMm })),
    [modelLevels],
  );
  const activeLevel = levels.find((l) => l.id === activeLevelId) ??
    levels[0] ?? { id: '', label: '—' };
  const cursorMm = planHudMm ? { xMm: planHudMm.xMm, yMm: planHudMm.yMm } : null;
  // FE-CQ-01-followup: narrow selector returning a primitive — Zustand
  // re-fires only when the count itself changes, not on every
  // unrelated elementsById delta.
  const driftCount = useBimStore((s) => selectDriftedElements(s.elementsById).length);
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
  const handleToolSelect = useCallback(
    (id: ToolId): void => {
      const tool = canonicalPlanToolForMode(id, effectiveMode);
      if (!tool) return;
      const def = toolRegistry[id];
      if (def && !def.modes.includes(effectiveMode) && def.modes.includes('plan')) {
        handleModeChange('plan');
      }
      setFocusedPanePlanTool(tool);
    },
    [effectiveMode, handleModeChange, setFocusedPanePlanTool, toolRegistry],
  );

  // REF-CQ-01: material-browser state extracted to a hook. Owns the
  // open/closed flags, the active-target selection, and the dispatchers
  // (open*, assignMaterialToTarget) the ribbon / inspector / palette
  // call into. The hook also owns the `selectedElement` memo because
  // every consumer of it currently feeds it back into the material
  // resolver. See useMaterialBrowserState.ts.
  const {
    activeMaterialKey,
    activeMaterialTargetLabel,
    materialBrowserOpen,
    setMaterialBrowserOpen,
    appearanceAssetBrowserOpen,
    setAppearanceAssetBrowserOpen,
    openMaterialBrowser,
    openAppearanceAssetBrowser,
    assignMaterialToTarget,
    clearActiveMaterialBrowserTarget,
  } = useMaterialBrowserState({
    // FE-CQ-01-followup: `elementsById` omitted — hook subscribes
    // internally. See `useMaterialBrowserState.ts`.
    selectedId,
    onSemanticCommand,
  });

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
    // PERF-G03 finishing: assembled from narrow modelIndices slices so
    // the useMemo only recomputes when one of those view-surface kinds
    // changes — not on every unrelated elementsById write.
    type Entity = { id: string; label: string; keywords: string };
    const out: Entity[] = [];
    for (const el of modelPlanViews) {
      out.push({ id: el.id, label: `Plan: ${el.name ?? el.id}`, keywords: 'plan view' });
    }
    for (const el of modelViewpoints) {
      out.push({ id: el.id, label: `3D: ${el.name ?? el.id}`, keywords: 'viewpoint' });
    }
    for (const el of modelSavedViews) {
      out.push({ id: el.id, label: `3D: ${el.name ?? el.id}`, keywords: 'saved view' });
    }
    for (const el of modelSectionCuts) {
      out.push({ id: el.id, label: `Section: ${el.name ?? el.id}`, keywords: 'section cut' });
    }
    for (const el of modelSheets) {
      out.push({ id: el.id, label: `Sheet: ${el.name ?? el.id}`, keywords: 'sheet' });
    }
    for (const el of modelSchedules) {
      out.push({ id: el.id, label: `Schedule: ${el.name ?? el.id}`, keywords: 'schedule' });
    }
    return out;
  }, [
    modelPlanViews,
    modelViewpoints,
    modelSavedViews,
    modelSectionCuts,
    modelSheets,
    modelSchedules,
  ]);

  // PERF-G03 finishing: narrow modelIndices.viewTemplates subscription
  // (added in this commit) keeps the palette useMemo cached through
  // unrelated elementsById writes.
  const palettePlanTemplates = useMemo(
    () =>
      modelViewTemplates.map((template) => ({
        id: template.id,
        label: template.name,
        keywords: `${template.name} plan template view template`,
      })),
    [modelViewTemplates],
  );
  const openElementById = useCallback(
    (id: string) => {
      // FE-CQ-01-followup: one-shot getState read in a callback — no
      // subscription, no fallback needed. Previously the read fell back
      // to the broad `elementsById` subscription; the store is always
      // the canonical source.
      const el = useBimStore.getState().elementsById[id] as Element | undefined;
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
      if (el.kind === 'elevation_view') {
        useBimStore.getState().select(el.id);
        setMode('elevation');
        return;
      }
      if (el.kind === 'project_settings') {
        useBimStore.getState().select(el.id);
        setRightRailOverride('open');
      }
    },
    [activatePlanView, openTabFromElement, setActiveLevelId, setViewerMode],
  );

  // Iter-11 capture toolchain hook (see spec/trackers/testhouse-visual-fidelity-tracker.md
  // methodology learning #11). Honors `?activeElevationView=<id>`,
  // `?activePlanView=<id>`, and `?activeViewpoint=<id>` so headless capture
  // scripts can deep-link straight into a specific view without driving the UI.
  // openElementById covers tab + mode; for elevation_view we also have to call
  // the store's activateElevationView (it sets viewerMode=plan_canvas) since
  // openElementById's elevation branch only calls setMode + select.
  const urlViewActivatedRef = useRef(false);
  useEffect(() => {
    if (urlViewActivatedRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const elevationId = params.get('activeElevationView');
    const planId = params.get('activePlanView');
    const viewpointId = params.get('activeViewpoint');
    const targetId = elevationId ?? planId ?? viewpointId;
    if (!targetId) return;
    // FE-CQ-01-followup: one-shot getState read — `modelId` / `revision`
    // are the reactive triggers for "the snapshot just hydrated", so we
    // re-fire the effect when those change and read elementsById once
    // at fire time rather than subscribing broadly.
    if (!useBimStore.getState().elementsById[targetId]) return;
    urlViewActivatedRef.current = true;
    openElementById(targetId);
    if (elevationId) useBimStore.getState().activateElevationView(elevationId);
  }, [modelId, revision, openElementById]);

  // MF-render-3 (#27): honor ``?renderStyle=<shaded|wireframe|hidden-line|…>``
  // on mount so the reverse-BIM capture runner can deep-link into a specific
  // render mode without driving the UI. The capture pipeline emits one URL per
  // (viewpoint, style) pair — wireframe & hidden-line surface modeling defects
  // (stray geometry, eave/ridge mismatches) that a shaded surface hides.
  const urlRenderStyleAppliedRef = useRef(false);
  useEffect(() => {
    if (urlRenderStyleAppliedRef.current) return;
    if (typeof window === 'undefined') return;
    const requested = parseViewerRenderStyleParam(
      new URLSearchParams(window.location.search).get('renderStyle'),
    );
    if (!requested) return;
    urlRenderStyleAppliedRef.current = true;
    useBimStore.getState().setViewerRenderStyle(requested);
  }, []);

  // MF-render-5 (#54): honor ``?projection=<perspective|orthographic>`` on
  // mount so ``capture-ortho-views`` can deliver true orthographic frames for
  // the ``ortho-{n,s,e,w}.png`` captures. The saved viewpoints stay
  // ``mode: "orbit_3d"`` (saveViewpoint has no first-class ortho mode), but
  // the store-level ``viewerProjection`` toggle re-projects the same orbit
  // pose through the orthographic camera (see ``Viewport.tsx``,
  // ``orthoMode = viewerProjection === 'orthographic'``). Without this, the
  // files named ``ortho-…`` shipped a 3/4 perspective with foreshortening
  // that misled grader massing comparisons.
  const urlProjectionAppliedRef = useRef(false);
  useEffect(() => {
    if (urlProjectionAppliedRef.current) return;
    if (typeof window === 'undefined') return;
    const requested = parseViewerProjectionParam(
      new URLSearchParams(window.location.search).get('projection'),
    );
    if (!requested) return;
    urlProjectionAppliedRef.current = true;
    useBimStore.getState().setViewerProjection(requested);
  }, []);

  const openProjectSettings = useCallback(() => {
    setProjectSetupOpen(true);
  }, []);

  const {
    createFloorPlanView,
    create3dSavedView,
    createSectionView,
    createSheetView,
    createScheduleView,
  } = useWorkspaceCreateViews({
    // FE-CQ-01-followup: `elementsById` omitted — hook subscribes
    // internally. See `useWorkspaceCreateViews.ts`.
    activePlanViewId,
    activeViewpointId,
    onSemanticCommand,
    openElementById,
    orbitCameraPoseMm,
    setFocusedPanePlanTool,
    setMode,
    setSeedError,
    setViewerMode,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerProjection,
  });

  const {
    paletteActiveScheduleId,
    paletteActiveSheetId,
    paletteActiveSectionId,
    paletteSheetPlaceableViews,
    openSelectedScheduleRow,
    placeActiveScheduleOnSheet,
    duplicateActiveSchedule,
    navigateTo,
    openActiveSheetAnchor,
    placeRecommendedViewsOnActiveSheet,
    placeViewOnActiveSheet,
    placeActiveSectionOnSheet,
    openActiveSectionSourcePlan,
    openActiveSection3dContext,
    adjustActiveSectionCropDepth,
    openScheduleControls,
  } = useWorkspacePaletteActions({
    // FE-CQ-01-followup: `elementsById` omitted — hook subscribes
    // internally. See `useWorkspacePaletteActions.ts`.
    activeTab,
    effectiveMode,
    selectedId,
    onSemanticCommand,
    openElementById,
    handleModeChange,
    setOrbitCameraFromViewpointMm,
  });
  const commitSave3dViewWithName = useCallback(
    (name: string) => {
      if (!orbitCameraPoseMm) return;
      const hiddenSemanticKinds3d = Object.entries(viewerCategoryHidden)
        .filter(([, hidden]) => hidden)
        .map(([kind]) => kind);
      setSave3dViewAsOpen(false);
      void onSemanticCommand({
        type: 'create_saved_view',
        id: `sv-3d-${Date.now().toString(36)}`,
        baseViewId: activeViewpointId ?? 'orbit_3d',
        name,
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
    },
    [
      activeViewpointId,
      onSemanticCommand,
      orbitCameraPoseMm,
      viewerCategoryHidden,
      viewerClipElevMm,
      viewerClipFloorElevMm,
      viewerProjection,
    ],
  );
  const saveCurrentViewpoint = useCallback(() => {
    if (!orbitCameraPoseMm) return;
    setSave3dViewAsOpen(true);
  }, [orbitCameraPoseMm]);
  const resetActiveSavedViewpoint = useCallback(() => {
    if (!activeViewpointId) return;
    // FE-CQ-01-followup: one-shot getState read in a callback — no
    // subscription dep needed.
    const viewpoint = useBimStore.getState().elementsById[activeViewpointId];
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
  }, [activeViewpointId, applyOrbitViewpointPreset, setOrbitCameraFromViewpointMm]);
  const updateActiveSavedViewpoint = useCallback(() => {
    if (!activeViewpointId) return;
    // FE-CQ-01-followup: one-shot getState read in a callback — no
    // subscription dep needed.
    const viewpoint = useBimStore.getState().elementsById[activeViewpointId];
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
    onSemanticCommand,
    orbitCameraPoseMm,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
  ]);
  const sectionBoxFromPlan = useCallback(() => {
    const st = useBimStore.getState();
    const pvId = st.activePlanViewId;
    if (!pvId) return;
    const pv = st.elementsById[pvId];
    if (!pv || pv.kind !== 'plan_view') return;
    const minMm = (pv as Record<string, unknown>).cropMinMm as
      | { xMm: number; yMm: number }
      | undefined;
    const maxMm = (pv as Record<string, unknown>).cropMaxMm as
      | { xMm: number; yMm: number }
      | undefined;
    if (!minMm || !maxMm) return;
    st.setViewerSectionBoxExtent({
      minX: minMm.xMm / 1000,
      maxX: maxMm.xMm / 1000,
      minY: -5,
      maxY: 50,
      minZ: minMm.yMm / 1000,
      maxZ: maxMm.yMm / 1000,
    });
    st.setViewerSectionBoxActive(true);
    setViewerMode('orbit_3d');
  }, [setViewerMode]);
  const splitActiveTab = useCallback(
    (direction: PaneSplitDirection) => {
      const focusedTabId =
        tabIdForLeaf(paneLayout.root, paneLayout.focusedLeafId) ?? tabsState.activeId;
      if (!focusedTabId) return;
      const focusedTab = tabsState.tabs.find((tab) => tab.id === focusedTabId);
      if (!focusedTab) return;
      const splitTabId = uniqueTabInstanceId(tabsState, focusedTab.id);
      const splitTab: ViewTab = { ...focusedTab, id: splitTabId };
      setTabsState((state) => upsertTabInstance(state, splitTab));
      setPaneLayout((layout) =>
        splitPaneWithTab(layout, layout.focusedLeafId, direction, splitTabId),
      );
    },
    [paneLayout.focusedLeafId, paneLayout.root, tabsState],
  );

  const ensureFamilyPlacementPane = useCallback(
    (adapter: ReturnType<typeof getFamilyPlacementAdapter>): string => {
      const leafId = paneLayout.focusedLeafId;
      const focusedTabId = tabIdForLeaf(paneLayout.root, leafId);
      const focusedTab = focusedTabId
        ? tabsState.tabs.find((tab) => tab.id === focusedTabId)
        : null;
      const canPlaceInCurrentPane =
        focusedTab?.kind === 'plan' ||
        (focusedTab?.kind === '3d' && adapter.mode !== 'type-driven-system');
      if (canPlaceInCurrentPane) return leafId;
      if (adapter.mode !== 'free-component' && adapter.hostRequirement !== 'wall') {
        return leafId;
      }

      // FE-CQ-01-followup: one-shot getState read inside the callback —
      // no subscription, no dep churn.
      const liveElementsById = useBimStore.getState().elementsById;
      const fallback = defaultTabFallbackForKind('plan', liveElementsById, activeLevelId);
      if (!fallback) return leafId;
      const tabId = tabIdFor('plan', fallback.targetId);
      const tab: ViewTab = {
        id: tabId,
        kind: 'plan',
        targetId: fallback.targetId,
        label: fallback.label,
        lensMode: focusedTab?.lensMode ?? lensMode,
      };
      setTabsState((state) => upsertTabInstance(state, tab));
      setPaneLayout((layout) => focusPane(assignTabToPane(layout, leafId, tabId), leafId));
      setMode('plan');
      setViewerMode('plan_canvas');
      const target = fallback.targetId ? liveElementsById[fallback.targetId] : undefined;
      if (target?.kind === 'plan_view') {
        activatePlanView(target.id);
      } else if (target?.kind === 'level') {
        activatePlanView(undefined);
        setActiveLevelId(target.id);
      }
      return leafId;
    },
    [
      activatePlanView,
      activeLevelId,
      lensMode,
      paneLayout.focusedLeafId,
      paneLayout.root,
      setActiveLevelId,
      setViewerMode,
      tabsState.tabs,
    ],
  );

  const handlePlaceFamilyType = useCallback(
    (kind: FamilyLibraryPlaceKind, typeId: string) => {
      setPendingPlacement({ kind, typeId });
      const adapter = getFamilyPlacementAdapter(kind);
      const placementLeafId = ensureFamilyPlacementPane(adapter);
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
        setPanePlanTool(placementLeafId, adapter.planTool);
      } else if (adapter.semanticInstanceKind === 'family_type_component') {
        setPanePlanTool(placementLeafId, 'component');
      }
    },
    [ensureFamilyPlacementPane, setPanePlanTool],
  );

  const loadCatalogFamilyIntoProject = useCallback(
    async (placement: ExternalCatalogPlacement, overwriteOption?: FamilyReloadOverwriteOption) => {
      if (isHistorical) {
        log.info('historical', 'catalog-family load ignored in historical (read-only) mode');
        return null;
      }
      if (!modelId) return null;
      // FE-CQ-01-followup: one-shot getState read in an async callback —
      // no subscription, no dep churn.
      const liveElementsById = useBimStore.getState().elementsById;
      const loadPlan = planCatalogFamilyLoad(placement, liveElementsById, { overwriteOption });
      const assetEntry = shouldPlaceCatalogFamilyAsAsset(placement) ? placement.assetEntry : null;
      const existingAsset = assetEntry ? liveElementsById[assetEntry.id] : undefined;
      const canPlaceAsAsset = Boolean(
        assetEntry && (!existingAsset || existingAsset.kind === 'asset_library_entry'),
      );
      const commands = [
        loadPlan.command,
        ...(assetEntry && !existingAsset ? [indexAssetCommandFromEntry(assetEntry)] : []),
      ];
      try {
        const r = await applyCommandBundle(modelId, commands, {
          userId: 'component-tool',
        });
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
        log.error('component-tool', 'applyCommandBundle failed', err);
        return null;
      }
      return {
        kind: loadPlan.kind,
        typeId: loadPlan.typeId,
        assetId: canPlaceAsAsset ? assetEntry?.id : undefined,
      };
    },
    [hydrateFromSnapshot, modelId, isHistorical],
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
      if (!loaded) return;
      if (loaded.assetId) {
        if (placement.assetEntry && placement.assetEntry.id === loaded.assetId) {
          setActiveComponentAssetPreviewEntry(assetPreviewElementFromEntry(placement.assetEntry));
        }
        handlePlaceFamilyType('asset', loaded.assetId);
        return;
      }
      handlePlaceFamilyType(loaded.kind, loaded.typeId);
    },
    [handlePlaceFamilyType, loadCatalogFamilyIntoProject],
  );

  const handleUpdateArrayFormula = useCallback(
    (update: FamilyLibraryArrayFormulaUpdate) =>
      updateArrayFormula(
        {
          modelId,
          // FE-CQ-01-followup: one-shot getState read inside the
          // callback — no subscription, no dep churn.
          elementsById: useBimStore.getState().elementsById,
          onSemanticCommand,
          hydrateFromSnapshot,
          setUndoDepth,
          setRedoDepth,
          setSeedError,
        },
        update,
      ),
    [hydrateFromSnapshot, modelId, onSemanticCommand, setSeedError],
  );

  /* ── VIS-V3-06: right rail driven by task context ────────────────── */
  const hasSelection = !!selectedId;
  const rightRailCollapsed = !hasSelection || rightRailOverride === 'collapsed';
  const toggleRightRail = useCallback(() => {
    if (!hasSelection) return;
    const key = `${compositionState.activeId}:${paneLayout.focusedLeafId}`;
    setPaneElementSidebarOpenByKey((state) => ({
      ...state,
      [key]: !(state[key] ?? true),
    }));
  }, [compositionState.activeId, hasSelection, paneLayout.focusedLeafId]);

  useEffect(() => {
    const previousSelectedId = previousSelectedIdRef.current;
    if (!selectedId) {
      previousSelectedIdRef.current = selectedId;
      return;
    }
    if (selectedId !== previousSelectedId) {
      setRightRailOverride('open');
      const key = `${compositionState.activeId}:${paneLayout.focusedLeafId}`;
      setPaneElementSidebarOpenByKey((state) => ({ ...state, [key]: true }));
    }
    previousSelectedIdRef.current = selectedId;
  }, [compositionState.activeId, paneLayout.focusedLeafId, selectedId]);

  /* ── Empty-state per §25 ──────────────────────────────────────────── */
  const emptyHint = patternFor(seedLoading ? 'canvas-loading' : 'canvas-empty');
  // PERF-G03 finishing: modelIndices.walls is updated by the invariant
  // subscriber, so this check no longer iterates elementsById on every
  // unrelated delta.
  const showEmptyState = modelWalls.length === 0;
  const showEmptyStateOverlay = showEmptyState && planTool === 'select';
  // Issue #124 — MF-render-11. The capture runner needs a machine-readable
  // "snapshot has streamed in" signal so the first cardinal ortho doesn't
  // catch the "Loading model…" overlay. Geometry is considered ready once
  // the seed fetch is no longer pending AND the model has at least one
  // structural element (walls or levels — covers both house seeds and
  // empty-but-loaded sandbox sessions where the user will draw manually).
  const modelReady = !seedLoading && (modelWalls.length > 0 || modelLevels.length > 0);

  /* ── CHR-V3-10: canvas hint (select/tool idle) ────────────────────── */
  const showCanvasHint = !selectedId && planTool === 'select';
  const tabsById = useMemo(
    () => Object.fromEntries(tabsState.tabs.map((tab) => [tab.id, tab])),
    [tabsState.tabs],
  );
  const focusedPaneLeafId = paneLayout.focusedLeafId;
  const rootPaneFooterInsetLeft =
    paneLayout.root.kind === 'leaf' &&
    Boolean(paneLayout.root.tabId && tabsById[paneLayout.root.tabId]) &&
    (paneSecondarySidebarOpenByKey[`${compositionState.activeId}:${paneLayout.root.id}`] ?? true)
      ? PANE_SECONDARY_SIDEBAR_WIDTH
      : undefined;

  const runSelectedWall3dInsert = useCallback(
    (kind: 'door' | 'window' | 'opening') => {
      if (!selectedId) return;
      // FE-CQ-01-followup: one-shot getState read inside the callback —
      // no subscription, no dep churn.
      const selected = useBimStore.getState().elementsById[selectedId];
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
    [effectiveMode, onSemanticCommand, selectedId],
  );

  // REF-CQ-02: per-pane render is owned by WorkspacePaneNode.tsx. We
  // build the shared context once per Workspace render and pass it in
  // through the WorkspaceCanvasSlot.renderPaneNode prop. The context
  // object is rebuilt on every render — this is intentional: the
  // pane-node component is uncached, so any "stale ctx" problem would
  // already manifest in the previous closure-based implementation.
  const paneNodeCtx: WorkspacePaneNodeContext = {
    effectiveMode,
    setMode,
    setViewerMode,
    viewerProjection,
    viewerWalkModeActive,
    viewerSectionBoxActive,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    tabsState,
    tabsById,
    setTabsState,
    paneLayout,
    setPaneLayout,
    focusedPaneLeafId,
    panePlanToolsById,
    setPanePlanTool,
    paneSecondarySidebarOpenByKey,
    setPaneSecondarySidebarOpenByKey,
    paneElementSidebarOpenByKey,
    setPaneElementSidebarOpenByKey,
    compositionStateActiveId: compositionState.activeId,
    handleTabActivate,
    selectedId,
    draggingViewElementId,
    placeViewElementInPane,
    // FE-CQ-01-followup: `elementsById` omitted — `WorkspacePaneNode`
    // subscribes internally. See WorkspacePaneNode.tsx.
    activeLevelId,
    setActiveLevelId,
    activeLevel,
    levels,
    planTool,
    setPlanTool,
    loopMode,
    draftGridVisible,
    toggleDraftGridVisible,
    cursorMm,
    snapModes,
    handleSnapToggle,
    snapSettings,
    toolRegistry,
    lensMode,
    temporaryVisibility,
    clearTemporaryVisibility,
    projectNorthAngleDeg,
    trueNorthActive,
    setTrueNorthActive,
    sheetReviewMode,
    setSheetReviewMode,
    sheetMarkupShape,
    setSheetMarkupShape,
    setPaletteOpen,
    setManageLinksOpen,
    setAdvisorOpen,
    setFamilyLibraryOpen,
    setCheatsheetOpen,
    setManagePhasesOpen,
    setManageGlobalParamsOpen,
    setDimStyleOpen,
    setViewRangeOpen,
    setVgOpen,
    setSharePresentationOpen,
    onSemanticCommand,
    openElementById,
    createSectionView,
    saveCurrentViewpoint,
    resetActiveSavedViewpoint,
    updateActiveSavedViewpoint,
    runSelectedWall3dInsert,
    placeActiveSectionOnSheet,
    openActiveSectionSourcePlan,
    openActiveSection3dContext,
    adjustActiveSectionCropDepth,
    placeRecommendedViewsOnActiveSheet,
    paletteSheetPlaceableViews,
    placeViewOnActiveSheet,
    openActiveSheetAnchor,
    openSelectedScheduleRow,
    placeActiveScheduleOnSheet,
    duplicateActiveSchedule,
    openScheduleControls,
    firstDuplicateWallFix,
    firstOrphanFix,
    openMaterialBrowser,
    openAppearanceAssetBrowser,
    planCameraHandleRef,
    modelId,
    wsOn,
    persistViewpointField,
  };
  const renderPaneNode = (node: PaneNode): JSX.Element => (
    <WorkspacePaneNode node={node} ctx={paneNodeCtx} />
  );

  /* ── Compose AppShell slots ───────────────────────────────────────── */
  return (
    <>
      {isHistorical && historicalCommitId ? (
        <div
          data-testid="historical-mode-banner"
          role="status"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10_000,
            background: 'var(--color-warning)',
            color: 'var(--color-warning-foreground)',
            padding: '6px 14px',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: 0.2,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            pointerEvents: 'none',
          }}
        >
          <span aria-hidden="true">⏪</span>
          <span>
            Viewing historical state — commit{' '}
            <code style={{ padding: '1px 6px' }}>{historicalCommitId.slice(0, 12)}</code>. Commands
            are disabled (read-only).
          </span>
        </div>
      ) : null}
      <WorkspaceOverlays
        // FE-CQ-01-followup: `elementsById` omitted — overlays
        // subscribes internally. See WorkspaceOverlays.tsx.
        modelId={modelId}
        revision={revision}
        userId={userId}
        userDisplayName={userDisplayName}
        activeLevelId={activeLevelId}
        activePlanViewId={activePlanViewId}
        activeWorkspaceId={activeWorkspaceId}
        selectedId={selectedId}
        selectedIds={selectedIds}
        projectNameRef={projectNameRef}
        recentProjects={recentProjects}
        seedModels={seedModels}
        activeSeedLabel={activeSeedLabel}
        saveAsMaximumBackups={saveAsMaximumBackups}
        sheetPages={sheetPages}
        comments={comments}
        commentOutsideScopeNote={disciplineScopeNote(
          activeWorkspaceId,
          // FE-CQ-01-followup: render-time lookup via the ref-mirror.
          // The mirror is updated by a vanilla store subscription, so
          // reads never trigger a Workspace re-render.
          selectedId ? (elementsByIdRef.current[selectedId] as Element | undefined) : undefined,
        )}
        advisorCounts={advisorCounts}
        unifiedAdvisorViolations={unifiedAdvisorViolations}
        buildingPreset={buildingPreset}
        codePresetIds={codePresetIds}
        perspectiveId={perspectiveId}
        activeMaterialKey={activeMaterialKey}
        activeMaterialTargetLabel={activeMaterialTargetLabel}
        groupRegistry={groupRegistry}
        clearanceViolations={clearanceViolations}
        activityIsOpen={activityIsOpen}
        libraryDiscipline={libraryDisciplineFromLens(focusedPaneLensMode)}
        vvDialogOpen={vvDialogOpen}
        cheatsheetOpen={cheatsheetOpen}
        setCheatsheetOpen={setCheatsheetOpen}
        printPlotOpen={printPlotOpen}
        setPrintPlotOpen={setPrintPlotOpen}
        save3dViewAsOpen={save3dViewAsOpen}
        setSave3dViewAsOpen={setSave3dViewAsOpen}
        familyLibraryOpen={familyLibraryOpen}
        setFamilyLibraryOpen={setFamilyLibraryOpen}
        materialBrowserOpen={materialBrowserOpen}
        setMaterialBrowserOpen={setMaterialBrowserOpen}
        appearanceAssetBrowserOpen={appearanceAssetBrowserOpen}
        setAppearanceAssetBrowserOpen={setAppearanceAssetBrowserOpen}
        clearActiveMaterialBrowserTarget={clearActiveMaterialBrowserTarget}
        tourOpen={tourOpen}
        setTourOpen={setTourOpen}
        templatesOpen={templatesOpen}
        setTemplatesOpen={setTemplatesOpen}
        versionHistoryOpen={versionHistoryOpen}
        setVersionHistoryOpen={setVersionHistoryOpen}
        appSettingsOpen={appSettingsOpen}
        setAppSettingsOpen={setAppSettingsOpen}
        advisorOpen={advisorOpen}
        setAdvisorOpen={setAdvisorOpen}
        jobsOpen={jobsOpen}
        setJobsOpen={setJobsOpen}
        commentsOpen={commentsOpen}
        setCommentsOpen={setCommentsOpen}
        projectMenuOpen={projectMenuOpen}
        setProjectMenuOpen={setProjectMenuOpen}
        projectSetupOpen={projectSetupOpen}
        setProjectSetupOpen={setProjectSetupOpen}
        manageLinksOpen={manageLinksOpen}
        setManageLinksOpen={setManageLinksOpen}
        dxfImportOpen={dxfImportOpen}
        setDxfImportOpen={setDxfImportOpen}
        projectUnitsOpen={projectUnitsOpen}
        setProjectUnitsOpen={setProjectUnitsOpen}
        phaseManagerOpen={phaseManagerOpen}
        setPhaseManagerOpen={setPhaseManagerOpen}
        managePhasesOpen={managePhasesOpen}
        setManagePhasesOpen={setManagePhasesOpen}
        globalParamsOpen={globalParamsOpen}
        setGlobalParamsOpen={setGlobalParamsOpen}
        vgOpen={vgOpen}
        setVgOpen={setVgOpen}
        perViewVGOpen={perViewVGOpen}
        setPerViewVGOpen={setPerViewVGOpen}
        setWorkPlaneOpen={setWorkPlaneOpen}
        setSetWorkPlaneOpen={setSetWorkPlaneOpen}
        manageGlobalParamsOpen={manageGlobalParamsOpen}
        setManageGlobalParamsOpen={setManageGlobalParamsOpen}
        dimStyleOpen={dimStyleOpen}
        setDimStyleOpen={setDimStyleOpen}
        projectInfoOpen={projectInfoOpen}
        setProjectInfoOpen={setProjectInfoOpen}
        milestoneDialogOpen={milestoneDialogOpen}
        setMilestoneDialogOpen={setMilestoneDialogOpen}
        pasteToLevelsOpen={pasteToLevelsOpen}
        setPasteToLevelsOpen={setPasteToLevelsOpen}
        selectionFilterOpen={selectionFilterOpen}
        setSelectionFilterOpen={setSelectionFilterOpen}
        createGroupOpen={createGroupOpen}
        setCreateGroupOpen={setCreateGroupOpen}
        sharePresentationOpen={sharePresentationOpen}
        setSharePresentationOpen={setSharePresentationOpen}
        libraryOpen={libraryOpen}
        setLibraryOpen={setLibraryOpen}
        terraceFloorId={terraceFloorId}
        setTerraceFloorId={setTerraceFloorId}
        setClearanceViolations={setClearanceViolations}
        onSemanticCommand={onSemanticCommand}
        commitSave3dViewWithName={commitSave3dViewWithName}
        handlePlaceFamilyType={handlePlaceFamilyType}
        handlePlaceCatalogFamily={handlePlaceCatalogFamily}
        handleLoadCatalogFamily={handleLoadCatalogFamily}
        handleUpdateArrayFormula={handleUpdateArrayFormula}
        assignMaterialToTarget={assignMaterialToTarget}
        setBuildingPreset={setBuildingPreset}
        openElementById={openElementById}
        handleCommentPost={handleCommentPost}
        handleCommentResolve={handleCommentResolve}
        handlePickRecent={handlePickRecent}
        loadSeedModel={loadSeedModel}
        insertSeedHouse={insertSeedHouse}
        handleSaveSnapshot={handleSaveSnapshot}
        handleSaveAsMaximumBackupsChange={handleSaveAsMaximumBackupsChange}
        handleRestoreSnapshot={handleRestoreSnapshot}
        openMilestoneDialog={openMilestoneDialog}
        openMaterialBrowser={openMaterialBrowser}
        openAppearanceAssetBrowser={openAppearanceAssetBrowser}
        handleNewClear={handleNewClear}
        replayOnboardingTour={replayOnboardingTour}
        handleExportIfc={handleExportIfc}
        handleExportDxf={handleExportDxf}
        handleExportDwg={handleExportDwg}
        handleExportDgn={handleExportDgn}
        handleDuplicateProject={handleDuplicateProject}
        handleRevertProject={handleRevertProject}
        closeVVDialog={closeVVDialog}
        setGroupRegistry={setGroupRegistry}
        closeActivityDrawer={closeActivityDrawer}
        handleLibraryPlace={handleLibraryPlace}
      />
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
          activeLensMode: focusedPaneLensMode,
          activePlanViewId,
          activeScheduleId: paletteActiveScheduleId,
          activeSheetId: paletteActiveSheetId,
          activeSectionId: paletteActiveSectionId,
          activeViewpointId,
          canSaveCurrentViewpoint: Boolean(orbitCameraPoseMm),
          navigateMode: (kind) => navigateTo({ kind, source: 'cmdk' }),
          startPlanTool: (toolId) => handleToolSelect(toolId as ToolId),
          setTheme: handleThemeSet,
          setLensMode: setFocusedPaneLensMode,
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
          openMaterialBrowser: () => openMaterialBrowser(),
          openAppearanceAssetBrowser: () => openAppearanceAssetBrowser(),
          openKeyboardShortcuts: () => setCheatsheetOpen(true),
          replayOnboardingTour,
          openAdvisor: () => setAdvisorOpen(true),
          openJobs: () => setJobsOpen(true),
          openMilestone: openMilestoneDialog,
          openVersionHistory: () => setVersionHistoryOpen(true),
          openAppSettings: () => setAppSettingsOpen(true),
          openPasteToLevels: () => setPasteToLevelsOpen(true),
          openSelectionFilter: () => setSelectionFilterOpen(true),
          openCreateGroup: () => setCreateGroupOpen(true),
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
          openManageGlobalParams: () => setManageGlobalParamsOpen(true),
          openManagePhases: () => setManagePhasesOpen(true),
          openDimensionStyle: () => setDimStyleOpen(true),
          openViewRange: () => setViewRangeOpen(true),
          openVisibilityGraphics: () => setVgOpen(true),
          openProjectInfo: () => setProjectInfoOpen(true),
          setWorkPlaneOpen: (open: boolean) => setSetWorkPlaneOpen(open),
          openTerracePreset: () => {
            const sel = useBimStore.getState().elementsById[selectedId ?? ''];
            if (sel?.kind === 'floor') setTerraceFloorId(sel.id);
          },
          sectionBoxFromPlan,
          openPrintDialog: () => setPrintPlotOpen(true),
          openProjectTemplates: () => setTemplatesOpen(true),
          duplicateProject: handleDuplicateProject,
          revertProject: handleRevertProject,
          autoDimWalls: () => {
            const lvlId = activeLevelId ?? '';
            if (!lvlId) return;
            // FE-CQ-01-followup: one-shot getState read at click time.
            const dims = autoDimensionWalls(lvlId, useBimStore.getState().elementsById);
            for (const d of dims) void onSemanticCommand({ type: 'createElement', element: d });
          },
          tagAllRooms: () => {
            const lvlId = activeLevelId ?? '';
            if (!lvlId) return;
            // FE-CQ-01-followup: one-shot getState read at click time.
            const tags = tagAllRoomsFn(lvlId, useBimStore.getState().elementsById);
            for (const t of tags) void onSemanticCommand({ type: 'createElement', element: t });
          },
          rotateToTrueNorth: () => {
            const ps = useBimStore.getState().modelIndices.projectSettings;
            const angleDeg = ps?.angleToTrueNorthDeg ?? 0;
            // FE-CQ-01-followup: one-shot getState read at click time.
            const activeView = activePlanViewId
              ? useBimStore.getState().elementsById[activePlanViewId]
              : undefined;
            if (!activeView) return;
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: activeView.id,
              key: 'planViewAngleDeg',
              value: -angleDeg,
            });
          },
          setTrueNorthAngle: () => {
            const angleDeg = parseFloat(
              prompt('Angle from project north to true north (degrees clockwise):') ?? '0',
            );
            if (isNaN(angleDeg)) return;
            const ps = useBimStore.getState().modelIndices.projectSettings;
            if (!ps) return;
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: ps.id,
              key: 'angleToTrueNorthDeg',
              value: angleDeg,
            });
          },
          setProjectElevation: () => {
            const elevMm = parseFloat(prompt('Project real-world elevation (mm):') ?? '0');
            if (isNaN(elevMm)) return;
            const ps = useBimStore.getState().modelIndices.projectSettings;
            if (!ps) return;
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: ps.id,
              key: 'projectElevationMm',
              value: elevMm,
            });
          },
          checkClearances: () => {
            const lvlId = activeLevelId ?? '';
            if (!lvlId) return;
            // FE-CQ-01-followup: one-shot getState read at click time.
            const violations = checkHeadHeightClearances(
              lvlId,
              useBimStore.getState().elementsById as Record<
                string,
                import('@bim-ai/core').Element | undefined
              >,
            );
            setClearanceViolations(violations);
            if (violations.length === 0) {
              alert('No clearance violations found.');
            } else {
              alert(`${violations.length} clearance violation(s) found. See highlighted elements.`);
            }
          },
        }}
      />
      <AppShell
        activeMode={effectiveMode}
        showRibbonToolbars={false}
        leftCollapsed={leftRailCollapsed}
        onLeftCollapsedChange={setLeftRailCollapsed}
        rightCollapsed={rightRailCollapsed}
        footerInsetLeft={rootPaneFooterInsetLeft}
        header={
          <WorkspaceHeaderSlot
            compositionState={compositionState}
            loadingCompositionId={loadingCompositionId}
            activeSeedLabel={activeSeedLabel}
            activePlanViewName={activePlanViewName}
            sheetPagesCount={sheetPages.length}
            presenceParticipants={presenceParticipants}
            presenceLocalUserId={presenceLocalUserId}
            userId={userId}
            onSharePresentation={() => setSharePresentationOpen(true)}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onToggleComments={() => setCommentsOpen((v) => !v)}
            onActivate={handleCompositionActivate}
            onCreate={handleCompositionCreate}
            onClose={handleCompositionClose}
            onReorder={handleCompositionReorder}
            onRename={handleCompositionRename}
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
            activeViewTargetId={activeTab?.targetId}
            userDisplayName={userDisplayName}
            userId={userId}
            modelId={modelId}
            revision={revision}
          />
        }
        canvas={
          <WorkspaceCanvasSlot
            activeViewKind={activeTab?.kind}
            showEmptyStateOverlay={showEmptyStateOverlay}
            showCanvasHint={showCanvasHint && !showEmptyState}
            emptyHint={emptyHint}
            seedLoading={seedLoading}
            seedError={seedError}
            modelReady={modelReady}
            onInsertSeedHouse={insertSeedHouse}
            paneRoot={paneLayout.root}
            renderPaneNode={renderPaneNode}
            onSemanticCommand={onSemanticCommand}
          />
        }
        footer={
          <WorkspaceFooterSlot
            level={activeLevel}
            undoDepth={undoDepth}
            redoDepth={redoDepth}
            pendingCommandCount={pendingCommandCount}
            onUndo={() => void handleUndoRedo(true)}
            onRedo={() => void handleUndoRedo(false)}
            wsState={wsOn ? 'connected' : 'offline'}
            saveState={pendingCommandCount > 0 ? 'saving' : 'saved'}
            advisorCounts={advisorCounts}
            onAdvisorClick={() => setAdvisorOpen(true)}
            jobsCounts={jobsCounts}
            onJobsClick={() => setJobsOpen(true)}
            selectionCount={selectionCount}
            activeWorkspaceId={activeWorkspaceId}
            driftCount={driftCount}
            onDriftClick={() => setManageLinksOpen(true)}
            activityUnreadCount={activityUnreadCount}
            onActivityClick={toggleActivityDrawer}
            planTool={planTool}
            toolPhase={activeToolPhase}
            hoveredElementKind={hoveredElementKind}
          />
        }
      />
    </>
  );
}
