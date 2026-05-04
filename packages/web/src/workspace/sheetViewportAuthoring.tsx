import type { Element } from '@bim-ai/core';
import type { Dispatch, SetStateAction } from 'react';
import { Fragment } from 'react';

/** Normalized authoring row for replayable `upsertSheetViewports`. */

export type SheetViewportMmDraft = {
  viewportId: string;

  label: string;

  viewRef: string;

  xMm: number;

  yMm: number;

  widthMm: number;

  heightMm: number;
};

export function sheetViewportsMmFromDrafts(
  rows: SheetViewportMmDraft[],
): Record<string, unknown>[] {
  return rows.map((r) => ({
    viewportId: r.viewportId.trim() || undefined,

    label: r.label.trim() || 'Viewport',

    viewRef: r.viewRef.trim() || undefined,

    xMm: r.xMm,

    yMm: r.yMm,

    widthMm: r.widthMm,

    heightMm: r.heightMm,
  }));
}

/** Stable fallback id when `viewportId` is missing (replay / hydration). */
export function fingerprintViewportFallback(
  index: number,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  viewRef: string,
): string {
  const s = `${index}|${xMm}|${yMm}|${widthMm}|${heightMm}|${viewRef}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(33, h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function normalizeViewportRaw(
  raw: Record<string, unknown>,
  index = 0,
): SheetViewportMmDraft {
  const xMm = Number(raw.xMm ?? raw.x_mm ?? 0);

  const yMm = Number(raw.yMm ?? raw.y_mm ?? 0);

  const widthMm = Number(raw.widthMm ?? raw.width_mm ?? 1000);

  const heightMm = Number(raw.heightMm ?? raw.height_mm ?? 1000);

  const viewRefRaw = raw.viewRef ?? raw.view_ref;

  const viewportIdRaw = raw.viewportId ?? raw.viewport_id;

  const labelRaw = raw.label;

  const nx = Number.isFinite(xMm) ? xMm : 0;

  const ny = Number.isFinite(yMm) ? yMm : 0;

  const nw = Number.isFinite(widthMm) ? Math.max(10, widthMm) : 1000;

  const nh = Number.isFinite(heightMm) ? Math.max(10, heightMm) : 1000;

  const viewRef = typeof viewRefRaw === 'string' ? viewRefRaw : '';

  const fp = fingerprintViewportFallback(index, nx, ny, nw, nh, viewRef);

  return {
    viewportId:
      typeof viewportIdRaw === 'string' && viewportIdRaw.trim()
        ? viewportIdRaw.trim()
        : `vp-${index}-${fp}`,
    label: typeof labelRaw === 'string' ? labelRaw : 'Viewport',
    viewRef,
    xMm: nx,
    yMm: ny,
    widthMm: nw,

    heightMm: nh,
  };
}

function refSuggestions(elementsById: Record<string, Element>) {
  return Object.values(elementsById).filter(
    (
      el,
    ): el is Extract<
      Element,
      { kind: 'plan_view' } | { kind: 'schedule' } | { kind: 'section_cut' } | { kind: 'viewpoint' }
    > =>
      el.kind === 'plan_view' ||
      el.kind === 'schedule' ||
      el.kind === 'section_cut' ||
      el.kind === 'viewpoint',
  );
}

function patchRow(
  idx: number,

  patch: Partial<SheetViewportMmDraft>,

  drafts: SheetViewportMmDraft[],
  setDrafts: Dispatch<SetStateAction<SheetViewportMmDraft[]>>,
) {
  setDrafts(drafts.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
}

export function SheetViewportEditor(props: {
  sheetName: string;

  sheetId: string;

  drafts: SheetViewportMmDraft[];

  setDrafts: Dispatch<SetStateAction<SheetViewportMmDraft[]>>;

  elementsById: Record<string, Element>;

  disabled?: boolean;

  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}) {
  const { drafts, setDrafts, elementsById, onUpsertSemantic } = props;

  const commit = () => {
    if (!props.onUpsertSemantic) return;

    props.onUpsertSemantic({
      type: 'upsertSheetViewports',

      sheetId: props.sheetId,

      viewportsMm: sheetViewportsMmFromDrafts(drafts),
    });
  };

  const addRow = () => {
    setDrafts((prev) => {
      const x = 1200;

      const y = 1200 + prev.length * 800;

      const w = 5000;

      const h = 4000;

      const ref = 'plan:';

      const nid = `vp-add-${prev.length}-${fingerprintViewportFallback(prev.length, x, y, w, h, ref)}`;

      return [
        ...prev,

        {
          viewportId: nid,

          label: 'Viewport',

          viewRef: ref,

          xMm: x,

          yMm: y,

          widthMm: w,

          heightMm: h,
        },
      ];
    });
  };

  const refExamples =
    '`plan:<plan_view id>` · `schedule:<schedule id>` · `section:<section_cut id>` · `viewpoint:<viewpoint id>`';

  return (
    <div className="mt-3 space-y-2 text-[10px]">
      <div className="font-semibold text-muted">
        Replayable viewport placement ({props.sheetId})
      </div>

      <div className="text-muted">{props.sheetName}</div>

      <div className="mt-2 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,3fr)_repeat(4,minmax(0,1fr))] gap-x-1 gap-y-2 font-mono text-[9px] text-muted">
        <span>viewportId</span>

        <span>label</span>

        <span>viewRef</span>

        <span>xMm</span>

        <span>yMm</span>

        <span>w</span>

        <span>h</span>

        {drafts.map((row, idx) => (
          <Fragment key={`viewport-row-${idx}-${row.viewportId}`}>
            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              value={row.viewportId}
              onChange={(e) => patchRow(idx, { viewportId: e.target.value }, drafts, setDrafts)}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              value={row.label}
              onChange={(e) => patchRow(idx, { label: e.target.value }, drafts, setDrafts)}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              title={refExamples}
              list="sheet-viewport-ref-datalist"
              value={row.viewRef}
              onChange={(e) => patchRow(idx, { viewRef: e.target.value }, drafts, setDrafts)}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              inputMode="decimal"
              value={String(row.xMm)}
              onChange={(e) => {
                const n = Number(e.target.value);

                if (Number.isFinite(n)) patchRow(idx, { xMm: n }, drafts, setDrafts);
              }}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              inputMode="decimal"
              value={String(row.yMm)}
              onChange={(e) => {
                const n = Number(e.target.value);

                if (Number.isFinite(n)) patchRow(idx, { yMm: n }, drafts, setDrafts);
              }}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              inputMode="decimal"
              value={String(row.widthMm)}
              onChange={(e) => {
                const n = Number(e.target.value);

                if (Number.isFinite(n))
                  patchRow(idx, { widthMm: Math.max(10, n) }, drafts, setDrafts);
              }}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              inputMode="decimal"
              value={String(row.heightMm)}
              onChange={(e) => {
                const n = Number(e.target.value);

                if (Number.isFinite(n))
                  patchRow(idx, { heightMm: Math.max(10, n) }, drafts, setDrafts);
              }}
            />

            <div className="col-span-full flex justify-end">
              <button
                type="button"
                className="text-[9px] text-muted underline"
                onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== idx))}
              >
                remove
              </button>
            </div>
          </Fragment>
        ))}
      </div>

      <datalist id="sheet-viewport-ref-datalist">
        {refSuggestions(elementsById).map((el) => {
          switch (el.kind) {
            case 'plan_view': {
              return (
                <option
                  key={`plan:${el.id}`}
                  value={`plan:${el.id}`}
                  label={`plan_view · ${el.name}`}
                />
              );
            }

            case 'schedule': {
              return (
                <option
                  key={`schedule:${el.id}`}
                  value={`schedule:${el.id}`}
                  label={`schedule · ${el.name}`}
                />
              );
            }

            case 'section_cut': {
              return (
                <option
                  key={`section:${el.id}`}
                  value={`section:${el.id}`}
                  label={`section_cut · ${el.name}`}
                />
              );
            }

            case 'viewpoint': {
              return (
                <option
                  key={`viewpoint:${el.id}`}
                  value={`viewpoint:${el.id}`}
                  label={`viewpoint · ${el.name}`}
                />
              );
            }

            default: {
              return null;
            }
          }
        })}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-border bg-background px-2 py-1 text-[10px]"
          disabled={props.disabled ?? !onUpsertSemantic}
          onClick={() => {
            addRow();
          }}
        >
          Add viewport
        </button>

        <button
          type="button"
          className="rounded border border-accent bg-accent/15 px-2 py-1 text-[11px]"
          disabled={props.disabled ?? !onUpsertSemantic}
          onClick={() => {
            commit();
          }}
        >
          Commit viewports · upsertSheetViewports
        </button>
      </div>
    </div>
  );
}
