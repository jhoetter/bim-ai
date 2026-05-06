import { describe, expect, it } from 'vitest';

import type { Violation } from '@bim-ai/core';

import {
  PARITY_TOKEN_ALIGNED,
  PARITY_TOKEN_PLACEMENT_MISSING,
  SCHEDULE_SHEET_EXPORT_PARITY_FORMAT,
  compactScheduleSheetExportParityAdvisoryLines,
  filterScheduleSheetExportParityAdvisories,
  formatScheduleSheetExportParityRowLine,
  parseScheduleSheetExportParityRows,
} from './scheduleSheetExportParityReadout';

describe('parseScheduleSheetExportParityRows', () => {
  it('exposes the canonical scheduleSheetExportParityEvidence_v1 format constant', () => {
    expect(SCHEDULE_SHEET_EXPORT_PARITY_FORMAT).toBe('scheduleSheetExportParityEvidence_v1');
  });

  it('returns empty array for non-objects or wrong format', () => {
    expect(parseScheduleSheetExportParityRows(null)).toEqual([]);
    expect(parseScheduleSheetExportParityRows({ format: 'other', rows: [] })).toEqual([]);
    expect(parseScheduleSheetExportParityRows({ rows: 'nope' })).toEqual([]);
  });

  it('parses rows and coerces missing fields, sorted by scheduleId then viewportId', () => {
    const out = parseScheduleSheetExportParityRows({
      format: SCHEDULE_SHEET_EXPORT_PARITY_FORMAT,
      rows: [
        {
          scheduleId: 'sch-b',
          sheetId: 'sh-1',
          viewportId: 'vp-2',
          csvRowCount: 5,
          jsonRowCount: 5,
          svgListingRowCount: 5,
          paginationSegmentCount: 1,
          crossFormatParityToken: 'aligned',
        },
        {
          scheduleId: 'sch-a',
          sheetId: 'sh-1',
          viewportId: 'vp-1',
          csvRowCount: 4,
          jsonRowCount: 4,
          svgListingRowCount: 4,
          paginationSegmentCount: 1,
          crossFormatParityToken: 'aligned',
        },
        {
          scheduleId: 'sch-a',
          sheetId: null,
          viewportId: null,
          csvRowCount: 0,
          jsonRowCount: 0,
          svgListingRowCount: 0,
          paginationSegmentCount: 1,
          crossFormatParityToken: 'placement_missing',
        },
        // skipped — no scheduleId
        {
          sheetId: 'sh-1',
        },
      ],
    });
    expect(out.map((r) => `${r.scheduleId}/${r.viewportId ?? '—'}`)).toEqual([
      'sch-a/—',
      'sch-a/vp-1',
      'sch-b/vp-2',
    ]);
    expect(out[2].crossFormatParityToken).toBe(PARITY_TOKEN_ALIGNED);
    expect(out[0].crossFormatParityToken).toBe(PARITY_TOKEN_PLACEMENT_MISSING);
  });

  it('falls back to aligned token when payload supplies an unknown one', () => {
    const out = parseScheduleSheetExportParityRows({
      format: SCHEDULE_SHEET_EXPORT_PARITY_FORMAT,
      rows: [
        {
          scheduleId: 'sch-x',
          sheetId: 'sh-x',
          viewportId: 'vp-x',
          csvRowCount: 3,
          jsonRowCount: 3,
          svgListingRowCount: 3,
          paginationSegmentCount: 1,
          crossFormatParityToken: 'mystery',
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].crossFormatParityToken).toBe(PARITY_TOKEN_ALIGNED);
  });
});

describe('formatScheduleSheetExportParityRowLine', () => {
  it('joins fields in stable order', () => {
    const line = formatScheduleSheetExportParityRowLine({
      scheduleId: 'sch-1',
      sheetId: 'sh-1',
      viewportId: 'vp-sch',
      csvRowCount: 4,
      jsonRowCount: 4,
      svgListingRowCount: 4,
      paginationSegmentCount: 1,
      crossFormatParityToken: PARITY_TOKEN_ALIGNED,
    });
    expect(line).toBe(
      'schedule=sch-1 · sheet=sh-1 · viewport=vp-sch · parity=aligned · csv=4 · json=4 · listing=4 · segs=1',
    );
  });

  it('renders em-dash for missing sheet/viewport ids', () => {
    const line = formatScheduleSheetExportParityRowLine({
      scheduleId: 'sch-x',
      sheetId: null,
      viewportId: null,
      csvRowCount: 0,
      jsonRowCount: 0,
      svgListingRowCount: 0,
      paginationSegmentCount: 1,
      crossFormatParityToken: PARITY_TOKEN_PLACEMENT_MISSING,
    });
    expect(line).toContain('sheet=—');
    expect(line).toContain('viewport=—');
    expect(line).toContain('parity=placement_missing');
  });
});

describe('schedule sheet export parity advisories', () => {
  const sample: Violation[] = [
    {
      ruleId: 'schedule_sheet_export_parity_listing_diverges',
      severity: 'warning',
      message: 'Sheet listing rows= diverges',
      elementIds: ['sch-1', 'sh-1'],
    },
    {
      ruleId: 'schedule_sheet_export_parity_csv_diverges',
      severity: 'warning',
      message: 'CSV row count diverges',
      elementIds: ['sch-1', 'sh-1'],
    },
    {
      ruleId: 'unrelated_rule',
      severity: 'warning',
      message: 'noise',
      elementIds: [],
    },
  ];

  it('filterScheduleSheetExportParityAdvisories keeps only parity rules and sorts deterministically', () => {
    const out = filterScheduleSheetExportParityAdvisories(sample);
    expect(out.map((v) => v.ruleId)).toEqual([
      'schedule_sheet_export_parity_csv_diverges',
      'schedule_sheet_export_parity_listing_diverges',
    ]);
  });

  it('compactScheduleSheetExportParityAdvisoryLines emits one line per matched advisory', () => {
    const lines = compactScheduleSheetExportParityAdvisoryLines(sample);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('schedule_sheet_export_parity_csv_diverges');
    expect(lines[0]).toContain('CSV row count diverges');
    expect(lines[0]).toContain('sch-1, sh-1');
  });
});
