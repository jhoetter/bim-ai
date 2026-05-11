import type { Element } from '@bim-ai/core';
import type { Dispatch, SetStateAction } from 'react';
import { Fragment } from 'react';

import { parseSheetViewRef } from './sheetViewRef';
import {
  buildRecommendedSheetViewportDrafts,
  recommendedSheetViewportsCommand,
  recommendedViewsForSheet,
} from './sheetRecommendedViewports';

/** Normalized authoring row for replayable `upsertSheetViewports`. */

export type Vec2MmDraft = { xMm: number; yMm: number };

export type SheetViewportMmDraft = {
  viewportId: string;

  label: string;

  viewRef: string;

  detailNumber: string;

  scale: string;

  viewportLocked: boolean;

  viewportRole: 'standard' | 'detail_callout';

  xMm: number;

  yMm: number;

  widthMm: number;

  heightMm: number;

  cropMinMm: Vec2MmDraft | null;

  cropMaxMm: Vec2MmDraft | null;
};

export function parsePlanViewRefId(viewRef: string): string | null {
  const t = viewRef.trim();
  const m = /^plan:\s*(.+)$/i.exec(t);
  return m?.[1]?.trim() ? m[1].trim() : null;
}

function readOptionalFinite(rec: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readCropCorner(
  raw: Record<string, unknown>,
  camel: string,
  snake: string,
): Vec2MmDraft | null {
  const obj = raw[camel] ?? raw[snake];
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const x = readOptionalFinite(rec, ['xMm', 'x_mm']);
  const y = readOptionalFinite(rec, ['yMm', 'y_mm']);
  if (x === undefined || y === undefined) return null;
  return { xMm: x, yMm: y };
}

function readViewportLockedFlag(raw: Record<string, unknown>): boolean {
  const v = raw.viewportLocked ?? raw.viewport_locked ?? raw.locked;
  if (v === true || v === 1) return true;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'true') return true;
  return false;
}

function readViewportRoleFromRaw(raw: Record<string, unknown>): 'standard' | 'detail_callout' {
  const v = raw.viewportRole ?? raw.viewport_role;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    if (s === 'detail_callout' || s === 'detailcallout') return 'detail_callout';
  }
  return 'standard';
}

/** Detail number, scale token, and lock flag from a persisted viewport row (read-only surfaces / hydration). */
export function readViewportPresentationMeta(raw: Record<string, unknown>): {
  detailNumber: string;
  scale: string;
  viewportLocked: boolean;
} {
  const dn = raw.detailNumber ?? raw.detail_number;
  const sc = raw.scale;
  const detailNumber = (
    typeof dn === 'string' ? dn : dn != null && typeof dn !== 'object' ? String(dn) : ''
  ).trim();
  const scale = (
    typeof sc === 'string' ? sc : sc != null && typeof sc !== 'object' ? String(sc) : ''
  ).trim();
  return { detailNumber, scale, viewportLocked: readViewportLockedFlag(raw) };
}

export function sheetViewportsMmFromDrafts(
  rows: SheetViewportMmDraft[],
): Record<string, unknown>[] {
  return rows.map((r) => {
    const row: Record<string, unknown> = {
      viewportId: r.viewportId.trim() || undefined,

      label: r.label.trim() || 'Viewport',

      viewRef: r.viewRef.trim() || undefined,

      xMm: r.xMm,

      yMm: r.yMm,

      widthMm: r.widthMm,

      heightMm: r.heightMm,
    };
    const d = r.detailNumber.trim();
    if (d) row.detailNumber = d;
    const sc = r.scale.trim();
    if (sc) row.scale = sc;
    if (r.viewportLocked) row.viewportLocked = true;
    if (r.viewportRole === 'detail_callout') row.viewportRole = 'detail_callout';
    if (r.cropMinMm !== null && r.cropMaxMm !== null) {
      row.cropMinMm = { xMm: r.cropMinMm.xMm, yMm: r.cropMinMm.yMm };
      row.cropMaxMm = { xMm: r.cropMaxMm.xMm, yMm: r.cropMaxMm.yMm };
    }
    return row;
  });
}

