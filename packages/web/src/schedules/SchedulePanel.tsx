import { useEffect, useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';

import { VirtualScrollRows } from './VirtualScrollRows';

type TabKey = 'rooms' | 'doors' | 'windows' | 'floors' | 'roofs' | 'stairs' | 'plans' | 'sheets';

const SCHED_TABLE_ROW_PX = 28;
const SCHED_TABLE_VIEWPORT_PX = 220;

function findScheduleIdForCategory(
  elementsById: Record<string, Element>,
  category: string,
): string | undefined {
  let best: string | undefined;

  for (const e of Object.values(elementsById)) {
    if (e.kind !== 'schedule') continue;
    const f = e.filters ?? {};
    const c = String(
      (f as { category?: string }).category ?? (f as { Category?: string }).Category ?? '',
    ).toLowerCase();
    if (c !== category) continue;
    if (!best || e.id.localeCompare(best) < 0) best = e.id;
  }

  return best;
}

function formatScheduleCell(v: unknown): string {
  if (v == null || v === '') return '—';

  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);

  return String(v);
}

/** Flat rows from derived schedule payload (ungrouped or grouped). */
function flattenSchedulePayloadRows(data: Record<string, unknown>): Record<string, unknown>[] {
  const rows = data.rows;

  if (Array.isArray(rows)) return rows as Record<string, unknown>[];

  const gs = data.groupedSections as Record<string, unknown[]> | undefined;

  if (gs && typeof gs === 'object') {
    const out: Record<string, unknown>[] = [];

    for (const v of Object.values(gs)) {
      if (Array.isArray(v)) out.push(...(v as Record<string, unknown>[]));
    }

    return out;
  }

  return [];
}

type RoomVm = {
  id: string;
  name: string;
  level: string;
  areaM2: number;
  perM: number;
};

type DoorVm = {
  id: string;
  name: string;
  level: string;
  widthMm: number;
  familyKey: string;
};

type WinVm = {
  id: string;
  name: string;
  level: string;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  familyKey: string;
};

function roomRowsFromServer(rows: Record<string, unknown>[]): RoomVm[] {
  return rows.map((r, i) => ({
    id: String(r.elementId ?? r.element_id ?? `srv-room-${i}`),
    name: String(r.name ?? ''),
    level: String(r.level ?? r.levelId ?? r.level_id ?? ''),
    areaM2: Number(r.areaM2 ?? r.area_m2 ?? 0),
    perM: Number(r.perimeterM ?? r.perimeter_m ?? 0),
  }));
}

function doorRowsFromServer(rows: Record<string, unknown>[]): DoorVm[] {
  return rows.map((r, i) => ({
    id: String(r.elementId ?? r.element_id ?? `srv-door-${i}`),
    name: String(r.name ?? ''),
    level: String(r.level ?? ''),
    widthMm: Number(r.widthMm ?? r.width_mm ?? 0),
    familyKey: String(r.familyTypeId ?? r.family_type_id ?? '—'),
  }));
}

function winRowsFromServer(rows: Record<string, unknown>[]): WinVm[] {
  return rows.map((r, i) => ({
    id: String(r.elementId ?? r.element_id ?? `srv-win-${i}`),
    name: String(r.name ?? ''),
    level: String(r.level ?? ''),
    widthMm: Number(r.widthMm ?? r.width_mm ?? 0),
    heightMm: Number(r.heightMm ?? r.height_mm ?? 0),
    sillMm: Number(r.sillMm ?? r.sill_mm ?? 0),
    familyKey: String(r.familyTypeId ?? r.family_type_id ?? '—'),
  }));
}

/** Roll-up schedules — prefer server-derived schedule tables where `schedule` elements exist. */

