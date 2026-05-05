/**
 * Motion grammar — spec §21.
 *
 * Pure-data motion budget mirroring the §21 surface table. Components
 * read these constants when composing CSS transitions / animations so a
 * spec change lights up everywhere.
 *
 * Honors `prefers-reduced-motion`: `motionFor(surface, options)` returns
 * the documented duration unless `reducedMotion` is true, in which case
 * everything collapses to `0 ms` per §21.
 */

export type MotionSurface =
  | 'mode-switch'
  | 'panel-slide'
  | 'view-cube-snap'
  | 'snap-pill'
  | 'tool-palette-hover'
  | 'toast'
  | 'inspector-tab-change'
  | 'selection-halo';

export type MotionToken = '--motion-fast' | '--motion-base' | '--motion-slow';
export type EaseToken = '--ease-out' | '--ease-in-out' | '--ease-snap';

export interface MotionSpec {
  surface: MotionSurface;
  durationMs: number;
  durationToken: MotionToken | null;
  easeToken: EaseToken | null;
  /** Allowed transform/opacity pair documented in §21. */
  channels: Array<'opacity' | 'transform'>;
  /** Optional secondary transform (e.g. scale on hover). */
  scale?: number;
  /** Optional translate-X distance (px) for slide transitions. */
  translateXPx?: number;
}

export const MOTION_TABLE: Record<MotionSurface, MotionSpec> = {
  'mode-switch': {
    surface: 'mode-switch',
    durationMs: 240,
    durationToken: '--motion-slow',
    easeToken: '--ease-out',
    channels: ['opacity', 'transform'],
    translateXPx: 4,
  },
  'panel-slide': {
    surface: 'panel-slide',
    durationMs: 140,
    durationToken: '--motion-base',
    easeToken: '--ease-out',
    channels: ['transform'],
  },
  'view-cube-snap': {
    surface: 'view-cube-snap',
    durationMs: 240,
    durationToken: '--motion-slow',
    easeToken: '--ease-snap',
    channels: ['transform'],
  },
  'snap-pill': {
    surface: 'snap-pill',
    durationMs: 80,
    durationToken: '--motion-fast',
    easeToken: '--ease-out',
    channels: ['opacity', 'transform'],
    scale: 1.05,
  },
  'tool-palette-hover': {
    surface: 'tool-palette-hover',
    durationMs: 80,
    durationToken: '--motion-fast',
    easeToken: '--ease-out',
    channels: ['opacity', 'transform'],
    scale: 1.04,
  },
  toast: {
    surface: 'toast',
    durationMs: 140,
    durationToken: '--motion-base',
    easeToken: '--ease-out',
    channels: ['transform'],
  },
  'inspector-tab-change': {
    surface: 'inspector-tab-change',
    durationMs: 80,
    durationToken: '--motion-fast',
    easeToken: '--ease-out',
    channels: ['opacity'],
  },
  'selection-halo': {
    surface: 'selection-halo',
    durationMs: 0,
    durationToken: null,
    easeToken: null,
    channels: [],
  },
};

export interface MotionOptions {
  /** When true, the resolved spec collapses to 0 ms per §21. */
  reducedMotion?: boolean;
}

export function motionFor(surface: MotionSurface, options: MotionOptions = {}): MotionSpec {
  const base = MOTION_TABLE[surface];
  if (options.reducedMotion) {
    return { ...base, durationMs: 0, scale: undefined, translateXPx: undefined };
  }
  return base;
}

/** Compose a CSS `transition` shorthand for the given surface. */
export function transitionCSS(surface: MotionSurface, options: MotionOptions = {}): string {
  const spec = motionFor(surface, options);
  if (!spec.channels.length || spec.durationMs === 0) return 'none';
  const ease = spec.easeToken ? `var(${spec.easeToken})` : 'ease';
  const dur = spec.durationToken ? `var(${spec.durationToken})` : `${spec.durationMs}ms`;
  return spec.channels.map((c) => `${c} ${dur} ${ease}`).join(', ');
}

/** Spec sanity rule: every surface duration must be ≤ 240 ms. */
export function maxDurationMs(): number {
  return Math.max(...Object.values(MOTION_TABLE).map((s) => s.durationMs));
}
