import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import type { WorkspaceId } from '../chrome/workspaces';
import type { CollaborationConflictQueueV1 } from '../../lib/collaborationConflictQueue';
import { DriftBadge } from './DriftBadge';

const TOOL_VERB: Record<string, string> = {
  wall: 'Drawing wall',
  door: 'Placing door',
  window: 'Placing window',
  floor: 'Sketching floor',
  roof: 'Sketching roof',
  stair: 'Sketching stair',
  railing: 'Placing railing',
  column: 'Placing column',
  beam: 'Placing beam',
  room: 'Bounding room',
  dimension: 'Annotating',
  section: 'Placing section',
  elevation: 'Placing elevation',
  callout: 'Placing callout',
  detail_region: 'Framing detail',
  annotation: 'Annotating',
  grid: 'Drawing grid',
  level: 'Setting level',
};

function toolVerb(label: string | null | undefined): string {
  if (!label) return '—';
  return TOOL_VERB[label.toLowerCase().replace(/\s+/g, '_')] ?? label;
}

/**
 * Snap-mode id → single-character glyph + accessibility title.
 * No snap-specific icons exist in @bim-ai/icons; use short glyphs with titles.
 */
const SNAP_GLYPH: Record<string, { glyph: string; title: string }> = {
  endpoint: { glyph: 'E', title: 'Endpoint snap' },
  midpoint: { glyph: 'M', title: 'Midpoint snap' },
  intersection: { glyph: 'I', title: 'Intersection snap' },
  grid: { glyph: 'G', title: 'Grid snap' },
  nearest: { glyph: 'N', title: 'Nearest snap' },
  perpendicular: { glyph: 'P', title: 'Perpendicular snap' },
  tangent: { glyph: 'T', title: 'Tangent snap' },
  center: { glyph: 'C', title: 'Center snap' },
  quadrant: { glyph: 'Q', title: 'Quadrant snap' },
};

function snapGlyph(id: string): { glyph: string; title: string } {
  return SNAP_GLYPH[id.toLowerCase()] ?? { glyph: id.slice(0, 1).toUpperCase(), title: id };
}

function fmtM(mm: number | null | undefined): string {
  if (mm == null) return '—';
  return `${(mm / 1000).toFixed(3)} m`;
}

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
export type AdvisorSeverityCounts = {
  error: number;
  warning: number;
  info: number;
};

export type JobsStatusCounts = {
  queued: number;
  running: number;
  errored: number;
};

export interface StatusBarProps {
  mode?: 'plan' | '3d' | 'plan-3d' | 'section' | 'sheet' | 'schedule' | 'agent' | 'concept';
  viewLabel?: string | null;
  viewDetails?: string[];
  level: { id: string; label: string; elevationMm?: number };
  levels?: { id: string; label: string; elevationMm?: number }[];
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
  redoDepth?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  wsState?: StatusWsState;
  saveState?: StatusSaveState;
  conflictQueue?: CollaborationConflictQueueV1 | null;
  onClearConflict?: () => void;
  /** LNS-V3-02 — active workspace discipline tint for the full-width stripe. */
  activeWorkspaceId?: WorkspaceId;
  /** CHR-V3-03 slot 6 — federation drift count; hidden when 0. */
  driftCount?: number;
  onDriftClick?: () => void;
  /** CHR-V3-05 slot 7 — activity-stream entry. */
  activityUnreadCount?: number;
  onActivityClick?: () => void;
  /** UX-WP-08 — global model-health advisor entry. */
  advisorCounts?: AdvisorSeverityCounts;
  onAdvisorClick?: () => void;
  jobsCounts?: JobsStatusCounts;
  onJobsClick?: () => void;
  selectionCount?: number;
}

