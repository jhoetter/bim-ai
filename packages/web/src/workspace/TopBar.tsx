import {
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useId,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, IconLabels, ICON_SIZE, type LucideLikeIcon } from '@bim-ai/ui';

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
] as const;

export type WorkspaceMode = (typeof WORKSPACE_MODES)[number]['id'];

export interface TopBarSelectOption {
  id: string;
  label: string;
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
  /** Presence peers to render as avatar chips (up to 6). */
  peers?: Array<{ name?: string; color?: string }>;
  /** Discipline/perspective filter selector. */
  perspectiveOptions?: TopBarSelectOption[];
  perspectiveValue?: string;
  onPerspectiveChange?: (id: string) => void;
  /** Plan presentation style selector. */
  planStyleOptions?: TopBarSelectOption[];
  planStyleValue?: string;
  onPlanStyleChange?: (id: string) => void;
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
  peers,
  perspectiveOptions,
  perspectiveValue,
  onPerspectiveChange,
  planStyleOptions,
  planStyleValue,
  onPlanStyleChange,
}: TopBarProps): JSX.Element {
  const tablistId = useId();
  return (
    <div
      data-testid="topbar"
      role="banner"
      style={topBarStyle}
      className="flex w-full items-center gap-4 border-b border-border bg-background px-4"
    >
      <TopBarLeft
        projectName={projectName}
        onProjectNameClick={onProjectNameClick}
        projectNameRef={projectNameRef}
        onHamburgerClick={onHamburgerClick}
      />
      <TopBarModePills tablistId={tablistId} mode={mode} onModeChange={onModeChange} />
      <TopBarRight
        theme={theme}
        onThemeToggle={onThemeToggle}
        onCommandPalette={onCommandPalette}
        onSettings={onSettings}
        collaboratorsCount={collaboratorsCount}
        onCollaboratorsClick={onCollaboratorsClick}
        avatarInitials={avatarInitials}
        peers={peers}
        perspectiveOptions={perspectiveOptions}
        perspectiveValue={perspectiveValue}
        onPerspectiveChange={onPerspectiveChange}
        planStyleOptions={planStyleOptions}
        planStyleValue={planStyleValue}
        onPlanStyleChange={onPlanStyleChange}
      />
    </div>
  );
}

const topBarStyle: CSSProperties = {
  height: 'var(--shell-topbar-height)',
  minHeight: 'var(--shell-topbar-height)',
};

function TopBarLeft({
  projectName,
  onProjectNameClick,
  projectNameRef,
  onHamburgerClick,
}: {
  projectName: string;
  onProjectNameClick?: () => void;
  projectNameRef?: React.RefObject<HTMLButtonElement | null>;
  onHamburgerClick?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3" style={{ minWidth: 240 }}>
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
        <span className="truncate" style={{ maxWidth: 160 }}>
          {projectName}
        </span>
        <Icons.disclosureOpen size={14} className="text-muted" aria-hidden="true" />
      </button>
    </div>
  );
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

function TopBarRight({
  theme,
  onThemeToggle,
  onCommandPalette,
  onSettings,
  collaboratorsCount,
  onCollaboratorsClick,
  avatarInitials,
  peers,
  perspectiveOptions,
  perspectiveValue,
  onPerspectiveChange,
  planStyleOptions,
  planStyleValue,
  onPlanStyleChange,
}: {
  theme: 'light' | 'dark';
  onThemeToggle?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  collaboratorsCount?: number;
  onCollaboratorsClick?: () => void;
  avatarInitials?: string;
  peers?: Array<{ name?: string; color?: string }>;
  perspectiveOptions?: TopBarSelectOption[];
  perspectiveValue?: string;
  onPerspectiveChange?: (id: string) => void;
  planStyleOptions?: TopBarSelectOption[];
  planStyleValue?: string;
  onPlanStyleChange?: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const showSelects =
    (perspectiveOptions && perspectiveOptions.length > 0) ||
    (planStyleOptions && planStyleOptions.length > 0);
  return (
    <div className="flex items-center gap-1.5">
      {showSelects ? (
        <>
          {perspectiveOptions && perspectiveOptions.length > 0 && perspectiveValue !== undefined && onPerspectiveChange ? (
            <TopBarSelect
              value={perspectiveValue}
              onChange={onPerspectiveChange}
              options={perspectiveOptions}
              label={t('topbar.perspective')}
            />
          ) : null}
          {planStyleOptions && planStyleOptions.length > 0 && planStyleValue !== undefined && onPlanStyleChange ? (
            <TopBarSelect
              value={planStyleValue}
              onChange={onPlanStyleChange}
              options={planStyleOptions}
              label={t('topbar.planStyle')}
            />
          ) : null}
          <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        </>
      ) : null}
      <button
        type="button"
        onClick={onCommandPalette}
        aria-label={IconLabels.commandPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-sm hover:bg-surface-strong hover:text-foreground"
      >
        <Icons.commandPalette size={13} aria-hidden="true" />
        <span className="tabular-nums">⌘K</span>
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
      <IconButton Icon={Icons.settings} label={IconLabels.settings} onClick={onSettings} />
      <IconButton
        Icon={theme === 'dark' ? Icons.themeLight : Icons.themeDark}
        label={theme === 'dark' ? IconLabels.themeLight : IconLabels.themeDark}
        onClick={onThemeToggle}
        data-testid="topbar-theme-toggle"
        data-current-theme={theme}
      />
      <div className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <div
        aria-label={t('topbar.account')}
        title={avatarInitials ?? ''}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-accent/15 text-[11px] font-semibold text-accent"
      >
        {(avatarInitials ?? '··').slice(0, 2).toUpperCase()}
      </div>
    </div>
  );
}

function TopBarSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: TopBarSelectOption[];
  label: string;
}): JSX.Element {
  return (
    <div className="relative flex items-center">
      <select
        aria-label={label}
        title={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 cursor-pointer appearance-none rounded-md border border-border bg-surface pl-2.5 pr-6 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-surface-strong focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Icons.disclosureOpen
        size={11}
        className="pointer-events-none absolute right-1.5 text-muted"
        aria-hidden="true"
      />
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
