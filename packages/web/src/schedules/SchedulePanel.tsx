import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { VirtualScrollRows } from './VirtualScrollRows';
import {
  MSG_LOADING,
  MSG_NO_ROWS,
  MSG_NO_SHEET_ELEMENTS,
  MSG_OPEN_SAVED_MODEL,
  noScheduleElementMessage,
  registryNoModelMode,
  type RegistryModelTab,
} from './schedulePanelPlansSheetsUi';
import { buildScheduleTableCsvUrl, type ScheduleFieldMeta } from './schedulePanelRegistryChrome';
import { scheduleTotalsReadoutParts } from './schedulePayloadTotals';
import { buildScheduleTableModelV1, type ScheduleTableModelV1 } from './scheduleTableRenderer';
import { roomFinishScheduleEvidenceReadoutParts } from './roomFinishScheduleEvidenceReadout';
import { stairScheduleEvidenceReadoutLines } from './stairScheduleEvidenceReadout';
import { compactScheduleOpeningAdvisoryLines } from './scheduleOpeningAdvisoriesReadout';
import { compactScheduleSheetExportParityAdvisoryLines } from './scheduleSheetExportParityReadout';
import type { SchedulePresetCategory } from './scheduleDefinitionPresets';
import { RegistryColumnPicker } from './RegistryColumnPicker';
import { ScheduleDefinitionPresetsStrip } from './ScheduleDefinitionPresetsStrip';
import { ScheduleDefinitionToolbar } from './ScheduleDefinitionToolbar';
import { ScheduleRegistryChrome } from './ScheduleRegistryChrome';
import { ScheduleRegistryTable } from './ScheduleRegistryTable';

export { resolveScheduleSortDescending, scheduleTotalsReadoutParts } from './schedulePayloadTotals';
export { scheduleSortKeyChoices } from './scheduleUtils';

import {
  type TabKey,
  SCHED_TABLE_ROW_PX,
  SCHED_TABLE_VIEWPORT_PX,
  ROOM_SCHED_COLSPAN,
  registryScheduleTab,
  findScheduleIdForCategory,
  flattenSchedulePayloadRows,
  fmtRoomScheduleOptM2,
  roomRowsFromServer,
  doorRowsFromServer,
  winRowsFromServer,
} from './scheduleUtils';