export function SchedulePanel(props: {
  modelId?: string;
  elementsById: Record<string, Element>;
  activeLevelId?: string;
}) {
  const [tab, setTab] = useState<TabKey>('rooms');
  const [server, setServer] = useState<{
    tab: TabKey;
    scheduleId: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const [registryVisibleCols, setRegistryVisibleCols] = useState<Record<string, string[]>>({});

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
  const sidSheets = useMemo(
    () => findScheduleIdForCategory(props.elementsById, 'sheet'),
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
      case 'floors':
        return sidFloors;
      case 'roofs':
        return sidRoofs;
      case 'stairs':
        return sidStairs;
      case 'plans':
        return sidPlans;
      case 'sheets':
        return sidSheets;
      default:
        return undefined;
    }
  }, [tab, sidRooms, sidDoors, sidWins, sidFloors, sidRoofs, sidStairs, sidPlans, sidSheets]);

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

        return {
          id: r.id,

          level: lv,

          name: r.name,

          areaM2: a,

          perM: per,
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

  type GenericDerived = {
    columns: string[];
    fieldLabels: Record<string, string>;
    rows: Record<string, unknown>[];
  };

  const registrySchedule: GenericDerived | null = useMemo(() => {
    if (
      tab !== 'floors' &&
      tab !== 'roofs' &&
      tab !== 'stairs' &&
      tab !== 'plans' &&
      tab !== 'sheets'
    )
      return null;

    if (!srvActive || srvActive.tab !== tab) return null;

    const d = srvActive.data;
    const columns = Array.isArray(d.columns) ? (d.columns as string[]) : [];

    const rawMeta = d.columnMetadata as { fields?: Record<string, { label?: string }> } | undefined;
    const fields = rawMeta?.fields ?? {};

    const fieldLabels = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v?.label ?? k]),
    ) as Record<string, string>;

    const rows = flattenSchedulePayloadRows(d);

    return columns.length ? { columns, fieldLabels, rows } : null;
  }, [srvActive, tab]);

  const registryPickKey =
    srvActive &&
    registrySchedule &&
    (tab === 'floors' || tab === 'roofs' || tab === 'stairs' || tab === 'plans' || tab === 'sheets')
      ? srvActive.scheduleId
      : null;

  const visibleRegistryColumns = useMemo(() => {
    if (!registrySchedule) return [] as string[];
    const all = registrySchedule.columns;
    if (!registryPickKey) return all;
    const sel = registryVisibleCols[registryPickKey];
    if (!sel?.length) return all;
    const want = new Set(sel);
    return all.filter((c) => want.has(c));
  }, [registrySchedule, registryPickKey, registryVisibleCols]);

  function toggleRegistryColumn(columnKey: string) {
    if (!registryPickKey || !registrySchedule) return;
    const all = registrySchedule.columns;
    setRegistryVisibleCols((prev) => {
      const curSel = [...(prev[registryPickKey] ?? all)];
      const has = curSel.includes(columnKey);
      const nextSel = has ? curSel.filter((c) => c !== columnKey) : [...curSel, columnKey];
      if (!nextSel.length) return { ...prev, [registryPickKey]: [...all] };
      nextSel.sort((a, b) => all.indexOf(a) - all.indexOf(b));
      return { ...prev, [registryPickKey]: nextSel.filter((c) => all.includes(c)) };
    });
  }

  function renderRegistryColumnPicker() {
    if (!registryPickKey || !registrySchedule || registrySchedule.columns.length < 2) return null;
    return (
      <div
        data-testid="schedule-column-picker"
        className="mb-2 flex flex-wrap gap-2 border-b border-border/40 pb-2 text-[10px] text-muted"
      >
        <span className="font-semibold text-foreground">Columns</span>
        {registrySchedule.columns.map((c) => {
          const on = visibleRegistryColumns.includes(c);
          return (
            <label key={c} className="flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={on} onChange={() => toggleRegistryColumn(c)} />
              <span>{registrySchedule.fieldLabels[c] ?? c}</span>
            </label>
          );
        })}
      </div>
    );
  }

  function csvForTab(): string {
    if (tab === 'rooms')
      return [
        ['Name', 'Level', 'Id', 'Area(m²)', 'Perimeter(m)'],
        ...roomRows.map((r) => [r.name, r.level, r.id, r.areaM2.toFixed(2), r.perM.toFixed(2)]),
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

  async function downloadCsv() {
    if (srvActive?.scheduleId && props.modelId && srvActive.tab === tab) {
      const mid = encodeURIComponent(props.modelId);
      const sc = encodeURIComponent(srvActive.scheduleId);
      let csvEndpoint = `/api/models/${mid}/schedules/${sc}/table?format=csv`;
      if (
        registrySchedule &&
        srvActive.scheduleId === registryPickKey &&
        visibleRegistryColumns.length > 0 &&
        visibleRegistryColumns.length < registrySchedule.columns.length
      ) {
        const cq = visibleRegistryColumns.map(encodeURIComponent).join(',');
        csvEndpoint += `&columns=${cq}`;
      }
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
      tab === 'windows' ? 'window' : tab === 'doors' ? 'door' : tab === 'sheets' ? 'sheet' : 'room';

    const blob = new Blob([csvForTab()], { type: 'text/csv;charset=utf-8' });

    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = objectUrl;

    a.download = `bim-ai-${ext}-schedule.csv`;

    a.click();

    URL.revokeObjectURL(objectUrl);
  }

  function renderTotals() {
    if (!totals) return null;

    const kind = String(totals.kind ?? '');

    const parts: string[] = [];

    parts.push(`${totals.rowCount ?? totals.row_count ?? '?'} rows`);

    if (kind === 'room') {
      parts.push(`sum area ${Number(totals.areaM2 ?? 0).toFixed(3)} m2`);
      parts.push(`sum perimeter ${Number(totals.perimeterM ?? 0).toFixed(3)} m`);
    }

    if (kind === 'window')
      parts.push(`avg width ${Number(totals.averageWidthMm ?? 0).toFixed(1)} mm`);

    if (kind === 'floor') parts.push(`sum area ${Number(totals.areaM2 ?? 0).toFixed(3)} m²`);

    if (kind === 'roof')
      parts.push(`footprint ${Number(totals.footprintAreaM2 ?? 0).toFixed(3)} m²`);

    if (kind === 'stair') parts.push(`total run ${Number(totals.totalRunMm ?? 0).toFixed(1)} mm`);

    if (kind === 'sheet') parts.push(`viewports ${Number(totals.totalViewports ?? 0)}`);

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
                colSpan={4}
                rows={rowsVm}
                header={
                  <tr>
                    <th>Name</th>
                    <th>Level</th>
                    <th className="text-right">A m²</th>
                    <th className="text-right">Edge m</th>
                  </tr>
                }
                renderRow={(r) => (
                  <tr className="border-t border-border/60">
                    <td>{r.name}</td>
                    <td className="text-muted">{r.level}</td>
                    <td className="text-right">{r.areaM2.toFixed(2)}</td>
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

  function renderRegistryScheduleTable(g: GenericDerived, columnKeys: string[]) {
    const cols = columnKeys.length ? columnKeys : g.columns;
    const headers = cols.map((c) => g.fieldLabels[c] ?? c);

    const rowsKeyed: Array<Record<string, unknown> & { id: string }> = g.rows.map((r, i) => ({
      ...r,
      id: String(r.elementId ?? (r as { element_id?: string }).element_id ?? `row-${i}`),
    }));

    return (
      <div data-testid="schedule-registry-table">
        <VirtualScrollRows<Record<string, unknown> & { id: string }>
          maxHeightPx={Math.min(
            SCHED_TABLE_VIEWPORT_PX,
            SCHED_TABLE_ROW_PX * Math.max(rowsKeyed.length, 1),
          )}
          rowHeightPx={SCHED_TABLE_ROW_PX}
          colSpan={cols.length}
          rows={rowsKeyed}
          header={
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left text-[10px] font-normal">
                  {h}
                </th>
              ))}
            </tr>
          }
          renderRow={(r) => (
            <tr className="border-t border-border/60">
              {cols.map((c) => (
                <td key={c} className="max-w-[140px] truncate text-[10px]">
                  {formatScheduleCell(r[c])}
                </td>
              ))}
            </tr>
          )}
        />
      </div>
    );
  }

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

        {srvActive?.data.scheduleEngine ? (
          <span
            data-testid="schedule-engine-meta"
            className="rounded border border-border/50 px-1.5 py-0.5 text-[9px] text-muted"
            title="scheduleDerivationEngine_v1 metadata"
          >
            {String(
              (srvActive.data.scheduleEngine as { format?: string }).format ?? 'scheduleEngine',
            )}
            {(() => {
              const sb = (srvActive.data.scheduleEngine as { sortBy?: unknown }).sortBy;

              return sb ? ` · sort:${String(sb)}` : '';
            })()}
          </span>
        ) : null}

        <div className="ms-auto flex flex-wrap gap-1">
          {(
            [
              ['rooms', 'Rooms'],
              ['doors', 'Doors'],
              ['windows', 'Windows'],
              ['floors', 'Floors'],
              ['roofs', 'Roofs'],
              ['stairs', 'Stairs'],
              ['plans', 'Plans'],
              ['sheets', 'Sheets'],
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
          onClick={() => void downloadCsv()}
        >
          CSV
        </button>
      </div>

      {serverErr ? <div className="mt-2 text-[10px] text-amber-500">{serverErr}</div> : null}

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
              colSpan={4}
              rows={roomRows}
              header={
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th className="text-right">A m²</th>
                  <th className="text-right">Edge m</th>
                </tr>
              }
              renderRow={(r) => (
                <tr className="border-t border-border/60">
                  <td>{r.name}</td>
                  <td className="text-muted">{r.level}</td>
                  <td className="text-right">{r.areaM2.toFixed(2)}</td>
                  <td className="text-right">{r.perM.toFixed(2)}</td>
                </tr>
              )}
            />
            {srvActive ? renderTotals() : null}
          </div>
        )
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

      {tab === 'floors' || tab === 'roofs' || tab === 'stairs' || tab === 'plans' ? (
        !props.modelId ? (
          <div className="mt-3 text-[11px] text-muted">
            Open a saved model to load server schedules.
          </div>
        ) : !sidForTab ? (
          <div className="mt-3 text-[11px] text-muted">
            No{' '}
            {tab === 'plans'
              ? 'plan view'
              : tab === 'floors'
                ? 'floor'
                : tab === 'roofs'
                  ? 'roof'
                  : 'stair'}{' '}
            schedule element in this model.
          </div>
        ) : serverErr ? null : srvActive?.tab !== tab ? (
          <div className="mt-3 text-[11px] text-muted">Loading schedule…</div>
        ) : registrySchedule && registrySchedule.rows.length > 0 ? (
          <div className="mt-2">
            {renderRegistryColumnPicker()}
            {renderRegistryScheduleTable(registrySchedule, visibleRegistryColumns)}
            {renderTotals()}
          </div>
        ) : (
          <div className="mt-3 text-[11px] text-muted">No rows in this schedule.</div>
        )
      ) : null}

      {tab === 'sheets' ? (
        props.modelId &&
        sidSheets &&
        !serverErr &&
        srvActive?.tab === 'sheets' &&
        registrySchedule &&
        registrySchedule.rows.length > 0 ? (
          <div className="mt-2">
            {renderRegistryColumnPicker()}
            {renderRegistryScheduleTable(registrySchedule, visibleRegistryColumns)}
            {renderTotals()}
          </div>
        ) : props.modelId && sidSheets && !serverErr && srvActive?.tab !== 'sheets' ? (
          <div className="mt-3 text-[11px] text-muted">Loading schedule…</div>
        ) : !sheets.length ? (
          <div className="mt-3 text-[11px] text-muted">No sheet elements yet.</div>
        ) : (
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
        )
      ) : null}
    </div>
  );
}
