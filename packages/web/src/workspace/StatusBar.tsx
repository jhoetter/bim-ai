import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import type { CollaborationConflictQueueV1 } from '../lib/collaborationConflictQueue';

/**
 * StatusBar — spec §17.
 *
 * 28 px tall surface bar, bottom-of-shell. Shows clusters from left to
 * right: active level, current tool, snap mode group, grid toggle, model
 * coordinates, undo depth, ws connection, save state.
 *
 * - Coordinates use `aria-live="polite"` so screen-readers can announce
 *   changes without interrupting.
 * - The save-state pill uses `aria-live="polite"` too.
 * - Errors / red-alert states (offline, save failed) use
 *   `aria-live="assertive"`.
 * - Every cluster has a tooltip via `title` and a hotkey hint where the
 *   spec specifies one (`F3` for snap cycle, `F7` for grid).
 */

export type StatusSaveState = 'saved' | 'saving' | 'unsynced' | 'error';
export type StatusWsState = 'connected' | 'reconnecting' | 'offline';

export interface StatusBarProps {
  level: { id: string; label: string };
  levels?: { id: string; label: string }[];
  onLevelChange?: (id: string) => void;
  toolLabel?: string | null;
  /** Snap mode group; toggling individual snaps lives here. */
  snapModes?: { id: string; label: string; on: boolean }[];
  onSnapToggle?: (id: string) => void;
  gridOn?: boolean;
  onGridToggle?: () => void;
  /** Live cursor model coords, in mm; null when off-canvas. */
  cursorMm?: { xMm: number; yMm: number } | null;
  /** Undo depth; clicking the cluster invokes undo / redo. */
  undoDepth?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  wsState?: StatusWsState;
  saveState?: StatusSaveState;
  conflictQueue?: CollaborationConflictQueueV1 | null;
  onClearConflict?: () => void;
}

export function StatusBar({
  level,
  levels = [],
  onLevelChange,
  toolLabel,
  snapModes = [],
  onSnapToggle,
  gridOn = true,
  onGridToggle,
  cursorMm,
  undoDepth,
  onUndo,
  onRedo,
  wsState = 'connected',
  saveState = 'saved',
  conflictQueue,
  onClearConflict,
}: StatusBarProps): JSX.Element {
  return (
    <div
      data-testid="status-bar"
      role="contentinfo"
      style={statusStyle}
      className="relative flex w-full items-center gap-3 border-t border-border bg-surface px-4 text-xs"
    >
      <LevelCluster level={level} levels={levels} onLevelChange={onLevelChange} />
      <Divider />
      <ToolCluster toolLabel={toolLabel ?? null} />
      <Divider />
      <SnapCluster snapModes={snapModes} onSnapToggle={onSnapToggle} />
      <Divider />
      <GridCluster gridOn={gridOn} onGridToggle={onGridToggle} />
      <Divider />
      <CoordCluster cursorMm={cursorMm ?? null} />
      <div className="ml-auto flex items-center gap-3">
        {conflictQueue ? (
          <>
            <ConflictSlot queue={conflictQueue} onClear={onClearConflict} />
            <Divider />
          </>
        ) : null}
        <UndoCluster depth={undoDepth ?? 0} onUndo={onUndo} onRedo={onRedo} />
        <Divider />
        <WsCluster state={wsState} />
        <Divider />
        <SaveCluster state={saveState} />
      </div>
    </div>
  );
}

const statusStyle: CSSProperties = {
  height: 'var(--shell-statusbar-height)',
  minHeight: 'var(--shell-statusbar-height)',
};

function Divider(): JSX.Element {
  return <span aria-hidden="true" className="inline-block h-3 w-px bg-border" />;
}

const RETRY_LABELS: Record<string, string> = {
  safe: 'safe retry',
  blocked: 'blocked',
  requires_manual_edit: 'manual edit',
};

