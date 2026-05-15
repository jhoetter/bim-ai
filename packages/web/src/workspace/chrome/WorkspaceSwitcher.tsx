import { type CSSProperties, type JSX, useEffect, useRef, useState } from 'react';
import { Icons } from '@bim-ai/ui';
import { WORKSPACES, type WorkspaceDescriptor, type WorkspaceId } from './workspaces';

export interface WorkspaceSwitcherProps {
  activeWorkspaceId: WorkspaceId;
  userPreferredWorkspace: WorkspaceId;
  onSetActiveWorkspace: (id: WorkspaceId) => void;
}

export function WorkspaceSwitcher({
  activeWorkspaceId,
  onSetActiveWorkspace,
}: WorkspaceSwitcherProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = WORKSPACES.find((w) => w.id === activeWorkspaceId) ?? WORKSPACES[0]!;

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const chipStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    height: 'calc(var(--shell-topbar-height) - 16px)',
    borderLeft: `3px solid ${activeWorkspace.discToken}`,
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-surface-strong)',
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm-line)',
    fontWeight: 500,
    color: 'var(--color-foreground)',
    cursor: 'pointer',
    transition: `border-color var(--motion-slow) var(--ease-paper), background-color var(--motion-slow) var(--ease-paper)`,
  };

  const menuStyle: CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--elev-2)',
    minWidth: 160,
    zIndex: 100,
    listStyle: 'none',
    padding: 0,
    margin: 0,
    marginBlockStart: 4,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="workspace-switcher-chip"
        data-disc={activeWorkspaceId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        style={chipStyle}
      >
        <span>{activeWorkspace.label}</span>
        <Icons.disclosureOpen
          size={12}
          aria-hidden="true"
          style={{ color: 'var(--color-muted-foreground)', flexShrink: 0 }}
        />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          style={menuStyle}
          ref={(el) => {
            const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
            const first = el?.querySelector<HTMLElement>(
              '[role="option"]:not([aria-disabled="true"])',
            );
            (active ?? first)?.focus();
          }}
          onKeyDown={(e) => {
            const options = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                '[role="option"]:not([aria-disabled="true"])',
              ),
            );
            const idx = options.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              options[(idx + 1) % options.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              options[(idx - 1 + options.length) % options.length]?.focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              (document.activeElement as HTMLElement | null)?.click();
            }
          }}
        >
          {WORKSPACES.map((w) => (
            <WorkspaceRow
              key={w.id}
              workspace={w}
              isActive={w.id === activeWorkspaceId}
              onSelect={() => {
                onSetActiveWorkspace(w.id);
                setIsOpen(false);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkspaceRow({
  workspace,
  isActive,
  onSelect,
}: {
  workspace: WorkspaceDescriptor;
  isActive: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <li
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      data-testid={`workspace-option-${workspace.id}`}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        cursor: 'pointer',
        backgroundColor: isActive ? 'var(--color-surface-strong)' : 'transparent',
        fontSize: 'var(--text-sm)',
        lineHeight: 'var(--text-sm-line)',
        color: 'var(--color-foreground)',
        listStyle: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 'var(--radius-pill)',
          backgroundColor: workspace.discToken,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      <span style={{ flex: 1 }}>{workspace.label}</span>
      {isActive && (
        <Icons.check
          size={12}
          aria-hidden="true"
          style={{ color: 'var(--color-accent)', flexShrink: 0 }}
        />
      )}
    </li>
  );
}