/** Read mm box from persisted viewport dict (camelCase plus legacy `wMm`/`hMm`). */
export function readViewportMmBox(raw: Record<string, unknown>): {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
} {
  const xMm = Number(raw.xMm ?? raw.x_mm ?? 0);
  const yMm = Number(raw.yMm ?? raw.y_mm ?? 0);
  const widthMm = Number(raw.widthMm ?? raw.width_mm ?? raw.wMm ?? raw.w_mm ?? 1000);
  const heightMm = Number(raw.heightMm ?? raw.height_mm ?? raw.hMm ?? raw.h_mm ?? 1000);
  const nx = Number.isFinite(xMm) ? xMm : 0;
  const ny = Number.isFinite(yMm) ? yMm : 0;
  const nw = Number.isFinite(widthMm) ? Math.max(10, widthMm) : 1000;
  const nh = Number.isFinite(heightMm) ? Math.max(10, heightMm) : 1000;
  return { xMm: nx, yMm: ny, widthMm: nw, heightMm: nh };
}

/** Clamp viewport top-left so the rect stays inside paper bounds (sheet mm space). */
export function clampViewportMmPosition(
  paperWidthMm: number,
  paperHeightMm: number,
  box: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): { xMm: number; yMm: number } {
  const maxX = Math.max(0, paperWidthMm - box.widthMm);
  const maxY = Math.max(0, paperHeightMm - box.heightMm);
  return {
    xMm: Math.min(Math.max(0, box.xMm), maxX),
    yMm: Math.min(Math.max(0, box.yMm), maxY),
  };
}

