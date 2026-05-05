import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  buildScheduleTableModelV1,
  formatScheduleTableRendererV1Readout,
  SCHEDULE_TABLE_EMPTY_V1,
  scheduleTableRendererV1SheetReadout,
  unitHintFromRegistryLabel,
} from './scheduleTableRendererV1';

describe('unitHintFromRegistryLabel', () => {
  it('extracts trailing parenthetical unit hints', () => {
    expect(unitHintFromRegistryLabel('Width (mm)')).toBe('mm');
    expect(unitHintFromRegistryLabel('Area (m²)')).toBe('m²');
    expect(unitHintFromRegistryLabel('Name')).toBe('');
  });
});

describe('buildScheduleTableModelV1', () => {
  const columnMetadata = {
    category: 'floor',
    fields: {
      elementId: { label: 'Element Id', role: 'id' },
      name: { label: 'Name', role: 'text' },
      areaM2: { label: 'Area (m²)', role: 'number' },
    },
  };

  it('builds flat body rows and footer from totals', () => {
    const payload: Record<string, unknown> = {
      name: 'Floor Schedule',
      columns: ['elementId', 'name', 'areaM2'],
      columnMetadata,
      rows: [
        { elementId: 'f1', name: 'Slab A', areaM2: 12.5 },
        { elementId: 'f2', name: 'Slab B', areaM2: 8 },
      ],
      totals: { kind: 'floor', rowCount: 2, areaM2: 20.5 },
    };

    const model = buildScheduleTableModelV1({ payload });

    expect(model.title).toBe('Floor Schedule');
    expect(model.columns.map((c) => c.key)).toEqual(['elementId', 'name', 'areaM2']);
    expect(model.columns[2]?.unitLabel).toBe('m²');
    expect(model.bodyRows.every((r) => r.kind === 'data')).toBe(true);
    expect(model.leafRowCount).toBe(2);
    expect(model.groupCount).toBe(0);
    expect(model.emptyToken).toBeNull();
    expect(model.footerParts.some((p) => p.includes('sum area'))).toBe(true);
  });

  it('orders columns via visibleColumnKeys while preserving payload semantics', () => {
    const payload: Record<string, unknown> = {
      scheduleId: 'sch-x',
      columns: ['elementId', 'name', 'areaM2'],
      columnMetadata,
      rows: [{ elementId: 'f1', name: 'Slab', areaM2: 1 }],
    };

    const model = buildScheduleTableModelV1({
      payload,
      visibleColumnKeys: ['areaM2', 'elementId'],
    });

    expect(model.columns.map((c) => c.key)).toEqual(['areaM2', 'elementId']);
  });

  it('emits group headers when groupedSections exists', () => {
    const payload: Record<string, unknown> = {
      name: 'Grouped',
      columns: ['elementId', 'level'],
      columnMetadata: {
        category: 'sheet',
        fields: {
          elementId: { label: 'Element Id', role: 'id' },
          level: { label: 'Level', role: 'text' },
        },
      },
      groupedSections: {
        L1: [{ elementId: 'a', level: 'L1' }],
        L2: [{ elementId: 'b', level: 'L2' }],
      },
    };

    const model = buildScheduleTableModelV1({ payload });

    expect(model.groupCount).toBe(2);
    expect(model.bodyRows[0]).toMatchObject({ kind: 'groupHeader', label: 'L1' });
    expect(model.bodyRows[1]).toMatchObject({ kind: 'data' });
    expect(model.leafRowCount).toBe(2);
  });

  it('uses schedule id fallback title and empty token when no leaf rows', () => {
    const payload: Record<string, unknown> = {
      scheduleId: 'sch-empty',
      columns: ['name'],
      columnMetadata: { category: 'floor', fields: { name: { label: 'Name', role: 'text' } } },
      rows: [],
    };

    const model = buildScheduleTableModelV1({ payload });

    expect(model.title).toBe('Schedule (sch-empty)');
    expect(model.leafRowCount).toBe(0);
    expect(model.emptyToken).toBe(SCHEDULE_TABLE_EMPTY_V1);
    expect(model.bodyRows.length).toBe(0);
  });

  it('formatScheduleTableRendererV1Readout is deterministic', () => {
    const payload: Record<string, unknown> = {
      name: 'T',
      columns: ['a'],
      columnMetadata: { category: 'floor', fields: { a: { label: 'A', role: 'text' } } },
      rows: [{ a: 1 }],
      totals: { kind: 'floor', rowCount: 1, areaM2: 1 },
    };

    const model = buildScheduleTableModelV1({ payload });
    expect(formatScheduleTableRendererV1Readout(model)).toBe(
      'tblV1[cols=1 leafRows=1 groups=0 footer=yes]',
    );
  });
});

describe('scheduleTableRendererV1SheetReadout', () => {
  it('returns null for non-summary schDoc segments', () => {
    expect(scheduleTableRendererV1SheetReadout('schDoc[missing_schedule_element]', {})).toBeNull();
    expect(scheduleTableRendererV1SheetReadout('schDoc[derive_error]', {})).toBeNull();
    expect(scheduleTableRendererV1SheetReadout('', {})).toBeNull();
  });

  it('parses schDoc summary and adds schedule name when element resolves', () => {
    const elementsById = {
      s1: { kind: 'schedule', id: 's1', name: 'Door Schedule' },
    } as Record<string, Element>;

    const seg = 'schDoc[id=s1 rows=2 cols=5 cat=door]';
    expect(scheduleTableRendererV1SheetReadout(seg, elementsById)).toBe(
      'tblV1[id=s1 name=Door Schedule rows=2 cols=5 cat=door]',
    );
  });

  it('omits name when schedule element missing', () => {
    expect(scheduleTableRendererV1SheetReadout('schDoc[id=s9 rows=1 cols=3 cat=door]', {})).toBe(
      'tblV1[id=s9 rows=1 cols=3 cat=door]',
    );
  });
});
