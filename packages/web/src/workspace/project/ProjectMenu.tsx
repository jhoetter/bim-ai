import { type JSX, useEffect, useRef, useState } from 'react';
import { ICON_SIZE, Icons } from '@bim-ai/ui';
import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
  MAX_CHECKPOINT_RETENTION_LIMIT,
  MIN_CHECKPOINT_RETENTION_LIMIT,
} from '../../state/backupRetention';

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
  saveAsMaximumBackups?: number;
  onSaveAsMaximumBackupsChange?: (maximumBackups: number) => void;
  onRestoreSnapshot?: (file: File) => void;
  onNewClear?: () => void;
  /** Replay the onboarding tour from the beginning (spec §24). */
  onReplayTour?: () => void;
  /** FED-01: open the Manage Links dialog (Insert → Link Model). */
  onManageLinks?: () => void;
  /** FED-04: import an IFC file as a shadow-model link. */
  onLinkIfc?: (file: File) => void;
  /** FED-04: import a DXF site plan as a `link_dxf` underlay element. */
  onLinkDxf?: (file: File) => void;
}

export function ProjectMenu({
  open,
  onOpenChange,
  anchorRef,
  recent,
  onPickRecent,
  onInsertSeed,
  onSaveSnapshot,
  saveAsMaximumBackups,
  onSaveAsMaximumBackupsChange,
  onRestoreSnapshot,
  onNewClear,
  onReplayTour,
  onManageLinks,
  onLinkIfc,
  onLinkDxf,
}: ProjectMenuProps): JSX.Element | null {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ifcInputRef = useRef<HTMLInputElement | null>(null);
  const dxfInputRef = useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [saveAsOptionsOpen, setSaveAsOptionsOpen] = useState(false);
  const [maximumBackupsDraft, setMaximumBackupsDraft] = useState(
    String(coerceCheckpointRetentionLimit(saveAsMaximumBackups)),
  );

  // Position the popover under the anchor.
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ left: rect.left, top: rect.bottom + 4 });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) {
      setSaveAsOptionsOpen(false);
      return;
    }
    setMaximumBackupsDraft(String(coerceCheckpointRetentionLimit(saveAsMaximumBackups)));
  }, [open, saveAsMaximumBackups]);

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

  // Auto-focus first enabled menu item on open.
  useEffect(() => {
    if (!pos) return;
    const first = popoverRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])',
    );
    first?.focus();
  }, [pos]);

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
      onKeyDown={(e) => {
        const items = Array.from(
          popoverRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ??
            [],
        );
        const idx = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
        }
      }}
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
          label="Save As Options…"
          icon="settings"
          testId="project-menu-save-as-options"
          onClick={() => {
            setSaveAsOptionsOpen((value) => !value);
          }}
        />
        {saveAsOptionsOpen ? (
          <li className="border-y border-border bg-surface-strong px-3 py-2">
            <label className="flex flex-col gap-1 text-xs text-foreground">
              <span>Maximum backups</span>
              <input
                aria-label="Maximum backups"
                data-testid="project-menu-maximum-backups"
                type="number"
                min={MIN_CHECKPOINT_RETENTION_LIMIT}
                max={MAX_CHECKPOINT_RETENTION_LIMIT}
                step={1}
                value={maximumBackupsDraft}
                onChange={(e) => setMaximumBackupsDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted">
                Applies to retained snapshots and rolling export slots.
              </span>
              <button
                type="button"
                role="menuitem"
                data-testid="project-menu-save-as-options-apply"
                className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface"
                onClick={() => {
                  const next = coerceCheckpointRetentionLimit(maximumBackupsDraft);
                  setMaximumBackupsDraft(String(next));
                  onSaveAsMaximumBackupsChange?.(next);
                  setSaveAsOptionsOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </li>
        ) : null}
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
        {onManageLinks ? (
          <>
            <div className="my-1 border-t border-border" />
            <MenuItem
              label="Insert → Link Model…"
              icon="externalLink"
              testId="project-menu-manage-links"
              onClick={() => {
                onOpenChange(false);
                onManageLinks();
              }}
            />
          </>
        ) : null}
        {onLinkIfc ? (
          <>
            <MenuItem
              label="Insert → Link IFC…"
              icon="externalLink"
              testId="project-menu-link-ifc"
              onClick={() => {
                ifcInputRef.current?.click();
              }}
            />
            <input
              ref={ifcInputRef}
              type="file"
              accept=".ifc,application/x-step,application/octet-stream"
              style={{ display: 'none' }}
              data-testid="project-menu-ifc-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLinkIfc(f);
                onOpenChange(false);
                e.target.value = '';
              }}
            />
            {onLinkDxf ? (
              <>
                <MenuItem
                  label="Insert → Link DXF…"
                  icon="externalLink"
                  testId="project-menu-link-dxf"
                  onClick={() => {
                    dxfInputRef.current?.click();
                  }}
                />
                <input
                  ref={dxfInputRef}
                  type="file"
                  accept=".dxf,application/dxf,application/octet-stream"
                  style={{ display: 'none' }}
                  data-testid="project-menu-dxf-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onLinkDxf(f);
                    onOpenChange(false);
                    e.target.value = '';
                  }}
                />
              </>
            ) : (
              <MenuItem
                label="Insert → Link DXF (deferred)"
                icon="externalLink"
                testId="project-menu-link-dxf"
                disabled
                tooltip="DXF underlay import is on the roadmap. Today, link a bim-ai shadow model directly via Insert → Link Model… instead."
                onClick={() => {
                  /* disabled */
                }}
              />
            )}
            <MenuItem
              label="Insert → Link Revit (deferred)"
              icon="externalLink"
              testId="project-menu-link-revit"
              disabled
              tooltip="Revit (.rvt) is out of scope until OpenBIM/Forge stabilises. Customers can pre-convert to IFC and use Insert → Link IFC."
              onClick={() => {
                /* disabled */
              }}
            />
          </>
        ) : null}
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
        {onReplayTour ? (
          <>
            <div className="my-1 border-t border-border" />
            <MenuItem
              label="Replay onboarding tour"
              icon="agent"
              testId="project-menu-replay-tour"
              onClick={() => {
                onOpenChange(false);
                onReplayTour();
              }}
            />
          </>
        ) : null}
      </ul>
    </div>
  );
}

function MenuItem({
  label,
  icon,
  testId,
  onClick,
  disabled,
  tooltip,
}: {
  label: string;
  icon: keyof typeof Icons;
  testId: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}): JSX.Element {
  const Icon = Icons[icon];
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        data-testid={testId}
        disabled={disabled}
        title={tooltip}
        className={[
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
          disabled
            ? 'text-muted opacity-60 cursor-not-allowed'
            : 'text-foreground hover:bg-surface-strong',
        ].join(' ')}
      >
        {Icon ? <Icon size={ICON_SIZE.chrome} aria-hidden="true" /> : null}
        <span>{label}</span>
      </button>
    </li>
  );
}