export function StatusBar({
  mode = 'plan',
  viewLabel,
  viewDetails = [],
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
  redoDepth,
  onUndo,
  onRedo,
  wsState = 'connected',
  saveState = 'saved',
  conflictQueue,
  onClearConflict,
  activeWorkspaceId = 'arch',
  driftCount = 0,
  onDriftClick,
  activityUnreadCount = 0,
  onActivityClick,
  advisorCounts,
  onAdvisorClick,
  jobsCounts,
  onJobsClick,
  selectionCount = 0,
}: StatusBarProps): JSX.Element {
  const showPlanClusters = mode === 'plan' || mode === 'plan-3d' || mode === 'section';
  return (
    <div
      data-testid="status-bar"
      role="contentinfo"
      style={{ ...statusStyle, ...disciplineStripeStyle(activeWorkspaceId) }}
      className="relative flex w-full items-center gap-2 overflow-hidden whitespace-nowrap border-t border-border bg-surface px-2 text-[11px] text-muted sm:px-4"
    >
      <div
        data-testid="status-bar-context-cluster"
        className="hidden min-w-0 items-center gap-2 overflow-hidden md:flex"
      >
        {showPlanClusters ? (
          <>
            <ToolCluster toolLabel={toolLabel ?? null} />
            <Divider />
            <SnapCluster snapModes={snapModes} onSnapToggle={onSnapToggle} />
            <Divider />
            <GridCluster gridOn={gridOn} onGridToggle={onGridToggle} />
            <Divider />
            <CoordCluster cursorMm={cursorMm ?? null} />
          </>
        ) : (
          <ViewModeCluster mode={mode} viewLabel={viewLabel ?? null} viewDetails={viewDetails} />
        )}
      </div>
      <div
        data-testid="status-bar-priority-cluster"
        className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-3"
      >
        {selectionCount > 0 ? (
          <>
            <SelectionEntry count={selectionCount} />
            <Divider />
          </>
        ) : null}
        {conflictQueue ? (
          <>
            <ConflictSlot queue={conflictQueue} onClear={onClearConflict} />
            <Divider />
          </>
        ) : null}
        <div className="hidden items-center gap-3 sm:flex">
          <UndoCluster
            undoDepth={undoDepth ?? 0}
            redoDepth={redoDepth ?? 0}
            onUndo={onUndo}
            onRedo={onRedo}
          />
          <Divider />
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <WsCluster state={wsState} />
          <Divider />
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <SaveCluster state={saveState} />
          <Divider />
        </div>
        {/* Slot 6 — drift badge; hidden when driftCount = 0 */}
        {driftCount > 0 ? (
          <div className="hidden items-center gap-3 md:flex">
            <Divider />
            <DriftBadge driftCount={driftCount} onClick={onDriftClick ?? (() => {})} />
          </div>
        ) : null}
        <AdvisorEntry
          counts={advisorCounts ?? { error: 0, warning: 0, info: 0 }}
          onClick={onAdvisorClick}
        />
        <Divider />
        <JobsEntry
          counts={jobsCounts ?? { queued: 0, running: 0, errored: 0 }}
          onClick={onJobsClick}
        />
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

function disciplineStripeStyle(id: WorkspaceId): CSSProperties {
  const token =
    id === 'struct'
      ? 'var(--disc-struct)'
      : id === 'mep'
        ? 'var(--disc-mep)'
        : id === 'concept'
          ? 'var(--color-accent)'
          : 'var(--disc-arch)';
  return {
    borderTop: `2px solid ${token}`,
  };
}

function Divider(): JSX.Element {
  return <span aria-hidden="true" className="inline-block h-3 w-px bg-border" />;
}

function ViewModeCluster({
  mode,
  viewLabel,
  viewDetails,
}: {
  mode: NonNullable<StatusBarProps['mode']>;
  viewLabel: string | null;
  viewDetails: string[];
}): JSX.Element {
  return (
    <div
      data-testid="statusbar-view-mode"
      className="flex min-w-0 items-center gap-1.5"
      title={[formatStatusMode(mode), viewLabel, ...viewDetails].filter(Boolean).join(' · ')}
    >
      <span className="text-muted">View</span>
      <span className="font-medium text-foreground">{formatStatusMode(mode)}</span>
      {viewLabel ? (
        <>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span className="max-w-64 truncate font-medium text-foreground">{viewLabel}</span>
        </>
      ) : null}
      {viewDetails.slice(0, 4).map((detail) => (
        <span
          key={detail}
          className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted"
        >
          {detail}
        </span>
      ))}
    </div>
  );
}

function formatStatusMode(mode: NonNullable<StatusBarProps['mode']>): string {
  switch (mode) {
    case 'plan':
      return 'Plan';
    case '3d':
      return '3D';
    case 'plan-3d':
      return 'Plan + 3D';
    case 'section':
      return 'Section';
    case 'sheet':
      return 'Sheet';
    case 'schedule':
      return 'Schedule';
    case 'agent':
      return 'Agent Review';
    case 'concept':
      return 'Concept';
  }
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
              title={t('statusbar.conflict.dismissAriaLabel')}
              className="rounded-sm px-1 py-0.5 text-muted hover:bg-surface-strong"
            >
              <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
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

function fmtElevation(elevationMm: number | undefined): string | null {
  if (elevationMm == null) return null;
  const m = elevationMm / 1000;
  if (elevationMm === 0) return `±0.000 m`;
  if (elevationMm > 0) return `+${m.toFixed(3)} m`;
  return `−${Math.abs(m).toFixed(3)} m`;
}

function LevelCluster({
  level,
  levels,
  onLevelChange,
}: {
  level: { id: string; label: string; elevationMm?: number };
  levels: { id: string; label: string; elevationMm?: number }[];
  onLevelChange?: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const close = useCallback(() => setOpen(false), []);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!open) return;
        event.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        );
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        items[(idx + delta + items.length) % items.length]?.focus();
      } else if (event.key === 'Escape') {
        close();
      }
    },
    [close, level.id, levels, onLevelChange, open],
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
        {fmtElevation(level.elevationMm) != null ? (
          <>
            <span className="mx-1 opacity-40">|</span>
            <span
              data-testid="statusbar-level-elevation"
              className="text-[10px] text-muted opacity-70"
            >
              {fmtElevation(level.elevationMm)}
            </span>
          </>
        ) : null}
        <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" className="ml-1 inline" />
      </button>
      {open ? (
        <div
          id={popoverId}
          role="menu"
          aria-label={t('statusbar.levels')}
          className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-md border border-border bg-surface text-sm shadow-elev-2"
          ref={(el) => {
            menuRef.current = el;
            const active = el?.querySelector<HTMLElement>('[aria-current="true"]');
            const first = el?.querySelector<HTMLElement>('[role="menuitem"]');
            (active ?? first)?.focus();
          }}
        >
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitem"
              aria-current={l.id === level.id ? 'true' : undefined}
              onClick={() => {
                onLevelChange?.(l.id);
                close();
              }}
              className={[
                'flex w-full items-center justify-between px-3 py-1.5 text-left',
                l.id === level.id ? 'bg-accent-soft text-foreground' : 'hover:bg-surface-strong',
              ].join(' ')}
            >
              <span className="flex items-center gap-1.5">
                {l.label}
                {fmtElevation(l.elevationMm) != null ? (
                  <span className="text-[10px] text-muted opacity-70">
                    {fmtElevation(l.elevationMm)}
                  </span>
                ) : null}
              </span>
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
      <span className="font-medium text-foreground">{toolVerb(toolLabel)}</span>
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
      <Icons.snap size={ICON_SIZE.chrome} aria-hidden="true" className="text-muted opacity-60" />
      <div role="group" aria-label={t('statusbar.snapModes')} className="flex items-center gap-0.5">
        {snapModes.length === 0 ? (
          <span className="text-muted">{t('statusbar.snapOff')}</span>
        ) : (
          snapModes.map((s) => {
            const { glyph, title } = snapGlyph(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="switch"
                aria-checked={s.on}
                onClick={() => onSnapToggle?.(s.id)}
                data-active={s.on ? 'true' : 'false'}
                title={`${title} (${s.on ? 'on' : 'off'})`}
                className={[
                  'rounded-sm px-1 py-0.5 font-mono text-[10px]',
                  s.on ? 'bg-accent-soft text-foreground' : 'text-muted hover:bg-surface-strong',
                ].join(' ')}
              >
                {glyph}
              </button>
            );
          })
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
      className={[
        'flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-strong',
        gridOn ? '' : 'opacity-40',
      ].join(' ')}
    >
      <Icons.grid size={ICON_SIZE.chrome} aria-hidden="true" />
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
      {cursorMm ? `X ${fmtM(cursorMm.xMm)}   Y ${fmtM(cursorMm.yMm)}` : 'X —   Y —'}
    </div>
  );
}

function UndoCluster({
  undoDepth,
  redoDepth,
  onUndo,
  onRedo,
}: {
  undoDepth: number;
  redoDepth: number;
  onUndo?: () => void;
  onRedo?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUndo}
        disabled={undoDepth <= 0}
        title={t('statusbar.undoTitle')}
        aria-label={t('statusbar.undoLabel')}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icons.undo size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
      <span className="text-muted">{undoDepth}</span>
      <button
        type="button"
        onClick={onRedo}
        disabled={redoDepth <= 0}
        title={t('statusbar.redoTitle')}
        aria-label={t('statusbar.redoLabel')}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
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
      {state !== 'connected' ? <span style={{ color }}>{label}</span> : null}
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

function AdvisorEntry({
  counts,
  onClick,
}: {
  counts: AdvisorSeverityCounts;
  onClick?: () => void;
}): JSX.Element {
  const total = counts.error + counts.warning + counts.info;
  const primary =
    counts.error > 0
      ? `${counts.error} error${counts.error === 1 ? '' : 's'}`
      : counts.warning > 0
        ? `${counts.warning} warning${counts.warning === 1 ? '' : 's'}`
        : counts.info > 0
          ? `${counts.info} info`
          : 'No findings';
  const title =
    total > 0
      ? `Advisor: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} info`
      : 'Advisor: no findings';

  return (
    <button
      type="button"
      data-testid="status-bar-advisor-entry"
      aria-label={title}
      title={title}
      onClick={onClick}
      className={[
        'status-bar__slot relative flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-strong',
        counts.error > 0 ? 'text-danger' : counts.warning > 0 ? 'text-warning' : 'text-muted',
      ].join(' ')}
    >
      <Icons.advisorWarning size={ICON_SIZE.chrome} aria-hidden="true" />
      <span>{primary}</span>
      {total > 0 ? (
        <span
          data-testid="status-bar-advisor-badge"
          className="rounded-sm bg-surface-strong px-1 font-mono text-[10px] text-foreground"
        >
          {total}
        </span>
      ) : null}
    </button>
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

function JobsEntry({
  counts,
  onClick,
}: {
  counts: JobsStatusCounts;
  onClick?: () => void;
}): JSX.Element {
  const active = counts.queued + counts.running;
  const totalAttention = active + counts.errored;
  const label =
    counts.errored > 0 ? `${counts.errored} failed` : active > 0 ? `${active} active` : 'Idle';
  const title = `Jobs: ${counts.running} running, ${counts.queued} queued, ${counts.errored} failed`;

  return (
    <button
      type="button"
      data-testid="status-bar-jobs-entry"
      aria-label={title}
      title={title}
      onClick={onClick}
      className={[
        'status-bar__slot relative flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-strong',
        counts.errored > 0 ? 'text-danger' : active > 0 ? 'text-warning' : 'text-muted',
      ].join(' ')}
    >
      <Icons.evidence size={ICON_SIZE.chrome} aria-hidden="true" />
      <span>Jobs {label}</span>
      {totalAttention > 0 ? (
        <span
          data-testid="status-bar-jobs-badge"
          className="rounded-sm bg-surface-strong px-1 font-mono text-[10px] text-foreground"
        >
          {totalAttention}
        </span>
      ) : null}
    </button>
  );
}

function SelectionEntry({ count }: { count: number }): JSX.Element {
  const noun = count === 1 ? 'selected' : 'selected';
  return (
    <div
      data-testid="status-bar-selection-count"
      title={`Selection count: ${count}`}
      className="hidden items-center text-muted md:flex"
    >
      {count} {noun}
    </div>
  );
}

export type { ReactNode };
