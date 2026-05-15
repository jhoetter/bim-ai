import { type CSSProperties, type JSX, type RefObject, useEffect, useMemo } from 'react';
import { Icons } from '@bim-ai/ui';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import type { WorkspaceId } from './workspaces';

export interface TopBarV3Props {
  // Slot 2
  projectName: string;
  currentProjectId: string;
  onProjectNameClick?: () => void;
  projectNameRef?: RefObject<HTMLButtonElement | null>;
  // Slot 3 — workspace switcher (CHR-V3-02)
  activeWorkspaceId: WorkspaceId;
  userPreferredWorkspace: WorkspaceId;
  onWorkspaceSwitcherSelect?: (id: WorkspaceId) => void;
  // Slot 5
  onCommandPalette?: () => void;
  // Slot 6
  onActivityStream?: () => void;
  // Slot 7 — presence
  presence?: Array<{ userId: string; name?: string; color?: string }>;
  // Slot 8
  theme: 'light' | 'dark';
  onThemeToggle?: () => void;
  onSettings?: () => void;
  avatarInitials?: string;
  onHamburgerClick?: () => void;
}

const topBarStyle: CSSProperties = {
  height: 'var(--shell-topbar-height)',
  minHeight: 'var(--shell-topbar-height)',
  backgroundColor: 'var(--color-surface)',
  borderBottom: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-canvas)',
};

const MAX_PRESENCE_AVATARS = 4;

export function TopBarV3({
  projectName,
  currentProjectId: _currentProjectId,
  onProjectNameClick,
  projectNameRef,
  activeWorkspaceId,
  userPreferredWorkspace,
  onWorkspaceSwitcherSelect,
  onCommandPalette,
  onActivityStream,
  presence,
  theme,
  onThemeToggle,
  onSettings,
  avatarInitials,
  onHamburgerClick,
}: TopBarV3Props): JSX.Element {
  const isMac = useMemo(() => navigator.platform.toLowerCase().includes('mac'), []);
  const cmdGlyph = isMac ? '⌘K' : 'Ctrl+K';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        onActivityStream?.();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onActivityStream]);

  const visiblePresence = presence?.slice(0, MAX_PRESENCE_AVATARS) ?? [];
  const overflowCount = Math.max(0, (presence?.length ?? 0) - MAX_PRESENCE_AVATARS);
  const hasPresence = (presence?.length ?? 0) > 0;

  return (
    <div
      data-testid="topbar-v3"
      role="banner"
      style={topBarStyle}
      className="flex w-full items-center gap-2 px-2"
    >
      {/* Hamburger toggle */}
      {onHamburgerClick ? (
        <button
          type="button"
          onClick={onHamburgerClick}
          aria-label="Toggle navigation"
          title="Toggle navigation"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          <Icons.hamburger size={16} aria-hidden="true" />
        </button>
      ) : null}

      {/* Slot 1 — Logo mark */}
      <div
        role="button"
        aria-label="bim-ai home"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
        }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'var(--color-accent)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-surface)',
          fontWeight: 700,
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        BA
      </div>

      {/* Slot 2 — Project name */}
      <button
        type="button"
        ref={projectNameRef}
        onClick={onProjectNameClick}
        aria-haspopup="menu"
        data-testid="topbar-v3-project-name"
        tabIndex={0}
        title={projectName}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          lineHeight: 'var(--text-sm-line)',
          borderRadius: 'var(--radius-md)',
          fontWeight: 500,
          color: 'var(--color-foreground)',
        }}
      >
        <span
          style={{
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {projectName}
        </span>
        <Icons.disclosureOpen size={12} aria-hidden="true" />
      </button>

      {/* Slot 3 — Workspace switcher (CHR-V3-02) */}
      <WorkspaceSwitcher
        activeWorkspaceId={activeWorkspaceId}
        userPreferredWorkspace={userPreferredWorkspace}
        onSetActiveWorkspace={onWorkspaceSwitcherSelect ?? (() => undefined)}
      />

      {/* Slot 4 — Flex stretch; never tools */}
      <div style={{ flex: 1 }} aria-hidden="true" />

      {/* Slot 5 — Cmd+K palette button */}
      <button
        type="button"
        onClick={onCommandPalette}
        aria-label={`Command palette  ${cmdGlyph}`}
        aria-keyshortcuts="Meta+K Control+K"
        data-testid="topbar-v3-cmdpalette"
        tabIndex={0}
        title={`Command palette  ${cmdGlyph}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-muted-foreground)',
        }}
      >
        <Icons.commandPalette size={16} aria-hidden="true" />
      </button>

      {/* Slot 6 — Activity-stream entry; Cmd+H bound via useEffect above */}
      <button
        type="button"
        onClick={onActivityStream}
        aria-label="Activity stream  ⌘H"
        aria-keyshortcuts="Meta+H"
        data-testid="topbar-v3-activity"
        tabIndex={0}
        title="Activity stream  ⌘H"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-muted-foreground)',
        }}
      >
        <Icons.activity size={16} aria-hidden="true" />
      </button>

      {/* Slot 7 — Presence avatars (hidden when empty) */}
      {hasPresence ? (
        <div
          data-testid="topbar-v3-presence"
          style={{ display: 'flex', alignItems: 'center' }}
          aria-label="Active collaborators"
        >
          {visiblePresence.map((p, i) => (
            <div
              key={p.userId}
              title={p.name ?? 'Anonymous'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 'var(--radius-pill)',
                border: '2px solid var(--color-surface)',
                backgroundColor: p.color ?? 'var(--color-surface-strong)',
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                color: 'var(--color-foreground)',
                marginLeft: i === 0 ? 0 : -6,
                zIndex: MAX_PRESENCE_AVATARS - i,
                userSelect: 'none',
              }}
            >
              {(p.name ?? '?').slice(0, 2).toUpperCase()}
            </div>
          ))}
          {overflowCount > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 6,
                paddingRight: 6,
                height: 24,
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-accent-foreground)',
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                marginLeft: -6,
              }}
            >
              +{overflowCount}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Slot 8 — Profile / settings */}
      <button
        type="button"
        onClick={onSettings}
        aria-label="Account"
        data-testid="topbar-v3-account"
        tabIndex={0}
        title="Account & settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-pill)',
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
          color: 'var(--color-accent)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
        }}
      >
        {(avatarInitials ?? '··').slice(0, 2).toUpperCase()}
      </button>

      {/* Theme toggle — hidden when no handler provided */}
      {onThemeToggle ? (
        <button
          type="button"
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          {theme === 'dark' ? (
            <Icons.themeLight size={16} aria-hidden="true" />
          ) : (
            <Icons.themeDark size={16} aria-hidden="true" />
          )}
        </button>
      ) : null}
    </div>
  );
}
