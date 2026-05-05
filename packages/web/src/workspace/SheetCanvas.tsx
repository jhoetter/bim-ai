import type { Element } from '@bim-ai/core';

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { SheetViewportMmDraft } from './sheetViewportAuthoring';
import {
  readViewportMmBox,
  SheetViewportEditor,
  normalizeViewportRaw,
  clampViewportMmPosition,
  clampViewportMmBox,
} from './sheetViewportAuthoring';
import {
  SheetTitleblockEditor,
  normalizeTitleblockDraftFromSheet,
} from './sheetTitleblockAuthoring';
import { SheetDocumentationManifest } from './SheetDocumentationManifest';
import { resolveViewportTitleFromRef } from './sheetViewRef';
import { SectionViewportSvg } from './sectionViewportSvg';

type SheetEl = Extract<Element, { kind: 'sheet' }>;

function clientToSvgMm(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return { x: 0, y: 0 };
  }
  const sp = pt.matrixTransform(ctm.inverse());
  return { x: sp.x, y: sp.y };
}

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

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ index: number; grabDX: number; grabDY: number } | null>(null);
  const resizeRef = useRef<{ index: number } | null>(null);

  const authoring = Boolean(props.onUpsertSemantic);

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

  const paintRows: Array<{
    key: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    viewRef: string;
    label: string;
    index: number;
  }> = authoring
    ? vpDrafts.map((d, index) => ({
        key: d.viewportId,
        xMm: d.xMm,
        yMm: d.yMm,
        widthMm: d.widthMm,
        heightMm: d.heightMm,
        viewRef: d.viewRef,
        label: d.label,
        index,
      }))
    : vps.map((vpRaw, index) => {
        const vp = vpRaw as Record<string, unknown>;
        const box = readViewportMmBox(vp);
        const viewRefRaw = vp.viewRef ?? vp.view_ref;
        const label = typeof vp.label === 'string' ? vp.label : 'Viewport';
        return {
          key: String(vp.viewportId ?? vp.viewport_id ?? `${box.xMm}_${box.yMm}_${index}`),
          xMm: box.xMm,
          yMm: box.yMm,
          widthMm: box.widthMm,
          heightMm: box.heightMm,
          viewRef: typeof viewRefRaw === 'string' ? viewRefRaw : '',
          label,
          index,
        };
      });

  const beginDrag = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    if (!authoring) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const d = vpDrafts[index];
    if (!d) return;
    const m = clientToSvgMm(svg, e.clientX, e.clientY);
    dragRef.current = { index, grabDX: m.x - d.xMm, grabDY: m.y - d.yMm };

    const onMove = (ev: PointerEvent) => {
      const dd = dragRef.current;
      const el = svgRef.current;
      if (!dd || !el) return;
      const pt = clientToSvgMm(el, ev.clientX, ev.clientY);
      setVpDrafts((prev) => {
        const row = prev[dd.index];
        if (!row) return prev;
        const nx = pt.x - dd.grabDX;
        const ny = pt.y - dd.grabDY;
        const { xMm, yMm } = clampViewportMmPosition(wMm, hMm, {
          xMm: nx,
          yMm: ny,
          widthMm: row.widthMm,
          heightMm: row.heightMm,
        });
        if (row.xMm === xMm && row.yMm === yMm) return prev;
        const next = [...prev];
        next[dd.index] = { ...row, xMm, yMm };
        return next;
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const beginResize = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    if (!authoring) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    if (!vpDrafts[index]) return;
    resizeRef.current = { index };

    const onMove = (ev: PointerEvent) => {
      const rr = resizeRef.current;
      const el = svgRef.current;
      if (!rr || !el) return;
      const pt = clientToSvgMm(el, ev.clientX, ev.clientY);
      setVpDrafts((prev) => {
        const row = prev[rr.index];
        if (!row) return prev;
        const nwRaw = pt.x - row.xMm;
        const nhRaw = pt.y - row.yMm;
        const nextBox = clampViewportMmBox(wMm, hMm, {
          xMm: row.xMm,
          yMm: row.yMm,
          widthMm: nwRaw,
          heightMm: nhRaw,
        });
        if (
          row.widthMm === nextBox.widthMm &&
          row.heightMm === nextBox.heightMm &&
          row.xMm === nextBox.xMm &&
          row.yMm === nextBox.yMm
        ) {
          return prev;
        }
        const cp = [...prev];
        cp[rr.index] = { ...row, ...nextBox };
        return cp;
      });
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      data-testid="sheet-canvas"
      className={`overflow-auto rounded border border-border bg-background p-2${scrollCls}`}
    >
      <div data-testid="sheet-canvas-full-bleed">
        <svg
          ref={svgRef}
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

          {paintRows.map((row) => {
            const { xMm, yMm, widthMm, heightMm, viewRef, label, index } = row;
            const resolved = resolveViewportTitleFromRef(elementsById, viewRef);
            const primary = resolved ?? label;
            const sub = viewRef.trim() ? viewRef : '';
            const secId =
              modelId && (viewRef.startsWith('section:') || viewRef.startsWith('sec:'))
                ? viewRef.split(':', 2)[1]?.trim()
                : '';
            const secInnerW = Math.max(200, widthMm - 320);
            const secInnerH = Math.max(200, heightMm - 2700);

            const handle = 560;
            const hx = xMm + widthMm - handle;
            const hy = yMm + heightMm - handle;

            return (
              <g key={row.key}>
                <rect
                  data-testid={`sheet-viewport-${index}`}
                  x={xMm}
                  y={yMm}
                  width={widthMm}
                  height={heightMm}
                  fill="#ffffff"
                  stroke="#475569"
                  strokeWidth={80}
                  className={authoring ? 'cursor-move touch-none' : undefined}
                  onPointerDown={authoring ? (e) => beginDrag(e, index) : undefined}
                />
                {authoring ? (
                  <rect
                    data-testid={`sheet-viewport-resize-${index}`}
                    x={hx}
                    y={hy}
                    width={handle}
                    height={handle}
                    fill="#475569"
                    stroke="#1e293b"
                    strokeWidth={40}
                    className="cursor-nwse-resize touch-none"
                    onPointerDown={(e) => beginResize(e, index)}
                  />
                ) : null}
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

      <SheetDocumentationManifest
        sheet={sh}
        modelId={modelId}
        elementsById={elementsById}
        authoring={authoring}
        tbDraft={tbDraft}
        vpDrafts={vpDrafts}
      />

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
