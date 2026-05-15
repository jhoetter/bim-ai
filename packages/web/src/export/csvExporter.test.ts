import { describe, expect, it } from 'vitest';

import { generateCsv } from './csvExporter';
import type { CsvColumn, CsvRow } from './csvExporter';

const columns: CsvColumn[] = [
  { key: 'name', header: 'Name' },
  { key: 'level', header: 'Level' },
  { key: 'area', header: 'Area', unit: 'm²' },
];

const rows: CsvRow[] = [
  { name: 'Room A', level: 'L1', area: 25.5 },
  { name: 'Room B', level: 'L1', area: 30.0 },
  { name: 'Room C', level: 'L2', area: 18.75 },
  { name: 'Room D', level: 'L2', area: 42.0 },
  { name: 'Room E', level: 'L3', area: 10.0 },
];

describe('generateCsv', () => {
  it('produces correct header row and exactly 6 lines for 3 columns and 5 rows', () => {
    const csv = generateCsv(columns, rows, { includeUnitsInHeader: false });
    const lines = csv.split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toBe('Name,Level,Area');
  });

  it('wraps a field containing a comma in double quotes', () => {
    const commaRows: CsvRow[] = [{ name: 'Smith, John', level: 'L1', area: 20 }];
    const csv = generateCsv(columns, commaRows, { includeUnitsInHeader: false });
    const lines = csv.split('\n');
    // data row is index 1
    expect(lines[1]).toContain('"Smith, John"');
  });

  it('doubles internal double quotes in a field', () => {
    const quoteRows: CsvRow[] = [{ name: 'Room "A"', level: 'L1', area: 20 }];
    const csv = generateCsv(columns, quoteRows, { includeUnitsInHeader: false });
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"Room ""A"""');
  });

  it('appends unit in parentheses to header when includeUnitsInHeader is true', () => {
    const csv = generateCsv(columns, rows, { includeUnitsInHeader: true });
    const headerLine = csv.split('\n')[0];
    expect(headerLine).toContain('(m²)');
    expect(headerLine).toBe('Name,Level,Area (m²)');
  });
});
