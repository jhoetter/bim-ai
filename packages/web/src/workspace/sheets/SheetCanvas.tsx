/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import type { Element, LensMode, XY } from '@bim-ai/core';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { exportSheetToPdf } from '../../export/pdfExporter';
import type { SheetViewportMmDraft } from './sheetViewportAuthoring';
import {
  readViewportMmBox,
  readViewportPresentationMeta,
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
import { parseSheetViewRef, resolveViewportTitleFromRef } from './sheetViewRef';
import {
  buildPlaceholderDetailTitle,
  detailCalloutUnresolvedReason,
} from './sheetDetailCalloutReadout';
import {
  recommendedSheetViewportsCommand,
  recommendedViewsForSheet,
} from './sheetRecommendedViewports';
import { SectionViewportSvg } from './sectionViewportSvg';
import { normalizeSheetPaperMm } from './sheetPaper';
import {
  formatSheetRevIssTitleblockDisplaySegmentV1,
  normalizeTitleblockRevisionIssueV1,
} from './sheetRevisionIssueManifestV1';
import {
  readSheetIntent,
  sheetIntentPatchJson,
  sheetIntentLabel,
  type SheetIntentTag,
} from './sheetIntent';

type SheetEl = Extract<Element, { kind: 'sheet' }>;

/**
 * Renders a simplified floor-plan thumbnail as SVG JSX inside a viewport frame.
 * Returns null when no geometry is available for the given plan view.
 */
function renderPlanThumbnail(
  elementsById: Record<string, Element>,
  planViewId: string,
  widthMm: number,
  heightMm: number,
): ReactElement | null {
  const planView = elementsById[planViewId];
  if (!planView || planView.kind !== 'plan_view') return null;

  const levelId = planView.levelId;

  const walls = Object.values(elementsById).filter(
    (el): el is Extract<Element, { kind: 'wall' }> => el.kind === 'wall' && el.levelId === levelId,
  );
  const rooms = Object.values(elementsById).filter(
    (el): el is Extract<Element, { kind: 'room' }> => el.kind === 'room' && el.levelId === levelId,
  );
  const floors = Object.values(elementsById).filter(
    (el): el is Extract<Element, { kind: 'floor' }> =>
      el.kind === 'floor' && el.levelId === levelId,
  );

  if (walls.length === 0 && rooms.length === 0 && floors.length === 0) return null;

  // Collect all world coordinate points to compute bounding box
  const allPoints: XY[] = [];
  for (const w of walls) {
    allPoints.push(w.start, w.end);
  }
  for (const r of rooms) {
    allPoints.push(...r.outlineMm);
  }
  for (const f of floors) {
    allPoints.push(...f.boundaryMm);
  }

  if (allPoints.length === 0) return null;

  let bbMinX = allPoints[0].xMm;
  let bbMaxX = allPoints[0].xMm;
  let bbMinY = allPoints[0].yMm;
  let bbMaxY = allPoints[0].yMm;
  for (const pt of allPoints) {
    if (pt.xMm < bbMinX) bbMinX = pt.xMm;
    if (pt.xMm > bbMaxX) bbMaxX = pt.xMm;
    if (pt.yMm < bbMinY) bbMinY = pt.yMm;
    if (pt.yMm > bbMaxY) bbMaxY = pt.yMm;
  }

  // 5% padding
  const bbW = bbMaxX - bbMinX;
  const bbH = bbMaxY - bbMinY;
  const padX = bbW * 0.05;
  const padY = bbH * 0.05;
  const pMinX = bbMinX - padX;
  const pW = bbW + 2 * padX;
  const pH = bbH + 2 * padY;

  if (pW <= 0 || pH <= 0) return null;

  // Uniform scale preserving aspect ratio
  const scaleX = widthMm / pW;
  const scaleY = heightMm / pH;
  const scale = Math.min(scaleX, scaleY);

  // Center offset
  const renderedW = pW * scale;
  const renderedH = pH * scale;
  const offsetX = (widthMm - renderedW) / 2;
  const offsetY = (heightMm - renderedH) / 2;

  // World → SVG: flip Y (architectural y-up → SVG y-down)
  const toSvg = (pt: XY): { sx: number; sy: number } => ({
    sx: (pt.xMm - pMinX) * scale + offsetX,
    sy: (bbMaxY + padY - pt.yMm) * scale + offsetY,
  });

  const polyPoints = (pts: XY[]): string =>
    pts
      .map((pt) => {
        const { sx, sy } = toSvg(pt);
        return `${sx},${sy}`;
      })
      .join(' ');

  return (
    <g>
      {floors.map((f) => (
        <polygon
          key={f.id}
          points={polyPoints(f.boundaryMm)}
          fill="#f0f0f0"
          stroke="#aaa"
          strokeWidth={0.3}
        />
      ))}
      {rooms.map((r) => (
        <polygon
          key={r.id}
          points={polyPoints(r.outlineMm)}
          fill="rgba(200,220,240,0.3)"
          stroke="none"
        />
      ))}
      {walls.map((w) => {
        const s = toSvg(w.start);
        const e = toSvg(w.end);
        const sw = Math.min(4, Math.max(0.5, w.thicknessMm * scale));
        return (
          <line
            key={w.id}
            x1={s.sx}
            y1={s.sy}
            x2={e.sx}
            y2={e.sy}
            stroke="#334155"
            strokeWidth={sw}
          />
        );
      })}
    </g>
  );
}

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
  lensMode?: LensMode;
  elementsById: Record<string, Element>;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
}) {
  const { sheet: sh, evidenceFullBleed, modelId, lensMode, elementsById } = props;

  const bleed = evidenceFullBleed ?? false;
  const { widthMm: wMm, heightMm: hMm } = normalizeSheetPaperMm(sh.paperWidthMm, sh.paperHeightMm);

  const vps = (sh.viewportsMm ?? []) as Array<Record<string, unknown>>;
  const nextDraftBase = (): SheetViewportMmDraft[] =>
    vps.map((vp, i) => normalizeViewportRaw(vp, i));
  const [vpDrafts, setVpDrafts] = useState<SheetViewportMmDraft[]>(() => nextDraftBase());

  const [tbDraft, setTbDraft] = useState(() => normalizeTitleblockDraftFromSheet(sh));

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ index: number; grabDX: number; grabDY: number } | null>(null);
  const resizeRef = useRef<{ index: number } | null>(null);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = useCallback(async () => {
    const el = svgRef.current;
    if (!el || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const safeFilename = (sh.name || 'sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportSheetToPdf(el, { paperSize: 'A4', filename: `${safeFilename}.pdf` });
    } finally {
      setIsExportingPdf(false);
    }
  }, [sh.name, isExportingPdf]);

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

  const revIssSeg = formatSheetRevIssTitleblockDisplaySegmentV1(
    normalizeTitleblockRevisionIssueV1(tp as Record<string, string>),
  );
  const sheetIntent = readSheetIntent(sh);

  const footerY0 = Math.max(2800, hMm - 5200);
  const xRight = wMm - 2600;
  const marginMm = Math.max(1600, Math.min(wMm, hMm) * 0.045);
  const titleY = marginMm + 1000;
  const subtitleY = titleY + 1000;
  const emptyBoxX = marginMm;
  const emptyBoxY = marginMm + 2600;
  const emptyBoxW = Math.max(1000, wMm - marginMm * 2);
  const emptyBoxH = Math.max(1000, hMm - marginMm * 2 - 5200);
  const recommendedViewCount = recommendedViewsForSheet(elementsById, sh.id).length;

  const scrollCls = bleed ? '' : ' max-h-[360px]';

  const [planLegendHints, setPlanLegendHints] = useState<
    Record<string, { rowCount: number; digestPrefix: string }>
  >({});

  useEffect(() => {
    if (!modelId) {
      setPlanLegendHints({});
      return;
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/models/${encodeURIComponent(modelId)}/evidence-package`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setPlanLegendHints({});
          return;
        }
        const payload = JSON.parse(await res.text()) as Record<string, unknown>;
        const rows = payload.deterministicSheetEvidence;
        if (!Array.isArray(rows)) {
          setPlanLegendHints({});
          return;
        }
        const drow = (rows as Record<string, unknown>[]).find(
          (r) => String(r.sheetId ?? '') === sh.id,
        );
        if (!drow) {
          setPlanLegendHints({});
          return;
        }
        const hints = drow.planRoomProgrammeLegendHints_v0;
        if (!Array.isArray(hints)) {
          setPlanLegendHints({});
          return;
        }
        const next: Record<string, { rowCount: number; digestPrefix: string }> = {};
        for (const h of hints) {
          if (!h || typeof h !== 'object') continue;
          const vid = String((h as { viewportId?: unknown }).viewportId ?? '').trim();
          if (!vid) continue;
          const rc = (h as { rowCount?: unknown }).rowCount;
          const n = typeof rc === 'number' ? rc : Number(rc);
          const dig = String((h as { legendDigestSha256?: unknown }).legendDigestSha256 ?? '');
          next[vid] = {
            rowCount: Number.isFinite(n) ? n : 0,
            digestPrefix: dig.slice(0, 8),
          };
        }
        setPlanLegendHints(next);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setPlanLegendHints({});
      }
    })();
    return () => ac.abort();
  }, [modelId, sh.id]);

  const paintRows: Array<{
    key: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    viewRef: string;
    label: string;
    detailNumber: string;
    scale: string;
    viewportLocked: boolean;
    viewportRole: 'standard' | 'detail_callout';
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
        detailNumber: d.detailNumber,
        scale: d.scale,
        viewportLocked: d.viewportLocked,
        viewportRole: d.viewportRole,
        index,
      }))
    : vps.map((vpRaw, index) => {
        const vp = vpRaw as Record<string, unknown>;
        const n = normalizeViewportRaw(vp, index);
        const box = readViewportMmBox(vp);
        const viewRefRaw = vp.viewRef ?? vp.view_ref;
        const label = typeof vp.label === 'string' ? vp.label : 'Viewport';
        const meta = readViewportPresentationMeta(vp);
        return {
          key:
            n.viewportId ||
            String(vp.viewportId ?? vp.viewport_id ?? `${box.xMm}_${box.yMm}_${index}`),
          xMm: box.xMm,
          yMm: box.yMm,
          widthMm: box.widthMm,
          heightMm: box.heightMm,
          viewRef: typeof viewRefRaw === 'string' ? viewRefRaw : '',
          label,
          detailNumber: meta.detailNumber,
          scale: meta.scale,
          viewportLocked: meta.viewportLocked,
          viewportRole: n.viewportRole,
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
    if (!d || d.viewportLocked) return;
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
    const row = vpDrafts[index];
    if (!row || row.viewportLocked) return;
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
      {authoring ? (
        <div
          data-testid="sheet-intent-toolbar"
          className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
        >
          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="font-medium">Sheet intent</span>
            <select
              data-testid="sheet-intent-select"
              value={sheetIntent}
              onChange={(event) => {
                const intent = event.currentTarget.value as SheetIntentTag;
                props.onUpsertSemantic?.({
                  type: 'updateElementProperty',
                  elementId: sh.id,
                  key: 'titleblockParametersPatch',
                  value: sheetIntentPatchJson(intent),
                });
              }}
              className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
            >
              <option value="documentation">Documentation</option>
              <option value="moodboard">Moodboard</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-muted">
              Current tag:{' '}
              <span className="font-medium text-foreground">{sheetIntentLabel(sheetIntent)}</span>
            </div>
            <button
              type="button"
              data-testid="sheet-export-pdf-btn"
              disabled={isExportingPdf}
              onClick={() => void handleExportPdf()}
              className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isExportingPdf ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            data-testid="sheet-export-pdf-btn"
            disabled={isExportingPdf}
            onClick={() => void handleExportPdf()}
            className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isExportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      )}
      {paintRows.length === 0 && authoring ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded border border-border bg-surface-strong px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs font-medium text-foreground">No viewports placed</div>
            <div className="truncate text-[11px] text-muted">
              {recommendedViewCount > 0
                ? `${recommendedViewCount} unplaced view${recommendedViewCount === 1 ? '' : 's'} can be added to this sheet.`
                : 'All recommended model views are already placed or no placeable views exist.'}
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border border-accent bg-accent/15 px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={recommendedViewCount === 0}
            onClick={() => {
              const cmd = recommendedSheetViewportsCommand(elementsById, sh.id);
              if (cmd) props.onUpsertSemantic?.(cmd);
            }}
          >
            Place recommended
          </button>
        </div>
      ) : null}
      <div data-testid="sheet-canvas-full-bleed">
        <svg
          ref={svgRef}
          data-testid="sheet-svg"
          viewBox={`0 0 ${wMm} ${hMm}`}
          className={bleed ? 'h-auto w-full' : 'h-auto max-h-[360px] w-full'}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width={wMm} height={hMm} fill="#f8fafc" stroke="#1e293b" strokeWidth={120} />
          <rect
            x={marginMm}
            y={marginMm}
            width={Math.max(1000, wMm - marginMm * 2)}
            height={2400}
            fill="#edf2ff"
            opacity={0.9}
          />

          <text x={marginMm + 900} y={titleY} className="fill-slate-800" style={{ fontSize: 1200 }}>
            {sh.name}
          </text>

          <text
            x={marginMm + 900}
            y={subtitleY}
            className="fill-slate-500"
            style={{ fontSize: 800 }}
          >
            Title block {sh.titleBlock ?? '—'}
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

          {revIssSeg ? (
            <text
              data-testid="sheet-canvas-revision-issue-doc-token"
              x={xRight}
              y={footerY0 + footerLines.map((txt) => txt.trim()).filter(Boolean).length * 760}
              fill="#0369a1"
              style={{ fontSize: '520px' }}
              textAnchor="end"
            >
              {revIssSeg}
            </text>
          ) : null}

          {paintRows.length === 0 ? (
            <g data-testid="sheet-empty-viewports">
              <rect
                x={emptyBoxX}
                y={emptyBoxY}
                width={emptyBoxW}
                height={emptyBoxH}
                fill="#ffffff"
                stroke="#94a3b8"
                strokeWidth={80}
                strokeDasharray="520 320"
              />
              <text
                x={wMm / 2}
                y={emptyBoxY + emptyBoxH / 2 - 450}
                fill="#475569"
                style={{ fontSize: 900, fontWeight: 600 }}
                textAnchor="middle"
              >
                No views placed on this sheet
              </text>
              <text
                x={wMm / 2}
                y={emptyBoxY + emptyBoxH / 2 + 500}
                fill="#64748b"
                style={{ fontSize: 600 }}
                textAnchor="middle"
              >
                Place floor plans, sections, schedules, or 3D views as sheet viewports.
              </text>
            </g>
          ) : null}

          {/* ANN-12 — north arrow symbols hosted on this sheet */}
          {Object.values(elementsById)
            .filter(
              (el): el is Extract<Element, { kind: 'annotation_symbol' }> =>
                el.kind === 'annotation_symbol' &&
                el.symbolType === 'north_arrow' &&
                el.hostViewId === sh.id,
            )
            .map((sym) => {
              const projectSettings = Object.values(elementsById).find(
                (e): e is Extract<Element, { kind: 'project_settings' }> =>
                  e.kind === 'project_settings',
              );
              const northDeg =
                (sym.rotationDeg ?? 0) + (projectSettings?.projectNorthAngleDeg ?? 0);
              const cx = sym.positionMm.xMm;
              const cy = sym.positionMm.yMm;
              const r = 1200 * (sym.scale ?? 1);
              return (
                <g
                  key={sym.id}
                  data-testid={`sheet-north-arrow-${sym.id}`}
                  transform={`rotate(${northDeg}, ${cx}, ${cy})`}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={sym.colour ?? '#202020'}
                    strokeWidth={80}
                  />
                  <polygon
                    points={`${cx},${cy - r * 0.85} ${cx - r * 0.35},${cy + r * 0.5} ${cx},${cy + r * 0.25} ${cx + r * 0.35},${cy + r * 0.5}`}
                    fill={sym.colour ?? '#202020'}
                  />
                  <text
                    x={cx}
                    y={cy - r - 200}
                    textAnchor="middle"
                    fill={sym.colour ?? '#202020'}
                    style={{ fontSize: `${r * 0.7}px`, fontWeight: 700 }}
                  >
                    N
                  </text>
                </g>
              );
            })}

          {paintRows.map((row) => {
            const {
              xMm,
              yMm,
              widthMm,
              heightMm,
              viewRef,
              label,
              detailNumber,
              scale,
              viewportLocked,
              viewportRole,
              index,
            } = row;
            const resolved = resolveViewportTitleFromRef(elementsById, viewRef);
            const detailReason = detailCalloutUnresolvedReason(elementsById, viewRef);
            const isDetailCallout = viewportRole === 'detail_callout';
            const primary = isDetailCallout
              ? buildPlaceholderDetailTitle(detailNumber, resolved, detailReason)
              : (resolved ?? label);
            const sub = viewRef.trim() ? viewRef : '';
            const parsedRef = parseSheetViewRef(viewRef);
            const secId =
              modelId && parsedRef?.kind === 'section' && parsedRef.refId ? parsedRef.refId : '';

            const secInnerW = Math.max(200, widthMm - 320);
            const secInnerH = Math.max(200, heightMm - 2700);

            const isScheduleVp = parsedRef?.kind === 'schedule' && Boolean(parsedRef.refId);
            const scheduleEl = isScheduleVp ? elementsById[parsedRef!.refId] : undefined;
            const scheduleResolved = scheduleEl?.kind === 'schedule';
            const scheduleCatRaw =
              scheduleResolved && scheduleEl.filters && typeof scheduleEl.filters === 'object'
                ? (scheduleEl.filters as Record<string, unknown>).category
                : undefined;
            const scheduleCat =
              typeof scheduleCatRaw === 'string' && scheduleCatRaw.trim()
                ? scheduleCatRaw.trim()
                : '';
            const scheduleCaption = isScheduleVp
              ? scheduleResolved
                ? `schedule · ${parsedRef!.refId}${scheduleCat ? ` · ${scheduleCat}` : ''}`
                : `unresolved schedule · ${parsedRef!.refId}`
              : '';

            const planLegendHint = planLegendHints[row.key];
            const planLegendCaption =
              parsedRef?.kind === 'plan' && planLegendHint && planLegendHint.rowCount > 0
                ? `legend · ${planLegendHint.rowCount} rows · ${planLegendHint.digestPrefix}…`
                : '';

            const handle = 560;
            const hx = xMm + widthMm - handle;
            const hy = yMm + heightMm - handle;
            const detailTrim = detailNumber.trim();
            const scaleTrim = scale.trim();
            const canDragResize = authoring && !viewportLocked;
            const vpStroke = isDetailCallout ? '#7c3aed' : '#475569';
            const vpDash = isDetailCallout || isScheduleVp ? '480 240' : undefined;

            // Plan thumbnail
            const isPlanVp = parsedRef?.kind === 'plan' && Boolean(parsedRef.refId);
            const footerBandMm = 1200;
            const planThumbW = Math.max(200, widthMm);
            const planThumbH = Math.max(200, heightMm - footerBandMm);
            const planThumbnailContent =
              isPlanVp && parsedRef?.refId
                ? renderPlanThumbnail(elementsById, parsedRef.refId, planThumbW, planThumbH)
                : null;

            // When a plan thumbnail is shown, labels shift to the bottom footer band.
            // The footer band starts at yMm + heightMm - footerBandMm.
            const footerY0Vp = yMm + heightMm - footerBandMm;
            const labelY = planThumbnailContent ? footerY0Vp + 480 : yMm + 900;
            const subY = planThumbnailContent ? footerY0Vp + 820 : yMm + 1400;
            const scaleY = planThumbnailContent ? footerY0Vp + 1060 : yMm + 1800;
            const detailY = planThumbnailContent ? footerY0Vp + 480 : yMm + 820;
            const scheduleY = planThumbnailContent ? footerY0Vp + 1300 : yMm + 2200;
            const legendY = planThumbnailContent ? footerY0Vp + 1600 : yMm + 2600;

            return (
              <g key={row.key}>
                <rect
                  data-testid={`sheet-viewport-${index}`}
                  x={xMm}
                  y={yMm}
                  width={widthMm}
                  height={heightMm}
                  fill="#ffffff"
                  stroke={vpStroke}
                  strokeWidth={80}
                  strokeDasharray={vpDash}
                  className={canDragResize ? 'cursor-move touch-none' : undefined}
                  onPointerDown={canDragResize ? (e) => beginDrag(e, index) : undefined}
                />
                {canDragResize ? (
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
                      lensMode={lensMode}
                      widthPx={secInnerW}
                      heightPx={secInnerH}
                    />
                  </svg>
                ) : null}
                {planThumbnailContent ? (
                  <svg
                    x={xMm}
                    y={yMm}
                    width={planThumbW}
                    height={planThumbH}
                    viewBox={`0 0 ${planThumbW} ${planThumbH}`}
                    overflow="hidden"
                  >
                    {planThumbnailContent}
                  </svg>
                ) : null}
                {isDetailCallout ? (
                  <text x={xMm + 200} y={yMm + 520} fill="#7c3aed" style={{ fontSize: '320px' }}>
                    detail callout
                  </text>
                ) : null}
                <text x={xMm + 200} y={labelY} fill="#475569" style={{ fontSize: '600px' }}>
                  {primary}
                </text>
                {detailTrim ? (
                  <text
                    data-testid={`sheet-viewport-detail-${index}`}
                    x={xMm + widthMm - 200}
                    y={detailY}
                    fill="#475569"
                    style={{ fontSize: '480px' }}
                    textAnchor="end"
                  >
                    {detailTrim}
                  </text>
                ) : null}
                {sub ? (
                  <text x={xMm + 200} y={subY} fill="#64748b" style={{ fontSize: '350px' }}>
                    {sub}
                  </text>
                ) : null}
                {scaleTrim ? (
                  <text
                    data-testid={`sheet-viewport-scale-${index}`}
                    x={xMm + 200}
                    y={scaleY}
                    fill="#64748b"
                    style={{ fontSize: '340px' }}
                  >
                    scale {scaleTrim}
                  </text>
                ) : null}
                {authoring && viewportLocked ? (
                  <text
                    x={xMm + widthMm - 200}
                    y={yMm + heightMm - 320}
                    fill="#94a3b8"
                    style={{ fontSize: '280px' }}
                    textAnchor="end"
                  >
                    locked
                  </text>
                ) : null}
                {scheduleCaption ? (
                  <text
                    data-testid={`sheet-viewport-schedule-caption-${index}`}
                    x={xMm + 200}
                    y={scheduleY}
                    fill={scheduleResolved ? '#15803d' : '#b45309'}
                    style={{ fontSize: '320px' }}
                  >
                    {scheduleCaption}
                  </text>
                ) : null}
                {planLegendCaption ? (
                  <text
                    data-testid={`sheet-viewport-plan-legend-caption-${index}`}
                    x={xMm + 200}
                    y={legendY}
                    fill="#0e7490"
                    style={{ fontSize: '300px' }}
                  >
                    {planLegendCaption}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <details
        data-testid="sheet-documentation-details"
        className="mt-2 rounded border border-border bg-surface"
      >
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-foreground">
          Documentation details
        </summary>
        <div className="border-t border-border px-2 py-2">
          <SheetDocumentationManifest
            sheet={sh}
            modelId={modelId}
            elementsById={elementsById}
            authoring={authoring}
            tbDraft={tbDraft}
            vpDrafts={vpDrafts}
          />
        </div>
      </details>

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
  lensMode?: LensMode;
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
      lensMode={props.lensMode}
      elementsById={props.elementsById}
      onUpsertSemantic={props.onUpsertSemantic}
    />
  );
}
