import { type JSX, useState } from 'react';
import type { Element } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';

import { SCHEDULE_DEFAULTS } from './modeSurfaces';
import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { useBimStore } from '../state/store';
import { SheetCanvas } from './SheetCanvas';
import { SectionPlaceholderPane } from './SectionPlaceholderPane';

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
}: {
  activeLevelLabel?: string;
  modelId?: string;
}): JSX.Element {
  return (
    <div data-testid="section-mode-shell" className="h-full w-full overflow-auto">
      <SectionPlaceholderPane activeLevelLabel={activeLevelLabel} modelId={modelId} />
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
}: {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
  modelId?: string;
}): JSX.Element {
  const evidenceFullBleed = new URLSearchParams(window.location.search).has('evidenceSheetFull');
  return (
    <div data-testid="sheet-mode-shell" className="h-full w-full overflow-auto bg-background p-6">
      <SheetCanvas
        elementsById={elementsById}
        preferredSheetId={preferredSheetId}
        modelId={modelId}
        evidenceFullBleed={evidenceFullBleed}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Schedule mode (§20.6)                                                    */
/* ────────────────────────────────────────────────────────────────────── */

export function ScheduleModeShell({
  elementsById,
}: {
  elementsById: Record<string, Element>;
}): JSX.Element {
  const schedules = asArr(elementsById, 'schedule');
  const [activeId, setActiveId] = useState<string | null>(
    schedules[0]?.id ?? SCHEDULE_DEFAULTS.activeScheduleId,
  );
  const active = activeId ? elementsById[activeId] : undefined;

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
          <p className="px-1 text-sm text-muted">No schedules yet.</p>
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
          <ScheduleGrid schedule={active} />
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

function ScheduleGrid({
  schedule,
}: {
  schedule: Extract<Element, { kind: 'schedule' }>;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-md font-medium text-foreground">{schedule.name}</div>
        <div className="text-xs text-muted">
          Schedule id · <span className="font-mono">{schedule.id}</span>
        </div>
      </div>
      <table className="w-full border-collapse text-sm" aria-label={`${schedule.name} grid`}>
        <thead>
          <tr className="text-xs uppercase text-muted">
            <th className="border-b border-border px-2 py-1.5 text-left">Mark</th>
            <th className="border-b border-border px-2 py-1.5 text-left">Type</th>
            <th className="border-b border-border px-2 py-1.5 text-right">Width</th>
            <th className="border-b border-border px-2 py-1.5 text-right">Height</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-border px-2 py-1.5 font-mono text-xs">—</td>
            <td className="border-b border-border px-2 py-1.5 text-muted">
              Rows hydrate from the server `derive_schedule_table` endpoint.
            </td>
            <td className="border-b border-border px-2 py-1.5 text-right text-muted">—</td>
            <td className="border-b border-border px-2 py-1.5 text-right text-muted">—</td>
          </tr>
        </tbody>
      </table>
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
