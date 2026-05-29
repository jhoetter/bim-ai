/**
 * REF-CQ-02 — pane-node renderer extracted from Workspace.tsx.
 *
 * The recursive component that materialises a `PaneNode` (split or
 * leaf) into the in-canvas pane chrome: identity cell, ribbon,
 * secondary view-settings sidebar, canvas, element sidebar, and the
 * drag/drop-split overlay. It used to live as the 250-LoC
 * `renderPaneNode` closure inside `Workspace.tsx` (≈ lines 2400-2650).
 *
 * The component pulls every dependency from a single `ctx` object so
 * Workspace.tsx wires it once at the top of the canvas slot rather
 * than threading 40+ props through the recursion. This keeps the prop
 * boundary explicit (TypeScript will surface any missing context
 * member) without coupling the leaf renderer to the Workspace closure.
 */
import { createElement, type Dispatch, type JSX, type SetStateAction } from 'react';
import type { Element, LensMode } from '@bim-ai/core';
import { Icons, type IconName } from '@bim-ai/ui';

import { OptionsBar, ToolModifierBar } from './authoring';
import { LensDropdown } from './shell/LensDropdown';
import { RibbonBar, ViewContextStatusPanel, type WorkspaceMode } from './shell';
import { CanvasMount } from './viewport';
import {
  defaultTabFallbackForKind,
  hifiIconForTabKind,
  resolvePlanTabTarget,
} from './WorkspaceHelpers';
import { WorkspaceRightRail } from './WorkspaceRightRail';
import {
  activateOrOpenKind,
  closeTab,
  TAB_KIND_LABEL,
  tabIdFor,
  type TabKind,
  type TabsState,
  type ViewTab,
} from './tabsModel';
import {
  assignTabToPane,
  findPaneForTab,
  focusPane,
  removePaneLeaf,
  type PaneLayoutState,
  type PaneNode,
  type PaneSplitDirection,
} from './paneLayout';
import { updateTabLens } from './compositions';
import { canonicalPlanToolForMode, planToolToToolId } from './workspaceUtils';
import { useBimStore, type PlanTool } from '../state/store';
import type { PlanCameraHandle } from '../plan/PlanCanvas';
import type { SnapSettings } from '../plan/snapSettings';
import type { SheetMarkupShape, SheetReviewMode } from './sheets/sheetReviewUi';
import type { TemporaryVisibility } from '../state/storeTypes';
import type { ToolId, getToolRegistry } from '../tools/toolRegistry';
import { formatStatusMm, splitViewTabLabel } from './workspacePresentation';
import type { OpenMaterialBrowser } from './inspector/materialInspectorSections';

const PANE_SECONDARY_SIDEBAR_WIDTH = 'min(248px, 34%)';

/**
 * The full set of workspace-wide values the pane-node renderer needs to
 * reach. Workspace.tsx builds this object once and passes it down the
 * recursion. Keeping it a single prop (rather than 40 individual props)
 * keeps the JSX call-site readable.
 */
export interface WorkspacePaneNodeContext {
  // Mode + viewer.
  effectiveMode: WorkspaceMode;
  setMode: Dispatch<SetStateAction<WorkspaceMode>>;
  setViewerMode: (mode: 'orbit_3d' | 'plan_canvas') => void;
  viewerProjection: 'perspective' | 'orthographic';
  viewerWalkModeActive: boolean;
  viewerSectionBoxActive: boolean;
  viewerClipElevMm: number | null;
  viewerClipFloorElevMm: number | null;

  // Tabs / panes.
  tabsState: TabsState;
  tabsById: Record<string, ViewTab>;
  setTabsState: Dispatch<SetStateAction<TabsState>>;
  paneLayout: PaneLayoutState;
  setPaneLayout: Dispatch<SetStateAction<PaneLayoutState>>;
  focusedPaneLeafId: string;
  panePlanToolsById: Record<string, PlanTool>;
  setPanePlanTool: (leafId: string, tool: PlanTool) => void;
  paneSecondarySidebarOpenByKey: Record<string, boolean>;
  setPaneSecondarySidebarOpenByKey: Dispatch<SetStateAction<Record<string, boolean>>>;
  paneElementSidebarOpenByKey: Record<string, boolean>;
  setPaneElementSidebarOpenByKey: Dispatch<SetStateAction<Record<string, boolean>>>;
  compositionStateActiveId: string;
  handleTabActivate: (id: string) => void;

  // Selection + drag.
  selectedId: string | undefined;
  draggingViewElementId: string | null;
  placeViewElementInPane: (
    elementId: string | null | undefined,
    leafId: string,
    direction?: PaneSplitDirection,
  ) => void;

