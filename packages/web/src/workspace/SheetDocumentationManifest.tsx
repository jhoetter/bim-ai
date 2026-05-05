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
import { detailCalloutUnresolvedReason } from './sheetDetailCalloutReadout';
import {
  buildSheetTitleblockRevisionIssueManifestV1FromNorm,
  normalizeTitleblockRevisionIssueV1,
  sheetRevisionIssueMetadataPresent,
} from './sheetRevisionIssueManifestV1';
import { scheduleTableRendererV1SheetReadout } from '../schedules/scheduleTableRendererV1';
import { formatSchedulePaginationPlacementReadout } from '../schedules/schedulePanelRegistryChrome';
import { roomColorSchemeLegendPlacementReadoutLines } from './roomColorSchemeLegendPlacementReadout';

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

  const revisionIssueNorm = useMemo(
    () => normalizeTitleblockRevisionIssueV1(titleblockParametersDisplay),
    [titleblockParametersDisplay],
  );

  const effectiveTitleblockSymbol = authoring
    ? tbDraft.titleBlock.trim() || String(sheet.titleBlock ?? '').trim()
    : String(sheet.titleBlock ?? '').trim();

  const viewportRows = useMemo(() => {
    const vps = (sheet.viewportsMm ?? []) as Array<Record<string, unknown>>;
    if (authoring) {
      return vpDrafts.map((d) => ({
        viewportId: d.viewportId,
        label: d.label,
        viewRef: d.viewRef,
        detailNumber: d.detailNumber,
        scale: d.scale,
        viewportLocked: d.viewportLocked,
        viewportRole: d.viewportRole,
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
        label: n.label,
        viewRef: n.viewRef,
        detailNumber: n.detailNumber,
        scale: n.scale,
        viewportLocked: n.viewportLocked,
        viewportRole: n.viewportRole,
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

  const revisionIssueReadout = useMemo(() => {
    if (evidence.status === 'ready' && deterministicRow) {
      const raw = deterministicRow.sheetTitleblockRevisionIssueManifest_v1;
      if (raw && typeof raw === 'object') {
        const o = raw as Record<string, unknown>;
        const pick = (k: string) => String(o[k] ?? '');
        return {
          provenance: 'evidence-package' as const,
          revisionId: pick('revisionId'),
          revisionCode: pick('revisionCode'),
          revisionDate: pick('revisionDate'),
          revisionDescription: pick('revisionDescription'),
          issueStatus: pick('issueStatus'),
          revisionDescriptionDigestPrefix8: pick('revisionDescriptionDigestPrefix8'),
          titleblockDisplaySegment: pick('titleblockDisplaySegment'),
          exportListingSegment: pick('exportListingSegment'),
        };
      }
    }
    const m = buildSheetTitleblockRevisionIssueManifestV1FromNorm(revisionIssueNorm);
    return {
      provenance: 'sheet' as const,
      revisionId: m.revisionId,
      revisionCode: m.revisionCode,
      revisionDate: m.revisionDate,
      revisionDescription: m.revisionDescription,
      issueStatus: m.issueStatus,
      revisionDescriptionDigestPrefix8: m.revisionDescriptionDigestPrefix8,
      titleblockDisplaySegment: m.titleblockDisplaySegment,
      exportListingSegment: m.exportListingSegment,
    };
  }, [deterministicRow, evidence.status, revisionIssueNorm]);

  const hintsByViewportId = useMemo(
    () => indexViewportEvidenceHints(deterministicRow?.viewportEvidenceHints_v0),
    [deterministicRow],
  );

  const planLegendHintsByViewportId = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    if (evidence.status !== 'ready' || !deterministicRow) return m;
    const raw = deterministicRow.planRoomProgrammeLegendHints_v0;
    if (!Array.isArray(raw)) return m;
    for (const h of raw) {
      if (!h || typeof h !== 'object') continue;
      const id = String((h as { viewportId?: unknown }).viewportId ?? '').trim();
      if (id) m.set(id, h as Record<string, unknown>);
    }
    return m;
  }, [deterministicRow, evidence.status]);

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

  const detailCalloutReadoutRows = useMemo(() => {
    if (evidence.status !== 'ready' || !deterministicRow) return [];
    const raw = deterministicRow.detailCalloutReadout_v0;
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
  }, [deterministicRow, evidence.status]);

  const advisorNotes = useMemo(() => {
    const notes: string[] = [];
    if (viewportRows.length > 0 && !effectiveTitleblockSymbol) {
      notes.push(
        'Title block symbol is blank while viewports exist (aligns with sheet_missing_titleblock checks).',
      );
    }
    if (
      viewportRows.length > 0 &&
      effectiveTitleblockSymbol &&
      !sheetRevisionIssueMetadataPresent(revisionIssueNorm)
    ) {
      notes.push(
        'Revision/issue metadata is missing revision id and revision code in titleblock parameters (aligns with sheet_revision_issue_metadata_missing checks).',
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
      if (row.viewportRole === 'detail_callout') {
        const dcReason = detailCalloutUnresolvedReason(elementsById, row.viewRef);
        if (dcReason) {
          notes.push(
            `Viewport ${row.viewportId}: detail callout target is unresolved (${dcReason}).`,
          );
        }
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
    revisionIssueNorm,
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

      <div
        className="mt-3 space-y-1 border-t border-border pt-2"
        data-testid="sheet-manifest-revision-issue-readout"
      >
        <div className="text-[10px] font-semibold uppercase text-muted">
          Revision / issue manifest (v1)
        </div>
        <div className="text-[9px] text-muted">provenance: {revisionIssueReadout.provenance}</div>
        <dl className="grid grid-cols-[minmax(0,180px)_1fr] gap-x-2 gap-y-0.5 font-mono text-[10px]">
          <dt className="text-muted">revisionId</dt>
          <dd>{revisionIssueReadout.revisionId || '—'}</dd>
          <dt className="text-muted">revisionCode</dt>
          <dd>{revisionIssueReadout.revisionCode || '—'}</dd>
          <dt className="text-muted">revisionDate</dt>
          <dd>{revisionIssueReadout.revisionDate || '—'}</dd>
          <dt className="text-muted">issueStatus</dt>
          <dd>{revisionIssueReadout.issueStatus || '—'}</dd>
          <dt className="text-muted">revisionDescriptionDigestPrefix8</dt>
          <dd>{revisionIssueReadout.revisionDescriptionDigestPrefix8 || '—'}</dd>
          <dt className="text-muted">titleblockDisplaySegment</dt>
          <dd className="break-all">{revisionIssueReadout.titleblockDisplaySegment || '—'}</dd>
          <dt className="text-muted">exportListingSegment</dt>
          <dd className="break-all">{revisionIssueReadout.exportListingSegment || '—'}</dd>
          <dt className="text-muted">revisionDescription</dt>
          <dd className="break-all">{revisionIssueReadout.revisionDescription || '—'}</dd>
        </dl>
      </div>

      <div className="mt-3 space-y-1 border-t border-border pt-2">
        <div className="text-[10px] font-semibold uppercase text-muted">Viewports</div>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] border-collapse border border-border font-mono text-[10px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="border border-border px-1 py-0.5 text-left">viewportId</th>
                <th className="border border-border px-1 py-0.5 text-left">role</th>
                <th className="border border-border px-1 py-0.5 text-left">label</th>
                <th className="border border-border px-1 py-0.5 text-left">viewRef (normalized)</th>
                <th className="border border-border px-1 py-0.5 text-left">kind</th>
                <th className="border border-border px-1 py-0.5 text-left">detail #</th>
                <th className="border border-border px-1 py-0.5 text-left">scale</th>
                <th className="border border-border px-1 py-0.5 text-left">locked</th>
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
                  <td colSpan={12} className="border border-border px-1 py-0.5 text-muted">
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
                    const schSeg = String(hint.scheduleDocumentationSegment).trim();
                    hintParts.push(schSeg);
                    const tblSeg = scheduleTableRendererV1SheetReadout(schSeg, elementsById);
                    if (tblSeg) hintParts.push(tblSeg);
                    const pagLine = formatSchedulePaginationPlacementReadout(
                      hint?.schedulePaginationPlacementEvidence_v0,
                    );
                    if (pagLine) hintParts.push(pagLine);
                  }
                  if (
                    hint?.roomProgrammeLegendDocumentationSegment !== undefined &&
                    String(hint.roomProgrammeLegendDocumentationSegment).trim()
                  ) {
                    hintParts.push(String(hint.roomProgrammeLegendDocumentationSegment).trim());
                  }
                  if (
                    hint?.detailCalloutDocumentationSegment !== undefined &&
                    String(hint.detailCalloutDocumentationSegment).trim()
                  ) {
                    hintParts.push(String(hint.detailCalloutDocumentationSegment).trim());
                  }
                  const hintLine = hintParts.join(' · ') || '—';
                  const planLeg = planLegendHintsByViewportId.get(row.viewportId);
                  const legRowsRaw = planLeg?.legendRows;
                  const legendRows =
                    Array.isArray(legRowsRaw) && legRowsRaw.length > 0
                      ? (legRowsRaw as Array<Record<string, unknown>>).filter(
                          (r) => r && typeof r === 'object',
                        )
                      : [];
                  const legendTitleRaw = planLeg?.legendTitle;
                  const legendTitle =
                    typeof legendTitleRaw === 'string' && legendTitleRaw.trim()
                      ? legendTitleRaw.trim()
                      : null;
                  return (
                    <tr key={row.viewportId}>
                      <td className="border border-border px-1 py-0.5">{row.viewportId}</td>
                      <td className="border border-border px-1 py-0.5">{row.viewportRole}</td>
                      <td className="border border-border px-1 py-0.5">{row.label}</td>
                      <td className="border border-border px-1 py-0.5">
                        {(parsed?.normalizedRef ?? '').trim() || row.viewRef.trim() || '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        {parsed?.kind ?? 'unknown'}
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        {row.detailNumber.trim() || '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        {row.scale.trim() || '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        {row.viewportLocked ? 'yes' : '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5 whitespace-nowrap">
                        [{row.xMm},{row.yMm}] {row.widthMm}×{row.heightMm}
                      </td>
                      <td className="border border-border px-1 py-0.5">{cropLabel}</td>
                      <td className="border border-border px-1 py-0.5">
                        {resolveViewportTitleFromRef(elementsById, row.viewRef) ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-0.5 align-top break-all">
                        <div className="space-y-1">
                          <div data-testid={`sheet-manifest-viewport-evidence-${row.viewportId}`}>
                            {hintLine}
                          </div>
                          {legendTitle && legendRows.length > 0 ? (
                            <div
                              data-testid={`sheet-manifest-room-legend-readout-${row.viewportId}`}
                              className="rounded border border-border/60 bg-muted/20 px-1 py-0.5"
                            >
                              <div className="font-semibold text-foreground">{legendTitle}</div>
                              <ul className="mt-0.5 list-none space-y-0.5 pl-0">
                                {legendRows.map((lr, li) => {
                                  const lab = String(lr.label ?? '').trim() || '—';
                                  const hx = String(lr.schemeColorHex ?? lr.scheme_color_hex ?? '').trim() || '#888888';
                                  const pc = String(lr.programmeCode ?? lr.programme_code ?? '').trim();
                                  const dept = String(lr.department ?? '').trim();
                                  const fn = String(lr.functionLabel ?? lr.function_label ?? '').trim();
                                  const keyBits = [pc, dept, fn].filter(Boolean);
                                  return (
                                    <li
                                      key={`${row.viewportId}-leg-${li}-${lab}-${hx}`}
                                      className="flex items-start gap-1"
                                    >
                                      <span
                                        className="mt-0.5 inline-block size-2.5 shrink-0 rounded-sm border border-border"
                                        style={{ backgroundColor: hx }}
                                        title={lab}
                                      />
                                      <span className="min-w-0">
                                        <span className="text-foreground">{lab}</span>
                                        <span className="block font-mono text-[9px] text-muted">
                                          {hx}
                                          {keyBits.length ? ` · ${keyBits.join(' · ')}` : ''}
                                        </span>
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {evidence.status === 'ready' && deterministicRow ? (
        <div className="mt-3 space-y-1 border-t border-border pt-2">
          <div className="text-[10px] font-semibold uppercase text-muted">
            Detail callouts (readout v0)
          </div>
          <div
            className="overflow-x-auto"
            data-testid="sheet-manifest-detail-callout-readout"
          >
            <table className="min-w-[1100px] border-collapse border border-border font-mono text-[10px]">
              <thead>
                <tr className="bg-muted/30">
                  <th className="border border-border px-1 py-0.5 text-left">viewportId</th>
                  <th className="border border-border px-1 py-0.5 text-left">viewportRole</th>
                  <th className="border border-border px-1 py-0.5 text-left">parentSheetId</th>
                  <th className="border border-border px-1 py-0.5 text-left">parentSheetName</th>
                  <th className="border border-border px-1 py-0.5 text-left">referencedViewRefRaw</th>
                  <th className="border border-border px-1 py-0.5 text-left">
                    referencedViewRefNormalized
                  </th>
                  <th className="border border-border px-1 py-0.5 text-left">referencedTargetKind</th>
                  <th className="border border-border px-1 py-0.5 text-left">referencedTargetId</th>
                  <th className="border border-border px-1 py-0.5 text-left">resolvedTargetTitle</th>
                  <th className="border border-border px-1 py-0.5 text-left">
                    placeholderDetailNumber
                  </th>
                  <th className="border border-border px-1 py-0.5 text-left">
                    placeholderDetailTitle
                  </th>
                  <th className="border border-border px-1 py-0.5 text-left">unresolvedReason</th>
                </tr>
              </thead>
              <tbody>
                {detailCalloutReadoutRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="border border-border px-1 py-0.5 text-muted">
                      (no detail callout viewports)
                    </td>
                  </tr>
                ) : (
                  detailCalloutReadoutRows.map((r, i) => (
                    <tr key={`dc-readout-${String(r.viewportId ?? i)}`}>
                      <td className="border border-border px-1 py-0.5">{String(r.viewportId ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.viewportRole ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.parentSheetId ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.parentSheetName ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.referencedViewRefRaw ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">
                        {String(r.referencedViewRefNormalized ?? '')}
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        {String(r.referencedTargetKind ?? '')}
                      </td>
                      <td className="border border-border px-1 py-0.5">{String(r.referencedTargetId ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.resolvedTargetTitle ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.placeholderDetailNumber ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.placeholderDetailTitle ?? '')}</td>
                      <td className="border border-border px-1 py-0.5">{String(r.unresolvedReason ?? '')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {evidence.status === 'ready' && deterministicRow ? (() => {
        const placementEv = deterministicRow.roomColorSchemeLegendPlacementEvidence_v1;
        const placementLines = roomColorSchemeLegendPlacementReadoutLines(placementEv);
        return placementLines.length > 0 ? (
          <div
            className="mt-3 space-y-1 border-t border-border pt-2"
            data-testid="sheet-manifest-room-color-scheme-legend-placement-readout"
          >
            <div className="text-[10px] font-semibold uppercase text-muted">
              Room color scheme legend placement (v1)
            </div>
            <ul className="space-y-0.5 font-mono text-[10px]">
              {placementLines.map((l, i) => (
                <li key={`legend-placement-${i}`} className="text-foreground whitespace-pre">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })() : null}

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
