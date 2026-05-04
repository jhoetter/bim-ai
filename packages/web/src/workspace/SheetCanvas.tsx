import type { Element } from '@bim-ai/core';

import { useMemo, useState } from 'react';

import type { SheetViewportMmDraft } from './sheetViewportAuthoring';
import {
  readViewportMmBox,
  SheetViewportEditor,
  normalizeViewportRaw,
} from './sheetViewportAuthoring';
import {
  SheetTitleblockEditor,
  normalizeTitleblockDraftFromSheet,
} from './sheetTitleblockAuthoring';
import { resolveViewportTitleFromRef } from './sheetViewRef';
import { SectionViewportSvg } from './sectionViewportSvg';

type SheetEl = Extract<Element, { kind: 'sheet' }>;

function SheetCanvasWithSheet(props: {
  sheet: SheetEl;
  evidenceFullBleed?: boolean;
  modelId?: string;
  elementsById: Record<string, Element>;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}) {
  const { sheet: sh, evidenceFullBleed, modelId, elementsById } = props;

  const bleed = evidenceFullBleed ?? false;
  const wMm =
    typeof sh.paperWidthMm === 'number' && Number.isFinite(sh.paperWidthMm)
      ? sh.paperWidthMm
      : 42_000;
  const hMm =
    typeof sh.paperHeightMm === 'number' && Number.isFinite(sh.paperHeightMm)
      ? sh.paperHeightMm
      : 29_700;

  const vps = (sh.viewportsMm ?? []) as Array<Record<string, unknown>>;
  const nextDraftBase = (): SheetViewportMmDraft[] =>
    vps.map((vp, i) => normalizeViewportRaw(vp, i));
  const [vpDrafts, setVpDrafts] = useState<SheetViewportMmDraft[]>(() => nextDraftBase());

  const [tbDraft, setTbDraft] = useState(() => normalizeTitleblockDraftFromSheet(sh));

  const tp = sh.titleblockParameters ?? {};
  const sheetNo = tp.sheetNumber ?? tp.sheetNo ?? '';
  const revision = tp.revision ?? '';
  const project = tp.projectName ?? tp.project ?? '';
  const drawn = tp.drawnBy ?? '';
  const chk = tp.checkedBy ?? '';
  const issued = tp.issueDate ?? tp.date ?? '';

  const hdrParts: string[] = [];
  if (String(sheetNo).trim()) hdrParts.push(String(sheetNo).trim());
  if (String(revision).trim()) hdrParts.push(`Rev ${String(revision).trim()}`);
  const hdr = hdrParts.join(' · ');

  const footerLines: string[] = [];
  if (hdr) footerLines.push(hdr);
  if (String(project).trim()) footerLines.push(String(project).trim());
  if (String(drawn).trim() || String(chk).trim()) {
    footerLines.push(
      `Drn ${String(drawn).trim()} · Chk ${String(chk).trim()}`.replace(/\s*·\s*$/, '').trim(),
    );
  }
  if (String(issued).trim()) footerLines.push(String(issued).trim());

  const footerY0 = Math.max(2800, hMm - 5200);
  const xRight = wMm - 2600;

  const scrollCls = bleed ? '' : ' max-h-[360px]';

  return (
    <div
      data-testid="sheet-canvas"
      className={`overflow-auto rounded border border-border bg-background p-2${scrollCls}`}
    >
      <div data-testid="sheet-canvas-full-bleed">
        <svg
          data-testid="sheet-svg"
          viewBox={`0 0 ${wMm} ${hMm}`}
          className={bleed ? 'h-auto w-full' : 'h-auto max-h-[360px] w-full'}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width={wMm} height={hMm} fill="#f8fafc" stroke="#1e293b" strokeWidth={120} />
          <rect x={800} y={800} width={wMm - 1600} height={3600} fill="#edf2ff" opacity={0.9} />

          <text x={2400} y={2400} className="fill-slate-800" style={{ fontSize: '1200px' }}>
            A1 metaphor — {sh.name}
          </text>

          <text x={2400} y={3600} className="fill-slate-500" style={{ fontSize: '800px' }}>
            TB {sh.titleBlock ?? '—'}
          </text>

          {footerLines
            .map((txt) => txt.trim())
            .filter(Boolean)
            .map((txt, i) => (
              <text
                key={`tb-${i}-${txt.slice(0, 12)}`}
                x={xRight}
                y={footerY0 + i * 760}
                fill="#334155"
                style={{ fontSize: '620px' }}
                textAnchor="end"
              >
                {txt}
              </text>
            ))}

          {vps.map((vpRaw) => {
            const vp = vpRaw as Record<string, unknown>;
            const box = readViewportMmBox(vp);
            const xMm = box.xMm;
            const yMm = box.yMm;
            const widthMm = box.widthMm;
            const heightMm = box.heightMm;

            const viewRefRaw = vp.viewRef ?? vp.view_ref;
            const resolved = resolveViewportTitleFromRef(elementsById, viewRefRaw);
            const fallback = typeof vp.label === 'string' ? vp.label : 'Viewport';
            const primary = resolved ?? fallback;
            const sub = typeof viewRefRaw === 'string' && viewRefRaw ? viewRefRaw : '';
            const secId =
              modelId &&
              typeof viewRefRaw === 'string' &&
              (viewRefRaw.startsWith('section:') || viewRefRaw.startsWith('sec:'))
                ? viewRefRaw.split(':', 2)[1]?.trim()
                : '';
            const secInnerW = Math.max(200, widthMm - 320);
            const secInnerH = Math.max(200, heightMm - 2700);

            return (
              <g key={String(vp.viewportId ?? vp.viewport_id ?? `${xMm}_${yMm}`)}>
                <rect
                  x={xMm}
                  y={yMm}
                  width={widthMm}
                  height={heightMm}
                  fill="#ffffff"
                  stroke="#475569"
                  strokeWidth={80}
                />
                {secId ? (
                  <svg
                    x={xMm + 160}
                    y={yMm + 1500}
                    width={secInnerW}
                    height={secInnerH}
                    viewBox={`0 0 ${secInnerW} ${secInnerH}`}
                  >
                    <SectionViewportSvg
                      modelId={modelId!}
                      sectionCutId={secId}
                      widthPx={secInnerW}
                      heightPx={secInnerH}
                    />
                  </svg>
                ) : null}
                <text x={xMm + 200} y={yMm + 900} fill="#475569" style={{ fontSize: '600px' }}>
                  {primary}
                </text>
                {sub ? (
                  <text x={xMm + 200} y={yMm + 1400} fill="#64748b" style={{ fontSize: '350px' }}>
                    {sub}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {props.onUpsertSemantic ? (
        <>
          <SheetTitleblockEditor
            sheetId={sh.id}
            sheetName={sh.name}
            draft={tbDraft}
            priorTitleblockParameters={tp as Record<string, string>}
            setDraft={setTbDraft}
            onUpsertSemantic={props.onUpsertSemantic}
          />

          <SheetViewportEditor
            sheetId={sh.id}
            sheetName={sh.name}
            drafts={vpDrafts}
            setDrafts={setVpDrafts}
            elementsById={elementsById}
            onUpsertSemantic={props.onUpsertSemantic}
          />
        </>
      ) : null}

      <div className="mt-1 font-mono text-[10px] text-muted">{sh.id}</div>
    </div>
  );
}

/** Paper-space preview: titleblock stripe + viewport frames from semantic `sheet` elements. */

export function SheetCanvas(props: {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
  modelId?: string;
  /**
   * When true, drop scroll/max-height clamps so PNG evidence can rasterize the entire sheet SVG
   * (drive via `/?evidenceSheetFull=1` in Playwright).
   */
  evidenceFullBleed?: boolean;
  /** When set, show a replayable `upsertSheetViewports` authoring band (WP-E05/E06/E04). */
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}) {
  const sheets = Object.values(props.elementsById).filter(
    (e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet',
  );

  const sh =
    sheets.find((s) => s.id === props.preferredSheetId) ??
    [...sheets].sort((a, b) => a.name.localeCompare(b.name))[0];

  const sheetAuthoringSyncKey = useMemo(
    () =>
      sh
        ? JSON.stringify({
            tb: sh.titleblockParameters ?? {},
            tbsym: sh.titleBlock ?? '',
            vps: sh.viewportsMm ?? [],
          })
        : '',
    [sh],
  );

  if (!sh) {
    return <div className="text-[11px] text-muted">No sheet elements in this model.</div>;
  }

  return (
    <SheetCanvasWithSheet
      key={`${sh.id}:${sheetAuthoringSyncKey}`}
      sheet={sh}
      evidenceFullBleed={props.evidenceFullBleed}
      modelId={props.modelId}
      elementsById={props.elementsById}
      onUpsertSemantic={props.onUpsertSemantic}
    />
  );
}
