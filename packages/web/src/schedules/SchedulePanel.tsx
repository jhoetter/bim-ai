import { useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';

import { VirtualScrollRows } from './VirtualScrollRows';

type TabKey = 'rooms' | 'doors' | 'windows' | 'sheets';

const SCHED_TABLE_ROW_PX = 28;
const SCHED_TABLE_VIEWPORT_PX = 220;

/** Roll-up schedules derived from semantic elements (projection layer for UI). */

export function SchedulePanel(props: {
  elementsById: Record<string, Element>;
  activeLevelId?: string;
}) {
  const [tab, setTab] = useState<TabKey>('rooms');

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

  const roomRows = useMemo(() => {
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

  const doorRows = useMemo(() => {
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

  const windowRows = useMemo(() => {
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

  function downloadCsv() {
    const ext =
      tab === 'windows' ? 'window' : tab === 'doors' ? 'door' : tab === 'sheets' ? 'sheet' : 'room';

    const blob = new Blob([csvForTab()], { type: 'text/csv;charset=utf-8' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = `bim-ai-${ext}-schedule.csv`;

    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div data-testid="schedule-panel" className="rounded border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold">Schedules</div>

        <div className="ms-auto flex flex-wrap gap-1">
          {(
            [
              ['rooms', 'Rooms'],
              ['doors', 'Doors'],
              ['windows', 'Windows'],
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

        <button type="button" className="text-[11px] text-accent" onClick={downloadCsv}>
          CSV
        </button>
      </div>

      {tab === 'rooms' ? (
        !roomRows.length ? (
          <div className="mt-3 text-[11px] text-muted">No rooms on this level yet.</div>
        ) : (
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
        )
      ) : null}

      {tab === 'doors' ? (
        !doorRows.length ? (
          <div className="mt-3 text-[11px] text-muted">No doors in this projection.</div>
        ) : (
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
        )
      ) : null}

      {tab === 'windows' ? (
        !windowRows.length ? (
          <div className="mt-3 text-[11px] text-muted">No windows in this projection.</div>
        ) : (
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
        )
      ) : null}

      {tab === 'sheets' ? (
        !sheets.length ? (
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
