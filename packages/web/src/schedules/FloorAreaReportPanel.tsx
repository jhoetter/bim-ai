import { useMemo, useState, type JSX } from 'react';

import type { Element } from '@bim-ai/core';

import { buildLevelAreaReport, type LevelAreaRow } from './scheduleLevelDatumEvidenceReadout';
import { rowsToCsv } from './scheduleCsvExport';
import { filterRows, sortRows } from './scheduleSortFilter';

export function FloorAreaReportPanel({
  elementsById,
}: {
  elementsById: Record<string, Element>;
}): JSX.Element {
  const rows = buildLevelAreaReport(elementsById);

  const [sort, setSort] = useState<{ key: keyof LevelAreaRow; dir: 'asc' | 'desc' } | null>(null);
  const [filter, setFilter] = useState('');

  const displayRows = useMemo(() => {
    let r: LevelAreaRow[] = rows;
    if (filter) r = filterRows(r, filter);
    if (sort) r = sortRows(r, sort.key, sort.dir);
    return r;
  }, [rows, filter, sort]);

  const exportCsv = () => {
    const csv = rowsToCsv(displayRows, [
      { key: 'levelName', label: 'Level' },
      {
        key: 'grossAreaM2',
        label: 'Gross Area (m²)',
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'netAreaM2',
        label: 'Net Area (m²)',
        format: (v) => Number(v).toFixed(2),
      },
    ]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floor-area-schedule.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  function toggleSort(key: keyof LevelAreaRow) {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }

  return (
    <div data-testid="floor-area-report-panel" className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">Floor Area Report</div>
        <button
          type="button"
          data-testid="floor-area-export-csv"
          className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-strong"
          onClick={exportCsv}
        >
          Export CSV
        </button>
      </div>
      <input
        data-testid="floor-area-filter"
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter levels..."
        className="rounded border border-border bg-surface px-2 py-1 text-xs"
      />
      <div data-testid="schedule-row-count-floor-areas" className="text-[10px] text-muted">
        {`Showing ${displayRows.length} of ${rows.length} rows`}
      </div>
      {displayRows.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted">
          {rows.length === 0 ? 'No levels with floor areas' : 'No matching levels'}
        </div>
      ) : (
        <div className="overflow-auto border border-border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted">
                <th
                  className="sticky top-0 cursor-pointer select-none border-b border-border bg-surface px-3 py-1.5 text-left"
                  onClick={() => toggleSort('levelName')}
                >
                  Level{sort?.key === 'levelName' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
                <th
                  className="sticky top-0 cursor-pointer select-none border-b border-border bg-surface px-3 py-1.5 text-right"
                  onClick={() => toggleSort('grossAreaM2')}
                >
                  Gross Area (m&sup2;)
                  {sort?.key === 'grossAreaM2' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
                <th
                  className="sticky top-0 cursor-pointer select-none border-b border-border bg-surface px-3 py-1.5 text-right"
                  onClick={() => toggleSort('netAreaM2')}
                >
                  Net Area (m&sup2;)
                  {sort?.key === 'netAreaM2' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr
                  key={row.levelId}
                  data-testid={`floor-area-row-${row.levelId}`}
                  className="border-t border-border/60 hover:bg-surface-strong"
                >
                  <td className="px-3 py-1.5">{row.levelName}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{row.grossAreaM2.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{row.netAreaM2.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
