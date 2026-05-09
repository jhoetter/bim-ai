/**
 * EDT-V3-09 — TypeScript port of the Python rebalance_treads() solver.
 *
 * Mirrors app/bim_ai/stair/autobalance.py exactly so that the live-preview
 * drag state is consistent with what the engine will persist on mouse-up.
 */

import type { StairTreadLine } from '@bim-ai/core';

/**
 * Rebalance tread lines after dragging one, keeping the total run constant.
 *
 * Locked treads (manualOverride=true) keep their width unchanged.
 * Unlocked treads (excluding the moved one) redistribute equally.
 *
 * @param treadLines  Current tread line array.
 * @param movedIndex  Index of the dragged tread.
 * @param newFromXMm  New X origin (mm) for the moved tread.
 * @param totalRunMm  Total run length of the stair (mm) — must stay constant.
 * @returns New tread line array with rebalanced widths.
 */
export function rebalanceTreads(
  treadLines: StairTreadLine[],
  movedIndex: number,
  newFromXMm: number,
  totalRunMm: number,
): StairTreadLine[] {
  if (treadLines.length === 0 || movedIndex < 0 || movedIndex >= treadLines.length) {
    return treadLines;
  }

  const n = treadLines.length;
  const result: StairTreadLine[] = treadLines.map((t) => ({ ...t }));

  // Place the moved tread at the new X position, preserving its width.
  const moved = result[movedIndex]!;
  const treadWidth = Math.abs(moved.toMm.xMm - moved.fromMm.xMm);
  result[movedIndex] = {
    ...moved,
    fromMm: { xMm: newFromXMm, yMm: moved.fromMm.yMm },
    toMm: { xMm: newFromXMm + treadWidth, yMm: moved.toMm.yMm },
  };

  // Collect unlocked tread indices (excluding the moved one).
  const unlockedIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i !== movedIndex && !result[i]!.manualOverride) {
      unlockedIndices.push(i);
    }
  }

  if (unlockedIndices.length === 0) {
    return result;
  }

  // Compute remaining run for unlocked treads.
  let lockedRun = 0;
  for (let i = 0; i < n; i++) {
    if (i !== movedIndex && result[i]!.manualOverride) {
      lockedRun += Math.abs(result[i]!.toMm.xMm - result[i]!.fromMm.xMm);
    }
  }

  const movedRun = Math.abs(result[movedIndex]!.toMm.xMm - result[movedIndex]!.fromMm.xMm);
  const remainingRun = totalRunMm - lockedRun - movedRun;

  if (remainingRun <= 0) {
    return result;
  }

  // Distribute remaining run equally among unlocked treads.
  const newWidth = remainingRun / unlockedIndices.length;
  for (const i of unlockedIndices) {
    const t = result[i]!;
    result[i] = {
      ...t,
      toMm: { xMm: t.fromMm.xMm + newWidth, yMm: t.toMm.yMm },
    };
  }

  return result;
}
