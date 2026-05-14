/**
 * Plan canvas state — spec §14.
 *
 * Pure-state controllers that compose the redesigned plan canvas. Each
 * controller is testable without DOM/canvas; the visual layer in
 * `PlanCanvas.tsx` consumes them in WP-UI-B01 and beyond.
 *
 * This module composes WP-UI-B01 (drafting paint state), WP-UI-B02
 * (snap engine + pointer classifier), and WP-UI-B03 (plan camera).
 */

import {
  CATEGORY_LINE_RULES,
  gridVisibilityFor,
  HATCH_SPECS,
  hatchVisibleAt,
  lineWeightsForScale,
  lineWidthPxFor,
  type HatchSpec,
  type LineWeights,
} from './draftingStandards';

/* ────────────────────────────────────────────────────────────────────── */
/* B01 — Drafting paint state                                              */
/* ────────────────────────────────────────────────────────────────────── */

export interface DraftingPaint {
  paperToken: '--draft-paper';
  grid: { showMajor: boolean; showMinor: boolean };
  lineWidthPx: (token: keyof typeof CATEGORY_LINE_RULES) => number;
  visibleHatches: HatchSpec[];
  /** CAN-V3-01 — structured line-weight set; renderer skips draw calls when null. */
  lineWeights: LineWeights;
}

export type { LineWeights };

/** Resolve the §14.2 drafting paint set for a given plot scale. */
export function draftingPaintFor(plotScale: number): DraftingPaint {
  const grid = gridVisibilityFor(plotScale);
  const visibleHatches = Object.values(HATCH_SPECS).filter((h) => hatchVisibleAt(plotScale, h));
  const lineWeights = lineWeightsForScale(plotScale);
  return {
    paperToken: '--draft-paper',
    grid,
    visibleHatches,
    lineWeights,
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
  if ((event.ctrlKey || event.metaKey) && event.button === 0) return 'add-to-selection';
  if (event.shiftKey && event.button === 0) return 'add-to-selection';
  if (event.altKey && event.button === 0) return 'toggle-selection';
  if (event.button === 0) {
    if (event.dragDirection === 'right-to-left') return 'marquee-crossing';
    if (event.dragDirection === 'left-to-right') return 'marquee-window';
    return 'drag-move';
  }
  return 'idle';
}

/* ────────────────────────────────────────────────────────────────────── */
/* B03 — Plan camera                                                        */
/* ────────────────────────────────────────────────────────────────────── */

export interface PlanCameraSnapshot {
  plotScale: number; // 1:N denominator
  centerMm: { xMm: number; yMm: number };
  activeLevelId: string;
}

export interface PlanCameraConfig {
  /** Min/max plot scale denominator (5 → very zoomed, 5000 → far out). */
  minScale: number;
  maxScale: number;
}

const CAMERA_DEFAULTS: PlanCameraConfig = { minScale: 5, maxScale: 5000 };

export class PlanCamera {
  private snapshotState: PlanCameraSnapshot;
  private config: PlanCameraConfig;
  private levelOrder: string[];

  constructor(
    initial: PlanCameraSnapshot,
    levelOrder: string[],
    config: Partial<PlanCameraConfig> = {},
  ) {
    this.snapshotState = { ...initial, centerMm: { ...initial.centerMm } };
    this.config = { ...CAMERA_DEFAULTS, ...config };
    this.levelOrder = [...levelOrder];
  }

  snapshot(): PlanCameraSnapshot {
    return {
      plotScale: this.snapshotState.plotScale,
      centerMm: { ...this.snapshotState.centerMm },
      activeLevelId: this.snapshotState.activeLevelId,
    };
  }

  /** Wheel zoom; positive `delta` zooms out (numerator increases). */
  wheelZoom(delta: number, anchorMm?: { xMm: number; yMm: number }): void {
    const { minScale, maxScale } = this.config;
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const next = clamp(this.snapshotState.plotScale * factor, minScale, maxScale);
    if (anchorMm) {
      // Anchor zoom: shift center toward anchor proportional to scale change.
      const ratio = 1 - this.snapshotState.plotScale / next;
      this.snapshotState.centerMm = {
        xMm:
          this.snapshotState.centerMm.xMm +
          (anchorMm.xMm - this.snapshotState.centerMm.xMm) * ratio,
        yMm:
          this.snapshotState.centerMm.yMm +
          (anchorMm.yMm - this.snapshotState.centerMm.yMm) * ratio,
      };
    }
    this.snapshotState.plotScale = next;
  }

  /** Pan by world-mm delta. */
  panMm(dxMm: number, dyMm: number): void {
    this.snapshotState.centerMm = {
      xMm: this.snapshotState.centerMm.xMm + dxMm,
      yMm: this.snapshotState.centerMm.yMm + dyMm,
    };
  }

  /** Zoom-to-fit a bbox; `padding` in mm. */
  fit(
    bbox: { minMm: { xMm: number; yMm: number }; maxMm: { xMm: number; yMm: number } },
    padding = 1000,
  ): void {
    const cx = (bbox.minMm.xMm + bbox.maxMm.xMm) / 2;
    const cy = (bbox.minMm.yMm + bbox.maxMm.yMm) / 2;
    const span = Math.max(bbox.maxMm.xMm - bbox.minMm.xMm, bbox.maxMm.yMm - bbox.minMm.yMm, 1);
    const proposed = (span + padding * 2) / 100; // span 10 m → ~1:100
    this.snapshotState.centerMm = { xMm: cx, yMm: cy };
    this.snapshotState.plotScale = clamp(proposed, this.config.minScale, this.config.maxScale);
  }

  /** PageUp / PageDown level cycling per §14.6. */
  cycleLevel(direction: 'up' | 'down'): string {
    const idx = this.levelOrder.indexOf(this.snapshotState.activeLevelId);
    if (idx < 0) return this.snapshotState.activeLevelId;
    const delta = direction === 'down' ? 1 : -1;
    const nextIdx = (idx + delta + this.levelOrder.length) % this.levelOrder.length;
    const nextId = this.levelOrder[nextIdx]!;
    this.snapshotState.activeLevelId = nextId;
    return nextId;
  }

  /** Empty-state copy per §14.7. */
  emptyStateMessage(): { headline: string; hint: string } {
    return {
      headline: 'This level is empty.',
      hint: 'Press W to draw a wall, or insert the seed house from the Project menu.',
    };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
