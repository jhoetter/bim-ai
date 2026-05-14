import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { Icons, ICON_SIZE, type IconName } from '@bim-ai/ui';

import { type ToolId, type WorkspaceMode as ToolWorkspaceMode } from '../../tools/toolRegistry';
import {
  capabilityIdForTool,
  type CommandAvailability,
  evaluateCommandInMode,
  type CapabilityLensMode,
  formatCapabilityMode,
  type CapabilityViewMode,
} from '../commandCapabilities';
import type { WorkspaceMode } from './TopBar';
import type { SheetMarkupShape, SheetReviewMode } from '../sheets/sheetReviewUi';
import { LensDropdown } from './LensDropdown';

type RibbonTabId =
  | 'create'
  | 'openings'
  | 'rooms-areas'
  | 'sketch'
  | 'review'
  | 'architecture'
  | 'structure'
  | 'steel'
  | 'precast'
  | 'systems'
  | 'insert'
  | 'annotate'
  | 'analyze'
  | 'massing-site'
  | 'collaborate'
  | 'view'
  | 'manage'
  | 'add-ins'
  | 'modify';

type RibbonCommand =
  | { type: 'tool'; id: ToolId; label: string; icon: IconName; testId?: string }
  | { type: 'mode'; id: WorkspaceMode; label: string; icon: IconName; testId?: string }
  | { type: 'action'; id: RibbonActionId; label: string; icon: IconName; testId?: string };

type RibbonActionId =
  | 'command-palette'
  | 'project-manage-links'
  | 'advisor-open'
  | 'create-section-view'
  | 'element-sidebar-toggle'
  | 'family-library'
  | 'settings'
  | '3d-insert-door'
  | '3d-insert-window'
  | '3d-insert-opening'
  | '3d-save-view'
  | '3d-reset-view'
  | '3d-update-view'
  | 'section-place-on-sheet'
  | 'section-source-plan'
  | 'section-depth-increase'
  | 'section-depth-decrease'
  | 'sheet-place-recommended'
  | 'sheet-place-first-view'
  | 'sheet-edit-viewports'
  | 'sheet-edit-titleblock'
  | 'sheet-publish'
  | 'sheet-review-comment'
  | 'sheet-review-markup'
  | 'sheet-review-resolve'
  | 'sheet-markup-freehand'
  | 'sheet-markup-arrow'
  | 'sheet-markup-cloud'
  | 'sheet-markup-text'
  | '3d-measure'
  | 'schedule-open-row'
  | 'schedule-row-ops'
  | 'schedule-column-ops'
  | 'schedule-place-on-sheet'
  | 'schedule-duplicate'
  | 'schedule-controls';

interface RibbonPanel {
  id: string;
  label: string;
  commands: RibbonCommand[];
  flyoutCommands?: RibbonCommand[];
}

interface RibbonTab {
  id: RibbonTabId;
  label: string;
  contextual?: boolean;
  panels: RibbonPanel[];
}

export interface RibbonCommandReachability {
  commandId: string;
  mode: CapabilityViewMode;
  tabId: RibbonTabId;
  panelId: string;
  label: string;
  behavior: 'direct' | 'bridge' | 'disabled';
  disabledReason?: string;
}

export interface RibbonCommandMetadata {
  commandKey: string;
  commandId: string | null;
  mode: CapabilityViewMode;
  tabId: RibbonTabId;
  panelId: string;
  label: string;
  behavior: 'direct' | 'bridge' | 'disabled' | 'missing-metadata';
  disabledReason?: string;
}

export interface RibbonInlineViewTitle {
  icon: IconName;
  viewType: string;
  viewName?: string;
  title: string;
  viewIconTestId?: string;
}

export interface RibbonBarProps {
  activeToolId?: ToolId;
  activeMode?: ToolWorkspaceMode;
  selectedElementKind?: string | null;
  lensMode?: CapabilityLensMode;
  onLensChange?: (lens: CapabilityLensMode) => void;
  onToolSelect?: (id: ToolId) => void;
  onModeChange?: (mode: WorkspaceMode) => void;
  onOpenCommandPalette?: () => void;
  onOpenManageLinks?: () => void;
  onOpenAdvisor?: () => void;
  onCreateSectionView?: () => void;
  onToggleElementSidebar?: () => void;
  onOpenFamilyLibrary?: () => void;
  onOpenSettings?: () => void;
  onSaveCurrentViewpoint?: () => void;
  onResetActiveSavedViewpoint?: () => void;
  onUpdateActiveSavedViewpoint?: () => void;
  onInsertDoorOnSelectedWall3d?: () => void;
  onInsertWindowOnSelectedWall3d?: () => void;
  onInsertOpeningOnSelectedWall3d?: () => void;
  onPlaceActiveSectionOnSheet?: () => void;
  onOpenActiveSectionSourcePlan?: () => void;
  onIncreaseActiveSectionCropDepth?: () => void;
  onDecreaseActiveSectionCropDepth?: () => void;
  onPlaceRecommendedViewsOnActiveSheet?: () => void;
  onPlaceFirstViewOnActiveSheet?: () => void;
  onOpenSheetViewportEditor?: () => void;
  onOpenSheetTitleblockEditor?: () => void;
  onShareActiveSheet?: () => void;
  onOpenSelectedScheduleRow?: () => void;
  onPlaceActiveScheduleOnSheet?: () => void;
  onDuplicateActiveSchedule?: () => void;
  onOpenScheduleControls?: () => void;
  sheetReviewMode?: SheetReviewMode;
  onSheetReviewModeChange?: (mode: SheetReviewMode) => void;
  sheetMarkupShape?: SheetMarkupShape;
  onSheetMarkupShapeChange?: (shape: SheetMarkupShape) => void;
  viewSettingsOpen?: boolean;
  onToggleViewSettings?: () => void;
  viewSettingsToggleLabel?: string;
  inlineViewTitle?: RibbonInlineViewTitle;
  showViewControls?: boolean;
  viewControlsVariant?: 'compact' | 'prominent';
  trailingControls?: JSX.Element | null;
}

const RIBBON_HIDDEN_COMMANDS_STORAGE_KEY = 'bim-ai.ribbon.hiddenCommands.v1';

