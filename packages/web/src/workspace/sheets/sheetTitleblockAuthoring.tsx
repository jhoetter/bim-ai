import type { Element } from '@bim-ai/core';
import type { Dispatch, SetStateAction } from 'react';

export type SheetTitleblockDraft = {
  titleBlock: string;

  sheetNumber: string;

  revision: string;

  revisionId: string;

  revisionDate: string;

  revisionDescription: string;

  issueStatus: string;

  projectName: string;

  drawnBy: string;

  checkedBy: string;

  issuedBy: string;

  issueDate: string;
};

type SheetEl = Extract<Element, { kind: 'sheet' }>;

export function normalizeTitleblockDraftFromSheet(sh: SheetEl): SheetTitleblockDraft {
  const tp = sh.titleblockParameters ?? {};

  return {
    titleBlock: sh.titleBlock ?? '',

    sheetNumber: String(tp.sheetNumber ?? tp.sheetNo ?? ''),

    revision: String(tp.revision ?? tp.revisionCode ?? ''),

    revisionId: String(tp.revisionId ?? ''),

    revisionDate: String(tp.revisionDate ?? ''),

    revisionDescription: String(tp.revisionDescription ?? ''),

    issueStatus: String(tp.issueStatus ?? ''),

    projectName: String(tp.projectName ?? tp.project ?? ''),

    drawnBy: String(tp.drawnBy ?? ''),

    checkedBy: String(tp.checkedBy ?? ''),

    issuedBy: String(tp.issuedBy ?? ''),

    issueDate: String(tp.issueDate ?? tp.date ?? ''),
  };
}

const MANAGED_TB_KEYS: (keyof Omit<SheetTitleblockDraft, 'titleBlock'>)[] = [
  'sheetNumber',

  'revision',

  'revisionId',

  'revisionDate',

  'revisionDescription',

  'issueStatus',

  'projectName',

  'drawnBy',

  'checkedBy',

  'issuedBy',

  'issueDate',
];

/** Overlay managed fields onto prior parameters; blanks remove managed keys only. Preserves unknown keys from the sheet. */

export function mergedTitleblockParametersForUpsert(
  prior: Record<string, string>,

  draft: SheetTitleblockDraft,
): Record<string, string> {
  const out = { ...prior };

  for (const key of MANAGED_TB_KEYS) {
    const v = String(draft[key] ?? '').trim();

    if (v) {
      out[key] = v;
    } else {
      delete out[key];
    }
  }

  return out;
}

export type SheetRevisionRow = {
  revisionId: string;
  number: string;
  description: string;
  date: string;
  issuedBy?: string;
};

export function resolveSheetRevisions(
  elementsById: Record<string, Element>,
  sheetId: string,
): SheetRevisionRow[] {
  const rows: SheetRevisionRow[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'sheet_revision' || el.sheetId !== sheetId) continue;
    const rev = elementsById[el.revisionId];
    if (!rev || rev.kind !== 'revision') continue;
    rows.push({
      revisionId: el.revisionId,
      number: rev.number,
      description: rev.description,
      date: rev.date,
      issuedBy: rev.issuedBy,
    });
  }
  rows.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  return rows;
}

