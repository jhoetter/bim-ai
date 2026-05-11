import {
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';
import { Icons, IconLabels, ICON_SIZE, type LucideLikeIcon } from '@bim-ai/ui';
import { useBimStore } from '../../state/store';
import { AccountStatusMenu, type AccountStatusInfo } from './AccountStatusMenu';
import { SourceViewChip } from './SourceViewChip';
import { type ViewTab, type TabKind } from '../tabsModel';
import type { ToolId } from '../../tools/toolRegistry';
import { WorkspaceSwitcher } from '../chrome/WorkspaceSwitcher';
import type { WorkspaceId } from '../chrome/workspaces';
import {
  capabilityIdForTool,
  evaluateCommandInMode,
  formatCapabilityMode,
  type CapabilityViewMode,
} from '../commandCapabilities';

/**
 * TopBar — spec §11.
 *
 * Three regions:
 *   1. Left  (240 px): hamburger toggle, logo placeholder, project-name button.
 *   2. Center: mode pills traversable with arrow keys (`role="tablist"`).
 *   3. Right: command palette button, collaborators count, settings, theme
 *      toggle, avatar.
 *
 * The TopBar is purely presentational. State (current mode, theme,
 * collaborators) is owned by callers (Workspace + Mode-switching WP-D03).
 */

export const WORKSPACE_MODES = [
  { id: 'plan', label: 'Plan', hotkey: '1' },
  { id: '3d', label: '3D', hotkey: '2' },
  { id: 'plan-3d', label: 'Plan + 3D', hotkey: '3' },
  { id: 'section', label: 'Section', hotkey: '4' },
  { id: 'sheet', label: 'Sheet', hotkey: '5' },
  { id: 'schedule', label: 'Schedule', hotkey: '6' },
  { id: 'agent', label: 'Agent', hotkey: '7' },
  { id: 'concept', label: 'Concept', hotkey: '8' },
] as const;

export type WorkspaceMode = (typeof WORKSPACE_MODES)[number]['id'];

export interface TopBarSelectOption {
  id: string;
  label: string;
}

const QAT_STORAGE_KEY = 'bim-ai.topbar.qat.visible.v1';

type QatShortcutId = 'section' | 'measure' | 'dimension' | 'tag' | 'thin-lines' | 'close-inactive';

const QAT_SHORTCUTS: Array<{ id: QatShortcutId; label: string }> = [
  { id: 'section', label: 'Section' },
  { id: 'measure', label: 'Measure' },
  { id: 'dimension', label: 'Aligned Dimension' },
  { id: 'tag', label: 'Tag by Category' },
  { id: 'thin-lines', label: 'Thin Lines' },
  { id: 'close-inactive', label: 'Close Inactive Views' },
];

const DEFAULT_QAT_VISIBLE: Record<QatShortcutId, boolean> = {
  section: true,
  measure: true,
  dimension: true,
  tag: true,
  'thin-lines': true,
  'close-inactive': true,
};

function readQatVisibility(): Record<QatShortcutId, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_QAT_VISIBLE };
  try {
    const raw = window.localStorage.getItem(QAT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QAT_VISIBLE };
    const parsed = JSON.parse(raw) as Partial<Record<QatShortcutId, boolean>>;
    return {
      ...DEFAULT_QAT_VISIBLE,
      ...Object.fromEntries(
        QAT_SHORTCUTS.map((item) => [item.id, parsed[item.id] ?? DEFAULT_QAT_VISIBLE[item.id]]),
      ),
    } as Record<QatShortcutId, boolean>;
  } catch {
    return { ...DEFAULT_QAT_VISIBLE };
  }
}