  // Element + level data.
  /**
   * FE-CQ-01-followup: optional. When omitted, `WorkspacePaneNode`
   * subscribes to `elementsById` internally via `useBimStore` so the
   * caller (notably `Workspace.tsx`) no longer needs a broad
   * subscription of its own. Reactivity is preserved — pane-node still
   * re-renders when elements change (selected-element kind probe,
   * phase-filter selector, fallback tab targeting all need fresh data).
   */
  elementsById?: Record<string, Element>;
  activeLevelId: string | undefined;
  setActiveLevelId: (id: string | undefined) => void;
  activeLevel: { id: string; label: string; elevationMm?: number };
  levels: Array<{ id: string; label: string; elevationMm: number }>;

  // Plan-tool state.
  planTool: PlanTool;
  setPlanTool: (tool: PlanTool) => void;
  loopMode: boolean;
  draftGridVisible: boolean;
  toggleDraftGridVisible: () => void;
  cursorMm: { xMm: number; yMm: number } | null;
  snapModes: Array<{ id: string; label: string; on: boolean }>;
  handleSnapToggle: (id: string) => void;
  snapSettings: SnapSettings;
  toolRegistry: ReturnType<typeof getToolRegistry>;

  // Lens / visibility.
  lensMode: LensMode;
  temporaryVisibility: TemporaryVisibility | null;
  clearTemporaryVisibility: () => void;

  // Project / true-north.
  projectNorthAngleDeg: number;
  trueNorthActive: boolean;
  setTrueNorthActive: Dispatch<SetStateAction<boolean>>;

  // Sheet / schedule UX state.
  sheetReviewMode: SheetReviewMode;
  setSheetReviewMode: Dispatch<SetStateAction<SheetReviewMode>>;
  sheetMarkupShape: SheetMarkupShape;
  setSheetMarkupShape: Dispatch<SetStateAction<SheetMarkupShape>>;

  // Misc overlay openers + dispatchers.
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setManageLinksOpen: Dispatch<SetStateAction<boolean>>;
  setAdvisorOpen: Dispatch<SetStateAction<boolean>>;
  setFamilyLibraryOpen: Dispatch<SetStateAction<boolean>>;
  setCheatsheetOpen: Dispatch<SetStateAction<boolean>>;
  setManagePhasesOpen: Dispatch<SetStateAction<boolean>>;
  setManageGlobalParamsOpen: Dispatch<SetStateAction<boolean>>;
  setDimStyleOpen: Dispatch<SetStateAction<boolean>>;
  setViewRangeOpen: Dispatch<SetStateAction<boolean>>;
  setVgOpen: Dispatch<SetStateAction<boolean>>;
  setSharePresentationOpen: Dispatch<SetStateAction<boolean>>;

  // Workspace actions / handlers.
  onSemanticCommand: (cmd: Record<string, unknown>) => Promise<void> | void;
  openElementById: (id: string) => void;
  createSectionView: () => void;
  saveCurrentViewpoint: () => void;
  resetActiveSavedViewpoint: () => void;
  updateActiveSavedViewpoint: () => void;
  runSelectedWall3dInsert: (kind: 'door' | 'window' | 'opening') => void;
  placeActiveSectionOnSheet: () => void;
  openActiveSectionSourcePlan: () => void;
  openActiveSection3dContext: () => void;
  adjustActiveSectionCropDepth: (deltaMm: number) => void;
  placeRecommendedViewsOnActiveSheet: () => void;
  paletteSheetPlaceableViews: ReadonlyArray<{ id: string; label: string }>;
  placeViewOnActiveSheet: (id: string) => void;
  openActiveSheetAnchor: (anchor: 'sheet-viewport-editor' | 'sheet-titleblock-editor') => void;
  openSelectedScheduleRow: () => void;
  placeActiveScheduleOnSheet: () => void;
  duplicateActiveSchedule: () => void;
  openScheduleControls: () => void;
  firstDuplicateWallFix: Record<string, unknown> | undefined;
  firstOrphanFix: Record<string, unknown> | undefined;

  // Material browser.
  openMaterialBrowser: OpenMaterialBrowser;
  openAppearanceAssetBrowser: OpenMaterialBrowser;

  // Canvas mount.
  planCameraHandleRef: React.RefObject<PlanCameraHandle | null>;
  modelId: string | null | undefined;
  wsOn: boolean;
  persistViewpointField: (payload: {
    elementId: string;
    key: string;
    value: string;
  }) => Promise<void>;
}

export interface WorkspacePaneNodeProps {
  node: PaneNode;
  ctx: WorkspacePaneNodeContext;
}

/**
 * The recursive pane-node renderer. Splits delegate back into the
 * component (preserving the original recursion); leaves render the
 * full pane chrome.
 */
