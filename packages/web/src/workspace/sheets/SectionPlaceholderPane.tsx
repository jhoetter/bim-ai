import { useEffect, useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';

import { Btn, Panel } from '@bim-ai/ui';

import { fetchSectionProjectionWire } from '../../plan/sectionProjectionWire';
import { useBimStore } from '../../state/store';

import { SectionViewportSvg } from './sectionViewportSvg';
import { formatSectionCutIdentityLine, formatSectionCutPlaneContext } from './sectionViewportDoc';
import { formatSectionDatumElevationEvidenceLine } from '../readouts';
import { sheetsReferencingSectionCut } from './sheetViewRef';

const PREVIEW_WIDTH_PX = 320;
const PREVIEW_HEIGHT_PX = 220;

export const SECTION_WORKBENCH_NO_WALL_CAPTION =
  'No wall primitives for this cut in the current snapshot.';

function segmentLengthMm(a: { xMm: number; yMm: number }, b: { xMm: number; yMm: number }): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  return Math.round(Math.hypot(dx, dy));
}

function SectionDatumElevationEvidenceLine(props: { modelId: string; sectionCutId: string }) {
  const [line, setLine] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchSectionProjectionWire(props.modelId, props.sectionCutId);
        if (cancelled) return;
        setLine(formatSectionDatumElevationEvidenceLine(payload));
      } catch {
        if (!cancelled) setLine('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.modelId, props.sectionCutId]);

  if (!line) return null;
  return (
    <div
      className="mt-1 font-mono text-[10px] text-muted"
      data-testid="section-datum-elevation-evidence"
    >
      {line}
    </div>
  );
}

function SectionWorkbenchLivePreview(props: {
  modelId: string;
  sectionCutId: string;
  sectionIdentityCaption: string;
  sectionCutPlaneCaption: string;
  widthPx: number;
  heightPx: number;
}) {
  const [showNoWallCaption, setShowNoWallCaption] = useState(false);

  return (
    <div className="mt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Live preview
      </div>
      <div
        className="mt-1 h-[220px] max-w-[320px] overflow-hidden rounded border border-border bg-white"
        data-testid="section-workbench-preview-svg"
      >
        <SectionViewportSvg
          modelId={props.modelId}
          sectionCutId={props.sectionCutId}
          widthPx={props.widthPx}
          heightPx={props.heightPx}
          sectionIdentityCaption={props.sectionIdentityCaption}
          sectionCutPlaneCaption={props.sectionCutPlaneCaption}
          onWallPrimitivesKnown={(hasWalls) => setShowNoWallCaption(!hasWalls)}
        />
      </div>
      {showNoWallCaption ? (
        <p className="mt-1 text-[10px] text-muted" data-testid="section-workbench-no-wall-caption">
          {SECTION_WORKBENCH_NO_WALL_CAPTION}
        </p>
      ) : null}
    </div>
  );
}

/** Section workbench: live projection preview, sheet deep links, Project Browser–aligned selection. */
export function SectionPlaceholderPane(props: { activeLevelLabel: string; modelId?: string }) {
  const elementsById = useBimStore((s) => s.elementsById);
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);

  const cuts = useMemo(
    () =>
      Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [elementsById],
  );

  const previewSectionId = useMemo(() => {
    if (selectedId) {
      const sel = elementsById[selectedId];
      if (sel?.kind === 'section_cut') return selectedId;
    }
    return cuts[0]?.id;
  }, [selectedId, elementsById, cuts]);

  const sheetRows = useMemo(() => {
    if (!previewSectionId) return [];
    return sheetsReferencingSectionCut(elementsById, previewSectionId);
  }, [elementsById, previewSectionId]);

  const previewCut = useMemo(() => {
    if (!previewSectionId) return undefined;
    const e = elementsById[previewSectionId];
    return e?.kind === 'section_cut' ? e : undefined;
  }, [elementsById, previewSectionId]);

  const sectionPreviewCaptions = useMemo(() => {
    if (!previewCut) {
      return { identity: '', plane: '' };
    }
    return {
      identity: formatSectionCutIdentityLine({ name: previewCut.name, id: previewCut.id }),
      plane: formatSectionCutPlaneContext({
        lineStartMm: previewCut.lineStartMm,
        lineEndMm: previewCut.lineEndMm,
      }),
    };
  }, [previewCut]);

  return (
    <Panel title={`Sections (${props.activeLevelLabel})`}>
      <p className="text-[11px] leading-snug text-muted">
        Live preview uses the same section projection wire as sheet viewports (export{' '}
        <code className="text-[10px]">secDoc[…]</code> segments stay server-owned). This is not a
        per-layer cut solid, CSG, or replacement section engine—only documented primitives in the
        snapshot.
      </p>

      {cuts.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">
          No <code className="text-[10px]">section_cut</code> elements in this snapshot. Author cuts
          in the model, then use{' '}
          <span className="font-semibold text-foreground/80">Project browser → Section cuts</span>{' '}
          to inspect ids and sheet <code className="text-[10px]">section:</code> viewports.
        </p>
      ) : (
        <>
          {props.modelId && previewSectionId && previewCut ? (
            <>
              <SectionWorkbenchLivePreview
                key={previewSectionId}
                modelId={props.modelId}
                sectionCutId={previewSectionId}
                sectionIdentityCaption={sectionPreviewCaptions.identity}
                sectionCutPlaneCaption={sectionPreviewCaptions.plane}
                widthPx={PREVIEW_WIDTH_PX}
                heightPx={PREVIEW_HEIGHT_PX}
              />
              <SectionDatumElevationEvidenceLine
                modelId={props.modelId}
                sectionCutId={previewSectionId}
              />
            </>
          ) : (
            <p className="mt-2 text-[11px] leading-snug text-muted">
              No <span className="font-mono">modelId</span> in this cockpit state—live projection
              preview is unavailable. Use the list below and{' '}
              <span className="font-semibold text-foreground/80">
                Project browser → Section cuts
              </span>{' '}
              to select cuts; switch to a connected session with snapshot hydration for SVG preview.
            </p>
          )}

          {previewSectionId ? (
            <div className="mt-3 border-t border-border pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Sheets
              </div>
              {sheetRows.length ? (
                <ul className="mt-1 space-y-1 text-[11px]">
                  {sheetRows.map((row) => (
                    <li key={`${row.sheetId}:${row.rawViewRef}`}>
                      <button
                        type="button"
                        className="text-left text-[11px] text-muted underline decoration-muted/60 underline-offset-2 hover:text-foreground"
                        onClick={() => select(row.sheetId)}
                      >
                        Select sheet · {row.sheetName}
                      </button>
                      <div className="font-mono text-[9px] leading-tight text-muted">
                        {row.viewRefNormalized}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  No sheet viewports target this cut yet. Add{' '}
                  <code className="text-[10px]">section:{previewSectionId}</code> (or{' '}
                  <code className="text-[10px]">sec:</code>) on a sheet viewport, then use
                  Coordination layout for canvas + export evidence.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-3 border-t border-border pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Section cuts
            </div>
            <ul className="mt-1 max-h-40 space-y-1 overflow-auto text-[11px]">
              {cuts.map((sc) => {
                const crop = typeof sc.cropDepthMm === 'number' ? sc.cropDepthMm : undefined;
                const run = segmentLengthMm(sc.lineStartMm, sc.lineEndMm);
                const active = selectedId === sc.id;
                return (
                  <li key={sc.id}>
                    <Btn
                      type="button"
                      variant="quiet"
                      title="Same selection pattern as Project browser section rows"
                      className={`h-auto min-h-0 w-full gap-0.5 px-2 py-1 text-left text-[11px] ${
                        active ? 'bg-surface ring-1 ring-border' : ''
                      }`}
                      onClick={() => select(sc.id)}
                    >
                      <div className="font-medium">{sc.name}</div>
                      <div className="text-muted">
                        id <code className="text-[10px]">{sc.id}</code> · cut line ≈{' '}
                        {run.toLocaleString()} mm
                        {crop != null ? ` · crop depth ${crop.toLocaleString()} mm` : ''}
                      </div>
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </Panel>
  );
}
