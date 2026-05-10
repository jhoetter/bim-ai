import { type JSX, useEffect, useMemo, useState } from 'react';
import type { Element } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import { ScheduleViewHifi } from '@bim-ai/icons';

import { SCHEDULE_DEFAULTS } from './modeSurfaces';
import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { useBimStore } from '../state/store';
import { SheetReviewSurface } from '../plan/SheetReviewSurface';
import { SheetCanvas, SectionPlaceholderPane } from './sheets';
import {
  buildScheduleTableModelV1,
  type ScheduleTableModelV1,
} from '../schedules/scheduleTableRenderer';
import { formatScheduleCell } from '../schedules/scheduleUtils';

/**
 * Mode-specific shells — spec §20.4 / §20.5 / §20.6 / §20.7.
 *
 * These render the canvas-region content for the four E-WPs. The
 * Workspace selects the right shell by `mode`. Each shell
 * pulls its data from `useBimStore` so each shell tracks live state.
 *
 * The shells are intentionally light: structural surfaces (Project
 * Browser, viewport mounts) and readout content from the seed-house
 * fixture; richer interactions (drag/resize, inline edit) follow with
 * the canvas drawing flow.
 */

function asArr<T extends Element['kind']>(
  elementsById: Record<string, Element>,
  k: T,
): Extract<Element, { kind: T }>[] {
  return (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: T }> => e.kind === k,
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Section / Elevation mode (§20.4)                                        */
/* ────────────────────────────────────────────────────────────────────── */

export function SectionModeShell({
  activeLevelLabel = '',
  modelId,
  onUpsertSemantic,
}: {
  activeLevelLabel?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}): JSX.Element {
  return (
    <div data-testid="section-mode-shell" className="h-full w-full overflow-auto">
      <SectionPlaceholderPane
        activeLevelLabel={activeLevelLabel}
        modelId={modelId}
        onUpsertSemantic={onUpsertSemantic}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Sheet mode (§20.5)                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export function SheetModeShell({
  elementsById,
  preferredSheetId,
  modelId,
  onUpsertSemantic,
}: {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}): JSX.Element {
  const evidenceFullBleed = new URLSearchParams(window.location.search).has('evidenceSheetFull');

  // Resolve the displayed sheet — mirrors SheetCanvas's own selection logic.
  const sheets = asArr(elementsById, 'sheet');
  const resolvedSheet =
    sheets.find((s) => s.id === preferredSheetId) ??
    [...sheets].sort((a, b) => a.name.localeCompare(b.name))[0];

  // MRK-V3-03: when a modelId is available and a sheet is selected, mount the
  // review surface which adds comment pins and review-mode toolbar on top of
  // the sheet canvas.
  if (modelId && resolvedSheet) {
    return (
      <div data-testid="sheet-mode-shell" className="h-full w-full overflow-hidden">
        <SheetReviewSurface
          sheetId={resolvedSheet.id}
          modelId={modelId}
          elementsById={elementsById}
          onUpsertSemantic={onUpsertSemantic}
        />
      </div>
    );
  }

  return (
    <div data-testid="sheet-mode-shell" className="h-full w-full overflow-auto bg-[#e5e5e5] p-6">
      <SheetCanvas
        elementsById={elementsById}
        preferredSheetId={preferredSheetId}
        modelId={modelId}
        evidenceFullBleed={evidenceFullBleed}
        onUpsertSemantic={onUpsertSemantic}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Schedule mode (§20.6)                                                    */
/* ────────────────────────────────────────────────────────────────────── */

export function ScheduleModeShell({
  elementsById,
  preferredScheduleId,
  modelId,
}: {
  elementsById: Record<string, Element>;
  preferredScheduleId?: string;
  modelId?: string;
}): JSX.Element {
  const schedules = asArr(elementsById, 'schedule');
  const [activeId, setActiveId] = useState<string | null>(
    preferredScheduleId ?? schedules[0]?.id ?? SCHEDULE_DEFAULTS.activeScheduleId,
  );
  const active = activeId ? elementsById[activeId] : undefined;

  useEffect(() => {
    if (preferredScheduleId && elementsById[preferredScheduleId]?.kind === 'schedule') {
      setActiveId(preferredScheduleId);
      return;
    }
    if (!activeId || elementsById[activeId]?.kind !== 'schedule') {
      setActiveId(schedules[0]?.id ?? null);
    }
  }, [activeId, elementsById, preferredScheduleId, schedules]);

  return (
    <div
      data-testid="schedule-mode-shell"
      className="grid h-full w-full"
      style={{ gridTemplateColumns: '220px 1fr' }}
    >
      <aside className="flex flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-2 py-3">
        <div
          className="px-1 text-xs uppercase text-muted"
          style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
        >
          Schedules
        </div>
        {schedules.length === 0 ? (
          <div className="px-1 py-3 text-center text-xs text-muted">
            <ScheduleViewHifi size={34} aria-hidden="true" className="mx-auto mb-1 text-accent" />
            <div className="font-medium text-foreground">No schedules yet</div>
            <p className="mt-0.5">Create a door, room, or window schedule from Project tools.</p>
          </div>
        ) : (
          schedules.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              data-active={activeId === s.id ? 'true' : 'false'}
              className={[
                'rounded-md px-2 py-1 text-left text-sm',
                activeId === s.id
                  ? 'bg-accent-soft text-foreground'
                  : 'text-foreground hover:bg-surface-strong',
              ].join(' ')}
            >
              {s.name}
            </button>
          ))
        )}
      </aside>
      <div className="overflow-auto bg-background p-3">
        {active && active.kind === 'schedule' ? (
          <ScheduleGrid schedule={active} modelId={modelId} />
        ) : (
          <PlaceholderCard
            title="Pick a schedule"
            body="Select a schedule on the left to inspect its rows."
            icon={Icons.schedule}
          />
        )}
      </div>
    </div>
  );
}

type ScheduleGridState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; payload: Record<string, unknown> }
  | { status: 'error'; message: string };

function ScheduleGrid({
  schedule,
  modelId,
}: {
  schedule: Extract<Element, { kind: 'schedule' }>;
  modelId?: string;
}): JSX.Element {
  const [state, setState] = useState<ScheduleGridState>({ status: 'idle' });

  useEffect(() => {
    if (!modelId) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    void (async () => {
      setState({ status: 'loading' });
      try {
        const mid = encodeURIComponent(modelId);
        const sid = encodeURIComponent(schedule.id);
        const res = await fetch(`/api/models/${mid}/schedules/${sid}/table`);
        const txt = await res.text();
        const payload = JSON.parse(txt) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(payload.detail ?? txt));
        if (!cancelled) setState({ status: 'ready', payload });
      } catch (error) {
        if (!cancelled)
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId, schedule.id]);

  const model = useMemo<ScheduleTableModelV1 | null>(() => {
    if (state.status !== 'ready') return null;
    return buildScheduleTableModelV1({ payload: state.payload });
  }, [state]);

  const category =
    state.status === 'ready'
      ? String(state.payload.category ?? '').trim()
      : String((schedule.filters as Record<string, unknown> | undefined)?.category ?? '').trim();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-md font-medium text-foreground">{schedule.name}</div>
        <div className="text-xs text-muted">
          Schedule id · <span className="font-mono">{schedule.id}</span>
          {category ? (
            <>
              {' '}
              · <span>{category}</span>
            </>
          ) : null}
        </div>
      </div>
      {state.status === 'idle' ? (
        <div className="rounded border border-border bg-surface px-3 py-2 text-sm text-muted">
          Open a saved model to derive schedule rows.
        </div>
      ) : state.status === 'loading' ? (
        <div className="rounded border border-border bg-surface px-3 py-2 text-sm text-muted">
          Loading schedule rows…
        </div>
      ) : state.status === 'error' ? (
        <div
          role="alert"
          className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
        >
          {state.message}
        </div>
      ) : model ? (
        <DerivedScheduleTable scheduleName={schedule.name} model={model} />
      ) : null}
    </div>
  );
}

function DerivedScheduleTable({
  scheduleName,
  model,
}: {
  scheduleName: string;
  model: ScheduleTableModelV1;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs text-muted">
        {model.leafRowCount} row{model.leafRowCount === 1 ? '' : 's'}
        {model.groupCount ? ` · ${model.groupCount} group${model.groupCount === 1 ? '' : 's'}` : ''}
      </div>
      <div className="max-h-[min(520px,calc(100vh-210px))] overflow-auto border border-border bg-surface">
        <table
          className="w-full min-w-max border-collapse text-sm"
          aria-label={`${scheduleName} grid`}
        >
          <thead>
            <tr className="text-xs uppercase text-muted">
              {model.columns.map((column) => (
                <th
                  key={column.key}
                  className="sticky top-0 border-b border-border bg-surface px-2 py-1.5 text-left"
                  style={{ minWidth: column.displayWidthHintPx }}
                >
                  {column.headerLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.bodyRows.length ? (
              model.bodyRows.map((row) =>
                row.kind === 'groupHeader' ? (
                  <tr key={row.id} className="bg-accent/10">
                    <td
                      className="px-2 py-1 text-xs font-semibold text-muted"
                      colSpan={model.columns.length}
                    >
                      {row.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="border-t border-border/60">
                    {model.columns.map((column) => (
                      <td key={`${row.id}-${column.key}`} className="px-2 py-1.5 align-top">
                        {formatScheduleCell(row.record[column.key])}
                      </td>
                    ))}
                  </tr>
                ),
              )
            ) : (
              <tr>
                <td className="px-2 py-3 text-muted" colSpan={Math.max(1, model.columns.length)}>
                  No rows match this schedule.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {model.footerParts.length ? (
        <div className="mt-2 rounded border border-border/60 px-2 py-1 font-mono text-[10px] text-muted">
          {model.footerParts.join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Agent Review mode (§20.7)                                                */
/* ────────────────────────────────────────────────────────────────────── */

export function AgentReviewModeShell({
  onApplyQuickFix,
}: {
  onApplyQuickFix: (cmd: Record<string, unknown>) => void;
}): JSX.Element {
  const violations = useBimStore((s) => s.violations);
  const selectedId = useBimStore((s) => s.selectedId);
  const buildingPreset = useBimStore((s) => s.buildingPreset);
  const setBuildingPreset = useBimStore((s) => s.setBuildingPreset);
  const perspectiveId = useBimStore((s) => s.perspectiveId);

  return (
    <div
      data-testid="agent-review-mode-shell"
      className="h-full w-full overflow-auto bg-background p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icons.agent size={ICON_SIZE.toolPalette} aria-hidden="true" className="text-accent" />
        <h2 className="text-md font-medium text-foreground">Advisor</h2>
      </div>
      <AdvisorPanel
        violations={violations}
        selectionId={selectedId ?? undefined}
        preset={buildingPreset}
        onPreset={setBuildingPreset}
        onApplyQuickFix={onApplyQuickFix}
        perspective={perspectiveId}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Shared placeholder card                                                  */
/* ────────────────────────────────────────────────────────────────────── */

function PlaceholderCard({
  title,
  body,
  icon: IconCmp,
}: {
  title: string;
  body: string;
  icon: typeof Icons.section;
}): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-2 px-6 py-4 text-center">
        <IconCmp size={ICON_SIZE.toolPalette} aria-hidden="true" className="text-muted" />
        <div className="text-md font-medium text-foreground">{title}</div>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}
