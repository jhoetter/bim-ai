import { describe, expect, it } from 'vitest';

import {
  buildScheduleTableCsvUrl,
  columnFieldRoleHint,
  columnMetadataCategoryLine,
  formatSchedulePaginationPlacementReadout,
  formatSchedulePlacementReadout,
  scheduleRegistryEngineReadoutParts,
} from './schedulePanelRegistryChrome';

describe('buildScheduleTableCsvUrl', () => {
  it('builds CSV endpoint with totals by default', () => {
    expect(buildScheduleTableCsvUrl('m1', 's1')).toBe(
      '/api/models/m1/schedules/s1/table?format=csv&includeScheduleTotalsCsv=true',
    );
  });

  it('encodes ids and appends column subset', () => {
    expect(
      buildScheduleTableCsvUrl('a/b', 'c d', { columns: ['x', 'y z'], includeScheduleTotalsCsv: true }),
    ).toBe(
      '/api/models/a%2Fb/schedules/c%20d/table?format=csv&includeScheduleTotalsCsv=true&columns=x,y%20z',
    );
  });

  it('omits totals when disabled', () => {
    expect(buildScheduleTableCsvUrl('m', 's', { includeScheduleTotalsCsv: false })).toBe(
      '/api/models/m/schedules/s/table?format=csv',
    );
  });
});

describe('columnFieldRoleHint', () => {
  it('returns empty when role missing', () => {
    expect(columnFieldRoleHint(undefined)).toBe('');
    expect(columnFieldRoleHint({ label: 'X' })).toBe('');
  });

  it('suffixes trimmed role', () => {
    expect(columnFieldRoleHint({ role: 'number' })).toBe(' · number');
  });
});

describe('formatSchedulePaginationPlacementReadout', () => {
  it('returns null for invalid or wrong format', () => {
    expect(formatSchedulePaginationPlacementReadout(null)).toBe(null);
    expect(formatSchedulePaginationPlacementReadout({ format: 'other' })).toBe(null);
  });

  it('formats segment summary and digest prefix', () => {
    const s = formatSchedulePaginationPlacementReadout({
      format: 'schedulePaginationPlacementEvidence_v0',
      segmentCount: 2,
      totalRows: 25,
      rowsPerSegment: 8,
      clipStatus: 'multi_segment',
      placementStatus: 'placed',
      digestSha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    });
    expect(s).toContain('pag segs=2');
    expect(s).toContain('rows=25');
    expect(s).toContain('rps=8');
    expect(s).toContain('clip=multi_segment');
    expect(s).toContain('h=abcdef012345');
  });
});

describe('formatSchedulePlacementReadout', () => {
  it('returns null for invalid input', () => {
    expect(formatSchedulePlacementReadout(null)).toBe(null);
    expect(formatSchedulePlacementReadout('x')).toBe(null);
  });

  it('formats sheet name and id', () => {
    expect(
      formatSchedulePlacementReadout({ sheetName: 'A101', sheetId: 'sh-1' }),
    ).toBe('Sheet placement: A101 (sh-1)');
  });
});

describe('columnMetadataCategoryLine', () => {
  it('reads category from columnMetadata', () => {
    expect(columnMetadataCategoryLine({ columnMetadata: { category: 'door' } })).toBe(
      'Field registry · door',
    );
  });

  it('returns null when absent', () => {
    expect(columnMetadataCategoryLine({})).toBe(null);
  });
});

describe('scheduleRegistryEngineReadoutParts', () => {
  it('returns empty when scheduleEngine missing', () => {
    expect(scheduleRegistryEngineReadoutParts({})).toEqual([]);
  });

  it('collects engine fragments and falls back to top-level groupKeys', () => {
    const parts = scheduleRegistryEngineReadoutParts({
      groupKeys: ['levelId'],
      scheduleEngine: {
        format: 'scheduleDerivationEngine_v1',
        category: 'room',
        groupKeys: [],
        sortBy: 'areaM2',
        sortTieBreak: 'elementId',
        sortDescending: true,
        supportsCsv: true,
        filterEquals: { levelId: 'L1' },
        filterRules: [{}, {}],
      },
    });
    expect(parts.some((p) => p.includes('scheduleDerivationEngine_v1'))).toBe(true);
    expect(parts.some((p) => p === 'cat room')).toBe(true);
    expect(parts.some((p) => p === 'group levelId')).toBe(true);
    expect(parts.some((p) => p === 'sort areaM2')).toBe(true);
    expect(parts.some((p) => p === 'tie elementId')).toBe(true);
    expect(parts).toContain('desc');
    expect(parts).toContain('CSV export');
    expect(parts.some((p) => p.startsWith('equals '))).toBe(true);
    expect(parts.some((p) => p.includes('rule'))).toBe(true);
  });

  it('uses scheduleEngine groupKeys over top-level when both present', () => {
    const parts = scheduleRegistryEngineReadoutParts({
      groupKeys: ['a'],
      scheduleEngine: {
        format: 'x',
        groupKeys: ['b', 'c'],
        sortBy: 'name',
      },
    });
    expect(parts.some((p) => p === 'group b, c')).toBe(true);
  });
});
