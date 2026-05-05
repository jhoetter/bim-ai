/**
 * Plan canvas state — spec §14.
 *
 * Pure-state controllers that compose the redesigned plan canvas. Each
 * controller is testable without DOM/canvas; the visual layer in
 * `PlanCanvas.tsx` consumes them in WP-UI-B01 and beyond.
 *
 * This module exposes WP-UI-B01 (drafting paint state) and WP-UI-B02
 * (snap engine + pointer classifier). PlanCamera (WP-UI-B03) lands in
 * a follow-up commit.
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

/* ────────────────────────────────────────────────────────────────────── */
/* B02 — Snap engine                                                        */
/* ────────────────────────────────────────────────────────────────────── */

export type SnapMode =
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'perpendicular'
  | 'parallel'
  | 'tangent'
  | 'nearest'
  | 'grid'
  | 'polar';

export const SNAP_DEFAULTS: Record<SnapMode, boolean> = {
  endpoint: true,
  midpoint: true,
  intersection: true,
  perpendicular: true,
  parallel: true,
  tangent: false,
  nearest: true,
  grid: true,
  polar: true,
};

export interface SnapCandidate {
  mode: SnapMode;
  /** World-space mm coordinates of the snap target. */
  xMm: number;
  yMm: number;
  /** Optional human label appended to the pill (`from <endpoint>`). */
  detail?: string;
}

export class SnapEngine {
  private modes: Record<SnapMode, boolean>;

  constructor(initial: Partial<Record<SnapMode, boolean>> = {}) {
    this.modes = { ...SNAP_DEFAULTS, ...initial };
  }

  isOn(mode: SnapMode): boolean {
    return this.modes[mode];
  }

  toggle(mode: SnapMode): void {
    this.modes[mode] = !this.modes[mode];
  }

  setOn(mode: SnapMode, on: boolean): void {
    this.modes[mode] = on;
  }

  /** Cycle through snap modes (`F3`). Loops endpoint → midpoint → … →
   * polar → endpoint. Disables every other mode while one is active. */
  cycleExclusive(): SnapMode {
    const order: SnapMode[] = [
      'endpoint',
      'midpoint',
      'intersection',
      'perpendicular',
      'parallel',
      'tangent',
      'nearest',
      'grid',
      'polar',
    ];
    const currentIdx = order.findIndex((m) => this.modes[m]);
    const nextIdx = (currentIdx + 1) % order.length;
    for (const m of order) this.modes[m] = false;
    this.modes[order[nextIdx]!] = true;
    return order[nextIdx]!;
  }

  /** Resolve cursor against a list of candidates and return the
   * highest-priority snap. */
  resolve(candidates: SnapCandidate[]): SnapCandidate | null {
    const priority: SnapMode[] = [
      'endpoint',
      'midpoint',
      'intersection',
      'perpendicular',
      'parallel',
      'tangent',
      'nearest',
      'grid',
      'polar',
    ];
    for (const mode of priority) {
      if (!this.modes[mode]) continue;
      const hit = candidates.find((c) => c.mode === mode);
      if (hit) return hit;
    }
    return null;
  }

  /** Returns a labelled pill for the given snap, ready for §14.4
   * status-bar display. */
  pillLabel(candidate: SnapCandidate): string {
    const detail = candidate.detail ? ` · ${candidate.detail}` : '';
    return `${candidate.mode}${detail}`;
  }

  snapshot(): Record<SnapMode, boolean> {
    return { ...this.modes };
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* B02 — Pointer classifier                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export type PointerIntent =
  | 'pan'
  | 'marquee-window'
  | 'marquee-crossing'
  | 'drag-move'
  | 'add-to-selection'
  | 'toggle-selection'
  | 'draw'
  | 'idle';

export interface PointerStartLike {
  button: number;
  spacePressed?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  /** Active drawing tool from §16. */
  activeTool?:
    | 'select'
    | 'wall'
    | 'door'
    | 'window'
    | 'floor'
    | 'roof'
    | 'stair'
    | 'room'
    | 'dimension'
    | 'section'
    | 'tag';
  dragDirection?: 'left-to-right' | 'right-to-left' | null;
}

/** Map a pointer-down event to a §14.3 intent. */
export function classifyPointerStart(event: PointerStartLike): PointerIntent {
  if (event.spacePressed && event.button === 0) return 'pan';
  if (event.button === 1) return 'pan'; // middle-click pan
  if (event.activeTool && event.activeTool !== 'select') return 'draw';
  if (event.shiftKey && event.button === 0) return 'add-to-selection';
  if (event.altKey && event.button === 0) return 'toggle-selection';
  if (event.button === 0) {
    if (event.dragDirection === 'right-to-left') return 'marquee-crossing';
    if (event.dragDirection === 'left-to-right') return 'marquee-window';
    return 'drag-move';
  }
  return 'idle';
}
