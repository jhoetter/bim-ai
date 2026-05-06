import { type JSX, useMemo, useState } from 'react';
import type { Element } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';

import {
  SCHEDULE_DEFAULTS,
  SECTION_ELEVATION_DEFAULTS,
  SHEET_DEFAULTS,
} from './modeSurfaces';
import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { useBimStore } from '../state/store';

/**
 * Mode-specific shells — spec §20.4 / §20.5 / §20.6 / §20.7.
 *
 * These render the canvas-region content for the four E-WPs. The
 * RedesignedWorkspace selects the right shell by `mode`. Each shell
 * pulls its data from `useBimStore` so the redesign tracks live state.
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
  elementsById,
}: {
  elementsById: Record<string, Element>;
}): JSX.Element {
  const sections = asArr(elementsById, 'section_cut');
  const [activeId, setActiveId] = useState<string | null>(
    sections[0]?.id ?? SECTION_ELEVATION_DEFAULTS.activeSectionId,
  );
  const active = activeId ? elementsById[activeId] : undefined;

  return (
    <div
      data-testid="section-mode-shell"
      className="grid h-full w-full"
      style={{ gridTemplateColumns: '1fr 1fr' }}
    >
      <div className="flex flex-col gap-2 overflow-y-auto border-r border-border bg-surface px-3 py-3">
        <div
          className="text-xs uppercase text-muted"
          style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
        >
          Section cuts
        </div>
        {sections.length === 0 ? (
          <p className="text-sm text-muted">No section cuts in the document.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  data-active={activeId === s.id ? 'true' : 'false'}
                  className={[
                    'w-full rounded-md px-3 py-1.5 text-left text-sm',
                    activeId === s.id
                      ? 'bg-accent-soft text-foreground'
                      : 'text-foreground hover:bg-surface-strong',
                  ].join(' ')}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col items-stretch overflow-hidden bg-background">
        {active && active.kind === 'section_cut' ? (
          <SectionPreview section={active} />
        ) : (
          <PlaceholderCard
            title="Pick a section cut"
            body="Select a section on the left to draft its preview here."
            icon={Icons.section}
          />
        )}
      </div>
    </div>
  );
}

function SectionPreview({
  section,
}: {
  section: Extract<Element, { kind: 'section_cut' }>;
}): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-4 text-sm">
      <div className="text-md font-medium text-foreground">{section.name}</div>
      <div
        className="text-xs uppercase text-muted"
        style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
      >
        Section line · mm
      </div>
      <ul className="font-mono text-xs text-foreground">
        <li>
          start · ({section.lineStartMm.xMm}, {section.lineStartMm.yMm})
        </li>
        <li>
          end · ({section.lineEndMm.xMm}, {section.lineEndMm.yMm})
        </li>
        <li>crop depth · {section.cropDepthMm}</li>
      </ul>
      <div
        className="mt-3 flex-1 rounded-lg border border-border bg-draft-paper"
        style={{ background: 'var(--draft-paper)' }}
      >
        <p className="m-3 text-xs text-muted">
          Section preview canvas mounts here once the §20.4 SVG renderer lands.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Sheet mode (§20.5)                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export function SheetModeShell({
  elementsById,
}: {
  elementsById: Record<string, Element>;
}): JSX.Element {
  const sheets = asArr(elementsById, 'sheet');
  const [activeId, setActiveId] = useState<string | null>(
    sheets[0]?.id ?? SHEET_DEFAULTS.activeSheetId,
  );
  const active = activeId ? elementsById[activeId] : undefined;

  return (
    <div
      data-testid="sheet-mode-shell"
      className="grid h-full w-full"
      style={{ gridTemplateColumns: '180px 1fr' }}
    >
      <aside className="flex flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-2 py-3">
        <div
          className="px-1 text-xs uppercase text-muted"
          style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
        >
          Sheets
        </div>
        {sheets.length === 0 ? (
          <p className="px-1 text-sm text-muted">No sheets yet.</p>
        ) : (
          sheets.map((s) => (
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
      <div className="overflow-auto bg-background p-6">
        {active && active.kind === 'sheet' ? (
          <SheetPaper sheet={active} />
        ) : (
          <PlaceholderCard
            title="Pick a sheet"
            body="Select a sheet on the left to compose viewports."
            icon={Icons.sheet}
          />
        )}
      </div>
    </div>
  );
}

function SheetPaper({ sheet }: { sheet: Extract<Element, { kind: 'sheet' }> }): JSX.Element {
  // Shrink mm → px proportionally. Use a 1 mm = 0.6 px gauge to fit A1.
  const gauge = 0.6;
  const widthPx = (sheet.paperWidthMm ?? 84_100) * gauge;
  const heightPx = (sheet.paperHeightMm ?? 59_400) * gauge;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-md font-medium text-foreground">{sheet.name}</div>
        <div className="text-xs text-muted">
          {((sheet.paperWidthMm ?? 0) / 1000).toFixed(1)} ×{' '}
          {((sheet.paperHeightMm ?? 0) / 1000).toFixed(1)} m · {(sheet.viewportsMm ?? []).length}{' '}
          viewports
        </div>
      </div>
      <div
        role="img"
        aria-label="Sheet paper"
        style={{
          width: widthPx,
          height: heightPx,
          background: 'var(--draft-paper)',
          border: '1px solid var(--color-border-strong)',
          position: 'relative',
        }}
      >
        {((sheet.viewportsMm ?? []) as Array<Record<string, unknown>>).map((vp) => {
          const xPx = (vp.xMm as number) * gauge;
          const yPx = (vp.yMm as number) * gauge;
          const wPx = (vp.widthMm as number) * gauge;
          const hPx = (vp.heightMm as number) * gauge;
          return (
            <div
              key={String(vp.viewportId)}
              data-testid={`sheet-viewport-${String(vp.viewportId)}`}
              style={{
                position: 'absolute',
                left: xPx,
                top: yPx,
                width: wPx,
                height: hPx,
                border: '1px dashed var(--color-border-strong)',
                background: 'color-mix(in srgb, var(--draft-construction-blue) 10%, transparent)',
                fontSize: 10,
                color: 'var(--color-foreground)',
                padding: 4,
              }}
            >
              <div className="font-mono text-[10px]">{String(vp.label)}</div>
            </div>
          );
        })}
      </div>
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
