import { type JSX, useEffect, useMemo, useState } from 'react';
import type { Element, LensMode } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import { ScheduleViewHifi } from '@bim-ai/icons';

import { SCHEDULE_DEFAULTS } from './modeSurfaces';
import { useBimStore } from '../state/store';
import { SheetReviewSurface } from '../plan/SheetReviewSurface';
import { SheetCanvas, SectionPlaceholderPane } from './sheets';
import type { SheetMarkupShape, SheetReviewMode } from './sheets/sheetReviewUi';
import {
  buildScheduleTableModelV1,
  type ScheduleTableModelV1,
} from '../schedules/scheduleTableRenderer';
import { formatScheduleCell } from '../schedules/scheduleUtils';
import {
  missingRequiredFieldKeys,
  presetById,
  resolvePresetColumnsForExport,
  type ScheduleAggregation,
} from '../schedules/scheduleDefinitionPresets';
import {
  buildScheduleTableCsvUrl,
  scheduleRegistryEngineReadoutParts,
} from '../schedules/schedulePanelRegistryChrome';
import { firstSheetId, placeViewOnSheetCommand } from './sheets/sheetRecommendedViewports';
import { lensUx } from './lensUx';
import { FloorAreaReportPanel } from '../schedules/FloorAreaReportPanel';

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
  activeSectionId,
  modelId,
  onUpsertSemantic,
  onOpenSourcePlan,
  onOpen3dContext,
  lensMode = 'all',
}: {
  activeLevelLabel?: string;
  activeSectionId?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  onOpenSourcePlan?: () => void;
  onOpen3dContext?: () => void;
  lensMode?: LensMode;
}): JSX.Element {
  return (
    <div data-testid="section-mode-shell" className="relative h-full w-full overflow-auto">
      {lensMode !== 'all' ? <SectionLensGuidance lensMode={lensMode} /> : null}
      <SectionPlaceholderPane
        activeLevelLabel={activeLevelLabel}
        activeSectionId={activeSectionId}
        modelId={modelId}
        onUpsertSemantic={onUpsertSemantic}
        onOpenSourcePlan={onOpenSourcePlan}
        onOpen3dContext={onOpen3dContext}
        lensMode={lensMode}
      />
    </div>
  );
}

function SectionLensGuidance({ lensMode }: { lensMode: LensMode }): JSX.Element {
  const ux = lensUx(lensMode);
  const focus = ux.inspectorFocus.slice(0, 3).join(' · ');
  return (
    <div
      data-testid="section-lens-guidance"
      className="pointer-events-none absolute right-4 top-4 z-10 max-w-[320px] rounded border border-border bg-background/95 px-3 py-2 text-[11px] shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-foreground">{ux.label}</div>
          <div className="text-muted">{ux.germanName}</div>
        </div>
        <span className="rounded bg-surface-strong px-1.5 py-0.5 text-[10px] uppercase text-muted">
          section
        </span>
      </div>
      <p className="mt-1 leading-snug text-muted">{ux.visualBehavior.section ?? ux.shortPurpose}</p>
      <div className="mt-1 truncate text-muted">{focus}</div>
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
  reviewMode,
  markupShape,
  lensMode = 'all',
}: {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  reviewMode?: SheetReviewMode;
  markupShape?: SheetMarkupShape;
  lensMode?: LensMode;
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
      <div data-testid="sheet-mode-shell" className="relative h-full w-full overflow-hidden">
        {lensMode !== 'all' ? <SheetLensGuidance lensMode={lensMode} /> : null}
        <SheetReviewSurface
          sheetId={resolvedSheet.id}
          modelId={modelId}
          elementsById={elementsById}
          onUpsertSemantic={onUpsertSemantic}
          reviewMode={reviewMode}
          markupShape={markupShape}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="sheet-mode-shell"
      className="relative h-full w-full overflow-auto bg-[#e5e5e5] p-6"
    >
      {lensMode !== 'all' ? <SheetLensGuidance lensMode={lensMode} /> : null}
      <SheetCanvas
        elementsById={elementsById}
        preferredSheetId={preferredSheetId}
        modelId={modelId}
        lensMode={lensMode}
        evidenceFullBleed={evidenceFullBleed}
        onUpsertSemantic={onUpsertSemantic}
      />
    </div>
  );
}