export function SheetRevisionTableSvg(props: {
  sheetId: string;
  elementsById: Record<string, Element>;
  x: number;
  y: number;
  colWidths?: [number, number, number, number];
  rowHeight?: number;
}) {
  const { x, y, colWidths = [800, 3200, 1600, 1200], rowHeight = 700 } = props;
  const rows = resolveSheetRevisions(props.elementsById, props.sheetId);
  if (rows.length === 0) return null;

  const totalWidth = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
  const headerHeight = rowHeight;
  const totalHeight = headerHeight + rows.length * rowHeight;
  const tableY = y - totalHeight;

  const col0x = x;
  const col1x = x + colWidths[0];
  const col2x = x + colWidths[0] + colWidths[1];
  const col3x = x + colWidths[0] + colWidths[1] + colWidths[2];

  const cellTextY = (rowY: number) => rowY + rowHeight * 0.65;

  return (
    <g data-testid="sheet-revision-table">
      <rect
        x={x}
        y={tableY}
        width={totalWidth}
        height={totalHeight}
        fill="#f8fafc"
        stroke="#334155"
        strokeWidth={60}
      />
      <line
        x1={x}
        y1={tableY + headerHeight}
        x2={x + totalWidth}
        y2={tableY + headerHeight}
        stroke="#334155"
        strokeWidth={60}
      />
      <line
        x1={col1x}
        y1={tableY}
        x2={col1x}
        y2={tableY + totalHeight}
        stroke="#334155"
        strokeWidth={40}
      />
      <line
        x1={col2x}
        y1={tableY}
        x2={col2x}
        y2={tableY + totalHeight}
        stroke="#334155"
        strokeWidth={40}
      />
      <line
        x1={col3x}
        y1={tableY}
        x2={col3x}
        y2={tableY + totalHeight}
        stroke="#334155"
        strokeWidth={40}
      />
      <text
        x={col0x + 120}
        y={cellTextY(tableY)}
        fill="#334155"
        style={{ fontSize: '380px', fontWeight: 700 }}
      >
        Rev
      </text>
      <text
        x={col1x + 120}
        y={cellTextY(tableY)}
        fill="#334155"
        style={{ fontSize: '380px', fontWeight: 700 }}
      >
        Description
      </text>
      <text
        x={col2x + 120}
        y={cellTextY(tableY)}
        fill="#334155"
        style={{ fontSize: '380px', fontWeight: 700 }}
      >
        Date
      </text>
      <text
        x={col3x + 120}
        y={cellTextY(tableY)}
        fill="#334155"
        style={{ fontSize: '380px', fontWeight: 700 }}
      >
        By
      </text>
      {rows.map((row, i) => {
        const ry = tableY + headerHeight + i * rowHeight;
        return (
          <g key={row.revisionId} data-testid={`sheet-revision-row-${row.revisionId}`}>
            {i > 0 ? (
              <line x1={x} y1={ry} x2={x + totalWidth} y2={ry} stroke="#94a3b8" strokeWidth={30} />
            ) : null}
            <text x={col0x + 120} y={cellTextY(ry)} fill="#334155" style={{ fontSize: '360px' }}>
              {row.number}
            </text>
            <text x={col1x + 120} y={cellTextY(ry)} fill="#334155" style={{ fontSize: '360px' }}>
              {row.description}
            </text>
            <text x={col2x + 120} y={cellTextY(ry)} fill="#334155" style={{ fontSize: '360px' }}>
              {row.date}
            </text>
            <text x={col3x + 120} y={cellTextY(ry)} fill="#334155" style={{ fontSize: '360px' }}>
              {row.issuedBy ?? ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function SheetTitleblockEditor(props: {
  sheetId: string;

  sheetName: string;

  draft: SheetTitleblockDraft;

  priorTitleblockParameters: Record<string, string>;

  setDraft: Dispatch<SetStateAction<SheetTitleblockDraft>>;

  disabled?: boolean;

  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}) {
  const { draft, setDraft, onUpsertSemantic } = props;

  const commit = () => {
    if (!onUpsertSemantic) return;

    const tbSym = draft.titleBlock.trim();

    const params = mergedTitleblockParametersForUpsert(props.priorTitleblockParameters, draft);

    onUpsertSemantic({
      type: 'upsertSheet',

      id: props.sheetId,

      name: props.sheetName,

      titleBlock: tbSym || null,

      titleblockParameters: params,
    });
  };

  const row = (label: string, key: keyof SheetTitleblockDraft) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-muted">{label}</span>

      <input
        className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div id="sheet-titleblock-editor" className="mt-3 space-y-2 text-[10px]">
      <div className="font-semibold text-muted">Replayable titleblock · upsertSheet</div>

      <div className="text-muted">{props.sheetName}</div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {row('titleBlock (symbol)', 'titleBlock')}

        {row('sheetNumber', 'sheetNumber')}

        {row('revision', 'revision')}

        {row('revisionId', 'revisionId')}

        {row('revisionDate', 'revisionDate')}

        {row('revisionDescription', 'revisionDescription')}

        {row('issueStatus', 'issueStatus')}

        {row('projectName', 'projectName')}

        {row('drawnBy', 'drawnBy')}

        {row('checkedBy', 'checkedBy')}

        {row('issuedBy', 'issuedBy')}

        {row('issueDate', 'issueDate')}
      </div>

      <button
        type="button"
        className="rounded border border-accent bg-accent/15 px-2 py-1 text-[11px]"
        disabled={props.disabled ?? !onUpsertSemantic}
        onClick={() => {
          commit();
        }}
      >
        Commit titleblock · upsertSheet
      </button>
    </div>
  );
}
