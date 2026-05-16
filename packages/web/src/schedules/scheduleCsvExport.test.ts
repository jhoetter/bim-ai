import { describe, expect, it } from 'vitest';

import { rowsToCsv } from './scheduleCsvExport';

describe('rowsToCsv — §13.3.1', () => {
  const columns = [
    { key: 'name' as const, label: 'Name' },
    { key: 'count' as const, label: 'Count' },
  ];

  it('produces correct header row', () => {
    const result = rowsToCsv([], columns);
    expect(result.split('\n')[0]).toBe('Name,Count');
  });

  it('produces correct data rows', () => {
    const rows = [{ name: 'Alpha', count: 3 }];
    const result = rowsToCsv(rows, columns);
    const lines = result.split('\n');
    expect(lines[1]).toBe('Alpha,3');
  });

  it('wraps cells containing commas in quotes', () => {
    const rows = [{ name: 'Foo, Bar', count: 1 }];
    const result = rowsToCsv(rows, columns);
    const lines = result.split('\n');
    expect(lines[1]).toBe('"Foo, Bar",1');
  });

  it('handles empty rows array (header only)', () => {
    const result = rowsToCsv([], columns);
    expect(result).toBe('Name,Count');
  });

  it('applies format function to cell value', () => {
    const cols = [
      { key: 'name' as const, label: 'Name' },
      { key: 'count' as const, label: 'Count', format: (v: unknown) => `${v as number} items` },
    ];
    const rows = [{ name: 'Beta', count: 5 }];
    const result = rowsToCsv(rows, cols);
    expect(result.split('\n')[1]).toBe('Beta,5 items');
  });
});