export interface TopBarProps {
  mode: WorkspaceMode;
  onModeChange: (next: WorkspaceMode) => void;
  projectName: string;
  onProjectNameClick?: () => void;
  /** Forwarded to the project-name pill so external popovers can anchor. */
  projectNameRef?: React.RefObject<HTMLButtonElement | null>;
  onHamburgerClick?: () => void;
  theme: 'light' | 'dark';
  onThemeToggle?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  collaboratorsCount?: number;
  onCollaboratorsClick?: () => void;
  /** Identifier shown as the avatar fallback when no avatar URL is provided. */
  avatarInitials?: string;
  /** F-013: local account/license/status/about readout for the top-right account menu. */
  accountStatus?: AccountStatusInfo;
  /** F-013: opens the local account/profile details surface. */
  onAccountDetails?: () => void;
  /** F-013: opens the local license/plan management surface. */
  onManageLicense?: () => void;
  /** F-013: opens privacy/session preferences. */
  onPrivacySettings?: () => void;
  /** F-013: signs out of the local browser session. */
  onSignOut?: () => void;
  /** Presence peers to render as avatar chips (up to 6). */
  peers?: Array<{ name?: string; color?: string }>;
  /** OUT-V3-01: true when at least one Page exists in the model. */
  hasPages?: boolean;
  /** OUT-V3-01: callback to open the SharePresentationModal. */
  onSharePresentation?: () => void;
  /** MRK-V3-03: modelId used to construct the SourceViewChip WS connection. */
  modelId?: string;
  /** MRK-V3-03: active view id forwarded to SourceViewChip for sheet-comment back-flow. */
  activeViewId?: string;
  /** MRK-V3-03: callback from SourceViewChip to navigate to a sheet comment. */
  onNavigateToSheet?: (sheetId: string, commentId: string) => void;
  /** F-006: QAT Undo button. */
  onUndo?: () => void;
  /** F-006: QAT Redo button. */
  onRedo?: () => void;
  /** F-006: true when there is at least one undo step available. */
  canUndo?: boolean;
  /** F-006: true when there is at least one redo step available. */
  canRedo?: boolean;
  /** F-006: QAT Section shortcut — activates the section tool. */
  onSectionShortcut?: () => void;
  /** F-006: QAT Measure shortcut — activates the measure tool. */
  onMeasureShortcut?: () => void;
  /** F-006: QAT Aligned Dimension shortcut — activates the dimension tool. */
  onDimensionShortcut?: () => void;
  /** F-006: QAT Tag by Category shortcut — activates the tag tool. */
  onTagByCategoryShortcut?: () => void;
  /** F-006: QAT Thin Lines toggle — when true the toggle is active. */
  thinLinesEnabled?: boolean;
  /** F-006: QAT Thin Lines toggle callback. */
  onToggleThinLines?: () => void;
  // Tab list (replaces mode pills when provided)
  tabs?: ViewTab[];
  activeTabId?: string | null;
  onTabActivate?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onTabAdd?: (kind: TabKind) => void;
  onTabReorder?: (fromIdx: number, toIdx: number) => void;
  onCloseInactiveTabs?: () => void;
  activeWorkspaceId?: WorkspaceId;
  userPreferredWorkspace?: WorkspaceId;
  onWorkspaceChange?: (id: WorkspaceId) => void;
}

