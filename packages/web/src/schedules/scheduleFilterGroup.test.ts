import { describe, expect, it } from 'vitest';

import { filterRows, groupByKey, sortRows } from './scheduleSortFilter';

describe('schedule sort/filter/group — §13.3', () => {
  it('sortRows sorts strings ascending', () => {
    const rows = [{ name: 'B' }, { name: 'A' }, { name: 'C' }];
    const sorted = sortRows(rows, 'name', 'asc');
    expect(sorted.map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });

  it('sortRows sorts numbers descending', () => {
    const rows = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const sorted = sortRows(rows, 'n', 'desc');
    expect(sorted.map((r) => r.n)).toEqual([3, 2, 1]);
  });

  it('filterRows returns only matching rows', () => {
    const rows = [{ name: 'Apple' }, { name: 'Banana' }, { name: 'apricot' }];
    const filtered = filterRows(rows, 'ap');
    expect(filtered.map((r) => r.name)).toEqual(['Apple', 'apricot']);
  });

  it('filterRows returns all rows for empty filter', () => {
    const rows = [{ name: 'A' }, { name: 'B' }];
    expect(filterRows(rows, '')).toHaveLength(2);
  });

  it('grouping rows by key produces correct group structure', () => {
    const rows = [
      { name: 'Door 1', level: 'L1' },
      { name: 'Door 2', level: 'L2' },
      { name: 'Door 3', level: 'L1' },
    ];
    const groups = groupByKey(rows, 'level');
    expect(groups['L1']).toHaveLength(2);
    expect(groups['L2']).toHaveLength(1);
  });

  it('groupByKey handles null/undefined values as empty string key', () => {
    const rows = [
      { name: 'A', level: null as unknown as string },
      { name: 'B', level: 'L1' },
    ];
    const groups = groupByKey(rows, 'level');
    expect(groups['']).toHaveLength(1);
    expect(groups['L1']).toHaveLength(1);
  });

  it('groupByKey preserves all rows across groups', () => {
    const rows = [
      { name: 'X', cat: 'alpha' },
      { name: 'Y', cat: 'beta' },
      { name: 'Z', cat: 'alpha' },
      { name: 'W', cat: 'gamma' },
    ];
    const groups = groupByKey(rows, 'cat');
    const total = Object.values(groups).reduce((acc, g) => acc + g.length, 0);
    expect(total).toBe(rows.length);
    expect(groups['alpha']).toHaveLength(2);
    expect(groups['beta']).toHaveLength(1);
    expect(groups['gamma']).toHaveLength(1);
  });
});
