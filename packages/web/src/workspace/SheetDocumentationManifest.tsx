import type { Element } from '@bim-ai/core';
import { useEffect, useMemo, useState } from 'react';

import type { SheetTitleblockDraft } from './sheetTitleblockAuthoring';
import { mergedTitleblockParametersForUpsert } from './sheetTitleblockAuthoring';
import {
  indexViewportEvidenceHints,
  sheetExportHrefTriple,
  viewportCropExtentsMm,
} from './sheetDocumentationManifestHelpers';
import type { SheetViewportMmDraft } from './sheetViewportAuthoring';
import { normalizeViewportRaw, readViewportMmBox } from './sheetViewportAuthoring';
import { parseSheetViewRef, resolveViewportTitleFromRef } from './sheetViewRef';

type SheetEl = Extract<Element, { kind: 'sheet' }>;

type EvidenceFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: Record<string, unknown> };

function sortedStringMapEntries(rec: Record<string, string>): [string, string][] {
  return Object.keys(rec)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, rec[k] ?? ''] as [string, string]);
}

export function SheetDocumentationManifest(props: {
  sheet: SheetEl;
  modelId?: string;
  elementsById: Record<string, Element>;
  authoring: boolean;
  tbDraft: SheetTitleblockDraft;
  vpDrafts: SheetViewportMmDraft[];
}) {
  const { sheet, modelId, elementsById, authoring, tbDraft, vpDrafts } = props;

  const paperW =
    typeof sheet.paperWidthMm === 'number' && Number.isFinite(sheet.paperWidthMm)
      ? sheet.paperWidthMm
      : 42_000;
  const paperH =
    typeof sheet.paperHeightMm === 'number' && Number.isFinite(sheet.paperHeightMm)
      ? sheet.paperHeightMm
      : 29_700;
  const orientation = paperW >= paperH ? 'landscape' : 'portrait';

  const priorTp = (sheet.titleblockParameters ?? {}) as Record<string, string>;
  const titleblockParametersDisplay = useMemo(
    () => (authoring ? mergedTitleblockParametersForUpsert(priorTp, tbDraft) : { ...priorTp }),
    [authoring, priorTp, tbDraft],
  );

  const effectiveTitleblockSymbol = authoring
    ? tbDraft.titleBlock.trim() || String(sheet.titleBlock ?? '').trim()
    : String(sheet.titleBlock ?? '').trim();

  const viewportRows = useMemo(() => {
    const vps = (sheet.viewportsMm ?? []) as Array<Record<string, unknown>>;
    if (authoring) {
      return vpDrafts.map((d) => ({
        viewportId: d.viewportId,
        viewRef: d.viewRef,
        xMm: d.xMm,
        yMm: d.yMm,
        widthMm: d.widthMm,
        heightMm: d.heightMm,
        cropMinMm: d.cropMinMm,
        cropMaxMm: d.cropMaxMm,
      }));
    }
    return vps.map((vp, i) => {
      const n = normalizeViewportRaw(vp, i);
      const box = readViewportMmBox(vp);
      return {
        viewportId: n.viewportId,
        viewRef: n.viewRef,
        xMm: box.xMm,
        yMm: box.yMm,
        widthMm: box.widthMm,
        heightMm: box.heightMm,
        cropMinMm: n.cropMinMm,
        cropMaxMm: n.cropMaxMm,
      };
    });
  }, [authoring, sheet.viewportsMm, vpDrafts]);

  /** Stable manifest table order (sheet JSON order may vary); authoring preserves draft order for UX. */
  const manifestViewportRows = useMemo(() => {
    if (authoring) return viewportRows;
    return [...viewportRows].sort((a, b) => {
      const byId = a.viewportId.localeCompare(b.viewportId);
      if (byId !== 0) return byId;
      const pa = parseSheetViewRef(a.viewRef);
      const pb = parseSheetViewRef(b.viewRef);
      const na = ((pa?.normalizedRef ?? a.viewRef) || '').trim();
      const nb = ((pb?.normalizedRef ?? b.viewRef) || '').trim();
      return na.localeCompare(nb);
    });
  }, [authoring, viewportRows]);

  const [evidence, setEvidence] = useState<EvidenceFetchState>({ status: 'idle' });

  useEffect(() => {
    if (!modelId) {
      setEvidence({ status: 'idle' });
      return;
    }
    const ac = new AbortController();
    setEvidence({ status: 'loading' });
    void (async () => {
      try {
        const res = await fetch(`/api/models/${encodeURIComponent(modelId)}/evidence-package`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setEvidence({ status: 'error', message: `HTTP ${res.status}` });
          return;
        }
        const payload = JSON.parse(await res.text()) as Record<string, unknown>;
        setEvidence({ status: 'ready', payload });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setEvidence({
          status: 'error',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => ac.abort();
  }, [modelId]);

  const deterministicRow = useMemo(() => {
    if (evidence.status !== 'ready') return null;
    const rows = evidence.payload.deterministicSheetEvidence;
    if (!Array.isArray(rows)) return null;
    return (rows as Record<string, unknown>[]).find((r) => String(r.sheetId ?? '') === sheet.id);
  }, [evidence, sheet.id]);

  const hintsByViewportId = useMemo(
    () => indexViewportEvidenceHints(deterministicRow?.viewportEvidenceHints_v0),
    [deterministicRow],
  );

  const exportHrefs = useMemo(() => {
    if (!modelId) return null;
    return deterministicRow
      ? {
          svgHref: String(deterministicRow.svgHref ?? ''),
          pdfHref: String(deterministicRow.pdfHref ?? ''),
          printRasterPngHref: String(deterministicRow.printRasterPngHref ?? ''),
        }
      : sheetExportHrefTriple(modelId, sheet.id);
  }, [deterministicRow, modelId, sheet.id]);

  const ingestContract = useMemo(() => {
    const raw = deterministicRow?.sheetPrintRasterIngest_v1;
    if (!raw || typeof raw !== 'object') return '';
    const contract = (raw as Record<string, unknown>).contract;
    return typeof contract === 'string' ? contract : '';
  }, [deterministicRow]);

  const contractV3Label = useMemo(() => {
    const raw = deterministicRow?.sheetPrintRasterPrintContract_v3;
    if (!raw || typeof raw !== 'object') return '';
    const fmt = (raw as Record<string, unknown>).format;
    return typeof fmt === 'string' ? fmt : 'sheetPrintRasterPrintContract_v3';
  }, [deterministicRow]);

  const playwrightNames = useMemo(() => {
    const raw = deterministicRow?.playwrightSuggestedFilenames;
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  }, [deterministicRow]);

  const advisorNotes = useMemo(() => {
    const notes: string[] = [];
    if (viewportRows.length > 0 && !effectiveTitleblockSymbol) {
      notes.push(
        'Title block symbol is blank while viewports exist (aligns with sheet_missing_titleblock checks).',
      );
    }
    for (const row of viewportRows) {
      const parsed = parseSheetViewRef(row.viewRef);
      if (!row.viewRef.trim()) {
        notes.push(`Viewport ${row.viewportId}: view ref is empty.`);
        continue;
      }
      if (!parsed || parsed.kind === 'unknown') {
        notes.push(
          `Viewport ${row.viewportId}: view ref is not a recognized plan:/section:/schedule:/viewpoint: prefix.`,
        );
        continue;
      }
      if (
        parsed.kind === 'schedule' &&
        parsed.refId &&
        resolveViewportTitleFromRef(elementsById, row.viewRef) === undefined
      ) {
        notes.push(
          `Viewport ${row.viewportId}: schedule ref does not resolve to a schedule element (schedule:${parsed.refId}).`,
        );
      }
      const cropEx = viewportCropExtentsMm(row.cropMinMm, row.cropMaxMm);
      if (cropEx && (cropEx.widthMm <= 0 || cropEx.heightMm <= 0)) {
        notes.push(`Viewport ${row.viewportId}: crop extents are zero or degenerate in mm space.`);
      }
    }
    if (!modelId) {
      notes.push(
        'No model id — export/listing correlation URLs and viewportEvidenceHints_v0 are unavailable in this surface.',
      );
    } else if (evidence.status === 'error') {
      notes.push(
        `Evidence-package fetch failed (${evidence.message}); export correlation rows may be stale or absent.`,
      );
    } else if (evidence.status === 'ready' && !deterministicRow) {
      notes.push('Evidence-package has no deterministicSheetEvidence row for this sheet id.');
    }
    return notes;
  }, [
    deterministicRow,
    effectiveTitleblockSymbol,
    evidence.status === 'error' ? evidence.message : undefined,
    evidence.status,
    modelId,
    viewportRows,
    elementsById,
  ]);

  const tbEntries = sortedStringMapEntries(
    Object.fromEntries(
      Object.entries(titleblockParametersDisplay).map(([k, v]) => [k, String(v ?? '')]),
    ),
  );

  return (
    <div
      data-testid="sheet-documentation-manifest"
      className="mt-2 rounded border border-border bg-surface/40 p-2 text-[11px]"
    >
      <div className="font-semibold text-foreground">Sheet documentation manifest</div>
      <p className="mt-1 text-[10px] text-muted">
        Deterministic readout for titleblock parameters, viewport composition, crop metadata, and
        export/evidence correlation (WP-E05 / WP-E06 / WP-V01 / WP-X01).
      </p>

      {advisorNotes.length > 0 ? (
        <ul
          data-testid="sheet-documentation-manifest-advisor"
          className="mt-2 list-disc space-y-0.5 border border-amber-600/40 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-950 dark:text-amber-100"
        >
          {advisorNotes.map((t, i) => (
            <li key={`sheet-manifest-advisor-${i}-${t.slice(0, 48)}`}>{t}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 space-y-1 border-t border-border pt-2">
        <div className="text-[10px] font-semibold uppercase text-muted">Titleblock</div>
        <dl className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-2 gap-y-0.5 font-mono text-[10px]">
          <dt className="text-muted">sheetId</dt>
          <dd>{sheet.id}</dd>
          <dt className="text-muted">name</dt>
          <dd>{sheet.name}</dd>
          <dt className="text-muted">titleBlock</dt>
          <dd>{effectiveTitleblockSymbol || '—'}</dd>
          <dt className="text-muted">paper</dt>
          <dd>
            {paperW}×{paperH} mm ({orientation})
          </dd>
        </dl>
        <div className="mt-2 text-[10px] text-muted">titleblockParameters (sorted keys)</div>
        <table className="mt-1 w-full border-collapse border border-border font-mono text-[10px]">
          <thead>
            <tr className="bg-muted/30">
              <th className="border border-border px-1 py-0.5 text-left">key</th>
              <th className="border border-border px-1 py-0.5 text-left">value</th>
            </tr>
          </thead>
          <tbody>
            {tbEntries.length === 0 ? (
              <tr>
                <td colSpan={2} className="border border-border px-1 py-0.5 text-muted">
                  (none)
                </td>
              </tr>
            ) : (
              tbEntries.map(([k, v]) => (
                <tr key={k}>
                  <td className="border border-border px-1 py-0.5">{k}</td>
                  <td className="border border-border px-1 py-0.5">{v}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1 border-t border-border pt-2">
        <div className="text-[10px] font-semibold uppercase text-muted">Viewports</div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] border-collapse border border-border font-mono text-[10px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="border border-border px-1 py-0.5 text-left">viewportId</th>
                <th className="border border-border px-1 py-0.5 text-left">viewRef (normalized)</th>
                <th className="border border-border px-1 py-0.5 text-left">kind</th>
                <th className="border border-border px-1 py-0.5 text-left">sheet box (mm)</th>
                <th className="border border-border px-1 py-0.5 text-left">crop extents (mm)</th>
                <th className="border border-border px-1 py-0.5 text-left">resolved title</th>
                <th className="border border-border px-1 py-0.5 text-left">
                  listing / projection evidence
                </th>
              </tr>
            </thead>
            <tbody>
              {manifestViewportRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-border px-1 py-0.5 text-muted">
                    (no viewports)
                  </td>
                </tr>
              ) : (
                manifestViewportRows.map((row) => {
                  const parsed = parseSheetViewRef(row.viewRef);
                  const cropEx = viewportCropExtentsMm(row.cropMinMm, row.cropMaxMm);
                  const cropLabel = cropEx ? `${cropEx.widthMm}×${cropEx.heightMm}` : 'omit';
                  const hint = hintsByViewportId.get(row.viewportId);
                  const hintParts: string[] = [];
                  if (hint?.crop !== undefined && String(hint.crop).trim()) {
                    hintParts.push(`crop_token=${String(hint.crop)}`);
                  }
                  if (
                    hint?.planProjectionSegment !== undefined &&
                    String(hint.planProjectionSegment).trim()
                  ) {
                    hintParts.push(String(hint.planProjectionSegment));
                  }
                  if (
                    hint?.sectionDocumentationSegment !== undefined &&
                    String(hint.sectionDocumentationSegment).trim()
                  ) {
                    hintParts.push(String(hint.sectionDocumentationSegment));
                  }
                  if (
                    hint?.scheduleDocumentationSegment !== undefined &&
                    String(hint.scheduleDocumentationSegment).trim()
                  ) {
                    hintParts.push(String(hint.scheduleDocumentationSegment));
                  }
                  const hintLine = hintParts.join(' · ') || '—';
                  return (
                    <tr key={row.viewportId}>
                      <td className="border border-border px-1 py-0.5">{row.viewportId}</td>
                      <td className="border border-border px-1 py-0.5">
                        {(parsed?.normalizedRef ?? '').trim() || row.viewRef.trim() || '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        {parsed?.kind ?? 'unknown'}
                      </td>
                      <td className="border border-border px-1 py-0.5 whitespace-nowrap">
                        [{row.xMm},{row.yMm}] {row.widthMm}×{row.heightMm}
                      </td>
                      <td className="border border-border px-1 py-0.5">{cropLabel}</td>
                      <td className="border border-border px-1 py-0.5">
                        {resolveViewportTitleFromRef(elementsById, row.viewRef) ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5 align-top break-all">
                        {hintLine}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 space-y-1 border-t border-border pt-2">
        <div className="text-[10px] font-semibold uppercase text-muted">
          Export / listing correlation
        </div>
        {!modelId ? (
          <p className="text-[10px] text-muted">
            Provide modelId to load evidence-package correlation.
          </p>
        ) : evidence.status === 'loading' ? (
          <p className="text-[10px] text-muted">Loading evidence-package…</p>
        ) : exportHrefs ? (
          <ul className="space-y-1 font-mono text-[10px]">
            <li>
              <span className="text-muted">SVG preview:</span>{' '}
              <a className="text-primary underline" href={exportHrefs.svgHref}>
                {exportHrefs.svgHref}
              </a>
            </li>
            <li>
              <span className="text-muted">PDF preview:</span>{' '}
              <a className="text-primary underline" href={exportHrefs.pdfHref}>
                {exportHrefs.pdfHref}
              </a>
            </li>
            <li>
              <span className="text-muted">Print surrogate PNG:</span>{' '}
              <a className="text-primary underline" href={exportHrefs.printRasterPngHref}>
                {exportHrefs.printRasterPngHref}
              </a>
            </li>
          </ul>
        ) : null}
        {ingestContract ? (
          <div className="font-mono text-[10px]">
            <span className="text-muted">sheetPrintRasterIngest_v1.contract:</span> {ingestContract}
          </div>
        ) : null}
        {contractV3Label ? (
          <div className="font-mono text-[10px]">
            <span className="text-muted">sheetPrintRasterPrintContract_v3:</span> {contractV3Label}
          </div>
        ) : null}
        {playwrightNames && Object.keys(playwrightNames).length > 0 ? (
          <div className="mt-1">
            <div className="text-[10px] text-muted">playwrightSuggestedFilenames</div>
            <pre className="mt-0.5 max-h-28 overflow-auto rounded border border-border bg-background p-1 font-mono text-[9px]">
              {JSON.stringify(playwrightNames)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
