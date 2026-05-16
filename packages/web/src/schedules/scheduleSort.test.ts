import { describe, expect, it } from 'vitest';

import { filterRows, sortRows } from './scheduleSortFilter';

describe('schedule sort and filter — §13.3.1', () => {
  const rows = [
    { name: 'Charlie', value: 3 },
    { name: 'Alpha', value: 1 },
    { name: 'Bravo', value: 2 },
  ];

  it('sorts rows ascending by string key', () => {
    const result = sortRows(rows, 'name', 'asc');
    expect(result.map((r) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts rows descending', () => {
    const result = sortRows(rows, 'name', 'desc');
    expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('filter returns only rows matching the search string (case-insensitive)', () => {
    const result = filterRows(rows, 'rav');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Bravo');
  });

  it('filter on empty string returns all rows', () => {
    const result = filterRows(rows, '');
    expect(result).toHaveLength(rows.length);
  });
});
