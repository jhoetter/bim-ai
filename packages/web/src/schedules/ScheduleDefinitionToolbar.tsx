import { useEffect, useState } from 'react';

import type { Element } from '@bim-ai/core';

import {
  parseNumericFilterRuleThreshold,
  parseWidthMmGtThreshold,
  parseWidthMmLtThreshold,
  schedulesFiltersWithNumericRule,
  schedulesFiltersWithWidthMmGt,
  schedulesFiltersWithWidthMmLt,
} from './scheduleFilterWidthRules';
import { formatScheduleLevelDatumEvidenceLine } from './scheduleLevelDatumEvidenceReadout';
import { resolveScheduleSortDescending } from './schedulePayloadTotals';
import {
  levelFilterFieldForTab,
  scheduleGroupingKeyChoices,
  scheduleSortKeyChoices,
  type TabKey,
} from './scheduleUtils';

type ServerScheduleData = {
  tab: TabKey;
  scheduleId: string;
  data: Record<string, unknown>;
};

export function ScheduleDefinitionToolbar({
  tab,
  scheduleId,
  srvActive,
  modelId,
  elementsById,
  activeLevelId,
  onScheduleFiltersCommit,
}: {
  tab: TabKey;
  scheduleId: string;
  srvActive: ServerScheduleData;
  modelId: string;
  elementsById: Record<string, Element>;
  activeLevelId?: string;
  onScheduleFiltersCommit: (
    scheduleId: string,
    filters: Record<string, unknown>,
    grouping?: Record<string, unknown>,
  ) => void;
}) {
  const [openingWidthGtDraft, setOpeningWidthGtDraft] = useState('');
  const [openingWidthLtDraft, setOpeningWidthLtDraft] = useState('');
  const [roomAreaGtDraft, setRoomAreaGtDraft] = useState('');
  const [roomAreaLtDraft, setRoomAreaLtDraft] = useState('');

  const openingToolbarScheduleEl =
    tab === 'doors' || tab === 'windows' ? elementsById[scheduleId] : undefined;
  const roomToolbarScheduleEl = tab === 'rooms' ? elementsById[scheduleId] : undefined;

  useEffect(() => {
    queueMicrotask(() => {
      if (openingToolbarScheduleEl?.kind !== 'schedule') {
        setOpeningWidthGtDraft('');
        setOpeningWidthLtDraft('');
        return;
      }
      const f0 = { ...(openingToolbarScheduleEl.filters ?? {}) } as Record<string, unknown>;
      const t = parseWidthMmGtThreshold(f0);
      setOpeningWidthGtDraft(t !== null ? String(t) : '');
      const u = parseWidthMmLtThreshold(f0);
      setOpeningWidthLtDraft(u !== null ? String(u) : '');
    });
  }, [openingToolbarScheduleEl]);

  useEffect(() => {
    queueMicrotask(() => {
      if (roomToolbarScheduleEl?.kind !== 'schedule') {
        setRoomAreaGtDraft('');
        setRoomAreaLtDraft('');
        return;
      }
      const f0 = { ...(roomToolbarScheduleEl.filters ?? {}) } as Record<string, unknown>;
      const minArea = parseNumericFilterRuleThreshold(f0, 'areaM2', 'gt');
      setRoomAreaGtDraft(minArea !== null ? String(minArea) : '');
      const maxArea = parseNumericFilterRuleThreshold(f0, 'areaM2', 'lt');
      setRoomAreaLtDraft(maxArea !== null ? String(maxArea) : '');
    });
  }, [roomToolbarScheduleEl]);

  // Guard: only render when all conditions are met (caller pre-validates, but double-check el)
  const el = elementsById[scheduleId];
  if (!el || el.kind !== 'schedule') return null;
  if (!srvActive || srvActive.scheduleId !== scheduleId || !modelId) return null;

  const f = { ...(el.filters ?? {}) } as Record<string, unknown>;

  const ghRaw = f.groupingHint ?? f.grouping_hint;
  const gkEl = el.grouping as { groupKeys?: unknown } | undefined;
  const gkRaw = gkEl?.groupKeys;
  const hintsFromFilters = Array.isArray(ghRaw)
    ? ghRaw.filter((x): x is string => typeof x === 'string')
    : [];
  const hintsFromGrouping = Array.isArray(gkRaw)
    ? gkRaw.filter((x): x is string => typeof x === 'string')
    : [];
  const hintList = hintsFromFilters.length > 0 ? hintsFromFilters : hintsFromGrouping;
  const hintSet = new Set(hintList);

  const sortKeys = scheduleSortKeyChoices(tab);
  const groupOpts = scheduleGroupingKeyChoices(tab);

  const sortVal = String(
    f.sortBy ?? (el.grouping as { sortBy?: string } | undefined)?.sortBy ?? sortKeys[0] ?? 'name',
  );

  const sortDesc = resolveScheduleSortDescending(f, el.grouping as Record<string, unknown>);

  const orderedHints = (): string[] => groupOpts.filter((gk) => hintSet.has(gk));

  const groupingPayload = (hints: string[]) => ({
    ...(el.grouping as Record<string, unknown>),
    sortBy: sortVal,
    groupKeys: hints,
    sortDescending: sortDesc,
  });

  const commit = (nextF: Record<string, unknown>, nextG: Record<string, unknown>) => {
    onScheduleFiltersCommit(scheduleId, nextF, nextG);
  };

  const numericDraftThreshold = (draft: string): number | null => {
    const trimmed = draft.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  const lf = levelFilterFieldForTab(tab);
  const feRaw = f.filterEquals ?? f.filter_equals;
  const feObj =
    typeof feRaw === 'object' && feRaw !== null && !Array.isArray(feRaw)
      ? { ...(feRaw as Record<string, unknown>) }
      : {};
  const levelRestricted = Boolean(lf && activeLevelId && String(feObj[lf] ?? '') === activeLevelId);

  const numericRuleBase = (): Record<string, unknown> => ({
    ...f,
    sortBy: sortVal,
    groupingHint: orderedHints(),
    filterEquals: feObj,
    sortDescending: sortDesc,
  });

  return (
    <div
      data-testid="schedule-definition-toolbar"
      className="mt-2 rounded border border-border/60 bg-background/40 p-2 text-[10px] text-muted"
    >
      <div className="font-semibold text-foreground">
        Schedule definition · upsertScheduleFilters
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2">
          <span>Sort field</span>

          <select
            className="rounded border border-border bg-background px-2 py-0.5 font-mono"
            value={sortVal}
            onChange={(e) => {
              const sb = e.target.value;
              const hints = orderedHints();
              commit(
                { ...f, sortBy: sb, groupingHint: hints, sortDescending: sortDesc },
                {
                  ...(el.grouping as Record<string, unknown>),
                  sortBy: sb,
                  groupKeys: hints,
                  sortDescending: sortDesc,
                },
              );
            }}
          >
            {sortKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            data-testid="schedule-sort-descending"
            checked={sortDesc}
            onChange={(e) => {
              const desc = e.target.checked;
              const hints = orderedHints();
              commit(
                {
                  ...f,
                  sortBy: sortVal,
                  groupingHint: hints,
                  sortDescending: desc,
                },
                {
                  ...(el.grouping as Record<string, unknown>),
                  sortBy: sortVal,
                  groupKeys: hints,
                  sortDescending: desc,
                },
              );
            }}
          />
          <span>Descending</span>
        </label>

        {lf && activeLevelId ? (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={levelRestricted}
              onChange={(e) => {
                const on = e.target.checked;
                const hints = orderedHints();
                const nextFe = { ...feObj };
                if (on) nextFe[lf] = activeLevelId;
                else delete nextFe[lf];
                commit(
                  {
                    ...f,
                    sortBy: sortVal,
                    groupingHint: hints,
                    filterEquals: nextFe,
                    sortDescending: sortDesc,
                  },
                  groupingPayload(hints),
                );
              }}
            />
            <span>
              Restrict to active level (<span className="font-mono">{lf}</span>)
            </span>
          </label>
        ) : null}
      </div>

      {levelRestricted && activeLevelId ? (
        <div
          data-testid="schedule-level-datum-evidence"
          className="mt-2 break-all font-mono text-[10px] text-muted"
        >
          {formatScheduleLevelDatumEvidenceLine(elementsById, activeLevelId)}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-foreground">Group by</span>

        {groupOpts.map((gk) => (
          <label key={gk} className="flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              checked={hintSet.has(gk)}
              onChange={(e) => {
                const on = e.target.checked;

                const nx = new Set(hintSet);

                if (on) nx.add(gk);
                else nx.delete(gk);

                const nextHints = groupOpts.filter((x) => nx.has(x));

                commit(
                  {
                    ...f,
                    groupingHint: nextHints,
                    sortBy: sortVal,
                    filterEquals: feObj,
                    sortDescending: sortDesc,
                  },
                  groupingPayload(nextHints),
                );
              }}
            />

            <span className="font-mono">{gk}</span>
          </label>
        ))}
      </div>

      {tab === 'rooms' ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex flex-wrap items-center gap-2">
              <span>Min area (m²) &gt;</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-background px-2 py-0.5 font-mono text-foreground"
                data-testid="schedule-filter-area-m2-gt"
                value={roomAreaGtDraft}
                onChange={(e) => {
                  setRoomAreaGtDraft(e.target.value);
                }}
                onBlur={() => {
                  const nextF = schedulesFiltersWithNumericRule(
                    numericRuleBase(),
                    'areaM2',
                    'gt',
                    numericDraftThreshold(roomAreaGtDraft),
                  );
                  commit(nextF, groupingPayload(orderedHints()));
                }}
              />
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <span>Max area (m²) &lt;</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-background px-2 py-0.5 font-mono text-foreground"
                data-testid="schedule-filter-area-m2-lt"
                value={roomAreaLtDraft}
                onChange={(e) => {
                  setRoomAreaLtDraft(e.target.value);
                }}
                onBlur={() => {
                  const nextF = schedulesFiltersWithNumericRule(
                    numericRuleBase(),
                    'areaM2',
                    'lt',
                    numericDraftThreshold(roomAreaLtDraft),
                  );
                  commit(nextF, groupingPayload(orderedHints()));
                }}
              />
            </label>
          </div>
          {(() => {
            const minArea = parseNumericFilterRuleThreshold(f, 'areaM2', 'gt');
            const maxArea = parseNumericFilterRuleThreshold(f, 'areaM2', 'lt');
            if (minArea == null && maxArea == null) return null;
            const parts: string[] = [];
            if (minArea != null) parts.push(`areaM2 > ${minArea} m²`);
            if (maxArea != null) parts.push(`areaM2 < ${maxArea} m²`);
            return (
              <div
                data-testid="schedule-filter-rules-readout"
                className="mt-1 text-[10px] text-foreground/90"
              >
                Rules: {parts.join(' · ')}
              </div>
            );
          })()}
        </>
      ) : null}

      {tab === 'doors' || tab === 'windows' ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex flex-wrap items-center gap-2">
              <span>Min width (mm) &gt;</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-background px-2 py-0.5 font-mono text-foreground"
                data-testid="schedule-filter-width-mm-gt"
                value={openingWidthGtDraft}
                onChange={(e) => {
                  setOpeningWidthGtDraft(e.target.value);
                }}
                onBlur={() => {
                  const trimmed = openingWidthGtDraft.trim();
                  let thresh: number | null = null;
                  if (trimmed !== '') {
                    const n = Number(trimmed);
                    thresh = Number.isFinite(n) ? n : null;
                  }
                  const nextF = schedulesFiltersWithWidthMmGt(numericRuleBase(), thresh);
                  commit(nextF, groupingPayload(orderedHints()));
                }}
              />
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <span>Max width (mm) &lt;</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-background px-2 py-0.5 font-mono text-foreground"
                data-testid="schedule-filter-width-mm-lt"
                value={openingWidthLtDraft}
                onChange={(e) => {
                  setOpeningWidthLtDraft(e.target.value);
                }}
                onBlur={() => {
                  const trimmed = openingWidthLtDraft.trim();
                  let thresh: number | null = null;
                  if (trimmed !== '') {
                    const n = Number(trimmed);
                    thresh = Number.isFinite(n) ? n : null;
                  }
                  const nextF = schedulesFiltersWithWidthMmLt(numericRuleBase(), thresh);
                  commit(nextF, groupingPayload(orderedHints()));
                }}
              />
            </label>
          </div>
          {(() => {
            const fw = f as Record<string, unknown>;
            const wgt = parseWidthMmGtThreshold(fw);
            const wlt = parseWidthMmLtThreshold(fw);
            if (wgt == null && wlt == null) return null;
            const parts: string[] = [];
            if (wgt != null) parts.push(`widthMm > ${wgt} mm`);
            if (wlt != null) parts.push(`widthMm < ${wlt} mm`);
            return (
              <div
                data-testid="schedule-filter-rules-readout"
                className="mt-1 text-[10px] text-foreground/90"
              >
                Rules: {parts.join(' · ')}
              </div>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}
