import { type JSX } from 'react';
import type { LensMode } from '@bim-ai/core';

import { SectionPlaceholderPane } from './sheets';
import { lensUx } from './lensUx';

/**
 * Mode-specific shells — spec §20.4 / §20.5 / §20.6 / §20.7.
 *
 * Historically all three shells (Section / Sheet / Schedule) lived in this
 * file. FE-CQ-02 split the Sheet and Schedule shells into their own modules
 * so `CanvasMount` can lazy-load them — they pull in the sheet review
 * surface, comments panel, markup canvas, and schedule registry/presets,
 * which add ~100KB+ to the eager workspace chunk even though they render
 * null until the user opens those modes.
 *
 * Tests still import the three shell names from this module via the
 * re-exports below.
 */

export { SheetModeShell } from './SheetModeShell';
export { ScheduleModeShell } from './ScheduleModeShell';

/* ────────────────────────────────────────────────────────────────────── */
/* Section / Elevation mode (§20.4)                                        */
/* ────────────────────────────────────────────────────────────────────── */

export function SectionModeShell({
  activeLevelLabel = '',
  activeSectionId,
  modelId,
  onUpsertSemantic,
  onOpenSourcePlan,
  onOpen3dContext,
  lensMode = 'all',
}: {
  activeLevelLabel?: string;
  activeSectionId?: string;
  modelId?: string;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  onOpenSourcePlan?: () => void;
  onOpen3dContext?: () => void;
  lensMode?: LensMode;
}): JSX.Element {
  return (
    <div data-testid="section-mode-shell" className="relative h-full w-full overflow-auto">
      {lensMode !== 'all' ? <SectionLensGuidance lensMode={lensMode} /> : null}
      <SectionPlaceholderPane
        activeLevelLabel={activeLevelLabel}
        activeSectionId={activeSectionId}
        modelId={modelId}
        onUpsertSemantic={onUpsertSemantic}
        onOpenSourcePlan={onOpenSourcePlan}
        onOpen3dContext={onOpen3dContext}
        lensMode={lensMode}
      />
    </div>
  );
}

function SectionLensGuidance({ lensMode }: { lensMode: LensMode }): JSX.Element {
  const ux = lensUx(lensMode);
  const focus = ux.inspectorFocus.slice(0, 3).join(' · ');
  return (
    <div
      data-testid="section-lens-guidance"
      className="pointer-events-none absolute right-4 top-4 z-10 max-w-[320px] rounded border border-border bg-background/95 px-3 py-2 text-[11px] shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-foreground">{ux.label}</div>
          <div className="text-muted">{ux.germanName}</div>
        </div>
        <span className="rounded bg-surface-strong px-1.5 py-0.5 text-[10px] uppercase text-muted">
          section
        </span>
      </div>
      <p className="mt-1 leading-snug text-muted">{ux.visualBehavior.section ?? ux.shortPurpose}</p>
      <div className="mt-1 truncate text-muted">{focus}</div>
    </div>
  );
}
