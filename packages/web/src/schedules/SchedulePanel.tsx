import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';

export function SchedulePanel(props: {
  elementsById: Record<string, Element>;

  activeLevelId?: string;
}) {
  const rows = useMemo(() => {
    const lvl = props.activeLevelId;

    const rooms = Object.values(props.elementsById).filter(
      (e): e is Extract<Element, { kind: 'room' }> => {
        return e.kind === 'room' && (!lvl || e.levelId === lvl);
      },
    );

    return rooms.map((r) => {
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

      return {
        id: r.id,

        name: r.name,

        areaM2: a,

        perM: per,
      };
    });
  }, [props.activeLevelId, props.elementsById]);

  if (!rows.length) {
    return (
      <div className="rounded border bg-surface p-4 text-[11px] text-muted">
        No rooms on this level yet.
      </div>
    );
  }

  function csv() {
    const line = [
      ['Name', 'Id', 'Area(m²)', 'Perimeter(m)'],
      ...rows.map((r) => [r.name, r.id, r.areaM2.toFixed(2), r.perM.toFixed(2)]),
    ].map((l) => l.map((cell) => `"${cell}"`).join(','));

    return line.join('\n');
  }

  function downloadCsv() {
    const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = 'room-schedule.csv';

    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">Room schedule</div>

        <button type="button" className="text-[11px] text-accent" onClick={downloadCsv}>
          CSV
        </button>
      </div>

      <table className="mt-2 w-full text-left text-[11px]">
        <thead>
          <tr>
            <th>Name</th>

            <th className="text-right">A m²</th>

            <th className="text-right">Edge m</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/60">
              <td>{r.name}</td>

              <td className="text-right">{r.areaM2.toFixed(2)}</td>

              <td className="text-right">{r.perM.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