export function RibbonBar({
  activeToolId,
  activeMode,
  selectedElementKind,
  lensMode = 'all',
  onLensChange,
  onToolSelect,
  onModeChange,
  onOpenCommandPalette,
  onOpenManageLinks,
  onOpenAdvisor,
  onCreateSectionView,
  onToggleElementSidebar,
  onOpenFamilyLibrary,
  onOpenSettings,
  onSaveCurrentViewpoint,
  onResetActiveSavedViewpoint,
  onUpdateActiveSavedViewpoint,
  onInsertDoorOnSelectedWall3d,
  onInsertWindowOnSelectedWall3d,
  onInsertOpeningOnSelectedWall3d,
  onPlaceActiveSectionOnSheet,
  onOpenActiveSectionSourcePlan,
  onIncreaseActiveSectionCropDepth,
  onDecreaseActiveSectionCropDepth,
  onPlaceRecommendedViewsOnActiveSheet,
  onPlaceFirstViewOnActiveSheet,
  onOpenSheetViewportEditor,
  onOpenSheetTitleblockEditor,
  onShareActiveSheet,
  onOpenSelectedScheduleRow,
  onPlaceActiveScheduleOnSheet,
  onDuplicateActiveSchedule,
  onOpenScheduleControls,
  sheetReviewMode = 'cm',
  onSheetReviewModeChange,
  sheetMarkupShape = 'freehand',
  onSheetMarkupShapeChange,
  viewSettingsOpen,
  onToggleViewSettings,
  viewSettingsToggleLabel,
  inlineViewTitle,
  showViewControls = true,
  viewControlsVariant = 'compact',
  trailingControls,
}: RibbonBarProps): JSX.Element {
  const [activeTabId, setActiveTabId] = useState<RibbonTabId>('create');
  const [minimized, setMinimized] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [openFlyoutPanelId, setOpenFlyoutPanelId] = useState<string | null>(null);
  const [hiddenCommandKeys, setHiddenCommandKeys] = useState<Set<string>>(
    () => new Set(readHiddenRibbonCommandKeys()),
  );
  const tabs = useMemo(
    () => buildRibbonTabs(activeMode, selectedElementKind, lensMode),
    [activeMode, lensMode, selectedElementKind],
  );
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!;
  const activeCommands = useMemo(() => collectTabCommands(activeTab), [activeTab]);
  const identity = ribbonModeIdentity(activeMode ?? 'plan');
  const ModeIdentityIcon = Icons[identity.icon] ?? Icons.planView;
  const InlineViewIcon = inlineViewTitle
    ? (Icons[inlineViewTitle.icon] ?? ModeIdentityIcon)
    : ModeIdentityIcon;
  const prevActiveToolIdRef = useRef<ToolId | undefined>(activeToolId);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? 'create');
      setOpenFlyoutPanelId(null);
      setCustomizeOpen(false);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    const prevToolId = prevActiveToolIdRef.current;
    if (
      activeToolId === 'select' &&
      prevToolId !== 'select' &&
      tabs[0] &&
      activeTabId !== tabs[0].id
    ) {
      setActiveTabId(tabs[0].id);
    }
    prevActiveToolIdRef.current = activeToolId;
  }, [activeTabId, activeToolId, tabs]);

  useEffect(() => {
    writeHiddenRibbonCommandKeys([...hiddenCommandKeys]);
  }, [hiddenCommandKeys]);

  function runCommand(command: RibbonCommand): void {
    const availability = activeMode ? commandAvailability(command, activeMode, lensMode) : null;
    if (availability?.state === 'disabled') return;
    if (availability?.state === 'bridge') {
      onModeChange?.(availability.targetMode as WorkspaceMode);
    }
    if (command.type === 'tool') {
      onToolSelect?.(command.id);
      return;
    }
    if (command.type === 'mode') {
      onModeChange?.(command.id);
      return;
    }
    const actions: Record<RibbonActionId, (() => void) | undefined> = {
      'command-palette': onOpenCommandPalette,
      'project-manage-links': onOpenManageLinks,
      'advisor-open': onOpenAdvisor,
      'create-section-view': onCreateSectionView,
      'element-sidebar-toggle': onToggleElementSidebar,
      'family-library': onOpenFamilyLibrary,
      settings: onOpenSettings,
      '3d-insert-door': onInsertDoorOnSelectedWall3d,
      '3d-insert-window': onInsertWindowOnSelectedWall3d,
      '3d-insert-opening': onInsertOpeningOnSelectedWall3d,
      '3d-save-view': onSaveCurrentViewpoint,
      '3d-reset-view': onResetActiveSavedViewpoint,
      '3d-update-view': onUpdateActiveSavedViewpoint,
      'section-place-on-sheet': onPlaceActiveSectionOnSheet,
      'section-source-plan': onOpenActiveSectionSourcePlan,
      'section-depth-increase': onIncreaseActiveSectionCropDepth,
      'section-depth-decrease': onDecreaseActiveSectionCropDepth,
      'sheet-place-recommended': onPlaceRecommendedViewsOnActiveSheet,
      'sheet-place-first-view': onPlaceFirstViewOnActiveSheet,
      'sheet-edit-viewports': onOpenSheetViewportEditor,
      'sheet-edit-titleblock': onOpenSheetTitleblockEditor,
      'sheet-publish': onShareActiveSheet,
      'sheet-review-comment': () => onSheetReviewModeChange?.('cm'),
      'sheet-review-markup': () => onSheetReviewModeChange?.('an'),
      'sheet-review-resolve': () => onSheetReviewModeChange?.('mr'),
      'sheet-markup-freehand': () => onSheetMarkupShapeChange?.('freehand'),
      'sheet-markup-arrow': () => onSheetMarkupShapeChange?.('arrow'),
      'sheet-markup-cloud': () => onSheetMarkupShapeChange?.('cloud'),
      'sheet-markup-text': () => onSheetMarkupShapeChange?.('text'),
      'schedule-open-row': onOpenSelectedScheduleRow,
      'schedule-row-ops': onOpenScheduleControls,
      'schedule-column-ops': onOpenScheduleControls,
      'schedule-place-on-sheet': onPlaceActiveScheduleOnSheet,
      'schedule-duplicate': onDuplicateActiveSchedule,
      'schedule-controls': onOpenScheduleControls,
      '3d-measure': () => onToolSelect?.('measure'),
    };
    (actions[command.id] ?? onOpenCommandPalette)?.();
  }

  function commandVisible(command: RibbonCommand): boolean {
    return !hiddenCommandKeys.has(commandKey(command));
  }

  function setCommandVisible(command: RibbonCommand, visible: boolean): void {
    setHiddenCommandKeys((prev) => {
      const next = new Set(prev);
      const key = commandKey(command);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section
      aria-label="Ribbon"
      data-testid="ribbon-bar"
      className="border-b border-border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.03)]"
    >
      <div className="flex min-h-9 items-end gap-2 px-2.5 pt-1">
        {showViewControls ? (
          <div
            className={[
              'mb-1 flex min-w-0 shrink-0 items-center border-r border-border/70 pr-2',
              inlineViewTitle && viewControlsVariant === 'prominent'
                ? 'max-w-[28rem] gap-2'
                : 'max-w-[36rem] gap-1.5',
            ].join(' ')}
          >
            {inlineViewTitle && viewControlsVariant === 'prominent' ? (
              <>
                <button
                  type="button"
                  className={[
                    'group inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-surface-strong',
                    viewSettingsOpen
                      ? 'border-accent/50 text-accent'
                      : 'border-border text-muted group-hover:text-foreground',
                  ].join(' ')}
                  data-testid="ribbon-mode-identity"
                  aria-label={
                    viewSettingsToggleLabel ?? `Toggle ${inlineViewTitle.viewType} view settings`
                  }
                  aria-pressed={viewSettingsOpen ?? false}
                  title={
                    viewSettingsToggleLabel ?? `Toggle ${inlineViewTitle.viewType} view settings`
                  }
                  onClick={onToggleViewSettings}
                >
                  <InlineViewIcon size={28} aria-hidden="true" />
                  <span className="sr-only">{inlineViewTitle.viewType}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
                    <span className="whitespace-nowrap">{inlineViewTitle.viewType}</span>
                    {onLensChange ? (
                      <>
                        <span aria-hidden="true" className="text-border">
                          /
                        </span>
                        <div
                          data-testid="ribbon-lens-dropdown"
                          className="h-7 min-w-0 rounded-md border border-border bg-background/80 px-1 text-[11px] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          <LensDropdown
                            currentLens={lensMode}
                            onLensChange={onLensChange}
                            enableHotkey={false}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div
                    className="mt-1 min-w-0 truncate text-base font-semibold leading-5 text-foreground"
                    title={inlineViewTitle.title}
                  >
                    {inlineViewTitle.viewName || inlineViewTitle.title}
                  </div>
                </div>
              </>
            ) : inlineViewTitle ? (
              onToggleViewSettings ? (
                <button
                  type="button"
                  className={[
                    'group inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold text-foreground hover:bg-surface-strong',
                    viewSettingsOpen ? 'bg-accent-soft text-accent' : '',
                  ].join(' ')}
                  data-testid="ribbon-mode-identity"
                  aria-label={
                    viewSettingsToggleLabel ?? `Toggle ${inlineViewTitle.viewType} view settings`
                  }
                  aria-pressed={viewSettingsOpen ?? false}
                  title={
                    viewSettingsToggleLabel ?? `Toggle ${inlineViewTitle.viewType} view settings`
                  }
                  onClick={onToggleViewSettings}
                >
                  <span
                    data-testid={inlineViewTitle.viewIconTestId}
                    className={[
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      viewSettingsOpen
                        ? 'border-accent/50 bg-background text-accent'
                        : 'border-border bg-background text-muted group-hover:text-foreground',
                    ].join(' ')}
                  >
                    <InlineViewIcon size={ICON_SIZE.chrome} aria-hidden="true" />
                  </span>
                  <span className="whitespace-nowrap">{inlineViewTitle.viewType}</span>
                </button>
              ) : (
                <div
                  className="inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold text-foreground"
                  data-testid="ribbon-mode-identity"
                  title={inlineViewTitle.title}
                >
                  <span
                    data-testid={inlineViewTitle.viewIconTestId}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted"
                  >
                    <InlineViewIcon size={ICON_SIZE.chrome} aria-hidden="true" />
                  </span>
                  <span className="whitespace-nowrap">{inlineViewTitle.viewType}</span>
                </div>
              )
            ) : onToggleViewSettings ? (
              <button
                type="button"
                className={[
                  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold text-foreground hover:bg-surface-strong',
                  viewSettingsOpen ? 'bg-accent-soft text-accent' : '',
                ].join(' ')}
                data-testid="ribbon-mode-identity"
                aria-label={viewSettingsToggleLabel ?? `Toggle ${identity.label} view settings`}
                aria-pressed={viewSettingsOpen ?? false}
                title={viewSettingsToggleLabel ?? `Toggle ${identity.label} view settings`}
                onClick={onToggleViewSettings}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted">
                  <ModeIdentityIcon size={ICON_SIZE.chrome} aria-hidden="true" />
                </span>
                <span>{identity.label}</span>
              </button>
            ) : (
              <div
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold text-foreground"
                data-testid="ribbon-mode-identity"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted">
                  <ModeIdentityIcon size={ICON_SIZE.chrome} aria-hidden="true" />
                </span>
                <span>{identity.label}</span>
              </div>
            )}
            {viewControlsVariant === 'compact' && onLensChange ? (
              <div
                data-testid="ribbon-lens-dropdown"
                className="h-7 rounded-md border border-border bg-background/80 px-1 text-[11px] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <LensDropdown
                  currentLens={lensMode}
                  onLensChange={onLensChange}
                  enableHotkey={false}
                />
              </div>
            ) : null}
            {viewControlsVariant === 'compact' && inlineViewTitle?.viewName ? (
              <div
                className="min-w-0 truncate text-xs font-medium text-foreground"
                title={inlineViewTitle.title}
              >
                {inlineViewTitle.viewName}
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          role="tablist"
          aria-label="Ribbon tabs"
          data-testid="ribbon-tabs"
          className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto rounded-t-md"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`ribbon-tab-${tab.id}`}
                data-contextual={tab.contextual ? 'true' : 'false'}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setMinimized(false);
                  setCustomizeOpen(false);
                  setOpenFlyoutPanelId(null);
                }}
                className={[
                  'relative h-8 whitespace-nowrap rounded-t-md px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-[inset_0_2px_0_0_var(--color-accent),0_-1px_0_0_var(--color-border),1px_0_0_0_var(--color-border),-1px_0_0_0_var(--color-border)]'
                    : tab.contextual
                      ? 'text-accent hover:bg-background/80'
                      : 'text-muted hover:bg-background/80 hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Customize ribbon"
          aria-expanded={customizeOpen}
          data-testid="ribbon-toggle-customize"
          title="Customize ribbon"
          onClick={() => {
            setCustomizeOpen((v) => !v);
            setOpenFlyoutPanelId(null);
          }}
          className={[
            'mb-1 flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground',
            customizeOpen ? 'bg-accent-soft text-accent' : '',
          ].join(' ')}
        >
          <Icons.settings size={ICON_SIZE.chrome} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={minimized ? 'Restore ribbon panels' : 'Minimize ribbon panels'}
          aria-expanded={!minimized}
          data-testid="ribbon-toggle-minimize"
          title={minimized ? 'Restore ribbon panels' : 'Minimize ribbon panels'}
          onClick={() => setMinimized((v) => !v)}
          className="mb-1 flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground"
        >
          {minimized ? (
            <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" />
          ) : (
            <Icons.disclosureClosed size={ICON_SIZE.chrome} aria-hidden="true" />
          )}
        </button>
        {trailingControls ? (
          <div className="mb-1 flex shrink-0 items-center gap-1 border-l border-border/70 pl-1">
            {trailingControls}
          </div>
        ) : null}
      </div>
      {customizeOpen ? (
        <div
          data-testid="ribbon-customize-menu"
          className="border-t border-border bg-background px-3 py-2 text-xs text-foreground"
        >
          <div className="mb-1 font-semibold">Customize {activeTab.label}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {activeCommands.map((command) => (
              <label
                key={commandKey(command)}
                className="flex items-center gap-1.5 whitespace-nowrap text-muted"
              >
                <input
                  type="checkbox"
                  checked={commandVisible(command)}
                  onChange={(e) => setCommandVisible(command, e.target.checked)}
                />
                <span>{command.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {!minimized ? (
        <div
          data-testid="ribbon-panels"
          className="flex min-h-[58px] items-stretch gap-2 overflow-x-auto bg-background px-3 py-1.5"
        >
          {activeTab.panels.map((panel) => {
            const visibleCommands = panel.commands.filter(commandVisible);
            const visibleFlyoutCommands = (panel.flyoutCommands ?? []).filter(commandVisible);
            const flyoutId = `${activeTab.id}:${panel.id}`;
            return (
              <div
                key={panel.id}
                role="group"
                aria-label={panel.label}
                className="relative flex min-w-fit self-stretch flex-col items-center justify-between border-r border-border pr-2 last:border-r-0"
              >
                <div className="flex w-full items-start justify-center gap-1">
                  {visibleCommands.map((command) => {
                    const availability = activeMode
                      ? commandAvailability(command, activeMode, lensMode)
                      : null;
                    const bridgeTargetMode =
                      availability?.state === 'bridge' ? availability.targetMode : undefined;
                    return (
                      <RibbonButton
                        key={commandKey(command)}
                        command={command}
                        active={commandActive(
                          command,
                          activeToolId,
                          sheetReviewMode,
                          sheetMarkupShape,
                        )}
                        bridgeTargetMode={bridgeTargetMode}
                        disabledReason={commandDisabledReason(command, activeMode, lensMode)}
                        onClick={() => runCommand(command)}
                      />
                    );
                  })}
                  {visibleFlyoutCommands.length > 0 ? (
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        aria-label={`${panel.label} panel flyout`}
                        aria-expanded={openFlyoutPanelId === flyoutId}
                        data-testid={`ribbon-panel-flyout-${panel.id}`}
                        onClick={() =>
                          setOpenFlyoutPanelId((current) =>
                            current === flyoutId ? null : flyoutId,
                          )
                        }
                        className="flex h-12 w-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
                      >
                        <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" />
                      </button>
                      {openFlyoutPanelId === flyoutId ? (
                        <div
                          role="menu"
                          data-testid={`ribbon-flyout-menu-${panel.id}`}
                          className="absolute right-0 top-12 z-30 min-w-48 rounded border border-border bg-surface p-1 shadow-lg"
                        >
                          {visibleFlyoutCommands.map((command) => {
                            const Icon = Icons[command.icon] ?? Icons.commandPalette;
                            const disabledReason = commandDisabledReason(
                              command,
                              activeMode,
                              lensMode,
                            );
                            return (
                              <button
                                key={commandKey(command)}
                                type="button"
                                role="menuitem"
                                data-testid={`ribbon-flyout-command-${command.testId ?? command.id}`}
                                disabled={Boolean(disabledReason)}
                                title={disabledReason ?? command.label}
                                data-disabled-reason={disabledReason}
                                onClick={() => {
                                  if (disabledReason) return;
                                  runCommand(command);
                                  setOpenFlyoutPanelId(null);
                                }}
                                className={[
                                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                                  disabledReason
                                    ? 'cursor-not-allowed text-muted opacity-55'
                                    : 'text-foreground hover:bg-background',
                                ].join(' ')}
                              >
                                <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
                                <span>{command.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full min-w-14 items-end justify-center px-1 pb-0.5 text-center text-[10px] font-medium text-muted">
                  {panel.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function ribbonCommandReachabilityForMode(
  mode: CapabilityViewMode,
  selectedElementKind?: string | null,
  lensMode: CapabilityLensMode = 'all',
): RibbonCommandReachability[] {
  const reachability: RibbonCommandReachability[] = [];
  for (const tab of buildRibbonTabs(mode, selectedElementKind, lensMode)) {
    for (const panel of tab.panels) {
      for (const command of [...panel.commands, ...(panel.flyoutCommands ?? [])]) {
        const commandId = ribbonCapabilityId(command);
        if (!commandId) continue;
        const availability = commandAvailability(command, mode, lensMode);
        const behavior =
          availability?.state === 'bridge'
            ? 'bridge'
            : availability?.state === 'disabled'
              ? 'disabled'
              : 'direct';
        reachability.push({
          commandId,
          mode,
          tabId: tab.id,
          panelId: panel.id,
          label: command.label,
          behavior,
          disabledReason: availability?.state === 'enabled' ? undefined : availability?.reason,
        });
      }
    }
  }
  return reachability;
}

export function ribbonCommandMetadataForMode(
  mode: CapabilityViewMode,
  selectedElementKind?: string | null,
  lensMode: CapabilityLensMode = 'all',
): RibbonCommandMetadata[] {
  const rows: RibbonCommandMetadata[] = [];
  for (const tab of buildRibbonTabs(mode, selectedElementKind, lensMode)) {
    for (const panel of tab.panels) {
      for (const command of [...panel.commands, ...(panel.flyoutCommands ?? [])]) {
        const commandId = ribbonCapabilityId(command);
        const availability = commandId ? commandAvailability(command, mode, lensMode) : null;
        rows.push({
          commandKey: commandKey(command),
          commandId,
          mode,
          tabId: tab.id,
          panelId: panel.id,
          label: command.label,
          behavior:
            availability?.state === 'bridge'
              ? 'bridge'
              : availability?.state === 'disabled'
                ? 'disabled'
                : availability?.state === 'enabled'
                  ? 'direct'
                  : 'missing-metadata',
          disabledReason: availability?.state === 'enabled' ? undefined : availability?.reason,
        });
      }
    }
  }
  return rows;
}

export function prunedRibbonCommandReachabilityForMode(
  mode: CapabilityViewMode,
  selectedElementKind?: string | null,
  lensMode: CapabilityLensMode = 'all',
): RibbonCommandReachability[] {
  const reachabilityByCommand = new Map<string, RibbonCommandReachability>();

  for (const sourceMode of [
    'plan',
    '3d',
    'section',
    'sheet',
    'schedule',
  ] as const satisfies readonly ToolWorkspaceMode[]) {
    for (const tab of buildUnfilteredRibbonTabs(sourceMode, selectedElementKind)) {
      for (const panel of tab.panels) {
        for (const command of [...panel.commands, ...(panel.flyoutCommands ?? [])]) {
          const commandId = ribbonCapabilityId(command);
          if (!commandId || reachabilityByCommand.has(commandId)) continue;
          const availability = evaluateCommandInMode(commandId, mode, lensMode);
          if (!availability || availability.state === 'enabled') continue;
          reachabilityByCommand.set(commandId, {
            commandId,
            mode,
            tabId: tab.id,
            panelId: panel.id,
            label: command.label,
            behavior: availability.state,
            disabledReason: availability.reason,
          });
        }
      }
    }
  }

  return [...reachabilityByCommand.values()].sort((a, b) => a.commandId.localeCompare(b.commandId));
}

function RibbonButton({
  command,
  active,
  bridgeTargetMode,
  disabledReason,
  onClick,
}: {
  command: RibbonCommand;
  active: boolean;
  bridgeTargetMode?: CapabilityViewMode;
  disabledReason?: string;
  onClick: () => void;
}): JSX.Element {
  const Icon = Icons[command.icon] ?? Icons.commandPalette;
  const isPaletteBridge = command.type === 'action' && command.id === 'command-palette';
  const isBridge = Boolean(bridgeTargetMode) || isPaletteBridge;
  const disabled = Boolean(disabledReason);
  return (
    <button
      type="button"
      data-testid={command.testId ?? `ribbon-command-${command.id}`}
      aria-pressed={command.type === 'tool' ? active : undefined}
      disabled={disabled}
      title={disabledReason ?? command.label}
      data-disabled-reason={disabledReason}
      onClick={onClick}
      className={[
        'flex h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted opacity-55'
          : active
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-surface hover:text-foreground',
      ].join(' ')}
    >
      <Icon size={ICON_SIZE.toolPalette} aria-hidden="true" />
      <span className="max-w-20 truncate">{command.label}</span>
      {isBridge ? (
        <span
          data-testid={
            command.testId ? `ribbon-bridge-${command.testId}` : `ribbon-bridge-${command.id}`
          }
          className="text-[9px] uppercase tracking-wide text-muted"
        >
          {bridgeTargetMode ? formatCapabilityMode(bridgeTargetMode) : 'Cmd+K'}
        </span>
      ) : null}
    </button>
  );
}

function buildRibbonTabs(
  activeMode: ToolWorkspaceMode | undefined,
  selectedElementKind?: string | null,
  lensMode: CapabilityLensMode = 'all',
): RibbonTab[] {
  const mode = activeMode ?? 'plan';
  return filterRibbonTabsForMode(
    buildUnfilteredRibbonTabs(mode, selectedElementKind),
    mode,
    lensMode,
  );
}

function buildUnfilteredRibbonTabs(
  mode: ToolWorkspaceMode,
  selectedElementKind?: string | null,
): RibbonTab[] {
  const tabs: RibbonTab[] =
    mode === '3d'
      ? build3dRibbonTabs(selectedElementKind)
      : mode === 'section'
        ? buildSectionRibbonTabs(selectedElementKind)
        : mode === 'sheet'
          ? buildSheetRibbonTabs(selectedElementKind)
          : mode === 'schedule'
            ? buildScheduleRibbonTabs(selectedElementKind)
            : buildPlanRibbonTabs(mode, selectedElementKind);

  return tabs;
}

function filterRibbonTabsForMode(
  tabs: RibbonTab[],
  mode: ToolWorkspaceMode,
  lensMode: CapabilityLensMode,
): RibbonTab[] {
  return tabs
    .map((tab) => ({
      ...tab,
      panels: tab.panels
        .map((panel) => ({
          ...panel,
          commands: panel.commands.filter((command) =>
            commandIsVisibleInMode(command, mode, lensMode),
          ),
          flyoutCommands: panel.flyoutCommands?.filter((command) =>
            commandIsVisibleInMode(command, mode, lensMode),
          ),
        }))
        .filter((panel) => panel.commands.length > 0 || (panel.flyoutCommands?.length ?? 0) > 0),
    }))
    .filter((tab) => tab.panels.length > 0);
}

function commandIsVisibleInMode(
  command: RibbonCommand,
  mode: ToolWorkspaceMode,
  lensMode: CapabilityLensMode,
): boolean {
  const availability = commandAvailability(command, mode, lensMode);
  return !availability || availability.state !== 'disabled';
}

function buildPlanRibbonTabs(
  activeMode: ToolWorkspaceMode,
  selectedElementKind?: string | null,
): RibbonTab[] {
  const tabs: RibbonTab[] = [
    {
      id: 'create',
      label: 'Create',
      panels: [
        {
          id: 'selection',
          label: 'Selection',
          commands: [tool('select', 'Select', 'select')],
        },
        {
          id: 'build',
          label: 'Build',
          commands: [
            tool('wall', 'Wall', 'wall'),
            tool('ceiling', 'Ceiling', 'ceiling'),
            tool('column', 'Column', 'column'),
            tool('beam', 'Beam', 'beam'),
          ],
        },
        {
          id: 'openings',
          label: 'Openings',
          commands: [
            tool('door', 'Door', 'door'),
            tool('window', 'Window', 'window'),
            tool('wall-opening', 'Opening', 'wall-opening'),
            tool('shaft', 'Shaft', 'shaft'),
          ],
        },
        {
          id: 'rooms-areas',
          label: 'Rooms / Areas',
          commands: [
            tool('room', 'Room', 'room'),
            tool('area', 'Area', 'room'),
            tool('area-boundary', 'Area Boundary', 'gridLine'),
          ],
        },
        {
          id: 'circulation',
          label: 'Circulation',
          commands: [tool('stair', 'Stair', 'stair'), tool('railing', 'Railing', 'railing')],
        },
      ],
    },
    {
      id: 'sketch',
      label: 'Sketch',
      panels: [
        {
          id: 'sketch',
          label: 'Sketch',
          commands: [tool('floor', 'Floor', 'floor'), tool('roof', 'Roof', 'roof')],
        },
        {
          id: 'site',
          label: 'Site',
          commands: [
            tool('property-line', 'Property Line', 'detailLine'),
            tool('toposolid_subdivision', 'Topo Subdivision', 'grid'),
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      panels: [
        {
          id: 'load',
          label: 'Load',
          commands: [
            action('family-library', 'Load Family', 'family'),
            tool('component', 'Component', 'family'),
          ],
        },
        {
          id: 'link',
          label: 'Import',
          commands: [action('project-manage-links', 'Import/Link', 'externalLink')],
        },
      ],
    },
    {
      id: 'annotate',
      label: 'Annotate',
      panels: [
        {
          id: 'annotate',
          label: 'Annotate',
          commands: [
            tool('dimension', 'Dimension', 'dimension'),
            tool('tag', 'Tag by Category', 'tag'),
            tool('measure', 'Measure', 'measure'),
          ],
        },
        {
          id: 'views',
          label: 'Views',
          commands: [
            tool('section', 'Section', 'sectionView'),
            tool('elevation', 'Elevation', 'elevationView'),
          ],
        },
        {
          id: 'datum',
          label: 'Datum',
          commands: [
            tool('grid', 'Grid', 'gridLine'),
            tool('reference-plane', 'Ref Plane', 'gridLine'),
          ],
        },
      ],
    },
    {
      id: 'review',
      label: 'Review',
      panels: [
        {
          id: 'review',
          label: 'Review',
          commands: [action('advisor-open', 'Checks', 'clash', 'plan-checks')],
        },
      ],
    },
  ];

  if (selectedElementKind) {
    tabs.push(
      activeMode === 'plan'
        ? buildPlanModifyTab(selectedElementKind)
        : buildSelectionOnlyModifyTab(selectedElementKind),
    );
  }

  return tabs;
}

function build3dRibbonTabs(selectedElementKind?: string | null): RibbonTab[] {
  const tabs: RibbonTab[] = [
    {
      id: 'create',
      label: 'Model',
      panels: [
        {
          id: 'selection',
          label: 'Selection',
          commands: [tool('select', 'Select', 'select')],
        },
        {
          id: 'build',
          label: 'Build',
          commands: [
            tool('wall', 'Wall', 'wall'),
            tool('floor', 'Floor', 'floor'),
            tool('roof', 'Roof', 'roof'),
            tool('ceiling', 'Ceiling', 'ceiling'),
            tool('column', 'Column', 'column'),
            tool('beam', 'Beam', 'beam'),
          ],
        },
        {
          id: 'openings',
          label: 'Openings',
          commands: [
            tool('door', 'Door', 'door'),
            tool('window', 'Window', 'window'),
            tool('wall-opening', 'Opening', 'wall-opening'),
            tool('shaft', 'Shaft', 'shaft'),
          ],
        },
        {
          id: 'circulation',
          label: 'Circulation',
          commands: [tool('stair', 'Stair', 'stair'), tool('railing', 'Railing', 'railing')],
        },
      ],
    },
    {
      id: 'view',
      label: '3D View',
      panels: [
        {
          id: 'select',
          label: 'Select',
          commands: [tool('select', 'Select', 'select')],
        },
        {
          id: 'saved-view',
          label: 'Saved View',
          commands: [
            action('3d-save-view', 'Save View', 'saveViewpoint'),
            action('3d-reset-view', 'Reset', 'viewCubeReset'),
            action('3d-update-view', 'Update', 'saveViewpoint'),
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      panels: [
        {
          id: 'load',
          label: 'Load',
          commands: [
            action('family-library', 'Load Family', 'family'),
            tool('component', 'Component', 'family'),
          ],
        },
      ],
    },
    {
      id: 'analyze',
      label: 'Review',
      panels: [
        {
          id: 'annotate',
          label: 'Annotate',
          commands: [action('3d-measure', 'Measure', 'measure')],
        },
        {
          id: 'review',
          label: 'Review',
          commands: [action('advisor-open', 'Findings', 'issue', '3d-findings')],
        },
        {
          id: 'documentation',
          label: 'Documentation',
          commands: [action('create-section-view', 'Create Section', 'sectionView')],
        },
      ],
    },
    {
      id: 'annotate',
      label: 'Annotate',
      panels: [
        {
          id: 'annotate',
          label: 'Annotate',
          commands: [tool('dimension', 'Dimension', 'dimension'), tool('tag', 'Tag', 'tag')],
        },
        {
          id: 'views',
          label: 'Views',
          commands: [
            tool('section', 'Section', 'sectionView'),
            tool('elevation', 'Elevation', 'elevationView'),
          ],
        },
        {
          id: 'datum',
          label: 'Datum',
          commands: [
            tool('grid', 'Grid', 'gridLine'),
            tool('reference-plane', 'Ref Plane', 'gridLine'),
          ],
        },
      ],
    },
  ];

  if (selectedElementKind) {
    tabs.push(build3dModifyTab(selectedElementKind));
  }

  return tabs;
}

function buildSectionRibbonTabs(selectedElementKind?: string | null): RibbonTab[] {
  const tabs: RibbonTab[] = [
    {
      id: 'annotate',
      label: 'Section',
      panels: [
        {
          id: 'selection',
          label: 'Selection',
          commands: [tool('select', 'Select', 'select')],
        },
        {
          id: 'annotate',
          label: 'Annotate',
          commands: [
            tool('dimension', 'Dimension', 'dimension'),
            tool('section', 'Section', 'sectionView'),
          ],
        },
        {
          id: 'crop',
          label: 'Crop / Depth',
          commands: [
            action('section-depth-increase', 'Depth +', 'sectionBox'),
            action('section-depth-decrease', 'Depth -', 'sectionBox'),
          ],
        },
        {
          id: 'place',
          label: 'Place',
          commands: [
            action('section-place-on-sheet', 'Place on Sheet', 'sheet'),
            action('section-source-plan', 'Source Plan', 'planView'),
          ],
        },
      ],
    },
  ];

  if (selectedElementKind) {
    tabs.push(buildSelectionOnlyModifyTab(selectedElementKind));
  }

  return tabs;
}

function buildSheetRibbonTabs(selectedElementKind?: string | null): RibbonTab[] {
  const tabs: RibbonTab[] = [
    {
      id: 'view',
      label: 'Sheet',
      panels: [
        {
          id: 'selection',
          label: 'Selection',
          commands: [tool('select', 'Select', 'select')],
        },
        {
          id: 'place-views',
          label: 'Place Views',
          commands: [
            action('sheet-place-recommended', 'Recommended', 'sheet'),
            action('sheet-place-first-view', 'Place View', 'planView'),
          ],
        },
        {
          id: 'viewports',
          label: 'Viewports',
          commands: [action('sheet-edit-viewports', 'Edit Viewports', 'select')],
        },
        {
          id: 'titleblock',
          label: 'Titleblock',
          commands: [action('sheet-edit-titleblock', 'Titleblock', 'sheet')],
        },
        {
          id: 'publish',
          label: 'Publish',
          commands: [action('sheet-publish', 'Publish', 'externalLink')],
        },
        {
          id: 'review',
          label: 'Review',
          commands: [
            action('sheet-review-comment', 'Comment', 'comment'),
            action('sheet-review-markup', 'Markup', 'annotation'),
            action('sheet-review-resolve', 'Resolve', 'check'),
          ],
        },
        {
          id: 'markup-shape',
          label: 'Markup Shape',
          commands: [
            action('sheet-markup-freehand', 'Freehand', 'pen'),
            action('sheet-markup-arrow', 'Arrow', 'arrowRight'),
            action('sheet-markup-cloud', 'Cloud', 'draftingCloud'),
            action('sheet-markup-text', 'Text', 'text'),
          ],
        },
      ],
    },
  ];

  if (selectedElementKind) {
    tabs.push(buildSelectionOnlyModifyTab(selectedElementKind));
  }

  return tabs;
}

function buildScheduleRibbonTabs(selectedElementKind?: string | null): RibbonTab[] {
  const tabs: RibbonTab[] = [
    {
      id: 'view',
      label: 'Schedule',
      panels: [
        {
          id: 'selection',
          label: 'Selection',
          commands: [tool('select', 'Select', 'select')],
        },
        {
          id: 'rows',
          label: 'Rows',
          commands: [
            action('schedule-open-row', 'Open Row', 'select'),
            action('schedule-row-ops', 'Row Ops', 'tableRows'),
            action('schedule-duplicate', 'Duplicate', 'copy'),
          ],
        },
        {
          id: 'columns',
          label: 'Columns',
          commands: [action('schedule-column-ops', 'Columns', 'tableColumns')],
        },
        {
          id: 'definition',
          label: 'Definition',
          commands: [action('schedule-controls', 'Fields / Sort', 'schedule')],
        },
        {
          id: 'place',
          label: 'Place',
          commands: [action('schedule-place-on-sheet', 'Place on Sheet', 'sheet')],
        },
      ],
    },
  ];

  if (selectedElementKind) {
    tabs.push(buildSelectionOnlyModifyTab(selectedElementKind));
  }

  return tabs;
}

function buildPlanModifyTab(selectedElementKind: string): RibbonTab {
  return {
    id: 'modify',
    label: `Modify | ${formatKind(selectedElementKind)}`,
    contextual: true,
    panels: [
      {
        id: 'selection',
        label: 'Selection',
        commands: [
          tool('select', 'Select', 'select'),
          tool('move', 'Move', 'move'),
          tool('copy', 'Copy', 'copy'),
        ],
      },
      {
        id: 'edit',
        label: 'Edit',
        commands: [
          tool('rotate', 'Rotate', 'rotate'),
          tool('mirror', 'Mirror', 'mirror'),
          tool('align', 'Align', 'align'),
          tool('trim-extend', 'Trim/Extend', 'trim'),
        ],
      },
    ],
  };
}

function build3dModifyTab(selectedElementKind: string): RibbonTab {
  return {
    id: 'modify',
    label: `Modify | ${formatKind(selectedElementKind)}`,
    contextual: true,
    panels: [
      {
        id: 'selection',
        label: 'Selection',
        commands: [tool('select', 'Select', 'select')],
      },
      {
        id: 'actions',
        label: 'Actions',
        commands:
          selectedElementKind === 'wall'
            ? [
                action('3d-insert-door', 'Insert Door', 'door', '3d-insert-door'),
                action('3d-insert-window', 'Insert Window', 'window', '3d-insert-window'),
                action('3d-insert-opening', 'Opening', 'wall-opening', '3d-insert-opening'),
              ]
            : [action('element-sidebar-toggle', 'Element Actions', 'select', '3d-element-actions')],
      },
    ],
  };
}

function buildSelectionOnlyModifyTab(selectedElementKind: string): RibbonTab {
  return {
    id: 'modify',
    label: `Modify | ${formatKind(selectedElementKind)}`,
    contextual: true,
    panels: [
      {
        id: 'selection',
        label: 'Selection',
        commands: [tool('select', 'Select', 'select')],
      },
      {
        id: 'actions',
        label: 'Actions',
        commands: [
          action('element-sidebar-toggle', 'Element Actions', 'select', 'element-actions'),
        ],
      },
    ],
  };
}

function collectTabCommands(tab: RibbonTab): RibbonCommand[] {
  const byKey = new Map<string, RibbonCommand>();
  for (const panel of tab.panels) {
    for (const command of [...panel.commands, ...(panel.flyoutCommands ?? [])]) {
      byKey.set(commandKey(command), command);
    }
  }
  return [...byKey.values()];
}

function commandKey(command: RibbonCommand): string {
  return `${command.type}:${command.id}:${command.testId ?? ''}`;
}

function commandActive(
  command: RibbonCommand,
  activeToolId: ToolId | undefined,
  sheetReviewMode: SheetReviewMode,
  sheetMarkupShape: SheetMarkupShape,
): boolean {
  if (command.type === 'tool') return command.id === activeToolId;
  if (command.type !== 'action') return false;
  switch (command.id) {
    case 'sheet-review-comment':
      return sheetReviewMode === 'cm';
    case 'sheet-review-markup':
      return sheetReviewMode === 'an';
    case 'sheet-review-resolve':
      return sheetReviewMode === 'mr';
    case 'sheet-markup-freehand':
      return sheetMarkupShape === 'freehand';
    case 'sheet-markup-arrow':
      return sheetMarkupShape === 'arrow';
    case 'sheet-markup-cloud':
      return sheetMarkupShape === 'cloud';
    case 'sheet-markup-text':
      return sheetMarkupShape === 'text';
    default:
      return false;
  }
}

function commandDisabledReason(
  command: RibbonCommand,
  activeMode: ToolWorkspaceMode | undefined,
  lensMode: CapabilityLensMode,
): string | undefined {
  if (!activeMode) return undefined;
  const availability = commandAvailability(command, activeMode, lensMode);
  if (availability?.state === 'disabled') {
    return availability.reason;
  }
  return undefined;
}

function commandAvailability(
  command: RibbonCommand,
  mode: ToolWorkspaceMode,
  lensMode: CapabilityLensMode,
): CommandAvailability | null {
  const commandId = ribbonCapabilityId(command);
  if (!commandId) return null;
  return evaluateCommandInMode(commandId, mode as CapabilityViewMode, lensMode);
}

function ribbonCapabilityId(command: RibbonCommand): string | null {
  if (command.type === 'tool') return capabilityIdForTool(command.id);
  if (command.type === 'mode') {
    return command.id === '3d' ? 'navigate.3d' : `navigate.${command.id}`;
  }
  switch (command.id) {
    case 'command-palette':
      return null;
    case 'project-manage-links':
      return 'project.manage-links';
    case 'advisor-open':
      return 'advisor.open';
    case 'create-section-view':
      return 'view.create.section';
    case 'element-sidebar-toggle':
      return 'shell.toggle-element-sidebar';
    case 'family-library':
      return 'library.open-family';
    case 'settings':
      return 'help.keyboard-shortcuts';
    case '3d-insert-door':
      return 'view.3d.wall.insert-door';
    case '3d-insert-window':
      return 'view.3d.wall.insert-window';
    case '3d-insert-opening':
      return 'view.3d.wall.insert-opening';
    case '3d-save-view':
      return 'view.3d.saved-view.save-current';
    case '3d-reset-view':
      return 'view.3d.saved-view.reset';
    case '3d-update-view':
      return 'view.3d.saved-view.update';
    case 'section-place-on-sheet':
      return 'section.place-on-sheet';
    case 'section-source-plan':
      return 'section.open-source-plan';
    case 'section-depth-increase':
      return 'section.crop-depth.increase';
    case 'section-depth-decrease':
      return 'section.crop-depth.decrease';
    case 'sheet-place-recommended':
      return 'sheet.place-recommended-views';
    case 'sheet-place-first-view':
      return 'sheet.edit-viewports';
    case 'sheet-edit-viewports':
      return 'sheet.edit-viewports';
    case 'sheet-edit-titleblock':
      return 'sheet.edit-titleblock';
    case 'sheet-publish':
      return 'sheet.export-share';
    case 'sheet-review-comment':
      return 'sheet.review.comment-mode';
    case 'sheet-review-markup':
      return 'sheet.review.markup-mode';
    case 'sheet-review-resolve':
      return 'sheet.review.resolve-mode';
    case 'sheet-markup-freehand':
      return 'sheet.review.markup-shape.freehand';
    case 'sheet-markup-arrow':
      return 'sheet.review.markup-shape.arrow';
    case 'sheet-markup-cloud':
      return 'sheet.review.markup-shape.cloud';
    case 'sheet-markup-text':
      return 'sheet.review.markup-shape.text';
    case 'schedule-open-row':
      return 'schedule.open-selected-row';
    case 'schedule-row-ops':
      return 'schedule.open-controls';
    case 'schedule-column-ops':
      return 'schedule.open-controls';
    case 'schedule-place-on-sheet':
      return 'schedule.place-on-sheet';
    case 'schedule-duplicate':
      return 'schedule.duplicate';
    case 'schedule-controls':
      return 'schedule.open-controls';
    case '3d-measure':
      return 'view.3d.measure.ribbon-bridge';
  }
  return null;
}

function readHiddenRibbonCommandKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RIBBON_HIDDEN_COMMANDS_STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeHiddenRibbonCommandKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RIBBON_HIDDEN_COMMANDS_STORAGE_KEY, JSON.stringify(keys.sort()));
}

function ribbonModeIdentity(mode: ToolWorkspaceMode): { label: string; icon: IconName } {
  switch (mode) {
    case '3d':
      return { label: '3D', icon: 'orbitView' };
    case 'section':
      return { label: 'Section', icon: 'sectionView' };
    case 'sheet':
      return { label: 'Sheet', icon: 'sheet' };
    case 'schedule':
      return { label: 'Schedule', icon: 'schedule' };
    case 'plan':
    default:
      return { label: 'Plan', icon: 'planView' };
  }
}

function tool(id: ToolId, label: string, icon: IconName, testId?: string): RibbonCommand {
  return { type: 'tool', id, label, icon, testId };
}

function mode(id: WorkspaceMode, label: string, icon: IconName, testId?: string): RibbonCommand {
  return { type: 'mode', id, label, icon, testId };
}

function action(id: RibbonActionId, label: string, icon: IconName, testId?: string): RibbonCommand {
  return { type: 'action', id, label, icon, testId };
}

function formatKind(kind: string): string {
  return kind
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
