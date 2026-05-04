import { describe, expect, it } from 'vitest';

import { parseWidthMmGtThreshold, schedulesFiltersWithWidthMmGt } from './scheduleFilterWidthRules';

describe('schedule filterRules widthMm gt helpers', () => {
  it('parseWidthMmGtThreshold reads first widthMm gt', () => {
    expect(
      parseWidthMmGtThreshold({
        filterRules: [
          { field: 'heightMm', op: 'gt', value: 99 },
          { field: 'widthMm', op: 'gt', value: 900 },
        ],
      }),
    ).toBe(900);
  });

  it('parseWidthMmGtThreshold reads filter_rules snake_case', () => {
    expect(
      parseWidthMmGtThreshold({
        filter_rules: [{ field: 'widthMm', op: 'gt', value: '750' }],
      }),
    ).toBe(750);
  });

  it('schedulesFiltersWithWidthMmGt replaces width gt and preserves other rules', () => {
    const base = {
      category: 'door',
      filterEquals: { levelId: 'l1' },
      filterRules: [
        { field: 'widthMm', op: 'gt', value: 100 },
        { field: 'heightMm', op: 'gt', value: 2000 },
      ],
    };
    const next = schedulesFiltersWithWidthMmGt(base, 888);
    expect(next.filterEquals).toEqual({ levelId: 'l1' });
    expect(next.filterRules).toEqual([
      { field: 'heightMm', op: 'gt', value: 2000 },
      { field: 'widthMm', op: 'gt', value: 888 },
    ]);
    expect(next).not.toHaveProperty('filter_rules');
  });

  it('schedulesFiltersWithWidthMmGt clears width gt when threshold null', () => {
    const base = {
      filterRules: [{ field: 'widthMm', op: 'gt', value: 100 }],
    };
    const next = schedulesFiltersWithWidthMmGt(base, null);
    expect(next.filterRules).toBeUndefined();
  });
});
