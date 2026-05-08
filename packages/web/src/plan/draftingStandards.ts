/**
 * Drafting standards — spec §9.10 + §26.
 *
 * Single source of truth for plan-canvas line weights, dash patterns,
 * stroke colors (drafting tokens), and category-specific role mappings.
 * Consumed by `PlanCanvas.tsx` and `plan/symbology/*` so a token / spec
 * update lights up everywhere.
 */

export type LineWeightTokenName =
  | '--draft-lw-cut-major'
  | '--draft-lw-cut-minor'
  | '--draft-lw-projection-major'
  | '--draft-lw-projection-minor'
  | '--draft-lw-hidden'
  | '--draft-lw-witness'
  | '--draft-lw-construction';

export type DraftingColorTokenName =
  | '--draft-paper'
  | '--draft-grid-major'
  | '--draft-grid-minor'
  | '--draft-construction-blue'
  | '--draft-witness'
  | '--draft-cut'
  | '--draft-projection'
  | '--draft-hidden'
  | '--draft-selection'
  | '--draft-hover'
  | '--draft-snap';

export type CategoryColorTokenName =
  | '--cat-wall'
  | '--cat-floor'
  | '--cat-roof'
  | '--cat-door'
  | '--cat-window'
  | '--cat-stair'
  | '--cat-railing'
  | '--cat-room'
  | '--cat-site'
  | '--cat-section'
  | '--cat-sheet';

/** Canonical line-weight px values at 1:50 plot scale. Mirrors §9.10. */
export const LINE_WEIGHT_PX_AT_1_50: Record<LineWeightTokenName, number> = {
  '--draft-lw-cut-major': 2.0,
  '--draft-lw-cut-minor': 1.4,
  '--draft-lw-projection-major': 1.0,
  '--draft-lw-projection-minor': 0.7,
  '--draft-lw-hidden': 0.7,
  '--draft-lw-witness': 0.5,
  '--draft-lw-construction': 0.5,
};

/** Reference plot scale anchor for `LINE_WEIGHT_PX_AT_1_50`. */
export const REFERENCE_PLOT_SCALE = 50;

/** Compute the px width of a line-weight token at an arbitrary plot
 * scale (where `plotScale` is the denominator of `1:N`). Larger
 * denominators (e.g. 1:200) shrink the line; smaller (1:5) widen it. */
export function lineWidthPxFor(token: LineWeightTokenName, plotScale: number): number {
  const base = LINE_WEIGHT_PX_AT_1_50[token];
  if (!Number.isFinite(plotScale) || plotScale <= 0) return base;
  return base * (REFERENCE_PLOT_SCALE / plotScale);
}

/** Spec §26 stroke style for category line roles. */
export type DashStyle =
  | { kind: 'solid' }
  | { kind: 'dashed'; on: number; off: number }
  | { kind: 'dash-dot'; pattern: [number, number, number, number] };

export interface CategoryLineRule {
  weight: LineWeightTokenName;
  color: DraftingColorTokenName | CategoryColorTokenName;
  dash: DashStyle;
  /** Multiplicative opacity [0..1]; used by §26 below-cut projections. */
  opacity?: number;
}

/** §26 line-role table for the redesign. Keys are the canonical role names
 * referenced by symbology; values plug straight into the renderer. */
export const CATEGORY_LINE_RULES: Record<string, CategoryLineRule> = {
  'wall.cut': {
    weight: '--draft-lw-cut-major',
    color: '--draft-cut',
    dash: { kind: 'solid' },
  },
  'door.cut': {
    weight: '--draft-lw-cut-minor',
    color: '--draft-cut',
    dash: { kind: 'solid' },
  },
  'window.cut': {
    weight: '--draft-lw-cut-minor',
    color: '--draft-cut',
    dash: { kind: 'solid' },
  },
  'floor.projection': {
    weight: '--draft-lw-projection-minor',
    color: '--draft-projection',
    dash: { kind: 'solid' },
    opacity: 0.6,
  },
  'roof.projection': {
    weight: '--draft-lw-projection-minor',
    color: '--draft-projection',
    dash: { kind: 'dash-dot', pattern: [4, 2, 1, 2] },
  },
  'stair.tread': {
    weight: '--draft-lw-cut-minor',
    color: '--draft-cut',
    dash: { kind: 'solid' },
  },
  'stair.direction': {
    weight: '--draft-lw-projection-major',
    color: '--draft-projection',
    dash: { kind: 'solid' },
  },
  hidden: {
    weight: '--draft-lw-hidden',
    color: '--draft-hidden',
    dash: { kind: 'dashed', on: 4, off: 3 },
  },
  'dimension.witness': {
    weight: '--draft-lw-witness',
    color: '--draft-witness',
    dash: { kind: 'solid' },
  },
  construction: {
    weight: '--draft-lw-construction',
    color: '--draft-construction-blue',
    dash: { kind: 'solid' },
  },
};

