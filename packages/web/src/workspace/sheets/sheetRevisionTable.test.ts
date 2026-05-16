import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { resolveSheetRevisions } from './sheetTitleblockAuthoring';

function makeElements(
  revisions: Array<{ id: string; number: string; description: string; date: string }>,
  sheetRevisions: Array<{ id: string; sheetId: string; revisionId: string }>,
): Record<string, Element> {
  const out: Record<string, Element> = {};
  for (const r of revisions) {
    out[r.id] = { kind: 'revision', ...r } as Extract<Element, { kind: 'revision' }>;
  }
  for (const sr of sheetRevisions) {
    out[sr.id] = { kind: 'sheet_revision', ...sr } as Extract<Element, { kind: 'sheet_revision' }>;
  }
  return out;
}

describe('resolveSheetRevisions — D1', () => {
  it('returns one row per sheet_revision assigned to the sheet', () => {
    const elementsById = makeElements(
      [
        { id: 'rev-01', number: '01', description: 'Issued for Review', date: '2026-05-01' },
        { id: 'rev-02', number: '02', description: 'Issued for Construction', date: '2026-06-01' },
      ],
      [
        { id: 'sr-1', sheetId: 'sheet-A101', revisionId: 'rev-01' },
        { id: 'sr-2', sheetId: 'sheet-A101', revisionId: 'rev-02' },
        { id: 'sr-3', sheetId: 'sheet-OTHER', revisionId: 'rev-02' },
      ],
    );
    const rows = resolveSheetRevisions(elementsById, 'sheet-A101');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.revisionId).toBe('rev-01');
    expect(rows[1]!.revisionId).toBe('rev-02');
  });

  it('returns empty array when no sheet_revisions are assigned', () => {
    const elementsById = makeElements(
      [{ id: 'rev-01', number: '01', description: 'Issued for Review', date: '2026-05-01' }],
      [],
    );
    const rows = resolveSheetRevisions(elementsById, 'sheet-A101');
    expect(rows).toHaveLength(0);
  });

  it('sorts revisions by number ascending (numeric)', () => {
    const elementsById = makeElements(
      [
        { id: 'rev-03', number: '03', description: 'Third', date: '2026-07-01' },
        { id: 'rev-01', number: '01', description: 'First', date: '2026-05-01' },
        { id: 'rev-02', number: '02', description: 'Second', date: '2026-06-01' },
      ],
      [
        { id: 'sr-1', sheetId: 'sheet-A', revisionId: 'rev-03' },
        { id: 'sr-2', sheetId: 'sheet-A', revisionId: 'rev-01' },
        { id: 'sr-3', sheetId: 'sheet-A', revisionId: 'rev-02' },
      ],
    );
    const rows = resolveSheetRevisions(elementsById, 'sheet-A');
    expect(rows.map((r) => r.number)).toEqual(['01', '02', '03']);
  });

  it('ignores sheet_revision rows with missing revision elements', () => {
    const elementsById = makeElements(
      [{ id: 'rev-01', number: '01', description: 'Valid', date: '2026-05-01' }],
      [
        { id: 'sr-1', sheetId: 'sheet-A', revisionId: 'rev-01' },
        { id: 'sr-2', sheetId: 'sheet-A', revisionId: 'rev-MISSING' },
      ],
    );
    const rows = resolveSheetRevisions(elementsById, 'sheet-A');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.number).toBe('01');
  });

  it('includes description and date in each row', () => {
    const elementsById = makeElements(
      [{ id: 'rev-01', number: 'A', description: 'Planning Permission', date: '2026-01-15' }],
      [{ id: 'sr-1', sheetId: 'sheet-X', revisionId: 'rev-01' }],
    );
    const rows = resolveSheetRevisions(elementsById, 'sheet-X');
    expect(rows[0]!.description).toBe('Planning Permission');
    expect(rows[0]!.date).toBe('2026-01-15');
  });
});
