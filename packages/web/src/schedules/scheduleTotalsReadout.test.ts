import { describe, expect, it } from 'vitest';

import { resolveScheduleSortDescending, scheduleTotalsReadoutParts } from './SchedulePanel';

describe('resolveScheduleSortDescending', () => {
  it('reads boolean from filters before grouping', () => {
    expect(resolveScheduleSortDescending({ sortDescending: false }, { sortDescending: true })).toBe(
      false,
    );
    expect(resolveScheduleSortDescending({ sortDescending: true }, { sortDescending: false })).toBe(
      true,
    );
  });

  it('falls back to grouping', () => {
    expect(resolveScheduleSortDescending({}, { sortDescending: true })).toBe(true);
  });

  it('accepts legacy string true', () => {
    expect(resolveScheduleSortDescending({ sortDescending: 'yes' }, undefined)).toBe(true);
  });
});

describe('scheduleTotalsReadoutParts', () => {
  it('includes door rough opening sum', () => {
    const parts = scheduleTotalsReadoutParts({
      kind: 'door',
      rowCount: 2,
      roughOpeningAreaM2: 5.25,
    });
    expect(parts.some((p) => p.includes('rough opening') && p.includes('5.250000'))).toBe(true);
  });

  it('includes window glazing and rough totals', () => {
    const parts = scheduleTotalsReadoutParts({
      kind: 'window',
      rowCount: 1,
      averageWidthMm: 1200,
      roughOpeningAreaM2: 2.8,
      totalOpeningAreaM2: 2.1,
    });
    expect(parts.some((p) => p.includes('glazing'))).toBe(true);
    expect(parts.some((p) => p.includes('rough opening'))).toBe(true);
  });

  it('includes room finish totals when present', () => {
    const parts = scheduleTotalsReadoutParts({
      kind: 'room',
      rowCount: 3,
      areaM2: 12,
      perimeterM: 40,
      finishCompleteCount: 1,
      finishMissingCount: 1,
      finishPeerSuggestedCount: 1,
    });
    expect(parts.some((p) => p.includes('finish OK 1'))).toBe(true);
    expect(parts.some((p) => p.includes('finish missing 1'))).toBe(true);
    expect(parts.some((p) => p.includes('finish peer 1'))).toBe(true);
  });
});
