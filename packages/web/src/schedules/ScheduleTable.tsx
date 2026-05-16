import type { JSX } from 'react';

interface ColumnDef<T> {
  key: keyof T;
  label: string;
  format?: (v: unknown) => string;
}

interface ScheduleTableProps<T extends object> {
  rows: T[];
  columns: ColumnDef<T>[];
  'data-testid'?: string;
  emptyMessage?: string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

export function ScheduleTable<T extends object>({
  rows,
  columns,
  'data-testid': testId,
  emptyMessage = 'No rows.',
  sortKey,
  sortDir,
  onSort,
}: ScheduleTableProps<T>): JSX.Element {
  return (
    <div data-testid={testId} className="overflow-auto border border-border">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="text-xs uppercase text-muted">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                data-testid={`schedule-col-header-${String(col.key)}`}
                className={`sticky top-0 border-b border-border bg-surface px-3 py-1.5 text-left${onSort ? ' cursor-pointer select-none' : ''}`}
                onClick={() => onSort?.(String(col.key))}
              >
                {col.label}
                {sortKey === String(col.key) ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-sm text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                data-testid={`schedule-row-${i}`}
                className="border-t border-border/60 hover:bg-surface-strong"
              >
                {columns.map((col) => {
                  const v = row[col.key];
                  const cell = col.format ? col.format(v) : v == null ? '—' : String(v);
                  return (
                    <td key={String(col.key)} className="px-3 py-1.5 font-mono">
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