function SheetLensGuidance({ lensMode }: { lensMode: LensMode }): JSX.Element {
  const ux = lensUx(lensMode);
  return (
    <div
      data-testid="sheet-lens-guidance"
      className="pointer-events-none absolute right-3 top-3 z-10 max-w-xs rounded border border-border bg-surface/95 px-3 py-2 text-[11px] shadow-elev-1"
    >
      <div className="font-semibold text-foreground">{ux.label} sheet context</div>
      <div className="mt-1 leading-snug text-muted">
        Sheets collect deliverables; selected viewports should carry the lens. Relevant:{' '}
        {ux.sheetDeliverables.slice(0, 3).join(', ')}.
      </div>
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
  onUpsertSemantic,
  onNavigateToElement,
  lensMode = 'all',
}: {
  elementsById: Record<string, Element>;
  preferredScheduleId?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  onNavigateToElement?: (elementId: string) => void;
  lensMode?: LensMode;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<'schedules' | 'floor-area'>('schedules');
  const schedules = useMemo(
    () => sortSchedulesForLens(asArr(elementsById, 'schedule'), lensMode),
    [elementsById, lensMode],
  );
  const [activeId, setActiveId] = useState<string | null>(
    preferredScheduleId ?? schedules[0]?.id ?? SCHEDULE_DEFAULTS.activeScheduleId,
  );
  const active = activeId ? elementsById[activeId] : undefined;
  const scheduleSheetStats = useMemo(
    () => scheduleSheetPlacementStats(elementsById),
    [elementsById],
  );

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
        <div className="mb-1 flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('schedules')}
            className={[
              'flex-1 rounded px-2 py-1 text-xs',
              activeTab === 'schedules'
                ? 'bg-accent-soft text-foreground font-medium'
                : 'text-muted hover:bg-surface-strong',
            ].join(' ')}
          >
            Schedules
          </button>
          <button
            type="button"
            data-testid="floor-area-tab-button"
            onClick={() => setActiveTab('floor-area')}
            className={[
              'flex-1 rounded px-2 py-1 text-xs',
              activeTab === 'floor-area'
                ? 'bg-accent-soft text-foreground font-medium'
                : 'text-muted hover:bg-surface-strong',
            ].join(' ')}
          >
            Floor Areas
          </button>
        </div>
        {lensMode !== 'all' ? (
          <div
            data-testid="schedule-lens-guidance"
            className="mb-1 rounded border border-border bg-background px-2 py-1.5 text-[11px] text-muted"
          >
            <div className="font-medium text-foreground">{lensUx(lensMode).label}</div>
            <div className="mt-0.5 leading-snug">
              Lens prioritizes {lensUx(lensMode).scheduleFamilies.slice(0, 3).join(', ')}.
            </div>
          </div>
        ) : null}
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
              <span className="block truncate">{s.name}</span>
              <span className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted">
                {lensMode !== 'all' && scheduleLensPriority(s, lensMode) > 0 ? (
                  <span className="rounded bg-accent-soft px-1 text-accent">lens</span>
                ) : null}
                {scheduleCategoryLabel(s) ? <span>{scheduleCategoryLabel(s)}</span> : null}
                <span>
                  {(scheduleSheetStats.get(s.id) ?? 0) > 0
                    ? `${scheduleSheetStats.get(s.id)} sheet viewport`
                    : 'not on sheet'}
                </span>
              </span>
            </button>
          ))
        )}
      </aside>
      <div className="overflow-auto bg-background p-3">
        {activeTab === 'floor-area' ? (
          <FloorAreaReportPanel elementsById={elementsById} />
        ) : active && active.kind === 'schedule' ? (
          <ScheduleGrid
            schedule={active}
            modelId={modelId}
            elementsById={elementsById}
            onUpsertSemantic={onUpsertSemantic}
            onNavigateToElement={onNavigateToElement}
          />
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
  elementsById,
  onUpsertSemantic,
  onNavigateToElement,
}: {
  schedule: Extract<Element, { kind: 'schedule' }>;
  modelId?: string;
  elementsById: Record<string, Element>;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  onNavigateToElement?: (elementId: string) => void;
}): JSX.Element {
  const [state, setState] = useState<ScheduleGridState>({ status: 'idle' });
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [workflowProfileId, setWorkflowProfileId] = useState<string>('');
  const select = useBimStore((s) => s.select);
  const activeWorkspaceId = useBimStore((s) => s.activeWorkspaceId);
  const firstSheet = useMemo(() => firstSheetId(elementsById), [elementsById]);
  const sheetViewportCount = useMemo(
    () => scheduleSheetPlacementStats(elementsById).get(schedule.id) ?? 0,
    [elementsById, schedule.id],
  );

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

  useEffect(() => {
    setSelectedRowId(null);
  }, [schedule.id]);

  const model = useMemo<ScheduleTableModelV1 | null>(() => {
    if (state.status !== 'ready') return null;
    return buildScheduleTableModelV1({ payload: state.payload });
  }, [state]);

  const category =
    state.status === 'ready'
      ? String(state.payload.category ?? '').trim()
      : String((schedule.filters as Record<string, unknown> | undefined)?.category ?? '').trim();
  const selectedRowIsElement = Boolean(selectedRowId && elementsById[selectedRowId]);
  const workflowProfiles = useMemo(
    () => scheduleWorkflowProfiles(category, activeWorkspaceId),
    [category, activeWorkspaceId],
  );
  const activeProfile =
    workflowProfiles.find((profile) => profile.id === workflowProfileId) ?? workflowProfiles[0];
  const payloadColumns = useMemo(() => {
    if (state.status !== 'ready') return [] as string[];
    const cols = state.payload.columns;
    return Array.isArray(cols) ? (cols as string[]) : [];
  }, [state]);
  const activePreset = activeProfile ? presetById(activeProfile.presetId) : undefined;
  const presetColumnKeys = useMemo(() => {
    if (!activePreset) return [] as string[];
    return resolvePresetColumnsForExport(
      activePreset.fields.map((field) => field.fieldKey),
      payloadColumns,
    );
  }, [activePreset, payloadColumns]);
  const missingPresetRequiredFields = useMemo(() => {
    if (!activePreset) return [] as string[];
    return missingRequiredFieldKeys(activePreset, payloadColumns);
  }, [activePreset, payloadColumns]);
  const presetUnitHints = useMemo(() => {
    if (!activePreset) return [] as string[];
    const units = new Set<string>();
    for (const field of activePreset.fields) {
      if (typeof field.unitHint === 'string' && field.unitHint.trim()) {
        units.add(field.unitHint.trim());
      }
    }
    return [...units].sort((a, b) => a.localeCompare(b));
  }, [activePreset]);
  const presetAggregations = useMemo(() => {
    if (!activePreset) return [] as Array<{ key: string; aggregation: ScheduleAggregation }>;
    return activePreset.fields
      .filter(
        (
          field,
        ): field is (typeof activePreset.fields)[number] & { aggregation: ScheduleAggregation } =>
          Boolean(field.aggregation),
      )
      .map((field) => ({ key: field.fieldKey, aggregation: field.aggregation }));
  }, [activePreset]);
  const provenanceParts = useMemo(() => {
    if (state.status !== 'ready') return [] as string[];
    const parts = [`schedule ${schedule.id}`, ...scheduleRegistryEngineReadoutParts(state.payload)];
    return parts.filter((part) => part.trim().length > 0);
  }, [schedule.id, state]);

  const placeOnSheet = () => {
    if (!firstSheet || !onUpsertSemantic) return;
    const cmd = placeViewOnSheetCommand(elementsById, firstSheet, schedule.id);
    if (cmd) onUpsertSemantic(cmd);
  };

  const duplicateSchedule = () => {
    if (!onUpsertSemantic) return;
    onUpsertSemantic({
      type: 'upsertSchedule',
      id: `${schedule.id}-copy-${Date.now().toString(36)}`,
      name: `${schedule.name} copy`,
      filters: { ...(schedule.filters ?? {}) },
      grouping: { ...(schedule.grouping ?? {}) },
    });
  };

  const openSelectedElement = () => {
    if (!selectedRowId || !elementsById[selectedRowId]) return;
    select(selectedRowId);
    onNavigateToElement?.(selectedRowId);
  };

  const applyWorkflowProfile = () => {
    if (!onUpsertSemantic || !activeProfile || !activePreset) return;
    const sortBy = activeProfile.sortBy ?? 'name';
    const nextFilters = {
      ...(schedule.filters ?? {}),
      displayColumnKeys: presetColumnKeys,
      sortBy,
      sortDescending: activeProfile.sortDescending ?? false,
      groupingHint: activeProfile.groupKeys ?? [],
    };
    const nextGrouping = {
      ...(schedule.grouping ?? {}),
      sortBy,
      sortDescending: activeProfile.sortDescending ?? false,
      groupKeys: activeProfile.groupKeys ?? [],
    };
    onUpsertSemantic({
      type: 'upsertSchedule',
      id: schedule.id,
      name: schedule.name,
      category: category || undefined,
      filters: nextFilters,
      grouping: nextGrouping,
    });
  };

  const exportScheduleCsv = async () => {
    if (!modelId) return;
    const cols = presetColumnKeys.length > 0 ? presetColumnKeys : undefined;
    const csvUrl = buildScheduleTableCsvUrl(modelId, schedule.id, {
      columns: cols,
      includeScheduleTotalsCsv: true,
    });
    const response = await fetch(csvUrl);
    const body = await response.text();
    if (!response.ok) {
      alert(body);
      return;
    }
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `bim-ai-schedule-${schedule.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  useEffect(() => {
    setWorkflowProfileId(workflowProfiles[0]?.id ?? '');
  }, [schedule.id, workflowProfiles]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-md font-medium text-foreground">{schedule.name}</div>
          <div className="text-xs text-muted">
            Schedule id · <span className="font-mono">{schedule.id}</span>
            {category ? (
              <>
                {' '}
                · <span>{category}</span>
              </>
            ) : null}{' '}
            · {sheetViewportCount > 0 ? `${sheetViewportCount} sheet viewport` : 'not on sheet'}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!selectedRowIsElement}
            title={
              selectedRowIsElement
                ? 'Open the selected schedule row element in the canvas'
                : 'Select a schedule row that resolves to a model element'
            }
            onClick={openSelectedElement}
          >
            <Icons.viewpoint size={ICON_SIZE.chrome} aria-hidden="true" />
            Open row
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!firstSheet || !onUpsertSemantic}
            title={firstSheet ? 'Place this schedule on the first sheet' : 'No sheet is available'}
            onClick={placeOnSheet}
          >
            <Icons.sheet size={ICON_SIZE.chrome} aria-hidden="true" />
            Place on sheet
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!onUpsertSemantic}
            title="Duplicate this schedule definition"
            onClick={duplicateSchedule}
          >
            <Icons.copy size={ICON_SIZE.chrome} aria-hidden="true" />
            Duplicate
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!modelId}
            title={modelId ? 'Export this schedule as CSV' : 'Open a model to export CSV'}
            onClick={() => void exportScheduleCsv()}
          >
            <Icons.externalLink size={ICON_SIZE.chrome} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>
      {activeProfile && activePreset ? (
        <div
          data-testid="schedule-workflow-profile"
          className="rounded border border-border/60 bg-surface px-2 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-foreground">Workflow profile</div>
              <div className="text-muted">{activeProfile.description}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                data-testid="schedule-workflow-profile-select"
                className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                value={activeProfile.id}
                onChange={(event) => setWorkflowProfileId(event.currentTarget.value)}
              >
                {workflowProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="schedule-workflow-profile-apply"
                className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!onUpsertSemantic || presetColumnKeys.length === 0}
                onClick={applyWorkflowProfile}
              >
                Apply profile
              </button>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Columns {presetColumnKeys.length}/{payloadColumns.length}
            {missingPresetRequiredFields.length > 0
              ? ` · missing required: ${missingPresetRequiredFields.join(', ')}`
              : ' · all required fields available'}
            {presetUnitHints.length > 0 ? ` · units: ${presetUnitHints.join(', ')}` : ''}
            {presetAggregations.length > 0
              ? ` · totals: ${presetAggregations
                  .map((entry) => `${entry.aggregation}(${entry.key})`)
                  .join(', ')}`
              : ''}
          </div>
          {provenanceParts.length > 0 ? (
            <div className="mt-1 font-mono text-[10px] text-muted">
              provenance: {provenanceParts.join(' · ')}
            </div>
          ) : null}
        </div>
      ) : null}
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
        <DerivedScheduleTable
          scheduleName={schedule.name}
          model={model}
          category={category}
          selectedRowId={selectedRowId}
          elementsById={elementsById}
          onRowSelect={(rowId) => {
            setSelectedRowId(rowId);
            if (elementsById[rowId]) select(rowId);
          }}
        />
      ) : null}
    </div>
  );
}

function DerivedScheduleTable({
  scheduleName,
  model,
  category,
  selectedRowId,
  elementsById,
  onRowSelect,
}: {
  scheduleName: string;
  model: ScheduleTableModelV1;
  category: string;
  selectedRowId: string | null;
  elementsById: Record<string, Element>;
  onRowSelect: (rowId: string) => void;
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
                  <tr
                    key={row.id}
                    className={[
                      'border-t border-border/60',
                      selectedRowId === row.id ? 'bg-accent/15' : 'hover:bg-surface-strong',
                    ].join(' ')}
                    data-selected={selectedRowId === row.id ? 'true' : 'false'}
                    data-resolves-element={elementsById[row.id] ? 'true' : 'false'}
                    tabIndex={0}
                    onClick={() => onRowSelect(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowSelect(row.id);
                      }
                    }}
                    title={
                      elementsById[row.id]
                        ? 'Select linked model element'
                        : 'This schedule row has no linked model element id'
                    }
                  >
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
                  No rows match this {category ? `${category} ` : ''}schedule. Check the category,
                  filters, and whether the model has matching elements.
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

type ScheduleWorkflowProfile = {
  id: string;
  label: string;
  description: string;
  presetId: string;
  sortBy?: string;
  sortDescending?: boolean;
  groupKeys?: string[];
};

function scheduleWorkflowProfiles(
  category: string,
  workspaceId: 'arch' | 'struct' | 'mep',
): ScheduleWorkflowProfile[] {
  switch (category) {
    case 'room':
      return workspaceId === 'mep'
        ? [
            {
              id: 'room-mep-loads',
              label: 'MEP load zoning',
              description: 'Sort rooms by programme and area for HVAC and electrical zone review.',
              presetId: 'room-programme',
              sortBy: 'areaM2',
              sortDescending: true,
              groupKeys: ['programmeCode'],
            },
            {
              id: 'room-core-quantity',
              label: 'Area takeoff',
              description: 'Core room area and perimeter quantities for quick gross checks.',
              presetId: 'room-core-area',
              sortBy: 'name',
              sortDescending: false,
              groupKeys: ['levelId'],
            },
          ]
        : [
            {
              id: 'room-architect-programme',
              label: 'Architect programme',
              description:
                'Room programme and department metadata for documentation and QA ownership.',
              presetId: 'room-programme',
              sortBy: 'name',
              sortDescending: false,
              groupKeys: ['levelId', 'department'],
            },
            {
              id: 'room-energy-envelope',
              label: 'Energy advisor area',
              description:
                'Area-focused room schedule with target deltas for quick energy-area reconciliation.',
              presetId: 'room-core-area',
              sortBy: 'areaDeltaM2',
              sortDescending: true,
              groupKeys: ['levelId'],
            },
          ];
    case 'door':
      return [
        {
          id: 'door-host-spec',
          label: 'Host and type spec',
          description:
            'Door host/type identity for architectural documentation and coordination handoff.',
          presetId: 'door-host-identity',
          sortBy: 'hostWallTypeDisplay',
          sortDescending: false,
          groupKeys: ['levelId', 'hostWallTypeDisplay'],
        },
        {
          id: 'door-opening-qto',
          label: 'Opening quantity',
          description:
            'Rough opening geometry grouped by level for quantity takeoff and fabrication prep.',
          presetId: 'door-opening-qto',
          sortBy: 'roughOpeningAreaM2',
          sortDescending: true,
          groupKeys: ['levelId'],
        },
      ];
    case 'window':
      return [
        {
          id: 'window-glazing-host',
          label: 'Glazing and host',
          description:
            'Window host/type/material context for envelope coordination and specification checks.',
          presetId: 'window-glazing-host',
          sortBy: 'hostWallTypeDisplay',
          sortDescending: false,
          groupKeys: ['levelId', 'hostWallTypeDisplay'],
        },
        {
          id: 'window-energy-opening',
          label: 'Energy opening area',
          description:
            'Opening-area oriented profile for daylight and envelope performance review.',
          presetId: 'window-opening-qto',
          sortBy: 'openingAreaM2',
          sortDescending: true,
          groupKeys: ['levelId'],
        },
      ];
    case 'material_assembly':
      return [
        {
          id: 'assembly-layer-qto',
          label: 'Layer takeoff',
          description:
            'Layer-by-layer assembly quantities and thicknesses for estimator and consultant workflows.',
          presetId: 'assembly-layer-takeoff',
          sortBy: 'grossVolumeM3',
          sortDescending: true,
          groupKeys: ['hostKind', 'materialKey'],
        },
      ];
    case 'energy_envelope':
      return [
        {
          id: 'energy-envelope-review',
          label: 'Envelope surfaces',
          description: 'Thermal envelope classification, surface area, U-value, and missing data.',
          presetId: 'energy-envelope-surfaces',
          sortBy: 'surfaceAreaM2',
          sortDescending: true,
          groupKeys: ['hostKind', 'thermalClassification'],
        },
      ];
    case 'energy_thermal_materials':
      return [
        {
          id: 'energy-material-lambda',
          label: 'Thermal material audit',
          description: 'Material lambda, density, heat capacity, mu, and source references.',
          presetId: 'energy-thermal-materials',
          sortBy: 'materialKey',
          groupKeys: ['thermalDataStatus'],
        },
      ];
    case 'energy_u_value_summary':
      return [
        {
          id: 'energy-u-values',
          label: 'U-value summary',
          description: 'Type-level U-value readouts with missing layer data called out.',
          presetId: 'energy-u-value-summary',
          sortBy: 'uValueWPerM2K',
          groupKeys: ['hostKind'],
        },
      ];
    case 'energy_windows_solar_gains':
      return [
        {
          id: 'energy-window-solar',
          label: 'Solar gains',
          description: 'Glazing area, U-value, g-value, frame fraction, and shading handoff.',
          presetId: 'energy-windows-solar-gains',
          sortBy: 'openingAreaM2',
          sortDescending: true,
          groupKeys: ['wallId'],
        },
      ];
    case 'energy_thermal_bridges':
      return [
        {
          id: 'energy-thermal-bridges',
          label: 'Thermal bridges',
          description: 'Thermal bridge markers, mitigation notes, and optional psi references.',
          presetId: 'energy-thermal-bridges',
          sortBy: 'markerType',
          groupKeys: ['markerType'],
        },
      ];
    case 'energy_thermal_zones':
      return [
        {
          id: 'energy-thermal-zones',
          label: 'Thermal zones',
          description: 'Room heating status, usage profile, setpoint, air change, and zone id.',
          presetId: 'energy-thermal-zones',
          sortBy: 'zoneId',
          groupKeys: ['zoneId', 'heatingStatus'],
        },
      ];
    case 'energy_building_services':
      return [
        {
          id: 'energy-building-services',
          label: 'Services handoff',
          description: 'Non-final generator, carrier, distribution, DHW, ventilation, and notes.',
          presetId: 'energy-building-services',
          sortBy: 'name',
          groupKeys: ['scenarioId'],
        },
      ];
    case 'energy_renovation_measures':
      return [
        {
          id: 'energy-renovation-measures',
          label: 'Renovation measures',
          description: 'As-is, scenario, target, measure packages, and cost placeholders.',
          presetId: 'energy-renovation-measures',
          sortBy: 'scenarioStatus',
          groupKeys: ['scenarioStatus', 'scenarioId'],
        },
      ];
    case 'energy_export_qa':
      return [
        {
          id: 'energy-export-qa',
          label: 'Export QA',
          description: 'Missing classifications, thermal values, opening data, and zone warnings.',
          presetId: 'energy-export-qa',
          sortBy: 'severity',
          groupKeys: ['severity', 'issueCode'],
        },
      ];
    case 'quantity_takeoff':
      return [
        {
          id: 'cost-quantity-takeoff',
          label: 'Quantity takeoff',
          description: 'Model-derived length, area, volume, opening, and layer quantities.',
          presetId: 'cost-quantity-takeoff',
          sortBy: 'elementKind',
          sortDescending: false,
          groupKeys: ['elementKind', 'costGroup'],
        },
      ];
    case 'cost_estimate':
      return [
        {
          id: 'cost-estimate-source',
          label: 'Estimate source',
          description: 'Cost rows with unit rates, source references, confidence, and totals.',
          presetId: 'cost-estimate-source',
          sortBy: 'totalCost',
          sortDescending: true,
          groupKeys: ['costGroup', 'workPackage'],
        },
      ];
    case 'element_cost_group':
      return [
        {
          id: 'cost-element-groups',
          label: 'Element cost groups',
          description: 'Traceable element rows grouped by cost group, work package, and trade.',
          presetId: 'cost-element-groups',
          sortBy: 'costGroup',
          sortDescending: false,
          groupKeys: ['costGroup', 'workPackage', 'trade'],
        },
      ];
    case 'scenario_delta':
      return [
        {
          id: 'cost-scenario-delta',
          label: 'Scenario delta',
          description: 'Package-level scenario totals compared against the baseline scenario.',
          presetId: 'cost-scenario-delta',
          sortBy: 'deltaCost',
          sortDescending: true,
          groupKeys: ['scenarioId', 'costGroup', 'workPackage'],
        },
      ];
    default:
      return [];
  }
}

function scheduleCategoryLabel(schedule: Extract<Element, { kind: 'schedule' }>): string {
  const filters = schedule.filters as Record<string, unknown> | undefined;
  const category = String(filters?.category ?? '').trim();
  return category;
}

function sortSchedulesForLens(
  schedules: Extract<Element, { kind: 'schedule' }>[],
  lensMode: LensMode,
): Extract<Element, { kind: 'schedule' }>[] {
  return [...schedules].sort((a, b) => {
    const pa = scheduleLensPriority(a, lensMode);
    const pb = scheduleLensPriority(b, lensMode);
    if (pa !== pb) return pb - pa;
    return a.name.localeCompare(b.name);
  });
}

function scheduleLensPriority(
  schedule: Extract<Element, { kind: 'schedule' }>,
  lensMode: LensMode,
): number {
  if (lensMode === 'all') return 0;
  const category = scheduleCategoryLabel(schedule).toLowerCase();
  const haystack = `${schedule.name} ${category}`.toLowerCase();
  const words = lensUx(lensMode).scheduleFamilies.flatMap((family) =>
    family
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4),
  );
  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) score += 1;
  }
  if (lensMode === 'architecture' && ['room', 'door', 'window'].includes(category)) score += 3;
  if (lensMode === 'sustainability' && haystack.includes('carbon')) score += 3;
  if (
    lensMode === 'cost-quantity' &&
    (haystack.includes('cost') || haystack.includes('quantity'))
  ) {
    score += 3;
  }
  if (lensMode === 'energy' && (haystack.includes('thermal') || haystack.includes('envelope'))) {
    score += 3;
  }
  return score;
}

function scheduleSheetPlacementStats(elementsById: Record<string, Element>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'sheet') continue;
    for (const raw of el.viewportsMm ?? []) {
      const rec = raw as Record<string, unknown>;
      const viewRef = String(rec.viewRef ?? rec.view_ref ?? '').trim();
      if (!viewRef.startsWith('schedule:')) continue;
      const id = viewRef.slice('schedule:'.length);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
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