function ConflictSlot({
  queue,
  onClear,
}: {
  queue: CollaborationConflictQueueV1;
  onClear?: () => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const retryLabel = RETRY_LABELS[queue.retryAdvice] ?? queue.retryAdvice;
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-expanded={expanded}
        data-testid="conflict-pill"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
        title="Collaboration conflict — click to expand"
      >
        <Icons.advisorWarning size={ICON_SIZE.chrome} aria-hidden="true" />
        <span>Conflict</span>
        <span className="rounded bg-amber-100 px-1 py-px text-[9px] dark:bg-amber-900/40">
          {retryLabel}
        </span>
      </button>
      {expanded ? (
        <div
          data-testid="collaboration-conflict-queue-readout"
          role="dialog"
          aria-label="Collaboration conflict details"
          className="absolute bottom-full right-0 z-50 mb-1 w-96 rounded border border-amber-500/40 bg-surface px-3 py-2 text-[10px] shadow-elev-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              Collaboration conflict
            </span>
            <button
              type="button"
              aria-label="Dismiss conflict"
              data-testid="conflict-dismiss"
              onClick={() => {
                setExpanded(false);
                onClear?.();
              }}
              className="rounded-sm px-1 py-0.5 text-muted hover:bg-surface-strong"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-foreground">{queue.inspectionReadout}</p>
          {queue.inspectionReadoutSecondary ? (
            <p className="mt-0.5 text-muted">{queue.inspectionReadoutSecondary}</p>
          ) : null}
          {queue.mergePreflightReadout ? (
            <p className="mt-0.5 text-muted">{queue.mergePreflightReadout}</p>
          ) : null}
          <ul className="mt-1 list-disc space-y-0.5 ps-4 text-muted">
            <li>
              Retry advice: <code className="font-mono text-[9px]">{queue.retryAdvice}</code>
              {queue.reason ? (
                <>
                  {' · '}reason <code className="font-mono text-[9px]">{queue.reason}</code>
                </>
              ) : null}
            </li>
            {queue.rows.length > 0 ? (
              <li>
                {queue.rows.length} blocking row(s) · rules{' '}
                <code className="text-[9px]">{queue.rows.map((r) => r.ruleId).join(', ')}</code>
              </li>
            ) : null}
            {queue.firstBlockingCommandStep1Based !== null ? (
              <li>
                Blocking command step {queue.firstBlockingCommandStep1Based}
                {queue.blockingCommandType ? ` (${queue.blockingCommandType})` : ''}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LevelCluster({
  level,
  levels,
  onLevelChange,
}: {
  level: { id: string; label: string };
  levels: { id: string; label: string }[];
  onLevelChange?: (id: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const close = useCallback(() => setOpen(false), []);
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'PageDown' || event.key === 'PageUp') {
        if (!levels.length) return;
        const idx = levels.findIndex((l) => l.id === level.id);
        if (idx < 0) return;
        const delta = event.key === 'PageDown' ? 1 : -1;
        const next = levels[(idx + delta + levels.length) % levels.length];
        event.preventDefault();
        onLevelChange?.(next.id);
      } else if (event.key === 'Escape') {
        close();
      }
    },
    [close, level.id, levels, onLevelChange],
  );

  return (
    <div onKeyDown={handleKey} className="relative flex items-center gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title="Active level — PageUp/PageDown to cycle"
        className="rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
      >
        Level: <span className="font-medium text-foreground">{level.label}</span>
        <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" className="ml-1 inline" />
      </button>
      {open ? (
        <div
          id={popoverId}
          role="menu"
          aria-label="Levels"
          className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-md border border-border bg-surface text-sm shadow-elev-2"
        >
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onLevelChange?.(l.id);
                close();
              }}
              className={[
                'flex w-full items-center justify-between px-3 py-1.5 text-left',
                l.id === level.id ? 'bg-accent-soft text-foreground' : 'hover:bg-surface-strong',
              ].join(' ')}
            >
              {l.label}
              {l.id === level.id ? <span className="text-xs text-muted">active</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolCluster({ toolLabel }: { toolLabel: string | null }): JSX.Element {
  return (
    <div aria-live="polite" className="flex items-center gap-1" title="Active tool">
      Tool: <span className="font-medium text-foreground">{toolLabel ?? '—'}</span>
    </div>
  );
}

function SnapCluster({
  snapModes,
  onSnapToggle,
}: {
  snapModes: { id: string; label: string; on: boolean }[];
  onSnapToggle?: (id: string) => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1" title="Snap modes — F3 to cycle">
      <Icons.snap size={ICON_SIZE.chrome} aria-hidden="true" className="text-muted" />
      <span>Snap:</span>
      <div role="group" aria-label="Snap modes" className="flex items-center gap-1">
        {snapModes.length === 0 ? (
          <span className="text-muted">off</span>
        ) : (
          snapModes.map((s) => (
            <button
              key={s.id}
              type="button"
              role="switch"
              aria-checked={s.on}
              onClick={() => onSnapToggle?.(s.id)}
              data-active={s.on ? 'true' : 'false'}
              className={[
                'rounded-sm px-1.5 py-0.5',
                s.on ? 'bg-accent-soft text-foreground' : 'text-muted hover:bg-surface-strong',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function GridCluster({
  gridOn,
  onGridToggle,
}: {
  gridOn: boolean;
  onGridToggle?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={gridOn}
      onClick={onGridToggle}
      title="Grid (F7)"
      className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
    >
      <Icons.grid size={ICON_SIZE.chrome} aria-hidden="true" />
      Grid: <span className="font-medium">{gridOn ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function CoordCluster({
  cursorMm,
}: {
  cursorMm: { xMm: number; yMm: number } | null;
}): JSX.Element {
  return (
    <div aria-live="polite" aria-label="Cursor coordinates" className="font-mono text-xs">
      {cursorMm
        ? `X ${(cursorMm.xMm / 1000).toFixed(2)} m   Y ${(cursorMm.yMm / 1000).toFixed(2)} m`
        : 'X —   Y —'}
    </div>
  );
}

function UndoCluster({
  depth,
  onUndo,
  onRedo,
}: {
  depth: number;
  onUndo?: () => void;
  onRedo?: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUndo}
        title="Undo (⌘Z)"
        aria-label="Undo"
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:bg-surface-strong"
      >
        <Icons.undo size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
      <span className="text-muted">{depth}</span>
      <button
        type="button"
        onClick={onRedo}
        title="Redo (⇧⌘Z)"
        aria-label="Redo"
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:bg-surface-strong"
      >
        <Icons.redo size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
    </div>
  );
}

function WsCluster({ state }: { state: StatusWsState }): JSX.Element {
  const palette: Record<StatusWsState, { color: string; label: string }> = {
    connected: { color: 'var(--color-success)', label: 'connected' },
    reconnecting: { color: 'var(--color-warning)', label: 'reconnecting' },
    offline: { color: 'var(--color-danger)', label: 'offline' },
  };
  const { color, label } = palette[state];
  return (
    <div
      aria-live={state === 'offline' ? 'assertive' : 'polite'}
      title={`Connection: ${label}`}
      className="flex items-center gap-1"
    >
      <Icons.online size={ICON_SIZE.chrome} aria-hidden="true" style={{ color }} />
      <span>ws:</span>
      <span style={{ color }}>{label}</span>
    </div>
  );
}

function SaveCluster({ state }: { state: StatusSaveState }): JSX.Element {
  const text: Record<StatusSaveState, string> = {
    saved: 'saved',
    saving: 'saving…',
    unsynced: 'unsynced',
    error: 'save failed',
  };
  return (
    <div
      aria-live={state === 'error' ? 'assertive' : 'polite'}
      title={`Save state: ${text[state]}`}
      className="font-medium"
      style={{
        color:
          state === 'error'
            ? 'var(--color-danger)'
            : state === 'unsynced'
              ? 'var(--color-warning)'
              : 'var(--color-foreground)',
      }}
    >
      {text[state]}
    </div>
  );
}

export type { ReactNode };