/** Clamp viewport box dimensions (min 10 mm edges) and origin so the rect fits the paper. */
export function clampViewportMmBox(
  paperWidthMm: number,
  paperHeightMm: number,
  box: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): { xMm: number; yMm: number; widthMm: number; heightMm: number } {
  let w = Math.max(10, box.widthMm);
  let h = Math.max(10, box.heightMm);
  w = Math.min(w, paperWidthMm);
  h = Math.min(h, paperHeightMm);
  const maxX = Math.max(0, paperWidthMm - w);
  const maxY = Math.max(0, paperHeightMm - h);
  return {
    xMm: Math.min(Math.max(0, box.xMm), maxX),
    yMm: Math.min(Math.max(0, box.yMm), maxY),
    widthMm: w,
    heightMm: h,
  };
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
  const { xMm: nx, yMm: ny, widthMm: nw, heightMm: nh } = readViewportMmBox(raw);

  const viewRefRaw = raw.viewRef ?? raw.view_ref;

  const viewportIdRaw = raw.viewportId ?? raw.viewport_id;

  const labelRaw = raw.label;

  const viewRef = typeof viewRefRaw === 'string' ? viewRefRaw : '';

  const fp = fingerprintViewportFallback(index, nx, ny, nw, nh, viewRef);

  const cmin = readCropCorner(raw, 'cropMinMm', 'crop_min_mm');
  const cmax = readCropCorner(raw, 'cropMaxMm', 'crop_max_mm');
  const hasCrop = cmin !== null && cmax !== null;
  const { detailNumber, scale, viewportLocked } = readViewportPresentationMeta(raw);
  const viewportRole = readViewportRoleFromRaw(raw);

  return {
    viewportId:
      typeof viewportIdRaw === 'string' && viewportIdRaw.trim()
        ? viewportIdRaw.trim()
        : `vp-${index}-${fp}`,
    label: typeof labelRaw === 'string' ? labelRaw : 'Viewport',
    viewRef,
    detailNumber,
    scale,
    viewportLocked,
    viewportRole,
    xMm: nx,
    yMm: ny,
    widthMm: nw,

    heightMm: nh,
    cropMinMm: hasCrop ? cmin : null,
    cropMaxMm: hasCrop ? cmax : null,
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
  const recommendedCount = recommendedViewsForSheet(elementsById, props.sheetId).length;

  const commit = () => {
    if (!props.onUpsertSemantic) return;

    props.onUpsertSemantic({
      type: 'upsertSheetViewports',

      sheetId: props.sheetId,

      viewportsMm: sheetViewportsMmFromDrafts(drafts),
    });
  };

  const pullCropFromPlan = (idx: number) => {
    const row = drafts[idx];
    if (!row) return;
    const pid = parsePlanViewRefId(row.viewRef);
    if (!pid) return;
    const el = elementsById[pid];
    if (!el || el.kind !== 'plan_view') return;
    const { cropMinMm, cropMaxMm } = el;
    if (!cropMinMm || !cropMaxMm) return;
    patchRow(
      idx,
      {
        cropMinMm: { xMm: cropMinMm.xMm, yMm: cropMinMm.yMm },
        cropMaxMm: { xMm: cropMaxMm.xMm, yMm: cropMaxMm.yMm },
      },
      drafts,
      setDrafts,
    );
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

          detailNumber: '',

          scale: '',

          viewportLocked: false,

          viewportRole: 'standard',

          xMm: x,

          yMm: y,

          widthMm: w,

          heightMm: h,
          cropMinMm: null,
          cropMaxMm: null,
        },
      ];
    });
  };

  const refExamples =
    '`plan:<plan_view id>` · `schedule:<schedule id>` · `section:<section_cut id>` · `viewpoint:<viewpoint id>`';

  return (
    <div id="sheet-viewport-editor" className="mt-3 space-y-2 text-[10px]">
      <div className="font-semibold text-muted">
        Replayable viewport placement ({props.sheetId})
      </div>

      <div className="text-muted">{props.sheetName}</div>

      <div className="mt-2 grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.8fr)_minmax(0,2.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_repeat(4,minmax(0,0.95fr))] gap-x-1 gap-y-2 font-mono text-[9px] text-muted">
        <span>viewportId</span>

        <span>label</span>

        <span>viewRef</span>

        <span>kind</span>

        <span>detail #</span>

        <span>scale</span>

        <span>lock</span>

        <span>role</span>

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

            <span
              className="self-center truncate font-mono text-[10px] text-foreground/80"
              title={parseSheetViewRef(row.viewRef)?.normalizedRef ?? ''}
            >
              {parseSheetViewRef(row.viewRef)?.kind ?? 'unknown'}
            </span>

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              aria-label="Detail number"
              value={row.detailNumber}
              onChange={(e) => patchRow(idx, { detailNumber: e.target.value }, drafts, setDrafts)}
            />

            <input
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              aria-label="Scale"
              placeholder="1:100"
              value={row.scale}
              onChange={(e) => patchRow(idx, { scale: e.target.value }, drafts, setDrafts)}
            />

            <label className="flex items-center justify-center gap-0.5 self-center">
              <input
                type="checkbox"
                checked={row.viewportLocked}
                aria-label="Viewport locked"
                onChange={(e) =>
                  patchRow(idx, { viewportLocked: e.target.checked }, drafts, setDrafts)
                }
              />
            </label>

            <select
              className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
              aria-label="Viewport role"
              value={row.viewportRole}
              onChange={(e) =>
                patchRow(
                  idx,
                  {
                    viewportRole:
                      e.target.value === 'detail_callout' ? 'detail_callout' : 'standard',
                  },
                  drafts,
                  setDrafts,
                )
              }
            >
              <option value="standard">standard</option>
              <option value="detail_callout">detail_callout</option>
            </select>

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

            <div className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-1 text-muted">
              <span className="font-mono">crop min mm</span>
              <input
                className="w-14 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                inputMode="decimal"
                aria-label="Crop min X mm"
                value={row.cropMinMm == null ? '' : String(row.cropMinMm.xMm)}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  if (t === '') {
                    patchRow(idx, { cropMinMm: null, cropMaxMm: null }, drafts, setDrafts);
                    return;
                  }
                  const nx = Number(t);
                  if (!Number.isFinite(nx)) return;
                  const minY = row.cropMinMm?.yMm ?? 0;
                  const max = row.cropMaxMm ?? { xMm: 0, yMm: 0 };
                  patchRow(
                    idx,
                    { cropMinMm: { xMm: nx, yMm: minY }, cropMaxMm: max },
                    drafts,
                    setDrafts,
                  );
                }}
              />
              <input
                className="w-14 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                inputMode="decimal"
                aria-label="Crop min Y mm"
                value={row.cropMinMm == null ? '' : String(row.cropMinMm.yMm)}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  if (t === '') {
                    patchRow(idx, { cropMinMm: null, cropMaxMm: null }, drafts, setDrafts);
                    return;
                  }
                  const ny = Number(t);
                  if (!Number.isFinite(ny)) return;
                  const minX = row.cropMinMm?.xMm ?? 0;
                  const max = row.cropMaxMm ?? { xMm: 0, yMm: 0 };
                  patchRow(
                    idx,
                    { cropMinMm: { xMm: minX, yMm: ny }, cropMaxMm: max },
                    drafts,
                    setDrafts,
                  );
                }}
              />
              <span className="font-mono">max</span>
              <input
                className="w-14 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                inputMode="decimal"
                aria-label="Crop max X mm"
                value={row.cropMaxMm == null ? '' : String(row.cropMaxMm.xMm)}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  if (t === '') {
                    patchRow(idx, { cropMinMm: null, cropMaxMm: null }, drafts, setDrafts);
                    return;
                  }
                  const nx = Number(t);
                  if (!Number.isFinite(nx)) return;
                  const min = row.cropMinMm ?? { xMm: 0, yMm: 0 };
                  const maxY = row.cropMaxMm?.yMm ?? 0;
                  patchRow(
                    idx,
                    { cropMinMm: min, cropMaxMm: { xMm: nx, yMm: maxY } },
                    drafts,
                    setDrafts,
                  );
                }}
              />
              <input
                className="w-14 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                inputMode="decimal"
                aria-label="Crop max Y mm"
                value={row.cropMaxMm == null ? '' : String(row.cropMaxMm.yMm)}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  if (t === '') {
                    patchRow(idx, { cropMinMm: null, cropMaxMm: null }, drafts, setDrafts);
                    return;
                  }
                  const ny = Number(t);
                  if (!Number.isFinite(ny)) return;
                  const min = row.cropMinMm ?? { xMm: 0, yMm: 0 };
                  const maxX = row.cropMaxMm?.xMm ?? 0;
                  patchRow(
                    idx,
                    { cropMinMm: min, cropMaxMm: { xMm: maxX, yMm: ny } },
                    drafts,
                    setDrafts,
                  );
                }}
              />
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[9px] text-muted"
                disabled={!parsePlanViewRefId(row.viewRef)}
                onClick={() => pullCropFromPlan(idx)}
              >
                Pull crop from plan view
              </button>
            </div>

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
          className="rounded border border-accent bg-accent/15 px-2 py-1 text-[11px] font-medium"
          disabled={(props.disabled ?? !onUpsertSemantic) || recommendedCount === 0}
          title={
            recommendedCount > 0
              ? `Place ${recommendedCount} unplaced view${recommendedCount === 1 ? '' : 's'} on this sheet`
              : 'All recommended views are already placed'
          }
          onClick={() => {
            const next = buildRecommendedSheetViewportDrafts(elementsById, props.sheetId);
            setDrafts(next);
            const cmd = recommendedSheetViewportsCommand(elementsById, props.sheetId);
            if (cmd) onUpsertSemantic?.(cmd);
          }}
        >
          Place recommended views
        </button>

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
