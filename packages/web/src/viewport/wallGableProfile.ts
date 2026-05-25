/**
 * Issue #109 — sample a wall's gable-shaped top profile for CSG hosting.
 *
 * Walls with ``roofAttachmentId`` pointing at a non-flat (gable / hip /
 * asymmetric / half-gable / mono-pitch …) roof are not rectangles —
 * their upper edge follows the underside of the roof, producing a
 * triangular zone above the rectangular wall body (Giebelverglasung).
 * Today's renderer treats walls as rectangles for CSG hole-cutting, so
 * windows hosted in that gable zone never cut visible apertures.
 *
 * This module is the pure-math helper used by ``useViewportSceneEffects``
 * to:
 *
 *   1. Sample the host roof's underside along the wall's plan segment.
 *   2. Detect whether the resulting profile rises above the rectangular
 *      wall height by a visible margin (anything below ``0.001`` m we
 *      treat as a flat-top rectangle so the existing fast path stays in
 *      place).
 *   3. Return the gable profile (per-sample wall-base-relative heights
 *      in metres) plus the peak height — which the CSG dispatcher uses
 *      to (a) build the worker job's sloped-top prism, and (b) widen
 *      the cutter clamps so a window whose sill / head land in the
 *      gable triangle don't get squashed back down to the eave.
 *
 * Pure-math only: takes a height-sampler callback so unit tests don't
 * need the full ``roofHeightSampler`` module loaded. The viewport
 * layer wires ``roofHeightAtPoint`` in as the callback.
 */

export type GableProfileSample = {
  /** Per-sample wall-base-relative heights (metres). length >= 2. */
  topProfileM: number[];
  /** Maximum sample (peak above wall base, in metres). */
  peakHeightM: number;
  /** Whether the profile actually rises above the rectangular wall top. */
  hasGable: boolean;
};

export type WallGableProfileInput = {
  /** Plan-start of the wall (mm). */
  startMm: { xMm: number; yMm: number };
  /** Plan-end of the wall (mm). */
  endMm: { xMm: number; yMm: number };
  /** Rectangular wall height (m), as used by CSG today. */
  rectangularHeightM: number;
  /** World y of the wall base (m). */
  yBaseM: number;
  /** Number of evenly distributed samples (>= 2). Default: derived from length. */
  sampleCount?: number;
  /**
   * Roof-height sampler — given a plan point in mm, returns the world y
   * of the underside of the host roof at that point (m). The viewport
   * layer wires ``roofHeightAtPoint(roof, elementsById, x, y)`` in here.
   */
  sampleRoofTopYM: (xMm: number, yMm: number) => number;
};

const VISIBLE_GABLE_MARGIN_M = 0.001;
const MIN_SAMPLES = 5;
const MAX_SAMPLES = 64;
/** ~250 mm spacing — matches the existing curtain-wall gable sampler. */
const SAMPLE_SPACING_M = 0.25;

export function sampleWallGableProfile(input: WallGableProfileInput): GableProfileSample {
  const dx = input.endMm.xMm - input.startMm.xMm;
  const dy = input.endMm.yMm - input.startMm.yMm;
  const lenM = Math.hypot(dx, dy) / 1000;

  const baseCount =
    input.sampleCount ??
    Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.ceil(lenM / SAMPLE_SPACING_M) + 1));
  const N = Math.max(2, baseCount);

  const topProfileM: number[] = new Array(N);
  let peakHeightM = input.rectangularHeightM;
  let hasGable = false;
  for (let i = 0; i < N; i += 1) {
    const t = i / (N - 1);
    const xMm = input.startMm.xMm + t * dx;
    const yMm = input.startMm.yMm + t * dy;
    const sampledTopYM = input.sampleRoofTopYM(xMm, yMm);
    // Clamp to at least the rectangular wall top so a sampling miss
    // (roof returns zero for an unrelated wall) can't accidentally
    // dent the wall below its eave.
    const heightAbsM = Math.max(input.rectangularHeightM, sampledTopYM - input.yBaseM);
    topProfileM[i] = heightAbsM;
    if (heightAbsM > peakHeightM) peakHeightM = heightAbsM;
    if (heightAbsM > input.rectangularHeightM + VISIBLE_GABLE_MARGIN_M) hasGable = true;
  }

  return { topProfileM, peakHeightM, hasGable };
}
