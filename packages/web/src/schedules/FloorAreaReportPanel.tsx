import type { JSX } from 'react';

import type { Element } from '@bim-ai/core';

import { buildLevelAreaReport } from './scheduleLevelDatumEvidenceReadout';

export function FloorAreaReportPanel({
  elementsById,
}: {
  elementsById: Record<string, Element>;
}): JSX.Element {
  const rows = buildLevelAreaReport(elementsById);

  const exportCsv = () => {
    const header = 'Level,Gross Area (m²),Net Area (m²)';
    const lines = rows.map(
      (r) => `${r.levelName},${r.grossAreaM2.toFixed(2)},${r.netAreaM2.toFixed(2)}`,
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floor-area-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
      {rows.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted">No levels with floor areas</div>
      ) : (
        <div className="overflow-auto border border-border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted">
                <th className="sticky top-0 border-b border-border bg-surface px-3 py-1.5 text-left">
                  Level
                </th>
                <th className="sticky top-0 border-b border-border bg-surface px-3 py-1.5 text-right">
                  Gross Area (m&sup2;)
                </th>
                <th className="sticky top-0 border-b border-border bg-surface px-3 py-1.5 text-right">
                  Net Area (m&sup2;)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
