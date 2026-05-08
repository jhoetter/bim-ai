import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import type { LensMode } from '@bim-ai/core';
import type { CollaborationConflictQueueV1 } from '../lib/collaborationConflictQueue';
import { LensDropdown } from './LensDropdown';
import { DriftBadge } from './DriftBadge';

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
  /** CHR-V3-03 slot 5 — lens discipline filter. */
  lensMode?: LensMode;
  onLensChange?: (lens: LensMode) => void;
  /** CHR-V3-03 slot 6 — federation drift count; hidden when 0. */
  driftCount?: number;
  onDriftClick?: () => void;
  /** CHR-V3-05 slot 7 — activity-stream entry. */
  activityUnreadCount?: number;
  onActivityClick?: () => void;
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
  lensMode = 'all',
  onLensChange,
  driftCount = 0,
  onDriftClick,
  activityUnreadCount = 0,
  onActivityClick,
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
        <Divider />
        {/* Slot 5 — lens dropdown (CHR-V3-03 keystone, A8 antidote) */}
        <LensDropdown currentLens={lensMode} onLensChange={onLensChange ?? (() => {})} />
        {/* Slot 6 — drift badge; hidden when driftCount = 0 */}
        {driftCount > 0 ? (
          <>
            <Divider />
            <DriftBadge driftCount={driftCount} onClick={onDriftClick ?? (() => {})} />
          </>
        ) : null}
        {/* Slot 7 — CHR-V3-05 activity-stream entry */}
        <Divider />
        <ActivityEntry count={activityUnreadCount} onClick={onActivityClick} />
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

function ConflictSlot({
  queue,
  onClear,
}: {
  queue: CollaborationConflictQueueV1;
  onClear?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const retryLabels: Record<string, string> = {
    safe: t('statusbar.conflict.safeRetry'),
    blocked: t('statusbar.conflict.blocked'),
    requires_manual_edit: t('statusbar.conflict.manualEdit'),
  };
  const retryLabel = retryLabels[queue.retryAdvice] ?? queue.retryAdvice;
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-expanded={expanded}
        data-testid="conflict-pill"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
        title={t('statusbar.conflict.pill')}
      >
        <Icons.advisorWarning size={ICON_SIZE.chrome} aria-hidden="true" />
        <span>{t('statusbar.conflict.label')}</span>
        <span className="rounded bg-amber-100 px-1 py-px text-[9px] dark:bg-amber-900/40">
          {retryLabel}
        </span>
      </button>
      {expanded ? (
        <div
          data-testid="collaboration-conflict-queue-readout"
          role="dialog"
          aria-label={t('statusbar.conflict.dialogAriaLabel')}
          className="absolute bottom-full right-0 z-50 mb-1 w-96 rounded border border-amber-500/40 bg-surface px-3 py-2 text-[10px] shadow-elev-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {t('statusbar.conflict.heading')}
            </span>
            <button
              type="button"
              aria-label={t('statusbar.conflict.dismissAriaLabel')}
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
  const { t } = useTranslation();
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
        title={t('statusbar.levelTitle')}
        className="rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
      >
        {t('statusbar.levelLabel')}{' '}
        <span className="font-medium text-foreground">{level.label}</span>
        <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" className="ml-1 inline" />
      </button>
      {open ? (
        <div
          id={popoverId}
          role="menu"
          aria-label={t('statusbar.levels')}
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
              {l.id === level.id ? (
                <span className="text-xs text-muted">{t('statusbar.levelActive')}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolCluster({ toolLabel }: { toolLabel: string | null }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div aria-live="polite" className="flex items-center gap-1" title={t('statusbar.toolTitle')}>
      {t('statusbar.toolLabel')}{' '}
      <span className="font-medium text-foreground">{toolLabel ?? '—'}</span>
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
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1" title={t('statusbar.snapTitle')}>
      <Icons.snap size={ICON_SIZE.chrome} aria-hidden="true" className="text-muted" />
      <span>{t('statusbar.snapLabel')}</span>
      <div role="group" aria-label={t('statusbar.snapModes')} className="flex items-center gap-1">
        {snapModes.length === 0 ? (
          <span className="text-muted">{t('statusbar.snapOff')}</span>
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
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={gridOn}
      onClick={onGridToggle}
      title={t('statusbar.gridTitle')}
      className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
    >
      <Icons.grid size={ICON_SIZE.chrome} aria-hidden="true" />
      {t('statusbar.gridLabel')}{' '}
      <span className="font-medium">{gridOn ? t('statusbar.gridOn') : t('statusbar.gridOff')}</span>
    </button>
  );
}

function CoordCluster({
  cursorMm,
}: {
  cursorMm: { xMm: number; yMm: number } | null;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div aria-live="polite" aria-label={t('statusbar.coordsLabel')} className="font-mono text-xs">
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
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUndo}
        title={t('statusbar.undoTitle')}
        aria-label={t('statusbar.undoLabel')}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:bg-surface-strong"
      >
        <Icons.undo size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
      <span className="text-muted">{depth}</span>
      <button
        type="button"
        onClick={onRedo}
        title={t('statusbar.redoTitle')}
        aria-label={t('statusbar.redoLabel')}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:bg-surface-strong"
      >
        <Icons.redo size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
    </div>
  );
}

function WsCluster({ state }: { state: StatusWsState }): JSX.Element {
  const { t } = useTranslation();
  const wsColors: Record<StatusWsState, string> = {
    connected: 'var(--color-success)',
    reconnecting: 'var(--color-warning)',
    offline: 'var(--color-danger)',
  };
  const color = wsColors[state];
  const label = t(`statusbar.ws.${state}`);
  return (
    <div
      aria-live={state === 'offline' ? 'assertive' : 'polite'}
      title={t('statusbar.connection', { label })}
      className="flex items-center gap-1"
    >
      <Icons.online size={ICON_SIZE.chrome} aria-hidden="true" style={{ color }} />
      <span>{t('statusbar.wsLabel')}</span>
      <span style={{ color }}>{label}</span>
    </div>
  );
}

function SaveCluster({ state }: { state: StatusSaveState }): JSX.Element {
  const { t } = useTranslation();
  const label = t(`statusbar.save.${state}`);
  return (
    <div
      aria-live={state === 'error' ? 'assertive' : 'polite'}
      title={t('statusbar.save.title', { state: label })}
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
      {label}
    </div>
  );
}

function ActivityEntry({ count, onClick }: { count: number; onClick?: () => void }): JSX.Element {
  return (
    <button
      type="button"
      data-testid="status-bar-activity-entry"
      aria-label="Activity stream"
      title="Cmd+H"
      onClick={onClick}
      className="status-bar__slot status-bar__activity-entry relative flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
    >
      <Icons.collaborators size={ICON_SIZE.chrome} aria-hidden="true" />
      {count > 0 && (
        <span
          data-testid="status-bar-activity-badge"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            background: 'var(--color-accent)',
            color: 'var(--color-surface)',
            fontSize: 'var(--text-3xs)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export type { ReactNode };