export function WorkspacePaneNode({ node, ctx }: WorkspacePaneNodeProps): JSX.Element {
  // FE-CQ-01-followup: fall back to the store when no prop is supplied so
  // Workspace.tsx no longer needs its own broad `elementsById`
  // subscription. The subscription is hoisted above the split-vs-leaf
  // branch so it's unconditional (rules of hooks).
  const elementsByIdFromStore = useBimStore((s) => s.elementsById);
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
            node.axis === 'horizontal' ? 'border-r border-border/60' : 'border-b border-border/60',
          ].join(' ')}
        >
          <WorkspacePaneNode node={node.first} ctx={ctx} />
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden">
          <WorkspacePaneNode node={node.second} ctx={ctx} />
        </div>
      </div>
    );
  }

  const {
    activeLevel,
    activeLevelId,
    clearTemporaryVisibility,
    compositionStateActiveId,
    cursorMm,
    draftGridVisible,
    draggingViewElementId,
    duplicateActiveSchedule,
    effectiveMode,
    elementsById: elementsByIdFromCtx,
    firstDuplicateWallFix,
    firstOrphanFix,
    focusedPaneLeafId,
    handleSnapToggle,
    handleTabActivate,
    lensMode,
    levels,
    loopMode,
    modelId,
    onSemanticCommand,
    openActiveSection3dContext,
    openActiveSectionSourcePlan,
    openActiveSheetAnchor,
    openAppearanceAssetBrowser,
    openElementById,
    openMaterialBrowser,
    openScheduleControls,
    openSelectedScheduleRow,
    paletteSheetPlaceableViews,
    paneElementSidebarOpenByKey,
    paneLayout,
    paneSecondarySidebarOpenByKey,
    panePlanToolsById,
    persistViewpointField,
    placeActiveScheduleOnSheet,
    placeActiveSectionOnSheet,
    placeRecommendedViewsOnActiveSheet,
    placeViewElementInPane,
    placeViewOnActiveSheet,
    planCameraHandleRef,
    planTool,
    projectNorthAngleDeg,
    resetActiveSavedViewpoint,
    runSelectedWall3dInsert,
    saveCurrentViewpoint,
    selectedId,
    setActiveLevelId,
    setAdvisorOpen,
    setCheatsheetOpen,
    setDimStyleOpen,
    setFamilyLibraryOpen,
    setManageGlobalParamsOpen,
    setManageLinksOpen,
    setManagePhasesOpen,
    setMode,
    setPaletteOpen,
    setPaneElementSidebarOpenByKey,
    setPaneLayout,
    setPanePlanTool,
    setPaneSecondarySidebarOpenByKey,
    setPlanTool,
    setSharePresentationOpen,
    setSheetMarkupShape,
    setSheetReviewMode,
    setTabsState,
    setTrueNorthActive,
    setVgOpen,
    setViewRangeOpen,
    setViewerMode,
    sheetMarkupShape,
    sheetReviewMode,
    snapModes,
    snapSettings,
    tabsById,
    tabsState,
    temporaryVisibility,
    toggleDraftGridVisible,
    toolRegistry,
    trueNorthActive,
    updateActiveSavedViewpoint,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerProjection,
    viewerSectionBoxActive,
    viewerWalkModeActive,
    wsOn,
    createSectionView,
    adjustActiveSectionCropDepth,
  } = ctx;
  const elementsById = elementsByIdFromCtx ?? elementsByIdFromStore;

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
  // These resolve to ComponentTypes from a registry, not local
  // declarations — but the react-hooks/static-components rule still
  // treats capitalised-binding-then-JSX as creating a component during
  // render. Use lowercase bindings + React.createElement so the rule's
  // heuristic doesn't flag them. The runtime identity comes from the
  // imported registries, so React reconciliation behaves identically.
  const paneIconComponent = Icons[paneIconName] ?? Icons.planView;
  const paneHifiIconComponent = hifiIconForTabKind(paneTab?.kind);
  const paneSidebarKey = `${compositionStateActiveId}:${node.id}`;
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
              {createElement(paneHifiIconComponent, { size: 30, 'aria-hidden': true })}
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
              {createElement(paneHifiIconComponent, { size: 30, 'aria-hidden': true })}
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
        onInsertOpeningOnSelectedWall3d={runInPaneContext(() => runSelectedWall3dInsert('opening'))}
        onPlaceActiveSectionOnSheet={runInPaneContext(placeActiveSectionOnSheet)}
        onOpenActiveSectionSourcePlan={runInPaneContext(openActiveSectionSourcePlan)}
        onIncreaseActiveSectionCropDepth={runInPaneContext(() => adjustActiveSectionCropDepth(500))}
        onDecreaseActiveSectionCropDepth={runInPaneContext(() =>
          adjustActiveSectionCropDepth(-500),
        )}
        onPlaceRecommendedViewsOnActiveSheet={runInPaneContext(placeRecommendedViewsOnActiveSheet)}
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
          activeSectionId={paneTab.kind === 'section' ? (paneTab.targetId ?? undefined) : undefined}
          preferredSheetId={paneTab.kind === 'sheet' ? (paneTab.targetId ?? undefined) : undefined}
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
              {createElement(paneIconComponent, { size: 12, 'aria-hidden': true })}
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
