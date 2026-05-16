export function buildScheduleCsv(columns: string[], rows: Record<string, unknown>[]): string {
  function escapeCell(v: unknown): string {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const header = columns.map(escapeCell).join(',');
  const body = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(','));
  return [header, ...body].join('\n');
}

export function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