/** Convert a `DashStyle` to an SVG `stroke-dasharray` value (or null for
 * solid). Multiplied by `widthPx` to keep the dash gauge proportional. */
export function dashArray(style: DashStyle, widthPx: number): string | null {
  if (style.kind === 'solid') return null;
  if (style.kind === 'dashed') {
    return `${style.on * widthPx} ${style.off * widthPx}`;
  }
  return style.pattern.map((n) => n * widthPx).join(' ');
}

/* ────────────────────────────────────────────────────────────────────── */
/* Hatches — spec §26                                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type HatchKind = 'wall.concrete' | 'floor.timber' | 'site.lawn';

export interface HatchSpec {
  kind: HatchKind;
  /** Stroke width in mm at the 1:50 reference. */
  widthMm: number;
  /** Spacing between strokes in mm. */
  spacingMm: number;
  /** Angle in degrees CCW from +x. */
  angleDeg: number;
  /** Token used for the stroke. */
  color: DraftingColorTokenName | CategoryColorTokenName;
  /** Min plot scale (denominator) at which the hatch becomes visible. */
  visibleAtScaleAtMost: number;
}

export const HATCH_SPECS: Record<HatchKind, HatchSpec> = {
  'wall.concrete': {
    kind: 'wall.concrete',
    widthMm: 0.5,
    spacingMm: 1,
    angleDeg: 45,
    color: '--cat-wall',
    visibleAtScaleAtMost: 200,
  },
  'floor.timber': {
    kind: 'floor.timber',
    widthMm: 0.5,
    spacingMm: 0.7,
    angleDeg: 0,
    color: '--cat-floor',
    visibleAtScaleAtMost: 200,
  },
  'site.lawn': {
    kind: 'site.lawn',
    widthMm: 0.3,
    spacingMm: 1.5,
    angleDeg: 90,
    color: '--cat-site',
    visibleAtScaleAtMost: 200,
  },
};

/** True when a hatch should render at the current plot scale (1:N). */
export function hatchVisibleAt(plotScale: number, hatch: HatchSpec): boolean {
  return plotScale <= hatch.visibleAtScaleAtMost;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Grid step                                                               */
/* ────────────────────────────────────────────────────────────────────── */

/** Per §14.5 / §14.2: major grid 1 m, minor grid 100 mm; minor only
 * shown at 1:100 or finer; no grid above 1:200. */
export interface GridVisibility {
  showMajor: boolean;
  showMinor: boolean;
}

export function gridVisibilityFor(plotScale: number): GridVisibility {
  if (plotScale <= 100) return { showMajor: true, showMinor: true };
  if (plotScale <= 200) return { showMajor: true, showMinor: false };
  return { showMajor: false, showMinor: false };
}

/* ────────────────────────────────────────────────────────────────────── */
/* CAN-V3-01 — structured line-weight set per plot scale                   */
/* ────────────────────────────────────────────────────────────────────── */

export interface LineWeights {
  cutMajor: number;
  cutMinor: number;
  /** null = suppressed at 1:500+ (omit the draw call entirely). */
  projMajor: number | null;
  projMinor: number | null;
  witness: number;
  /** null = grid pass suppressed per gridVisibilityFor. */
  gridMajor: number | null;
  gridMinor: number | null;
}

/**
 * Returns calibrated line-weight px values for the given plot scale
 * denominator (50 | 100 | 200 | 500 or any interpolated value).
 * At 1:500 projection lines return null (suppress entirely).
 * Grid nullability follows gridVisibilityFor.
 */
export function lineWeightsForScale(scaleDenominator: number): LineWeights {
  const grid = gridVisibilityFor(scaleDenominator);
  const suppress = scaleDenominator >= 500;
  return {
    cutMajor: lineWidthPxFor('--draft-lw-cut-major', scaleDenominator),
    cutMinor: lineWidthPxFor('--draft-lw-cut-minor', scaleDenominator),
    projMajor: suppress ? null : lineWidthPxFor('--draft-lw-projection-major', scaleDenominator),
    projMinor: suppress ? null : lineWidthPxFor('--draft-lw-projection-minor', scaleDenominator),
    witness: lineWidthPxFor('--draft-lw-witness', scaleDenominator),
    gridMajor: grid.showMajor ? 1 : null,
    gridMinor: grid.showMinor ? 0.5 : null,
  };
}