export function TopBar({
  mode,
  onModeChange,
  projectName,
  onProjectNameClick,
  projectNameRef,
  onHamburgerClick,
  theme,
  onThemeToggle,
  onCommandPalette,
  onSettings,
  collaboratorsCount,
  onCollaboratorsClick,
  avatarInitials,
  accountStatus,
  onAccountDetails,
  onManageLicense,
  onPrivacySettings,
  onSignOut,
  peers,
  hasPages,
  onSharePresentation,
  modelId,
  activeViewId,
  onNavigateToSheet,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSectionShortcut,
  onMeasureShortcut,
  onDimensionShortcut,
  onTagByCategoryShortcut,
  thinLinesEnabled,
  onToggleThinLines,
  tabs,
  activeTabId,
  onTabActivate,
  onTabClose,
  onTabAdd,
  onTabReorder,
  onCloseInactiveTabs,
  activeWorkspaceId = 'arch',
  userPreferredWorkspace = activeWorkspaceId,
  onWorkspaceChange,
}: TopBarProps): JSX.Element {
  const tablistId = useId();
  // SourceViewChip is only relevant when in a sheet-type view and both IDs are known.
  const showSourceViewChip = mode === 'sheet' && !!modelId && !!activeViewId;
  return (
    <div
      data-testid="topbar"
      role="banner"
      style={topBarStyle}
      className="flex w-full items-center gap-4 border-b border-border bg-background px-4"
    >
      <TopBarLeft
        mode={mode}
        projectName={projectName}
        onProjectNameClick={onProjectNameClick}
        projectNameRef={projectNameRef}
        onHamburgerClick={onHamburgerClick}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSectionShortcut={onSectionShortcut}
        onMeasureShortcut={onMeasureShortcut}
        onDimensionShortcut={onDimensionShortcut}
        onTagByCategoryShortcut={onTagByCategoryShortcut}
        thinLinesEnabled={thinLinesEnabled}
        onToggleThinLines={onToggleThinLines}
        onCloseInactiveTabs={onCloseInactiveTabs}
        activeWorkspaceId={activeWorkspaceId}
        userPreferredWorkspace={userPreferredWorkspace}
        onWorkspaceChange={onWorkspaceChange}
      />
      {tabs !== undefined ? (
        <TopBarTabs
          tabs={tabs}
          activeId={activeTabId ?? null}
          onActivate={onTabActivate}
          onClose={onTabClose}
          onAdd={onTabAdd}
          onReorder={onTabReorder}
          onCloseInactive={onCloseInactiveTabs}
        />
      ) : (
        <TopBarModePills tablistId={tablistId} mode={mode} onModeChange={onModeChange} />
      )}
      <TopBarRight
        theme={theme}
        onThemeToggle={onThemeToggle}
        onCommandPalette={onCommandPalette}
        onSettings={onSettings}
        collaboratorsCount={collaboratorsCount}
        onCollaboratorsClick={onCollaboratorsClick}
        avatarInitials={avatarInitials}
        accountStatus={accountStatus}
        onAccountDetails={onAccountDetails}
        onManageLicense={onManageLicense}
        onPrivacySettings={onPrivacySettings}
        onSignOut={onSignOut}
        peers={peers}
        hasPages={hasPages}
        onSharePresentation={onSharePresentation}
        sourceViewChip={
          showSourceViewChip ? (
            <SourceViewChip
              viewId={activeViewId!}
              modelId={modelId!}
              onNavigateToSheet={onNavigateToSheet}
            />
          ) : null
        }
      />
    </div>
  );
}

const topBarStyle: CSSProperties = {
  height: 'var(--shell-topbar-height)',
  minHeight: 'var(--shell-topbar-height)',
};

