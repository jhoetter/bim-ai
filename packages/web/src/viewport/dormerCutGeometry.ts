/**
 * Pure geometry helpers for the dormer/roof-opening CSG cut.
 *
 * Kept in a separate module so it can be unit-tested under jsdom
 * without dragging in `three-bvh-csg` (which crashes at import time
 * in jsdom because of a circular init in `three-mesh-bvh`). The CSG
 * driver in `dormerRoofCut.ts` consumes these helpers at runtime.
 */

/**
 * Issue #77 — vertical safety margin (m) by which the cutter starts
 * BELOW the eave. Just enough to guarantee the SUBTRACTION clips
 * cleanly through the roof's underside without leaving a sliver, but
 * small enough that it never reaches down into the wall mass below.
 */
export const DORMER_CUT_MARGIN_M = 0.05;

/**
 * Issue #77 — compute the vertical extent of the dormer/roof-opening
 * CSG cutter so that the SUBTRACTION carves the roof volume ONLY,
 * never the wall/floor mass beneath it.
 *
 * - When `eaveY` (top of wall = bottom of roof at the eave) is
 *   provided, the cutter starts {@link DORMER_CUT_MARGIN_M} below the
 *   eave so its bottom face is guaranteed to clip cleanly through the
 *   roof's underside without leaving a sliver.
 * - When `eaveY` is omitted (legacy call sites / synthetic tests), the
 *   cutter falls back to starting at `refElev` (ground floor). This
 *   preserves the pre-#77 behaviour for callers that haven't been
 *   migrated yet.
 *
 * The cutter is intentionally tall (30m) so a single box reliably
 * exceeds any sensible ridge height even for steep mansards.
 */
export function computeDormerCutVerticalExtent(
  refElev: number,
  eaveY: number | undefined,
): { baseY: number; cutHeightM: number } {
  const cutHeightM = 30;
  const baseY = eaveY != null ? eaveY - DORMER_CUT_MARGIN_M : refElev;
  return { baseY, cutHeightM };
}
