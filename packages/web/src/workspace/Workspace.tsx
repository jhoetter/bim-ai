import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';
import { Icons, type IconName } from '@bim-ai/ui';

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
import { applyCommand, ApiHttpError, fetchActivity, undoModel, redoModel } from '../lib/api';
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
import { AppShell, RibbonBar, ViewContextStatusPanel, type WorkspaceMode } from './shell';
import { LensDropdown } from './shell/LensDropdown';
import { OptionsBar, ToolModifierBar } from './authoring';
import { getToolRegistry, type ToolDefinition, type ToolId } from '../tools/toolRegistry';
import {
  EMPTY_TABS,
  activateOrOpenKind,
  activateTab,
  closeInactiveTabs,
  closeTab,
  cycleActive,
  openTab,
  snapshotViewport,
  TAB_KIND_LABEL,
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
  createPaneLayout,
  focusPane,
  findPaneForTab,
  normalizePaneLayout,
  persistPaneLayout,
  readPersistedPaneLayout,
  removePaneLeaf,
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
import { materialTargetLayerIndex } from '../viewport/hostMaterialLayerTargets';
import type { MaterialBrowserTargetRequest } from './inspector';
import {
  findLoadedCatalogFamilyType,
  planCatalogFamilyLoad,
  type FamilyReloadOverwriteOption,
} from '../families/catalogFamilyReload';
import { getFamilyPlacementAdapter } from '../families/familyPlacementAdapters';
import { applyCommandBundle } from '../lib/api';
import { readOnboardingProgress, resetOnboarding } from '../onboarding/tour';
import { CanvasMount } from './viewport';
import {
  defaultTabFallbackForKind,
  hifiIconForTabKind,
  resolvePlanTabTarget,
} from './WorkspaceHelpers';
import {
  assetPreviewElementFromEntry,
  indexAssetCommandFromEntry,
  shouldPlaceCatalogFamilyAsAsset,
} from './catalogPlacementHelpers';
import { applyHideInView, applyIsolateInView, applyResetHiddenInView } from './hideInView';
import { WorkspaceLeftRail } from './WorkspaceLeftRail';
import { WorkspaceRightRail } from './WorkspaceRightRail';
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
import { canonicalPlanToolForMode, planToolToToolId } from './workspaceUtils';
import {
  materialEditableTargetLabel,
  materialKeyForInstanceTarget,
  materialSlotTargetLabel,
  resolveMaterialEditableTarget,
  type ActiveMaterialBrowserTarget,
} from './materialTargets';
import {
  disciplineScopeNote,
  EMPTY_JOBS_COUNTS,
  firstMmVector,
  formatStatusMm,
  libraryDisciplineFromLens,
  splitViewTabLabel,
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
  const { t, i18n } = useTranslation();
  const toolRegistry = useMemo(() => getToolRegistry(t), [t]);
  const elementsById = useBimStore((s) => s.elementsById);
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
  const structuralViolations = useStructuralValidationViolations(elementsById);
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

  const projectNorthAngleDeg = useMemo(() => {
    const bp = elementsById['project_base_point'] as
      | Extract<Element, { kind: 'project_base_point' }>
      | undefined;
    if (bp?.kind === 'project_base_point') return bp.angleToTrueNorthDeg ?? 0;
    const ps = elementsById['project_settings'] as
      | Extract<Element, { kind: 'project_settings' }>
      | undefined;
    if (ps?.kind === 'project_settings') return ps.projectNorthAngleDeg ?? 0;
    return 0;
  }, [elementsById]);

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
  const [materialBrowserOpen, setMaterialBrowserOpen] = useState(false);
  const [appearanceAssetBrowserOpen, setAppearanceAssetBrowserOpen] = useState(false);
  const [activeMaterialBrowserTarget, setActiveMaterialBrowserTarget] =
    useState<ActiveMaterialBrowserTarget | null>(null);
  const [sheetReviewMode, setSheetReviewMode] = useState<SheetReviewMode>('cm');
  const [sheetMarkupShape, setSheetMarkupShape] = useState<SheetMarkupShape>('freehand');
  const [_pendingPlacement, setPendingPlacement] = useState<{
    kind: FamilyLibraryPlaceKind;
    typeId: string;
  } | null>(null);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [save3dViewAsOpen, setSave3dViewAsOpen] = useState(false);
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

  // §1.6.1: derive active plan view display name for document.title and breadcrumb
  const activePlanViewName = useMemo(() => {
    if (!activePlanViewId) return undefined;
    const pv = elementsById[activePlanViewId];
    if (!pv || pv.kind !== 'plan_view') return undefined;
    return (pv as Extract<Element, { kind: 'plan_view' }>).name;
  }, [activePlanViewId, elementsById]);

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
  const pendingChordRef = useRef<string | null>(null);
  const pendingChordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
          const target = elementsById[incomingTab.targetId];
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
      elementsById,
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
      const element = elementsById[elementId];
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
    [activateDroppedView, elementsById, lensMode, paneLayout.root, tabsState],
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

  const onSemanticCommand = useWorkspaceSemanticCommand({
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
    elementsById,
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
    [hydrateFromSnapshot],
  );

  /* ── Undo / Redo ────────────────────────────────────────────────────── */
  const handleUndoRedo = useCallback(
    async (isUndo: boolean): Promise<void> => {
      const mid = useBimStore.getState().modelId;
      const uid = useBimStore.getState().userId;
      if (!mid) return;
      setPendingCommandCount((count) => count + 1);
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
      } finally {
        setPendingCommandCount((count) => Math.max(0, count - 1));
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

  // After a model has hydrated, prune any restored tabs whose targets
  // no longer exist (e.g. a sheet deleted between sessions). If the
  // pruned set is empty, open a sensible default view for this model.
  // This is keyed by model id, not by app lifetime, because local seed
  // workflows often switch between disposable evidence models and the
  // final seed model in one browser session.
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
    const defaultTab: Omit<ViewTab, 'id'> | null = preferredViewpoint
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
      if (pruned.tabs.length > 0) return pruned;
      return openTab(pruned, defaultTab);
    });
    if (defaultTab.kind === '3d') {
      setMode('3d');
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
      setMode('plan');
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
    setViewerMode,
  ]);

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
      const target = event.target;
      if (target instanceof globalThis.HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
        if (target.closest('[role="dialog"]')) return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        effectiveMode !== 'plan'
      ) {
        if (deleteSelectedElements()) event.preventDefault();
        return;
      }
      if (
        event.key === 'Escape' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        // UX: Escape always returns authoring to the default Select cursor.
        setFocusedPanePlanTool('select');
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
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
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
          const tool = canonicalPlanToolForMode(chordTool.id, effectiveMode);
          if (tool) {
            event.preventDefault();
            setFocusedPanePlanTool(tool);
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
          const tool = canonicalPlanToolForMode(hotkeyTool.id, effectiveMode);
          if (tool) setFocusedPanePlanTool(tool);
        }, 400);
        return;
      }

      if (hotkeyTool) {
        const tool = canonicalPlanToolForMode(hotkeyTool.id, effectiveMode);
        if (tool) {
          event.preventDefault();
          setFocusedPanePlanTool(tool);
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
    setFocusedPanePlanTool,
    deleteSelectedElements,
    setOrthoSnapHold,
    effectiveMode,
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
    if (!import.meta.env.DEV || import.meta.env.MODE === 'test' || !selectedId) return;
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

  const selectedElement = useMemo(
    () => (selectedId ? (elementsById[selectedId] as Element | undefined) : undefined),
    [elementsById, selectedId],
  );
  const materialEditableTarget = useMemo(
    () => resolveMaterialEditableTarget(selectedElement, elementsById),
    [selectedElement, elementsById],
  );
  const selectedMaterialKey =
    materialEditableTarget?.kind === 'instance'
      ? materialKeyForInstanceTarget(materialEditableTarget)
      : materialEditableTarget
        ? (materialEditableTarget.element.layers[
            materialTargetLayerIndex(materialEditableTarget.element)
          ]?.materialKey ?? null)
        : null;
  const activeMaterialKey =
    activeMaterialBrowserTarget?.kind === 'material-slot'
      ? (activeMaterialBrowserTarget.currentKey ?? null)
      : (activeMaterialBrowserTarget?.currentKey ?? selectedMaterialKey);
  const activeMaterialTargetLabel =
    activeMaterialBrowserTarget?.kind === 'material-slot'
      ? materialSlotTargetLabel(activeMaterialBrowserTarget, elementsById)
      : (activeMaterialBrowserTarget?.label ??
        (materialEditableTarget ? materialEditableTargetLabel(materialEditableTarget) : null));

  const openMaterialBrowser = useCallback(
    (target?: MaterialBrowserTargetRequest) => {
      if (target) {
        setActiveMaterialBrowserTarget(target);
      } else if (materialEditableTarget) {
        setActiveMaterialBrowserTarget({
          kind: 'editable',
          target: materialEditableTarget,
          label: materialEditableTargetLabel(materialEditableTarget),
          currentKey: selectedMaterialKey,
        });
      } else {
        setActiveMaterialBrowserTarget(null);
      }
      setMaterialBrowserOpen(true);
    },
    [materialEditableTarget, selectedMaterialKey],
  );

  const openAppearanceAssetBrowser = useCallback(
    (target?: MaterialBrowserTargetRequest) => {
      if (target) {
        setActiveMaterialBrowserTarget(target);
      } else if (materialEditableTarget) {
        setActiveMaterialBrowserTarget({
          kind: 'editable',
          target: materialEditableTarget,
          label: materialEditableTargetLabel(materialEditableTarget),
          currentKey: selectedMaterialKey,
        });
      } else {
        setActiveMaterialBrowserTarget(null);
      }
      setAppearanceAssetBrowserOpen(true);
    },
    [materialEditableTarget, selectedMaterialKey],
  );

  const assignMaterialToTarget = useCallback(
    (materialKey: string) => {
      const target =
        activeMaterialBrowserTarget ??
        (materialEditableTarget
          ? ({
              kind: 'editable',
              target: materialEditableTarget,
              label: materialEditableTargetLabel(materialEditableTarget),
              currentKey: selectedMaterialKey,
            } satisfies ActiveMaterialBrowserTarget)
          : null);
      if (!target) return;
      if (target.kind === 'material-slot') {
        const element = elementsById[target.elementId];
        if (!element || !('materialSlots' in element)) return;
        const currentSlots =
          (element.materialSlots as Record<string, string | null> | null | undefined) ?? {};
        void onSemanticCommand({
          type: 'updateElementProperty',
          elementId: element.id,
          key: 'materialSlots',
          value: { ...currentSlots, [target.slot]: materialKey },
        });
        return;
      }
      if (target.target.kind === 'instance') {
        void onSemanticCommand({
          type: 'updateElementProperty',
          elementId: target.target.element.id,
          key: target.target.property,
          value: materialKey,
        });
        return;
      }
      const targetLayer = materialTargetLayerIndex(target.target.element);
      const nextLayers = target.target.element.layers.map((layer, index) =>
        index === targetLayer ? { ...layer, materialKey } : { ...layer },
      );
      if (!nextLayers.length) return;
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: target.target.element.id,
        key: 'layers',
        value: nextLayers,
      });
    },
    [
      activeMaterialBrowserTarget,
      elementsById,
      materialEditableTarget,
      onSemanticCommand,
      selectedMaterialKey,
    ],
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
    [activatePlanView, elementsById, openTabFromElement, setActiveLevelId, setViewerMode],
  );

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
    activePlanViewId,
    activeViewpointId,
    elementsById,
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
    activeTab,
    effectiveMode,
    elementsById,
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

      const fallback = defaultTabFallbackForKind('plan', elementsById, activeLevelId);
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
      const target = fallback.targetId ? elementsById[fallback.targetId] : undefined;
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
      elementsById,
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
      if (!modelId) return null;
      const loadPlan = planCatalogFamilyLoad(placement, elementsById, { overwriteOption });
      const assetEntry = shouldPlaceCatalogFamilyAsAsset(placement) ? placement.assetEntry : null;
      const existingAsset = assetEntry ? elementsById[assetEntry.id] : undefined;
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
    [elementsById, hydrateFromSnapshot, modelId],
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
  const showEmptyState =
    (Object.values(elementsById) as Element[]).filter((e) => e.kind === 'wall').length === 0;
  const showEmptyStateOverlay = showEmptyState && planTool === 'select';

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

  function renderPaneNode(node: PaneNode): JSX.Element {
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
    const paneLensMode = paneTab?.lensMode ?? lensMode;
    const paneMode = (paneTab?.kind as WorkspaceMode | undefined) ?? effectiveMode;
    const paneIsPlan = paneTab?.kind === 'plan';
    const panePlanTarget = paneIsPlan
      ? resolvePlanTabTarget(elementsById, paneTab?.targetId, activeLevelId)
      : { activeLevelId: activeLevelId ?? '' };
    const paneViewerMode = paneTab?.kind === '3d' ? 'orbit_3d' : 'plan_canvas';
    const focused = focusedPaneLeafId === node.id;
    const panePlanTool = panePlanToolsById[node.id] ?? 'select';
    const paneLabel = paneTab?.label ?? 'Empty pane';
    const paneLabelParts = splitViewTabLabel(
      paneLabel,
      paneTab ? TAB_KIND_LABEL[paneTab.kind] : undefined,
    );
    const paneCanAcceptDrop = Boolean(draggingViewElementId);
    const paneIconName: IconName =
      paneTab?.kind === '3d'
        ? 'orbitView'
        : paneTab?.kind === 'section'
          ? 'section'
          : paneTab?.kind === 'sheet'
            ? 'sheet'
            : paneTab?.kind === 'schedule'
              ? 'schedule'
              : paneTab?.kind === 'elevation'
                ? 'elevationView'
                : 'planView';
    const PaneIcon = Icons[paneIconName] ?? Icons.planView;
    const PaneHifiIcon = hifiIconForTabKind(paneTab?.kind);
    const paneSidebarKey = `${compositionState.activeId}:${node.id}`;
    const paneSecondarySidebarOpen =
      Boolean(paneTab) && (paneSecondarySidebarOpenByKey[paneSidebarKey] ?? true);
    const paneElementSidebarOpen =
      Boolean(paneTab && selectedId) && (paneElementSidebarOpenByKey[paneSidebarKey] ?? true);
    const selectedElementKind = selectedId
      ? (elementsById[selectedId] as Element | undefined)?.kind
      : null;
    const paneStatusViewDetails = (() => {
      const selected = selectedId ? (elementsById[selectedId] as Element | undefined) : undefined;
      const selectedDetail = selected
        ? `Selected ${selected.kind.replaceAll('_', ' ')}`
        : selectedId
          ? 'Selection'
          : null;
      if (paneMode === '3d') {
        return [
          viewerProjection === 'orthographic' ? 'Ortho' : 'Perspective',
          viewerWalkModeActive ? 'Walk' : 'Orbit',
          viewerSectionBoxActive ? 'Section box' : null,
          viewerClipElevMm != null ? `Cap ${formatStatusMm(viewerClipElevMm)}` : null,
          viewerClipFloorElevMm != null ? `Floor ${formatStatusMm(viewerClipFloorElevMm)}` : null,
          paneTab?.targetId ? `Viewpoint ${paneTab.targetId}` : null,
          selectedDetail,
        ].filter((detail): detail is string => Boolean(detail));
      }
      if (paneMode === 'sheet') return [selectedDetail ?? 'Paper space'];
      if (paneMode === 'schedule') return [selectedDetail ?? 'Rows'];
      if (paneMode === 'elevation') return [selectedDetail ?? 'Elevation'];
      return selectedDetail ? [selectedDetail] : [];
    })();
    const paneTemporaryVisibility =
      temporaryVisibility &&
      (!temporaryVisibility.viewId || temporaryVisibility.viewId === paneTab?.targetId)
        ? temporaryVisibility
        : null;
    const activatePaneForControls = (): void => {
      setMode(paneMode);
      if (paneTab?.kind === '3d') setViewerMode('orbit_3d');
      else if (paneTab?.kind) setViewerMode('plan_canvas');
      setPaneLayout((layout) => focusPane(layout, node.id));
      if (paneTab?.id && paneTab.id !== tabsState.activeId) {
        handleTabActivate(paneTab.id);
      }
    };
    const handlePaneModeChange = (next: WorkspaceMode): void => {
      activatePaneForControls();
      setMode(next);
      if (next === 'plan') setViewerMode('plan_canvas');
      else if (next === '3d') setViewerMode('orbit_3d');

      const fallback = defaultTabFallbackForKind(next, elementsById, activeLevelId);
      if (!fallback) return;
      const tabId = tabIdFor(next as TabKind, fallback.targetId);
      setTabsState((state) => activateOrOpenKind(state, next as TabKind, fallback));
      setPaneLayout((layout) => focusPane(assignTabToPane(layout, node.id, tabId), node.id));
    };
    const handlePaneToolSelect = (id: ToolId): void => {
      const tool = canonicalPlanToolForMode(id, paneMode);
      if (!tool) return;
      setPlanTool(tool);
      activatePaneForControls();
      const def = toolRegistry[id];
      if (def && !def.modes.includes(paneMode) && def.modes.includes('plan')) {
        handlePaneModeChange('plan');
      }
      setPanePlanTool(node.id, tool);
    };
    const runInPaneContext =
      (handler: (() => void) | undefined): (() => void) =>
      () => {
        activatePaneForControls();
        handler?.();
      };
    const togglePaneViewSettings = (): void => {
      activatePaneForControls();
      if (!paneTab) return;
      setPaneSecondarySidebarOpenByKey((state) => ({
        ...state,
        [paneSidebarKey]: !(state[paneSidebarKey] ?? true),
      }));
    };
    const closePaneTab = (): void => {
      if (!paneTab) return;
      const nextLayout = removePaneLeaf(paneLayout, node.id);
      setPaneLayout(nextLayout);
      if (!findPaneForTab(nextLayout.root, paneTab.id)) {
        setTabsState((state) => closeTab(state, paneTab.id));
      }
    };
    const handlePaneLensChange = (nextLensMode: LensMode): void => {
      activatePaneForControls();
      if (!paneTab) return;
      setTabsState((state) => updateTabLens(state, paneTab.id, nextLensMode));
    };
    const isPlanPane = paneTab?.kind === 'plan';
    const paneTrailingControls = paneTab ? (
      <>
        {paneCanAcceptDrop ? (
          <span className="rounded-md border border-accent/60 bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
            Drop view
          </span>
        ) : null}
        {(() => {
          const pvId =
            paneIsPlan && 'activePlanViewId' in panePlanTarget
              ? (panePlanTarget.activePlanViewId ?? null)
              : null;
          const pv = pvId ? elementsById[pvId] : null;
          if (!pv || pv.kind !== 'plan_view' || !pv.phaseId) return null;
          const currentMode = (pv.phaseFilterMode ?? '') as string;
          return (
            <select
              data-testid="phase-filter-mode-select"
              value={currentMode}
              title="Phase filter display mode"
              onChange={(e) => {
                const v = e.currentTarget.value;
                void onSemanticCommand({
                  type: 'updateElementProperty',
                  elementId: pvId,
                  key: 'phaseFilterMode',
                  value: v || null,
                });
              }}
              className={`h-6 rounded-md border px-1 text-[10px] font-medium ${
                currentMode
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface text-muted'
              }`}
            >
              <option value="">Phase: All</option>
              <option value="new_construction">New Construction</option>
              <option value="demolition">Demolition Plan</option>
              <option value="existing">Existing Only</option>
              <option value="as_built">As-Built</option>
            </select>
          );
        })()}
        {isPlanPane && projectNorthAngleDeg !== 0 ? (
          <button
            type="button"
            data-testid="true-north-toggle"
            aria-pressed={trueNorthActive}
            title={
              trueNorthActive
                ? `True North active (${projectNorthAngleDeg}°) — click to disable`
                : `Rotate to True North (${projectNorthAngleDeg}°)`
            }
            onClick={() => setTrueNorthActive((v) => !v)}
            className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium ${
              trueNorthActive
                ? 'border-accent bg-accent text-white'
                : 'border-border text-muted hover:bg-surface-strong hover:text-foreground'
            }`}
          >
            N↑
          </button>
        ) : null}
        <button
          type="button"
          data-testid={`canvas-pane-close-tab-${node.id}`}
          title={`Close ${paneLabel}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground"
          aria-label={`Close ${paneLabel}`}
          onClick={(event) => {
            event.stopPropagation();
            closePaneTab();
          }}
        >
          <Icons.close size={12} aria-hidden="true" />
        </button>
      </>
    ) : null;
    const paneIdentityCell = paneTab ? (
      <div
        data-testid={`canvas-pane-view-header-${node.id}`}
        className="relative z-40 flex h-[84px] min-w-0 flex-col overflow-visible border-r border-b border-border bg-surface-2"
      >
        {paneSecondarySidebarOpen ? (
          <>
            <div className="flex h-8 min-w-0 items-end gap-1.5 px-2.5 pb-1">
              <div
                className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground"
                title={paneLabel}
              >
                {paneLabelParts.viewName || paneLabel}
              </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 bg-background/55 px-2">
              <button
                type="button"
                data-testid="ribbon-mode-identity"
                aria-label={`Hide ${paneLabelParts.viewType} view settings for ${paneLabel}`}
                aria-pressed={paneSecondarySidebarOpen}
                title={`Hide ${paneLabelParts.viewType} view settings for ${paneLabel}`}
                onClick={togglePaneViewSettings}
                className="group relative inline-flex h-11 min-w-12 shrink-0 flex-col items-center justify-center gap-0 rounded-md border border-accent/45 bg-surface px-1.5 text-[11px] font-medium text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-accent-soft"
              >
                <PaneHifiIcon size={30} aria-hidden="true" />
                <span className="max-w-12 truncate">{paneLabelParts.viewType}</span>
              </button>
              <div
                data-testid="ribbon-lens-dropdown"
                className="relative z-50 h-7 min-w-0 rounded-md border border-border bg-background/85 px-1 text-[11px] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <LensDropdown
                  currentLens={paneLensMode}
                  onLensChange={handlePaneLensChange}
                  enableHotkey={false}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="h-8" />
            <div className="flex min-h-0 flex-1 items-center justify-center bg-background/55 px-1">
              <div
                title={`${paneLabelParts.viewType} view settings hidden`}
                className="relative inline-flex h-11 min-w-12 shrink-0 flex-col items-center justify-center gap-0 rounded-md border border-border bg-surface px-1.5 text-[11px] font-medium text-muted"
              >
                <PaneHifiIcon size={30} aria-hidden="true" />
                <span className="max-w-12 truncate">{paneLabelParts.viewType}</span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-accent"
                />
              </div>
            </div>
          </>
        )}
      </div>
    ) : null;
    const paneRibbon = paneTab ? (
      <div data-testid={`canvas-pane-ribbon-${node.id}`}>
        <RibbonBar
          activeToolId={planToolToToolId(panePlanTool)}
          activeMode={paneMode}
          selectedElementKind={selectedElementKind}
          lensMode={paneLensMode}
          inlineViewTitle={{
            icon: paneIconName,
            viewType: paneLabelParts.viewType,
            viewName: paneLabelParts.viewName,
            title: paneLabel,
            viewIconTestId: `canvas-pane-view-icon-${node.id}`,
          }}
          showViewControls={!paneSecondarySidebarOpen}
          trailingControls={paneTrailingControls}
          onLensChange={handlePaneLensChange}
          onToolSelect={handlePaneToolSelect}
          onModeChange={handlePaneModeChange}
          viewSettingsOpen={paneSecondarySidebarOpen}
          onToggleViewSettings={togglePaneViewSettings}
          viewSettingsToggleLabel={`Toggle view settings for ${paneLabel}`}
          onOpenCommandPalette={runInPaneContext(() => setPaletteOpen(true))}
          onOpenManageLinks={runInPaneContext(() => setManageLinksOpen(true))}
          onOpenAdvisor={runInPaneContext(() => setAdvisorOpen(true))}
          onCreateSectionView={runInPaneContext(createSectionView)}
          onToggleElementSidebar={runInPaneContext(() =>
            setPaneElementSidebarOpenByKey((state) => ({
              ...state,
              [paneSidebarKey]: !(state[paneSidebarKey] ?? true),
            })),
          )}
          onOpenFamilyLibrary={runInPaneContext(() => setFamilyLibraryOpen(true))}
          onOpenSettings={runInPaneContext(() => setCheatsheetOpen(true))}
          onSaveCurrentViewpoint={runInPaneContext(saveCurrentViewpoint)}
          onResetActiveSavedViewpoint={runInPaneContext(resetActiveSavedViewpoint)}
          onUpdateActiveSavedViewpoint={runInPaneContext(updateActiveSavedViewpoint)}
          onInsertDoorOnSelectedWall3d={runInPaneContext(() => runSelectedWall3dInsert('door'))}
          onInsertWindowOnSelectedWall3d={runInPaneContext(() => runSelectedWall3dInsert('window'))}
          onInsertOpeningOnSelectedWall3d={runInPaneContext(() =>
            runSelectedWall3dInsert('opening'),
          )}
          onPlaceActiveSectionOnSheet={runInPaneContext(placeActiveSectionOnSheet)}
          onOpenActiveSectionSourcePlan={runInPaneContext(openActiveSectionSourcePlan)}
          onIncreaseActiveSectionCropDepth={runInPaneContext(() =>
            adjustActiveSectionCropDepth(500),
          )}
          onDecreaseActiveSectionCropDepth={runInPaneContext(() =>
            adjustActiveSectionCropDepth(-500),
          )}
          onPlaceRecommendedViewsOnActiveSheet={runInPaneContext(
            placeRecommendedViewsOnActiveSheet,
          )}
          onPlaceFirstViewOnActiveSheet={runInPaneContext(() => {
            const first = paletteSheetPlaceableViews[0];
            if (first) placeViewOnActiveSheet(first.id);
          })}
          onOpenSheetViewportEditor={runInPaneContext(() =>
            openActiveSheetAnchor('sheet-viewport-editor'),
          )}
          onOpenSheetTitleblockEditor={runInPaneContext(() =>
            openActiveSheetAnchor('sheet-titleblock-editor'),
          )}
          onShareActiveSheet={runInPaneContext(() => setSharePresentationOpen(true))}
          onOpenSelectedScheduleRow={runInPaneContext(openSelectedScheduleRow)}
          onPlaceActiveScheduleOnSheet={runInPaneContext(placeActiveScheduleOnSheet)}
          onDuplicateActiveSchedule={runInPaneContext(duplicateActiveSchedule)}
          onOpenScheduleControls={runInPaneContext(openScheduleControls)}
          onRepairDuplicateWall={
            firstDuplicateWallFix
              ? runInPaneContext(() => void onSemanticCommand(firstDuplicateWallFix))
              : undefined
          }
          onRepairOrphan={
            firstOrphanFix
              ? runInPaneContext(() => void onSemanticCommand(firstOrphanFix))
              : undefined
          }
          onOpenManagePhases={() => setManagePhasesOpen(true)}
          onOpenManageGlobalParams={() => setManageGlobalParamsOpen(true)}
          onOpenDimensionStyle={() => setDimStyleOpen(true)}
          onOpenViewRange={() => setViewRangeOpen(true)}
          onOpenVisibilityGraphics={() => setVgOpen(true)}
          sheetReviewMode={sheetReviewMode}
          onSheetReviewModeChange={setSheetReviewMode}
          sheetMarkupShape={sheetMarkupShape}
          onSheetMarkupShapeChange={setSheetMarkupShape}
        />
        {paneMode === 'plan' || paneMode === 'section' ? (
          <>
            <ToolModifierBar activeTool={planToolToToolId(panePlanTool)} />
            <OptionsBar activeTool={panePlanTool} />
          </>
        ) : null}
      </div>
    ) : null;
    const paneSecondarySidebar = paneSecondarySidebarOpen ? (
      <aside
        aria-label={`View settings for ${paneLabel}`}
        data-testid={`canvas-pane-secondary-sidebar-${node.id}`}
        className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-surface"
        style={{ gridColumn: 1, gridRow: 2 }}
      >
        <ViewContextStatusPanel
          mode={paneMode}
          viewLabel={paneLabel}
          viewDetails={paneStatusViewDetails}
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
          snapModes={snapModes}
          onSnapToggle={handleSnapToggle}
          temporaryVisibility={paneTemporaryVisibility}
          onClearTemporaryVisibility={clearTemporaryVisibility}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <WorkspaceRightRail
            mode={paneMode}
            onSemanticCommand={onSemanticCommand}
            onModeChange={handlePaneModeChange}
            onNavigateToElement={openElementById}
            activeViewTargetId={paneTab?.targetId}
            lensMode={paneLensMode}
            surface="view-context"
            onOpenMaterialBrowser={openMaterialBrowser}
            onOpenAppearanceAssetBrowser={openAppearanceAssetBrowser}
          />
        </div>
      </aside>
    ) : null;
    const canvasRotationDeg = trueNorthActive && isPlanPane ? -projectNorthAngleDeg : 0;
    const paneCanvas = (
      <div
        className="min-h-0 min-w-0 flex-1"
        style={{
          background: ['plan', 'section', 'elevation'].includes(paneTab?.kind ?? '')
            ? 'var(--color-canvas-paper)'
            : 'var(--color-background)',
          transform: canvasRotationDeg !== 0 ? `rotate(${canvasRotationDeg}deg)` : undefined,
          transition: 'transform 0.2s ease',
        }}
      >
        {paneTab ? (
          <CanvasMount
            mode={paneMode}
            activeTabId={paneTab.id}
            viewerMode={paneViewerMode}
            activeLevelId={panePlanTarget.activeLevelId}
            activePlanViewId={panePlanTarget.activePlanViewId ?? null}
            elementsById={elementsById}
            onSemanticCommand={(cmd) => void onSemanticCommand(cmd)}
            cameraHandleRef={planCameraHandleRef}
            initialCamera={paneTab.viewportState?.planCamera}
            activeSectionId={
              paneTab.kind === 'section' ? (paneTab.targetId ?? undefined) : undefined
            }
            preferredSheetId={
              paneTab.kind === 'sheet' ? (paneTab.targetId ?? undefined) : undefined
            }
            preferredScheduleId={
              paneTab.kind === 'schedule' ? (paneTab.targetId ?? undefined) : undefined
            }
            preferredElevationId={
              paneTab.kind === 'elevation' ? (paneTab.targetId ?? undefined) : undefined
            }
            modelId={modelId ?? undefined}
            wsOn={wsOn}
            onPersistViewpointField={persistViewpointField}
            lensMode={paneLensMode}
            activePlanTool={panePlanTool}
            onActivePlanToolChange={(nextTool) => {
              setPanePlanTool(node.id, nextTool);
              if (focused) setPlanTool(nextTool);
            }}
            onNavigateToElement={openElementById}
            snapSettings={snapSettings}
            viewOverlayRightInset={paneElementSidebarOpen ? 'min(340px, 45%)' : undefined}
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
    );
    const paneElementSidebar = paneElementSidebarOpen ? (
      <aside
        aria-label={`Element properties for ${paneLabel}`}
        data-testid={`canvas-pane-element-sidebar-${node.id}`}
        className="absolute inset-y-0 right-0 z-30 min-h-0 overflow-hidden border-l border-border bg-surface shadow-elev-2"
        style={{ width: 'min(340px, 45%)' }}
      >
        <WorkspaceRightRail
          mode={paneMode}
          onSemanticCommand={onSemanticCommand}
          onModeChange={handlePaneModeChange}
          onNavigateToElement={openElementById}
          lensMode={paneLensMode}
          surface="element"
          onOpenMaterialBrowser={openMaterialBrowser}
          onOpenAppearanceAssetBrowser={openAppearanceAssetBrowser}
        />
      </aside>
    ) : null;
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
        {paneTab ? (
          <div
            data-testid={`canvas-pane-tabstrip-${node.id}`}
            className={[
              'grid min-h-0 min-w-0 flex-1 bg-surface',
              paneCanAcceptDrop ? 'border border-accent/80 bg-accent/10' : '',
            ].join(' ')}
            style={{
              gridTemplateColumns: paneSecondarySidebarOpen
                ? `${PANE_SECONDARY_SIDEBAR_WIDTH} minmax(0, 1fr)`
                : '64px minmax(0, 1fr)',
              gridTemplateRows: 'auto minmax(0, 1fr)',
            }}
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
            {paneIdentityCell}
            <div className="min-w-0" style={{ gridColumn: 2, gridRow: 1 }}>
              {paneRibbon}
            </div>
            {paneSecondarySidebar}
            <div
              className="relative flex min-h-0 min-w-0 overflow-hidden"
              style={{
                gridColumn: paneSecondarySidebarOpen ? 2 : '1 / 3',
                gridRow: 2,
              }}
            >
              {paneCanvas}
              {paneElementSidebar}
            </div>
          </div>
        ) : (
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
              <span
                data-testid={`canvas-pane-view-icon-${node.id}`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-muted"
                title={paneLabel}
              >
                <PaneIcon size={12} aria-hidden="true" />
              </span>
              <div className="min-w-0 truncate font-medium text-foreground" title={paneLabel}>
                {paneLabel}
              </div>
            </div>
            {paneCanAcceptDrop ? (
              <span className="rounded border border-accent/60 px-1 py-0.5 text-[10px] text-accent">
                Drop view
              </span>
            ) : null}
          </div>
        )}
        {!paneTab ? <div className="flex min-h-0 min-w-0 flex-1">{paneCanvas}</div> : null}
        {draggingViewElementId ? (
          <div className="pointer-events-none absolute left-0 right-0 top-8 bottom-0 z-20">
            {(
              [
                ['left', { left: '4%', top: '28%', width: '18%', height: '44%' }],
                ['right', { right: '4%', top: '28%', width: '18%', height: '44%' }],
                ['top', { left: '28%', top: '5%', width: '44%', height: '18%' }],
                ['bottom', { left: '28%', bottom: '5%', width: '44%', height: '18%' }],
              ] as const
            ).map(([direction, style]) => (
              <button
                key={direction}
                type="button"
                data-testid={`canvas-pane-${node.id}-split-dropzone-${direction}`}
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
                  placeViewElementInPane(elementId, node.id, direction);
                }}
              >
                Drop {direction}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

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
      <WorkspaceOverlays
        elementsById={elementsById}
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
          selectedId ? (elementsById[selectedId] as Element | undefined) : undefined,
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
        clearActiveMaterialBrowserTarget={() => setActiveMaterialBrowserTarget(null)}
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
            const dims = autoDimensionWalls(lvlId, elementsById);
            for (const d of dims) void onSemanticCommand({ type: 'createElement', element: d });
          },
          tagAllRooms: () => {
            const lvlId = activeLevelId ?? '';
            if (!lvlId) return;
            const tags = tagAllRoomsFn(lvlId, elementsById);
            for (const t of tags) void onSemanticCommand({ type: 'createElement', element: t });
          },
          rotateToTrueNorth: () => {
            const ps = Object.values(elementsById).find((e) => e?.kind === 'project_settings') as
              | Extract<Element, { kind: 'project_settings' }>
              | undefined;
            const angleDeg = ps?.angleToTrueNorthDeg ?? 0;
            const activeView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
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
            const ps = Object.values(elementsById).find((e) => e?.kind === 'project_settings');
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
            const ps = Object.values(elementsById).find((e) => e?.kind === 'project_settings');
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
            const violations = checkHeadHeightClearances(
              lvlId,
              elementsById as Record<string, import('@bim-ai/core').Element | undefined>,
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