function TopBarLeft({
  mode,
  projectName,
  onProjectNameClick,
  projectNameRef,
  onHamburgerClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSectionShortcut,
  onMeasureShortcut,
  onDimensionShortcut,
  onTagByCategoryShortcut,
  thinLinesEnabled,
  onToggleThinLines,
  onCloseInactiveTabs,
  activeWorkspaceId,
  userPreferredWorkspace,
  onWorkspaceChange,
}: {
  mode: WorkspaceMode;
  projectName: string;
  onProjectNameClick?: () => void;
  projectNameRef?: React.RefObject<HTMLButtonElement | null>;
  onHamburgerClick?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSectionShortcut?: () => void;
  onMeasureShortcut?: () => void;
  onDimensionShortcut?: () => void;
  onTagByCategoryShortcut?: () => void;
  thinLinesEnabled?: boolean;
  onToggleThinLines?: () => void;
  onCloseInactiveTabs?: () => void;
  activeWorkspaceId: WorkspaceId;
  userPreferredWorkspace: WorkspaceId;
  onWorkspaceChange?: (id: WorkspaceId) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [qatVisible, setQatVisible] = useState<Record<QatShortcutId, boolean>>(() =>
    readQatVisibility(),
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(QAT_STORAGE_KEY, JSON.stringify(qatVisible));
  }, [qatVisible]);

  const toggleQatShortcut = (id: QatShortcutId) => {
    setQatVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const sectionShortcut = qatToolShortcutProjection('Section', 'section', mode);
  const measureShortcut = qatToolShortcutProjection(IconLabels.measure, 'measure', mode);
  const dimensionShortcut = qatToolShortcutProjection('Aligned Dimension', 'dimension', mode);
  const tagShortcut = qatToolShortcutProjection('Tag by Category', 'tag', mode);

  return (
    <div className="relative flex items-center gap-3" style={{ minWidth: 240 }}>
      <IconButton Icon={Icons.hamburger} label={IconLabels.hamburger} onClick={onHamburgerClick} />
      <div
        aria-label={t('topbar.appLogoAriaLabel')}
        className="flex h-6 w-6 items-center justify-center rounded bg-accent text-accent-foreground"
        style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.01em' }}
      >
        BA
      </div>
      <button
        type="button"
        ref={projectNameRef}
        onClick={onProjectNameClick}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:bg-surface"
        aria-haspopup="menu"
        data-testid="topbar-project-name"
      >
        <span className="truncate" style={{ maxWidth: 160 }} title={projectName}>
          {projectName}
        </span>
        <Icons.disclosureOpen size={14} className="text-muted" aria-hidden="true" />
      </button>
      <WorkspaceSwitcher
        activeWorkspaceId={activeWorkspaceId}
        userPreferredWorkspace={userPreferredWorkspace}
        onSetActiveWorkspace={onWorkspaceChange ?? (() => undefined)}
      />
      <div className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        data-testid="topbar-undo"
        title="Undo (Ctrl+Z)"
        aria-label={IconLabels.undo}
        aria-keyshortcuts="Control+Z Meta+Z"
        disabled={!canUndo}
        onClick={onUndo}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icons.undo size={ICON_SIZE.topbar} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="topbar-redo"
        title="Redo (Ctrl+Y)"
        aria-label={IconLabels.redo}
        aria-keyshortcuts="Control+Y Meta+Shift+Z"
        disabled={!canRedo}
        onClick={onRedo}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icons.redo size={ICON_SIZE.topbar} aria-hidden="true" />
      </button>
      {qatVisible.section ? (
        <button
          type="button"
          data-testid="topbar-section-shortcut"
          title={sectionShortcut.title}
          aria-label={sectionShortcut.ariaLabel}
          data-command-behavior={sectionShortcut.behavior}
          onClick={onSectionShortcut ?? (() => useBimStore.getState().setPlanTool('section'))}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Icons.section size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      ) : null}
      {qatVisible.measure ? (
        <button
          type="button"
          data-testid="topbar-measure-shortcut"
          title={measureShortcut.title}
          aria-label={measureShortcut.ariaLabel}
          data-command-behavior={measureShortcut.behavior}
          onClick={onMeasureShortcut ?? (() => useBimStore.getState().setPlanTool('measure'))}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Icons.measure size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      ) : null}
      {qatVisible.dimension ? (
        <button
          type="button"
          data-testid="topbar-dimension-shortcut"
          title={dimensionShortcut.title}
          aria-label={dimensionShortcut.ariaLabel}
          data-command-behavior={dimensionShortcut.behavior}
          onClick={onDimensionShortcut ?? (() => useBimStore.getState().setPlanTool('dimension'))}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Icons.dimension size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      ) : null}
      {qatVisible.tag ? (
        <button
          type="button"
          data-testid="topbar-tag-by-category-shortcut"
          title={tagShortcut.title}
          aria-label={tagShortcut.ariaLabel}
          data-command-behavior={tagShortcut.behavior}
          onClick={onTagByCategoryShortcut ?? (() => useBimStore.getState().setPlanTool('tag'))}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Icons.tag size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      ) : null}
      {qatVisible['thin-lines'] ? (
        <button
          type="button"
          data-testid="topbar-thin-lines"
          title="Thin Lines"
          aria-label={IconLabels.thinLines}
          aria-pressed={thinLinesEnabled ?? false}
          onClick={onToggleThinLines ?? (() => useBimStore.getState().toggleThinLines())}
          className={[
            'relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            thinLinesEnabled
              ? 'bg-accent text-accent-foreground hover:bg-accent/80'
              : 'text-muted hover:bg-surface hover:text-foreground',
          ].join(' ')}
        >
          <Icons.thinLines size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      ) : null}
      {qatVisible['close-inactive'] ? (
        <button
          type="button"
          data-testid="topbar-close-inactive"
          title="Close Inactive Views"
          aria-label="Close Inactive Views"
          disabled={!onCloseInactiveTabs}
          onClick={onCloseInactiveTabs}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icons.close size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        data-testid="topbar-qat-customize"
        title="Customize Quick Access Toolbar"
        aria-label="Customize Quick Access Toolbar"
        aria-expanded={customizeOpen}
        onClick={() => setCustomizeOpen((v) => !v)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        <Icons.settings size={ICON_SIZE.topbar} aria-hidden="true" />
      </button>
      {customizeOpen ? (
        <div
          data-testid="topbar-qat-menu"
          className="absolute left-24 top-9 z-50 min-w-52 rounded-md border border-border bg-background p-2 text-xs shadow"
        >
          {QAT_SHORTCUTS.map((item) => (
            <label key={item.id} className="flex items-center gap-2 px-1 py-1">
              <input
                type="checkbox"
                checked={qatVisible[item.id]}
                data-testid={`topbar-qat-toggle-${item.id}`}
                onChange={() => toggleQatShortcut(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function qatToolShortcutProjection(
  label: string,
  toolId: ToolId,
  mode: WorkspaceMode,
): { title: string; ariaLabel: string; behavior: 'direct' | 'bridge' | 'disabled' } {
  const availability = evaluateCommandInMode(
    capabilityIdForTool(toolId),
    mode as CapabilityViewMode,
  );
  if (availability?.state === 'bridge') {
    const target = formatCapabilityMode(availability.targetMode);
    return {
      title: `${label} - switches to ${target}`,
      ariaLabel: `${label}, switches to ${target}`,
      behavior: 'bridge',
    };
  }
  if (availability?.state === 'disabled') {
    return {
      title: availability.reason,
      ariaLabel: `${label}, unavailable in ${formatCapabilityMode(mode as CapabilityViewMode)}`,
      behavior: 'disabled',
    };
  }
  return { title: label, ariaLabel: label, behavior: 'direct' };
}

function TopBarModePills({
  tablistId,
  mode,
  onModeChange,
}: {
  tablistId: string;
  mode: WorkspaceMode;
  onModeChange: (next: WorkspaceMode) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const tabRefs = useRef<Map<WorkspaceMode, HTMLButtonElement>>(new Map());
  const setTabRef = useCallback(
    (id: WorkspaceMode) => (el: HTMLButtonElement | null) => {
      if (el) tabRefs.current.set(id, el);
      else tabRefs.current.delete(id);
    },
    [],
  );

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const idx = WORKSPACE_MODES.findIndex((m) => m.id === mode);
      if (idx < 0) return;
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = WORKSPACE_MODES[(idx + delta + WORKSPACE_MODES.length) % WORKSPACE_MODES.length];
      event.preventDefault();
      onModeChange(next.id);
      tabRefs.current.get(next.id)?.focus();
    },
    [mode, onModeChange],
  );

  return (
    <div
      role="tablist"
      id={tablistId}
      aria-label={t('topbar.modesAriaLabel')}
      onKeyDown={handleKey}
      className="flex flex-1 items-center justify-center gap-1"
    >
      {WORKSPACE_MODES.map((m) => {
        const active = m.id === mode;
        const modeLabel = t(`topbar.modes.${m.id}`);
        return (
          <button
            key={m.id}
            ref={setTabRef(m.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-keyshortcuts={m.hotkey}
            tabIndex={active ? 0 : -1}
            onClick={() => onModeChange(m.id)}
            data-active={active ? 'true' : 'false'}
            title={`${modeLabel} (${m.hotkey})`}
            className={[
              'relative rounded px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'text-accent' : 'text-muted hover:bg-surface hover:text-foreground',
            ].join(' ')}
            style={active ? { boxShadow: 'inset 0 -2px 0 0 var(--color-accent)' } : undefined}
          >
            {modeLabel}
            <span aria-hidden="true" className="ml-1.5 text-[10px] tabular-nums opacity-40">
              {m.hotkey}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TAB_KIND_ICON: Record<TabKind, LucideLikeIcon> = {
  plan: Icons.floor!,
  '3d': Icons.family!,
  'plan-3d': Icons.floor!,
  section: Icons.section!,
  sheet: Icons.sheet!,
  schedule: Icons.schedule!,
  agent: Icons.agent!,
  concept: Icons.agent!,
};

const ADDABLE_KINDS: TabKind[] = [
  'plan',
  '3d',
  'plan-3d',
  'section',
  'sheet',
  'schedule',
  'agent',
  'concept',
];

function TopBarTabs({
  tabs,
  activeId,
  onActivate,
  onClose,
  onAdd,
  onReorder,
  onCloseInactive,
}: {
  tabs: ViewTab[];
  activeId: string | null;
  onActivate?: (id: string) => void;
  onClose?: (id: string) => void;
  onAdd?: (kind: TabKind) => void;
  onReorder?: (from: number, to: number) => void;
  onCloseInactive?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Horizontal mousewheel scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent): void => {
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
      ev.preventDefault();
      el.scrollLeft += ev.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Click outside closes popover
  useEffect(() => {
    if (!popoverOpen) return;
    const onDoc = (e: globalThis.MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [popoverOpen]);

  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeId]);

  function handleTabListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabEls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const idx = tabEls.indexOf(document.activeElement as HTMLElement);
    const next = tabEls[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabEls.length) % tabEls.length];
    next?.focus();
    e.preventDefault();
  }

  return (
    <div
      ref={scrollRef}
      role="tablist"
      aria-label={t('workspace.openViews')}
      data-testid="view-tabs"
      onKeyDown={handleTabListKeyDown}
      className="flex flex-1 items-center gap-0.5 overflow-x-auto px-2"
    >
      {tabs.length === 0 ? (
        <span className="px-2 text-xs text-muted">{t('workspace.noViewsOpen')}</span>
      ) : null}
      {tabs.map((tab, idx) => {
        const Icon = TAB_KIND_ICON[tab.kind] ?? Icons.floor!;
        const isActive = tab.id === activeId;
        const isDragOver = dragOverIdx === idx && dragSrc !== null && dragSrc !== idx;
        const truncated = tab.label.length > 18 ? tab.label.slice(0, 17) + '…' : tab.label;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            data-tab-id={tab.id}
            data-active={isActive ? 'true' : 'false'}
            draggable={Boolean(onReorder)}
            onClick={() => onActivate?.(tab.id)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              onActivate?.(tab.id);
            }}
            onDragStart={(e) => {
              if (!onReorder) return;
              setDragSrc(idx);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (!onReorder || dragSrc === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverIdx !== idx) setDragOverIdx(idx);
            }}
            onDragLeave={() => {
              if (dragOverIdx === idx) setDragOverIdx(null);
            }}
            onDrop={(e) => {
              if (!onReorder || dragSrc === null) return;
              e.preventDefault();
              if (dragSrc !== idx) onReorder(dragSrc, idx);
              setDragSrc(null);
              setDragOverIdx(null);
            }}
            onDragEnd={() => {
              setDragSrc(null);
              setDragOverIdx(null);
            }}
            className={[
              'group flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors cursor-pointer flex-shrink-0',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted hover:bg-surface hover:text-foreground',
              isDragOver ? 'ring-2 ring-accent' : '',
            ].join(' ')}
            style={isActive ? { boxShadow: 'inset 0 -2px 0 0 var(--color-accent)' } : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActivate?.(tab.id);
              }}
              aria-label={`${tab.kind}: ${tab.label}`}
              className="flex items-center gap-1.5"
              data-testid={`tab-activate-${tab.id}`}
            >
              <Icon
                size={12}
                aria-hidden="true"
                className={isActive ? 'text-accent' : 'text-muted'}
              />
              <span className="whitespace-nowrap">{truncated}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.(tab.id);
              }}
              aria-label={`Close ${tab.label}`}
              data-testid={`tab-close-${tab.id}`}
              className={[
                'rounded p-0.5 hover:bg-surface-strong',
                isActive
                  ? 'opacity-50 hover:opacity-100'
                  : 'opacity-0 group-hover:opacity-50 group-hover:hover:opacity-100',
              ].join(' ')}
            >
              <Icons.close size={10} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <div className="relative ml-0.5 flex-shrink-0" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          aria-label={t('workspace.openNewView')}
          aria-expanded={popoverOpen}
          aria-haspopup="menu"
          data-testid="tab-add-button"
          className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-strong hover:text-foreground"
          style={{ fontSize: 16, lineHeight: 1 }}
        >
          +
        </button>
        {popoverOpen ? (
          <div
            role="menu"
            data-testid="tab-add-popover"
            className="absolute left-0 top-full z-30 mt-1 flex min-w-[180px] flex-col rounded-md border border-border bg-surface shadow-elev-2"
            ref={(el) => el?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()}
            onKeyDown={(e) => {
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
              );
              const idx = items.indexOf(document.activeElement as HTMLElement);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[(idx + 1) % items.length]?.focus();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[(idx - 1 + items.length) % items.length]?.focus();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setPopoverOpen(false);
              }
            }}
          >
            {ADDABLE_KINDS.map((kind) => {
              const Icon = TAB_KIND_ICON[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPopoverOpen(false);
                    onAdd?.(kind);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
                  data-testid={`tab-add-${kind}`}
                >
                  <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
                  <span>+ {t(`workspace.tabs.${kind}`)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {onCloseInactive && tabs.length > 1 ? (
        <button
          type="button"
          data-testid="close-inactive-tabs"
          title="Close Inactive Views"
          onClick={onCloseInactive}
          className="ml-1 flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-muted hover:bg-surface-strong hover:text-foreground"
          style={{ fontSize: 11, whiteSpace: 'nowrap' }}
        >
          <Icons.close size={10} aria-hidden="true" />
          <span>Close Inactive</span>
        </button>
      ) : null}
    </div>
  );
}

function TopBarRight({
  theme,
  onThemeToggle,
  onCommandPalette,
  onSettings,
  collaboratorsCount,
  onCollaboratorsClick,
  avatarInitials,
  accountStatus,
  onAccountDetails,
  onManageLicense,
  onPrivacySettings,
  onSignOut,
  peers,
  hasPages,
  onSharePresentation,
  sourceViewChip,
}: {
  theme: 'light' | 'dark';
  onThemeToggle?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  collaboratorsCount?: number;
  onCollaboratorsClick?: () => void;
  avatarInitials?: string;
  accountStatus?: AccountStatusInfo;
  onAccountDetails?: () => void;
  onManageLicense?: () => void;
  onPrivacySettings?: () => void;
  onSignOut?: () => void;
  peers?: Array<{ name?: string; color?: string }>;
  hasPages?: boolean;
  onSharePresentation?: () => void;
  /** MRK-V3-03: pre-rendered SourceViewChip node (null when not in sheet view). */
  sourceViewChip?: JSX.Element | null;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Close avatar menu on outside click
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const onDoc = (e: globalThis.MouseEvent): void => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [avatarMenuOpen]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={hasPages ? onSharePresentation : undefined}
        disabled={!hasPages}
        aria-label="Share"
        title={hasPages ? 'Share live presentation' : 'Add a Page first'}
        style={{ background: 'var(--color-surface-strong)' }}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-muted shadow-sm hover:bg-surface-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span style={{ fontSize: 'var(--text-sm)' }}>Share</span>
      </button>
      {sourceViewChip ?? null}
      <button
        type="button"
        onClick={onCommandPalette}
        aria-label="Search or open command palette"
        aria-keyshortcuts="Meta+K Control+K"
        data-testid="topbar-cmdpalette"
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted shadow-sm hover:bg-surface-strong hover:text-foreground"
        style={{ minWidth: 160 }}
      >
        <Icons.commandPalette size={13} aria-hidden="true" />
        <span className="flex-1 text-left">Search or press</span>
        <kbd className="rounded bg-surface-strong px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      {peers && peers.length > 0 ? (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
          <div
            data-testid="peer-avatars"
            className="flex items-center -space-x-1"
            aria-label={t('topbar.activeCollaborators')}
          >
            {peers.slice(0, 5).map((p, i) => (
              <div
                key={i}
                title={p.name ?? t('topbar.anonymous')}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[9px] font-semibold text-foreground ring-0"
                style={{ backgroundColor: p.color ?? 'var(--color-surface-strong)', zIndex: 5 - i }}
              >
                {(p.name ?? '?').slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </>
      ) : null}
      <IconButton
        Icon={Icons.collaborators}
        label={IconLabels.collaborators}
        onClick={onCollaboratorsClick}
        badge={collaboratorsCount}
      />
      {/* Avatar / settings dropdown */}
      <div className="relative" ref={avatarMenuRef}>
        <button
          type="button"
          aria-label={t('topbar.account')}
          aria-haspopup="menu"
          aria-expanded={avatarMenuOpen}
          title={avatarInitials ?? ''}
          data-testid="topbar-avatar-menu-trigger"
          onClick={() => setAvatarMenuOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-accent/15 text-[11px] font-semibold text-accent hover:bg-accent/25"
        >
          {(avatarInitials ?? '··').slice(0, 2).toUpperCase()}
        </button>
        {avatarMenuOpen ? (
          <div
            role="menu"
            data-testid="topbar-avatar-menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-md border border-border bg-surface shadow-elev-2"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setAvatarMenuOpen(false);
              }
            }}
          >
            <AccountStatusMenu
              info={accountStatus}
              onSettings={() => {
                setAvatarMenuOpen(false);
                onSettings?.();
              }}
              onCommandPalette={() => {
                setAvatarMenuOpen(false);
                onCommandPalette?.();
              }}
              onAccountDetails={() => {
                setAvatarMenuOpen(false);
                (onAccountDetails ?? onSettings)?.();
              }}
              onManageLicense={() => {
                setAvatarMenuOpen(false);
                (onManageLicense ?? onSettings)?.();
              }}
              onPrivacySettings={() => {
                setAvatarMenuOpen(false);
                (onPrivacySettings ?? onSettings)?.();
              }}
              onSignOut={() => {
                setAvatarMenuOpen(false);
                (onSignOut ?? onSettings)?.();
              }}
            />
            <div className="my-1 h-px bg-border" aria-hidden="true" />
            <button
              type="button"
              role="menuitem"
              data-testid="topbar-theme-toggle"
              data-current-theme={theme}
              onClick={() => {
                setAvatarMenuOpen(false);
                onThemeToggle?.();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface-strong"
            >
              {theme === 'dark' ? (
                <Icons.themeLight size={13} aria-hidden="true" />
              ) : (
                <Icons.themeDark size={13} aria-hidden="true" />
              )}
              {theme === 'dark' ? IconLabels.themeLight : IconLabels.themeDark}
            </button>
            <button
              type="button"
              role="menuitem"
              data-testid="topbar-language-toggle"
              onClick={() => {
                setAvatarMenuOpen(false);
                const next = i18n.language === 'de' ? 'en' : 'de';
                void i18n.changeLanguage(next);
                localStorage.setItem('bim-ai:lang', next);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface-strong"
            >
              Language: {i18n.language.toUpperCase()}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface IconButtonProps {
  Icon: LucideLikeIcon;
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  badge?: number;
  ['data-testid']?: string;
  ['data-current-theme']?: string;
}

function IconButton({
  Icon,
  label,
  onClick,
  badge,
  'data-testid': testId,
  'data-current-theme': currentTheme,
}: IconButtonProps): JSX.Element {
  const handleFocus = useCallback((_e: FocusEvent<HTMLButtonElement>) => {
    /* no-op — declared so consumers can extend later. */
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={handleFocus}
      aria-label={label}
      title={label}
      data-testid={testId}
      data-current-theme={currentTheme}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
    >
      <Icon size={ICON_SIZE.topbar} aria-hidden="true" />
      {typeof badge === 'number' && badge > 0 ? (
        <span
          data-testid="topbar-badge"
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-xs text-accent-foreground"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
