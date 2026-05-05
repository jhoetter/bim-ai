/**
 * Plan canvas state — spec §14.
 *
 * Pure-state controllers that compose the redesigned plan canvas. Each
 * controller is testable without DOM/canvas; the visual layer in
 * `PlanCanvas.tsx` consumes them in WP-UI-B01 and beyond.
 *
 * This module currently exposes WP-UI-B01 (drafting paint state). Snap
 * engine + pointer classifier (WP-UI-B02) and PlanCamera (WP-UI-B03)
 * land in follow-up commits.
 */

import {
  CATEGORY_LINE_RULES,
  gridVisibilityFor,
  HATCH_SPECS,
  hatchVisibleAt,
  lineWidthPxFor,
  type HatchSpec,
} from './draftingStandards';

/* ────────────────────────────────────────────────────────────────────── */
/* B01 — Drafting paint state                                              */
/* ────────────────────────────────────────────────────────────────────── */

export interface DraftingPaint {
  paperToken: '--draft-paper';
  grid: { showMajor: boolean; showMinor: boolean };
  lineWidthPx: (token: keyof typeof CATEGORY_LINE_RULES) => number;
  visibleHatches: HatchSpec[];
}

/** Resolve the §14.2 drafting paint set for a given plot scale. */
export function draftingPaintFor(plotScale: number): DraftingPaint {
  const grid = gridVisibilityFor(plotScale);
  const visibleHatches = Object.values(HATCH_SPECS).filter((h) => hatchVisibleAt(plotScale, h));
  return {
    paperToken: '--draft-paper',
    grid,
    visibleHatches,
    lineWidthPx(role) {
      const rule = CATEGORY_LINE_RULES[role as string];
      if (!rule) return 1;
      return lineWidthPxFor(rule.weight, plotScale);
    },
  };
}
