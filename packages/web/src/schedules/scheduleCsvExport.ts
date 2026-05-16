export function rowsToCsv<T extends object>(
  rows: T[],
  columns: { key: keyof T; label: string; format?: (v: unknown) => string }[],
): string {
  const escape = (s: string): string =>
    s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;

  const header = columns.map((c) => escape(c.label)).join(',');
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const v = row[col.key];
        const str = col.format ? col.format(v) : v == null ? '' : String(v);
        return escape(str);
      })
      .join(','),
  );

  return [header, ...dataRows].join('\n');
}
