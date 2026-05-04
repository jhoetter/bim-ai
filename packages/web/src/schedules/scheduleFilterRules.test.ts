import { describe, expect, it } from 'vitest';

import {
  parseNumericFilterRuleThreshold,
  parseWidthMmGtThreshold,
  parseWidthMmLtThreshold,
  schedulesFiltersWithNumericRule,
  schedulesFiltersWithWidthMmGt,
  schedulesFiltersWithWidthMmLt,
} from './scheduleFilterWidthRules';

describe('generic numeric schedule filterRules helpers', () => {
  it('parseNumericFilterRuleThreshold reads areaM2 gt from camelCase rules', () => {
    expect(
      parseNumericFilterRuleThreshold(
        {
          filterRules: [
            { field: 'widthMm', op: 'gt', value: 900 },
            { field: 'areaM2', op: 'gt', value: '12.5' },
          ],
        },
        'areaM2',
        'gt',
      ),
    ).toBe(12.5);
  });

  it('schedulesFiltersWithNumericRule replaces only the requested field/op', () => {
    const next = schedulesFiltersWithNumericRule(
      {
        category: 'room',
        filterRules: [
          { field: 'areaM2', op: 'gt', value: 8 },
          { field: 'areaM2', op: 'lt', value: 30 },
          { field: 'targetAreaM2', op: 'gt', value: 10 },
        ],
      },
      'areaM2',
      'gt',
      12,
    );
    expect(next.filterRules).toEqual([
      { field: 'areaM2', op: 'lt', value: 30 },
      { field: 'targetAreaM2', op: 'gt', value: 10 },
      { field: 'areaM2', op: 'gt', value: 12 },
    ]);
  });

  it('schedulesFiltersWithNumericRule clears the final rule and removes snake_case', () => {
    const next = schedulesFiltersWithNumericRule(
      {
        filter_rules: [{ field: 'areaM2', op: 'lt', value: 50 }],
      },
      'areaM2',
      'lt',
      null,
    );
    expect(next).not.toHaveProperty('filterRules');
    expect(next).not.toHaveProperty('filter_rules');
  });
});

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

describe('schedule filterRules widthMm lt helpers', () => {
  it('parseWidthMmLtThreshold reads first widthMm lt', () => {
    expect(
      parseWidthMmLtThreshold({
        filterRules: [
          { field: 'heightMm', op: 'lt', value: 99 },
          { field: 'widthMm', op: 'lt', value: 1200 },
        ],
      }),
    ).toBe(1200);
  });

  it('schedulesFiltersWithWidthMmLt replaces width lt and preserves gt rules', () => {
    const base = {
      category: 'door',
      filterRules: [
        { field: 'widthMm', op: 'lt', value: 100 },
        { field: 'widthMm', op: 'gt', value: 700 },
      ],
    };
    const next = schedulesFiltersWithWidthMmLt(base, 1500);
    expect(next.filterRules).toEqual([
      { field: 'widthMm', op: 'gt', value: 700 },
      { field: 'widthMm', op: 'lt', value: 1500 },
    ]);
  });

  it('schedulesFiltersWithWidthMmLt clears width lt when threshold null but keeps gt', () => {
    const base = {
      filterRules: [
        { field: 'widthMm', op: 'gt', value: 500 },
        { field: 'widthMm', op: 'lt', value: 2000 },
      ],
    };
    const next = schedulesFiltersWithWidthMmLt(base, null);
    expect(next.filterRules).toEqual([{ field: 'widthMm', op: 'gt', value: 500 }]);
  });
});
