import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { SheetRevisionTableSvg } from './sheetTitleblockAuthoring';

afterEach(() => {
  cleanup();
});

function makeElements(
  revisions: Array<{
    id: string;
    number: string;
    description: string;
    date: string;
    issuedBy?: string;
  }>,
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

describe('sheet revision table — §6.3', () => {
  it('renders sheet-revision-table when revisions exist for sheet', () => {
    const elementsById = makeElements(
      [{ id: 'rev-01', number: '01', description: 'Issued for Review', date: '2026-05-01' }],
      [{ id: 'sr-1', sheetId: 'sheet-A101', revisionId: 'rev-01' }],
    );
    const { getByTestId } = render(
      <svg>
        <SheetRevisionTableSvg sheetId="sheet-A101" elementsById={elementsById} x={0} y={10000} />
      </svg>,
    );
    expect(getByTestId('sheet-revision-table')).toBeTruthy();
  });

  it('does not render table when no revisions for sheet', () => {
    const elementsById = makeElements([], []);
    const { queryByTestId } = render(
      <svg>
        <SheetRevisionTableSvg sheetId="sheet-A101" elementsById={elementsById} x={0} y={10000} />
      </svg>,
    );
    expect(queryByTestId('sheet-revision-table')).toBeNull();
  });

  it('renders a row for each sheet_revision element matching sheetId', () => {
    const elementsById = makeElements(
      [
        { id: 'rev-01', number: '01', description: 'First', date: '2026-05-01' },
        { id: 'rev-02', number: '02', description: 'Second', date: '2026-06-01' },
      ],
      [
        { id: 'sr-1', sheetId: 'sheet-A101', revisionId: 'rev-01' },
        { id: 'sr-2', sheetId: 'sheet-A101', revisionId: 'rev-02' },
        { id: 'sr-3', sheetId: 'sheet-OTHER', revisionId: 'rev-01' },
      ],
    );
    const { getByTestId, queryByTestId } = render(
      <svg>
        <SheetRevisionTableSvg sheetId="sheet-A101" elementsById={elementsById} x={0} y={10000} />
      </svg>,
    );
    expect(getByTestId('sheet-revision-row-rev-01')).toBeTruthy();
    expect(getByTestId('sheet-revision-row-rev-02')).toBeTruthy();
    expect(queryByTestId('sheet-revision-row-rev-03')).toBeNull();
  });

  it('row contains sequence, date, description, by fields', () => {
    const elementsById = makeElements(
      [
        {
          id: 'rev-01',
          number: 'A',
          description: 'Planning Permission',
          date: '2026-01-15',
          issuedBy: 'JH',
        },
      ],
      [{ id: 'sr-1', sheetId: 'sheet-X', revisionId: 'rev-01' }],
    );
    const { getByTestId } = render(
      <svg>
        <SheetRevisionTableSvg sheetId="sheet-X" elementsById={elementsById} x={0} y={10000} />
      </svg>,
    );
    const row = getByTestId('sheet-revision-row-rev-01');
    const text = row.textContent ?? '';
    expect(text).toContain('A');
    expect(text).toContain('Planning Permission');
    expect(text).toContain('2026-01-15');
    expect(text).toContain('JH');
  });
});
