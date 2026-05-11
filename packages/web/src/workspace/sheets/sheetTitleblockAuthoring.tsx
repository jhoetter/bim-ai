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