export function SchedulePanel(props: {
  modelId?: string;
  elementsById: Record<string, Element>;
  activeLevelId?: string;
  onScheduleFiltersCommit?: (
    scheduleId: string,
    filters: Record<string, unknown>,
    grouping?: Record<string, unknown>,
  ) => void;
}) {
  const [tab, setTab] = useState<TabKey>('rooms');
  const [server, setServer] = useState<{
    tab: TabKey;
    scheduleId: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const [registryVisibleCols, setRegistryVisibleCols] = useState<Record<string, string[]>>({});

  const violations = useBimStore((s) => s.violations);

  const scheduleOpeningAdvisoryLines = useMemo(() => {
    if (tab !== 'doors' && tab !== 'windows') return [];
    return compactScheduleOpeningAdvisoryLines(violations, props.elementsById, tab);
  }, [tab, violations, props.elementsById]);

  const scheduleSheetExportParityAdvisoryLines = useMemo(
    () => compactScheduleSheetExportParityAdvisoryLines(violations),
    [violations],
  );

  const schedulePersistedColumns = useCallback(
    (scheduleElementId: string | null): string[] | null => {
      if (!scheduleElementId) return null;
      const el = props.elementsById[scheduleElementId];
      if (!el || el.kind !== 'schedule') return null;
      const f = el.filters ?? {};
      const keys =
        (f as { displayColumnKeys?: unknown }).displayColumnKeys ??
        (f as { display_column_keys?: unknown }).display_column_keys;
      if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string')) return null;
      return keys as string[];
    },
    [props.elementsById],
  );

  const levelLabels = useMemo(() => {
    const m = new Map<string, string>();

    for (const e of Object.values(props.elementsById)) {
      if (e.kind === 'level') m.set(e.id, e.name ?? e.id);
    }

    return m;
  }, [props.elementsById]);

  const wallLevel = useMemo(() => {
    const m = new Map<string, string>();

    for (const e of Object.values(props.elementsById)) {
      if (e.kind === 'wall') m.set(e.id, e.levelId);
    }

    return m;
  }, [props.elementsById]);

  const sidRooms = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'room'),
    [props.elementsById],
  );
  const sidDoors = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'door'),
    [props.elementsById],
  );
  const sidWins = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'window'),
    [props.elementsById],
  );
  const sidFloors = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'floor'),
    [props.elementsById],
  );
  const sidFinishes = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'finish'),
    [props.elementsById],
  );
  const sidRoofs = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'roof'),
    [props.elementsById],
  );
  const sidStairs = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'stair'),
    [props.elementsById],
  );
  const sidPlans = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'plan_view'),
    [props.elementsById],
  );
  const sidViews = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'view'),
    [props.elementsById],
  );
  const sidSheets = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'sheet'),
    [props.elementsById],
  );
  const sidAssemblies = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'material_assembly'),
    [props.elementsById],
  );

  const sidForTab = useMemo(() => {
    switch (tab) {
      case 'rooms':
        return sidRooms;
      case 'doors':
        return sidDoors;
      case 'windows':
        return sidWins;
      case 'finishes':
        return sidFinishes;
      case 'floors':
        return sidFloors;
      case 'roofs':
        return sidRoofs;
      case 'stairs':
        return sidStairs;
      case 'plans':
        return sidPlans;
      case 'views':
        return sidViews;
      case 'sheets':
        return sidSheets;
      case 'assemblies':
        return sidAssemblies;
      default:
        return undefined;
    }
  }, [
    tab,
    sidRooms,
    sidDoors,
    sidWins,
    sidFinishes,
    sidFloors,
    sidRoofs,
    sidStairs,
    sidPlans,
    sidViews,
    sidSheets,
    sidAssemblies,
  ]);

  const [presetIdByCategory, setPresetIdByCategory] = useState<
    Partial<Record<SchedulePresetCategory, string>>
  >({});

  useEffect(() => {
    if (!props.modelId || !sidForTab) {
      queueMicrotask(() => {
        setServer(null);
        setServerErr(null);
      });
      return;
    }

    const sid = sidForTab;

    let cancel = false;
    void (async () => {
      setServerErr(null);
      try {
        const mid = encodeURIComponent(props.modelId!);
        const sc = encodeURIComponent(sid);
        const res = await fetch(`/api/models/${mid}/schedules/${sc}/table`);
        const txt = await res.text();
        const json = JSON.parse(txt) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(json.detail ?? txt));
        if (!cancel)
          setServer({
            tab,
            scheduleId: sid,
            data: json,
          });
      } catch (e) {
        if (!cancel) {
          setServer(null);
          setServerErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [props.modelId, tab, sidForTab]);

  const roomRowsLocal = useMemo(() => {
    const lvl = props.activeLevelId;

    return Object.values(props.elementsById)
      .filter(
        (e): e is Extract<Element, { kind: 'room' }> =>
          e.kind === 'room' && (!lvl || e.levelId === lvl),
      )
      .map((r) => {
        const outline = r.outlineMm ?? [];

        let a = 0;

        const n = outline.length;

        if (n >= 3) {
          for (let i = 0; i < n; i++) {
            const p = outline[i]!;

            const q = outline[(i + 1) % n]!;

            a += p.xMm * q.yMm - q.xMm * p.yMm;
          }

          a = Math.abs(a / 2) / 1e6;
        }

        let per = 0;

        for (let i = 0; i < outline.length; i++) {
          const p = outline[i]!;

          const q = outline[(i + 1) % outline.length]!;

          per += Math.hypot(q.xMm - p.xMm, q.yMm - p.yMm) / 1000;
        }

        const lv = levelLabels.get(r.levelId) ?? r.levelId;

        const tgtRaw = r.targetAreaM2;
        const targetAreaM2 =
          tgtRaw != null && Number.isFinite(Number(tgtRaw)) ? Number(tgtRaw) : null;

        const areaDeltaM2 =
          targetAreaM2 != null ? Math.round((a - targetAreaM2) * 1000) / 1000 : null;

        return {
          id: r.id,

          level: lv,

          name: r.name,

          areaM2: a,

          perM: per,

          targetAreaM2,

          areaDeltaM2,
        };
      });
  }, [props.activeLevelId, props.elementsById, levelLabels]);

  const doorRowsLocal = useMemo(() => {
    const lvl = props.activeLevelId;

    return Object.values(props.elementsById)
      .filter((e): e is Extract<Element, { kind: 'door' }> => e.kind === 'door')

      .map((d) => {
        const lid = wallLevel.get(d.wallId);

        if (lvl && lid && lid !== lvl) return null;

        const lvLab = lid ? (levelLabels.get(lid) ?? lid) : '—';

        return {
          id: d.id,

          name: d.name,

          level: lvLab,

          widthMm: d.widthMm,

          familyKey: (d.familyTypeId ?? '—').toString(),
        };
      })

      .filter((x): x is NonNullable<typeof x> => Boolean(x))

      .sort((a, b) => `${a.level} ${a.name}`.localeCompare(`${b.level} ${b.name}`));
  }, [props.activeLevelId, props.elementsById, levelLabels, wallLevel]);

  const windowRowsLocal = useMemo(() => {
    const lvl = props.activeLevelId;

    return Object.values(props.elementsById)
      .filter((e): e is Extract<Element, { kind: 'window' }> => e.kind === 'window')

      .map((w) => {
        const lid = wallLevel.get(w.wallId);

        if (lvl && lid && lid !== lvl) return null;

        const lvLab = lid ? (levelLabels.get(lid) ?? lid) : '—';

        return {
          id: w.id,

          name: w.name,

          level: lvLab,

          widthMm: w.widthMm,

          heightMm: w.heightMm,

          sillMm: w.sillHeightMm,

          familyKey: (w.familyTypeId ?? '—').toString(),
        };
      })

      .filter((x): x is NonNullable<typeof x> => Boolean(x))

      .sort(
        (a, b) =>
          a.level.localeCompare(b.level) ||
          String(a.familyKey ?? '').localeCompare(String(b.familyKey ?? '')) ||
          a.widthMm - b.widthMm,
      );
  }, [props.activeLevelId, props.elementsById, levelLabels, wallLevel]);

  const sheets = useMemo(
    () =>
      Object.values(props.elementsById)
        .filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet')

        .map((sh) => ({
          id: sh.id,

          name: sh.name,

          tb: sh.titleBlock ?? '',

          vps: (sh.viewportsMm ?? []).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [props.elementsById],
  );

  const srvActive = !!props.modelId && server && server.tab === tab ? server : null;

  const groupedRooms =
    tab === 'rooms' && srvActive?.data.groupedSections
      ? (srvActive.data.groupedSections as Record<string, Record<string, unknown>[]>)
      : undefined;

  const groupedDoors =
    tab === 'doors' && srvActive?.data.groupedSections
      ? (srvActive.data.groupedSections as Record<string, Record<string, unknown>[]>)
      : undefined;

  const groupedWins =
    tab === 'windows' && srvActive?.data.groupedSections
      ? (srvActive.data.groupedSections as Record<string, Record<string, unknown>[]>)
      : undefined;

  const flatRoomSrv =
    tab === 'rooms' && srvActive && !groupedRooms
      ? roomRowsFromServer((srvActive.data.rows as Record<string, unknown>[]) ?? [])
      : undefined;

  const flatDoorSrv =
    tab === 'doors' && srvActive && !groupedDoors
      ? doorRowsFromServer((srvActive.data.rows as Record<string, unknown>[]) ?? [])
      : undefined;

  const flatWinSrv =
    tab === 'windows' && srvActive && !groupedWins
      ? winRowsFromServer((srvActive.data.rows as Record<string, unknown>[]) ?? [])
      : undefined;

  const roomRows = flatRoomSrv ?? roomRowsLocal;

  const doorRows = flatDoorSrv ?? doorRowsLocal;

  const windowRows = flatWinSrv ?? windowRowsLocal;

  const totals = srvActive
    ? (srvActive.data.totals as Record<string, unknown> | undefined)
    : undefined;

  const roomFinishScheduleEvidenceLines = useMemo(() => {
    if (tab !== 'rooms' || !srvActive?.data) return [];
    return roomFinishScheduleEvidenceReadoutParts(
      (srvActive.data as Record<string, unknown>).roomFinishScheduleEvidence_v1,
    );
  }, [tab, srvActive]);

  const stairScheduleServerEvidenceLines = useMemo(() => {
    if (tab !== 'stairs' || !srvActive?.data) return [];
    return stairScheduleEvidenceReadoutLines(
      flattenSchedulePayloadRows(srvActive.data as Record<string, unknown>),
    );
  }, [tab, srvActive]);

  type GenericDerived = {
    columns: string[];
    fieldLabels: Record<string, string>;
    fieldMeta: Record<string, ScheduleFieldMeta>;
    rows: Record<string, unknown>[];
  };

  const registrySchedule: GenericDerived | null = useMemo(() => {
    if (!registryScheduleTab(tab)) return null;

    if (!srvActive || srvActive.tab !== tab) return null;

    const d = srvActive.data;
    const columns = Array.isArray(d.columns) ? (d.columns as string[]) : [];

    const rawMeta = d.columnMetadata as { fields?: Record<string, ScheduleFieldMeta> } | undefined;
    const fields = rawMeta?.fields ?? {};

    const fieldLabels = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v?.label ?? k]),
    ) as Record<string, string>;

    const rows = flattenSchedulePayloadRows(d);

    const fieldMeta = fields as Record<string, ScheduleFieldMeta>;

    return columns.length ? { columns, fieldLabels, fieldMeta, rows } : null;
  }, [srvActive, tab]);

  const registryPickKey =
    srvActive && registrySchedule && registryScheduleTab(tab) ? srvActive.scheduleId : null;

  const visibleRegistryColumns = useMemo(() => {
    if (!registrySchedule) return [] as string[];
    const all = registrySchedule.columns;
    if (!registryPickKey) return all;
    const persisted = schedulePersistedColumns(registryPickKey);
    const sel = registryVisibleCols[registryPickKey] ?? persisted;
    if (!sel?.length) return all;
    const want = new Set(sel);
    return all.filter((c) => want.has(c));
  }, [registrySchedule, registryPickKey, registryVisibleCols, schedulePersistedColumns]);

  const registryTableModelV1: ScheduleTableModelV1 | null = useMemo(() => {
    if (!registryScheduleTab(tab)) {
      return null;
    }

    if (!srvActive || srvActive.tab !== tab) return null;

    const d = srvActive.data as Record<string, unknown>;
    const cols = Array.isArray(d.columns) ? (d.columns as string[]) : [];
    if (!cols.length) return null;

    return buildScheduleTableModelV1({
      payload: d,
      visibleColumnKeys: visibleRegistryColumns.length ? visibleRegistryColumns : undefined,
    });
  }, [srvActive, tab, visibleRegistryColumns]);

  const scheduleBudgetHydrationForStore = useMemo((): { tab: string; rowCount: number } | null => {
    if (registryScheduleTab(tab)) {
      if (!props.modelId || !sidForTab) return null;
      if (serverErr) return null;
      if (!srvActive || srvActive.tab !== tab) return null;
      const n = registryTableModelV1?.bodyRows.length ?? 0;
      return { tab, rowCount: n };
    }
    if (tab === 'rooms') {
      if (groupedRooms && Object.keys(groupedRooms).length > 0) {
        const n = Object.values(groupedRooms).reduce(
          (acc, rows) => acc + (Array.isArray(rows) ? rows.length : 0),
          0,
        );
        return { tab, rowCount: n };
      }
      return { tab, rowCount: roomRows.length };
    }
    if (tab === 'doors') {
      if (groupedDoors && Object.keys(groupedDoors).length > 0) {
        const n = Object.values(groupedDoors).reduce(
          (acc, rows) => acc + (Array.isArray(rows) ? rows.length : 0),
          0,
        );
        return { tab, rowCount: n };
      }
      return { tab, rowCount: doorRows.length };
    }
    if (tab === 'windows') {
      if (groupedWins && Object.keys(groupedWins).length > 0) {
        const n = Object.values(groupedWins).reduce(
          (acc, rows) => acc + (Array.isArray(rows) ? rows.length : 0),
          0,
        );
        return { tab, rowCount: n };
      }
      return { tab, rowCount: windowRows.length };
    }
    return null;
  }, [
    tab,
    props.modelId,
    sidForTab,
    serverErr,
    srvActive,
    registryTableModelV1,
    groupedRooms,
    groupedDoors,
    groupedWins,
    roomRows,
    doorRows,
    windowRows,
  ]);

  const setScheduleBudgetHydration = useBimStore((s) => s.setScheduleBudgetHydration);

  useEffect(() => {
    setScheduleBudgetHydration(scheduleBudgetHydrationForStore);
  }, [scheduleBudgetHydrationForStore, setScheduleBudgetHydration]);

  function toggleRegistryColumn(columnKey: string) {
    if (!registryPickKey || !registrySchedule) return;
    const all = registrySchedule.columns;
    const persisted = schedulePersistedColumns(registryPickKey);
    setRegistryVisibleCols((prev) => {
      const curSel = [...(prev[registryPickKey] ?? persisted ?? all)];
      const has = curSel.includes(columnKey);
      let nextSel = has ? curSel.filter((c) => c !== columnKey) : [...curSel, columnKey];
      if (!nextSel.length) nextSel = [...all];
      nextSel.sort((a, b) => all.indexOf(a) - all.indexOf(b));
      const filtered = nextSel.filter((c) => all.includes(c));
      const el = props.elementsById[registryPickKey];
      if (el?.kind === 'schedule' && props.onScheduleFiltersCommit) {
        const prevF = (el.filters ?? {}) as Record<string, unknown>;
        props.onScheduleFiltersCommit(registryPickKey, {
          ...prevF,
          displayColumnKeys: filtered,
        });
      }
      return { ...prev, [registryPickKey]: filtered };
    });
  }

  function csvForTab(): string {
    if (tab === 'rooms')
      return [
        ['Name', 'Level', 'Id', 'Area(m²)', 'Tgt(m²)', 'Δ(m²)', 'Perimeter(m)'],
        ...roomRows.map((r) => [
          r.name,
          r.level,
          r.id,
          r.areaM2.toFixed(2),
          fmtRoomScheduleOptM2(r.targetAreaM2),
          fmtRoomScheduleOptM2(r.areaDeltaM2),
          r.perM.toFixed(2),
        ]),
      ]
        .map((line) => line.map((cell) => `"${cell}"`).join(','))
        .join('\n');

    if (tab === 'doors')
      return [
        ['Name', 'Level', 'Width(mm)', 'FamilyType', 'Id'],
        ...doorRows.map((r) => [r.name, r.level, String(r.widthMm), r.familyKey, r.id]),
      ]
        .map((line) => line.map((cell) => `"${cell}"`).join(','))
        .join('\n');

    if (tab === 'windows')
      return [
        ['Name', 'Level', 'Width(mm)', 'Height(mm)', 'Sill(mm)', 'FamilyType', 'Id'],
        ...windowRows.map((r) => [
          r.name,
          r.level,
          String(r.widthMm),
          String(r.heightMm),
          String(r.sillMm),
          r.familyKey,
          r.id,
        ]),
      ]
        .map((line) => line.map((cell) => `"${cell}"`).join(','))
        .join('\n');

    return [
      ['Sheet', 'Titleblock', '#Viewports', 'Id'],
      ...sheets.map((s) => [s.name, s.tb, String(s.vps), s.id]),
    ]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))

      .join('\n');
  }

  function scheduleExportColumnSubset(): string[] | undefined {
    if (!srvActive?.scheduleId || !props.modelId || srvActive.tab !== tab) return undefined;
    const d = srvActive.data as Record<string, unknown>;
    const allCols = Array.isArray(d.columns) ? (d.columns as string[]) : [];
    if (!allCols.length) return undefined;
    const persisted = schedulePersistedColumns(srvActive.scheduleId);
    const sel = registryVisibleCols[srvActive.scheduleId] ?? persisted;
    if (!sel?.length) return undefined;
    const filtered = sel.filter((c) => allCols.includes(c));
    if (!filtered.length || filtered.length >= allCols.length) return undefined;
    return filtered;
  }

  async function downloadCsv() {
    if (srvActive?.scheduleId && props.modelId && srvActive.tab === tab) {
      const subset = scheduleExportColumnSubset();
      const csvEndpoint = buildScheduleTableCsvUrl(props.modelId, srvActive.scheduleId, {
        columns: subset,
        includeScheduleTotalsCsv: true,
      });
      const res = await fetch(csvEndpoint);
      const body = await res.text();
      if (!res.ok) {
        alert(body);
        return;
      }

      const ext =
        tab === 'windows'
          ? 'window'
          : tab === 'doors'
            ? 'door'
            : tab === 'floors'
              ? 'floor'
              : tab === 'roofs'
                ? 'roof'
                : tab === 'stairs'
                  ? 'stair'
                  : tab === 'plans'
                    ? 'plan_view'
                    : tab === 'sheets'
                      ? 'sheet'
                      : tab === 'assemblies'
                        ? 'assembly'
                        : 'room';

      const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });

      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = objectUrl;

      a.download = `bim-ai-schedule-${ext}-server.csv`;

      a.click();

      URL.revokeObjectURL(objectUrl);
      return;
    }

    const ext =
      tab === 'windows'
        ? 'window'
        : tab === 'doors'
          ? 'door'
          : tab === 'sheets'
            ? 'sheet'
            : tab === 'assemblies'
              ? 'assembly'
              : 'room';

    const blob = new Blob([csvForTab()], { type: 'text/csv;charset=utf-8' });

    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = objectUrl;

    a.download = `bim-ai-${ext}-schedule.csv`;

    a.click();

    URL.revokeObjectURL(objectUrl);
  }

  async function copyScheduleToClipboard() {
    const csv = csvForTab();
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(csv);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  function renderTotals(footerPartsOverride?: string[]) {
    const parts =
      footerPartsOverride !== undefined
        ? footerPartsOverride
        : totals
          ? scheduleTotalsReadoutParts(totals)
          : [];

    if (!parts.length) return null;

    return (
      <div
        data-testid="schedule-totals"
        className="mt-2 rounded border border-border/60 px-2 py-1 font-mono text-[10px] text-muted"
      >
        {parts.join(' · ')}
      </div>
    );
  }

  function renderGroupedRooms(grp: Record<string, Record<string, unknown>[]>) {
    const keys = Object.keys(grp).sort((a, b) => a.localeCompare(b));

    return (
      <div className="space-y-2" data-testid="schedule-grouped">
        {keys.map((k) => {
          const prow = grp[k]!;
          const rowsVm = roomRowsFromServer(Array.isArray(prow) ? prow : []);
          return (
            <div key={k}>
              <div className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-muted">
                {k}
              </div>
              <VirtualScrollRows
                maxHeightPx={Math.min(SCHED_TABLE_VIEWPORT_PX, SCHED_TABLE_ROW_PX * rowsVm.length)}
                rowHeightPx={SCHED_TABLE_ROW_PX}
                colSpan={ROOM_SCHED_COLSPAN}
                rows={rowsVm}
                header={
                  <tr>
                    <th>Name</th>
                    <th>Level</th>
                    <th className="text-right">A m²</th>
                    <th className="text-right">Tgt m²</th>
                    <th className="text-right">Δ m²</th>
                    <th className="text-right">Edge m</th>
                  </tr>
                }
                renderRow={(r) => (
                  <tr className="border-t border-border/60">
                    <td>{r.name}</td>
                    <td className="text-muted">{r.level}</td>
                    <td className="text-right">{r.areaM2.toFixed(2)}</td>
                    <td className="text-right">{fmtRoomScheduleOptM2(r.targetAreaM2)}</td>
                    <td className="text-right">{fmtRoomScheduleOptM2(r.areaDeltaM2)}</td>
                    <td className="text-right">{r.perM.toFixed(2)}</td>
                  </tr>
                )}
              />
            </div>
          );
        })}
      </div>
    );
  }

  function renderGroupedDoorsOrWindows(
    grp: Record<string, Record<string, unknown>[]>,
    which: 'door' | 'window',
  ) {
    const keys = Object.keys(grp).sort((a, b) => a.localeCompare(b));

    if (which === 'door')
      return (
        <div className="space-y-2">
          {keys.map((k) => {
            const prow = grp[k]!;
            const rowsVm = doorRowsFromServer(Array.isArray(prow) ? prow : []);

            return (
              <div key={k}>
                <div className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {k}
                </div>
                <VirtualScrollRows
                  maxHeightPx={Math.min(
                    SCHED_TABLE_VIEWPORT_PX,
                    SCHED_TABLE_ROW_PX * rowsVm.length,
                  )}
                  rowHeightPx={SCHED_TABLE_ROW_PX}
                  colSpan={4}
                  rows={rowsVm}
                  header={
                    <tr>
                      <th>Name</th>
                      <th>Level</th>
                      <th className="text-right">W mm</th>
                      <th>Type</th>
                    </tr>
                  }
                  renderRow={(r) => (
                    <tr className="border-t border-border/60">
                      <td>{r.name}</td>
                      <td className="text-muted">{r.level}</td>
                      <td className="text-right">{r.widthMm}</td>
                      <td className="text-[10px] text-muted">{r.familyKey}</td>
                    </tr>
                  )}
                />
              </div>
            );
          })}
        </div>
      );

    return (
      <div className="space-y-2">
        {keys.map((k) => {
          const prow = grp[k]!;
          const rowsVm = winRowsFromServer(Array.isArray(prow) ? prow : []);

          return (
            <div key={k}>
              <div className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-muted">
                {k}
              </div>

              <VirtualScrollRows
                maxHeightPx={Math.min(SCHED_TABLE_VIEWPORT_PX, SCHED_TABLE_ROW_PX * rowsVm.length)}
                rowHeightPx={SCHED_TABLE_ROW_PX}
                colSpan={6}
                rows={rowsVm}
                header={
                  <tr>
                    <th>Name</th>
                    <th>Level</th>
                    <th className="text-right">W mm</th>
                    <th className="text-right">H mm</th>
                    <th className="text-right">Sill</th>
                    <th>Type</th>
                  </tr>
                }
                renderRow={(r) => (
                  <tr className="border-t border-border/60">
                    <td>{r.name}</td>
                    <td className="text-muted">{r.level}</td>
                    <td className="text-right">{r.widthMm}</td>
                    <td className="text-right">{r.heightMm}</td>
                    <td className="text-right">{r.sillMm}</td>
                    <td className="text-[10px] text-muted">{r.familyKey}</td>
                  </tr>
                )}
              />
            </div>
          );
        })}
      </div>
    );
  }

  const csvUsesServerEndpoint = Boolean(
    srvActive?.scheduleId && props.modelId && srvActive.tab === tab,
  );

  return (
    <div
      data-testid="schedule-panel"
      className="rounded border bg-surface p-4"
      {...(srvActive ? { 'data-schedule-derived': 'server' } : {})}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold">Schedules</div>

        {srvActive ? (
          <span
            data-testid="schedule-server-derived"
            className="rounded border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] text-muted"
          >
            server rows
          </span>
        ) : null}

        <div className="ms-auto flex flex-wrap gap-1">
          {(
            [
              ['rooms', 'Rooms'],
              ['doors', 'Doors'],
              ['windows', 'Windows'],
              ['finishes', 'Finishes'],
              ['floors', 'Floors'],
              ['roofs', 'Roofs'],
              ['stairs', 'Stairs'],
              ['plans', 'Plans'],
              ['views', 'Views'],
              ['sheets', 'Sheets'],
              ['assemblies', 'Assemblies'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={[
                'rounded px-2 py-0.5 text-[10px]',

                tab === k ? 'bg-accent/30 font-semibold' : 'border border-transparent text-muted',
              ].join(' ')}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="text-[11px] text-accent"
          title={
            csvUsesServerEndpoint
              ? 'Download CSV from the server schedule table (includes totals row when available)'
              : 'Build CSV from the visible client snapshot (limited columns)'
          }
          aria-label={
            csvUsesServerEndpoint
              ? 'Download server schedule CSV with totals'
              : 'Download local schedule CSV snapshot'
          }
          onClick={() => void downloadCsv()}
        >
          CSV
        </button>
        <button
          type="button"
          className="text-[11px] text-accent"
          title="Copy schedule to clipboard as CSV"
          aria-label="Copy schedule CSV to clipboard"
          onClick={() => void copyScheduleToClipboard()}
        >
          Copy
        </button>
      </div>

      <ScheduleRegistryChrome srvActive={srvActive} />
      {serverErr ? <div className="mt-2 text-[10px] text-amber-500">{serverErr}</div> : null}

      <ScheduleDefinitionPresetsStrip
        tab={tab}
        srvActive={srvActive}
        modelId={props.modelId}
        elementsById={props.elementsById}
        onScheduleFiltersCommit={props.onScheduleFiltersCommit}
        presetIdByCategory={presetIdByCategory}
        setPresetIdByCategory={setPresetIdByCategory}
        sidForTab={sidForTab}
        setRegistryVisibleCols={setRegistryVisibleCols}
      />
      {scheduleOpeningAdvisoryLines.length ? (
        <div
          data-testid="schedule-opening-advisories-readout"
          className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400/90"
        >
          <div className="font-semibold text-foreground/90">Opening schedule advisories</div>
          <ul className="mt-1 list-disc space-y-0.5 ps-4 font-mono leading-snug">
            {scheduleOpeningAdvisoryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {scheduleSheetExportParityAdvisoryLines.length ? (
        <div
          data-testid="schedule-sheet-export-parity-advisories-readout"
          className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400/90"
        >
          <div className="font-semibold text-foreground/90">
            Schedule sheet export parity advisories
          </div>
          <ul className="mt-1 list-disc space-y-0.5 ps-4 font-mono leading-snug">
            {scheduleSheetExportParityAdvisoryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.onScheduleFiltersCommit &&
      sidForTab &&
      srvActive?.scheduleId === sidForTab &&
      props.modelId ? (
        <ScheduleDefinitionToolbar
          tab={tab}
          scheduleId={sidForTab}
          srvActive={srvActive}
          modelId={props.modelId}
          elementsById={props.elementsById}
          activeLevelId={props.activeLevelId}
          onScheduleFiltersCommit={props.onScheduleFiltersCommit}
        />
      ) : null}
      {tab === 'rooms' ? (
        groupedRooms && Object.keys(groupedRooms).length > 0 ? (
          <div className="mt-3">
            {renderGroupedRooms(groupedRooms)}
            {renderTotals()}
          </div>
        ) : !roomRows.length ? (
          <div className="mt-3 text-[11px] text-muted">No rooms on this level yet.</div>
        ) : (
          <div className="mt-2">
            <VirtualScrollRows
              maxHeightPx={SCHED_TABLE_VIEWPORT_PX}
              rowHeightPx={SCHED_TABLE_ROW_PX}
              colSpan={ROOM_SCHED_COLSPAN}
              rows={roomRows}
              header={
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th className="text-right">A m²</th>
                  <th className="text-right">Tgt m²</th>
                  <th className="text-right">Δ m²</th>
                  <th className="text-right">Edge m</th>
                </tr>
              }
              renderRow={(r) => (
                <tr className="border-t border-border/60">
                  <td>{r.name}</td>
                  <td className="text-muted">{r.level}</td>
                  <td className="text-right">{r.areaM2.toFixed(2)}</td>
                  <td className="text-right">{fmtRoomScheduleOptM2(r.targetAreaM2)}</td>
                  <td className="text-right">{fmtRoomScheduleOptM2(r.areaDeltaM2)}</td>
                  <td className="text-right">{r.perM.toFixed(2)}</td>
                </tr>
              )}
            />
            {srvActive ? renderTotals() : null}
          </div>
        )
      ) : null}

      {tab === 'rooms' && roomFinishScheduleEvidenceLines.length ? (
        <div
          data-testid="room-finish-schedule-evidence-readout"
          className="mt-2 rounded border border-border/60 px-2 py-1.5 text-[10px] text-muted"
        >
          <div className="font-semibold text-foreground/90">Room finish schedule evidence</div>
          <div className="mt-0.5 font-mono leading-snug">
            {roomFinishScheduleEvidenceLines.join(' · ')}
          </div>
        </div>
      ) : null}

      {tab === 'doors' ? (
        groupedDoors && Object.keys(groupedDoors).length > 0 ? (
          <div className="mt-3">
            {renderGroupedDoorsOrWindows(groupedDoors, 'door')}
            {renderTotals()}
          </div>
        ) : !doorRows.length ? (
          <div className="mt-3 text-[11px] text-muted">No doors in this projection.</div>
        ) : (
          <div className="mt-2">
            <VirtualScrollRows
              maxHeightPx={SCHED_TABLE_VIEWPORT_PX}
              rowHeightPx={SCHED_TABLE_ROW_PX}
              colSpan={4}
              rows={doorRows}
              header={
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th className="text-right">W mm</th>
                  <th>Type</th>
                </tr>
              }
              renderRow={(r) => (
                <tr className="border-t border-border/60">
                  <td>{r.name}</td>
                  <td className="text-muted">{r.level}</td>
                  <td className="text-right">{r.widthMm}</td>
                  <td className="text-[10px] text-muted">{r.familyKey}</td>
                </tr>
              )}
            />
            {srvActive ? renderTotals() : null}
          </div>
        )
      ) : null}

      {tab === 'windows' ? (
        groupedWins && Object.keys(groupedWins).length > 0 ? (
          <div className="mt-3">
            {renderGroupedDoorsOrWindows(groupedWins, 'window')}
            {renderTotals()}
          </div>
        ) : !windowRows.length ? (
          <div className="mt-3 text-[11px] text-muted">No windows in this projection.</div>
        ) : (
          <div className="mt-2">
            <VirtualScrollRows
              maxHeightPx={SCHED_TABLE_VIEWPORT_PX}
              rowHeightPx={SCHED_TABLE_ROW_PX}
              colSpan={6}
              rows={windowRows}
              header={
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th className="text-right">W mm</th>
                  <th className="text-right">H mm</th>
                  <th className="text-right">Sill</th>
                  <th>Type</th>
                </tr>
              }
              renderRow={(r) => (
                <tr className="border-t border-border/60">
                  <td>{r.name}</td>
                  <td className="text-muted">{r.level}</td>
                  <td className="text-right">{r.widthMm}</td>
                  <td className="text-right">{r.heightMm}</td>
                  <td className="text-right">{r.sillMm}</td>
                  <td className="text-[10px] text-muted">{r.familyKey}</td>
                </tr>
              )}
            />
            {srvActive ? renderTotals() : null}
          </div>
        )
      ) : null}

      {tab === 'floors' ||
      tab === 'finishes' ||
      tab === 'roofs' ||
      tab === 'stairs' ||
      tab === 'plans' ||
      tab === 'views' ||
      tab === 'sheets' ||
      tab === 'assemblies' ? (
        !props.modelId ? (
          tab === 'sheets' ? (
            registryNoModelMode(sheets.length) === 'sheetsLocal' ? (
              <ul className="mt-2 space-y-1 text-[11px]">
                {sheets.map((s) => (
                  <li key={s.id} className="rounded border border-border/50 px-2 py-1">
                    <div className="font-medium">{s.name}</div>

                    <div className="text-muted">
                      TB {s.tb || '—'} · VP {s.vps} <span className="opacity-75">[{s.id}]</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 text-[11px] text-muted">{MSG_NO_SHEET_ELEMENTS}</div>
            )
          ) : (
            <div className="mt-3 text-[11px] text-muted">{MSG_OPEN_SAVED_MODEL}</div>
          )
        ) : !sidForTab ? (
          <div className="mt-3 text-[11px] text-muted">
            {noScheduleElementMessage(tab as RegistryModelTab)}
          </div>
        ) : serverErr ? null : srvActive?.tab !== tab ? (
          <div className="mt-3 text-[11px] text-muted">{MSG_LOADING}</div>
        ) : registryTableModelV1 ? (
          <div className="mt-2">
            <RegistryColumnPicker
              registryPickKey={registryPickKey}
              registrySchedule={registrySchedule}
              visibleRegistryColumns={visibleRegistryColumns}
              onToggleColumn={toggleRegistryColumn}
            />
            <ScheduleRegistryTable model={registryTableModelV1} />
            {renderTotals(registryTableModelV1.footerParts)}
            {tab === 'stairs' && stairScheduleServerEvidenceLines.length ? (
              <div
                data-testid="stair-schedule-evidence-readout"
                className="mt-2 rounded border border-border/60 px-2 py-1.5 text-[10px] text-muted"
              >
                <div className="font-semibold text-foreground/90">Stair schedule evidence</div>
                <ul className="mt-1 list-disc space-y-0.5 ps-4 font-mono leading-snug">
                  {stairScheduleServerEvidenceLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 text-[11px] text-muted">{MSG_NO_ROWS}</div>
        )
      ) : null}
    </div>
  );
}
