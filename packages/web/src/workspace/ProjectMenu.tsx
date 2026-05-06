import { type JSX, useEffect, useRef, useState } from 'react';
import { ICON_SIZE, Icons } from '@bim-ai/ui';

/**
 * Project-name dropdown — spec §11.1, T-03.
 *
 * Anchored under the project-name pill in TopBar. Items:
 *   - Recent projects (last 5, from localStorage)
 *   - Insert seed house (re-runs the bootstrap)
 *   - Save snapshot to disk (downloads the current store as JSON)
 *   - Restore snapshot from disk (file picker → onRestore)
 *   - New (clear) — wipes the current store
 *
 * The component is presentational: callers wire each item to a real
 * handler. Click-outside + Escape close the menu.
 */

export interface ProjectMenuItemRecent {
  id: string;
  label: string;
}

export interface ProjectMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anchor element for positioning. */
  anchorRef: React.RefObject<HTMLElement | null>;
  recent?: ProjectMenuItemRecent[];
  onPickRecent?: (id: string) => void;
  onInsertSeed?: () => void;
  onSaveSnapshot?: () => void;
  onRestoreSnapshot?: (file: File) => void;
  onNewClear?: () => void;
}

export function ProjectMenu({
  open,
  onOpenChange,
  anchorRef,
  recent,
  onPickRecent,
  onInsertSeed,
  onSaveSnapshot,
  onRestoreSnapshot,
  onNewClear,
}: ProjectMenuProps): JSX.Element | null {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Position the popover under the anchor.
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ left: rect.left, top: rect.bottom + 4 });
  }, [open, anchorRef]);

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange, anchorRef]);

  if (!open || !pos) return null;

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Project menu"
      data-testid="project-menu"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 50,
        minWidth: 240,
      }}
      className="rounded-md border border-border bg-surface shadow-elev-3"
    >
      {recent && recent.length > 0 ? (
        <>
          <div
            className="px-3 pb-1 pt-2 text-[10px] uppercase text-muted"
            style={{ letterSpacing: '0.06em' }}
          >
            Recent
          </div>
          <ul className="flex flex-col">
            {recent.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenChange(false);
                    onPickRecent?.(p.id);
                  }}
                  data-testid={`project-menu-recent-${p.id}`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
                >
                  <Icons.evidence size={ICON_SIZE.chrome} aria-hidden="true" />
                  <span className="truncate">{p.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1 border-t border-border" />
        </>
      ) : null}
      <ul className="flex flex-col">
        <MenuItem
          label="Insert seed house"
          icon="agent"
          testId="project-menu-insert-seed"
          onClick={() => {
            onOpenChange(false);
            onInsertSeed?.();
          }}
        />
        <MenuItem
          label="Save snapshot to disk"
          icon="evidence"
          testId="project-menu-save-snapshot"
          onClick={() => {
            onOpenChange(false);
            onSaveSnapshot?.();
          }}
        />
        <MenuItem
          label="Open snapshot from disk…"
          icon="externalLink"
          testId="project-menu-open-snapshot"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          data-testid="project-menu-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onRestoreSnapshot) onRestoreSnapshot(f);
            onOpenChange(false);
            e.target.value = '';
          }}
        />
        <div className="my-1 border-t border-border" />
        <MenuItem
          label="New (clear)"
          icon="close"
          testId="project-menu-new-clear"
          onClick={() => {
            onOpenChange(false);
            onNewClear?.();
          }}
        />
      </ul>
    </div>
  );
}

function MenuItem({
  label,
  icon,
  testId,
  onClick,
}: {
  label: string;
  icon: keyof typeof Icons;
  testId: string;
  onClick: () => void;
}): JSX.Element {
  const Icon = Icons[icon];
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        data-testid={testId}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
      >
        {Icon ? <Icon size={ICON_SIZE.chrome} aria-hidden="true" /> : null}
        <span>{label}</span>
      </button>
    </li>
  );
}
