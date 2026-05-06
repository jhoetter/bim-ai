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
}: TopBarProps): JSX.Element {
  const tablistId = useId();
  return (
    <div
      data-testid="topbar"
      role="banner"
      style={topBarStyle}
      className="flex w-full items-center gap-4 border-b border-border bg-surface px-4"
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
  return (
    <div className="flex items-center gap-3" style={{ minWidth: 240 }}>
      <IconButton Icon={Icons.hamburger} label={IconLabels.hamburger} onClick={onHamburgerClick} />
      <div
        aria-label="BIM AI"
        className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-accent-foreground"
        style={{ fontWeight: 700, fontSize: 12 }}
      >
        BA
      </div>
      <button
        type="button"
        ref={projectNameRef}
        onClick={onProjectNameClick}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-surface-strong"
        aria-haspopup="menu"
        data-testid="topbar-project-name"
      >
        <span className="truncate" style={{ maxWidth: 160 }}>
          {projectName}
        </span>
        <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" />
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
      aria-label="Workspace modes"
      onKeyDown={handleKey}
      className="flex flex-1 items-center justify-center gap-1"
    >
      {WORKSPACE_MODES.map((m) => {
        const active = m.id === mode;
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
            className={[
              'rounded-md px-3 py-1 text-sm transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-surface-strong',
            ].join(' ')}
          >
            {m.label}
            <span className="ml-1.5 text-xs opacity-60" aria-hidden="true">
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
}: {
  theme: 'light' | 'dark';
  onThemeToggle?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  collaboratorsCount?: number;
  onCollaboratorsClick?: () => void;
  avatarInitials?: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCommandPalette}
        aria-label={IconLabels.commandPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-sm text-muted hover:bg-surface-strong"
      >
        <Icons.commandPalette size={ICON_SIZE.chrome} />
        <span>⌘K</span>
      </button>
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
      <div
        aria-label="Account"
        className="flex h-7 w-7 items-center justify-center rounded-pill bg-surface-strong text-xs text-foreground"
      >
        {(avatarInitials ?? '··').slice(0, 2)}
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
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-surface-strong"
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
