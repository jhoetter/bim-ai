export interface CsvColumn {
  key: string;
  header: string;
  unit?: string; // e.g. "m²", "mm"
}

export interface CsvRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface CsvExportOptions {
  filename?: string;
  includeUnitsInHeader?: boolean; // default: true — appends " (m²)" to header
}

/** Escape a single CSV cell value. */
function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  // Fields containing commas, double-quotes, or newlines must be quoted; internal quotes doubled
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replaceAll('"', '""') + '"';
  }
  return str;
}

/** Generate a UTF-8 CSV string from columns + rows. */
export function generateCsv(columns: CsvColumn[], rows: CsvRow[], opts?: CsvExportOptions): string {
  const includeUnits = opts?.includeUnitsInHeader !== false;

  const headerRow = columns
    .map((col) => {
      const header = includeUnits && col.unit ? `${col.header} (${col.unit})` : col.header;
      return escapeCsvCell(header);
    })
    .join(',');

  const dataRows = rows.map((row) => columns.map((col) => escapeCsvCell(row[col.key])).join(','));

  return [headerRow, ...dataRows].join('\n');
}

/** Trigger a browser file download of the CSV. */
export function downloadCsv(columns: CsvColumn[], rows: CsvRow[], opts?: CsvExportOptions): void {
  const csv = generateCsv(columns, rows, opts);
  const filename = opts?.filename ?? 'export.csv';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

/** Copy the CSV content to the clipboard. Returns true on success. */
export async function copyCsvToClipboard(
  columns: CsvColumn[],
  rows: CsvRow[],
  opts?: CsvExportOptions,
): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false;
  try {
    const csv = generateCsv(columns, rows, opts);
    await navigator.clipboard.writeText(csv);
    return true;
  } catch {
    return false;
  }
}
