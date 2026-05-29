import { type JSX } from 'react';
import type { Element, LensMode } from '@bim-ai/core';

import { SheetReviewSurface } from '../plan/SheetReviewSurface';
import { SheetCanvas } from './sheets';
import type { SheetMarkupShape, SheetReviewMode } from './sheets/sheetReviewUi';
import { lensUx } from './lensUx';
import { asArr } from './modeShellsShared';

/**
 * Sheet mode shell — spec §20.5.
 *
 * Extracted from `ModeShells.tsx` in FE-CQ-02 so the heavy sheet-review code
 * (review surface, comments panel, markup canvas) can be lazy-loaded from
 * `CanvasMount` instead of shipping in the eager workspace chunk.
 */

export function SheetModeShell({
  elementsById,
  preferredSheetId,
  modelId,
  onUpsertSemantic,
  reviewMode,
  markupShape,
  lensMode = 'all',
}: {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  reviewMode?: SheetReviewMode;
  markupShape?: SheetMarkupShape;
  lensMode?: LensMode;
}): JSX.Element {
  const evidenceFullBleed = new URLSearchParams(window.location.search).has('evidenceSheetFull');

  // Resolve the displayed sheet — mirrors SheetCanvas's own selection logic.
  const sheets = asArr(elementsById, 'sheet');
  const resolvedSheet =
    sheets.find((s) => s.id === preferredSheetId) ??
    [...sheets].sort((a, b) => a.name.localeCompare(b.name))[0];

  // MRK-V3-03: when a modelId is available and a sheet is selected, mount the
  // review surface which adds comment pins and review-mode toolbar on top of
  // the sheet canvas.
  if (modelId && resolvedSheet) {
    return (
      <div data-testid="sheet-mode-shell" className="relative h-full w-full overflow-hidden">
        {lensMode !== 'all' ? <SheetLensGuidance lensMode={lensMode} /> : null}
        <SheetReviewSurface
          sheetId={resolvedSheet.id}
          modelId={modelId}
          elementsById={elementsById}
          onUpsertSemantic={onUpsertSemantic}
          reviewMode={reviewMode}
          markupShape={markupShape}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="sheet-mode-shell"
      className="relative h-full w-full overflow-auto bg-[#e5e5e5] p-6"
    >
      {lensMode !== 'all' ? <SheetLensGuidance lensMode={lensMode} /> : null}
      <SheetCanvas
        elementsById={elementsById}
        preferredSheetId={preferredSheetId}
        modelId={modelId}
        lensMode={lensMode}
        evidenceFullBleed={evidenceFullBleed}
        onUpsertSemantic={onUpsertSemantic}
      />
    </div>
  );
}

function SheetLensGuidance({ lensMode }: { lensMode: LensMode }): JSX.Element {
  const ux = lensUx(lensMode);
  return (
    <div
      data-testid="sheet-lens-guidance"
      className="pointer-events-none absolute right-3 top-3 z-10 max-w-xs rounded border border-border bg-surface/95 px-3 py-2 text-[11px] shadow-elev-1"
    >
      <div className="font-semibold text-foreground">{ux.label} sheet context</div>
      <div className="mt-1 leading-snug text-muted">
        Sheets collect deliverables; selected viewports should carry the lens. Relevant:{' '}
        {ux.sheetDeliverables.slice(0, 3).join(', ')}.
      </div>
    </div>
  );
}
